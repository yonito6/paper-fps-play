# Foldiers first-person hands (CHARS agent)

Blocky origami hand (owner sheet HAND OPEN / AIRPLANE-GRIP: square wrist block, wedge palm, three chunky 2-segment fingers, 2-segment thumb) + faceted forearm, beige carton edges, built on **Sector Nine's glove rig**:
same bone names, same rest pose, same pose format, so `modules/hands.js` works with it unchanged (swap the file it loads).

## Status
| Item | Status |
|---|---|
| Rig, mesh, atlases, masks, poses, grip sockets | **usable now** |
| Look | v1: chunky faceted fingers + forearm prism; atlas = baked AO + crease + fibre (switch to `modules/papermat.js` when ready) |
| Grip sockets | rifle grip + support verified in Blender against the real `rifle.glb` (`docs/previews/hands_ref1.png`); others: same rule, tune in game if a finger clips |

## Files
- `paper_hand.gltf.json`: single-file glTF (data URI) = drop-in for `assets/models/hands/glove.gltf.json` in `modules/hands.js`.
  `paper_hand.glb`: the same as GLB.
- `paper_hand_blue.png` / `paper_hand_red.png` (1024, sRGB, same UVs): team swap = swap `map`.
- `paper_hand_mask.png`: R = team-colour mask, G = thin paper (1 = single sheet: translucency / thickness), B = baked AO, A = crease-edge lines.
- `paper_hands_poses.json`: `poses` (17), `families` (Sector Nine viewmodel placements), `weapons`, **`grip_sockets`**, **`hand_clips`**.
- Source: `render/paper/chars/hands.py` (build + previews), `render/paper/chars/hand_poses.py` (poses json).

## Rig + conventions
- Bones: `forearm`, `hand`, `index_01..03`, `middle_01..03`, `ring_01..03`, `pinky_01..03`, `thumb_01..03` (17). Right hand; left = X-mirror (hands.js mirrors).
- Palm space (three.js): wrist at the origin, fingers toward **-Z**, back of the hand **+Y**, palm faces -Y, thumb toward -X. Metres.
- Materials (all use the same atlas): `hand_glove` (hand + fingers), `hand_sleeve` (forearm), `hand_cuff` (white cuff + wrap) -
  the zone names `modules/hands.js` already sorts by (no white parts in v2, so `hand_cuff` is empty). 180 triangles (budget 4k), flat per-fold normals (no smoothing).
- Pose format = Sector Nine: Euler XYZ degrees per bone, in the bone's own frame, on top of rest (negative x curls toward the palm).

## Poses
`flat`, `open`, `fist`, `rifle_trigger`, `pistol_trigger`, `rifle_support`, `pistol_support`, `vgrip`, `pump` (Sector Nine, kept),
new: `boomerang_hold`, `boomerang_release`, `plane_pinch` (thumb + index pinch like ref3), `plane_release`, `plane_steer`,
`catch_open`, `catch_closed`, `sniper_bolt`.

## Grip contract with the GUNS agent (`grip_r`, `grip_l`)
Guns own the empties (`grip_r` = right palm centre on the pistol grip, -Z forward along the gun, +Y up the grip; `grip_l` = left palm under the
fore-end, animated during reloads). Hands own `grip_sockets[pose]` = `{pos, axes}` in palm space: `pos` is where the gun empty sits inside the posed
hand, `axes` are the gun empty's X/Y/Z axes written in palm coordinates. Every frame: **`hand.matrixWorld = grip.matrixWorld * inverse(socket)`**
(left hand: the socket is in the mirrored left palm space; multiply by `scale(-1,1,1)` after the inverse).

## FP clips (`hand_clips`)
The hands ride the gun's animated `grip_r` / `grip_l`, so equip / unequip (gun `equip`, reversed), reload, pump, bolt, windup, throw and catch
**motion** comes from the gun clips. `hand_clips[gun][clip]` = `[t, rightPose, leftPose]` switches (blend ~0.06 s; `*` = every other clip;
`null` = hand hidden). Covered: rifle / smg / sniper (bolt, reload), shotgun (pump, shells), boomerang (hold, throw release at 0.10 s, catch),
plane (pinch hold, throw release at 0.13 s, `steer` = flat guiding hand, `catch` two-hand snatch then pinch).

Previews: `docs/previews/hands_vs_turnaround.png` (owner sheet vs ours), `docs/previews/hands_ref1.png` (real paper rifle, hands placed only by the socket contract), `docs/previews/hands_ref3.png` (plane pinch).
