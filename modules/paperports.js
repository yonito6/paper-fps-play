/* Foldiers paper skin for the add-ons ported from Sector Nine (news, bug report, announcements, touch controls).
   CSS only: remaps the colour variables those modules read (--sodium, --cyan, --ink, --dim, --line, --bg, --alert) to the logo palette and swaps
   their hard-coded dark panels for cream/kraft paper. Accounts (account.js) and the radar (radar.js) carry their own paper styling.
   Loads after the ported modules (modules/manifest.json order). */
(() => {
  'use strict';
  if (window.__paperPorts) return; window.__paperPorts = true;
  const css = `
#s9news,#s9bug,#s9bug-aim,#s9bug-toast,#s9ann,#s9touch,.s9t{--sodium:#0b3f9a;--cyan:#0b3f9a;--ink:#22150c;--dim:#4e3420;--line:rgba(43,28,14,.42);--bg:#f4e9d2;--alert:#b11912;--display:"Changa One","Arial Black",sans-serif;--mono:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif}
#s9news{background:radial-gradient(ellipse at center,rgba(42,26,12,.5),rgba(30,18,8,.78));backdrop-filter:none;color:#22150c}
#s9news .s9n-box{background:var(--face-kraft,#c69b62);border:2px solid #2b1c0e;border-radius:4px;box-shadow:4px 6px 0 rgba(43,28,14,.4);color:#22150c}
#s9news .s9n-head{border-bottom:2px dashed rgba(43,28,14,.45)}
#s9news h2,#s9news h3{font-style:italic;font-weight:400;text-transform:none}
#s9news .s9n-kick{color:#8a2217;font-weight:800}
#s9news .s9n-card{background:rgba(255,250,238,.62);border:2px solid rgba(43,28,14,.5);border-radius:3px;color:#22150c}
#s9news .s9n-card.s9n-big{background:rgba(255,250,238,.85);border-color:#0b3f9a}
#s9news .s9n-card.s9n-big::before{background:#0b3f9a}
#s9news .s9n-tag{color:#fff3da;background:#b11912;border-radius:2px}#s9news .s9n-new{color:#0b3f9a;border-color:#0b3f9a}
#s9news .s9n-x{border:2px solid #2b1c0e;color:#22150c;border-radius:3px}
#s9news li,#s9news .s9n-meta{color:#3a2a18}
#btnNews .s9n-dot{background:#b11912!important;color:#fff3da!important}
#s9bug{background:linear-gradient(90deg,rgba(42,26,12,.9) 0 50%,rgba(42,26,12,.55));color:#22150c}
#s9bug .s9b-sheet{background:var(--face-kraft,#c69b62);border:2px solid #2b1c0e;border-radius:4px;padding:20px 24px;box-shadow:4px 6px 0 rgba(43,28,14,.4);max-height:calc(100vh - 40px);overflow:auto}
#s9bug h2{font-style:italic;font-weight:400}#s9bug .s9b-kicker{color:#8a2217;font-weight:800}
#s9bug input[type=text],#s9bug select,#s9bug textarea{background:rgba(255,250,238,.85);color:#22150c;border:2px solid #2b1c0e;border-radius:3px;font-weight:600}
#s9bug .s9b-pins{background:rgba(255,250,238,.5);border:2px dashed rgba(43,28,14,.45)}
#s9bug pre{background:rgba(255,250,238,.7);color:#22150c}
#s9bug .s9b-go{background:var(--face-blue,#0b3f9a);color:#f8d0a4;font-style:italic;font-weight:400;text-transform:none;border:2px solid #013587;border-radius:4px;clip-path:none}
#s9bug .s9b-go:hover{filter:brightness(1.12);background:var(--face-blue,#0b3f9a)}
#s9bug .s9b-ghost{border:2px solid #2b1c0e;border-radius:3px;color:#22150c;font-weight:800}
#s9bug .s9b-msg.ok{color:#1c5a37}
#s9bug-toast{background:var(--face-cream,#f4e9d2);color:#22150c;border:2px solid #2b1c0e;border-radius:3px}
#s9bug-aim .s9b-hint{background:var(--face-cream,#f4e9d2);color:#22150c;border:2px solid #2b1c0e}
#s9bug-aim .s9b-cross{border-color:#b11912}#s9bug-aim .s9b-cross::before,#s9bug-aim .s9b-cross::after{background:#b11912}
#btnBug,#btnBugMenu{font-weight:800}
#s9Announce{background:var(--face-cream,#f4e9d2)!important;border:2px solid #2b1c0e!important;border-left:6px solid #b11912!important;border-radius:3px!important;color:#22150c!important;box-shadow:3px 4px 0 rgba(43,28,14,.4)!important;font:700 15px/1.35 "Barlow Semi Condensed","Arial Narrow",sans-serif!important}
#s9Announce b{color:#b11912!important;font:400 17px/1 "Changa One","Arial Black",sans-serif!important;font-style:italic;text-transform:none!important}#s9Announce button{color:#22150c!important}
#s9t .b{background:rgba(244,233,210,.5)!important;border:3px solid rgba(43,28,14,.75)!important;color:#22150c!important;font:800 12px/1 "Barlow Semi Condensed","Arial Narrow",sans-serif!important}
#s9t .b.dn,#s9t .b.tg{background:rgba(11,63,154,.6)!important;border-color:#0b3f9a!important;color:#fff3da!important}
#s9tBase{border:3px solid rgba(43,28,14,.55)!important;background:rgba(244,233,210,.3)!important}#s9tBase.act{background:rgba(244,233,210,.5)!important}
`;
  const st = document.createElement('style'); st.id = 'paperports-css'; st.textContent = css; document.head.appendChild(st);
  // the announcement banner (modules/announce.js builds a fixed box on its own id-less element): restyle by tag marker it sets, if any
  window.PAPER_PORTS = { css: true };
})();
