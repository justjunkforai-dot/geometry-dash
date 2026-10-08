/**
 * Built-in level registry. Order defines unlock order; `hidden` levels are unlocked by
 * collecting every secret coin of the main levels.
 */
import level1 from './level1.js';

export const LEVELS = [
  { id: level1.meta.id, data: level1 },
];
