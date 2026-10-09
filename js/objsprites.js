/**
 * Cached sprites for fixed-colour objects (saws, pads, orbs, portals, coins) and neutral block
 * detail overlays. Sprites are drawn once per device resolution with baked glow (shadowBlur),
 * then blitted with drawImage. Every interactable carries a glyph so its function never relies
 * on colour alone.
 */
import { COLORS, COLORS_CB } from './config.js';
import { makeCanvas, drawIcon } from './icons.js';

const cache = new Map();

/** Returns a cached sprite { canvas, w, h } (w/h in blocks) built by `build(ctx, q)`. */
function sprite(key, wBlocks, hBlocks, q, build) {
  const k = `${key}|${q}`;
  let s = cache.get(k);
  if (s) return s;
  const cv = makeCanvas(Math.ceil(wBlocks * q), Math.ceil(hBlocks * q));
  const ctx = cv.getContext('2d');
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.scale(q, q);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  build(ctx, q);
  s = { canvas: cv, w: wBlocks, h: hBlocks };
  cache.set(k, s);
  return s;
}

export function clearSpriteCache() { cache.clear(); }

function glow(ctx, color, q, amt = 0.25) { ctx.shadowColor = color; ctx.shadowBlur = q * amt; }
function noGlow(ctx) { ctx.shadowBlur = 0; }

function chevron(ctx, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(-w, y + h * 0.5); ctx.lineTo(0, y - h * 0.5); ctx.lineTo(w, y + h * 0.5);
  ctx.stroke();
}

/** Glyphs shared by pads and orbs: up = launch strength, arrows = gravity. */
function glyph(ctx, kind, s, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 0.09 * s;
  switch (kind) {
    case 'yellow': chevron(ctx, 0, 0.2 * s, 0.22 * s); break;
    case 'pink': ctx.beginPath(); ctx.arc(0, 0, 0.09 * s, 0, Math.PI * 2); ctx.fill(); break;
    case 'red': chevron(ctx, -0.1 * s, 0.2 * s, 0.2 * s); chevron(ctx, 0.12 * s, 0.2 * s, 0.2 * s); break;
    case 'blue':
      ctx.beginPath();
      ctx.moveTo(-0.1 * s, 0.25 * s); ctx.lineTo(-0.1 * s, -0.2 * s); ctx.moveTo(-0.22 * s, -0.08 * s); ctx.lineTo(-0.1 * s, -0.22 * s); ctx.lineTo(0.02 * s, -0.08 * s);
      ctx.moveTo(0.12 * s, -0.25 * s); ctx.lineTo(0.12 * s, 0.2 * s); ctx.moveTo(0.0, 0.08 * s); ctx.lineTo(0.12 * s, 0.22 * s); ctx.lineTo(0.24 * s, 0.08 * s);
      ctx.stroke();
      break;
    case 'green':
      ctx.beginPath(); ctx.arc(0, 0, 0.2 * s, -Math.PI * 0.8, Math.PI * 0.6); ctx.stroke();
      chevron(ctx, -0.02 * s, 0.1 * s, 0.1 * s);
      break;
    case 'black': chevron(ctx, 0, 0.2 * s, -0.22 * s); break;
    case 'dash':
      ctx.beginPath(); ctx.moveTo(-0.1 * s, -0.2 * s); ctx.lineTo(0.15 * s, 0); ctx.lineTo(-0.1 * s, 0.2 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.26 * s, 0); ctx.lineTo(0.12 * s, 0); ctx.stroke();
      break;
    default: break;
  }
}

export function sawSprite(radius, q) {
  const box = radius * 2 + 0.6;
  return sprite(`saw${radius}`, box, box, q, (ctx) => {
    const r = radius;
    const teeth = Math.round(8 + radius * 8);
    glow(ctx, COLORS.hazardEdge, q, 0.3);
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const a2 = ((i + 0.55) / teeth) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#16121e';
    ctx.fill();
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = COLORS.saw;
    ctx.stroke();
    noGlow(ctx);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = COLORS.hazardEdge;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
      ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.hazardEdge;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
  });
}

function palette(cb) { return cb ? { pad: COLORS_CB.pad, orb: COLORS_CB.orb } : { pad: COLORS.pad, orb: COLORS.orb }; }

export function padSprite(color, q, cb) {
  return sprite(`pad${color}${cb ? 'cb' : ''}`, 1.4, 1.4, q, (ctx) => {
    const c = palette(cb).pad[color];
    glow(ctx, c, q, 0.35);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-0.46, 0.5);
    ctx.quadraticCurveTo(-0.42, 0.24, 0, 0.22);
    ctx.quadraticCurveTo(0.42, 0.24, 0.46, 0.5);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.04;
    ctx.stroke();
    // Light rays rising from the pad.
    const g = ctx.createLinearGradient(0, 0.25, 0, -0.35);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(-0.36, -0.35, 0.72, 0.6);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(0, 0.38);
    glyph(ctx, color, 0.55, '#141018');
    ctx.restore();
  });
}

export function orbSprite(color, q, cb) {
  return sprite(`orb${color}${cb ? 'cb' : ''}`, 1.6, 1.6, q, (ctx) => {
    const c = palette(cb).orb[color];
    const dark = color === 'black';
    glow(ctx, dark ? '#ffffff' : c, q, 0.4);
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = dark ? '#ffffff' : c;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.stroke();
    noGlow(ctx);
    const g = ctx.createRadialGradient(-0.1, -0.12, 0.02, 0, 0, 0.4);
    g.addColorStop(0, dark ? '#55556a' : '#ffffff');
    g.addColorStop(0.35, c);
    g.addColorStop(1, dark ? '#05050a' : c);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    glyph(ctx, color, 1, dark ? '#ffffff' : 'rgba(10,8,20,0.85)');
  });
}

/** Ring drawn rotating around orbs (separate so it can spin without re-baking). */
export function orbRingSprite(color, q, cb) {
  return sprite(`orbring${color}${cb ? 'cb' : ''}`, 1.6, 1.6, q, (ctx) => {
    const c = color === 'black' ? '#ffffff' : palette(cb).orb[color];
    ctx.strokeStyle = c;
    ctx.lineWidth = 0.035;
    ctx.setLineDash([0.12, 0.1]);
    ctx.beginPath(); ctx.arc(0, 0, 0.64, 0, Math.PI * 2); ctx.stroke();
  });
}

const PORTAL_GLYPH = {
  gravity: (ctx, v) => {
    ctx.beginPath();
    const d = v === 1 ? 1 : -1;
    ctx.moveTo(0, -0.35 * d); ctx.lineTo(0, 0.3 * d);
    ctx.moveTo(-0.18, 0.12 * d); ctx.lineTo(0, 0.32 * d); ctx.lineTo(0.18, 0.12 * d);
    ctx.stroke();
  },
  size: (ctx, v) => {
    const s = v ? 0.16 : 0.32;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
  },
  mirror: (ctx, v) => {
    ctx.beginPath();
    ctx.moveTo(-0.3, 0); ctx.lineTo(0.3, 0);
    ctx.moveTo(-0.15, -0.14); ctx.lineTo(-0.3, 0); ctx.lineTo(-0.15, 0.14);
    if (v) { ctx.moveTo(0.15, -0.14); ctx.lineTo(0.3, 0); ctx.lineTo(0.15, 0.14); }
    ctx.stroke();
  },
  dual: (ctx, v) => {
    ctx.strokeRect(-0.14, v ? -0.36 : -0.14, 0.28, 0.28);
    if (v) ctx.strokeRect(-0.14, 0.08, 0.28, 0.28);
  },
};

export function portalSprite(def, q) {
  const color = def.color === 'speed' ? COLORS.portal.speed[def.value] : COLORS.portal[def.color];
  if (def.action === 'speed') {
    return sprite(`speed${def.value}`, 1.8, 2.6, q, (ctx) => {
      glow(ctx, color, q, 0.35);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.13;
      const n = def.value + 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.22;
        ctx.beginPath(); ctx.moveTo(x - 0.15, -0.55); ctx.lineTo(x + 0.15, 0); ctx.lineTo(x - 0.15, 0.55); ctx.stroke();
      }
      noGlow(ctx);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 0.04;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.22;
        ctx.beginPath(); ctx.moveTo(x - 0.15, -0.55); ctx.lineTo(x + 0.15, 0); ctx.lineTo(x - 0.15, 0.55); ctx.stroke();
      }
    });
  }
  return sprite(`portal${def.id}`, 1.8, 3.6, q, (ctx) => {
    glow(ctx, color, q, 0.45);
    ctx.lineWidth = 0.16;
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 1.42, 0, 0, Math.PI * 2); ctx.stroke();
    noGlow(ctx);
    const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.3);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.36, 1.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 0.045;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.42, 1.42, 0, 0, Math.PI * 2); ctx.stroke();
    // Glyph in a dark badge.
    ctx.fillStyle = 'rgba(8,6,18,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    if (def.action === 'mode') {
      ctx.save();
      ctx.scale(0.42, 0.42);
      drawIcon(ctx, def.value, 0, { p1: color, p2: '#ffffff', g: color }, 0);
      ctx.restore();
    } else PORTAL_GLYPH[def.action](ctx, def.value);
  });
}

export function coinSprite(q) {
  return sprite('coin', 1.5, 1.5, q, (ctx) => {
    glow(ctx, COLORS.coin, q, 0.35);
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath(); ctx.arc(0, 0, 0.48, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = '#7a5200';
    ctx.beginPath(); ctx.arc(0, 0, 0.38, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.12 : 0.28;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}
