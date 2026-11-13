/* Foldiers - WP-GFX look pass (modules/papergfx.js). Loads after paperpost.js (manifest). Everything here is a uniform / render-state
   change or a shader addition compiled at load: no new lights, no new passes, no mid-match compiles.
   1. FILM GRADE: one display-space step folded into the existing final grade (no extra pass): per-channel gain + warm lift that fades
      toward white, saturation, and a soft exponential shoulder so whites roll off and never clip (refs: warm, bright, nothing blown).
      Numbers fitted with qa/paper/gfx_fit.py against the set2 clean plates (wp-a3-metrics grade_metric).
   2. FLICKER: (a) the map's print layer (posters, mat prints, signs: pm_print) lies IN the plane of the walls / mat it is printed on
      (0 mm gap, found by qa/paper/zfight_page.js) -> the two surfaces fought for the depth test and flashed while moving. The print
      layer now gets a depth bias toward the camera (polygonOffset, slope-scaled: holds at every distance). (b) the far cutting mat
      (180 x 140 m) lies under the play mat (100 x 60 m) in the SAME plane y = 0: it now gets a bias away from the camera.
      (c) camera near plane 0.05 -> 0.1 m (the first-person gun has its own camera): twice the depth precision everywhere.
   3. SOLDIER SHADING (shader only, wp-soldier-copy owns the mesh): on top of ART_CHAR_HOOK - crease shading from the normal's screen
      derivative (valley darker, ridge catches light, like the refs' folded paper), wrapped diffuse = light bleeding through thin paper
      (slight translucency), a warmer desk bounce on down-facing folds.
   API: window.PAPERGFX { status(), set({...}) } */
(function () {
  'use strict';
  if (window.PAPERGFX) return;
  if (typeof grade === 'undefined' || typeof scene === 'undefined' || typeof camera === 'undefined') { console.warn('[papergfx] globals missing, idle'); return; }
  const T = THREE, GU = grade.uniforms;
  const S = { film: 0, zfix: 0, near: 0, chars: 0, notes: [], err: null };
  const P = { film: 1, gain: [1.08, 1.06, 1.02], lift: [.012, .008, 0], sat: .97, shoulder: .2, skyBlur: .2, sky: null, skyTry: { zen: [.10, .45, 2.4], mid: [.22, .62, 2.6], hor: [.55, .90, 2.4], cloud: [2.2, 2.18, 2.1], cloudAmt: .85, sunGlow: .3 }, near: .1, crease: .35, wrap: .35, bounce: .25 };
  /* ---------- 1. film grade ---------- */
  GU.uFgK = { value: 1 }; GU.uFgGain = { value: new T.Vector3(1, 1, 1) }; GU.uFgLift = { value: new T.Vector3() }; GU.uFgSat = { value: 1 }; GU.uFgSh = { value: .15 };
  function patchGrade() {
    let fs = grade.material.fragmentShader; if (fs.includes('uFgK')) return true;
    const at = 'if (uLutK > 0.001)'; if (!fs.includes(at)) { S.notes.push('grade shader not recognised: film grade off'); return false; }
    fs = fs.replace('void main(){', `uniform float uFgK, uFgSat, uFgSh; uniform vec3 uFgGain, uFgLift;
vec3 fgFilm(vec3 c){ c = c * uFgGain + uFgLift * (1.0 - c); float L = dot(c, vec3(.2126,.7152,.0722)); c = max(L + (c - L) * uFgSat, 0.0);
  float k = 1.0 - uFgSh; vec3 s = k + (1.0 - k) * (1.0 - exp(-(c - k) / max(1.0 - k, 1e-3))); return clamp(mix(c, s, step(k, c)), 0.0, 1.0); }
void main(){`).replace(at, 'if (uFgK > 0.001) col = mix(col, fgFilm(col), uFgK);\n  ' + at);
    grade.material.fragmentShader = fs; grade.material.needsUpdate = true; return true;
  }
  let expBase = null;
  function applyFilm() {
    const on = P.film && S.film; GU.uFgK.value = on ? 1 : 0; GU.uFgGain.value.set(...P.gain); GU.uFgLift.value.set(...P.lift); GU.uFgSat.value = P.sat; GU.uFgSh.value = P.shoulder;
  }
  /* ---------- 2. flicker ---------- */
  function zfix() {
    let n = 0;
    scene.traverse(o => {
      if (!o.isMesh || !o.material || !o.parent) return; const pn = o.parent.name || '';
      if (/^desktown_.*_print$/.test(pn)) { for (const m of [].concat(o.material)) if (!m.userData.gfxZ) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; m.userData.gfxZ = 1; n++; } }
      else if (pn === 'desktown_far_mat' && !o.userData.gfxZ) { const m = [].concat(o.material)[0].clone(); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; o.material = m; o.userData.gfxZ = 1; n++; }
    });
    S.zfix += n; return n;
  }
  function applyNear() {
    if (camera.near !== P.near) { camera.near = P.near; camera.updateProjectionMatrix(); }
    if (GU.uDofNF) GU.uDofNF.value.set(camera.near, camera.far); S.near = camera.near;
  }
  /* ---------- 3. soldier shading ---------- */
  const CU = { crease: { value: P.crease }, wrap: { value: P.wrap }, bounce: { value: P.bounce } };
  function CHAR2(sh) {
    if (typeof ART_CHAR_HOOK === 'function') ART_CHAR_HOOK.call(this, sh);
    sh.uniforms.gfxCrease = CU.crease; sh.uniforms.gfxWrap = CU.wrap; sh.uniforms.gfxBounce = CU.bounce;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float gfxCrease, gfxWrap, gfxBounce;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
    { vec3 nV = normalize(normal); vec3 nW2 = inverseTransformDirection(nV, viewMatrix);
      // crease: how fast the normal turns across the pixel = a fold edge; concave folds (normal turning toward the eye) darken, ridges lift
      vec3 dn = fwidth(nV); float edge = smoothstep(.08, .55, dn.x + dn.y + dn.z);
      float ridge = step(0.0, dot(dFdx(nV), vec3(1.0, 0.0, 0.0)) + dot(dFdy(nV), vec3(0.0, -1.0, 0.0)));
      reflectedLight.directDiffuse *= 1.0 - edge * gfxCrease * (1.0 - ridge) * 0.6;
      reflectedLight.indirectDiffuse += diffuseColor.rgb * edge * ridge * gfxCrease * 0.25;
      // thin paper: light wraps past the terminator (soft, slightly translucent sheets instead of a hard plastic edge)
      float nl = dot(nW2, artSun); float wrapL = saturate((nl + gfxWrap) / (1.0 + gfxWrap)) - saturate(nl);
      reflectedLight.indirectDiffuse += diffuseColor.rgb * wrapL * vec3(1.0, 0.86, 0.68) * 0.55 * artObj.x;
      // warm desk bounce on down-facing folds (kraft desk under the soldier)
      reflectedLight.indirectDiffuse += diffuseColor.rgb * saturate(-nW2.y) * gfxBounce * vec3(1.0, 0.78, 0.55) * artObj.y; }`);
  }
  function shadeBot(r) {
    if (!r || !r.model) return 0; let n = 0;
    r.model.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of [].concat(o.material)) { if (!m.userData.artChar || m.userData.gfxChar) continue;
      m.userData.gfxChar = 1; m.onBeforeCompile = CHAR2; m.customProgramCacheKey = () => 'artChar1|gfx2'; m.needsUpdate = true; n++; } });
    S.chars += n; return n;
  }
  if (typeof artCharShade === 'function') { const _a = artCharShade; artCharShade = function (r) { const x = _a.apply(this, arguments); try { shadeBot(r); } catch (e) { S.err = 'char ' + e.message; } return x; }; }
  if (typeof buildBot === 'function') { const _bb = buildBot; buildBot = function () { const r = _bb.apply(this, arguments); try { shadeBot(r); } catch (e) {} return r; }; }
  function shadeAll() { try { for (const r of (window.__s9 && __s9.robots) || (typeof robots !== 'undefined' ? robots : [])) shadeBot(r); } catch (e) {} }
  /* ---------- 4. paper sky backdrop: the refs' sky is a saturated warm-blue paper sheet (median sRGB ~115,170,247) with white cut-out
     clouds; ours read grey-cyan (ACES compresses a 0..1 blue toward grey). The BACKGROUND cube is re-baked with the same paper-cut sky
     shader at HDR blue so it lands on the refs' colour after the grade; the environment map (lighting) is left as it is. ---------- */
  let skyRT = null;
  function paperSky() {
    if (!P.sky || typeof artSkyMaterial !== 'function') return false; let DD = null; try { DD = (0, eval)('DESKTOWN_DATA'); } catch (e) {} if (!DD || !scene.background || !scene.background.isTexture) return false;
    if (scene.background === (skyRT && skyRT.texture)) return true;
    const k = Object.assign({}, (0, eval)('DESKTOWN_LOOK'), (0, eval)('ART_LOOK').sky, P.sky), mat = artSkyMaterial(k), sc = new T.Scene(), g = new T.SphereGeometry(500, 64, 32); sc.add(new T.Mesh(g, mat));
    if (skyRT) skyRT.dispose(); skyRT = new T.WebGLCubeRenderTarget(1024, { type: T.HalfFloatType, generateMipmaps: false });
    new T.CubeCamera(1, 1200, skyRT).update(renderer, sc); scene.background = skyRT.texture; g.dispose(); mat.dispose(); S.sky = (S.sky || 0) + 1; return true;
  }
  /* ---------- wiring ---------- */
  function apply() { applyFilm(); try { if (window.PAPERPOST && P.skyBlur != null) PAPERPOST.set({ skyBlur: P.skyBlur }); } catch (e) {} applyNear(); CU.crease.value = P.crease; CU.wrap.value = P.wrap; CU.bounce.value = P.bounce; }
  try {
    S.film = patchGrade() ? 1 : 0; apply(); zfix(); shadeAll();
    if (typeof loadMap === 'function') { const _lm = loadMap; loadMap = async function () { const r = await _lm.apply(this, arguments); try { zfix(); applyNear(); shadeAll(); setTimeout(paperSky, 300); } catch (e) {} return r; }; }
    // the Desk Town GLB arrives after the add-ons (menu first): re-run the depth fix until its print layer is found
    // (2 min: the ART pass re-bakes the sky when the map art lands; a changed background is re-done, else it is a no-op)
    let polls = 0; const poll = setInterval(() => { zfix(); paperSky(); if (++polls > 240) clearInterval(poll); }, 500);
    addEventListener('s9gfx', apply); addEventListener('s9glrestored', () => setTimeout(paperSky, 200));
  } catch (e) { S.err = e.message; console.warn('[papergfx]', e); }
  window.PAPERGFX = { status: () => ({ film: S.film, filmK: GU.uFgK.value, zfix: S.zfix, near: S.near, chars: S.chars, sky: S.sky || 0, notes: S.notes, err: S.err, P: JSON.parse(JSON.stringify(P)) }),
    set: o => { Object.assign(P, o || {}); apply(); shadeAll(); return PAPERGFX.status(); } };
})();
