#!/usr/bin/env node
/** Lists level objects around an x position (blocks): node tools/inspect.mjs <level> <x> [range] */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDef } from '../js/objects.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name, xs, rs] = process.argv.slice(2);
const level = (await import(name.includes('/') ? join(root, name) : join(root, 'js/levels', `${name}.js`))).default;
const x = Number(xs), r = Number(rs || 8);
const rows = level.objects.filter((o) => Math.abs(o[1] - x) <= r).sort((a, b) => a[1] - b[1]);
for (const o of rows) console.log(`${getDef(o[0]).key.padEnd(12)} x=${o[1]} y=${o[2]}${o[3] ? ` rot=${o[3]}` : ''}${o[4] ? ' fx' : ''}${o[5] ? ' fy' : ''}${o[6] ? ` g=${o[6]}` : ''}${o[7] ? ` ${JSON.stringify(o[7])}` : ''}`);
for (const t of level.triggers.filter((t) => Math.abs(t[1] - x) <= r)) console.log(`${getDef(t[0]).key.padEnd(12)} x=${t[1]} ${JSON.stringify(t[3] || {})}`);
