# Overclocked v3.1 — implementation and verification

Date: October 31, 2026 (America/Chicago)

Game: https://overclocked-hazmat-interns.giakhiemhcmc.chatgpt.site/

Repository: https://github.com/giabim/overclocked-hazmat-interns

This report describes the implementation of the supplied L-0–L-6 plan. It distinguishes code/test results from GPU and physical-device measurements that could not be completed here.

## Delivered

| Step | Change |
| --- | --- |
| L-0 | Debug-only 300-frame median FPS, 5% floor FPS, frame-time p95/SD, CPU median, >33/>50 ms frames over the last minute, React effect-update batches/sec, RTT p50/p95, correction and CAS-loss counts/minute. No statistics sorting or renderer stats reads in ordinary play. |
| L-1 | Medium is the default on every device. Auto/Ultra/High/Medium/Low menu, safely remembered. Ultra alone enables bloom/clearcoat/2048 shadows; High has 1024 PCF shadows and no bloom. Medium has PBR/environment/blob shadows, DPR ≤1.5 mouse/1.25 touch. Low disables bump, DPR ≤1. Potato is automatic only, DPR 0.75 and Lambert materials. Two consecutive slow 2-second p95 windows step down; at most one recovery upgrade, capped at Medium. |
| L-2 | External snapshot store and primitive selectors for timer, score, carry, charge, weapon and roster/lifecycle state. Position-only polls do not update the page's React state. Landing/help/HUD parts are memoized. Debug text updates imperatively at most twice/sec, never causing whole-page renders. Connection state changes only when it flips. Late authoritative final scores still update results and session best. |
| L-3 | Camera copies its clamped follow target, without lerp/trailing. Reusable camera offset/vectors/sets/frame objects; player/monster frame objects are reused between snapshots. ResizeObserver replaces per-frame DOM size reads. Foreground movement uses up to 100 ms/frame; gaps >250 ms and hidden-tab frames are skipped. Walls update only after a cell change. Dedicated 192×120 minimap and separate guide canvas update at ≤12 FPS; the full overlay is for names/effects. |
| L-4 | Removed the playable 2D renderer, maze view, view preferences, view toggle, old view URL behavior and 2D fallback tests. Both Classic Delivery and Containment Breach use 3D. Landing preloads the chunk after a short idle delay. Loading overlay, WebGL tips and Retry, restored-context rebuild, 3-second recovery timeout and a two-failed-rebuild stop. Slow devices use Low/Potato. Navigation overlay moves to the minimap. |
| L-5 | One display delay shared by players and specimens: last 20 arrival gaps, median×1.5 + 2×MAD, 120–400 ms, 20% smoothing. PvE rewind cap 600 ms, 14 specimen/history samples; Chaos player rewind cap 250 ms. CAS losers return their original read plus accepted local position without a third database batch; action counters remain unacknowledged until committed. Redundant <40 ms polls skip simulation/CAS; fresh movement/actions still drain immediately. |
| L-6 | Floor AO near walls and light pools baked at load. 1.2-unit walls, dark tops, bright edge, side panels, hazard bands and centered smaller room names. Merged hazmat boots/belt/tank/helmet, articulated arms, bounded facing, waddle/lean/start-stop squash/carry wobble. Translucent core-lit slime, long hound with four legs/tail and striped warning lane, wind-up sparks, instanced ice shards. Instanced canister halo billboards/pop-in, short foam particles, score pops and world-anchored catch text. Off-screen/edge/HUD-overlapping names are culled. Reduced-motion settings suppress decorative motion. |

Classic Delivery, Breach, scoring, grabs/drops, respawn timing, bot levels, capacity, host handoff, restart and the three-minute deadline are retained. No database schema migration or gameplay dependency upgrade was needed in v3.1. Additional pose history lives in the existing room JSON.

## Black-frame handling

The previous High path used the composer/bloom. High now renders directly, as do Medium, Low and Potato. Ultra remains opt-in. On the first composed Ultra frame, a synchronous nine-point framebuffer check detects an almost-black output and disables the composer, then redraws directly. Debug shows `bloom guarded off` if that happens.

`tests/render-tiers.mjs` bundles the actual renderer into an isolated local fixture, starts Playwright Chromium with the requested SwiftShader flags, checks all five tiers, immediately copies WebGL pixels into a 2D canvas, and fails on near-black/empty frames. It also checks Medium ≤80 calls and ≤120,000 triangles. `--baseline` can record the prior three-tier build for comparison.

**Blocked verification:** no Chromium binary is installed in this execution container. The official Playwright browser download returned an invalid/truncated archive. The cloud browser has WebGL unavailable. The GPU pixel test and before/after GPU timing therefore did not run to completion. The reported original shader/bloom failure was not independently reproduced or diagnosed at its source. The direct default paths and runtime guard mitigate it; they are not evidence that Ultra's underlying numerical issue is fixed.

## Verified results

- TypeScript check passes.
- The combined regression runner passes all gameplay, networking, quality, store, controller, HUD, geometry, frame-time and diagnostic suites. The final release also runs the build and dynamic-bundle budget check.
- A full hazmat model, including arms, visor and bot antenna, has **756 triangles**, below the 1,000-triangle requirement.
- Actual route tests force CAS races: two contenders use exactly **four batches total**, including the loser; no third snapshot read. A redundant sub-step poll uses **one batch**.
- Moving-target tests freeze the displayed specimen pose for D=150/300/400 ms and RTT=100/300 ms. PvE is capped at 600 ms and Chaos at 250 ms. This is not a physical Slow 4G hit-rate measurement.
- Movement at 10, 15, 20 and 60 FPS covers the same distance in one second. Hidden-tab gaps do not grant movement time.
- 600 position-only snapshots leave the structural UI and score selectors unchanged. Score, timer, charge and lifecycle values invalidate their own selections. Results also react to late final-score changes.
- Full simulated three-minute rounds with seven mixed-level bots and four specimens still pass, along with wall collision, exactly-once scores/actions, host controls, capacity, handoff and restart regressions.
- Controller tests cover missing WebGL/chunk/timeout, Retry, restored context, timeout rebuilding, two-failed-rebuild stop, cancellation and no 2D path.
- Preview UI shows the WebGL requirement/tips/Retry with `?view=2d&debug=1`; there is no 2D toggle. The room, timer, bot scores, podium and results continue to work. Retry preserves the room. This checks the unsupported-graphics path, not a successful GPU scene.

The diagnostic React counter coalesces effects from one update flush into a batch count. It is a practical update-frequency measure, not a replacement for a React DevTools profiling trace.

## Before/after: measured facts and open measurements

| Item | v3 | v3.1 | Evidence |
| --- | --- | --- | --- |
| Default on a mouse device | High, DPR up to 2, bloom/shadows | Medium, DPR up to 1.5, no bloom/shadow map | Configuration |
| Default on touch | DPR up to 1.5 | DPR up to 1.25 | Configuration |
| Default pixel work at DPR caps | Mouse 4× / touch 2.25× CSS pixels | Mouse 2.25× / touch 1.5625× | Calculated: 43.75% / 30.56% fewer pixels; not measured GPU time |
| Page state per position poll | Whole snapshot setState | External store; no page invalidation | 600-snapshot selector test |
| Per-frame DOM size reads | clientWidth/clientHeight | None; ResizeObserver | Source and type/build checks |
| Movement at 10 FPS | 50% time retained | 100% time retained | Frame-time regression test |
| Camera trail | Exponential ~100 ms | Target copied each frame | Implementation |
| Display delay | Per-track, up to 1500 ms | Shared, bounded 120–400 ms | Delay regression test |
| CAS-loser batches | 3 | 2 | Forced actual-route race test |
| Frame-time p95, FPS floor, Medium actual calls | Not measured here | Not measured here | GPU/browser limitation above |

Saved native checkpoints preserve L-0 through L-5 separately as versions **9–14**, with source commits for review/rollback. The completed visual/report release is published separately. No claim is made that the physical laptop ≥55 FPS floor, phone ≥30 FPS floor, ≤2 React batches/sec, ≤2 corrections/minute, or ≥9/10 Slow 4G hits has been met yet.

## Reproduce automated checks

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/verify-v3.mjs
```

After a production build:

```bash
node tests/render-bundle.mjs
```

For the optional GPU regression, install Playwright in the development environment and its Chromium binary, then run:

```bash
node tests/render-tiers.mjs
```

The GPU harness is a local synthetic renderer fixture with no account/session data. It uses the explicitly requested software-rendering flags. Software results compare paths; they do not certify phone FPS.

## Record a before and after on laptop and phone

1. Use the same browser/device, window size and zoom for each run. Compare the saved L-0 checkpoint with the current version only when deliberately doing a controlled rollback/test; the existing v3.1 release is the normal play link.
2. Open `?debug=1`, create Breach, add seven bots and start. A solo shortcut creates three bots; return to the lobby and add four more for the eight-participant benchmark.
3. Choose **Medium**. Move continuously for 60 seconds, circling rooms and walking through doorways. Avoid leaving the tab hidden. After warm-up record median FPS, 5% floor FPS, frame p95/SD, >33/>50 ms count, React batches/sec, CPU ms, DPR, calls, triangles, RTT p50/p95, D and corrections/CAS losses per minute.
4. Repeat the same route on a real phone, using the joystick. Record the device, browser, viewport, graphics setting and participant count with every row. Do not compare desktop software rendering with a real-phone run as if they were equivalent.
5. In Chrome DevTools → Network select **Slow 4G**. Join the same room from a second tab/device. Verify immediate local input, smooth held/interpolated remote motion, no wall clipping, and grabs/deliveries using the accepted position.
6. Aim at the moving slime's visible position and spray ten valid shots, waiting for recharge/cooldown. Count registered freezes; target ≥9/10. Confirm walls block shots. Chaos off: teammates unaffected. Chaos on: player rewind must remain bounded at 250 ms.
7. Run a full three-minute round, then Play Again. Check podium/final scores/session best, preserved bot levels and reset weapons/epochs. Test Classic Delivery too.
8. Check Ultra/High/Medium/Low. Use Auto on a slow device; quality may reach Potato but must stay in 3D. Test resize/fullscreen, `?view=2d` being ignored, a browser without WebGL, Retry, and `WEBGL_lose_context` recovery on a development machine.

## Practical limits

A complete 3D-only conversion means a WebGL-disabled browser can manage a room but cannot play the arena until graphics work. This is the requested behavior. The game remains request-driven and D1-backed, not a continuously ticking dedicated server. Idle lobby/results polling can raise the shared delay toward its 400 ms cap; evaluate the delay target during an active round. No contest submission was made.
