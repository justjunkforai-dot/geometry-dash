#!/usr/bin/env node
/**
 * Browser checks with Playwright + Chromium (no install step: uses a global Playwright).
 *
 *   node tests/browser.mjs [--heap-minutes 5] [--perf-seconds 10] [--shots docs/screenshots] [--skip-heap]
 *
 * 1. zero console errors/warnings across boot, every menu screen, the editor and every level
 * 2. the in-page test suite (?test=1, includes offline audio rendering) passes
 * 3. layout at 1920×1080, 1366×768, 390×844 (portrait) and 844×390
 * 4. named screenshots (menu, level select, cube, ship, wave, pause, complete, editor, customize)
 * 5. frame time over N seconds of the heaviest level (Final Descent) played by the bot
 * 6. JS heap after GC across an N-minute session of menus and bot play does not keep growing
 *
 * Set PLAYWRIGHT_MODULE / CHROMIUM_PATH to override how Playwright and Chromium are found.
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LEVELS } from '../js/levels/index.js';
import { replay } from './bot.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const HEAP_MIN = Number(opt('--heap-minutes', 5));
const PERF_S = Number(opt('--perf-seconds', 10));
const SHOTS = join(root, opt('--shots', 'docs/screenshots'));

// ---- locate Playwright and Chromium ------------------------------------------------------------
async function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright'];
  try { tries.push(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')); } catch { /* npm missing */ }
  for (const t of tries.filter(Boolean)) {
    try { return await import(t.startsWith('/') ? pathToFileURL(t).href : t); } catch { /* next */ }
  }
  throw new Error('Playwright not found: install it globally or set PLAYWRIGHT_MODULE.');
}
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
    const p = join(base, d, 'chrome-linux', 'chrome');
    if (existsSync(p)) return p;
  }
  return undefined;
}

// ---- static server -----------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = path.endsWith('/') ? `${path}index.html` : path;
    const body = await readFile(join(root, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---- harness -----------------------------------------------------------------------------------
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
});
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(viewport = { width: 1920, height: 1080 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 900 });
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.problems.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => page.problems.push(`request failed: ${r.url()}`));
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) page.problems.push(`external request: ${r.url()}`); });
  return page;
}
const state = (page) => page.evaluate(() => { const a = window.neonDash; const g = a.game; return { name: a.stateName, game: g && g.state, pct: g && g.percent, mode: g && g.sim.players[0].mode }; });
const go = (page, name, data) => page.evaluate(([n, d]) => window.neonDash.go(n, d, true), [name, data]);

/** Seconds into a level's bot recording where the player first uses `mode` (+ lead). */
function timeOfMode(idx, mode, lead = 1.5) {
  const L = LEVELS[idx];
  const rec = JSON.parse(readFileSync(join(root, 'tests/recordings', `${L.id}.json`), 'utf8'));
  let tick = 0;
  replay(L.data, rec, { onTick: (sim, t) => { if (!tick && sim.players[0].mode === mode) tick = t; } });
  return tick / 240 + lead;
}

await mkdir(SHOTS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

// 1. Screens and the editor.
{
  const page = await newPage();
  await page.goto(BASE);
  await wait(900);
  await shot(page, 'main-menu');
  const screens = [
    ['levels', {}], ['levels', { tab: 'mine' }], ['credits', {}],
    ...['audio', 'video', 'gameplay', 'controls', 'data'].map((t) => ['settings', { tab: t }]),
    ['customize', {}], ['customize', { section: 'colors' }], ['customize', { section: 'trail' }],
    ['achievements', {}], ['achievements', { tab: 'stats' }], ['menu', {}],
  ];
  for (const [n, d] of screens) { await go(page, n, d); await wait(250); }
  await go(page, 'levels', {});
  await wait(500);
  await shot(page, 'level-select');
  await go(page, 'customize', {});
  await wait(500);
  await shot(page, 'customize');
  await go(page, 'editor', {});
  await wait(400);
  await page.evaluate(async () => {
    const { LEVELS: L } = await import('./js/levels/index.js');
    const ed = window.neonDash.editor;
    ed.reset(L[1].data);
    ed.cam.x = 120 * 30; ed.cam.y = 4.5 * 30; ed.cam.zoom = 0.7;
    ed.ui.refresh();
  });
  await page.mouse.click(960, 520);
  await page.keyboard.press('KeyV');
  await page.mouse.click(1100, 600);
  await wait(400);
  await shot(page, 'editor');
  await page.click('button[aria-label="Shortcuts and help"]');
  await wait(200);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await wait(1500);
  const s = await state(page);
  check('editor playtest starts from the editor', s.name === 'play', JSON.stringify(s));
  check('menus, customize, achievements and editor log no console errors', !page.problems.length, page.problems.slice(0, 5).join(' | '));
  await page.context().close();
}

// 2. In-page test suite (includes offline audio rendering).
{
  const page = await newPage();
  await page.goto(`${BASE}?test=1`);
  await page.waitForFunction(() => window.__testResults, null, { timeout: 120000 });
  const r = await page.evaluate(() => window.__testResults.map((x) => ({ name: x.name, pass: x.pass, error: x.detail })));
  const failed = r.filter((x) => !x.pass);
  check(`in-page suite: ${r.length - failed.length}/${r.length} passed`, !failed.length, failed.map((f) => `${f.name}: ${f.error}`).join(' | '));
  check('in-page suite logs no console errors', !page.problems.length, page.problems.slice(0, 5).join(' | '));
  await page.context().close();
}

// 3. Every level with the bot (start and middle), plus gameplay screenshots.
{
  const page = await newPage();
  const bad = [];
  for (let i = 0; i < LEVELS.length; i++) {
    for (const t of [0, 25]) {
      await page.goto(`${BASE}?bot=1&level=${i + 1}&t=${t}`);
      await wait(2200);
      const s = await state(page);
      if (s.name !== 'play' || s.game === 'dead') bad.push(`${LEVELS[i].id}@${t}s: ${JSON.stringify(s)}`);
    }
  }
  check('bot plays every level in the browser without dying', !bad.length, bad.join(' | '));
  const shots = [['cube', 1, 8], ['ship', 2, timeOfMode(1, 'ship')], ['wave', 5, timeOfMode(4, 'wave', 2)]];
  for (const [name, lvl, t] of shots) {
    await page.goto(`${BASE}?bot=1&level=${lvl}&t=${t.toFixed(2)}`);
    await wait(700);
    await shot(page, name);
  }
  await page.goto(`${BASE}?bot=1&level=1&t=12`);
  await wait(600);
  await page.keyboard.press('Escape');
  await wait(400);
  check('Esc pauses the game', (await state(page)).game === 'paused');
  await shot(page, 'pause');
  const len = replay(LEVELS[0].data, JSON.parse(readFileSync(join(root, 'tests/recordings/first-steps.json'), 'utf8'))).tick / 240;
  await page.goto(`${BASE}?bot=1&level=1&t=${(len - 1.5).toFixed(2)}`);
  await page.waitForSelector('.complete', { timeout: 15000 });
  await wait(1500);
  await shot(page, 'level-complete');
  check('levels and gameplay log no console errors', !page.problems.length, page.problems.slice(0, 5).join(' | '));
  await page.context().close();
}

// 4. Viewports.
for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await newPage(vp);
  await page.goto(BASE);
  await wait(700);
  const m = await page.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    return { w: st.width, h: st.height, l: st.left, t: st.top, scrollW: document.documentElement.scrollWidth, hint: !document.getElementById('rotate-hint').hidden };
  });
  const ratio = m.w / m.h;
  const fits = m.w <= vp.width + 0.5 && m.h <= vp.height + 0.5 && Math.abs(ratio - 16 / 9) < 0.02 && m.scrollW <= vp.width;
  const portrait = vp.height > vp.width;
  check(`layout ${vp.width}×${vp.height}: 16:9 letterbox${portrait ? ' + rotate hint' : ''}`, fits && (!portrait || m.hint), JSON.stringify(m));
  await page.screenshot({ path: join(SHOTS, `viewport-${vp.width}x${vp.height}.png`) });
  await page.context().close();
}

// 5. Frame time in the heaviest level.
{
  const page = await newPage();
  await page.goto(`${BASE}?bot=1&level=8&t=1`);
  await wait(800);
  const perf = await page.evaluate((secs) => new Promise((resolve) => {
    const app = window.neonDash;
    const st = app.state;
    const work = [];
    const frames = [];
    const u = st.update, r = st.render;
    let t0 = 0;
    st.update = function (...a) { t0 = performance.now(); return u.apply(this, a); };
    st.render = function (...a) { const out = r.apply(this, a); work.push(performance.now() - t0); return out; };
    let last = performance.now();
    const end = last + secs * 1000;
    const loop = (now) => {
      frames.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(loop);
      else {
        st.update = u; st.render = r;
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const p = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)];
        resolve({ fps: 1000 / avg(frames), frame: avg(frames), work: avg(work), workP95: p(work, 0.95), workP99: p(work, 0.99), dead: app.game.state });
      }
    };
    requestAnimationFrame(loop);
  }), PERF_S);
  check(`Final Descent ${PERF_S} s: ${perf.fps.toFixed(1)} FPS, update+render avg ${perf.work.toFixed(2)} ms (p95 ${perf.workP95.toFixed(2)}, p99 ${perf.workP99.toFixed(2)})`,
    perf.work < 8 && perf.workP95 < 16.7, JSON.stringify(perf));
  await page.context().close();
}

// 6. Heap over a long session (menus + bot play, no reloads).
if (!args.includes('--skip-heap')) {
  const page = await newPage();
  await page.goto(BASE);
  await wait(800);
  const heap = () => page.evaluate(() => { window.gc(); window.gc(); return performance.memory.usedJSHeapSize / 1048576; });
  const cycle = async (k) => {
    const L = LEVELS[k % LEVELS.length];
    await page.evaluate(async (id) => {
      const { RecordingInput } = await import('./tests/bot.js');
      const { LEVELS: all } = await import('./js/levels/index.js');
      const entry = all.find((l) => l.id === id);
      const rec = await (await fetch(`tests/recordings/${id}.json`)).json();
      window.neonDash.go('play', { entry, bot: new RecordingInput(rec) }, true);
    }, L.id);
    await wait(12000);
    for (const n of ['levels', 'customize', 'achievements', 'menu']) { await go(page, n, {}); await wait(300); }
  };
  const samples = [];
  const t0 = Date.now();
  let k = 0;
  await cycle(k++);
  samples.push(await heap());
  while (Date.now() - t0 < HEAP_MIN * 60000) {
    await cycle(k++);
    samples.push(await heap());
  }
  const first = samples[0], lastS = samples[samples.length - 1], peak = Math.max(...samples);
  check(`heap over ${HEAP_MIN} min (${samples.length} samples): ${first.toFixed(1)} → ${lastS.toFixed(1)} MB (peak ${peak.toFixed(1)})`,
    lastS - first < 3, samples.map((x) => x.toFixed(1)).join(' '));
  check('long session logs no console errors', !page.problems.length, page.problems.slice(0, 5).join(' | '));
  await page.context().close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed; screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
