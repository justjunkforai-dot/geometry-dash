/**
 * Object type table. Every placeable thing (blocks, hazards, pads, portals, triggers, deco)
 * is described here once; the sim, renderer and editor all read from this table.
 *
 * Geometry is given in BLOCKS relative to the object's centre, before rotation/flip:
 *   solid  [x0, y0, x1, y1]           collision box
 *   tri    [ax, ay, bx, by, cx, cy]   visual triangle (hazard hitbox is derived & shrunk)
 *   radius                            circle (saws: visual radius; orbs/coins: sensor radius)
 *   sensor [x0, y0, x1, y1]           trigger zone for pads/portals
 * `w`,`h` is the footprint in blocks used for grid snapping and selection.
 */

const defs = [];
const byId = new Map();
const byKey = new Map();

function def(id, key, name, cat, kind, extra) {
  const d = { id, key, name, cat, kind, w: 1, h: 1, layer: 'M', ...extra };
  defs.push(d);
  byId.set(id, d);
  byKey.set(key, d);
  return d;
}

// ---- Blocks ------------------------------------------------------------------------------
def(1, 'block', 'Block', 'blocks', 'solid', { solid: [-0.5, -0.5, 0.5, 0.5], style: 'neon' });
def(2, 'half', 'Half Block', 'blocks', 'solid', { solid: [-0.5, -0.5, 0.5, 0], style: 'neon' });
def(3, 'slab', 'Slab', 'blocks', 'solid', { solid: [-0.5, 0.25, 0.5, 0.5], style: 'slab' });
def(4, 'panel', 'Panel Block', 'blocks', 'solid', { solid: [-0.5, -0.5, 0.5, 0.5], style: 'panel' });
def(5, 'brick', 'Brick Block', 'blocks', 'solid', { solid: [-0.5, -0.5, 0.5, 0.5], style: 'brick' });
// Slopes: unrotated, the hypotenuse rises left→right and the solid part is below it.
def(6, 'slope', 'Slope 45°', 'blocks', 'slope', { slope: 1 });
def(7, 'slope2', 'Slope 2:1', 'blocks', 'slope', { w: 2, slope: 0.5 });

// ---- Hazards -----------------------------------------------------------------------------
def(10, 'spike', 'Spike', 'hazards', 'spike', { tri: [-0.5, -0.5, 0.5, -0.5, 0, 0.5] });
def(11, 'spikeSmall', 'Small Spike', 'hazards', 'spike', { tri: [-0.5, -0.5, 0.5, -0.5, 0, 0] });
def(13, 'sawS', 'Saw (small)', 'hazards', 'saw', { radius: 0.5 });
def(14, 'sawM', 'Saw (medium)', 'hazards', 'saw', { w: 2, h: 2, radius: 1 });
def(15, 'sawL', 'Saw (large)', 'hazards', 'saw', { w: 3, h: 3, radius: 1.5 });

// ---- Pads & orbs -------------------------------------------------------------------------
const PAD_SENSOR = [-0.45, -0.5, 0.45, -0.2];
def(20, 'padYellow', 'Yellow Pad', 'interact', 'pad', { color: 'yellow', sensor: PAD_SENSOR });
def(21, 'padPink', 'Pink Pad', 'interact', 'pad', { color: 'pink', sensor: PAD_SENSOR });
def(22, 'padRed', 'Red Pad', 'interact', 'pad', { color: 'red', sensor: PAD_SENSOR });
def(23, 'padBlue', 'Blue Pad', 'interact', 'pad', { color: 'blue', sensor: PAD_SENSOR });
const ORB_R = 0.62;
def(30, 'orbYellow', 'Yellow Orb', 'interact', 'orb', { color: 'yellow', radius: ORB_R });
def(31, 'orbPink', 'Pink Orb', 'interact', 'orb', { color: 'pink', radius: ORB_R });
def(32, 'orbRed', 'Red Orb', 'interact', 'orb', { color: 'red', radius: ORB_R });
def(33, 'orbBlue', 'Blue Orb', 'interact', 'orb', { color: 'blue', radius: ORB_R });
def(34, 'orbGreen', 'Green Orb', 'interact', 'orb', { color: 'green', radius: ORB_R });
def(35, 'orbBlack', 'Black Orb', 'interact', 'orb', { color: 'black', radius: ORB_R });
def(36, 'orbDash', 'Dash Orb', 'interact', 'orb', { color: 'dash', radius: ORB_R });
def(70, 'coin', 'Secret Coin', 'interact', 'coin', { radius: 0.55 });
def(71, 'end', 'End Wall', 'interact', 'end', { h: 3 });

// ---- Portals -----------------------------------------------------------------------------
const PORTAL_SENSOR = [-0.55, -1.45, 0.55, 1.45];
function portal(id, key, name, action, value, color) {
  def(id, key, name, 'portals', 'portal', { h: 3, sensor: PORTAL_SENSOR, action, value, color });
}
portal(40, 'portalCube', 'Cube Portal', 'mode', 'cube', 'cube');
portal(41, 'portalShip', 'Ship Portal', 'mode', 'ship', 'ship');
portal(42, 'portalBall', 'Ball Portal', 'mode', 'ball', 'ball');
portal(43, 'portalUfo', 'UFO Portal', 'mode', 'ufo', 'ufo');
portal(44, 'portalWave', 'Wave Portal', 'mode', 'wave', 'wave');
portal(45, 'portalRobot', 'Robot Portal', 'mode', 'robot', 'robot');
portal(46, 'portalSpider', 'Spider Portal', 'mode', 'spider', 'spider');
portal(47, 'portalSwing', 'Swing Portal', 'mode', 'swing', 'swing');
portal(50, 'gravDown', 'Gravity Down', 'gravity', 1, 'gravityDown');
portal(51, 'gravUp', 'Gravity Up', 'gravity', -1, 'gravityUp');
portal(52, 'sizeMini', 'Mini Portal', 'size', true, 'mini');
portal(53, 'sizeNormal', 'Normal Size Portal', 'size', false, 'big');
portal(54, 'mirrorOn', 'Mirror Portal', 'mirror', true, 'mirror');
portal(55, 'mirrorOff', 'Unmirror Portal', 'mirror', false, 'unmirror');
portal(56, 'dualOn', 'Dual Portal', 'dual', true, 'dual');
portal(57, 'dualOff', 'Single Portal', 'dual', false, 'single');
const SPEED_SENSOR = [-0.55, -0.95, 0.55, 0.95];
['Slow', 'Normal', 'Fast', 'Faster', 'Fastest'].forEach((n, i) => {
  def(60 + i, `speed${i}`, `Speed: ${n}`, 'portals', 'portal', {
    h: 2, sensor: SPEED_SENSOR, action: 'speed', value: i, color: 'speed',
  });
});

// ---- Triggers ----------------------------------------------------------------------------
function trigger(id, key, name, action, props) {
  def(id, key, name, 'triggers', 'trigger', { action, props, layer: 'T' });
}
trigger(80, 'trColor', 'Color Trigger', 'color', { channel: 'bg', color: '#3a1d8f', duration: 0.6 });
trigger(81, 'trMove', 'Move Trigger', 'move', { group: 1, dx: 0, dy: 2, duration: 0.5, easing: 'inOut' });
trigger(82, 'trRotate', 'Rotate Trigger', 'rotate', { group: 1, degrees: 90, duration: 0.5, easing: 'inOut' });
trigger(83, 'trScale', 'Scale Trigger', 'scale', { group: 1, scale: 1.5, duration: 0.5, easing: 'out' });
trigger(84, 'trAlpha', 'Alpha Trigger', 'alpha', { group: 1, alpha: 0, duration: 0.5 });
trigger(85, 'trToggle', 'Toggle Trigger', 'toggle', { group: 1, on: false });
trigger(86, 'trPulse', 'Pulse Trigger', 'pulse', { channel: 'obj', color: '#ffffff', fadeIn: 0.03, hold: 0.05, fadeOut: 0.35 });
trigger(87, 'trZoom', 'Zoom Trigger', 'zoom', { zoom: 1.2, duration: 1, easing: 'inOut' });
trigger(88, 'trShake', 'Shake Trigger', 'shake', { strength: 8, duration: 0.5 });
trigger(89, 'trParticles', 'Particle Trigger', 'particles', { count: 40, color: '#ffffff', kind: 'burst' });

// ---- Decoration (no collision) -----------------------------------------------------------
function deco(id, key, name, extra) {
  def(id, key, name, 'deco', 'deco', { layer: 'B', ...extra });
}
deco(100, 'fakeBlock', 'Fake Block', { style: 'fake', layer: 'M' });
deco(101, 'lineH', 'Neon Line', { style: 'line' });
deco(102, 'pillar', 'Pillar', { style: 'pillar' });
deco(103, 'chain', 'Chain', { style: 'chain' });
deco(104, 'arrow', 'Arrow Sign', { style: 'arrow', layer: 'M' });
deco(105, 'sparkle', 'Sparkle', { style: 'sparkle' });
deco(106, 'ring', 'Ring', { style: 'ring', w: 2, h: 2 });
deco(107, 'gear', 'Gear', { style: 'gear', w: 2, h: 2 });
deco(108, 'text', 'Text Label', { style: 'text', layer: 'M', props: { text: 'Hold!' } });
deco(109, 'beatOrb', 'Beat Light', { style: 'beat' });
deco(110, 'diamond', 'Diamond', { style: 'diamond' });

export const OBJECT_DEFS = defs;
export function getDef(id) { return byId.get(id); }
export function defByKey(key) { return byKey.get(key); }
/** Numeric id lookup by key, throws on typos so level scripts fail loudly. */
export function T(key) {
  const d = byKey.get(key);
  if (!d) throw new Error(`Unknown object key "${key}"`);
  return d.id;
}

export const CATEGORIES = [
  { id: 'blocks', name: 'Blocks' },
  { id: 'hazards', name: 'Hazards' },
  { id: 'interact', name: 'Pads/Orbs' },
  { id: 'portals', name: 'Portals' },
  { id: 'triggers', name: 'Triggers' },
  { id: 'deco', name: 'Decoration' },
];

export const EASINGS = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  back: (t) => {
    const c = 1.70158;
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
  bounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d;
    return n * t * t + 0.984375;
  },
};

/** Colour channels that colour/pulse triggers may target. */
export const CHANNELS = ['bg', 'ground', 'line', 'obj', 'deco'];
