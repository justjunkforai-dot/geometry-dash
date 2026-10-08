/** Main menu and credits screens. */
import { h, ICONS } from '../ui.js';

function stat(icon, value, label) {
  return h('div', { class: 'stat', 'aria-label': `${label}: ${value}` },
    h('span', { class: 'stat-ico', 'aria-hidden': 'true', svg: icon }), h('b', {}, value), h('small', {}, label));
}

export function mainMenu(app) {
  const ui = app.ui;
  const p = app.progress;
  const logo = h('h1', { class: 'logo', 'aria-label': 'Neon Dash' },
    h('span', { class: 'logo-a', 'aria-hidden': 'true' }, ...'NEON'.split('').map((c, i) => h('i', { style: { '--i': i } }, c))),
    h('span', { class: 'logo-b', 'aria-hidden': 'true' }, ...'DASH'.split('').map((c, i) => h('i', { style: { '--i': i + 4 } }, c))));
  const play = h('button', { type: 'button', class: 'play-big', 'aria-label': 'Play', 'data-autofocus': true, onclick: () => app.go('levels') },
    h('span', { class: 'ico', 'aria-hidden': 'true', svg: ICONS.play }));
  const row = h('nav', { class: 'menu-row', 'aria-label': 'Main menu' },
    ui.button('Create', () => app.go('editor'), { icon: ICONS.build, cls: 'tile' }),
    ui.button('Customize', () => app.go('customize'), { icon: ICONS.palette, cls: 'tile' }),
    ui.button('Achievements', () => app.go('achievements'), { icon: ICONS.trophy, cls: 'tile' }),
    ui.button('Settings', () => app.go('settings'), { icon: ICONS.gear, cls: 'tile' }),
    ui.button('Credits', () => app.go('credits'), { icon: ICONS.info, cls: 'tile' }));
  const stats = h('div', { class: 'menu-stats' },
    stat(ICONS.star, p.totalStars(), 'Stars'),
    stat(ICONS.coin, `${p.totalCoins()}`, 'Coins'),
    stat(ICONS.diamond, app.storage.data.diamonds, 'Diamonds'),
    stat(ICONS.restart, app.storage.data.stats.attempts, 'Attempts'));
  const corner = h('div', { class: 'corner-buttons' },
    ui.button('', () => app.toggleFullscreen(), { icon: ICONS.fullscreen, aria: 'Toggle fullscreen', cls: 'round' }));
  return h('section', { class: 'screen menu-screen' }, logo, play, row, stats, corner,
    app.storage.persistent ? null : h('p', { class: 'warn-note' }, 'Storage is unavailable: progress will not be saved in this browser mode.'));
}

export function credits(app) {
  const ui = app.ui;
  return h('section', { class: 'screen panel-screen' },
    h('header', { class: 'screen-head' }, ui.button('Back', () => app.go('menu'), { icon: ICONS.back, sfx: 'back' }), h('h2', {}, 'Credits')),
    h('div', { class: 'panel credits' },
      h('h3', {}, 'Neon Dash'),
      h('p', {}, 'An original one-button rhythm platformer built with plain JavaScript, Canvas 2D and the Web Audio API.'),
      h('p', {}, 'All graphics are drawn in code and every note of music and every sound effect is synthesized live in your browser. No external assets, fonts or network requests.'),
      h('h3', {}, 'Controls'),
      h('ul', {},
        h('li', {}, 'Jump: Space, ↑, W, left click, tap, or any gamepad face button'),
        h('li', {}, 'Esc: pause · R: restart · P: practice mode · Z / X: place / remove checkpoint'),
        h('li', {}, 'H: hitboxes · F: FPS counter · M: mute · F11: fullscreen')),
      h('h3', {}, 'Music'),
      h('p', {}, 'Original tracks: First Steps, Neon Skyline, Gravity Well, Pulse Reactor, Wave Runner, Mirror Maze, Saw Factory, Final Descent, Prism Core, Neon Lounge and Blueprint.'),
      h('p', { class: 'muted' }, 'Thanks for playing!')));
}
