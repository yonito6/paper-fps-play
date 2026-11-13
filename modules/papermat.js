/* modules/papermat.js: Foldiers REAL cardboard + paper material library for three.js r147 (classic script, no deps).
 * Registers window.PaperMat. Textures: assets/paper/materials/{2k|1k}/ (photo-scanned CC0 ambientCG sources, built by
 * render/paper/materials/build_textures.py; docs: render/paper/materials/MATERIALS.md). Everything is plain PBR
 * (albedo sRGB, normal OpenGL, ORM = AO / roughness / 0) so Unity gets the same files.
 *
 *   PaperMat.load({ tier: 'high' | 'balanced', renderer })   // call once at load; returns a Promise (textures decoded)
 *   const m = PaperMat.makeMaterial('kraft', { triplanar: true })   // kinds: kraft paper white blue red flute ruler wear mat
 *   mesh = PaperMat.boardBox(w, h, d, { thick: 'z' })               // a cardboard sheet: faces on kraft, the 4 cut edges on flute
 *   geo  = PaperMat.decal('torn0', 0.6, 0.6)                        // a wear decal quad (use with makeMaterial('wear'))
 *
 * Options for makeMaterial(kind, o): tile (m per repeat; default from the library), triplanar (world-space projection, for
 * geometry without proper UVs), lightMap (+ lmSqrt: texel^2 decode like the map bake, lmScale), vertexColors (COLOR_0 panel
 * tint), lmOnly (FULL BAKE: the lightmap is the only light, no real-time sun / hemisphere on this material), side, color (extra tint), normalScale, roughness (multiplier), sheen (0..0.3 fibre sheen at grazing angles), macro
 * (0..0.3 world-space brightness variation to break tiling), flat (0..1: mix the albedo toward the tile's mean colour; the photo kraft's
 * 0.5 m blotches read as camouflage at map scale, 0.4 keeps the fibre and calms the blotches), decal (transparent, no depth write, polygon offset).
 * One shader program per {uv|triplanar} x {lightmap|none} x {decal}: build every variant you use at load (warmShaders). */
(function () {
  if (typeof THREE === 'undefined') { console.warn('[PaperMat] THREE missing'); return; }
  const LIB = {
    // tile = metres per texture repeat. sheen/macro = defaults. rough = roughness multiplier when there is no ORM.
    kraft: { col: 'kraft_col.jpg', nrm: 'kraft_nrm.jpg', orm: 'kraft_orm.jpg', tile: 1.35, normalScale: 1.0, sheen: .10, macro: .12, mean: 0xac8556 },
    paper: { col: 'paper_col.jpg', nrm: 'paper_nrm.jpg', orm: 'paper_orm.jpg', tile: 1.0, normalScale: .8, sheen: .12, macro: .08, mean: 0xe8d3b8 },
    white: { col: 'white_col.jpg', nrm: 'paper_nrm.jpg', tile: .8, normalScale: .6, rough: .82, sheen: .14, macro: .04 },   // shares the paper normal (GPU budget)
    blue: { col: 'origami_blue_col.jpg', nrm: 'origami_nrm.jpg', tile: .6, normalScale: .9, rough: .8, sheen: .16, macro: .05 },   // (origami_orm.jpg exists; skipped for GPU budget)
    red: { col: 'origami_red_col.jpg', nrm: 'origami_nrm.jpg', tile: .6, normalScale: .9, rough: .8, sheen: .16, macro: .05 },
    // the cut edge: u = metres along the edge / (8 x thickness), v = 0..1 across the board thickness
    flute: { col: 'flute_col.jpg', nrm: 'flute_nrm.jpg', orm: 'flute_orm.jpg', tile: 1, strip: true, normalScale: 1.0, sheen: .04, macro: .10 },
    // ruler: u = 30 cm of scale per repeat (choose the repeat per ruler), v 0..0.5 marked face, 0.5..1 plain wood
    ruler: { col: 'ruler_col.jpg', nrm: 'ruler_nrm.jpg', tile: 1, strip: true, normalScale: .7, rough: .6, sheen: .06, macro: .06 },   // (ruler_orm.jpg exists; skipped for GPU budget)
    wear: { col: 'wear_col.png', nrm: 'wear_nrm.jpg', orm: 'wear_orm.jpg', tile: 1, strip: true, normalScale: 1.0, sheen: .08, macro: 0, decal: true },
    mat: { col: '../../map/tex/mat_diff.jpg', tile: 10, rough: .8, sheen: .02, macro: .06 },   // the MAP agent's cutting mat (optional)
    // MATERIALS V2 (wp-mats, docs/MATERIALS_V2.md): lazy = not preloaded by load(); fetched the first time makeMaterial asks for them
    felt_blue: { col: 'felt_blue_col.jpg', nrm: 'felt_blue_nrm.jpg', tile: 15, normalScale: 1.0, rough: .97, sheen: .22, macro: .06, lazy: true },
    felt_green: { col: 'felt_green_col.jpg', nrm: 'felt_green_nrm.jpg', tile: 10, normalScale: 1.0, rough: .97, sheen: .22, macro: .06, lazy: true },
    cutmat: { col: 'cutmat_col.jpg', nrm: 'cutmat_nrm.jpg', tile: 8, normalScale: .6, rough: .82, sheen: .02, macro: .04, lazy: true },
    case_fabric: { col: 'case_fabric_col.jpg', nrm: 'case_fabric_nrm.jpg', tile: 8, normalScale: .9, rough: .95, sheen: .16, macro: .05, lazy: true },
    zip_teeth: { col: 'zip_teeth_col.jpg', nrm: 'zip_teeth_nrm.jpg', orm: 'zip_teeth_orm.jpg', tile: 1, strip: true, normalScale: 1.0, sheen: .08, macro: .06, lazy: true },   // UV 0..1 per tooth face
    page_edge: { col: 'page_edge_col.jpg', nrm: 'page_edge_nrm.jpg', orm: 'page_edge_orm.jpg', tile: 3, normalScale: 1.0, sheen: .08, macro: .05, lazy: true },   // U along the edge, V across the stack
  };
  // flute strip: one U repeat = 8 flutes = 8 x the board thickness (pitch == thickness, like real C-flute at thumb scale)
  const FLUTES_PER_REPEAT = 8, RULER_REPEAT_CM = 30;
  const fluteRepeat = t => FLUTES_PER_REPEAT * t;
  const PM = { ready: false, tier: 'high', base: 'assets/paper/materials/', lib: LIB, cells: null, FLUTES_PER_REPEAT, fluteRepeat, RULER_REPEAT_CM, _tex: {}, _mats: {}, _loads: [] };
  const loader = new THREE.TextureLoader();
  // KTX2 (Basis Universal UASTC -> BC7 on desktop: 4x less VRAM than JPG uploads, no decode stall): used when THREE.KTX2Loader is
  // on the page (modules/papermat_ktx2.js, a classic-script bundle of three r147's loader) and load({ ktx2: true }) was asked;
  // the .ktx2 files sit next to the JPGs (render/paper/materials/encode_ktx2.py). Otherwise plain JPG/PNG.
  let ktx2 = null;
  function tex(file, srgb) {
    const key = file + (srgb ? ':s' : ':l'); if (PM._tex[key]) return PM._tex[key];
    const dir = PM.base + ({ balanced: '1k/', performance: '512/' }[PM.tier] || '2k/');
    let t;
    if (ktx2 && !/\//.test(file)) {   // (textures outside the library folder, e.g. the MAP's cutting mat, stay JPG)
      t = new THREE.CompressedTexture(); t.mipmaps = []; const f = file.replace(/\.(jpg|png)$/, '.ktx2');
      ktx2.load(dir + f, k => { Object.assign(t, { image: k.image, mipmaps: k.mipmaps, format: k.format, type: k.type, minFilter: k.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, encoding: srgb ? THREE.sRGBEncoding : THREE.LinearEncoding, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: PM.aniso || 16, flipY: false, generateMipmaps: false, needsUpdate: true }); k.dispose && 0; },
        undefined, () => { console.warn('[PaperMat] no ktx2 for', file, '- falling back to', file); loader.load(dir + file, j => { Object.assign(t, { isCompressedTexture: false, image: j.image, mipmaps: [], format: THREE.RGBAFormat, type: THREE.UnsignedByteType, flipY: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, needsUpdate: true }); }); });
    } else t = loader.load(dir + file, undefined, undefined, e => console.warn('[PaperMat] missing', file));
    PM._loads.push(t);
    t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = PM.aniso || 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; if (!ktx2) t.generateMipmaps = true;
    t.userData.file = file; return (PM._tex[key] = t);
  }
  PM.load = function (o = {}) {
    PM.tier = o.tier === 'balanced' ? 'balanced' : o.tier === 'performance' ? 'performance' : 'high';
    if (o.renderer) PM.aniso = Math.min(16, o.renderer.capabilities.getMaxAnisotropy());
    if (o.base) PM.base = o.base;
    if (o.ktx2 && THREE.KTX2Loader && o.renderer) { try { ktx2 = new THREE.KTX2Loader().setTranscoderPath(o.transcoderPath || 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/libs/basis/').detectSupport(o.renderer); } catch (e) { console.warn('[PaperMat] KTX2 unavailable', e); ktx2 = null; } }
    PM.ktx2 = !!ktx2;
    const cellsP = fetch(PM.base + 'wear_atlas.json').then(r => r.json()).then(j => { PM.cells = j.cells; }).catch(() => { PM.cells = {}; });
    for (const k of Object.keys(LIB)) if (k !== 'mat' && !LIB[k].lazy) { tex(LIB[k].col, true); if (LIB[k].nrm) tex(LIB[k].nrm, false); if (LIB[k].orm) tex(LIB[k].orm, false); }
    tex('macro_var.jpg', false);
    const wait = PM._loads.map(t => new Promise(res => { const c = () => (t.image && t.image.width) ? res() : setTimeout(c, 30); c(); }));
    // never block a boot on textures: after `timeout` ms (default 20 s; a slow CDN transcoder or a stalled download) resolve anyway,
    // the textures keep streaming in and simply appear when they arrive
    const timeout = new Promise(res => setTimeout(() => { if (!PM.ready) console.warn('[PaperMat] load timeout: continuing with what arrived'); res(); }, o.timeout || 20000));
    return Promise.race([Promise.all([cellsP, ...wait]), timeout]).then(() => { PM.ready = true; return PM; });
  };
  // ---------------------------------------------------------------- shader extension (one function object => shared programs per key)
  const HOOK = function (sh) {
    const u = this.userData.pm;
    sh.uniforms.pmMacro = u.macroTex; sh.uniforms.pmK = u.k; sh.uniforms.pmMean = u.mean;
    const tri = u.flags.tri, lm = u.flags.lm;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPmWP; varying vec3 vPmWN; uniform vec4 pmK;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\nvUv *= pmK.z;\n#endif')   // UV in metres -> repeats
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPmWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vPmWN = normalize(mat3(modelMatrix) * objectNormal);');
    let f = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPmWP; varying vec3 vPmWN; uniform sampler2D pmMacro; uniform vec4 pmK;   // x macro amount, y sheen, z 1/tile (triplanar), w lightmap scale
        uniform vec4 pmMean;   // rgb = the tile's mean albedo (linear), a = flatten amount (0 = the photo as is, 1 = flat mean colour)
        vec3 pmTriW() { vec3 w = pow(abs(vPmWN), vec3(6.0)); return w / (w.x + w.y + w.z); }
        vec4 pmTri(sampler2D s, vec3 w) { float k = pmK.z; return texture2D(s, vPmWP.zy * k) * w.x + texture2D(s, vPmWP.xz * k) * w.y + texture2D(s, vPmWP.xy * k) * w.z; }`);
    // AO from the material UV (three r147 samples aoMap with uv2, which the map uses for its lightmap)
    f = f.replace('#include <aomap_fragment>', `#ifdef USE_AOMAP
        { float ao = ${tri ? 'pmTri(aoMap, pmTriW()).r' : 'texture2D(aoMap, vUv).r'}; float ambientOcclusion = (ao - 1.0) * aoMapIntensity + 1.0;
          reflectedLight.indirectDiffuse *= ambientOcclusion; }
        #endif`);
    if (tri) {
      f = f.replace('#include <map_fragment>', `#ifdef USE_MAP
          { vec4 sampledDiffuseColor = pmTri(map, pmTriW()); diffuseColor *= sampledDiffuseColor; }
          #endif`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
          roughnessFactor *= pmTri(roughnessMap, pmTriW()).g;
          #endif`)
        .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP
          { vec3 w = pmTriW(); vec3 n = normalize(vPmWN); float k = pmK.z; vec2 ns = normalScale;
            vec3 tX = texture2D(normalMap, vPmWP.zy * k).xyz * 2.0 - 1.0; vec3 tY = texture2D(normalMap, vPmWP.xz * k).xyz * 2.0 - 1.0; vec3 tZ = texture2D(normalMap, vPmWP.xy * k).xyz * 2.0 - 1.0;
            tX.xy *= ns; tY.xy *= ns; tZ.xy *= ns;
            tX = vec3(tX.xy + n.zy, abs(tX.z) * n.x); tY = vec3(tY.xy + n.xz, abs(tY.z) * n.y); tZ = vec3(tZ.xy + n.xy, abs(tZ.z) * n.z);
            vec3 wN = normalize(tX.zyx * w.x + tY.xzy * w.y + tZ.xyz * w.z);
            normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz); }
          #endif`);
    }
    // macro variation (world space, 7 m tile) right after the albedo
    f = f.replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 w = pmTriW(); vec2 muv = (vPmWP.xz * w.y + vPmWP.zy * w.x + vPmWP.xy * w.z) / 7.0;
          #if defined( USE_COLOR_ALPHA )
          diffuseColor.rgb = mix(diffuseColor.rgb, pmMean.rgb * vColor.rgb, pmMean.a);
          #elif defined( USE_COLOR )
          diffuseColor.rgb = mix(diffuseColor.rgb, pmMean.rgb * vColor, pmMean.a);
          #else
          diffuseColor.rgb = mix(diffuseColor.rgb, pmMean.rgb, pmMean.a);
          #endif
          diffuseColor.rgb *= 1.0 + (texture2D(pmMacro, muv).r - 0.5) * pmK.x; }`);
    if (lm) {   // lightmap stored as sqrt(light / scale)
      let chunk = THREE.ShaderChunk.lights_fragment_maps.replace('lightMapTexel.rgb * lightMapIntensity', 'lightMapTexel.rgb * lightMapTexel.rgb * lightMapIntensity * pmK.w');
      // lmOnly (FULL BAKE): the lightmap IS the light (sun + sky + bounce + AO + shadows from Cycles): no hemisphere added, no real-time
      // sun; the frame equals the Blender render for every static surface and costs nothing per frame
      // WP-D1: movers' shadows from the live shadow map take away the bake's SUN share (06-paper-look.js ART_SH_GLSL / artDynShadow)
      const dyn = u.flags.lmOnly && typeof ART_SH_GLSL !== 'undefined';
      if (dyn) { Object.assign(sh.uniforms, ART_SH_U); f = f.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>' + String.fromCharCode(10) + ART_SH_GLSL); }
      if (u.flags.lmOnly) chunk = chunk.replace('irradiance += lightMapIrradiance;', dyn ? 'irradiance = lightMapIrradiance * artDynShadow(lightMapTexel.rgb);' : 'irradiance = lightMapIrradiance;');
      f = f.replace('#include <lights_fragment_maps>', chunk);
      if (u.flags.lmOnly) f = f.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse = vec3(0.0); reflectedLight.directSpecular = vec3(0.0);');
    }
    // fibre sheen: paper and board catch light at grazing angles (only where light reaches: scaled by the lit diffuse)
    f = f.replace('#include <output_fragment>', `{ float ndv = saturate(dot(normalize(normal), normalize(vViewPosition))); float fr = pow(1.0 - ndv, 3.0);
        outgoingLight += (reflectedLight.directDiffuse * 1.2 + reflectedLight.indirectDiffuse * 0.6) * fr * pmK.y * vec3(1.0, 0.96, 0.9); }
        #include <output_fragment>`);
    sh.fragmentShader = f;
  };
  PM.makeMaterial = function (kind, o = {}) {
    const L = LIB[kind]; if (!L) throw new Error('[PaperMat] unknown kind ' + kind);
    const key = kind + JSON.stringify(o, (k, v) => (v && v.isTexture) ? v.uuid : v);
    if (PM._mats[key]) return PM._mats[key];
    const tile = o.tile || L.tile, tri = !!o.triplanar && !L.strip, decal = !!(o.decal || L.decal);
    const m = new THREE.MeshStandardMaterial({
      map: tex(L.col, true), normalMap: L.nrm ? tex(L.nrm, false) : null, roughnessMap: L.orm ? tex(L.orm, false) : null, aoMap: L.orm ? tex(L.orm, false) : null,
      metalness: 0, roughness: (L.orm ? 1 : (L.rough || .85)) * (o.roughness || 1), envMapIntensity: o.envMapIntensity ?? .35,
      vertexColors: !!o.vertexColors, side: o.side || THREE.FrontSide, color: o.color !== undefined ? new THREE.Color(o.color) : 0xffffff,
      transparent: decal, depthWrite: !decal, polygonOffset: decal, polygonOffsetFactor: decal ? -2 : 0, polygonOffsetUnits: decal ? -2 : 0, alphaTest: decal ? .02 : 0,
    });
    m.normalScale = new THREE.Vector2(o.normalScale ?? L.normalScale ?? 1, o.normalScale ?? L.normalScale ?? 1);
    if (o.lightMap) { m.lightMap = o.lightMap; m.lightMapIntensity = o.lightMapIntensity ?? 1; }
    // uv repeat: UV = metres, so the shader scales vUv by 1 / tile (pmK.z; textures stay shared, never cloned, so KTX2 data arrives
    // for every material). Strips (flute / ruler / wear) carry their own UVs (tile 1).
    m.userData.pm = { kind, tile, flags: { tri, lm: !!(o.lightMap && (o.lmSqrt ?? true)), decal, lmOnly: !!(o.lightMap && o.lmOnly) }, macroTex: { value: tex('macro_var.jpg', false) },
      k: { value: new THREE.Vector4(o.macro ?? L.macro ?? .1, o.sheen ?? L.sheen ?? .1, L.strip ? 1 : 1 / tile, o.lmScale ?? 1) },
      mean: { value: new THREE.Vector4(...(new THREE.Color(L.mean || 0x808080).convertSRGBToLinear().toArray()), o.flat ?? 0) } };
    m.userData.paper = kind; m.userData.tile = tile;
    m.onBeforeCompile = HOOK;
    m.customProgramCacheKey = () => 'pm3|' + (tri ? 't' : 'u') + (m.userData.pm.flags.lm ? 'L' : '') + (m.userData.pm.flags.lmOnly ? 'O' : '') + (decal ? 'd' : '');
    return (PM._mats[key] = m);
  };
  PM.tune = function (m, o) { const k = m.userData.pm && m.userData.pm.k.value; if (!k) return; if (o.macro !== undefined) k.x = o.macro; if (o.sheen !== undefined) k.y = o.sheen; if (o.lmScale !== undefined) k.w = o.lmScale; if (o.flat !== undefined) m.userData.pm.mean.value.w = o.flat; };
  // ---------------------------------------------------------------- geometry helpers (UV conventions of the library)
  // A cardboard board: w x h x d box whose faces perpendicular to `thick` (x|y|z) get the face material (UV = metres), and the 4 cut
  // sides get the flute strip (u = metres along the edge / (8 x thickness), v = 0..1 across the thickness). Returns a Mesh with 2
  // materials. o.solid = true: a closed box / solid block (crate, building mass): every face gets the face material, no flutes.
  PM.boardBox = function (w, h, d, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d); const thick = o.thick || (Math.min(w, h, d) === d ? 'z' : Math.min(w, h, d) === h ? 'y' : 'x');
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv; const size = { x: w, y: h, z: d };
    const idx = { x: 0, y: 1, z: 2 }[thick]; const groups = g.groups; const faceMat = o.face || PM.makeMaterial('kraft', o.faceOpts || {}), edgeMat = o.edge || PM.makeMaterial('flute', o.edgeOpts || {});
    for (const gr of groups) {
      const n = [nor.getX(gr.start), nor.getY(gr.start), nor.getZ(gr.start)]; const axis = n[0] ? 0 : n[1] ? 1 : 2;
      const isFace = o.solid || axis === idx; gr.materialIndex = isFace ? 0 : 1;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        const vi = g.index.getX(i); const p = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)];
        if (isFace) { const a = (axis + 1) % 3, b = (axis + 2) % 3; uv.setXY(vi, p[a] + (o.offset ? o.offset[a] : 0), p[b] + (o.offset ? o.offset[b] : 0)); }
        else { const along = [0, 1, 2].find(k => k !== axis && k !== idx); uv.setXY(vi, (p[along] + size[['x', 'y', 'z'][along]] / 2) / fluteRepeat(size[thick]), (p[idx] + size[thick] / 2) / size[thick]); }
      }
    }
    uv.needsUpdate = true; g.setAttribute('uv2', g.attributes.uv);
    const mesh = new THREE.Mesh(g, [faceMat, edgeMat]); mesh.castShadow = mesh.receiveShadow = true; return mesh;
  };
  // a flute strip quad: length L along x, thickness t along y (facing +z). For lids, window reveals, torn openings.
  PM.fluteStrip = function (L, t) { const g = new THREE.PlaneGeometry(L, t); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / fluteRepeat(t), uv.getY(i)); g.setAttribute('uv2', uv); return g; };
  // ruler top face: length L (metres) showing `cm` centimetres of scale; v 0..0.5 = marked face. Side faces use v 0.5..1 (plain wood).
  PM.rulerUV = function (geo, L, cm, face = true) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (cm / RULER_REPEAT_CM), face ? uv.getY(i) * .5 : .5 + uv.getY(i) * .5); uv.needsUpdate = true; return geo; };
  // wear decal quad: cell name from wear_atlas.json (torn0-3, scuff0-2, dent0, glue0-1, ink_arrows, ink_glass, ink_ring, tape_brown0-1, tape_clear0-1)
  PM.decal = function (cell, w, h) {
    const c = (PM.cells && PM.cells[cell]) || [0, 0, .25, .25]; const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, c[0] + uv.getX(i) * c[2], 1 - c[1] - c[3] + uv.getY(i) * c[3]);
    g.setAttribute('uv2', uv); return g;
  };
  // estimated GPU memory of the loaded textures (RGBA8 + mipmaps, or the compressed mip bytes for KTX2)
  PM.stats = function () { let bytes = 0, n = 0; const seen = new Set(); for (const k in PM._tex) { const t = PM._tex[k]; if (!t.image || seen.has(t.image)) continue; seen.add(t.image); n++; bytes += (t.isCompressedTexture && t.mipmaps && t.mipmaps.length) ? t.mipmaps.reduce((s, m) => s + (m.data ? m.data.byteLength : 0), 0) : t.image.width * t.image.height * 4 * 1.333; } return { textures: n, mb: +(bytes / 1048576).toFixed(1), tier: PM.tier, ktx2: PM.ktx2 }; };
  // compile every material variant now (never mid-match)
  PM.warm = function (renderer, scene, camera) { const g = new THREE.Group(); const b = new THREE.BoxGeometry(.1, .1, .1); for (const k in PM._mats) g.add(new THREE.Mesh(b, PM._mats[k])); scene.add(g); renderer.compile(scene, camera); scene.remove(g); };
  window.PaperMat = PM;
})();
