/**
 * Parallax backgrounds and ground/ceiling bands. Backgrounds are drawn in logical screen space
 * (1920×1080) with per-layer horizontal parallax; geometry is generated once per style with a
 * seeded PRNG and reused every frame (Path2D), colours come from the live colour channels.
 */
import { VIEW_W, VIEW_H, BLOCK } from './config.js';
import { mulberry32 } from './particles.js';
import { rgb, darken, lighten, mix } from './color.js';
import { makeCanvas } from './icons.js';

export const BG_STYLES = ['stars', 'city', 'grid', 'hex', 'gears', 'waves', 'circuit'];
export const GROUND_STYLES = ['tiles', 'stripes', 'hex', 'grid', 'plain'];

const TILE = 2400;
const gen = new Map();

/**
 * Derived palette (CSS strings + gradients) for the current channel colours. Rebuilt only when
 * the rounded colours change, so steady frames allocate nothing.
 */
export class BgPalette {
  constructor() { this.key = ''; this.version = 0; }
  update(ctx, bg, ground, line) {
    const key = `${bg.map(Math.round)}|${ground.map(Math.round)}|${line.map(Math.round)}`;
    if (key === this.key) return;
    this.key = key;
    this.version++;
    const top = darken(bg, 0.62);
    this.bgRgb = bg.slice(); this.lineRgb = line.slice();
    this.top = rgb(top);
    this.grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    this.grad.addColorStop(0, this.top);
    this.grad.addColorStop(1, rgb(bg));
    this.l1 = rgb(lighten(bg, 0.12), 0.5);
    this.l2 = rgb(lighten(bg, 0.22), 0.55);
    this.l3 = rgb(darken(bg, 0.45), 0.92);
    this.acc = rgb(line, 0.45);
    this.star = rgb(lighten(bg, 0.7), 0.7);
    this.sun = rgb(mix(line, [255, 230, 120], 0.4), 0.85);
    this.line = rgb(line);
    this.lineHi = rgb(lighten(line, 0.45));
    this.glow = rgb(line, 0.35);
    this.groundPat = rgb(lighten(ground, 0.25), 0.55);
    this.blobLine = blob(lighten(line, 0.1));
    this.blobBg = blob(lighten(bg, 0.4));
    this.groundGrad = [];
    for (const dir of [1, -1]) {
      const g = ctx.createLinearGradient(0, 0, 0, dir * 260);
      g.addColorStop(0, rgb(ground));
      g.addColorStop(1, rgb(darken(ground, 0.55)));
      this.groundGrad.push(g);
    }
  }
}
const blobs = new Map();

function geometry(style) {
  let g = gen.get(style);
  if (g) return g;
  const r = mulberry32(style.length * 7919 + style.charCodeAt(0));
  g = { stars: [], shapes: [], paths: [] };
  for (let i = 0; i < 140; i++) g.stars.push([r() * TILE, r() * VIEW_H * 0.85, 0.6 + r() * 2.2, r() * 6.28]);
  switch (style) {
    case 'city':
      for (let layer = 0; layer < 3; layer++) {
        const p = new Path2D();
        const win = [];
        let x = 0;
        const base = VIEW_H;
        p.moveTo(0, base);
        while (x < TILE) {
          const w = 60 + r() * (110 + layer * 40);
          const h = 160 + r() * (260 + layer * 120) - layer * 40;
          p.lineTo(x, base - h);
          if (r() < 0.3) { p.lineTo(x + w * 0.45, base - h); p.lineTo(x + w * 0.5, base - h - 50); p.lineTo(x + w * 0.55, base - h); }
          p.lineTo(x + w, base - h);
          if (layer === 1) for (let k = 0; k < 6; k++) win.push([x + 10 + r() * (w - 24), base - h + 20 + r() * (h - 60), r()]);
          x += w;
        }
        p.lineTo(TILE, base);
        p.closePath();
        g.paths.push({ p, win });
      }
      break;
    case 'grid': {
      const p = new Path2D();
      let x = 0;
      p.moveTo(0, 700);
      while (x < TILE) { x += 80 + r() * 160; p.lineTo(x, 700 - 60 - r() * 220); x += 80 + r() * 160; p.lineTo(x, 700 - r() * 40); }
      p.lineTo(TILE, 700); p.closePath();
      g.paths.push({ p });
      break;
    }
    case 'gears':
      for (let i = 0; i < 9; i++) g.shapes.push([r() * TILE, 150 + r() * 700, 60 + r() * 150, (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.6), 8 + Math.floor(r() * 6), i % 2]);
      break;
    case 'circuit':
      for (let i = 0; i < 26; i++) {
        const pts = [];
        let x = r() * TILE, y = 80 + r() * 800;
        pts.push(x, y);
        for (let k = 0; k < 4; k++) {
          if (k % 2 === 0) x += 80 + r() * 220; else y += (r() - 0.5) * 220;
          pts.push(x, y);
        }
        g.shapes.push(pts);
      }
      break;
    default:
      for (let i = 0; i < 18; i++) g.shapes.push([r() * TILE, r() * VIEW_H * 0.8, 30 + r() * 120, r() * 6.28, (r() - 0.5) * 0.4, i % 3]);
  }
  gen.set(style, g);
  return g;
}

/** Soft radial blob sprite, cached per quantised colour. */
function blob(c) {
  const key = Math.round(c[0] / 16) * 289 + Math.round(c[1] / 16) * 17 + Math.round(c[2] / 16);
  let s = blobs.get(key);
  if (s) return s;
  if (blobs.size > 64) blobs.clear();
  s = makeCanvas(128, 128);
  const ctx = s.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgb(c, 0.55));
  gr.addColorStop(1, rgb(c, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  blobs.set(key, s);
  return s;
}

/** Offset of a parallax layer into its repeating tile. */
function scroll(camX, factor) {
  const o = (camX * factor) % TILE;
  return o < 0 ? o + TILE : o;
}

/**
 * Draws the background. `camX`/`camY` are the camera position in logical px, `pulse` 0..1 beat
 * intensity, `t` seconds for idle animation. `pal` is a BgPalette.
 */
export function drawBackground(ctx, style, pal, camX, camY, pulse, t) {
  const g = geometry(style);
  ctx.fillStyle = pal.grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const { l1, l2, l3, acc } = pal;
  const yOff = -camY * 0.04;

  // Far stars for every style.
  const so = scroll(camX, 0.03);
  ctx.fillStyle = pal.star;
  for (const s of g.stars) {
    let x = s[0] - so;
    if (x < -10) x += TILE;
    if (x > VIEW_W + 10) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + s[3]);
    const sz = s[2] * (0.6 + tw * 0.6);
    ctx.fillRect(x, s[1] + yOff, sz, sz);
  }

  switch (style) {
    case 'city': {
      ctx.drawImage(pal.blobLine, VIEW_W * 0.62 - 300, 120 + yOff - 300, 600, 600);
      const fs = [0.08, 0.2, 0.4];
      const cols = [l1, l2, l3];
      for (let i = 0; i < 3; i++) {
        const o = scroll(camX, fs[i]);
        const dy = 120 - i * 40 + yOff * (i + 1);
        ctx.fillStyle = cols[i];
        for (let k = 0; k < 2; k++) {
          ctx.save();
          ctx.translate(-o + k * TILE, dy);
          ctx.fill(g.paths[i].p);
          if (i === 1) {
            ctx.fillStyle = acc;
            for (const w of g.paths[i].win) if (w[2] > 0.35) ctx.fillRect(w[0], w[1], 10, 14);
            ctx.fillStyle = cols[i];
          }
          ctx.restore();
        }
      }
      break;
    }
    case 'grid': {
      const hy = 700 + yOff;
      ctx.drawImage(pal.blobLine, VIEW_W / 2 - 380, hy - 560, 760, 760);
      ctx.fillStyle = pal.sun;
      ctx.beginPath(); ctx.arc(VIEW_W / 2, hy - 160, 170, Math.PI, 0); ctx.fill();
      ctx.fillStyle = pal.top;
      for (let i = 0; i < 6; i++) ctx.fillRect(VIEW_W / 2 - 180, hy - 150 - i * 26, 360, 4 + i * 1.5);
      const o = scroll(camX, 0.1);
      ctx.fillStyle = l3;
      for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(-o + k * TILE, yOff); ctx.fill(g.paths[0].p); ctx.restore(); }
      ctx.strokeStyle = acc;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const go = scroll(camX, 0.5) % 160;
      for (let i = -14; i <= 14; i++) { const x = VIEW_W / 2 + i * 160 - go; ctx.moveTo(VIEW_W / 2 + (x - VIEW_W / 2) * 0.2, hy); ctx.lineTo(x * 2.2 - VIEW_W * 0.6, VIEW_H); }
      for (let i = 0; i < 9; i++) { const y = hy + Math.pow(i / 9, 2) * (VIEW_H - hy); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); }
      ctx.stroke();
      break;
    }
    case 'hex': {
      for (let layer = 0; layer < 2; layer++) {
        const size = layer ? 120 : 64;
        const o = scroll(camX, layer ? 0.3 : 0.12) % (size * 3);
        ctx.strokeStyle = layer ? l2 : l1;
        ctx.lineWidth = layer ? 3 : 2;
        ctx.beginPath();
        const hgt = size * Math.sqrt(3);
        for (let x = -size * 3; x < VIEW_W + size * 3; x += size * 3) {
          for (let y = -hgt; y < VIEW_H + hgt; y += hgt) {
            for (let h2 = 0; h2 < 2; h2++) {
              const cx = x + h2 * size * 1.5 - o, cy = y + h2 * hgt * 0.5 + yOff * (layer + 1);
              if (layer && ((Math.floor(x / size) + Math.floor(y / hgt)) % 3)) continue;
              for (let i = 0; i <= 6; i++) {
                const a = (i * Math.PI) / 3;
                const px = cx + Math.cos(a) * size * 0.92, py = cy + Math.sin(a) * size * 0.92;
                if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
              }
            }
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.25 + pulse * 0.5;
      ctx.drawImage(pal.blobLine, VIEW_W * 0.25, 100, 900, 900);
      ctx.globalAlpha = 1;
      break;
    }
    case 'gears': {
      for (const s of g.shapes) {
        const f = s[5] ? 0.35 : 0.15;
        let x = s[0] - scroll(camX, f);
        if (x < -300) x += TILE;
        if (x > VIEW_W + 300) continue;
        drawGear(ctx, x, s[1] + yOff * (s[5] + 1), s[2], s[4], t * s[3] + camX * 0.0004 * s[3], s[5] ? l2 : l1);
      }
      break;
    }
    case 'waves': {
      for (let layer = 0; layer < 4; layer++) {
        const o = camX * (0.05 + layer * 0.08);
        ctx.fillStyle = layer === 3 ? l3 : layer % 2 ? l2 : l1;
        ctx.beginPath();
        const base = 420 + layer * 140 + yOff * (layer + 1);
        ctx.moveTo(0, VIEW_H);
        for (let x = 0; x <= VIEW_W; x += 40) {
          ctx.lineTo(x, base + Math.sin((x + o) * 0.004 + layer + t * 0.6) * (40 + layer * 12) + Math.sin((x + o) * 0.011 + layer * 2) * 16);
        }
        ctx.lineTo(VIEW_W, VIEW_H);
        ctx.fill();
      }
      break;
    }
    case 'circuit': {
      const o = scroll(camX, 0.2);
      ctx.strokeStyle = l2;
      ctx.lineWidth = 3;
      ctx.fillStyle = acc;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (const pts of g.shapes) {
          for (let i = 0; i < pts.length; i += 2) {
            const x = pts[i] - o + k * TILE, y = pts[i + 1] + yOff;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
        for (const pts of g.shapes) {
          const x = pts[pts.length - 2] - o + k * TILE;
          if (x < -20 || x > VIEW_W + 20) continue;
          ctx.fillRect(x - 6, pts[pts.length - 1] + yOff - 6, 12, 12);
          const q = (t * 0.4 + pts[0] * 0.001) % 1;
          const seg = Math.min(pts.length / 2 - 2, Math.floor(q * (pts.length / 2 - 1)));
          const f = q * (pts.length / 2 - 1) - seg;
          const px = pts[seg * 2] + (pts[seg * 2 + 2] - pts[seg * 2]) * f - o + k * TILE;
          const py = pts[seg * 2 + 1] + (pts[seg * 2 + 3] - pts[seg * 2 + 1]) * f + yOff;
          ctx.fillRect(px - 4, py - 4, 8, 8);
        }
      }
      break;
    }
    default: {
      ctx.drawImage(pal.blobLine, VIEW_W * 0.55 - 450, 40 + yOff, 900, 900);
      ctx.drawImage(pal.blobBg, VIEW_W * 0.1 - 300, 300 + yOff, 600, 600);
      for (const s of g.shapes) {
        const f = 0.08 + s[5] * 0.12;
        let x = s[0] - scroll(camX, f);
        if (x < -200) x += TILE;
        if (x > VIEW_W + 200) continue;
        ctx.save();
        ctx.translate(x, s[1] + yOff * (s[5] + 1));
        ctx.rotate(s[3] + t * s[4]);
        ctx.strokeStyle = s[5] === 2 ? l2 : l1;
        ctx.lineWidth = 3 + s[5];
        const sz = s[2] * (1 + pulse * 0.06);
        ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
    }
  }
}

function drawGear(ctx, x, y, r, teeth, a, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const ang = a + (i * Math.PI) / teeth;
    const rr = i % 2 ? r : r * 1.18;
    const a0 = ang - Math.PI / teeth / 2, a1 = ang + Math.PI / teeth / 2;
    ctx.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
    ctx.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.moveTo(x + r * 0.4, y);
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
}

/**
 * Ground band below `edgeSy` (dir = 1) or ceiling band above it (dir = -1), in logical screen
 * space. `scrollX` is the screen-left world x in logical px (for the scrolling tile pattern).
 */
export function drawGround(ctx, style, pal, edgeSy, dir, scrollX, scale, pulse) {
  const y0 = dir > 0 ? edgeSy : 0;
  const y1 = dir > 0 ? VIEW_H : edgeSy;
  if (y1 <= y0) return;
  ctx.translate(0, edgeSy);
  ctx.fillStyle = pal.groundGrad[dir > 0 ? 0 : 1];
  ctx.fillRect(0, y0 - edgeSy, VIEW_W, y1 - y0);
  ctx.translate(0, -edgeSy);
  const tile = BLOCK * 4 * scale;
  const off = ((scrollX % tile) + tile) % tile;
  ctx.strokeStyle = pal.groundPat;
  ctx.lineWidth = 3;
  ctx.beginPath();
  switch (style) {
    case 'stripes':
      for (let x = -off - tile; x < VIEW_W + tile; x += tile / 2) { ctx.moveTo(x, edgeSy); ctx.lineTo(x + tile * 0.6, edgeSy + dir * tile); }
      break;
    case 'hex':
      for (let x = -off; x < VIEW_W + tile; x += tile / 2) {
        const yy = edgeSy + dir * tile * 0.35;
        ctx.moveTo(x, yy); ctx.lineTo(x + tile * 0.12, edgeSy + dir * tile * 0.15); ctx.lineTo(x + tile * 0.38, edgeSy + dir * tile * 0.15);
        ctx.lineTo(x + tile * 0.5, yy); ctx.lineTo(x + tile * 0.38, edgeSy + dir * tile * 0.55); ctx.lineTo(x + tile * 0.12, edgeSy + dir * tile * 0.55); ctx.closePath();
      }
      break;
    case 'grid':
      for (let x = -off; x < VIEW_W + tile; x += tile / 4) { ctx.moveTo(x, edgeSy); ctx.lineTo(x, dir > 0 ? VIEW_H : 0); }
      for (let k = 1; k < 6; k++) { const yy = edgeSy + (dir * k * tile) / 4; ctx.moveTo(0, yy); ctx.lineTo(VIEW_W, yy); }
      break;
    case 'plain':
      break;
    default:
      for (let x = -off; x < VIEW_W + tile; x += tile) ctx.rect(x + 6, edgeSy + (dir > 0 ? 8 : -8 - tile + 12), tile - 12, tile - 12);
  }
  ctx.stroke();
  // Glowing edge line.
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.fillStyle = pal.glow;
  ctx.fillRect(0, edgeSy - 7, VIEW_W, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.lineHi;
  ctx.fillRect(0, edgeSy - 2, VIEW_W, 4);
}
