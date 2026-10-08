/**
 * Automated test suite, shared by `node tests/run.mjs` and the in-page runner (`?test=1`).
 * ctx: { loadRecording(id) → recording | null, log(msg) }.
 */
import { Sim } from '../js/sim.js';
import { MODE_NAMES, DT_MS, BLOCK } from '../js/config.js';
import { LevelBuilder } from '../js/levels/builder.js';
import { LEVELS } from '../js/levels/index.js';
import { JumpQueue } from '../js/input.js';
import { Game } from '../js/game.js';
import { Particles } from '../js/particles.js';
import { replay } from './bot.js';
import { TRACKS, degree } from '../js/tracks.js';
import { mechanicsTests } from './suite-mechanics.js';
import showcase from './levels/showcase.js';

class AssertionError extends Error {}
export function assert(cond, msg) { if (!cond) throw new AssertionError(msg); }

/** Runs a sim with a held/pressed function of the tick; returns { sim, events }. */
export function run(level, ticks, inputFn = () => false) {
  const sim = new Sim(level);
  const events = [];
  const inp = { held: false, pressed: false };
  let prevHeld = false;
  for (let t = 1; t <= ticks; t++) {
    const r = inputFn(t, sim);
    inp.held = typeof r === 'object' ? r.held : !!r;
    inp.pressed = typeof r === 'object' ? r.pressed : inp.held && !prevHeld;
    prevHeld = inp.held;
    sim.step(inp);
    for (const e of sim.events) events.push(e);
    sim.events.length = 0;
    if (sim.dead || sim.completed) break;
  }
  return { sim, events, p: sim.players[0] };
}

function lvl(meta, fn) {
  const b = new LevelBuilder({ id: 'test', name: 'Test', bpm: 120, ...meta });
  fn(b);
  if (!b.objects.some((o) => o[0] === 71)) b.end(200);
  return b.build();
}

/** Press windows for n spikes at cell 20: number of surviving press ticks. */
function spikeWindow(n) {
  const level = lvl({}, (b) => b.spikes(20, 0, n));
  let ok = 0;
  for (let press = 300; press < 520; press++) {
    const { sim } = run(level, 900, (t) => t === press);
    if (!sim.dead) ok++;
  }
  return ok;
}

/** Fake app for driving the real Game stepping loop without a DOM. */
function fakeApp() {
  return {
    input: new JumpQueue(), particles: new Particles(256), audio: null, hooks: {},
    settings: { restartDelay: 0.4, particles: 0.5, shake: 0, reduceFlash: true, autoCheckpoint: 0 },
    profile: { colors: { p1: '#fff', p2: '#fff', g: '#fff' }, trail: 'none' },
  };
}

/** Plays a recording through Game.update at a given render rate; returns the final sim hash. */
function playAtFps(level, rec, fps) {
  const app = fakeApp();
  const game = new Game(app, level, {});
  game.start();
  game.clock = 0;
  const q = app.input;
  for (const [p, r] of rec.presses) {
    q.queue.push({ t: (p - 0.5) * DT_MS, down: true, held: true });
    q.queue.push({ t: (r - 0.5) * DT_MS, down: false, held: false });
  }
  const frame = 1000 / fps;
  for (let now = 0; now < 1000 * 60 * 5; now += frame) {
    game.update(now, frame / 1000);
    if (game.state !== 'playing') break;
  }
  return { hash: game.sim.hash(), state: game.state, tick: game.sim.tick };
}

export async function runSuite(ctx) {
  const results = [];
  const test = async (name, fn) => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ name, pass: true, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ name, pass: false, ms: Date.now() - t0, detail: e instanceof AssertionError ? e.message : String(e && e.stack || e) });
    }
    const r = results[results.length - 1];
    if (ctx.log) ctx.log(`${r.pass ? 'PASS' : 'FAIL'} ${name}${r.pass ? '' : ` — ${r.detail}`}`);
  };

  const recs = {};
  for (const L of LEVELS) recs[L.id] = await ctx.loadRecording(L.id);
  const first = LEVELS[0];

  await test('determinism: identical inputs give identical state hashes', () => {
    const rec = recs[first.id];
    assert(rec, 'missing recording');
    const hashes = [[], []];
    for (let k = 0; k < 2; k++) replay(first.data, rec, { onTick: (sim, t) => { if (t % 500 === 0) hashes[k].push(sim.hash()); } });
    assert(hashes[0].length > 10, 'too few samples');
    assert(hashes[0].join() === hashes[1].join(), 'hash sequences differ');
  });

  await test('frame-rate independence: 30/60/144/240 FPS give the same result', () => {
    const rec = recs[first.id];
    const res = [30, 60, 144, 240].map((fps) => playAtFps(first.data, rec, fps));
    for (const r of res) assert(r.state === 'complete', `run ended in state ${r.state} at tick ${r.tick}`);
    assert(new Set(res.map((r) => r.hash)).size === 1, `hashes differ: ${res.map((r) => r.hash).join(', ')}`);
  });

  await test('spikes: single/double comfortable, triple tight, quadruple impossible', () => {
    const ms = (n) => (spikeWindow(n) * 1000) / 240;
    const [s1, s2, s3, s4] = [1, 2, 3, 4].map(ms);
    assert(s1 >= 200, `single window ${s1}ms`);
    assert(s2 >= 120, `double window ${s2}ms`);
    assert(s3 >= 40 && s3 <= 100, `triple window ${s3}ms`);
    assert(s4 === 0, `quadruple window ${s4}ms`);
  });

  await test('no tunnelling at 2× speed (wall and thin slab)', () => {
    const wall = lvl({ startSpeed: 4 }, (b) => b.block(30, 0, 1, 4));
    const r1 = run(wall, 2400);
    assert(r1.sim.dead, 'cube passed through the wall');
    assert(r1.p.x + r1.p.w / 2 <= 30 * BLOCK + 3, `died too late at x=${r1.p.x}`);
    const slab = lvl({ startSpeed: 4 }, (b) => { b.pad(4, 0, 'Red'); for (let x = 8; x < 60; x++) b.add('slab', x, 0); });
    const r2 = run(slab, 480);
    assert(!r2.sim.dead, 'died on slab');
    assert(Math.abs(r2.p.y - r2.p.h / 2 - BLOCK) < 0.01 && r2.p.onGround, `not standing on slab (y=${r2.p.y})`);
  });

  await test('slopes: ride up 45° and 2:1, slide down, side of a slope kills', () => {
    const up = lvl({}, (b) => { b.slope(10, 0); b.block(11, 0, 6, 1); b.slope(17, 1, { wide: true }); b.block(19, 0, 2, 2); });
    // Stop when the player's centre is above the last block (x = 20 blocks).
    const r = run(up, Math.floor((20 * BLOCK - 15) / 1.3));
    assert(!r.sim.dead, `died on rising slopes (${r.events.find((e) => e.type === 'death')?.a})`);
    assert(r.p.y - r.p.h / 2 >= 2 * BLOCK - 0.5, `not on top (bottom=${r.p.y - r.p.h / 2})`);
    const down = lvl({}, (b) => { b.slope(9, 0); b.block(10, 0, 4, 1); b.slope(14, 0, { fx: true }); });
    const r2 = run(down, 240 * 2.5);
    assert(!r2.sim.dead, 'died going down a slope');
    const side = lvl({}, (b) => b.slope(12, 0, { fx: true }));
    assert(run(side, 240 * 2).sim.dead, 'survived hitting a slope wall');
  });

  await test('gravity portal flips every mode', () => {
    for (const mode of MODE_NAMES) {
      const level = lvl({ startMode: mode }, (b) => b.portal('gravUp', 8, 1.5));
      const r = run(level, 240 * 2.5);
      assert(!r.sim.dead, `${mode} died`);
      assert(r.p.grav === -1, `${mode} gravity not flipped`);
      assert(r.p.y > 3 * BLOCK, `${mode} did not move up (y=${r.p.y.toFixed(1)})`);
    }
  });

  await test('ceiling: cube dies bonking a block, ship slides along it', () => {
    const roof = lvl({}, (b) => b.block(14, 2, 6, 1));
    assert(run(roof, 240 * 2, (t) => t === 300).sim.dead, 'cube survived head bonk');
    const shipRoof = lvl({ startMode: 'ship' }, (b) => b.block(10, 4, 20, 1));
    const r = run(shipRoof, Math.floor((25 * BLOCK - 15) / 1.3), (t, sim) => sim.players[0].x > 11 * BLOCK);
    assert(!r.sim.dead, 'ship died on ceiling');
    assert(Math.abs(r.p.y + r.p.h / 2 - 4 * BLOCK) < 0.5, `ship not under ceiling (y=${r.p.y})`);
  });

  await test('wave: slides on corridor floor, dies touching a block', () => {
    const open = lvl({ startMode: 'wave' }, () => {});
    assert(!run(open, 240 * 3).sim.dead, 'wave died sliding on floor');
    const blk = lvl({ startMode: 'wave' }, (b) => b.block(20, 0, 1, 1));
    assert(run(blk, 240 * 3).sim.dead, 'wave survived a block');
  });

  await test('orbs fire once per overlap; buffered press before landing still jumps', () => {
    const orb = lvl({}, (b) => b.orb(12.5, 1.5, 'Yellow'));
    const r2 = run(orb, 240 * 2, (t, sim) => {
      const p = sim.players[0];
      const inOrb = Math.abs(p.x - 12.5 * BLOCK) < 22;
      return inOrb && sim.tick % 4 === 0;
    });
    assert(r2.events.filter((e) => e.type === 'orb-fx').length === 1, 'orb fired more than once');
    // Jump, then press ~60 ms before landing: the next jump must happen on landing.
    const flat = lvl({}, () => {});
    const air = Math.round((2 * 687) / 3570 * 240);
    const r3 = run(flat, 240 * 2, (t) => t === 10 || t === 10 + air - 14);
    const jumps = r3.events.filter((e) => e.type === 'jump');
    assert(jumps.length === 2, `expected 2 jumps, got ${jumps.length}`);
    assert(jumps[1].tick - (10 + air) <= 2, 'buffered jump was late');
  });

  await test('coyote time: a press just after walking off a ledge still jumps', () => {
    const ledge = lvl({}, (b) => { b.slope(10, 0); b.block(11, 0, 6, 1); });
    const off = Math.ceil((17 * BLOCK + 15 - 15) / 1.3);
    const jumpTick = (press) => (run(ledge, off + 60, (t) => t === press).events.find((e) => e.type === 'jump') || {}).tick;
    assert(jumpTick(off + 5) === off + 5, 'no coyote jump 20 ms after the ledge');
    assert(!(jumpTick(off + 20) <= off + 25), 'jumped in mid-air 80 ms after the ledge');
  });

  for (const L of LEVELS) {
    await test(`bot completes "${L.data.meta.name}"`, () => {
      const rec = recs[L.id];
      assert(rec, 'missing recording');
      const r = replay(L.data, rec);
      assert(r.completed, `bot died at ${(r.progress * 100).toFixed(1)}%`);
    });
  }

  await test('level data survives a JSON round trip', () => {
    const rec = recs[first.id];
    const copy = JSON.parse(JSON.stringify(first.data));
    const a = replay(first.data, rec, { maxTicks: 3000 });
    const b = replay(copy, rec, { maxTicks: 3000 });
    assert(a.hash === b.hash, 'hash differs after round trip');
  });

  await mechanicsTests(test, { assert, run, lvl });

  await test('bot completes the all-mechanics showcase level', async () => {
    const rec = await ctx.loadRecording('showcase');
    assert(rec, 'missing recording');
    const r = replay(showcase, rec);
    assert(r.completed, `bot died at ${(r.progress * 100).toFixed(1)}%`);
  });

  await test('music data: every pattern is well-formed', () => {
    for (const [id, tr] of Object.entries(TRACKS)) {
      const fits = (str) => str.length > 0 && (16 % str.length === 0 || str.length % 16 === 0);
      for (const d of Object.values(tr.drums)) for (const str of Object.values(d)) assert(fits(str) && /^[xXo.]+$/.test(str), `${id}: bad drum pattern "${str}"`);
      for (const group of ['bass', 'lead', 'arp']) {
        for (const [n, str] of Object.entries(tr[group])) {
          assert(fits(str), `${id}.${group}.${n}: length ${str.length}`);
          for (const ch of str) assert(ch === '.' || ch === '-' || degree(ch) !== null, `${id}.${group}.${n}: bad char ${ch}`);
        }
      }
      for (const sec of tr.song) {
        assert(tr.drums[sec[1]], `${id}: unknown drums ${sec[1]}`);
        assert(!sec[2] || tr.bass[sec[2]], `${id}: unknown bass ${sec[2]}`);
        assert(!sec[3] || tr.lead[sec[3]], `${id}: unknown lead ${sec[3]}`);
        assert(!sec[4] || tr.arp[sec[4]], `${id}: unknown arp ${sec[4]}`);
      }
    }
    for (const L of LEVELS) assert(TRACKS[L.data.meta.song], `${L.id}: unknown song ${L.data.meta.song}`);
  });

  if (typeof OfflineAudioContext !== 'undefined') {
    await test('audio: every track renders audible, unclipped output', async () => {
      const { AudioEngine } = await import('../js/audio.js');
      for (const id of Object.keys(TRACKS)) {
        const buf = await AudioEngine.renderOffline(id, 4);
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
        const rms = Math.sqrt(sum / d.length);
        assert(rms > 0.01, `${id} is silent (rms ${rms.toFixed(4)})`);
        assert(peak < 0.99, `${id} clips (peak ${peak.toFixed(3)})`);
      }
    });
  }

  return results;
}
