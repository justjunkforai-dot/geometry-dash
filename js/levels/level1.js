/**
 * Level 1 — "First Steps" (Easy, 128 BPM, 1★). Cube basics: single/double spikes, steps,
 * floating ledges, pits and jump pads. Every jump is pressed on a beat.
 * Music sections start at beats 8, 24, 40 … (2-bar intro, then 4-bar blocks).
 */
import { LevelBuilder } from './builder.js';
import { stepUp, ledge, pit, padTo, beatLights, sky, colors, pulses } from './patterns.js';

const b = new LevelBuilder({
  id: 'first-steps', name: 'First Steps', author: 'Neon Dash', difficulty: 'easy', stars: 1,
  bpm: 128, song: 'firstSteps', offset: 0, bg: 'stars', ground: 'tiles', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#24106b', ground: '#2e148a', line: '#7df9ff', obj: '#42e8ff', deco: '#ff5ce1' },
});
const X = (beat) => b.x(beat);

// Intro (beats 0-8): hints.
b.text(X(1.6), 4.4, 'Tap, click or press Space to jump', { props: { size: 34 } });
b.text(X(5), 3.3, 'Hold to keep jumping', { props: { size: 26 } });
b.deco('arrow', X(6.6), 1.5);
b.deco('arrow', X(7.1), 1.5);
sky(b, 0, 128, 1);
beatLights(b, 0, 128, 4);

// A (8-23): single spikes, then doubles.
for (const beat of [8, 10, 12, 14]) b.spikesAt(beat);
b.spikesAt(16, 2);
b.spikesAt(18);
b.spikesAt(20, 2);
b.spikesAt(22);

// B (24-39): steps.
colors(b, 24, { bg: '#1b0f5c', obj: '#5ef1ff' });
let end = stepUp(b, 24, 1, 10);
b.spikesAt(26, 1, 1);
b.deco('pillar', end - 0.5, 1.5);
stepUp(b, 28, 1, 4);
end = stepUp(b, 29, 1, 10, 1);
b.block(X(29) + 2.5, 0, 10, 1);
b.spikesAt(31, 1, 2);
pit(b, 34, 2);
b.spikesAt(36);
b.spikesAt(37);
b.spikesAt(38, 2);

// C (40-55): pads.
colors(b, 40, { bg: '#2a0a5e', obj: '#ff7af0', line: '#ffc2f6' });
pulses(b, 40, 56, 2);
b.text(X(39.3), 4.6, 'Pads launch you!', { props: { size: 26 } });
end = padTo(b, 40, 'Yellow', 3, 16);
b.spikesAt(43, 1, 3);
b.spikesAt(46);
padTo(b, 48, 'Pink', 0, 0);
b.spikes(X(48) + 1.5, 0, 1);
b.spikesAt(50);
b.spikesAt(52, 2);
b.spikesAt(54);

// D (56-71): floating ledges over a pit. Coin 1 floats above the middle ledge — jump on it
// half a beat early to grab it and still make the next ledge.
colors(b, 56, { bg: '#24106b', obj: '#42e8ff', line: '#7df9ff' });
const d0 = X(56);
ledge(b, 56, 1, 3);
ledge(b, 57, 2, 3);
ledge(b, 58, 1, 3);
b.gap(d0 + 5.5, 7);
b.gap(d0 + 15.4, 2);
b.coin(X(57) + 4, 5);
b.deco('chain', X(57) + 3.2, 2.5);
b.deco('chain', X(57) + 4.8, 2.5);
b.spikesAt(64, 2);
b.spikesAt(66);
b.spikesAt(67);
b.spikesAt(68, 2);
b.spikesAt(70);

// E (72-87): red pad climb, staircase down; coin 2 sits in the air over a double spike.
colors(b, 72, { bg: '#0f1d5e', obj: '#7dff8a', line: '#b4ffbf' });
end = padTo(b, 72, 'Red', 5, 17);
b.spikesAt(75.6, 1, 5);
b.stairs(end, 0, 3, -1, 2);
b.spikesAt(80, 2);
b.spikesAt(82);
b.spikesAt(83);
b.coin(b.apex(84), 3.55);
b.spikesAt(84, 2);
b.spikesAt(86);

// F (88-103): the triple spike, then block hops.
colors(b, 88, { bg: '#2b0d4a', obj: '#ffd23f', line: '#fff0a8' });
b.text(X(87.2), 4.4, 'Triple! Jump right before it', { props: { size: 26 } });
b.spikesAt(88, 3);
b.spikesAt(90);
end = stepUp(b, 92, 1, 4);
stepUp(b, 93, 1, 4, 1);
b.block(X(93) + 2.5, 0, 4, 1);
b.spikesAt(96, 2);
b.spikesAt(98, 2);
b.spikesAt(100);
b.spikesAt(101);
b.spikesAt(102, 2);

// G (104-119): finale on every beat; a pad lifts you to coin 3.
colors(b, 104, { bg: '#24106b', obj: '#42e8ff', line: '#7df9ff' });
pulses(b, 104, 120, 1);
for (let beat = 104; beat < 118; beat++) {
  if (beat === 110 || beat === 111) continue;
  b.spikesAt(beat, beat % 4 === 0 ? 2 : 1);
}
padTo(b, 110, 'Yellow', 0, 0);
b.spikes(X(110) + 2.8, 0, 3);
b.orb(X(110) + 2.9, 4.4, 'Yellow');
b.coin(X(110) + 5.2, 7.2);

b.text(X(121), 4, 'Well done!', { props: { size: 34 } });
b.end(X(125));

export default b.build();
