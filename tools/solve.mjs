#!/usr/bin/env node
/**
 * Level solver / validator. Breadth-first search over "hold or release" decisions every few
 * ticks, de-duplicating equivalent states, until the end wall is reached. Writes the resulting
 * input recording to tests/recordings/<id>.json and reports how tight each input is.
 *
 *   node tools/solve.mjs level1 [--coins] [--width 96] [--step 6] [--no-write]
 *
 * --coins  requires every secret coin to be collected (proves coins are reachable).
 * The search prefers releasing over holding, so recordings use as few presses as possible.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim } from '../js/sim.js';
import { heldToPresses, replay } from '../tests/bot.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
if (!name) { console.error('usage: solve.mjs <levelModule> [--coins] [--width N] [--step N]'); process.exit(1); }

const level = (await import(name.includes('/') ? join(root, name) : join(root, 'js/levels', `${name}.js`))).default;
const STEP = opt('--step', 6);
const WIDTH = opt('--width', 96);
const needCoins = flag('--coins');

function keyOf(sim, held) {
  let k = `${held ? 1 : 0}|${sim.speedIdx}|${sim.dual ? 1 : 0}|${Math.round(sim.players[0].x)}`;
  for (const p of sim.players) {
    k += `|${Math.round(p.y * 4)},${Math.round(p.vy / 4)},${p.grav},${p.mode},${p.mini ? 1 : 0},${p.onGround ? 1 : 0},${p.dashing ? 1 : 0},${p.boost > 0 ? 1 : 0},${p.buffer > 0 ? 1 : 0},${p.usedOrbs.length}`;
  }
  if (needCoins) k += `|${sim.coins.map((c) => (c ? 1 : 0)).join('')}`;
  return k;
}

function solve() {
  const sim = new Sim(level);
  let layer = [{ snap: sim.snapshot(), held: false, parent: -1 }];
  const history = [];
  const inp = { held: false, pressed: false };
  let best = 0;
  let bestX = 0;
  let bestTick = 0;
  for (let d = 0; d < 100000; d++) {
    const next = [];
    const seen = new Set();
    for (let i = 0; i < layer.length; i++) {
      const st = layer[i];
      for (const held of [false, true]) {
        sim.restore(st.snap);
        let done = false;
        for (let k = 0; k < STEP; k++) {
          inp.held = held;
          inp.pressed = held && !st.held && k === 0;
          sim.step(inp);
          sim.events.length = 0;
          if (sim.dead || sim.completed) break;
        }
        if (sim.dead) continue;
        if (sim.progress > best) { best = sim.progress; bestX = sim.players[0].x / 30; bestTick = sim.tick; }
        if (sim.completed) {
          if (needCoins && !sim.coins.every(Boolean)) continue;
          done = true;
        }
        const key = keyOf(sim, held);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ snap: done ? null : sim.snapshot(), held, parent: i, done, tick: sim.tick });
        if (done) {
          history.push(layer.map((s) => ({ parent: s.parent, held: s.held })));
          return reconstruct(history, { parent: i, held }, sim.tick);
        }
      }
    }
    if (!next.length) return { fail: true, best, bestX, beat: ((bestTick / 240 + (level.meta.offset || 0)) * level.meta.bpm) / 60 };
    let kept = next;
    if (next.length > WIDTH) {
      // Keep a spread of states: sort by height/velocity, take evenly spaced samples.
      next.sort((a, b) => {
        const pa = a.snap.players[0], pb = b.snap.players[0];
        return pa.y - pb.y || pa.vy - pb.vy;
      });
      kept = [];
      for (let j = 0; j < WIDTH; j++) kept.push(next[Math.floor((j * next.length) / WIDTH)]);
    }
    history.push(layer.map((s) => ({ parent: s.parent, held: s.held })));
    layer = kept;
    if (d % 400 === 0) process.stdout.write(`\r  layer ${d} states ${layer.length} progress ${(best * 100).toFixed(1)}%   `);
  }
  return { fail: true, best, bestX };
}

function reconstruct(history, last, endTick) {
  const actions = [last.held];
  let idx = last.parent;
  for (let d = history.length - 1; d >= 1; d--) {
    const s = history[d][idx];
    actions.push(s.held);
    idx = s.parent;
  }
  actions.reverse();
  const held = [];
  for (const a of actions) for (let k = 0; k < STEP; k++) held.push(a);
  held.length = Math.min(held.length, endTick);
  return { presses: heldToPresses(held), endTick };
}

/** For each press, how many ticks earlier/later it could happen and still reach the next press. */
function windows(rec) {
  const out = [];
  const base = rec.presses;
  for (let i = 0; i < base.length; i++) {
    const limit = i + 1 < base.length ? base[i + 1][0] + 240 : Infinity;
    const ok = (shift) => {
      const ps = base.map((p) => p.slice());
      ps[i][0] += shift; ps[i][1] += shift;
      if (i > 0 && ps[i][0] <= ps[i - 1][1]) return false;
      if (i + 1 < ps.length && ps[i][1] >= ps[i + 1][0]) return false;
      const r = replay(level, { presses: ps }, { maxTicks: limit === Infinity ? undefined : limit });
      return r.completed || (!r.dead && r.tick >= limit);
    };
    let lo = 0, hi = 0;
    while (lo > -60 && ok(lo - 1)) lo--;
    while (hi < 60 && ok(hi + 1)) hi++;
    out.push([base[i][0], lo, hi]);
  }
  return out;
}

const t0 = Date.now();
console.log(`Solving ${level.meta.name}${needCoins ? ' (all coins)' : ''}…`);
const res = solve();
process.stdout.write('\n');
if (res.fail) {
  console.log(`FAILED — best progress ${(res.best * 100).toFixed(1)}% at x=${res.bestX.toFixed(1)} blocks, beat ${res.beat && res.beat.toFixed(2)}`);
  process.exit(2);
}
const rec = { level: level.meta.id, hz: 240, coins: needCoins, presses: res.presses };
const check = replay(level, rec);
console.log(`Solved in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${rec.presses.length} presses, ${res.endTick} ticks, replay ${check.completed ? 'OK' : 'BROKEN'}`);
if (!flag('--no-windows')) {
  const w = windows(rec);
  const tight = w.filter(([, lo, hi]) => hi - lo + 1 < 12);
  const ms = (n) => ((n * 1000) / 240).toFixed(0);
  console.log(`Press windows (ms): min ${ms(Math.min(...w.map(([, lo, hi]) => hi - lo + 1)))}, median ${ms(w.map(([, lo, hi]) => hi - lo + 1).sort((a, b) => a - b)[Math.floor(w.length / 2)])}`);
  for (const [tick, lo, hi] of tight) console.log(`  tight press at tick ${tick} (${(tick / 240).toFixed(2)}s): ${ms(hi - lo + 1)} ms window`);
}
if (!flag('--no-write')) {
  const out = join(root, 'tests/recordings', `${level.meta.id}${needCoins ? '.coins' : ''}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(rec)}\n`);
  console.log(`wrote ${out}`);
}
