/**
 * Achievements: definitions, unlock checks and toast notifications. Unlock times are stored
 * in the save (data.achievements[id] = timestamp).
 */
import { LEVELS } from './levels/index.js';

const levelAch = LEVELS.map((l) => ({
  id: `beat-${l.id}`,
  name: l.hidden ? 'Hidden Depths' : `Cleared: ${l.data.meta.name}`,
  desc: l.hidden ? 'Complete the hidden bonus level.' : `Complete "${l.data.meta.name}" in normal mode.`,
  icon: l.hidden ? '◆' : '✔',
}));

export const ACHIEVEMENTS = [
  { id: 'first-jump', name: 'First Jump', desc: 'Jump for the very first time.', icon: '⤴' },
  ...levelAch,
  { id: 'halfway', name: 'Halfway There', desc: 'Reach 50% in any level.', icon: '½' },
  { id: 'so-close', name: 'So Close', desc: 'Crash at 95% or later.', icon: '!' },
  { id: 'coins-3', name: 'Collector', desc: 'Save 3 secret coins.', icon: '◎' },
  { id: 'coins-all', name: 'Treasure Hunter', desc: 'Save every secret coin of the main levels.', icon: '◉' },
  { id: 'attempts-100', name: 'Persistent', desc: 'Make 100 attempts.', icon: '↻' },
  { id: 'attempts-1000', name: 'Unstoppable', desc: 'Make 1,000 attempts.', icon: '∞' },
  { id: 'jumps-1000', name: 'Hopper', desc: 'Jump 1,000 times.', icon: '⇡' },
  { id: 'hold-60', name: 'Hold For 60 Seconds', desc: 'Hold the jump button for 60 seconds in total.', icon: '⏱' },
  { id: 'no-hit-practice', name: 'No Hit Practice', desc: 'Finish a level in practice mode without dying or using checkpoints.', icon: '◆' },
  { id: 'perfect-wave', name: 'Perfect Wave', desc: 'Fly a whole wave section without grazing the floor or ceiling.', icon: '〰' },
  { id: 'mirror', name: 'Looking Glass', desc: 'Pass through a mirror portal.', icon: '⇄' },
  { id: 'dual', name: 'Double Trouble', desc: 'Play in dual mode.', icon: '⧉' },
  { id: 'stars-10', name: 'Rising Star', desc: 'Earn 10 stars.', icon: '★' },
  { id: 'stars-all', name: 'Superstar', desc: 'Earn every star.', icon: '✦' },
  { id: 'orbs-500', name: 'Orb Hoarder', desc: 'Collect 500 orbs.', icon: '●' },
  { id: 'create-level', name: 'Architect', desc: 'Save a level in the editor.', icon: '✎' },
  { id: 'playtest', name: 'Test Pilot', desc: 'Playtest your own level.', icon: '▶' },
  { id: 'import-level', name: 'Importer', desc: 'Import a level file.', icon: '⇩' },
  { id: 'customize', name: 'New Look', desc: 'Change your icon, colours or trail.', icon: '✿' },
];

export class Achievements {
  constructor(app) { this.app = app; }

  get data() { return this.app.storage.data; }
  has(id) { return !!this.data.achievements[id]; }
  count() { return Object.keys(this.data.achievements).length; }

  unlock(id) {
    if (this.has(id)) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    this.data.achievements[id] = Date.now();
    this.app.storage.save();
    this.app.ui.toast('Achievement unlocked', a.name, a.icon);
    if (this.app.audio) this.app.audio.sfx('achievement');
    return true;
  }

  /** Threshold-based achievements from the running totals. */
  check() {
    const s = this.data.stats;
    const p = this.app.progress;
    if (s.attempts >= 100) this.unlock('attempts-100');
    if (s.attempts >= 1000) this.unlock('attempts-1000');
    if (s.jumps >= 1000) this.unlock('jumps-1000');
    if (s.holdTime >= 60) this.unlock('hold-60');
    if (p.totalCoins() >= 3) this.unlock('coins-3');
    if (p.mainCoins() >= p.mainLevels().length * 3) this.unlock('coins-all');
    const stars = p.totalStars();
    if (stars >= 10) this.unlock('stars-10');
    if (stars >= LEVELS.reduce((a, l) => a + (l.data.meta.stars || 0), 0)) this.unlock('stars-all');
    if (this.data.orbs >= 500) this.unlock('orbs-500');
  }

  onJump() { if (!this.has('first-jump')) this.unlock('first-jump'); }

  onDeath(g, d) {
    if (!d.practice && !g.opts.playtest) {
      if (d.pct >= 50) this.unlock('halfway');
      if (d.pct >= 95) this.unlock('so-close');
    }
    this.check();
  }

  onComplete(g, d) {
    if (g.opts.playtest) return;
    if (!d.practice) {
      if (LEVELS.some((l) => l.id === g.opts.levelId)) this.unlock(`beat-${g.opts.levelId}`);
      this.unlock('halfway');
    } else if (d.noDeaths) this.unlock('no-hit-practice');
    this.check();
  }

  onModeLeft(d) {
    if (d.mode === 'wave' && !d.grazed) this.unlock('perfect-wave');
  }
}
