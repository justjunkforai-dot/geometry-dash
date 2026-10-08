/**
 * Versioned save data in localStorage with migrations. Every access is wrapped in try/catch:
 * when storage is blocked (private mode, sandboxed iframes) the game keeps working in memory
 * and `storage.persistent` is false so the UI can say so.
 *
 * Custom levels are stored under their own keys so saving progress never rewrites them.
 */
import { STORAGE_KEY, SAVE_VERSION } from './config.js';

export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.7, sfx: 0.8, muted: false,
  fpsCap: 0, showFps: false, particles: 'high', glow: 'high', reduceFlash: false, shake: 1,
  hitboxes: false, restartDelay: 0.4, autoCheckpoint: 0, colorblind: false, largeUi: false,
  unlockAll: false, language: 'en', bindings: null, reduceMotion: null,
};

export const DEFAULT_PROFILE = {
  icons: { cube: 0, ship: 0, ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, swing: 0 },
  p1: 0, p2: 1, glowColor: 2, glow: true, trail: 'none',
};

function freshSave() {
  return {
    version: SAVE_VERSION,
    levels: {},
    stats: { attempts: 0, jumps: 0, playTime: 0, holdTime: 0, deaths: 0, completions: 0, levelsCreated: 0 },
    orbs: 0,
    diamonds: 0,
    achievements: {},
    profile: structuredClone(DEFAULT_PROFILE),
    settings: structuredClone(DEFAULT_SETTINGS),
    customIndex: [],
  };
}

/**
 * Migrations: each entry upgrades a save from version `from` to `from + 1`.
 * v1 stored `best` as the only per-level field and settings at the top level.
 */
const MIGRATIONS = {
  1: (s) => {
    const out = freshSave();
    out.version = 2;
    for (const [id, l] of Object.entries(s.levels || {})) {
      out.levels[id] = { ...emptyLevel(), best: l.best || 0, attempts: l.attempts || 0, completed: (l.best || 0) >= 100, coins: l.coins || [false, false, false] };
    }
    if (s.volume !== undefined) out.settings.master = s.volume;
    out.stats.attempts = s.attempts || 0;
    return out;
  },
};

export function emptyLevel() {
  return { attempts: 0, jumps: 0, time: 0, best: 0, bestPractice: 0, completed: false, completions: 0, coins: [false, false, false] };
}

export function migrate(raw) {
  let s = raw && typeof raw === 'object' ? raw : null;
  if (!s) return freshSave();
  let v = s.version || 1;
  while (v < SAVE_VERSION) {
    if (!MIGRATIONS[v]) return freshSave();
    s = MIGRATIONS[v](s);
    v = s.version;
  }
  // Fill any fields added since (defensive merge, keeps unknown keys out).
  const base = freshSave();
  return {
    ...base,
    ...s,
    stats: { ...base.stats, ...(s.stats || {}) },
    profile: { ...base.profile, ...(s.profile || {}), icons: { ...base.profile.icons, ...((s.profile && s.profile.icons) || {}) } },
    settings: { ...base.settings, ...(s.settings || {}) },
    levels: s.levels || {},
    achievements: s.achievements || {},
    customIndex: Array.isArray(s.customIndex) ? s.customIndex : [],
  };
}

export class Storage {
  constructor(backend = null) {
    this.backend = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.persistent = true;
    this.mem = new Map();
    this.data = this.load();
  }

  read(key) {
    try { return this.backend ? this.backend.getItem(key) : this.mem.get(key) ?? null; } catch { this.persistent = false; return this.mem.get(key) ?? null; }
  }

  write(key, value) {
    this.mem.set(key, value);
    try { if (this.backend) this.backend.setItem(key, value); } catch { this.persistent = false; }
  }

  remove(key) {
    this.mem.delete(key);
    try { if (this.backend) this.backend.removeItem(key); } catch { this.persistent = false; }
  }

  load() {
    const raw = this.read(STORAGE_KEY);
    if (!raw) return freshSave();
    try { return migrate(JSON.parse(raw)); } catch { return freshSave(); }
  }

  save() { this.write(STORAGE_KEY, JSON.stringify(this.data)); }

  level(id) {
    if (!this.data.levels[id]) this.data.levels[id] = emptyLevel();
    return this.data.levels[id];
  }

  get settings() { return this.data.settings; }
  get profile() { return this.data.profile; }

  /** Entire save as pretty JSON (Settings → Export save). */
  exportJSON() { return JSON.stringify({ format: 'neondash-save', ...this.data, custom: this.allCustom() }, null, 1); }

  /** Replaces the save from exported JSON; throws a readable Error when invalid. */
  importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
    if (!obj || obj.format !== 'neondash-save') throw new Error('That file is not a Neon Dash save.');
    const custom = Array.isArray(obj.custom) ? obj.custom : [];
    delete obj.custom;
    delete obj.format;
    this.data = migrate(obj);
    this.data.customIndex = [];
    for (const c of custom) if (c && c.meta) this.saveCustom(c);
    this.save();
  }

  reset() {
    for (const c of this.data.customIndex) this.remove(`neondash.level.${c.id}`);
    const settings = this.data.settings;
    this.data = freshSave();
    this.data.settings = settings;
    this.save();
  }

  // ---- editor autosave (crash recovery) ----------------------------------------------------
  saveAutosave(obj) { this.write('neondash.editor.autosave', JSON.stringify(obj)); }
  clearAutosave() { this.remove('neondash.editor.autosave'); }
  loadAutosave() {
    const raw = this.read('neondash.editor.autosave');
    if (!raw) return null;
    try { const o = JSON.parse(raw); return o && o.level && o.level.meta ? o : null; } catch { return null; }
  }

  // ---- custom levels -----------------------------------------------------------------------
  listCustom() { return this.data.customIndex.slice().sort((a, b) => b.updated - a.updated); }

  loadCustom(id) {
    const raw = this.read(`neondash.level.${id}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  allCustom() { return this.data.customIndex.map((c) => this.loadCustom(c.id)).filter(Boolean); }

  /** Saves a custom level ({ meta, objects, triggers }); assigns an id when missing. */
  saveCustom(level) {
    if (!level.meta.id || !String(level.meta.id).startsWith('u-')) level.meta.id = `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    const id = level.meta.id;
    this.write(`neondash.level.${id}`, JSON.stringify(level));
    const entry = { id, name: level.meta.name || 'Untitled', objects: level.objects.length, updated: Date.now() };
    const i = this.data.customIndex.findIndex((c) => c.id === id);
    if (i >= 0) this.data.customIndex[i] = entry; else this.data.customIndex.push(entry);
    this.save();
    return id;
  }

  renameCustom(id, name) {
    const lvl = this.loadCustom(id);
    if (!lvl) return;
    lvl.meta.name = name;
    this.saveCustom(lvl);
  }

  deleteCustom(id) {
    this.remove(`neondash.level.${id}`);
    this.data.customIndex = this.data.customIndex.filter((c) => c.id !== id);
    delete this.data.levels[id];
    this.save();
  }
}
