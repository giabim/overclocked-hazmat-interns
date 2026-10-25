# Movement synchronization fix

The movement update preserves the existing UI, game rules, and Lv1 bot decision/simulation logic.

## Changes

- Sync requests send the locally predicted `x/y` and the existing input sequence.
- The server validates displacement against human speed, carrying slowdown, and full elapsed server time: `speed × elapsed × 1.3 + 10px`. Excess movement is limited along the requested vector; coordinates stay inside the arena. Lobby time does not grant movement credit, and movement remains bounded by the round deadline.
- Grabs and deliveries run after position acceptance in the same D1 transaction. Existing session authentication, sequence checks, interaction deduplication, and single-award scoring remain in place.
- Server snapshots return stored positions and their acceptance timestamps, without the former 350ms extrapolation.
- Local prediction trusts accepted moves. It compares the server's acknowledged sequence with the position sent for that sequence, rather than the newer position currently on screen. Errors over 40px ease back over 150ms.
- Other players and bots use four distinct confirmed position samples. Playback starts 200ms behind the server and increases its buffer on slower connections. It blends between samples, never extrapolates, never rewinds, and holds the last sample if updates stop.
- Running polls target a 100ms start-to-start cadence with one sync request in flight. When a request takes longer than that, the next poll starts after completion without an additional fixed delay.

## Verification

Run from the repository root:

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/multiplayer.mjs --in-process
node tests/day2.mjs
node tests/movement.mjs
```

All four commands above passed. The movement tests execute the actual server handler against SQLite and the actual client movement module against delayed snapshots. They check 500ms movement intervals, vector speed limits, carrying, grabs/deliveries using the accepted position, walls, stale/invalid requests, round-state freezes, immediate local start/stop, old acknowledgements, correction timing, smooth remote turns at 100/400/500ms sample intervals, variable 100–800ms intervals, outage holds, and poll timing. Existing multiplayer and full-round/bot acceptance tests remain part of validation.

The browser preview connected two human clients and one bot, accepted human movement visible in both views, and showed synchronized bot deliveries/timers without server errors. The new SQL runs in preview's actual D1 engine. The production build passed. Chrome's actual Slow 4G preset and a physical phone were not tested in this environment.

## Chrome Slow 4G acceptance

1. Open the live game in Chrome. Open DevTools, select Network, and choose **Slow 4G** from the throttling dropdown. Keep DevTools open. If your Chrome version uses another preset name, choose its slow mobile-network preset or a custom connection with roughly 400–500ms latency.
2. Create a room. In a separate tab/window, join the same code with another nickname. Keep both views visible; background tabs can have their rendering throttled. Throttle the second tab too when checking both directions.
3. Start a round. Press and release WASD/arrows. Your character should start and stop immediately without routine backward pulls. The other view should show smooth, slightly delayed motion and turns.
4. Stand on a canister and press Space/Grab. Confirm ownership, walk to the green exit, and confirm exactly one point and a two-second respawn. Repeat with bots present.
5. In Network, filter for `/api/room`. Sync request starts should be about 100ms apart when responses are faster than 100ms. Under Slow 4G they should follow response completion, with no overlapping sync requests or additional 120ms wait. Host-management requests are separate actions.
6. Let the round finish, confirm results and Play Again, then repeat movement/pickup on a real phone using the joystick and Grab button.

A 200ms buffer cannot cover every Slow 4G gap, so the adaptive remote delay can grow. Long outages still hold the latest known remote position. These automated checks do not replace Chrome's actual Slow 4G preset or a physical-phone playtest.
