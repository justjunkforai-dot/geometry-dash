/**
 * Editor DOM: toolbar, categorized palette, properties panel, and dialogs (level settings,
 * load/manage, validation). All edits go through Editor.modify()/commit() so they are undoable.
 */
import { h, ICONS, plural } from './ui.js';
import { OBJECT_DEFS, CATEGORIES, getDef, EASINGS, CHANNELS } from './objects.js';
import { MODE_NAMES, SPEED_NAMES, BLOCK, MODES } from './config.js';
import { TRACKS, LEVEL_SONGS } from './tracks.js';
import { BG_STYLES, GROUND_STYLES } from './background.js';
import { DIFFICULTIES } from './progress.js';
import { thumb } from './editor-view.js';
import { exportJSON, importJSON, validate } from './editor-io.js';
import { download } from './screens/settings.js';

const LAYERS = [['M', 'Main'], ['B', 'Background'], ['F', 'Foreground'], ['all', 'All layers']];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export class EditorUI {
  constructor(ed) {
    this.ed = ed;
    this.cat = 'blocks';
  }

  get app() { return this.ed.app; }
  text(t) { return h('p', {}, t); }

  mount() {
    this.root = h('div', { class: 'editor passthrough' });
    this.toolbar = h('header', { class: 'ed-toolbar panel', role: 'toolbar', 'aria-label': 'Editor tools' });
    this.paletteEl = h('section', { class: 'ed-palette panel', 'aria-label': 'Object palette' });
    this.props = h('aside', { class: 'ed-props panel', 'aria-label': 'Properties' });
    this.toast = h('div', { class: 'ed-flash', role: 'status' });
    this.root.append(this.toolbar, this.paletteEl, this.props, this.toast);
    this.app.ui.clearAll();
    this.app.ui.showHud(this.root);
    this.refresh();
  }

  unmount() { this.app.ui.clearHud(); this.root = null; }

  flash(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }

  refresh() {
    if (!this.root) return;
    this.buildToolbar();
    this.buildPalette();
    this.buildProps();
  }

  status() {
    if (!this.statusEl) return;
    const c = this.ed.cursor;
    this.statusEl.textContent = `${plural(this.ed.items.size, 'object')} · x ${c.x.toFixed(1)} y ${c.y.toFixed(1)} · ${Math.round(this.ed.cam.zoom * 100)}%`;
  }

  btn(label, fn, opts = {}) { return this.app.ui.button(label, fn, { ...opts, cls: `ed-btn ${opts.cls || ''}` }); }

  buildToolbar() {
    const ed = this.ed;
    const tool = (id, label, key, icon) => this.btn(label, () => ed.setTool(id), { cls: ed.tool === id ? 'on' : '', title: `${label} (${key})`, icon, aria: `${label} tool` });
    const icon = (ico, fn, label, opts = {}) => this.btn('', fn, { icon: ico, aria: label, title: label, ...opts });
    const layer = h('select', { 'aria-label': 'Layer', title: 'Layer to place on / show' }, LAYERS.map(([v, n]) => h('option', { value: v, selected: ed.layer === v || null }, n)));
    layer.addEventListener('change', () => { ed.layer = layer.value; ed.selection.clear(); this.refresh(); });
    this.toolbar.replaceChildren(
      icon(ICONS.back, () => ed.leave(), 'Exit editor (Esc)', { sfx: 'back' }),
      h('span', { class: 'ed-title', title: ed.meta.name }, `${ed.meta.name}${ed.dirty ? ' •' : ''}`),
      icon(ICONS.save, () => this.save(), 'Save (Ctrl+S)'),
      icon(ICONS.folder, () => this.manage(), 'Your levels: load, rename, delete, new'),
      icon(ICONS.download, () => this.exportFile(), 'Export as .json'),
      icon(ICONS.upload, () => this.pickFile(), 'Import a .json file (or drop it on the editor)'),
      h('span', { class: 'sep' }),
      icon(ICONS.undo, () => ed.undo(), 'Undo (Ctrl+Z)', { disabled: !ed.undoStack.length }),
      icon(ICONS.redo, () => ed.redo(), 'Redo (Ctrl+Y)', { disabled: !ed.redoStack.length }),
      h('span', { class: 'sep' }),
      tool('build', 'Build', 'B', ICONS.build),
      tool('select', 'Select', 'V', ICONS.cursor),
      tool('delete', 'Erase', 'E', ICONS.trash),
      icon(ICONS.grid, () => { ed.snap = !ed.snap; this.refresh(); }, `Grid snap ${ed.snap ? 'on' : 'off'} (G)`, { cls: ed.snap ? 'on' : '' }),
      layer,
      h('span', { class: 'grow' }),
      this.btn('Check', () => this.showValidation(), { icon: ICONS.check, title: 'Validate the level' }),
      this.btn('Level', () => this.settings(), { icon: ICONS.gear, title: 'Level settings' }),
      icon(ICONS.info, () => this.help(), 'Shortcuts and help'),
      this.btn('Test', () => ed.playtest(false), { icon: ICONS.play, cls: 'primary', title: 'Playtest from the start (Enter)' }),
      this.btn('Here', () => ed.playtest(true), { icon: ICONS.play, title: 'Playtest from the cursor / view (Shift+Enter)' }),
    );
  }

  buildPalette() {
    const ed = this.ed;
    const tabs = h('div', { class: 'ed-tabs', role: 'tablist' }, CATEGORIES.map((c) => h('button', {
      type: 'button', role: 'tab', class: `tab ${c.id === this.cat ? 'on' : ''}`, 'aria-selected': c.id === this.cat ? 'true' : 'false',
      onclick: () => { this.cat = c.id; this.buildPalette(); },
    }, c.name)));
    const items = OBJECT_DEFS.filter((d) => d.cat === this.cat).map((d) => {
      const b = h('button', {
        type: 'button', class: `ed-item ${ed.current === d.id && ed.tool === 'build' ? 'on' : ''}`, title: d.name, 'aria-label': d.name,
        onclick: () => ed.pick(d.id),
      });
      const t = thumb(d);
      b.append(t instanceof HTMLCanvasElement ? t.cloneNode() : t);
      const img = b.querySelector('canvas');
      if (img) img.getContext('2d').drawImage(t, 0, 0);
      b.append(h('span', { class: 'ed-item-name' }, d.name));
      return b;
    });
    const rot = h('span', { class: 'ed-rot', title: 'Rotation for new objects (R)' }, `↻ ${ed.rot}°`);
    this.statusEl = h('span', { class: 'ed-status', 'aria-live': 'off' });
    this.paletteEl.replaceChildren(h('div', { class: 'ed-pal-head' }, tabs, this.statusEl, rot), h('div', { class: 'ed-items' }, items));
    this.status();
  }

  buildProps() {
    const ed = this.ed;
    const sel = [...ed.selection].map((u) => ed.items.get(u)).filter(Boolean);
    this.props.hidden = !sel.length;
    if (!sel.length) { this.props.replaceChildren(); return; }
    const rows = [];
    const field = (label, input) => h('label', { class: 'ed-field' }, h('span', {}, label), input);
    const numIn = (label, value, apply, step = 0.5) => {
      const i = h('input', { type: 'number', step, value: Number(value.toFixed ? value.toFixed(3) : value) });
      i.addEventListener('change', () => ed.modify((it) => apply(it, num(i.value))));
      return field(label, i);
    };
    const selectIn = (label, opts, value, apply) => {
      const s = h('select', {}, opts.map(([v, n]) => h('option', { value: v, selected: String(v) === String(value) || null }, n)));
      s.addEventListener('change', () => ed.modify((it) => apply(it, s.value)));
      return field(label, s);
    };
    const prop = (it, k, v) => { it.p = { ...(it.p || {}), [k]: v }; };
    const one = sel.length === 1 ? sel[0] : null;
    const d = one ? getDef(one.t) : null;
    rows.push(h('h3', {}, one ? d.name : plural(sel.length, 'object')));
    if (one) {
      rows.push(numIn('X', one.x, (it, v) => { it.x = v; }), numIn('Y', one.y, (it, v) => { it.y = v; }));
      if (d.kind !== 'trigger') {
        rows.push(numIn('Rotation°', one.r || 0, (it, v) => { it.r = ((v % 360) + 360) % 360; }, d.kind === 'deco' || d.kind === 'spike' ? 15 : 90));
      }
    }
    if (!one || d.kind !== 'trigger') {
      rows.push(numIn('Group', one ? one.g : 0, (it, v) => { it.g = Math.max(0, Math.min(999, Math.round(v))); }, 1));
      rows.push(selectIn('Layer', LAYERS.slice(0, 3), (one && one.p && one.p.layer) || (d && d.layer) || 'M', (it, v) => prop(it, 'layer', v)));
      rows.push(numIn('Z order', (one && one.p && one.p.z) || 0, (it, v) => prop(it, 'z', Math.round(v)), 1));
    }
    if (one && d.kind === 'deco') {
      const c = h('input', { type: 'color', value: (one.p && one.p.color) || '#ff5ce1' });
      c.addEventListener('change', () => ed.modify((it) => prop(it, 'color', c.value)));
      rows.push(field('Colour', c));
      if (d.style === 'text') {
        const t = h('input', { type: 'text', value: (one.p && one.p.text) || '', maxlength: 60 });
        t.addEventListener('change', () => ed.modify((it) => prop(it, 'text', t.value)));
        rows.push(field('Text', t), numIn('Size', (one.p && one.p.size) || 30, (it, v) => prop(it, 'size', Math.max(10, Math.min(120, v))), 2));
      }
    }
    if (one && d.kind === 'saw') {
      const path = (one.p && one.p.path) || null;
      const setPath = (k) => (it, v) => { const pth = { dx: 0, dy: 2, period: 2, ...((it.p && it.p.path) || {}), [k]: v }; prop(it, 'path', pth); };
      rows.push(h('p', { class: 'muted' }, path ? 'Moves along a path' : 'Static — set a path to move it'));
      rows.push(numIn('Path dx', path ? path.dx || 0 : 0, setPath('dx')), numIn('Path dy', path ? path.dy || 0 : 0, setPath('dy')), numIn('Period (s)', path ? path.period || 2 : 2, setPath('period'), 0.1));
    }
    if (one && d.kind === 'portal' && d.action === 'mode' && MODES[d.value].corridor) {
      const cur = one.p && Number.isFinite(one.p.floor) ? one.p.floor : 'auto';
      const opts = [['auto', 'Auto'], ...Array.from({ length: 31 }, (_, i) => [i, `Floor at ${i}`])];
      rows.push(selectIn('Flight band', opts, cur, (it, v) => {
        if (v === 'auto') { if (it.p) { delete it.p.floor; if (!Object.keys(it.p).length) it.p = null; } } else prop(it, 'floor', Number(v));
      }));
      rows.push(h('p', { class: 'muted' }, `The ${d.value} flies in a ${MODES[d.value].corridor}-block band.`));
    }
    if (one && d.kind === 'trigger') rows.push(...this.triggerFields(one, d, prop, field, numIn));
    rows.push(h('div', { class: 'ed-actions' },
      this.btn('Rotate', () => ed.rotateSelection(1), { title: 'Rotate 90° (R)' }),
      this.btn('Flip H', () => ed.flipSelection('x'), { title: 'Flip horizontally (X)' }),
      this.btn('Flip V', () => ed.flipSelection('y'), { title: 'Flip vertically (Y)' }),
      this.btn('Copy', () => { ed.copySel(); this.flash('Copied'); }, { title: 'Ctrl+C' }),
      this.btn('Duplicate', () => ed.duplicate(), { title: 'Ctrl+D' }),
      this.btn('Delete', () => ed.deleteSelection(), { cls: 'danger', title: 'Delete' })));
    this.props.replaceChildren(...rows);
  }

  triggerFields(one, d, prop, field, numIn) {
    const ed = this.ed;
    const p = { ...d.props, ...(one.p || {}) };
    const out = [];
    for (const k of Object.keys(d.props)) {
      const v = p[k];
      if (k === 'channel') {
        const s = h('select', {}, CHANNELS.map((c) => h('option', { value: c, selected: c === v || null }, c)));
        s.addEventListener('change', () => ed.modify((it) => prop(it, k, s.value)));
        out.push(field('Channel', s));
      } else if (k === 'color') {
        const c = h('input', { type: 'color', value: v });
        c.addEventListener('change', () => ed.modify((it) => prop(it, k, c.value)));
        out.push(field('Colour', c));
      } else if (k === 'easing') {
        const s = h('select', {}, Object.keys(EASINGS).map((e) => h('option', { value: e, selected: e === v || null }, e)));
        s.addEventListener('change', () => ed.modify((it) => prop(it, k, s.value)));
        out.push(field('Easing', s));
      } else if (k === 'kind') {
        const s = h('select', {}, ['burst', 'confetti', 'sparks'].map((e) => h('option', { value: e, selected: e === v || null }, e)));
        s.addEventListener('change', () => ed.modify((it) => prop(it, k, s.value)));
        out.push(field('Particles', s));
      } else if (k === 'on') {
        const s = h('select', {}, [['true', 'Show'], ['false', 'Hide']].map(([a, n]) => h('option', { value: a, selected: String(v) === a || null }, n)));
        s.addEventListener('change', () => ed.modify((it) => prop(it, k, s.value === 'true')));
        out.push(field('Toggle to', s));
      } else {
        const step = k === 'group' || k === 'count' ? 1 : k === 'alpha' ? 0.1 : 0.05;
        out.push(numIn(k[0].toUpperCase() + k.slice(1), v, (it, x) => prop(it, k, k === 'group' || k === 'count' ? Math.max(0, Math.round(x)) : x), step));
      }
    }
    return out;
  }

  // ---- dialogs ----------------------------------------------------------------------------------
  async settings() {
    const ed = this.ed, m = structuredClone(ed.meta);
    const sel = (label, opts, value, set) => {
      const s = h('select', { 'aria-label': label }, opts.map(([v, n]) => h('option', { value: v, selected: String(v) === String(value) || null }, n)));
      s.addEventListener('change', () => set(s.value));
      return h('label', { class: 'ed-field' }, h('span', {}, label), s);
    };
    const inp = (label, type, value, set, attrs = {}) => {
      const i = h('input', { type, value, 'aria-label': label, ...attrs });
      i.addEventListener('change', () => set(type === 'number' ? num(i.value) : i.value));
      return h('label', { class: 'ed-field' }, h('span', {}, label), i);
    };
    const body = h('div', { class: 'ed-settings' },
      inp('Name', 'text', m.name, (v) => { m.name = v.slice(0, 40) || 'Untitled'; }, { maxlength: 40 }),
      inp('Creator', 'text', m.author, (v) => { m.author = v.slice(0, 30); }, { maxlength: 30 }),
      sel('Difficulty', Object.entries(DIFFICULTIES).map(([k, d]) => [k, d.name]), m.difficulty, (v) => { m.difficulty = v; }),
      sel('Music', LEVEL_SONGS.map((s) => [s, `${TRACKS[s].name} (${TRACKS[s].bpm} BPM)`]), m.song, (v) => { m.song = v; m.bpm = TRACKS[v].bpm; }),
      inp('BPM', 'number', m.bpm, (v) => { m.bpm = Math.min(300, Math.max(40, v)); }, { min: 40, max: 300 }),
      inp('Song offset (s)', 'number', m.offset, (v) => { m.offset = Math.max(0, v); }, { step: 0.05, min: 0 }),
      sel('Start mode', MODE_NAMES.map((n) => [n, n]), m.startMode, (v) => { m.startMode = v; }),
      sel('Start speed', SPEED_NAMES.map((n, i) => [i, n]), m.startSpeed, (v) => { m.startSpeed = Number(v); }),
      sel('Start gravity', [[1, 'Normal'], [-1, 'Flipped']], m.startGravity, (v) => { m.startGravity = Number(v); }),
      sel('Start size', [['false', 'Normal'], ['true', 'Mini']], String(!!m.startMini), (v) => { m.startMini = v === 'true'; }),
      sel('Background', BG_STYLES.map((s) => [s, s]), m.bg, (v) => { m.bg = v; }),
      sel('Ground', GROUND_STYLES.map((s) => [s, s]), m.ground, (v) => { m.ground = v; }),
      ...Object.keys(m.palette).map((ch) => inp(`Colour: ${ch}`, 'color', m.palette[ch], (v) => { m.palette[ch] = v; })));
    const ok = await this.app.ui.dialog('Level settings', body, [{ label: 'Cancel', value: () => false }, { label: 'Apply', value: () => true }]);
    if (ok) { ed.meta = m; ed.touch(); }
  }

  save() {
    const ed = this.ed;
    const level = ed.level();
    if (!level.objects.length) { this.app.ui.alert('Nothing to save', 'Place some objects first.'); return; }
    if (ed.levelId) level.meta.id = ed.levelId; else delete level.meta.id;
    ed.levelId = this.app.storage.saveCustom(level);
    ed.meta.id = ed.levelId;
    ed.dirty = false;
    this.app.storage.clearAutosave();
    this.app.storage.data.stats.levelsCreated++;
    this.app.achievements.unlock('create-level');
    this.flash('Saved');
    this.refresh();
  }

  async manage() {
    const ed = this.ed;
    const st = this.app.storage;
    const list = st.listCustom();
    const close = () => this.app.ui.closeModal();
    const rows = list.length ? list.map((c) => h('div', { class: 'ed-level-row' },
      h('span', {}, `${c.name} (${plural(c.objects, 'object')})`),
      this.btn('Load', async () => {
        if (ed.dirty && !(await this.confirmDiscard())) return;
        const lvl = st.loadCustom(c.id);
        if (lvl) { ed.reset(lvl); ed.levelId = c.id; close(); this.refresh(); }
      }, { cls: 'primary' }),
      this.btn('Rename', async () => { close(); const n = await this.app.ui.prompt('Rename level', c.name); if (n) { st.renameCustom(c.id, n); if (ed.levelId === c.id) ed.meta.name = n; this.refresh(); } }),
      this.btn('Delete', async () => { close(); if (await this.app.ui.confirm(`Delete "${c.name}"?`, 'Delete', true)) { st.deleteCustom(c.id); if (ed.levelId === c.id) ed.levelId = null; } }, { cls: 'danger' })))
      : [h('p', { class: 'muted' }, 'No saved levels yet.')];
    await this.app.ui.dialog('Your levels', h('div', { class: 'ed-levels' }, rows), [
      { label: 'New level', value: () => { this.newLevel(); return true; } },
      { label: 'Close', value: () => false },
    ]);
  }

  async confirmDiscard() { return this.app.ui.confirm('Discard unsaved changes?', 'Discard', true); }

  async newLevel() {
    if (this.ed.dirty && !(await this.confirmDiscard())) return;
    this.ed.reset();
    this.refresh();
  }

  exportFile() {
    const level = this.ed.level();
    const name = (level.meta.name || 'level').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'level';
    download(`${name}.neondash.json`, exportJSON(level));
    this.flash('Exported');
  }

  pickFile() {
    const f = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
    f.addEventListener('change', () => { if (f.files[0]) this.importFile(f.files[0]); f.remove(); });
    document.body.append(f);
    f.click();
  }

  async importFile(file) {
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('That file is too large to be a level.');
      const { level, warnings } = importJSON(await file.text());
      if (this.ed.dirty && !(await this.confirmDiscard())) return;
      this.ed.reset(level);
      this.ed.levelId = null;
      this.ed.dirty = true;
      this.app.achievements.unlock('import-level');
      this.refresh();
      this.app.ui.alert('Level imported', `"${level.meta.name}" loaded with ${level.objects.length} objects.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
    } catch (e) {
      this.app.ui.alert('Import failed', e.message);
    }
  }

  help() {
    const rows = [
      ['Click / drag', 'Place (Build), select or move (Select), erase (Erase)'],
      ['B · V · E', 'Build · Select · Erase tools'],
      ['1–0', 'Quick-pick block, spike, half, slab, slope, pad, orb, saw, coin, end wall'],
      ['R / Shift+R', 'Rotate selection (or the next object) 90°'],
      ['X · Y', 'Flip selection horizontally · vertically'],
      ['W A S D', 'Nudge selection one block (Shift: half a block)'],
      ['Shift+click · drag', 'Add to selection · box select'],
      ['Ctrl+C · V · D', 'Copy · paste at cursor · duplicate'],
      ['Ctrl+Z · Ctrl+Y', 'Undo · redo'],
      ['Delete', 'Delete selection'],
      ['G', 'Toggle grid snap'],
      ['Arrows · Space+drag · right-drag', 'Pan the view'],
      ['Wheel · + −', 'Zoom'],
      ['Enter · Shift+Enter', 'Playtest from the start · from the cursor'],
      ['Ctrl+S', 'Save'],
      ['Esc', 'Clear selection, then leave the editor'],
    ];
    const body = h('div', { class: 'ed-help' },
      h('table', {}, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))))),
      h('p', { class: 'muted' }, 'Levels autosave every 30 seconds. Drop a .json file anywhere on the editor to import it.'));
    this.app.ui.dialog('Editor shortcuts', body, [{ label: 'Close', value: () => true }]);
  }

  async showValidation() {
    const found = validate(this.ed.level());
    const body = found.length
      ? h('ul', { class: 'ed-issues' }, found.map((f) => h('li', { class: f.level }, h('b', {}, f.level === 'error' ? 'Error: ' : 'Warning: '), f.msg,
        f.x !== undefined ? this.btn('Go to', () => { this.ed.cam.x = f.x * BLOCK; this.app.ui.closeModal(); }) : null)))
      : h('p', {}, 'No problems found. Playtest it to be sure it is beatable!');
    await this.app.ui.dialog('Level check', body, [{ label: 'Close', value: () => true }]);
  }
}
