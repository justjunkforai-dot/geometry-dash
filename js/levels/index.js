/**
 * Built-in level registry. Order defines unlock order; `hidden` levels are unlocked by
 * collecting every secret coin of the main levels.
 */
import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';

export const LEVELS = [
  { id: level1.meta.id, data: level1 },
  { id: level2.meta.id, data: level2 },
  { id: level3.meta.id, data: level3 },
  { id: level4.meta.id, data: level4 },
];
