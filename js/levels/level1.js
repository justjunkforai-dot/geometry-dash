/**
 * Level 1 — "First Steps" (Easy, 128 BPM). Cube basics: single/double spikes, steps,
 * platforms, pits and jump pads. Every jump is pressed on a beat (b.x(beat) is the press point).
 */
import { LevelBuilder } from './builder.js';

const b = new LevelBuilder({
  id: 'first-steps',
  name: 'First Steps',
  author: 'Neon Dash',
  difficulty: 'easy',
  stars: 1,
  bpm: 128,
  song: 'firstSteps',
  offset: 0,
  bg: 'stars',
  ground: 'tiles',
  startMode: 'cube',
  startSpeed: 1,
  palette: { bg: '#24106b', ground: '#2e148a', line: '#7df9ff', obj: '#42e8ff', deco: '#ff5ce1' },
});

const X = (beat) => b.x(beat);

// Intro: hints and a calm run-in.
b.text(X(1.5), 4.3, 'Tap, click or press Space to jump');
b.text(X(4.5), 3.4, 'Hold to keep jumping', { props: { size: 24 } });
b.deco('arrow', X(6.4), 1.6);
b.deco('arrow', X(7), 1.6);

// Beats 8-23: single spikes on every other beat, then doubles.
for (const beat of [8, 10, 12, 14]) b.spikesAt(beat, 1);
b.spikesAt(16, 2);
b.spikesAt(18, 1);
b.spikesAt(20, 2);
b.spikesAt(22, 1);

// Beats 24-39: steps and platforms.
const stepX = (beat) => X(beat) + 2.5;
let s = stepX(24);
b.block(s, 0, 12, 1);
b.spikesAt(26, 1, 1);
s = stepX(28);
b.block(s, 0, 5, 1);
b.block(s + 5, 0, 10, 2);
b.spikesAt(30, 1, 2);
b.deco('pillar', s + 9.5, 2.5);
// Drop down and clear a pit of small spikes from the ground.
b.gap(X(32) + 1.2, 3);
b.spikesAt(34, 2);
b.spikesAt(36, 1);
b.spikesAt(37, 1);
b.spikesAt(38, 1);

// Beats 40-55: jump pads lift you to platforms.
b.pad(X(40) + 1.4, 0, 'Yellow');
b.block(X(40) + 4.8, 0, 14, 3);
b.spikesAt(43, 1, 3);
b.text(X(39.2), 4.6, 'Pads launch you!', { props: { size: 22 } });
b.spikesAt(46, 2);
b.pad(X(48) + 1.4, 0, 'Pink');
b.spikes(X(48) + 3.2, 0, 2);
b.spikesAt(50, 1);
b.spikesAt(52, 2);
b.spikesAt(54, 1);

// Beats 56-71: floating platforms over a pit.
s = stepX(56);
b.block(s, 0, 2, 1);
b.platform(s + 4.6, 1, 3);
b.gap(s + 2, 2.6);
b.platform(s + 9.4, 2, 3);
b.gap(s + 7.6, 1.8);
b.platform(s + 14.3, 1, 3);
b.gap(s + 12.4, 1.9);
b.coin(s + 11, 5.2);
b.gap(s + 17.3, 2);
b.spikesAt(64, 2);
b.spikesAt(66, 1);
b.spikesAt(67, 1);
b.spikesAt(68, 2);
b.spikesAt(70, 1);

// Beats 72-87: red pad climb and a staircase down.
b.pad(X(72) + 1.4, 0, 'Red');
b.block(X(72) + 6.4, 0, 8, 5);
b.spikesAt(75.6, 1, 5);
b.stairs(X(72) + 14.4, 0, 3, -1, 2);
b.spikesAt(78, 2);
b.spikesAt(80, 1);
b.spikesAt(81, 1);
b.spikesAt(82, 2);
b.coin(b.apex(84), 3.1);
b.spikesAt(84, 2);
b.spikesAt(86, 1);

// Beats 88-103: the triple spike (marked) and block hops.
b.text(X(87.4), 4.2, 'Triple! Jump late', { props: { size: 22 } });
b.spikesAt(88, 3);
b.spikesAt(90, 1);
s = stepX(92);
b.block(s, 0, 4, 1);
b.block(s + 4, 0, 4, 2);
b.block(s + 8, 0, 6, 1);
b.spikesAt(96, 1, 1);
b.spikesAt(98, 2);
b.spikesAt(100, 1);
b.spikesAt(101, 1);
b.spikesAt(102, 2);

// Beats 104-119: final run on the beat.
for (let beat = 104; beat < 118; beat += 1) {
  if (beat === 111) continue;
  b.spikesAt(beat, beat % 4 === 0 ? 2 : 1);
}
b.coin(b.apex(111) + 0.2, 6.2);
b.pad(X(111) + 1.4, 0, 'Yellow');
b.spikes(X(111) + 3.4, 0, 2);

b.end(X(124));

export default b.build();
