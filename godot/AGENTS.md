# AGENTS.md — Overclocked (Godot 4.7.2)

Co-op first-person game: interns in hazmat suits keep an overheating underground lab alive. They deliver coolant canisters and freeze escaped specimens with foam. 1–8 players (humans or bots). Online play is server-authoritative.

## Scope
- Work only in godot/ in giabim/overclocked-hazmat-interns (branch: godot-long-term). Run commands from godot/.
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
