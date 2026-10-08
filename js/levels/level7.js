/**
 * Level 7 — "Saw Factory" (Harder, 136 BPM, 7★). Saws (static and on beat-synced paths), the
 * robot's variable jump, move triggers that slam crushers down and lift gates, and the swing.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, pit, padTo, tunnel, tunnelLow, beatLights, sky, colors, pulses } from './patterns.js';

const b = new LevelBuilder({
  id: 'saw-factory', name: 'Saw Factory', author: 'Neon Dash', difficulty: 'harder', stars: 7,
  bpm: 136, song: 'sawFactory', offset: 0, bg: 'gears', ground: 'tiles', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#1c1c22', ground: '#2a2a33', line: '#ffb000', obj: '#ff3b3b', deco: '#ffb000' },
});
const X = (beat) => b.x(beat);
const beatSec = 60 / 136;

/** A saw oscillating by (dx, dy) blocks every `beats`, positioned at `atPhase` (0..1) on `beat`. */
function movingSaw(x, y, size, dx, dy, beats, beat, atPhase = 0.5) {
  const period = beats * beatSec;
  const phase = (((atPhase - b.time(beat) / period) % 1) + 1) % 1;
  b.saw(x, y, size, { props: { path: { dx, dy, period, phase } } });
}

let group = 10;
/**
 * A press block hanging `rise` blocks up that slams to the ground on `trigBeat`, a beat
 * before the player arrives — it becomes a step to land on.
 */
function crusher(x, w, h, rise, trigBeat) {
  const g = group++;
  b.inGroup(g, () => b.block(x, rise, w, h, 'panel'));
  for (let k = 0; k < w; k++) b.deco('chain', x + k + 0.5, rise + h + 0.5);
  b.trigger('trMove', X(trigBeat), { group: g, dx: 0, dy: -rise, duration: beatSec * 0.5, easing: 'in' });
  b.trigger('trShake', X(trigBeat + 0.5), { strength: 5, duration: 0.2 });
}

/** A wall that lifts out of the way one beat before the player reaches it. */
function gateWall(x, h, beat) {
  const g = group++;
  b.inGroup(g, () => b.block(x, 0, 1, h, 'brick'));
  b.trigger('trMove', X(beat - 1.5), { group: g, dx: 0, dy: h + 1, duration: beatSec, easing: 'inOut' });
}

sky(b, 0, 160, 7, 5, 9);
beatLights(b, 0, 160, 2);
b.text(X(2), 4.4, 'Saw Factory', { props: { size: 40 } });
for (let i = 0; i < 12; i++) b.deco('gear', X(4 + i * 12), 7 + (i % 3), { props: { layer: 'B' } });

// A (8-23): cube over grounded saws.
b.saw(b.apex(8), 0, 'M');
b.spikesAt(10);
b.saw(b.apex(12), 0, 'M');
b.spikesAt(14, 2);
stepUp(b, 16, 1, 10);
b.saw(b.apex(18) - 0.2, 1.5, 'S');
pit(b, 21, 2);
b.saw(b.apex(23), 0, 'M');

// B (24-39): robot — tap for low jumps, hold for high ones.
colors(b, 24, { bg: '#16161c', obj: '#ffb000', line: '#ff3b3b' });
b.gate('portalRobot', X(24) + 1, 1.5);
b.text(X(23), 4.6, 'Robot: hold longer to jump higher', { props: { size: 24 } });
stepUp(b, 26, 3, 5);
b.saw(b.apex(28), 0, 'M');
b.spikesAt(30);
stepUp(b, 32, 3, 4);
// Coin 1 on a lonely pillar right after a high jump.
b.block(X(33) + 4, 0, 1, 5);
b.coin(X(33) + 4.5, 5.6);
b.spikes(X(33) + 5, 0, 2);
b.saw(b.apex(36), 0, 'M');
b.spikesAt(38, 2);

// C (40-55): cube with saws on beat-synced paths.
colors(b, 40, { bg: '#1c1c22', obj: '#ff3b3b', line: '#ffb000' });
b.gate('portalCube', X(40) + 1, 1.5);
pulses(b, 40, 56, 1, 'obj');
movingSaw(b.apex(42), 1.2, 'S', 0, 2.6, 2, 42, 0.5);
b.spikesAt(44, 2);
movingSaw(b.apex(46), 1.2, 'S', 0, 2.6, 2, 46, 0.5);
movingSaw(X(48) + 1.5, 4, 'M', 0, -2, 4, 48, 0);
b.spikesAt(50);
movingSaw(b.apex(52), 1, 'S', 0, 3, 2, 52, 0.5);
b.spikesAt(54, 2);

// D (56-71): gates lift ahead of you, presses slam down on the beat — land on top of them.
colors(b, 56, { bg: '#22161a', obj: '#ffb000', line: '#ffffff' });
gateWall(X(57) + 2, 4, 57);
crusher(X(60) + 2.5, 3, 1, 5, 59);
b.spikesAt(62, 2);
gateWall(X(63) + 2, 4, 63);
crusher(X(66) + 2.5, 4, 2, 6, 65);
// Coin 2 hangs above the second press: jump again from its top at the right moment.
b.coin(X(66) + 5.5, 5);
b.spikesAt(68, 2);
b.spikesAt(70);

// E (72-87): swing through a sawmill tunnel.
colors(b, 72, { bg: '#16161c', obj: '#ff3b3b', line: '#ffb000' });
b.gate('portalSwing', X(72) + 1, 1.5);
b.text(X(70.6), 4.6, 'Swing: tap to flip', { props: { size: 24 } });
const s0 = X(72) + 4;
const s1 = X(87.6);
const sc = (cx) => 5 + 1.4 * Math.sin(((cx - s0) / 34) * Math.PI * 2);
const pk = Math.floor(s0 + 30);
tunnel(b, s0, s1, sc, 6, 0, 10, 'block', [[pk, pk + 8, 0, 2]]);
b.coin(pk + 4, tunnelLow(sc, 6, pk + 4) + 7.1);
for (let k = 0; k < 4; k++) {
  const cx = Math.floor(s0 + 12 + k * 15);
  b.saw(cx, sc(cx) + (k % 2 ? 2.2 : -2.2), 'S');
}

// F (88-103): robot with circling saws.
colors(b, 88, { bg: '#1c1c22', obj: '#ffb000', line: '#ff3b3b' });
b.gate('portalRobot', s1 + 0.5, sc(s1));
b.spikesAt(90, 2);
stepUp(b, 92, 3, 4);
b.saw(X(93) + 6, 1.4, 'M', { props: { path: { mode: 'circle', dx: 0.6, period: 4 * beatSec } } });
b.spikesAt(96);
stepUp(b, 98, 2, 6);
b.saw(b.apex(100), 2, 'S');
b.spikesAt(102, 2);

// G (104-119): ship at 1.3× between oscillating saws.
colors(b, 104, { bg: '#22161a', obj: '#ff3b3b', line: '#ffffff' });
b.gate('portalShip', X(104) + 1, 1.5);
b.speed(104, 2, 0, 10);
const t0 = X(104) + 5;
const t1 = X(119.6);
tunnel(b, t0, t1, () => 5, 7);
for (let k = 0; k < 6; k++) {
  const beat = 106 + k * 2;
  movingSaw(X(beat) + 2, k % 2 ? 6 : 4, 'M', 0, k % 2 ? -2 : 2, 2, beat, 0);
}
pulses(b, 104, 120, 1, 'obj');

// H (120-139): cube finale at 1.3× with saws and a last crusher.
colors(b, 120, { bg: '#1c1c22', obj: '#ff3b3b', line: '#ffb000' });
b.gate('portalCube', t1 + 0.5, 5);
b.spikesAt(122);
b.saw(b.apex(124), 0, 'M');
b.spikesAt(126, 2);
movingSaw(b.apex(128), 1.2, 'S', 0, 2.6, 2, 128, 0.5);
crusher(Math.round(X(130)) + 3, 3, 1, 4, 129.4);
b.saw(b.apex(134), 0, 'L');
b.speed(136, 1);
b.end(X(144));

export default b.build();
