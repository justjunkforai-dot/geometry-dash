/**
 * Level 4 — "Pulse Reactor" (Normal, 132 BPM, 4★). Introduces the UFO and mini size; the
 * reactor lights pulse with the kick (pulse triggers) and the palette shifts per section.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, pit, padTo, orbAt, tunnel, tunnelLow, beatLights, sky, colors, pulses } from './patterns.js';

const b = new LevelBuilder({
  id: 'pulse-reactor', name: 'Pulse Reactor', author: 'Neon Dash', difficulty: 'normal', stars: 4,
  bpm: 132, song: 'pulseReactor', offset: 0, bg: 'circuit', ground: 'grid', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#3a1500', ground: '#4d1e00', line: '#ff6a00', obj: '#ffaa2b', deco: '#ffd84a' },
});
const X = (beat) => b.x(beat);

sky(b, 0, 160, 4, 4, 9);
beatLights(b, 0, 160, 2);
b.text(X(2), 4.4, 'Pulse Reactor', { props: { size: 40 } });

// A (8-23): cube warm-up, the reactor pulses on every beat.
pulses(b, 8, 24, 1, 'obj');
pulses(b, 8, 24, 4, 'bg', '#5a2400');
b.spikesAt(8);
b.spikesAt(10, 2);
b.spikesAt(12);
b.spikesAt(13);
stepUp(b, 14, 1, 6);
b.spikesAt(16, 1, 1);
pit(b, 18, 2);
b.spikesAt(20, 2);
b.spikesAt(22);

// B (24-39): UFO — tap to hop; one tap per beat drifts down, two climb.
colors(b, 24, { bg: '#2b1000', obj: '#ffd84a', line: '#ff3b1f' });
b.gate('portalUfo', X(24) + 1, 1.5);
b.text(X(22.6), 4.5, 'UFO: tap to hop', { props: { size: 26 } });
const u1 = X(24) + 4;
const u1end = X(39.6);
const cu1 = (cx) => {
  const t = (cx - u1) / (u1end - u1);
  return 3.6 + 2.2 * Math.sin(t * Math.PI * 2.5) * Math.min(1, t / 0.15);
};
const pocket = Math.floor(u1 + 34);
tunnel(b, u1, u1end, cu1, 5, 0, 10, 'panel', [[pocket, pocket + 8, 0, 2]]);
b.coin(pocket + 4, tunnelLow(cu1, 5, pocket + 4) + 6.2);
pulses(b, 24, 40, 2, 'obj');

// C (40-55): mini cube — slabs only the mini cube fits under.
colors(b, 40, { bg: '#3a1500', obj: '#ffaa2b', line: '#ff6a00' });
b.gate('portalCube', u1end + 0.5, Math.max(1.5, Math.round(cu1(u1end))), 0, 10);
b.portal('sizeMini', X(40) + 1, 1.5);
b.mini = true;
b.text(X(39.5), 4.6, 'Mini!', { props: { size: 30 } });
pulses(b, 40, 56, 1, 'obj');
b.spikesAt(42, 1);
for (let x = Math.floor(X(43.5)); x < X(45.5); x++) b.add('slab', x, 0);
b.spikesAt(46, 2);
b.spikesAt(48, 1);
for (let x = Math.floor(X(49.5)); x < X(51); x++) b.add('slab', x, 0);
// Coin 2: on top of the second slab run — hop up onto it instead of ducking under.
b.coin(X(50) + 0.6, 1.5);
b.spikesAt(52, 2);
b.spikesAt(54);

// D (56-71): mini UFO.
colors(b, 56, { bg: '#241000', obj: '#ff6a00', line: '#ffd84a' });
b.gate('portalUfo', X(56) + 1, 1.5);
const u2 = X(56) + 4;
const u2end = X(71.6);
const cu2 = (cx) => 4.5 + 1.6 * Math.sin(((cx - u2) / 34) * Math.PI * 2);
tunnel(b, u2, u2end, cu2, 4, 0, 10, 'panel');
pulses(b, 56, 72, 1, 'line', '#ffffff');

// E (72-87): normal size cube with orbs.
colors(b, 72, { bg: '#3a1500', obj: '#ffaa2b', line: '#ff6a00' });
b.gate('portalCube', u2end + 0.5, Math.max(1.5, Math.round(cu2(u2end))), 0, 10);
b.portal('sizeNormal', X(72) + 1, 1.5);
b.mini = false;
b.spikesAt(74, 2);
orbAt(b, 76, 'Yellow', 1.5);
b.gap(X(76) + 1.2, 3);
b.spikesAt(78);
orbAt(b, 80, 'Pink', 1.4);
b.spikes(X(80) + 1.4, 0, 1);
b.spikesAt(82, 2);
b.spikesAt(84);
b.spikesAt(85);
b.spikesAt(86, 2);

// F (88-103): UFO with spiked pillars.
colors(b, 88, { bg: '#1f0d00', obj: '#ffd84a', line: '#ff3b1f' });
b.gate('portalUfo', X(88) + 1, 1.5);
const u3 = X(88) + 4;
const u3end = X(103.6);
const cu3 = (cx) => 5 + 1.8 * Math.sin(((cx - u3) / 28) * Math.PI * 2);
tunnel(b, u3, u3end, cu3, 5, 0, 10, 'panel');
for (let k = 0; k < 4; k++) {
  const cx = Math.floor(u3 + 8 + k * 16);
  if (cx >= u3end - 2) break;
  const lo = tunnelLow(cu3, 5, cx);
  b.spikes(cx, lo, 1);
}
pulses(b, 88, 104, 1, 'obj');

// G (104-119): fast cube with pads; coin 3 on a high ledge above a red pad.
colors(b, 104, { bg: '#3a1500', obj: '#ffaa2b', line: '#ff6a00' });
b.gate('portalCube', u3end + 0.5, Math.max(1.5, Math.round(cu3(u3end))), 0, 10);
b.speed(104, 2, 0, 10);
b.spikesAt(106);
padTo(b, 108, 'Yellow', 3, 10);
b.spikesAt(110.5, 1, 3);
b.spikesAt(112, 2);
padTo(b, 114, 'Red', 0, 0);
b.platform(X(114) + 5, 5, 3);
b.coin(X(114) + 6.5, 6.6);
b.spikes(X(114) + 2.4, 0, 3);
b.spikesAt(117);

// H (120-139): mini finale at 1.3×.
colors(b, 120, { bg: '#2b1000', obj: '#ffd84a', line: '#ffffff' });
b.portal('sizeMini', X(120) + 1, 1.5);
b.mini = true;
pulses(b, 120, 136, 1, 'obj');
pulses(b, 120, 136, 2, 'bg', '#6a2a00');
for (let beat = 122; beat < 136; beat += 2) b.spikesAt(beat, beat % 4 === 0 ? 2 : 1);
b.portal('sizeNormal', X(137) + 1, 1.5);
b.end(X(144));

export default b.build();
