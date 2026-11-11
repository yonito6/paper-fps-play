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
    { id: 'crane', name: 'Crane', line: 'Light on her feet, first through every window.', color: '#2f4fb0', svg: '<path d="M8 44 L30 30 L52 6 L40 32 L56 40 L30 40 L20 56 L24 40Z"/>' },
    { id: 'boxer', name: 'Boxer', line: 'A cardboard box with a cardboard grudge.', color: '#2f4fb0', svg: '<path d="M14 18 L32 10 L50 18 L50 42 L32 52 L14 42Z M14 18 L32 26 L50 18 M32 26 L32 52" stroke="#fff" stroke-width="2"/>' },
    { id: 'frog', name: 'Frog', line: 'Jumps first, folds the questions later.', color: '#2f4fb0', svg: '<path d="M8 40 Q14 18 32 20 Q50 18 56 40 L44 36 L32 44 L20 36Z"/><circle cx="22" cy="20" r="6" fill="#fff"/><circle cx="42" cy="20" r="6" fill="#fff"/>' },
    { id: 'fox', name: 'Fox', line: 'Patient. Pointy. Never misses twice.', color: '#2f4fb0', svg: '<path d="M10 10 L26 26 L38 26 L54 10 L50 34 L32 54 L14 34Z"/><path d="M24 34 L30 36 M40 34 L34 36" stroke="#fff" stroke-width="3"/>' },
  ];
  U.chars = CHARS0;

  /* ---------------- data ---------------- */
  const getJSON = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const dataP = Promise.all([getJSON('data/game.json'), getJSON('data/paper_weapons.json'), getJSON('data/paper/chars.json')]).then(([g, w, ch]) => {
    U.game = g || { title: 'Foldiers', short: 'Foldiers' };
    document.title = U.game.title;
    if (w && w.weapons) for (const id in w.weapons) if (WEAPONS[id]) { Object.assign(WEAPONS[id], w.weapons[id]); WEAPONS[id].label = WEAPONS[id].name + ' · ' + WEAPONS[id].cls.toLowerCase(); }
    U.weaponData = w;
    if (ch) { const list = Array.isArray(ch) ? ch : ch.chars || ch.characters; if (Array.isArray(list) && list.length) U.chars = list.slice(0, 4).map((c, i) => Object.assign({}, CHARS0[i] || {}, { id: c.id || CHARS0[i].id, name: c.name || c.id, line: c.line || c.tagline || c.desc || c.personality || (CHARS0[i] || {}).line, img: c.icon || c.card || c.preview || null })); }
    if (!U.chars.some(c => c.id === U.char)) U.char = U.chars[0].id;
  });

  /* ---------------- paper textures as CSS backgrounds (drawn by the game's PAPER kit) ---------------- */
  const url = t => { try { return `url(${t.userData.canvas.toDataURL('image/jpeg', .85)})`; } catch (e) { return 'none'; } };
  const BG = { kraft: url(PAPER.tex.fibre('kraft')), cream: url(PAPER.tex.fibre('cream')), blue: url(PAPER.tex.fibre('blue')), red: url(PAPER.tex.fibre('red')), corr: url(PAPER.tex.corr()), white: url(PAPER.tex.fibre('white')) };
  // torn edge polygons (jagged, fixed seed so they never flicker)
  const torn = (side, n = 28, amp = 1.6) => { let s = 7 + side.length; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const pts = [];
    if (side === 'right') { pts.push('0 0'); for (let i = 0; i <= n; i++) pts.push(`${100 - r() * amp}% ${(i / n * 100).toFixed(2)}%`); pts.push('0 100%'); }
    else { pts.push('100% 0'); for (let i = 0; i <= n; i++) pts.push(`${(r() * amp).toFixed(2)}% ${(i / n * 100).toFixed(2)}%`); pts.push('100% 100%'); }
    return `polygon(${pts.join(',')})`; };
  const tornBox = (k = 1) => { let s = 11 * k; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, P = [], n = 22;
    for (let i = 0; i <= n; i++) P.push(`${(i / n * 100).toFixed(1)}% ${(r() * 1.2).toFixed(2)}%`); for (let i = 0; i <= n; i++) P.push(`${(100 - r() * .8).toFixed(2)}% ${(i / n * 100).toFixed(1)}%`);
    for (let i = n; i >= 0; i--) P.push(`${(i / n * 100).toFixed(1)}% ${(100 - r() * 1.2).toFixed(2)}%`); for (let i = n; i >= 0; i--) P.push(`${(r() * .8).toFixed(2)}% ${(i / n * 100).toFixed(1)}%`); return `polygon(${P.join(',')})`; };

  /* ---------------- styles ---------------- */
  const fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800;900&display=swap'; document.head.appendChild(fl);
  const st = document.createElement('style'); st.id = 'paperStyle';
  st.textContent = `
:root{--pblue:#2f4fb0;--pred:#c0392b;--pkraft:#c89d68;--pcream:#efe5cf;--pink:#2b2420;--pf:'Lilita One','Arial Black',system-ui,sans-serif;--pt:'Nunito',system-ui,sans-serif}
/* ---- HUD (match the reference shots) ---- */
#hud #compass,#hud .corner.tl,#hud .corner.tr>.label,#hud #hScore,#hud #matchbar,#hud #abil,#hud #pips,#hud #hWeapon,#hud .corner.bl>.label,#hud #hpsegs,#hud #combo,#hud #combobar{display:none!important}
#hud .corner.bl{left:22px;bottom:18px}
#hud #hHp{font-family:var(--pf);font-size:44px;line-height:1;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 12px rgba(0,0,0,.25);display:flex;align-items:center;gap:12px}
#hud #hHp::before{content:'';width:30px;height:30px;background:linear-gradient(#fff,#fff) center/30% 100% no-repeat,linear-gradient(#fff,#fff) center/100% 30% no-repeat;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
#pHpBar{margin-top:8px;width:290px;height:9px;background:rgba(0,0,0,.28);clip-path:polygon(0 0,100% 0,97% 100%,0 100%)}#pHpBar i{display:block;height:100%;background:#fff;transform-origin:left;transition:transform .15s}#pHpBar.low i{background:#ff6b5b}
#hud .corner.br{right:24px;bottom:18px;display:flex;align-items:center;gap:14px}
#pGun{display:flex;align-items:center;height:38px;padding-right:16px;border-right:2px solid rgba(255,255,255,.85);color:#fff;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}#pGun svg{height:26px;width:auto}#pGun img{height:34px;width:auto}
#hud #hAmmo{font-family:var(--pf);font-size:40px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35);letter-spacing:.02em}#hud #hAmmo small{font-size:24px;opacity:.95;margin-left:2px}
#mxHud{top:14px!important;gap:0!important}
#mxHud .sc{font-family:var(--pf)!important;font-size:34px!important;min-width:96px;padding:2px 22px!important;color:#fff!important;text-shadow:0 2px 0 rgba(0,0,0,.25)!important;border:0!important;border-radius:0!important;box-shadow:0 3px 0 rgba(0,0,0,.22)!important}
#mxHud .sc.atk{background:${BG.blue},var(--pblue)!important;background-blend-mode:multiply!important;clip-path:polygon(8% 0,100% 0,100% 100%,0 100%)}
#mxHud .sc.def{background:${BG.red},var(--pred)!important;background-blend-mode:multiply!important;clip-path:polygon(0 0,100% 0,92% 100%,0 100%)}
#mxHud .mid{margin:0 10px!important}#mxHud .mid .clk{font-family:var(--pf)!important;color:#fff!important;text-shadow:0 2px 0 rgba(0,0,0,.4)!important}#mxHud .mid .rd{font-family:var(--pt)!important;font-weight:900!important;color:#fff!important;text-shadow:0 1px 0 rgba(0,0,0,.5)!important}
#xh i{background:#fff!important;box-shadow:0 0 0 1px rgba(0,0,0,.35)!important}#xh .c{display:none}
#kfeed>*{font-family:var(--pt)!important;font-weight:800!important;background:${BG.cream},var(--pcream)!important;color:var(--pink)!important;border-radius:2px!important;box-shadow:0 2px 0 rgba(0,0,0,.18)!important}
#callout{font-family:var(--pf)!important;color:#fff!important;text-shadow:0 3px 0 rgba(0,0,0,.35),0 0 18px rgba(0,0,0,.25)!important;letter-spacing:.03em!important}
#banner .huge,#death .huge{font-family:var(--pf)!important;color:#fff!important;text-shadow:0 4px 0 rgba(0,0,0,.3)!important}
#pPlane{position:absolute;right:26px;bottom:76px;display:flex;align-items:center;gap:8px;font:900 15px var(--pt);color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.5)}#pPlane kbd{font:inherit;background:#fff;color:var(--pink);padding:1px 7px;border-radius:3px}#pPlane svg{width:34px;height:20px}#pPlane.empty{opacity:.4}
#pTip{position:absolute;left:50%;top:calc(50% + 70px);transform:translateX(-50%);font:900 20px var(--pt);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5);white-space:nowrap;display:none}#pTip kbd{font:inherit;background:#fff;color:var(--pink);padding:1px 9px;border-radius:4px;margin:0 6px}
#pPip{position:absolute;right:24px;top:84px;width:300px;height:170px;border:4px solid #fff;box-shadow:0 4px 0 rgba(0,0,0,.25);display:none;pointer-events:none}#pPip b{position:absolute;left:8px;top:6px;font:900 13px var(--pt);color:#fff;text-shadow:0 1px 2px #000}
/* ---- loading + overlays ---- */
#mapload{background:${BG.kraft},#b88a55!important;background-blend-mode:multiply!important}#mapload b{font-family:var(--pf)!important;color:#fff!important;text-shadow:0 4px 0 rgba(0,0,0,.25)}#mapload span{font-family:var(--pt)!important;font-weight:800;color:var(--pink)!important}
#loading{background:${BG.kraft},#b88a55!important;background-blend-mode:multiply;font-family:var(--pf)!important;color:#fff!important;text-shadow:0 3px 0 rgba(0,0,0,.25)}
#pause .sheet,#mend .sheet{background:${BG.cream},var(--pcream)!important;color:var(--pink)!important;clip-path:${tornBox(3)};box-shadow:none!important;border:0!important}
#pause .sheet *,#mend .sheet *{color:var(--pink)}#pause h2,#mend h2{font-family:var(--pf)!important;color:var(--pblue)!important}
#pause .go,#mend .go{background:var(--pblue)!important;color:#fff!important;font-family:var(--pf)!important;border:0!important}#pause .ghost,#mend .ghost{font-family:var(--pt)!important;font-weight:900!important;border:2px solid var(--pink)!important;color:var(--pink)!important;background:transparent!important}
/* ---- the menu ---- */
#menu>.sheet{display:none!important}
#menu{background:linear-gradient(90deg,rgba(40,28,16,.55),rgba(40,28,16,.08) 55%,rgba(0,0,0,0))!important}
#pmenu{position:absolute;inset:0;display:flex;align-items:stretch;font-family:var(--pt);color:var(--pink);overflow:auto}
#pmenu .card{position:relative;margin:26px 0 26px 34px;width:min(560px,calc(100vw - 40px));padding:30px 34px 28px;background:${BG.kraft},var(--pkraft);background-blend-mode:multiply;clip-path:${tornBox(1)};filter:drop-shadow(0 10px 18px rgba(0,0,0,.35));align-self:center}
#pmenu h1{margin:0;font:400 64px/0.95 var(--pf);color:#fff;letter-spacing:.01em;text-shadow:0 4px 0 #8a5d2c,0 8px 14px rgba(0,0,0,.25);transform:rotate(-2deg)}
#pmenu h1.logo{display:flex;flex-wrap:wrap;gap:3px;position:relative;margin:18px 0 0;transform:none;text-shadow:none}
#pmenu h1.logo .helmet{position:absolute;left:-6px;top:-20px;width:58px;transform:rotate(-14deg);filter:drop-shadow(0 3px 0 rgba(0,0,0,.25));z-index:2}
#pmenu .lt{display:inline-flex;align-items:center;justify-content:center;width:56px;height:66px;transform:rotate(var(--rot));filter:drop-shadow(0 4px 0 rgba(0,0,0,.25));clip-path:polygon(0 0,82% 0,100% 18%,100% 100%,0 100%)}
#pmenu .lt.b{background:linear-gradient(135deg,#3c5fc7 0 50%,#2a479f 50% 100%)}#pmenu .lt.r{background:linear-gradient(135deg,#d24a3b 0 50%,#ad3226 50% 100%)}
#pmenu .lt i{font:400 50px/1 var(--pf);font-style:normal;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25)}
@media (max-width:700px){#pmenu .lt{width:38px;height:46px}#pmenu .lt i{font-size:34px}}
#pmenu h1 em{display:block;font:900 14px var(--pt);color:var(--pink);opacity:.75;letter-spacing:.14em;text-transform:uppercase;text-shadow:none;margin-top:6px;font-style:normal}
#pmenu .tag{margin:12px 0 18px;font-weight:900;font-size:16px}
#pmenu .lab{font:900 12px var(--pt);letter-spacing:.16em;text-transform:uppercase;opacity:.8;margin:14px 0 8px}
#pmenu .chars{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
#pmenu .ch{position:relative;cursor:pointer;border:0;padding:10px 6px 10px;background:${BG.cream},var(--pcream);background-blend-mode:multiply;font:inherit;color:inherit;text-align:center;clip-path:polygon(0 0,86% 0,100% 14%,100% 100%,0 100%);transition:transform .18s,filter .18s;filter:drop-shadow(0 3px 0 rgba(0,0,0,.18))}
#pmenu .ch::after{content:'';position:absolute;right:0;top:0;width:14%;height:14%;background:linear-gradient(225deg,transparent 50%,rgba(0,0,0,.18) 50%)}
#pmenu .ch:hover{transform:translateY(-3px) rotate(-1deg)}#pmenu .ch[aria-checked=true]{background:${BG.blue},var(--pblue);color:#fff;transform:translateY(-4px)}
#pmenu .ch svg{width:54px;height:54px;fill:var(--pblue)}#pmenu .ch[aria-checked=true] svg{fill:#fff}#pmenu .ch img{width:64px;height:64px;object-fit:contain}
#pmenu .ch b{display:block;font:400 19px var(--pf);margin-top:4px}#pmenu .ch span{display:block;font-size:11px;line-height:1.25;font-weight:700;margin-top:3px;min-height:28px;opacity:.85}
#pmenu .chips{display:flex;gap:8px}#pmenu .chip{cursor:pointer;border:2px solid var(--pink);background:transparent;color:var(--pink);font:900 13px var(--pt);padding:6px 14px;border-radius:3px}#pmenu .chip[aria-checked=true]{background:var(--pink);color:var(--pcream)}
#pmenu .play{margin-top:22px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
#pmenu .go{cursor:pointer;border:0;padding:16px 34px 14px;font:400 30px var(--pf);color:#fff;background:${BG.blue},var(--pblue);background-blend-mode:multiply;clip-path:polygon(0 0,93% 0,100% 22%,100% 100%,4% 100%,0 80%);filter:drop-shadow(0 5px 0 #1d3280);transition:transform .15s}#pmenu .go:hover{transform:translateY(-2px) scale(1.02)}#pmenu .go:active{transform:translateY(2px)}
#pmenu .sm{cursor:pointer;border:0;background:${BG.cream},var(--pcream);font:900 14px var(--pt);color:var(--pink);padding:10px 16px;clip-path:polygon(0 0,100% 0,96% 100%,3% 100%)}
#pmenu .mode{font-weight:800;font-size:13px;opacity:.85;margin-top:10px}
#pkeys{display:none;margin-top:14px;padding:12px 14px;background:${BG.cream},var(--pcream);font-size:13px;font-weight:700;columns:2;column-gap:20px}#pkeys.on{display:block}#pkeys div{break-inside:avoid;margin:2px 0}#pkeys kbd{font:900 11px var(--pt);background:var(--pink);color:#fff;padding:1px 6px;border-radius:3px;margin-right:6px}
#psetwrap{display:none;margin-top:14px}#psetwrap.on{display:block}
@media (max-width:700px){#pmenu .card{margin:12px auto;padding:20px 16px}#pmenu h1{font-size:46px}#pmenu .chars{grid-template-columns:repeat(2,1fr)}}
/* ---- paper wipe ---- */
#pwipe{position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden}
#pwipe .s{position:absolute;top:-2%;bottom:-2%;width:56%;background:${BG.kraft},#c39258;background-blend-mode:multiply;transition:transform .38s cubic-bezier(.7,0,.3,1);filter:drop-shadow(0 0 14px rgba(0,0,0,.4))}
#pwipe .s.l{left:0;transform:translateX(-104%) rotate(-2deg);clip-path:${torn('right')}}#pwipe .s.r{right:0;transform:translateX(104%) rotate(2deg);clip-path:${torn('left')}}
#pwipe.on .s.l{transform:translateX(0) rotate(0)}#pwipe.on .s.r{transform:translateX(0) rotate(0)}
#pwipe .t{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.8);font:400 48px var(--pf);color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25);opacity:0;transition:opacity .2s,transform .3s;white-space:nowrap}#pwipe.on .t{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media (prefers-reduced-motion:reduce){#pwipe .s{transition-duration:.01s}}
`;
  document.head.appendChild(st);

  /* ---------------- HUD extras ---------------- */
  const hud = $('hud');
  { const bl = hud.querySelector('.corner.bl'); const bar = document.createElement('div'); bar.id = 'pHpBar'; bar.innerHTML = '<i></i>'; bl.appendChild(bar);
    const br = hud.querySelector('.corner.br'); const g = document.createElement('div'); g.id = 'pGun'; br.insertBefore(g, $('hAmmo'));
    const pl = document.createElement('div'); pl.id = 'pPlane'; pl.innerHTML = '<kbd>G</kbd><svg viewBox="0 0 40 22"><path d="M1 11 L39 1 L22 21 L18 13Z" fill="#fff"/><path d="M18 13 L39 1" stroke="#c0392b" stroke-width="1.5"/></svg><span id="pPlaneN">×2</span>'; hud.appendChild(pl);
    const tip = document.createElement('div'); tip.id = 'pTip'; hud.appendChild(tip);
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
  const wp = document.createElement('div'); wp.id = 'pwipe'; wp.innerHTML = '<div class="s l"></div><div class="s r"></div><div class="t"></div>'; document.body.appendChild(wp);
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

  /* ---------------- menu ---------------- */
  // the wordmark: every letter is a folded paper tile (a diagonal crease: one half lit, one in shade), blue and red alternating
  // like the two teams, with a little origami soldier's helmet perched on the first letter
  function logoHTML(t) {
    const L = [...String(t).toUpperCase()];
    return `<svg class="helmet" viewBox="0 0 64 34" aria-hidden="true"><path d="M4 30 L14 8 L32 2 L50 8 L60 30Z" fill="#2f4fb0"/><path d="M14 8 L32 2 L32 30 L4 30Z" fill="#3c5fc7"/><path d="M32 2 L50 8 L60 30 L32 30Z" fill="#24408f"/><path d="M0 30 H64 V34 H0Z" fill="#1d3280"/></svg>` +
      L.map((c, i) => `<span class="lt ${i % 2 ? 'r' : 'b'}" style="--rot:${((i * 37) % 9 - 4) * .9}deg"><i>${esc(c)}</i></span>`).join('');
  }
  function menuHTML() {
    const g = U.game || {}, title = String(g.short || g.title || 'Foldiers').replace(/\s*\(.*\)\s*$/, '');
    return `<div class="card" role="dialog" aria-label="Main menu">
      <h1 class="logo" aria-label="${esc(title)}">${logoHTML(title)}</h1>
      <div class="tag">${esc(g.tagline || 'Tear the map. Catch the plane. Fold the other team.')}</div>
      <div class="lab">Choose your fighter</div>
      <div class="chars" role="radiogroup" aria-label="Character">${U.chars.map(c => `<button type="button" class="ch" role="radio" data-ch="${esc(c.id)}" aria-checked="${c.id === U.char}">${c.img ? `<img src="${esc(c.img)}" alt="">` : `<svg viewBox="0 0 64 64">${c.svg || ''}</svg>`}<b>${esc(c.name)}</b><span>${esc(c.line || '')}</span></button>`).join('')}</div>
      <div class="lab">Bots</div>
      <div class="chips" role="radiogroup" aria-label="Bot difficulty">${['easy', 'normal', 'hard'].map(d => `<button type="button" class="chip" role="radio" data-df="${d}" aria-checked="${d === U.diff}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
      <div class="mode">Team Deathmatch · Blue (you + 3 bots) vs Red (4 bots) · first to 30 kills or 8 minutes · Desk Town</div>
      <div class="play"><button type="button" class="go" id="pPlay">Play vs Bots</button><button type="button" class="sm" id="pKeysB">Controls</button><button type="button" class="sm" id="pSetB">Settings</button></div>
      <div id="pkeys">${[['WASD', 'Move'], ['Mouse', 'Look'], ['Left click', 'Fire'], ['Right click', 'Aim'], ['1-5', 'Rifle · Shotgun · Sniper · SMG · Boomerang'], ['R', 'Reload'], ['Shift', 'Sprint'], ['Space', 'Jump (twice: double jump)'], ['C', 'Crouch / slide'], ['E', 'Dash'], ['V', 'Paper cutter (melee)'], ['G', 'Paper plane: hold to aim, let go to throw, then steer with the mouse'], ['F', 'Catch a plane flying at you'], ['Tab', 'Scores']].map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('')}<div style="margin-top:6px">Shoot thin cardboard to tear holes you can see and shoot through. Shoot along a dashed crease to tear a flap open.</div></div>
      <div id="psetwrap"></div>
    </div>`;
  }
  function buildMenu() {
    let m = $('pmenu'); if (!m) { m = document.createElement('div'); m.id = 'pmenu'; $('menu').appendChild(m); }
    m.innerHTML = menuHTML();
    m.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      try { if (typeof sfx !== 'undefined' && sfx.equip) sfx.equip(); } catch (x) {}
      if (b.dataset.ch) { U.char = b.dataset.ch; save(); m.querySelectorAll('[data-ch]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.ch === U.char))); }
      else if (b.dataset.df) { U.diff = b.dataset.df; save(); m.querySelectorAll('[data-df]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.df === U.diff))); }
      else if (b.id === 'pPlay') U.playBots();
      else if (b.id === 'pKeysB') $('pkeys').classList.toggle('on');
      else if (b.id === 'pSetB') { const w = $('psetwrap'), s = $('setMenu'); if (s && !w.contains(s)) w.appendChild(s); w.classList.toggle('on'); }
    });
  }
  U.playBots = async () => {
    if (U.starting) return; U.starting = true;
    try {
      const BM = window.S9BotModes; if (BM) { if (BM.loading) await BM.loading; Object.assign(BM.cfg, { mode: 'tdm', size: 4, diff: U.diff }); BM.startOpts = { team: 'atk' }; }
      await U.wipe(async () => { try { initAudio(); } catch (e) {} try { lock(); } catch (e) {} await startMatch('desktown'); setState('play'); }, 'DESK TOWN');
    } finally { U.starting = false; }
  };
  // Enter on the menu = Play vs Bots (the core's Enter handler calls play(); route it here)
  const _play = typeof play === 'function' ? play : null;
  if (_play) play = async function () { if (state === 'menu') return U.playBots(); return _play.apply(this, arguments); };

  /* ---------------- match start: holes reset, always blue, planes refilled ---------------- */
  const _startMatch = startMatch;
  startMatch = async function () {
    const r = await _startMatch.apply(this, arguments);
    try { TEAR.reset(); PFX.clear(); PLANES.reset(); PAPER_MARKS.clear(); PAPER_DEATHS.warm(); } catch (e) {}
    return r;
  };

  dataP.then(() => { buildMenu(); U.ready = true; window.dispatchEvent(new Event('paper:ready')); });
})();
