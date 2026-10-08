/**
 * Level 5 — "Wave Runner" (Hard, 156 BPM, 5★). Wave corridors built from 45° slopes, a
 * slope-walled ship tunnel, a mini-wave spike run and a 2× wave climax. At 156 BPM one beat
 * is exactly 4 blocks at 1× (8 at 2×), so zig-zag turns land on beats / half beats.
 */
import { LevelBuilder } from './builder.js';
import { stepUp, pit, padTo, orbAt, tunnel, tunnelLow, waveCorridor, zigzag, beatLights, sky, colors, pulses } from './patterns.js';

const b = new LevelBuilder({
  id: 'wave-runner', name: 'Wave Runner', author: 'Neon Dash', difficulty: 'hard', stars: 5,
  bpm: 156, song: 'waveRunner', offset: 0, bg: 'waves', ground: 'stripes', startMode: 'cube', startSpeed: 1,
  palette: { bg: '#001a40', ground: '#002a66', line: '#00f0ff', obj: '#38b6ff', deco: '#7df9ff' },
});
const X = (beat) => b.x(beat);

/**
 * Wave zig-zag between beats: gate in, slope corridor, gate out. The corridor starts on a
 * whole column so its peaks fall every `amp` columns.
 */
function waveRun(beat0, beat1, gap, amp, base, exitKey = 'portalCube') {
  const gx = Math.round(X(beat0)) + 1;
  b.gate('portalWave', gx, base + 1.5);
  const x0 = gx + 2;
  const cols = Math.round(X(beat1)) - x0;
  const prof = zigzag(base, amp);
  b.block(gx + 0.5, 0, 1, base);
  b.block(gx + 0.5, base + gap, 1, 10 - base - gap);
  waveCorridor(b, x0, cols, prof, gap);
  const end = x0 + cols;
  const f = prof(cols);
  b.gate(exitKey, end + 0.5, f + gap / 2);
  return { x0, end, prof };
}

sky(b, 0, 160, 5, 5, 9);
beatLights(b, 0, 24, 2);
b.text(X(2), 4.4, 'Wave Runner', { props: { size: 40 } });

// A (8-23): cube on slopes — rising slopes launch you a little.
b.spikesAt(8);
b.spikesAt(10, 2);
let sx = Math.round(X(12));
b.slope(sx, 0); b.block(sx + 1, 0, 10, 1); b.slope(sx + 11, 0, { fx: true });
b.spikesAt(14, 1, 1);
b.spikesAt(16, 2);
sx = Math.round(X(17.5));
b.slope(sx, 0, { wide: true }); b.block(sx + 2, 0, 7, 1);
b.slope(sx + 7, 1, { wide: true }); b.block(sx + 9, 0, 6, 2);
b.slope(sx + 15, 1, { fx: true, wide: true }); b.block(sx + 15, 0, 2, 1);
b.slope(sx + 17, 0, { fx: true, wide: true });
b.spikesAt(22, 1, 0);

// B (24-39): wave 1 — wide zig-zag, turns on every beat.
colors(b, 24, { bg: '#001233', obj: '#00f0ff', line: '#38b6ff' });
b.text(X(22.5), 4.6, 'Wave: hold to rise, release to dive', { props: { size: 24 } });
const w1 = waveRun(24, 40, 4, 4, 2, 'portalShip');
pulses(b, 24, 40, 1, 'line', '#ffffff');
// Coin 1: tucked into the valley wall halfway along — dive late to graze it.
b.coin(w1.x0 + 24, w1.prof(24) + 0.9);

// C (40-55): ship through a slope-walled zig-zag (sliding on slopes is safe for the ship).
colors(b, 40, { bg: '#00102a', obj: '#7df9ff', line: '#00f0ff' });
const s0 = Math.round(X(41));
const sCols = Math.round(X(55)) - s0;
waveCorridor(b, s0, sCols, zigzag(1, 3), 5);
b.gate('portalCube', s0 + sCols + 0.5, zigzag(1, 3)(sCols) + 2.5);

// D (56-71): cube with pads and orbs.
colors(b, 56, { bg: '#001a40', obj: '#38b6ff', line: '#00f0ff' });
beatLights(b, 56, 72, 2);
b.spikesAt(58);
padTo(b, 60, 'Yellow', 3, 7);
b.spikesAt(62, 1, 3);
orbAt(b, 64, 'Yellow', 1.5);
b.gap(X(64) + 1.2, 3);
b.spikesAt(66, 2);
b.spikesAt(68);
b.spikesAt(69);
b.spikesAt(70, 2);

// E (72-87): mini wave through a curving tunnel with spikes on its walls.
colors(b, 72, { bg: '#0a0a3a', obj: '#ff4fd8', line: '#7df9ff' });
const mg = Math.round(X(72)) + 1;
b.gate('portalWave', mg, 1.5);
b.portal('sizeMini', mg + 2, 1.5);
const m0 = mg + 4;
const m1 = Math.round(X(87.5));
const mc = (cx) => 4.5 + 2.2 * Math.sin(((cx - m0) / 16) * Math.PI * 2);
tunnel(b, m0, m1, mc, 4);
for (let cx = m0 + 6; cx < m1 - 4; cx += 8) {
  const lo = tunnelLow(mc, 4, cx);
  if ((cx - m0) % 16 < 8) b.spikes(cx, lo, 1, { small: true });
  else b.spikes(cx, lo + 3, 1, { small: true, rot: 180 });
}
b.gate('portalCube', m1 + 0.5, mc(m1));
b.portal('sizeNormal', m1 + 2.5, 1.5);

// F (88-103): cube, then 2× from beat 96.
colors(b, 88, { bg: '#001a40', obj: '#38b6ff', line: '#00f0ff' });
b.spikesAt(90);
b.spikesAt(92, 2);
b.spikesAt(94);
b.speed(96, 4);
for (let beat = 97; beat < 103; beat++) b.spikesAt(beat, beat % 2 ? 1 : 2);

// G (104-119): wave at 2× — turns every half beat. Coin 3 rides the last valley.
colors(b, 104, { bg: '#1a0033', obj: '#ff4fd8', line: '#ffffff' });
pulses(b, 104, 120, 0.5, 'obj');
const w3 = waveRun(104, 120, 4, 4, 2, 'portalShip');
b.coin(w3.x0 + 104, w3.prof(104) + 0.9);
b.trigger('trZoom', X(104), { zoom: 0.9, duration: 0.6 });
b.trigger('trShake', X(104), { strength: 6, duration: 0.3 });

// H (120-135): ship at 2× through a gentle tunnel.
colors(b, 120, { bg: '#001233', obj: '#00f0ff', line: '#38b6ff' });
b.trigger('trZoom', X(120), { zoom: 1, duration: 0.8 });
const t0 = w3.end + 3;
const t1 = Math.round(X(135.5));
const tc = (cx) => 5 + 1.6 * Math.sin(((cx - t0) / 44) * Math.PI * 2);
const pk = t0 + 64;
tunnel(b, t0, t1, tc, 5, 0, 10, 'block', [[pk, pk + 14, 0, 2]]);
b.coin(pk + 7, tunnelLow(tc, 5, pk + 7) + 6.2);

// I (136-151): back to 1× and the ground.
b.gate('portalCube', t1 + 0.5, tc(t1));
b.speed(136, 1, 0, 10);
colors(b, 136, { bg: '#001a40', obj: '#38b6ff', line: '#00f0ff' });
beatLights(b, 136, 152, 1);
b.spikesAt(139);
b.spikesAt(141, 2);
stepUp(b, 143, 1, 9);
b.spikesAt(145, 1, 1);
pit(b, 147, 2);
b.end(X(152));

export default b.build();
