/**
 * A play session: owns the Sim, advances it at the fixed rate from timestamped input, turns sim
 * events into effects/sound, and handles death → restart, practice checkpoints, pause with
 * countdown, and the completion sequence. Rendering of the session lives in gameview.js.
 */
import { DT, DT_MS, MAX_FRAME_GAP_MS, TRAIL_POINTS, BLOCK, COUNTDOWN_SECONDS, COLORS, START_X } from './config.js';
import { Sim } from './sim.js';
import { P_SQUARE, P_CIRCLE, P_SPARK, P_RING, P_CONFETTI } from './particles.js';
import { hsl, rgb } from './color.js';
import { drawGame } from './gameview.js';

export class Game {
  /**
   * @param app  shared services { renderer, input, audio, particles, settings, profile, hooks }
   * @param level level data { meta, objects, triggers }
   * @param opts { levelId, practice, start, playtest, attempts }
   */
  constructor(app, level, opts = {}) {
    this.app = app;
    this.level = level;
    this.opts = opts;
    this.sim = new Sim(level, { start: opts.start });
    this.meta = this.sim.meta;
    this.particles = app.particles;
    this.practice = !!opts.practice;
    this.checkpoints = [];
    this.attempt = 1;
    this.state = 'idle';
    this.inp = { held: false, pressed: false };
    this.trail = new Float32Array(TRAIL_POINTS * 3);
    this.trailHead = 0;
    this.trailLen = 0;
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.flash = 0;
    this.time = 0;
    this.countdown = 0;
    this.deathTimer = 0;
    this.completeT = 0;
    this.attemptText = 0;
    this.stride = 0;
    this.streaks = [];
    this.bestPct = 0;
    this.deathsThisPractice = 0;
    this.usedCheckpoint = false;
    this.lastAutoCp = 0;
    this.runHoldTicks = 0;
    this.listeners = [];
    this.views = [{}, {}];
  }

  get settings() { return this.app.settings; }
  get audio() { return this.app.audio; }

  start() {
    this.app.input.setGameplay(true);
    this.beginAttempt(true);
  }

  destroy() {
    this.app.input.setGameplay(false);
    if (this.audio) this.audio.stopMusic();
    this.particles.clear();
  }

  // ---- attempts ------------------------------------------------------------------------------
  beginAttempt(first = false) {
    const cp = this.practice ? this.checkpoints[this.checkpoints.length - 1] : null;
    if (cp) this.sim.restore(cp.snap); else this.sim.reset();
    if (this.opts.bot) this.opts.bot.i = 0;
    if (!first) this.attempt++;
    this.state = 'playing';
    this.clock = performance.now();
    this.app.input.flush();
    this.trailLen = 0;
    this.streaks.length = 0;
    this.completeT = 0;
    this.attemptText = cp ? 0 : 2.2;
    this.lastAutoCp = this.sim.time;
    this.runHoldTicks = 0;
    this.startMusic();
    this.emitHook('attempt', { attempt: this.attempt, practice: this.practice });
  }

  startMusic() {
    if (!this.audio) return;
    this.audio.playMusic(this.meta.song, this.sim.time + (this.meta.offset || 0), { practice: this.practice, bpm: this.meta.bpm });
  }

  restart() {
    if (this.state === 'complete') this.attempt = 0;
    this.checkpoints.length = this.practice ? this.checkpoints.length : 0;
    this.beginAttempt();
  }

  // ---- per-frame update ----------------------------------------------------------------------
  update(now, dt) {
    this.time += dt;
    const sim = this.sim;
    if (this.state === 'playing') {
      if (now - this.clock > MAX_FRAME_GAP_MS) this.clock = now - DT_MS;
      while (this.clock + DT_MS <= now) {
        this.clock += DT_MS;
        if (this.opts.bot) {
          const b = this.opts.bot.at(sim.tick + 1);
          this.inp.held = b.held;
          this.inp.pressed = b.pressed;
        } else this.app.input.sampleUntil(this.clock, this.inp);
        if (this.inp.held) this.runHoldTicks++;
        sim.step(this.inp);
        this.afterTick();
        if (sim.dead || sim.completed) break;
      }
      this.alpha = Math.min(1, (now - this.clock) / DT_MS);
      this.handleEvents();
      if (sim.dead) this.onDeath();
      else if (sim.completed) this.onComplete();
      else {
        if (this.practice) this.autoCheckpoint();
        if (this.audio) this.audio.syncMusic(sim.time + (this.meta.offset || 0));
      }
    } else {
      this.alpha = 1;
      this.handleEvents();
    }
    if (this.state === 'dead') {
      this.deathTimer -= dt;
      // Playtests return to the editor after a death (practice runs keep retrying).
      if (this.deathTimer <= 0) { if (this.opts.playtest && !this.practice) this.state = 'ended'; else this.beginAttempt(); }
    } else if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== before && this.countdown > 0 && this.audio) this.audio.sfx('tick');
      if (this.countdown <= 0) this.resumeNow();
    } else if (this.state === 'complete') {
      this.completeT += dt;
      if (this.completeT > 0.15 && this.completeT < 1.6 && Math.random() < dt * 6) this.firework();
    }
    if (this.attemptText > 0 && this.state === 'playing') this.attemptText -= dt * 0.35;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.shakeT += dt;
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 40);
    if (this.state !== 'paused') this.particles.update(dt);
    for (const s of this.streaks) s.t -= dt;
    while (this.streaks.length && this.streaks[0].t <= 0) this.streaks.shift();
  }

  /** Per-tick visuals that need the fixed rate (trail sampling, exhaust). */
  afterTick() {
    const sim = this.sim;
    const p = sim.players[0];
    const trail = this.app.profile.trail;
    if (p.mode === 'wave' || (trail && trail !== 'none')) {
      if ((sim.tick & 1) === 0) this.pushTrail(p.x, p.y, p.mode === 'wave' ? 1 : 0);
    } else this.trailLen = 0;
    const q = this.settings.particles;
    for (const pl of sim.players) {
      if ((pl.mode === 'ship' || pl.mode === 'swing') && sim.tick % (q > 0.6 ? 2 : 5) === 0) {
        const held = this.inp.held;
        const back = pl.x - Math.cos(pl.rot * Math.PI / 180) * pl.w * 0.55;
        const by = pl.y - Math.sin(pl.rot * Math.PI / 180) * pl.w * 0.55;
        this.particles.spawn(P_CIRCLE, back, by, -sim.vx * 0.4 - 60, (Math.random() - 0.5) * 40, held ? 0.35 : 0.2,
          held ? 9 : 6, held ? '#ffb347' : '#ff6a3d', 0, 2, 0, -14);
      }
      if ((pl.mode === 'cube' || pl.mode === 'robot' || pl.mode === 'ball' || pl.mode === 'spider') && pl.onGround && sim.tick % 9 === 0 && q > 0.3) {
        this.particles.spawn(P_SQUARE, pl.x - pl.w * 0.4, pl.y - pl.h * 0.5 * pl.grav, -60, 30 * pl.grav, 0.3, 4, this.app.profile.colors.p2, 0, 3, 8);
      }
      if (pl.mode === 'robot' || pl.mode === 'spider') this.stride += pl.onGround ? sim.vx * DT * 0.09 : 0;
    }
  }

  pushTrail(x, y, wave) {
    const i = this.trailHead * 3;
    this.trail[i] = x; this.trail[i + 1] = y; this.trail[i + 2] = wave;
    this.trailHead = (this.trailHead + 1) % TRAIL_POINTS;
    this.trailLen = Math.min(TRAIL_POINTS, this.trailLen + 1);
  }

  // ---- events → effects ------------------------------------------------------------------------
  handleEvents() {
    const ev = this.sim.events;
    if (!ev.length) return;
    const pc = this.particles;
    const prof = this.app.profile;
    const sfx = (n) => { if (this.audio) this.audio.sfx(n); };
    for (const e of ev) {
      switch (e.type) {
        case 'jump':
          if (e.a === 'cube' || e.a === 'robot') pc.burst(e.x - 8, e.y - 14, 5, prof.colors.p2, { speed: 90, life: 0.3, size: 5, angle: Math.PI * 0.8, spread: 1.2 });
          sfx('jump');
          this.emitHook('jump');
          break;
        case 'flip': sfx('flip'); pc.burst(e.x, e.y, 8, prof.colors.p1, { speed: 140, life: 0.3, size: 4, kind: P_CIRCLE }); this.emitHook('jump'); break;
        case 'land': pc.burst(e.x - 6, e.y, 6, prof.colors.p2, { speed: 80, life: 0.28, size: 4, angle: Math.PI, spread: 1.6 }); break;
        case 'orb-fx': {
          const c = COLORS.orb[e.a] || '#fff';
          pc.spawn(P_RING, e.x, e.y, 0, 0, 0.35, 30, c, 0, 0, 0, 160);
          pc.burst(e.x, e.y, 10, c, { speed: 160, life: 0.35, size: 5, kind: P_CIRCLE });
          sfx('orb');
          break;
        }
        case 'pad': {
          const c = COLORS.pad[e.a] || '#fff';
          pc.burst(e.x, e.y - 10, 14, c, { speed: 220, life: 0.4, size: 5, angle: Math.PI / 2, spread: 1.0, kind: P_SPARK });
          sfx('pad');
          break;
        }
        case 'portal': {
          const c = e.a === 'mode' ? COLORS.portal[e.b] : '#ffffff';
          pc.burst(e.x, e.y, 26, c || '#fff', { speed: 260, life: 0.5, size: 6, kind: P_CIRCLE, jitter: 40 });
          pc.spawn(P_RING, e.x, e.y, 0, 0, 0.45, 40, c || '#fff', 0, 0, 0, 260);
          sfx('portal');
          if (e.a === 'mirror' || e.a === 'dual') this.emitHook(e.a);
          break;
        }
        case 'speed':
          sfx(e.b ? 'whoosh' : 'portal');
          pc.burst(e.x, e.y, 18, COLORS.portal.speed[e.a], { speed: 300, life: 0.4, size: 5, kind: P_SPARK, angle: Math.PI, spread: 0.6 });
          break;
        case 'coin':
          pc.burst(e.x, e.y, 24, COLORS.coin, { speed: 220, life: 0.6, size: 6, kind: P_CIRCLE });
          pc.spawn(P_RING, e.x, e.y, 0, 0, 0.5, 30, COLORS.coin, 0, 0, 0, 200);
          sfx('coin');
          break;
        case 'teleport':
          this.streaks.push({ x: e.x, y0: e.y, y1: e.a, t: 0.25 });
          pc.burst(e.x, e.a, 10, prof.colors.p1, { speed: 160, life: 0.3, size: 5 });
          sfx('teleport');
          this.emitHook('jump');
          break;
        case 'orb': this.emitHook('jump'); break;
        case 'mode-left': this.emitHook('modeLeft', { mode: e.a, grazed: e.b }); break;
        case 'particles': {
          const pr = e.b;
          const kind = pr.kind === 'confetti' ? P_CONFETTI : pr.kind === 'sparks' ? P_SPARK : P_CIRCLE;
          pc.burst(e.x, e.y, Math.min(200, e.a || 30), pr.color || '#fff', { speed: 260, life: 0.8, size: 7, kind, grav: kind === P_CONFETTI ? 300 : 0 });
          break;
        }
        default: break;
      }
    }
    ev.length = 0;
  }

  explode(p) {
    const prof = this.app.profile;
    const pc = this.particles;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 120 + Math.random() * 380;
      pc.spawn(P_SQUARE, p.x, p.y, Math.cos(a) * sp + this.sim.vx * 0.2, Math.sin(a) * sp, 0.5 + Math.random() * 0.5,
        4 + Math.random() * 9, i % 3 ? prof.colors.p1 : prof.colors.p2, 260, 1.6, (Math.random() - 0.5) * 20);
    }
    pc.spawn(P_RING, p.x, p.y, 0, 0, 0.45, 20, '#ffffff', 0, 0, 0, 420);
    pc.burst(p.x, p.y, 16, '#ffffff', { speed: 420, life: 0.35, size: 6, kind: P_SPARK, exact: true });
  }

  onDeath() {
    const sim = this.sim;
    this.state = 'dead';
    this.deathTimer = this.opts.playtest && !this.practice ? Math.max(0.7, this.settings.restartDelay) : this.settings.restartDelay;
    for (const p of sim.players) this.explode(p);
    this.shakeAmp = 14;
    this.flash = this.settings.reduceFlash ? 0.15 : 0.55;
    if (this.audio) { this.audio.sfx('death'); this.audio.stopMusic(0.12); }
    const pct = Math.floor(sim.progress * 100);
    if (this.practice) this.deathsThisPractice++;
    this.emitHook('death', { pct, practice: this.practice, time: sim.time, holdTicks: this.runHoldTicks, jumps: sim.stats.jumps });
  }

  onComplete() {
    this.state = 'complete';
    this.completeT = 0;
    this.flash = this.settings.reduceFlash ? 0.15 : 0.6;
    if (this.audio) { this.audio.stopMusic(1.2); this.audio.sfx('complete'); }
    const p = this.sim.players[0];
    this.particles.burst(p.x + 40, p.y, 80, '#ffffff', { speed: 520, life: 1.0, size: 8, kind: P_SPARK, exact: true });
    this.emitHook('complete', {
      practice: this.practice, noDeaths: this.practice && this.deathsThisPractice === 0 && !this.usedCheckpoint,
      coins: this.sim.coins.slice(), time: this.sim.time, jumps: this.sim.stats.jumps, attempts: this.attempt,
      holdTicks: this.runHoldTicks,
    });
  }

  firework() {
    const c = this.sim.camera;
    const x = c.x + (Math.random() - 0.3) * 400;
    const y = c.y + 40 + Math.random() * 120;
    const col = rgb(hsl(Math.random() * 360, 1, 0.62));
    this.particles.burst(x, y, 36, col, { speed: 300, life: 1.1, size: 6, kind: P_CIRCLE, grav: 140 });
    this.particles.burst(x, y, 20, '#ffffff', { speed: 200, life: 0.6, size: 4, kind: P_SPARK });
    if (this.audio) this.audio.sfx('firework');
  }

  // ---- practice --------------------------------------------------------------------------------
  setPractice(on) {
    if (on === this.practice) return;
    this.practice = on;
    this.checkpoints.length = 0;
    this.deathsThisPractice = 0;
    this.usedCheckpoint = false;
    if (on) {
      if (this.state === 'playing') this.startMusic();
    } else this.beginAttempt();
    this.emitHook('practice', on);
  }

  placeCheckpoint(auto = false) {
    if (!this.practice || this.state !== 'playing') return;
    const p = this.sim.players[0];
    this.checkpoints.push({ snap: this.sim.snapshot(), x: p.x, y: p.y, auto });
    if (this.checkpoints.length > 200) this.checkpoints.shift();
    this.usedCheckpoint = true;
    if (!auto && this.audio) this.audio.sfx('checkpoint');
    this.particles.burst(p.x, p.y, 12, '#3dff7a', { speed: 120, life: 0.4, size: 5, kind: P_CIRCLE });
  }

  removeCheckpoint() {
    if (!this.practice || !this.checkpoints.length) return;
    this.checkpoints.pop();
    if (this.audio) this.audio.sfx('back');
  }

  autoCheckpoint() {
    const every = this.settings.autoCheckpoint;
    if (!every) return;
    const p = this.sim.players[0];
    const stable = p.onGround || p.mode === 'ship' || p.mode === 'wave' || p.mode === 'ufo' || p.mode === 'swing';
    if (stable && this.sim.time - this.lastAutoCp >= every) {
      this.lastAutoCp = this.sim.time;
      this.placeCheckpoint(true);
    }
  }

  // ---- pause -----------------------------------------------------------------------------------
  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return false;
    this.state = 'paused';
    this.app.input.setGameplay(false);
    if (this.audio) this.audio.pauseMusic();
    return true;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'countdown';
    this.countdown = this.settings.reduceMotion ? 1 : COUNTDOWN_SECONDS;
    if (this.audio) this.audio.sfx('tick');
  }

  resumeNow() {
    this.state = 'playing';
    this.clock = performance.now();
    this.app.input.setGameplay(true);
    this.startMusic();
  }

  // ---- hooks -----------------------------------------------------------------------------------
  emitHook(name, data) {
    const h = this.app.hooks && this.app.hooks[name];
    if (h) h(this, data);
  }

  /** Fast-forwards a bot-driven session to `seconds` of level time (tests and screenshots). */
  skipTo(seconds) {
    const sim = this.sim;
    const target = Math.round(seconds * 240);
    while (this.opts.bot && sim.tick < target && !sim.dead && !sim.completed) {
      const b = this.opts.bot.at(sim.tick + 1);
      sim.step(b);
      this.afterTick();
      sim.events.length = 0;
    }
    this.particles.clear();
    this.clock = performance.now();
    if (this.audio) this.audio.syncMusic(sim.time + (this.meta.offset || 0), true);
  }

  /** Current level progress in percent (0..100). */
  get percent() { return this.state === 'complete' ? 100 : Math.floor(this.sim.progress * 100); }

  render(now) { drawGame(this, now); }

  /** Start-x of the level for the floating attempt text. */
  static get startX() { return START_X + BLOCK * 3; }
}
