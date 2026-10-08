/**
 * Trigger effects. Triggers fire when the (primary) player's x passes them and start tweens
 * that are advanced every tick from sim.time, so they are deterministic and snapshot-able.
 */
import { BLOCK } from './config.js';
import { EASINGS, CHANNELS } from './objects.js';

export function hexToRgb(hex) {
  let h = String(hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(c) {
  const v = (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
  return `#${v.toString(16).padStart(6, '0')}`;
}

function ease(name, u) { return (EASINGS[name] || EASINGS.linear)(u); }

export function fireTrigger(sim, t) {
  const pr = t.props;
  const now = sim.time;
  const world = sim.world;
  const group = pr.group ? world.groups.get(pr.group | 0) : null;
  switch (t.action) {
    case 'color':
      if (!sim.colors[pr.channel]) return;
      sim.tweens.push({ k: 'color', ch: pr.channel, from: sim.colors[pr.channel].slice(), to: hexToRgb(pr.color), t0: now, dur: +pr.duration || 0, e: 'linear' });
      break;
    case 'move':
      if (group) sim.tweens.push({ k: 'move', g: group.id, dx: (+pr.dx || 0) * BLOCK, dy: (+pr.dy || 0) * BLOCK, t0: now, dur: +pr.duration || 0, e: pr.easing, ax: 0, ay: 0 });
      break;
    case 'rotate':
      if (group) sim.tweens.push({ k: 'rotate', g: group.id, deg: +pr.degrees || 0, t0: now, dur: +pr.duration || 0, e: pr.easing, a: 0 });
      break;
    case 'scale':
      if (group) sim.tweens.push({ k: 'scale', g: group.id, from: group.scale, to: +pr.scale || 1, t0: now, dur: +pr.duration || 0, e: pr.easing });
      break;
    case 'alpha':
      if (group) sim.tweens.push({ k: 'alpha', g: group.id, from: group.alpha, to: Math.max(0, Math.min(1, +pr.alpha)), t0: now, dur: +pr.duration || 0, e: 'linear' });
      break;
    case 'toggle':
      if (group) { group.enabled = !!pr.on; world.applyGroup(group); }
      break;
    case 'pulse':
      if (!sim.colors[pr.channel]) return;
      sim.tweens.push({ k: 'pulse', ch: pr.channel, to: hexToRgb(pr.color), t0: now, fi: +pr.fadeIn || 0, hold: +pr.hold || 0, fo: +pr.fadeOut || 0 });
      break;
    case 'zoom':
      sim.tweens.push({ k: 'zoom', from: sim.camera.zoom, to: +pr.zoom || 1, t0: now, dur: +pr.duration || 0, e: pr.easing });
      break;
    case 'shake':
      sim.shake = { s: +pr.strength || 0, t0: now, dur: +pr.duration || 0 };
      break;
    case 'particles':
      sim.emit('particles', t.x, t.y, pr.count | 0, pr);
      break;
    default:
      break;
  }
}

const dirty = [];

/** Advances every active tween to sim.time and recomputes output colours. */
export function updateTweens(sim) {
  const world = sim.world;
  const now = sim.time;
  const tw = sim.tweens;
  dirty.length = 0;
  for (const ch of CHANNELS) {
    const p = sim.pulse[ch];
    p[3] = 0;
  }
  let w = 0;
  for (let i = 0; i < tw.length; i++) {
    const t = tw[i];
    let done;
    if (t.k === 'pulse') {
      const el = now - t.t0;
      const total = t.fi + t.hold + t.fo;
      let k;
      if (el < t.fi) k = t.fi > 0 ? el / t.fi : 1;
      else if (el < t.fi + t.hold) k = 1;
      else k = t.fo > 0 ? 1 - (el - t.fi - t.hold) / t.fo : 0;
      k = Math.max(0, Math.min(1, k));
      const p = sim.pulse[t.ch];
      if (k >= p[3]) { p[0] = t.to[0]; p[1] = t.to[1]; p[2] = t.to[2]; p[3] = k; }
      done = el >= total;
    } else {
      const u = t.dur > 0 ? Math.min(1, (now - t.t0) / t.dur) : 1;
      const e = ease(t.e, u);
      done = u >= 1;
      const g = t.g ? world.groups.get(t.g) : null;
      switch (t.k) {
        case 'color': {
          const c = sim.colors[t.ch];
          for (let j = 0; j < 3; j++) c[j] = t.from[j] + (t.to[j] - t.from[j]) * u;
          break;
        }
        case 'move':
          if (g) {
            const nx = t.dx * e, ny = t.dy * e;
            g.dx += nx - t.ax; g.dy += ny - t.ay;
            t.ax = nx; t.ay = ny;
            markDirty(g);
          }
          break;
        case 'rotate':
          if (g) { const na = t.deg * e; g.rot += na - t.a; t.a = na; markDirty(g); }
          break;
        case 'scale':
          if (g) { g.scale = t.from + (t.to - t.from) * e; markDirty(g); }
          break;
        case 'alpha':
          if (g) { g.alpha = t.from + (t.to - t.from) * e; markDirty(g); }
          break;
        case 'zoom':
          sim.camera.zoom = t.from + (t.to - t.from) * e;
          break;
        default:
          break;
      }
    }
    if (!done) tw[w++] = t;
  }
  tw.length = w;
  for (let i = 0; i < dirty.length; i++) world.applyGroup(dirty[i]);
  for (const ch of CHANNELS) {
    const c = sim.colors[ch];
    const p = sim.pulse[ch];
    const o = sim.outColors[ch];
    const k = p[3];
    o[0] = c[0] + (p[0] - c[0]) * k;
    o[1] = c[1] + (p[1] - c[1]) * k;
    o[2] = c[2] + (p[2] - c[2]) * k;
  }
}

function markDirty(g) {
  if (!g.dirty) { g.dirty = true; dirty.push(g); }
}

/** Instantly completes all tweens (used when starting a playtest mid-level). */
export function finishTweens(sim) {
  const end = 1e9;
  const saved = sim.time;
  sim.time = end;
  updateTweens(sim);
  sim.time = saved;
  sim.tweens.length = 0;
}
