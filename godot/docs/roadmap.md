## 6. Roadmap (docs/roadmap.md)

Rough time is for part-time work (~10 h/week). Each milestone ends with a **cohesion check** (D1): the new part has a look, sound and feedback, not just logic.

| Phase | Milestones | Rough time | Result |
| --- | --- | --- | --- |
| 1. Foundation | M0–M2 | 5–7 weeks | Offline solo shift that already looks and sounds like *our* game, with Orientation |
| 2. Systems | M3–M4 | 4–6 weeks | Specimens, foam, grenades, bots Lv1–3 |
| 3. Online | M5–M6 | 6–8 weeks | Play over the internet, web + desktop together |
| 4. Identity + content | M7–M8 | ongoing | Final art and audio, more maps and modes |
| 5. Ship | M9–M10 | 4 weeks + | Playtest program, public release |

### M0 — Skeleton
- [x] **M0.1** Split `docs/GUIDE.md` into files at each `<!-- FILE: path -->` … `<!-- END FILE -->` marker (copy exactly). Add `README.md` (5 lines), `docs/CHANGELOG.md`, `docs/CREDITS.md`, `docs/notes.md`, `.gitignore` (`.godot/`, `.tools/`, `build/`, `*.tmp`), `.gitattributes` (`* text=auto eol=lf`, binaries `binary`). **Done:** files exist; AGENTS.md ≤ 70 lines.
- [x] **M0.2** `tools/get_godot.sh` and `tools/check.sh` from §5.7. **Done:** `./tools/get_godot.sh` prints `4.7.2.stable…`.
- [x] **M0.3** `project.godot` per §5.2, empty `game/main.tscn` (Node3D + Camera3D + "Overclocked" label), input map. **Done:** `--import` has no errors.
- [x] **M0.4** `tests/run_all.gd` (§5.7) + `tests/test_smoke.gd` (one passing test). **Done:** `./tools/check.sh` exits 0 and prints `1/1 tests passed`.
- [x] **M0.5** CI workflow (§5.7). **Done:** CI is green on GitHub.

### M1 — Vertical slice (offline, 1 player)
- [x] **M1.1** `sim/map_grid.gd`, `maps/lab_a.txt`. Tests: size 24×15; 213 walkable; all reachable from `P` (BFS); counts of `C G M P E +` match §5.4.
- [x] **M1.2** `sim/grid_move.gd` (§5.4), `sim/tuning.gd`. Tests: 10,000 random moves never end inside a wall; sliding along a wall keeps the parallel motion; a 10 m move in one call can't pass through a 2 m wall.
- [x] **M1.3** `game/level/level_builder.gd`: builds floor, walls (MultiMesh), door frames and exit from the grid. Colors from `docs/art.md`. **Done:** draw calls ≤ 40 in the Lab A scene (show `Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)` in a debug label).
- [ ] **M1.4** `game/player/player_view.gd`: first-person camera at 1.6 m, captured mouse, `Camera3D.keep_aspect = KEEP_WIDTH` with FOV setting, inputs → `sim` each tick, view interpolation. **Done:** 👤 You walk the whole map; it feels smooth; no camera lag.
- [x] **M1.5** `sim/game_state.gd` + `sim/rules.gd`: canisters, carry, deliver, Heat, quota, extraction, results. Tests: delivery lowers Heat by 6%; meltdown at 100%; quota formula.
- [x] **M1.6** HUD: Heat bar, carry icon, count, minimap with wing colors and room codes. Results screen with "Play again".
- [x] **M1.7** Placeholder intern (primitives, human proportions, respirator, chest tank, number) + **silhouette gate** (§4.1). **Done:** `docs/shots/M1_silhouette.png`; 👤 You approve.
- [ ] **Cohesion check:** a solo 4-minute shift with sounds for pickup, delivery and alarms.

### M2 — Teach + feedback + feel
- [x] **M2.1** `maps/orientation.txt` + room triggers for R1–R4 (§3.6), idle-8 s hints, Skip, first-run flag. (Slime and hound in R3/R4 can be scripted fakes until M3.)
- [x] **M2.2** `game/fx/feedback.gd`: one event bus (`signal fx(kind: StringName, data: Dictionary)`) → sounds, particles, HUD (§3.5).
- [ ] **M2.3** Juice pass (D7): small camera kick (≤ 0.5°, off with "reduce motion"), steam, sparks, light shifts with Heat.
- [ ] **M2.4** Settings menu (§3.9), saved to `user://settings.cfg`. Quality tiers (§4.6).
- [ ] **M2.5** 👤 **Playtest #1:** 3–5 new players, no explanation. Write down where they get stuck in `docs/playtests/01.md`. Fix the top 3 problems before M3.

### M3 — Specimens and tools (offline)
- [ ] **M3.1** `sim/grid_los.gd` (grid ray march) + `sim/flow_field.gd` (BFS distance field to targets). Tests: LOS blocked by walls; flow field leads from every cell to the target.
- [ ] **M3.2** `sim/specimen.gd`: states Den → Patrol → Chase → (Hound: WindUp → Dash → Tired) → Frozen → Patrol; hound wall stun 1.5 s (§3.7). Numbers from §3.4.
- [ ] **M3.3** Foam sprayer (cone, charges, cooldown, freeze, contain 3-in-12 s) and freeze grenade (throw, fuse, radius, respawn).
- [ ] **M3.4** Caught rule (drop, stun, immunity) + "why you got caught" card + direction arrow.
- [ ] **M3.5** Specimen views + positional audio (slime 8 m, hound 12 m) + sensor sweep.
- [ ] Tests: no catch during immunity; hound wind-up always ≥ 0.6 s before a dash; a carrying player outruns a slime on a straight path; contain only on 3 freezes within 12 s.
- [ ] **Cohesion check:** frozen look, contain cage, sounds, and Orientation R3/R4 now use real specimens.

### M4 — Bots (1–7, Lv1–3)
- [ ] **M4.1** `sim/bot_brain.gd`: produces the same input struct as a human. Perception = LOS + hearing radius only.
- [ ] **M4.2** Lv1/Lv2/Lv3 behaviors (§3.10), all numbers in `tuning.gd`.
- [ ] **M4.3** Lobby screen (offline): add 1–7 bots, pick a level for all or per bot.
- [ ] **M4.4** Headless bot league test (`tests/test_bot_league.gd`, can be slow; skip in CI with an env flag): 50 shifts per level. **Done:** median score Lv3 > Lv2 > Lv1; no bot stays still for > 5 s while it has a goal.
- [ ] 👤 **Playtest #2:** solo with 3 bots at each level. Is Lv1 easy, Lv3 helpful but not doing everything?

### M5 — Online foundation (ask Codex to **plan first**, effort high)
- [ ] **M5.1** `net/net_config.gd`, `net/server.gd`, `net/client.gd` with `WebSocketMultiplayerPeer`. Start the server with `--server` or the `dedicated_server` feature. Desktop "Host game" = listen server.
- [ ] **M5.2** Lobby over the network: join by address, names, ready, host settings (validated), max 8, bots fill empty slots.
- [ ] **M5.3** Input RPC + server sim loop + snapshot codec + interpolation (§5.5).
- [ ] **M5.4** Prediction + reconciliation for the local player.
- [ ] **M5.5** `net/lag_sim.gd` (dev setting).
- [ ] **M5.6** `tools/net_smoke.sh`: headless server + 2 headless bot clients for 20 s with 150 ms RTT and 2% loss. **Done:** both clients see 2 players; after input stops, positions match the server within 5 cm.
- [ ] 👤 **Check:** web build (browser) + desktop build in the same match.

### M6 — Netcode quality
- [ ] **M6.1** Lag-compensated foam (rewind ≤ 250 ms). Test: a hit that was valid on the client's screen 150 ms ago is accepted; 400 ms ago is rejected.
- [ ] **M6.2** Net debug overlay (F3): RTT, jitter, snapshot rate, prediction error, 5th-percentile frame time.
- [ ] **M6.3** Reconnect within 30 s keeps your slot and score.
- [ ] **M6.4** RPC fuzz test: random/garbage arguments never crash the server or change state.
- [ ] **M6.5** Dedicated server export + `Dockerfile` + Caddy `wss` example + `docs/deploy.md`. 👤 You rent the server.

### M7 — Identity pass (art + audio)
- [ ] **M7.1** 👤 Final intern model (artist or CC0 base, customized to §4.1) with attachment points; Codex integrates it and a simple walk/carry/spray animation set.
- [ ] **M7.2** Environment kit (§4.3) + baked lightmaps + wing landmarks + signage.
- [ ] **M7.3** Audio: lab hum per Heat level, adaptive music layers, alarms. CC0 only, credited.
- [ ] **M7.4** Silhouette gate again + screenshot set in `docs/shots/M7_*.png`. 👤 You check the full §4.1 table.

### M8 — Content and modes
- [ ] **M8.1** Map 2 (hand-made ASCII) + a map validator tool (reachability, spawn/exit distance, den distance).
- [ ] **M8.2** Optional generated maps with constraints (rooms + corridors, validated) [R26].
- [ ] **M8.3** "Rival Shift": 2 teams, separate quotas, shared specimens. No deception.
- [ ] **M8.4** Fixed achievements + cosmetic unlocks (helmet stripes, badges). Respect checklist §3.8.
- [ ] **M8.5** Only if playtests ask for more Discovery: lab puzzles (valves, coolant routes, door switches).

### M9 — Playtest program + balance
- [ ] **M9.1** Local match log (`user://logs/*.json`): duration, deliveries, catches by type and cell, foam hits/misses, bot levels, points by source. Opt-in only; no personal data.
- [ ] **M9.2** `tools/log_report.gd`: heatmap of catches, points by strategy, "dominant strategy" flag if one source > 60% of points (P5).
- [ ] **M9.3** 👤 Playtest every 2 weeks (5 players). After each shift ask 5 questions: "I felt capable" (competence), "I had real choices" (autonomy), "I felt part of the team" (relatedness) [R3], "I knew why I got caught" (P3), "I want to play another shift" (1–5 scale).
- [ ] **M9.4** Balance only `sim/tuning.gd`, one change at a time, noted in `docs/CHANGELOG.md`.

### M10 — Ship
- [ ] **M10.1** Web build on itch.io (single-threaded) + Windows/Linux downloads.
- [ ] **M10.2** Room list / simple matchmaker service (only if players need strangers to play with).
- [ ] **M10.3** Credits screen, privacy note (what the logs keep), controls screen.
- [ ] **M10.4** Trailer capture with Movie Maker (`--write-movie`) [R25]. Store/cover images must pass §4.1.
- [ ] Later: touch controls for mobile; ENet for desktop-only servers if WebSocket lag is a problem (§9).
