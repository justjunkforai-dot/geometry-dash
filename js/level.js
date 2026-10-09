/**
 * Level runtime ("World"): turns compact level data into runtime objects, owns the spatial
 * grid used for collision queries, render buckets for culling, and group transforms that
 * triggers manipulate. DOM-free.
 */
import { BLOCK, GRID_CELL, SPIKE_HIT_W, SPIKE_HIT_H, SAW_HIT_R } from './config.js';
import { getDef } from './objects.js';

const RENDER_BUCKET = 4 * BLOCK;
const DEG = Math.PI / 180;

export const DEFAULT_META = {
  id: 'custom',
  name: 'Untitled',
  author: 'You',
  difficulty: 'normal',
  stars: 0,
  bpm: 128,
  song: 'firstSteps',
  offset: 0,
  bg: 'stars',
  ground: 'tiles',
  startMode: 'cube',
  startSpeed: 1,
  startGravity: 1,
  startMini: false,
  palette: { bg: '#120a3a', ground: '#1e1060', line: '#7af0ff', obj: '#5ef1ff', deco: '#ff5ce1' },
};

/** Fills in defaults so partially specified level files (or editor exports) are valid. */
export function normalizeLevel(data) {
  const meta = { ...DEFAULT_META, ...(data.meta || {}) };
  meta.palette = { ...DEFAULT_META.palette, ...((data.meta && data.meta.palette) || {}) };
  return { meta, objects: data.objects || [], triggers: data.triggers || [] };
}

/** sin/cos with exact values for multiples of 90° (keeps AABBs crisp). */
function trig(deg) {
  const r = ((deg % 360) + 360) % 360;
  if (r === 0) return [0, 1];
  if (r === 90) return [1, 0];
  if (r === 180) return [0, -1];
  if (r === 270) return [-1, 0];
  return [Math.sin(r * DEG), Math.cos(r * DEG)];
}

/**
 * Local (blocks, relative to centre) → world units. Rotation is clockwise in degrees,
 * applied after flips. Writes into out[i], out[i+1].
 */
function xf(o, lx, ly, out, i, rot = o.rot) {
  if (o.fx) lx = -lx;
  if (o.fy) ly = -ly;
  const [s, c] = trig(rot);
  const sc = o.scale * BLOCK;
  out[i] = o.x + (lx * c + ly * s) * sc;
  out[i + 1] = o.y + (-lx * s + ly * c) * sc;
}

const tmp = new Float64Array(8);

/** Recomputes the world-space collision/visual geometry of an object after it moved. */
export function updateGeometry(o) {
  const d = o.def;
  const half = (Math.max(d.w, d.h) * 0.5 + 0.5) * BLOCK * o.scale;
  // Visual bounds (generous, rotation-safe) used for culling.
  o.vx0 = o.x - half; o.vx1 = o.x + half; o.vy0 = o.y - half; o.vy1 = o.y + half;
  switch (o.kind) {
    case 'solid': {
      // Solids stay axis-aligned boxes: their footprint uses the rotation snapped to 90°.
      const b = d.solid;
      const r90 = Math.round(o.rot / 90) * 90;
      xf(o, b[0], b[1], tmp, 0, r90); xf(o, b[2], b[3], tmp, 2, r90);
      setBox(o, tmp[0], tmp[1], tmp[2], tmp[3]);
      break;
    }
    case 'slope': {
      const w = d.w * 0.5;
      const h = d.h * 0.5;
      // Unrotated triangle: (-w,-h) (w,-h) (w,h); hypotenuse (-w,-h)→(w,h), solid below.
      xf(o, -w, -h, tmp, 0); xf(o, w, -h, tmp, 2); xf(o, w, h, tmp, 4);
      const ax = tmp[0], ay = tmp[1], rx = tmp[2], ry = tmp[3], bx = tmp[4], by = tmp[5];
      if (ax <= bx) { o.hx0 = ax; o.hy0 = ay; o.hx1 = bx; o.hy1 = by; }
      else { o.hx0 = bx; o.hy0 = by; o.hx1 = ax; o.hy1 = ay; }
      // The right-angle vertex lies on the solid side of the hypotenuse.
      const t = (rx - o.hx0) / (o.hx1 - o.hx0 || 1);
      const hyAtR = o.hy0 + (o.hy1 - o.hy0) * t;
      o.solidBelow = ry < hyAtR;
      o.rx = rx; o.ry = ry;
      setBox(o, Math.min(ax, rx, bx), Math.min(ay, ry, by), Math.max(ax, rx, bx), Math.max(ay, ry, by));
      break;
    }
    case 'spike': {
      const t = d.tri;
      const baseY = t[1];
      const hv = t[5] - baseY;
      const hw = SPIKE_HIT_W * 0.5;
      if (!o.tri) { o.tri = new Float64Array(6); o.vtri = new Float64Array(6); }
      xf(o, -hw, baseY, o.tri, 0); xf(o, hw, baseY, o.tri, 2); xf(o, 0, baseY + hv * SPIKE_HIT_H, o.tri, 4);
      xf(o, t[0], t[1], o.vtri, 0); xf(o, t[2], t[3], o.vtri, 2); xf(o, t[4], t[5], o.vtri, 4);
      const v = o.tri;
      setBox(o, Math.min(v[0], v[2], v[4]), Math.min(v[1], v[3], v[5]), Math.max(v[0], v[2], v[4]), Math.max(v[1], v[3], v[5]));
      break;
    }
    case 'saw':
      o.r = d.radius * BLOCK * o.scale * SAW_HIT_R;
      o.vr = d.radius * BLOCK * o.scale;
      setBox(o, o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
      break;
    case 'orb':
    case 'coin':
      o.r = d.radius * BLOCK * o.scale;
      setBox(o, o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
      break;
    case 'pad':
    case 'portal': {
      const b = d.sensor;
      xf(o, b[0], b[1], tmp, 0); xf(o, b[2], b[3], tmp, 2);
      setBox(o, tmp[0], tmp[1], tmp[2], tmp[3]);
      break;
    }
    default:
      setBox(o, o.vx0, o.vy0, o.vx1, o.vy1);
  }
}

function setBox(o, ax, ay, bx, by) {
  o.minX = Math.min(ax, bx); o.maxX = Math.max(ax, bx);
  o.minY = Math.min(ay, by); o.maxY = Math.max(ay, by);
}

const COLLIDABLE = new Set(['solid', 'slope', 'spike', 'saw', 'pad', 'orb', 'portal', 'coin']);
const DYNAMIC_ACTIONS = new Set(['move', 'rotate', 'scale']);

export class World {
  constructor(levelData) {
    const lvl = normalizeLevel(levelData);
    this.meta = lvl.meta;
    this.objects = [];
    this.triggers = [];
    this.groups = new Map();
    this.grid = new Map();
    this.dynamic = [];
    this.pathObjects = [];
    this.coins = [];
    this.buckets = [];
    this.maxVisualW = BLOCK * 4;
    this.stamp = 1;
    this.endX = 0;
    this.hasEnd = false;

    for (const t of lvl.triggers) this.addTrigger(t);
    this.triggers.sort((a, b) => a.x - b.x || a.order - b.order);
    const dynGroups = new Set();
    for (const t of this.triggers) if (DYNAMIC_ACTIONS.has(t.action) && t.props.group) dynGroups.add(t.props.group | 0);

    let maxX = 0;
    for (const a of lvl.objects) {
      const o = this.makeObject(a);
      if (!o) continue;
      if (o.group && dynGroups.has(o.group)) o.dyn = true;
      if (o.props && o.props.path) { o.dyn = true; this.pathObjects.push(o); }
      maxX = Math.max(maxX, o.x);
    }
    if (!this.hasEnd) this.endX = maxX + 12 * BLOCK;
    this.computeMasks();
    for (const g of this.groups.values()) {
      let sx = 0, sy = 0;
      for (const o of g.objs) { sx += o.bx; sy += o.by; }
      g.px = g.objs.length ? sx / g.objs.length : 0;
      g.py = g.objs.length ? sy / g.objs.length : 0;
    }
    for (const o of this.objects) {
      if (o.dyn) this.dynamic.push(o);
      else {
        if (COLLIDABLE.has(o.kind)) this.insertGrid(o);
        this.insertBucket(o);
      }
    }
    this.coins.sort((a, b) => a.x - b.x);
    this.coins.forEach((c, i) => { c.coinIndex = i; });
  }

  makeObject(a) {
    const def = getDef(a[0]);
    if (!def || def.kind === 'trigger') return null;
    const props = a[7] ? { ...(def.props || {}), ...a[7] } : def.props ? { ...def.props } : null;
    const o = {
      id: this.objects.length, def, type: def.id, kind: def.kind,
      bx: (a[1] || 0) * BLOCK, by: (a[2] || 0) * BLOCK, brot: a[3] || 0,
      x: 0, y: 0, rot: a[3] || 0, fx: !!a[4], fy: !!a[5], group: a[6] | 0, props,
      scale: (props && props.scale) || 1, alpha: 1, enabled: true,
      layer: (props && props.layer) || def.layer, z: (props && props.z) || 0,
      color: props && props.color,
      minX: 0, minY: 0, maxX: 0, maxY: 0, vx0: 0, vx1: 0, vy0: 0, vy1: 0,
      mask: 0, dyn: false, stamp: 0, coinIndex: -1,
    };
    o.baseScale = o.scale;
    o.x = o.bx; o.y = o.by;
    updateGeometry(o);
    this.objects.push(o);
    if (o.group) {
      let g = this.groups.get(o.group);
      if (!g) {
        g = { id: o.group, objs: [], px: 0, py: 0, dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1, enabled: true, dirty: false };
        this.groups.set(o.group, g);
      }
      g.objs.push(o);
    }
    if (o.kind === 'coin') this.coins.push(o);
    if (o.kind === 'end') { this.endX = this.hasEnd ? Math.min(this.endX, o.x) : o.x; this.hasEnd = true; }
    const vw = o.vx1 - o.vx0;
    if (vw > this.maxVisualW) this.maxVisualW = vw;
    return o;
  }

  addTrigger(a) {
    const def = getDef(a[0]);
    if (!def || def.kind !== 'trigger') return;
    this.triggers.push({
      def, action: def.action, x: (a[1] || 0) * BLOCK, y: (a[2] || 0) * BLOCK,
      props: { ...def.props, ...(a[3] || {}) }, order: this.triggers.length,
    });
  }

  /**
   * Which outline edges to hide because something solid covers them. Full blocks get `mask`
   * (1 top, 2 right, 4 bottom, 8 left covered); slopes get `legMask` (1 the leg from the
   * hypotenuse start to the right angle, 2 the other leg). Edges are compared as unit grid
   * segments, so a slope resting on a block hides both the block's top and the slope's base.
   */
  computeMasks() {
    const cells = new Set();
    const slopeFaces = new Map();
    const near = (v) => Math.abs(v - Math.round(v)) < 0.01;
    // Unit segments of an axis-aligned edge: "h x,y" runs (x,y)→(x+1,y), "v x,y" runs (x,y)→(x,y+1).
    const segs = (x0, y0, x1, y1, g) => {
      const a = [x0 / BLOCK, y0 / BLOCK, x1 / BLOCK, y1 / BLOCK];
      if (!a.every(near)) return null;
      const [bx0, by0, bx1, by1] = a.map(Math.round);
      const out = [];
      if (by0 === by1) for (let x = Math.min(bx0, bx1); x < Math.max(bx0, bx1); x++) out.push(['h', x, by0, g]);
      else if (bx0 === bx1) for (let y = Math.min(by0, by1); y < Math.max(by0, by1); y++) out.push(['v', bx0, y, g]);
      else return null;
      return out;
    };
    const segKey = (sg) => sg.join(',');
    const cellKey = (x, y, g) => `${x},${y},${g}`;
    const full = (o) => o.kind === 'solid' && (o.def.style === 'neon' || o.def.style === 'panel' || o.def.style === 'brick')
      && Math.abs(o.maxX - o.minX - BLOCK) < 0.01 && Math.abs(o.maxY - o.minY - BLOCK) < 0.01;
    const legs = (o) => [segs(o.hx0, o.hy0, o.rx, o.ry, o.group), segs(o.hx1, o.hy1, o.rx, o.ry, o.group)];
    /** A unit segment lies on the face of some full block. */
    const onBlock = ([d, x, y, g]) => (d === 'h' ? cells.has(cellKey(x, y, g)) || cells.has(cellKey(x, y - 1, g))
      : cells.has(cellKey(x, y, g)) || cells.has(cellKey(x - 1, y, g)));
    for (const o of this.objects) {
      if (full(o)) cells.add(cellKey(Math.round(o.minX / BLOCK), Math.round(o.minY / BLOCK), o.group));
      if (o.kind === 'slope') for (const f of legs(o)) if (f) for (const sg of f) slopeFaces.set(segKey(sg), (slopeFaces.get(segKey(sg)) || 0) + 1);
    }
    for (const o of this.objects) {
      if (full(o)) {
        const cx = Math.round(o.minX / BLOCK), cy = Math.round(o.minY / BLOCK), g = o.group;
        const side = (dx, dy, sg) => cells.has(cellKey(cx + dx, cy + dy, g)) || slopeFaces.has(segKey(sg));
        o.mask = (side(0, 1, ['h', cx, cy + 1, g]) ? 1 : 0) | (side(1, 0, ['v', cx + 1, cy, g]) ? 2 : 0)
          | (side(0, -1, ['h', cx, cy, g]) ? 4 : 0) | (side(-1, 0, ['v', cx, cy, g]) ? 8 : 0);
      } else if (o.kind === 'slope') {
        o.legMask = 0;
        legs(o).forEach((f, i) => {
          if (!f) return;
          const ground = o.group === 0 && f.every(([d, , y]) => d === 'h' && y === 0);
          if (ground || f.every((sg) => onBlock(sg) || slopeFaces.get(segKey(sg)) > 1)) o.legMask |= 1 << i;
        });
      } else o.mask = 0;
    }
  }

  cellKey(cx, cy) {
    const y = cy < -2048 ? -2048 : cy > 2047 ? 2047 : cy;
    return (cx + 4096) * 4096 + (y + 2048);
  }

  insertGrid(o) {
    const cx0 = Math.floor(o.minX / GRID_CELL), cx1 = Math.floor(o.maxX / GRID_CELL);
    const cy0 = Math.floor(o.minY / GRID_CELL), cy1 = Math.floor(o.maxY / GRID_CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = this.cellKey(cx, cy);
        let cell = this.grid.get(k);
        if (!cell) { cell = []; this.grid.set(k, cell); }
        cell.push(o);
      }
    }
  }

  insertBucket(o) {
    const b = Math.max(0, Math.floor(o.vx0 / RENDER_BUCKET));
    while (this.buckets.length <= b) this.buckets.push([]);
    this.buckets[b].push(o);
  }

  /**
   * Collects enabled collidable objects whose AABB overlaps the box into `out`.
   * Returns the count. Objects are de-duplicated with a per-query stamp.
   */
  query(x0, y0, x1, y1, out) {
    const stamp = ++this.stamp;
    let n = 0;
    const cx0 = Math.floor(x0 / GRID_CELL), cx1 = Math.floor(x1 / GRID_CELL);
    const cy0 = Math.floor(y0 / GRID_CELL), cy1 = Math.floor(y1 / GRID_CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = this.grid.get(this.cellKey(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const o = cell[i];
          if (o.stamp === stamp || !o.enabled) continue;
          o.stamp = stamp;
          if (o.minX < x1 && o.maxX > x0 && o.minY < y1 && o.maxY > y0) out[n++] = o;
        }
      }
    }
    const dyn = this.dynamic;
    for (let i = 0; i < dyn.length; i++) {
      const o = dyn[i];
      if (!o.enabled || !COLLIDABLE.has(o.kind)) continue;
      if (o.minX < x1 && o.maxX > x0 && o.minY < y1 && o.maxY > y0) out[n++] = o;
    }
    return n;
  }

  /** Collects objects whose visual bounds overlap the view rectangle (for rendering). */
  collectVisible(x0, y0, x1, y1, out) {
    let n = 0;
    const b0 = Math.max(0, Math.floor((x0 - this.maxVisualW) / RENDER_BUCKET));
    const b1 = Math.min(this.buckets.length - 1, Math.floor(x1 / RENDER_BUCKET));
    for (let b = b0; b <= b1; b++) {
      const bucket = this.buckets[b];
      for (let i = 0; i < bucket.length; i++) {
        const o = bucket[i];
        if (o.vx1 > x0 && o.vx0 < x1 && o.vy1 > y0 && o.vy0 < y1) out[n++] = o;
      }
    }
    const dyn = this.dynamic;
    for (let i = 0; i < dyn.length; i++) {
      const o = dyn[i];
      if (o.vx1 > x0 && o.vx0 < x1 && o.vy1 > y0 && o.vy0 < y1) out[n++] = o;
    }
    return n;
  }

  /** Re-applies a group's transform to all of its objects. */
  applyGroup(g) {
    const [s, c] = trig(g.rot);
    for (const o of g.objs) {
      o.enabled = g.enabled;
      o.alpha = g.alpha;
      if (!o.dyn) continue;
      const lx = (o.bx - g.px) * g.scale;
      const ly = (o.by - g.py) * g.scale;
      o.x = g.px + g.dx + lx * c + ly * s;
      o.y = g.py + g.dy - lx * s + ly * c;
      o.rot = o.brot + g.rot;
      o.scale = o.baseScale * g.scale;
      if (o.props && o.props.path) continue; // path objects finish in updatePaths()
      updateGeometry(o);
    }
    g.dirty = false;
  }

  /** Moves objects that follow a looping path; position is a pure function of time. */
  updatePaths(time) {
    for (const o of this.pathObjects) {
      const p = o.props.path;
      const g = o.group ? this.groups.get(o.group) : null;
      let x = o.bx, y = o.by;
      if (g) {
        const [s, c] = trig(g.rot);
        const lx = (o.bx - g.px) * g.scale, ly = (o.by - g.py) * g.scale;
        x = g.px + g.dx + lx * c + ly * s;
        y = g.py + g.dy - lx * s + ly * c;
      }
      const period = p.period || 2;
      const ph = time / period + (p.phase || 0);
      if (p.mode === 'circle') {
        const a = ph * Math.PI * 2;
        x += Math.cos(a) * (p.dx || 1) * BLOCK;
        y += Math.sin(a) * (p.dx || 1) * BLOCK;
      } else {
        const f = ph - Math.floor(ph);
        const tri = f < 0.5 ? f * 2 : 2 - f * 2;
        const e = tri * tri * (3 - 2 * tri);
        x += (p.dx || 0) * BLOCK * e;
        y += (p.dy || 0) * BLOCK * e;
      }
      o.x = x; o.y = y;
      updateGeometry(o);
    }
  }

  /** Group state for snapshots: flat numbers keyed by group id. */
  saveGroups() {
    const out = [];
    for (const g of this.groups.values()) out.push(g.id, g.dx, g.dy, g.rot, g.scale, g.alpha, g.enabled ? 1 : 0);
    return out;
  }

  loadGroups(arr) {
    for (let i = 0; i < arr.length; i += 7) {
      const g = this.groups.get(arr[i]);
      if (!g) continue;
      g.dx = arr[i + 1]; g.dy = arr[i + 2]; g.rot = arr[i + 3]; g.scale = arr[i + 4];
      g.alpha = arr[i + 5]; g.enabled = arr[i + 6] === 1;
      this.applyGroup(g);
    }
  }

  resetGroups() {
    for (const g of this.groups.values()) {
      g.dx = 0; g.dy = 0; g.rot = 0; g.scale = 1; g.alpha = 1; g.enabled = true;
      this.applyGroup(g);
    }
    this.updatePaths(0);
  }
}
