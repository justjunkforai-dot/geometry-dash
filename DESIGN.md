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
            │  └─ ui.js, screens/  DOM menus and screens         │
            │ renderer.js · background.js · icons.js · particles  │
            │ audio.js · synth.js · tracks.js · storage.js        │
            └──────────────────────────────────────────────────────┘
            ┌──────────── simulation core (DOM-free) ─────────────┐
            │ sim.js      world, players, triggers; camera.js     │
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
snapped to the grid (never below the ground). A portal may pin the corridor floor explicitly
(`props.floor`, the editor's "Flight band"); the level builder's `gate()` does this whenever the
gated span equals the band height, so a corridor always matches the tunnel built after it. Cube and robot have the ground and no ceiling.
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

Canvas 2D with one world transform (camera-relative coordinates, y up). Blocks are drawn in a few
batched passes per frame: one fill path, one sheen fill, one stroke path per block style for the
inner pattern, and **vector edge strokes on exposed sides only** in 1–4 layered glow strokes.
Exposure is computed at load from unit grid segments, so faces shared by two blocks, or by a block
and a slope leg, are never outlined; colour triggers therefore cost nothing. Fixed-colour things
(saws, orbs, pads, portals, player icons) are cached sprites with baked `shadowBlur`. Particles use
a struct-of-arrays pool (2000 cap, no per-frame allocation). Software rasterisers (headless
Chromium) are fill-rate bound at 1080p; the JS cost of update + render stays under 1 ms per frame.

## Editor

`editor.js` (state, tools, input, undo) + `editor-ui.js` (DOM panels and dialogs) +
`editor-view.js` (canvas overlays, palette thumbnails) + `editor-io.js` (item ↔ level conversion,
JSON import/export with friendly errors, validation, playtest start state). Items carry stable
uids; undo/redo stores diffs (`{removed, added}`), 200 steps. Playtest from the cursor replays every
portal left of the cursor with the real portal code and derives the level time from the speed
segments, so music and moving objects line up. A death or quitting a playtest returns to the editor
at the same view. Autosave every 30 s into a recovery slot; opening the editor offers recovery.
Custom levels track best % but award no stars or orbs.

## Level validation tools

- `tools/solve.mjs` — beam search over press/release decisions (6-tick steps, behaviour-bucketed
  beam) that finds a completing input for a level, optionally collecting every coin, with presses
  restricted to the music's eighth-note grid (±8 ticks). Results are minimised and written to
  `tests/recordings/`, which the test suite replays (bot completion, portal coverage).
- `--fair` reports each timed press's *recoverable window*: how far it can move earlier/later while
  some later input still survives the next 1.25 s. Minimums: L1 71 ms (triple spike), L2 167,
  L3 88, L4 100, L5 167, L6 167, L7 125, L8 42 (an artefact of the bot's double tap in the
  Insane swing section; the triples are 71), L9 121.
- `js/lint.js` flags floating spikes; tests also check that no mode/size/speed portal can be
  skipped and that flying corridors leave no space around their tunnels.

## Decisions on open points

- Gameplay pause stops music at its position; `AudioContext.suspend()` is used for hidden tabs.
- Default auto-restart delay is 0.4 s (configurable 0.2–1.0 s).
- Group membership is a single group id per object; rotation triggers rotate solids' positions,
  and their collision box follows (90° steps swap width/height).
- Hidden 9th level unlocks when all 24 coins of levels 1–8 are collected.
- Unlocks use thresholds (stars, orbs, diamonds, coins, achievements) — nothing is purchased.
- Green orb = gravity flip that pushes toward the new floor (a dip over pits killed players).
- Playtest deaths return to the editor (practice-mode playtests keep retrying from checkpoints).
- Wave Runner runs at 156 BPM so one beat is exactly four blocks at 1× and zig-zags turn on beats.
- Toasts never capture clicks; Esc inside a text field still closes the open dialog.
