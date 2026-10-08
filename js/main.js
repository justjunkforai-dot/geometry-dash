/**
 * Bootstrap, main loop and state machine.
 *
 * States: boot → menu → levelSelect → play (⇄ pause) → complete / death auto-restart, plus
 * editor, settings, customize, achievements, credits. Each state is an object with
 * enter/exit/update/render; menus are DOM screens drawn over an animated canvas backdrop.
 */
import { VIEW_W, VIEW_H, MAX_DPR } from './config.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { Game } from './game.js';
import { LEVELS } from './levels/index.js';
import { RecordingInput } from '../tests/bot.js';
import { AudioEngine } from './audio.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');

const renderer = new Renderer(canvas);
const input = new Input(stage);
const particles = new Particles();
const audio = new AudioEngine();

const app = {
  renderer, input, particles, audio,
  settings: {
    restartDelay: 0.4, particles: 1, shake: 1, reduceFlash: false, reduceMotion: false,
    autoCheckpoint: 0, hud: true, fpsCap: 0, showFps: false,
  },
  profile: { colors: { p1: '#7dff4f', p2: '#3dd6ff', g: '#7df9ff' }, trail: 'none' },
  iconStyle: null,
  hooks: {},
  state: null,
  fps: 0,
};
app.iconStyle = {
  colors: app.profile.colors,
  twinColors: { p1: app.profile.colors.p2, p2: app.profile.colors.p1, g: app.profile.colors.g },
  variants: { cube: 0, ship: 0, ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, swing: 0 },
  glow: true,
};

function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / VIEW_W, vh / VIEW_H);
  const w = Math.floor(VIEW_W * scale);
  const h = Math.floor(VIEW_H * scale);
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  stage.style.left = `${Math.floor((vw - w) / 2)}px`;
  stage.style.top = `${Math.floor((vh - h) / 2)}px`;
  uiRoot.style.transform = `scale(${w / VIEW_W})`;
  renderer.resize(w, h, Math.min(MAX_DPR, window.devicePixelRatio || 1));
}
window.addEventListener('resize', layout);
layout();

const params = new URLSearchParams(location.search);

/** Minimal play state used until the menus exist. */
function playState(data, bot) {
  let game = null;
  return {
    enter() {
      game = new Game(app, data, { levelId: data.meta.id, bot });
      game.start();
      app.game = game;
      if (params.has('t')) game.skipTo(Number(params.get('t')));
    },
    exit() { game.destroy(); app.game = null; },
    update(now, dt) {
      game.update(now, dt);
      if (game.state === 'complete' && game.completeT > 2.5) game.restart();
    },
    render(now) { game.render(now); },
  };
}

function setState(s) {
  if (app.state && app.state.exit) app.state.exit();
  app.state = s;
  if (s.enter) s.enter();
}
app.setState = setState;

// Autoplay policy: the AudioContext is created/resumed on the first user gesture.
const unlock = () => audio.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true });
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (document.hidden && app.game) app.game.pause();
});

input.on('hitboxes', () => { renderer.opt.hitboxes = !renderer.opt.hitboxes; });
input.on('mute', () => audio.setMuted(!audio.muted));
input.on('restart', () => { if (app.game) app.game.restart(); });

let last = performance.now();
let lastRender = 0;
let fpsAcc = 0;
let fpsFrames = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const cap = app.settings.fpsCap;
  if (cap && now - lastRender < 1000 / cap - 1) return;
  lastRender = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) { app.fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
  input.pollGamepads(now);
  audio.update();
  if (app.state) {
    app.state.update(now, dt);
    app.state.render(now);
  }
}

/** In-page test runner (?test=1): runs the shared suite and shows the results. */
async function runTests() {
  const { runSuite } = await import('../tests/suite.js');
  const panel = document.createElement('pre');
  panel.className = 'test-panel';
  panel.setAttribute('role', 'log');
  uiRoot.appendChild(panel);
  const results = await runSuite({
    loadRecording: async (id) => {
      const r = await fetch(`tests/recordings/${id}.json`);
      return r.ok ? r.json() : null;
    },
    log: (m) => { panel.textContent += `${m}\n`; },
  });
  const failed = results.filter((r) => !r.pass).length;
  panel.textContent += `\n${results.length - failed}/${results.length} passed`;
  window.__testResults = results;
}

async function boot() {
  if (params.has('test')) { await runTests(); return; }
  const idx = Number(params.get('level') || 1) - 1;
  const data = params.has('showcase') ? (await import('../tests/levels/showcase.js')).default : LEVELS[idx].data;
  let bot = null;
  if (params.has('bot')) {
    const res = await fetch(`tests/recordings/${data.meta.id}.json`);
    bot = new RecordingInput(await res.json());
  }
  setState(playState(data, bot));
  requestAnimationFrame(frame);
}
boot();
window.neonDash = app;
