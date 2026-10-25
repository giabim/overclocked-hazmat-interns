# Overclocked — 3D migration, Day 1

Implemented the renderer refactor and basic 3D foundation from `Overclocked_3D_Migration_Plan.md`. Classic 2D stays the default until the laptop/phone gate passes.

## What changed

- One animation loop builds a `FrameView`. Positions come from the existing `MovementSync.localPosition()` / `remotePosition()` once per frame, then either renderer draws that same view. Switching views does not restart the room, timer, polling, inputs, or prediction.
- The existing Canvas 2D drawing moved to `lib/render/canvas2d.ts`; name placement and overlap avoidance moved to `labels.ts`. A golden drawing-command test matches the previous renderer for eight players, including overlapping labels, edge positions, bots, and a carrier.
- Cosmetic snapshot events cover grab, drop, delivery, and respawn. They are drained once and expire after one second; room/round transitions do not replay old effects. The foundation provides these events for later animation work.
- The optional 3D view uses exactly pinned `three@0.186.1` and `@types/three@0.186.0`. It uses plain Three.js/WebGL2, loaded dynamically when requested, with no extra physics engine or model downloads.
- Scene mapping is 40 pixels per unit: a 24 × 15 floor, low walls, floor grid/storage/exit markings, colored capsules, dark visors, bot antenna markers, canisters, carried canisters, blob shadows, a lime self ring, and projected labels.
- The fixed camera uses a 30° field of view, 60° downward pitch, and no yaw. It fits the entire lab on resize, including fullscreen. The fit also covers a carried canister above the head. Input directions are unchanged.
- The toolbar has Classic 2D / 3D buttons. URL `?view=2d` / `?view=3d` takes priority on load, then the saved choice, then Classic 2D. Storage failures do not block play.
- A working Classic view remains visible during 3D loading. Import rejection/8-second timeout, missing WebGL2, context loss, resize failure, and three consecutive draw errors recover to Classic with a retry button. A basic monitor ignores the initial two seconds and resets on tab visibility changes; sustained average frames above 40ms for five seconds also trigger fallback.
- `?debug=1` shows renderer, frame timing, draw calls, triangles, geometry/texture counts, and pixel ratio. Lobby/results 3D drawing is capped at 30fps. GPU resources and canvases are disposed on view changes/leave.

## Preserved behavior

No changes to `app/api/room/route.ts`, `lib/room-engine.ts`, `lib/movement-sync.ts`, `lib/game.ts`, `lib/bot-settings.ts`, database schema/migrations, or keyboard/joystick handlers. The round remains three minutes, carrying remains 15% slower, bots remain Lv1, and ownership/scoring remain authoritative.

Day 2–5 work is not included: detailed hazmat bodies, waddle/reach/squash animation, particle effects, sound, anomaly effects, Lv2/Lv3 bots, full quality tiers, and photo mode.

## Saved checkpoints

| Label from the plan | Saved checkpoint |
| --- | --- |
| `v3-2d-baseline` | Sites version 4; source `bd4101bf637cc04482372380a99baa8f206675f5`; GitHub equivalent `5b911bdc605e502e3bcaf33611fa642ba398fd2c` |
| `v3-2d-refactor` | Sites version 5, saved before the 3D scene; source `5fc526673f9d36af35cd9dd0ae6cb445e5996ec4` |
| Day 1 foundation | Current source and published update; final commit/version are returned with the completed task |

## Validation

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/multiplayer.mjs --in-process
node tests/day2.mjs
node tests/movement.mjs
node tests/render-2d.mjs
node tests/render-events.mjs
node tests/render-coords.mjs
node tests/render-fallback.mjs
node tests/render-scene.mjs
# After the production build:
node tests/render-bundle.mjs
```

All listed source checks passed. The renderer tests check the Classic drawing fingerprint, event rules, arena/exit/round-trip mapping, W/D screen directions, camera fitting over seven aspect ratios (0.1–4), URL/preference/default selection, failed import/mount/timeout, context-loss recovery, resize failure, error fallback, cancellation during loading, sustained slow-frame handling, CPU geometry, and resource disposal. Each capsule has 216 triangles. Existing multiplayer, gameplay/bot/full-round, and simulated-latency tests passed too.

The initial 3D production chunk measured 545,028 bytes minified / 134,545 bytes gzipped. The build check enforces a 200 KiB gzip budget including its static chunk dependencies. This measures download size, not first-frame latency.

## Gate 1 decision: pending device validation — keep Classic 2D default

The available cloud Chrome reports WebGL disabled (`GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`), so it cannot render or benchmark the GPU scene. Its attempted 3D view recovered to Classic without losing the room. An eight-participant room with seven bots completed a real three-minute round, showed ranked results with 29 total bot deliveries, and retained all seven bots on Play Again. This is a browser fallback check, not a successful 3D performance check.

Real 3D rendering, laptop/phone frame rate, every physical keyboard/joystick direction, mobile orientation/fullscreen, GPU memory over five rounds, and a full three-minute phone round remain pending. No physical phone, CPU-throttled Chrome performance, Safari/Firefox, or three-device result is claimed. Do not promote 3D to the default until Gate 1 passes.

## Laptop and phone acceptance

1. Open the game with `?view=3d&debug=1`. Create a room, add seven bots, and start. Confirm the 3D capsule view appears. If the browser cannot use WebGL2, confirm Classic appears with a retry message and the round continues.
2. Check W/A/S/D, all four arrows, and all joystick directions. Up must go up; right must go right. Your movement should start/stop immediately and other players should interpolate smoothly.
3. Grab a canister and deliver it. Confirm one point, a two-second respawn, correct carrying display, results, and Play Again with retained bots.
4. Switch Classic 2D ↔ 3D mid-round. Confirm the code, player positions, scores, timer, and controls continue. Reload to check the saved preference; use `?view=2d` to verify the override.
5. On the phone, note FPS at 0:30, 1:30, and 2:45. Gate 1 requires at least 30fps throughout a full three-minute round with seven bots. Record draw calls/triangles; targets are at most 60 / 60,000.
6. Rotate the phone, enter/leave fullscreen, and switch apps/return. Repeat with a friend on a second device, including Slow 4G on the laptop. Keep Classic as default if there are blocking issues or sustained phone FPS below 30.
