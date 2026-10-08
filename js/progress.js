/**
 * Progress rules: unlocks, rewards and per-level bookkeeping on top of Storage.
 * Stars come from completing levels (first clear only), orbs and diamonds from completions
 * and newly collected secret coins. Practice runs only record the best practice percentage.
 */
import { LEVELS } from './levels/index.js';

export const DIFFICULTIES = {
  easy: { name: 'Easy', color: '#3dc8ff' },
  normal: { name: 'Normal', color: '#3dff7a' },
  hard: { name: 'Hard', color: '#ffb000' },
  harder: { name: 'Harder', color: '#ff5a36' },
  insane: { name: 'Insane', color: '#ff3bd5' },
  demon: { name: 'Demon', color: '#ff2056' },
};

export class Progress {
  constructor(storage) {
    this.storage = storage;
  }

  get data() { return this.storage.data; }

  mainLevels() { return LEVELS.filter((l) => !l.hidden); }
  bonusLevels() { return LEVELS.filter((l) => l.hidden); }

  /** Main levels unlock in order; hidden levels need every coin of the main levels. */
  isUnlocked(entry) {
    if (this.data.settings.unlockAll) return true;
    if (entry.hidden) return this.mainCoins() >= this.mainLevels().length * 3;
    const i = this.mainLevels().indexOf(entry);
    return i <= 0 || this.level(this.mainLevels()[i - 1].id).completed;
  }

  unlockHint(entry) {
    if (entry.hidden) return `Collect all ${this.mainLevels().length * 3} secret coins to unlock`;
    const i = this.mainLevels().indexOf(entry);
    return `Complete "${this.mainLevels()[i - 1].data.meta.name}" to unlock`;
  }

  level(id) { return this.storage.level(id); }

  totalStars() {
    let s = 0;
    for (const l of LEVELS) if (this.level(l.id).completed) s += l.data.meta.stars || 0;
    return s;
  }

  totalCoins() {
    let c = 0;
    for (const l of LEVELS) c += this.level(l.id).coins.filter(Boolean).length;
    return c;
  }

  mainCoins() {
    let c = 0;
    for (const l of this.mainLevels()) c += this.level(l.id).coins.filter(Boolean).length;
    return c;
  }

  completedCount() { return LEVELS.filter((l) => this.level(l.id).completed).length; }

  onAttempt(id) {
    this.level(id).attempts++;
    this.data.stats.attempts++;
  }

  /** Called when a run ends without completion. */
  onRunEnd(id, pct, practice, run) {
    const l = this.level(id);
    if (practice) l.bestPractice = Math.max(l.bestPractice, pct);
    else l.best = Math.max(l.best, pct);
    this.addRunStats(l, run);
    if (!practice) this.data.stats.deaths++;
    this.storage.save();
  }

  addRunStats(l, run) {
    l.jumps += run.jumps || 0;
    l.time += run.time || 0;
    this.data.stats.jumps += run.jumps || 0;
    this.data.stats.playTime += run.time || 0;
    this.data.stats.holdTime += (run.holdTicks || 0) / 240;
  }

  /**
   * Called on completion. Returns the reward summary for the complete screen.
   * Coins are only saved for normal-mode completions.
   */
  onComplete(id, meta, practice, run, coins) {
    const l = this.level(id);
    const r = { firstClear: false, stars: 0, orbs: 0, diamonds: 0, newCoins: 0, practice, prevBest: l.best };
    this.addRunStats(l, run);
    if (practice) {
      l.bestPractice = 100;
      this.storage.save();
      return r;
    }
    l.best = 100;
    l.completions++;
    this.data.stats.completions++;
    const stars = meta.stars || 0;
    if (!l.completed) {
      l.completed = true;
      r.firstClear = true;
      r.stars = stars;
      r.orbs = 50 * Math.max(1, stars);
      r.diamonds = 2 * Math.max(1, stars);
    } else {
      r.orbs = 5 * Math.max(1, stars);
    }
    coins.forEach((got, i) => {
      if (got && !l.coins[i]) { l.coins[i] = true; r.newCoins++; }
    });
    r.diamonds += r.newCoins * 5;
    this.data.orbs += r.orbs;
    this.data.diamonds += r.diamonds;
    this.storage.save();
    return r;
  }
}
