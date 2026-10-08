/**
 * Procedural player icons. Every mode has several variants drawn with canvas paths in a unit
 * space where 1 = one cube width (icons are centred on 0,0, facing right, gravity down).
 * Rendered icons are cached as glowing sprites keyed by mode/variant/colours/size.
 */

export const ICON_COUNTS = { cube: 12, ship: 8, ball: 7, ufo: 7, wave: 7, robot: 7, spider: 7, swing: 7 };
export const ICON_NAMES = {
  cube: ['Classic', 'Diamond', 'Cross', 'Target', 'Visor', 'Split', 'Circuit', 'Grin', 'Grid', 'Bolt', 'Star', 'Core'],
  ship: ['Dart', 'Rocket', 'Jet', 'Raptor', 'Manta', 'Arrowhead', 'Hammer', 'Comet'],
  ball: ['Spokes', 'Orbit', 'Segments', 'Spiral', 'Dots', 'Halves', 'Gear'],
  ufo: ['Saucer', 'Dome', 'Ringed', 'Crab', 'Disc', 'Lantern', 'Crown'],
  wave: ['Dart', 'Needle', 'Kite', 'Chevron', 'Fang', 'Prism', 'Shard'],
  robot: ['Unit', 'Visor', 'Tank', 'Antenna', 'Boxer', 'Owl', 'Knight'],
  spider: ['Crawler', 'Widow', 'Mite', 'Tick', 'Mantis', 'Crab', 'Drone'],
  swing: ['Rotor', 'Fan', 'Bat', 'Moth', 'Wing', 'Petal', 'Twin'],
};

/** Visual size of each mode's sprite box, in cube units (w, h). */
export const ICON_BOX = {
  cube: [1, 1], ship: [1.5, 1.1], ball: [1, 1], ufo: [1.35, 1.1], wave: [0.95, 0.75],
  robot: [1.1, 1.05], spider: [1.3, 0.95], swing: [1.25, 1.1],
};

const OUT = 'rgba(0,0,0,0.85)';

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function fillStroke(ctx, fill, lw = 0.07) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.stroke();
}

function rect(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

/** Cube face; also used inside ships/UFOs. Drawn in y-down canvas space. */
export function drawCube(ctx, v, c) {
  const s = 0.5;
  rect(ctx, -s, -s, 1, 1);
  fillStroke(ctx, c.p1, 0.09);
  ctx.fillStyle = c.p2;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.06;
  switch (v % ICON_COUNTS.cube) {
    case 0: rect(ctx, -0.3, -0.3, 0.6, 0.6); fillStroke(ctx, c.p2, 0.06); rect(ctx, -0.18, -0.16, 0.1, 0.14); ctx.fillStyle = OUT; ctx.fill(); rect(ctx, 0.08, -0.16, 0.1, 0.14); ctx.fill(); rect(ctx, -0.18, 0.08, 0.36, 0.07); ctx.fill(); break;
    case 1: poly(ctx, [0, -0.34, 0.34, 0, 0, 0.34, -0.34, 0]); fillStroke(ctx, c.p2); circle(ctx, 0, 0, 0.09); ctx.fillStyle = c.p1; ctx.fill(); break;
    case 2: poly(ctx, [-0.34, -0.22, -0.22, -0.34, 0, -0.12, 0.22, -0.34, 0.34, -0.22, 0.12, 0, 0.34, 0.22, 0.22, 0.34, 0, 0.12, -0.22, 0.34, -0.34, 0.22, -0.12, 0]); fillStroke(ctx, c.p2); break;
    case 3: rect(ctx, -0.34, -0.34, 0.68, 0.68); fillStroke(ctx, c.p2); rect(ctx, -0.21, -0.21, 0.42, 0.42); fillStroke(ctx, c.p1); rect(ctx, -0.08, -0.08, 0.16, 0.16); fillStroke(ctx, c.p2); break;
    case 4: rect(ctx, -0.4, -0.2, 0.8, 0.22); fillStroke(ctx, c.p2); rect(ctx, -0.3, 0.16, 0.6, 0.1); fillStroke(ctx, c.p2, 0.05); break;
    case 5: poly(ctx, [-0.5, 0.5, 0.5, -0.5, 0.5, 0.5]); fillStroke(ctx, c.p2, 0.05); rect(ctx, -0.1, -0.1, 0.2, 0.2); fillStroke(ctx, c.p1, 0.05); break;
    case 6:
      ctx.lineWidth = 0.08; ctx.strokeStyle = c.p2; ctx.beginPath();
      ctx.moveTo(-0.5, -0.2); ctx.lineTo(-0.2, -0.2); ctx.lineTo(-0.05, -0.35); ctx.lineTo(0.5, -0.35);
      ctx.moveTo(-0.5, 0.2); ctx.lineTo(0.1, 0.2); ctx.lineTo(0.25, 0.05); ctx.lineTo(0.5, 0.05);
      ctx.moveTo(-0.1, 0.5); ctx.lineTo(-0.1, 0.3); ctx.stroke();
      circle(ctx, 0.25, 0.05, 0.07); fillStroke(ctx, c.p2, 0.04); circle(ctx, -0.2, -0.2, 0.07); fillStroke(ctx, c.p2, 0.04);
      break;
    case 7:
      rect(ctx, -0.26, -0.24, 0.14, 0.18); fillStroke(ctx, c.p2, 0.05); rect(ctx, 0.12, -0.24, 0.14, 0.18); fillStroke(ctx, c.p2, 0.05);
      ctx.beginPath(); ctx.arc(0, 0.02, 0.26, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 0.09; ctx.strokeStyle = c.p2; ctx.stroke();
      break;
    case 8:
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { if ((i + j) % 2) continue; rect(ctx, -0.36 + i * 0.25, -0.36 + j * 0.25, 0.22, 0.22); fillStroke(ctx, c.p2, 0.04); }
      break;
    case 9: poly(ctx, [0.08, -0.4, -0.22, 0.05, -0.02, 0.05, -0.1, 0.4, 0.24, -0.08, 0.03, -0.08]); fillStroke(ctx, c.p2, 0.05); break;
    case 10: {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 0.16 : 0.38; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
      poly(ctx, pts); fillStroke(ctx, c.p2, 0.05);
      break;
    }
    default:
      circle(ctx, 0, 0, 0.3); fillStroke(ctx, c.p2); circle(ctx, 0, 0, 0.14); ctx.fillStyle = '#fff'; ctx.fill();
  }
}

function drawShip(ctx, v, c, cubeVariant) {
  // Small cube riding on top.
  ctx.save(); ctx.translate(-0.12, -0.28); ctx.scale(0.5, 0.5); drawCube(ctx, cubeVariant, c); ctx.restore();
  const hulls = [
    [-0.7, -0.05, 0.1, -0.05, 0.72, 0.18, 0.1, 0.42, -0.7, 0.42, -0.55, 0.18],
    [-0.72, 0, 0.35, 0, 0.72, 0.2, 0.35, 0.42, -0.72, 0.42, -0.6, 0.2],
    [-0.7, -0.12, -0.45, 0.02, 0.4, 0.02, 0.72, 0.22, 0.4, 0.42, -0.45, 0.42, -0.7, 0.52],
    [-0.72, -0.1, -0.2, 0.06, 0.25, -0.05, 0.72, 0.2, 0.25, 0.45, -0.2, 0.34, -0.72, 0.5],
    [-0.74, 0.25, -0.3, 0, 0.3, 0, 0.72, 0.25, 0.3, 0.45, -0.3, 0.45],
    [-0.72, 0.02, 0.0, 0.02, 0.72, 0.22, 0.0, 0.42, -0.72, 0.42, -0.3, 0.22],
    [-0.7, -0.02, 0.5, -0.02, 0.5, 0.1, 0.72, 0.1, 0.72, 0.36, 0.5, 0.36, 0.5, 0.44, -0.7, 0.44],
    [-0.74, 0.22, -0.2, -0.02, 0.45, 0.06, 0.72, 0.22, 0.45, 0.4, -0.2, 0.46],
  ];
  poly(ctx, hulls[v % hulls.length]);
  fillStroke(ctx, c.p1, 0.08);
  ctx.beginPath();
  ctx.moveTo(-0.45, 0.22); ctx.lineTo(0.3, 0.22);
  ctx.lineWidth = 0.09; ctx.strokeStyle = c.p2; ctx.stroke();
  rect(ctx, -0.78, 0.08, 0.12, 0.26); fillStroke(ctx, c.p2, 0.05);
}

function drawBall(ctx, v, c) {
  circle(ctx, 0, 0, 0.48); fillStroke(ctx, c.p1, 0.09);
  ctx.strokeStyle = c.p2; ctx.fillStyle = c.p2; ctx.lineWidth = 0.09;
  switch (v % ICON_COUNTS.ball) {
    case 0: ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 0.44, Math.sin(a) * 0.44); } ctx.stroke(); circle(ctx, 0, 0, 0.13); fillStroke(ctx, c.p2, 0.05); break;
    case 1: ctx.beginPath(); ctx.ellipse(0, 0, 0.4, 0.16, 0.6, 0, Math.PI * 2); ctx.stroke(); circle(ctx, 0, 0, 0.1); ctx.fill(); break;
    case 2: for (let i = 0; i < 6; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.42, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); ctx.closePath(); fillStroke(ctx, c.p2, 0.04); } break;
    case 3: ctx.beginPath(); for (let t = 0; t < 12; t += 0.2) { const r = t * 0.034; const a = t; if (t === 0) ctx.moveTo(0, 0); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); break;
    case 4: for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; circle(ctx, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.08); fillStroke(ctx, c.p2, 0.04); } break;
    case 5: ctx.beginPath(); ctx.arc(0, 0, 0.48, -Math.PI / 2, Math.PI / 2); ctx.closePath(); fillStroke(ctx, c.p2, 0.05); circle(ctx, 0, -0.2, 0.08); ctx.fillStyle = c.p1; ctx.fill(); break;
    default: for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((i * Math.PI) / 4); rect(ctx, -0.06, -0.44, 0.12, 0.14); fillStroke(ctx, c.p2, 0.03); ctx.restore(); } circle(ctx, 0, 0, 0.16); fillStroke(ctx, c.p2, 0.05);
  }
}

function drawUfo(ctx, v, c, cubeVariant) {
  ctx.save(); ctx.translate(0, -0.12); ctx.scale(0.46, 0.46); drawCube(ctx, cubeVariant, c); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, -0.12, 0.32, 0.3, 0, Math.PI, 0); ctx.fillStyle = 'rgba(180,240,255,0.25)'; ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = OUT; ctx.stroke();
  const w = [0.66, 0.6, 0.68, 0.62, 0.66, 0.5, 0.64][v % ICON_COUNTS.ufo];
  ctx.beginPath(); ctx.ellipse(0, 0.18, w, 0.2, 0, 0, Math.PI * 2); fillStroke(ctx, c.p1, 0.08);
  ctx.fillStyle = c.p2;
  switch (v % ICON_COUNTS.ufo) {
    case 0: for (let i = -2; i <= 2; i++) { circle(ctx, i * 0.22, 0.2, 0.05); ctx.fill(); } break;
    case 1: ctx.beginPath(); ctx.ellipse(0, 0.24, w * 0.6, 0.08, 0, 0, Math.PI * 2); fillStroke(ctx, c.p2, 0.04); break;
    case 2: ctx.beginPath(); ctx.ellipse(0, 0.18, w + 0.06, 0.06, 0, 0, Math.PI * 2); ctx.lineWidth = 0.05; ctx.strokeStyle = c.p2; ctx.stroke(); break;
    case 3: for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.3, 0.32); ctx.lineTo(s * 0.5, 0.5); ctx.lineWidth = 0.07; ctx.strokeStyle = c.p2; ctx.stroke(); } break;
    case 4: rect(ctx, -w * 0.8, 0.16, w * 1.6, 0.06); ctx.fill(); break;
    case 5: rect(ctx, -0.12, 0.32, 0.24, 0.16); fillStroke(ctx, c.p2, 0.04); break;
    default: poly(ctx, [-0.3, 0.05, -0.2, -0.1, 0, 0.02, 0.2, -0.1, 0.3, 0.05]); fillStroke(ctx, c.p2, 0.04);
  }
}

function drawWave(ctx, v, c) {
  const shapes = [
    [-0.45, -0.32, 0.45, 0, -0.45, 0.32, -0.25, 0],
    [-0.47, -0.18, 0.47, 0, -0.47, 0.18],
    [-0.45, 0, -0.05, -0.34, 0.47, 0, -0.05, 0.34],
    [-0.45, -0.34, 0.47, 0, -0.45, 0.34, -0.1, 0.12, -0.1, -0.12],
    [-0.45, -0.3, 0.1, -0.18, 0.47, 0, 0.1, 0.18, -0.45, 0.3, -0.2, 0],
    [-0.4, -0.3, 0.47, 0, -0.4, 0.3],
    [-0.45, -0.1, -0.1, -0.34, 0.47, 0, -0.1, 0.34, -0.45, 0.1],
  ];
  poly(ctx, shapes[v % shapes.length]);
  fillStroke(ctx, c.p1, 0.07);
  poly(ctx, [-0.2, -0.1, 0.2, 0, -0.2, 0.1]);
  ctx.fillStyle = c.p2; ctx.fill();
}

function drawRobotBody(ctx, v, c) {
  const k = v % ICON_COUNTS.robot;
  const hw = [0.4, 0.42, 0.48, 0.38, 0.45, 0.4, 0.42][k];
  rect(ctx, -hw, -0.5, hw * 2, 0.62); fillStroke(ctx, c.p1, 0.08);
  ctx.fillStyle = c.p2;
  switch (k) {
    case 0: rect(ctx, 0.0, -0.36, 0.3, 0.14); fillStroke(ctx, c.p2, 0.04); break;
    case 1: rect(ctx, -0.32, -0.34, 0.64, 0.16); fillStroke(ctx, c.p2, 0.04); break;
    case 2: rect(ctx, -0.4, -0.1, 0.8, 0.12); fillStroke(ctx, c.p2, 0.04); circle(ctx, 0.2, -0.3, 0.08); fillStroke(ctx, c.p2, 0.04); break;
    case 3: ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.lineTo(0, -0.66); ctx.lineWidth = 0.05; ctx.strokeStyle = OUT; ctx.stroke(); circle(ctx, 0, -0.68, 0.06); fillStroke(ctx, c.p2, 0.03); rect(ctx, 0.04, -0.34, 0.24, 0.12); fillStroke(ctx, c.p2, 0.04); break;
    case 4: rect(ctx, -0.55, -0.25, 0.14, 0.28); fillStroke(ctx, c.p2, 0.04); rect(ctx, 0.41, -0.25, 0.14, 0.28); fillStroke(ctx, c.p2, 0.04); rect(ctx, 0.05, -0.38, 0.22, 0.12); fillStroke(ctx, c.p2, 0.04); break;
    case 5: circle(ctx, -0.12, -0.28, 0.1); fillStroke(ctx, c.p2, 0.04); circle(ctx, 0.17, -0.28, 0.1); fillStroke(ctx, c.p2, 0.04); break;
    default: poly(ctx, [-0.3, -0.42, 0.3, -0.42, 0.3, -0.26, 0.06, -0.26, 0.06, -0.14, -0.06, -0.14, -0.06, -0.26, -0.3, -0.26]); fillStroke(ctx, c.p2, 0.04);
  }
}

function drawSpiderBody(ctx, v, c) {
  const k = v % ICON_COUNTS.spider;
  ctx.beginPath(); ctx.ellipse(-0.05, -0.12, [0.42, 0.46, 0.36, 0.4, 0.44, 0.48, 0.4][k], 0.3, 0, 0, Math.PI * 2); fillStroke(ctx, c.p1, 0.08);
  circle(ctx, 0.36, -0.08, 0.17); fillStroke(ctx, c.p1, 0.06);
  ctx.fillStyle = c.p2;
  switch (k) {
    case 0: circle(ctx, 0.42, -0.1, 0.06); ctx.fill(); break;
    case 1: poly(ctx, [-0.15, -0.3, -0.02, -0.12, -0.15, 0.06, -0.28, -0.12]); fillStroke(ctx, c.p2, 0.03); break;
    case 2: for (let i = 0; i < 3; i++) { circle(ctx, -0.3 + i * 0.18, -0.16, 0.05); ctx.fill(); } break;
    case 3: rect(ctx, -0.35, -0.2, 0.5, 0.08); ctx.fill(); break;
    case 4: ctx.beginPath(); ctx.moveTo(0.42, -0.2); ctx.lineTo(0.6, -0.42); ctx.lineWidth = 0.05; ctx.strokeStyle = c.p2; ctx.stroke(); break;
    case 5: circle(ctx, 0.4, -0.13, 0.05); ctx.fill(); circle(ctx, 0.44, -0.02, 0.04); ctx.fill(); break;
    default: rect(ctx, -0.25, -0.34, 0.3, 0.1); fillStroke(ctx, c.p2, 0.03);
  }
}

function drawSwing(ctx, v, c) {
  const k = v % ICON_COUNTS.swing;
  const wing = [
    [0, -0.1, -0.55, -0.45, -0.25, -0.05],
    [0, -0.1, -0.6, -0.35, -0.5, 0],
    [0, -0.1, -0.5, -0.5, -0.4, -0.2, -0.6, -0.1],
    [0, -0.1, -0.35, -0.5, -0.6, -0.2],
    [0.1, -0.1, -0.6, -0.3, -0.3, 0],
    [0, -0.1, -0.2, -0.55, -0.5, -0.4],
    [0, -0.12, -0.55, -0.3, -0.55, -0.1],
  ][k];
  for (const s of [1, -1]) {
    ctx.save(); ctx.scale(1, s);
    poly(ctx, wing); fillStroke(ctx, c.p2, 0.06);
    ctx.restore();
  }
  circle(ctx, 0.05, 0, 0.32); fillStroke(ctx, c.p1, 0.08);
  circle(ctx, 0.12, 0, 0.12); ctx.fillStyle = c.p2; ctx.fill();
}

/** Draws an icon in unit space (1 = cube width) at the current transform. */
export function drawIcon(ctx, mode, v, c, cubeVariant = 0) {
  switch (mode) {
    case 'ship': drawShip(ctx, v, c, cubeVariant); break;
    case 'ball': drawBall(ctx, v, c); break;
    case 'ufo': drawUfo(ctx, v, c, cubeVariant); break;
    case 'wave': drawWave(ctx, v, c); break;
    case 'robot': drawRobotBody(ctx, v, c); break;
    case 'spider': drawSpiderBody(ctx, v, c); break;
    case 'swing': drawSwing(ctx, v, c); break;
    default: drawCube(ctx, v, c);
  }
}

/** Cache of rendered icon sprites. */
export class IconCache {
  constructor() { this.map = new Map(); }

  /**
   * Returns { canvas, w, h } where w/h are the sprite's size in cube units (including glow
   * margin). `px` is the device pixel size of one cube unit.
   */
  get(mode, v, colors, cubeVariant, px, glow) {
    const q = Math.max(8, Math.round(px / 4) * 4);
    const key = `${mode}|${v}|${cubeVariant}|${colors.p1}|${colors.p2}|${colors.g}|${q}|${glow ? 1 : 0}`;
    let e = this.map.get(key);
    if (e) return e;
    if (this.map.size > 120) this.map.clear();
    const box = ICON_BOX[mode];
    const margin = 0.45;
    const w = box[0] + margin * 2, h = box[1] + margin * 2 + (mode === 'robot' ? 0.3 : 0);
    const cv = makeCanvas(Math.ceil(w * q), Math.ceil(h * q));
    const ctx = cv.getContext('2d');
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.scale(q, q);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (glow) {
      ctx.shadowColor = colors.g;
      ctx.shadowBlur = q * 0.35;
    }
    drawIcon(ctx, mode, v, colors, cubeVariant);
    ctx.shadowBlur = 0;
    // Redraw crisp on top so the glow does not soften the outline.
    if (glow) drawIcon(ctx, mode, v, colors, cubeVariant);
    e = { canvas: cv, w, h };
    this.map.set(key, e);
    return e;
  }
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}
