# Handoff — continue from here (for ChatGPT / Codex)

Updated: 2026-11-07, by Claude. Read this file and `AGENTS.md` before working.

**Starter prompt (paste to Codex):**

```
Read godot/AGENTS.md and godot/docs/HANDOFF.md. Confirm ./tools/check.sh passes (57/57 tests + 3 scene smokes).
Then do the first unchecked item in HANDOFF §6 that does not need a human. Follow AGENTS.md "Done when".
Never invent playtest results. Reply in ≤ 10 lines.
```

## 1. Where the work is

- Repo `giabim/overclocked-hazmat-interns`, branch `godot-long-term`, folder `godot/`.
- Base: `5514b7f` (M2.5 playtest sheet). Claude could not push, so its commits come as a git bundle / mailbox file. The owner applies them first (§7).

| Commit | What |
| --- | --- |
| `beb8a10` | M3.1 grid line of sight + BFS flow field |
| `3de5975` | M3.2–M3.4 sim: specimens, foam, grenades, caught rules |
| `5c3a27e` | M3.4–M3.5 views: specimens, den cages, grenades, caught card + arrows, positional audio, sweep blips, foam/grenade HUD |
| `d49c817` | M3 cohesion: Orientation R3/R4 use real specimen records + views |
| `e08d283` | M4.1/M4.2/M4.4: bot brains Lv1–3, multi-player rules, bot league test |
| `0762ece` | M4.3: lobby (0–7 bots, level), merged bot models, minimap dots |
| last commit | This report |

(The other commits in between only update this file.)

## 2. Status

- **Done:** M3.1–M3.5, M3 cohesion check, M4.1–M4.4.
- **Checks:** `./tools/check.sh` on Godot 4.7.2 (Linux headless) → **57/57 tests**, both scene smokes pass (~40 s).
- **Review renders** (`docs/shots/`): `M3_specimens.png` (77 draw calls), `M3_orientation_slime.png`, `M3_orientation_hound.png`, `M4_bots.png` (7 bots, 93 draw calls; limit 120). Made with `xvfb-run -a .tools/godot --path . --rendering-method gl_compatibility --script res://tools/capture_scene.gd -- --capture --specimens` (or `--bots`, or `--orientation --slime-pen` / `--glass-hall`).
- **Bot league:** default test (3 × 150 s shifts per level) passes. A 6 × 180 s run gave medians Lv1 68 < Lv2 78 < Lv3 85; catches per run: Lv1 178, Lv2 9, Lv3 1. The full `BOT_LEAGUE=1` run (50 × 240 s per level) was started but not finished.
- **Waiting for a human (👤):** M1.4 movement feel, M2.5 Playtest #1, feel/audio check of M3 on Windows, Playtest #2 (bots).
- **Audio smoke flake fixed (Codex, 2026-11-07):** stopped playback objects now drain before scene resources are freed. Verified 12 consecutive passes of all 3 smokes (36 clean processes), including active/paused/overlapping/positional audio.

## 3. What was built

| File | Role |
| --- | --- |
| `sim/grid_los.gd` | `GridLos.clear(grid, a, b)` (blocks diagonal corner gaps), `free_distance(...)`, `cell_of(pos)` |
| `sim/flow_field.gd` | `FlowField.build(grid, targets, avoid = {})`, `distance`, `next_cell`, `steer` |
| `sim/specimen_state.gd`, `sim/specimen_ai.gd` | Slime/Hound. Modes DEN, PATROL, CHASE, WINDUP, DASH, TIRED, STUNNED, FROZEN. 1 per 2 participants (max 4), Slime first |
| `sim/hazards.gd` | `player_actions` (grenade pickup, foam, throw) + `world_step` (crates, fuses, specimens, catches, sweep) |
| `sim/bot_brain.gd` | Bots Lv1–3; output is a normal `PlayerInput` |
| `sim/rules.gd` | `Rules.advance(state, input, delta)`: `input` drives players[0]; each `state.brains[i]` drives bot i |
| `sim/game_state.gd` | `players`, `brains`, `specimens`, `grenade_pickups`, `thrown_grenades`, `contained`, `quota_override`, cached `field_to(cell)`. `create(map, count, seed, spawn_specimens, bot_levels)` |
| `game/specimens/specimen_views.gd` | Specimen models, den pens (bars close while occupied), looping positional sounds |
| `game/level/grenade_views.gd` | Grenade crates and arcing grenades |
| `game/player/bot_views.gd` | Bots: each `InternView` baked into one mesh + 2 number labels (draw-call budget) |
| `game/ui/hud.gd`, `game/ui/minimap.gd` | Foam/grenade line, caught card + edge arrows + grey-out, sweep blips, crates, bot dots, lobby (BOTS −/+, BOT LEVEL cycle) |
| `tests/test_grid_los.gd`, `test_specimens.gd`, `test_tools.gd`, `test_specimen_views.gd`, `test_bots.gd` | New tests |

**Events for views** (`state.events`, Dictionaries with `kind`): `foam_fired` (position, direction), `foam_hit` (id, position), `foam_miss` (position), `contained` (id, specimen, position), `grenade_pickup` (id, player, position), `grenade_respawn`, `grenade_thrown` (from, position), `grenade_burst` (position), `caught` (player, specimen, how = dashed/touched, from_angle: 0 front, +PI/2 right, −PI/2 left, ±PI behind, position), `canister_dropped`, `slime_notice` / `hound_notice` / `hound_windup` / `hound_wall_stun` (id, position), `sensor_sweep` (blips). `pickup` / `delivery` now also carry `player`.

## 4. Choices Claude made (owner can change)

1. Every foam hit counts toward containment, even on a frozen specimen ("frozen 3 times within 12 s").
2. The hound aims during wind-up and locks direction 0.2 s before the dash, so a well-timed sidestep makes it hit a wall (stun 1.5 s).
3. After a catch: player stunned 1 s, then immune 2.5 s; the slime ignores players 3 s, the hound becomes tired. A carried canister drops where the player stood.
4. Grenades are picked up by walking onto a `G` crate.
5. Bots: perception = sight (≤ 16 m, line of sight) or hearing (slime 8 m, hound 12 m; frozen specimens are silent). The lobby offers one level for all bots or "MIXED" (1, 2, 3, 1, …), not a separate level per bot.
6. The shift is won when the human (players[0]) reaches the airlock during extraction; bots walk there too.
7. Orientation stays catch-free: its slime sleeps, its hounds are scripted but drawn with the real specimen views.

## 5. Balance findings (from simulations, not playtests)

- With 4 bots the normal quota (2 + participants = 6) is met in ~25 s, so a shift ends almost at once. Suggest a quota that grows with team size (e.g. 3 × participants + 2). Owner decides; change only `GameState.quota()` / `sim/tuning.gd`.
- A random-input test player was caught ~28 times per 4-minute shift with 2 specimens. Wait for real playtest notes before tuning.

## 6. Next tasks, in order

1. [x] Imported bundle at c89bb4a, verified 57 tests on Windows, pushed; GitHub CI run 42382958773 passed.
2. 👤 Owner: M1.4 walk check + play a shift with specimens and bots (feel, caught card clarity, sounds on Windows). Note results in `docs/playtests/`.
3. 👤 **M2.5 Playtest #1** (3–5 new players), then fix the top 3 problems. Never invent observations.
4. **Quota balance** (§5) once the owner picks a formula. Add a test.
5. Optional polish:
   - [ ] Per-bot level buttons in the lobby.
   - [ ] Bots use ping.
   - [x] Fix flaky ObjectDB audio cleanup; 57 tests + 3 smokes pass.
6. 👤 **Playtest #2:** solo + 3 bots at each level. Is Lv1 easy and Lv3 helpful without doing everything?
7. **M5 Online** (plan first, effort high). Notes: `GameState` is already multi-player. Add `Rules.advance_inputs(state, inputs: Array[PlayerInput], delta)` so the server can feed one input per peer; keep bots server-side; WebSocket per `docs/tech.md` §5.5.

## 7. Applying Claude's commits (owner)

Download `overclocked-godot.bundle` (or `overclocked-godot.mbox`), then in Git Bash:

```
cd "D:/GitHub/game handshake/overclocked-godot-long-term"
git checkout godot-long-term
git status            # must be clean and at 5514b7f
git pull ~/Downloads/overclocked-godot.bundle godot-long-term
# or: git am ~/Downloads/overclocked-godot.mbox
cd godot && ./tools/check.sh
git push origin godot-long-term
```

## 8. Rules for the next agent

- Follow `AGENTS.md`: one roadmap item per task, typed GDScript, numbers in `sim/tuning.gd`, `./tools/check.sh` must pass.
- Game rules stay in `sim/` (no Nodes). Views only read state and events.
- Keep draw calls ≤ 120 (bots are merged meshes for this reason).
- Art stays "not Among Us" (`docs/art.md`). No dark patterns.
