/**
 * Level 9 — "Prism Core" (Demon, 145 BPM, 10★). Hidden bonus level unlocked by saving every
 * secret coin of levels 1–8. Short, relentless and tight: three-block wave and ship gaps,
 * half-beat orb chains, dash orbs and a 2× finale.
 */
import { LevelBuilder } from './builder.js';
import {
  stepUp, pit, padTo, orbAt, airOrb, tunnel, tunnelLow, flipHazards, beatLights, sky, colors, pulses,
  waveRun, dualSpikes, movingSaw, portalColumn,
} from './patterns.js';

const b = new LevelBuilder({
  id: 'prism-core', name: 'Prism Core', author: 'Neon Dash', difficulty: 'demon', stars: 10,
  bpm: 145, song: 'prismCore', offset: 0, bg: 'circuit', ground: 'hex', startMode: 'cube', startSpeed: 2,
  palette: { bg: '#001a10', ground: '#00291a', line: '#00ffa3', obj: '#a6ff00', deco: '#00ffa3' },
});
const X = (beat) => b.x(beat);

sky(b, 0, 140, 9, 5, 9);
b.text(X(2), 4.4, 'Prism Core', { props: { size: 44 } });

// 1 (8-23): cube at 1.3× — triples and half-beat orb chains.
beatLights(b, 8, 24, 1);
pulses(b, 8, 24, 1, 'obj');
b.spikesAt(8, 2);
b.spikesAt(9.5, 3);
airOrb(b, 11, 11.5, 'Yellow');
b.gap(X(11) + 1.5, 7);
airOrb(b, 13, 13.5, 'Pink');
b.gap(X(13) + 1.5, 4);
b.spikesAt(15, 3);
stepUp(b, 16, 1, 3);
stepUp(b, 17, 1, 3, 1);
b.block(X(17) + 3, 0, 3, 1);
stepUp(b, 18, 1, 12, 2);
b.block(X(18) + 3, 0, 12, 2);
b.spikesAt(20, 2, 3);
b.coin(b.apex(20), 6.6);
b.spikesAt(22, 3);

// 2 (24-39): wave at 1.3×, three-block zig-zag turning every three columns.
colors(b, 24, { bg: '#00120c', obj: '#00ffa3', line: '#a6ff00' });
const w = waveRun(b, 24, 39.5, 3, 3, 0, 'portalShip');
b.coin(w.x0 + 40, w.prof(40) + 0.8);

// 3 (40-55): ship at 1.3× through a three-block tunnel between saws.
colors(b, 40, { bg: '#001a10', obj: '#a6ff00', line: '#ffffff' });
const s0 = w.end + 3, s1 = X(55.6);
const sc = (cx) => 5 + 2 * Math.sin(((cx - s0) / 28) * Math.PI * 2);
tunnel(b, s0, s1, sc, 3);
pulses(b, 40, 56, 1, 'line', '#ffffff');

// 4 (56-71): ball at 1×, flips on beats and half beats.
colors(b, 56, { bg: '#002014', obj: '#00ffa3', line: '#a6ff00' });
b.gate('portalBall', s1 + 0.5, 4.5);
b.speed(56, 1, 0, 10);
flipHazards(b, [58, 58.5, 59.5, 60, 61, 61.5, 62.5, 63, 64, 65, 65.5, 66.5, 67, 68], 1, 9, { lead: 1.2, len: 2 });
b.block(X(56.5), 0, Math.ceil(X(70) - X(56.5)), 1);
b.block(X(56.5), 9, Math.ceil(X(70) - X(56.5)), 1);

// 5 (72-87): dual cube at 1.3× with mirrored spikes, then dash orbs.
colors(b, 72, { bg: '#001a10', obj: '#a6ff00', line: '#00ffa3' });
b.gate('portalCube', X(70.5) + 1, 1.5, 0, 9);
b.speed(72, 2, 0, 10);
b.portal('dualOn', X(72) + 1, 1.5);
for (const [beat, n] of [[74, 2], [75, 1], [76, 3], [78, 2], [79, 1], [80, 2]]) dualSpikes(b, beat, n);
b.portal('dualOff', X(82) + 1, 1.5);
b.portal('dualOff', X(82) + 1, 8.5);
b.orb(X(84), 1.5, 'Dash', { rot: -30 });
b.spikes(X(84) + 1, 0, 8);
b.coin(X(84) + 7, 4.5);

// 6 (88-103): spider at 1.3×.
colors(b, 88, { bg: '#00120c', obj: '#00ffa3', line: '#ffffff' });
b.gate('portalSpider', X(88) + 1, 1.5, 0, 10);
b.speed(88, 2, 0, 8);
flipHazards(b, [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100], 0, 8, { lead: 1.4, len: 3 });

// 7 (104-119): swing at 1.3× with oscillating saws.
colors(b, 104, { bg: '#001a10', obj: '#a6ff00', line: '#00ffa3' });
b.gate('portalSwing', X(103) + 1, 1.5, 0, 8);
b.speed(104, 2, 0, 10);
const q0 = X(105) + 2, q1 = X(119.6);
tunnel(b, q0, q1, (cx) => 5 + 1.2 * Math.sin(((cx - q0) / 30) * Math.PI * 2), 6);
for (let k = 0; k < 4; k++) movingSaw(b, X(107 + k * 3), 5, 'S', 0, k % 2 ? 1.2 : -1.2, 2, 107 + k * 3, 0);

// 8 (120-135): cube at 2×.
colors(b, 120, { bg: '#003020', obj: '#ffffff', line: '#00ffa3' });
b.gate('portalCube', q1 + 0.5, 5);
b.speed(120, 4, 0, 10);
b.trigger('trZoom', X(120), { zoom: 0.85, duration: 0.5 });
b.trigger('trShake', X(120), { strength: 9, duration: 0.4 });
pulses(b, 120, 134, 1, 'obj', '#00ffa3');
for (let beat = 122; beat < 133; beat++) b.spikesAt(beat, beat % 2 ? 3 : 2);
b.end(X(136));

export default b.build();
