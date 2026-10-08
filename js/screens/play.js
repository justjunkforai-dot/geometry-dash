/** In-level UI: HUD buttons, pause menu and the level-complete screen. */
import { h, ICONS } from '../ui.js';
import { LEVELS } from '../levels/index.js';

export function playHud(app, game) {
  const ui = app.ui;
  const pause = h('button', { type: 'button', class: 'btn round hud-pause', 'aria-label': 'Pause', onclick: () => app.pauseGame() },
    h('span', { class: 'ico', 'aria-hidden': 'true', svg: ICONS.pause }));
  const kids = [pause];
  if (game.practice) {
    kids.push(h('div', { class: 'hud-practice' },
      ui.button('Checkpoint', () => game.placeCheckpoint(), { icon: ICONS.diamond, cls: 'cp-add', aria: 'Place checkpoint (Z)' }),
      ui.button('Remove', () => game.removeCheckpoint(), { icon: ICONS.trash, cls: 'cp-del', aria: 'Remove last checkpoint (X)' })));
  }
  return h('div', { class: 'hud' }, kids);
}

export function pauseMenu(app, game) {
  const ui = app.ui;
  const meta = game.meta;
  const st = app.progress.level(game.opts.levelId);
  const s = app.storage.settings;
  return h('div', { class: 'scrim' }, h('section', { class: 'panel pause', role: 'dialog', 'aria-label': 'Paused' },
    h('h2', {}, 'Paused'),
    h('p', { class: 'muted' }, `${meta.name} · ${game.percent}%${game.practice ? ' · practice' : ''}`),
    h('div', { class: 'pause-bars' },
      h('div', { class: 'mini-bar' }, h('span', {}, 'Best'), h('div', { class: 'pbar-track' }, h('div', { class: 'pbar-fill', style: { width: `${st.best}%` } })), h('b', {}, `${st.best}%`)),
      h('div', { class: 'mini-bar practice' }, h('span', {}, 'Practice'), h('div', { class: 'pbar-track' }, h('div', { class: 'pbar-fill', style: { width: `${st.bestPractice}%` } })), h('b', {}, `${st.bestPractice}%`))),
    h('div', { class: 'pause-actions' },
      ui.button('Resume', () => app.resumeGame(), { icon: ICONS.play, cls: 'primary big', autofocus: true }),
      ui.button('Restart', () => app.restartGame(), { icon: ICONS.restart }),
      ui.button(game.practice ? 'Practice: On' : 'Practice: Off', () => app.togglePractice(), { icon: ICONS.diamond, cls: game.practice ? 'on' : '' }),
      ui.button(game.opts.playtest ? 'Back to Editor' : 'Exit to Menu', () => app.exitGame(), { icon: game.opts.playtest ? ICONS.build : ICONS.home, sfx: 'back' })),
    h('div', { class: 'pause-settings' },
      ui.slider('Music', s.music, (v) => { s.music = v; app.applySettings(); }),
      ui.slider('Sound effects', s.sfx, (v) => { s.sfx = v; app.applySettings(); }),
      ui.toggle('Show hitboxes', s.hitboxes, (v) => { s.hitboxes = v; app.applySettings(); }))));
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;

/** Animated counter element; app.ui.tick() advances it. */
function counter(app, icon, label, value) {
  const num = h('b', {}, '0');
  const el = h('div', { class: 'reward', 'aria-label': `${label}: ${value}` }, h('span', { class: 'ico', 'aria-hidden': 'true', svg: icon }), num, h('small', {}, label));
  app.tweens.push({ t: 0, dur: 1.2, from: 0, to: value, apply: (v) => { num.textContent = String(Math.round(v)); } });
  return el;
}

function rewardNote(game, rewards) {
  if (game.opts.playtest) return 'Playtest passed: your level can be beaten.';
  if (game.practice) return 'Practice runs do not award stars or coins.';
  return rewards && rewards.custom ? 'Custom levels do not award stars or orbs.' : '';
}

export function completeScreen(app, game, rewards, run) {
  const ui = app.ui;
  const entry = game.opts.entry;
  const idx = LEVELS.indexOf(entry);
  const next = idx >= 0 ? LEVELS.slice(idx + 1).find((l) => app.progress.isUnlocked(l)) : null;
  const coins = run.coins;
  const title = game.practice ? 'Practice Complete!' : 'Level Complete!';
  const actions = [ui.button('Replay', () => app.restartGame(), { icon: ICONS.restart, cls: 'primary', autofocus: true })];
  if (game.opts.playtest) actions.push(ui.button('Back to Editor', () => app.exitGame(), { icon: ICONS.build, sfx: 'back' }));
  else {
    if (next && !game.practice) actions.push(ui.button('Next Level', () => app.playLevel(next, { practice: false }), { icon: ICONS.next }));
    actions.push(ui.button('Menu', () => app.exitGame(), { icon: ICONS.home, sfx: 'back' }));
  }
  return h('div', { class: 'scrim light' }, h('section', { class: 'panel complete', role: 'dialog', 'aria-label': title },
    h('h2', { class: 'banner' }, ...title.split('').map((c, i) => h('i', { style: { '--i': i } }, c === ' ' ? ' ' : c))),
    h('p', { class: 'muted' }, game.meta.name, rewards && rewards.firstClear ? h('span', { class: 'tag' }, 'First clear!') : null),
    h('div', { class: 'complete-stats' },
      h('div', {}, h('small', {}, 'Attempts'), h('b', {}, String(run.attempts))),
      h('div', {}, h('small', {}, 'Time'), h('b', {}, fmtTime(run.time))),
      h('div', {}, h('small', {}, 'Jumps'), h('b', {}, String(run.jumps))),
      h('div', {}, h('small', {}, 'Coins'), h('span', { class: 'coins' }, coins.map((c) => h('span', { class: `coin ${c ? 'got' : ''}`, svg: ICONS.coin }))))),
    rewards && !game.practice && !rewards.custom ? h('div', { class: 'rewards' },
      counter(app, ICONS.star, 'Stars', rewards.stars),
      counter(app, ICONS.coin, 'Orbs', rewards.orbs),
      counter(app, ICONS.diamond, 'Diamonds', rewards.diamonds)) : h('p', { class: 'muted' }, rewardNote(game, rewards)),
    h('div', { class: 'complete-actions' }, actions)));
}
