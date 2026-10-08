/**
 * Built-in level registry. Order defines unlock order; `hidden` levels are unlocked by
 * collecting every secret coin of the main levels.
 */
import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';
import level5 from './level5.js';
import level6 from './level6.js';

export const LEVELS = [
  { id: level1.meta.id, data: level1 },
  { id: level2.meta.id, data: level2 },
  { id: level3.meta.id, data: level3 },
  { id: level4.meta.id, data: level4 },
  { id: level5.meta.id, data: level5 },
  { id: level6.meta.id, data: level6 },
];
