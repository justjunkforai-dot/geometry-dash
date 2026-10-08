/**
 * Deterministic game simulation: world + players + triggers + camera. DOM-free.
 * step(input) advances exactly one fixed tick; identical inputs give identical states.
 */
import {
  BASE_SPEED, SPEEDS, DT, BLOCK, CAMERA, CAMERA_SCALE, VIEW_W, VIEW_H, PLAYER_SCREEN_X, START_X,
} from './config.js';
import { World } from './level.js';
import { CHANNELS } from './objects.js';
import {
  createPlayer, stepPlayer, setMode, setMini, copyPlayer, corridorHeight,
} from './player.js';
import { fireTrigger, updateTweens, hexToRgb, finishTweens } from './triggers.js';

const MODE_INDEX = { cube: 0, ship: 1, ball: 2, ufo: 3, wave: 4, robot: 5, spider: 6, swing: 7 };
const DUAL_HEIGHT = 10 * BLOCK;

export class Sim {
  constructor(level, opts = {}) {
    this.world = level instanceof World ? level : new World(level);
    this.meta = this.world.meta;
    this.events = [];
    this.colors = {};
    this.outColors = {};
    this.pulse = {};
    for (const ch of CHANNELS) {
      this.colors[ch] = [0, 0, 0];
      this.outColors[ch] = [0, 0, 0];
      this.pulse[ch] = [0, 0, 0, 0];
    }
    this.camera = { x: 0, y: 0, zoom: 1, px: 0, py: 0, pzoom: 1, ty: 0, look: 0 };
    this.start = opts.start || null;
    this.reset();
  }

  get vx() { return BASE_SPEED * SPEEDS[this.speedIdx]; }
  get player() { return this.players[0]; }
  /** 0..1 progress through the level (by x). */
  get progress() {
    const p = this.players[0];
    return Math.max(0, Math.min(1, (p.x - START_X) / Math.max(1, this.world.endX - START_X)));
  }

  emit(type, x, y, a, b) {
    if (this.events.length >= 256) this.events.shift();
    this.events.push({ type, x, y, a, b, tick: this.tick });
  }

  reset() {
    const m = this.meta;
    this.tick = 0;
    this.time = 0;
    this.world.resetGroups();
    this.speedIdx = m.startSpeed | 0;
    this.mirror = false;
    this.dual = false;
    this.corridor = null;
    this.tweens = [];
    this.trigIdx = 0;
    this.shake = null;
    this.coins = this.world.coins.map(() => false);
    this.dead = false;
    this.completed = false;
    this.stats = { jumps: 0, holdTicks: 0 };
    this.events.length = 0;
    for (const ch of CHANNELS) {
      const c = hexToRgb(m.palette[ch]);
      this.colors[ch][0] = c[0]; this.colors[ch][1] = c[1]; this.colors[ch][2] = c[2];
      this.pulse[ch][3] = 0;
    }
    const p = createPlayer(m.startMode, m.startGravity === -1 ? -1 : 1, !!m.startMini);
    this.players = [p];
    this.camera.zoom = 1;
    this.corridor = this.corridorFor(p.mode, corridorHeight(p.mode) * 0.5);
    if (this.start) this.applyStart(this.start);
    if (p.grav < 0 && !this.corridor) p.y = 6 * BLOCK;
    updateTweens(this);
    this.initCamera();
  }

  /** Starts mid-level: fires earlier triggers instantly and applies a scanned portal state. */
  applyStart(st) {
    const trig = this.world.triggers;
    while (this.trigIdx < trig.length && trig[this.trigIdx].x <= st.x) fireTrigger(this, trig[this.trigIdx++]);
    finishTweens(this);
    const p = this.players[0];
    p.x = p.px = st.x;
    this.speedIdx = st.speed;
    this.mirror = !!st.mirror;
    p.grav = st.grav;
    setMini(p, !!st.mini);
    setMode(this, p, st.mode);
    this.corridor = st.corridor ? { ...st.corridor } : null;
    p.y = p.py = st.y !== undefined ? st.y : (this.corridor ? (p.grav > 0 ? this.corridor.floor + p.h / 2 : this.corridor.ceil - p.h / 2) : p.h / 2);
    if (st.dual) this.enableDual(p.y);
  }

  corridorFor(mode, centerY) {
    const h = corridorHeight(mode) || (this.dual ? DUAL_HEIGHT : 0);
    if (!h) return null;
    const floor = Math.max(0, Math.round((centerY - h / 2) / BLOCK) * BLOCK);
    return { floor, ceil: floor + h };
  }

  applyPortal(p, o) {
    const v = o.def.value;
    switch (o.def.action) {
      case 'mode': {
        if (p.mode === v && this.players.every((q) => q.mode === v)) return;
        for (const q of this.players) setMode(this, q, v);
        const c = this.corridorFor(v, o.y);
        if (c || !this.dual) this.corridor = c;
        this.emit('portal', o.x, o.y, 'mode', v);
        break;
      }
      case 'gravity':
        if (p.grav !== v) {
          p.grav = v;
          p.vy *= 0.5;
          p.onGround = false;
          this.emit('portal', o.x, o.y, 'gravity', v);
        }
        break;
      case 'size':
        if (p.mini !== v) {
          for (const q of this.players) setMini(q, v);
          this.emit('portal', o.x, o.y, 'size', v);
        }
        break;
      case 'speed':
        if (this.speedIdx !== v) {
          this.emit('speed', o.x, o.y, v, v > this.speedIdx ? 1 : 0);
          this.speedIdx = v;
        }
        break;
      case 'mirror':
        if (this.mirror !== v) { this.mirror = v; this.emit('portal', o.x, o.y, 'mirror', v); }
        break;
      case 'dual':
        if (v && !this.dual) { this.enableDual(o.y); this.emit('portal', o.x, o.y, 'dual', true); }
        if (!v && this.dual) { this.disableDual(); this.emit('portal', o.x, o.y, 'dual', false); }
        break;
      default:
        break;
    }
  }

  enableDual(centerY) {
    this.dual = true;
    const p = this.players[0];
    if (!this.corridor) {
      const floor = Math.max(0, Math.round((centerY - DUAL_HEIGHT / 2) / BLOCK) * BLOCK);
      this.corridor = { floor, ceil: floor + DUAL_HEIGHT };
    }
    const c = this.corridor;
    const t = copyPlayer(p);
    t.twin = true;
    t.grav = -p.grav;
    t.y = t.py = c.floor + c.ceil - p.y;
    t.vy = -p.vy;
    t.rot = t.prot = -p.rot;
    t.onGround = false;
    this.players.push(t);
  }

  disableDual() {
    this.dual = false;
    this.players.length = 1;
    if (!corridorHeight(this.players[0].mode)) this.corridor = null;
  }

  step(input) {
    if (this.dead || this.completed) return;
    this.tick++;
    this.time = this.tick * DT;
    if (input.held) this.stats.holdTicks++;
    updateTweens(this);
    if (this.world.pathObjects.length) this.world.updatePaths(this.time);
    const n = this.players.length;
    for (let i = 0; i < n && i < this.players.length; i++) {
      stepPlayer(this, this.players[i], input);
      if (this.dead) return;
    }
    const p = this.players[0];
    const trig = this.world.triggers;
    while (this.trigIdx < trig.length && trig[this.trigIdx].x <= p.x) fireTrigger(this, trig[this.trigIdx++]);
    this.updateCamera();
    if (p.x + p.w * 0.5 >= this.world.endX) {
      this.completed = true;
      this.emit('complete', p.x, p.y, 0, 0);
    }
  }

  viewW() { return VIEW_W / (CAMERA_SCALE * this.camera.zoom); }
  viewH() { return VIEW_H / (CAMERA_SCALE * this.camera.zoom); }

  cameraTargetY() {
    const c = this.camera;
    const vh = this.viewH();
    const cor = this.corridor;
    if (cor) {
      const ch = cor.ceil - cor.floor;
      const mid = (cor.floor + cor.ceil) * 0.5;
      if (ch <= vh - 16) return mid;
      const py = this.players[0].y;
      return Math.min(Math.max(py, cor.floor + vh * 0.5 - 20), cor.ceil - vh * 0.5 + 20);
    }
    let py = this.players[0].y;
    if (this.dual) py = (py + this.players[1].y) * 0.5;
    if (py > c.ty + CAMERA.deadUp) c.ty = py - CAMERA.deadUp;
    else if (py < c.ty - CAMERA.deadDown) c.ty = py + CAMERA.deadDown;
    return Math.max(-CAMERA.groundMargin + vh * 0.5, c.ty);
  }

  initCamera() {
    const c = this.camera;
    const p = this.players[0];
    c.look = CAMERA.lookahead * this.speedIdx;
    c.ty = p.y;
    c.x = p.x + this.viewW() * (0.5 - PLAYER_SCREEN_X) + c.look;
    c.y = this.cameraTargetY();
    c.px = c.x; c.py = c.y; c.pzoom = c.zoom;
  }

  updateCamera() {
    const c = this.camera;
    const p = this.players[0];
    c.px = c.x; c.py = c.y; c.pzoom = c.zoom;
    c.look += (CAMERA.lookahead * this.speedIdx - c.look) * (1 - Math.exp(-2 * DT));
    c.x = p.x + this.viewW() * (0.5 - PLAYER_SCREEN_X) + c.look;
    const rate = this.corridor ? CAMERA.corridorRate : CAMERA.followRate;
    c.y += (this.cameraTargetY() - c.y) * (1 - Math.exp(-rate * DT));
  }

  snapshot() {
    return {
      tick: this.tick, time: this.time, speedIdx: this.speedIdx, mirror: this.mirror, dual: this.dual,
      corridor: this.corridor ? { ...this.corridor } : null, trigIdx: this.trigIdx,
      players: this.players.map(copyPlayer),
      tweens: this.tweens.map((t) => ({ ...t, from: Array.isArray(t.from) ? t.from.slice() : t.from, to: Array.isArray(t.to) ? t.to.slice() : t.to })),
      shake: this.shake ? { ...this.shake } : null,
      coins: this.coins.slice(),
      colors: CHANNELS.map((ch) => this.colors[ch].slice()),
      groups: this.world.saveGroups(),
      camera: { ...this.camera },
      stats: { ...this.stats },
    };
  }

  restore(s) {
    this.tick = s.tick; this.time = s.time; this.speedIdx = s.speedIdx; this.mirror = s.mirror;
    this.dual = s.dual; this.corridor = s.corridor ? { ...s.corridor } : null; this.trigIdx = s.trigIdx;
    this.players = s.players.map(copyPlayer);
    this.tweens = s.tweens.map((t) => ({ ...t, from: Array.isArray(t.from) ? t.from.slice() : t.from, to: Array.isArray(t.to) ? t.to.slice() : t.to }));
    this.shake = s.shake ? { ...s.shake } : null;
    this.coins = s.coins.slice();
    CHANNELS.forEach((ch, i) => { for (let j = 0; j < 3; j++) this.colors[ch][j] = s.colors[i][j]; });
    for (const ch of CHANNELS) this.pulse[ch][3] = 0;
    this.world.loadGroups(s.groups);
    if (this.world.pathObjects.length) this.world.updatePaths(this.time);
    Object.assign(this.camera, s.camera);
    this.stats = { ...s.stats };
    this.dead = false;
    this.completed = false;
    this.events.length = 0;
    updateTweens(this);
  }

  /** FNV-1a digest of the gameplay-relevant state (used by determinism tests). */
  hash() {
    const v = [this.tick, this.speedIdx, this.mirror ? 1 : 0, this.dual ? 1 : 0, this.trigIdx,
      this.camera.x, this.camera.y, this.camera.zoom, this.dead ? 1 : 0, this.completed ? 1 : 0];
    for (const p of this.players) {
      v.push(p.x, p.y, p.vy, p.rot, p.grav, MODE_INDEX[p.mode], p.mini ? 1 : 0, p.onGround ? 1 : 0, p.buffer, p.coyote);
    }
    for (const ch of CHANNELS) v.push(...this.colors[ch]);
    v.push(...this.world.saveGroups());
    v.push(...this.coins.map((c) => (c ? 1 : 0)));
    const bytes = new Uint8Array(new Float64Array(v).buffer);
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
}

export { MODE_INDEX };
