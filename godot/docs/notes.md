# Notes

- Owner chose godot/ in giabim/overclocked-hazmat-interns on godot-long-term; this supersedes the separate-repository instructions in preserved GUIDE.md.
- M0, M1.1-M1.3 and M1.5-M1.7 are complete. Owner approved silhouette; movement/cue review still needs details. Owner explicitly requested continued implementation; proceed with M2 while leaving manual checks pending. See docs/review/M1.md.
- Do not mark deferred manual checks approved without specific owner feedback. Silhouette gate is approved.
- Latest automated check: 21/21 tests plus running-scene pickup/delivery/extraction/results/restart smoke, without warnings. Original placeholder meshes and sounds require no external assets.
- CI workflow is ../.github/workflows/godot-ci.yml; gameplay changes stay inside godot/.
