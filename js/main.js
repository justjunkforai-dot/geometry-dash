/**
 * Bootstrap, main loop and state machine.
 *
 * States: menu → levels → play (⇄ paused, complete, death auto-restart) and editor, settings,
 * customize, achievements, credits. Each state has enter/exit/update/render; menu-like states
 * render the animated MenuScene behind a DOM screen. Iris transitions run between states.
 */
import { VIEW_W, VIEW_H, MAX_DPR } from './config.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { Storage } from './storage.js';
import { Progress } from './progress.js';
import { UI } from './ui.js';
import { MenuScene } from './menuscene.js';
import { Game } from './game.js';
import { LEVELS } from './levels/index.js';
import { RecordingInput } from '../tests/bot.js';
import { PLAYER_COLORS } from './cosmetics.js';
import { mainMenu, credits } from './screens/menu.js';
import { levelSelect } from './screens/levels.js';
import { playHud, pauseMenu, completeScreen } from './screens/play.js';
import { settingsScreen } from './screens/settings.js';
import { customizeScreen } from './screens/customize.js';
import { achievementsScreen } from './screens/achievements.js';
import { Achievements } from './achievements.js';
import { Editor } from './editor.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');
const params = new URLSearchParams(location.search);

const storage = new Storage();
const app = {
  renderer: new Renderer(canvas),
  input: new Input(stage),
  particles: new Particles(),
  audio: new AudioEngine(),
  storage,
  progress: new Progress(storage),
  settings: {},
  profile: {},
  iconStyle: null,
  hooks: {},
  tweens: [],
  state: null,
  stateName: '',
  game: null,
  fps: 0,
};
app.ui = new UI(uiRoot, app);
app.achievements = new Achievements(app);
app.menuScene = new MenuScene(app);
const { renderer, input, audio, ui } = app;

// ---- settings ----------------------------------------------------------------------------------
const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Pushes saved settings/profile into every subsystem. */
app.applySettings = () => {
  const s = storage.settings;
  const q = { low: 0.3, medium: 0.6, high: 1 };
  const reduceMotion = s.reduceMotion === null ? !!(reducedMotionQuery && reducedMotionQuery.matches) : s.reduceMotion;
  Object.assign(app.settings, {
    restartDelay: s.restartDelay, particles: q[s.particles] ?? 1, shake: s.shake, reduceFlash: s.reduceFlash || reduceMotion,
    reduceMotion, autoCheckpoint: s.autoCheckpoint, hud: true, fpsCap: s.fpsCap, showFps: s.showFps,
  });
  app.particles.setQuality(app.settings.particles);
  audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  audio.setMuted(s.muted);
  renderer.opt.glow = { low: 0, medium: 1, high: 2 }[s.glow] ?? 2;
  renderer.opt.hitboxes = s.hitboxes;
  renderer.opt.colorblind = s.colorblind;
  input.setBindings(s.bindings);
  document.documentElement.classList.toggle('large-ui', !!s.largeUi);
  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  const pr = storage.profile;
  app.profile.colors = { p1: PLAYER_COLORS[pr.p1] || PLAYER_COLORS[0], p2: PLAYER_COLORS[pr.p2] || PLAYER_COLORS[1], g: PLAYER_COLORS[pr.glowColor] || PLAYER_COLORS[2] };
  app.profile.trail = pr.trail;
  app.iconStyle = {
    colors: app.profile.colors,
    twinColors: { p1: app.profile.colors.p2, p2: app.profile.colors.p1, g: app.profile.colors.g },
    variants: { ...pr.icons },
    glow: pr.glow,
  };
};

// ---- layout ------------------------------------------------------------------------------------
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / VIEW_W, vh / VIEW_H);
  const w = Math.floor(VIEW_W * scale);
  const hgt = Math.floor(VIEW_H * scale);
  stage.style.width = `${w}px`;
  stage.style.height = `${hgt}px`;
  stage.style.left = `${Math.floor((vw - w) / 2)}px`;
  stage.style.top = `${Math.floor((vh - hgt) / 2)}px`;
  uiRoot.style.transform = `scale(${w / VIEW_W})`;
  renderer.resize(w, hgt, Math.min(MAX_DPR, window.devicePixelRatio || 1));
  const hint = document.getElementById('rotate-hint');
  const portrait = vh > vw * 1.1 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  hint.hidden = !portrait || !!app.rotateDismissed;
}
window.addEventListener('resize', layout);
document.getElementById('rotate-dismiss').addEventListener('click', () => { app.rotateDismissed = true; layout(); });

app.toggleFullscreen = () => {
  const d = document;
  if (d.fullscreenElement) d.exitFullscreen().catch(() => {});
  else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
};

// ---- state machine -----------------------------------------------------------------------------
function ensureMenuMusic() {
  if (audio.currentTrack() !== 'menu') audio.playMusic('menu', 0);
}

/** A menu-like state: DOM screen over the animated backdrop. */
function menuState(build, opts = {}) {
  return {
    enter(data) { ui.clearAll(); ui.showScreen(build(app, data || {})); if (opts.music !== false) ensureMenuMusic(); },
    exit() { ui.clearScreen(); },
    update(now, dt) { app.menuScene.update(dt); },
    render() { app.menuScene.render(); },
    onNav: opts.onNav,
  };
}

const playState = {
  enter(data) {
    const { entry, practice, playtest, start, bot } = data;
    const game = new Game(app, entry.data, { levelId: entry.id, entry, practice, playtest, start, bot });
    app.game = game;
    this.completeShown = false;
    ui.clearAll();
    game.start();
    ui.showHud(playHud(app, game));
    if (data.skip) game.skipTo(data.skip);
  },
  exit() {
    app.game.destroy();
    app.game = null;
    ui.clearAll();
  },
  update(now, dt) {
    const g = app.game;
    g.update(now, dt);
    if (g.state === 'ended') { g.state = 'leaving'; app.exitGame(); return; }
    if (g.state === 'complete' && !this.completeShown && g.completeT > 1.3) {
      this.completeShown = true;
      ui.clearHud();
      ui.showOverlay(completeScreen(app, g, g.rewards, g.runSummary));
    }
  },
  render(now) { app.game.render(now); },
};

const STATES = {
  menu: menuState(mainMenu),
  levels: menuState(levelSelect, { onNav: (dir) => app.levelNav && app.levelNav(dir) }),
  credits: menuState(credits),
  settings: menuState(settingsScreen),
  customize: menuState(customizeScreen),
  achievements: menuState(achievementsScreen),
  play: playState,
  editor: {
    ownsKeys: true,
    enter(data) { app.editor = app.editor || new Editor(app); app.editor.enter(data || {}); },
    exit() { app.editor.exit(); },
    update(now, dt) { app.editor.update(now, dt); },
    render() { app.editor.render(); },
    onBack() { return app.editor.onBack(); },
  },
};
app.registerState = (name, st) => { STATES[name] = st; };
app.menuState = menuState;

function setState(name, data) {
  if (app.state && app.state.exit) app.state.exit();
  app.tweens.length = 0;
  app.state = STATES[name];
  app.stateName = name;
  app.state.enter(data);
}

/** Navigates to a state with an iris transition (or instantly). */
app.go = (name, data, instant = false) => {
  if (!STATES[name] || app.transitioning) return;
  const el = document.getElementById('transition');
  if (instant || app.settings.reduceMotion) { setState(name, data); return; }
  app.transitioning = true;
  el.className = 'iris-in';
  el.addEventListener('animationend', function closeDone() {
    el.removeEventListener('animationend', closeDone);
    setState(name, data);
    el.className = 'iris-out';
    el.addEventListener('animationend', function openDone() {
      el.removeEventListener('animationend', openDone);
      el.className = '';
      app.transitioning = false;
    });
  });
};

app.back = () => {
  if (ui.closeModal()) return;
  if (app.state && app.state.onBack && app.state.onBack()) return;
  if (app.stateName === 'play') {
    const g = app.game;
    if (g.state === 'paused') app.resumeGame();
    else if (g.state === 'complete') app.exitGame();
    else app.pauseGame();
    return;
  }
  if (app.stateName !== 'menu') app.go('menu');
};

app.playLevel = (entry, opts = {}) => app.go('play', { entry, ...opts });
app.pauseGame = () => {
  const g = app.game;
  if (g && g.pause()) ui.showOverlay(pauseMenu(app, g));
};
app.resumeGame = () => {
  const g = app.game;
  if (!g || g.state !== 'paused') return;
  ui.clearOverlay();
  g.resume();
};
app.restartGame = () => {
  const g = app.game;
  if (!g) return;
  ui.clearOverlay();
  playState.completeShown = false;
  ui.showHud(playHud(app, g));
  input.setGameplay(true);
  g.restart();
};
app.togglePractice = () => {
  const g = app.game;
  if (!g || g.state === 'complete') return;
  const paused = g.state === 'paused';
  g.setPractice(!g.practice);
  ui.showHud(playHud(app, g));
  if (paused) ui.showOverlay(pauseMenu(app, g));
};
app.exitGame = () => {
  const g = app.game;
  if (g && g.opts.playtest) app.go('editor', { resume: true });
  else app.go('levels');
};
app.bestFor = (g) => (g.opts.levelId ? app.progress.level(g.opts.levelId).best : 0);

// ---- gameplay hooks (progress, achievements) ---------------------------------------------------
app.hooks = {
  attempt: (g) => {
    if (g.opts.bot) return;
    if (g.opts.playtest) app.achievements.unlock('playtest');
    else app.progress.onAttempt(g.opts.levelId);
    app.achievements.check();
  },
  death: (g, d) => {
    if (g.opts.bot) return;
    if (!g.opts.playtest) app.progress.onRunEnd(g.opts.levelId, d.pct, d.practice, d);
    app.achievements.onDeath(g, d);
  },
  complete: (g, d) => {
    g.runSummary = { attempts: g.attempt, time: d.time, jumps: d.jumps, coins: d.coins };
    g.rewards = g.opts.bot || g.opts.playtest ? null : app.progress.onComplete(g.opts.levelId, g.meta, d.practice, d, d.coins);
    if (!g.opts.bot) app.achievements.onComplete(g, d);
  },
  jump: (g) => { if (!g.opts.bot) app.achievements.onJump(); },
  practice: (g) => { if (app.stateName === 'play' && g.state !== 'paused') ui.showHud(playHud(app, g)); },
  mirror: (g) => { if (!g.opts.bot) app.achievements.unlock('mirror'); },
  dual: (g) => { if (!g.opts.bot) app.achievements.unlock('dual'); },
  modeLeft: (g, d) => { if (!g.opts.bot) app.achievements.onModeLeft(d); },
};

// ---- global input ------------------------------------------------------------------------------
const unlockAudio = () => audio.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlockAudio, { capture: true });
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (document.hidden && app.game) app.pauseGame();
});
window.addEventListener('blur', () => { if (app.game && app.game.state === 'playing' && !app.game.opts.bot) app.pauseGame(); });

const inPlay = () => app.stateName === 'play' && app.game;
input.on('pause', () => app.back());
input.on('back', () => app.back());
input.on('restart', () => { if (inPlay() && app.game.state !== 'paused') app.restartGame(); });
input.on('practice', () => { if (inPlay()) app.togglePractice(); });
input.on('checkpoint', () => { if (inPlay()) app.game.placeCheckpoint(); });
input.on('uncheckpoint', () => { if (inPlay()) app.game.removeCheckpoint(); });
input.on('hitboxes', () => { storage.settings.hitboxes = !storage.settings.hitboxes; app.applySettings(); storage.save(); });
input.on('fps', () => { storage.settings.showFps = !storage.settings.showFps; app.applySettings(); storage.save(); });
input.on('mute', () => { storage.settings.muted = !storage.settings.muted; app.applySettings(); storage.save(); });
input.on('fullscreen', () => app.toggleFullscreen());

// ---- main loop ---------------------------------------------------------------------------------
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
  for (let i = app.tweens.length - 1; i >= 0; i--) {
    const t = app.tweens[i];
    t.t = Math.min(t.dur, t.t + dt);
    const u = t.t / t.dur;
    t.apply(t.from + (t.to - t.from) * (1 - (1 - u) * (1 - u)));
    if (t.t >= t.dur) app.tweens.splice(i, 1);
  }
  if (app.state) {
    app.state.update(now, dt);
    app.state.render(now);
  }
  if (app.settings.showFps) drawFps();
  uiRoot.style.setProperty('--pulse', audio.musicPlaying() ? audio.beatPulse().toFixed(3) : '0');
}

function drawFps() {
  const ctx = renderer.ctx;
  renderer.toScreen();
  ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(14, 14, 132, 38);
  ctx.fillStyle = app.fps >= 55 ? '#3dff7a' : app.fps >= 40 ? '#ffd500' : '#ff3b5c';
  ctx.fillText(`${Math.round(app.fps)} FPS`, 24, 20);
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
  app.applySettings();
  layout();
  window.neonDash = app;
  if (params.has('test')) { await runTests(); return; }
  if (params.has('bot')) {
    // Bot playback for tests/screenshots: ?bot=1&level=N[&t=seconds] or ?bot=1&showcase=1
    const idx = Number(params.get('level') || 1) - 1;
    const entry = params.has('showcase')
      ? { id: 'showcase', data: (await import('../tests/levels/showcase.js')).default }
      : LEVELS[idx];
    const res = await fetch(`tests/recordings/${entry.data.meta.id}.json`);
    const bot = new RecordingInput(await res.json());
    setState('play', { entry, bot, skip: params.has('t') ? Number(params.get('t')) : 0 });
  } else {
    const s = params.get('screen');
    setState(s && STATES[s] ? s : 'menu');
  }
  requestAnimationFrame(frame);
}

boot();
