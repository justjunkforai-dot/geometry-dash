/**
 * Customize: icon variant per game mode, primary/secondary/glow colours, glow on/off and the
 * trail. Locked items show their requirement; everything unlocks from progress thresholds.
 */
import { h, ICONS } from '../ui.js';
import { ICON_COUNTS, ICON_NAMES, ICON_BOX, drawIcon } from '../icons.js';
import { PLAYER_COLORS, TRAILS, colorReq, iconRequirement, requirementText, playerTotals, meets, MODES_ORDER } from '../cosmetics.js';

const SECTIONS = [['icons', 'Icons'], ['colors', 'Colours'], ['trail', 'Trail']];
const MODE_LABEL = { cube: 'Cube', ship: 'Ship', ball: 'Ball', ufo: 'UFO', wave: 'Wave', robot: 'Robot', spider: 'Spider', swing: 'Swing' };

/** Draws one icon centred into a square canvas of `size` CSS px (crisp at 2× density). */
function iconCanvas(mode, v, colors, cubeVariant, size, glow) {
  const c = document.createElement('canvas');
  const k = 2;
  c.width = c.height = size * k;
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  const box = ICON_BOX[mode];
  const unit = (size * k * 0.62) / Math.max(box[0], box[1] + (mode === 'robot' ? 0.3 : 0));
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(unit, unit);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (glow) { ctx.shadowColor = colors.g; ctx.shadowBlur = unit * 0.35; }
  drawIcon(ctx, mode, v, colors, cubeVariant);
  ctx.shadowBlur = 0;
  if (glow) drawIcon(ctx, mode, v, colors, cubeVariant);
  return c;
}

export function customizeScreen(app, opts = {}) {
  const ui = app.ui;
  const pr = app.storage.profile;
  const state = { section: opts.section || 'icons', mode: opts.mode || 'cube' };
  const totals = playerTotals(app);
  const hint = h('p', { class: 'cz-hint', role: 'status' }, '');
  const preview = h('div', { class: 'cz-preview' });
  const content = h('div', { class: 'cz-content' });
  const sectionTabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Customize sections' });

  const colors = () => app.profile.colors;

  const commit = () => {
    app.applySettings();
    app.storage.save();
    app.achievements.unlock('customize');
    render();
  };

  /** A selectable tile; locked tiles explain their requirement instead of selecting. */
  const tile = (key, label, child, selected, req, onPick, cls = '') => {
    const locked = !meets(req, totals);
    const b = h('button', {
      type: 'button', class: `cz-tile ${cls} ${selected ? 'on' : ''} ${locked ? 'locked' : ''}`, 'data-key': key,
      'aria-pressed': selected ? 'true' : 'false', 'aria-label': locked ? `${label}, locked. ${requirementText(req)}` : label,
      title: locked ? requirementText(req) : label,
      onclick: () => {
        if (locked) { hint.textContent = `${label} is locked — ${requirementText(req).toLowerCase()}.`; app.audio.sfx('back'); return; }
        onPick();
      },
      onfocus: () => { hint.textContent = locked ? `${label}: ${requirementText(req)}` : label; },
    }, child, locked ? h('span', { class: 'cz-lock', 'aria-hidden': 'true', svg: ICONS.lock }) : null);
    return b;
  };

  function renderPreview() {
    const big = iconCanvas(state.mode, pr.icons[state.mode] || 0, colors(), pr.icons.cube || 0, 300, pr.glow);
    const row = h('div', { class: 'cz-modes-row' }, MODES_ORDER.map((m) => h('button', {
      type: 'button', class: `cz-mini ${m === state.mode ? 'on' : ''}`, 'aria-label': `Show ${MODE_LABEL[m]} icons`,
      onclick: () => { state.mode = m; state.section = 'icons'; render(); },
    }, iconCanvas(m, pr.icons[m] || 0, colors(), pr.icons.cube || 0, 64, false))));
    const trail = TRAILS.find((t) => t.id === pr.trail) || TRAILS[0];
    preview.replaceChildren(
      h('div', { class: `cz-stage trail-${trail.id}` }, h('div', { class: 'cz-trail', 'aria-hidden': 'true' }), big),
      h('p', { class: 'cz-name' }, `${MODE_LABEL[state.mode]} · ${ICON_NAMES[state.mode][pr.icons[state.mode] || 0]}`),
      row,
      h('div', { class: 'cz-totals' },
        h('span', {}, h('span', { class: 'ico', svg: ICONS.star }), String(totals.stars)),
        h('span', {}, h('span', { class: 'ico', svg: ICONS.coin }), `${totals.orbs} orbs`),
        h('span', {}, h('span', { class: 'ico', svg: ICONS.diamond }), String(totals.diamonds)),
        h('span', {}, h('span', { class: 'ico', svg: ICONS.coin }), `${totals.coins} coins`)));
    preview.querySelector('.cz-stage').style.setProperty('--p1', colors().p1);
    preview.querySelector('.cz-stage').style.setProperty('--g', colors().g);
  }

  function iconsSection() {
    const tabs = h('div', { class: 'cz-mode-tabs', role: 'tablist', 'aria-label': 'Game mode' }, MODES_ORDER.map((m) => h('button', {
      type: 'button', role: 'tab', class: `tab ${m === state.mode ? 'on' : ''}`, 'aria-selected': m === state.mode ? 'true' : 'false',
      onclick: () => { state.mode = m; render(); },
    }, MODE_LABEL[m])));
    const grid = h('div', { class: 'cz-grid' });
    for (let v = 0; v < ICON_COUNTS[state.mode]; v++) {
      const name = ICON_NAMES[state.mode][v];
      grid.append(tile(`icon-${v}`, `${MODE_LABEL[state.mode]} ${name}`, iconCanvas(state.mode, v, colors(), pr.icons.cube || 0, 96, false),
        (pr.icons[state.mode] || 0) === v, iconRequirement(state.mode, v), () => { pr.icons[state.mode] = v; commit(); }));
    }
    return [tabs, grid];
  }

  function colorRow(label, field) {
    return h('div', { class: 'cz-color-row' }, h('h3', {}, label), h('div', { class: 'cz-swatches' }, PLAYER_COLORS.map((col, i) => tile(
      `${field}-${i}`, `${label} colour ${i + 1}`, h('span', { class: 'cz-swatch', style: { background: col } }),
      pr[field] === i, colorReq(i), () => { pr[field] = i; commit(); }, 'cz-color'))));
  }

  function colorsSection() {
    return [
      colorRow('Primary', 'p1'), colorRow('Secondary', 'p2'), colorRow('Glow', 'glowColor'),
      ui.toggle('Icon glow', pr.glow, (v) => { pr.glow = v; commit(); }),
    ];
  }

  function trailSection() {
    return [h('div', { class: 'cz-trails' }, TRAILS.map((t) => tile(`trail-${t.id}`, `${t.name} trail`,
      h('span', { class: `cz-trail-demo trail-${t.id}`, style: { '--p1': colors().p1, '--g': colors().g } }, h('b', {}, t.name)),
      pr.trail === t.id, t.req || null, () => { pr.trail = t.id; commit(); }, 'cz-trail-tile')))];
  }

  function render() {
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    sectionTabs.replaceChildren(...SECTIONS.map(([id, label]) => h('button', {
      type: 'button', role: 'tab', class: `tab ${id === state.section ? 'on' : ''}`, 'aria-selected': id === state.section ? 'true' : 'false',
      onclick: () => { state.section = id; render(); },
    }, label)));
    renderPreview();
    const body = state.section === 'colors' ? colorsSection() : state.section === 'trail' ? trailSection() : iconsSection();
    content.replaceChildren(...body);
    if (focused) {
      const el = content.querySelector(`[data-key="${focused}"]`);
      if (el) el.focus({ preventScroll: true });
    }
  }

  render();
  return h('section', { class: 'screen panel-screen customize' },
    h('header', { class: 'screen-head' }, ui.button('Back', () => app.go('menu'), { icon: ICONS.back, sfx: 'back' }), h('h2', {}, 'Customize'), sectionTabs),
    h('div', { class: 'cz-body' }, h('div', { class: 'panel cz-left' }, preview), h('div', { class: 'panel cz-right' }, content, hint)));
}
