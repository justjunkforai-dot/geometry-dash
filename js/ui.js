/**
 * DOM UI core: element helper, layers (screen / hud / overlay / toasts), reusable controls,
 * spatial keyboard+gamepad navigation, UI sounds, modal dialogs and toasts.
 * Screens live in js/screens/*.js and are plain functions returning an element.
 */

/** Element builder: h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Text'). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'svg') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]';

export class UI {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.screen = h('div', { class: 'layer layer-screen' });
    this.hud = h('div', { class: 'layer layer-hud passthrough' });
    this.overlay = h('div', { class: 'layer layer-overlay' });
    this.modal = h('div', { class: 'layer layer-modal' });
    this.toasts = h('div', { class: 'layer toasts passthrough', 'aria-live': 'polite' });
    root.append(this.screen, this.hud, this.overlay, this.modal, this.toasts);
    this.lastHover = null;
    root.addEventListener('pointerover', (e) => {
      const b = e.target.closest && e.target.closest('button, [role="switch"], select, input[type=range]');
      if (b && b !== this.lastHover && !b.disabled) { this.lastHover = b; this.sfx('hover'); }
      if (!b) this.lastHover = null;
    });
    root.addEventListener('focusin', (e) => {
      if (e.target !== this.lastHover && this.keyboardNav) this.sfx('hover');
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && !b.disabled) this.sfx(b.dataset.sfx || 'click');
    });
    app.input.on('key', (e) => { if (!this.stateOwnsKeys()) this.onKey(e); });
    app.input.on('nav', (dir) => { if (this.stateOwnsKeys()) return; this.keyboardNav = true; this.move(dir); });
    app.input.on('confirm', () => {
      if (this.stateOwnsKeys()) return;
      const a = document.activeElement;
      if (a && this.root.contains(a) && a.click) a.click();
      else this.focusFirst();
    });
  }

  sfx(name) { if (this.app.audio) this.app.audio.sfx(name); }

  /** States like the editor handle arrows/Enter themselves unless a dialog is open. */
  stateOwnsKeys() { return !!(this.app.state && this.app.state.ownsKeys && !this.modal.childElementCount); }

  /** The layer that currently owns input (modal > overlay > screen). */
  activeLayer() {
    if (this.modal.childElementCount) return this.modal;
    if (this.overlay.childElementCount) return this.overlay;
    if (this.hud.querySelector(FOCUSABLE) && !this.screen.childElementCount) return this.hud;
    return this.screen;
  }

  showScreen(el) {
    this.screen.replaceChildren(el);
    this.focusFirst();
  }

  clearScreen() { this.screen.replaceChildren(); }
  showHud(el) { this.hud.replaceChildren(el); }
  clearHud() { this.hud.replaceChildren(); }

  showOverlay(el) {
    this.overlay.replaceChildren(el);
    this.focusFirst();
  }

  clearOverlay() { this.overlay.replaceChildren(); }

  clearAll() {
    this.screen.replaceChildren();
    this.hud.replaceChildren();
    this.overlay.replaceChildren();
    this.modal.replaceChildren();
  }

  focusables(layer = this.activeLayer()) {
    return [...layer.querySelectorAll(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === document.activeElement);
  }

  focusFirst() {
    const layer = this.activeLayer();
    const pref = layer.querySelector('[data-autofocus]');
    const el = pref || this.focusables(layer)[0];
    if (el) el.focus({ preventScroll: true });
  }

  onKey(e) {
    const a = document.activeElement;
    const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = dirs[e.code];
    if (!dir) {
      if (e.code === 'Tab') this.keyboardNav = true;
      return;
    }
    if (a && a.type === 'range' && (dir === 'left' || dir === 'right')) return;
    if (a && a.tagName === 'SELECT') return;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.type !== 'range' && a.type !== 'checkbox') return;
    if (this.app.state && this.app.state.onNav && this.app.state.onNav(dir)) { e.preventDefault(); return; }
    this.keyboardNav = true;
    e.preventDefault();
    this.move(dir);
  }

  /** Spatial navigation: focus the nearest control in the given direction. */
  move(dir) {
    const list = this.focusables();
    if (!list.length) return;
    const cur = document.activeElement;
    if (!list.includes(cur)) { list[0].focus({ preventScroll: true }); return; }
    const r0 = cur.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let along, across;
      if (dir === 'left') { along = -dx; across = Math.abs(dy); }
      else if (dir === 'right') { along = dx; across = Math.abs(dy); }
      else if (dir === 'up') { along = -dy; across = Math.abs(dx); }
      else { along = dy; across = Math.abs(dx); }
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) best.focus({ preventScroll: true });
  }

  // ---- controls ------------------------------------------------------------------------------
  button(label, onClick, opts = {}) {
    return h('button', {
      type: 'button', class: `btn ${opts.cls || ''}`, onclick: onClick, 'aria-label': opts.aria || null,
      'data-sfx': opts.sfx || null, 'data-autofocus': opts.autofocus || null, title: opts.title || null,
      disabled: opts.disabled || null,
    }, opts.icon ? h('span', { class: 'ico', 'aria-hidden': 'true', svg: opts.icon }) : null, label ? h('span', { class: 'lbl' }, label) : null);
  }

  slider(label, value, onInput, opts = {}) {
    const min = opts.min ?? 0, max = opts.max ?? 1, step = opts.step ?? 0.01;
    const fmt = opts.format || ((v) => `${Math.round(v * 100)}%`);
    const out = h('output', {}, fmt(value));
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
    input.addEventListener('input', () => { const v = Number(input.value); out.textContent = fmt(v); onInput(v); });
    return h('label', { class: 'row slider' }, h('span', { class: 'row-label' }, label), input, out);
  }

  toggle(label, checked, onChange, opts = {}) {
    const b = h('button', { type: 'button', role: 'switch', class: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-label': label });
    b.append(h('span', { class: 'knob', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', v ? 'true' : 'false');
      onChange(v);
    });
    return h('div', { class: 'row' }, h('span', { class: 'row-label' }, label, opts.hint ? h('small', {}, opts.hint) : null), b);
  }

  select(label, options, value, onChange) {
    const s = h('select', { 'aria-label': label }, options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) || null }, o.label)));
    s.addEventListener('change', () => onChange(s.value));
    return h('label', { class: 'row' }, h('span', { class: 'row-label' }, label), s);
  }

  // ---- dialogs & toasts ----------------------------------------------------------------------
  dialog(title, body, actions) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const close = (v) => { this.modal.replaceChildren(); if (prev && prev.focus) prev.focus({ preventScroll: true }); resolve(v); };
      const box = h('div', { class: 'dialog panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', {}, title), body,
        h('div', { class: 'dialog-actions' }, actions.map((a, i) => this.button(a.label, () => close(a.value()), { cls: a.cls || (i === actions.length - 1 ? 'primary' : ''), autofocus: a.autofocus }))));
      this.modal.replaceChildren(h('div', { class: 'scrim' }, box));
      this.modalClose = () => close(actions[0].value());
      this.focusFirst();
    });
  }

  confirm(message, ok = 'OK', danger = false) {
    return this.dialog('Are you sure?', h('p', {}, message), [
      { label: 'Cancel', value: () => false, autofocus: true },
      { label: ok, value: () => true, cls: danger ? 'danger' : 'primary' },
    ]);
  }

  alert(title, message) {
    return this.dialog(title, h('p', {}, message), [{ label: 'OK', value: () => true, autofocus: true }]);
  }

  prompt(title, value = '', maxLength = 40) {
    const input = h('input', { type: 'text', value, maxlength: maxLength, 'aria-label': title, 'data-autofocus': true });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.modal.querySelector('.dialog-actions .primary').click(); } });
    return this.dialog(title, input, [
      { label: 'Cancel', value: () => null },
      { label: 'OK', value: () => input.value.trim() || null },
    ]);
  }

  /** Esc closes the open modal (if any); returns true when handled. */
  closeModal() {
    if (!this.modal.childElementCount) return false;
    if (this.modalClose) this.modalClose();
    return true;
  }

  toast(title, text, icon = '★') {
    const el = h('div', { class: 'toast', role: 'status' }, h('div', { class: 'toast-icon', 'aria-hidden': 'true' }, icon), h('div', {}, h('strong', {}, title), h('div', {}, text)));
    this.toasts.append(el);
    el.addEventListener('animationend', (e) => { if (e.animationName === 'toast-out') el.remove(); });
    while (this.toasts.childElementCount > 4) this.toasts.firstChild.remove();
  }
}

/** "1 object" / "3 objects". */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---- inline SVG icons (24×24 viewBox) ----------------------------------------------------------
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="100%" height="100%" ${extra}><path d="${d}" fill="currentColor"/></svg>`;
export const ICONS = {
  play: svg('M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z'),
  pause: svg('M6 4h4v16H6zM14 4h4v16h-4z'),
  build: svg('M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'),
  palette: svg('M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01a1.5 1.5 0 0 1 1.12-2.49H16a5 5 0 0 0 5-5C21 6.58 16.97 3 12 3zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z'),
  trophy: svg('M19 5h-2V3H7v2H5a2 2 0 0 0-2 2v1a5 5 0 0 0 4.4 4.96A5 5 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5 5 0 0 0 3.6-2.94A5 5 0 0 0 21 8V7a2 2 0 0 0-2-2zM5 8V7h2v3.82A3 3 0 0 1 5 8zm14 0a3 3 0 0 1-2 2.82V7h2v1z'),
  gear: svg('M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z'),
  info: svg('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'),
  back: svg('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'),
  left: svg('M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z'),
  right: svg('M8.6 16.6L10 18l6-6-6-6-1.4 1.4 4.6 4.6z'),
  restart: svg('M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'),
  home: svg('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
  next: svg('M6 18l8.5-6L6 6v12zm9-12v12h2V6h-2z'),
  lock: svg('M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z'),
  flag: svg('M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z'),
  diamond: svg('M12 2l-8 10 8 10 8-10z'),
  trash: svg('M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
  edit: svg('M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25z'),
  star: svg('M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'),
  undo: svg('M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 12.5 10c3.54 0 6.55 2.31 7.6 5.5l2.37-.78A10.02 10.02 0 0 0 12.5 8z'),
  redo: svg('M18.4 10.6A10.02 10.02 0 0 0 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8 8 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z'),
  save: svg('M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z'),
  folder: svg('M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z'),
  download: svg('M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z'),
  upload: svg('M5 20h14v-2H5v2zm4-4h6v-6h4l-7-7-7 7h4v6z'),
  check: svg('M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'),
  cursor: svg('M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5z'),
  grid: svg('M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z'),
  coin: svg('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l1.9 3.9 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6z'),
  fullscreen: svg('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
};

/** Difficulty face as inline SVG (distinct shapes per difficulty, not colour alone). */
export function faceSVG(diff, color) {
  const mouth = {
    easy: '<path d="M8 14.5q4 4 8 0" stroke="#111" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    normal: '<path d="M8.5 15.5h7" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>',
    hard: '<path d="M8 16.5q4-3 8 0" stroke="#111" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    harder: '<path d="M8 17q4-4 8 0" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6.5 8l4 1.6M17.5 8l-4 1.6" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>',
    insane: '<path d="M7.5 16.5h9l-1.5 2h-6z" fill="#111"/><path d="M6.5 7.5l4.5 2M17.5 7.5l-4.5 2" stroke="#111" stroke-width="2" stroke-linecap="round"/>',
    demon: '<path d="M7 15.5l1.5 2 1.5-1.5 2 2 2-2 1.5 1.5 1.5-2" stroke="#111" stroke-width="1.6" fill="none"/><path d="M6.5 8l4.5 2M17.5 8l-4.5 2" stroke="#111" stroke-width="2" stroke-linecap="round"/>',
  }[diff] || '';
  const horns = diff === 'insane' || diff === 'demon' ? `<path d="M4.5 6L3 1.5 7.5 4.5zM19.5 6L21 1.5 16.5 4.5z" fill="${color}" stroke="#111" stroke-width="1"/>` : '';
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">${horns}<circle cx="12" cy="12.5" r="9.5" fill="${color}" stroke="#111" stroke-width="1.6"/><circle cx="9" cy="11" r="1.4" fill="#111"/><circle cx="15" cy="11" r="1.4" fill="#111"/>${mouth}</svg>`;
}
