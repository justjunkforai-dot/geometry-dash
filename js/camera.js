/**
 * Game camera (part of the deterministic sim): follows the player with a speed-dependent
 * lookahead, a vertical dead zone in free modes and the corridor centre in flying modes.
 * Values are world units; `px/py/pzoom` hold the previous tick for render interpolation.
 */
import { DT, CAMERA, CAMERA_SCALE, VIEW_W, VIEW_H, PLAYER_SCREEN_X } from './config.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, px: 0, py: 0, pzoom: 1, ty: 0, look: 0 };
}

export const viewW = (c) => VIEW_W / (CAMERA_SCALE * c.zoom);
export const viewH = (c) => VIEW_H / (CAMERA_SCALE * c.zoom);

/** Vertical target: corridor centre (or clamped player y when the band is taller than the view). */
function targetY(sim) {
  const c = sim.camera;
  const vh = viewH(c);
  const cor = sim.corridor;
  if (cor) {
    const ch = cor.ceil - cor.floor;
    const mid = (cor.floor + cor.ceil) * 0.5;
    if (ch <= vh - 16) return mid;
    const py = sim.players[0].y;
    return Math.min(Math.max(py, cor.floor + vh * 0.5 - 20), cor.ceil - vh * 0.5 + 20);
  }
  let py = sim.players[0].y;
  if (sim.dual) py = (py + sim.players[1].y) * 0.5;
  if (py > c.ty + CAMERA.deadUp) c.ty = py - CAMERA.deadUp;
  else if (py < c.ty - CAMERA.deadDown) c.ty = py + CAMERA.deadDown;
  return Math.max(-CAMERA.groundMargin + vh * 0.5, c.ty);
}

/** Snaps the camera onto the player (level start, checkpoint restore). */
export function initCamera(sim) {
  const c = sim.camera;
  const p = sim.players[0];
  c.look = CAMERA.lookahead * sim.speedIdx;
  c.ty = p.y;
  c.x = p.x + viewW(c) * (0.5 - PLAYER_SCREEN_X) + c.look;
  c.y = targetY(sim);
  c.px = c.x; c.py = c.y; c.pzoom = c.zoom;
}

/** One fixed tick of camera follow (exponential smoothing is frame-rate independent at 240 Hz). */
export function updateCamera(sim) {
  const c = sim.camera;
  const p = sim.players[0];
  c.px = c.x; c.py = c.y; c.pzoom = c.zoom;
  c.look += (CAMERA.lookahead * sim.speedIdx - c.look) * (1 - Math.exp(-2 * DT));
  c.x = p.x + viewW(c) * (0.5 - PLAYER_SCREEN_X) + c.look;
  const rate = sim.corridor ? CAMERA.corridorRate : CAMERA.followRate;
  c.y += (targetY(sim) - c.y) * (1 - Math.exp(-rate * DT));
}
