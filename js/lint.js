/**
 * Level lint checks shared by the tests and the editor's validator.
 * Returns a list of { level: 'warn' | 'error', msg, x } findings.
 */
import { getDef } from './objects.js';

const EPS = 0.01;

/** Spikes whose base is not resting on the ground, a block, or a band ceiling. */
export function floatingSpikes(level) {
  const solids = [];
  for (const o of level.objects) {
    const d = getDef(o[0]);
    if (!d || d.kind !== 'solid') continue;
    const [x0, y0, x1, y1] = d.solid;
    solids.push([o[1] + x0, o[2] + y0, o[1] + x1, o[2] + y1]);
  }
  const out = [];
  for (const o of level.objects) {
    const d = getDef(o[0]);
    if (!d || d.kind !== 'spike') continue;
    const rot = ((o[3] || 0) % 360 + 360) % 360;
    if (rot !== 0 && rot !== 180) continue;
    const x = o[1];
    if (rot === 0) {
      const base = o[2] - 0.5;
      if (base < EPS) continue;
      const ok = solids.some((s) => Math.abs(s[3] - base) < EPS && s[0] < x + 0.2 && s[2] > x - 0.2);
      if (!ok) out.push({ level: 'warn', msg: `Floating spike at x=${x.toFixed(1)}, y=${o[2]}`, x });
    } else {
      const base = o[2] + 0.5;
      if (Math.abs(base - 10) < EPS || Math.abs(base - 8) < EPS) continue;
      const ok = solids.some((s) => Math.abs(s[1] - base) < EPS && s[0] < x + 0.2 && s[2] > x - 0.2);
      if (!ok) out.push({ level: 'warn', msg: `Hanging spike without a ceiling at x=${x.toFixed(1)}, y=${o[2]}`, x });
    }
  }
  return out;
}
