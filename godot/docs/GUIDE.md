# Overclocked (Godot) — Codex Build Guide v1

| | |
| --- | --- |
| **For** | Khiêm (owner) and Codex (coder) |
| **Date** | Friday, November 6, 2026 |
| **Engine** | **Godot 4.7.2 stable** (latest stable). Do **not** use the 4.8 betas. [R17] |
| **Language** | GDScript with static types (no C#: Godot 4 can't export C# to the web) [R18] |
| **Repo** | A **new, separate** repo `overclocked-godot`. The old web game (`overclocked-hazmat-interns`) is not touched. |
| **Type** | Long-term project (not a hackathon). One milestone at a time. |
| **Look** | Our own identity. **Must not look like Among Us** (§4). |

---

## 0. How to use this file (you, 5 minutes)

1. Create an empty GitHub repo `overclocked-godot`. Put this file at `docs/GUIDE.md`.
2. Give Codex task **M0.1** (§7). Codex splits this file into small files using the `<!-- FILE: path -->` markers. After that, Codex reads only the small file a task needs, which saves tokens.
3. Then give one task per Codex thread, in order (M0.2, M0.3, …). Use the template in §7.
4. Tasks marked **👤 You** need a human: playtests, art approval, accounts, money.
5. If Codex makes the same mistake twice, add **one line** to `AGENTS.md` (OpenAI's advice [R19]).

---

## 1. Research → rules

Each rule below comes from a source in §10. The rule IDs (D1, D2 …) are used in the rest of this guide.

| ID | What the research says | Rule for this game |
| --- | --- | --- |
| D1 | Mechanics alone don't make a game fun. Deus Shift had balanced mechanics but failed: plain grey look, no story, weak tutorial. Fun comes from **cohesion** of design, art, story and mood. [R1] | Every milestone ships a **cohesion slice**: mechanic + look + sound + feedback together. No "mechanics now, art later". |
| D2 | In a study of 45,000+ players, tutorials helped only the most complex game (up to +29% play time). In simpler games, players learned by exploring. In the complex game, in-context help beat an up-front manual. Limiting player freedom didn't clearly help. [R2] | Teach through play (Portal/Braid style): safe rooms, one new idea each. Text only when the player is stuck (idle 8 s). Never lock controls. |
| D3 | Enjoyment and wanting to play again are predicted by **competence, autonomy, relatedness**. Intuitive controls matter through competence and autonomy. [R3] | Tight controls first. Real choices (routes, tools, roles). Co-op tools that need teammates (pings, rescue, combo freezes). |
| D4 | GameFlow: "players should receive immediate feedback on their actions", should "always know their status or score", and challenge "must match the players' skill levels". [R4] | Every action gets a cue within 100 ms (§3.4). Bots and specimen count scale with skill. |
| D5 | MDA: designers work from mechanics, players feel aesthetics. Pick target aesthetics first. [R5] | Targets: **Challenge, Fellowship, Discovery**. Support: Sensation (juice). Not targets: deception, grinding. |
| D6 | Dark patterns: grinding, playing by appointment, pay to skip, monetized rivalries, social pyramid schemes. [R6] Loot-box spending is linked to problem gambling (n = 7,422). [R7] | No loot boxes, no random paid rewards, no daily-login streaks, no FOMO timers, no pay to skip. Rewards are fixed and shown up front. |
| D7 | Visual "juice" (bursts, glows, pops) improved visual appeal in every game tested. [R8] | Hits, freezes and deliveries get particles + sound + small camera feedback (can be turned off). |
| D8 | Latency hurts precise, fast actions most. [R9] Compensation methods: prediction, interpolation, time warp. [R10][R16] Of five aim assists, bullet magnetism worked well; sticky targets and target gravity didn't. [R11] | Server-authoritative. Predict own movement. Interpolate others. Rewind specimens for foam hits (≤ 250 ms). Light aim magnetism. |
| D9 | Frame-rate **variation** hurts experience, not only low average fps. [R12] | Budget the 5th-percentile frame time (§5.9), not just average fps. |
| D10 | Landmarks and maps help wayfinding in large worlds. [R13] | Each wing has a color + a unique landmark. Minimap. Room codes on walls. |
| D11 | 42–56% of people got motion sick playing normal console games on a screen. [R14] Sickness rose as movement speed went from about 3 to 10 m/s. [R15] | FOV slider, head bob OFF by default, "reduce motion" switch, no sprint or speed boosts. |
| D12 | Hidden information (fog of war) without feedback feels unfair. (Your design notes.) | First-person view hides a lot, so give audio cues, sensor sweeps and a "why you got caught" card (§3.5). |
| D13 | Almost any rule can be broken in the right case. (Your design notes.) | Every pillar has a "break it when" line. A playtest result beats this guide. |

---

<!-- FILE: AGENTS.md -->
# AGENTS.md — Overclocked (Godot 4.7.2)

Co-op first-person game: interns in hazmat suits keep an overheating underground lab alive. They deliver coolant canisters and freeze escaped specimens with foam. 1–8 players (humans or bots). Online play is server-authoritative.

## Scope
- Work **only** in this repo. Never read or change other repos (e.g. `overclocked-hazmat-interns`).
- One task = one roadmap item (`docs/roadmap.md`). Don't start the next item.

## Read only what you need (saves tokens)
- Always: this file. Then **only** the roadmap section named in the task, plus the files it lists.
- Design: `docs/design.md` · Art: `docs/art.md` · Tech: `docs/tech.md`. Open them only when the task says so.
- Never open: `.godot/`, `*.import`, `build/`, `.tools/`, or binary files (`*.png *.glb *.wav *.ogg *.ttf`).
- Read file ranges (`sed -n`, `grep -n`), not whole big files. Don't print whole files in replies.

## Layout
`sim/` pure rules (`RefCounted`, no Nodes, testable headless) · `net/` networking · `game/` scenes + view scripts · `maps/` ASCII maps · `assets/` CC0 only · `tests/` · `tools/` scripts · `docs/`

## Commands
- Setup: `./tools/get_godot.sh` (Godot 4.7.2 → `.tools/godot`; `WITH_TEMPLATES=1` for exports)
- Check everything: `./tools/check.sh` (import + parse every script + tests). **Must pass before you finish.**
- One script: `.tools/godot --headless --path . --check-only --script res://sim/grid_move.gd`
- Tests only: `.tools/godot --headless --path . --script res://tests/run_all.gd`
- Export: `.tools/godot --headless --path . --export-release "Web" build/web/index.html`

## Code rules
- Godot 4 only. Typed GDScript (`var x: int`, `-> void`). Style: Godot style guide (snake_case files/functions, PascalCase classes).
- Godot 3 → 4: `KinematicBody`→`CharacterBody3D`, `Spatial`→`Node3D`, `yield`→`await`, `export var`→`@export var`, `onready`→`@onready`, `connect("s", o, "m")`→`s.connect(f)`, `instance()`→`instantiate()`, `remote/master/puppet`→`@rpc(...)`.
- Game rules live in `sim/`. Views (`game/`) only read sim state and draw it. All tuning numbers live in `sim/tuning.gd`.
- Server decides everything that matters (position, hits, score). Validate every RPC argument. Clients send inputs only.
- Prefer building nodes in code or tiny `.tscn` files. Never hand-edit `uid=` values. Commit `*.uid` files.
- No new addons, paid assets or network services without asking. Assets: CC0 only, listed in `docs/CREDITS.md`.
- Art must follow `docs/art.md` (**not Among Us**: no bean body, no single big visor, no backpack).
- No dark patterns: no loot boxes, streaks, FOMO timers, pay to skip.

## Done when
1. `./tools/check.sh` exits 0, with no new warnings.
2. New logic has a test in `tests/test_*.gd`.
3. Tick the roadmap box and add one line to `docs/CHANGELOG.md`.
4. Reply in ≤ 10 lines: files changed, tests added, what a human must check.

## If stuck
After 2 failed tries: stop, write what you tried in `docs/notes.md`, and ask one clear question.
<!-- END FILE -->

---

<!-- FILE: docs/design.md -->
## 3. Design (docs/design.md)

### 3.1 The game in one paragraph

**Overclocked: The Hazmat Interns.** The underground lab's servers are running too hot, and specimens have escaped. You and up to 7 other interns (friends or bots) work a **shift**. Carry coolant canisters to the Exit Airlock to cool the lab. Freeze specimens with foam and contain them. Reach the quota before the **Heat** meter hits 100% (meltdown), then extract. First person, co-op by default. No betrayal or voting.

### 3.2 Target experience (MDA [R5])

| Aesthetic | What the player should feel | Main mechanic |
| --- | --- | --- |
| Challenge | "That was close, but I did it." | Heat meter, specimens, quota |
| Fellowship | "We saved that shift together." | Combo freezes, escorts, pings, rescue |
| Discovery | "Oh! The hound crashes into walls!" | Specimen tricks you learn by playing (§3.6) |
| Sensation (support) | Foam feels good, alarms feel tense | Juice, audio, lights (D7) |

The game is not trying to be cute-funny all the time. A shift should feel tense, then end in relief. Games don't have to be only "fun" (your notes); here the goal is **tension → teamwork → relief**.

### 3.3 Pillars

| # | Pillar | Do | Test | Break it when |
| --- | --- | --- | --- | --- |
| P1 | Cohesion (D1) | Every mechanic fits "hot lab, hazmat crew, containment". Heat is the round clock. | Can a new player explain why each mechanic exists in this world? | A fun mechanic doesn't fit: change the story, not the fun. |
| P2 | Teach by playing (D2) | One new idea per safe room. No text walls. | 4 of 5 new players finish Orientation without help. | A complex system (later modes) may need a short tutorial card. |
| P3 | Clear feedback (D4, D12) | Every action gets a cue in ≤ 100 ms. Hidden threats are heard before they are seen. | After a catch, players can say *why* it happened. | Short scares: hide one cue on purpose for 1–2 s, never longer. |
| P4 | Discover strategies (your notes) | Each specimen has a learnable counter. | Playtesters find each counter by themselves within 3 shifts. | If players never find one, add a hint in the environment, not in text. |
| P5 | No single dominant strategy | Every strong plan has a counter (§3.7). | Match logs (M9): no single plan scores > 60% of points in most matches. | Orientation puzzles *should* have one best answer. |
| P6 | Respect players (D6) | Fixed, visible rewards. Shifts end cleanly. | Checklist in §3.8 passes. | Never. |

### 3.4 Core rules v1 (all numbers in `sim/tuning.gd`)

Units: 1 Godot unit = 1 m. Map grid cell = 2 m. Sim tick = 30 Hz.

| Rule | Value |
| --- | --- |
| Shift | Heat goes 0 → 100% in 240 s. Each delivery: −6% Heat. 100% = meltdown (shift failed). |
| Quota | (2 + participants) canisters, counting humans + bots. Quota reached → Extraction: 20 s to reach the airlock. |
| Score | +1 per canister delivered, +2 per specimen contained. Team score + personal stats. |
| Player | Radius 0.475 m. Walk 5.5 m/s. Carrying 4.7 m/s. Eye height 1.6 m. |
| Canisters | 8 spawn cells (`C`). A delivered canister comes back at a random free `C` after 10 s. |
| Caught | Drop canister, stunned 1.0 s, then 2.5 s immune (blinking). |
| Foam Sprayer | Everyone. Range 3.5 m, cone ±15° from the crosshair (includes magnetism). 5 charges, +1 every 1.5 s, 0.8 s cooldown. Freeze 2.5 s. |
| Freeze Grenade | Pickup on `G` cells (3). Carry 1. Thrown 4 m (stops at walls), 0.6 s fuse, radius 1.75 m, freeze 3.5 s. Respawn 20 s. |
| Contain | Frozen 3 times within 12 s → contained (+2 to whoever froze it last). It returns to its den for 8 s. |
| Specimens | 1 per 2 participants (min 1, max 4), alternating Slime / Hound. |
| Goo Slime | Radius 0.6 m, 3.0 m/s. Notices you at path distance ≤ 6 cells. Gives up at > 10 cells or after 8 s. Catches on touch. |
| Spark Hound | Radius 0.55 m, 4.4 m/s. Notices you in line of sight ≤ 5 cells. Wind-up 0.6 s (sparks + sound), then a straight dash at 8.8 m/s for 0.5 s, then tired 2 s at 0.4× speed. Gives up after 3 s. |
| Fairness | Slimes are slower than a carrying player. Hound wind-up (0.6 s) is longer than the interpolation delay (0.1 s). No catches during immunity. |
| PvP | Off. Host option "Chaos": foam slows other players 40% for 1.5 s. |

### 3.5 Feedback table (P3)

| Event | Visual | Audio | HUD |
| --- | --- | --- | --- |
| Foam fired | Spray instantly (local, cosmetic) | Hiss | Charges −1 |
| Foam hit (server confirmed) | Specimen turns frosty blue + ice particles | Crunch | Hit marker |
| Foam miss | Foam splat on the wall | Soft splat | — |
| Contained | Cage snaps shut, blue flash | Big "clunk" + team chime | "+2 CONTAINED · name" |
| Pickup / delivery | Canister glows / airlock vents steam | Clank / whoosh | Count, Heat −6% |
| Hound sees you | Sparks; screen-edge arrow toward it | Rising crackle (12 m radius) | — |
| Slime near | — | Wet squelch (8 m radius) | — |
| Caught | 1 s desaturate, arrow from the attacker's direction | Thud | Card: "Caught by Spark Hound — it dashed from the left" |
| Hidden threats | Sensor sweep every 12 s: specimens blink on the minimap for 1 s | Ping | Minimap |
| Teammates | Outline through walls (co-op) | Footsteps | Name + carry icon |
| Heat 75% / 90% | Lights shift orange → red, heat shimmer | Alarm layers in music | Heat bar pulses |

### 3.6 Teach by playing: Orientation (4 rooms, skippable)

| Room | Teaches | How (no text) | Text fallback (only after 8 s idle) |
| --- | --- | --- | --- |
| R1 Locker | Move + look | The door opens when you step into the light. | "WASD to move · mouse to look" |
| R2 Supply | Pick up / carry / deliver | The only exit needs a canister in the slot. | "E to pick up" |
| R3 Slime Pen | Foam | A sleepy slime blocks the door. It can't catch you here. Freeze it 3 times → cage → door opens. | "Click to spray foam" |
| R4 Glass Hall | Hound telegraph + counter | Watch a hound behind glass: it winds up, dashes, hits a wall and gets stunned. Then a real hound appears in a hall with pillars. | "Watch for sparks, then dodge" |

The first run starts Orientation. A "Skip" button is always visible. The finished flag is saved in `user://settings.cfg`.

### 3.7 Strategies and counters (P4, P5)

| Strategy players may find | Counter built into the game |
| --- | --- |
| **Dodge a hound's dash so it hits a wall** → stunned 1.5 s (trick to discover) | Needs timing; a hound only starts a dash with ≥ 4 m clear ahead; two hounds can cover each other |
| Camp at the exit and foam everything | Canisters spawn far from the exit; Heat keeps rising if nobody carries |
| Foam spam | Charges + cooldown; contain needs 3 freezes in 12 s, so teams must time it |
| Run in a big group | Slimes block doors; deliveries are faster when split into pairs |
| Grenade the den | Dens are empty while specimens patrol; grenades respawn slowly |

### 3.8 Respect checklist (P6, D6)

- [ ] No loot boxes or random rewards for money.
- [ ] No daily-login streaks, energy timers or "come back in 4 hours".
- [ ] No pay to skip or pay to win.
- [ ] Unlocks (helmet stripes, badges) come from fixed achievements, shown in a list before you earn them.
- [ ] After a shift: results + "Play again" + "Main menu". No nag pop-ups.

### 3.9 Accessibility (D11)

Key remap · mouse sensitivity + invert Y · FOV slider (75–110 horizontal, default 90) · head bob OFF by default · "reduce motion" (no camera kick or shake) · colorblind-safe (players have numbers + patterns, not just colors) · subtitles for important sounds · toggle or hold for actions.

### 3.10 Bots (1–7, levels 1–3)

Bots send inputs through the **same input path** as humans, and see only what a player could see (line of sight + hearing radius). No wallhacks.

| Level | Name | Behavior |
| --- | --- | --- |
| Lv1 | Trainee | Goes to the nearest canister and delivers it. Reacts in 600 ms. Wanders 20% of the time. Foams only at close range. |
| Lv2 | Technician | Avoids specimens within 4 cells (flow-field cost). Foams at 6 m in line of sight. Picks up grenades. Reacts in 400 ms. |
| Lv3 | Supervisor | Claims canisters (no two bots chase the same one), escorts carriers, times 3 freezes to contain, grenades hounds during wind-up. Reacts in 250 ms. |
<!-- END FILE -->

---

<!-- FILE: docs/art.md -->
## 4. Art direction (docs/art.md): "Overclocked Underground", not Among Us

### 4.1 Avoid these Among Us signatures

The old web interns (capsule body + visor + tank) already look close to Among Us crewmates. The Godot version must break **every** row.

| Among Us signature | Our version |
| --- | --- |
| Bean body, no neck, no arms, stub legs | Human proportions (~5.5 heads tall, 1.75 m): arms, gloves, legs, boots |
| One big glossy visor | Full-face **respirator**: two small round eye lenses + two side filter canisters |
| Backpack | **Chest-mounted** foam tank with a hose to a hand nozzle |
| Whole body in one bright color per player | Shared off-white/orange suit. Player ID = colored shoulder band + big stencil **number (01–08)** on the back and helmet + pattern |
| Flat cartoon shading, thick outlines | Stylized realism: worn fabric, rubber, metal (CC0 PBR textures), rim light, no outlines |
| Clean spaceship, tasks list, vents, emergency button, voting, ejection | 1970s industrial underground lab: concrete, pipes, cable trays, CRT terminals, server racks. No deception mechanics at all |
| Top-down 2D | First person, 3D |
| Bubbly white-outlined UI | Amber CRT / stencil style UI (§4.5) |

**Silhouette gate (M1 and M7):** render the intern in black on white at 128 px from front, side and 3/4 views. 👤 You compare it with a crewmate. If anyone could confuse them, change the shape before any other art work.

### 4.2 Palette

| Name | Hex | Use |
| --- | --- | --- |
| Night | `#14171A` | Shadows, UI background |
| Concrete | `#8A8D8F` | Walls, floors |
| Tyvek | `#E9E4D8` | Suits |
| Hazard Amber | `#F2A900` | Warning stripes, UI text |
| Heat | `#FF5A1F` | Heat meter, alarms, hot zones |
| Coolant | `#2EC4C9` | Canisters, foam, frozen specimens |
| Slime | `#7BD35A` | Goo Slime only |

Player bands (colorblind-safe, always paired with a number and pattern): `#E69F00` `#56B4E9` `#009E73` `#F0E442` `#0072B2` `#D55E00` `#CC79A7` `#FFFFFF`.

### 4.3 World

- Modular kit on a 2 m grid: wall, wall + window, door frame, corner, pipe run, cable tray, server rack (blinking LEDs), coolant tank, CRT terminal, hazard stripes at doors.
- Wings for wayfinding (D10): West Wing = cyan pipes + water tank landmark; East = amber + giant fan; North = red + server wall; South = green + specimen pens. Room codes stenciled on walls ("E-03").
- Lighting: warm sodium lamps + cyan emergency strips. As Heat rises, lights shift orange → red and steam appears.

### 4.4 Specimens

- **Goo Slime:** translucent green blob, two eyes, wobble, drips. Frozen = frosty blue.
- **Spark Hound:** low-poly dog-like machine-creature, cables for a tail, electric sparks during wind-up.
- Cartoon and non-violent: specimens are frozen and contained, never hurt.

### 4.5 UI

- Fonts (SIL Open Font License): **Barlow Condensed** (headings), **JetBrains Mono** (numbers). Put license files in `assets/fonts/`.
- Amber text on dark panels, thin stencil frames, small scanlines. Heat bar at the top center; canister count and charges at the bottom.

### 4.6 Renderer limits (Compatibility, needed for the web [R18][R20])

- **Not available:** SDFGI, VoxelGI, volumetric fog, SSR, SSIL.
- **Available:** glow, tonemapping, adjustments, SSAO (High tier only), MSAA 3D (limited), **baked lightmaps** (rendering works; baking needs a Forward+/Mobile-capable GPU, so bake on your PC).
- Static light = baked lightmaps. At most 2 shadowed lights on screen. Moving lights without shadows.
- Tiers: Low (no glow/SSAO, 0.75 render scale), Medium (glow), High (glow + SSAO + MSAA 2×).

### 4.7 Assets

CC0 only: Poly Haven, ambientCG, Kenney [R22]. Every file is listed in `docs/CREDITS.md` (name, source URL, license). Models made in code (primitives) are fine as placeholders. The final intern model can come from an artist (👤 You), with the same attachment points: `Head`, `Chest`, `HandR`, `HandL` (`Marker3D`).
<!-- END FILE -->

---

<!-- FILE: docs/tech.md -->
## 5. Tech (docs/tech.md)

### 5.1 Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Engine | Godot 4.7.2, pinned. Upgrade only between milestones, on a branch. | Stable release [R17] |
| Language | Typed GDScript | Web export needs it (no C# on web in Godot 4) [R18] |
| Renderer | `gl_compatibility` on every platform | The web only supports Compatibility. One look everywhere. [R18][R20] |
| Targets | Web (single-threaded export, no special headers needed) + Windows/Linux desktop. macOS and mobile later. | [R18] |
| Network | `WebSocketMultiplayerPeer` everywhere in v1 | Web exports only have WebSocket/WebRTC, no ENet/UDP [R18][R21] |
| Server | Dedicated headless server (export mode "dedicated server", strip visuals). Desktop players can also host (listen server). Web can't host. | [R23] |
| Solo/bots | Same code; no peer (offline peer = server id 1) | One code path |
| Physics | Custom circle-vs-grid movement in `sim/` (§5.4), not `CharacterBody3D` | Same result on server and client, fast, easy to test |
| Tests | Small built-in runner (§5.7). No test addon. | No version issues |

### 5.2 Project settings (`project.godot`)

- `application/config/name="Overclocked"`, `run/main_scene="res://game/main.tscn"`
- `rendering/renderer/rendering_method="gl_compatibility"` and `.mobile="gl_compatibility"`
- `physics/common/physics_ticks_per_second=30` (sim tick). Views interpolate with `Engine.get_physics_interpolation_fraction()`. Mouse look is applied every frame in `_process` (never wait for a tick).
- `debug/gdscript/warnings/untyped_declaration=2` (error) [R24]
- Input map: `move_forward` W, `move_back` S, `move_left` A, `move_right` D, `fire` left mouse, `throw` G / right mouse, `interact` E, `ping` Q, `pause` Esc.

### 5.3 Folders

```
sim/      tuning.gd map_grid.gd grid_move.gd grid_los.gd flow_field.gd
          game_state.gd rules.gd specimen.gd bot_brain.gd
net/      net_config.gd server.gd client.gd snapshot_codec.gd prediction.gd lag_sim.gd
game/     main.tscn  level/ player/ specimens/ fx/ ui/
maps/     lab_a.txt orientation.txt
tests/    run_all.gd test_*.gd
tools/    get_godot.sh check.sh net_smoke.sh shot.sh
```

### 5.4 Map + movement

Map legend: `#` wall · `.` floor · `+` doorway · `C` canister spawn · `G` grenade pickup · `M` specimen den · `P` player spawn · `E` exit airlock. Outside the map = wall. Sim `Vector2(x, y)` → world `Vector3(x, 0, y)`.

**Lab Complex A** (`maps/lab_a.txt`, 24×15 cells = 48×30 m). Checked: 213 walkable cells, all reachable from spawn; 8 `C`, 3 `G`, 2 `M`, 9 `P`, 3 `E`, 14 `+`.

```
########################
#C....#.......C.#....M.#
#.##..#..##..##.#..##..#
#.....+....G....+......#
#..C..#...#..#..#..C...#
###+#####+##+#######+###
#PPP..#....C....#......E
#PPP..+..##..##.+......E
#PPP..#.........#......E
###+#####+##+#######+###
#.....#...#..#..#...G..#
#..C..+....G....+..##..#
#.##..#..##..##.#....C.#
#M....#....C....#......#
########################
```

Movement (ported from the tested web version; runs on server and client):

```gdscript
class_name GridMove
extends RefCounted
## Circle-vs-grid movement with wall sliding. Units: meters.

const CELL := 2.0
const RADIUS := 0.475
const MAX_STEP := 0.2

static func hits_wall(grid: MapGrid, p: Vector2, r: float = RADIUS) -> bool:
	var x0 := floori((p.x - r) / CELL)
	var x1 := floori((p.x + r) / CELL)
	var y0 := floori((p.y - r) / CELL)
	var y1 := floori((p.y + r) / CELL)
	for cy: int in range(y0, y1 + 1):
		for cx: int in range(x0, x1 + 1):
			if not grid.is_wall(cx, cy):
				continue
			var nx := clampf(p.x, cx * CELL, cx * CELL + CELL)
			var ny := clampf(p.y, cy * CELL, cy * CELL + CELL)
			if (p.x - nx) ** 2 + (p.y - ny) ** 2 < r * r:
				return true
	return false

static func move_circle(grid: MapGrid, p: Vector2, d: Vector2, r: float = RADIUS) -> Vector2:
	var steps := maxi(1, ceili(d.length() / MAX_STEP))
	var s := d / steps
	for _i: int in steps:
		if not hits_wall(grid, Vector2(p.x + s.x, p.y), r):
			p.x += s.x
		if not hits_wall(grid, Vector2(p.x, p.y + s.y), r):
			p.y += s.y
	return p
```

`MapGrid` needs: `static func from_text(text: String) -> MapGrid`, `width`, `height`, `cell(cx, cy) -> String` (returns `"#"` outside), `is_wall(cx, cy) -> bool`, `cells_of(ch: String) -> Array[Vector2i]`, `cell_center(c: Vector2i) -> Vector2`.

### 5.5 Networking

**Model:** clients send inputs; the server runs the sim and sends snapshots (Godot's own advice: server-authoritative, validate RPC arguments, rate-limit, don't trust client positions or timers [R21]).

| Message | Direction | `@rpc` | Rate | Content |
| --- | --- | --- | --- | --- |
| `input` | C→S | `"any_peer", "call_remote", "unreliable_ordered", 1` | 30 Hz | `seq`, move `Vector2` (length ≤ 1), yaw, pitch, buttons bitmask, `view_tick` |
| `snapshot` | S→C | `"authority", "call_remote", "unreliable_ordered", 2` | 30 Hz | `tick`, your `ack_seq`, packed state (`PackedByteArray`) |
| `event` | S→C | `"authority", "call_remote", "reliable"` | on change | match start/end, caught, contained, chat ping |
| lobby (`join`, `ready`, `settings`) | C→S | `"any_peer", "call_remote", "reliable"` | on click | Server checks: name ≤ 16 chars, host-only settings, max 8 |

- **Server input buffer:** up to 4 inputs per player; use 1 per tick; if none, repeat the last for 3 ticks, then zero. Drop `seq` that go backwards. Kick if > 60 inputs/s.
- **Snapshot codec:** `StreamPeerBuffer`. Positions as int16 centimeters, yaw as uint16, flags as bits. Target ≤ 300 bytes per snapshot for 8 players + 4 specimens.
- **Interpolation:** draw other entities at server time − 100 ms (3 snapshots back).
- **Prediction:** keep the last 64 inputs. On each snapshot: reset own state to the server state, replay inputs with `seq > ack_seq` using `sim/` code. If the error is > 5 cm, smooth it out over 100 ms. Stuns and slows are part of the server state, so the replay handles them (no separate "epoch" needed).
- **Lag compensation (foam):** the server keeps 1 s of specimen positions. A hit test rewinds to the client's `view_tick` (max 250 ms back) and checks line of sight from the shooter's current server position. [R10][R16]
- **Transport:** `WebSocketMultiplayerPeer.create_server(port)`. Web clients on https need `wss://`: put Caddy or nginx with TLS in front of the server.
- **Lag simulator (dev only):** `net/lag_sim.gd` delays and drops our own messages (settings: +RTT ms, jitter ms, loss %). Use it in every net test.
- **v1 limit:** one match per server process. A room list / matchmaker comes later (M10).

### 5.6 Exports (`export_presets.cfg`, committed, no secrets)

| Preset | Notes |
| --- | --- |
| `Web` | Threads OFF (single-threaded). Host with gzip/Brotli. |
| `Windows Desktop`, `Linux Desktop` | Normal |
| `Linux Server` | Export mode "Export as dedicated server", resources "Strip Visuals". Server code checks `OS.has_feature("dedicated_server")`. [R23] |

### 5.7 Tests and checks

Test files: `tests/test_*.gd`, `extends RefCounted`. Each `func test_*() -> String` returns `""` on pass or an error message. A runtime error inside a test prints `SCRIPT ERROR`, and `check.sh` counts that as a fail. (Checked on Godot 4.7.2: the runner, `check.sh`, `get_godot.sh` and the movement code below all work, and an untyped `var x = 3` is rejected.)

```gdscript
extends SceneTree
## Run: godot --headless --path . --script res://tests/run_all.gd

func _initialize() -> void:
	var total := 0
	var failed := 0
	for f: String in DirAccess.get_files_at("res://tests"):
		if not (f.begins_with("test_") and f.ends_with(".gd")):
			continue
		var script: GDScript = load("res://tests/" + f)
		var obj: Object = script.new()
		for m: Dictionary in script.get_script_method_list():
			var method_name: String = m["name"]
			if not method_name.begins_with("test_"):
				continue
			total += 1
			var result: Variant = obj.call(method_name)
			if not (result is String and result == ""):
				failed += 1
				printerr("FAIL %s.%s: %s" % [f, method_name, str(result)])
	print("%d/%d tests passed" % [total - failed, total])
	quit(1 if failed > 0 else 0)
```

`tools/check.sh`:

```bash
#!/usr/bin/env bash
# Quiet on success (saves tokens). Prints only errors and the test summary.
set -euo pipefail
G="${GODOT:-./.tools/godot}"
imp=$("$G" --headless --path . --import 2>&1 || true)
grep -E "ERROR|WARNING" <<<"$imp" || true
fail=0
while IFS= read -r f; do
  out=$("$G" --headless --path . --check-only --script "res://${f#./}" 2>&1 || true)
  if grep -qE "Parse Error|SCRIPT ERROR" <<<"$out"; then grep -E "ERROR|at:" <<<"$out"; fail=1; fi
done < <(find . -name '*.gd' -not -path './.godot/*' -not -path './.tools/*' -not -path './addons/*')
[ "$fail" = 0 ] || { echo "Parse errors"; exit 1; }
out=$("$G" --headless --path . --script res://tests/run_all.gd 2>&1) && code=0 || code=$?
grep -E "FAIL|SCRIPT ERROR|at:|tests passed" <<<"$out" || true
# A runtime error inside a test prints SCRIPT ERROR; treat it as a failure.
if [ "$code" != 0 ] || grep -q "SCRIPT ERROR" <<<"$out"; then echo "Tests failed"; exit 1; fi
```

`tools/get_godot.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
VER=4.7.2
BASE="https://github.com/godotengine/godot/releases/download/${VER}-stable"
mkdir -p .tools && cd .tools
if [ ! -x godot ]; then
  curl -fsSL -o g.zip "$BASE/Godot_v${VER}-stable_linux.x86_64.zip"
  unzip -q -o g.zip && mv "Godot_v${VER}-stable_linux.x86_64" godot && rm g.zip
fi
if [ "${WITH_TEMPLATES:-0}" = 1 ]; then
  T="$HOME/.local/share/godot/export_templates/${VER}.stable"
  mkdir -p "$T"
  curl -fsSL -o t.tpz "$BASE/Godot_v${VER}-stable_export_templates.tpz"
  unzip -q -o t.tpz && cp -r templates/. "$T"/ && rm -rf templates t.tpz
fi
./godot --version
```

**Screenshot check (optional, for visual tasks):** `tools/shot.sh` runs `xvfb-run -a .tools/godot --path . --rendering-method gl_compatibility --write-movie /tmp/shot.png --fixed-fps 30 --quit-after 60 res://tools/shot_scene.tscn` and keeps the last frame in `docs/shots/`. Needs `xvfb` and Mesa (`apt-get install -y xvfb libgl1-mesa-dri`). [R25]

**CI** (`.github/workflows/ci.yml`): on push and pull request, run `ubuntu-latest` → checkout → `./tools/get_godot.sh` → `./tools/check.sh`. On tags `v*`: also export Web + Linux Server and upload them as artifacts.

### 5.8 Godot traps (tell Codex once, here)

- Run `--import` once before tests, or `class_name` scripts won't be found.
- `.tscn` files contain `uid=` and resource IDs. Hand edits break them; build nodes in code when you can.
- `await` inside `_initialize()` of a SceneTree script needs care; keep tests synchronous.
- Web: no blocking HTTP and no threads in our single-threaded build. Poll the peer every frame.

### 5.9 Performance budget

| Target | Budget |
| --- | --- |
| Frame time | 60 fps on a mid laptop (web, Medium). **5th-percentile frame time ≤ 25 ms** (D9) |
| Draw calls | ≤ 120 (walls via `MultiMeshInstance3D`, one per tile type) |
| Triangles | ≤ 250k visible |
| Lights | ≤ 2 shadowed lights on screen; static light baked |
| Network | ≤ 10 KB/s down per client |
| Web download | ≤ 40 MB compressed |
<!-- END FILE -->

---

<!-- FILE: docs/roadmap.md -->
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
- [ ] **M0.1** Split `docs/GUIDE.md` into files at each `<!-- FILE: path -->` … `<!-- END FILE -->` marker (copy exactly). Add `README.md` (5 lines), `docs/CHANGELOG.md`, `docs/CREDITS.md`, `docs/notes.md`, `.gitignore` (`.godot/`, `.tools/`, `build/`, `*.tmp`), `.gitattributes` (`* text=auto eol=lf`, binaries `binary`). **Done:** files exist; AGENTS.md ≤ 70 lines.
- [ ] **M0.2** `tools/get_godot.sh` and `tools/check.sh` from §5.7. **Done:** `./tools/get_godot.sh` prints `4.7.2.stable…`.
- [ ] **M0.3** `project.godot` per §5.2, empty `game/main.tscn` (Node3D + Camera3D + "Overclocked" label), input map. **Done:** `--import` has no errors.
- [ ] **M0.4** `tests/run_all.gd` (§5.7) + `tests/test_smoke.gd` (one passing test). **Done:** `./tools/check.sh` exits 0 and prints `1/1 tests passed`.
- [ ] **M0.5** CI workflow (§5.7). **Done:** CI is green on GitHub.

### M1 — Vertical slice (offline, 1 player)
- [ ] **M1.1** `sim/map_grid.gd`, `maps/lab_a.txt`. Tests: size 24×15; 213 walkable; all reachable from `P` (BFS); counts of `C G M P E +` match §5.4.
- [ ] **M1.2** `sim/grid_move.gd` (§5.4), `sim/tuning.gd`. Tests: 10,000 random moves never end inside a wall; sliding along a wall keeps the parallel motion; a 10 m move in one call can't pass through a 2 m wall.
- [ ] **M1.3** `game/level/level_builder.gd`: builds floor, walls (MultiMesh), door frames and exit from the grid. Colors from `docs/art.md`. **Done:** draw calls ≤ 40 in the Lab A scene (show `Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)` in a debug label).
- [ ] **M1.4** `game/player/player_view.gd`: first-person camera at 1.6 m, captured mouse, `Camera3D.keep_aspect = KEEP_WIDTH` with FOV setting, inputs → `sim` each tick, view interpolation. **Done:** 👤 You walk the whole map; it feels smooth; no camera lag.
- [ ] **M1.5** `sim/game_state.gd` + `sim/rules.gd`: canisters, carry, deliver, Heat, quota, extraction, results. Tests: delivery lowers Heat by 6%; meltdown at 100%; quota formula.
- [ ] **M1.6** HUD: Heat bar, carry icon, count, minimap with wing colors and room codes. Results screen with "Play again".
- [ ] **M1.7** Placeholder intern (primitives, human proportions, respirator, chest tank, number) + **silhouette gate** (§4.1). **Done:** `docs/shots/M1_silhouette.png`; 👤 You approve.
- [ ] **Cohesion check:** a solo 4-minute shift with sounds for pickup, delivery and alarms.

### M2 — Teach + feedback + feel
- [ ] **M2.1** `maps/orientation.txt` + room triggers for R1–R4 (§3.6), idle-8 s hints, Skip, first-run flag. (Slime and hound in R3/R4 can be scripted fakes until M3.)
- [ ] **M2.2** `game/fx/feedback.gd`: one event bus (`signal fx(kind: StringName, data: Dictionary)`) → sounds, particles, HUD (§3.5).
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
<!-- END FILE -->

---

## 7. Codex task template

Paste this, change the parts in `< >`. One task per Codex thread.

```
Task <M1.2>: <title from roadmap>
Goal: <one sentence>
Read: AGENTS.md, docs/roadmap.md section <M1.2> only, <docs/tech.md §5.4 if needed>, <files>
Only change: <paths>
Constraints: typed GDScript, Godot 4.7.2, numbers go in sim/tuning.gd, no new addons.
Done when: ./tools/check.sh exits 0; <the tests in the roadmap item> pass; roadmap box ticked; 1 CHANGELOG line.
Reply: ≤ 10 lines (files changed, tests added, what I must check by hand).
```

**First prompt (M0.1):**

```
Task M0.1: Split the guide into repo files.
Read: docs/GUIDE.md (this one time only).
Do: for every block between "<!-- FILE: path -->" and "<!-- END FILE -->", create that file with the exact content between the markers. Then do the rest of M0.1 in the roadmap.
Only change: new files listed in M0.1. Don't edit docs/GUIDE.md.
Done when: AGENTS.md, docs/design.md, docs/art.md, docs/tech.md, docs/roadmap.md exist; AGENTS.md ≤ 70 lines.
Reply: ≤ 5 lines.
```

**Effort and planning** (OpenAI's guidance [R19]):

| Task type | Reasoning effort | Plan first? |
| --- | --- | --- |
| M0, small UI, tuning changes | low | no |
| M1–M3 features | medium | no |
| M4 bots, M5–M6 netcode, any bug you can't reproduce | high | **yes** (`/plan`) |

---

## 8. Saving tokens (you + Codex)

1. **Short `AGENTS.md`** (it loads every time). Details live in `docs/` and are read only when needed.
2. **One thread per task.** Start a new thread for the next task. Don't keep one huge thread.
3. **Name exact files and sections** in the prompt. Codex won't search the whole repo.
4. **All numbers in `sim/tuning.gd`.** Balance tasks touch one file.
5. **Short replies:** "≤ 10 lines", no full-file echo.
6. **Never let Codex open** `.godot/`, `*.import`, binaries, or build output (already in AGENTS.md).
7. **Tests replace explanations:** "Done when the test passes" is shorter and safer than describing behavior twice.
8. **Fix the rule, not the chat:** when a mistake repeats, add one line to AGENTS.md instead of re-explaining.
9. **Use git worktrees** if two Codex threads run at once, so they never edit the same files.
10. **Don't paste this guide** into prompts. Codex reads the repo files.

---

## 9. Risks

| Risk | Sign | What to do |
| --- | --- | --- |
| WebSocket uses TCP, so packet loss causes stalls | Rubber-banding at 2%+ loss in `net_smoke` | Keep snapshots small; later add an ENet server for desktop-only matches |
| Compatibility renderer limits the look | Screens look flat | Baked lightmaps, strong palette, glow, good textures. Don't chase photorealism. |
| Still looks like Among Us | Anyone says "Among Us?" | Silhouette gate (§4.1) blocks art work until fixed |
| Scope creep | Many half-done systems | One milestone at a time; cohesion check before moving on |
| Godot upgrade breaks things | 4.8 stable comes out | Upgrade on a branch between milestones; run `check.sh` + net smoke |
| Codex writes Godot 3 code | `yield`, `KinematicBody` | AGENTS.md table; add the exact case if it repeats |
| Broken `.tscn` | Import errors, missing nodes | Build nodes in code; never hand-edit `uid=` |
| Bots feel unfair or useless | Playtest #2 complaints | Tune reaction time and perception in `tuning.gd` only |

---

## 10. References

**Design and player research (peer-reviewed unless noted)**

- [R1] Maletz, D. (2012, July 31). What makes a game fun? *Game Developer* (blog, not peer-reviewed). https://www.gamedeveloper.com/design/what-makes-a-game-fun-
- [R2] Andersen, E., O'Rourke, E., Liu, Y.-E., Snider, R., Lowdermilk, J., Truong, D., Cooper, S., & Popović, Z. (2012). The impact of tutorials on games of varying complexity. *Proceedings of CHI 2012*, 59–68. ACM. https://doi.org/10.1145/2207676.2207687 — project page: https://grail.cs.washington.edu/projects/game-abtesting/chi2012/
- [R3] Ryan, R. M., Rigby, C. S., & Przybylski, A. K. (2006). The motivational pull of video games: A self-determination theory approach. *Motivation and Emotion*, 30(4), 347–363. https://doi.org/10.1007/s11031-006-9051-8
- [R4] Sweetser, P., & Wyeth, P. (2005). GameFlow: A model for evaluating player enjoyment in games. *ACM Computers in Entertainment*, 3(3), Article 3A. https://doi.org/10.1145/1077246.1077253
- [R5] Hunicke, R., LeBlanc, M., & Zubek, R. (2004). MDA: A formal approach to game design and game research. *AAAI Workshop on Challenges in Game AI* (WS-04-04). https://aaai.org/papers/ws04-04-001-mda-a-formal-approach-to-game-design-and-game-research/
- [R6] Zagal, J. P., Björk, S., & Lewis, C. (2013). Dark patterns in the design of games. *Foundations of Digital Games 2013*. https://research.chalmers.se/en/publication/177148
- [R7] Zendle, D., & Cairns, P. (2018). Video game loot boxes are linked to problem gambling: Results of a large-scale survey. *PLOS ONE*, e0206767. https://doi.org/10.1371/journal.pone.0206767
- [R8] Hicks, K., Gerling, K., Dickinson, P., & Vanden Abeele, V. (2019). Juicy game design: Understanding the impact of visual embellishments on player experience. *Proceedings of CHI PLAY '19*, 185–197. ACM. https://doi.org/10.1145/3311350.3347171
- [R9] Claypool, M., & Claypool, K. T. (2006). Latency and player actions in online games. *Communications of the ACM*, 49(11), 40–45. https://doi.org/10.1145/1167838.1167860
- [R10] Liu, S., Xu, X., & Claypool, M. (2022). A survey and taxonomy of latency compensation techniques for network computer games. *ACM Computing Surveys*, 54(11s), Article 243. https://doi.org/10.1145/3519023
- [R11] Vicencio-Moreira, R., Mandryk, R. L., Gutwin, C., & Bateman, S. (2014). The effectiveness (or lack thereof) of aim-assist techniques in first-person shooter games. *Proceedings of CHI 2014*, 937–946. ACM. https://doi.org/10.1145/2556288.2557308
- [R12] Liu, S., Kuwahara, A., Scovell, J., & Claypool, M. (2023). The effects of frame rate variation on game player quality of experience. *Proceedings of CHI 2023*. ACM. https://doi.org/10.1145/3544548.3580665
- [R13] Darken, R. P., & Sibert, J. L. (1996). Wayfinding strategies and behaviors in large virtual worlds. *Proceedings of CHI '96*, 142–149. ACM. https://doi.org/10.1145/238386.238459
- [R14] Stoffregen, T. A., Faugloire, E., Yoshida, K., Flanagan, M. B., & Merhi, O. (2008). Motion sickness and postural sway in console video games. *Human Factors*, 50(2), 322–331. https://doi.org/10.1518/001872008X250755
- [R15] So, R. H. Y., Lo, W. T., & Ho, A. T. K. (2001). Effects of navigation speed on motion sickness caused by an immersive virtual environment. *Human Factors*, 43(3), 452–461. https://doi.org/10.1518/001872001775898223
- [R16] Bernier, Y. (2001). Latency compensating methods in client/server in-game protocol design and optimization. Valve (industry paper). https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization
- [R26] van der Linden, R., Lopes, R., & Bidarra, R. (2014). Procedural generation of dungeons. *IEEE Transactions on Computational Intelligence and AI in Games*, 6(1), 78–89. https://doi.org/10.1109/TCIAIG.2013.2290371

**Official documentation**

- [R17] Godot Engine — download page (latest stable 4.7.2; 4.8 beta 2 on Oct 29, 2026): https://godotengine.org/
- [R18] Godot docs — Exporting for the Web (C# not supported on web in Godot 4; Compatibility renderer only; single-threaded export since 4.3; only HTTP, WebSocket and WebRTC networking): https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- [R19] OpenAI — Codex best practices (AGENTS.md, Goal/Context/Constraints/Done when, plan first, one thread per task, worktrees): https://developers.openai.com/codex/learn/best-practices
- [R20] Godot docs — Overview of renderers (feature table): https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html
- [R21] Godot docs — High-level multiplayer (`@rpc` modes, transfer modes, "Secure multiplayer design"): https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html
- [R22] CC0 licenses: Poly Haven https://polyhaven.com/license · ambientCG https://docs.ambientcg.com/license/ · Kenney https://kenney.nl/support
- [R23] Godot docs — Exporting for dedicated servers (`--headless`, "Strip Visuals", `dedicated_server` feature tag): https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html
- [R24] Godot docs — Static typing in GDScript (`UNTYPED_DECLARATION` warning) and GDScript style guide: https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html · https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html
- [R25] Godot docs — Command line tutorial (`--headless`, `--import`, `--check-only`, `--export-release`, `--write-movie`): https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html