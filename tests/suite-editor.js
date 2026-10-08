/**
 * Editor I/O and save-data tests (DOM-free): level ↔ editor items ↔ JSON round trips, friendly
 * import errors, "playtest from here" start states, and save export/import/migration.
 */
import { levelToItems, itemsToLevel, exportJSON, importJSON, validate, computeStart } from '../js/editor-io.js';
import { Storage, migrate } from '../js/storage.js';
import { SAVE_VERSION, BLOCK } from '../js/config.js';
import { T } from '../js/objects.js';
import { replay } from './bot.js';
import showcase from './levels/showcase.js';

/** Minimal localStorage stand-in. */
class MemoryBackend {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const throwsWith = (fn, re) => {
  try { fn(); } catch (e) { return re.test(e.message); }
  return false;
};

export async function editorTests(test, { assert, loadRecording }) {
  await test('editor: level → items → JSON → level round trip plays identically', async () => {
    const { meta, items } = levelToItems(showcase);
    assert(items.length === showcase.objects.length + showcase.triggers.length, 'items lost on load');
    const text = exportJSON(itemsToLevel(meta, items));
    const { level, warnings } = importJSON(text);
    assert(!warnings.length, `unexpected warnings: ${warnings.join(' ')}`);
    assert(level.objects.length === showcase.objects.length, 'object count changed');
    assert(level.triggers.length === showcase.triggers.length, 'trigger count changed');
    const rec = await loadRecording('showcase');
    assert(rec, 'missing showcase recording');
    const a = replay(showcase, rec);
    const b = replay(level, rec);
    assert(a.completed && b.completed, 'round-tripped level is no longer beatable');
    assert(a.hash === b.hash, 'simulation differs after the round trip');
  });

  await test('editor: imports reject broken files with readable errors', () => {
    assert(throwsWith(() => importJSON('{nope'), /not valid JSON/), 'bad JSON');
    assert(throwsWith(() => importJSON('{"format":"neondash-save"}'), /not a Neon Dash level/), 'wrong format');
    assert(throwsWith(() => importJSON('{"meta":{}}'), /no "objects"/), 'missing objects');
    assert(throwsWith(() => importJSON('{"objects":[[1,"a",0]]}'), /invalid position/), 'bad position');
    assert(throwsWith(() => importJSON('{"objects":[5]}'), /malformed/), 'malformed entry');
    const { level, warnings } = importJSON(JSON.stringify({ objects: [[1, 3, 0.5], [9999, 4, 0.5]], meta: { bpm: 9999, song: 'nope', palette: { bg: 'red' } } }));
    assert(level.objects.length === 1 && warnings.length === 1, 'unknown types should be skipped with a warning');
    assert(level.meta.bpm === 300 && level.meta.song !== 'nope' && level.meta.palette.bg.startsWith('#'), 'meta not sanitised');
  });

  await test('editor: validation flags missing end walls and empty trigger groups', () => {
    const msgs = validate({ meta: showcase.meta, objects: [[T('block'), 5, 0.5]], triggers: [[T('trMove'), 3, 8, { group: 7 }]] }).map((f) => f.msg).join(' | ');
    assert(/No end wall/.test(msgs), 'no end-wall warning');
    assert(/group 7/.test(msgs), 'no empty-group warning');
  });

  await test('editor: playtest-from-here replays earlier portals and level time', () => {
    const level = showcase;
    const ship = level.objects.find((o) => o[0] === T('portalShip'));
    const st = computeStart(level, ship[1] + 3);
    assert(st.mode === 'ship', `expected ship, got ${st.mode}`);
    assert(st.corridor && st.corridor.ceil > st.corridor.floor, 'ship start needs its corridor');
    assert(st.tick > 0 && Math.abs(st.x - (ship[1] + 3) * BLOCK) < 1e-6, 'start tick/x wrong');
    const fast = level.objects.find((o) => o[0] === T('speed3'));
    assert(computeStart(level, fast[1] + 2).speed === 3, 'speed portal not applied');
  });

  await test('save data: export/import round trip, custom levels and v1 migration', () => {
    const a = new Storage(new MemoryBackend());
    a.level('first-steps').best = 64;
    a.data.orbs = 1234;
    a.profile.p1 = 5;
    const id = a.saveCustom({ meta: { name: 'Mine' }, objects: [[1, 3, 0.5]], triggers: [] });
    a.save();
    const text = a.exportJSON();
    const b = new Storage(new MemoryBackend());
    b.importJSON(text);
    assert(b.level('first-steps').best === 64 && b.data.orbs === 1234 && b.profile.p1 === 5, 'progress lost');
    assert(b.listCustom().length === 1 && b.loadCustom(b.listCustom()[0].id).meta.name === 'Mine', 'custom level lost');
    assert(id.startsWith('u-'), 'custom ids are prefixed');
    assert(throwsWith(() => b.importJSON('{"format":"other"}'), /not a Neon Dash save/), 'foreign save accepted');
    const m = migrate({ version: 1, levels: { 'first-steps': { best: 40 } }, volume: 0.3, attempts: 9 });
    assert(m.version === SAVE_VERSION && m.levels['first-steps'].best === 40 && m.settings.master === 0.3 && m.stats.attempts === 9, 'v1 migration');
    const blocked = new Storage({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} });
    blocked.save();
    assert(!blocked.persistent && blocked.data.version === SAVE_VERSION, 'blocked storage must fall back to memory');
  });
}
