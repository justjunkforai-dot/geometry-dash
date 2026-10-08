/**
 * Player ↔ world collision resolution. Called once per physics tick per player.
 *
 * Conventions: positions are world units, y up. A player's "local up" is against gravity:
 * p.grav = 1 means gravity pulls towards -y, p.grav = -1 means towards +y. "Feet" is the side
 * facing gravity. Solids are resolved in two axis-separated phases (X then Y), then slopes,
 * then the corridor floor/ceiling. Hazards and sensors are tested after movement.
 */
import { DT, STEP_TOLERANCE, LAND_TOLERANCE, WORLD_MAX_Y, WORLD_MIN_Y, HAZARD_INSET } from './config.js';
import { triOverlapsBox, circleOverlapsBox, slopeHeightAt } from './collision.js';

const EPS = 1e-6;
const hits = new Array(512);

export function kill(sim, p, cause) {
  if (p.dead) return;
  p.dead = true;
  sim.dead = true;
  sim.emit('death', p.x, p.y, cause, p.twin ? 1 : 0);
}

/** Local vertical extent of a box for a player with gravity g: returns [bottom, top] in u = y*g. */
function localSpan(g, minY, maxY, out) {
  if (g > 0) { out[0] = minY; out[1] = maxY; } else { out[0] = -maxY; out[1] = -minY; }
  return out;
}
const span = [0, 0];

function overlapsPlayer(p, o) {
  const hw = p.w * 0.5, hh = p.h * 0.5;
  return o.minX < p.x + hw - EPS && o.maxX > p.x - hw + EPS && o.minY < p.y + hh - EPS && o.maxY > p.y - hh + EPS;
}

function queryAround(sim, p, pad) {
  const hw = p.w * 0.5 + pad, hh = p.h * 0.5 + pad;
  return sim.world.query(p.x - hw, p.y - hh, p.x + hw, p.y + hh, hits);
}

/** Horizontal move: side contacts kill unless they are tiny steps (feet) or safe ceilings. */
export function moveX(sim, p, dx, params) {
  p.x += dx;
  const n = queryAround(sim, p, 0);
  const hh = p.h * 0.5;
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    if (o.kind !== 'solid' || !overlapsPlayer(p, o)) continue;
    if (p.mode === 'wave') { kill(sim, p, 'block'); return; }
    localSpan(p.grav, o.minY, o.maxY, span);
    const pu = p.y * p.grav;
    const vL = p.vy * p.grav;
    const feetPen = span[1] - (pu - hh);
    const headPen = pu + hh - span[0];
    const tol = vL < 0 ? LAND_TOLERANCE : STEP_TOLERANCE;
    if (feetPen <= tol + EPS) {
      p.y = (span[1] + hh) * p.grav;
      if (vL <= 0) { p.vy = 0; setGround(sim, p); }
    } else if (headPen <= STEP_TOLERANCE + EPS && !params.ceilingKills) {
      p.y = (span[0] - hh) * p.grav;
      if (vL > 0) p.vy = 0;
    } else {
      kill(sim, p, 'wall');
      return;
    }
  }
}

/** Vertical move: falling onto a top lands, rising into a bottom bonks (fatal for cube/robot). */
export function moveY(sim, p, dy, params) {
  const prevU = p.y * p.grav;
  p.y += dy;
  const n = queryAround(sim, p, 0);
  const hh = p.h * 0.5;
  const tol = Math.abs(dy) + LAND_TOLERANCE;
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    if (o.kind !== 'solid' || !overlapsPlayer(p, o)) continue;
    if (p.mode === 'wave') { kill(sim, p, 'block'); return; }
    localSpan(p.grav, o.minY, o.maxY, span);
    const vL = p.vy * p.grav;
    if (vL <= 0 && prevU - hh >= span[1] - tol) {
      p.y = (span[1] + hh) * p.grav;
      p.vy = 0;
      setGround(sim, p);
    } else if (vL > 0 && prevU + hh <= span[0] + tol) {
      if (params.ceilingKills) { kill(sim, p, 'ceiling'); return; }
      p.y = (span[0] - hh) * p.grav;
      p.vy = 0;
      p.ceiling = true;
    } else {
      kill(sim, p, 'crush');
      return;
    }
  }
}

function setGround(sim, p) {
  p.onGround = true;
}

/**
 * Slopes: the push needed to separate the player from the hypotenuse is compared with what
 * riding the slope can explain this tick; anything larger is a side hit.
 */
export function resolveSlopes(sim, p, vx, params) {
  const n = queryAround(sim, p, 0);
  const hw = p.w * 0.5, hh = p.h * 0.5;
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    if (o.kind !== 'slope') continue;
    const pl = p.x - hw, pr = p.x + hw, pb = p.y - hh, pt = p.y + hh;
    if (o.maxX <= pl || o.minX >= pr || o.maxY <= pb || o.minY >= pt) continue;
    const sl = Math.max(pl, o.hx0), sr = Math.min(pr, o.hx1);
    const ya = slopeHeightAt(o, sl), yb = slopeHeightAt(o, sr);
    let pen;
    if (o.solidBelow) pen = Math.max(ya, yb) - pb;
    else pen = pt - Math.min(ya, yb);
    if (pen <= EPS) continue;
    if (p.mode === 'wave') { kill(sim, p, 'slope'); return; }
    const k = Math.abs(o.hy1 - o.hy0) / (o.hx1 - o.hx0);
    const allowed = vx * DT * k + Math.abs(p.vy) * DT + STEP_TOLERANCE + 1;
    if (pen > allowed) { kill(sim, p, 'slope-wall'); return; }
    const feet = o.solidBelow ? p.grav > 0 : p.grav < 0;
    p.y += o.solidBelow ? pen : -pen;
    if (feet) {
      const riseWorld = o.hy1 > o.hy0 ? 1 : -1;
      const localRise = riseWorld * p.grav;
      const ride = localRise > 0 ? vx * k : -vx * k;
      const vL = p.vy * p.grav;
      if (vL <= ride + 1) {
        p.vy = ride * p.grav;
        setGround(sim, p);
        p.slopeAngle = Math.atan2(o.hy1 - o.hy0, o.hx1 - o.hx0);
      }
    } else {
      if (params.ceilingKills) { kill(sim, p, 'ceiling'); return; }
      const vL = p.vy * p.grav;
      if (vL > 0) p.vy = 0;
    }
  }
}

/** Keeps a grounded player glued to a descending slope instead of hopping down it. */
export function stickToSlopes(sim, p, vx) {
  const probe = vx * DT * 2 + 1.5;
  const hw = p.w * 0.5, hh = p.h * 0.5;
  const pl = p.x - hw, pr = p.x + hw;
  const n = p.grav > 0
    ? sim.world.query(pl, p.y - hh - probe, pr, p.y - hh + 1, hits)
    : sim.world.query(pl, p.y + hh - 1, pr, p.y + hh + probe, hits);
  let best = Infinity;
  let bestO = null;
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    if (o.kind !== 'slope') continue;
    const sl = Math.max(pl, o.hx0), sr = Math.min(pr, o.hx1);
    if (sl >= sr) continue;
    const ya = slopeHeightAt(o, sl), yb = slopeHeightAt(o, sr);
    let gap;
    if (p.grav > 0 && o.solidBelow) gap = p.y - hh - Math.max(ya, yb);
    else if (p.grav < 0 && !o.solidBelow) gap = Math.min(ya, yb) - (p.y + hh);
    else continue;
    if (gap >= -EPS && gap <= probe && gap < best) { best = gap; bestO = o; }
  }
  if (!bestO) return;
  p.y -= best * p.grav;
  const k = Math.abs(bestO.hy1 - bestO.hy0) / (bestO.hx1 - bestO.hx0);
  const localRise = (bestO.hy1 > bestO.hy0 ? 1 : -1) * p.grav;
  p.vy = (localRise > 0 ? vx * k : -vx * k) * p.grav;
  p.slopeAngle = Math.atan2(bestO.hy1 - bestO.hy0, bestO.hx1 - bestO.hx0);
  setGround(sim, p);
}

/** Corridor floor/ceiling (or the ground). Bounds never kill; they ground or stop the player. */
export function resolveBounds(sim, p) {
  const hh = p.h * 0.5;
  const c = sim.corridor;
  const floor = c ? c.floor : 0;
  const ceil = c ? c.ceil : Infinity;
  if (p.y - hh < floor) {
    p.y = floor + hh;
    if (p.vy < 0) p.vy = 0;
    if (p.grav > 0) setGround(sim, p); else p.ceiling = true;
    p.grazed = true;
  }
  if (p.y + hh > ceil) {
    p.y = ceil - hh;
    if (p.vy > 0) p.vy = 0;
    if (p.grav < 0) setGround(sim, p); else p.ceiling = true;
    p.grazed = true;
  }
  if (p.y > WORLD_MAX_Y || p.y < WORLD_MIN_Y) kill(sim, p, 'void');
}

/**
 * Hazards and sensors after movement. Sensors fire on entry (pads, portals), orbs are
 * remembered in p.contacts so a press can use them (once per overlap).
 */
export function touchObjects(sim, p, onSensor) {
  const n = queryAround(sim, p, 0);
  const hw = p.w * 0.5, hh = p.h * 0.5;
  const x0 = p.x - hw, x1 = p.x + hw, y0 = p.y - hh, y1 = p.y + hh;
  // Hazards use a slightly inset player box (forgiving corner grazes).
  const ix = Math.min(HAZARD_INSET, hw * 0.25), iy = Math.min(HAZARD_INSET, hh * 0.25);
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    if (o.kind === 'spike') {
      if (triOverlapsBox(o.tri, x0 + ix, y0 + iy, x1 - ix, y1 - iy)) { kill(sim, p, 'spike'); return; }
    } else if (o.kind === 'saw') {
      if (circleOverlapsBox(o.x, o.y, o.r, x0 + ix, y0 + iy, x1 - ix, y1 - iy)) { kill(sim, p, 'saw'); return; }
    }
  }
  const prev = p.contacts;
  const next = p.nextContacts;
  next.length = 0;
  for (let i = 0; i < n; i++) {
    const o = hits[i];
    const k = o.kind;
    if (k === 'pad' || k === 'portal') {
      if (!overlapsPlayer(p, o)) continue;
      next.push(o.id);
      if (prev.indexOf(o.id) < 0) onSensor(sim, p, o);
    } else if (k === 'orb') {
      if (circleOverlapsBox(o.x, o.y, o.r, x0, y0, x1, y1)) next.push(o.id);
    } else if (k === 'coin') {
      if (circleOverlapsBox(o.x, o.y, o.r, x0, y0, x1, y1)) onSensor(sim, p, o);
    }
    if (p.dead) return;
  }
  p.contacts = next;
  p.nextContacts = prev;
  // Forget orbs we no longer overlap so they can be used again on a later pass.
  const used = p.usedOrbs;
  for (let i = used.length - 1; i >= 0; i--) if (next.indexOf(used[i]) < 0) used.splice(i, 1);
}
