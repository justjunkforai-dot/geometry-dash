/**
 * Breadth-first input search shared by the solver and the fairness analysis.
 *
 * Every `step` ticks the search branches on "hold" / "release", de-duplicates equivalent
 * states (position, velocity, mode, gravity, …) and keeps at most `width` diverse states per
 * layer (more coins first, then an even spread over height/velocity).
 */
import { Sim } from '../js/sim.js';
import { heldToPresses } from '../tests/bot.js';

const HOLD_MODES = new Set(['ship', 'wave']);

export function makeGrid(level, grid, tol) {
  const beatTicks = (240 * 60) / level.meta.bpm / Math.max(1, grid);
  const offTicks = (level.meta.offset || 0) * 240;
  return (sim, tick) => {
    if (!grid || HOLD_MODES.has(sim.players[0].mode)) return true;
    const k = (tick + offTicks) / beatTicks;
    return Math.abs(k - Math.round(k)) * beatTicks <= tol;
  };
}

function keyOf(sim, held, coins) {
  let k = `${held ? 1 : 0}|${sim.speedIdx}|${sim.dual ? 1 : 0}|${Math.round(sim.players[0].x)}`;
  for (const p of sim.players) {
    k += `|${Math.round(p.y * 4)},${Math.round(p.vy / 4)},${p.grav},${p.mode},${p.mini ? 1 : 0},${p.onGround ? 1 : 0},${p.dashing ? 1 : 0},${p.boost > 0 ? 1 : 0},${p.buffer > 0 ? 1 : 0},${p.usedOrbs.length}`;
  }
  if (coins) k += `|${sim.coins.map((c) => (c ? 1 : 0)).join('')}`;
  return k;
}

/**
 * opts: { level, start (snapshot), startHeld, horizon (ticks; success = survive that long),
 *         width, step, pressAllowed(sim, tick), coins (bool), coinsOk(sim), onProgress }
 * Returns { ok, held (per-tick array from the start tick), endTick, best, bestX, bestTick }.
 */
export function search(opts) {
  const { level, width = 96, step = 6 } = opts;
  const sim = opts.sim || new Sim(level);
  if (opts.start) sim.restore(opts.start); else sim.reset();
  const t0 = sim.tick;
  const allowed = opts.pressAllowed || (() => true);
  let layer = [{ snap: sim.snapshot(), held: !!opts.startHeld, parent: -1 }];
  const history = [];
  const inp = { held: false, pressed: false };
  let best = 0, bestX = 0, bestTick = 0;
  const maxLayers = opts.horizon ? Math.ceil(opts.horizon / step) + 1 : 100000;
  for (let d = 0; d < maxLayers; d++) {
    const next = [];
    const seen = new Set();
    for (let i = 0; i < layer.length; i++) {
      const st = layer[i];
      for (const held of [false, true]) {
        sim.restore(st.snap);
        if (held && !st.held && !allowed(sim, sim.tick + 1)) continue;
        for (let k = 0; k < step; k++) {
          inp.held = held;
          inp.pressed = held && !st.held && k === 0;
          sim.step(inp);
          sim.events.length = 0;
          if (sim.dead || sim.completed) break;
        }
        if (sim.dead) continue;
        if (sim.progress > best) { best = sim.progress; bestX = sim.players[0].x / 30; bestTick = sim.tick; }
        let done = false;
        if (sim.completed) {
          if (opts.coins && !opts.coinsOk(sim)) continue;
          done = true;
        } else if (opts.horizon && sim.tick - t0 >= opts.horizon) done = true;
        const key = keyOf(sim, held, opts.coins);
        if (seen.has(key)) continue;
        seen.add(key);
        if (done) {
          history.push(layer.map((s) => ({ parent: s.parent, held: s.held })));
          return { ok: true, ...reconstruct(history, { parent: i, held }, step, sim.tick - t0), endTick: sim.tick, best, bestX, bestTick };
        }
        next.push({ snap: sim.snapshot(), held, parent: i });
      }
    }
    if (!next.length) return { ok: false, best, bestX, bestTick };
    history.push(layer.map((s) => ({ parent: s.parent, held: s.held })));
    layer = next.length > width ? trim(next, width, opts.coins) : next;
    if (opts.onProgress && d % 400 === 0) opts.onProgress(d, layer.length, best);
  }
  return { ok: false, best, bestX, bestTick };
}

/**
 * Keeps `width` states. Coins first (when required); then slots are shared round-robin between
 * behaviour buckets (held / grounded / mode / gravity) so no family of states (e.g. "on the
 * ground, button released") is crowded out; inside a bucket states are spread over y/vy.
 */
function trim(next, width, coins) {
  const coinCount = (st) => (coins ? st.snap.coins.filter(Boolean).length : 0);
  const maxCoins = Math.max(...next.map(coinCount));
  const pool = coins ? next.filter((st) => coinCount(st) === maxCoins) : next;
  const rest = coins ? next.filter((st) => coinCount(st) !== maxCoins) : [];
  const buckets = new Map();
  for (const st of pool) {
    const p = st.snap.players[0];
    const k = `${st.held ? 1 : 0}${p.onGround ? 1 : 0}${p.mode}${p.grav}${p.mini ? 1 : 0}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(st);
  }
  const lists = [...buckets.values()].map((g) => g.sort((a, b) => {
    const pa = a.snap.players[0], pb = b.snap.players[0];
    return pa.y - pb.y || pa.vy - pb.vy;
  }));
  // Evenly spaced picks from each bucket, interleaved until the width is reached.
  const kept = [];
  const quota = lists.map(() => 0);
  let remaining = Math.min(width, pool.length);
  while (remaining > 0) {
    let progressed = false;
    for (let i = 0; i < lists.length && remaining > 0; i++) {
      if (quota[i] < lists[i].length) { quota[i]++; remaining--; progressed = true; }
    }
    if (!progressed) break;
  }
  lists.forEach((g, i) => {
    const q = quota[i];
    for (let j = 0; j < q; j++) kept.push(g[Math.floor((j * g.length) / q)]);
  });
  for (let i = 0; kept.length < width && i < rest.length; i++) kept.push(rest[i]);
  return kept;
}

function reconstruct(history, last, step, total) {
  const actions = [last.held];
  let idx = last.parent;
  for (let d = history.length - 1; d >= 1; d--) {
    const s = history[d][idx];
    actions.push(s.held);
    idx = s.parent;
  }
  actions.reverse();
  const held = [];
  for (const a of actions) for (let k = 0; k < step; k++) held.push(a);
  held.length = Math.min(held.length, total);
  return { held, presses: heldToPresses(held) };
}

export { HOLD_MODES };
