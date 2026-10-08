/**
 * Level 3 — "Gravity Well" (Normal, 120 BPM, 3★). Gravity portals and ceiling runs, blue/green
 * orbs and blue pads, then the ball. Inputs fall on beats or half beats.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, pit, padTo, orbAt, airOrb, flipHazards, beatLights, sky, colors, pulses, chains } from './patterns.js';

const b = new LevelBuilder({
  id: 'gravity-well', name: 'Gravity Well', author: 'Neon Dash', difficulty: 'normal', stars: 3,
  bpm: 120, song: 'gravityWell', offset: 0, bg: 'hex', ground: 'hex', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#062c3a', ground: '#0b3d4d', line: '#3dffb4', obj: '#3dffb4', deco: '#7df9ff' },
});
const X = (beat) => b.x(beat);
/** Spikes hanging from a ceiling whose underside is at height `top`, centred on a flipped jump's apex. */
const hang = (beat, n, top) => b.spikes(b.apex(beat) - n / 2, top - 1, n, { rot: 180 });

sky(b, 0, 136, 3, 6, 9);
beatLights(b, 0, 136, 4);
b.text(X(2), 4.4, 'Gravity Well', { props: { size: 40 } });

// A (8-23): orbs over pits.
b.spikesAt(8);
b.spikesAt(10, 2);
b.text(X(10.2), 4.8, 'Tap orbs in mid-air', { props: { size: 26 } });
airOrb(b, 11, 11.5, 'Yellow');
b.gap(X(11) + 1.4, 5);
orbAt(b, 14, 'Pink', 1.4);
b.spikes(X(14) + 1.4, 0, 1, { small: true });
b.spikesAt(16, 2);
airOrb(b, 17, 17.5, 'Yellow');
b.gap(X(17) + 1.4, 5);
stepUp(b, 20, 1, 8);
b.spikesAt(22, 1, 1);

// B (24-39): gravity up — run on a ceiling.
colors(b, 24, { bg: '#04202e', obj: '#7df9ff', line: '#3dffb4' });
const ceilB = 5;
b.block(X(23.6), ceilB, Math.ceil(X(35) - X(23.6)), 1);
b.portal('gravUp', X(24) + 1, 1.5);
b.text(X(23), 3.4, 'Gravity flip!', { props: { size: 26 } });
hang(26, 1, ceilB);
hang(28, 2, ceilB);
hang(30, 1, ceilB);
hang(31, 1, ceilB);
hang(32, 2, ceilB);
b.coin(X(29) + 2.4, ceilB - 2.4);
b.gap(X(25), 4);
b.gap(X(30), 4);
b.portal('gravDown', X(34) + 1, 3.5);
b.spikesAt(36);
b.spikesAt(38, 2);

// C (40-55): blue pads and blue orbs bounce between floor and ceiling.
colors(b, 40, { bg: '#062c3a', obj: '#3dffb4', line: '#ffd500' });
pulses(b, 40, 56, 2, 'line');
const ceilC = 6;
b.block(X(39.6), ceilC, Math.ceil(X(55) - X(39.6)), 1);
padTo(b, 40, 'Blue', 0, 0);
hang(42, 1, ceilC);
orbAt(b, 44, 'Blue', ceilC - 0.5);
b.spikesAt(46);
padTo(b, 48, 'Blue', 0, 0);
hang(50, 2, ceilC);
orbAt(b, 52, 'Blue', ceilC - 0.5);
b.spikesAt(54);
chains(b, [X(41), X(47), X(53)], ceilC + 1, 0);

// D (56-71): ball.
colors(b, 56, { bg: '#0a1f3a', obj: '#ffb000', line: '#3dffb4' });
b.portal('portalBall', X(56) + 1, 1.5);
b.text(X(55), 4.2, 'Ball: tap to flip', { props: { size: 26 } });
const ballBeats = [58, 59, 60, 61, 62, 64, 65, 66, 67, 68];
flipHazards(b, ballBeats, 0, 8, { lead: 1.3, len: 3 });
// Coin 2: in the middle of the corridor; flip half a beat early from the ceiling to cross it.
b.coin(X(63) + 1.2, 4);
b.spikes(X(69) + 1.3, 7, 3, { rot: 180 });

// E (72-87): ball with gravity portals that flip you for free.
colors(b, 72, { bg: '#062c3a', obj: '#3dffb4', line: '#7df9ff' });
b.portal('gravUp', X(72) + 1, 1.5);
b.portal('gravUp', X(72) + 1, 4);
b.spikes(X(73) + 1, 0, 4);
flipHazards(b, [74, 75, 76, 78, 79, 80, 82, 83, 84], 0, 8, { lead: 1.3, len: 3 });
b.spikes(X(85) + 1.3, 0, 2);

// F (88-103): cube again with green orbs at the top of each jump.
colors(b, 88, { bg: '#123044', obj: '#3dff7a', line: '#ffd500' });
b.gate('portalCube', X(87) + 1, 1.5, 0, 8);
b.block(X(88) + 6, 6, Math.ceil(X(103) - X(88) - 6), 1);
b.spikesAt(89);
airOrb(b, 91, 91.5, 'Green');
b.gap(X(91) + 1.6, 6);
hang(93.5, 2, 6);
orbAt(b, 96, 'Blue', 5.5);
b.spikesAt(97);
airOrb(b, 99, 99.5, 'Green');
b.gap(X(99) + 1.6, 6);
hang(101.5, 1, 6);
// Coin 3: hidden above the ceiling block's end, reached with an early blue-orb flip.
b.coin(X(103) + 2, 4.6);
orbAt(b, 103, 'Blue', 5.5);

// G (104-120): gravity portals on the beat.
colors(b, 104, { bg: '#062c3a', obj: '#3dffb4', line: '#3dffb4' });
pulses(b, 104, 120, 1);
const ceilG = 5;
b.block(X(104), ceilG, Math.ceil(X(119) - X(104)), 1);
for (let beat = 106; beat < 118; beat += 2) {
  const up = (beat / 2) % 2 === 1;
  b.portal(up ? 'gravUp' : 'gravDown', X(beat) + 1, 1.5);
  b.portal(up ? 'gravUp' : 'gravDown', X(beat) + 1, 3.5);
  if (up) b.spikes(X(beat + 1) + 1.6, ceilG - 1, 1, { rot: 180 });
  else b.spikes(X(beat + 1) + 1.6, 0, 1);
}
b.portal('gravDown', X(118) + 1, 1.5);
b.portal('gravDown', X(118) + 1, 3.5);

b.end(X(126));
export default b.build();
