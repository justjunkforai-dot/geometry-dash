/**
 * Reusable, beat-aligned level patterns built on LevelBuilder. Every helper takes the builder
 * first; beats refer to the music, positions are in blocks. The rule of thumb used throughout:
 * the ideal input for an obstacle placed "at beat B" is a press exactly on beat B.
 */
import { BLOCK, MODES, PAD_VEL } from '../config.js';

const G = MODES.cube.gravity;

/** Left edge of a platform to step onto: under the cube's front edge at the jump apex. */
export function stepX(b, beat) {
  return b.x(beat) + 0.5 + (b.v(beat) * b.airtime()) / 2;
}

/** Platform (solid block stack from `y0` up to `y0 + h`) the cube steps onto when pressing on `beat`. */
export function stepUp(b, beat, h, len, y0 = 0, key = 'block') {
  const x = stepX(b, beat);
  b.block(x, y0, len, h, key);
  return x + len;
}

/** Floating platform (one block thick) the cube lands on when pressing on `beat` from height y0. */
export function ledge(b, beat, top, len, key = 'block') {
  const x = stepX(b, beat);
  b.platform(x, top - 1, len, key);
  return x + len;
}

/** Pit of small spikes centred on the apex of a jump pressed on `beat`. */
export function pit(b, beat, w, y = 0) {
  b.gap(b.apex(beat) - w / 2, w, y);
}

/**
 * Pad hit exactly on `beat` (the pad's sensor meets the player's front edge), followed by a
 * platform of height `top` whose left edge sits under the apex of the launch.
 */
export function padTo(b, beat, color, top, len, y0 = 0) {
  const padX = b.x(beat) + 0.95;
  b.pad(padX - 0.5, y0, color);
  if (top) {
    const tApex = (PAD_VEL[color.toLowerCase()] || PAD_VEL.yellow) / G;
    const L = b.x(beat) + b.v(beat) * tApex + 0.5;
    b.block(L, 0, len, top);
    return L + len;
  }
  return padX;
}

/**
 * Orb placed where a cube that jumped (from height y0) on `jumpBeat` will be on `orbBeat`,
 * so the second press lands on the beat too.
 */
export function airOrb(b, jumpBeat, orbBeat, color, y0 = 0) {
  const dt = b.time(orbBeat) - b.time(jumpBeat);
  const y = y0 + (MODES.cube.jump * dt - 0.5 * G * dt * dt) / BLOCK + 0.5;
  b.orb(b.x(orbBeat), y, color);
  return y;
}

/** Orb the player overlaps exactly on `beat` at height `y` (centre, blocks). */
export function orbAt(b, beat, color, y = 1.5) {
  b.orb(b.x(beat) + 0.3, y, color);
  return b.x(beat);
}

/**
 * Ship/UFO/swing tunnel: grid-aligned columns from x0 to x1 whose open gap is centred on
 * centre(cx) (blocks) and `gap` tall (number or function of cx). Walls are filled down to the
 * band floor / up to its ceiling. `pockets` = [[cx0, cx1, dLo, dHi]] widen the gap locally
 * (dLo blocks deeper, dHi blocks higher) — used to hide secret coins.
 */
export function tunnel(b, x0, x1, centre, gap, floor = 0, ceil = 10, key = 'block', pockets = []) {
  for (let cx = Math.floor(x0); cx < x1; cx++) {
    const c = centre(cx);
    const g = typeof gap === 'function' ? gap(cx) : gap;
    let lo = Math.max(floor, Math.round(c - g / 2));
    let hi = Math.min(ceil, lo + g);
    for (const [p0, p1, dLo, dHi] of pockets) if (cx >= p0 && cx < p1) { lo = Math.max(floor, lo - dLo); hi = Math.min(ceil, hi + dHi); }
    if (lo > floor) b.block(cx, floor, 1, lo - floor, key);
    if (hi < ceil) b.block(cx, hi, 1, ceil - hi, key);
  }
}

/** Bottom of the open gap of a tunnel column (same rounding as tunnel()). */
export function tunnelLow(centre, gap, cx, floor = 0) {
  return Math.max(floor, Math.round(centre(cx) - gap / 2));
}

/**
 * 45° wave corridor made of slopes: the floor surface follows `profile(i)` (blocks, integer
 * steps of 0 or ±1 per column) and the ceiling runs `gap` blocks above it.
 */
export function waveCorridor(b, x0, cols, profile, gap, floor = 0, ceil = 10) {
  for (let i = 0; i < cols; i++) {
    const cx = x0 + i;
    const f0 = profile(i), f1 = profile(i + 1);
    const c0 = f0 + gap, c1 = f1 + gap;
    const lowF = Math.min(f0, f1);
    if (lowF > floor) b.block(cx, floor, 1, lowF - floor);
    if (f1 > f0) b.slope(cx, f0);
    else if (f1 < f0) b.slope(cx, f1, { fx: true });
    const highC = Math.max(c0, c1);
    if (highC < ceil) b.block(cx, highC, 1, ceil - highC);
    if (c1 > c0) b.slope(cx, c0, { rot: 180 });
    else if (c1 < c0) b.slope(cx, c1, { fy: true });
  }
}

/** Zig-zag profile: rises `amp` blocks over `amp` columns, then falls back, from `base`. */
export function zigzag(base, amp, phase = 0) {
  return (i) => {
    const p = (i + phase) % (2 * amp);
    return base + (p <= amp ? p : 2 * amp - p);
  };
}

/** Ball / spider flips: hazards alternate floor and ceiling so a flip is needed on each beat. */
export function flipHazards(b, beats, floor, ceil, opts = {}) {
  const len = opts.len || 3;
  beats.forEach((beat, i) => {
    const x = b.x(beat) + (opts.lead === undefined ? 2.2 : opts.lead);
    if (i % 2 === 0) b.spikes(x, floor, len);
    else b.spikes(x, ceil - 1, len, { rot: 180 });
  });
}

// ---- decoration & triggers --------------------------------------------------------------------

/** Beat lights along the ground every `every` beats. */
export function beatLights(b, beat0, beat1, every = 4, y = 0.4) {
  for (let beat = beat0; beat < beat1; beat += every) b.deco('beatOrb', b.x(beat), y);
}

/** Sparkles and floating rings in the background between two beats. */
export function sky(b, beat0, beat1, seed = 1, yMin = 3, yMax = 9) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let beat = beat0; beat < beat1; beat += 2) {
    const x = b.x(beat) + rnd() * 4;
    const y = yMin + rnd() * (yMax - yMin);
    b.deco(rnd() < 0.7 ? 'sparkle' : 'diamond', x, y);
  }
}

/** Hanging chains under a ceiling at the given x positions. */
export function chains(b, xs, ceilY, len = 2) {
  for (const x of xs) for (let k = 0; k < len; k++) b.deco('chain', x, ceilY - 0.5 - k);
}

/** Colour change at a beat. */
export function colors(b, beat, pal, dur = 0.8) {
  for (const [ch, color] of Object.entries(pal)) b.trigger('trColor', b.x(beat), { channel: ch, color, duration: dur });
}

/** Pulse a colour channel on every `every` beats between two beats. */
export function pulses(b, beat0, beat1, every = 1, channel = 'obj', color = '#ffffff') {
  for (let beat = beat0; beat < beat1; beat += every) b.trigger('trPulse', b.x(beat), { channel, color, fadeIn: 0.02, hold: 0.04, fadeOut: 0.3 });
}

/** Height (units) the cube reaches `t` seconds after a jump — used for orb/coin placement. */
export function cubeHeightAt(t) { return MODES.cube.jump * t - 0.5 * G * t * t; }

export { BLOCK };

// ---- section helpers shared by the harder levels ------------------------------------------

/**
 * Wave zig-zag between two beats: gate in, 45° slope corridor, gate out (`exitKey`).
 * Returns { x0, end, prof } so callers can place coins relative to the corridor.
 */
export function waveRun(b, beat0, beat1, gap, amp, base, exitKey = 'portalCube', entryKey = 'portalWave') {
  const gx = Math.round(b.x(beat0)) + 1;
  b.gate(entryKey, gx, base + 1.5);
  const x0 = gx + 2;
  const cols = Math.round(b.x(beat1)) - x0;
  const prof = zigzag(base, amp);
  b.block(gx + 0.5, 0, 1, base);
  b.block(gx + 0.5, base + gap, 1, 10 - base - gap);
  waveCorridor(b, x0, cols, prof, gap);
  const end = x0 + cols;
  b.gate(exitKey, end + 0.5, prof(cols) + gap / 2);
  return { x0, end, prof };
}

/** Two mirrored bands for dual flying: the lower follows `centre`, the upper mirrors it. */
export function mirroredTunnel(b, x0, x1, centre, gap, ceil = 10) {
  for (let cx = Math.floor(x0); cx < x1; cx++) {
    const lo = Math.max(0, Math.round(centre(cx) - gap / 2));
    const hi = lo + gap;
    if (lo > 0) { b.block(cx, 0, 1, lo); b.block(cx, ceil - lo, 1, lo); }
    if (hi < ceil - hi) b.block(cx, hi, 1, ceil - 2 * hi);
  }
}

/** Ground spikes plus the same spikes mirrored on a ceiling at height `ceil` (dual mode). */
export function dualSpikes(b, beat, n, ceil = 10) {
  b.spikesAt(beat, n);
  b.spikes(b.apex(beat) - n / 2, ceil - 1, n, { rot: 180 });
}

/** Spikes hanging from a ceiling whose underside is at `top`, under a flipped jump's apex. */
export function hang(b, beat, n, top) {
  b.spikes(b.apex(beat) - n / 2, top - 1, n, { rot: 180 });
}

/**
 * Saw oscillating by (dx, dy) blocks every `beats` beats, at phase `atPhase` (0 = base
 * position, 0.5 = fully offset) exactly on `beat`. Motion is a pure function of level time.
 */
export function movingSaw(b, x, y, size, dx, dy, beats, beat, atPhase = 0.5) {
  const period = (beats * 60) / b.bpm;
  const phase = (((atPhase - b.time(beat) / period) % 1) + 1) % 1;
  b.saw(x, y, size, { props: { path: { dx, dy, period, phase } } });
}

let nextGroup = 100;
/** A press block hanging `rise` up that slams down on `trigBeat` and becomes a step. */
export function crusher(b, x, w, h, rise, trigBeat) {
  const g = nextGroup++;
  const beatSec = 60 / b.bpm;
  b.inGroup(g, () => b.block(x, rise, w, h, 'panel'));
  for (let k = 0; k < w; k++) b.deco('chain', x + k + 0.5, rise + h + 0.5);
  b.trigger('trMove', b.x(trigBeat), { group: g, dx: 0, dy: -rise, duration: beatSec * 0.5, easing: 'in' });
  b.trigger('trShake', b.x(trigBeat + 0.5), { strength: 5, duration: 0.2 });
}

/** A wall that lifts out of the way 1.5 beats before the player reaches it (spectacle). */
export function gateWall(b, x, h, beat) {
  const g = nextGroup++;
  b.inGroup(g, () => b.block(x, 0, 1, h, 'brick'));
  b.trigger('trMove', b.x(beat - 1.5), { group: g, dx: 0, dy: h + 1, duration: 60 / b.bpm, easing: 'inOut' });
}

/** Stack of identical portals covering a band so a flying player cannot miss it. */
export function portalColumn(b, key, x, floor = 0, ceil = 9) {
  for (let y = floor + 1.5; y < ceil; y += 3) b.portal(key, x, y);
}
