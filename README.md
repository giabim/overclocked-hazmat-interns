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

React/TypeScript and canvas render the game. A Sites Worker and D1 store authoritative rooms, players, canister ownership, scores, and round deadlines. The client sends movement direction and monotonic input/interaction counters.

Sync uses one `db.batch()` round trip per request. The batch validates the session, updates movement and ownership, claims elapsed simulation time, advances bots, resolves deliveries, checks the deadline, and returns a snapshot. The SQL compare-and-set uses a monotonically increasing simulation timestamp and a per-batch claim token; requests with overlapping timestamps cannot replay the same elapsed time.

Bot movement is capped at 500 ms per update and split into at most ten 50 ms steps. Bots think every 1.5 seconds, chase the nearest available-in-time canister even when carried, wobble, and plan an accidental drop on approximately one trip in six. Steering uses L1 normalization, so its speed never exceeds 70% of the human maximum; diagonal bot movement can be slower. All tuning values are in `lib/bot-settings.ts`.

The client waits 120 ms after a running request completes before its next poll, or 850 ms in the lobby/results. Network and server time add to these delays. Client prediction/interpolation improves rendering; there is no WebSocket transport, background game loop, or physics rollback.

Inactive human sessions expire after 30 seconds; bots are exempt. A room is marked closed when its last human explicitly leaves. If all humans stop polling without leaving, no simulation runs, and a later join detects that no active human remains and closes the old room. Room codes expire after six hours.

Session secrets are per-tab, hashed in the database, and omitted from snapshots. Host management actions require an active human host. `drizzle/0001_long_microbe.sql` appends the Day 2 schema to the existing migration history.

## Source map

- `app/page.tsx`: check-in, lobby, HUD, canvas, controls, results, and polling.
- `app/api/room/route.ts`: create/join, host actions, bots, and lifecycle.
- `lib/room-engine.ts`: authoritative batched sync and bot simulation.
- `lib/bot-settings.ts`: gameplay and bot tuning values.
- `db/schema.ts`, `drizzle/`: durable schema and migrations.
- `tests/`: regression and gameplay integration checks.

## Validation

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/multiplayer.mjs --in-process
node tests/day2.mjs
```

Use the Sites build helper for deployment builds. Generate future migrations with `node node_modules/drizzle-kit/bin.cjs generate`, then apply only pending SQL files to the local preview database. Hosted migrations are applied during publishing.

The handler harness executes the actual API source against SQLite through the D1 interface. Day 2 tests cover competing grabs, interaction retries, slowdown, one-time scoring, respawn, deadlines/results, bot management, capacity, human replacement of bots, host handoff, no double bot advancement, capped speed, an entire simulated three-minute round against seven bots, and bot preservation/restart. These checks do not replace hosted performance or physical-device testing.

The full sync statement batch was also executed successfully in the local D1 engine. Browser preview checks passed for a real three-minute solo round against three bots, ranked results, Play Again with preserved bots, and human keyboard pickup/delivery with the same point visible on two clients.

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
