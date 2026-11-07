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
