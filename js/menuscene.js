/**
 * Animated backdrop for menu screens: parallax background, scrolling ground and the player's
 * icon running and hopping over spikes in time with the menu music. Purely visual.
 */
import { BLOCK, VIEW_W } from './config.js';
import { drawBackground, drawGround } from './background.js';
import { hsl } from './color.js';

const SPIKE_GAP = 11 * BLOCK;

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.x = 0;
    this.style = 'grid';
    this.bg = [0, 0, 0]; this.ground = [0, 0, 0]; this.line = [0, 0, 0];
  }

  update(dt) {
    this.t += dt;
    this.x += 300 * dt;
    const hue = (250 + this.t * 6) % 360;
    this.bg = hsl(hue, 0.75, 0.16);
    this.ground = hsl(hue, 0.7, 0.22);
    this.line = hsl((hue + 150) % 360, 1, 0.65);
  }

  /** Cube y (units above ground) for the hop over each spike, a pure function of x. */
  cubeY(x) {
    const cx = x + 15;
    const k = Math.round(cx / SPIKE_GAP);
    const d = cx - k * SPIKE_GAP;
    const half = 2 * BLOCK;
    if (k <= 0 || Math.abs(d) > half) return 0;
    const u = (d + half) / (2 * half);
    return 4 * 66 * u * (1 - u);
  }

  render() {
    const r = this.app.renderer;
    const ctx = r.ctx;
    const a = this.app.audio;
    const pulse = a && a.musicPlaying() ? a.beatPulse() : 0;
    const camY = 150;
    r.setCamera(this.x + VIEW_W * 0.12 / r.s, camY, 1, 1);
    r.bgPal.update(ctx, this.bg, this.ground, this.line);
    r.toScreen();
    drawBackground(ctx, this.style, r.bgPal, r.cx * r.s, camY * r.s, pulse, this.t);
    // Spikes to hop over.
    r.toWorld();
    ctx.beginPath();
    const [x0, , x1] = r.viewRect(BLOCK);
    for (let k = Math.ceil(x0 / SPIKE_GAP); k * SPIKE_GAP < x1; k++) {
      const sx = k * SPIKE_GAP - r.cx;
      ctx.moveTo(sx - 15, -camY); ctx.lineTo(sx + 15, -camY); ctx.lineTo(sx, 30 - camY); ctx.closePath();
    }
    ctx.fillStyle = '#16081a';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 8 / r.s;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6 / r.s;
    ctx.stroke();
    r.toScreen();
    drawGround(ctx, 'tiles', r.bgPal, r.sy(0), 1, (r.cx * r.s - VIEW_W / 2), r.s, pulse);
    // The player's cube.
    const ic = this.app.iconStyle;
    const y = this.cubeY(this.x);
    const spr = r.icons.get('cube', ic.variants.cube || 0, ic.colors, 0, r.q, ic.glow);
    const rot = y > 0 ? -((this.x % SPIKE_GAP) / (4 * BLOCK)) * 360 : 0;
    r.sprite(spr.canvas, this.x + 15, y + 15, spr.w * BLOCK, spr.h * BLOCK, rot);
    r.toScreen();
  }
}
