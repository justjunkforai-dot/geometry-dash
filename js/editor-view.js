/**
 * Editor overlays drawn on top of the level (grid, trigger badges, groups, selection, ghost
 * of the item being placed, box selection) and palette thumbnails.
 */
import { BLOCK, COLORS, START_X } from './config.js';
import { getDef } from './objects.js';
import { makeCanvas } from './icons.js';
import { sawSprite, padSprite, orbSprite, portalSprite, coinSprite } from './objsprites.js';

export const TRIGGER_STYLE = {
  color: ['C', '#ff9f1c'], move: ['M', '#3dd6ff'], rotate: ['R', '#a05bff'], scale: ['S', '#3dff9e'],
  alpha: ['A', '#c8c8ff'], toggle: ['T', '#ff5a88'], pulse: ['P', '#ffd500'], zoom: ['Z', '#7df9ff'],
  shake: ['~', '#ff3b3b'], particles: ['✦', '#ffffff'],
};

const thumbs = new Map();

/** 64×64 canvas preview of an object type for the palette and the placement ghost. */
export function thumb(def) {
  let c = thumbs.get(def.id);
  if (c) return c;
  c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  const fit = (s) => {
    const k = Math.min(56 / s.canvas.width, 56 / s.canvas.height);
    ctx.drawImage(s.canvas, (-s.canvas.width * k) / 2, (-s.canvas.height * k) / 2, s.canvas.width * k, s.canvas.height * k);
  };
  const q = 64;
  ctx.lineJoin = 'round';
  switch (def.kind) {
    case 'solid': case 'slope': {
      ctx.fillStyle = '#152a40';
      ctx.strokeStyle = '#5ef1ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (def.kind === 'slope') { const w = def.w === 2 ? 26 : 20; ctx.moveTo(-w, 20); ctx.lineTo(w, 20); ctx.lineTo(w, def.w === 2 ? 0 : -20); }
      else { const b = def.solid; ctx.rect(b[0] * 40, -b[3] * 40, (b[2] - b[0]) * 40, (b[3] - b[1]) * 40); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'spike': {
      const t = def.tri;
      ctx.beginPath(); ctx.moveTo(t[0] * 44, -t[1] * 44); ctx.lineTo(t[2] * 44, -t[3] * 44); ctx.lineTo(t[4] * 44, -t[5] * 44); ctx.closePath();
      ctx.fillStyle = '#16081a'; ctx.fill();
      ctx.strokeStyle = COLORS.hazardEdge; ctx.lineWidth = 6; ctx.globalAlpha = 0.4; ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      break;
    }
    case 'saw': fit(sawSprite(def.radius, q)); break;
    case 'pad': fit(padSprite(def.color, q, false)); break;
    case 'orb': fit(orbSprite(def.color, q, false)); break;
    case 'portal': fit(portalSprite(def, q)); break;
    case 'coin': fit(coinSprite(q)); break;
    case 'end':
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -28, 8, 56);
      ctx.globalAlpha = 0.4; ctx.fillRect(-12, -28, 24, 56); ctx.globalAlpha = 1;
      break;
    case 'trigger': {
      const [l, col] = TRIGGER_STYLE[def.action] || ['?', '#fff'];
      badge(ctx, 0, 0, 22, col, l);
      break;
    }
    default: {
      ctx.strokeStyle = '#ff5ce1'; ctx.fillStyle = '#ff5ce1'; ctx.lineWidth = 3;
      const st = def.style;
      if (st === 'fake') { ctx.setLineDash([5, 4]); ctx.strokeRect(-20, -20, 40, 40); ctx.setLineDash([]); }
      else if (st === 'text') { ctx.font = '800 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Aa', 0, 2); }
      else if (st === 'arrow') { ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(6, -12); ctx.lineTo(18, 0); ctx.lineTo(6, 12); ctx.stroke(); }
      else if (st === 'chain') { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -16 + i * 16, 6, 9, 0, 0, Math.PI * 2); ctx.stroke(); } }
      else if (st === 'gear' || st === 'ring') { ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke(); }
      else if (st === 'pillar') ctx.strokeRect(-6, -24, 12, 48);
      else if (st === 'line') { ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke(); }
      else if (st === 'beat') { ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(12, 0); ctx.lineTo(0, 20); ctx.lineTo(-12, 0); ctx.closePath(); ctx.stroke(); }
    }
  }
  thumbs.set(def.id, c);
  return c;
}

function badge(ctx, x, y, r, col, label) {
  ctx.fillStyle = 'rgba(10,8,24,0.85)';
  ctx.strokeStyle = col;
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = `900 ${r * 1.2}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + r * 0.08);
}

/** Draws every editor overlay; called by the renderer's `over` hook with the world transform. */
export function drawEditorOverlay(ed, r) {
  const ctx = r.ctx;
  const [vx0, vy0, vx1, vy1] = r.viewRect(BLOCK);
  const cx = r.cx, cy = r.cy;
  r.toWorld();
  // Grid.
  ctx.lineWidth = 1 / r.s;
  for (const [step, alpha] of [[BLOCK, 0.07], [BLOCK * 4, 0.16]]) {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    for (let x = Math.floor(vx0 / step) * step; x <= vx1; x += step) { ctx.moveTo(x - cx, vy0 - cy); ctx.lineTo(x - cx, vy1 - cy); }
    for (let y = Math.floor(vy0 / step) * step; y <= vy1; y += step) { ctx.moveTo(vx0 - cx, y - cy); ctx.lineTo(vx1 - cx, y - cy); }
    ctx.stroke();
  }
  // Start line.
  ctx.strokeStyle = '#3dff7a';
  ctx.lineWidth = 3 / r.s;
  ctx.beginPath(); ctx.moveTo(START_X - 15 - cx, vy0 - cy); ctx.lineTo(START_X - 15 - cx, vy1 - cy); ctx.stroke();
  const list = ed.list();
  // Triggers and group ids.
  for (const it of list) {
    const x = it.x * BLOCK, y = it.y * BLOCK;
    if (x < vx0 - BLOCK || x > vx1 + BLOCK) continue;
    const d = getDef(it.t);
    if (d.kind === 'trigger') {
      const sel = ed.selection.has(it.uid);
      if (sel) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.setLineDash([6 / r.s, 6 / r.s]);
        ctx.beginPath(); ctx.moveTo(x - cx, vy0 - cy); ctx.lineTo(x - cx, vy1 - cy); ctx.stroke();
        ctx.setLineDash([]);
      }
      const [l, col] = TRIGGER_STYLE[d.action] || ['?', '#fff'];
      ctx.save();
      r.ctx.setTransform(r.k * r.m, 0, 0, r.k, r.k * r.sx(x), r.k * r.sy(y));
      badge(ctx, 0, 0, 0.42 * BLOCK * r.s, col, l);
      const p = it.p || {};
      if (p.group) { ctx.font = `800 ${0.3 * BLOCK * r.s}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(`→${p.group}`, 0, 0.75 * BLOCK * r.s); }
      ctx.restore();
      r.toWorld();
    } else if (it.g && ed.showGroups !== false) {
      r.worldText(`${it.g}`, x - 9, y + 9, 0.3 * BLOCK * r.s, '#ffd500', 0.9);
      r.toWorld();
    }
  }
  // Selection and hover.
  ctx.lineWidth = 2.5 / r.s;
  ctx.strokeStyle = '#ffe14d';
  ctx.setLineDash([5 / r.s, 3 / r.s]);
  ctx.beginPath();
  for (const uid of ed.selection) {
    const it = ed.items.get(uid);
    if (!it) continue;
    const f = ed.footprint(it);
    ctx.rect((it.x - f.w / 2) * BLOCK - cx, (it.y - f.h / 2) * BLOCK - cy, f.w * BLOCK, f.h * BLOCK);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const c = ed.cursor;
  if (c.inside && !ed.drag) {
    if (ed.tool === 'build') drawGhost(ed, r, c);
    else {
      const h = ed.hit(c.x, c.y);
      if (h) {
        const f = ed.footprint(h);
        ctx.strokeStyle = ed.tool === 'delete' ? '#ff3b5c' : '#ffffff';
        ctx.lineWidth = 2 / r.s;
        ctx.strokeRect((h.x - f.w / 2) * BLOCK - cx, (h.y - f.h / 2) * BLOCK - cy, f.w * BLOCK, f.h * BLOCK);
      }
    }
  }
  const d = ed.drag;
  if (d && d.kind === 'box') {
    ctx.fillStyle = 'rgba(255,225,77,0.12)';
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2 / r.s;
    const x0 = Math.min(d.x0, d.x1) * BLOCK - cx, y0 = Math.min(d.y0, d.y1) * BLOCK - cy;
    const w = Math.abs(d.x1 - d.x0) * BLOCK, hh = Math.abs(d.y1 - d.y0) * BLOCK;
    ctx.fillRect(x0, y0, w, hh);
    ctx.strokeRect(x0, y0, w, hh);
  }
}

function drawGhost(ed, r, c) {
  const d = getDef(ed.current);
  const pos = ed.snapPos(d, c.x, c.y, d.kind === 'trigger' ? 0 : ed.rot);
  const q = ((ed.rot % 180) + 180) % 180 === 90 && d.kind !== 'trigger';
  const w = q ? d.h : d.w, h = q ? d.w : d.h;
  const ctx = r.ctx;
  r.toWorld();
  ctx.strokeStyle = 'rgba(125,249,255,0.9)';
  ctx.lineWidth = 2 / r.s;
  ctx.strokeRect((pos.x - w / 2) * BLOCK - r.cx, (pos.y - h / 2) * BLOCK - r.cy, w * BLOCK, h * BLOCK);
  ctx.globalAlpha = 0.55;
  const img = thumb(d);
  const size = Math.max(d.w, d.h) * BLOCK;
  r.sprite(img, pos.x * BLOCK, pos.y * BLOCK, size, size, d.kind === 'trigger' ? 0 : -ed.rot);
  ctx.globalAlpha = 1;
  r.toWorld();
}
