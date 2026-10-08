/**
 * Draws a play session: assembles the scene for the renderer (interpolated camera/players,
 * shake, beat pulse) and paints the canvas HUD (progress bar, practice info, countdown, flash).
 */
import { VIEW_W, VIEW_H, BLOCK, TRAIL_POINTS, START_X } from './config.js';
import { ColorCache } from './color.js';

const lerp = (a, b, t) => a + (b - a) * t;
const hudCol = new ColorCache();

function playerView(v, p, a, g) {
  v.x = lerp(p.px, p.x, a);
  v.y = lerp(p.py, p.y, a);
  v.rot = lerp(p.prot, p.rot, a);
  v.mode = p.mode; v.grav = p.grav; v.mini = p.mini; v.twin = p.twin;
  v.w = p.w; v.h = p.h; v.air = !p.onGround; v.stride = g.stride;
  return v;
}

/** Beat pulse 0..1 from the music clock (falls back to level time when audio is off). */
function beatPulse(g) {
  const a = g.app.audio;
  if (a && a.musicPlaying()) return a.beatPulse();
  const bpm = g.meta.bpm || 120;
  const beat = ((g.sim.time + (g.meta.offset || 0)) * bpm) / 60;
  return Math.exp(-(beat - Math.floor(beat)) * 6);
}

export function drawGame(g, now) {
  const r = g.app.renderer;
  const sim = g.sim;
  const a = g.alpha === undefined ? 1 : g.alpha;
  const cam = sim.camera;
  let sc = g.scene;
  if (!sc) {
    sc = g.scene = {
      cam: { x: 0, y: 0, zoom: 1, mirror: 1, shx: 0, shy: 0 }, players: [],
      hooks: { under: (rr) => drawUnder(g, rr), over: null },
    };
    g.mirrorVis = sim.mirror ? -1 : 1;
  }
  const dt = Math.min(0.1, (now - (g.lastDraw || now)) / 1000);
  g.lastDraw = now;
  if (g.state !== 'paused') g.animTime = (g.animTime || 0) + dt;
  const mTarget = sim.mirror ? -1 : 1;
  g.mirrorVis += Math.sign(mTarget - g.mirrorVis) * Math.min(Math.abs(mTarget - g.mirrorVis), dt * 4);

  sc.world = sim.world;
  sc.colors = sim.outColors;
  sc.bg = g.meta.bg;
  sc.ground = g.meta.ground;
  sc.corridor = sim.corridor;
  sc.time = g.animTime;
  sc.dt = g.state === 'paused' ? 0 : dt;
  sc.pulse = g.settings.reduceFlash ? beatPulse(g) * 0.4 : beatPulse(g);
  sc.coins = sim.coins;
  sc.particles = g.particles;
  sc.icon = g.app.iconStyle;
  sc.snapBands = !g.bandsInit;
  g.bandsInit = true;

  const c = sc.cam;
  c.x = lerp(cam.px, cam.x, a);
  c.y = lerp(cam.py, cam.y, a);
  c.zoom = lerp(cam.pzoom, cam.zoom, a);
  // Visible mirror flip: a slightly eased scale through 0 (never exactly 0).
  const mv = g.mirrorVis;
  c.mirror = Math.abs(mv) < 0.02 ? 0.02 * Math.sign(mv || 1) : mv;
  let amp = g.shakeAmp;
  if (sim.shake) {
    const el = sim.time - sim.shake.t0;
    if (el < sim.shake.dur) amp += sim.shake.s * (1 - el / sim.shake.dur);
  }
  amp *= g.settings.shake * (g.settings.reduceMotion ? 0.3 : 1);
  c.shx = Math.sin(g.shakeT * 71) * amp;
  c.shy = Math.cos(g.shakeT * 53) * amp;

  sc.players.length = 0;
  if (g.state !== 'dead') {
    for (let i = 0; i < sim.players.length; i++) {
      const v = playerView(g.views[i] || (g.views[i] = {}), sim.players[i], a, g);
      if (g.state === 'complete') {
        // Fly into the end wall and shrink.
        const t = Math.min(1, g.completeT / 0.6);
        v.x += t * BLOCK * 3;
        v.rot -= t * 360;
        if (t >= 1) continue;
      }
      sc.players.push(v);
    }
  }
  r.drawScene(sc);
  drawHud(g, r);
}

function drawUnder(g, r) {
  const ctx = r.ctx;
  // Floating attempt counter at the level start.
  if (g.attemptText > 0 && !g.practice) {
    r.worldText(`Attempt ${g.attempt}`, START_X + BLOCK * 7, BLOCK * 4.2, 58, '#ffffff', Math.min(1, g.attemptText));
  }
  // Practice checkpoints.
  if (g.practice) {
    for (const cp of g.checkpoints) {
      r.toWorld();
      ctx.save();
      ctx.translate(cp.x - r.cx, cp.y - r.cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = cp.auto ? 'rgba(61,255,122,0.35)' : 'rgba(61,255,122,0.75)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / r.s;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }
  }
  drawTrail(g, r);
  if (g.streaks.length) {
    r.toWorld();
    ctx.lineCap = 'round';
    for (const s of g.streaks) {
      ctx.globalAlpha = Math.max(0, s.t / 0.25);
      ctx.strokeStyle = g.app.profile.colors.g;
      ctx.lineWidth = 14 / r.s * 3;
      ctx.beginPath(); ctx.moveTo(s.x - r.cx, s.y0 - r.cy); ctx.lineTo(s.x - r.cx, s.y1 - r.cy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawTrail(g, r) {
  const n = g.trailLen;
  if (n < 2 || g.state === 'dead') return;
  const ctx = r.ctx;
  const prof = g.app.profile;
  const tr = g.trail;
  r.toWorld();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const head = g.views[0];
  const wave = tr[((g.trailHead - 1 + TRAIL_POINTS) % TRAIL_POINTS) * 3 + 2] === 1;
  const maxPts = wave ? n : Math.min(n, 40);
  const chunks = 6;
  const per = Math.ceil(maxPts / chunks);
  const layers = wave ? [[18, 0.18, prof.colors.g], [7, 0.9, prof.colors.p1], [2.5, 1, '#ffffff']] : [[8, 0.35, prof.colors.g]];
  for (const [w, al, col] of layers) {
    ctx.strokeStyle = col;
    ctx.lineWidth = (w * (head && head.mini ? 0.6 : 1)) / r.s;
    for (let c = 0; c < chunks; c++) {
      const s0 = c * per, s1 = Math.min(maxPts - 1, (c + 1) * per);
      if (s0 >= s1) break;
      ctx.globalAlpha = al * (1 - c / chunks);
      ctx.beginPath();
      for (let k = s0; k <= s1; k++) {
        const idx = ((g.trailHead - 1 - k + TRAIL_POINTS * 2) % TRAIL_POINTS) * 3;
        let x = tr[idx], y = tr[idx + 1];
        if (k === 0 && head) { x = head.x; y = head.y; }
        if (k === s0) ctx.moveTo(x - r.cx, y - r.cy); else ctx.lineTo(x - r.cx, y - r.cy);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawHud(g, r) {
  const ctx = r.ctx;
  r.toScreen();
  const pct = g.percent;
  const hud = g.app.settings.hud !== false;
  if (hud) {
    const w = 720, h = 16, x = (VIEW_W - w) / 2, y = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 12);
    ctx.fill();
    const fillW = (w * Math.min(100, g.sim.progress * 100)) / 100;
    ctx.fillStyle = hudCol.get(g.sim.outColors.line);
    if (fillW > 1) { roundRect(ctx, x, y, fillW, h, 8); ctx.fill(); }
    const best = g.app.bestFor ? g.app.bestFor(g) : 0;
    if (best > 0 && best < 100) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + (w * best) / 100 - 2, y - 6, 4, h + 12);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 12);
    ctx.stroke();
    ctx.font = '800 30px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 5;
    const label = `${pct}%`;
    ctx.strokeText(label, x + w + 22, y + h / 2 + 1);
    ctx.fillText(label, x + w + 22, y + h / 2 + 1);
  }
  if (g.practice) {
    ctx.font = '800 28px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3dff7a';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 5;
    const t = `PRACTICE  ◆ ${g.checkpoints.length}`;
    ctx.strokeText(t, VIEW_W / 2, 78);
    ctx.fillText(t, VIEW_W / 2, 78);
  }
  if (g.state === 'countdown') {
    const n = Math.ceil(g.countdown);
    const f = g.countdown - Math.floor(g.countdown);
    ctx.font = `900 ${160 + f * 60}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.4 + f * 0.6;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(String(n), VIEW_W / 2, VIEW_H / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(n), VIEW_W / 2, VIEW_H / 2);
    ctx.globalAlpha = 1;
  }
  if (g.flash > 0) {
    ctx.globalAlpha = Math.min(1, g.flash);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
