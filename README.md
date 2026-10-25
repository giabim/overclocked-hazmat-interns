# Overclocked The Hazmat Interns

A browser delivery race for friends or solo players against Clumsy Intern bots. Create a lab, join with a five-character room code, and carry glowing canisters to the green exit. Most deliveries in three minutes wins.

## Day 2 scope

- Complete round: Grab/Drop, delivery zone, server-owned scoring, two-second canister respawn, three-minute server deadline, ranked results, and Play Again.
- Two canisters for small rooms; three when a round starts with six or more participants. A late sixth participant also adds a third canister.
- Carrying makes players 15% slower. Only one player can grab each canister; each delivery scores once.
- Solo start with one human and at least one bot. The host can add/remove up to seven bots in the lobby.
- One bot difficulty: Lv1 Clumsy Intern. No level picker or respawn animation.
- Full rooms give a new human the newest bot's seat. Bots cannot become host. Play Again keeps bots; the last human leaving closes the room.
- Keyboard (WASD/arrows and Space), pointer/touch joystick, and Grab/Drop button.
- Day 1 room codes, capacity checks, invite links, session restoration, reconnect feedback, human host handoff, and public anonymous-compatible routes.

## Implementation

Day 1 of the 3D migration adds an optional Three.js view. Classic 2D remains the default pending the laptop/phone performance gate. Choose **3D** in the arena toolbar, or use `?view=3d`; `?view=2d` forces Classic. The choice is saved when browser storage permits, with URL overrides taking priority on load. Add `&debug=1` (or `?debug=1`) for frame rate, draw calls, triangles, memory counts, and pixel ratio.

One animation loop builds a `FrameView` from `MovementSync` and passes it to either renderer. The existing 2D drawing and label layout were extracted without changing their drawing commands. The 3D foundation uses colored capsules, canisters, blob shadows, a self ring, projected labels, and a fixed 60° camera that fits the entire arena. Three.js loads only when 3D is requested. Missing WebGL2, import failure/timeout, context loss, resize failure, repeated drawing errors, or persistently slow frames switch to Classic 2D while the round continues. The server, database, bots, input handlers, and movement-sync code are unchanged by this migration. See `docs/3D_Day_1_Report.md` for scope, saved checkpoints, tests, and the pending device gate.

React/TypeScript and canvas render the game. A Sites Worker and D1 store authoritative rooms, players, canister ownership, scores, and round deadlines. The client sends its predicted position, movement direction, and monotonic input/interaction counters. The server accepts displacement up to `220 × carrying ratio × elapsed seconds × 1.3 + 10px`, otherwise moves only that far toward the request, and clamps to the arena. Elapsed time is bounded by the current round, rather than a 350ms per-request cap. Grabs and deliveries use this accepted position. Direction-only requests from older clients remain supported.

Sync uses one `db.batch()` round trip per request. The batch validates the session, updates movement and ownership, claims elapsed simulation time, advances bots, resolves deliveries, checks the deadline, and returns a snapshot. The SQL compare-and-set uses a monotonically increasing simulation timestamp and a per-batch claim token; requests with overlapping timestamps cannot replay the same elapsed time.

Bot movement is capped at 500 ms per update and split into at most ten 50 ms steps. Bots think every 1.5 seconds, chase the nearest available-in-time canister even when carried, wobble, and plan an accidental drop on approximately one trip in six. Steering uses L1 normalization, so its speed never exceeds 70% of the human maximum; diagonal bot movement can be slower. All tuning values are in `lib/bot-settings.ts`.

Running polls target a 100ms start-to-start cadence (850ms in the lobby/results), with at most one sync request in flight. A request taking more than 100ms is followed immediately by the next request, without another fixed delay. Actual cadence is limited by network/server time.

Local movement starts/stops immediately. Server acknowledgements are compared with the predicted position sent for that sequence, so an old accepted position does not pull the player backward. Only errors greater than 40px are corrected, over 150ms. Remote players and bots interpolate between four confirmed position samples. The buffer starts at 200ms and adapts to slower sample intervals; a monotonic playback cursor prevents rewinds and holds at the newest sample during an outage. Snapshots expose the actual position timestamp so repeated observer polls cannot overwrite a slower sender's useful history. Neither the server snapshot nor remote rendering extrapolates velocity. There is no WebSocket transport, background game loop, or physics rollback.

Inactive human sessions expire after 30 seconds; bots are exempt. A room is marked closed when its last human explicitly leaves. If all humans stop polling without leaving, no simulation runs, and a later join detects that no active human remains and closes the old room. Room codes expire after six hours.

Session secrets are per-tab, hashed in the database, and omitted from snapshots. Host management actions require an active human host. `drizzle/0001_long_microbe.sql` appends the Day 2 schema to the existing migration history.

## Source map

- `app/page.tsx`: check-in, lobby, HUD, canvas, controls, results, and polling.
- `app/api/room/route.ts`: create/join, host actions, bots, and lifecycle.
- `lib/room-engine.ts`: authoritative batched sync and bot simulation.
- `lib/movement-sync.ts`: prediction acknowledgement history, bounded corrections, remote interpolation, and poll timing.
- `lib/render/`: common frame/events, Classic 2D renderer, 3D renderer, camera fitting, preference selection, and fallback controller.
- `lib/bot-settings.ts`: gameplay and bot tuning values.
- `db/schema.ts`, `drizzle/`: durable schema and migrations.
- `tests/`: regression and gameplay integration checks.

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
```

Use the Sites build helper for deployment builds. Generate future migrations with `node node_modules/drizzle-kit/bin.cjs generate`, then apply only pending SQL files to the local preview database. Hosted migrations are applied during publishing.

The handler harness executes the actual API source against SQLite through the D1 interface. Day 2 tests cover competing grabs, interaction retries, slowdown, one-time scoring, respawn, deadlines/results, bot management, capacity, human replacement of bots, host handoff, no double bot advancement, capped speed, an entire simulated three-minute round against seven bots, and bot preservation/restart. These checks do not replace hosted performance or physical-device testing.

The full sync statement batch was also executed successfully in the local D1 engine. Browser preview checks passed for a real three-minute solo round against three bots, ranked results, Play Again with preserved bots, and human keyboard pickup/delivery with the same point visible on two clients.

Movement regression checks cover 500ms request intervals without lost movement, speed limits including carrying, accepted-position grabs/deliveries, stale/invalid requests, arena bounds, round boundaries, old acknowledgements without rubber-banding, 150ms corrections, remote reversals and outages at 100/400/500ms sample intervals, and start-to-start polling. See `docs/Movement_Fix_Report.md` for the change report and throttled-network acceptance steps.

## Acceptance test

1. Create a room and add three bots. Start a solo round.
2. Move with WASD/arrows, touch a canister, and press Space or Grab. Carry it to the green exit; verify one point and a two-second respawn.
3. Let the full three-minute round finish. Verify ranked results, then Play Again. Bots should remain in the lobby.
4. Test one human plus seven bots. Add Bot must be disabled at eight participants.
5. Join the same room from a phone. A human joining a full room must replace the newest bot.
6. Test two humans plus two bots. Verify shared ownership, scores, timer, and results; compare countdowns within one second.
7. Refresh one device. Have the host leave and verify a human receives host controls while bots continue. Have the last human leave and verify the old room closes.

Physical phone/laptop touch, network responsiveness, the full-room frame rate on a phone, and the subjective bot difficulty still require the user's acceptance test. No Handshake submission has been made.

## Next phase

Playtest and tune the simple loop before adding special anomaly effects or additional bot difficulty levels.
