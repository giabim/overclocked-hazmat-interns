# Full bot league — 2026-11-07

**Result: passed.** The full M4.4 simulation completed 50 shifts for each level.

| Level | Shifts | Median team score |
| --- | --- | --- |
| Lv1 Trainee | 50 | 87 |
| Lv2 Technician | 50 | 102 |
| Lv3 Supervisor | 50 | 113 |

Conditions: Godot 4.7.2 on Windows; Lab A; four AI participants of the same level; seeds 0–49; up to 240 simulated seconds per shift. The test uses quota override 999 to observe full shifts. The normal quota formula remains unchanged.

The test checks strict median ranking and rejects bots stationary for more than five seconds while farther than 1.5 m from their goal. No such stalls were flagged.

Run basis: the imported M4 simulation from `c89bb4a`, with diagnostic progress output. Subsequent team-ping metadata and UI changes have separate unit/scene coverage and do not alter movement, combat, scoring or random decisions. Human playtests and the owner's quota decision remain pending.

Reproduce from `godot/` in Git Bash:

```bash
BOT_LEAGUE=1 ./.tools/godot --headless --path . --script res://tools/run_bot_league.gd
```

The normal check runs a shorter league; this command runs the full 150-shift acceptance check and prints progress every ten shifts.
