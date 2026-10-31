# Track A + Track B implementation report

Date: 2026-10-31

Project: Overclocked — The Hazmat Interns

Live game: https://overclocked-hazmat-interns.minty-elm-6294.chatgpt.site

Source: https://github.com/giabim/overclocked-hazmat-interns

## Delivered

| Track | Implementation |
| --- | --- |
| A — visuals | Three.js 0.186.1 retained; Neutral tone mapping/exposure 1.1; RoomEnvironment/PMREM reflections; PBR suits, clearcoat visors and metal/glass canisters; emissive liquid; procedural floor/bump/panel-wear textures and hazard stripes. High: 2048 soft shadows and bloom. Medium: PBR/environment/blob shadows. Low: reduced pixel ratio and no bump detail. Slow-frame quality reduction and 2D fallback remain. |
| A — immediate play | Play solo now creates Breach, adds Lv1/Lv2/Lv3 bots, shows 3–2–1, and starts. Default Intern### nickname. Three first-move/6-second hints, top-three podium, session best, focused Play Again, sound/mute, and photo mode. |
| B — simulation | Pure TypeScript seeded simulation with 50 ms steps and 500 ms catch-up limit. Authenticated durable inputs, revision CAS, uniquely guarded writes, action sequence deduplication, and additive D1 migration. |
| B — map | 24 × 15 cells, 1920 × 1200 px, nine named rooms, eight canisters, doorways, exit and grenade pickups. Shared client/server circle collision and swept movement validation. Classic Delivery remains selectable. |
| B — navigation | Cached eight-neighbor flow fields, no diagonal corner cutting, stuck recovery, clumsy Lv1, danger-avoiding Lv2, foam-using Lv3. |
| B — specimens | Slimes and spark hounds, patrol/chase, hound warning/dash/recovery, freeze and containment. Catch drops the canister, stuns for 1 second, grants 2.5 further seconds of immunity, and increments position epoch. Up to four specimens. |
| B — weapons | F/right-click/mobile foam: five rechargeable charges, 0.8-second cooldown, 2.5-second freeze, cone/aim help, line of sight, specimen-history rewind capped at 350 ms. G/mobile grenades: pickups, 160 px throw, 0.6-second fuse, 70 px splash, 3.5-second freeze. Three freezes within 12 seconds: exactly-once +2 containment, 8-second specimen respawn. Optional Chaos slows teammates. |
| B — presentation | Scrolling 2D maze; smooth clamped 3D follow camera with wall fading; minimap, room colors/names, objective and nearby-specimen guidance; warning lanes, foam cones, grenade arcs and frozen colors. Instanced walls, stripes, frames, props and canisters. Mouse aiming uses the rendered 3D floor ray. |
| Diagnostics | Debug FPS/render counters/quality tier, sync RTT p50/p95, correction count, specimen states and a 2D navigation overlay. |

The optional open-arena monster-lite/foam-lite experiments are superseded by Breach's complete specimen and weapon systems. No first-person view or external asset downloads were added. The ordinary entry flow keeps the previous safe 2D default; solo requests 3D with automatic fallback.

## Important fixes found during implementation

- Breach bots now select uncarried canisters instead of crowding around a canister already held by another player.
- Zero-radius visibility rays correctly detect walls, so foam and grenade splash cannot hit through them.
- Inputs from a request that loses the revision race survive for the next winning simulation. Winning projections never overwrite newer pending-input columns.
- Concurrent third foam hits award +2 to only one player; replayed action counters do not score twice.
- Concurrent round-start batches share unique claim guards, so one winning start cannot be reset by the loser.
- Snapshots with older revisions cannot revert the UI to an earlier room state. Successful polls preserve unrelated control errors.
- Position epochs reject old proposals after catches; elapsed stun time grants no movement credit.
- Remote specimen playback holds at the latest sample, does not extrapolate, and does not rewind when its display buffer grows.
- Map-specific 3D resources are disposed when changing modes; renderer teardown releases geometry, textures, PMREM and postprocessing resources.

## Verification

Run:

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/verify-v3.mjs
```

The combined runner contains 19 suites. Coverage includes:

- Map rectangularity, reachable floor/exit/spawns, no dead ends, correct dimensions.
- 2,000 seeded collision proposals, doorway passage, swept wall blocking, Classic bounds.
- Deterministic replay for a fixed seed.
- Stale epoch rejection, stun movement credit, accepted-position grabs and replay protection.
- Forced concurrent read/CAS races: losing grabs survive, deliveries score once, losing fire actions drain, containment scores once.
- Host-only mode/Chaos/bot controls, safe concurrent starts, restart/reset/deadline behavior.
- Full simulated three-minute rounds with seven mixed-level bots, both with and without four specimens; no wall clipping. Navigation-only runs require every bot to deliver and no stationary interval longer than three seconds.
- Foam rewind/cooldown/recharge/occlusion, grenade fuse/freeze, containment/respawn, Chaos slow, hound warning/dash/recovery, catch/drop/stun/immunity.
- Existing Day 2 and eight-client multiplayer regressions.
- Immediate local start/stop, stale acknowledgements, 40 px / 150 ms corrections, variable 100–800 ms snapshots, no extrapolation and steady polling.
- Unchanged Classic 2D drawing fingerprint, coordinate/camera mapping, event handling, renderer fallback and resource cleanup.
- Breach drawing at three canvas sizes, minimap/flow/specimen/weapon effects with finite coordinates.

After a production build, `node tests/render-bundle.mjs` checks a separate lazy-loaded 3D entry and its static dependencies against the existing 200 KiB gzip limit. No gameplay dependency upgrade was required.

Browser preview verification covers fresh one-click solo creation, mixed-level bots, visible countdown, transition to live Breach, wall-limited movement, foam charge consumption, minimap/specimens and WebGL failure fallback. The local D1 migration executed successfully. Build and publication results are reported with the delivered release.

## Verification limits

This cloud browser reports WebGL unavailable. CPU geometry/material/camera checks and bundle compilation passed; this is **not** a verified GPU render or frame-rate result. The 30 FPS phone, 60 FPS laptop, ≤80 draw-call and hosted p50 ≤150 ms targets still need device measurements. High/Medium/Low and resource counters are implemented to support that check. Browser network throttling and physical touch testing remain manual. No contest entry has been submitted.

## Acceptance test — Slow 4G and real devices

1. Open the live game in Chrome. In DevTools → Network choose **Slow 4G**. Choose **Play solo now** and verify three bots, a visible countdown, and a live three-minute round. On a GPU-capable device choose 3D; otherwise the fallback should remain playable.
2. Move along walls and through doorways. Movement starts/stops with input. Touch a canister, press Space/Grab, carry it to the green exit, and verify exactly one point and a two-second respawn. Repeat in Classic Delivery.
3. Join the same code in another tab/device with a different nickname. Watch each other move; remote motion should interpolate rather than jump backward. Keep only one poll in flight per client. In debug mode note RTT and correction count.
4. Face a specimen and press F/right-click/Foam. A charge is spent; wait for recharge. Verify the frozen color and that a wall blocks the shot. Collect a G pickup, throw a grenade, and verify its fuse and splash. Three valid freezes within 12 seconds give +2 once. A catch drops the canister and briefly blocks movement, followed by immunity.
5. Leave Chaos off initially: teammates remain unaffected by foam. In the lobby enable Chaos and start again; friendly foam/grenade hits should briefly slow, never stun, a teammate.
6. Let the deadline finish. Verify frozen final scores, top-three podium, session best and Play Again. Replay must preserve bot levels and reset scores, charges, grenades, specimens and position epochs.
7. Test one human + seven bots, then join as a human: the newest bot's seat is replaced. Refresh a client, test host handoff, and leave the last human to close the room.
8. On a real phone run a full round in Medium, exercising the joystick and all three action buttons. On a laptop test High, Medium, Low, repeated 2D/3D switches, resize/fullscreen and context-loss recovery. Record FPS, draw calls, triangles, geometry/texture counts and input feel; lower quality if needed.

## Files

- Application: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`.
- Authority: `app/api/room/route.ts`, `lib/room-engine.ts`, `lib/sim/*`.
- Client sync: `lib/movement-sync.ts`, `lib/render/snapshots.ts`.
- Presentation: `lib/render/three/*`, `lib/render/breach-overlay.ts`, `lib/render/audio.ts`, shared types/controller/2D.
- Database: `db/schema.ts`, `drizzle/0002_secret_catseye.sql`, Drizzle journal/snapshot.
- Credits: `public/assets/CREDITS.md`.
- Tests: `tests/verify-v3.mjs` and the named suites above.
