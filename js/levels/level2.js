/**
 * Level 2 — "Neon Skyline" (Easy, 140 BPM, 2★). Introduces the ship and speed portals.
 * Ship tunnels are wide and gently curved; speed changes happen at section boundaries.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, pit, padTo, orbAt, airOrb, tunnel, tunnelLow, beatLights, sky, colors, pulses, chains } from './patterns.js';

const b = new LevelBuilder({
  id: 'neon-skyline', name: 'Neon Skyline', author: 'Neon Dash', difficulty: 'easy', stars: 2,
  bpm: 140, song: 'neonSkyline', offset: 0, bg: 'city', ground: 'stripes', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#3a0a4a', ground: '#4a0f5e', line: '#ffd23f', obj: '#ff4fd8', deco: '#ffd23f' },
});
const X = (beat) => b.x(beat);
const wave = (x0, amp, len, base) => (cx) => base + amp * Math.sin(((cx - x0) / len) * Math.PI * 2);

sky(b, 0, 150, 2, 4, 9);
beatLights(b, 0, 24, 4);

// Intro + cube warm-up (8-23).
b.text(X(2), 4.2, 'Neon Skyline', { props: { size: 40 } });
for (const beat of [8, 10]) b.spikesAt(beat);
b.spikesAt(12, 2);
b.spikesAt(14);
stepUp(b, 16, 1, 7);
b.spikesAt(18, 1, 1);
b.spikesAt(20, 2);
b.text(X(21.3), 4.6, 'Hold to fly the ship!', { props: { size: 28 } });

// Ship tunnel 1 (24-39), 1×, wide gap with a ceiling pocket hiding coin 1.
colors(b, 24, { bg: '#2c0838', obj: '#ffd23f', line: '#ff4fd8' });
b.gate('portalShip', X(24) + 1, 1.5);
const t1 = X(24) + 4;
const t1end = X(39.5);
const c1 = wave(t1, 1.4, 26, 4.6);
// Coin 1 hides in a pocket where the ceiling opens two blocks higher.
const p1 = Math.floor(t1 + 30);
tunnel(b, t1, t1end, c1, 6, 0, 10, 'block', [[p1, p1 + 9, 0, 2]]);
b.coin(p1 + 4.5, tunnelLow(c1, 6, p1 + 4) + 6.9);
chains(b, [t1 + 10, t1 + 22, t1 + 40], 10, 2);

// Cube at 1.3× (40-55).
const exit1 = Math.round(c1(t1end));
b.gate('portalCube', t1end + 0.5, Math.max(1.5, exit1), 0, 10);
b.speed(40, 2, 0, 10);
colors(b, 40, { bg: '#3a0a4a', obj: '#ff4fd8', line: '#ffd23f' });
pulses(b, 40, 56, 2);
b.spikesAt(42);
b.spikesAt(44, 2);
b.spikesAt(46);
stepUp(b, 48, 1, 9);
b.spikesAt(50, 1, 1);
b.spikesAt(52, 2);
b.spikesAt(54);

// Ship tunnel 2 (56-71), 1.3×, narrower with pillars.
colors(b, 56, { bg: '#1d0a40', obj: '#7df9ff', line: '#ff4fd8' });
b.gate('portalShip', X(56) + 1, 1.5);
const t2 = X(56) + 4;
const t2end = X(71.5);
const c2 = wave(t2, 1.8, 36, 5);
tunnel(b, t2, t2end, c2, 5);
chains(b, [t2 + 14, t2 + 44], 10, 3);

// Cube at 1× (72-87): pads and orbs.
const exit2 = Math.round(c2(t2end));
b.gate('portalCube', t2end + 0.5, Math.max(1.5, exit2), 0, 10);
b.speed(72, 1, 0, 10);
colors(b, 72, { bg: '#3a0a4a', obj: '#ff4fd8', line: '#ffd23f' });
beatLights(b, 72, 88, 2);
b.spikesAt(74);
padTo(b, 76, 'Yellow', 3, 8);
b.spikesAt(78.5, 1, 3);
b.text(X(79.4), 4.8, 'Tap on the orb!', { props: { size: 26 } });
airOrb(b, 81, 81.5, 'Yellow');
b.gap(X(81) + 1.4, 4);
b.spikesAt(84, 1);
b.spikesAt(86);

// Cube at 1.3× (88-103): steps; coin 2 on a high ledge reached from an orb.
b.speed(88, 2);
colors(b, 88, { bg: '#26083d', obj: '#3dff9e', line: '#ffd23f' });
b.spikesAt(90);
stepUp(b, 92, 1, 5);
stepUp(b, 93, 1, 5, 1);
b.block(X(93) + 2.5, 0, 5, 1);
orbAt(b, 94.5, 'Yellow', 3.5);
b.platform(X(94.5) + 4.2, 4, 3);
b.coin(X(94.5) + 5.7, 5.6);
b.spikesAt(96, 2);
b.spikesAt(98);
pit(b, 100, 2);
b.spikesAt(102);

// Ship tunnel 3 (104-119), 1.3×: tighter curves; coin 3 behind a pillar below the path.
colors(b, 104, { bg: '#120830', obj: '#ffd23f', line: '#7df9ff' });
b.gate('portalShip', X(104) + 1, 1.5);
const t3 = X(104) + 4;
const t3end = X(119.5);
const c3 = wave(t3, 2.2, 30, 5);
// Coin 3 sits in a pocket two blocks below the tunnel floor.
const p3 = Math.floor(t3 + 50);
tunnel(b, t3, t3end, c3, 5, 0, 10, 'block', [[p3, p3 + 10, 2, 0]]);
b.coin(p3 + 5, tunnelLow(c3, 5, p3 + 5) - 1);

// Finale (120-143).
const exit3 = Math.round(c3(t3end));
b.gate('portalCube', t3end + 0.5, Math.max(1.5, exit3), 0, 10);
colors(b, 120, { bg: '#3a0a4a', obj: '#ff4fd8', line: '#ffd23f' });
pulses(b, 120, 136, 1);
beatLights(b, 120, 144, 2);
for (let beat = 122; beat < 136; beat += 2) b.spikesAt(beat, beat % 4 === 0 ? 2 : 1);
b.spikesAt(137);
b.end(X(143));

export default b.build();
