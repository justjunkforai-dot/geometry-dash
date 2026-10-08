/**
 * Level-building helper API. Levels are authored in code, in blocks, and mostly by music beat:
 *
 *   const b = new LevelBuilder(meta);
 *   b.spikesAt(16, 2);           // double spike centred under the apex of a jump pressed on beat 16
 *   b.block(b.x(20) + 2, 0, 3, 1);
 *   b.speed(32, 3);              // speed portal so that the new speed starts exactly on beat 32
 *   export default b.build();
 *
 * Beat → x mapping: levelTime(beat) = beat·60/bpm − offset; x(t) is piecewise linear in t with the
 * horizontal speed of each segment (segments start at speed portals). x(beat) returns the player's
 * centre x in blocks at that moment, so an input made exactly on the beat happens there.
 */
import { BLOCK, BASE_SPEED, SPEEDS, START_X, MODES } from '../config.js';
import { T, getDef } from '../objects.js';

const CUBE = MODES.cube;
/** Cube airtime on flat ground (s) and apex height (blocks). */
export const CUBE_AIRTIME = (2 * CUBE.jump) / CUBE.gravity;
export const CUBE_APEX = (CUBE.jump * CUBE.jump) / (2 * CUBE.gravity) / BLOCK;
/** Portal sensor reach ahead of the player centre (blocks): half player + half sensor width. */
const PORTAL_LEAD = (15 + 0.55 * BLOCK) / BLOCK;

const r2 = (v) => Math.round(v * 100) / 100;

export class LevelBuilder {
  constructor(meta) {
    this.meta = meta;
    this.objects = [];
    this.triggers = [];
    this.bpm = meta.bpm;
    this.offset = meta.offset || 0;
    this.segs = [{ t: 0, x: START_X, s: meta.startSpeed === undefined ? 1 : meta.startSpeed }];
    this.group = 0;
  }

  // ---- beat mapping ------------------------------------------------------------------------
  /** Level time (s) at which the music reaches `beat`. */
  time(beat) { return (beat * 60) / this.bpm - this.offset; }

  seg(t) {
    let s = this.segs[0];
    for (const g of this.segs) if (g.t <= t) s = g;
    return s;
  }

  /** Player centre x in blocks at a beat. */
  x(beat) {
    const t = this.time(beat);
    const s = this.seg(t);
    return (s.x + (t - s.t) * BASE_SPEED * SPEEDS[s.s]) / BLOCK;
  }

  /** Horizontal speed in blocks/s at a beat. */
  v(beat) { return (BASE_SPEED * SPEEDS[this.seg(this.time(beat)).s]) / BLOCK; }

  /** Blocks travelled per beat at that beat. */
  perBeat(beat) { return (this.v(beat) * 60) / this.bpm; }

  /** x (blocks) of the apex of a flat-ground cube jump pressed on `beat`. */
  apex(beat) { return this.x(beat) + (this.v(beat) * CUBE_AIRTIME) / 2; }

  /** x (blocks) where a cube jump pressed on `beat` comes back down to height `h` blocks. */
  landX(beat, h = 0) {
    const g = CUBE.gravity, v0 = CUBE.jump, y = h * BLOCK;
    const t = (v0 + Math.sqrt(Math.max(0, v0 * v0 - 2 * g * y))) / g;
    return this.x(beat) + this.v(beat) * t;
  }

  // ---- raw placement -----------------------------------------------------------------------
  /** Places an object by its centre (blocks). */
  put(key, x, y, opts = {}) {
    const id = typeof key === 'number' ? key : T(key);
    const a = [id, r2(x), r2(y), opts.rot || 0, opts.fx ? 1 : 0, opts.fy ? 1 : 0, opts.group || this.group || 0];
    if (opts.props) a.push(opts.props);
    while (a.length > 3 && !a[a.length - 1]) a.pop();
    this.objects.push(a);
    return this;
  }

  /** Places an object by the bottom-left cell of its footprint (blocks). */
  add(key, cx, cy, opts = {}) {
    const d = getDef(typeof key === 'number' ? key : T(key));
    const rot = opts.rot || 0;
    const sw = rot % 180 === 0 ? d.w : d.h, sh = rot % 180 === 0 ? d.h : d.w;
    return this.put(key, cx + sw / 2, cy + sh / 2, opts);
  }

  /** Runs `fn` with every object it places assigned to `group`. */
  inGroup(group, fn) {
    const prev = this.group;
    this.group = group;
    fn(this);
    this.group = prev;
    return this;
  }

  block(cx, cy, w = 1, h = 1, key = 'block', opts) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.add(key, cx + i, cy + j, opts);
    return this;
  }

  /** Column of blocks from cy up to cy + h. */
  pillar(cx, cy, h, key = 'block') { return this.block(cx, cy, 1, h, key); }

  platform(cx, cy, w, key = 'block') { return this.block(cx, cy, w, 1, key); }

  /** `n` floor spikes starting at cell cx on surface height cy. */
  spikes(cx, cy = 0, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) this.add(opts.small ? 'spikeSmall' : 'spike', cx + i, cy, opts.rot ? { rot: opts.rot } : {});
    return this;
  }

  /** `n` ceiling spikes hanging below the cell row cy (pointing down). */
  ceilSpikes(cx, cy, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) this.add(opts.small ? 'spikeSmall' : 'spike', cx + i, cy, { rot: 180 });
    return this;
  }

  /** Staircase of `n` steps going up (dir 1) or down (dir -1), each step w blocks wide. */
  stairs(cx, cy, n, dir = 1, w = 2) {
    for (let i = 0; i < n; i++) {
      const h = dir > 0 ? i + 1 : n - i;
      this.block(cx + i * w, cy, w, h);
    }
    return this;
  }

  /** A pit: low spikes filling `w` cells at floor height cy. */
  gap(cx, w, cy = 0) { return this.spikes(cx, cy, w, { small: true }); }

  /** Calls fn(i, dx) n times with an x offset of i * dx. */
  repeat(n, dx, fn) {
    for (let i = 0; i < n; i++) fn(i, i * dx);
    return this;
  }

  slope(cx, cy, opts = {}) { return this.add(opts.wide ? 'slope2' : 'slope', cx, cy, opts); }
  saw(x, y, size = 'M', opts = {}) { return this.put(`saw${size}`, x, y, opts); }
  pad(cx, cy, color = 'Yellow', opts = {}) { return this.add(`pad${color}`, cx, cy, opts); }
  orb(x, y, color = 'Yellow', opts = {}) { return this.put(`orb${color}`, x, y, opts); }
  coin(x, y) { return this.put('coin', x, y); }
  /** Portal centred at (x, y) blocks. */
  portal(key, x, y = 1.5, opts) { return this.put(key, x, y, opts); }
  deco(key, x, y, opts) { return this.put(key, x, y, opts); }
  text(x, y, text, opts = {}) { return this.put('text', x, y, { ...opts, props: { text, ...(opts.props || {}) } }); }

  trigger(key, x, props = {}, y = 8) {
    const a = [T(key), r2(x), r2(y)];
    if (Object.keys(props).length) a.push(props);
    this.triggers.push(a);
    return this;
  }

  end(x) { return this.put('end', x, 1.5); }

  // ---- beat-aware helpers ------------------------------------------------------------------
  /**
   * Speed portal placed so the player enters it exactly on `beat`; later beats map with the new
   * speed. Returns the portal x.
   */
  speed(beat, idx, y = 1) {
    const t = this.time(beat);
    const x = this.x(beat);
    this.put(`speed${idx}`, x + PORTAL_LEAD, y);
    this.segs.push({ t, x: x * BLOCK, s: idx });
    this.segs.sort((a, b) => a.t - b.t);
    return x + PORTAL_LEAD;
  }

  /** Any portal placed so that the player enters it on `beat`. */
  portalAt(beat, key, y = 1.5) {
    const x = this.x(beat) + PORTAL_LEAD;
    this.portal(key, x, y);
    return x;
  }

  /** n spikes (on surface height y) centred under the apex of a jump pressed on `beat`. */
  spikesAt(beat, n = 1, y = 0) {
    const cx = this.apex(beat) - n / 2;
    return this.spikes(cx, y, n);
  }

  /** The x of the left edge of a platform the cube lands on when jumping on `beat`. */
  platformAfterJump(beat, h) {
    return this.apex(beat) + 0.5;
  }

  build() {
    return { meta: this.meta, objects: this.objects, triggers: this.triggers };
  }
}
