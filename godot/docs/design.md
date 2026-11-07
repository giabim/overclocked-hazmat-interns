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
