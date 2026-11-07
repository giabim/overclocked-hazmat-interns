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
