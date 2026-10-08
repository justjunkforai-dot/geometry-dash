/**
 * Editor data I/O: item ↔ level conversion, JSON export/import with validation, level
 * validation warnings and the start state for "playtest from here".
 */
import { getDef } from './objects.js';
import { DEFAULT_META, normalizeLevel } from './level.js';
import { Sim } from './sim.js';
import { floatingSpikes } from './lint.js';
import { BLOCK, BASE_SPEED, SPEEDS, START_X, MODE_NAMES } from './config.js';
import { TRACKS } from './tracks.js';
import { BG_STYLES, GROUND_STYLES } from './background.js';

export const MAX_OBJECTS = 50000;
export const WARN_OBJECTS = 20000;
export const FORMAT = 'neondash-level';

let uidCounter = 1;
export const nextUid = () => uidCounter++;

const round = (v) => Math.round(v * 1000) / 1000;

/** Level data → editor items. */
export function levelToItems(level) {
  const lvl = normalizeLevel(level);
  const items = [];
  for (const a of lvl.objects) {
    if (!getDef(a[0])) continue;
    items.push({ uid: nextUid(), t: a[0], x: a[1] || 0, y: a[2] || 0, r: a[3] || 0, fx: !!a[4], fy: !!a[5], g: a[6] | 0, p: a[7] ? structuredClone(a[7]) : null });
  }
  for (const a of lvl.triggers) {
    if (!getDef(a[0])) continue;
    items.push({ uid: nextUid(), t: a[0], x: a[1] || 0, y: a[2] || 0, r: 0, fx: false, fy: false, g: 0, p: a[3] ? structuredClone(a[3]) : null });
  }
  return { meta: lvl.meta, items };
}

/** Editor items → compact level data (trailing defaults trimmed). */
export function itemsToLevel(meta, items) {
  const objects = [];
  const triggers = [];
  for (const i of items) {
    const d = getDef(i.t);
    if (!d) continue;
    if (d.kind === 'trigger') {
      const a = [i.t, round(i.x), round(i.y)];
      if (i.p && Object.keys(i.p).length) a.push(i.p);
      triggers.push(a);
      continue;
    }
    const a = [i.t, round(i.x), round(i.y), i.r || 0, i.fx ? 1 : 0, i.fy ? 1 : 0, i.g || 0];
    if (i.p && Object.keys(i.p).length) a.push(i.p);
    while (a.length > 3 && !a[a.length - 1]) a.pop();
    objects.push(a);
  }
  objects.sort((a, b) => a[1] - b[1]);
  triggers.sort((a, b) => a[1] - b[1]);
  return { meta: structuredClone(meta), objects, triggers };
}

export function exportJSON(level) {
  return JSON.stringify({ format: FORMAT, version: 1, ...level });
}

/**
 * Parses and validates an imported file. Throws Error with a player-friendly message.
 * Unknown object types are dropped with a warning instead of failing the whole import.
 */
export function importJSON(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!obj || typeof obj !== 'object') throw new Error('This file does not contain a level.');
  if (obj.format && obj.format !== FORMAT) throw new Error(`This is a "${obj.format}" file, not a Neon Dash level.`);
  if (!Array.isArray(obj.objects)) throw new Error('The level has no "objects" list.');
  if (obj.triggers !== undefined && !Array.isArray(obj.triggers)) throw new Error('"triggers" must be a list.');
  if (obj.objects.length + (obj.triggers || []).length > MAX_OBJECTS) throw new Error(`The level has too many objects (limit ${MAX_OBJECTS}).`);
  const warnings = [];
  const clean = (list, isTrigger) => {
    const out = [];
    let unknown = 0;
    list.forEach((a, i) => {
      if (!Array.isArray(a) || a.length < 3) throw new Error(`Entry #${i + 1} is malformed (expected [type, x, y, …]).`);
      const d = getDef(a[0]);
      if (!d || (d.kind === 'trigger') !== isTrigger) { unknown++; return; }
      if (!Number.isFinite(a[1]) || !Number.isFinite(a[2])) throw new Error(`Entry #${i + 1} has an invalid position.`);
      if (Math.abs(a[1]) > 1e5 || Math.abs(a[2]) > 1e4) throw new Error(`Entry #${i + 1} is placed impossibly far away.`);
      out.push(a);
    });
    if (unknown) warnings.push(`${unknown} unknown ${isTrigger ? 'trigger' : 'object'} type(s) were skipped.`);
    return out;
  };
  const objects = clean(obj.objects, false);
  const triggers = clean(obj.triggers || [], true);
  const meta = sanitizeMeta(obj.meta || {});
  return { level: { meta, objects, triggers }, warnings };
}

/** Clamps metadata to valid values (imported files may contain anything). */
export function sanitizeMeta(m) {
  const out = { ...DEFAULT_META, ...m, palette: { ...DEFAULT_META.palette, ...(m.palette || {}) } };
  out.name = String(out.name || 'Untitled').slice(0, 40);
  out.author = String(out.author || 'You').slice(0, 30);
  out.bpm = Math.min(300, Math.max(40, Number(out.bpm) || 120));
  out.offset = Math.min(60, Math.max(0, Number(out.offset) || 0));
  if (!TRACKS[out.song]) out.song = DEFAULT_META.song;
  if (!BG_STYLES.includes(out.bg)) out.bg = DEFAULT_META.bg;
  if (!GROUND_STYLES.includes(out.ground)) out.ground = DEFAULT_META.ground;
  if (!MODE_NAMES.includes(out.startMode)) out.startMode = 'cube';
  out.startSpeed = Math.min(4, Math.max(0, out.startSpeed | 0));
  out.startGravity = out.startGravity === -1 ? -1 : 1;
  out.startMini = !!out.startMini;
  for (const k of Object.keys(out.palette)) if (!/^#[0-9a-f]{6}$/i.test(out.palette[k])) out.palette[k] = DEFAULT_META.palette[k];
  out.difficulty = out.difficulty || 'normal';
  return out;
}

/** Validation findings shown in the editor: [{ level: 'error'|'warn', msg, x? }]. */
export function validate(level) {
  const out = [];
  const objs = level.objects;
  const ends = objs.filter((o) => getDef(o[0]).kind === 'end');
  if (!ends.length) out.push({ level: 'warn', msg: 'No end wall: the level ends 12 blocks after the last object.' });
  if (ends.length > 1) out.push({ level: 'warn', msg: 'More than one end wall: the first one ends the level.' });
  const total = objs.length + level.triggers.length;
  if (total > WARN_OBJECTS) out.push({ level: 'warn', msg: `${total} objects — very large levels may run slowly on older devices.` });
  if (!objs.length) out.push({ level: 'error', msg: 'The level is empty.' });
  const groups = new Set(objs.map((o) => o[6] | 0).filter(Boolean));
  for (const t of level.triggers) {
    const d = getDef(t[0]);
    const p = { ...d.props, ...(t[3] || {}) };
    if ('group' in d.props && !groups.has(p.group | 0)) out.push({ level: 'warn', msg: `${d.name} at x=${t[1]} targets group ${p.group}, which has no objects.`, x: t[1] });
    if ('duration' in p && !(p.duration >= 0)) out.push({ level: 'error', msg: `${d.name} at x=${t[1]} has a negative duration.`, x: t[1] });
    if (d.action === 'zoom' && !(p.zoom >= 0.5 && p.zoom <= 2)) out.push({ level: 'warn', msg: `Zoom trigger at x=${t[1]} uses ${p.zoom}; keep it between 0.5 and 2.`, x: t[1] });
  }
  const m = level.meta;
  for (const o of objs) {
    const d = getDef(o[0]);
    if (d.kind === 'portal' && o[1] < 2) {
      const conflict = (d.action === 'mode' && d.value !== m.startMode) || (d.action === 'speed' && d.value !== m.startSpeed);
      if (conflict) out.push({ level: 'warn', msg: `${d.name} overlaps the start position and conflicts with the level's start settings.`, x: o[1] });
    }
    if (o[1] < -1) { out.push({ level: 'warn', msg: `${d.name} is behind the start line (x=${o[1]}).`, x: o[1] }); break; }
  }
  const coins = objs.filter((o) => getDef(o[0]).kind === 'coin').length;
  if (coins > 3) out.push({ level: 'warn', msg: `${coins} secret coins placed; levels show at most 3 slots.` });
  for (const f of floatingSpikes(level).slice(0, 5)) out.push(f);
  return out;
}

/**
 * Start state at world x (blocks) for "playtest from here": replays every portal to the left
 * using the real portal logic, and the level time at which the player would reach x.
 */
export function computeStart(level, xBlocks) {
  const x = Math.max(START_X, xBlocks * BLOCK);
  const sim = new Sim(level);
  const p = sim.players[0];
  const portals = sim.world.objects.filter((o) => o.kind === 'portal' && o.x < x).sort((a, b) => a.x - b.x);
  let t = 0;
  let lastX = START_X;
  let speed = sim.speedIdx;
  for (const o of portals) {
    t += Math.max(0, o.x - lastX) / (BASE_SPEED * SPEEDS[speed]);
    lastX = Math.max(lastX, o.x);
    p.x = o.x;
    p.y = o.y;
    sim.applyPortal(p, o);
    speed = sim.speedIdx;
  }
  t += Math.max(0, x - lastX) / (BASE_SPEED * SPEEDS[speed]);
  return {
    x, tick: Math.round(t * 240), mode: p.mode, grav: p.grav, mini: p.mini, speed: sim.speedIdx,
    mirror: sim.mirror, dual: sim.dual, corridor: sim.corridor ? { ...sim.corridor } : null,
  };
}
