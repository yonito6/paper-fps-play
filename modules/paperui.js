/* Foldiers UI extras (BRAND/UI agent, modules/paperui.js; loads after paper.js). Styling lives in src/index.shell.html.
   - Character cards: a real portrait of each paper soldier (the CHARS agent's current GLB in your blue paper, idle pose), rendered
     ONCE in the menu by a small separate WebGL canvas that is thrown away right after (never during a match, no cost in play).
   - End screen: #mend gets win / lose / draw so the result sits on a blue, red or split torn banner.
   - Preloads every UI image so no screen pops in late.
   Test API: window.PAPER_UI.portraits {id: dataURL}, PAPER_UI.uiPortraits() */
(() => {
  'use strict';
  if (window.__paperUIx) return; window.__paperUIx = true;
  const $ = id => document.getElementById(id);

  /* ---------------- preload ---------------- */
  const UI = 'assets/brand/ui/', IMGS = ['panel_rim.webp', 'panel_mask.png', 'panel_edge.webp', 'tag_rim.webp', 'tag_mask.png', 'tag_edge.webp', 'sheet_rim.webp', 'sheet_mask.png', 'sheet_edge.webp', 'sheetr_rim.webp', 'sheetr_mask.png', 'sheetr_edge.webp', 'hole1.webp', 'tape.webp'].map(f => UI + f)
    .concat(['assets/brand/foldiers_logo_512.webp', 'assets/brand/foldiers_logo_1024.webp', 'assets/paper/materials/512/paper_col.jpg', 'assets/paper/materials/512/origami_blue_col.jpg', 'assets/paper/materials/512/origami_red_col.jpg', 'assets/ui/map_desktown.jpg']);
  const keep = []; for (const u of IMGS) { const i = new Image(); i.decoding = 'async'; i.src = u; keep.push(i); }

  /* ---------------- end screen result ---------------- */
  const mend = $('mend'), mt = $('mendTitle');
  if (mend && mt) {
    const sync = () => { const t = (mt.textContent || '').toLowerCase(); mend.classList.toggle('win', /victor|win/.test(t)); mend.classList.toggle('lose', /defeat|lose|lost/.test(t)); mend.classList.toggle('draw', /draw/.test(t)); fill(); };
    new MutationObserver(sync).observe(mt, { childList: true, characterData: true, subtree: true }); sync();
  }

  // wp-endfit: the end card ALWAYS fits the viewport (no scrollbar, no overlap): measure the card at zoom 1, then scale it down to fit
  // (and up to the HUD scale on 1440p / 4K). Re-runs on resize, on show, and when XP / medals / board content is added.
  if (mend) {
    const sheet = mend.querySelector('.sheet'); let raf = 0;
    const fit = () => {
      raf = 0; if (!sheet || mend.hidden) return;
      sheet.style.zoom = '1';
      const W = innerWidth, H = innerHeight, w = sheet.offsetWidth || 1, h = sheet.offsetHeight || 1;
      const base = W >= 3400 ? 2.2 : W >= 2200 ? 1.5 : 1, padX = W < 600 ? 12 : 36, padY = 52;
      const z = Math.max(.3, Math.min(base, (W - padX) / w, (H - padY) / h));
      sheet.style.zoom = String(+z.toFixed(3)); mend.dataset.fit = z.toFixed(2);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(fit); };
    addEventListener('resize', kick);
    new MutationObserver(kick).observe(mend, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    if (window.PAPER_UI) window.PAPER_UI.fitEnd = fit;
  }

  // big team score + MVP for the one-card end screen (filled from the bot-match roster; hidden when there is none, e.g. FFA)
  const escH = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function fill() {
    const sc = $('mendScore'), mv = $('mendMvp'); if (!sc || !mv) return;
    const S = window.S9BotModes, M = S && S.M, pl = M && M.players ? [...M.players.values()] : [];
    if (!pl.length) { sc.hidden = mv.hidden = true; return; }
    const my = S.myTeam || 'atk', ot = my === 'atk' ? 'def' : 'atk', k = t => pl.filter(p => p.team === t).reduce((a, p) => a + (p.kills | 0), 0);
    sc.innerHTML = `<span class="t b"><small>Blue</small>${k(my)}</span><em>:</em><span class="t r"><small>Red</small>${k(ot)}</span>`; sc.hidden = false;
    const best = pl.slice().sort((a, b) => (b.kills | 0) - (a.kills | 0) || (a.deaths | 0) - (b.deaths | 0))[0];
    mv.innerHTML = `<b>MVP</b><span class="${best.team === my ? 'b' : 'r'}">${best.id === 'me' ? 'You' : escH(best.n || 'Bot')}</span><small>${best.kills | 0} kill${(best.kills | 0) === 1 ? '' : 's'} · ${best.deaths | 0} death${(best.deaths | 0) === 1 ? '' : 's'}</small>`; mv.hidden = false;
  }

  /* ---------------- character portraits ---------------- */
  let busy = false;
  async function portraits() {
    const U = window.PAPER_UI; if (busy || !U || !U.charModels || !Object.keys(U.charModels).length || typeof THREE === 'undefined') return; busy = true;
    const W = 240, H = 300, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    let r; try { r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); } catch (e) { busy = false; return; }
    const out = {};
    try {
      r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xfff1dc, 0x6b5236, 1.05));
      const sun = new THREE.DirectionalLight(0xffe2b8, 1.7); sun.position.set(2.5, 4, 3.5); sc.add(sun);
      const rim = new THREE.DirectionalLight(0xcfe0ff, .7); rim.position.set(-3, 2, -2.5); sc.add(rim);
      const cam = new THREE.PerspectiveCamera(22, W / H, .05, 60);
      const idle = typeof CLIPS !== 'undefined' && CLIPS && (CLIPS.Pistol_Idle_Loop || CLIPS.Idle_Loop);
      for (const id of Object.keys(U.charModels)) {
        const g = U.charModels[id], m = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true), tx = U.charTex && U.charTex[id] && U.charTex[id].atk;
        m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const src = Array.isArray(o.material) ? o.material[0] : o.material; o.material = new THREE.MeshStandardMaterial({ map: tx || (src && src.map) || null, color: tx || (src && src.map) ? 0xffffff : 0x2f4fb0, roughness: .88, metalness: 0, flatShading: false }); } });
        if (idle) { const mx = new THREE.AnimationMixer(m), a = mx.clipAction(idle.full || idle); a.play(); mx.update(.4); }
        m.rotation.y = .42; sc.add(m); m.updateMatrixWorld(true);
        const bb = new THREE.Box3(), bv = new THREE.Vector3(); m.traverse(o => { if (o.isBone) bb.expandByPoint(o.getWorldPosition(bv)); });   // skinned: bind-pose geometry bounds are ~0, so frame the posed skeleton
        if (bb.isEmpty() || bb.max.y - bb.min.y < .3) bb.setFromObject(m); else bb.max.y += (bb.max.y - bb.min.y) * .1;   // + the head above the head bone
        const h = Math.max(.5, bb.max.y - bb.min.y), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        const viewH = h * .74, cy = bb.max.y - viewH / 2 + h * .03, d = viewH / 2 / Math.tan(cam.fov * Math.PI / 360);
        cam.position.set(cx + d * .12, cy + h * .04, cz + d); cam.lookAt(cx, cy, cz);
        r.render(sc, cam); out[id] = cv.toDataURL('image/png');
        sc.remove(m);
      }
    } catch (e) { console.warn('portraits', e); }
    try { r.dispose(); r.forceContextLoss(); } catch (e) {}
    busy = false;
    if (!Object.keys(out).length) return;
    U.portraits = out;
    // swap the pictures in place (no menu rebuild: the entrance animation does not replay)
    document.querySelectorAll('#pmenu [data-ch]').forEach(b => { const u = out[b.dataset.ch], p = b.querySelector('.pic'); if (!u || !p) return; const im = new Image(); im.className = 'pic'; im.alt = ''; im.src = u; p.replaceWith(im); });
  }
  const go = () => setTimeout(portraits, 60);
  if (window.PAPER_UI && window.PAPER_UI.ready) go(); else addEventListener('paper:ready', go, { once: true });
  if (window.PAPER_UI) window.PAPER_UI.uiPortraits = portraits;
})();
