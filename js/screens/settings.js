/** Settings screen: audio, video, gameplay, controls (rebinding) and save data. */
import { h, ICONS } from '../ui.js';
import { DEFAULT_BINDINGS, ACTION_LABELS } from '../input.js';
import { DEFAULT_SETTINGS } from '../storage.js';

const TABS = [['audio', 'Audio'], ['video', 'Video'], ['gameplay', 'Gameplay'], ['controls', 'Controls'], ['data', 'Data']];

export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift' };
  return map[code] || code;
}

export function settingsScreen(app, opts = {}) {
  const ui = app.ui;
  const s = app.storage.settings;
  const tab = opts.tab || 'audio';
  const save = () => { app.applySettings(); app.storage.save(); };
  const set = (k) => (v) => { s[k] = v; save(); };
  const goTab = (t) => app.go('settings', { tab: t }, true);

  let body;
  switch (tab) {
    case 'video':
      body = [
        ui.select('Frame-rate cap', [{ value: 60, label: '60 FPS' }, { value: 120, label: '120 FPS' }, { value: 0, label: 'Unlimited (vsync)' }], s.fpsCap, (v) => set('fpsCap')(Number(v))),
        ui.toggle('Show FPS counter', s.showFps, set('showFps')),
        h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Fullscreen'), ui.button('Toggle', () => app.toggleFullscreen(), { icon: ICONS.fullscreen })),
        ui.select('Particle quality', [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }], s.particles, set('particles')),
        ui.select('Glow quality', [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }], s.glow, set('glow')),
        ui.toggle('Reduce flashing', s.reduceFlash, set('reduceFlash')),
        ui.select('Reduce motion', [{ value: 'auto', label: 'Follow system' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
          s.reduceMotion === null ? 'auto' : s.reduceMotion ? 'on' : 'off', (v) => set('reduceMotion')(v === 'auto' ? null : v === 'on')),
        ui.slider('Screen shake', s.shake, set('shake')),
        ui.toggle('Colour-blind safe palette', s.colorblind, set('colorblind'), { hint: 'Okabe–Ito colours for pads and orbs' }),
        ui.toggle('Large UI', s.largeUi, set('largeUi')),
        ui.toggle('Show hitboxes', s.hitboxes, set('hitboxes')),
      ];
      break;
    case 'gameplay':
      body = [
        ui.slider('Auto-restart delay', s.restartDelay, set('restartDelay'), { min: 0.2, max: 1, step: 0.05, format: (v) => `${v.toFixed(2)} s` }),
        ui.select('Practice auto-checkpoints', [{ value: 0, label: 'Off' }, { value: 2, label: 'Every 2 s' }, { value: 4, label: 'Every 4 s' }, { value: 6, label: 'Every 6 s' }], s.autoCheckpoint, (v) => set('autoCheckpoint')(Number(v))),
        ui.toggle('Unlock all levels', s.unlockAll, set('unlockAll'), { hint: 'Skip the unlock order' }),
        ui.select('Language', [{ value: 'en', label: 'English' }], s.language, set('language')),
      ];
      break;
    case 'controls':
      body = controls(app, save);
      break;
    case 'data':
      body = dataTab(app);
      break;
    default:
      body = [
        ui.slider('Master volume', s.master, set('master')),
        ui.slider('Music volume', s.music, set('music')),
        ui.slider('Sound effects volume', s.sfx, set('sfx')),
        ui.toggle('Mute (M)', s.muted, set('muted')),
      ];
  }
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, TABS.map(([id, name]) => h('button', {
    type: 'button', role: 'tab', class: `tab ${id === tab ? 'on' : ''}`, 'aria-selected': id === tab ? 'true' : 'false', onclick: () => goTab(id),
  }, name)));
  return h('section', { class: 'screen panel-screen settings-screen' },
    h('header', { class: 'screen-head' }, ui.button('Back', () => app.go('menu'), { icon: ICONS.back, sfx: 'back' }), h('h2', {}, 'Settings'), tabs),
    h('div', { class: 'panel settings-body', role: 'tabpanel', 'aria-label': tab }, body));
}

function controls(app, save) {
  const ui = app.ui;
  const s = app.storage.settings;
  const current = () => ({ ...structuredClone(DEFAULT_BINDINGS), ...(s.bindings || {}) });
  const rows = Object.keys(DEFAULT_BINDINGS).map((action) => {
    const keys = h('span', { class: 'keys' }, current()[action].map((c) => h('kbd', {}, keyName(c))));
    const btn = ui.button('Rebind', () => {
      btn.querySelector('.lbl').textContent = 'Press a key…';
      app.input.captureNextKey((code) => {
        if (code !== 'Escape' || action === 'pause') {
          const b = current();
          for (const k of Object.keys(b)) b[k] = b[k].filter((c) => c !== code || k === action);
          b[action] = [code];
          s.bindings = b;
          save();
        }
        app.go('settings', { tab: 'controls' }, true);
      });
    }, { aria: `Rebind ${ACTION_LABELS[action]}` });
    return h('div', { class: 'row' }, h('span', { class: 'row-label' }, ACTION_LABELS[action]), keys, btn);
  });
  rows.push(h('p', { class: 'muted' }, 'Mouse click, touch and gamepad face buttons (A/B/X/Y, RT) always jump. Start pauses.'));
  rows.push(h('div', { class: 'row' }, h('span', {}), ui.button('Reset to defaults', () => { s.bindings = null; save(); app.go('settings', { tab: 'controls' }, true); })));
  return rows;
}

function dataTab(app) {
  const ui = app.ui;
  const st = app.storage;
  const file = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', 'aria-label': 'Import save file' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      st.importJSON(await f.text());
      app.applySettings();
      await ui.alert('Save imported', 'Your progress was restored from the file.');
      app.go('settings', { tab: 'data' }, true);
    } catch (e) {
      ui.alert('Import failed', e.message);
    }
    file.value = '';
  });
  return [
    h('p', {}, st.persistent ? 'Progress is saved automatically in this browser.' : 'Storage is blocked in this browser mode — progress lasts only until you close the tab. Export your save to keep it.'),
    h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Export save'), ui.button('Download .json', () => download('neon-dash-save.json', st.exportJSON()))),
    h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Import save'), ui.button('Choose file…', () => file.click()), file),
    h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Reset all settings'), ui.button('Reset settings', async () => {
      if (await ui.confirm('Reset every setting to its default value?', 'Reset')) {
        st.data.settings = structuredClone(DEFAULT_SETTINGS);
        st.save();
        app.applySettings();
        app.go('settings', { tab: 'data' }, true);
      }
    })),
    h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Reset progress'), ui.button('Reset progress', async () => {
      if (await ui.confirm('Erase all progress, achievements, unlocks and custom levels? Settings are kept.', 'Erase everything', true)) {
        st.reset();
        app.applySettings();
        ui.toast('Progress reset', 'Starting fresh.', '↻');
      }
    }, { cls: 'danger' })),
  ];
}

/** Saves text as a file via a temporary object URL (no network involved). */
export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
