/**
 * Level 6 — "Mirror Maze" (Hard, 126 BPM, 6★). Mirror portals flip the screen, dual portals
 * add a twin with opposite gravity (obstacles are mirrored so both need the same input), and
 * the spider teleports between floor and ceiling.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, padTo, flipHazards, beatLights, sky, colors, pulses } from './patterns.js';

const b = new LevelBuilder({
  id: 'mirror-maze', name: 'Mirror Maze', author: 'Neon Dash', difficulty: 'hard', stars: 6,
  bpm: 126, song: 'mirrorMaze', offset: 0, bg: 'grid', ground: 'grid', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#2a0636', ground: '#3a0a4e', line: '#ff8cf0', obj: '#c77dff', deco: '#ff8cf0' },
});
const X = (beat) => b.x(beat);
const CEIL = 10;

/** Spikes for the ground cube and the same spikes mirrored on the ceiling for its twin. */
function dualSpikes(beat, n) {
  b.spikesAt(beat, n);
  b.spikes(b.apex(beat) - n / 2, CEIL - 1, n, { rot: 180 });
}

/** Two mirrored ship bands: the lower one follows `centre`, the upper one mirrors it. */
function mirroredTunnel(x0, x1, centre, gap) {
  for (let cx = Math.floor(x0); cx < x1; cx++) {
    const lo = Math.max(0, Math.round(centre(cx) - gap / 2));
    const hi = lo + gap;
    if (lo > 0) { b.block(cx, 0, 1, lo); b.block(cx, CEIL - lo, 1, lo); }
    if (hi < CEIL - hi) b.block(cx, hi, 1, CEIL - 2 * hi);
  }
}

sky(b, 0, 150, 6, 5, 9);
beatLights(b, 0, 150, 4);
b.text(X(2), 4.4, 'Mirror Maze', { props: { size: 40 } });

// A (8-23): cube, then the first mirror portal.
b.spikesAt(8);
b.spikesAt(10, 2);
b.spikesAt(12);
b.spikesAt(13);
b.portal('mirrorOn', X(15) + 1, 1.5);
b.text(X(14), 4.4, 'Mirror!', { props: { size: 30 } });
b.spikesAt(17, 2);
stepUp(b, 19, 1, 11);
b.spikesAt(21, 1, 1);
b.spikesAt(23);

// B (24-39): dual cube — mirrored spikes, the twin rides the ceiling.
colors(b, 24, { bg: '#1e0430', obj: '#ff8cf0', line: '#c77dff' });
b.portal('mirrorOff', X(24) + 1, 1.5);
b.portal('dualOn', X(25) + 1, 1.5);
b.text(X(24.2), 4.6, 'Dual: one button, two players', { props: { size: 24 } });
for (const [beat, n] of [[27, 1], [29, 2], [31, 1], [32, 1], [34, 2], [36, 1], [37, 1]]) dualSpikes(beat, n);
// Coin 1: only the twin can reach it, with an off-beat jump.
b.coin(X(33) + 2, CEIL - 2.4);
b.portal('dualOff', X(39) + 1, 1.5);
b.portal('dualOff', X(39) + 1, 8.5);

// C (40-55): spider.
colors(b, 40, { bg: '#2a0636', obj: '#c77dff', line: '#ff8cf0' });
b.portal('portalSpider', X(40) + 1, 1.5);
b.text(X(39.6), 5.5, 'Spider: tap to teleport', { props: { size: 24 } });
flipHazards(b, [42, 43, 44, 46, 47, 48, 50, 51, 52], 0, 8, { lead: 1.4, len: 3 });
// Coin 2 sits on the ceiling between two floor runs: an extra double-teleport grabs it.
b.coin(X(54) + 1, 7.4);
b.spikes(X(53) + 1.4, 0, 2);

// D (56-71): dual ship through mirrored bands.
colors(b, 56, { bg: '#16042a', obj: '#ff8cf0', line: '#ffffff' });
b.gate('portalShip', X(55.6) + 1, 1.5, 0, 8);
b.portal('dualOn', X(56) + 1.5, 1.5);
const d0 = X(56) + 4;
const d1 = X(71.6);
const dc = (cx) => 2.2 + 0.9 * Math.sin(((cx - d0) / 26) * Math.PI * 2);
const pocket = Math.floor(d0 + 40);
mirroredTunnel(d0, d1, dc, 3);
b.coin(pocket, Math.max(0, Math.round(dc(pocket) - 1.5)) + 2.5);
b.trigger('trPulse', d0, { channel: 'bg', color: '#ffffff', fadeIn: 0.02, hold: 0.02, fadeOut: 0.4 });
pulses(b, 56, 72, 2, 'obj');

// E (72-87): back to one cube, mirrored, with pads.
colors(b, 72, { bg: '#2a0636', obj: '#c77dff', line: '#ff8cf0' });
b.portal('dualOff', d1 + 1, 2);
b.portal('dualOff', d1 + 1, 8);
b.gate('portalCube', d1 + 3, 2.5, 0, 10);
b.portal('mirrorOn', X(73) + 1, 1.5);
b.spikesAt(75);
padTo(b, 77, 'Yellow', 3, 14);
b.spikesAt(79.5, 1, 3);
b.spikesAt(82, 2);
b.spikesAt(84);
b.spikesAt(85);
b.spikesAt(86, 2);

// F (88-103): mirror flips every four beats over a dual cube run.
colors(b, 88, { bg: '#1e0430', obj: '#ff8cf0', line: '#c77dff' });
b.portal('mirrorOff', X(88) + 1, 1.5);
b.portal('dualOn', X(89) + 1, 1.5);
for (const [beat, n] of [[91, 1], [93, 2], [95, 1], [97, 2], [99, 1], [100, 1]]) dualSpikes(beat, n);
for (let beat = 92; beat < 102; beat += 4) b.portal((beat / 4) % 2 ? 'mirrorOn' : 'mirrorOff', X(beat) + 1, 1.5);
b.portal('mirrorOff', X(102) + 1, 1.5);
b.portal('dualOff', X(102) + 1, 1.5);
b.portal('dualOff', X(102) + 1, 8.5);

// G (104-119): spider at 1.3×.
colors(b, 104, { bg: '#2a0636', obj: '#c77dff', line: '#ffffff' });
b.portal('portalSpider', X(104) + 1, 1.5);
b.speed(104, 2, 0, 8);
pulses(b, 104, 120, 1, 'obj');
flipHazards(b, [106, 107, 108, 109, 110, 112, 113, 114, 115, 116], 0, 8, { lead: 1.6, len: 4 });

// H (120-139): cube outro at 1×.
colors(b, 120, { bg: '#2a0636', obj: '#c77dff', line: '#ff8cf0' });
b.gate('portalCube', X(118) + 1, 1.5, 0, 8);
b.speed(120, 1, 0, 8);
for (let beat = 122; beat < 134; beat += 2) b.spikesAt(beat, beat % 4 === 0 ? 2 : 1);
b.end(X(140));

export default b.build();
