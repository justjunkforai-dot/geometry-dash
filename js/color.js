/** Colour helpers shared by the renderer and UI. */

export function hex(c) {
  let h = String(c || '#ffffff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb(c, a = 1) {
  const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function lighten(c, t) { return mix(c, [255, 255, 255], t); }
export function darken(c, t) { return mix(c, [0, 0, 0], t); }

/**
 * Caches CSS strings for a slowly changing RGB triple so steady frames don't allocate:
 * `get(c, a)` only rebuilds the string when the rounded colour or alpha changes.
 */
export class ColorCache {
  constructor() { this.key = -1; this.str = ''; }
  get(c, a = 1, tf = null) {
    const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
    const ai = Math.round(a * 100);
    const key = ((r * 256 + g) * 256 + b) * 101 + ai;
    if (key !== this.key) {
      this.key = key;
      if (tf) {
        const d = tf([r, g, b]);
        this.str = rgb(d, ai / 100);
      } else this.str = ai >= 100 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${ai / 100})`;
    }
    return this.str;
  }
}

/** HSL (0..360, 0..1, 0..1) → RGB triple. */
export function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
