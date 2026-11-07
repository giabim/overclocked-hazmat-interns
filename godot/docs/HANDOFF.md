# Handoff — continue from here (for ChatGPT / Codex)

Updated: 2026-11-07. Written by Claude. Read this file and `AGENTS.md` before working.

## 1. Where the work is

- Repo `giabim/overclocked-hazmat-interns`, branch `godot-long-term`, folder `godot/`.
- Base: `5514b7f` (M2.5 sheet). Claude added these commits on top (delivered as a git bundle / patch files, because Claude couldn't push):

| Commit | What |
| --- | --- |
| `beb8a10` | M3.1 grid line of sight + BFS flow field |
| `3de5975` | M3.2–M3.4 sim: specimens, foam, grenades, caught rules |

If the commits are not on GitHub yet, the owner applies them first (see §6).

## 2. Verified

`./tools/check.sh` on Godot 4.7.2 (Linux headless): **49/49 tests**, both scene smokes pass, no warnings.

## 3. What the new sim does (all numbers in `sim/tuning.gd`)

| File | Role |
| --- | --- |
| `sim/grid_los.gd` | `GridLos.clear(grid, a, b)` (blocks diagonal corner gaps), `free_distance(grid, from, dir, max, radius)`, `cell_of(pos)` |
| `sim/flow_field.gd` | `FlowField.build(grid, targets)`, `distance(cell)`, `next_cell(cell)`, `steer(pos)` |
| `sim/specimen_state.gd` | Kind SLIME/HOUND; Mode DEN, PATROL, CHASE, WINDUP, DASH, TIRED, STUNNED, FROZEN |
| `sim/specimen_ai.gd` | Spawn (1 per 2 participants, max 4, Slime first), patrol, notice, chase, give up, hound wind-up/dash/wall stun/tired |
| `sim/hazards.gd` | Foam, grenades, freezes + contain, catches, sensor sweep. Called from `Rules.advance` |
| `sim/grenade_pickup.gd`, `sim/thrown_grenade.gd` | Grenade data |
| `GameState` | New: `players`, `specimens`, `grenade_pickups`, `thrown_grenades`, `contained`, `field_to(cell)`. `create(..., spawn_specimens = true)` |
| `PlayerState` | New: `yaw`, `foam_charges`, `foam_cooldown`, `has_grenade`, `stun_remaining`, `immune_remaining`, `facing()` |

**Events for the views** (`state.events`, each a Dictionary with `kind`):

| kind | data |
| --- | --- |
| `foam_fired` | `position`, `direction` |
| `foam_hit` / `foam_miss` | `id`, `position` / `position` (where the foam lands) |
| `contained` | `id`, `specimen` (`&"slime"`/`&"hound"`), `position` |
| `grenade_pickup` / `grenade_respawn` | `id`, `position` |
| `grenade_thrown` / `grenade_burst` | `from`, `position` / `position` |
| `caught` | `player`, `specimen`, `how` (`&"dashed"`/`&"touched"`), `from_angle` (0 = in front, +PI/2 = right, −PI/2 = left, ±PI = behind), `position` |
| `canister_dropped` | `id`, `position` |
| `slime_notice` / `hound_notice` / `hound_windup` / `hound_wall_stun` | `id`, `position` |
| `sensor_sweep` | `blips` (`Array[Vector2]` of specimens outside dens) |

## 4. Choices Claude made (owner can change)

1. Every foam hit counts toward containment, even on an already frozen specimen (spec says "frozen 3 times within 12 s"). Solo players can contain fast; revisit after playtests.
2. The hound keeps aiming during wind-up and locks direction 0.2 s before the dash (`HOUND_AIM_LOCK_SECONDS`), so a well-timed sidestep makes it hit a wall.
3. After a catch: the slime ignores players for 3 s; the hound becomes tired (2 s). The player is stunned 1 s, then immune 2.5 s.
4. Grenades are picked up by walking onto a `G` crate (no key).
5. A caught player drops the canister where they stand; anyone can pick it up.
6. Orientation still uses its scripted fakes (`GameState.create(grid, 1, 0, false)`).
7. Balance note (not a playtest): a random-input test player was caught ~28 times per 4-minute shift with 2 specimens. Tune only after M2.5 observations.

## 5. Next tasks, in order

1. **M3.4 view:** "why you got caught" card (e.g. "Caught by Spark Hound — it dashed from the left") + screen-edge arrow from `from_angle`, 1 s desaturate. Card text lives in `game/`, not `sim/`.
2. **M3.5:** specimen views (primitive meshes per `docs/art.md` §4.4; frosty blue when FROZEN; den cage), grenade crates/thrown grenade/burst, positional audio (slime 8 m, hound 12 m; louder crackle in WINDUP), sensor-sweep blips on the minimap for 1 s, HUD foam charges + grenade icon.
3. **Cohesion check:** Orientation R3/R4 use real `SpecimenState` (sleepy slime that can't catch; hound behind glass).
4. **M2.5 (👤 owner):** 3–5 new players, record in `docs/playtests/01.md`, fix the top 3 problems. Never invent observations. M1.4 movement check is also still waiting for the owner.
5. Then M4 bots (they use `PlayerInput` and `GameState.players`).

Done-when for each task stays as in `AGENTS.md`: `./tools/check.sh` passes, new logic has tests, roadmap box ticked, one CHANGELOG line.

## 6. Applying Claude's commits (owner, Windows Git Bash or PowerShell)

```
cd "D:/GitHub/game handshake/overclocked-godot-long-term"
git checkout godot-long-term
git pull "C:/Users/<you>/Downloads/overclocked-m3.bundle" godot-long-term   # fast-forward
# or: git am "C:/Users/<you>/Downloads/m3-patches/"*.patch
cd godot && ./tools/check.sh
git push origin godot-long-term
```
