/**
 * Cosmetics: player colours, trails and the unlock rules for icons/colours/trails.
 * Requirements are thresholds (nothing is purchased): { stars | orbs | diamonds | coins |
 * completed | achievements: n } or { achievement: id }.
 */
import { ICON_COUNTS } from './icons.js';

export const PLAYER_COLORS = [
  '#7dff4f', '#3dd6ff', '#7df9ff', '#ffd500', '#ff4fd8', '#ff3b3b', '#ff8a1f', '#a05bff',
  '#ffffff', '#3dff9e', '#3d7bff', '#ffb3f0', '#c8ff3d', '#ff5a88', '#00e5c0', '#9fa8ff',
  '#ffe08a', '#ff9e3d', '#5affd2', '#d24bff', '#1e1e2a', '#7a7a90', '#ff2056', '#00b4ff',
];

/** Unlock requirement per colour index (missing = free). */
const COLOR_REQ = {
  8: { stars: 2 }, 9: { stars: 4 }, 10: { stars: 6 }, 11: { stars: 10 }, 12: { orbs: 200 }, 13: { orbs: 500 },
  14: { orbs: 900 }, 15: { diamonds: 20 }, 16: { diamonds: 40 }, 17: { coins: 3 }, 18: { coins: 9 },
  19: { coins: 15 }, 20: { achievements: 5 }, 21: { achievements: 10 }, 22: { completed: 6 }, 23: { completed: 8 },
};

export const TRAILS = [
  { id: 'none', name: 'None' },
  { id: 'streak', name: 'Streak' },
  { id: 'glow', name: 'Glow', req: { stars: 5 } },
  { id: 'sparks', name: 'Sparks', req: { coins: 6 } },
  { id: 'rainbow', name: 'Rainbow', req: { coins: 18 } },
  { id: 'pixels', name: 'Pixels', req: { achievements: 8 } },
];

/** Icon unlock: the first two variants of each mode are free, later ones need progress. */
function iconReq(mode, v) {
  if (v < 2) return null;
  const order = ['stars', 'orbs', 'coins', 'diamonds', 'achievements', 'completed'];
  const kind = order[(v + mode.length) % order.length];
  const scale = { stars: 3, orbs: 150, coins: 3, diamonds: 12, achievements: 3, completed: 1 }[kind];
  return { [kind]: Math.min(kind === 'completed' ? 8 : 999, scale * (v - 1)) };
}

export function requirementText(req) {
  if (!req) return '';
  const [k, v] = Object.entries(req)[0];
  const names = { stars: 'stars', orbs: 'orbs', diamonds: 'diamonds', coins: 'secret coins', achievements: 'achievements', completed: 'levels completed' };
  if (k === 'achievement') return 'Unlock a specific achievement';
  return `Requires ${v} ${names[k]}`;
}

/** Totals the player has, used to evaluate requirements. */
export function playerTotals(app) {
  const p = app.progress;
  return {
    stars: p.totalStars(), orbs: app.storage.data.orbs, diamonds: app.storage.data.diamonds, coins: p.totalCoins(),
    achievements: Object.keys(app.storage.data.achievements).length, completed: p.completedCount(),
  };
}

export function meets(req, totals) {
  if (!req) return true;
  return Object.entries(req).every(([k, v]) => (totals[k] || 0) >= v);
}

export const colorReq = (i) => COLOR_REQ[i] || null;
export const iconRequirement = iconReq;
export const MODES_ORDER = Object.keys(ICON_COUNTS);
