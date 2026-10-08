/**
 * Level editor state: items, selection, tools, undo/redo (diff commands), camera, input,
 * autosave + crash recovery and playtesting. DOM panels live in editor-ui.js, overlays and
 * thumbnails in editor-view.js, serialization/validation in editor-io.js.
 */
import { BLOCK, CAMERA_SCALE, VIEW_W, VIEW_H } from './config.js';
import { getDef, T } from './objects.js';
import { World, DEFAULT_META } from './level.js';
import { hexToRgb } from './triggers.js';
import { levelToItems, itemsToLevel, nextUid, computeStart } from './editor-io.js';
import { drawEditorOverlay } from './editor-view.js';
import { EditorUI } from './editor-ui.js';

const UNDO_LIMIT = 200;
const AUTOSAVE_EVERY = 30;
const copy = (i) => ({ ...i, p: i.p ? structuredClone(i.p) : null });
const QUICK = ['block', 'spike', 'half', 'slab', 'slope', 'padYellow', 'orbYellow', 'sawM', 'coin', 'end'];

export class Editor {
  constructor(app) {
    this.app = app;
    this.ui = new EditorUI(this);
    this.reset();
  }

  reset(level = null) {
    const { meta, items } = levelToItems(level || { meta: { ...structuredClone(DEFAULT_META), name: 'My Level', id: '' }, objects: [], triggers: [] });
    this.meta = meta;
    this.items = new Map(items.map((i) => [i.uid, i]));
    this.selection = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.tool = 'build';
    this.current = T('block');
    this.rot = 0;
    this.snap = true;
    this.layer = 'M';
    this.levelId = meta.id && String(meta.id).startsWith('u-') ? meta.id : null;
    this.dirty = false;
    this.version = 1;
    this.worldVersion = 0;
    // Start line near the left edge and the ground just above the palette.
    this.cam = { x: 10 * BLOCK, y: 3 * BLOCK, zoom: 0.8 };
    this.cursor = { x: 0, y: 0, inside: false };
    this.autosaveT = 0;
    this.clipboard = [];
    this.palette = { r: [0, 0, 0] };
  }

  // ---- state lifecycle ------------------------------------------------------------------------
  enter(data = {}) {
    const app = this.app;
    if (data.id) {
      const lvl = app.storage.loadCustom(data.id);
      if (lvl) this.reset(lvl);
    } else if (!data.resume && !this.started) {
      this.reset();
      this.recover = true;
    }
    this.started = true;
    app.input.setGameplay(false);
    app.audio.playMusic('editor', 0);
    this.attach();
    this.ui.mount();
    if (this.recover) { this.recover = false; this.offerRecovery(); }
  }

  exit() {
    this.detach();
    this.ui.unmount();
  }

  async offerRecovery() {
    const auto = this.app.storage.loadAutosave();
    if (!auto || !auto.dirty) return;
    const when = new Date(auto.time).toLocaleString();
    const ok = await this.app.ui.dialog('Recover unsaved level?', this.ui.text(`"${auto.level.meta.name}" has unsaved changes from ${when}.`), [
      { label: 'Discard', value: () => false },
      { label: 'Recover', value: () => true, autofocus: true },
    ]);
    if (ok) {
      this.reset(auto.level);
      this.levelId = auto.id || null;
      this.dirty = true;
      this.ui.refresh();
    } else this.app.storage.clearAutosave();
  }

  // ---- model ----------------------------------------------------------------------------------
  list() { return [...this.items.values()]; }
  level() { return itemsToLevel({ ...this.meta, id: this.levelId || 'editor' }, this.list()); }

  touch() {
    this.version++;
    this.dirty = true;
    this.ui.refresh();
  }

  /** Applies a diff command and records it for undo. */
  commit(cmd) {
    if (!cmd.removed.length && !cmd.added.length) return;
    this.apply(cmd, false);
    this.undoStack.push(cmd);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  apply(cmd, inverse) {
    const rem = inverse ? cmd.added : cmd.removed;
    const add = inverse ? cmd.removed : cmd.added;
    for (const i of rem) { this.items.delete(i.uid); }
    for (const i of add) this.items.set(i.uid, copy(i));
    for (const uid of [...this.selection]) if (!this.items.has(uid)) this.selection.delete(uid);
    this.touch();
  }

  undo() { const c = this.undoStack.pop(); if (c) { this.apply(c, true); this.redoStack.push(c); } }
  redo() { const c = this.redoStack.pop(); if (c) { this.apply(c, false); this.undoStack.push(c); } }

  /** Modifies selected items through `fn(item)` as one undoable step. */
  modify(fn, uids = this.selection) {
    const removed = [], added = [];
    for (const uid of uids) {
      const it = this.items.get(uid);
      if (!it) continue;
      removed.push(copy(it));
      const n = copy(it);
      fn(n);
      added.push(n);
    }
    this.commit({ removed, added });
  }

  footprint(i) {
    const d = getDef(i.t);
    const q = ((i.r % 180) + 180) % 180 === 90;
    return { w: q ? d.h : d.w, h: q ? d.w : d.h };
  }

  /** Snapped centre for an item of def `d` under the world point (blocks). */
  snapPos(d, bx, by, rot = 0) {
    const q = ((rot % 180) + 180) % 180 === 90;
    const w = q ? d.h : d.w, h = q ? d.w : d.h;
    // Nothing goes below the ground line, where it could never be seen or reached.
    if (!this.snap) return { x: Math.round(bx * 10) / 10, y: Math.max(h / 2, Math.round(by * 10) / 10) };
    return { x: Math.floor(bx - w / 2 + 0.5) + w / 2, y: Math.max(h / 2, Math.floor(by - h / 2 + 0.5) + h / 2) };
  }

  place(bx, by) {
    const d = getDef(this.current);
    const pos = this.snapPos(d, bx, by, this.rot);
    for (const i of this.items.values()) if (i.t === d.id && Math.abs(i.x - pos.x) < 0.01 && Math.abs(i.y - pos.y) < 0.01) return;
    const p = d.kind === 'trigger' ? structuredClone(d.props) : d.kind === 'deco' && this.layer !== 'M' ? { layer: this.layer } : d.props ? structuredClone(d.props) : null;
    const it = { uid: nextUid(), t: d.id, x: pos.x, y: pos.y, r: d.kind === 'trigger' ? 0 : this.rot, fx: false, fy: false, g: 0, p };
    this.commit({ removed: [], added: [it] });
    if (this.app.audio) this.app.audio.sfx('click');
  }

  /** Topmost item whose footprint contains the point (blocks). */
  hit(bx, by) {
    let best = null;
    for (const i of this.items.values()) {
      if (!this.visibleLayer(i)) continue;
      const f = this.footprint(i);
      if (Math.abs(bx - i.x) <= f.w / 2 && Math.abs(by - i.y) <= f.h / 2) best = i;
    }
    return best;
  }

  visibleLayer(i) {
    if (this.layer === 'all') return true;
    const d = getDef(i.t);
    const layer = (i.p && i.p.layer) || d.layer;
    return d.kind === 'trigger' || layer === this.layer || (this.layer === 'M' && layer === 'T');
  }

  deleteSelection() {
    const removed = [...this.selection].map((u) => this.items.get(u)).filter(Boolean).map(copy);
    this.commit({ removed, added: [] });
    this.selection.clear();
  }

  selectionCenter() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const u of this.selection) {
      const i = this.items.get(u);
      x0 = Math.min(x0, i.x); x1 = Math.max(x1, i.x); y0 = Math.min(y0, i.y); y1 = Math.max(y1, i.y);
    }
    return { x: Math.round((x0 + x1)) / 2, y: Math.round((y0 + y1)) / 2 };
  }

  /** Rotates the selection by ±90° around its centre (positions and object rotation). */
  rotateSelection(dir) {
    if (!this.selection.size) { this.rot = (this.rot + 90 * dir + 360) % 360; this.ui.refresh(); return; }
    const c = this.selectionCenter();
    this.modify((i) => {
      const dx = i.x - c.x, dy = i.y - c.y;
      i.x = c.x + dy * dir; i.y = c.y - dx * dir;
      if (getDef(i.t).kind !== 'trigger') i.r = (((i.r || 0) + 90 * dir) % 360 + 360) % 360;
    });
  }

  flipSelection(axis) {
    const c = this.selectionCenter();
    this.modify((i) => {
      if (axis === 'x') { i.x = 2 * c.x - i.x; i.fx = !i.fx; } else { i.y = 2 * c.y - i.y; i.fy = !i.fy; }
    });
  }

  nudge(dx, dy) { this.modify((i) => { i.x += dx; i.y += dy; }); }

  copySel() { this.clipboard = [...this.selection].map((u) => copy(this.items.get(u))); }

  /** Pastes the clipboard with its bounding box anchored at the cursor (or offset). */
  paste(at = null) {
    if (!this.clipboard.length) return;
    const x0 = Math.min(...this.clipboard.map((i) => i.x));
    const y0 = Math.min(...this.clipboard.map((i) => i.y));
    // Keep the clipboard's sub-block alignment so pasted structures stay on the grid.
    const fx = x0 - Math.floor(x0), fy = y0 - Math.floor(y0);
    const ax = at ? Math.floor(at.x) + fx : x0 + 2, ay = at ? Math.max(0, Math.floor(at.y)) + fy : y0;
    const added = this.clipboard.map((i) => ({ ...copy(i), uid: nextUid(), x: i.x - x0 + ax, y: i.y - y0 + ay }));
    this.commit({ removed: [], added });
    this.selection = new Set(added.map((i) => i.uid));
    this.ui.refresh();
  }

  duplicate() {
    if (!this.selection.size) return;
    this.copySel();
    const xs = this.clipboard.map((i) => i.x);
    const w = Math.ceil(Math.max(...xs) - Math.min(...xs)) + 1;
    const added = this.clipboard.map((i) => ({ ...copy(i), uid: nextUid(), x: i.x + w }));
    this.commit({ removed: [], added });
    this.selection = new Set(added.map((i) => i.uid));
    this.ui.refresh();
  }

  // ---- rendering ------------------------------------------------------------------------------
  update(now, dt) {
    if (this.dirty) {
      this.autosaveT += dt;
      if (this.autosaveT >= AUTOSAVE_EVERY) {
        this.autosaveT = 0;
        this.app.storage.saveAutosave({ time: Date.now(), id: this.levelId, level: this.level(), dirty: true });
        this.ui.flash('Autosaved');
      }
    }
    this.time = (this.time || 0) + dt;
  }

  world() {
    // Rebuilding the runtime world is cheap for typical sizes; throttle it for huge levels.
    const now = performance.now();
    if (this.worldVersion !== this.version && (!this.worldObj || this.items.size < 4000 || now - (this.worldAt || 0) > 150)) {
      this.worldObj = new World(this.level());
      this.worldVersion = this.version;
      this.worldAt = now;
      const pal = this.meta.palette;
      this.colors = { bg: hexToRgb(pal.bg), ground: hexToRgb(pal.ground), line: hexToRgb(pal.line), obj: hexToRgb(pal.obj), deco: hexToRgb(pal.deco) };
    }
    return this.worldObj;
  }

  render() {
    const r = this.app.renderer;
    const world = this.world();
    if (!this.scene) this.scene = { cam: { x: 0, y: 0, zoom: 1, mirror: 1 }, players: null, hooks: { under: null, over: (rr) => drawEditorOverlay(this, rr) }, editor: true };
    const sc = this.scene;
    sc.world = world; sc.colors = this.colors; sc.bg = this.meta.bg; sc.ground = this.meta.ground;
    sc.corridor = null; sc.time = this.time || 0; sc.dt = 0.016; sc.pulse = 0; sc.coins = null; sc.particles = null;
    sc.icon = this.app.iconStyle; sc.snapBands = true;
    sc.cam.x = this.cam.x; sc.cam.y = this.cam.y; sc.cam.zoom = this.cam.zoom;
    r.drawScene(sc);
  }

  // ---- input ----------------------------------------------------------------------------------
  attach() {
    const stage = document.getElementById('stage');
    this.stage = stage;
    this.h = {
      down: (e) => this.onDown(e), move: (e) => this.onMove(e), up: (e) => this.onUp(e),
      wheel: (e) => this.onWheel(e), key: (e) => this.onKey(e), keyup: (e) => { if (e.code === 'Space') this.spaceHeld = false; },
      ctx: (e) => { if (e.target === this.app.renderer.canvas) e.preventDefault(); },
      drop: (e) => this.onDrop(e), over: (e) => e.preventDefault(),
    };
    stage.addEventListener('pointerdown', this.h.down);
    window.addEventListener('pointermove', this.h.move);
    window.addEventListener('pointerup', this.h.up);
    stage.addEventListener('wheel', this.h.wheel, { passive: false });
    window.addEventListener('keydown', this.h.key);
    window.addEventListener('keyup', this.h.keyup);
    stage.addEventListener('contextmenu', this.h.ctx);
    stage.addEventListener('drop', this.h.drop);
    stage.addEventListener('dragover', this.h.over);
  }

  detach() {
    const s = this.stage;
    if (!s) return;
    s.removeEventListener('pointerdown', this.h.down);
    window.removeEventListener('pointermove', this.h.move);
    window.removeEventListener('pointerup', this.h.up);
    s.removeEventListener('wheel', this.h.wheel);
    window.removeEventListener('keydown', this.h.key);
    window.removeEventListener('keyup', this.h.keyup);
    s.removeEventListener('contextmenu', this.h.ctx);
    s.removeEventListener('drop', this.h.drop);
    s.removeEventListener('dragover', this.h.over);
    this.stage = null;
  }

  /** Client coordinates → world blocks (and logical screen px). */
  toWorld(e) {
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) * VIEW_W) / rect.width;
    const ly = ((e.clientY - rect.top) * VIEW_H) / rect.height;
    const s = CAMERA_SCALE * this.cam.zoom;
    return { x: (this.cam.x + (lx - VIEW_W / 2) / s) / BLOCK, y: (this.cam.y - (ly - VIEW_H / 2) / s) / BLOCK, lx, ly };
  }

  onDown(e) {
    if (e.target !== this.app.renderer.canvas || this.app.ui.modal.childElementCount) return;
    const w = this.toWorld(e);
    this.cursor = { x: w.x, y: w.y, inside: true };
    if (e.button === 1 || e.button === 2 || this.spaceHeld) {
      this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y };
      e.preventDefault();
      return;
    }
    if (this.tool === 'build') { this.place(w.x, w.y); this.drag = { kind: 'paint' }; return; }
    if (this.tool === 'delete') { this.eraseAt(w); this.drag = { kind: 'erase' }; return; }
    const hit = this.hit(w.x, w.y);
    if (hit) {
      if (e.shiftKey) { if (this.selection.has(hit.uid)) this.selection.delete(hit.uid); else this.selection.add(hit.uid); this.ui.refresh(); return; }
      if (!this.selection.has(hit.uid)) { this.selection = new Set([hit.uid]); this.ui.refresh(); }
      this.drag = { kind: 'move', sx: w.x, sy: w.y, orig: [...this.selection].map((u) => copy(this.items.get(u))), moved: false };
    } else {
      if (!e.shiftKey) this.selection.clear();
      this.drag = { kind: 'box', x0: w.x, y0: w.y, x1: w.x, y1: w.y, add: e.shiftKey };
      this.ui.refresh();
    }
  }

  onMove(e) {
    if (!this.stage) return;
    const w = this.toWorld(e);
    const r = this.app.renderer.canvas.getBoundingClientRect();
    this.cursor = { x: w.x, y: w.y, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    this.ui.status();
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pan') {
      const s = (CAMERA_SCALE * this.cam.zoom * r.width) / VIEW_W;
      this.cam.x = d.cx - (e.clientX - d.sx) / s;
      this.cam.y = d.cy + (e.clientY - d.sy) / s;
    } else if (d.kind === 'paint') this.place(w.x, w.y);
    else if (d.kind === 'erase') this.eraseAt(w);
    else if (d.kind === 'box') { d.x1 = w.x; d.y1 = w.y; }
    else if (d.kind === 'move') {
      let dx = w.x - d.sx, dy = w.y - d.sy;
      if (this.snap) { dx = Math.round(dx); dy = Math.round(dy); } else { dx = Math.round(dx * 10) / 10; dy = Math.round(dy * 10) / 10; }
      for (const o of d.orig) { const it = this.items.get(o.uid); it.x = o.x + dx; it.y = o.y + dy; }
      d.moved = d.moved || dx !== 0 || dy !== 0;
      this.version++;
    }
  }

  onUp() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'box') {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      for (const i of this.items.values()) if (this.visibleLayer(i) && i.x >= x0 && i.x <= x1 && i.y >= y0 && i.y <= y1) this.selection.add(i.uid);
      this.ui.refresh();
    } else if (d.kind === 'move' && d.moved) {
      const added = d.orig.map((o) => copy(this.items.get(o.uid)));
      for (const o of d.orig) this.items.set(o.uid, copy(o));
      this.commit({ removed: d.orig, added });
    }
  }

  eraseAt(w) {
    const hit = this.hit(w.x, w.y);
    if (hit) { this.commit({ removed: [copy(hit)], added: [] }); this.selection.delete(hit.uid); }
  }

  onWheel(e) {
    if (e.target !== this.app.renderer.canvas) return;
    e.preventDefault();
    const before = this.toWorld(e);
    this.setZoom(this.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    const after = this.toWorld(e);
    this.cam.x += (before.x - after.x) * BLOCK;
    this.cam.y += (before.y - after.y) * BLOCK;
  }

  setZoom(z) { this.cam.zoom = Math.min(2.5, Math.max(0.25, z)); this.ui.status(); }

  onKey(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || this.app.ui.modal.childElementCount) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.code;
    const panStep = (e.shiftKey ? 8 : 2) * BLOCK / this.cam.zoom;
    let handled = true;
    if (ctrl && k === 'KeyZ') { if (e.shiftKey) this.redo(); else this.undo(); }
    else if (ctrl && k === 'KeyY') this.redo();
    else if (ctrl && k === 'KeyC') this.copySel();
    else if (ctrl && k === 'KeyV') this.paste(this.cursor.inside ? this.cursor : null);
    else if (ctrl && k === 'KeyD') this.duplicate();
    else if (ctrl && k === 'KeyA') { this.selection = new Set([...this.items.values()].filter((i) => this.visibleLayer(i)).map((i) => i.uid)); this.ui.refresh(); }
    else if (ctrl && k === 'KeyS') this.ui.save();
    else if (ctrl) handled = false;
    else if (k === 'Space') this.spaceHeld = true;
    else if (k === 'Delete' || k === 'Backspace') this.deleteSelection();
    else if (k === 'KeyR') this.rotateSelection(e.shiftKey ? -1 : 1);
    else if (k === 'KeyX' && this.selection.size) this.flipSelection('x');
    else if (k === 'KeyY' && this.selection.size) this.flipSelection('y');
    else if (k === 'KeyG') { this.snap = !this.snap; this.ui.refresh(); }
    else if (k === 'KeyB') this.setTool('build');
    else if (k === 'KeyV') this.setTool('select');
    else if (k === 'KeyE') this.setTool('delete');
    else if (k === 'ArrowLeft') this.cam.x -= panStep;
    else if (k === 'ArrowRight') this.cam.x += panStep;
    else if (k === 'ArrowUp') this.cam.y += panStep;
    else if (k === 'ArrowDown') this.cam.y -= panStep;
    else if ((k === 'KeyW' || k === 'KeyA' || k === 'KeyS' || k === 'KeyD') && this.selection.size) {
      const s = e.shiftKey ? 0.5 : 1;
      this.nudge(k === 'KeyA' ? -s : k === 'KeyD' ? s : 0, k === 'KeyW' ? s : k === 'KeyS' ? -s : 0);
    } else if (k === 'Equal' || k === 'NumpadAdd') this.setZoom(this.cam.zoom * 1.15);
    else if (k === 'Minus' || k === 'NumpadSubtract') this.setZoom(this.cam.zoom / 1.15);
    else if (k === 'Enter') this.playtest(e.shiftKey);
    else if (/^Digit[0-9]$/.test(k)) { this.pick(T(QUICK[(Number(k.slice(5)) + 9) % 10])); }
    else handled = false;
    if (handled) e.preventDefault();
  }

  setTool(t) { this.tool = t; this.ui.refresh(); }

  pick(id) {
    this.current = id;
    this.setTool('build');
  }

  /** Esc: drop the selection first, then leave the editor (confirming unsaved changes). */
  onBack() {
    if (this.selection.size) { this.selection.clear(); this.ui.refresh(); return true; }
    this.leave();
    return true;
  }

  async leave() {
    if (this.dirty) {
      const ok = await this.app.ui.confirm('Leave the editor? Unsaved changes stay in the autosave slot.', 'Leave');
      if (!ok) return;
      this.app.storage.saveAutosave({ time: Date.now(), id: this.levelId, level: this.level(), dirty: true });
    }
    this.started = false;
    this.app.go('menu');
  }

  async onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) this.ui.importFile(f);
  }

  playtest(fromCursor) {
    const level = this.level();
    const x = fromCursor ? (this.cursor.inside ? this.cursor.x : this.cam.x / BLOCK) : 0;
    const start = fromCursor && x > 1 ? computeStart(level, x) : null;
    this.app.go('play', { entry: { id: this.levelId || 'editor-test', data: level, custom: true }, playtest: true, start });
  }
}
