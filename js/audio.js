/**
 * Audio engine: master/music/SFX buses, SFX playback and a look-ahead step sequencer.
 *
 * The sequencer schedules 16th-note steps against AudioContext.currentTime with a 180 ms
 * look-ahead. It is pumped from the requestAnimationFrame loop (update()), not from timers.
 * Each playback is a "session" with its own gain and delay send; stopping or seeking fades the
 * session out and disconnects it when a silent ConstantSource ends (sample-accurate cleanup).
 * Song time is the position in the track in seconds; gameplay passes levelTime + offset.
 */
import { TRACKS, degree, stepSemis } from './tracks.js';
import * as V from './synth.js';

const LOOKAHEAD = 0.18;
const RESYNC = 0.08;

export class AudioEngine {
  constructor() {
    this.ac = null;
    this.ready = false;
    this.vol = { master: 0.8, music: 0.7, sfx: 0.8 };
    this.muted = false;
    this.session = null;
    this.want = null;
    this.lastSfx = new Map();
    this.sections = new Map();
  }

  /** Creates/resumes the AudioContext; call from user-gesture handlers (autoplay policy). */
  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ac.state === 'suspended' && !this.hidden) this.ac.resume();
    if (!this.ready) {
      this.ready = true;
      if (this.want) this.startSession(this.want.id, this.want.songTime + (performance.now() - this.want.at) / 1000, this.want.opts);
    }
  }

  build() {
    const ac = this.ac;
    this.master = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ac.destination);
    this.musicBus = ac.createGain();
    this.sfxBus = ac.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    const len = ac.sampleRate;
    this.noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
    this.sfxCtx = { ac, noise: this.noise, sends: null };
    this.applyVolumes();
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  setMuted(m) { this.muted = m; this.applyVolumes(); }

  applyVolumes() {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const curve = (x) => x * x;
    this.master.gain.setTargetAtTime(this.muted ? 0 : curve(this.vol.master), t, 0.02);
    this.musicBus.gain.setTargetAtTime(curve(this.vol.music), t, 0.02);
    this.sfxBus.gain.setTargetAtTime(curve(this.vol.sfx), t, 0.02);
  }

  /** Tab hidden/visible: suspend the whole context while hidden. */
  setHidden(hidden) {
    this.hidden = hidden;
    if (!this.ac) return;
    if (hidden) this.ac.suspend(); else if (this.ready) this.ac.resume();
  }

  get latency() { return this.ac ? (this.ac.outputLatency || this.ac.baseLatency || 0) : 0; }

  // ---- music ---------------------------------------------------------------------------------
  /** Starts track `id` so that `songTime` seconds are audible right now. */
  playMusic(id, songTime = 0, opts = {}) {
    this.want = { id, songTime, at: performance.now(), opts };
    if (this.ready) this.startSession(id, songTime, opts);
  }

  startSession(id, songTime, opts) {
    this.stopMusic(0.03, true);
    const ac = this.ac;
    const track = TRACKS[id] || TRACKS.firstSteps;
    const gain = ac.createGain();
    gain.gain.value = opts.practice ? 0.5 : 1;
    gain.connect(this.musicBus);
    // Per-session echo: delay with filtered feedback.
    const delay = ac.createDelay(2);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(gain);
    const stepDur = 60 / track.bpm / 4;
    const start = ac.currentTime - this.latency - songTime;
    const first = Math.max(0, Math.ceil((ac.currentTime + 0.01 - start) / stepDur));
    this.session = {
      id, track, gain, nodes: [gain, delay, fb, lp], start, stepDur, step: first, opts,
      S: { ac, noise: this.noise, sends: { delay } }, practice: !!opts.practice,
    };
    this.pump();
  }

  /** Fades out and releases the current session. `keepWant` keeps the request for resync. */
  stopMusic(fade = 0.05, keepWant = false) {
    if (!keepWant) this.want = null;
    const s = this.session;
    if (!s || !this.ac) { this.session = null; return; }
    this.session = null;
    const t = this.ac.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setValueAtTime(s.gain.gain.value, t);
    s.gain.gain.linearRampToValueAtTime(0, t + fade);
    const timer = this.ac.createConstantSource();
    timer.offset.value = 0;
    timer.connect(s.gain);
    timer.onended = () => { timer.disconnect(); for (const n of s.nodes) n.disconnect(); };
    timer.start(t);
    timer.stop(t + fade + 0.3);
  }

  /** Pausing stops the session at its exact position; resume re-seeks via playMusic(). */
  pauseMusic() { this.stopMusic(0.03); }

  musicPlaying() { return !!this.session; }

  /** Song time currently audible (seconds), or null. */
  musicTime() {
    if (!this.session) return null;
    return this.ac.currentTime - this.latency - this.session.start;
  }

  /** 0..1 pulse that peaks on every beat of the playing track. */
  beatPulse() {
    const t = this.musicTime();
    if (t === null || t < 0) return 0;
    const beat = (t * this.session.track.bpm) / 60;
    return Math.exp(-(beat - Math.floor(beat)) * 5.5);
  }

  /**
   * Keeps music aligned with the game's song time; re-seeks after hitches or if music was
   * requested before audio was unlocked.
   */
  syncMusic(songTime, force = false) {
    if (this.want) { this.want.songTime = songTime; this.want.at = performance.now(); }
    if (!this.ready || !this.want) return;
    if (!this.session) { this.startSession(this.want.id, songTime, this.want.opts); return; }
    const drift = this.musicTime() - songTime;
    if (force || Math.abs(drift) > RESYNC) this.startSession(this.session.id, songTime, this.session.opts);
  }

  /** Called every frame: schedules upcoming steps. */
  update() {
    if (this.session && this.ac.state === 'running') this.pump();
  }

  pump() {
    const s = this.session;
    const horizon = this.ac.currentTime + LOOKAHEAD;
    let guard = 0;
    while (s.start + s.step * s.stepDur < horizon && guard++ < 64) {
      const t = s.start + s.step * s.stepDur;
      if (t >= this.ac.currentTime) this.scheduleStep(s, s.step, t);
      s.step++;
    }
  }

  layout(track) {
    let L = this.sections.get(track);
    if (L) return L;
    L = [];
    let bar = 0;
    for (const sec of track.song) { L.push({ start: bar, sec }); bar += sec[0]; }
    L.total = bar;
    L.loopStart = track.loop >= 0 ? L[track.loop].start : -1;
    this.sections.set(track, L);
    return L;
  }

  /** Maps an absolute bar to { sec, barIn, songBar } honouring the loop point. */
  sectionAt(track, bar) {
    const L = this.layout(track);
    let b = bar;
    if (b >= L.total) {
      if (L.loopStart < 0) return null;
      b = L.loopStart + ((b - L.total) % (L.total - L.loopStart));
    }
    for (let i = L.length - 1; i >= 0; i--) if (L[i].start <= b) return { sec: L[i].sec, barIn: b - L[i].start, songBar: b };
    return null;
  }

  scheduleStep(s, step, t) {
    const tr = s.track;
    const bar = Math.floor(step / 16);
    const sib = step % 16;
    const at = this.sectionAt(tr, bar);
    if (!at) return;
    const [bars, dName, bName, lName, aName, padOn, fx] = at.sec;
    const pos = at.barIn * 16 + sib;
    const S = s.S;
    const out = s.gain;
    const inst = tr.inst;
    const chord = tr.prog[at.songBar % tr.prog.length];
    const note = (deg, octave) => V.midiHz(tr.root + 12 * octave + stepSemis(tr.scale, deg));
    const dur = (str, i) => {
      let n = 1;
      while (str[(i + n) % str.length] === '-' && n < 64) n++;
      return n * s.stepDur;
    };
    const drums = tr.drums[dName] || {};
    const hit = (str) => (str ? str[pos % str.length] : '.');
    if (!s.practice) {
      const k = hit(drums.k);
      if (k === 'x' || k === 'X') V.kick(S, out, t, k === 'X' ? 1 : 0.85, inst.kickTone || 1);
      const sn = hit(drums.s);
      if (sn === 'x' || sn === 'X') V.snare(S, out, t, sn === 'X' ? 1 : 0.7);
      const c = hit(drums.c);
      if (c === 'x' || c === 'X') V.clap(S, out, t, 0.8);
    }
    const h = hit(drums.h);
    if (h === 'x' || h === 'o' || h === 'X') V.hat(S, out, t, s.practice ? 0.5 : h === 'X' ? 1 : 0.7, h === 'o');
    else if (s.practice && sib % 4 === 2) V.hat(S, out, t, 0.4, false);
    if (!s.practice && bName) {
      const str = tr.bass[bName];
      const ch = str[pos % str.length];
      const d = degree(ch);
      if (typeof d === 'number') V.bass(S, out, t, note(chord + d, -2), dur(str, pos % str.length) * 0.95, 1, inst.bass);
    }
    if (!s.practice && lName && tr.lead[lName]) {
      const str = tr.lead[lName];
      const i = pos % str.length;
      const d = degree(str[i]);
      if (typeof d === 'number') V.lead(S, out, t, note(d, 1), dur(str, i) * 0.92, 1, inst.lead);
    }
    if (aName && tr.arp[aName]) {
      const str = tr.arp[aName];
      const d = degree(str[pos % str.length]);
      if (typeof d === 'number') {
        const deg = chord + [0, 2, 4, 7, 9, 11, 14][d % 7];
        V.pluck(S, out, t, note(deg, 1), s.practice ? 0.7 : 0.9, inst.arp);
      }
    }
    if (padOn && sib === 0) {
      const freqs = [0, 2, 4].map((o) => note(chord + o, 0));
      V.pad(S, out, t, freqs, s.stepDur * 16 * 0.98, s.practice ? 1.2 : 1, inst.pad);
    }
    if (!s.practice && fx === 'crash' && pos === 0) V.crash(S, out, t, 1);
    if (!s.practice && fx === 'riser' && at.barIn === bars - 1 && sib === 0) V.sweep(S, out, t, s.stepDur * 16, 300, 7000, 0.5, 1.5);
  }

  /**
   * Renders `seconds` of a track offline (tests: proves the synth makes sound without
   * clipping). Returns an AudioBuffer.
   */
  static async renderOffline(id, seconds, opts = {}) {
    const off = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100);
    const eng = new AudioEngine();
    eng.ac = off;
    eng.build();
    eng.ready = true;
    eng.startSession(id, 0, opts);
    const s = eng.session;
    while (s.start + s.step * s.stepDur < seconds) {
      eng.scheduleStep(s, s.step, Math.max(0, s.start + s.step * s.stepDur));
      s.step++;
    }
    return off.startRendering();
  }

  // ---- SFX -------------------------------------------------------------------------------------
  sfx(name) {
    if (!this.ready || !this.ac || this.ac.state !== 'running') return;
    const fn = V.SFX[name];
    if (!fn) return;
    const now = this.ac.currentTime;
    const last = this.lastSfx.get(name) || 0;
    if (now - last < 0.03) return;
    this.lastSfx.set(name, now);
    fn(this.sfxCtx, this.sfxBus, now + 0.002);
  }
}
