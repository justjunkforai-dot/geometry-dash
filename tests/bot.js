/**
 * Input recordings and bot replay (DOM-free; used by tests and tools).
 *
 * Recording format: { level, hz: 240, presses: [[pressTick, releaseTick], ...] }.
 * Ticks are 1-based (the first sim.step() is tick 1). The button is held for ticks in
 * [pressTick, releaseTick) and `pressed` is true exactly on pressTick.
 */
import { Sim } from '../js/sim.js';

export class RecordingInput {
  constructor(rec) {
    this.presses = rec.presses || [];
    this.i = 0;
    this.out = { held: false, pressed: false };
  }

  at(tick) {
    const ps = this.presses;
    while (this.i < ps.length && ps[this.i][1] <= tick) this.i++;
    const cur = ps[this.i];
    this.out.held = !!cur && cur[0] <= tick && tick < cur[1];
    this.out.pressed = !!cur && cur[0] === tick;
    return this.out;
  }
}

/**
 * Replays a recording. Returns { completed, dead, tick, progress, coins, hash }.
 * `maxTicks` guards against recordings that never finish.
 */
export function replay(level, rec, opts = {}) {
  const sim = opts.sim || new Sim(level);
  if (opts.sim) sim.reset();
  const inp = new RecordingInput(rec);
  const max = opts.maxTicks || 240 * 60 * 5;
  for (let t = 1; t <= max; t++) {
    sim.step(inp.at(t));
    sim.events.length = 0;
    if (opts.onTick) opts.onTick(sim, t);
    if (sim.dead || sim.completed) break;
  }
  return {
    completed: sim.completed, dead: sim.dead, tick: sim.tick, progress: sim.progress,
    coins: sim.coins.slice(), hash: sim.hash(), sim,
  };
}

/** Converts a per-tick held array (index 0 = tick 1) into the presses format. */
export function heldToPresses(held) {
  const presses = [];
  let start = -1;
  for (let i = 0; i < held.length; i++) {
    if (held[i] && start < 0) start = i + 1;
    if (!held[i] && start >= 0) { presses.push([start, i + 1]); start = -1; }
  }
  if (start >= 0) presses.push([start, held.length + 1]);
  return presses;
}
