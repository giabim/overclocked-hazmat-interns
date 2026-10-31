# Overclocked — The Hazmat Interns

A three-minute browser party game for 2–8 humans and bots. Deliver glowing canisters, dodge escaped specimens, and freeze the chaos. Most points wins.

**Play:** https://overclocked-hazmat-interns.giakhiemhcmc.chatgpt.site

## Play immediately

Choose **Play solo now** for a Containment Breach room with three bots, a countdown, and an automatic start. Create/join with a nickname and five-character room code to play with friends. The host can choose a mode, change bot levels, and enable Chaos in the lobby.

| Mode | Rules |
| --- | --- |
| Classic Delivery | Original 960 × 600 arena, two canisters (three at six participants), +1 per delivery. |
| Containment Breach | 1920 × 1200 nine-room maze, eight canisters, wall collision, escaped slimes and spark hounds, foam, freeze grenades, minimap and follow camera. |

| Control | Action |
| --- | --- |
| WASD / arrows / touch joystick | Move; your last movement direction aims on touch. |
| Space / Grab | Pick up or drop a nearby canister. Carry to the green exit for +1. |
| Mouse pointer, then F / right-click / Foam | Aim and spray foam. Five charges; one recharges every 1.5 seconds; 0.8-second cooldown. |
| G / Freeze | Throw a freeze grenade after collecting a blue G pickup. |

Three freezes within 12 seconds contain a specimen for +2 points. Catches drop your canister, stun for one second, and grant 2.5 more seconds of immunity. Hounds warn for 0.6 seconds before dashing. Chaos is off by default; when enabled, foam and grenades briefly slow teammates. Carrying slows you by 15%. The three-minute deadline, ownership, weapons and scoring belong to the server.

Lv1 bots are clumsy, Lv2 avoids specimens, and Lv3 uses foam. Up to seven bots can fill a room. A new human replaces the newest bot in a full room. Only humans become host. Play Again preserves bots and difficulty levels.

## Rendering and diagnostics

Choose **3D** for PBR suits and visors, procedural tiled floors, reflections from RoomEnvironment/PMREM, metal canisters, glowing liquid, and instanced walls, hazard stripes, door frames and canisters. High enables 2048 shadows and bloom; Medium keeps PBR, environment and blob shadows; Low disables bump detail and lowers pixel ratio. Slow frames reduce quality and can switch to 2D. Missing WebGL2, context loss, import failures and repeated rendering errors also fall back while gameplay continues. Three.js remains pinned to 0.186.1 and loads dynamically.

The ordinary entry flow retains 2D as the safe default until physical-device performance is verified. Solo tries 3D unless `view=2d` is specified. Classic Delivery's 2D drawing commands match the previous version exactly; Breach adds a scrolling 2D maze renderer.

- `?view=2d` or `?view=3d`: force a view.
- `?view=3d&quality=high` (or `medium`, `low`): select a starting tier.
- `?debug=1`: FPS, render counters, sync RTT p50/p95, corrections, specimen states, 2D flow-field toggle.
- `?photo=1`: hide HUD/labels and request High 3D for captures.

All textures, models and sound cues are generated in code. See [asset credits](public/assets/CREDITS.md).

## Server and synchronization

React/TypeScript clients communicate with a Sites Worker and D1. `lib/sim/` is a pure seeded TypeScript simulation: shared circle-wall collision, cached navigation fields, bot decisions, specimen state machines, weapons and 50 ms steps, capped at 500 ms of catch-up per request. A request drives the simulation; there is no background dedicated-server loop.

A normal sync uses two D1 batch round trips: persist the authenticated latest input and read the world; simulate in TypeScript; then write with a room-revision compare-and-set and a unique claim token. Every projected world write is conditional on that claim. Pending input columns are never overwritten by a winning projection, so actions from losing requests survive. A loser reads a fresh snapshot in a third batch. Action counters and contained state prevent duplicate grabs, throws, deliveries and containment points. Host round-start writes also share a unique claim, making concurrent starts safe.

Predicted movement is accepted up to `220 × carry ratio × slow ratio × elapsed seconds × 1.3 + 10 px`, with arena bounds and straight/L-shaped wall sweeps. Stun time earns no movement credit. Grabs, deliveries and shots use the accepted position. Position epochs invalidate proposals sent before a stun, slow or round reset.

Local movement starts and stops immediately. Acknowledgements are compared with the position sent for that sequence; errors over 40 px ease over 150 ms. Remote players and specimens use confirmed snapshot interpolation with a hold at the newest sample, never velocity extrapolation. The nominal 200 ms buffer adapts to slower intervals for players. Foam rewinds specimen history by displayed delay plus half RTT, capped at 350 ms, and checks range/cone/line of sight. This is bounded hitscan compensation, not full physics rollback.

Running polls target 100 ms start-to-start with one request in flight; lobby/results use 850 ms. Sessions expire after 30 seconds without input and room codes after six hours. Tokens are stored per tab, hashed in D1, and omitted from snapshots.

## Source map

- `app/page.tsx`: check-in, solo flow, lobby, input, HUD and results.
- `app/api/room/route.ts`: membership, authenticated host actions, input validation.
- `lib/room-engine.ts`: durable input, read/simulate/CAS write, public snapshots.
- `lib/sim/`: maps, collision, navigation, balance, seeded RNG, bots, specimens, weapons and ticks.
- `lib/movement-sync.ts`: local prediction, epochs, acknowledgement history and remote players.
- `lib/render/`: shared frames, 2D, PBR 3D, camera, minimap, specimen interpolation, audio and fallback.
- `drizzle/0002_secret_catseye.sql`: additive v3 migration; keep previous migrations.
- `docs/Track_A_B_Report.md`: delivered scope, test evidence and device acceptance steps.

## Verify

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/verify-v3.mjs
```

Run the Sites build helper for a production build, then `node tests/render-bundle.mjs` to verify lazy loading and the 200 KiB gzip 3D budget. Tests run the actual route against SQLite through the D1 interface, force concurrency races, simulate full rounds, and preserve the Classic 2D drawing fingerprint. They do not certify hosted latency, GPU performance, touch ergonomics or a real phone connection.

Use the supported Sites preview workflow. Apply only pending SQL migrations to its local D1 database; hosting applies additive migrations during publication. No new dependencies or external assets were required for v3.
