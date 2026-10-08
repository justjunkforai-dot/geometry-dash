/**
 * Per-mechanic tests: pads, orbs, every game mode, portals, triggers and snapshot/restore.
 * Registered by suite.js; `h` provides { assert, run, lvl }.
 */
import { BLOCK, SPEEDS, BASE_SPEED, MINI_SCALE } from '../js/config.js';
import { Sim } from '../js/sim.js';

/** Highest player bottom (blocks) reached during a run. */
function apexOf(h, level, ticks, input) {
  let top = 0;
  h.run(level, ticks, (t, sim) => {
    const p = sim.players[0];
    top = Math.max(top, (p.y - p.h / 2) / BLOCK);
    return input ? input(t, sim) : false;
  });
  return top;
}

export async function mechanicsTests(test, h) {
  const { assert, run, lvl } = h;

  await test('pads: pink < yellow < red launch height, blue flips gravity', () => {
    const height = (c) => apexOf(h, lvl({}, (b) => b.pad(10, 0, c)), 240 * 2);
    const [pink, yellow, red] = ['Pink', 'Yellow', 'Red'].map(height);
    assert(pink < yellow && yellow < red, `heights ${pink.toFixed(2)} ${yellow.toFixed(2)} ${red.toFixed(2)}`);
    assert(yellow > 3.5 && yellow < 4.5, `yellow pad apex ${yellow.toFixed(2)} blocks`);
    const r = run(lvl({}, (b) => b.pad(10, 0, 'Blue')), 240);
    assert(r.p.grav === -1, 'blue pad did not flip gravity');
  });

  await test('orbs: launch strengths, blue/green flip, black slams down, dash flies straight', () => {
    const press = (sim) => {
      const p = sim.players[0];
      return Math.abs(p.x - 12.5 * BLOCK) < 10 && sim.tick % 2 === 0;
    };
    const apex = (c) => apexOf(h, lvl({}, (b) => b.orb(12.5, 1.5, c)), 240 * 2, (t, sim) => press(sim));
    const [pink, yellow, red] = ['Pink', 'Yellow', 'Red'].map(apex);
    assert(pink < yellow && yellow < red, `orb heights ${pink.toFixed(2)} ${yellow.toFixed(2)} ${red.toFixed(2)}`);
    for (const c of ['Blue', 'Green']) {
      const r = run(lvl({}, (b) => b.orb(12.5, 1.5, c)), 240 * 2, (t, sim) => press(sim));
      assert(r.p.grav === -1, `${c} orb did not flip gravity`);
    }
    // Black orb: jump, then use the orb in the air; vertical speed must turn sharply downward.
    let vyMin = 0;
    run(lvl({}, (b) => b.orb(13, 2.6, 'Black')), 240 * 2, (t, sim) => {
      const p = sim.players[0];
      vyMin = Math.min(vyMin, p.vy);
      return t === 270 || (Math.hypot(p.x - 13 * BLOCK, p.y - 2.6 * BLOCK) < 30 && sim.tick % 2 === 0);
    });
    assert(vyMin < -1000, `black orb vy ${vyMin}`);
    // Dash orb at 30° up: while held the path is straight.
    const pts = [];
    run(lvl({}, (b) => b.orb(12.5, 1.5, 'Dash', { rot: -30 })), 240 * 2, (t, sim) => {
      const p = sim.players[0];
      if (p.dashing) pts.push([p.x, p.y]);
      return p.x > 11.6 * BLOCK && p.x < 20 * BLOCK;
    });
    assert(pts.length > 20, 'never dashed');
    const slope = (pts[pts.length - 1][1] - pts[0][1]) / (pts[pts.length - 1][0] - pts[0][0]);
    assert(Math.abs(slope - Math.tan(Math.PI / 6)) < 0.02, `dash slope ${slope}`);
  });

  await test('ship rises while held, falls when released, stays in its corridor', () => {
    const level = lvl({ startMode: 'ship' }, () => {});
    const up = run(level, 240 * 3, () => true);
    assert(Math.abs(up.p.y + up.p.h / 2 - 10 * BLOCK) < 0.5, `held ship not at ceiling (${up.p.y})`);
    const down = run(level, 240 * 3, (t) => t < 120);
    assert(Math.abs(down.p.y - down.p.h / 2) < 0.5, 'released ship did not return to the floor');
  });

  await test('ball flips on press, UFO hops in mid-air, swing flips in mid-air', () => {
    const ball = run(lvl({ startMode: 'ball' }, () => {}), 240, (t) => t === 30);
    assert(ball.p.grav === -1 && ball.p.y > 7 * BLOCK, 'ball did not flip to the ceiling');
    const ufo = run(lvl({ startMode: 'ufo' }, () => {}), 100, (t) => t === 10 || t === 40 || t === 70);
    assert(ufo.events.filter((e) => e.type === 'jump').length === 3, 'UFO did not hop three times');
    assert(ufo.p.y > 3 * BLOCK, `UFO too low after three hops (${ufo.p.y})`);
    const swing = run(lvl({ startMode: 'swing' }, () => {}), 120, (t) => t === 60);
    assert(swing.p.grav === -1 && !swing.p.onGround, 'swing did not flip in the air');
  });

  await test('robot: longer hold jumps higher; spider teleports instantly', () => {
    const level = lvl({ startMode: 'robot' }, () => {});
    const tap = apexOf(h, level, 200, (t) => t >= 20 && t < 22);
    const hold = apexOf(h, level, 200, (t) => t >= 20 && t < 120);
    assert(hold > tap + 1.2, `robot hold ${hold.toFixed(2)} vs tap ${tap.toFixed(2)}`);
    let jump = 0;
    run(lvl({ startMode: 'spider' }, () => {}), 60, (t, sim) => {
      if (t === 31) jump = sim.players[0].y;
      return t === 30;
    });
    assert(jump > 7 * BLOCK, `spider not on the ceiling one tick after the press (y=${jump})`);
  });

  await test('mini, speed, mirror and dual portals', () => {
    const mini = run(lvl({}, (b) => b.portal('sizeMini', 6, 1.5)), 240);
    assert(mini.p.mini && Math.abs(mini.p.w - 30 * MINI_SCALE) < 1e-6, 'mini portal');
    const miniApex = apexOf(h, lvl({}, (b) => b.portal('sizeMini', 4, 1.5)), 400, (t) => t === 200);
    assert(miniApex < 1.6 && miniApex > 1.1, `mini jump apex ${miniApex.toFixed(2)}`);
    for (let i = 0; i < 5; i++) {
      const r = run(lvl({}, (b) => b.portal(`speed${i}`, 6, 1)), 200);
      assert(Math.abs(r.sim.vx - BASE_SPEED * SPEEDS[i]) < 1e-9, `speed portal ${i}`);
    }
    const m = run(lvl({}, (b) => b.portal('mirrorOn', 6, 1.5)), 200);
    assert(m.sim.mirror, 'mirror portal');
    const dual = run(lvl({}, (b) => b.portal('dualOn', 6, 1.5)), 240);
    assert(dual.sim.players.length === 2 && dual.sim.players[1].grav === -1, 'dual twin missing');
    assert(dual.sim.players[1].y > 8 * BLOCK, 'twin not on the ceiling');
    const dualDeath = run(lvl({}, (b) => { b.portal('dualOn', 6, 1.5); b.spikes(20, 9, 1, { rot: 180 }); }), 240 * 3);
    assert(dualDeath.sim.dead && !dualDeath.p.dead, 'twin death must end the run');
  });

  await test('triggers: move shifts collision, toggle removes it, colours and zoom tween', () => {
    const moved = lvl({}, (b) => {
      b.inGroup(3, () => b.block(20, 3, 1, 1));
      b.trigger('trMove', 4, { group: 3, dx: 0, dy: -3, duration: 0.2 });
    });
    assert(run(moved, 240 * 2).sim.dead, 'moved block did not block the path');
    const toggled = lvl({}, (b) => {
      b.inGroup(4, () => b.block(20, 0, 1, 1));
      b.trigger('trToggle', 4, { group: 4, on: false });
    });
    assert(!run(toggled, 240 * 2).sim.dead, 'toggled-off block still collides');
    const col = run(lvl({}, (b) => {
      b.trigger('trColor', 4, { channel: 'bg', color: '#ff0000', duration: 0.5 });
      b.trigger('trZoom', 4, { zoom: 1.5, duration: 0.5 });
    }), 240 * 1.2);
    const c = col.sim.colors.bg;
    assert(c[0] === 255 && c[1] === 0 && c[2] === 0, `bg colour ${c}`);
    assert(Math.abs(col.sim.camera.zoom - 1.5) < 1e-9, 'zoom');
  });

  await test('moving saws are a pure function of time', () => {
    const level = lvl({}, (b) => b.saw(30, 4, 'M', { props: { path: { dx: 0, dy: 2, period: 1 } } }));
    const a = new Sim(level), b = new Sim(level);
    for (let i = 0; i < 300; i++) a.step({ held: false, pressed: false });
    b.world.updatePaths(300 / 240);
    const sa = a.world.pathObjects[0], sb = b.world.pathObjects[0];
    assert(Math.abs(sa.y - sb.y) < 1e-9, 'path position differs');
  });

  await test('snapshot/restore reproduces the exact future (practice checkpoints)', () => {
    const level = lvl({}, (b) => {
      b.inGroup(2, () => b.block(40, 4, 2, 1));
      b.trigger('trMove', 10, { group: 2, dx: 0, dy: -2, duration: 2 });
      b.trigger('trColor', 10, { channel: 'obj', color: '#00ff00', duration: 2 });
      b.portal('portalShip', 20, 1.5);
      b.saw(50, 5, 'S', { props: { path: { dx: 0, dy: 2, period: 1.3 } } });
    });
    const sim = new Sim(level);
    const inp = (t) => ({ held: t % 70 < 30, pressed: t % 70 === 0 });
    for (let t = 1; t <= 600; t++) sim.step(inp(t));
    const snap = sim.snapshot();
    for (let t = 601; t <= 900; t++) sim.step(inp(t));
    const a = sim.hash();
    sim.restore(snap);
    for (let t = 601; t <= 900; t++) sim.step(inp(t));
    assert(sim.hash() === a, 'restored run diverged');
  });
}
