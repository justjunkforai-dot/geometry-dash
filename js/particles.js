/**
 * Pooled particle system (struct-of-arrays, fixed capacity, zero allocation per frame).
 * Particles live in world units (or screen units for UI pools) and are advanced with the
 * render delta time — they are purely visual and never affect gameplay.
 */
import { PARTICLE_CAP } from './config.js';

export const P_SQUARE = 0;
export const P_CIRCLE = 1;
export const P_SPARK = 2;
export const P_CONFETTI = 3;
export const P_RING = 4;

/** Small deterministic PRNG so effects don't depend on Math.random (handy for screenshots). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Particles {
  constructor(cap = PARTICLE_CAP) {
    this.cap = cap;
    this.limit = cap;
    this.n = 0;
    const f = () => new Float32Array(cap);
    this.x = f(); this.y = f(); this.vx = f(); this.vy = f();
    this.life = f(); this.max = f(); this.size = f(); this.rot = f(); this.vrot = f();
    this.grav = f(); this.drag = f(); this.grow = f();
    this.kind = new Uint8Array(cap);
    this.color = new Array(cap).fill('#fff');
    this.rand = mulberry32(1337);
  }

  /** Quality scale 0..1 from settings (Low/Med/High). */
  setQuality(q) { this.limit = Math.max(64, Math.floor(this.cap * q)); this.quality = q; }

  spawn(kind, x, y, vx, vy, life, size, color, grav = 0, drag = 0, vrot = 0, grow = 0) {
    if (this.n >= this.limit) return;
    const i = this.n++;
    this.kind[i] = kind;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.color[i] = color;
    this.grav[i] = grav; this.drag[i] = drag; this.rot[i] = this.rand() * 6.283; this.vrot[i] = vrot; this.grow[i] = grow;
  }

  /** Radial burst helper. */
  burst(x, y, count, color, opts = {}) {
    const q = this.quality === undefined ? 1 : this.quality;
    const n = Math.max(1, Math.round(count * (opts.exact ? 1 : q)));
    const speed = opts.speed || 200;
    const kind = opts.kind === undefined ? P_SQUARE : opts.kind;
    for (let k = 0; k < n; k++) {
      const a = (opts.angle !== undefined ? opts.angle : 0) + (opts.spread !== undefined ? (this.rand() - 0.5) * opts.spread : this.rand() * Math.PI * 2);
      const sp = speed * (0.35 + this.rand() * 0.65);
      this.spawn(kind, x + (this.rand() - 0.5) * (opts.jitter || 0), y + (this.rand() - 0.5) * (opts.jitter || 0),
        Math.cos(a) * sp, Math.sin(a) * sp, (opts.life || 0.6) * (0.6 + this.rand() * 0.4),
        (opts.size || 6) * (0.5 + this.rand() * 0.7), color, opts.grav || 0, opts.drag || 1.5,
        (this.rand() - 0.5) * (opts.spin || 12), opts.grow || 0);
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      const l = this.life[i] - dt;
      if (l <= 0) { this.kill(i); continue; }
      this.life[i] = l;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d;
      this.vy[i] = this.vy[i] * d - this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vrot[i] * dt;
      this.size[i] = Math.max(0, this.size[i] + this.grow[i] * dt);
      i++;
    }
  }

  /** Swap-remove keeps the pool dense. */
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.kind[i] = this.kind[j]; this.x[i] = this.x[j]; this.y[i] = this.y[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.life[i] = this.life[j]; this.max[i] = this.max[j];
    this.size[i] = this.size[j]; this.color[i] = this.color[j]; this.grav[i] = this.grav[j];
    this.drag[i] = this.drag[j]; this.rot[i] = this.rot[j]; this.vrot[i] = this.vrot[j]; this.grow[i] = this.grow[j];
  }

  clear() { this.n = 0; }

  /**
   * Draws all particles with the canvas in logical screen space: a particle at (x, y) lands at
   * (ox + x·scale·mirror, oy + y·scale·ySign).
   */
  draw(ctx, ox, oy, scale, ySign, mirror = 1) {
    if (!this.n) return;
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const a = this.life[i] / this.max[i];
      const sx = ox + (this.x[i]) * scale * mirror;
      const sy = oy + (this.y[i]) * scale * ySign;
      const s = this.size[i] * scale;
      ctx.globalAlpha = a < 1 ? a : 1;
      ctx.fillStyle = this.color[i];
      switch (this.kind[i]) {
        case P_CIRCLE:
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.5, 0, 6.2832);
          ctx.fill();
          break;
        case P_SPARK: {
          ctx.strokeStyle = this.color[i];
          ctx.lineWidth = Math.max(1, s * 0.35);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - this.vx[i] * 0.03 * scale * mirror, sy - this.vy[i] * 0.03 * scale * ySign);
          ctx.stroke();
          break;
        }
        case P_CONFETTI: {
          const c = Math.cos(this.rot[i]);
          ctx.fillRect(sx - s * 0.5 * c, sy - s * 0.3, s * c, s * 0.6);
          break;
        }
        case P_RING:
          ctx.strokeStyle = this.color[i];
          ctx.lineWidth = Math.max(1, 3 * scale * a);
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.5, 0, 6.2832);
          ctx.stroke();
          break;
        default: {
          const r = this.rot[i];
          const c = Math.cos(r) * s * 0.5, d = Math.sin(r) * s * 0.5;
          ctx.beginPath();
          ctx.moveTo(sx + c, sy + d);
          ctx.lineTo(sx - d, sy + c);
          ctx.lineTo(sx - c, sy - d);
          ctx.lineTo(sx + d, sy - c);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prevOp;
  }
}
