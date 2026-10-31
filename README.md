# Overclocked — The Hazmat Interns

A three-minute 3D browser party game for 2–8 humans and bots. Deliver glowing canisters, dodge escaped specimens and freeze the chaos. Most points wins.

**Play:** https://overclocked-hazmat-interns.giakhiemhcmc.chatgpt.site/

Choose **Play solo now** for Breach with three bot levels and a countdown, or create/join with a five-character room code. WebGL 2 is required. Both modes use 3D: **Classic Delivery** is the original open arena; **Containment Breach** is a nine-room, 1920×1200 maze with specimens, weapons, pickups, minimap and follow camera.

| Control | Action |
| --- | --- |
| WASD / arrows / joystick | Move. Last movement aims on touch. |
| Space / Grab | Grab or drop a canister; carry to the green exit for +1. |
| Mouse + F / right-click / Foam | Aim/spray foam; five charges, 1.5-second recharge, 0.8-second cooldown. |
| G / Freeze | Throw a collected freeze grenade. |

Three freezes within 12 seconds contain a specimen for +2. Catches drop your canister, stun for one second and grant 2.5 further seconds of immunity. Hounds warn before lunging. Chaos is off by default; when enabled, weapons briefly slow teammates. Carrying slows you by 15%. The server owns movement validation, ownership, effects, scoring and the three-minute deadline.

Lv1 is clumsy, Lv2 avoids specimens and Lv3 uses foam. Up to seven bots fill a room. A human joining a full room replaces the newest bot. Only humans become host. Play Again retains bot levels.

## v3.1 rendering and lag work

Medium is the default on every device. The quality menu offers Auto/Ultra/High/Medium/Low; Auto can reach Potato on slow devices. Medium uses PBR/environment/blob shadows; High adds 1024 PCF shadows; Ultra opts into 2048 shadows, clearcoat and guarded bloom. Low removes bump detail; Potato uses Lambert materials and DPR 0.75. No tier switches to 2D.

The camera follows without trailing. ResizeObserver replaces per-frame DOM size reads. The game reuses frame objects/sets/vectors, updates walls only on cell changes and draws its own 192×120 minimap at ≤12 FPS. Low frame rates retain movement time. An external snapshot store isolates timer, score, carry, charge and roster updates from the page. Ordinary polling does not update the whole React page.

3D loads directly behind a loading overlay. Missing WebGL/chunk failures show tips and Retry while the lobby works. Lost contexts rebuild on restoration or after three seconds; two failed rebuilds show the error. The old 2D renderer, toggle and preference are removed; `?view=2d` is ignored.

- `?debug=1`: 300-frame FPS median/5% floor, p95/SD, long frames/minute, React update batches/sec, CPU, render counters, RTT p50/p95, shared display delay, corrections/CAS losses. Navigation draws on the minimap.
- `?quality=ultra|high|medium|low`: select a starting tier. Auto starts at Medium.
- `?photo=1`: hide HUD/names and request Ultra.

The lab has baked floor shading, low paneled walls, instanced hazard bands and canisters, 756-triangle merged hazmat models with articulated arms, distinct specimens and short effects. Textures, geometry and sound are procedural; see [credits](public/assets/CREDITS.md).

## Simulation and networking

`lib/sim/` contains seeded TypeScript simulation, shared circle collision, cached navigation, bot decisions, specimens, weapons and 50 ms steps capped at 500 ms catch-up per request. A request drives simulation; there is no background dedicated-server loop.

Sync persists authenticated durable input/read state, simulates, then writes under a revision CAS and unique claim. New pending inputs survive losing simulations. CAS losers use two batches total, returning the original read plus accepted local position without acknowledging uncommitted actions. Redundant polls below 40 ms can use one batch; fresh movement/actions still drain immediately. Action counters and contained state prevent duplicate scores.

Local prediction compares an acknowledgement with the position sent for that sequence; errors >40 px ease over 150 ms. Position epochs invalidate pre-catch/reset proposals. Players/specimens interpolate confirmed samples using one 120–400 ms arrival-median/MAD delay; missing data holds rather than extrapolates. Foam rewinds specimens up to 600 ms with 14 history samples; Chaos player rewind caps at 250 ms. Server shots, grabs and deliveries use accepted positions and line-of-sight/wall rules.

Polls target 100 ms start-to-start with one request in flight; lobby/results use 850 ms. Human sessions expire after 30 seconds and room codes after six hours. Per-tab tokens are hashed in D1 and omitted from snapshots. Existing additive migrations remain; v3.1 adds no schema migration.

## Verify

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/verify-v3.mjs
```

Use the Sites build helper, then `node tests/render-bundle.mjs` for the lazy 3D bundle's 200 KiB gzip budget. Optional `node tests/render-tiers.mjs` requires Playwright and its Chromium installation; it runs the actual renderer with requested SwiftShader flags and rejects black frames across all tiers.

The current environment could not download Chromium, and its cloud browser has WebGL disabled. CPU/controller/gameplay tests pass; GPU image correctness, actual Medium calls/FPS and physical laptop/phone benchmarks remain unverified. No measured FPS improvement is claimed.

See [v3.1 implementation and test report](docs/Overclocked_v3.1_Implementation_Report.md) for checkpoints, limitations and 60-second/Slow 4G acceptance steps. Earlier reports document earlier releases.

## Source

- `app/page.tsx`, `app/game-hud.tsx`: lobby, isolated live HUD, controls, results.
- `lib/game-store.ts`, `lib/use-game-store.ts`, `lib/game-types.ts`: snapshot store and primitive UI subscriptions.
- `app/api/room/route.ts`, `lib/room-engine.ts`, `lib/sim/`: authenticated authoritative simulation.
- `lib/movement-sync.ts`, `lib/render/display-delay.ts`, `lib/render/snapshots.ts`: prediction and shared interpolation timing.
- `lib/render/three/`, `quality.ts`, `performance.ts`, `controller.ts`, `breach-overlay.ts`: 3D, tiers, diagnostics, recovery and HUD.
