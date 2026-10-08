/**
 * Global constants for Neon Dash.
 *
 * UNITS: 1 block = 30 world units (BLOCK). The world y axis points UP and the ground top is y = 0.
 * Level data is authored in blocks; the runtime converts to units on load.
 * TIME: physics runs at a fixed PHYSICS_HZ independent of the render rate.
 */

export const BLOCK = 30;

// ---- Timing -------------------------------------------------------------------------------
export const PHYSICS_HZ = 240;
export const DT = 1 / PHYSICS_HZ;
export const DT_MS = 1000 / PHYSICS_HZ;
/** Frame gaps longer than this (ms) are dropped instead of simulated (tab switch, debugger). */
export const MAX_FRAME_GAP_MS = 250;

// ---- View ---------------------------------------------------------------------------------
export const VIEW_W = 1920;
export const VIEW_H = 1080;
/** Logical pixels per world unit at zoom 1: shows ~19.7 × 11 blocks. */
export const CAMERA_SCALE = 3.25;
/** Horizontal screen position of the player, as a fraction of the view width. */
export const PLAYER_SCREEN_X = 0.3;
/** Maximum devicePixelRatio used for the backing store (perf guard on 4K/retina). */
export const MAX_DPR = 2;

// ---- Movement -----------------------------------------------------------------------------
/** Horizontal speed at 1× in units/second (10.4 blocks/s). */
export const BASE_SPEED = 10.4 * BLOCK;
/** Speed portal multipliers, index 0..4: slow, normal, fast, faster, fastest. */
export const SPEEDS = [0.7, 1.0, 1.3, 1.6, 2.0];
export const SPEED_NAMES = ['0.7×', '1×', '1.3×', '1.6×', '2×'];
export const START_X = BLOCK * 0.5;
/** Seconds a press is remembered before it can be used (landing/orb). */
export const BUFFER_TIME = 0.08;
/** Seconds after walking off a ledge during which a jump is still allowed. */
export const COYOTE_TIME = 0.04;
export const BUFFER_TICKS = Math.round(BUFFER_TIME * PHYSICS_HZ);
export const COYOTE_TICKS = Math.round(COYOTE_TIME * PHYSICS_HZ);
/** Max vertical penetration (units) that is resolved by stepping up instead of killing. */
export const STEP_TOLERANCE = 3;
/** Extra landing tolerance when falling onto a ledge corner. */
export const LAND_TOLERANCE = 6;
/** World bounds: dying when flying out of the level. */
export const WORLD_MAX_Y = 4200;
export const WORLD_MIN_Y = -600;

/** Mini size multiplier for hitbox and sprite. */
export const MINI_SCALE = 0.6;

/**
 * Per-mode physics. Velocities in units/s, accelerations in units/s².
 * `hitbox` is [w, h] in units at normal size. `corridor` is the height in blocks of the
 * floor/ceiling band the mode creates (0 = ground only). `ceilingKills`: bonking a surface
 * while moving against gravity is fatal. `orbMul` scales pad/orb impulses for this mode.
 */
export const MODES = {
  cube: {
    hitbox: [30, 30], corridor: 0, ceilingKills: true, orbMul: 1,
    gravity: 3570, jump: 687, maxFall: 1100,
    mini: { gravity: 3570, jump: 550, maxFall: 1100 },
    /** degrees of spin over one full jump arc */
    spinPerJump: 360,
  },
  ship: {
    hitbox: [30, 22], corridor: 10, ceilingKills: false, orbMul: 0.55,
    upAccel: 2250, downAccel: 1650, maxUp: 440, maxDown: 520,
    mini: { upAccel: 2600, downAccel: 1900, maxUp: 480, maxDown: 560 },
  },
  ball: {
    hitbox: [28, 28], corridor: 8, ceilingKills: false, orbMul: 0.75,
    gravity: 2900, flipPush: 300, maxFall: 900,
    mini: { gravity: 3200, flipPush: 320, maxFall: 950 },
  },
  ufo: {
    hitbox: [30, 26], corridor: 10, ceilingKills: false, orbMul: 0.7,
    gravity: 2600, jump: 490, maxFall: 480,
    mini: { gravity: 2700, jump: 440, maxFall: 480 },
  },
  wave: {
    hitbox: [12, 12], corridor: 10, ceilingKills: true, orbMul: 0,
    slope: 1, mini: { slope: 2 },
  },
  robot: {
    hitbox: [30, 30], corridor: 0, ceilingKills: true, orbMul: 0.9,
    gravity: 3570, jump: 550, boostTime: 0.13, maxFall: 1100,
    mini: { gravity: 3570, jump: 460, boostTime: 0.11, maxFall: 1100 },
  },
  spider: {
    hitbox: [30, 26], corridor: 8, ceilingKills: false, orbMul: 0.8,
    gravity: 3570, maxFall: 1100, reach: 24 * BLOCK, flingSpeed: 1100,
    mini: { gravity: 3570, maxFall: 1100 },
  },
  swing: {
    hitbox: [28, 28], corridor: 10, ceilingKills: false, orbMul: 0.6,
    gravity: 2400, maxSpeed: 520,
    mini: { gravity: 2700, maxSpeed: 560 },
  },
};
export const MODE_NAMES = Object.keys(MODES);

/** Pad launch velocities (local "up", units/s) for the cube; scaled by MODES[m].orbMul. */
export const PAD_VEL = { yellow: 935, pink: 600, red: 1180, blue: 600 };
/** Orb impulses (local "up", units/s); blue/green/black are documented in player.js. */
export const ORB_VEL = { yellow: 687, pink: 520, red: 950, blue: 420, green: 687, black: 1150 };
/** Dash orb: max dash angle in degrees (from horizontal). */
export const DASH_MAX_ANGLE = 70;

// ---- Hazard hitboxes ----------------------------------------------------------------------
/** Spike hitbox: fraction of the visual base width and visual height (triangle). */
export const SPIKE_HIT_W = 0.4;
export const SPIKE_HIT_H = 0.55;
/** Units the player's box is inset by (per side) when testing hazards. */
export const HAZARD_INSET = 3;
/** Saw hitbox radius as a fraction of the visual radius. */
export const SAW_HIT_R = 0.78;

// ---- Spatial partition --------------------------------------------------------------------
export const GRID_CELL = 4 * BLOCK;

// ---- Camera -------------------------------------------------------------------------------
export const CAMERA = {
  /** exponential smoothing rate (1/s) for vertical follow */
  followRate: 6,
  corridorRate: 5,
  /** dead zone above/below the camera centre (units) */
  deadUp: 40,
  deadDown: 70,
  /** blocks of ground kept visible at the bottom in open sections */
  groundMargin: 2.1 * BLOCK,
  /** extra horizontal lookahead per speed multiplier step (units) */
  lookahead: 18,
  zoomMin: 0.5,
  zoomMax: 2,
};

// ---- Gameplay flow ------------------------------------------------------------------------
export const DEFAULT_RESTART_DELAY = 0.4;
export const COUNTDOWN_SECONDS = 3;
export const PARTICLE_CAP = 2000;
export const TRAIL_POINTS = 160;

// ---- Palette ------------------------------------------------------------------------------
/** Fixed gameplay colours (hazards and interactables keep these regardless of level theme). */
export const COLORS = {
  hazard: '#ffffff',
  hazardEdge: '#ff3355',
  saw: '#e8ecf5',
  pad: { yellow: '#ffd500', pink: '#ff4fd8', red: '#ff3b3b', blue: '#33c6ff' },
  orb: {
    yellow: '#ffd500', pink: '#ff4fd8', red: '#ff3b3b', blue: '#33c6ff',
    green: '#3dff7a', black: '#20202a', dash: '#7dff4f',
  },
  portal: {
    cube: '#3dff7a', ship: '#ff4fd8', ball: '#ff8a1f', ufo: '#ffd500', wave: '#33c6ff',
    robot: '#f2f2f2', spider: '#a05bff', swing: '#ffef5c',
    gravityDown: '#33c6ff', gravityUp: '#ffd500', mini: '#ff4fd8', big: '#3dff7a',
    mirror: '#ff8a1f', unmirror: '#33c6ff', dual: '#ff8a1f', single: '#33c6ff',
    speed: ['#ff8a1f', '#33c6ff', '#3dff7a', '#ff4fd8', '#ff3b3b'],
  },
  coin: '#ffd84a',
};

/** Okabe–Ito based colour-blind-safe overrides for interactables. */
export const COLORS_CB = {
  pad: { yellow: '#f0e442', pink: '#cc79a7', red: '#d55e00', blue: '#0072b2' },
  orb: {
    yellow: '#f0e442', pink: '#cc79a7', red: '#d55e00', blue: '#56b4e9',
    green: '#009e73', black: '#20202a', dash: '#e69f00',
  },
};

export const STORAGE_KEY = 'neondash.save';
export const SAVE_VERSION = 2;
