/** Level select: carousel of built-in levels and the "My Levels" list of custom levels. */
import { h, ICONS, faceSVG, plural } from '../ui.js';
import { LEVELS } from '../levels/index.js';
import { DIFFICULTIES } from '../progress.js';

function bar(label, pct, cls) {
  return h('div', { class: `pbar ${cls}`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
    h('span', { class: 'pbar-label' }, label), h('div', { class: 'pbar-track' }, h('div', { class: 'pbar-fill', style: { width: `${pct}%` } })), h('b', {}, `${pct}%`));
}

function coinSlots(coins) {
  return h('div', { class: 'coins', 'aria-label': `${coins.filter(Boolean).length} of 3 secret coins` },
    coins.map((c) => h('span', { class: `coin ${c ? 'got' : ''}`, 'aria-hidden': 'true', svg: ICONS.coin })));
}

/** Levels visible in the carousel: main levels plus unlocked hidden ones. */
function carouselLevels(app) {
  return LEVELS.filter((l) => !l.hidden || app.progress.isUnlocked(l));
}

export function levelCard(app, entry) {
  const ui = app.ui;
  const m = entry.data.meta;
  const st = app.progress.level(entry.id);
  const unlocked = app.progress.isUnlocked(entry);
  const diff = DIFFICULTIES[m.difficulty] || DIFFICULTIES.normal;
  const len = Math.round(estimateLength(entry));
  const card = h('article', { class: `level-card ${unlocked ? '' : 'locked'}`, style: { '--accent': m.palette.obj }, 'aria-label': `${m.name}, ${diff.name}${unlocked ? '' : ', locked'}` },
    h('div', { class: 'face', svg: faceSVG(m.difficulty, diff.color) }),
    h('div', { class: 'card-main' },
      h('h2', {}, m.name),
      h('p', { class: 'card-sub' }, h('span', { class: 'diff', style: { color: diff.color } }, diff.name),
        h('span', { class: 'stars', 'aria-label': `${m.stars} stars` }, h('span', { class: 'ico', svg: ICONS.star, 'aria-hidden': 'true' }), ` ${m.stars}`),
        h('span', {}, `${len}s · ${m.bpm} BPM`), entry.hidden ? h('span', { class: 'bonus-tag' }, 'BONUS') : null),
      bar('Normal', st.best, 'normal'),
      bar('Practice', st.bestPractice, 'practice'),
      h('div', { class: 'card-foot' }, coinSlots(st.coins), h('span', { class: 'muted' }, `${st.attempts} attempts`))),
    unlocked ? null : h('div', { class: 'lock', 'aria-hidden': 'true' }, h('span', { class: 'ico', svg: ICONS.lock }), h('p', {}, app.progress.unlockHint(entry))));
  const actions = h('div', { class: 'card-actions' },
    ui.button('Play', () => app.playLevel(entry, { practice: false }), { icon: ICONS.play, cls: 'primary big', disabled: !unlocked, autofocus: unlocked }),
    ui.button('Practice', () => app.playLevel(entry, { practice: true }), { icon: ICONS.diamond, disabled: !unlocked }));
  return h('div', { class: 'card-wrap' }, card, actions);
}

/** Approximate play time from the level's end position and start speed. */
function estimateLength(entry) {
  const d = entry.data;
  let endX = 0;
  for (const o of d.objects) if (o[0] === 71) endX = o[1];
  return endX / 10.4 / [0.7, 1, 1.3, 1.6, 2][d.meta.startSpeed ?? 1];
}

export function levelSelect(app, opts = {}) {
  const ui = app.ui;
  const tab = opts.tab || 'main';
  const levels = carouselLevels(app);
  let index = Math.min(levels.length - 1, Math.max(0, app.lastLevelIndex || 0));
  const holder = h('div', { class: 'carousel-card' });
  const dots = h('div', { class: 'dots', role: 'tablist', 'aria-label': 'Levels' });
  const render = (dir = 0) => {
    app.lastLevelIndex = index;
    const card = levelCard(app, levels[index]);
    if (dir) card.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    holder.replaceChildren(card);
    dots.replaceChildren(...levels.map((l, i) => h('button', {
      type: 'button', class: `dot ${i === index ? 'on' : ''}`, role: 'tab', 'aria-selected': i === index ? 'true' : 'false',
      'aria-label': l.data.meta.name, onclick: () => { const d = i - index; index = i; render(d); },
    })));
    const f = holder.querySelector('[data-autofocus]') || holder.querySelector('button:not([disabled])');
    if (f && opts.focus !== false) f.focus({ preventScroll: true });
  };
  const step = (d) => { index = (index + d + levels.length) % levels.length; render(d); };
  app.levelNav = (dir) => {
    if (tab !== 'main') return false;
    if (dir === 'left') { step(-1); return true; }
    if (dir === 'right') { step(1); return true; }
    return false;
  };
  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    h('button', { type: 'button', role: 'tab', class: `tab ${tab === 'main' ? 'on' : ''}`, 'aria-selected': tab === 'main' ? 'true' : 'false', onclick: () => app.go('levels', { tab: 'main' }, true) }, 'Main Levels'),
    h('button', { type: 'button', role: 'tab', class: `tab ${tab === 'mine' ? 'on' : ''}`, 'aria-selected': tab === 'mine' ? 'true' : 'false', onclick: () => app.go('levels', { tab: 'mine' }, true) }, 'My Levels'));
  const head = h('header', { class: 'screen-head' }, ui.button('Back', () => app.go('menu'), { icon: ICONS.back, sfx: 'back' }), tabs);
  if (tab === 'mine') return h('section', { class: 'screen levels-screen' }, head, myLevels(app));
  const body = h('div', { class: 'carousel' },
    ui.button('', () => step(-1), { icon: ICONS.left, cls: 'arrow round', aria: 'Previous level' }),
    holder,
    ui.button('', () => step(1), { icon: ICONS.right, cls: 'arrow round', aria: 'Next level' }));
  const el = h('section', { class: 'screen levels-screen' }, head, body, dots);
  render();
  return el;
}

function myLevels(app) {
  const ui = app.ui;
  const list = app.storage.listCustom();
  const rerender = () => app.go('levels', { tab: 'mine' }, true);
  if (!list.length) {
    return h('div', { class: 'panel empty' }, h('h3', {}, 'No levels yet'), h('p', {}, 'Build your own level in the editor — it will show up here.'),
      ui.button('Open the editor', () => app.go('editor'), { icon: ICONS.build, cls: 'primary', autofocus: true }));
  }
  return h('div', { class: 'my-levels' }, list.map((c) => {
    const st = app.progress.level(c.id);
    return h('article', { class: 'my-level panel', 'aria-label': c.name },
      h('div', {}, h('h3', {}, c.name), h('p', { class: 'muted' }, `${plural(c.objects, 'object')} · best ${st.best}% · ${new Date(c.updated).toLocaleDateString()}`)),
      h('div', { class: 'my-actions' },
        ui.button('Play', () => {
          const data = app.storage.loadCustom(c.id);
          if (data) app.playLevel({ id: c.id, data, custom: true }, { practice: false });
        }, { icon: ICONS.play, cls: 'primary' }),
        ui.button('Edit', () => app.go('editor', { id: c.id }), { icon: ICONS.edit }),
        ui.button('Rename', async () => {
          const n = await ui.prompt('Rename level', c.name);
          if (n) { app.storage.renameCustom(c.id, n); rerender(); }
        }),
        ui.button('Delete', async () => {
          if (await ui.confirm(`Delete "${c.name}"? This cannot be undone.`, 'Delete', true)) { app.storage.deleteCustom(c.id); rerender(); }
        }, { icon: ICONS.trash, cls: 'danger' })));
  }));
}
