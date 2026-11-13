# Paper guns: files for the LEAD (GUNS agent, tracker item 8)

Built by `render/paper/guns/build.py` (Blender 5.2, fully scripted). Rebuild: see "Rebuild" at the bottom.
**Units metres. glTF axes: +Y up, the muzzle points to -Z (same as a three.js camera looks), +X right.** Every model's root node is `gun_<id>`;
its origin is the right-hand grip (`grip_r`), so you place the root in camera space at `art.hip` from `data/paper/guns.json` with no rotation.

## Files
| id | file (blue) | red team | tris | clips |
|---|---|---|---|---|
| rifle | `rifle.glb` (463 KB) | `rifle_red.glb` | 2634 | equip, idle, fire, ads, ads_idle, inspect, reload |
| shotgun | `shotgun.glb` (514 KB) | `shotgun_red.glb` | 3040 | equip, idle, fire, ads, ads_idle, inspect, reload_start, reload_shell, reload_end |
| sniper | `sniper.glb` (495 KB) | `sniper_red.glb` | 2858 | equip, idle, fire, ads, ads_idle, inspect, reload, bolt |
| smg | `smg.glb` (336 KB) | `smg_red.glb` | 1504 | equip, idle, fire, ads, ads_idle, inspect, reload |
| boomerang | `boomerang.glb` (184 KB) | `boomerang_red.glb` | 404 | equip, idle, windup, throw, catch, inspect, punch |
| plane | `plane.glb` (185 KB) | `plane_red.glb` | 416 | equip, idle, aim, aim_idle, throw |
| plane_flight | `plane_flight.glb` (176 KB) | `plane_flight_red.glb` | 416 | none |
| plane_damaged | `plane_damaged.glb` (177 KB) | `plane_damaged_red.glb` | 428 | none |

- `textures/atlas_blue.png` / `atlas_red.png`: the shared 1024 albedo atlas (the only difference between teams; regions in `regions.json`).
  `atlas_orm.png` (G = roughness, B = metal) and `atlas_n.png` (OpenGL normal map: paper fibre + crinkle + corrugation).
  Each GLB embeds its own copy (JPEG). To swap team at runtime instead of loading `_red`: `mat.map = redAtlas` (load with `flipY = false`, sRGB).
- One material per model. Crease/ambient occlusion is **baked into vertex colours (COLOR_0)**; GLTFLoader turns on `vertexColors` itself; keep it on or the folds lose their shading.
- `fx/`: `muzzle_puff_4x4.png` (16 frames, 128 px, ~40 fps, additive or alpha both fine), `impact_chips_4x2.png` (8 chip sprites, 64 px), `impact_puff_8f.png` (8 frames, 128 px),
  `confetti_4x4.png` (16 confetti sprites 64 px: rows squares / triangles / curled strips / dots, blue-red-white), `tracer_paper_streak.png` (256x32, head on the right). Straight alpha PNG.
- `icons/<id>_hud.png` (256x96) and `<id>_kill.png` (128x48): flat white silhouettes, muzzle to the right, transparent, like the references' HUD ammo icon.

## Node tree (every gun)
`gun_<id>` (static, place at hip) -> `vm` (all viewmodel motion: sway, kick, equip, inspect, ADS) -> meshes + attach empties.
Moving parts are their own nodes: rifle/smg/sniper `mag`, shotgun `pump` + loose `shell` (scale 0 at rest), sniper `bolt` (+ `bolt_knob` empty), boomerang `blade`, plane `plane` -> `wing_l`, `wing_r`.

## Attach points (agreed with CHARS: hands follow these every frame)
- `grip_r`: centre of the right palm on the pistol grip. Its local -Z = forward along the gun, +Y = up the grip (pinky to index). The root origin.
- `grip_l`: centre of the left palm under the fore-end / pump, palm up (+Y up, -Z forward). **Animated**: during reloads it travels to the mag / shell, so the left hand just follows it.
  On the sniper the `bolt` clip also moves `grip_r` to the bolt knob and back.
- `muzzle`: bore exit (flash, tracer and projectile spawn; boomerang = blade spin centre, plane = nose).
- `mag`: rifle/smg/sniper = the magazine node itself (origin at the mag well); shotgun = loading port empty.
- `sight`: ADS eye point (rifle/smg: centre of the square paper sight window; shotgun: rear notch; sniper: rear lens). The camera looks along -Z through it.
- `eject`: right-side ejection flap (paper casing / puff spawn).

Rest positions (glTF, metres, relative to the root):
- **rifle**: `mag` (0.000, 0.040, -0.159) parent `vm`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `grip_l` (0.000, 0.050, -0.384) parent `vm`; `muzzle` (0.000, 0.094, -0.724) parent `vm`; `sight` (0.000, 0.175, -0.085) parent `vm`; `eject` (0.040, 0.100, -0.144) parent `vm`; `mag_well` (0.000, 0.040, -0.159) parent `vm`
- **shotgun**: `pump` (0.000, 0.085, -0.471) parent `vm`; `shell` (0.000, -0.001, -0.171) parent `vm`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `grip_l` (0.000, 0.057, -0.471) parent `vm`; `muzzle` (0.000, 0.123, -0.823) parent `vm`; `sight` (0.000, 0.158, 0.004) parent `vm`; `eject` (0.047, 0.101, -0.156) parent `vm`; `mag` (0.000, 0.031, -0.171) parent `vm`
- **sniper**: `mag` (0.000, 0.046, -0.126) parent `vm`; `bolt` (0.000, 0.096, -0.036) parent `vm`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `grip_l` (0.000, 0.045, -0.446) parent `vm`; `muzzle` (0.000, 0.089, -1.101) parent `vm`; `sight` (0.000, 0.156, 0.062) parent `vm`; `eject` (0.032, 0.109, -0.066) parent `vm`; `bolt_knob` (0.064, 0.084, -0.027) parent `bolt`
- **smg**: `mag` (0.000, 0.017, -0.148) parent `vm`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `grip_l` (0.000, 0.040, -0.243) parent `vm`; `muzzle` (0.000, 0.091, -0.404) parent `vm`; `sight` (0.000, 0.134, 0.001) parent `vm`; `eject` (0.039, 0.080, -0.108) parent `vm`
- **boomerang**: `blade` (0.142, 0.094, -0.005) parent `vm`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `grip_l` (0.220, -0.080, 0.055) parent `vm`; `muzzle` (0.142, 0.094, -0.005) parent `blade`; `sight` (0.170, 0.200, -0.015) parent `vm`
- **plane**: `plane` (0.000, 0.008, -0.015) parent `vm`; `wing_l` (0.000, 0.030, -0.035) parent `plane`; `wing_r` (0.000, 0.030, -0.035) parent `plane`; `grip_r` (0.000, 0.000, 0.000) parent `vm`; `muzzle` (0.000, 0.030, -0.175) parent `plane`; `sight` (0.000, 0.050, -0.015) parent `vm`; `grip_l` (-0.060, -0.030, 0.085) parent `vm`

## Clips (seconds; every clip keys every animated node of that gun)
- **rifle**: `equip` 0.5s, `idle` 2s, `fire` 0.1s, `ads` 0.2s, `ads_idle` 2s, `inspect` 2.6s, `reload` 1.867s
- **shotgun**: `equip` 0.5s, `idle` 2s, `fire` 0.733s, `ads` 0.2s, `ads_idle` 2s, `inspect` 2.6s, `reload_start` 0.333s, `reload_shell` 0.5s, `reload_end` 0.467s
- **sniper**: `equip` 0.5s, `idle` 2s, `fire` 0.4s, `ads` 0.2s, `ads_idle` 2s, `inspect` 2.6s, `reload` 2s, `bolt` 0.733s
- **smg**: `equip` 0.5s, `idle` 2s, `fire` 0.067s, `ads` 0.2s, `ads_idle` 2s, `inspect` 2.6s, `reload` 1.5s
- **boomerang**: `equip` 0.467s, `idle` 2s, `windup` 0.3s, `throw` 0.333s, `catch` 0.333s, `inspect` 2.2s, `punch` 0.333s
- **plane**: `equip` 0.667s, `idle` 2s, `aim` 0.333s, `aim_idle` 1.5s, `throw` 0.467s

Meaning: `equip` raise from below. `idle` 2 s breathing loop. `fire` one shot of kick (shotgun includes the pump stroke). `ads` hip -> sights (ends with the sight on the camera axis
at `art.eye` when the root is at `art.hip`), `ads_idle` loop while aimed. `reload` paper mag out and a new one in (rifle/smg/sniper). Shotgun: `reload_start`, then `reload_shell` once per shell, then `reload_end`.
Sniper `bolt` after each shot. `inspect` show-off turn. Boomerang: `windup` (hold; the game spins `blade` itself about its local +Y), `throw` (blade hides at 0.10 s: spawn the flying one then),
`catch` (blade reappears spinning), `punch` (melee). Plane: `equip` = the wings fold out from closed, `aim` / `aim_idle` hold to aim, `throw` (plane leaves the hand and hides at 0.13 s: spawn the flying plane then).
Use `plane_flight.glb` for the flying plane (wings at a slight dihedral, origin near its centre) and `plane_damaged.glb` after it is hit / caught.

**Mixer note:** the exporter drops channels that never change, so before playing a clip reset the animated nodes to their rest transform (or always crossfade from idle). Clips are 30 fps sampled.

## Budgets
Guns 2.6k-3.0k triangles each (boomerang 0.4k), plane 0.42k; 1 material + the shared atlas each; 2-3 draw calls per gun (body + moving parts).

## Rebuild
```
cd render/paper/guns
python atlas.py out && python fx.py out/fx
blender -b -P build.py -- [id ...]         # GLBs + meta.json  (run at low priority)
blender -b -P render.py -- fp:<id> lineup:<id> icon:<id>   # previews / icon renders
python compose.py lineup && python compose.py icons
node pack.js                                # copy here + verify + guns.json + this README
```
Previews: `docs/previews/gun_<id>_fp.png`, `guns_lineup.png`, `gun_plane_variants.png`, `guns_fx.png`, `guns_icons.png`, `lookdev_*_vs_ref*.png`.
The hands in the previews are placeholders made by the gun script (CHARS owns the real ones).
