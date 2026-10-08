/**
 * Level 8 — "Final Descent" (Insane, 160 BPM, 9★). Every mode in sequence, 1.3×–2× speeds,
 * camera zoom/shake and colour shifts on the drops. Sections are 16 beats long.
 */
import { LevelBuilder } from './builder.js';
import {
  stepUp, pit, padTo, orbAt, airOrb, tunnel, tunnelLow, flipHazards, beatLights, sky, colors, pulses,
  waveRun, mirroredTunnel, hang, movingSaw, crusher, portalColumn,
} from './patterns.js';

const b = new LevelBuilder({
  id: 'final-descent', name: 'Final Descent', author: 'Neon Dash', difficulty: 'insane', stars: 9,
  bpm: 160, song: 'finalDescent', offset: 0, bg: 'stars', ground: 'tiles', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#1a0005', ground: '#2b0010', line: '#ff2056', obj: '#ff2056', deco: '#ff8aa8' },
});
const X = (beat) => b.x(beat);
const zoom = (beat, z, d = 0.6) => b.trigger('trZoom', X(beat), { zoom: z, duration: d, easing: 'inOut' });
const shake = (beat, s = 7) => b.trigger('trShake', X(beat), { strength: s, duration: 0.35 });

sky(b, 0, 264, 8, 5, 9);
b.text(X(2), 4.4, 'Final Descent', { props: { size: 44 } });

// 1 (8-23): cube 1× — the warm-up already asks for a triple.
beatLights(b, 8, 24, 1);
b.spikesAt(8);
b.spikesAt(9);
b.spikesAt(10, 2);
b.spikesAt(12, 3);
b.spikesAt(14);
b.spikesAt(15, 2);
airOrb(b, 16, 16.5, 'Yellow');
b.gap(X(16) + 1.3, 5);
airOrb(b, 18, 18.5, 'Pink');
b.gap(X(18) + 1.3, 3);
stepUp(b, 20, 1, 3);
stepUp(b, 21, 1, 10, 1);
b.block(X(21) + 2.5, 0, 10, 1);
b.spikesAt(23, 1, 2);

// 2 (24-39): ship at 1.3×, four-block tunnel.
colors(b, 24, { bg: '#22000a', obj: '#ff8aa8', line: '#ffffff' });
shake(24);
b.gate('portalShip', X(24) + 1, 1.5);
b.speed(24, 2, 0, 10);
const s0 = X(24) + 5, s1 = X(39.6);
const sc = (cx) => 5 + 2 * Math.sin(((cx - s0) / 32) * Math.PI * 2);
const pk = Math.floor(s0 + 50);
tunnel(b, s0, s1, sc, 4, 0, 10, 'block', [[pk, pk + 10, 0, 2]]);
b.coin(pk + 5, tunnelLow(sc, 4, pk + 5) + 5.1);
pulses(b, 24, 40, 1, 'obj');

// 3 (40-55): cube at 1.6× — pads, then a ceiling run.
colors(b, 40, { bg: '#1a0005', obj: '#ff2056', line: '#ff8aa8' });
b.gate('portalCube', s1 + 0.5, sc(s1));
b.speed(40, 3, 0, 10);
b.spikesAt(42, 2);
padTo(b, 44, 'Yellow', 3, 16);
b.spikesAt(46, 2, 3);
b.portal('gravUp', X(48) + 1, 1.5);
b.block(X(47.6), 6, Math.ceil(X(54.2) - X(47.6)), 1);
hang(b, 50, 2, 6);
hang(b, 52, 3, 6);
b.portal('gravDown', X(54) + 1, 4.5);

// 4 (56-71): wave at 1×, three-block zig-zag.
colors(b, 56, { bg: '#12000a', obj: '#ffffff', line: '#ff2056' });
b.speed(56, 1, 0, 10);
zoom(56, 0.9);
const w4 = waveRun(b, 56.5, 71.5, 3, 4, 0, 'portalUfo');

// 5 (72-87): mini UFO over spiked pillars.
colors(b, 72, { bg: '#1a0005', obj: '#ff2056', line: '#ff8aa8' });
zoom(72, 1);
const u0 = X(72) + 4, u1 = X(87.6);
portalColumn(b, 'sizeMini', w4.end + 2.5, 0, 10);
const uc = (cx) => 5 + 1.2 * Math.sin(((cx - u0) / 30) * Math.PI * 2 + Math.PI);
tunnel(b, u0, u1, uc, 4, 0, 10, 'panel');
for (let cx = Math.floor(u0 + 6); cx < u1 - 4; cx += 9) b.spikes(cx, tunnelLow(uc, 4, cx), 1, { small: true });

// 6 (88-103): ball at 1.3×.
colors(b, 88, { bg: '#20000c', obj: '#ff8aa8', line: '#ffffff' });
b.gate('portalBall', u1 + 0.5, 4.5);
b.portal('sizeNormal', u1 + 2.5, 4.5);
b.speed(88, 2, 0, 10);
flipHazards(b, [90, 91, 92, 93, 94, 95, 96.5, 97.5, 98.5, 100, 101], 1, 9, { lead: 1.5, len: 3 });
b.block(X(89), 0, Math.ceil(X(102.6) - X(89)), 1);
b.block(X(89), 9, Math.ceil(X(102.6) - X(89)), 1);

// 7 (104-119): dual ship through mirrored bands.
colors(b, 104, { bg: '#1a0005', obj: '#ff2056', line: '#ff8aa8' });
shake(104);
b.gate('portalShip', X(103) + 1, 2.5, 0, 10);
b.portal('dualOn', X(104) + 1, 2.5);
const d0 = X(104) + 4, d1 = X(119.6);
mirroredTunnel(b, d0, d1, (cx) => 2.2 + 0.9 * Math.sin(((cx - d0) / 22) * Math.PI * 2), 3);
pulses(b, 104, 120, 1, 'bg', '#40001a');

// 8 (120-135): robot with saws and presses.
colors(b, 120, { bg: '#1c0008', obj: '#ffb000', line: '#ff2056' });
b.portal('dualOff', d1 + 1, 2);
b.portal('dualOff', d1 + 1, 8);
b.gate('portalRobot', d1 + 3, 1.5, 0, 10);
b.speed(121, 1, 0, 10);
stepUp(b, 123, 3, 8);
b.saw(b.apex(125), 0, 'M');
movingSaw(b, b.apex(127), 1.2, 'S', 0, 2.6, 2, 127, 0.5);
crusher(b, X(130) + 2.5, 3, 2, 6, 129);
b.spikesAt(133, 2);

// 9 (136-151): spider at 1.3×; coin 2 on the ceiling mid-run.
colors(b, 136, { bg: '#1a0005', obj: '#ff2056', line: '#ffffff' });
b.gate('portalSpider', X(136) + 1, 1.5, 0, 10);
b.speed(136, 2, 0, 8);
flipHazards(b, [138, 139, 140, 141, 142, 144, 145, 146, 147, 148], 0, 8, { lead: 1.6, len: 3 });
b.coin(X(143) + 2, 7.4);
b.spikes(X(149) + 1.6, 7, 3, { rot: 180 });

// 10 (152-167): cube at 2× — zoomed out, every beat.
colors(b, 152, { bg: '#30000f', obj: '#ffffff', line: '#ff2056' });
b.gate('portalCube', X(151) + 1, 1.5, 0, 8);
b.speed(152, 4, 0, 10);
zoom(152, 0.85);
shake(152, 9);
pulses(b, 152, 168, 1, 'obj', '#ff2056');
for (let beat = 154; beat < 167; beat++) {
  if (beat === 160) { airOrb(b, 160, 160.5, 'Red'); b.gap(X(160) + 1.6, 12); continue; }
  if (beat === 161 || beat === 162) continue;
  b.spikesAt(beat, beat % 4 === 0 ? 3 : beat % 2 ? 1 : 2);
}
b.coin(X(160.5) + 6, 7.2);

// 11 (168-183): wave at 2×, mirrored.
colors(b, 168, { bg: '#12000a', obj: '#ff2056', line: '#ffffff' });
zoom(168, 0.9);
b.portal('mirrorOn', X(167.5) + 1, 1.5);
const w11 = waveRun(b, 168, 183.5, 4, 4, 0, 'portalSwing');
portalColumn(b, 'mirrorOff', w11.end + 3, 0, 10);

// 12 (184-199): swing at 1.3×.
colors(b, 184, { bg: '#1a0005', obj: '#ff8aa8', line: '#ff2056' });
zoom(184, 1);
b.speed(184, 2, 0, 10);
const w0 = X(184) + 5, w1 = X(199.6);
const wc = (cx) => 5 + 1.5 * Math.sin(((cx - w0) / 30) * Math.PI * 2);
tunnel(b, w0, w1, wc, 5);

// 13 (200-215): ship at 2× between oscillating saws.
colors(b, 200, { bg: '#22000a', obj: '#ff2056', line: '#ffffff' });
b.gate('portalShip', w1 + 0.5, wc(w1));
b.speed(200, 4, 0, 10);
shake(200, 8);
tunnel(b, X(200) + 4, X(215.6), () => 5, 7);
for (let k = 0; k < 7; k++) movingSaw(b, X(202 + k * 2) + 2, k % 2 ? 6 : 4, 'M', 0, k % 2 ? -1.6 : 1.6, 2, 202 + k * 2, 0);

// 14 (216-231): cube at 1.6× with blue/green orb switching.
colors(b, 216, { bg: '#1a0005', obj: '#ff2056', line: '#ff8aa8' });
b.gate('portalCube', X(215.6) + 1, 4.5);
b.speed(216, 3, 0, 10);
b.block(X(218), 6, Math.ceil(X(230) - X(218)), 1);
b.spikesAt(218);
padTo(b, 220, 'Blue', 0, 0);
hang(b, 222, 2, 6);
orbAt(b, 224, 'Blue', 5.5);
b.spikesAt(225);
airOrb(b, 226, 226.5, 'Green');
b.gap(X(226) + 1.5, 6);
orbAt(b, 229, 'Blue', 5.5);

// 15 (232-247): mini wave at 1.3×.
colors(b, 232, { bg: '#2b0010', obj: '#ffffff', line: '#ff2056' });
b.speed(232, 2, 0, 10);
const mw = waveRun(b, 232, 247.5, 3, 4, 0, 'portalCube');
b.portal('sizeMini', mw.x0 - 1, 1.5);
portalColumn(b, 'sizeNormal', mw.end + 2.5, 0, 10);

// 16 (248-262): outro at 1×.
colors(b, 248, { bg: '#1a0005', obj: '#ff2056', line: '#ff2056' });
b.speed(248, 1, 0, 10);
beatLights(b, 248, 262, 1);
b.spikesAt(250);
b.spikesAt(252, 2);
b.spikesAt(254, 3);
b.text(X(256.5), 4.5, 'GG', { props: { size: 60 } });
b.end(X(262));

export default b.build();
