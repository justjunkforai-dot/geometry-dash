# Neon Dash — Design

## Architecture

Plain ES modules, no build step. The code is split into a **deterministic simulation core** that
has no DOM dependency (so Node tests and the bot validator can import it), and a **presentation
shell** (rendering, audio, DOM UI, input).

```
            ┌──────────── presentation (browser only) ────────────┐
 input.js ─▶│ main.js  (rAF loop, state machine, transitions)      │
            │  ├─ game.js     play session: ticks sim, practice,  │
            │  │              death/restart, music sync, HUD      │
            │  ├─ editor*.js  level editor                        │
            │  └─ ui*.js      DOM menus / screens                 │
            │ renderer.js · background.js · icons.js · particles  │
            │ audio.js · music.js (tracks)  · storage.js          │
            └──────────────────────────────────────────────────────┘
            ┌──────────── simulation core (DOM-free) ─────────────┐
            │ sim.js      world + players + triggers, step(input) │
            │ player.js   per-mode physics, interactions          │
            │ physics.js  collision resolution (solids/slopes/…)  │
            │ collision.js geometric primitives (SAT, circle)     │
            │ level.js    World: objects, spatial grid, groups    │
            │ triggers.js trigger effects and tweens              │
            │ objects.js  object type table · config.js constants │
            │ levels/     builder.js + level data + tracks meta   │
            └──────────────────────────────────────────────────────┘
```

**Loop.** `requestAnimationFrame` drives everything. Physics runs at a **fixed 240 Hz**
(`DT = 1/240`) with an accumulator; frame gaps over 250 ms are dropped (tab switches). Rendering
interpolates player and camera between the last two ticks. Input events carry their DOM
`timeStamp`; each tick consumes the events stamped before that tick's wall-clock time, so the tick
on which a press lands does not depend on the render rate. This is what makes 30/60/144/240 FPS
produce bit-identical trajectories (tested).

**Determinism.** The sim never reads wall-clock time, `Math.random`, or audio time. Moving objects
are functions of `levelTime` (an integer tick count × DT). Visual-only randomness (particles) uses
a seeded PRNG outside the sim. `sim.hash()` digests the full state for tests.

## Units and physics constants (see `js/config.js`)

1 block = **30 world units**; y points **up**; the ground top is y = 0. Logical screen 1920×1080,
camera scale 3.25 px/unit → about 19.7 × 11 blocks visible at zoom 1.

| Quantity | Value | Reasoning |
|---|---|---|
| Base speed (1×) | 312 u/s (10.4 blocks/s) | spec; speeds 0.7/1/1.3/1.6/2× |
| Cube gravity | 3570 u/s² | with jump 687 u/s gives apex 66.1 u (**2.2 blocks**) |
| Cube jump | 687 u/s | airtime 0.385 s → **4.0 blocks** long at 1× |
| Max fall | 1100 u/s | bounded per-tick motion (4.6 u) |
| Per-tick motion at 2× | 2.6 u horizontally | far below the smallest hitbox (12 u), so no tunneling |
| Input buffer / coyote | 80 ms / 40 ms | press before landing still jumps; walking off a ledge forgives |
| Spike hitbox | triangle 40% width × 55% height of the visual | see windows below |
| Hazard inset | player box inset 3 u per side vs hazards | forgives corner grazes |

Measured press windows at 1× (brute-force sweep, `tests/suite.js`): single spike **263 ms**,
double **167 ms**, triple **71 ms** (a well-timed jump), quadruple impossible.

Collision runs per tick in two axis-separated phases. **X phase**: overlapping solids are either
"stepped onto" (feet within a small tolerance of the top, falling) or kill (side hit). **Y phase**:
a falling player lands, a rising one bonks (fatal for cube/robot, a stop for ship/UFO/ball/spider/
swing). Slopes are resolved by computing the hypotenuse height under the player's span; the push
needed to separate is compared with what riding the slope could explain — anything larger is a side
hit. Hazards are tested after movement: spikes via SAT (triangle vs AABB), saws as circles. Sensors
(pads, orbs, portals, coins) fire on entry; each orb fires at most once per overlap. A uniform grid
(4×4-block cells) holds static collidables; objects that move (group triggers, saw paths) live in a
small dynamic list that is scanned directly.

Ship/UFO/wave/swing use a 10-block corridor and ball/spider an 8-block one, centred on the portal and
snapped to the grid (never below the ground). Cube and robot have the ground and no ceiling.
Wave dies on any block, slope or hazard but can slide on the corridor floor/ceiling.

Shallow slopes are **2:1 (≈26.6°)** instead of 22.5° so both ends land on grid points.

## Level data format

```js
export default {
  meta: { id, name, difficulty, stars, bpm, song, offset, palette, bg, ground, startMode, startSpeed },
  objects:  [[typeId, x, y, rot, flipX, flipY, groupId, props], ...],   // x,y = centre in blocks
  triggers: [[typeId, x, y, props], ...],                                // fire when player.x ≥ x
};
```

Trailing defaults may be omitted (`[1, 10.5, 0.5]` is a block in cell (10,0)). Levels are written
with `js/levels/builder.js`, which places obstacles **by beat**: `b.x(beat)` maps a music beat to the
x where the player's centre is at that moment, accounting for speed portals. Helpers such as
`b.spikesAt(beat, n)` centre an obstacle on the apex of a jump pressed exactly on `beat`, so the
correct input lands on the beat grid. The same builder is used by the editor's export.

## Audio engine

Web Audio graph: voices → per-playback *session gain* → music bus / sfx bus → master → destination.
All instruments are synthesized per note (oscillators, filtered noise from one shared buffer,
envelopes) and disconnect themselves on `ended`. A step sequencer schedules 16th-note steps with a
150 ms look-ahead against `AudioContext.currentTime`; it is pumped from the rAF loop (no timers).
Tracks are data: BPM, key, scale, chord progression, and per-section patterns (drum strings,
bass/lead/arp degree strings). Seeking stops the current session (fast fade) and starts a new one at
the target step. Pause stops the music session at its exact position and resumes by seeking, so UI
sounds still work in the pause menu; when the tab is hidden the whole `AudioContext` is suspended.
Beat-synced visuals read `audio.musicTime()`; if music and sim drift by >80 ms (a long hitch) the
music is re-seeked to the sim.

## Rendering

Canvas 2D with one world transform (camera-relative coordinates, y up). Blocks use a cached,
colour-independent interior sprite plus **vector edge strokes on exposed sides only** (neighbour
mask computed at load), drawn in 1–3 layered strokes for glow — colour triggers therefore cost
nothing. Fixed-colour things (saws, orbs, pads, portals, player icons) are cached sprites with baked
`shadowBlur`. Particles use a struct-of-arrays pool (2000 cap, no per-frame allocation).

## Editor

`editor.js` (state, tools, undo) + `editor-ui.js` (DOM panels) + `editor-view.js` (canvas
drawing). Objects are kept in the same compact format the game loads. Undo/redo stores
diffs (`{removed, added}` object lists) so 100+ steps stay cheap. Playtest builds a level from the
editor list and starts the game with a start state computed by scanning portals left of the start
x. Autosave every 30 s into a recovery slot; on next open a recovery prompt appears if it is newer
than the last manual save.

## Decisions on open points

- Gameplay pause stops music at its position; `AudioContext.suspend()` is used for hidden tabs.
- Default auto-restart delay is 0.4 s (configurable 0.2–1.0 s).
- Group membership is a single group id per object; rotation triggers rotate solids' positions,
  and their collision box follows (90° steps swap width/height).
- Hidden 9th level unlocks when all 24 coins of levels 1–8 are collected.
- Unlocks use thresholds (stars, orbs, diamonds, coins, achievements) — nothing is purchased.
