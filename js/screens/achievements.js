/** Achievements gallery and lifetime statistics. */
import { h, ICONS } from '../ui.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { LEVELS } from '../levels/index.js';

const fmtDuration = (s) => {
  const hrs = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return hrs ? `${hrs}h ${m}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
};

function gallery(app) {
  const got = app.storage.data.achievements;
  const n = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const cards = ACHIEVEMENTS.map((a) => {
    const when = got[a.id];
    return h('article', { class: `ach ${when ? 'got' : 'locked'}`, tabindex: '0', 'aria-label': `${a.name}: ${a.desc} ${when ? 'Unlocked.' : 'Locked.'}` },
      h('div', { class: 'ach-icon', 'aria-hidden': 'true' }, when ? a.icon : h('span', { class: 'ico', svg: ICONS.lock })),
      h('div', {}, h('h3', {}, a.name), h('p', {}, a.desc),
        when ? h('small', {}, `Unlocked ${new Date(when).toLocaleDateString()}`) : null));
  });
  return [
    h('div', { class: 'ach-summary' }, h('b', {}, `${n} / ${ACHIEVEMENTS.length}`), ' unlocked',
      h('div', { class: 'ach-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ACHIEVEMENTS.length), 'aria-valuenow': String(n) },
        h('i', { style: { width: `${(n / ACHIEVEMENTS.length) * 100}%` } }))),
    h('div', { class: 'ach-grid' }, cards),
  ];
}

function stats(app) {
  const d = app.storage.data;
  const s = d.stats;
  const p = app.progress;
  const tile = (label, value) => h('div', { class: 'stat-tile' }, h('small', {}, label), h('b', {}, String(value)));
  const visible = LEVELS.filter((l) => !l.hidden || p.isUnlocked(l));
  return [
    h('div', { class: 'stat-tiles' },
      tile('Attempts', s.attempts.toLocaleString()), tile('Jumps', s.jumps.toLocaleString()), tile('Deaths', s.deaths.toLocaleString()),
      tile('Completions', s.completions), tile('Play time', fmtDuration(s.playTime)), tile('Button held', fmtDuration(s.holdTime)),
      tile('Stars', p.totalStars()), tile('Secret coins', p.totalCoins()), tile('Orbs', d.orbs.toLocaleString()),
      tile('Diamonds', d.diamonds), tile('Levels created', s.levelsCreated), tile('Achievements', Object.keys(d.achievements).length)),
    h('table', { class: 'stat-table' },
      h('thead', {}, h('tr', {}, ['Level', 'Best', 'Practice', 'Attempts', 'Jumps', 'Clears', 'Coins'].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, visible.map((l) => {
        const st = p.level(l.id);
        return h('tr', {}, h('th', { scope: 'row' }, l.data.meta.name), h('td', {}, `${st.best}%`), h('td', {}, `${st.bestPractice}%`),
          h('td', {}, String(st.attempts)), h('td', {}, String(st.jumps)), h('td', {}, String(st.completions)),
          h('td', {}, `${st.coins.filter(Boolean).length} / 3`));
      }))),
  ];
}

export function achievementsScreen(app, opts = {}) {
  const ui = app.ui;
  const tab = opts.tab || 'achievements';
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['achievements', 'Achievements'], ['stats', 'Statistics']].map(([id, label]) => h('button', {
    type: 'button', role: 'tab', class: `tab ${id === tab ? 'on' : ''}`, 'aria-selected': id === tab ? 'true' : 'false',
    onclick: () => app.go('achievements', { tab: id }, true),
  }, label)));
  return h('section', { class: 'screen panel-screen' },
    h('header', { class: 'screen-head' }, ui.button('Back', () => app.go('menu'), { icon: ICONS.back, sfx: 'back' }), h('h2', {}, tab === 'stats' ? 'Statistics' : 'Achievements'), tabs),
    h('div', { class: 'panel achievements' }, tab === 'stats' ? stats(app) : gallery(app)));
}
