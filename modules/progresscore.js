/* Foldiers progression core: PURE math, no DOM, no I/O. Runs in the browser (window.FOLD_PROG) and in node (module.exports),
   so the game server can require the SAME file to validate a match credit (copy it next to the server; keep it byte-identical).
   Design: docs/PROGRESSION.md. Numbers: data/progression.json is generated from this file (node tools/gen_progression.js).
   Levels 1-100 from lifetime XP (fast early, slower later), then Prestige. Clips (paper clips) = the soft currency. */
(function (root) {
  'use strict';
  const MAX_LEVEL = 100;
  const xpToNext = L => { const r = 250 + 22 * L + 0.55 * L * L; return Math.round(r / 5) * 5; };   // XP from level L to L+1
  const TOTAL = [0, 0]; for (let L = 1; L < MAX_LEVEL; L++) TOTAL[L + 1] = TOTAL[L] + xpToNext(L);
  const XP_AT_MAX = TOTAL[MAX_LEVEL], PRESTIGE_XP = xpToNext(MAX_LEVEL - 1) * 5;   // a prestige block = 5 late levels of XP
  const MAX_PRESTIGE = 10;
  const XP = { kill: 20, headshot: 10, assist: 10, win: 250, loss: 80, draw: 120, objective: 40, mvp: 80, doubleKill: 15, tripleKill: 30, quadKill: 50, streak: 5, firstWinOfDay: 400, challenge: 150 };
  const CLIPS = { play: 10, win: 15, killEvery: 2, killCap: 30, levelUp: 25, levelUpPer2: 1, prestige: 100, firstWinOfDay: 20, challenge: 20, mvp: 5 };
  const LIMITS = { matchXpCap: 1800, matchClipsCap: 120, minSeconds: 45, maxSeconds: 3600, maxKills: 60, maxStreakBonusKills: 10 };

  const TIERS = ['Plain', 'Kraft', 'Blue', 'Red', 'Green', 'Yellow', 'Lined', 'Graph', 'Foil', 'Gold'];   // ribbon paper, a new one every 10 levels
  const tierOf = L => Math.min(9, Math.floor((Math.max(1, L) - 1) / 10));
  const tierName = L => TIERS[tierOf(L)];

  function levelInfo(xp) {
    xp = Math.max(0, Math.floor(+xp || 0));
    if (xp >= XP_AT_MAX) {
      const over = xp - XP_AT_MAX, pr = Math.min(MAX_PRESTIGE, Math.floor(over / PRESTIGE_XP)), inL = pr >= MAX_PRESTIGE ? PRESTIGE_XP : over % PRESTIGE_XP;
      return { level: MAX_LEVEL, xp, prestige: pr, xpInLevel: inL, xpForNext: PRESTIGE_XP, frac: inL / PRESTIGE_XP, tier: tierOf(MAX_LEVEL) };
    }
    let L = 1; while (L < MAX_LEVEL && TOTAL[L + 1] <= xp) L++;
    const inL = xp - TOTAL[L], need = xpToNext(L);
    return { level: L, xp, prestige: 0, xpInLevel: inL, xpForNext: need, frac: inL / need, tier: tierOf(L) };
  }

  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  // XP + Clips for ONE match line {kills, headshots, assists, win, draw, objectives, mvp, multi:{double,triple,quad}, bestStreak, seconds, firstWinOfDay, challenges:int}
  function matchReward(r) {
    r = r || {};
    const kills = n(r.kills, LIMITS.maxKills), hs = Math.min(kills, n(r.headshots, LIMITS.maxKills)), as = n(r.assists, LIMITS.maxKills), ob = n(r.objectives, 20);
    const mu = r.multi || {}, secs = n(r.seconds, LIMITS.maxSeconds), streak = Math.min(n(r.bestStreak, LIMITS.maxKills), kills);
    const parts = {};
    if (kills) parts.kills = kills * XP.kill;
    if (hs) parts.headshots = hs * XP.headshot;
    if (as) parts.assists = as * XP.assist;
    if (ob) parts.objectives = ob * XP.objective;
    parts.result = r.draw ? XP.draw : r.win ? XP.win : XP.loss;
    if (r.mvp) parts.mvp = XP.mvp;
    const mk = n(mu.double, 20) * XP.doubleKill + n(mu.triple, 10) * XP.tripleKill + n(mu.quad, 10) * XP.quadKill; if (mk) parts.multiKills = mk;
    if (streak > 3) parts.streak = Math.min(streak - 3, LIMITS.maxStreakBonusKills) * XP.streak;
    let base = 0; for (const k in parts) base += parts[k];
    const valid = secs >= LIMITS.minSeconds;
    if (!valid) { for (const k in parts) parts[k] = 0; base = 0; }
    const capped = base > LIMITS.matchXpCap;
    if (capped) { const f = LIMITS.matchXpCap / base; for (const k in parts) parts[k] = Math.floor(parts[k] * f); }
    const fw = !!(valid && r.win && !r.draw && r.firstWinOfDay), ch = valid ? n(r.challenges, 3) : 0;
    if (fw) parts.firstWinOfDay = XP.firstWinOfDay;
    if (ch) parts.challenges = ch * XP.challenge;
    let xp = 0; for (const k in parts) xp += parts[k];
    const clipParts = {};
    if (valid) {
      clipParts.match = CLIPS.play;
      if (r.win && !r.draw) clipParts.win = CLIPS.win;
      if (kills) clipParts.kills = Math.min(CLIPS.killCap, Math.floor(kills / CLIPS.killEvery));
      if (r.mvp) clipParts.mvp = CLIPS.mvp;
      if (fw) clipParts.firstWinOfDay = CLIPS.firstWinOfDay;
      if (ch) clipParts.challenges = ch * CLIPS.challenge;
    }
    let clips = 0; for (const k in clipParts) clips += clipParts[k];
    clips = Math.min(LIMITS.matchClipsCap, clips);
    return { xp, parts, clips, clipParts, capped, valid };
  }
  // Clips for every level reached (from+1 .. to): 25 + floor(L/2)
  const levelUpClips = (from, to) => { let c = 0; for (let L = from + 1; L <= to; L++) c += CLIPS.levelUp + Math.floor(L / 2) * CLIPS.levelUpPer2; return c; };

  // apply a reward to an account state {xp}; returns the new lifetime xp, the Clips to add (match + level-ups) and the level change
  function apply(st, reward) {
    const before = levelInfo(st.xp), xp = st.xp + reward.xp, after = levelInfo(xp);
    const gained = Math.max(0, after.level - before.level), pr = Math.max(0, after.prestige - before.prestige);
    const fromClipsLevels = levelUpClips(before.level, after.level) + pr * CLIPS.prestige;
    return { xp, clipsAdd: reward.clips + fromClipsLevels, clipsFromLevels: fromClipsLevels, before, after, levelUp: gained > 0 || pr > 0, levelsGained: gained, prestigeGained: pr };
  }

  // ----- daily challenges: 3 per UTC day, picked deterministically from the date so the server and the client agree
  const POOL = [
    { id: 'k15', text: 'Get 15 kills in one match', stat: 'kills', goal: 15 }, { id: 'k25', text: 'Get 25 kills in one match', stat: 'kills', goal: 25 },
    { id: 'hs5', text: 'Land 5 headshots in one match', stat: 'headshots', goal: 5 }, { id: 'hs10', text: 'Land 10 headshots in one match', stat: 'headshots', goal: 10 },
    { id: 'win1', text: 'Win a match', stat: 'win', goal: 1 }, { id: 'st5', text: 'Get a 5 kill streak', stat: 'bestStreak', goal: 5 },
    { id: 'mk2', text: 'Get a double kill', stat: 'doubles', goal: 1 }, { id: 'pl3', text: 'Play 3 matches', stat: 'plays', goal: 3, sum: true },
  ];
  const utcDay = t => new Date(t == null ? Date.now() : t).toISOString().slice(0, 10);
  function dailyChallenges(day) {
    let h = 2166136261; for (const c of String(day)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const idx = []; while (idx.length < 3) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const i = (h >>> 8) % POOL.length; if (!idx.includes(i)) idx.push(i); }
    return idx.map(i => Object.assign({}, POOL[i]));
  }
  // ids of the challenges this match line completes; prog = {done:[ids], plays:matches already played today}
  function challengeProgress(line, day, prog) {
    prog = prog || {}; const done = prog.done || [], out = [];
    const val = { kills: line.kills | 0, headshots: line.headshots | 0, win: line.win && !line.draw ? 1 : 0, bestStreak: line.bestStreak | 0, doubles: (line.multi && line.multi.double | 0) || 0 };
    for (const c of dailyChallenges(day)) {
      if (done.includes(c.id)) continue;
      if (c.sum) { if ((prog.plays | 0) + 1 >= c.goal) out.push(c.id); } else if (val[c.stat] >= c.goal) out.push(c.id);
    }
    return out;
  }

  // ----- unlock list: cosmetic only (never a skin, never the shop, never gameplay power)
  const U = (lv, kind, id, name) => ({ lv, kind, id, name });
  const UNLOCKS = [
    U(1, 'title', 'rookie', 'Rookie Folder'), U(1, 'banner', 'plain', 'Plain Sheet'), U(1, 'crosshair', 'dot', 'Pin Dot'), U(1, 'flair', 'ribbon_plain', 'Plain Ribbon'), U(1, 'card', 'blank_card', 'Blank Card'),
    U(3, 'crosshair', 'cross', 'Pencil Cross'), U(4, 'card', 'kraft_card', 'Kraft Card'), U(5, 'title', 'crease', 'Crease Maker'), U(6, 'banner', 'graph', 'Graph Paper Banner'), U(8, 'crosshair', 'ring', 'Hole-Punch Ring'),
    U(10, 'title', 'sharp', 'Sharp Edge'), U(10, 'flair', 'ribbon_kraft', 'Kraft Ribbon'), U(12, 'card', 'sticky', 'Sticky Note Card'), U(15, 'banner', 'lined', 'Lined Paper Banner'), U(18, 'crosshair', 'brackets', 'Tape Brackets'),
    U(20, 'title', 'origami', 'Origami Hand'), U(20, 'flair', 'ribbon_blue', 'Blue Ribbon'), U(25, 'card', 'doodle', 'Doodle Card'), U(28, 'banner', 'torn', 'Torn Edge Banner'),
    U(30, 'title', 'scissor', 'Scissor Hand'), U(30, 'flair', 'ribbon_red', 'Red Ribbon'), U(35, 'crosshair', 'chevron', 'Staple Chevron'),
    U(40, 'title', 'paper_trail', 'Paper Trail'), U(40, 'flair', 'ribbon_green', 'Green Ribbon'), U(45, 'card', 'stamp', 'Rubber Stamp Card'),
    U(50, 'title', 'veteran', 'Desk Veteran'), U(50, 'banner', 'blueprint', 'Blueprint Banner'), U(55, 'crosshair', 'tick', 'Tally Tick'),
    U(60, 'flair', 'ribbon_yellow', 'Yellow Ribbon'), U(65, 'card', 'crane', 'Paper Crane Card'), U(70, 'title', 'master', 'Master Folder'),
    U(75, 'banner', 'postal', 'Postal Banner'), U(80, 'flair', 'ribbon_lined', 'Lined Ribbon'), U(85, 'crosshair', 'star', 'Paper Star'),
    U(90, 'title', 'legend', 'Desk Legend'), U(90, 'card', 'foil', 'Foil Card'), U(95, 'banner', 'gilded', 'Gilded Banner'),
    U(100, 'title', 'origami_master', 'Grand Origami Master'), U(100, 'flair', 'ribbon_gold', 'Gold Ribbon'),
  ];
  const unlocksAt = L => UNLOCKS.filter(u => u.lv === L);
  const unlocked = (level, prestige) => UNLOCKS.filter(u => u.lv <= level || prestige > 0);


  // ----- the whole credit step on a plain state object (used by the client for guests AND by the server for accounts, so they cannot drift)
  // st = {xp, clips, clipsTotal, matches, wins, day, dayPlays, dayDone[], dayXp, firstWinDay}; returns {error} or {st, credited, levelBefore, levelAfter, levelUp, prestigeGained, unlocks}
  const DAY_XP_CAP = 12000;
  const newState = () => ({ xp: 0, clips: 0, clipsTotal: 0, matches: 0, wins: 0, day: '', dayPlays: 0, dayDone: [], dayXp: 0, firstWinDay: '' });
  function creditState(st, line, now) {
    const today = utcDay(now), s = Object.assign(newState(), st), same = s.day === today;
    const plays = same ? s.dayPlays | 0 : 0, done = same && Array.isArray(s.dayDone) ? s.dayDone.slice() : [], dayXp = same ? s.dayXp | 0 : 0;
    if (dayXp >= DAY_XP_CAP) return { error: 'Daily XP limit reached. Come back tomorrow.' };
    const fin = (line.seconds | 0) >= LIMITS.minSeconds, newly = fin ? challengeProgress(line, today, { done, plays }) : [];
    const firstWin = fin && !!line.win && !line.draw && s.firstWinDay !== today;
    const reward = matchReward(Object.assign({}, line, { firstWinOfDay: firstWin, challenges: newly.length }));
    const ap = apply({ xp: s.xp }, reward), clipsAdd = fin ? ap.clipsAdd : 0;
    const out = Object.assign({}, s, { xp: s.xp + reward.xp, clips: s.clips + clipsAdd, clipsTotal: s.clipsTotal + clipsAdd, matches: s.matches + (fin ? 1 : 0), wins: s.wins + (fin && line.win && !line.draw ? 1 : 0),
      day: today, dayPlays: plays + (fin ? 1 : 0), dayDone: done.concat(newly), dayXp: dayXp + reward.xp, firstWinDay: firstWin ? today : s.firstWinDay });
    const unlocks = []; for (let i = 0; i < ap.levelsGained; i++) unlocks.push(...unlocksAt(ap.before.level + 1 + i));
    return { st: out, valid: reward.valid, credited: { xp: reward.xp, clips: clipsAdd, parts: reward.parts, clipParts: reward.clipParts, clipsFromLevels: fin ? ap.clipsFromLevels : 0, capped: reward.capped, firstWin, challengesDone: newly },
      levelBefore: ap.before.level, levelAfter: ap.after.level, levelUp: ap.levelUp, levelsGained: ap.levelsGained, prestigeGained: ap.prestigeGained, unlocks };
  }

  const API = { DAY_XP_CAP, newState, creditState, MAX_LEVEL, MAX_PRESTIGE, XP, CLIPS, LIMITS, TOTAL, XP_AT_MAX, PRESTIGE_XP, TIERS, xpToNext, levelInfo, tierOf, tierName, matchReward, levelUpClips, apply, dailyChallenges, challengeProgress, utcDay, POOL, UNLOCKS, unlocksAt, unlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FOLD_PROG = API;
})(typeof window !== 'undefined' ? window : globalThis);
