/**
 * Decoration drawing (no collision). Called by the renderer with the world transform active.
 */
import { BLOCK } from './config.js';

const DEG = Math.PI / 180;

export function drawDeco(r, o, sc) {
  const ctx = r.ctx;
  const style = o.def.style;
  const color = o.color || r.decoColor;
  ctx.globalAlpha = o.alpha * (o.enabled ? 1 : 0.35);
  if (style === 'text') {
    const t = (o.props && o.props.text) || '';
    const size = ((o.props && o.props.size) || 30) * (r.s / 3.25);
    r.worldText(t, o.x, o.y, size, color, ctx.globalAlpha);
    r.toWorld();
    return;
  }
  if (style === 'fake') {
    const list = [o];
    r.drawSolidList(list, 0, 1, sc.pulse, o.alpha);
    return;
  }
  ctx.save();
  ctx.translate(o.x - r.cx, o.y - r.cy);
  ctx.rotate(-o.rot * DEG);
  const u = BLOCK * o.scale;
  ctx.scale(u, u);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const lw = (w) => { ctx.lineWidth = w / (r.s * u) ; };
  switch (style) {
    case 'line':
      ctx.globalAlpha *= 0.35; lw(10); ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.lineTo(0.5, 0); ctx.stroke();
      ctx.globalAlpha /= 0.35; lw(3); ctx.stroke();
      break;
    case 'pillar': {
      ctx.globalAlpha *= 0.55;
      ctx.fillRect(-0.18, -0.5, 0.36, 1);
      ctx.globalAlpha /= 0.55;
      lw(2); ctx.strokeRect(-0.18, -0.5, 0.36, 1);
      break;
    }
    case 'chain':
      lw(3);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0.33 - i * 0.33, i % 2 ? 0.06 : 0.12, 0.18, 0, 0, Math.PI * 2); ctx.stroke(); }
      break;
    case 'arrow':
      ctx.globalAlpha *= 0.85 + sc.pulse * 0.15;
      lw(5);
      ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.lineTo(0.3, 0); ctx.moveTo(0.05, -0.25); ctx.lineTo(0.3, 0); ctx.lineTo(0.05, 0.25); ctx.stroke();
      break;
    case 'sparkle': {
      const k = 0.6 + 0.4 * Math.sin(sc.time * 3 + o.x * 0.01);
      ctx.globalAlpha *= k;
      ctx.beginPath();
      ctx.moveTo(0, 0.4); ctx.quadraticCurveTo(0, 0, 0.4, 0); ctx.quadraticCurveTo(0, 0, 0, -0.4);
      ctx.quadraticCurveTo(0, 0, -0.4, 0); ctx.quadraticCurveTo(0, 0, 0, 0.4); ctx.fill();
      break;
    }
    case 'ring':
      ctx.rotate(sc.time * 0.8);
      lw(4); ctx.setLineDash([0.25, 0.12]);
      ctx.beginPath(); ctx.arc(0, 0, 0.85 * (1 + sc.pulse * 0.08), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'gear': {
      ctx.rotate(sc.time * 1.2);
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      const n = 10;
      for (let i = 0; i < n * 2; i++) {
        const a = (i * Math.PI) / n;
        const rr = i % 2 ? 0.72 : 0.9;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.moveTo(0.3, 0); ctx.arc(0, 0, 0.3, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      break;
    }
    case 'beat': {
      const k = 0.35 + sc.pulse * 0.65;
      ctx.globalAlpha *= k * 0.4;
      ctx.beginPath(); ctx.arc(0, 0, 0.45 + sc.pulse * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.4;
      ctx.beginPath(); ctx.arc(0, 0, 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'diamond':
      lw(3); ctx.beginPath(); ctx.moveTo(0, 0.45); ctx.lineTo(0.3, 0); ctx.lineTo(0, -0.45); ctx.lineTo(-0.3, 0); ctx.closePath(); ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}
