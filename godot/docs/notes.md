# Notes

- Active work: godot/ on giabim/overclocked-hazmat-interns, branch godot-long-term. Original GUIDE.md separate-repo advice is superseded by owner direction.
- 2026-11-07: Imported Claude bundle through c89bb4a and pushed it. M3/M4 simulation, tools, views, bot levels and lobby are implemented.
- Handoff polish complete: bounded native-audio drain (36 clean smoke processes), per-bot lobby editor, own-location team pings and correct actor-specific camera/caught feedback.
- Full M4.4 league completed: 50 shifts per level, median scores 87 < 102 < 113, no flagged goal stalls. See docs/reports/bot-league-2026-11-07.md. Normal quota unchanged.
- Current checks: 64 tests + 3 scene smokes. Staged 7-bot editor with eight pings renders at 115 draw calls (limit 120).
- Human checks remain pending: M1.4 movement/cues, M2.5 new-player playtest, M3 Windows feel/audio review and Playtest #2 with bots. No observations have been invented.
- Quota formula is an owner decision. Next implementation step: M5 Online, plan first. CI workflow is ../.github/workflows/godot-ci.yml.
- Startup now opens shift setup before gameplay, including after Orientation. Human Windows/bot review instructions are in docs/playtests/02.md.
