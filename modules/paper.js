/* Foldiers (Paper FPS engine fork): menu, HUD, transitions, title, weapon data, characters (modules/paper.js).
   - Title: data/game.json (the ONE place the name lives).
   - Menu: a cardboard menu (pick 1 of 4 characters, difficulty, Play vs Bots). Online stays dormant (not shown).
   - Match: Team Deathmatch blue (you + 3 bots) vs red (4 bots), first to 30 or 8 minutes (data/botmodes.json, run by botmodes.js).
   - HUD like the references: team score pills top centre, HP bottom-left, gun icon + ammo bottom-right, simple crosshair.
   - Transitions: torn kraft sheets slide closed/open between menu, loading, match and end screen.
   - Weapons: data/paper_weapons.json applied over the engine table (file wins).
   Test API: window.PAPER_UI { ready, playBots(), char, chars, wipe(fn) } */
(() => {
  'use strict';
  if (window.PAPER_UI) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const U = window.PAPER_UI = { ready: false, char: 'crane', diff: 'normal', chars: null, game: null, wipes: 0 };
  try { const c = JSON.parse(localStorage.getItem('paperfps-ui') || '{}'); if (c.char) U.char = c.char; if (c.diff) U.diff = c.diff; } catch (e) {}
  const save = () => { try { localStorage.setItem('paperfps-ui', JSON.stringify({ char: U.char, diff: U.diff })); } catch (e) {} };

  // default characters (CHARS agent's data/paper/chars.json replaces them when it exists)
  const CHARS0 = [
    { id: 'trooper', name: 'Trooper', line: 'Folded for every fight. Steady, square, reliable.', svg: '<path d="M14 18 L32 8 L50 18 L48 30 L32 36 L16 30Z"/><path d="M20 36 L44 36 L40 56 L24 56Z"/>' },
    { id: 'scout', name: 'Scout', line: 'Light card, quick feet, first through every window.', svg: '<path d="M8 44 L30 30 L52 6 L40 32 L56 40 L30 40 L20 56 L24 40Z"/>' },
    { id: 'heavy', name: 'Heavy', line: 'Double-wall corrugated. Takes a crease, gives a crease.', svg: '<path d="M10 16 L32 8 L54 16 L54 46 L32 56 L10 46Z M10 16 L32 24 L54 16 M32 24 L32 56" stroke="#fff" stroke-width="2"/>' },
    { id: 'marksman', name: 'Marksman', line: 'Patient. Pointy. Never misses twice.', svg: '<path d="M10 10 L26 26 L38 26 L54 10 L50 34 L32 54 L14 34Z"/><path d="M24 34 L30 36 M40 34 L34 36" stroke="#fff" stroke-width="3"/>' },
  ];
  U.chars = CHARS0;

  /* ---------------- data ---------------- */
  const getJSON = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const dataP = Promise.all([getJSON('data/game.json'), getJSON('data/paper_weapons.json'), getJSON('data/paper/chars.json')]).then(([g, w, ch]) => {
    U.game = g || { title: 'Foldiers', short: 'Foldiers' };
    document.title = U.game.title;
    if (w && w.weapons) for (const id in w.weapons) if (WEAPONS[id]) { Object.assign(WEAPONS[id], w.weapons[id]); WEAPONS[id].label = WEAPONS[id].name + ' · ' + WEAPONS[id].cls.toLowerCase(); }
    U.weaponData = w;
    if (ch) { const list = Array.isArray(ch) ? ch : ch.chars || ch.characters; if (Array.isArray(list) && list.length) U.chars = list.slice(0, 4).map((c, i) => { const d = CHARS0.find(x => x.id === c.id) || CHARS0[i] || {}; return Object.assign({}, d, { id: c.id || d.id, name: c.name || c.id, line: c.line || c.tagline || c.desc || c.personality || d.line, img: c.icon || c.card || c.preview || null }); }); }
    if (!U.chars.some(c => c.id === U.char)) U.char = U.chars[0].id;
  });

  /* ---------------- look: ALL UI styling lives in src/index.shell.html ("FOLDIERS UI" block, built around the official logo:
     real cardboard textures + torn 9-slice pieces from assets/brand/ui, Changa One + Barlow Semi Condensed) ---------------- */

  /* ---------------- HUD extras ---------------- */
  const hud = $('hud');
  { const bl = hud.querySelector('.corner.bl'); const bar = document.createElement('div'); bar.id = 'pHpBar'; bar.innerHTML = '<i></i>'; bl.appendChild(bar);
    const br = hud.querySelector('.corner.br'); const am = document.createElement('div'); am.id = 'pAmmo'; br.insertBefore(am, $('hAmmo')); const g = document.createElement('div'); g.id = 'pGun'; am.appendChild(g); am.appendChild($('hAmmo'));
    const pl = document.createElement('div'); pl.id = 'pPlane'; pl.innerHTML = '<kbd>G</kbd><svg viewBox="0 0 40 22"><path d="M1 11 L39 1 L22 21 L18 13Z" fill="#fff"/><path d="M18 13 L39 1" stroke="#c0392b" stroke-width="1.5"/></svg><span id="pPlaneN">×2</span>'; hud.appendChild(pl);
    const tip = document.createElement('div'); tip.id = 'pTip'; hud.appendChild(tip);
    const hint = document.createElement('div'); hint.id = 'pHint'; hud.appendChild(hint);
    const sl = document.createElement('div'); sl.id = 'pSlice'; hud.appendChild(sl);
    const wk = document.createElement('div'); wk.id = 'pWalk'; wk.textContent = 'QUIET · no footsteps'; wk.style.cssText = 'position:absolute;left:22px;bottom:96px;display:none;font:900 13px Nunito,system-ui,sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.6);pointer-events:none';   /* (style: UI designer) */ hud.appendChild(wk);
    const pip = document.createElement('div'); pip.id = 'pPip'; pip.innerHTML = '<b>YOUR PLANE · mouse steers · click: pop · G: let go</b>'; hud.appendChild(pip); }
  const gunIcon = id => { const gi = U.gunIcons && U.gunIcons[id]; if (gi) return `<img src="${esc(gi)}" alt="">`; return (typeof ICON !== 'undefined' && ICON[id]) || ''; };
  let lastW = null, lastHp = -1;
  const _updateHud = updateHud;
  updateHud = function (force) {
    const r = _updateHud.apply(this, arguments);
    try {
      if (P.weapon !== lastW || force) { lastW = P.weapon; $('pGun').innerHTML = gunIcon(P.weapon); }
      const hp = Math.max(0, Math.ceil(P.hp)); if (hp !== lastHp || force) { lastHp = hp; const b = $('pHpBar'); b.firstChild.style.transform = `scaleX(${hp / 100})`; b.classList.toggle('low', hp < 35); }
      if (P.weapon === 'boomerang' && typeof BOOM !== 'undefined') $('hAmmo').innerHTML = BOOM.out ? '<small>returning</small>' : '1<small>/ 1</small>';
    } catch (e) {}
    return r;
  };

  /* ---------------- paper wipe transitions ---------------- */
  const wp = document.createElement('div'); wp.id = 'pwipe'; wp.innerHTML = '<div class="s l"></div><div class="s r"></div><div class="c"><img src="assets/brand/foldiers_logo_1024.webp" srcset="assets/brand/foldiers_logo_1024.webp 1024w, assets/brand/foldiers_logo_2048.webp 1890w" sizes="(max-width:700px) 70vw, 560px" width="1024" height="349" alt=""><div class="t"></div></div>'; document.body.appendChild(wp);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  U.wipe = async (fn, text) => {
    U.wipes++; wp.querySelector('.t').textContent = text || ''; wp.classList.add('on'); await sleep(400);
    try { await fn(); } finally { await sleep(120); wp.classList.remove('on'); }
  };
  // match end: a quick fold-in/out over the switch to the end screen; back to the menu: same
  const _setState = setState;
  setState = function (s) {
    const prev = typeof state !== 'undefined' ? state : null;
    if (s === 'matchend' && prev !== 'matchend' && !U.inWipe) { U.inWipe = true; wp.querySelector('.t').textContent = ''; wp.classList.add('on'); setTimeout(() => { _setState.call(this, s); setTimeout(() => { wp.classList.remove('on'); U.inWipe = false; }, 120); }, 380); return; }
    return _setState.apply(this, arguments);
  };

  /* ---------------- menu (built around the official logo: assets/brand/foldiers_logo_*.webp) ---------------- */
  const KEYS = [['WASD', 'Move'], ['Mouse', 'Look'], ['Left click', 'Fire'], ['Right click', 'Aim'], ['1-5', 'Rifle · Shotgun · Sniper · SMG · Boomerang'], ['R', 'Reload'], ['Shift', 'Sprint (loud steps)'], ['Alt', 'Walk silently (hold)'], ['C', 'Crouch (silent)'], ['Space', 'Jump (twice: double jump)'], ['C', 'Crouch / slide'], ['E', 'Dash'], ['V', 'Paper cutter (melee)'], ['G or 6', 'Paper plane: take it out, click to throw, steer it with the mouse, click to pop, right click to let go'], ['F', 'CATCH a plane flying at you, then steer it back'], ['Y', 'Look at your gun'], ['Tab', 'Scores']];
  function menuHTML() {
    const g = U.game || {}, title = String(g.short || g.title || 'Foldiers').replace(/\s*\(.*\)\s*$/, '');
    const pic = c => (U.portraits && U.portraits[c.id]) ? `<img class="pic" src="${U.portraits[c.id]}" alt="">` : c.img ? `<img class="pic" src="${esc(c.img)}" alt="">` : `<svg class="pic" viewBox="0 0 64 64" aria-hidden="true">${c.svg || ''}</svg>`;
    const dname = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
    return `<div class="col">
      <h1 class="logo-h"><img class="logo" src="assets/brand/foldiers_logo_1024.webp" srcset="assets/brand/foldiers_logo_1024.webp 1024w, assets/brand/foldiers_logo_2048.webp 1890w" sizes="(max-width:700px) 92vw, 780px" width="1024" height="349" alt="${esc(title)}"></h1>
      <div class="board" role="dialog" aria-label="Main menu">
        <p class="tagline">${esc(g.tagline || 'Tear the map. Catch the plane. Fold the other team.')}</p>
        <div class="lab">Choose your Foldier</div>
        <div class="chars" role="radiogroup" aria-label="Character">${U.chars.map((c, i) => `<button type="button" class="ch" role="radio" data-ch="${esc(c.id)}" aria-checked="${c.id === U.char}"><i class="bh h${i % 3 + 1}"></i>${pic(c)}<b>${esc(c.name)}</b><span>${esc(c.line || '')}</span></button>`).join('')}</div>
        <div class="row2"><div class="lab">Bots</div><div class="chips" role="radiogroup" aria-label="Bot difficulty">${['easy', 'normal', 'hard'].map(d => `<button type="button" class="chip" role="radio" data-df="${d}" aria-checked="${d === U.diff}">${dname[d]}</button>`).join('')}</div></div>
        <div class="play"><button type="button" class="go" id="pPlay"><b>Play</b><small>vs bots · Desk Town</small><i class="bh"></i></button></div>
        <div class="mode">Team Deathmatch · Blue (you + 3 bots) vs Red (4 bots) · first to 30 kills or 8 minutes</div>
        <div class="smrow"><button type="button" class="sm" id="pKeysB" aria-expanded="false" aria-controls="pkeys">Controls</button><button type="button" class="sm" id="pSetB" aria-expanded="false" aria-controls="psetwrap">Settings</button></div>
        <div id="pkeys">${KEYS.map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('')}<div style="margin-top:8px">Shoot thin cardboard to tear holes you can see and shoot through. Shoot along a dashed crease to tear a flap open.</div></div>
        <div id="psetwrap"></div>
      </div>
    </div>`;
  }
  function buildMenu() {
    { const n = $('btnNext'), m = $('btnMenu'); if (n) n.textContent = 'Play again'; if (m) m.textContent = 'Main menu'; }
    let m = $('pmenu'); if (!m) { m = document.createElement('div'); m.id = 'pmenu'; $('menu').appendChild(m); }
    { const sm = $('setMenu'); if (sm && m.contains(sm)) $('menu').querySelector('.sheet').appendChild(sm); }   // a rebuild never destroys the settings box
    m.innerHTML = menuHTML();
    if (m._wired) return; m._wired = true;
    m.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      try { if (typeof sfx !== 'undefined' && sfx.equip) sfx.equip(); } catch (x) {}
      if (b.dataset.ch) { U.char = b.dataset.ch; save(); m.querySelectorAll('[data-ch]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.ch === U.char))); }
      else if (b.dataset.df) { U.diff = b.dataset.df; save(); m.querySelectorAll('[data-df]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.df === U.diff))); }
      else if (b.id === 'pPlay') U.playBots();
      else if (b.id === 'pKeysB') b.setAttribute('aria-expanded', String($('pkeys').classList.toggle('on')));
      else if (b.id === 'pSetB') { const w = $('psetwrap'), s = $('setMenu'); if (s && !w.contains(s)) w.appendChild(s); b.setAttribute('aria-expanded', String(w.classList.toggle('on'))); }
    });
  }
  U.buildMenu = buildMenu;
  U.playBots = async () => {
    if (U.starting) return; U.starting = true;
    try {
      if (U.assetsP) await U.assetsP;   // paper soldiers + guns first (never a match with Sector Nine robots)
      const BM = window.S9BotModes; if (BM) { if (BM.loading) await BM.loading; Object.assign(BM.cfg, { mode: 'tdm', size: 4, diff: U.diff }); BM.startOpts = { team: 'atk' }; }
      await U.wipe(async () => { try { initAudio(); } catch (e) {} try { lock(); } catch (e) {} await startMatch('desktown'); setState('play'); }, 'DESK TOWN');
    } finally { U.starting = false; }
  };
  // Enter on the menu = Play vs Bots (the core's Enter handler calls play(); route it here)
  const _play = typeof play === 'function' ? play : null;
  if (_play) play = async function () { if (state === 'menu') return U.playBots(); return _play.apply(this, arguments); };

  /* ---------------- first-match hints (each shown to a player a few times, then never again) ---------------- */
  const HINTS = [['holes', '<b>Shoot thin cardboard</b> to tear holes you can <b>see and shoot through</b>. Shoot along a dashed crease to rip a flap open.'],
    ['slice', 'Knife in hand (<b>V</b>), stand close to thin cardboard and <b>hold left click</b>: drag to cut a peek hole. Come back to the start of the cut and the piece drops out.'],
    ['walk', 'Footsteps give you away. <b>Hold Alt</b> to walk silently (crouching is silent too); <b>Shift</b> sprints, loud.'],
    ['plane', 'Press <b>G</b> to take out a <b>paper plane</b>, <b>click</b> to throw it, then steer it with the mouse. An enemy plane coming at you? Press <b>F</b> to <b>catch</b> it and send it back!']];
  U.showHints = () => {
    let seen = {}; try { seen = JSON.parse(localStorage.getItem('foldiers-hints') || '{}'); } catch (e) {}
    const due = HINTS.filter(([k]) => (seen[k] || 0) < 3); if (!due.length) return; const el = $('pHint'); let t = 2500;
    for (const [k, html] of due) { setTimeout(() => { el.innerHTML = html; el.classList.add('on'); }, t); setTimeout(() => el.classList.remove('on'), t + 6500); t += 7500; seen[k] = (seen[k] || 0) + 1; }
    try { localStorage.setItem('foldiers-hints', JSON.stringify(seen)); } catch (e) {}
  };

  /* ---------------- match start: holes reset, always blue, planes refilled ---------------- */
  const _startMatch = startMatch;
  startMatch = async function () {
    const r = await _startMatch.apply(this, arguments);
    try { TEAR.reset(); PFX.clear(); PLANES.reset(); PAPER_MARKS.clear(); PAPER_DEATHS.warm(); U.showHints(); } catch (e) {}
    return r;
  };

  /* ---------------- the GUNS agent's paper guns in first person (data/paper/guns.json + assets/paper/guns/*.glb) ---------------- */
  // Each engine viewmodel (WM[id]) keeps its motion (sway, kick, reload dip, ADS) and its muzzle flash; its Sector Nine meshes are
  // hidden and the paper gun is placed so that at the hip its grip sits at guns.json art.hip and at ADS its sight sits on the
  // camera axis at art.eye. The hands stay the engine's (tinted blue paper) until the CHARS agent's origami hands land.
  const GUNMAP = { carbine: 'rifle', breacher: 'shotgun', sniper: 'sniper', wasp: 'smg' };
  U.gunsLoaded = 0;
  // third-person paper guns (bots, drops, killcam avatar): the GUNS agent's GLBs, muzzle along +Z like the engine's rifleTP
  async function loadTPGuns() {
    const G = await getJSON('data/paper/guns.json'); if (!G || !G.guns) return; const L = new THREE.GLTFLoader();
    for (const [eid, gid] of Object.entries(Object.assign({ boomerang: 'boomerang' }, GUNMAP))) { const a = G.guns[gid] && G.guns[gid].art; if (!a) continue;
      try { const gl = await L.loadAsync(a.glb); (U.tpGuns = U.tpGuns || {})[eid] = { scene: gl.scene, mz: (a.attach && a.attach.muzzle) || [0, .1, -.6] }; } catch (e) { console.warn('tp gun', gid, e); } }
    if (!U._tpWrapped) { U._tpWrapped = true; const _tp = rifleTP;
      rifleTP = function (kind) { const id = kind === 'rifle' ? 'carbine' : kind, sc = U.tpGuns && U.tpGuns[id];
        if (!sc) { U.s9tpCalls = (U.s9tpCalls || 0) + 1; U.s9tpLast = id; return _tp.apply(this, arguments); }   // (counted: the tests require 0)
        const g = new THREE.Group(), c = sc.scene.clone(true); c.rotation.y = Math.PI; c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.noProbe = true; } }); g.add(c);
        g.userData.body = c; g.userData.muzzle = new THREE.Vector3(-sc.mz[0], sc.mz[1], -sc.mz[2]); g.userData.paperGun = true; return g; }; }
  }
  // the boomerang (key 5): Sector Nine's mechanic, paper/cardboard model. Every boomerang blade the engine builds (first-person hand,
  // the flying blade, killcam) becomes the blade from assets/paper/guns/boomerang.glb; the first-person viewmodel is rebuilt with it.
  function paperBoomerang() {
    const sc = U.tpGuns && U.tpGuns.boomerang, bm = sc && sc.scene.getObjectByName('blade'); if (!bm || !bm.isMesh || U._boomWrapped || typeof buildBoomBlade !== 'function') return;
    U._boomWrapped = true; bm.material.side = THREE.DoubleSide;
    buildBoomBlade = function () { const g = new THREE.Group(), m = new THREE.Mesh(bm.geometry, bm.material); m.scale.setScalar(.72); m.castShadow = true; m.userData.noProbe = true; g.add(m); g.userData.paperGun = true; g.userData.paperBoom = true; return g; };
    try { if (typeof WM !== 'undefined' && WM.boomerang && typeof buildBoomVM === 'function') { const old = WM.boomerang; if (old.group && old.group.parent) old.group.parent.remove(old.group); WM.boomerang = buildBoomVM(); if (P.weapon === 'boomerang' && typeof setModel === 'function') setModel('boomerang'); } } catch (e) { console.warn('paper boomerang vm', e); }
    U.paperBoom = true;
  }
  // WP-boomplane: the boomerang's hand = the shared origami paper hand (PVM rig, pose boomerang_hold / boomerang_release while the
  // fingers let go) instead of the Sector Nine capsule glove (55-weapons.js) / S9Hands glove: a socket group in the boomerang hand group
  // (data/paper/viewmodel.json hands.boomerang.R: pose, rot, off + at = socket spot, srot = socket rotation deg), siblings hidden.
  function paperBoomHand(c) {
    const B = typeof WM !== 'undefined' && WM.boomerang && WM.boomerang.boom; if (!B || typeof PVM === 'undefined' || !PVM.handGeo || !PVM.S.hand.mat) return false;
    c = c || (PVM.S.data && PVM.S.data.hands && PVM.S.data.hands.boomerang && PVM.S.data.hands.boomerang.R); if (!c) return false;
    const D = Math.PI / 180, hold = PVM.handGeo(c.pose || 'boomerang_hold', 'R', c.bones), open = PVM.handGeo(c.open || 'boomerang_release', 'R', c.bones);
    let s = B.paperSock;
    if (!s) {
      s = B.paperSock = new THREE.Group(); s.name = 'paperBoomSock'; B.hand.add(s);
      const m = B.paperHandM = new THREE.Mesh(hold, PVM.S.hand.mat); m.name = 'paperHand_R'; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.userData.noProbe = true; s.add(m);
      m.onBeforeRender = () => { for (const o of B.hand.children) if (o !== s && o !== B.holder && o.visible) o.visible = false;
        const f = B.fingers && B.fingers[0], g = f && Math.abs(f.rotation.y) > .2 ? B.paperOpen : B.paperHold; if (g && m.geometry !== g) m.geometry = g; };
    }
    B.paperHold = hold; B.paperOpen = open; B.paperHandM.geometry = hold;
    PVM.placeHand(B.paperHandM, 'R', Object.assign({ pose: 'boomerang_hold' }, c));
    const a = c.at || [0, 0, 0], r = c.srot || [0, 0, 0]; s.position.set(a[0], a[1], a[2]); s.rotation.set(r[0] * D, r[1] * D, r[2] * D);
    for (const o of B.hand.children) if (o !== s && o !== B.holder) o.visible = false;
    return true;
  }
  U.boomHand = paperBoomHand;
  async function loadGuns() {
    paperBoomerang();
    // WEAPONS agent: the core's PVM (src/game/40-viewmodel.js) builds the paper guns + origami hands + the plane slot (exact ADS)
    if (typeof PVM !== 'undefined') { await PVM.load(); U.gunIcons = Object.assign({}, PVM.icons); try { const hm = PVM.S.hand.mat, B = WM.boomerang; if (hm && B && B.group && U.paperBoom) B.group.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial && !(o.parent && o.parent.userData.paperBoom)) o.material = hm; }); } catch (e) {}   // boomerang hand = the paper hands' material
    try { paperBoomHand(); } catch (e) { console.warn('paper boomerang hand', e); }
    { const G = await getJSON('data/paper/guns.json'), bi = G && G.guns && G.guns.boomerang && G.guns.boomerang.art && G.guns.boomerang.art.hudIcon; if (bi && !U.gunIcons.boomerang) U.gunIcons.boomerang = bi; } lastW = null; try { updateHud(true); } catch (e) {} return; }
    const G = await getJSON('data/paper/guns.json'); if (!G || !G.guns) return;
    U.gunIcons = {}; const L = new THREE.GLTFLoader();
    for (const [eid, gid] of Object.entries(GUNMAP)) {
      const a = G.guns[gid] && G.guns[gid].art, m = WM[eid]; if (!a || !m) continue;
      if (a.hudIcon) U.gunIcons[eid] = a.hudIcon;
      try {
        const gl = await L.loadAsync(a.glb); const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = .5; } });
        const grp = m.group, keep = new Set(); for (const k of [m.rear, m.leftArm, m.flash]) if (k) k.traverse(o => keep.add(o));
        grp.traverse(o => { if (o.isMesh && !keep.has(o)) o.visible = false; if (o.isSprite && !keep.has(o)) o.visible = false; });
        const sc = grp.scale.x || 1, off = new THREE.Vector3(...a.hip).sub(m.hip).divideScalar(sc);
        root.position.copy(off); grp.add(root);
        const sight = new THREE.Vector3(...((a.attach && a.attach.sight) || [0, .15, 0])), mz = new THREE.Vector3(...((a.attach && a.attach.muzzle) || [0, .1, -.6]));
        if (a.eye) m.adsPos = new THREE.Vector3(0, 0, -a.eye).sub(off.clone().multiplyScalar(sc)).sub(sight);
        if (m.flash) m.flash.position.copy(off).add(mz.divideScalar(sc));
        m.paper = root; U.gunsLoaded++;
      } catch (e) { console.warn('paper gun', gid, e); }
    }
    for (const id in WM) for (const k of [WM[id].rear, WM[id].leftArm]) if (k) k.traverse(o => { if (o.isMesh && o.material && !o.material.userData.paperHand) { o.material = o.material.clone(); o.material.color.set(0x2f4fb0); o.material.userData = { paperHand: 1 }; o.material.roughness = .9; o.material.metalness = 0; } });
    if (typeof P !== 'undefined' && P.weapon && WM[P.weapon]) { HIP_POS = WM[P.weapon].hip; ADS_POS = WM[P.weapon].adsPos; }
    try { renderer.compile(gunScene, gunCam); } catch (e) {}
    lastW = null; try { updateHud(true); } catch (e) {}
  }

  /* ---------------- the CHARS agent's paper soldiers replace the Sector Nine robots (assets/paper/chars/<id>.glb) ---------------- */
  // Same mixamo skeleton as the engine's animations, so the bots keep every clip. Team colour = the agent's blue / red textures.
  U.charModels = {}; U.charTex = {};
  // texture budget (DESIGN.md perf rule): cap a texture's size (characters 1024; everything 1024 on the Performance tier)
  function shrink(t, max) { const im = t && t.image; if (!im || !im.width || Math.max(im.width, im.height) <= max) return t; const k = max / Math.max(im.width, im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); t.image = c; t.needsUpdate = true; return t; }
  U.shrink = shrink;
  async function loadChars() {
    const ids = (U.chars || CHARS0).map(c => c.id), L = new THREE.GLTFLoader(), TL = new THREE.TextureLoader();
    const K2 = typeof s2Ktx2 === 'function' ? s2Ktx2() : null;   // WP-S2: team atlases as KTX2 (BC7, 1.3 MB of GPU each instead of 5.3), PNG fallback
    const tx = u => new Promise(res => { const png = () => TL.load(u, t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; shrink(t, 1024); res(t); }, undefined, () => res(null));
      if (!K2) return png(); K2.load(u.replace(/\.png$/, '.ktx2'), t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; res(t); }, undefined, png); });
    for (const id of ids) {
      try { const g = await L.loadAsync(`assets/paper/chars/${id}.glb`); if (!g || !g.scene) continue; g.scene.traverse(o => { if (o.isMesh && o.material) for (const k of ['map', 'normalMap', 'roughnessMap']) if (o.material[k]) shrink(o.material[k], 1024); }); U.charModels[id] = g; U.charTex[id] = { atk: await tx(`assets/paper/chars/${id}_blue.png`), def: await tx(`assets/paper/chars/${id}_red.png`) }; } catch (e) { console.warn('paper char', id, e); }
    }
    const list = Object.keys(U.charModels); if (!list.length) return;
    const S9soldier = U.charModels[U.char] || U.charModels[list[0]];   // the default model from now on: your character
    ASSET.soldier = S9soldier;
    try { if (typeof SHARED_GPU !== 'undefined' && SHARED_GPU) for (const g of Object.values(U.charModels)) g.scene.traverse(o => { if (o.geometry) SHARED_GPU.add(o.geometry); }); } catch (e) {}
    const _bb = buildBot;
    buildBot = function (profile) {
      const me = profile && profile.name === 'You', k = me && U.charModels[U.char] ? U.char : list[Math.abs([...String(profile && profile.name || 'x')].reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 7)) % list.length];
      ASSET.soldier = U.charModels[k]; let r;
      try { r = _bb.apply(this, arguments); } finally { ASSET.soldier = S9soldier; }
      r.paperChar = k; if (!r.visor) r.visor = new THREE.MeshStandardMaterial();
      { const c = profile && profile.color; r._team0 = me ? 'atk' : c && (Array.isArray(c) ? c[2] > c[0] : c.b > c.r) ? 'atk' : 'def'; }
      r.model.traverse(o => { o.userData.paperModel = true; if (o.isMesh && o.material) solid(o.material); });   // paper soldiers are opaque: never a see-through ghost
      r.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      paperTeam(r, true); return r;
    };
    // rebuild the bots already in the scene (menu) with the paper soldiers
    try { if (state === 'menu') { while (robots.length) removeRobot(robots[0]); newRoster(); } } catch (e) { console.warn('roster', e); }
    try { renderer.compile(scene, camera); } catch (e) {}
    U.charsLoaded = list.length;
  }
  // dress a body cloned from ASSET.soldier (death cam, killcam avatar) as your paper character in your team colour
  const solid = m => { m.transparent = false; m.opacity = 1; m.depthWrite = true; m.alphaTest = 0; };
  // The body must be drawn EXACTLY like every live soldier: the same paper character shader (06-paper-look artCharShade: paper
  // lighting, envMapIntensity .15) and it receives shadows. A clone straight from the asset loses the shader hook (Material.clone
  // drops onBeforeCompile), so it fell back to the generic lit shader at full environment light: a pale, glowing, shadow-free body in
  // the death cam (the "transparent ghost") + two shader programs compiled at the moment of death (the hitch).
  U.dressSelf = (root, team) => { const T = U.charTex[U.char] || {}; root.traverse(o => { o.userData.paperModel = true; if (!o.isMesh || !o.material) return; const m = o.material; if (T[team || 'atk']) m.map = T[team || 'atk']; if (m.color) m.color.setRGB(1, 1, 1); if (m.emissive) m.emissive.setRGB(0, 0, 0); solid(m); m.roughness = .9; m.metalness = 0; m.needsUpdate = true; o.castShadow = true; o.receiveShadow = true; });
    try { if (typeof artCharShade === 'function') artCharShade({ model: root, root: new THREE.Group() }); } catch (e) { console.warn('[paper] dressSelf shade', e); } };
  U.paperTeam = (r, f) => paperTeam(r, f);
  function paperTeam(r, force) {
    const t = r.mxTeam === 'def' ? 'def' : r.mxTeam === 'atk' ? 'atk' : (r._team0 || 'def'), T = U.charTex[r.paperChar];
    if (!force && r._pt === t) return; r._pt = t; if (!r.body) return;
    if (T && T[t]) r.body.map = T[t]; r.body.color.setRGB(1, 1, 1); r.body.roughness = .9; r.body.metalness = 0; r.body.needsUpdate = false;
  }
  // counter (the tests require 0): a visible Sector Nine CHARACTER model (any skinned body that is not a paper soldier) while you are
  // dying, in the death cam or in the killcam replay. Same idea as s9tpCalls for Sector Nine weapon models.
  setInterval(() => { try { const kc = document.getElementById('killcam'); if (state !== 'dead' && !(kc && !kc.hidden)) return;
    scene.traverse(o => { if (!o.isSkinnedMesh || /gmRim/.test(o.name)) return; let q = o; while (q) { if (!q.visible) return; q = q.parent; } q = o; while (q) { if (q.userData && q.userData.paperModel) return; q = q.parent; }
      U.s9charSeen = (U.s9charSeen || 0) + 1; U.s9charLast = o.name + '|' + (o.material && o.material.name); }); } catch (e) {} }, 300);
  setInterval(() => { try { const w = $('pWalk'); if (w) w.style.display = state === 'play' && P.walk ? 'block' : 'none'; } catch (e) {} }, 100);   // quiet-walk indicator
  setInterval(() => { try { const h = $('pHint'); if (h && state !== 'play' && h.classList.contains('on')) h.classList.remove('on'); } catch (e) {} }, 200);   // hints never sit on the death / end screens
  setInterval(() => { try { for (const r of robots) if (r.paperChar) { paperTeam(r); if (r.body && (r.body.color.r !== 1 || r.body.color.b !== 1)) r.body.color.setRGB(1, 1, 1); } } catch (e) {} }, 250);

  U.assetsP = dataP.then(() => loadTPGuns()).catch(e => console.warn('tp guns', e)).then(() => loadChars()).catch(e => console.warn('chars', e)).then(() => loadGuns()).catch(e => console.warn('guns', e)).then(() => { buildMenu(); U.ready = true; window.dispatchEvent(new Event('paper:ready')); });
})();
