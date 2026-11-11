# Foldiers characters (CHARS agent)

Four simple origami soldiers (ref3 runners / ref1 doorway soldier / ref3 window soldier). The earlier creature designs
(crane, frog, fox, kabuto) are parked as later skins in `render/paper/chars/later_skins/`.

## Status: what is final vs placeholder
| Item | Status |
|---|---|
| 4 models (`trooper`, `scout`, `marksman`, `heavy`), skeleton, attach points | **usable now** (v1 shapes; may get more folds) |
| Atlases blue / red / teammask | **placeholder look**: baked AO + crease + fibre. Switch to `modules/papermat.js` / render/paper/MATERIALS.md when it lands |
| Game clips (19 Sector Nine clips, verbatim) | final (unchanged, already tuned in game) |
| New `P_*` clips (rifle aim/idle, fire x4, reload, throws, catches, steer, flinch, strafes, backpedal) | **usable v1** (procedural keys, not hand-polished) |
| Death break-up pieces | piece ids are in the meshes now (`_piece` vertex attribute); baked piece-motion files: coming next |
| LOD1 / LOD2 | not needed yet: LOD0 is already 540-616 tris (under the 1k LOD2 budget) |

## Files
- `trooper.glb`, `scout.glb`, `marksman.glb`, `heavy.glb`: skinned mesh + skeleton + attach empties. No animations inside.
  1 mesh, 1 material (`paper_<id>`), the blue atlas embedded.
- `<id>_blue.png`, `<id>_red.png` (1024x1024, sRGB): same UVs. **Team swap = set `material.map` to the other PNG.**
  `<id>_teammask.png`: white where the paper is team-coloured (for a tint shader instead of two PNGs).
- `paper_anims.json` / `paper_anims.js` (`window.PAPER.anims`): every clip in the SAME format as Sector Nine's
  `assets/models/anims.json` (`{fps:30, clips:{name:{d,f,tr:{'mixamorigHips.quaternion':[...]}}}}`) + per clip
  `loop`, `mask` (`upper` / `lower` / `full`), `events` (seconds), `note`. `buildClips()` reads it as is.
- Data: `data/paper/chars.json` (ids, names, personality, hitboxes, colours, tris, heights).
- Sources: `render/paper/chars/` (`characters.py` shapes, `build_chars.py` bake + export, `anims.py` clips,
  `convert_anims.js`, `previews.py`, `lookdev.py`). Rebuild: `sh run.sh build_chars.py full all`, `sh run.sh anims.py`, `node convert_anims.js`.

## Conventions
- Units metres, +Y up. Like the old soldier, the model faces **-Z** (buildBot's `model.rotation.y = Math.PI` makes it face +Z).
- Root node `Character` (scale 0.01, same as `soldier.gltf.json`), bones `mixamorig:*` (three.js names `mixamorigHips` ...),
  49 skinned joints, identical rest pose to the Sector Nine soldier: **drop-in for `ASSET.soldier`** in `buildBot`
  (`bone('Hips')`, `bone('RightHand')`, hitboxes, `animateBot` all work unchanged).
- Material: the old code looks for a material named `/Visor/` for an emissive accent; there is none here (paper has no glow).
  `r.body` = the single paper material.
- Every vertex has `_piece` (float id; three.js attribute `_piece`): the rigid fold-panel it belongs to (32-37 per character),
  each panel bound 100 % to one bone. For break-up deaths, split by `_piece`.
- Budgets: 540 / 588 / 582 / 616 triangles (rule: <= 8k), 1 material, 1 atlas, 49 bones (<= 60).

## Attach points (empties parented to bones, exported as glTF nodes)
| name | bone | where |
|---|---|---|
| `head` | Head | centre of the head (hitbox centre) |
| `hand_r` | RightHand | centre of the right fist (gun grip) |
| `hand_l` | LeftHand | centre of the left fist |
| `weapon` | RightHand | = hand_r; the gun's `grip_r` goes here, gun forward = the character's forward |

## Hitboxes (fair: identical for all 4)
Same bone-attached shapes as the game (`hitGeometry()`): head sphere r 0.15 (Head +0.10), chest box 0.46x0.46x0.32 (Spine1 +0.10),
pelvis box 0.38x0.26x0.28, thigh capsule r 0.095, shin r 0.08, arm r 0.07. Visual differences (cosmetic, shots there miss):
scout hat tip 1.98 m and brim 0.28 m forward (head sphere top 1.82 m); marksman hood peak +7 cm; heavy pauldrons reach
x 0.35 m (arm capsules cover most); heavy body is ~7 % wider than the trooper visually. Heights: trooper 1.82, scout 1.98 (hat),
marksman 1.89 (hood), heavy 1.82 m.

## Clips (30 fps). Game clips (unchanged)
`Idle_Loop`, `Pistol_Idle_Loop`, `Pistol_Aim_Neutral/Up/Down`, `Pistol_Shoot`, `Pistol_Reload`, `Walk_Loop`, `Jog_Fwd_Loop` (run),
`Sprint_Loop`, `Crouch_Idle_Loop`, `Crouch_Fwd_Loop`, `Jump_Start`, `Jump_Loop` (fall), `Jump_Land`, `Hit_Chest`, `Hit_Head`, `Death01`, `Roll`.

New paper clips (`mask` tells which half to use; upper clips assume the gun rides `hand_r` like now):
| clip | s | loop | mask | events | note |
|---|---|---|---|---|---|
| `P_Rifle_Aim` | 0.50 | yes | upper | - | two-handed rifle aim; support hand on the handguard |
| `P_Rifle_Idle_Loop` | 2.00 | yes | upper | - | relaxed low-ready, breathing |
| `P_Fire_Rifle` | 0.20 | no | upper | shot 0 | kick + settle |
| `P_Fire_SMG` | 0.10 | yes | upper | shot 0 | loop at fire rate |
| `P_Fire_Shotgun` | 0.85 | no | upper | shot 0, pump_back 0.38, pump_fwd 0.60 | blast + pump |
| `P_Fire_Sniper` | 1.20 | no | upper | shot 0, bolt_back 0.55, bolt_fwd 0.78 | shot + bolt |
| `P_Reload_Rifle` | 2.00 | no | upper | mag_out 0.55, mag_in 1.48 | magazine swap |
| `P_Throw_Boomerang` | 0.80 | no | upper | release 0.47 | overhand throw |
| `P_Catch_Boomerang` | 0.45 | no | upper | catch 0.20 | right-hand snatch |
| `P_Throw_Plane` | 0.90 | no | upper | release 0.43 | dart-style throw from a pinch |
| `P_Plane_Steer_Loop` | 1.60 | yes | upper | - | left hand guides the plane |
| `P_Catch_Plane` | 0.60 | no | upper | catch 0.30 | two-handed snatch |
| `P_Hit_Flinch` | 0.35 | no | upper | - | crumple jolt |
| `P_Run_Back_Loop` | 0.73 | yes | lower | - | backpedal (reversed jog, same speed scale as `Jog_Fwd_Loop`) |
| `P_Crouch_Back_Loop` | 1.60 | yes | lower | - | crouch walk backwards |
| `P_Strafe_L_Loop` / `P_Strafe_R_Loop` | 0.60 | yes | lower | - | side-steps, ~2.2 m/s at timeScale 1 |

Previews: `docs/previews/chars_lineup.png` (4 x 5 views, blue + red), `docs/previews/lookdev_soldier_vs_ref3.png`.
