#!/usr/bin/env node
/** Node test runner: `node tests/run.mjs`. Exits non-zero if any test fails. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from './suite.js';

const here = dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
const results = await runSuite({
  loadRecording: async (id) => {
    const f = join(here, 'recordings', `${id}.json`);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  },
  log: (m) => console.log(m),
});
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed.length ? 1 : 0);
