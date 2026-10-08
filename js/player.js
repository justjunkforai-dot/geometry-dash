/**
 * Player state and per-mode physics. One call to stepPlayer() advances one 240 Hz tick.
 * Vertical velocity is stored in world space (p.vy); mode logic works in "local up"
 * (vL = p.vy * p.grav) so every mode works the same with flipped gravity.
 */
import {
  MODES, MODE_NAMES, DT, START_X, BUFFER_TICKS, COYOTE_TICKS, MINI_SCALE, PAD_VEL, ORB_VEL,
  DASH_MAX_ANGLE, BLOCK,
} from './config.js';
import { moveX, moveY, resolveSlopes, stickToSlopes, resolveBounds, touchObjects } from './physics.js';

const RAD = 180 / Math.PI;
const EPS = 1e-6;

/** Mode parameters merged with their mini overrides: PARAMS[mode][mini ? 1 : 0]. */
const PARAMS = {};
for (const m of MODE_NAMES) PARAMS[m] = [MODES[m], { ...MODES[m], ...MODES[m].mini }];
export function modeParams(p) { return PARAMS[p.mode][p.mini ? 1 : 0]; }

export function createPlayer(mode = 'cube', grav = 1, mini = false) {
  const p = {
    x: START_X, y: 0, vy: 0, px: START_X, py: 0, rot: 0, prot: 0,
    mode, grav, mini, w: 30, h: 30,
    onGround: true, landedThisTick: false, ceiling: false, coyote: 0, buffer: 0,
    dead: false, twin: false, dashing: false, dashAngle: 0, boost: 0,
    contacts: [], nextContacts: [], usedOrbs: [], slopeAngle: 0, grazed: false,
  };
  setHitbox(p);
  p.y = p.h * 0.5;
  p.py = p.y;
  return p;
}

export function setHitbox(p) {
  const hb = MODES[p.mode].hitbox;
  const s = p.mini ? MINI_SCALE : 1;
  p.w = hb[0] * s;
  p.h = hb[1] * s;
}

/** Changes the hitbox while keeping the feet in place if grounded. */
function resize(p, fn) {
  const feet = p.y - (p.h * 0.5) * p.grav;
  fn();
  setHitbox(p);
  if (p.onGround) p.y = feet + (p.h * 0.5) * p.grav;
}

const nudgeHits = new Array(64);

/**
 * After a hitbox grows (mode/size portal), push the player vertically out of solids it now
 * overlaps by at most the growth amount, so portals inside tight gates never cause deaths.
 */
function nudgeOut(sim, p, grow) {
  if (grow <= 0 || !sim.world) return;
  const hw = p.w * 0.5, hh = p.h * 0.5;
  const n = sim.world.query(p.x - hw, p.y - hh, p.x + hw, p.y + hh, nudgeHits);
  for (let i = 0; i < n; i++) {
    const o = nudgeHits[i];
    if (o.kind !== 'solid') continue;
    const up = o.maxY - (p.y - hh);
    const down = p.y + hh - o.minY;
    if (up > 0 && up <= grow + 0.01 && up < down) p.y += up;
    else if (down > 0 && down <= grow + 0.01) p.y -= down;
  }
}

export function setMode(sim, p, mode) {
  if (p.mode === mode) return;
  const h0 = p.h;
  resize(p, () => { p.mode = mode; });
  nudgeOut(sim, p, p.h - h0);
  p.dashing = false;
  p.boost = 0;
  if (mode === 'ship' || mode === 'ufo' || mode === 'swing') p.vy *= 0.5;
  if (mode === 'wave') p.grazed = false;
  p.rot = Math.round(p.rot / 90) * 90;
  p.prot = p.rot;
}

export function setMini(p, mini, sim = null) {
  if (p.mini === mini) return;
  const h0 = p.h;
  resize(p, () => { p.mini = mini; });
  if (sim) nudgeOut(sim, p, p.h - h0);
}

function flipGravity(p) { p.grav = -p.grav; p.onGround = false; p.coyote = 0; }

function jumped(sim, p, kind) {
  p.buffer = 0;
  p.coyote = 0;
  p.onGround = false;
  sim.stats.jumps++;
  if (kind) sim.emit(kind, p.x, p.y, p.mode, p.twin ? 1 : 0);
}

// ---- Mode physics (velocity update) -------------------------------------------------------
function modePhysics(sim, p, P, input, vx) {
  let vL = p.vy * p.grav;
  const canJump = p.onGround || p.coyote > 0;
  switch (p.mode) {
    case 'cube':
      if (canJump && (p.buffer > 0 || input.held)) { vL = P.jump; jumped(sim, p, 'jump'); }
      vL = Math.max(vL - P.gravity * DT, -P.maxFall);
      break;
    case 'ship':
      vL += (input.held ? P.upAccel : -P.downAccel) * DT;
      vL = Math.min(Math.max(vL, -P.maxDown), P.maxUp);
      break;
    case 'ball':
      if (canJump && p.buffer > 0) {
        flipGravity(p);
        vL = -P.flipPush;
        jumped(sim, p, 'flip');
      }
      vL = Math.max(vL - P.gravity * DT, -P.maxFall);
      break;
    case 'ufo':
      if (p.buffer > 0) { vL = P.jump; jumped(sim, p, 'jump'); }
      vL = Math.max(vL - P.gravity * DT, -P.maxFall);
      break;
    case 'wave':
      vL = (input.held ? 1 : -1) * vx * P.slope;
      break;
    case 'robot':
      if (canJump && (p.buffer > 0 || input.held)) {
        vL = P.jump;
        p.boost = Math.round(P.boostTime / DT);
        jumped(sim, p, 'jump');
      } else if (p.boost > 0 && input.held && vL > 0) {
        p.boost--;
        vL = P.jump;
        break;
      } else p.boost = 0;
      vL = Math.max(vL - P.gravity * DT, -P.maxFall);
      break;
    case 'spider':
      if (canJump && p.buffer > 0) {
        spiderTeleport(sim, p, P);
        vL = p.vy * p.grav;
        jumped(sim, p, null);
      }
      vL = Math.max(vL - P.gravity * DT, -P.maxFall);
      break;
    case 'swing':
      if (p.buffer > 0) {
        flipGravity(p);
        vL = -vL;
        jumped(sim, p, 'flip');
      }
      vL = Math.min(Math.max(vL - P.gravity * DT, -P.maxSpeed), P.maxSpeed);
      break;
    default:
      break;
  }
  p.vy = vL * p.grav;
}

const rayHits = new Array(256);

/** Spider: instantly move to the nearest surface against gravity, then flip gravity. */
function spiderTeleport(sim, p, P) {
  const hw = p.w * 0.5 - 1, hh = p.h * 0.5;
  const head = p.y + hh * p.grav;
  const x0 = p.x - hw, x1 = p.x + hw;
  const n = p.grav > 0
    ? sim.world.query(x0, head - 1, x1, head + P.reach, rayHits)
    : sim.world.query(x0, head - P.reach, x1, head + 1, rayHits);
  let best = P.reach;
  for (let i = 0; i < n; i++) {
    const o = rayHits[i];
    let d = Infinity;
    if (o.kind === 'solid') d = p.grav > 0 ? o.minY - head : head - o.maxY;
    else if (o.kind === 'slope' && o.solidBelow === p.grav < 0) {
      const ya = slopeAt(o, Math.max(x0, o.hx0)), yb = slopeAt(o, Math.min(x1, o.hx1));
      d = p.grav > 0 ? Math.min(ya, yb) - head : head - Math.max(ya, yb);
    }
    if (d >= -EPS && d < best) best = Math.max(0, d);
  }
  const c = sim.corridor;
  const bound = p.grav > 0 ? (c ? c.ceil - head : Infinity) : head - (c ? c.floor : 0);
  if (bound >= -EPS && bound < best) best = Math.max(0, bound);
  const fromY = p.y;
  if (best < P.reach) {
    p.y += best * p.grav;
    flipGravity(p);
    p.vy = 0;
  } else {
    flipGravity(p);
    p.vy = -P.flingSpeed * p.grav;
  }
  sim.emit('teleport', p.x, fromY, p.y, p.twin ? 1 : 0);
}

function slopeAt(o, x) {
  const t = Math.min(1, Math.max(0, (x - o.hx0) / (o.hx1 - o.hx0)));
  return o.hy0 + (o.hy1 - o.hy0) * t;
}

// ---- Orbs, pads, portals -------------------------------------------------------------------
function useOrb(sim, p, o) {
  const P = modeParams(p);
  const mul = P.orbMul;
  const c = o.def.color;
  let vL = p.vy * p.grav;
  if (p.mode === 'wave' && c !== 'blue' && c !== 'green') return false;
  switch (c) {
    case 'yellow': vL = ORB_VEL.yellow * mul; break;
    case 'pink': vL = ORB_VEL.pink * mul; break;
    case 'red': vL = ORB_VEL.red * mul; break;
    case 'blue': flipGravity(p); vL = -ORB_VEL.blue * Math.max(mul, 0.5); break;
    // Green = power flip: like blue but launches toward the new floor at full jump speed.
    case 'green': flipGravity(p); vL = -ORB_VEL.green * Math.max(mul, 0.5); break;
    case 'black': vL = -ORB_VEL.black; break;
    case 'dash': {
      let a = -(((o.rot % 360) + 540) % 360 - 180);
      a = Math.max(-DASH_MAX_ANGLE, Math.min(DASH_MAX_ANGLE, a));
      p.dashing = true;
      p.dashAngle = a;
      break;
    }
    default: return false;
  }
  if (p.mode === 'wave') vL = p.vy * p.grav;
  if (!p.dashing) p.vy = vL * p.grav;
  p.boost = 0;
  jumped(sim, p, 'orb');
  sim.emit('orb-fx', o.x, o.y, c, o.id);
  return true;
}

function tryOrbs(sim, p) {
  const objs = sim.world.objects;
  for (let i = 0; i < p.contacts.length; i++) {
    const id = p.contacts[i];
    const o = objs[id];
    if (o.kind !== 'orb' || !o.enabled || p.usedOrbs.indexOf(id) >= 0) continue;
    if (useOrb(sim, p, o)) { p.usedOrbs.push(id); return; }
  }
}

function usePad(sim, p, o) {
  const P = modeParams(p);
  const c = o.def.color;
  if (c === 'blue') {
    flipGravity(p);
    p.vy = -PAD_VEL.blue * Math.max(P.orbMul, 0.5) * p.grav;
  } else {
    if (P.orbMul === 0) return;
    p.vy = PAD_VEL[c] * P.orbMul * p.grav;
  }
  p.onGround = false;
  p.coyote = 0;
  p.boost = 0;
  p.dashing = false;
  sim.emit('pad', o.x, o.y, c, o.id);
}

function onSensor(sim, p, o) {
  switch (o.kind) {
    case 'pad': usePad(sim, p, o); break;
    case 'portal': sim.applyPortal(p, o); break;
    case 'coin':
      if (o.coinIndex >= 0 && !sim.coins[o.coinIndex]) {
        sim.coins[o.coinIndex] = true;
        sim.emit('coin', o.x, o.y, o.coinIndex, 0);
      }
      break;
    default: break;
  }
}

// ---- Visual orientation ---------------------------------------------------------------------
function updateVisual(p, P, vx) {
  switch (p.mode) {
    case 'cube': {
      if (p.onGround) {
        const target = p.slopeAngle ? p.slopeAngle * RAD : Math.round(p.rot / 90) * 90;
        p.rot += (target - p.rot) * 0.2;
      } else {
        const airtime = (2 * P.jump) / P.gravity;
        p.rot -= (P.spinPerJump / airtime) * DT * p.grav;
      }
      break;
    }
    case 'ship':
    case 'swing': {
      const target = Math.max(-50, Math.min(50, Math.atan2(p.vy, vx) * RAD));
      p.rot += (target - p.rot) * (p.mode === 'ship' ? 0.08 : 0.06);
      break;
    }
    case 'ball':
      p.rot -= ((vx * DT) / (p.w * 0.5)) * RAD * p.grav;
      break;
    case 'ufo': {
      const target = Math.max(-14, Math.min(14, p.vy * 0.03));
      p.rot += (target - p.rot) * 0.1;
      break;
    }
    case 'wave':
      p.rot = Math.atan2(p.vy, vx) * RAD;
      break;
    default: {
      const target = p.onGround && p.slopeAngle ? p.slopeAngle * RAD : 0;
      p.rot += (target - p.rot) * 0.2;
    }
  }
  if (Math.abs(p.rot) > 7200) {
    const k = Math.round(p.rot / 360) * 360;
    p.rot -= k;
    p.prot -= k;
  }
}

/** Advances one player by one tick. `input` = { held, pressed }. */
export function stepPlayer(sim, p, input) {
  p.px = p.x;
  p.py = p.y;
  p.prot = p.rot;
  p.landedThisTick = false;
  p.ceiling = false;
  const vx = sim.vx;
  if (input.pressed) p.buffer = BUFFER_TICKS;
  else if (p.buffer > 0) p.buffer--;
  if (p.onGround) p.coyote = COYOTE_TICKS;
  else if (p.coyote > 0) p.coyote--;
  const wasGround = p.onGround;

  if (p.buffer > 0 && p.contacts.length) tryOrbs(sim, p);
  const P = modeParams(p);
  if (p.dashing) {
    if (!input.held) p.dashing = false;
    else p.vy = vx * Math.tan(p.dashAngle / RAD);
  }
  if (!p.dashing) modePhysics(sim, p, P, input, vx);

  p.onGround = false;
  p.slopeAngle = 0;
  moveX(sim, p, vx * DT, P);
  if (p.dead) return;
  moveY(sim, p, p.vy * DT, P);
  if (p.dead) return;
  resolveSlopes(sim, p, vx, P);
  if (p.dead) return;
  if (wasGround && !p.onGround && p.vy * p.grav <= EPS && p.mode !== 'wave' && !p.dashing) stickToSlopes(sim, p, vx);
  resolveBounds(sim, p);
  if (p.dead) return;
  touchObjects(sim, p, onSensor);
  if (p.dead) return;
  if (p.dashing && (p.onGround || p.ceiling)) p.dashing = false;
  p.landedThisTick = p.onGround && !wasGround;
  if (p.landedThisTick && p.mode !== 'wave' && p.mode !== 'ship' && p.mode !== 'swing') {
    sim.emit('land', p.x, p.y - p.h * 0.5 * p.grav, p.mode, p.twin ? 1 : 0);
  }
  updateVisual(p, P, vx);
}

export function copyPlayer(p) {
  return {
    ...p,
    contacts: p.contacts.slice(),
    nextContacts: [],
    usedOrbs: p.usedOrbs.slice(),
  };
}

/** Height of the band a mode creates, in units (0 = no ceiling). */
export function corridorHeight(mode) { return MODES[mode].corridor * BLOCK; }
