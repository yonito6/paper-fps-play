// Foldiers accounts, client side (ported from Sector Nine modules/account.js, restyled to paper). Self-contained: injects its own CSS and UI, talks to the game server's /api.
// Server: the same accounts API as Sector Nine (register/confirm/login/me/forgot/reset, unique nickname) + /api/fold/* (progress.js): see docs/PARITY.md API.
// Screens: Sign in, Create account, Check your email, Forgot password, Reset (from #reset=TOKEN), Confirm (from #confirm=TOKEN),
// and a Profile panel. A chip in the top-right corner of the menu shows the signed-in nick + rank badge + level.
// Public:  window.S9Account = { token(), profile(), onChange(fn), api(path, opts), open(screen), close(), refresh(), signOut(), base }
//   api(path, {method, body}) -> Promise<data>; rejects with Error(message) carrying .status and .data
// Security: every piece of user/server text goes in through textContent (never innerHTML); the token lives in localStorage
// only; no secrets in here.
(function () {
  'use strict';
  if (window.S9Account) return;

  // ---------------------------------------------------------------- API base: same host as the game WebSocket server
  const DEFAULT_SRV = (typeof SRV !== 'undefined' && SRV && SRV.url) || 'wss://eu.foldiers.com';   // follows the game's own server setting (?srv= too)
  function apiBase() {
    let s = null; try { s = new URLSearchParams(location.search).get('srv'); } catch (e) {}
    s = s || DEFAULT_SRV;
    try { const u = new URL(s); u.protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol; return u.origin; } catch (e) { return 'https://eu.foldiers.com'; }
  }
  const BASE = apiBase();
  const KEY = 'foldiers-account';
  const ls = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} } };

  let saved = ls.get();
  let TOKEN = saved && typeof saved.token === 'string' ? saved.token : null;
  let PROFILE = saved && saved.profile && typeof saved.profile === 'object' ? saved.profile : null;
  // guests: a chosen nickname, kept in this browser only; 'sector9-welcome' = the first-launch question was answered
  const GKEY = 'foldiers-guest', WKEY = 'foldiers-welcome';
  const lsRaw = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  let GUEST = null; try { const g = JSON.parse(lsRaw.get(GKEY) || 'null'); if (g && typeof g.nick === 'string' && /^[A-Za-z0-9_.-]{3,16}$/.test(g.nick)) GUEST = { nick: g.nick }; } catch (e) {}
  const welcomeDone = () => !!lsRaw.get(WKEY);
  function setWelcomeDone(how) { lsRaw.set(WKEY, how); }
  function setGuest(nick) { GUEST = nick ? { nick } : null; lsRaw.set(GKEY, nick ? JSON.stringify({ nick, at: Date.now() }) : null); }
  const subs = new Set();
  function changed() { ls.set(TOKEN ? { token: TOKEN, profile: PROFILE } : null); renderChip(); fillNick(); linkSocket(); for (const f of [...subs]) try { f(PROFILE); } catch (e) { console.error(e); } }

  async function api(path, opts = {}) {
    const h = { accept: 'application/json' };
    if (opts.body !== undefined) h['content-type'] = 'application/json';
    if (TOKEN && opts.auth !== false) h.authorization = 'Bearer ' + TOKEN;
    let r;
    try { r = await fetch(BASE + path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers: h, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, mode: 'cors', credentials: 'omit', cache: 'no-store' }); }
    catch (e) { const x = new Error("Can't reach the server. Check your connection and try again."); x.status = 0; throw x; }
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      if (r.status === 401 && TOKEN && opts.auth !== false && path.startsWith('/api/me')) { TOKEN = null; PROFILE = null; changed(); }
      const x = new Error((data && typeof data.error === 'string' && data.error) || 'Something went wrong (' + r.status + ').'); x.status = r.status; x.data = data; throw x;
    }
    return data;
  }

  async function refresh() {
    if (!TOKEN) return null;
    try { PROFILE = await api('/api/me'); changed(); } catch (e) { /* offline: keep the cached profile */ }
    return PROFILE;
  }
  async function signOut() {
    const t = TOKEN; TOKEN = null; PROFILE = null; changed();
    if (t) try { await fetch(BASE + '/api/logout', { method: 'POST', headers: { authorization: 'Bearer ' + t }, mode: 'cors', credentials: 'omit' }); } catch (e) {}
  }

  // link the game's WebSocket to this account (server side: {k:'auth', t:token}); works with index.html's SRV/srvSend
  function linkSocket() {
    try { if (typeof srvOn === 'function' && srvOn() && typeof srvSend === 'function') srvSend({ k: 'auth', t: TOKEN || null }); } catch (e) {}
  }
  try { if (typeof SRV !== 'undefined' && SRV.on) SRV.on.add(d => { if (d && d.k === 'hello' && TOKEN) srvSend({ k: 'auth', t: TOKEN }); if (d && d.k === 'xp' && TOKEN) refresh(); }); } catch (e) {}
  // the online nickname follows the account
  const playNick = () => (TOKEN && PROFILE && PROFILE.nick) || (GUEST && GUEST.nick) || null;
  function fillNick() { const n = document.getElementById('nick'), v = playNick(); if (n && v && n.value !== v) { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); } }

  // ---------------------------------------------------------------- styles
  const css = `
#s9a-chip,#s9a-root{--a-bg:var(--bg,#0b0d10);--a-ink:var(--ink,#ece6d8);--a-dim:var(--dim,#8b9097);--a-acc:var(--sodium,#ff9a3c);--a-cy:var(--cyan,#7fe7ff);--a-bad:var(--alert,#ff4a3d);--a-line:var(--line,rgba(236,230,216,.18));--a-disp:var(--display,"Big Shoulders Stencil Display",Impact,"Arial Narrow",sans-serif);--a-mono:var(--mono,"IBM Plex Mono",ui-monospace,Consolas,monospace);font-family:var(--a-mono);color:var(--a-ink);box-sizing:border-box}
#s9a-root *,#s9a-chip *{box-sizing:border-box}
#s9a-chip{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:calc(14px + env(safe-area-inset-right,0px));z-index:60;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 28px);padding:7px 14px 7px 8px;background:rgba(11,13,16,.62);border:1px solid var(--a-line);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);cursor:pointer;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--a-ink);transition:border-color .15s,background .15s}
#s9a-chip:hover,#s9a-chip:focus-visible{border-color:var(--a-acc);background:rgba(11,13,16,.8);outline:none}
#s9a-chip[hidden]{display:none}
#s9a-chip.inline{position:static;justify-self:start;max-width:100%;margin-bottom:-6px}
#s9a-chip .nk{font-family:var(--a-disp);font-size:19px;font-weight:900;letter-spacing:.04em;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;line-height:1}
#s9a-chip .lv{color:var(--a-acc);font-weight:600;white-space:nowrap}
#s9a-chip .in{display:flex;align-items:center;gap:8px;padding-left:6px}
#s9a-chip .gs{display:grid;gap:3px;text-align:left;padding:2px 2px 2px 6px;line-height:1.2}
#s9a-chip .gn{font-family:var(--a-disp);font-size:17px;font-weight:900;letter-spacing:.03em;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}#s9a-chip .gn b{color:var(--a-acc)}
#s9a-chip .gw{font-size:10px;letter-spacing:.12em;color:#ffd27a;white-space:nowrap}#s9a-chip .gw u{color:var(--a-ink);text-underline-offset:2px}
.s9a-dice{position:absolute;right:1px;top:1px;bottom:1px;width:48px;border:0;border-left:1px solid var(--a-line);background:rgba(255,154,60,.08);font-size:20px;line-height:1;cursor:pointer;color:var(--a-ink)}
.s9a-dice:hover,.s9a-dice:focus-visible{background:rgba(255,154,60,.2);outline:none}.s9a-dice.roll{animation:s9a-roll .4s ease-out}
@keyframes s9a-roll{from{transform:rotate(-200deg) scale(.7)}to{transform:none}}
.s9a-nst{font-size:12px;color:var(--a-dim);min-height:16px;line-height:1.4}.s9a-nst.ok{color:#8ff0a4}.s9a-nst.bad{color:#ffb3ab}
.s9a-sug{display:flex;flex-wrap:wrap;gap:6px}.s9a-sug:empty{display:none}
.s9a-sugb{font:12px var(--a-mono);color:var(--a-ink);background:rgba(127,231,255,.06);border:1px solid rgba(127,231,255,.35);padding:7px 10px;cursor:pointer}
.s9a-sugb:hover,.s9a-sugb:focus-visible{border-color:var(--a-cy);background:rgba(127,231,255,.14);outline:none}
.s9a-warn{font-size:13px;line-height:1.55;color:#ffe2b8;background:rgba(255,154,60,.1);border:1px solid rgba(255,154,60,.35);border-left:3px solid var(--a-acc);padding:11px 13px}
.s9a-warn b{color:var(--a-acc)}
.s9a-alt{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:space-between;border-top:1px solid var(--a-line);padding-top:14px}
#s9a-chip .in i{width:8px;height:8px;border:1px solid var(--a-acc);transform:rotate(45deg)}
.s9a-badge{position:relative;flex:none;width:34px;height:34px;display:grid;place-items:center}
.s9a-badge img,.s9a-badge svg{width:100%;height:100%;object-fit:contain;display:block}
.s9a-pips{display:flex;gap:2px;margin-top:3px}.s9a-pips b{width:5px;height:3px;background:rgba(236,230,216,.22)}.s9a-pips b.on{background:var(--a-acc)}
#s9a-root{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:16px;background:rgba(5,6,8,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);overflow:auto}
#s9a-root[hidden]{display:none}
.s9a-card{position:relative;width:min(440px,100%);background:linear-gradient(180deg,rgba(20,22,26,.86),rgba(11,13,16,.9));border:1px solid var(--a-line);border-top:3px solid var(--a-acc);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);padding:28px 26px 24px;box-shadow:0 30px 80px rgba(0,0,0,.5);display:grid;gap:14px;animation:s9a-in .18s ease-out}
.s9a-card.wide{width:min(560px,100%)}
@keyframes s9a-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.s9a-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border:1px solid transparent;background:transparent;color:var(--a-dim);font:20px/1 var(--a-mono);cursor:pointer}
.s9a-x:hover,.s9a-x:focus-visible{color:var(--a-ink);border-color:var(--a-line);outline:none}
.s9a-k{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--a-acc)}
.s9a-h{font-family:var(--a-disp);font-weight:900;font-size:clamp(34px,8vw,44px);line-height:.88;margin:0;letter-spacing:.01em;text-transform:uppercase}
.s9a-p{margin:0;font-size:13px;line-height:1.6;color:#c9c3b6}
.s9a-p b{color:var(--a-ink)}
.s9a-f{display:grid;gap:5px}
.s9a-f label{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--a-dim)}
.s9a-f .w{position:relative;display:flex}
.s9a-f input{width:100%;min-width:0;background:rgba(5,6,8,.7);color:var(--a-ink);border:1px solid var(--a-line);font:15px var(--a-mono);padding:11px 12px;border-radius:0;outline:none;transition:border-color .12s}
.s9a-f input:focus{border-color:var(--a-acc)}
.s9a-f input[aria-invalid=true]{border-color:var(--a-bad)}
.s9a-f .eye{position:absolute;right:1px;top:1px;bottom:1px;padding:0 12px;background:transparent;border:0;color:var(--a-dim);font:11px var(--a-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.s9a-f .eye:hover{color:var(--a-ink)}
.s9a-hint{font-size:11px;color:var(--a-dim);min-height:14px}
.s9a-meter{height:3px;background:rgba(236,230,216,.1);overflow:hidden}.s9a-meter i{display:block;height:100%;width:0;background:var(--a-bad);transition:width .2s,background .2s}
.s9a-err{font-size:13px;color:#ffb3ab;background:rgba(255,74,61,.1);border-left:2px solid var(--a-bad);padding:9px 11px;line-height:1.5}
.s9a-err[hidden],.s9a-ok[hidden]{display:none}
.s9a-ok{font-size:13px;color:#cdf6ff;background:rgba(127,231,255,.08);border-left:2px solid var(--a-cy);padding:9px 11px;line-height:1.5}
.s9a-go{font-family:var(--a-disp);font-weight:900;font-size:24px;letter-spacing:.08em;text-transform:uppercase;color:#14100b;background:var(--a-acc);border:0;padding:13px 26px 11px;cursor:pointer;clip-path:polygon(0 0,100% 0,100% 70%,calc(100% - 14px) 100%,0 100%);justify-self:start;min-width:180px}
.s9a-go:hover,.s9a-go:focus-visible{filter:brightness(1.1);outline:none}
.s9a-go[disabled]{opacity:.55;cursor:wait}
.s9a-row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
.s9a-link{background:none;border:0;padding:4px 0;color:var(--a-dim);font:12px var(--a-mono);letter-spacing:.06em;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(236,230,216,.25);text-underline-offset:3px}
.s9a-link:hover,.s9a-link:focus-visible{color:var(--a-ink);outline:none}
.s9a-ghost{font:12px var(--a-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--a-ink);background:transparent;border:1px solid var(--a-line);padding:11px 16px;cursor:pointer}
.s9a-ghost:hover,.s9a-ghost:focus-visible{border-color:var(--a-acc);outline:none}
.s9a-prof{display:flex;gap:16px;align-items:center}
.s9a-prof .s9a-badge{width:78px;height:78px}
.s9a-prof .nm{font-family:var(--a-disp);font-weight:900;font-size:clamp(30px,7vw,40px);line-height:.9;word-break:break-all}
.s9a-prof .rk{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--a-acc);margin-top:6px}
.s9a-xp{display:grid;gap:5px}.s9a-xp .bar{height:6px;background:rgba(236,230,216,.1);position:relative;overflow:hidden}.s9a-xp .bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--a-acc),#ffc27a)}
.s9a-xp .t{display:flex;justify-content:space-between;font-size:11px;color:var(--a-dim);letter-spacing:.08em}
.s9a-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--a-line);border:1px solid var(--a-line)}
.s9a-grid div{background:rgba(11,13,16,.92);padding:10px 8px;display:grid;gap:3px}
.s9a-grid b{font-family:var(--a-disp);font-weight:900;font-size:24px;line-height:1}
.s9a-grid span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--a-dim)}
.s9a-rec{display:grid;gap:0;font-size:12px;max-height:180px;overflow:auto;border-top:1px solid var(--a-line)}
.s9a-rec div{display:grid;grid-template-columns:44px 1fr auto auto;gap:10px;padding:7px 2px;border-bottom:1px solid rgba(236,230,216,.07);align-items:center}
.s9a-rec .w{color:var(--a-cy)}.s9a-rec .l{color:var(--a-dim)}.s9a-rec .x{color:var(--a-acc)}
.s9a-spin{width:22px;height:22px;border:2px solid var(--a-line);border-top-color:var(--a-acc);border-radius:50%;animation:s9a-sp .8s linear infinite}
@keyframes s9a-sp{to{transform:rotate(360deg)}}
@media (max-width:480px){.s9a-card{padding:24px 18px 20px}.s9a-grid{grid-template-columns:repeat(2,1fr)}#s9a-chip .nk{max-width:110px}#s9a-chip{padding:6px 10px 6px 6px}.s9a-go{width:100%}}
@media (prefers-reduced-motion:reduce){.s9a-card{animation:none}}
`;
  const PAPER_CSS = `
/* PAPER restyle (Foldiers): cream/kraft sheets, ink brown text, logo blue + red; no glass, no sci-fi corners */
#s9a-chip,#s9a-root{--a-bg:#f4e9d2;--a-ink:#22150c;--a-dim:#5b4430;--a-acc:#0b3f9a;--a-cy:#0b3f9a;--a-bad:#b11912;--a-line:rgba(43,28,14,.42);--a-disp:var(--display,"Changa One","Arial Black",sans-serif);--a-mono:var(--mono,"Barlow Semi Condensed","Arial Narrow",sans-serif);font-weight:600}
#s9a-chip{background:var(--face-cream,#f4e9d2);border:2px solid #2b1c0e;border-radius:4px;-webkit-backdrop-filter:none;backdrop-filter:none;transform:rotate(1deg);box-shadow:2px 3px 0 rgba(43,28,14,.35);text-transform:none;letter-spacing:.02em;font-size:13px}
#s9a-chip:hover,#s9a-chip:focus-visible{background:var(--face-cream,#f4e9d2);border-color:#0b3f9a;transform:rotate(.3deg)}
#s9a-chip .nk{font-style:italic;font-weight:400;font-size:19px}#s9a-chip .lv{color:#0b3f9a}
#s9a-chip .gw{color:#8a2217}#s9a-chip .gn b{color:#0b3f9a}#s9a-chip .in i{border-color:#0b3f9a}
#s9a-root{background:radial-gradient(ellipse at center,rgba(42,26,12,.45),rgba(30,18,8,.74));-webkit-backdrop-filter:none;backdrop-filter:none}
.s9a-card{background:var(--face-kraft,#c69b62);border:2px solid #2b1c0e;border-top:2px solid #2b1c0e;border-radius:4px;box-shadow:4px 6px 0 rgba(43,28,14,.4);-webkit-backdrop-filter:none;backdrop-filter:none;color:#22150c}
.s9a-card::before{content:"";position:absolute;left:50%;top:-12px;width:90px;height:24px;margin-left:-45px;background:rgba(248,208,164,.85);border:1px solid rgba(43,28,14,.25);transform:rotate(-2deg)}
.s9a-h{font-style:italic;font-weight:400;text-transform:none;letter-spacing:.01em;line-height:1}
.s9a-k{color:#8a2217;letter-spacing:.2em;font-weight:800}
.s9a-p{color:#3a2a18}.s9a-p b{color:#22150c}
.s9a-x{color:#22150c}.s9a-x:hover,.s9a-x:focus-visible{border-color:#2b1c0e}
.s9a-f label{color:#4e3420;font-weight:800}
.s9a-f input{background:rgba(255,250,238,.85);color:#22150c;border:2px solid #2b1c0e;border-radius:3px;font-weight:700}
.s9a-f input:focus{border-color:#0b3f9a;box-shadow:0 0 0 2px rgba(11,63,154,.25)}.s9a-f input[aria-invalid=true]{border-color:#b11912}
.s9a-f .eye{color:#4e3420}.s9a-f .eye:hover{color:#22150c}.s9a-hint{color:#4e3420}
.s9a-meter,.s9a-xp .bar{background:rgba(43,28,14,.2);border:1px solid rgba(43,28,14,.5)}
.s9a-xp .bar i{background:repeating-linear-gradient(90deg,rgba(255,255,255,0) 0 17px,rgba(255,255,255,.24) 17px 18px),var(--tx-blue,none) 0 0/200px,#0b3f9a}
.s9a-xp .t{color:#4e3420}.s9a-xp .bar{height:11px;border-radius:2px}
.s9a-err{color:#7a0f0a;background:rgba(177,25,18,.12);border-left:3px solid #b11912}
.s9a-ok{color:#173783;background:rgba(11,63,154,.1);border-left:3px solid #0b3f9a}
.s9a-nst.ok{color:#1c5a37}.s9a-nst.bad{color:#9a1710}
.s9a-go{font-weight:400;font-style:italic;text-transform:none;letter-spacing:.03em;font-size:26px;color:#f8d0a4;background:var(--face-blue,#0b3f9a);clip-path:none;border:2px solid #013587;border-radius:4px;box-shadow:2px 3px 0 rgba(43,28,14,.4);padding:11px 26px 9px}
.s9a-go:hover,.s9a-go:focus-visible{filter:brightness(1.12);transform:translateY(-1px)}
.s9a-ghost{color:#22150c;border:2px solid #2b1c0e;border-radius:3px;background:rgba(255,250,238,.5);font-weight:800}.s9a-ghost:hover,.s9a-ghost:focus-visible{border-color:#0b3f9a;background:rgba(255,250,238,.9)}
.s9a-link{color:#4e3420;text-decoration-color:rgba(43,28,14,.45)}.s9a-link:hover,.s9a-link:focus-visible{color:#22150c}
.s9a-dice{background:rgba(255,250,238,.6);border-left:2px solid #2b1c0e;color:#22150c}.s9a-dice:hover,.s9a-dice:focus-visible{background:rgba(190,208,255,.7)}
.s9a-sugb{color:#22150c;background:rgba(255,250,238,.7);border:2px solid #2b1c0e;border-radius:3px}.s9a-sugb:hover,.s9a-sugb:focus-visible{border-color:#0b3f9a;background:#fff}
.s9a-warn{color:#4e3420;background:rgba(255,250,238,.6);border:2px dashed #2b1c0e;border-left:3px solid #b11912}.s9a-warn b{color:#8a2217}
.s9a-alt{border-top:2px dashed rgba(43,28,14,.4)}
.s9a-grid{background:rgba(43,28,14,.45);border:2px solid #2b1c0e}.s9a-grid div{background:rgba(244,233,210,.95)}.s9a-grid span{color:#4e3420}.s9a-grid b{font-style:italic;font-weight:400;color:#0b3f9a}
.s9a-prof .rk{color:#8a2217}.s9a-prof .nm{font-style:italic;font-weight:400}.s9a-prof .s9a-badge{width:84px;height:92px}.s9a-badge svg{height:auto}
.s9a-spin{border-color:rgba(43,28,14,.25);border-top-color:#0b3f9a}
`;
  const st = document.createElement('style'); st.id = 's9a-css'; st.textContent = css + PAPER_CSS; document.head.appendChild(st);

  // ---------------------------------------------------------------- tiny DOM helper (text only, never HTML strings)
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lvView = () => { try { if (window.FOLD_PROGRESS) return window.FOLD_PROGRESS.view(); } catch (e) {} const x = PROFILE || {}; return { level: (x.level | 0) || 1, prestige: x.prestige | 0 }; };
  // level badge = the folded ribbon from progress.js (the server's profile.level is the Sector Nine curve; the real Foldiers level comes from progress.js)
  function badge(rank, withPips) {
    const v = lvView(), wrap = el('span', { class: 's9a-badge', title: 'Level ' + v.level });
    wrap.innerHTML = window.FOLD_PROGRESS ? window.FOLD_PROGRESS.ribbon(v.level, v.prestige, 40) : '<b>' + (v.level | 0) + '</b>';   // markup is built from numbers only
    return wrap;
  }

  // ---------------------------------------------------------------- chip
  const chip = el('button', { id: 's9a-chip', type: 'button', 'aria-label': 'Account', onclick: () => open(TOKEN ? 'profile' : GUEST ? 'register' : 'signin') });
  function renderChip() {
    chip.textContent = '';
    if (TOKEN && PROFILE) {
      chip.appendChild(badge(PROFILE.rank, false));
      chip.appendChild(el('span', { style: 'display:grid;gap:3px;min-width:0' }, el('span', { class: 'nk', text: PROFILE.nick }), el('span', { class: 'lv', text: 'Lv ' + lvView().level + (lvView().prestige ? ' · P' + lvView().prestige : '') + ' · ' + (PROFILE.rank && PROFILE.rank.name || '') })));
      chip.setAttribute('aria-label', 'Account: ' + PROFILE.nick + ', level ' + lvView().level);
    } else if (GUEST) {
      chip.appendChild(el('span', { class: 'gs' }, el('span', { class: 'gn' }, el('b', { text: 'Guest' }), ' · ', el('span', { text: GUEST.nick })), el('span', { class: 'gw' }, 'Progress not saved · ', el('u', { text: 'Create account' }))));
      chip.setAttribute('aria-label', 'Playing as guest ' + GUEST.nick + '. Progress is not saved. Create an account');
    } else {
      chip.appendChild(el('span', { class: 'in' }, el('i'), el('span', { text: 'Sign in' })));
      chip.setAttribute('aria-label', 'Sign in or create an account');
    }
  }
  // the chip shows while the main menu is up (hidden during play)
  function menuVisible() { const m = document.getElementById('menu'); return !m || !m.hidden; }
  function syncChip() { chip.hidden = !menuVisible() || !root.hidden; }
  // phones: the corner is taken by the menu's own text, so the chip sits at the top of the menu column instead
  const narrowMq = matchMedia('(max-width: 600px)');
  function placeChip() {
    const sheet = document.querySelector('#menu .sheet');
    if (narrowMq.matches && sheet) { if (chip.parentNode !== sheet) sheet.prepend(chip); chip.classList.add('inline'); }
    else { if (chip.parentNode !== document.body) document.body.appendChild(chip); chip.classList.remove('inline'); }
  }

  // ---------------------------------------------------------------- modal + screens
  const root = el('div', { id: 's9a-root', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's9a-title' });
  root.addEventListener('mousedown', e => { if (e.target === root && screen !== 'welcome') close(); });
  // keep typing inside the account forms away from the game's controls
  // (window capture phase: runs before the game's own window listeners, wherever the focus is)
  for (const ev of ['keydown', 'keyup', 'keypress']) addEventListener(ev, e => {
    if (root.hidden) return;
    if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); if (screen !== 'welcome') close(); }
    e.stopPropagation();
  }, true);
  for (const ev of ['mousedown', 'mouseup', 'click', 'wheel', 'contextmenu']) root.addEventListener(ev, e => e.stopPropagation());
  let screen = null, lastEmail = '';

  function field(label, input, hint) { const id = 's9a-' + Math.random().toString(36).slice(2, 8); input.id = id; return el('div', { class: 's9a-f' }, el('label', { for: id, text: label }), el('div', { class: 'w' }, input), hint || null); }
  function pwInput(name, autoc) {
    const i = el('input', { type: 'password', name, autocomplete: autoc, maxlength: '128', spellcheck: 'false', required: true });
    return i;
  }
  function withEye(f) { const inp = f.querySelector('input'); const b = el('button', { type: 'button', class: 'eye', text: 'Show', 'aria-label': 'Show password', onclick: () => { const sh = inp.type === 'password'; inp.type = sh ? 'text' : 'password'; b.textContent = sh ? 'Hide' : 'Show'; } }); inp.style.paddingRight = '64px'; f.querySelector('.w').appendChild(b); return f; }
  const errBox = () => el('div', { class: 's9a-err', role: 'alert', hidden: true });
  const okBox = () => el('div', { class: 's9a-ok', role: 'status', hidden: true });
  const show = (box, msg) => { box.textContent = msg || ''; box.hidden = !msg; };
  function card(kicker, title, body, wide, noX) {
    return el('div', { class: 's9a-card' + (wide ? ' wide' : '') }, noX ? null : el('button', { class: 's9a-x', type: 'button', 'aria-label': 'Close', text: '×', onclick: close }),
      el('div', { class: 's9a-k', text: kicker }), el('h2', { class: 's9a-h', id: 's9a-title', text: title }), ...body);
  }
  async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Wait...'; try { return await fn(); } finally { btn.disabled = false; btn.textContent = t; } }
  function strength(pw) { let s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; if (pw.length >= 20) s++; return Math.min(4, Math.floor(s * 4 / 6 + (pw.length >= 10 ? 1 : 0))); }

  // nickname input with a live availability check (✓/✗), suggestions and a random-name dice
  const NICK_RE = /^[A-Za-z0-9_.-]{3,16}$/;
  const RA = ['Folded','Crisp','Creased','Origami','Paper','Kraft','Glued','Taped','Stapled','Inky','Pencil','Torn','Sharp','Crinkly','Cardboard','Clippy','Dotted','Lined','Doodle','Scissor','Blue','Red'];
  const RB = ['Otter','Falcon','Badger','Fox','Crane','Frog','Boat','Hat','Star','Swan','Tiger','Panda','Gecko','Wolf','Yeti','Moth','Hornet','Koala','Llama','Walrus','Plane','Flap'];
  const localRandom = () => { for (;;) { const n = RA[Math.random() * RA.length | 0] + RB[Math.random() * RB.length | 0] + (10 + Math.random() * 90 | 0); if (n.length <= 16) return n; } };
  async function randomName() { try { const r = await api('/api/random-nick', { auth: false }); if (r && NICK_RE.test(r.nick)) return r.nick; } catch (e) {} return localRandom(); }
  function nickField(o = {}) {
    const inp = el('input', { type: 'text', name: 'nick', autocomplete: 'username', maxlength: '16', spellcheck: 'false', required: true, autocapitalize: 'off', value: o.value || '' });
    const st = el('div', { class: 's9a-nst', 'aria-live': 'polite' }), sug = el('div', { class: 's9a-sug' });
    let state = 'empty', seq = 0, timer = null, pending = Promise.resolve('empty'), settle = null;
    const mark = (s, msg) => { state = s; st.className = 's9a-nst ' + s; st.textContent = msg; inp.setAttribute('aria-invalid', s === 'bad' ? 'true' : 'false'); };
    const setSug = list => { sug.textContent = ''; for (const n of (list || []).slice(0, 3)) if (NICK_RE.test(n)) sug.appendChild(el('button', { type: 'button', class: 's9a-sugb', text: n, title: 'Use ' + n, onclick: () => set(n) })); };
    function set(n) { inp.value = n; check(true); try { inp.focus({ preventScroll: true }); } catch (e) {} }
    function check(now) {
      clearTimeout(timer); setSug([]); const v = inp.value.trim(), my = ++seq;
      if (settle) { settle(state); settle = null; }
      if (!v) { mark('empty', '3 to 16 letters, digits, _ . -'); return (pending = Promise.resolve('empty')); }
      if (!NICK_RE.test(v)) { mark('bad', '\u2717 Only letters, digits, _ . - (3 to 16)'); return (pending = Promise.resolve('bad')); }
      mark('checking', 'Checking ' + v + '...');
      pending = new Promise(res => { settle = res; });
      const done = s => { if (my === seq && settle) { settle(s); settle = null; } };
      timer = setTimeout(async () => {
        try {
          const r = await api('/api/nick-available?n=' + encodeURIComponent(v), { auth: false });
          if (my !== seq) return;
          if (r && r.available) { mark('ok', '\u2713 ' + v + ' is available'); done('ok'); }
          else { mark('bad', '\u2717 ' + ((r && r.reason) || 'That nickname is taken.') + ' Try one of these:'); setSug(r && r.suggestions); done('bad'); }
        } catch (x) { if (my !== seq) return; mark('unknown', "Couldn't check right now. It will be checked when you continue."); done('unknown'); }
      }, now ? 0 : 320);
      return pending;
    }
    inp.addEventListener('input', () => check(false));
    const dice = el('button', { type: 'button', class: 's9a-dice', title: 'Random name', 'aria-label': 'Pick a random free name', text: '\ud83c\udfb2', onclick: async () => { dice.disabled = true; dice.classList.add('roll'); try { set(await randomName()); } finally { dice.disabled = false; setTimeout(() => dice.classList.remove('roll'), 400); } } });
    const f = field(o.label || 'Nickname', inp, el('div', { style: 'display:grid;gap:7px' }, st, sug));
    f.querySelector('.w').appendChild(dice); inp.style.paddingRight = '56px';
    if (inp.value) check(true); else { mark('empty', '3 to 16 letters, digits, _ . -'); if (o.autoRandom) randomName().then(n => { if (!inp.value) set(n); }); }
    return { node: f, input: inp, state: () => state, ready: () => pending };
  }
  // the create-account form (used by "Create account" and by the first-launch welcome)
  function regForm(o = {}) {
    const N = nickField({ value: (GUEST && GUEST.nick) || '' });
    const em = el('input', { type: 'email', name: 'email', autocomplete: 'email', maxlength: '254', spellcheck: 'false', required: true, value: lastEmail });
    const pw = pwInput('new-password', 'new-password'), err = errBox();
    const meter = el('div', { class: 's9a-meter' }, el('i')), ph = el('div', { class: 's9a-hint', text: 'At least 10 characters. A few random words work great.' });
    pw.addEventListener('input', () => { const s = strength(pw.value), bar = meter.firstChild; bar.style.width = (pw.value ? 12 + s * 22 : 0) + '%'; bar.style.background = ['#ff4a3d', '#ff4a3d', '#ff9a3c', '#ffd27a', '#7fe7ff'][s]; ph.textContent = pw.value.length && pw.value.length < 10 ? (10 - pw.value.length) + ' more characters' : ['', 'Weak', 'Okay', 'Good', 'Strong'][s] || 'At least 10 characters. A few random words work great.'; });
    const go = el('button', { class: 's9a-go', type: 'submit', text: 'Create account' });
    const f = el('form', { novalidate: true, style: 'display:grid;gap:14px', onsubmit: async e => {
      e.preventDefault(); show(err);
      const nick = N.input.value.trim(), email = em.value.trim();
      if (!NICK_RE.test(nick)) { N.input.focus(); return show(err, 'Nickname: 3 to 16 letters, digits, _ . or -'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { em.focus(); return show(err, 'Please enter a valid email address.'); }
      if (pw.value.length < 10) { pw.focus(); return show(err, 'Password: at least 10 characters.'); }
      await busy(go, async () => {
        if ((await N.ready()) === 'bad') { N.input.focus(); return show(err, 'That nickname is not available. Pick another one or tap the dice.'); }
        try { await api('/api/register', { body: { nick, email, password: pw.value }, auth: false }); lastEmail = email; pw.value = ''; setWelcomeDone('account'); gating = false; open('sent', { email }); }
        catch (x) { show(err, x.message); if (x.status === 409) N.input.dispatchEvent(new Event('input')); }
      });
    } },
      N.node, field('Email', em), withEye(field('Password', pw, el('div', { style: 'display:grid;gap:5px;margin-top:2px' }, meter, ph))), err,
      el('div', { class: 's9a-row' }, go, o.welcome ? null : el('button', { type: 'button', class: 's9a-link', text: 'I have an account', onclick: () => open('signin') })));
    return { form: f, focus: N.input };
  }

  const SCREENS = {
    signin() {
      const em = el('input', { type: 'email', name: 'email', autocomplete: 'email', maxlength: '254', spellcheck: 'false', required: true, value: lastEmail });
      const pw = pwInput('password', 'current-password'), err = errBox(), ok = okBox();
      const go = el('button', { class: 's9a-go', type: 'submit', text: 'Sign in' });
      let resend = null;
      const f = el('form', { novalidate: true, style: 'display:grid;gap:14px', onsubmit: async e => {
        e.preventDefault(); show(err); show(ok); if (resend) { resend.remove(); resend = null; }
        if (!em.value.trim() || !pw.value) return show(err, 'Enter your email and password.');
        lastEmail = em.value.trim();
        await busy(go, async () => {
          try { const r = await api('/api/login', { body: { email: em.value.trim(), password: pw.value }, auth: false }); TOKEN = r.token; PROFILE = r.profile; pw.value = ''; setGuest(null); setWelcomeDone('account'); gating = false; changed(); open('profile', { welcome: true }); }
          catch (x) {
            show(err, x.message); pw.value = ''; pw.focus();
            if (x.data && x.data.needConfirm) { resend = el('button', { type: 'button', class: 's9a-link', text: 'Send the link again', onclick: () => resendLink(em.value.trim(), ok) }); err.after(resend); }
          }
        });
      } },
        field('Email', em), withEye(field('Password', pw)), err, ok,
        el('div', { class: 's9a-row' }, go, el('button', { type: 'button', class: 's9a-link', text: 'Forgot password?', onclick: () => { lastEmail = em.value.trim(); open('forgot'); } })));
      return { node: card('Operator access', 'Sign in', [el('p', { class: 's9a-p', text: 'Save your XP, rank and stats across devices.' }), f,
        el('div', { class: 's9a-row', style: 'border-top:1px solid var(--a-line);padding-top:12px' }, el('span', { class: 's9a-p', text: 'New here?' }), el('button', { type: 'button', class: 's9a-ghost', text: 'Create account', onclick: () => open('register') }))]), focus: lastEmail ? pw : em };
    },
    register() { const R = regForm(); return { node: card('New Foldier', 'Create account', [R.form]), focus: R.focus }; },
    // first launch: create an account (big), sign in, or play as guest
    welcome() {
      const R = regForm({ welcome: true });
      return { node: card('Welcome, Foldier', 'Join Foldiers', [
        el('p', { class: 's9a-p', text: 'Create a free account to keep your level, Clips and stats on every device.' }), R.form,
        el('div', { class: 's9a-alt' },
          el('button', { type: 'button', class: 's9a-ghost', 'data-act': 'have-account', text: 'I already have an account', onclick: () => open('signin') }),
          el('button', { type: 'button', class: 's9a-link', 'data-act': 'guest', text: 'Play as guest', onclick: () => open('guest') })),
      ], true, true), focus: R.focus };
    },
    // guest: still needs a free nickname; clear warning that nothing is saved
    guest() {
      const N = nickField({ value: (GUEST && GUEST.nick) || '', autoRandom: !GUEST });
      const err = errBox(), go = el('button', { class: 's9a-go', type: 'submit', text: 'Continue' });
      const f = el('form', { novalidate: true, style: 'display:grid;gap:14px', onsubmit: async e => {
        e.preventDefault(); show(err);
        await busy(go, async () => {
          const st = await N.ready(), nick = N.input.value.trim();
          if (st === 'bad' || st === 'empty' || !NICK_RE.test(nick)) { N.input.focus(); return show(err, 'Pick a free nickname first (or tap the dice).'); }
          setGuest(nick); setWelcomeDone('guest'); gating = false; changed(); close();
        });
      } },
        el('div', { class: 's9a-warn', role: 'note' }, el('b', { text: 'Heads up: ' }), "Progress, levels, skins and coins won't be saved. You can create an account anytime."),
        N.node, err,
        el('div', { class: 's9a-row' }, go, el('button', { type: 'button', class: 's9a-link', 'data-act': 'back', text: 'Go back', onclick: () => open(gating ? 'welcome' : 'register') })));
      return { node: card('No account', 'Play as guest', [f], false, gating), focus: N.input };
    },
    sent(o) {
      const ok = okBox();
      return { node: card('Almost there', 'Check your email', [
        el('p', { class: 's9a-p' }, 'We sent a confirmation link to ', el('b', { text: o && o.email || 'your email' }), '. Open it on this device to switch your account on. The link works for 24 hours.'),
        el('p', { class: 's9a-p', text: "Nothing there? Check spam, or send it again." }), ok,
        el('div', { class: 's9a-row' }, el('button', { type: 'button', class: 's9a-go', text: 'Sign in', onclick: () => open('signin') }), el('button', { type: 'button', class: 's9a-link', text: 'Send again', onclick: () => resendLink(o && o.email, ok) }))]) };
    },
    forgot() {
      const em = el('input', { type: 'email', name: 'email', autocomplete: 'email', maxlength: '254', spellcheck: 'false', required: true, value: lastEmail });
      const err = errBox(), ok = okBox(), go = el('button', { class: 's9a-go', type: 'submit', text: 'Send link' });
      const f = el('form', { novalidate: true, style: 'display:grid;gap:14px', onsubmit: async e => {
        e.preventDefault(); show(err); show(ok);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) return show(err, 'Please enter a valid email address.');
        await busy(go, async () => { try { await api('/api/forgot', { body: { email: em.value.trim() }, auth: false }); lastEmail = em.value.trim(); show(ok, 'If an account uses this email, a reset link is on its way. It works for 30 minutes.'); } catch (x) { show(err, x.message); } });
      } }, field('Email', em), err, ok, el('div', { class: 's9a-row' }, go, el('button', { type: 'button', class: 's9a-link', text: 'Back to sign in', onclick: () => open('signin') })));
      return { node: card('Security', 'Forgot password', [el('p', { class: 's9a-p', text: "Enter your email and we'll send you a link to choose a new password." }), f]), focus: em };
    },
    reset(o) {
      const pw = pwInput('new-password', 'new-password'), pw2 = pwInput('confirm-password', 'new-password'), err = errBox(), ok = okBox();
      const go = el('button', { class: 's9a-go', type: 'submit', text: 'Save password' });
      const f = el('form', { novalidate: true, style: 'display:grid;gap:14px', onsubmit: async e => {
        e.preventDefault(); show(err);
        if (pw.value.length < 10) return show(err, 'Password: at least 10 characters.');
        if (pw.value !== pw2.value) return show(err, "The two passwords don't match.");
        await busy(go, async () => {
          try { await api('/api/reset', { body: { token: o.token, password: pw.value }, auth: false }); pw.value = pw2.value = ''; f.remove(); show(ok, 'Password saved. You were signed out everywhere, so sign in again with the new one.'); ok.after(el('button', { type: 'button', class: 's9a-go', text: 'Sign in', onclick: () => open('signin') })); }
          catch (x) { show(err, x.message); }
        });
      } }, withEye(field('New password', pw, el('div', { class: 's9a-hint', text: 'At least 10 characters.' }))), field('Repeat it', pw2), err, go);
      return { node: card('Security', 'New password', [f, ok]), focus: pw };
    },
    confirm(o) {
      const box = el('div', { style: 'display:flex;gap:12px;align-items:center' }, el('div', { class: 's9a-spin' }), el('span', { class: 's9a-p', text: 'Confirming your email...' }));
      const c = card('New Foldier', 'Confirming', [box]);
      api('/api/confirm', { body: { token: o.token }, auth: false }).then(r => {
        c.querySelector('.s9a-h').textContent = 'Confirmed';
        box.replaceWith(el('div', { style: 'display:grid;gap:14px' }, el('p', { class: 's9a-p' }, 'Welcome to Sector Nine', r && r.nick ? el('b', { text: ', ' + r.nick }) : '', '. Your account is on. Sign in to start earning XP.'), el('button', { type: 'button', class: 's9a-go', text: 'Sign in', onclick: () => open('signin') })));
      }).catch(x => {
        c.querySelector('.s9a-h').textContent = 'Link expired';
        const e = errBox(); show(e, x.message);
        box.replaceWith(el('div', { style: 'display:grid;gap:14px' }, e, el('p', { class: 's9a-p', text: 'Sign in with your email and password and we will send you a fresh link.' }), el('button', { type: 'button', class: 's9a-go', text: 'Sign in', onclick: () => open('signin') })));
      });
      return { node: c };
    },
    profile(o) {
      if (!TOKEN || !PROFILE) return SCREENS.signin();
      const P = PROFILE, v = lvView(), FP = window.FOLD_PROGRESS, pct = v.li ? Math.max(0, Math.min(100, v.li.frac * 100)) : 0, fmt = n => (n | 0).toLocaleString('en-US');
      const stat = (x, l) => el('div', null, el('b', { text: String(x) }), el('span', { text: l }));
      return { node: card(o && o.welcome ? 'Signed in' : 'Your account', P.nick, [
        el('div', { class: 's9a-prof' }, badge(), el('div', { style: 'min-width:0' }, el('div', { class: 'rk', text: v.prestige ? 'Prestige ' + v.prestige : 'Level ' + v.level }), el('div', { class: 'nm', text: P.nick }))),
        el('div', { class: 's9a-xp' }, el('div', { class: 'bar' }, el('i', { style: 'width:' + pct.toFixed(1) + '%' })), el('div', { class: 't' }, el('span', { text: v.li ? fmt(v.li.xpInLevel) + ' / ' + fmt(v.li.xpForNext) + ' XP' : '' }), el('span', { text: fmt(v.xp) + ' XP total' }))),
        el('div', { class: 's9a-grid' }, stat(fmt(v.clips), '\uD83D\uDCCE Clips'), stat(v.matches | 0, 'Matches'), stat(v.wins | 0, 'Wins'), stat(v.signedIn ? 'Saved' : 'Local', 'Progress')),
        el('p', { class: 's9a-p', text: 'Your level and Clips are kept on your account. Nothing you unlock changes how you play.' }),
        el('div', { class: 's9a-row' }, el('span', { class: 's9a-p', text: P.email || '' }), el('span', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          FP ? el('button', { type: 'button', class: 's9a-ghost', text: 'Progress', onclick: () => { close(); FP.openPanel(); } }) : null,
          el('button', { type: 'button', class: 's9a-ghost', text: 'Sign out', onclick: () => { signOut(); close(); } }))),
      ], true) };
    },
  };
  async function resendLink(email, ok) { try { await api('/api/resend', { body: { email: email || lastEmail }, auth: false }); show(ok, 'If that account still needs confirming, a new link is on its way.'); } catch (x) { show(ok, x.message); } }

  let prevFocus = null;
  function open(name, o) {
    const S = SCREENS[name] || SCREENS.signin;
    if (root.hidden) prevFocus = document.activeElement;
    const r = S(o || {}); screen = name;
    root.textContent = ''; root.appendChild(r.node); root.hidden = false; syncChip();
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    setTimeout(() => { const f = r.focus || root.querySelector('button.s9a-go,.s9a-x'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    if (name === 'profile') refresh().then(() => { if (screen === 'profile' && !root.hidden && PROFILE) { const n = SCREENS.profile(o).node; root.textContent = ''; root.appendChild(n); } });
  }
  let gating = false;   // true while the first-launch question is unanswered: closing any screen goes back to it
  function close() {
    if (gating && !TOKEN && !welcomeDone() && screen !== 'welcome') return open('welcome');
    root.hidden = true; screen = null; root.textContent = ''; syncChip(); if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) {} }

  // #confirm=TOKEN / #reset=TOKEN from the emails: read once, then wipe the token out of the address bar
  function readHash() {
    const m = /^#(confirm|reset)=([A-Za-z0-9_-]{20,80})$/.exec(location.hash || '');
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    open(m[1], { token: m[2] });
  }

  // first launch: ask once per browser (not signed in, not answered yet). Automated test browsers skip it unless
  // window.__s9ForceWelcome is set, so other test suites never find a dialog over the menu.
  function maybeWelcome() {
    if (TOKEN || welcomeDone() || !root.hidden) return;
    if (navigator.webdriver && !window.__s9ForceWelcome) return;
    const go = () => { if (TOKEN || welcomeDone() || !root.hidden) return; gating = true; open('welcome'); };
    if (menuVisible()) go(); else { const m = document.getElementById('menu'); if (m) { const ob = new MutationObserver(() => { if (menuVisible()) { ob.disconnect(); go(); } }); ob.observe(m, { attributes: true, attributeFilter: ['hidden'] }); } }
  }

  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    document.body.appendChild(chip); document.body.appendChild(root);
    renderChip(); placeChip(); syncChip(); fillNick();
    try { narrowMq.addEventListener('change', placeChip); } catch (e) { narrowMq.addListener(placeChip); }
    const m = document.getElementById('menu'); if (m) new MutationObserver(syncChip).observe(m, { attributes: true, attributeFilter: ['hidden'] });
    addEventListener('hashchange', readHash); readHash();
    if (TOKEN) refresh();
    else maybeWelcome();
  }
  mount();

  addEventListener('foldiers:progress', () => { renderChip(); });
  window.S9Account = {
    token: () => TOKEN, profile: () => PROFILE, getProfile: () => PROFILE, base: BASE,
    onChange(fn) { if (typeof fn === 'function') subs.add(fn); return () => subs.delete(fn); },
    api, open, close, refresh, signOut,
    guest: () => (GUEST ? { nick: GUEST.nick } : null), isGuest: () => !TOKEN && !!GUEST, nick: playNick,
    welcome() { gating = !TOKEN && !welcomeDone(); open('welcome'); }, randomName,
  };
})();
