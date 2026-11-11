/* Foldiers - ART post pass (modules/paperpost.js, ART DIRECTOR; docs/ART_GAP.md)
   Loads after graphics.js / gfxplus.js / gfxmat.js (manifest). Adds to the existing final grade pass (no second full-screen grade):
   - miniature / tilt-shift depth of field (High, Ultra without MSAA): the scene colour + depth are read back from the composer's own
     render target (a depth texture on it, no extra scene pass); one half-resolution depth-aware blur (12 taps) is mixed in by distance,
     so the far town, pencil cup and sky go soft like a model on a desk while the first-person gun and the lane stay sharp.
   - a 3D colour LUT fitted to the references (assets/paper/look/grade_lut.png, 32^3 as a 1024x32 strip; the same .cube is for Unity),
     applied at the very end of the grade (2 texture reads). LUT strength per tier.
   - soft paper banners: the GLB's flat banner quads (print atlas cells ban_*) are found by their UVs, hidden in the print material's
     shader (uv-rect discard, one uniform) and replaced by sagging / curling origami-paper banners with the crane / boat as a separate
     white-paper layer (2 draw calls for all banners of a team).
   Rules kept: everything built at load (menu), tier switches are uniform changes, no mid-match compiles, no new lights.
   API: window.PAPERPOST { status(), set({ dof, dofNear, dofFar, dofMax, lut }), rebuild() } */
(function () {
  'use strict';
  if (window.PAPERPOST) return;
  const need = typeof composer !== 'undefined' && typeof renderer !== 'undefined' && typeof grade !== 'undefined' && typeof camera !== 'undefined' && typeof scene !== 'undefined';
  if (!need || !renderer.capabilities.isWebGL2) { console.warn('[paperpost] game globals / WebGL2 missing, idle'); return; }
  const T = THREE, S = { ready: false, dof: 0, lut: 0, lutLoaded: false, banners: 0, err: null, notes: [] };
  const tier = () => (window.S9GFX && S9GFX.tier) || CFG.q;
  const PARAM = { dof: 1, dofNear: 26, dofFar: 110, dofMax: .85, lut: 1, skyBlur: .55 };
  const inMatch = () => typeof state !== 'undefined' && (state === 'play' || state === 'paused' || state === 'dead');

  /* ---------- 1. depth from the composer's render target ---------- */
  const DOF = { rt: null, sceneRT: null, depth: {}, pass: null, ok: false };
  // (the world render is the first pass; the gun pass that follows clears the depth buffer and draws the first-person gun, so the
  //  blur + its per-pixel amount are computed from the world depth BEFORE that, and the gun pixels are recognised at grade time)
  function depthFor(rt) {
    if (!rt || rt.samples) return null;   // (multisampled targets: no depth texture in r147 -> DOF off on Ultra 4x MSAA)
    if (!rt.depthTexture) { const d = new T.DepthTexture(rt.width, rt.height); d.type = T.UnsignedIntType; d.minFilter = d.magFilter = T.NearestFilter; rt.depthTexture = d; rt.dispose(); }
    return rt.depthTexture;
  }
  // which buffer the RenderPass draws into (the composer swaps its two targets; the count of swaps per frame depends on the tier)
  const rp = composer.passes.find(p => p.isRenderPass || (p.scene && p.camera && p.constructor && /RenderPass/.test(p.constructor.name)));
  if (rp && !rp.__ppWrapped) { const _r = rp.render; rp.__ppWrapped = true; rp.render = function (r, w, rd) { DOF.sceneRT = rd; return _r.apply(this, arguments); }; }

  /* ---------- 2. half-resolution depth-aware blur (one pass, 12 taps, written to its own target; not part of the swap chain) ---------- */
  const BlurShader = {
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uNF: { value: new T.Vector2(.05, 700) }, uDof: { value: new T.Vector3(26, 110, .85) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
uniform sampler2D tDiffuse; uniform highp sampler2D tDepth; uniform vec2 uRes, uNF; uniform vec3 uDof; varying vec2 vUv;
float lin(float d){ float n = uNF.x, f = uNF.y; return 2.0*n*f / (f + n - (d*2.0-1.0)*(f-n)); }
float coc(vec2 uv){ float z = lin(texture2D(tDepth, uv).x); return max(smoothstep(uDof.x, uDof.y, z), step(650.0, z) * uDof.z); }   // uDof.z = extra sky softness
void main(){
  vec2 px = 1.0 / uRes; float c0 = coc(vUv); float rad = (1.5 + 4.5 * c0);
  vec3 acc = texture2D(tDiffuse, vUv).rgb; float wsum = 1.0;
  for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236 + 0.26; vec2 o = vec2(cos(a), sin(a)) * rad * px * (1.0 + 0.5 * mod(float(i), 2.0));
    vec2 uv = vUv + o; float w = 0.15 + 0.85 * step(c0 * 0.5, coc(uv));   // near sharp pixels do not smear into the far blur
    acc += texture2D(tDiffuse, uv).rgb * w; wsum += w; }
  gl_FragColor = vec4(acc / wsum, c0);
}` };
  class DofPass extends T.Pass {
    constructor() { super(); this.needsSwap = false; this.mat = new T.ShaderMaterial(BlurShader); this.fsq = new T.FullScreenQuad(this.mat); this.rt = new T.WebGLRenderTarget(2, 2, { type: T.HalfFloatType, depthBuffer: false }); this.rt.texture.minFilter = this.rt.texture.magFilter = T.LinearFilter; }
    setSize(w, h) { this.rt.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); this.mat.uniforms.uRes.value.set(Math.max(2, w >> 1), Math.max(2, h >> 1)); }
    render(r, w, rd) {
      if (!this.enabled) return;
      const src = DOF.sceneRT || rd, d = depthFor(src); if (!d) { GU.uDofK.value = 0; return; }
      this.mat.uniforms.tDiffuse.value = src.texture; this.mat.uniforms.tDepth.value = d; this.mat.uniforms.uNF.value.set(camera.near, camera.far); this.mat.uniforms.uDof.value.set(PARAM.dofNear, PARAM.dofFar, PARAM.skyBlur);
      r.setRenderTarget(this.rt); this.fsq.render(r);
      GU.tDofBlur.value = this.rt.texture; GU.tDofDepth.value = d; GU.uDofK.value = PARAM.dofDebug ? -1 : PARAM.dofMax * S.dof;
    }
  }

  /* ---------- 3. the grade shader: + depth-of-field mix + LUT (string patch of graphics.js's final pass, same program otherwise) ---------- */
  const GU = grade.uniforms;
  Object.assign(GU, { tDofBlur: { value: null }, tDofDepth: { value: null }, uDofK: { value: 0 }, uDofNF: { value: new T.Vector2(.05, 700) }, uDofR: { value: new T.Vector3(26, 110, .55) }, tLut: { value: null }, uLutK: { value: 0 } });
  function patchGrade() {
    let fs = grade.material.fragmentShader; if (/uDofK/.test(fs)) return true;
    const anchorA = 'float l = dot(col, vec3(.2126,.7152,.0722));', anchorB = 'col += (n-.5)*uGrain;';   // (after the chromatic-fringe block: it re-samples r/b sharp)
    if (fs.indexOf(anchorA) < 0 || fs.indexOf(anchorB) < 0) { S.err = 'grade anchors missing'; return false; }
    fs = fs.replace('varying vec2 vUv;', `varying vec2 vUv;
uniform sampler2D tDofBlur, tLut; uniform highp sampler2D tDofDepth; uniform float uDofK, uLutK; uniform vec2 uDofNF; uniform vec3 uDofR;
float ppLin(float d){ float n = uDofNF.x, f = uDofNF.y; return 2.0*n*f / (f + n - (d*2.0-1.0)*(f-n)); }
vec3 ppLut(vec3 c){ c = clamp(c, 0.0, 1.0); float b = c.b * 31.0; float b0 = floor(b), fb = b - b0; vec2 uv0 = vec2((b0 * 32.0 + 0.5 + c.r * 31.0) / 1024.0, 1.0 - (0.5 + c.g * 31.0) / 32.0); vec2 uv1 = uv0 + vec2(min(b0 + 1.0, 31.0) - b0, 0.0) * (32.0 / 1024.0);
  return mix(texture2D(tLut, uv0).rgb, texture2D(tLut, uv1).rgb, fb); }`);
    // DOF: mix the half-res far blur by the pixel's own distance (before the grade so the blur is graded too); sky gets a little extra softness
    fs = fs.replace(anchorA, `if (uDofK < -0.5) { vec4 bl = texture2D(tDofBlur, vUv); gl_FragColor = vec4(vec3(bl.a * step(0.9999, texture2D(tDofDepth, vUv).x)), 1.0); return; }   // debug: the blur amount
  if (uDofK > 0.001) { vec4 bl = texture2D(tDofBlur, vUv); float k = bl.a * uDofK * step(0.9999, texture2D(tDofDepth, vUv).x);   // (the gun pass cleared the depth: only the gun is < 1)
    col = mix(col, aces(bl.rgb * uExposure), k); }
  ` + anchorA);
    fs = fs.replace(anchorB, `if (uLutK > 0.001) col = mix(col, ppLut(col), uLutK);
  ` + anchorB);
    grade.material.fragmentShader = fs; grade.material.needsUpdate = true; return true;
  }

  /* ---------- 4. the LUT fitted to the references (render/paper/look/fit_lut.py -> assets/paper/look/grade_lut.png + grade.cube) ---------- */
  function loadLut() {
    new T.TextureLoader().load('assets/paper/look/grade_lut.png', t => { t.minFilter = t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.encoding = T.LinearEncoding; t.flipY = true; GU.tLut.value = t; S.lutLoaded = true; apply(); }, undefined, () => { S.notes.push('no LUT file (assets/paper/look/grade_lut.png): LUT off'); });
  }

  /* ---------- 5. soft paper banners replacing the GLB's flat banner quads ---------- */
  const BAN = { group: null, n: 0, rects: [], built: false };
  function cells() { try { const a = window.__paperAtlas; if (a) return a; } catch (e) {} return null; }
  async function buildBanners() {
    if (BAN.built) return; BAN.built = true;
    const DD = (() => { try { return (0, eval)('DESKTOWN_DATA'); } catch (e) { return null; } })();   // (a top-level let of the core script: reached through global eval, like graphics.js has())
    if (!DD || !DD.gltf) { S.notes.push('banners: no DESKTOWN_DATA'); return; } if (!window.PaperMat) { S.notes.push('banners: no PaperMat'); return; }
    const atlas = await fetch('render/paper/map/atlas.json').then(r => r.ok ? r.json() : null).catch(() => null); if (!atlas || !atlas.cells) { S.notes.push('no atlas.json: banners kept flat'); return; }
    const root = DD.gltf.scene; let print = null; root.traverse(o => { if (o.isMesh && o.material && o.material.name === 'pm_print' && o.visible && !print) print = o; });
    if (!print) { S.notes.push('banners: no pm_print mesh'); return; }
    const g = print.geometry, pos = g.attributes.position, uv = g.attributes.uv, nor = g.attributes.normal, idx = g.index;
    const W = atlas.size || 2048, cellRects = Object.entries(atlas.cells).filter(([k]) => /^ban_/.test(k)).map(([k, r]) => ({ k, x0: r[0] / W, y0: r[1] / W, x1: (r[0] + r[2]) / W, y1: (r[1] + r[3]) / W }));
    if (!cellRects.length) { S.notes.push('banners: no ban_* cells'); return; }
    // glTF uv: v is flipped (three keeps the file's uv with flipY false on textures): atlas y (top-left origin) -> uv.y = 1 - y? GLTFLoader leaves uvs as in file (top-left origin), textures flipY=false
    const inCell = (u, v) => cellRects.find(c => u >= c.x0 - 1e-4 && u <= c.x1 + 1e-4 && v >= c.y0 - 1e-4 && v <= c.y1 + 1e-4);
    // gather the banner triangles: group by cell + a spatial key (each banner = its own cluster of vertices)
    const tris = idx ? idx.count / 3 : pos.count / 3, groups = [];
    const key = (c, p) => c.k + '|' + Math.round(p.x / 1.5) + '|' + Math.round(p.z / 1.5);
    const vtx = new T.Vector3();
    for (let t = 0; t < tris; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const c = inCell(uv.getX(ia), uv.getY(ia)); if (!c || !inCell(uv.getX(ib), uv.getY(ib))) continue;
      vtx.set((pos.getX(ia) + pos.getX(ib) + pos.getX(ic)) / 3, 0, (pos.getZ(ia) + pos.getZ(ib) + pos.getZ(ic)) / 3);
      let gr = groups.find(q => q.cell === c && Math.abs(q.cx - vtx.x) < 1.2 && Math.abs(q.cz - vtx.z) < 1.2 && Math.abs(q.cy - (pos.getY(ia) + pos.getY(ib) + pos.getY(ic)) / 3) < 2.5);
      if (!gr) { gr = { cell: c, cx: vtx.x, cz: vtx.z, cy: (pos.getY(ia) + pos.getY(ib) + pos.getY(ic)) / 3, min: new T.Vector3(1e9, 1e9, 1e9), max: new T.Vector3(-1e9, -1e9, -1e9), n: new T.Vector3(), k: 0 }; groups.push(gr); }
      for (const i of [ia, ib, ic]) { const p = new T.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)); gr.min.min(p); gr.max.max(p); gr.n.add(new T.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i))); gr.k++; }
    }
    if (!groups.length) { S.notes.push('no banner quads found in pm_print'); return; }
    print.updateMatrixWorld(true);
    // hide the flat quads: the print material discards fragments whose uv lies in a banner cell (one uniform per cell, max 4)
    const pm = print.material; pm.userData.banRects = cellRects.slice(0, 4).map(c => new T.Vector4(c.x0, c.y0, c.x1, c.y1)); while (pm.userData.banRects.length < 4) pm.userData.banRects.push(new T.Vector4(2, 2, 3, 3));
    const prev = pm.onBeforeCompile, prevKey = pm.customProgramCacheKey;
    pm.onBeforeCompile = sh => { if (prev && prev !== T.Material.prototype.onBeforeCompile) prev(sh); sh.uniforms.ppBan = { value: pm.userData.banRects };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 ppBan[4];').replace('#include <map_fragment>', `for (int i = 0; i < 4; i++) { vec4 r = ppBan[i]; if (vUv.x >= r.x && vUv.x <= r.z && vUv.y >= r.y && vUv.y <= r.w) discard; }\n#include <map_fragment>`); };
    pm.customProgramCacheKey = () => (prevKey ? prevKey.call(pm) : '') + '|ppBan1'; pm.needsUpdate = true;
    // build the soft banners: a sheet sagging between its rod (top), curling at the hem, with a V cut; the emblem as a separate paper layer
    const grp = new T.Group(); grp.name = 'art_banners'; const byTeam = { blue: [], red: [] }, embByTeam = { blue: [], red: [] };
    for (const gr of groups) {
      const w = Math.max(gr.max.x - gr.min.x, gr.max.z - gr.min.z), h = gr.max.y - gr.min.y; if (w < .4 || h < .6) continue;
      const n = gr.n.normalize(); const team = /blue/.test(gr.cell.k) ? 'blue' : 'red', emb = /boat/.test(gr.cell.k) ? 'boat' : 'crane';
      const centre = new T.Vector3((gr.min.x + gr.max.x) / 2, gr.max.y, (gr.min.z + gr.max.z) / 2).addScaledVector(n, .02);
      const sheet = bannerSheet(w, h, gr.cx * 7.1 + gr.cz * 3.3), m = new T.Matrix4().makeRotationY(Math.atan2(n.x, n.z)).setPosition(centre);
      sheet.applyMatrix4(m); byTeam[team].push(sheet);
      const e = emblemSheet(w, h, emb === 'boat' ? 1 : 0); e.applyMatrix4(m); embByTeam[team].push(e);
      BAN.n++;
    }
    for (const team of ['blue', 'red']) {
      if (!byTeam[team].length) continue;
      const geo = T.BufferGeometryUtils.mergeBufferGeometries(byTeam[team]); const mat = PaperMat.makeMaterial(team, { side: T.DoubleSide, envMapIntensity: .2, sheen: .18, macro: .06 });
      const mesh = new T.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.noProbe = true; mesh.name = 'art_banner_' + team; grp.add(mesh);
      // the emblem layer: one quad per banner, the crane / boat cut from the owner's reference banners as an alpha mask (uv.x 0..0.5 crane, 0.5..1 boat)
      const eg = T.BufferGeometryUtils.mergeBufferGeometries(embByTeam[team]); const em = new T.MeshStandardMaterial({ map: embAtlas(), transparent: false, alphaTest: .45, side: T.DoubleSide, roughness: .95, metalness: 0, envMapIntensity: .2, color: 0xfaf6ee });
      const emesh = new T.Mesh(eg, em); emesh.receiveShadow = true; emesh.userData.noProbe = true; emesh.name = 'art_emblem_' + team; grp.add(emesh);
    }
    scene.add(grp); BAN.group = grp; S.banners = BAN.n;
    try { renderer.compile(scene, camera); } catch (e) {}
    try { renderer.shadowMap.needsUpdate = true; } catch (e) {}
  }
  // the sheet: width w, height h, hung from its top edge (y = 0 at the rod, down to -h). Sag: the paper bows out a little toward the
  // bottom and curls at the hem; the V cut at the bottom like the refs; a folded hem at the top (double thickness band).
  function bannerSheet(w, h, seed) {
    const nx = 10, ny = 18, g = new T.PlaneGeometry(w, h, nx, ny); g.translate(0, -h / 2, 0);
    const p = g.attributes.position, uv = g.attributes.uv; const rnd = k => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const curl = .06 + rnd(1) * .05, bow = .05 + rnd(2) * .04, tw = (rnd(3) - .5) * .05;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = -y / h;   // t: 0 at the rod, 1 at the hem
      let z = Math.sin(t * Math.PI) * bow * (1 - .5 * Math.abs(x / (w / 2)));          // bows out mid-height, flatter at the sides
      z += Math.pow(t, 3) * curl + (x / w) * tw * t;                                      // hem curls forward, slight twist
      z += Math.sin(x / w * 6.28 * 2 + seed) * .012 * t + Math.sin(t * 9 + seed) * .006; // small wrinkles
      p.setXYZ(i, x, y, z); uv.setXY(i, uv.getX(i) * (w / .6), uv.getY(i) * (h / .6));   // team paper tile 0.6 m
    }
    // the V notch: drop the bottom-centre rows into a notch by pulling vertices up along the centre
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = -y / h; if (t > .8) { const v = Math.abs(x) / (w / 2); const notch = Math.max(0, (1 - v) - (1 - (t - .8) / .2)) ; p.setY(i, y + notch * h * .2); } }
    g.computeVertexNormals(); g.setAttribute('uv2', g.attributes.uv); g.deleteAttribute('normal'); g.computeVertexNormals();
    // folded hem at the top: a thin band of double thickness in front of the rod
    const hem = new T.PlaneGeometry(w * 1.02, h * .06, 2, 1); hem.translate(0, -h * .03, .02); const hu = hem.attributes.uv; for (let i = 0; i < hu.count; i++) hu.setXY(i, hu.getX(i) * (w / .6), hu.getY(i) * .1);
    hem.setAttribute('uv2', hem.attributes.uv);
    return T.BufferGeometryUtils.mergeBufferGeometries([g, hem]);
  }
  // emblem: a flat paper cut-out 3 cm in front of the sheet, following its bow; uv picks the crane (left half) or the boat (right half)
  function emblemSheet(w, h, which) {
    const sz = Math.min(w * .78, h * .42), g = new T.PlaneGeometry(sz, sz, 4, 4); g.translate(0, -h * .40, .03);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const t = -p.getY(i) / h; p.setZ(i, p.getZ(i) + Math.sin(t * Math.PI) * .05); uv.setXY(i, which * .5 + uv.getX(i) * .5, uv.getY(i)); }
    g.computeVertexNormals(); g.setAttribute('uv2', g.attributes.uv); return g;
  }
  let embAtlasTex = null;
  function embAtlas() {
    if (embAtlasTex) return embAtlasTex;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; embAtlasTex = t;
    let n = 0; for (const [i, k] of [[0, 'crane'], [1, 'boat']]) { const im = new Image(); im.onload = () => { g.drawImage(im, i * 256, 0, 256, 256); t.needsUpdate = true; if (++n === 2) { try { renderer.shadowMap.needsUpdate = true; } catch (e) {} } }; im.src = 'assets/paper/look/emblem_' + k + '.png'; }
    return t;
  }
  /* ---------- tiers / apply ---------- */
  function apply() {
    const t = tier(), msaa = composer.renderTarget1 && composer.renderTarget1.samples;
    S.dof = (t === 'high' || t === 'ultra') && !msaa ? PARAM.dof : 0;
    S.lut = S.lutLoaded ? (t === 'performance' ? PARAM.lut * .8 : PARAM.lut) : 0;
    GU.uLutK.value = S.lut; GU.uDofR.value.set(PARAM.dofNear, PARAM.dofFar, PARAM.skyBlur);
    if (DOF.pass) DOF.pass.enabled = S.dof > 0; if (!S.dof) GU.uDofK.value = 0;
  }
  function init() {
    if (!patchGrade()) return;
    DOF.pass = new DofPass(); const ri = composer.passes.indexOf(rp); composer.insertPass(DOF.pass, ri < 0 ? 1 : ri + 1);   // right after the world render, before the gun pass clears the depth
    DOF.pass.setSize(renderer.domElement.width, renderer.domElement.height);
    GU.uDofNF.value.set(camera.near, camera.far);
    loadLut(); apply();
    buildBanners().catch(e => { S.err = 'banners ' + e.message; console.warn('[paperpost] banners', e); });
    if (typeof applyQuality === 'function') { const _aq = applyQuality; applyQuality = function () { const r = _aq.apply(this, arguments); try { apply(); } catch (e) {} return r; }; }
    addEventListener('s9gfx', apply);
    S.ready = true;
  }
  try { init(); } catch (e) { S.err = e.message; console.warn('[paperpost]', e); }
  window.PAPERPOST = { status: () => ({ ready: S.ready, tier: tier(), dof: S.dof, lut: S.lut, lutLoaded: S.lutLoaded, banners: S.banners, err: S.err, notes: S.notes, param: Object.assign({}, PARAM),
      depth: { rt: !!DOF.sceneRT, hasDepth: !!(DOF.sceneRT && DOF.sceneRT.depthTexture), samples: DOF.sceneRT && DOF.sceneRT.samples, size: DOF.sceneRT && [DOF.sceneRT.width, DOF.sceneRT.height], rp: !!rp, k: GU.uDofK.value } }),
    set: o => { Object.assign(PARAM, o || {}); apply(); }, rebuild: () => { BAN.built = false; if (BAN.group) { scene.remove(BAN.group); BAN.group = null; } BAN.n = 0; return buildBanners(); } };
})();
