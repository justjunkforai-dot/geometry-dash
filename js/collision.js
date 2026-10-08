/**
 * Geometric primitives used by the physics. All functions are allocation-free.
 * Boxes are given as (x0, y0, x1, y1) with x0 < x1, y0 < y1.
 */

const EPS = 1e-6;

export function boxesOverlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  return ax0 < bx1 - EPS && ax1 > bx0 + EPS && ay0 < by1 - EPS && ay1 > by0 + EPS;
}

/** Circle (cx, cy, r) vs box. */
export function circleOverlapsBox(cx, cy, r, x0, y0, x1, y1) {
  const nx = cx < x0 ? x0 : cx > x1 ? x1 : cx;
  const ny = cy < y0 ? y0 : cy > y1 ? y1 : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/** Projects the triangle on axis (ax, ay) and tests against the box's projection. */
function separatedOnAxis(t, ax, ay, x0, y0, x1, y1) {
  const p0 = t[0] * ax + t[1] * ay;
  const p1 = t[2] * ax + t[3] * ay;
  const p2 = t[4] * ax + t[5] * ay;
  const tMin = Math.min(p0, p1, p2);
  const tMax = Math.max(p0, p1, p2);
  // Box projection: centre ± half-extent along the axis.
  const cx = (x0 + x1) * 0.5;
  const cy = (y0 + y1) * 0.5;
  const c = cx * ax + cy * ay;
  const e = (x1 - x0) * 0.5 * Math.abs(ax) + (y1 - y0) * 0.5 * Math.abs(ay);
  return tMax <= c - e + EPS || tMin >= c + e - EPS;
}

/**
 * Triangle (Float64Array/Array of 6: ax,ay,bx,by,cx,cy) vs box using the separating axis test.
 * Axes: the box's x/y axes and the three edge normals of the triangle.
 */
export function triOverlapsBox(t, x0, y0, x1, y1) {
  const tx0 = Math.min(t[0], t[2], t[4]);
  const tx1 = Math.max(t[0], t[2], t[4]);
  const ty0 = Math.min(t[1], t[3], t[5]);
  const ty1 = Math.max(t[1], t[3], t[5]);
  if (!boxesOverlap(tx0, ty0, tx1, ty1, x0, y0, x1, y1)) return false;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const ex = t[j * 2] - t[i * 2];
    const ey = t[j * 2 + 1] - t[i * 2 + 1];
    if (separatedOnAxis(t, -ey, ex, x0, y0, x1, y1)) return false;
  }
  return true;
}

/** Height of a slope's hypotenuse at world x (clamped to its span). */
export function slopeHeightAt(o, x) {
  const t = (x - o.hx0) / (o.hx1 - o.hx0);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return o.hy0 + (o.hy1 - o.hy0) * c;
}

/** Point-in-triangle used by the editor for picking. */
export function pointInTri(t, px, py) {
  const d1 = (px - t[2]) * (t[1] - t[3]) - (t[0] - t[2]) * (py - t[3]);
  const d2 = (px - t[4]) * (t[3] - t[5]) - (t[2] - t[4]) * (py - t[5]);
  const d3 = (px - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (py - t[1]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
