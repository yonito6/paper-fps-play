/* Foldiers PROGRESSION (modules/progress.js, needs modules/progresscore.js): player level, XP, Clips (paper clips), daily challenges, unlocks.
   Design: docs/PROGRESSION.md. All the math is in progresscore.js (the server runs the same file).
   - Guests: progress is kept in this browser (localStorage 'foldiers-progress'): honest, NOT tamper-proof, and Clips of a guest can never be spent in a future shop.
   - Signed-in players (modules/account.js): after a match the raw facts are sent to POST /api/fold/credit; the SERVER recomputes XP and Clips
     (server/foldiers_progress.js) and the screen shows the server's answer. If that endpoint is not there yet, the match is booked locally and marked "not saved to account".
   UI (paper): menu card with a folded-ribbon level badge + paper XP strip + "Clips" count; Progress panel (daily challenges, unlocks, equip);
   end-of-match breakdown (XP + Clips line by line) in #mend; level-up paper animation. No gameplay power in any unlock.
   Test API: window.FOLD_PROGRESS = { ready, view(), state(), creditLine(line), openPanel(), closePanel(), reset(), ribbon(level, prestige), lastResult } */
(() => {
  'use strict';
  const P = window.FOLD_PROG; if (!P || window.FOLD_PROGRESS) return;
  const $ = id => document.getElementById(id);
  const KEY = 'foldiers-progress';
  const ls = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} } };
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const c of kids.flat()) if (c != null && c !== false) e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    return e;
  };
  const html = (tag, cls, h) => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = h; return e; };   // h is ONLY ever built from numbers and fixed strings in this file
  const fmt = n => Math.round(n).toLocaleString('en-US');

  /* ---------------- state ---------------- */
  let S = Object.assign(P.newState(), { equip: {}, acct: null, unsynced: 0 }, ls.get() || {});
  S.equip = S.equip && typeof S.equip === 'object' ? S.equip : {};
  const save = () => ls.set(S);
  const acct = () => (window.S9Account && window.S9Account.token && window.S9Account.token()) ? window.S9Account : null;
  // what the screens show: the server's numbers for a signed-in player, the local ones for a guest
  function view() {
    const A = acct(), m = A && S.acct && S.acct.id === (A.profile() || {}).id ? S.acct.me : null;
    const src = m ? { xp: m.xp, clips: m.clips, clipsTotal: m.clipsTotal, matches: m.matches, wins: m.wins, equip: m.equip || {}, daily: m.daily } : null;
    const today = P.utcDay(), dayDone = S.day === today ? S.dayDone : [];
    const v = src || { xp: S.xp, clips: S.clips, clipsTotal: S.clipsTotal, matches: S.matches, wins: S.wins, equip: S.equip, daily: { day: today, plays: S.day === today ? S.dayPlays : 0, challenges: P.dailyChallenges(today).map(c => Object.assign({ done: dayDone.includes(c.id) }, c)) } };
    const li = P.levelInfo(v.xp);
    return Object.assign({ li, level: li.level, prestige: li.prestige, signedIn: !!m, nick: (A && A.profile() && A.profile().nick) || (S.nick || 'Folder') }, v);
  }

  /* ---------------- art: folded-ribbon level badge, paper clip ---------------- */
  const PAPER = [['#efe3cb', '#cdbd9a', '#3a2a18'], ['#c99f66', '#9c7340', '#2b1c0e'], ['#2c55bd', '#173783', '#fff3da'], ['#bf2a20', '#7a0f0a', '#fff3da'], ['#2f8a56', '#1c5a37', '#fff3da'],
    ['#e6bd36', '#a8821a', '#3a2a18'], ['#f6f1e2', '#b9b39c', '#173783'], ['#dcebd5', '#8fae86', '#2b4a2a'], ['#c9d3da', '#8895a0', '#22313c'], ['#e0b13a', '#9a6d12', '#3a2208']];
  let rid = 0;
  function ribbon(level, prestige, px) {
    const t = P.tierOf(level), [face, fold, ink] = PAPER[t], id = 'fpr' + (++rid), size = px || 64, num = String(level), fs = num.length > 2 ? 21 : 27;
    const stars = prestige ? `<text x="32" y="11" text-anchor="middle" font-size="9" fill="#e0b13a" stroke="#3a2208" stroke-width=".5" font-family="sans-serif">${'\u2605'.repeat(Math.min(3, prestige))}${prestige > 3 ? '+' : ''}</text>` : '';
    const lines = t === 6 ? '<g stroke="#2c55bd" stroke-width=".6" opacity=".55"><path d="M12 22H52M12 28H52M12 34H52M12 40H52"/></g>' : t === 7 ? '<g stroke="#5f8a5a" stroke-width=".5" opacity=".6"><path d="M12 22H52M12 28H52M12 34H52M12 40H52M20 17V46M28 17V46M36 17V46M44 17V46"/></g>' : '';
    return `<svg class="fp-rib" viewBox="0 0 64 70" width="${size}" height="${Math.round(size * 70 / 64)}" role="img" aria-label="Level ${level}">`
      + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${face}"/><stop offset="1" stop-color="${face}" stop-opacity=".86"/></linearGradient></defs>`
      + `<path d="M14 40 L9 66 L22 60 L28 68 L31 42 Z" fill="${fold}"/><path d="M50 40 L55 66 L42 60 L36 68 L33 42 Z" fill="${fold}"/>`      // tails
      + `<path d="M22 60 L28 68 L31 56 Z M42 60 L36 68 L33 56 Z" fill="#000" opacity=".22"/>`                                                       // the folds
      + `<path d="M8 16 Q8 12 12 12 H52 Q56 12 56 16 V42 Q56 46 52 46 H12 Q8 46 8 42 Z" fill="url(#${id})" stroke="#2b1c0e" stroke-width="1.6" stroke-linejoin="round"/>`
      + `<path d="M8 16 Q8 12 12 12 H52 Q56 12 56 16 V20 H8 Z" fill="#fff" opacity=".16"/><path d="M8 40 H56 V42 Q56 46 52 46 H12 Q8 46 8 42 Z" fill="#000" opacity=".12"/>${lines}`
      + `<path d="M50 12 L56 12 L56 18 Z" fill="${fold}" stroke="#2b1c0e" stroke-width="1"/>`                                                        // dog-eared corner
      + `<text x="32" y="${num.length > 2 ? 36 : 38}" text-anchor="middle" font-size="${fs}" font-weight="900" font-style="italic" fill="${ink}" font-family="Changa One,Arial Black,sans-serif">${num}</text>${stars}</svg>`;
  }
  const CLIP = (s) => `<svg class="fp-clip" viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" aria-hidden="true"><path d="M8 13.5V6.2a4 4 0 0 1 8 0v11.3a2.6 2.6 0 0 1-5.2 0V7.4" fill="none" stroke="#0b3f9a" stroke-width="2.2" stroke-linecap="round"/><path d="M8 13.5V6.2a4 4 0 0 1 8 0v11.3a2.6 2.6 0 0 1-5.2 0V7.4" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".7" stroke-linecap="round" transform="translate(-.5 -.6)"/><circle cx="13.4" cy="20.6" r="1.1" fill="#b11912"/></svg>`;
  const strip = (frac, cls) => `<div class="fp-strip ${cls || ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}"><i style="transform:scaleX(${Math.max(0, Math.min(1, frac))})"></i></div>`;

  /* ---------------- styles ---------------- */
  const css = `
.fp-rib{display:block;filter:drop-shadow(0 2px 0 rgba(43,28,14,.35))}
.fp-clip{vertical-align:-3px}
.fp-strip{position:relative;height:13px;background:rgba(43,28,14,.28);border:2px solid #2b1c0e;border-radius:3px;overflow:hidden;transform:rotate(-.4deg)}
.fp-strip i{position:absolute;inset:0;transform-origin:left center;background:repeating-linear-gradient(90deg,rgba(255,255,255,.0) 0 17px,rgba(255,255,255,.24) 17px 18px,rgba(0,0,0,.18) 18px 19px),var(--tx-blue) 0 0/200px,#0b3f9a;transition:transform .9s cubic-bezier(.2,.8,.2,1);border-right:2px solid #7a9bf0}
.fp-strip.big{height:20px}
#fpCard{position:fixed;left:calc(24px + env(safe-area-inset-left,0px));top:calc(22px + env(safe-area-inset-top,0px));z-index:58;display:flex;gap:10px;align-items:center;cursor:pointer;padding:10px 16px 10px 12px;font:700 14px/1.1 var(--mono);color:#22150c;background:none;border:0;text-align:left;--face:var(--face-cream);transform:rotate(-1.2deg)}
#fpCard[hidden]{display:none}
#fpCard:hover{transform:rotate(-.4deg) translateY(-1px)}#fpCard:focus-visible{outline:3px solid #0b3f9a;outline-offset:6px}
#fpCard .in{display:grid;gap:5px;min-width:128px}#fpCard .nm{font:400 19px/1 var(--display);font-style:italic;letter-spacing:.02em;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fpCard .sub{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:#4e3420;white-space:nowrap}#fpCard .sub b{color:#0b3f9a}
@media (max-width:600px){#fpCard{top:auto;left:18px;bottom:calc(16px + env(safe-area-inset-bottom,0px));padding:8px 12px 8px 8px}#fpCard .nm{font-size:16px}}
#fpLinks{position:fixed;right:calc(26px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:58;display:flex;gap:16px;align-items:center}
#fpLinks[hidden]{display:none}
.fp-link{--face:var(--face-cream);font:800 14px/1 var(--mono);color:#22150c;background:none;border:0;padding:9px 14px;cursor:pointer;transform:rotate(.8deg);letter-spacing:.03em}
.fp-link:hover{transform:rotate(0) translateY(-1px)}.fp-link:focus-visible{outline:3px solid #0b3f9a;outline-offset:5px}
.fp-dot{font:800 9px/1 var(--mono);font-style:normal;margin-left:7px;padding:3px 5px;background:#b11912;color:#fff3da;border-radius:2px;vertical-align:1px}
@media (max-width:600px){#fpLinks{right:auto;left:16px;bottom:auto;top:calc(16px + env(safe-area-inset-top,0px));gap:8px}.fp-link{font-size:12px;padding:6px 10px}}
#fpPanel{position:fixed;inset:0;z-index:72;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at center,rgba(42,26,12,.45),rgba(30,18,8,.74));overflow:auto}
#fpPanel[hidden]{display:none}
#fpPanel .sheet{position:relative;width:min(760px,100%);max-height:calc(100vh - 50px);overflow:auto;padding:22px 26px 24px;--face:var(--face-kraft);font:600 15px/1.35 var(--mono);color:#22150c;display:grid;gap:14px}
#fpPanel h2{margin:0;font:400 34px/1 var(--display);font-style:italic}
#fpPanel .x{position:absolute;right:8px;top:6px;font:900 24px/1 var(--mono);background:none;border:0;color:#22150c;cursor:pointer;padding:6px 10px;z-index:2}
#fpPanel .head{display:flex;gap:16px;align-items:center}#fpPanel .head .t{display:grid;gap:6px;flex:1;min-width:0}
#fpPanel .nm{font:400 30px/1 var(--display);font-style:italic}#fpPanel .tt{color:#4e3420;font-size:14px}
#fpPanel .stats{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px}#fpPanel .stats b{font-size:18px;color:#0b3f9a}
#fpPanel h3{margin:2px 0 6px;font:800 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#4e3420}
#fpPanel .ch{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;margin:4px 0;background:rgba(255,250,238,.55);border:2px dashed rgba(43,28,14,.4);border-radius:3px}
#fpPanel .ch.done{background:rgba(120,190,130,.45);text-decoration:line-through;text-decoration-color:rgba(43,28,14,.45)}#fpPanel .ch span:last-child{white-space:nowrap;color:#0b3f9a}
#fpPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
#fpPanel .un{display:grid;gap:3px;text-align:left;padding:8px 10px;font:700 13px/1.2 var(--mono);color:#22150c;background:rgba(255,250,238,.6);border:2px solid rgba(43,28,14,.5);border-radius:3px;cursor:pointer}
#fpPanel .un small{font-weight:600;color:#4e3420;font-size:11px;letter-spacing:.05em;text-transform:uppercase}
#fpPanel .un.on{border-color:#0b3f9a;background:rgba(190,208,255,.7);box-shadow:0 0 0 2px #0b3f9a}
#fpPanel .un.lock{opacity:.5;cursor:default;filter:grayscale(.7)}
#fpPanel .note{font-size:12.5px;color:#4e3420}
#fpEnd{display:grid;gap:7px;width:100%;margin:6px 0 4px;padding:10px 16px;text-align:left;--face:var(--face-cream);font:700 15px/1.25 var(--mono);color:#22150c;box-sizing:border-box}
#fpEnd[hidden]{display:none}
#fpEnd .top{display:flex;gap:14px;align-items:center}#fpEnd .tt{flex:1;display:grid;gap:6px;min-width:0}
#fpEnd .lvl{display:flex;justify-content:space-between;font-size:13px;color:#4e3420}
#fpEnd .cols{display:grid;grid-template-columns:1fr 1fr;gap:4px 22px}
#fpEnd .col h4{margin:0 0 3px;font:800 13px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#4e3420}
#fpEnd .ln{display:flex;justify-content:space-between;gap:10px;font-size:14px;padding:1px 0;border-bottom:1px dashed rgba(43,28,14,.22);opacity:0;transform:translateY(5px);animation:fp-line .35s ease-out forwards}
#fpEnd .ln b{color:#0b3f9a}#fpEnd .tot{display:flex;justify-content:space-between;font:400 22px/1.1 var(--display);font-style:italic;padding-top:3px}#fpEnd .tot b{color:#0b3f9a}
#fpEnd .nsv{font-size:12px;color:#8a2217}
@keyframes fp-line{to{opacity:1;transform:none}}
#mend .row{position:sticky;bottom:-6px;z-index:4;padding:16px 0 6px;background:linear-gradient(rgba(198,155,98,0),rgba(198,155,98,.97) 38%)}
@media (max-width:520px){#fpEnd .cols{grid-template-columns:1fr}#fpEnd{padding:8px 10px}}
#fpLvl{position:fixed;inset:0;z-index:80;display:grid;place-items:center;pointer-events:none;overflow:hidden}
#fpLvl[hidden]{display:none}
#fpLvl .back{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,236,190,.35),rgba(30,18,8,.55));animation:fp-fade 4.4s ease-out forwards}
#fpLvl .card{opacity:1;position:relative;display:grid;justify-items:center;gap:2px;padding:10px 30px 18px;--face:var(--face-cream);transform-origin:50% 0;animation:fp-drop 4.4s cubic-bezier(.2,.9,.25,1) forwards}
#fpLvl .big{font:400 clamp(40px,8vw,70px)/1 var(--display);font-style:italic;color:#0b3f9a;text-shadow:3px 3px 0 #f8d0a4}
#fpLvl .rib{animation:fp-flip 4.4s cubic-bezier(.2,.9,.25,1) forwards}
#fpLvl .new{font:800 14px/1.2 var(--mono);color:#22150c;text-align:center;max-width:320px}
#fpLvl .bit{position:absolute;top:-20px;width:14px;height:10px;opacity:0;animation:fp-fall 2.8s linear forwards}
@keyframes fp-drop{0%{transform:translateY(-140%) rotate(-8deg) scaleY(.4);opacity:1}14%{transform:translateY(0) rotate(2deg) scaleY(1.06)}20%{transform:translateY(0) rotate(-1deg) scaleY(.98)}26%,86%{transform:none;opacity:1}100%{transform:translateY(-30px) scale(.9);opacity:0}}
@keyframes fp-flip{0%,10%{transform:perspective(500px) rotateX(90deg)}28%,100%{transform:perspective(500px) rotateX(0)}}
@keyframes fp-fade{0%{opacity:0}12%,80%{opacity:1}100%{opacity:0}}
@keyframes fp-fall{0%{opacity:0;transform:translateY(0) rotate(0)}8%{opacity:1}100%{opacity:1;transform:translateY(105vh) rotate(540deg)}}
@media (prefers-reduced-motion:reduce){#fpLvl .card,#fpLvl .rib,#fpLvl .back{animation-duration:.01s;animation-delay:2s}#fpEnd .ln{animation:none;opacity:1;transform:none}.fp-strip i{transition:none}}
/* crosshair styles (cosmetic unlocks): the HUD crosshair #xh gets class xh-<id> */
#xh.xh-dot i:not(.c){display:none}#xh.xh-dot .c{display:block!important;width:6px!important;height:6px!important;left:-3px!important;top:-3px!important;border-radius:50%;background:#fff!important}
#xh.xh-cross .u,#xh.xh-cross .d{height:13px;width:3px;left:-1.5px}#xh.xh-cross .l,#xh.xh-cross .r{width:13px;height:3px;top:-1.5px}
#xh.xh-ring i{display:none}#xh.xh-ring::before{content:"";position:absolute;left:-11px;top:-11px;width:16px;height:16px;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
#xh.xh-brackets i{display:none}#xh.xh-brackets::before{content:"";position:absolute;left:-14px;top:-14px;width:22px;height:22px;border:3px solid #fff;border-width:3px 0 3px 3px;border-radius:2px;clip-path:polygon(0 0,45% 0,45% 100%,0 100%)}#xh.xh-brackets::after{content:"";position:absolute;left:-1px;top:-14px;width:22px;height:22px;border:3px solid #fff;border-width:3px 3px 3px 0;border-radius:2px;clip-path:polygon(55% 0,100% 0,100% 100%,55% 100%)}
#xh.xh-chevron i{display:none}#xh.xh-chevron::before{content:"";position:absolute;left:-9px;top:-5px;width:14px;height:14px;border:3px solid #fff;border-width:3px 0 0 3px;transform:rotate(45deg);transform-origin:50% 50%;margin-top:3px}
#xh.xh-tick i:not(.c){display:none}#xh.xh-tick::before{content:"";position:absolute;left:-1.5px;top:-14px;width:3px;height:10px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4)}#xh.xh-tick::after{content:"";position:absolute;left:-14px;top:6px;width:28px;height:3px;background:#fff;opacity:.0}
#xh.xh-star i{display:none}#xh.xh-star::before{content:"\\2605";position:absolute;left:-10px;top:-14px;font:20px/1 sans-serif;color:#fff;text-shadow:0 0 2px #000}
`;
  const style = document.createElement('style'); style.id = 'fp-css'; style.textContent = css; document.head.appendChild(style);

  /* ---------------- crosshair + equip ---------------- */
  function applyCrosshair() {
    const xh = $('xh'); if (!xh) return; for (const c of [...xh.classList]) if (c.startsWith('xh-')) xh.classList.remove(c);
    const id = view().equip.crosshair; if (id && P.UNLOCKS.some(u => u.kind === 'crosshair' && u.id === id)) xh.classList.add('xh-' + id);
  }
  async function equip(slot, id) {
    const v = view(), it = P.UNLOCKS.find(u => u.kind === slot && u.id === id); if (!it || (it.lv > v.level && !v.prestige)) return false;
    const A = acct();
    if (A && v.signedIn) { try { const r = await A.api('/api/fold/equip', { method: 'PUT', body: { slot, id: v.equip[slot] === id ? null : id } }); S.acct = { id: A.profile().id, me: r.me }; save(); } catch (e) { return false; } }
    else { if (S.equip[slot] === id) delete S.equip[slot]; else S.equip[slot] = id; save(); }
    applyCrosshair(); render(); if (!$('fpPanel').hidden) renderPanel(); return true;
  }

  /* ---------------- match tracking ---------------- */
  const M = { t0: 0, started: false, multiT: -99, chain: 0, doubles: 0, triples: 0, quads: 0, credited: false, hs: 0 };
  function resetMatch() { Object.assign(M, { t0: 0, started: false, multiT: -99, chain: 0, doubles: 0, triples: 0, quads: 0, credited: false }); }
  const gt = () => (typeof G !== 'undefined' ? G.time : 0);
  if (typeof startMatch === 'function') { const _sm = startMatch; startMatch = function () { try { resetMatch(); } catch (e) {} return _sm.apply(this, arguments); }; }
  if (typeof killEntity === 'function') {
    const _ke = killEntity;
    killEntity = function (v, k) {
      const r = _ke.apply(this, arguments);
      try {
        if (typeof PLAYER_ENT !== 'undefined' && k === PLAYER_ENT && v !== k) {
          const t = gt(); M.chain = (t - M.multiT <= 4) ? M.chain + 1 : 1; M.multiT = t;
          if (M.chain === 2) M.doubles++; else if (M.chain === 3) { M.doubles--; M.triples++; } else if (M.chain >= 4) { if (M.chain === 4) M.triples--; else M.quads--; M.quads++; }
        }
      } catch (e) {}
      return r;
    };
  }
  function lineNow() {
    const me = PLAYER_ENT, title = ($('mendTitle') || {}).textContent || '', bm = window.S9BotModes;
    const win = /victor/i.test(title) || (!bm && typeof standings === 'function' && standings()[0] === me), draw = /draw/i.test(title);
    let mvp = false, obj = 0;
    try {
      const pl = bm && bm.M && bm.M.players ? [...bm.M.players.values()] : [];
      if (pl.length) { const best = pl.slice().sort((a, b) => (b.kills | 0) - (a.kills | 0) || (a.deaths | 0) - (b.deaths | 0))[0]; mvp = !!best && best.id === 'me' && !!win; }
      if (bm && bm.stats) obj = (bm.stats.plants || []).filter(p => p.id === 'me').length + (bm.stats.defuses || []).filter(p => p.id === 'me').length;
    } catch (e) {}
    const kills = me.kills | 0;
    return { kills, headshots: Math.min(kills, me.heads | 0), assists: 0, objectives: obj, win: !!win && !draw, draw, mvp, bestStreak: Math.min(G.bestStreak | 0, kills), seconds: Math.round(Math.max(0, gt() - M.t0)), multi: { double: M.doubles, triple: M.triples, quad: M.quads } };
  }

  /* ---------------- crediting ---------------- */
  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  async function creditLine(line) {
    const A = acct(), matchId = newId(), before = view();
    if (A) {
      try {
        const r = await A.api('/api/fold/credit', { method: 'POST', body: { matchId, line } });
        S.acct = { id: A.profile().id, me: r.me }; save();
        return finish(Object.assign({ where: 'account' }, r), before);
      } catch (e) { if (e && e.status && e.status !== 404 && e.status !== 503 && e.status !== 0) return finish({ error: e.message, credited: { xp: 0, clips: 0, parts: {}, clipParts: {}, clipsFromLevels: 0 }, where: 'rejected' }, before); }
    }
    const R = P.creditState(S, line, Date.now());
    if (R.error) return finish({ error: R.error, credited: { xp: 0, clips: 0, parts: {}, clipParts: {}, clipsFromLevels: 0 }, where: 'rejected' }, before);
    Object.assign(S, R.st); if (A) S.unsynced = (S.unsynced | 0) + 1; save();
    return finish(Object.assign({ where: A ? 'local-unsynced' : 'guest' }, R), before);
  }
  function finish(r, before) { r.before = before; r.after = view(); window.FOLD_PROGRESS.lastResult = r; render(); return r; }

  /* ---------------- UI: menu card ---------------- */
  const card = el('button', { id: 'fpCard', type: 'button', class: 'pt', 'aria-label': 'Player level and Clips. Open progress.', onclick: () => openPanel() });
  document.body.appendChild(card);
  function render() {
    const v = view(), A = acct();
    card.innerHTML = ''; card.appendChild(html('span', '', ribbon(v.level, v.prestige, 52)));
    const nm = (A && A.profile() && A.profile().nick) || v.nick;
    card.appendChild(html('span', 'in', `<span class="nm"></span>${strip(v.li.frac)}<span class="sub"><span>${v.prestige ? 'Prestige ' + v.prestige : 'Lv ' + v.level}</span><span>\uD83D\uDCCE Clips <b>${fmt(v.clips)}</b></span></span>`));
    card.querySelector('.nm').textContent = nm;
    card.title = `${fmt(v.li.xpInLevel)} / ${fmt(v.li.xpForNext)} XP to the next level`;
    applyCrosshair(); try { dispatchEvent(new Event('foldiers:progress')); } catch (e) {}
  }
  const menuUp = () => { const m = $('menu'); return !!m && !m.hidden; };
  const sync = () => { card.hidden = !menuUp(); };
  new MutationObserver(sync).observe($('menu'), { attributes: true, attributeFilter: ['hidden'] }); sync();


  /* ---------------- menu links (Progress / What's new / Report a bug): the paper menu has no spare buttons, so a small tag strip ---------------- */
  const links = el('div', { id: 'fpLinks', role: 'group', 'aria-label': 'More' });
  document.body.appendChild(links);
  function renderLinks() {
    links.textContent = '';
    const add = (id, text, fn, dot) => { const b = el('button', { type: 'button', class: 'pt fp-link', id, onclick: fn }, text); if (dot) b.appendChild(el('i', { class: 'fp-dot', text: 'NEW' })); links.appendChild(b); };
    add('fpLinkProg', 'Progress', () => openPanel());
    if (window.S9News) add('fpLinkNews', "What's new", () => window.S9News.open(), (window.S9News.unseen && window.S9News.unseen().length) > 0);
    if (window.S9Bug) add('fpLinkBug', 'Report a bug', () => window.S9Bug.open());
  }
  addEventListener('s9modules', renderLinks); renderLinks(); setTimeout(renderLinks, 1500); setTimeout(renderLinks, 5000);
  const syncLinks = () => { links.hidden = !menuUp(); };
  new MutationObserver(syncLinks).observe($('menu'), { attributes: true, attributeFilter: ['hidden'] }); syncLinks();

  /* ---------------- UI: progress panel ---------------- */
  const panel = el('div', { id: 'fpPanel', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Progress' });
  document.body.appendChild(panel);
  panel.addEventListener('mousedown', e => { if (e.target === panel) closePanel(); });
  addEventListener('keydown', e => { if (!panel.hidden && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); } }, true);
  const TITLES = {}; for (const u of P.UNLOCKS) if (u.kind === 'title') TITLES[u.id] = u.name;
  function renderPanel() {
    const v = view(), A = acct(), nick = (A && A.profile() && A.profile().nick) || v.nick;
    const sheet = el('div', { class: 'sheet pp' }, el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '\u00D7', onclick: closePanel }));
    const head = html('div', 'head', `<span>${ribbon(v.level, v.prestige, 88)}</span><div class="t"><span class="nm"></span><span class="tt"></span>${strip(v.li.frac, 'big')}<span class="stats"><span>${v.prestige ? 'Prestige <b>' + v.prestige + '</b>' : 'Level <b>' + v.level + '</b>'}</span><span>${fmt(v.li.xpInLevel)} / ${fmt(v.li.xpForNext)} XP</span><span>\uD83D\uDCCE Clips <b>${fmt(v.clips)}</b></span><span>Matches <b>${v.matches}</b></span><span>Wins <b>${v.wins}</b></span></span></div>`);
    head.querySelector('.nm').textContent = nick; head.querySelector('.tt').textContent = (v.equip.title && TITLES[v.equip.title]) || 'Rookie Folder';
    sheet.appendChild(head);
    sheet.appendChild(el('h2', { text: 'Progress' }));
    const dc = el('div'); dc.appendChild(el('h3', { text: 'Daily challenges (new every day, UTC)' }));
    for (const c of v.daily.challenges) dc.appendChild(html('div', 'ch' + (c.done ? ' done' : ''), `<span></span><span>+${P.XP.challenge} XP \u00B7 +${P.CLIPS.challenge} ${CLIP(15)}</span>`)), dc.lastChild.firstChild.textContent = c.text + (c.sum ? ` (${Math.min(c.goal, v.daily.plays)}/${c.goal})` : '');
    sheet.appendChild(dc);
    for (const [kind, label] of [['title', 'Titles'], ['banner', 'Paper banners'], ['crosshair', 'Crosshair styles'], ['card', 'Calling cards'], ['flair', 'Ribbon flair']]) {
      const box = el('div'); box.appendChild(el('h3', { text: label })); const grid = el('div', { class: 'grid' });
      for (const u of P.UNLOCKS.filter(x => x.kind === kind)) {
        const ok = u.lv <= v.level || v.prestige > 0, on = v.equip[kind] === u.id || (!v.equip[kind] && ok && u.lv === 1 && ['title', 'banner', 'flair', 'card', 'crosshair'].includes(kind) && false);
        const b = el('button', { type: 'button', class: 'un' + (on ? ' on' : '') + (ok ? '' : ' lock'), 'data-unlock': u.id, 'aria-pressed': String(on), onclick: () => ok && equip(kind, u.id) });
        b.appendChild(el('span', { text: u.name })); b.appendChild(el('small', { text: ok ? (on ? 'Equipped' : 'Unlocked') : 'Level ' + u.lv })); grid.appendChild(b);
      }
      box.appendChild(grid); sheet.appendChild(box);
    }
    sheet.appendChild(el('div', { class: 'note', text: v.signedIn ? 'Saved to your account. Nothing here changes how you play: titles, banners, crosshairs, cards and ribbons are cosmetic.' : 'Guest progress is kept in this browser only. Create an account to keep it safe and to use your Clips in the shop when it opens. All unlocks are cosmetic.' }));
    panel.textContent = ''; panel.appendChild(sheet);
  }
  function openPanel() { renderPanel(); panel.hidden = false; const x = panel.querySelector('.x'); if (x) x.focus(); }
  function closePanel() { panel.hidden = true; }

  /* ---------------- UI: end-of-match breakdown + level-up ---------------- */
  const LBL = { kills: 'Kills', headshots: 'Headshots', assists: 'Assists', objectives: 'Objectives', result: 'Match result', mvp: 'MVP', multiKills: 'Multi-kills', streak: 'Kill streak', firstWinOfDay: 'First win of the day', challenges: 'Daily challenges' };
  const CLBL = { match: 'Match played', win: 'Win', kills: 'Kills', mvp: 'MVP', firstWinOfDay: 'First win of the day', challenges: 'Daily challenges' };
  function showEnd(r) {
    let box = $('fpEnd'); const row = document.querySelector('#mend .row'), sheet = document.querySelector('#mend .sheet');
    if (!sheet) return; if (!box) { box = el('div', { id: 'fpEnd', class: 'pt', 'aria-live': 'polite' }); sheet.insertBefore(box, row || null); }
    const c = r.credited, a = r.after, b = r.before; let d = 0; const ln = (t, n, plus) => `<div class="ln" style="animation-delay:${(d += .12).toFixed(2)}s"><span>${t}</span><b>${plus || '+'}${fmt(n)}</b></div>`;
    const xl = Object.keys(c.parts || {}).filter(k => c.parts[k]).map(k => ln(LBL[k] || k, c.parts[k])).join('') || '<div class="ln" style="animation-delay:.1s"><span>No XP: match too short</span><b>0</b></div>';
    let cl = Object.keys(c.clipParts || {}).filter(k => c.clipParts[k]).map(k => ln(CLBL[k] || k, c.clipParts[k])).join('');
    if (c.clipsFromLevels) cl += ln('Level up', c.clipsFromLevels);
    box.hidden = false; box.innerHTML = '';
    const lvLabel = x => x.prestige ? 'Prestige ' + x.prestige : 'Level ' + x.level;
    box.appendChild(html('div', 'top', `<span>${ribbon(a.level, a.prestige, 58)}</span><div class="tt"><div class="lvl"><span>${lvLabel(a)}</span><span>${fmt(a.li.xpInLevel)} / ${fmt(a.li.xpForNext)} XP</span></div>${strip(b.level === a.level ? b.li.frac : 0, 'big')}</div>`));
    box.appendChild(html('div', 'cols', `<div class="col"><h4>XP</h4>${xl}<div class="tot"><span>Total</span><b>+${fmt(c.xp)} XP</b></div></div><div class="col"><h4>\uD83D\uDCCE Clips</h4>${cl || '<div class="ln" style="animation-delay:.1s"><span>Nothing earned</span><b>0</b></div>'}<div class="tot"><span>Total</span><b>+${fmt(c.clips + (c.clipsFromLevels || 0) * 0)} ${CLIP(20)}</b></div></div>`));
    box.appendChild(html('div', 'lvl', `<span>Balance: ${CLIP(15)} ${fmt(a.clips)} Clips</span><span></span>`));
    if (r.error) box.appendChild(el('div', { class: 'nsv', text: r.error }));
    if (r.where === 'local-unsynced') box.appendChild(el('div', { class: 'nsv', text: 'Not saved to your account yet (server offline). Kept on this device.' }));
    const fill = box.querySelector('.fp-strip i'); requestAnimationFrame(() => requestAnimationFrame(() => { if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, a.li.frac))})`; }));
    if (r.levelUp) setTimeout(() => levelUp(r), 900);
    render();
  }
  function levelUp(r) {
    let o = $('fpLvl'); if (o) o.remove();
    o = el('div', { id: 'fpLvl', 'aria-live': 'assertive' }); const a = r.after;
    const cols = ['#0b3f9a', '#b11912', '#e7b484', '#f8d0a4', '#2f8a56', '#e0b13a'];
    for (let i = 0; i < 26; i++) { const b = el('i', { class: 'bit' }); b.style.cssText = `left:${(i * 3.9 + (i * 37 % 11)).toFixed(1)}%;background:${cols[i % cols.length]};animation-delay:${((i * 53 % 17) / 20).toFixed(2)}s;transform:rotate(${i * 29}deg);border-radius:${i % 3 ? 1 : 5}px`; o.appendChild(b); }
    o.appendChild(el('div', { class: 'back' }));
    const c = el('div', { class: 'card pp' }); c.appendChild(html('div', 'big', r.prestigeGained ? 'PRESTIGE!' : 'LEVEL UP!')); const rib = html('div', 'rib', ribbon(a.level, a.prestige, 150)); c.appendChild(rib);
    const nu = (r.unlocks || []).map(u => u.name); c.appendChild(el('div', { class: 'new', text: nu.length ? 'New: ' + nu.slice(0, 4).join(', ') : (a.prestige ? 'Prestige ' + a.prestige : 'Level ' + a.level) }));
    o.appendChild(c); document.body.appendChild(o); setTimeout(() => o.remove(), 4600);
  }
  async function onMatchEnd() {
    if (M.credited) return; M.credited = true;
    try { if (typeof NET !== 'undefined' && NET.on && NET.inMatch) return; } catch (e) {}   // online matches are credited by the room server
    const r = await creditLine(lineNow()); showEnd(r);
  }
  if (typeof setState === 'function') { const _ss = setState; setState = function (s) { const r = _ss.apply(this, arguments); if (s === 'play' && !M.started) { M.started = true; M.t0 = gt(); } if (s === 'matchend') onMatchEnd().catch(e => console.warn('progress', e)); return r; }; }
  // a signed-in player: pull the server's numbers when the account changes
  async function pull() { const A = acct(); if (!A) { render(); return; } try { const me = await A.api('/api/fold/me'); S.acct = { id: A.profile().id, me }; save(); } catch (e) {} render(); }
  if (window.S9Account && window.S9Account.onChange) window.S9Account.onChange(pull);
  else addEventListener('s9modules', () => { if (window.S9Account && window.S9Account.onChange) window.S9Account.onChange(pull); pull(); });

  window.FOLD_PROGRESS = { ready: true, shiftStart(sec) { M.t0 += sec; }, view, state: () => JSON.parse(JSON.stringify(S)), creditLine, openPanel, closePanel, equip, showEnd, ribbon, clip: CLIP, applyCrosshair, levelUp, resetMatch, lineNow,
    reset() { S = Object.assign(P.newState(), { equip: {}, acct: null, unsynced: 0 }); save(); render(); }, lastResult: null };
  render(); pull();
})();
