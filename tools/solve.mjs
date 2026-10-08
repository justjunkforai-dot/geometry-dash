#!/usr/bin/env node
/**
 * Level solver / validator. Finds an input recording that completes a level and writes it to
 * tests/recordings/<id>.json (or <id>.coins.json with --coins).
 *
 *   node tools/solve.mjs level1 [--coins | --coin N] [--width 96] [--step 6] [--grid 2] [--tol 8]
 *                                [--fair] [--no-write] [--raw]
 *
 * --grid N  press-based modes may only start presses within ±tol ticks of 1/N beat
 *           (proves the obstacles sit on the music's rhythm grid; 0 disables)
 * --fair    reports each timed press's *recoverable window*: how far it can be early/late
 *           and still survive the next 1.5 s with some later input.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim } from '../js/sim.js';
import { replay } from '../tests/bot.js';
import { search, makeGrid, HOLD_MODES } from './search.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
if (!name) { console.error('usage: solve.mjs <levelModule> [--coins] [--fair] …'); process.exit(1); }

const level = (await import(name.includes('/') ? join(root, name) : join(root, 'js/levels', `${name}.js`))).default;
const STEP = opt('--step', 6);
const WIDTH = opt('--width', 96);
const onlyCoin = args.includes('--coin') ? opt('--coin', 0) : -1;
const needCoins = flag('--coins') || onlyCoin >= 0;
const coinsOk = (sim) => (onlyCoin >= 0 ? sim.coins[onlyCoin] : sim.coins.every(Boolean));
const pressAllowed = makeGrid(level, opt('--grid', 2), opt('--tol', 8));
const beatOf = (tick) => (((tick / 240) + (level.meta.offset || 0)) * level.meta.bpm) / 60;
const ms = (n) => ((n * 1000) / 240).toFixed(0);

/** Drops every press the run does not need (keeps coin collection when required). */
function minimize(rec) {
  let ps = rec.presses.slice();
  const ok = (list) => {
    const r = replay(level, { presses: list });
    return r.completed && (!needCoins || coinsOk(r.sim));
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = ps.length - 1; i >= 0; i--) {
      const trial = ps.slice(0, i).concat(ps.slice(i + 1));
      if (ok(trial)) { ps = trial; changed = true; }
    }
  }
  return { ...rec, presses: ps };
}

/**
 * Recoverable window of each timed press: shift it by δ ticks (others before it unchanged),
 * then search for any input that survives the next 1.5 s.
 */
function fairness(rec) {
  const ps = rec.presses;
  const sim = new Sim(level);
  const holdTick = [];
  replay(level, rec, { onTick: (s) => holdTick.push(HOLD_MODES.has(s.players[0].mode)) });
  const isHold = (p) => { for (let k = -1; k <= 60; k++) if (holdTick[p + k]) return true; return false; };
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    const [p, r] = ps[i];
    if (isHold(p)) continue;
    const s0 = Math.max(i ? ps[i - 1][1] : 0, p - 61);
    // State after tick s0 following the recording.
    const base = replay(level, { presses: ps.slice(0, i) }, { maxTicks: s0, sim });
    if (base.dead) continue;
    const snap = sim.snapshot();
    const survives = (d) => {
      if (p + d <= s0) return false;
      sim.restore(snap);
      const inp = { held: false, pressed: false };
      for (let t = s0 + 1; t < r + d; t++) {
        inp.held = t >= p + d;
        inp.pressed = t === p + d;
        sim.step(inp);
        sim.events.length = 0;
        if (sim.dead) return false;
        if (sim.completed) return true;
      }
      return search({ level, sim, start: sim.snapshot(), startHeld: true, horizon: 300, width: 32, step: 6 }).ok;
    };
    // Binary-search each edge of the (assumed contiguous) window, up to ±60 ticks.
    const edge = (dir) => {
      let good = 0, bad = 61;
      while (bad - good > 1) {
        const mid = (good + bad) >> 1;
        if (survives(dir * mid)) good = mid; else bad = mid;
      }
      return good;
    };
    const lo = -edge(-1), hi = edge(1);
    out.push({ tick: p, lo, hi, w: hi - lo + 1 });
  }
  return out;
}

const t0 = Date.now();
console.log(`Solving ${level.meta.name}${needCoins ? ' (coins)' : ''}…`);
const res = search({
  level, width: WIDTH, step: STEP, pressAllowed, coins: needCoins, coinsOk,
  onProgress: (d, n, best) => process.stdout.write(`\r  layer ${d} states ${n} progress ${(best * 100).toFixed(1)}%   `),
});
process.stdout.write('\n');
if (!res.ok) {
  console.log(`FAILED — best progress ${(res.best * 100).toFixed(1)}% at x=${res.bestX.toFixed(1)} blocks, beat ${beatOf(res.bestTick).toFixed(2)}`);
  process.exit(2);
}
const raw = { level: level.meta.id, hz: 240, coins: needCoins && onlyCoin < 0, presses: res.presses };
const rec = flag('--raw') ? raw : minimize(raw);
const check = replay(level, rec);
console.log(`Solved in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${rec.presses.length} presses, ${res.endTick} ticks, replay ${check.completed ? 'OK' : 'BROKEN'}`);
if (flag('--fair')) {
  const w = fairness(rec);
  const sorted = w.map((x) => x.w).sort((a, b) => a - b);
  console.log(`Recoverable windows over ${w.length} timed presses (ms): min ${ms(sorted[0])}, 10th pct ${ms(sorted[Math.floor(sorted.length * 0.1)])}, median ${ms(sorted[Math.floor(sorted.length / 2)])}`);
  for (const x of w.filter((q) => q.w < opt('--warn', 18))) console.log(`  tight press at beat ${beatOf(x.tick).toFixed(2)} (${(x.tick / 240).toFixed(2)}s): ${ms(x.w)} ms (${ms(-x.lo)} early / ${ms(x.hi)} late)`);
}
if (!flag('--no-write') && onlyCoin < 0 && check.completed) {
  const out = join(root, 'tests/recordings', `${level.meta.id}${needCoins ? '.coins' : ''}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(rec)}\n`);
  console.log(`wrote ${out}`);
}
