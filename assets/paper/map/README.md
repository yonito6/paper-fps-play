# Desk Town: map assets (MAP agent)

A cardboard and paper toy town on a giant desk: 3-lane team deathmatch, mirrored across x = 0 (blue = -x, red = +x), built
around the three reference places (ref1 awning shop + ruler bridge, ref2 street under the bridge, ref3 window house street).
Everything is scripted, so it rebuilds any time and re-imports in Unity:
`python render/paper/map/make_textures.py` -> `blender -b -P render/paper/map/build_map.py` -> `blender -b -P render/paper/map/bake_map.py -- 4096 128`
(bakes AO + lightmaps, exports `render/paper/map/src/desktown_src.glb`) -> `python render/paper/map/pack_glb.py` (gltfpack, native build for KTX2).
Heavy steps only through `bash tools/heavy.sh <exe> ... -t 4` (one heavy job across all agents).

## Units and axes
Metres, +Y up (glTF), player 1.8 m (eye 1.65, radius 0.4). Game x = Blender x, game y = Blender z, game z = -Blender y.
Blue spawns at x = -42, red at x = +42; the high lane / clock tower / courtyard side of the map is game -z.

## Files
| File | What | Needs |
|---|---|---|
| `desktown.glb` (17.6 MB) | the map today: 16-bit positions (KHR_mesh_quantization), float UVs, JPG/PNG textures | nothing (r147 GLTFLoader as is) |
| `desktown_webp.glb` (6.3 MB) | + meshopt compression + WebP textures (High) | `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` (classic script: `three@0.147.0/examples/js/libs/meshopt_decoder.js`) |
| `desktown_perf.glb` (2.9 MB) | same with half-size textures (Performance tier) | MeshoptDecoder |
| `desktown_ktx2.glb` (5.8 MB) | + KTX2/BasisU GPU-compressed textures (smallest GPU memory) | MeshoptDecoder + `KTX2Loader` (r147 has it only as ES module `examples/jsm/loaders/KTX2Loader.js` + `examples/js/libs/basis/`) |
| `ao.png` (2048) | baked ambient occlusion on TEXCOORD_1; already wired in every GLB as glTF `occlusionTexture` (texCoord 1) -> three `aoMap` (uv2), no shader work needed | - |
| `lm.png` / `lm_full.png` (+ `_2k`) | LOOK-pipeline lightmaps (sqrt-encoded, scale in `render/paper/map/bake_meta.json`): sky + lamps + sun bounce / + sun direct | optional shader hook |
| `tex/` | my generated mat + print atlas (`atlas_diff.png`: banners, clock, ruler, notes, wear decals composited on the library kraft/paper) | - |
| `../../../data/paper/map_desktown.json` | colliders (with wallbang class), spawns, 36 tearable panels, firing / plane windows, nav lanes + camps, static lamps, sun / sky / fog | - |

Materials: `pm_kraft`, `pm_paper`, `pm_edge` use the shared REAL cardboard library (`assets/paper/materials/2k`, render/paper/MATERIALS.md):
kraft tile 1.35 m, paper 1.0 m, cut edges on the flute trim with u = length / (8 x board thickness). ORM -> glTF metallicRoughness.
Static map = 10 meshes (play + far per material) = 10 draw calls; tearable panels `T_<id>` are separate nodes (the game hides them and
builds its own TEAR panels from the JSON list; glTF extras are dropped by gltfpack, the JSON is the source).

## Budgets (measured 2026-11-11)
- Triangles ~103k (gameplay ~52k + background ~51k); draw calls 10 static (+ the game's own tear panels).
- GPU texture memory: `desktown.glb` / `_webp` 143 MB (RGBA8 + mips: kraft 2k col/nrm, mat 2k, atlas 2k, AO 2k, the rest 1k);
  `_perf` ~36 MB; `_ktx2` ~35-45 MB (BC7/BC1 on desktop).
- FPS (headless Chrome, RTX 2070, 1672x941, menu state, other agents' jobs running; noisy): 12 walk spots min 36 / median 40 fps,
  ref2 62, ref3 50. The LEAD's perf gate is the reference number.

## Wallbangs (data `colliders[i][8]` = pen class, `[9]` = thickness m)
- `thin`: every gun + knife, see-through holes: all 36 tearable panels (gallery window sills, shop fronts / side panels, window-house walls,
  terrace parapets, alley fences, cross-passage fence) + 6 dedicated WALLBANG screens (street sign board, alley corner screen,
  courtyard screen, per side) + crates, kiosks, awnings, rails.
- `medium`: strong guns only: gallery walls, window-house walls, box walls, parapets, pencil cup, tape rolls, ruler deck, truss posts, gate pillars.
- `thick`: building blocks, floors, stairs, landings. Mirrored: blue and red have the same counts (see `docs/previews/map_layout_top.png`).

## Z-fighting (flicker) - checker `python render/paper/map/check_coplanar.py <glb>`
Fixed in the source (no polygonOffset): hidden-face cull pass (faces covered by opposite faces deleted), same-plane overlaps cut out of
the earlier face (convex difference), wear decals carved INTO the card panels, prints >= 4.5 cm off walls (banners 10 cm), floor numbers
carved into the mat, no thin floor slabs on blocks, no dents, cloud blobs rotated. 30 411 overlapping pairs (4 414 m2) -> see the report
for the current count.

## Known render issues (for the LEAD: shader / renderer side)
1. Depth precision: camera near 0.05 / far 700 gives ~12 mm depth steps at 100 m and ~27 mm at 150 m. Map geometry is built for it, but
   runtime decals (shot marks) need a depth offset that grows with distance (or near 0.1 / logarithmicDepthBuffer off-cost check).
2. Shadow acne: three r147 renders BACK faces into the shadow map for single-sided materials; thin sheets (banners, awnings, bunting,
   shutters) are two-sided as front + reversed copies. Keep `normalBias` ~0.04 and `bias` -0.0003 (current), or set `shadowSide = FrontSide`
   on the map materials.
3. Tone: the in-game grade pushes kraft orange and the mat cooler than the references; with ACES (exposure ~1.15) the ref look is
   warmer + lighter kraft and creamy highlights. AO map intensity 1.0 is tuned for the hemisphere fill (0.38).
4. KTX2 loading needs an ES-module KTX2Loader (r147); the WebP + meshopt GLBs work with classic scripts.
