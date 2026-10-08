/**
 * Synth voices. Every voice is a small, self-cleaning node graph scheduled at an exact
 * AudioContext time: sources stop themselves and disconnect on 'ended', so nothing leaks.
 * `S` is the synth context: { ac, noise (AudioBuffer), sends: { delay } }.
 */

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function cleanup(src, nodes) {
  src.onended = () => { for (const n of nodes) n.disconnect(); };
}

function env(g, t, a, peak, d, sustain, rel, end) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(Math.max(0.0001, sustain), t + a, d / 3 + 0.0001);
  p.setValueAtTime(Math.max(0.0001, sustain), Math.max(t + a, end - 0.0001));
  p.exponentialRampToValueAtTime(0.0001, end + rel);
}

function noiseSrc(S, t, dur) {
  const n = S.ac.createBufferSource();
  n.buffer = S.noise;
  n.loop = true;
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur + 0.05);
  return n;
}

export function kick(S, out, t, vel = 1, tone = 1) {
  const ac = S.ac;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160 * tone, t);
  o.frequency.exponentialRampToValueAtTime(42 * tone, t + 0.11);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
  cleanup(o, [o, g]);
}

export function snare(S, out, t, vel = 1) {
  const ac = S.ac;
  const n = noiseSrc(S, t, 0.22);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(f).connect(g).connect(out);
  const o = ac.createOscillator();
  const og = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  og.gain.setValueAtTime(0.35 * vel, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(og).connect(out);
  o.start(t); o.stop(t + 0.12);
  cleanup(n, [n, f, g]);
  cleanup(o, [o, og]);
}

export function clap(S, out, t, vel = 1) {
  const ac = S.ac;
  const n = noiseSrc(S, t, 0.25);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 3; i++) {
    g.gain.linearRampToValueAtTime(0.5 * vel, t + i * 0.012 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.012 + 0.01);
  }
  g.gain.linearRampToValueAtTime(0.4 * vel, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(f).connect(g).connect(out);
  cleanup(n, [n, f, g]);
}

export function hat(S, out, t, vel = 1, open = false) {
  const ac = S.ac;
  const dur = open ? 0.28 : 0.05;
  const n = noiseSrc(S, t, dur);
  const f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 7200;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(out);
  cleanup(n, [n, f, g]);
}

/** Long noise cymbal for section starts. */
export function crash(S, out, t, vel = 1) {
  const ac = S.ac;
  const n = noiseSrc(S, t, 1.4);
  const f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 4500;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
  n.connect(f).connect(g).connect(out);
  cleanup(n, [n, f, g]);
}

/** Bass: oscillator through a resonant low-pass with a pluck envelope. */
export function bass(S, out, t, freq, dur, vel = 1, o = {}) {
  const ac = S.ac;
  const osc = ac.createOscillator();
  osc.type = o.type || 'sawtooth';
  osc.frequency.setValueAtTime(freq, t);
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq / 2, t);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = o.q || 4;
  const cut = o.cutoff || 900;
  f.frequency.setValueAtTime(cut * 2.5, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, cut * 0.35), t + Math.min(dur, 0.25));
  const g = ac.createGain();
  env(g, t, 0.004, 0.42 * vel, 0.1, 0.3 * vel, 0.05, t + dur);
  const sg = ac.createGain();
  sg.gain.value = (o.sub === undefined ? 0.5 : o.sub);
  osc.connect(f).connect(g);
  sub.connect(sg).connect(g);
  g.connect(out);
  osc.start(t); sub.start(t);
  osc.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
  cleanup(osc, [osc, f, g]);
  cleanup(sub, [sub, sg]);
}

/** Lead: detuned oscillator pair, low-pass, ADSR, optional delay send. */
export function lead(S, out, t, freq, dur, vel = 1, o = {}) {
  const ac = S.ac;
  const g = ac.createGain();
  env(g, t, o.attack || 0.01, 0.2 * vel, 0.15, 0.13 * vel, o.release || 0.12, t + dur);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(o.cutoff || 3200, t);
  f.Q.value = 1;
  const oscs = [];
  const det = o.detune === undefined ? 9 : o.detune;
  for (const d of [-det, det]) {
    const osc = ac.createOscillator();
    osc.type = o.type || 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = d;
    if (o.vibrato) {
      const lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = freq * 0.006;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t + 0.15); lfo.stop(t + dur + 0.3);
      cleanup(lfo, [lfo, lg]);
    }
    osc.connect(f);
    osc.start(t);
    osc.stop(t + dur + (o.release || 0.12) + 0.05);
    oscs.push(osc);
  }
  f.connect(g).connect(out);
  const nodes = [oscs[0], f, g];
  if (S.sends && S.sends.delay && o.delay !== 0) {
    const sg = ac.createGain();
    sg.gain.value = o.delay || 0.25;
    g.connect(sg).connect(S.sends.delay);
    nodes.push(sg);
  }
  cleanup(oscs[0], nodes);
  cleanup(oscs[1], [oscs[1]]);
}

/** Short plucked note for arpeggios. */
export function pluck(S, out, t, freq, vel = 1, o = {}) {
  const ac = S.ac;
  const osc = ac.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(freq, t);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(o.cutoff || 4000, t);
  f.frequency.exponentialRampToValueAtTime(400, t + 0.18);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.11 * vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (o.decay || 0.22));
  osc.connect(f).connect(g).connect(out);
  if (S.sends && S.sends.delay && o.delay) {
    const sg = ac.createGain();
    sg.gain.value = o.delay;
    g.connect(sg).connect(S.sends.delay);
    cleanup(osc, [osc, f, g, sg]);
  } else cleanup(osc, [osc, f, g]);
  osc.start(t);
  osc.stop(t + (o.decay || 0.22) + 0.05);
}

/** FM bell (menus, chimes). */
export function bell(S, out, t, freq, vel = 1, dur = 1.2) {
  const ac = S.ac;
  const car = ac.createOscillator();
  const mod = ac.createOscillator();
  const mg = ac.createGain();
  const g = ac.createGain();
  car.frequency.setValueAtTime(freq, t);
  mod.frequency.setValueAtTime(freq * 3.5, t);
  mg.gain.setValueAtTime(freq * 2.2, t);
  mg.gain.exponentialRampToValueAtTime(freq * 0.1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  mod.connect(mg).connect(car.frequency);
  car.connect(g).connect(out);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  cleanup(car, [car, g]);
  cleanup(mod, [mod, mg]);
}

/** Sustained pad chord: several detuned saws through a soft low-pass. */
export function pad(S, out, t, freqs, dur, vel = 1, o = {}) {
  const ac = S.ac;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(o.cutoff || 1400, t);
  f.Q.value = 0.5;
  const g = ac.createGain();
  const att = o.attack || 0.25;
  env(g, t, att, 0.07 * vel, 0.3, 0.06 * vel, o.release || 0.4, t + dur);
  f.connect(g).connect(out);
  let last = null;
  for (const fr of freqs) {
    for (const d of [-7, 7]) {
      const osc = ac.createOscillator();
      osc.type = o.type || 'sawtooth';
      osc.frequency.setValueAtTime(fr, t);
      osc.detune.value = d;
      osc.connect(f);
      osc.start(t);
      osc.stop(t + dur + (o.release || 0.4) + 0.05);
      cleanup(osc, [osc]);
      last = osc;
    }
  }
  if (last) {
    const prev = last.onended;
    last.onended = () => { prev(); f.disconnect(); g.disconnect(); };
  }
}

/** Filtered noise sweep (risers, whooshes). */
export function sweep(S, out, t, dur, from, to, vel = 1, q = 2) {
  const ac = S.ac;
  const n = noiseSrc(S, t, dur);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5 * vel, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(out);
  cleanup(n, [n, f, g]);
}

/** Simple pitched blip with a frequency glide. */
export function blip(S, out, t, f0, f1, dur, vel = 1, type = 'square') {
  const ac = S.ac;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  cleanup(o, [o, g]);
}

/** Low noise thump + sub drop (impacts, death). */
export function impact(S, out, t, vel = 1) {
  const ac = S.ac;
  const n = noiseSrc(S, t, 0.5);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3000, t);
  f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.7 * vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  n.connect(f).connect(g).connect(out);
  cleanup(n, [n, f, g]);
  kick(S, out, t, vel * 0.9, 0.7);
}

const SCALE_C = [0, 4, 7, 12, 16, 19, 24];

/** Sound-effect recipes. */
export const SFX = {
  jump: (S, o, t) => blip(S, o, t, 330, 620, 0.07, 0.35, 'triangle'),
  flip: (S, o, t) => blip(S, o, t, 520, 260, 0.08, 0.35, 'triangle'),
  land: (S, o, t) => blip(S, o, t, 140, 60, 0.06, 0.4, 'sine'),
  orb: (S, o, t) => { blip(S, o, t, 880, 1760, 0.09, 0.4, 'triangle'); hat(S, o, t, 0.6); },
  pad: (S, o, t) => blip(S, o, t, 260, 1040, 0.14, 0.45, 'sine'),
  portal: (S, o, t) => { sweep(S, o, t, 0.35, 500, 4000, 0.5); bell(S, o, t + 0.02, 1046, 0.5, 0.5); },
  whoosh: (S, o, t) => sweep(S, o, t, 0.45, 300, 6000, 0.8, 1.2),
  teleport: (S, o, t) => blip(S, o, t, 1600, 200, 0.1, 0.4, 'sawtooth'),
  coin: (S, o, t) => { bell(S, o, t, 1976, 0.8, 0.5); bell(S, o, t + 0.08, 2637, 0.8, 0.7); },
  death: (S, o, t) => { impact(S, o, t, 1); blip(S, o, t, 420, 50, 0.45, 0.6, 'sawtooth'); },
  complete: (S, o, t) => {
    SCALE_C.forEach((s, i) => lead(S, o, t + i * 0.07, midiHz(72 + s), 0.25, 0.9, { detune: 6, delay: 0.3 }));
    sweep(S, o, t, 1.2, 2000, 9000, 0.4);
  },
  checkpoint: (S, o, t) => { bell(S, o, t, 1318, 0.6, 0.4); bell(S, o, t + 0.06, 1760, 0.6, 0.5); },
  achievement: (S, o, t) => [0, 4, 7].forEach((s, i) => bell(S, o, t + i * 0.09, midiHz(84 + s), 0.8, 0.8)),
  tick: (S, o, t) => blip(S, o, t, 900, 880, 0.05, 0.5, 'sine'),
  go: (S, o, t) => blip(S, o, t, 1320, 1300, 0.12, 0.5, 'sine'),
  hover: (S, o, t) => blip(S, o, t, 1500, 1400, 0.03, 0.18, 'sine'),
  click: (S, o, t) => { blip(S, o, t, 700, 1100, 0.05, 0.4, 'triangle'); },
  back: (S, o, t) => blip(S, o, t, 700, 380, 0.07, 0.35, 'triangle'),
  firework: (S, o, t) => { sweep(S, o, t, 0.08, 3000, 6000, 0.3, 0.8); hat(S, o, t + 0.1, 0.8, true); },
};
