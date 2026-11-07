# Changelog

- 2026-11-06 — M0.1: Created the separate Godot repository, preserved the source guide, and split project instructions into focused documents.
- 2026-11-06: Prepared completed M0.1 docs for the existing GitHub repository in godot/ on godot-long-term, per owner direction.
- 2026-11-06 — M0.2: Added Windows/Linux Godot 4.7.2 setup and strict import/parse/test checks; installer prints 4.7.2.stable.official.ed1daf0bf.
- 2026-11-06 — M0.3: Added Compatibility project, 30 Hz settings, input map, and main camera/title scene; Godot import exits 0 without errors.
- 2026-11-06 — M0.4: Added typed test discovery and project/input smoke coverage; tools/check.sh passes with 1/1 tests passed.
- 2026-11-06 — M0.5: Linux GitHub CI is green (run 42332724802); Web and Linux Server release exports and all local checks pass.
- 2026-11-06 — M1.1: Added Lab A and pure typed MapGrid; verified 24x15 size, all 213 reachable cells, spawn counts, invalid maps, and outside walls (5/5 total tests).
- 2026-11-06 — M1.2: Added shared substepped circle movement and tuning; 10,000 seeded moves, sliding, 10 m wall crossing, corners, and zero motion pass (9/9 total tests).
- 2026-11-06 — M1.3: Batched lab walls, floor, door frames, airlock and wing markings; actual Compatibility render measures 18 draw calls (limit 40), screenshot reviewed; 10/10 tests pass.
- 2026-11-06 — M1.4 implementation: Added first-person frame-rate mouse look, horizontal FOV, 30 Hz shared input/state movement and view interpolation; 12/12 tests pass. Human smoothness/map walkthrough remains pending.
- 2026-11-06 — M1.5: Added pure authoritative canister/delivery/Heat/quota/extraction/results rules and batched canister views; timing, scoring, respawns, inventory and terminal states pass (20/20 tests).
- 2026-11-06 — M1.6: Added Heat/carry/quota HUD, color-and-code minimap, contextual cues, results/restart/menu, synthesized pickup/delivery/alarms, and heat lighting. Reviewed play/results renders (42/48 draw calls); 20 tests plus running-scene lifecycle smoke pass.
