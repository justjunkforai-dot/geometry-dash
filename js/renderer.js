/**
 * Canvas renderer. Logical resolution is 1920×1080; `k` maps logical px to device px. World
 * drawing uses one transform with y up and coordinates relative to the camera centre (keeps
 * float precision at large x). Blocks and spikes are batched into single paths per frame and
 * stroked in layers for the neon glow, so colour triggers cost nothing.
 */
import { VIEW_W, VIEW_H, CAMERA_SCALE, BLOCK, MINI_SCALE, COLORS, HAZARD_INSET } from './config.js';
import { IconCache } from './icons.js';
import { BgPalette, drawBackground, drawGround } from './background.js';
import { ColorCache, mix } from './color.js';
import { sawSprite, padSprite, orbSprite, orbRingSprite, portalSprite, coinSprite } from './objsprites.js';
import { drawDeco } from './deco.js';

const DEG = Math.PI / 180;
const GLOW_LAYERS = [
  [[3, 1]],
  [[9, 0.16], [3.2, 1]],
  [[15, 0.08], [7, 0.2], [3, 1], [1.1, 0.55]],
];
const SPIKE_GLOW = [[], [[9, 0.25]], [[14, 0.14], [6, 0.3]]];
const SPIKE_CORE = [[2.6, 1]];
const BLOCK_STYLES = ['neon', 'panel', 'brick'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.k = 1;
    this.icons = new IconCache();
    this.bgPal = new BgPalette();
    this.vis = new Array(16384);
    this.lists = {};
    for (const n of ['solid', 'solidA', 'slope', 'spike', 'spikeA', 'saw', 'pad', 'orb', 'portal', 'coin', 'end', 'decoB', 'decoM', 'decoF']) this.lists[n] = [];
    this.opt = { glow: 2, hitboxes: false, colorblind: false, reduceFlash: false };
    this.cc = { obj: new ColorCache(), fill: new ColorCache(), deco: new ColorCache(), line: new ColorCache() };
    this.dispFloor = 0;
    this.dispCeil = null;
    this.cx = 0; this.cy = 0; this.s = CAMERA_SCALE; this.m = 1; this.ox = VIEW_W / 2; this.oy = VIEW_H / 2;
  }

  resize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.k = w / VIEW_W;
  }

  /**
   * Sprite for an object type, memoised per def id so steady frames do no string building.
   * The memo is dropped when the sprite resolution or colour-blind mode changes.
   */
  objSprite(def) {
    const q = this.q, cb = this.opt.colorblind;
    if (q !== this.memoQ || cb !== this.memoCb) { this.memo = new Map(); this.memoQ = q; this.memoCb = cb; }
    let s = this.memo.get(def.id);
    if (!s) {
      switch (def.kind) {
        case 'saw': s = [sawSprite(def.radius, q)]; break;
        case 'pad': s = [padSprite(def.color, q, cb)]; break;
        case 'orb': s = [orbSprite(def.color, q, cb), orbRingSprite(def.color, q, cb)]; break;
        case 'portal': s = [portalSprite(def, q)]; break;
        default: s = [coinSprite(q)];
      }
      this.memo.set(def.id, s);
    }
    return s;
  }

  /** Device px per block at the current zoom (sprite resolution). */
  get q() { return Math.max(16, Math.round((this.k * this.s * BLOCK) / 8) * 8); }

  setCamera(cx, cy, zoom, mirror = 1, shx = 0, shy = 0) {
    this.cx = cx; this.cy = cy; this.s = CAMERA_SCALE * zoom; this.m = mirror;
    this.ox = VIEW_W / 2 + shx; this.oy = VIEW_H / 2 + shy;
  }

  toWorld() { this.ctx.setTransform(this.k * this.m * this.s, 0, 0, -this.k * this.s, this.k * this.ox, this.k * this.oy); }
  toScreen() { this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0); }
  sx(wx) { return this.ox + this.m * (wx - this.cx) * this.s; }
  sy(wy) { return this.oy - (wy - this.cy) * this.s; }
  /** World-space view rectangle with a margin (units). */
  viewRect(margin = 0) {
    const hw = VIEW_W / 2 / this.s + margin, hh = VIEW_H / 2 / this.s + margin;
    return [this.cx - hw, this.cy - hh, this.cx + hw, this.cy + hh];
  }

  clear(color = '#000') {
    this.toScreen();
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Draws an upright sprite centred at world (wx, wy) sized w×h units, rotated ccw `rot` deg. */
  sprite(img, wx, wy, w, h, rot = 0, flipY = false) {
    const ctx = this.ctx, k = this.k, s = this.s;
    ctx.setTransform(k * this.m, 0, 0, k, k * this.sx(wx), k * this.sy(wy));
    if (rot) ctx.rotate(-rot * DEG);
    if (flipY) ctx.scale(1, -1);
    ctx.drawImage(img, -w * s * 0.5, -h * s * 0.5, w * s, h * s);
  }

  worldText(text, wx, wy, size, color, alpha = 1, align = 'center') {
    const ctx = this.ctx;
    ctx.setTransform(this.k * this.m, 0, 0, this.k, this.k * this.sx(wx), this.k * this.sy(wy));
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.globalAlpha = 1;
  }

  /**
   * Draws a full scene. `sc`: { world, colors, bg, ground, cam:{x,y,zoom,mirror,shx,shy}, corridor,
   * time, pulse, dt, players:[{x,y,rot,mode,grav,mini,...}], coins, particles, icon, hooks, editor }
   */
  drawScene(sc) {
    const ctx = this.ctx;
    const col = sc.colors;
    this.setCamera(sc.cam.x, sc.cam.y, sc.cam.zoom, sc.cam.mirror, sc.cam.shx || 0, sc.cam.shy || 0);
    this.bgPal.update(ctx, col.bg, col.ground, col.line);
    this.toScreen();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.m !== 1) ctx.setTransform(this.k * this.m, 0, 0, this.k, this.k * (VIEW_W / 2) * (1 - this.m), 0);
    drawBackground(ctx, sc.bg, this.bgPal, sc.cam.x * this.s, sc.cam.y * this.s, sc.pulse, sc.time);
    this.collect(sc.world, sc.editor);
    this.objColor = this.cc.obj.get(col.obj);
    this.fillColor = this.cc.fill.get(mix(col.obj, [6, 4, 14], 0.86), 0.92);
    this.decoColor = this.cc.deco.get(col.deco);
    this.toWorld();
    this.drawDecoList(this.lists.decoB, sc);
    this.drawSolids(sc.pulse);
    this.drawSlopes();
    this.drawSpikes();
    this.drawSprites(sc);
    this.drawDecoList(this.lists.decoM, sc);
    if (sc.hooks && sc.hooks.under) sc.hooks.under(this);
    this.drawBands(sc);
    if (sc.players) for (const p of sc.players) this.drawPlayer(p, sc);
    if (sc.particles) {
      this.toScreen();
      sc.particles.draw(ctx, this.ox - this.m * this.cx * this.s, this.oy + this.cy * this.s, this.s, -1, this.m);
    }
    this.toWorld();
    this.drawDecoList(this.lists.decoF, sc);
    if (this.opt.hitboxes) this.drawHitboxes(sc);
    if (sc.hooks && sc.hooks.over) sc.hooks.over(this);
    this.toScreen();
  }

  collect(world, editor) {
    const L = this.lists;
    for (const k in L) L[k].length = 0;
    const [x0, y0, x1, y1] = this.viewRect(BLOCK);
    const n = world.collectVisible(x0, y0, x1, y1, this.vis);
    for (let i = 0; i < n; i++) {
      const o = this.vis[i];
      if (!o.enabled && !editor) continue;
      switch (o.kind) {
        case 'solid': (o.alpha < 0.999 ? L.solidA : L.solid).push(o); break;
        case 'spike': (o.alpha < 0.999 ? L.spikeA : L.spike).push(o); break;
        case 'deco': (o.layer === 'F' ? L.decoF : o.layer === 'M' ? L.decoM : L.decoB).push(o); break;
        case 'trigger': break;
        default: if (L[o.kind]) L[o.kind].push(o);
      }
    }
  }

  strokeLayers(layers, color, extraAlpha = 1) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    for (const [w, a] of layers) {
      ctx.lineWidth = w / this.s;
      ctx.globalAlpha = Math.min(1, a * extraAlpha);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  blockPath(list, from, to, edges) {
    const ctx = this.ctx, cx = this.cx, cy = this.cy;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const o = list[i];
      const x0 = o.minX - cx, x1 = o.maxX - cx, y0 = o.minY - cy, y1 = o.maxY - cy;
      if (!edges) { ctx.rect(x0, y0, x1 - x0, y1 - y0); continue; }
      const m = o.mask;
      if (!(m & 1)) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
      if (!(m & 2)) { ctx.moveTo(x1, y1); ctx.lineTo(x1, y0); }
      if (!(m & 4)) { ctx.moveTo(x1, y0); ctx.lineTo(x0, y0); }
      if (!(m & 8)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
    }
  }

  drawSolidList(list, from, to, pulse, alpha) {
    if (to <= from) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    this.blockPath(list, from, to, false);
    ctx.fillStyle = this.fillColor;
    ctx.fill();
    this.blockDetail(list, from, to);
    this.blockPath(list, from, to, true);
    this.strokeLayers(GLOW_LAYERS[this.opt.glow], this.objColor, alpha * (0.85 + pulse * 0.25));
  }

  /**
   * Bevel sheen and inner pattern of every block, batched into one fill and one stroke per
   * style (a drawImage per block is far slower on software rasterisers).
   */
  blockDetail(list, from, to) {
    const ctx = this.ctx, cx = this.cx, cy = this.cy;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const o = list[i];
      if (o.def.style === 'slab') continue;
      ctx.rect(o.minX - cx, o.maxY - cy - (o.maxY - o.minY) * 0.45, o.maxX - o.minX, (o.maxY - o.minY) * 0.45);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = BLOCK * 0.035;
    for (const style of BLOCK_STYLES) {
      let any = false;
      ctx.beginPath();
      for (let i = from; i < to; i++) {
        const o = list[i];
        const st = o.def.style === 'panel' || o.def.style === 'brick' ? o.def.style : 'neon';
        if (st !== style) continue;
        any = true;
        const x = (o.minX + o.maxX) / 2 - cx, y = (o.minY + o.maxY) / 2 - cy;
        const w = o.maxX - o.minX, h = o.maxY - o.minY;
        if (style === 'panel') {
          const a = w * 0.36, b = h * 0.36;
          ctx.rect(x - a, y - b, 2 * a, 2 * b);
          ctx.moveTo(x, y - b); ctx.lineTo(x, y + b); ctx.moveTo(x - a, y); ctx.lineTo(x + a, y);
        } else if (style === 'brick') {
          const top = o.maxY - cy, bot = o.minY - cy;
          ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
          ctx.moveTo(x, y); ctx.lineTo(x, bot);
          ctx.moveTo(x - w / 4, y); ctx.lineTo(x - w / 4, top); ctx.moveTo(x + w / 4, y); ctx.lineTo(x + w / 4, top);
        } else {
          const a = w * 0.32, b = Math.min(h, w) * 0.32;
          ctx.rect(x - a, y - b, 2 * a, 2 * b);
        }
      }
      if (any) ctx.stroke();
    }
  }

  drawSolids(pulse) {
    const L = this.lists;
    this.drawSolidList(L.solid, 0, L.solid.length, pulse, 1);
    for (let i = 0; i < L.solidA.length; i++) this.drawSolidList(L.solidA, i, i + 1, pulse, L.solidA[i].alpha);
  }

  drawSlopes() {
    const L = this.lists.slope;
    if (!L.length) return;
    const ctx = this.ctx, cx = this.cx, cy = this.cy;
    for (const o of L) {
      ctx.globalAlpha = o.alpha;
      ctx.beginPath();
      ctx.moveTo(o.hx0 - cx, o.hy0 - cy); ctx.lineTo(o.hx1 - cx, o.hy1 - cy); ctx.lineTo(o.rx - cx, o.ry - cy); ctx.closePath();
      ctx.fillStyle = this.fillColor;
      ctx.fill();
      // Outline the hypotenuse and only the legs nothing solid covers.
      const m = o.legMask | 0;
      ctx.beginPath();
      ctx.moveTo(o.hx0 - cx, o.hy0 - cy); ctx.lineTo(o.hx1 - cx, o.hy1 - cy);
      if (!(m & 2)) ctx.lineTo(o.rx - cx, o.ry - cy); else ctx.moveTo(o.rx - cx, o.ry - cy);
      if (!(m & 1)) ctx.lineTo(o.hx0 - cx, o.hy0 - cy);
      this.strokeLayers(GLOW_LAYERS[this.opt.glow], this.objColor, o.alpha);
    }
    ctx.globalAlpha = 1;
  }

  spikePath(list, from, to) {
    const ctx = this.ctx, cx = this.cx, cy = this.cy;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const t = list[i].vtri;
      ctx.moveTo(t[0] - cx, t[1] - cy); ctx.lineTo(t[2] - cx, t[3] - cy); ctx.lineTo(t[4] - cx, t[5] - cy); ctx.closePath();
    }
  }

  drawSpikeList(list, from, to, alpha) {
    if (to <= from) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    this.spikePath(list, from, to);
    ctx.fillStyle = '#16081a';
    ctx.fill();
    ctx.lineJoin = 'round';
    this.strokeLayers(SPIKE_GLOW[this.opt.glow], COLORS.hazardEdge, alpha);
    this.strokeLayers(SPIKE_CORE, COLORS.hazard, alpha);
  }

  drawSpikes() {
    const L = this.lists;
    this.drawSpikeList(L.spike, 0, L.spike.length, 1);
    for (let i = 0; i < L.spikeA.length; i++) this.drawSpikeList(L.spikeA, i, i + 1, L.spikeA[i].alpha);
  }

  drawSprites(sc) {
    const ctx = this.ctx, L = this.lists, t = sc.time;
    const B = BLOCK;
    for (const o of L.saw) {
      const s = this.objSprite(o.def)[0];
      ctx.globalAlpha = o.alpha;
      this.sprite(s.canvas, o.x, o.y, s.w * B * o.scale, s.h * B * o.scale, -t * 360 * (o.props && o.props.spin !== undefined ? o.props.spin : 1));
    }
    for (const o of L.pad) {
      const s = this.objSprite(o.def)[0];
      ctx.globalAlpha = o.alpha;
      this.sprite(s.canvas, o.x, o.y, s.w * B, s.h * B, -o.rot, o.fy);
    }
    for (const o of L.orb) {
      const [s, r] = this.objSprite(o.def);
      const sc2 = 1 + sc.pulse * 0.08;
      ctx.globalAlpha = o.alpha;
      this.sprite(r.canvas, o.x, o.y, r.w * B * sc2, r.h * B * sc2, t * 90);
      this.sprite(s.canvas, o.x, o.y, s.w * B * sc2, s.h * B * sc2, o.def.color === 'dash' ? -o.rot : 0);
    }
    for (const o of L.portal) {
      const s = this.objSprite(o.def)[0];
      ctx.globalAlpha = o.alpha;
      this.sprite(s.canvas, o.x, o.y, s.w * B, s.h * B, -o.rot, o.fy);
    }
    for (const o of L.coin) {
      const got = sc.coins && o.coinIndex >= 0 && sc.coins[o.coinIndex];
      const s = this.objSprite(o.def)[0];
      ctx.globalAlpha = got ? 0.25 : o.alpha;
      const w = Math.cos(t * 3 + o.x) * s.w * B;
      this.sprite(s.canvas, o.x, o.y + Math.sin(t * 2.4) * 3, Math.abs(w) < 4 ? 4 : w, s.h * B);
    }
    ctx.globalAlpha = 1;
    for (const o of L.end) this.drawEnd(o, sc);
    this.toWorld();
  }

  drawEnd(o, sc) {
    const ctx = this.ctx;
    this.toWorld();
    const x = o.x - this.cx;
    const [, y0, , y1] = this.viewRect(10);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.12 + i * 0.08 + sc.pulse * 0.1;
      ctx.fillStyle = this.objColor;
      const w = 40 - i * 9;
      ctx.fillRect(x - w / 2, y0 - this.cy, w, y1 - y0);
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, y0 - this.cy, 4, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawDecoList(list, sc) {
    if (!list.length) return;
    for (const o of list) drawDeco(this, o, sc);
    this.ctx.globalAlpha = 1;
    this.toWorld();
  }

  /** Ground and (in corridors) ceiling bands; their position eases for a sliding transition. */
  drawBands(sc) {
    const dt = Math.min(0.1, sc.dt || 0);
    const vh = VIEW_H / this.s;
    const tf = sc.corridor ? sc.corridor.floor : 0;
    const tc = sc.corridor ? sc.corridor.ceil : this.cy + vh * 0.5 + 60;
    if (sc.snapBands || this.dispCeil === null) { this.dispFloor = tf; this.dispCeil = tc; }
    const a = 1 - Math.exp(-14 * dt);
    this.dispFloor += (tf - this.dispFloor) * a;
    this.dispCeil += (tc - this.dispCeil) * a;
    this.toScreen();
    const scrollX = (this.cx * this.s - VIEW_W / 2) * this.m;
    const fy = this.sy(this.dispFloor);
    if (fy < VIEW_H) drawGround(this.ctx, sc.ground, this.bgPal, fy, 1, scrollX, this.s, sc.pulse);
    const cyS = this.sy(this.dispCeil);
    if (cyS > 0) drawGround(this.ctx, sc.ground, this.bgPal, cyS, -1, scrollX, this.s, sc.pulse);
    this.toWorld();
  }

  /** p: interpolated player view { x, y, rot, mode, grav, mini, twin, stride } */
  drawPlayer(p, sc) {
    const ic = sc.icon;
    const ctx = this.ctx;
    const scale = p.mini ? MINI_SCALE : 1;
    const variant = ic.variants[p.mode] || 0;
    const colors = p.twin ? ic.twinColors : ic.colors;
    const spr = this.icons.get(p.mode, variant, colors, ic.variants.cube || 0, this.q * scale, ic.glow && this.opt.glow > 0);
    const B = BLOCK * scale;
    if (ic.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      this.sprite(this.bgPal.blobLine, p.x, p.y, B * 2.4, B * 2.4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (p.mode === 'robot' || p.mode === 'spider') this.drawLegs(p, colors, B);
    let yOff = 0;
    if (p.mode === 'robot') yOff = 0.12 * B * p.grav;
    if (p.mode === 'spider') yOff = 0.05 * B * p.grav;
    if (p.mode === 'ship' || p.mode === 'ufo') yOff = -0.1 * B * p.grav;
    this.sprite(spr.canvas, p.x, p.y + yOff, spr.w * B, spr.h * B, p.rot, p.grav < 0);
  }

  drawLegs(p, colors, B) {
    const ctx = this.ctx;
    this.toWorld();
    const x = (p.x - this.cx) * 1, y = p.y - this.cy;
    const g = p.grav;
    const ph = p.stride || 0;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = B * 0.2;
    const legs = p.mode === 'robot' ? 2 : 3;
    const draw = (stroke, w) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < legs; i++) {
        const ofs = p.mode === 'robot' ? (i ? 0.18 : -0.18) : (i - 1) * 0.36;
        const sw = Math.sin(ph + i * Math.PI * (p.mode === 'robot' ? 1 : 0.66)) * (p.air ? 0 : 0.14);
        const hipX = x + ofs * B, hipY = y - 0.05 * B * g;
        const footX = hipX + sw * B, footY = y - 0.5 * B * g;
        const kneeX = (hipX + footX) / 2 + (p.mode === 'spider' ? 0.16 * B : 0.06 * B), kneeY = (hipY + footY) / 2 + (p.mode === 'spider' ? 0.12 * B * g : 0);
        ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY);
      }
      ctx.stroke();
    };
    draw('rgba(0,0,0,0.85)', B * 0.2);
    draw(colors.p2, B * 0.1);
  }

  drawHitboxes(sc) {
    const ctx = this.ctx, L = this.lists, cx = this.cx, cy = this.cy;
    this.toWorld();
    ctx.lineWidth = 2 / this.s;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3dff7a';
    ctx.beginPath();
    for (const o of L.solid) ctx.rect(o.minX - cx, o.minY - cy, o.maxX - o.minX, o.maxY - o.minY);
    for (const o of L.solidA) ctx.rect(o.minX - cx, o.minY - cy, o.maxX - o.minX, o.maxY - o.minY);
    for (const o of L.slope) { ctx.moveTo(o.hx0 - cx, o.hy0 - cy); ctx.lineTo(o.hx1 - cx, o.hy1 - cy); ctx.lineTo(o.rx - cx, o.ry - cy); ctx.closePath(); }
    ctx.stroke();
    ctx.strokeStyle = '#ff2a4a';
    ctx.beginPath();
    for (const list of [L.spike, L.spikeA]) for (const o of list) { const t = o.tri; ctx.moveTo(t[0] - cx, t[1] - cy); ctx.lineTo(t[2] - cx, t[3] - cy); ctx.lineTo(t[4] - cx, t[5] - cy); ctx.closePath(); }
    for (const o of L.saw) { ctx.moveTo(o.x - cx + o.r, o.y - cy); ctx.arc(o.x - cx, o.y - cy, o.r, 0, Math.PI * 2); }
    ctx.stroke();
    ctx.strokeStyle = '#33c6ff';
    ctx.beginPath();
    for (const list of [L.pad, L.portal]) for (const o of list) ctx.rect(o.minX - cx, o.minY - cy, o.maxX - o.minX, o.maxY - o.minY);
    ctx.stroke();
    ctx.strokeStyle = '#ffd500';
    ctx.beginPath();
    for (const list of [L.orb, L.coin]) for (const o of list) { ctx.moveTo(o.x - cx + o.r, o.y - cy); ctx.arc(o.x - cx, o.y - cy, o.r, 0, Math.PI * 2); }
    ctx.stroke();
    if (sc.players) {
      for (const p of sc.players) {
        ctx.strokeStyle = '#3dff7a';
        ctx.strokeRect(p.x - p.w / 2 - cx, p.y - p.h / 2 - cy, p.w, p.h);
        const ix = Math.min(HAZARD_INSET, p.w * 0.125 * 2), iy = Math.min(HAZARD_INSET, p.h * 0.125 * 2);
        ctx.strokeStyle = '#ff2a4a';
        ctx.strokeRect(p.x - p.w / 2 + ix - cx, p.y - p.h / 2 + iy - cy, p.w - ix * 2, p.h - iy * 2);
      }
    }
    if (sc.corridor) {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([8 / this.s, 6 / this.s]);
      const [x0, , x1] = this.viewRect(0);
      ctx.beginPath();
      ctx.moveTo(x0 - cx, sc.corridor.floor - cy); ctx.lineTo(x1 - cx, sc.corridor.floor - cy);
      ctx.moveTo(x0 - cx, sc.corridor.ceil - cy); ctx.lineTo(x1 - cx, sc.corridor.ceil - cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
