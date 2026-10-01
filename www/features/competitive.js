import { mulberry32 } from '../core.js';

export const BOARDS = { daily: 'deadzone.daily', dailyRookie: 'deadzone.daily.rookie', weekly: 'deadzone.weekly', alltime: 'deadzone.highscore', sprint: 'deadzone.sprint20', extract: 'deadzone.extract' };
export const SPRINT_WAVE = 20, DAILY_WAVES = 10, ROOKIE_LEVEL = 10, ROOKIE_DIFFICULTY = 'survivor';
export const LEAGUE_REWARDS = { bronze: 200, silver: 400, gold: 800, platinum: 1500, diamond: 2500, legend: 4000 };
export const DAILY_DIFFICULTY = 'veteran';
const BOARD_OF = { daily: 'daily', ranked: 'weekly', normal: 'alltime', extract: 'extract' };
const BOARD_NAME = { daily: 'DAILY', weekly: 'WEEKLY', alltime: 'ALL-TIME', sprint: 'SPRINT 20', extract: 'EXTRACT' };
export const EXTRACT_MAX_MULT = 2;
const DAY = 864e5, WINDOW = 30;

export const LEAGUES = [
  { id: 'legend', name: 'LEGEND', icon: '♛', color: '#ff6ad5', rule: 'TOP 100' },
  { id: 'diamond', name: 'DIAMOND', icon: '◆', color: '#7fe8ff', max: .03, rule: 'TOP 3%' },
  { id: 'platinum', name: 'PLATINUM', icon: '⬢', color: '#bff5e3', max: .10, rule: 'TOP 10%' },
  { id: 'gold', name: 'GOLD', icon: '⬣', color: '#ffc34d', max: .25, rule: 'TOP 25%' },
  { id: 'silver', name: 'SILVER', icon: '⬣', color: '#cfd8dc', max: .50, rule: 'TOP 50%' },
  { id: 'bronze', name: 'BRONZE', icon: '⬣', color: '#d8925a', max: 1, rule: 'RANKED' },
];
const UNRANKED = { id: 'unranked', name: 'UNRANKED', icon: '○', color: '#9aa9ab', rule: '' };

export function leagueFor(rank, total) {
  if (!rank || !total) return null;
  const pct = Math.min(1, rank / total);
  if (rank <= 100 && pct <= .03) return LEAGUES[0];
  return LEAGUES.slice(1).find(l => pct <= l.max);
}

export const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const leagueRank = id => { const i = LEAGUES.findIndex(l => l.id === id); return i < 0 ? -1 : LEAGUES.length - 1 - i; };
export function sprintTime(cs) {
  const t = Math.max(0, Math.round(cs)), m = Math.floor(t / 6000), sec = Math.floor(t / 100) % 60, h = t % 100;
  return m + ':' + String(sec).padStart(2, '0') + '.' + String(h).padStart(2, '0');
}
export function settleWeek(c, thisWeek) {
  const l = c.league;
  if (!l || !l.week || l.week >= thisWeek || c.paidWeek === l.week) return null;
  const prev = c.held;
  const lastWeek = utcDay(Date.parse(thisWeek + 'T00:00:00Z') - 7 * DAY);
  const prevRank = prev && prev.week === utcDay(Date.parse(l.week + 'T00:00:00Z') - 7 * DAY) ? leagueRank(prev.id) : -1;
  c.held = { id: l.id, week: l.week };
  c.paidWeek = l.week;
  const now = leagueRank(l.id);
  return { id: l.id, week: l.week, scrap: LEAGUE_REWARDS[l.id] || 0, move: prevRank < 0 ? 'new' : now > prevRank ? 'up' : now < prevRank ? 'down' : 'same', from: prevRank < 0 ? null : prev.id, current: l.week === lastWeek };
}
export function weekStart(t = Date.now()) { const d = Math.floor(t / DAY); return (d - (d + 3) % 7) * DAY; }
export function nextReset(board, t = Date.now()) { return board === 'daily' ? (Math.floor(t / DAY) + 1) * DAY : weekStart(t) + 7 * DAY; }
export function timeLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return d ? d + 'D ' + h + 'H' : h ? h + 'H ' + (m % 60) + 'M' : Math.max(1, m) + 'M';
}

export const dailyBracket = level => (level < ROOKIE_LEVEL ? 'rookie' : 'veteran');
export function dailyChallenge(api, date = utcDay(), level = api.levelInfo().level) {
  const seed = api.hashSeed('daily-' + date), r = mulberry32(seed ^ 0x5bd1e995), bracket = dailyBracket(level);
  const pool = api.WEAPONS.filter(w => !w.premium);
  const a = pool[(r() * pool.length) | 0], rest = pool.filter(w => w !== a), b = rest[(r() * rest.length) | 0];
  const maps = Array.isArray(api.MAPS) && api.MAPS.length ? api.MAPS : null;
  const map = maps ? maps[(r() * maps.length) | 0] : null;
  return { date, seed, bracket, difficulty: bracket === 'rookie' ? ROOKIE_DIFFICULTY : DAILY_DIFFICULTY, slots: [api.weaponIndex(a.id), api.weaponIndex(b.id)], map, waves: DAILY_WAVES };
}

export function rankedLoadout(api) {
  const slots = [...api.loadoutWeapons()], swapped = [];
  const m4 = api.weaponIndex('m4'), r870 = api.weaponIndex('r870');
  slots.forEach((i, k) => { if (api.WEAPONS[i].premium) { swapped.push(api.WEAPONS[i].name); slots[k] = -1; } });
  slots.forEach((i, k) => { if (i < 0) slots[k] = (k ? [r870, m4] : [m4, r870]).find(x => x !== slots[1 - k]); });
  return { slots, swapped };
}

export function plausible(run, api, now = Date.now()) {
  const num = v => Number.isFinite(v) && v >= 0;
  if (![run.score, run.wave, run.kills, run.heads, run.time].every(num) || !Number.isInteger(run.score)) return 'INVALID RUN DATA';
  const D = api.DIFFICULTIES[run.difficultyId];
  if (!D) return 'UNKNOWN DIFFICULTY';
  const start = run.startWave ?? 1, played = run.wave - start + 1;
  if (!Number.isInteger(start) || start < 1 || played < 1) return 'INVALID START WAVE';
  if (start > 1 && run.type !== 'normal') return 'CHECKPOINT START IN A FAIR-PLAY RUN';
  if (run.wave > 999 || run.heads > run.kills) return 'IMPOSSIBLE STATS';
  if (run.kills > played * 160 + 40) return 'TOO MANY KILLS FOR WAVE ' + run.wave;
  if (run.time < (played - 1) * 2 || run.kills > run.time * 25 + 30) return 'RUN TOO FAST';
  const bosses = Math.min(run.bosses?.length || 0, Math.floor(run.wave / 5) - Math.floor((start - 1) / 5) + 1);
  const cap = (125 * (run.wave * (run.wave + 1) - start * (start - 1)) + run.kills * 7100 * D.score + bosses * 94000 * D.score) * 1.5 + 1000;
  if (run.score > cap * (run.type === 'extract' ? EXTRACT_MAX_MULT : 1)) return 'SCORE TOO HIGH FOR THIS RUN';
  if (run.type === 'daily' || run.type === 'ranked') {
    if ((run.slots || []).some(i => api.WEAPONS[i]?.premium)) return 'PREMIUM WEAPON IN A FAIR-PLAY RUN';
  }
  if (run.type === 'daily') {
    const today = dailyChallenge(api, utcDay(now));
    if (![DAILY_DIFFICULTY, ROOKIE_DIFFICULTY].includes(run.difficultyId) || (run.slots || []).join() !== today.slots.join()) return 'NOT THE DAILY LOADOUT';
    if (run.seed !== today.seed) return 'DAILY CHALLENGE ALREADY RESET';
    if (run.wave > DAILY_WAVES) return 'THE DAILY IS ' + DAILY_WAVES + ' WAVES';
  }
  return null;
}

const CSS = `
.cm-mode{padding:9px 13px;font-size:11px;letter-spacing:1.6px;display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;line-height:1.1}
.cm-mode small{font:700 8.5px var(--ui);letter-spacing:1.2px;color:var(--amber)}
.cm-mode.ranked small{color:#7fe8ff}
.cm-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:20px;border:1px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c);font:900 11px var(--ui);letter-spacing:1.6px;white-space:nowrap}
.cm-badge i{font-style:normal;font-size:13px}
button.cm-badge{cursor:pointer}
#comp-sheet{background:#010406c4;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.cm-panel{width:min(94vw,600px)}
.cm-panel h2{margin-bottom:4px}
.cm-sub{margin:0 0 12px;color:var(--amber);font:800 10px var(--ui);letter-spacing:2px}
.cm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px;text-align:left}
.cm-grid div{padding:8px 10px;border-radius:10px;background:#ffffff0a;border:1px solid var(--line);min-width:0}
.cm-grid b{display:block;font:900 16px var(--display);letter-spacing:.6px}
.cm-grid small{font:800 8.5px var(--ui);letter-spacing:1.4px;color:var(--dim);white-space:nowrap}
.cm-note{margin:0 0 8px;color:var(--amber);font:800 11px var(--ui);letter-spacing:1px}
.cm-note:empty{display:none}
.cm-rules{margin:0 0 14px;color:var(--dim);font:600 11px/1.5 var(--ui);letter-spacing:.3px}
.cm-ladder{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin:0 0 12px}
.cm-ladder span{padding:3px 8px;border-radius:12px;border:1px solid var(--line);color:var(--c);font:800 9px var(--ui);letter-spacing:1px;opacity:.6}
.cm-ladder span.on{opacity:1;border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
.cm-panel .row{justify-content:center}
.cm-seg{display:flex;gap:4px;margin:0 0 8px;padding:3px;border-radius:11px;background:#ffffff08;border:1px solid var(--line)}
.cm-seg button{flex:1;padding:7px 4px;border-radius:8px;border:0;background:none;font:800 10px var(--ui);letter-spacing:1.4px;color:var(--dim)}
.cm-seg button.on{background:#ffffff1c;color:var(--ink)}
.cm-board-note{margin:-2px 0 8px;color:var(--amber);font:800 9px var(--ui);letter-spacing:1.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-rival{display:flex;flex-direction:column;align-items:center;padding:5px 12px;border-radius:10px;background:#050b0e99;border:1px solid var(--line);white-space:nowrap;font:800 11px var(--ui);letter-spacing:1.2px;color:#dfe9e6}
.cm-rival .cm-line{display:flex;gap:5px;align-items:baseline;max-width:62vw}
.cm-rival b{color:var(--green);font:900 14px var(--display);letter-spacing:.6px}
.cm-rival .cm-name{color:#fff;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cm-rival small{font:700 8.5px var(--ui);letter-spacing:1.4px;color:var(--dim);margin-top:1px}
.cm-rival.lead b{color:var(--amber)}
.cm-rival.pop{animation:cm-pop .6s ease-out}
@keyframes cm-pop{0%{transform:scale(1);border-color:var(--green);box-shadow:0 0 0 #6dffa000}30%{transform:scale(1.14);border-color:var(--green);box-shadow:0 0 22px #6dffa088}100%{transform:scale(1)}}
#hud:has(#bossbar:not(.hidden)) #hud-rival{top:calc(max(12px,var(--st)) + 96px)}
.cm-pay{position:fixed;inset:0;z-index:35;display:grid;place-items:center;background:#010406b0;padding:16px}
.cm-pay-card{width:min(340px,90vw);padding:18px 18px 16px;border-radius:18px;background:#081115f8;border:1px solid #ffc34d66;box-shadow:0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center;animation:pgIn .35s cubic-bezier(.2,1.4,.4,1) both}
.cm-pay-card small{font:900 10px var(--ui);letter-spacing:2px;color:var(--amber)}
.cm-pay-card h3{margin:0;font:900 28px/1 var(--display);letter-spacing:1.5px}
.cm-pay-card p{margin:0;font:800 11px var(--ui);letter-spacing:1.2px}
.cm-pay-card p.dim{color:var(--dim);font-size:10px}
.cm-pay-card .cta{margin-top:6px;padding:12px 30px}
.cm-over{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.cm-over span:last-child{color:var(--dim);font:800 10px var(--ui);letter-spacing:1.4px}
@media (max-height:430px) and (orientation:landscape){#board .panel{width:min(94vw,640px);display:grid;grid-template-columns:1fr 1fr;column-gap:8px}#board .panel>*{grid-column:1/-1;order:3}#board .panel>h2{order:0}#board .panel>#cm-boards{grid-column:1;order:1;margin-bottom:6px}#board .panel>.tabs{grid-column:2;order:2;margin-bottom:6px}#board-list{max-height:30vh}}
@media (max-height:430px){.cm-grid{gap:5px;margin-bottom:8px}.cm-grid div{padding:5px 9px}.cm-grid b{font-size:14px}.cm-sub{margin-bottom:8px}.cm-rules{margin-bottom:10px;font-size:10px}.cm-ladder{margin-bottom:8px}.cm-over{margin:-4px 0 8px}.cm-mode{padding:7px 11px}}
@media (orientation:landscape){.cm-rival .cm-line{max-width:calc(100vw - 2 * min(34vw,230px) - 2 * max(14px,var(--sl),var(--sr)) - 48px)}}
@media (orientation:landscape) and (max-width:760px){.cm-rival{padding:4px 9px;letter-spacing:.8px}.cm-rival .cm-line{max-width:calc(100vw - 2 * min(30vw,230px) - 2 * max(14px,var(--sl),var(--sr)) - 40px)}}
@media (orientation:portrait){#hud-rival{top:calc(max(12px,var(--st)) + 120px)}#hud:has(#bossbar:not(.hidden)) #hud-rival{top:calc(max(12px,var(--st)) + 150px)}.cm-rival .cm-line{max-width:80vw}.cm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cm-grid .wide{grid-column:span 2}#menu-modes{justify-content:center}}
`;

export const id = 'competitive';

export function init(api) {
  const { $, bus, gameCenter: gc } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const comp = () => (api.profile.competitive ||= { league: null, daily: null, weekly: null, resets: {} });
  comp();
  gc.guard = run => plausible(run, api);

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n).toLocaleString();
  const boardId = b => (b === 'daily' && dailyBracket(api.levelInfo().level) === 'rookie' ? BOARDS.dailyRookie : BOARDS[b]);
  const resetIn = board => { const t = comp().resets[boardId(board)]; return timeLeft((t && t > Date.now() ? t : nextReset(board)) - Date.now()); };
  const signedIn = async () => gc.available() && (gc.player || await gc.signIn());
  const loadBoard = async (board, opts = {}) => {
    const r = await gc.call('loadScores', { leaderboardId: boardId(board), ...opts });
    if (r?.nextStart) comp().resets[boardId(board)] = r.nextStart;
    return r;
  };
  const weekKey = () => utcDay(weekStart());
  const currentLeague = () => { const l = comp().league; return l && l.week === weekKey() ? l : null; };
  function setLeague(rank, total) {
    const lg = leagueFor(rank, total);
    comp().league = lg ? { id: lg.id, rank, total, pct: rank / total, week: weekKey(), at: Date.now() } : null;
    api.saveProfile();
    renderMenu();
    return lg;
  }
  const leagueOf = l => (l && LEAGUES.find(x => x.id === l.id)) || UNRANKED;
  function badge(l, tag = 'span') {
    const lg = leagueOf(l), b = el(tag, 'cm-badge');
    b.style.setProperty('--c', lg.color);
    b.append(el('i', '', lg.icon), document.createTextNode(lg.name));
    return b;
  }
  function heldRank() {
    const c = comp(), lastWeek = utcDay(weekStart() - 7 * DAY), held = c.held?.week === lastWeek ? leagueRank(c.held.id) : -1;
    return Math.max(held, leagueRank(currentLeague()?.id));
  }
  api.reqs.league = {
    met: id => heldRank() >= leagueRank(id),
    text: id => 'FINISH A WEEK IN ' + (LEAGUES.find(l => l.id === id)?.name || id.toUpperCase()) + '+ (KEEP IT BY STAYING THERE)',
  };
  function payWeek() {
    const res = settleWeek(comp(), weekKey());
    if (!res) return null;
    const lg = LEAGUES.find(l => l.id === res.id);
    if (res.scrap) api.grantScrap(res.scrap);
    if (leagueRank(res.id) >= leagueRank('diamond')) { const k = 'gun:' + api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'league:diamond'); if (!api.profile.fresh.includes(k)) api.profile.fresh.push(k); }
    api.saveProfile();
    api.refreshProfileUI();
    const headline = res.move === 'up' ? 'PROMOTED' : res.move === 'down' ? 'RELEGATED' : 'WEEK COMPLETE';
    api.queueModal(done => {
      const wrap = el('div', 'cm-pay'), card = el('div', 'cm-pay-card'), b = badge({ id: res.id });
      const ok = el('button', 'cta', 'COLLECT');
      card.append(el('small', '', 'RANKED WEEKLY · ' + headline), b,
        el('h3', '', lg.name + ' LEAGUE'),
        el('p', '', (res.from && res.move !== 'same' ? LEAGUES.find(x => x.id === res.from).name + ' → ' + lg.name + ' · ' : '') + '+' + fmt(res.scrap) + ' 🔩 SCRAP' + (leagueRank(res.id) >= leagueRank('diamond') ? ' · DIAMOND LEAGUE SKIN' : '')),
        el('p', 'dim', leagueRank(res.id) >= leagueRank('diamond') ? 'STAY DIAMOND OR LEGEND TO KEEP THE SKIN.' : 'REACH DIAMOND TO EARN THE DIAMOND LEAGUE SKIN.'), ok);
      wrap.appendChild(card);
      document.body.appendChild(wrap);
      ok.onclick = () => { wrap.remove(); api.sfx.pickup?.(); api.haptic('MEDIUM'); done(); };
    }, 2);
    bus.emit('league:settled', res);
    return res;
  }

  const pctText = l => l && l.pct <= .5 ? 'TOP ' + Math.max(1, Math.ceil(l.pct * 100)) + '%' : '';

  async function refreshLeague() {
    if (!(await signedIn())) return currentLeague();
    try { const r = await loadBoard('weekly', { count: 1 }); return r.player ? (setLeague(r.player.rank, r.total), currentLeague()) : setLeague(0, 0); } catch { return currentLeague(); }
  }

  const daily = () => dailyChallenge(api);
  const dailyOpts = () => { const d = daily(); return { type: 'daily', seed: d.seed, difficulty: d.difficulty, slots: d.slots, maxWave: d.waves, ...(d.map ? { map: d.map.id } : {}), replay: dailyOpts }; };
  const rankedOpts = () => ({ type: 'ranked', difficulty: api.settings.difficulty, slots: rankedLoadout(api).slots, replay: rankedOpts });
  const slotNames = slots => slots.map(i => api.WEAPONS[i].name).join(' + ');

  const modes = $('#menu-modes');
  const dailyBtn = el('button', 'ghost cm-mode'), rankedBtn = el('button', 'ghost cm-mode ranked');
  dailyBtn.id = 'cm-daily'; rankedBtn.id = 'cm-ranked';
  const dailySmall = el('small'), rankedSmall = el('small', '', 'NO PREMIUM GUNS · WEEKLY');
  dailyBtn.append(el('span', '', '📅 DAILY'), dailySmall);
  rankedBtn.append(el('span', '', '⚔ RANKED'), rankedSmall);
  let leagueBtn = null;
  modes.append(dailyBtn, rankedBtn);
  function renderMenu() {
    dailySmall.textContent = DAILY_WAVES + ' WAVES · ' + api.DIFFICULTIES[daily().difficulty].name + ' · NEW IN ' + resetIn('daily');
    const nb = badge(currentLeague(), 'button');
    nb.id = 'cm-league';
    nb.setAttribute('aria-label', 'League');
    nb.onclick = () => openBoard('weekly');
    if (leagueBtn) leagueBtn.replaceWith(nb); else modes.appendChild(nb);
    leagueBtn = nb;
  }
  renderMenu();

  const sheet = el('section', 'screen');
  sheet.id = 'comp-sheet';
  const panel = el('div', 'panel cm-panel'), title = el('h2'), sub = el('div', 'cm-sub'), grid = el('div', 'cm-grid'), note = el('div', 'cm-note'), ladder = el('div', 'cm-ladder'), rules = el('div', 'cm-rules');
  const row = el('div', 'row'), go = el('button', 'cta', 'START'), back = el('button', 'ghost', 'BACK');
  go.id = 'cm-go'; back.id = 'cm-back';
  row.append(go, back);
  panel.append(title, sub, grid, note, ladder, rules, row);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
  api.registerScreen(sheet);
  back.onclick = () => api.showScreen(api.ui.menu);
  let sheetMode = null, sheetToken = 0;
  const cells = {};
  function setCells(list) {
    grid.replaceChildren();
    for (const [k, label, value] of list) { const c = el('div', k === 'loadout' ? 'wide' : ''), b = el('b', '', value); c.append(b, el('small', '', label)); grid.appendChild(c); cells[k] = b; }
  }
  const setCell = (k, v) => { if (cells[k]) cells[k].textContent = v; };
  function renderLadder(active) {
    ladder.replaceChildren(...[...LEAGUES].reverse().map(l => { const s = el('span', l.id === active ? 'on' : '', l.name + (l.id === 'bronze' ? '' : ' · ' + l.rule)); s.style.setProperty('--c', l.color); return s; }));
  }

  function openDaily() {
    const d = daily(), c = comp(), mine = c.daily?.date === d.date ? c.daily : null, token = ++sheetToken;
    sheetMode = 'daily';
    title.textContent = 'DAILY CHALLENGE';
    const rookie = d.bracket === 'rookie';
    sub.textContent = new Date(d.date + 'T00:00:00Z').toUTCString().slice(0, 11).toUpperCase() + (rookie ? ' · ROOKIE BRACKET' : ' · SAME RUN FOR EVERY SURVIVOR');
    setCells([
      ['loadout', 'ASSIGNED LOADOUT', slotNames(d.slots)],
      ['diff', 'DIFFICULTY', api.DIFFICULTIES[d.difficulty].name + (rookie ? ' · ROOKIE' : ' · x' + api.DIFFICULTIES[d.difficulty].score)],
      ['format', 'FORMAT', d.waves + ' WAVES'],
      ...(d.map ? [['map', 'MAP', String(d.map.name || d.map.id).toUpperCase()]] : []),
      ['reset', 'RESETS IN', resetIn('daily')],
      ['best', 'BEST TODAY', mine?.best ? fmt(mine.best) : '—'],
      ['rank', 'YOUR RANK', mine?.rank ? '#' + fmt(mine.rank) + ' / ' + fmt(mine.total) : gc.available() ? '…' : 'iOS APP'],
      ['tries', 'ATTEMPTS TODAY', String(mine?.attempts || 0)],
    ]);
    note.textContent = '';
    ladder.replaceChildren();
    rules.textContent = d.waves + ' WAVES. SAME SEED, HORDE, PERKS AND GUNS FOR EVERYONE. NO PREMIUM WEAPONS. CLEAR WAVE ' + d.waves + ' TO BANK YOUR SCORE — A DEATH COUNTS TOO. RETRY AS OFTEN AS YOU LIKE; YOUR BEST SCORE COUNTS. NEW CHALLENGE AT 00:00 UTC.' + (rookie ? ' ROOKIE BRACKET: UNDER LEVEL ' + ROOKIE_LEVEL + ' YOU PLAY ON SURVIVOR AND RANK AGAINST OTHER ROOKIES.' : '');
    go.textContent = 'START DAILY';
    go.onclick = () => api.startGame(dailyOpts());
    api.showScreen(sheet);
    (async () => {
      if (!(await signedIn())) { if (gc.available()) setCell('rank', '—'); return; }
      try {
        const r = await loadBoard('daily', { count: 1 });
        if (token !== sheetToken) return;
        setCell('reset', resetIn('daily'));
        if (r.player) {
          comp().daily = { date: d.date, best: Math.max(mine?.best || 0, r.player.score), rank: r.player.rank, total: r.total };
          api.saveProfile();
          setCell('best', fmt(comp().daily.best));
          setCell('rank', '#' + fmt(r.player.rank) + ' / ' + fmt(r.total));
        } else setCell('rank', '—');
      } catch { if (token === sheetToken) setCell('rank', '—'); }
    })();
  }

  function openRanked() {
    const { slots, swapped } = rankedLoadout(api), c = comp(), l = currentLeague(), D = api.DIFFICULTIES[api.settings.difficulty], token = ++sheetToken;
    const wk = c.weekly?.week === weekKey() ? c.weekly : null;
    sheetMode = 'ranked';
    title.textContent = 'RANKED';
    sub.textContent = 'WEEKLY LEAGUE · RESETS IN ' + resetIn('weekly');
    setCells([
      ['loadout', 'YOUR LOADOUT', slotNames(slots)],
      ['diff', 'DIFFICULTY', D.name + ' · x' + D.score],
      ['league', 'LEAGUE', leagueOf(l).name + (pctText(l) ? ' · ' + pctText(l) : '')],
      ['rank', 'WEEKLY RANK', l ? '#' + fmt(l.rank) + ' / ' + fmt(l.total) : gc.available() ? '…' : 'iOS APP'],
      ['best', 'BEST THIS WEEK', wk?.best ? fmt(wk.best) : '—'],
      ['reset', 'RESETS IN', resetIn('weekly')],
    ]);
    note.textContent = swapped.length ? swapped.join(' + ') + (swapped.length > 1 ? ' ARE' : ' IS') + ' OFF IN RANKED — USING ' + slotNames(slots) : '';
    renderLadder(l?.id);
    rules.textContent = 'FAIR PLAY: iOS EXCLUSIVE WEAPONS ARE OFF, SCRAP WEAPONS ARE ALLOWED. SCORES GO TO THE WEEKLY BOARD AND SET YOUR LEAGUE. NORMAL DEPLOY KEEPS EVERY WEAPON AND COUNTS FOR THE ALL-TIME BOARD.';
    go.textContent = 'START RANKED';
    go.onclick = () => {
      api.startGame(rankedOpts());
      if (swapped.length) api.toast('RANKED: ' + swapped.join(' + ') + ' OFF — USING ' + slotNames(api.player.slots), 2.6);
    };
    api.showScreen(sheet);
    refreshLeague().then(nl => {
      if (token !== sheetToken) return;
      setCell('league', leagueOf(nl).name + (pctText(nl) ? ' · ' + pctText(nl) : ''));
      setCell('rank', nl ? '#' + fmt(nl.rank) + ' / ' + fmt(nl.total) : gc.available() ? '—' : 'iOS APP');
      setCell('reset', resetIn('weekly'));
      renderLadder(nl?.id);
    });
  }
  dailyBtn.onclick = openDaily;
  rankedBtn.onclick = openRanked;
  setInterval(() => {
    if (api.activeScreen === api.ui.menu) renderMenu();
    if (api.activeScreen === sheet) setCell('reset', resetIn(sheetMode === 'daily' ? 'daily' : 'weekly'));
  }, 30000);

  const boardPanel = $('#board .panel'), seg = el('div', 'cm-seg'), boardNote = el('div', 'cm-board-note');
  seg.id = 'cm-boards';
  let boardSel = 'alltime';
  const filters = {
    daily: r => r.type === 'daily' && r.seed === daily().seed,
    weekly: r => r.type === 'ranked' && r.date >= weekStart(),
    alltime: null,
    sprint: null,
    extract: r => r.type === 'extract',
  };
  const sprintRows = () => (comp().sprint || []).map(x => ({ title: (api.DIFFICULTIES[x.diff]?.name || 'SURVIVOR') + ' · ' + sprintTime(x.cs), sub: new Date(x.date).toLocaleDateString(), score: x.cs, code: x.code }));
  for (const b of ['daily', 'weekly', 'alltime', 'extract', 'sprint']) {
    const btn = el('button', '', BOARD_NAME[b]);
    btn.dataset.board = b;
    btn.onclick = () => { selectBoard(b); api.renderBoard(); };
    seg.appendChild(btn);
  }
  boardPanel.querySelector('h2').after(seg, boardNote);
  function selectBoard(b) {
    boardSel = b;
    api.boardView.id = boardId(b);
    api.boardView.filter = filters[b];
    api.boardView.format = b === 'sprint' ? sprintTime : null;
    api.boardView.local = b === 'sprint' ? sprintRows : null;
    api.boardView.empty = b === 'sprint' ? 'No sprint yet — clear wave ' + SPRINT_WAVE + ' from wave 1 in a normal or ranked run.' : null;
    for (const btn of seg.children) btn.classList.toggle('on', btn.dataset.board === b);
    const l = currentLeague();
    boardNote.textContent = b === 'daily' ? 'DAILY CHALLENGE RUNS · RESETS IN ' + resetIn('daily')
      : b === 'weekly' ? (l ? leagueOf(l).name + ' LEAGUE · ' : '') + 'RANKED RUNS · NO PREMIUM WEAPONS · RESETS IN ' + resetIn('weekly')
      : b === 'sprint' ? 'FASTEST TIME TO CLEAR WAVE ' + SPRINT_WAVE + ' · FROM WAVE 1 · LOWER IS BETTER'
      : b === 'extract' ? 'EXTRACTION RUNS · BANKED SCORES · NEVER RESETS'
      : 'EVERY RUN · ALL WEAPONS · NEVER RESETS';
  }
  function openBoard(b) {
    selectBoard(b);
    document.querySelector('#menu [data-open="board"]').click();
  }
  selectBoard('alltime');
  bus.on('screen', ({ id }) => {
    if (id === 'board') selectBoard(boardSel);
    if (id === 'menu') renderMenu();
  });

  const rv = { active: false, token: 0, entries: [], idx: 0, top: 1, source: 'local', loading: false, board: 'alltime', ready: false };
  const hudRival = $('#hud-rival'), box = el('div', 'cm-rival'), line = el('div', 'cm-line'), arrow = el('span'), gap = el('b'), mid = el('span'), nameEl = el('span', 'cm-name'), rsub = el('small');
  line.append(arrow, gap, mid, nameEl);
  box.append(line, rsub);
  function renderRival() {
    if (!rv.active || !rv.ready) { hudRival.replaceChildren(); return; }
    if (!box.isConnected) hudRival.appendChild(box);
    const t = rv.entries[rv.idx], score = api.state.score || 0;
    box.classList.toggle('lead', !t);
    if (t) {
      arrow.textContent = '▲';
      gap.textContent = fmt(t.score - score + 1);
      mid.textContent = 'TO PASS';
      nameEl.textContent = t.name;
      rsub.textContent = (rv.source === 'gc' ? '#' + fmt(t.rank) + ' · ' : 'MY RUNS · ') + BOARD_NAME[rv.board];
    } else {
      arrow.textContent = '★';
      gap.textContent = '';
      nameEl.textContent = '';
      mid.textContent = rv.source === 'gc' ? (rv.entries.length ? 'YOU LEAD THE BOARD' : 'NO RIVALS YET — SET THE PACE') : rv.entries.length ? 'NEW PERSONAL BEST' : 'FIRST RUN — SET THE BAR';
      rsub.textContent = (rv.source === 'gc' ? '#1 · ' : 'MY RUNS · ') + BOARD_NAME[rv.board];
    }
  }
  function celebrate(beaten, n) {
    const text = n > 1 ? 'PASSED ' + n + ' SURVIVORS' : 'PASSED ' + beaten.name;
    api.schedule(.05, () => api.toast('▲ ' + text, 1.8));
    api.haptic('MEDIUM');
    api.sfx.pickup?.();
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    bus.emit('rival:passed', { name: beaten.name, rank: beaten.rank, score: beaten.score, count: n, board: rv.board });
  }
  function addEntries(list) {
    const seen = new Set(rv.entries.map(e => e.key));
    for (const e of list) if (!seen.has(e.key)) { rv.entries.push(e); seen.add(e.key); }
    rv.entries.sort((a, b) => a.score - b.score || b.rank - a.rank);
  }
  function updateRival() {
    if (!rv.active || !rv.ready) return;
    const score = api.state.score || 0;
    let idx = 0;
    while (idx < rv.entries.length && rv.entries[idx].score < score) idx++;
    if (idx > rv.idx) celebrate(rv.entries[idx - 1], idx - rv.idx);
    rv.idx = Math.max(rv.idx, idx);
    if (rv.idx >= rv.entries.length) loadMore();
    renderRival();
  }
  async function loadMore() {
    if (rv.loading || rv.source !== 'gc' || rv.top <= 1) return;
    const token = rv.token, start = Math.max(1, rv.top - WINDOW), count = rv.top - start;
    rv.loading = true;
    try {
      const r = await loadBoard(rv.board, { start, count });
      if (token !== rv.token) return;
      addEntries((r.entries || []).filter(e => !e.isLocal).map(gcEntry));
      rv.top = start;
    } catch { if (token === rv.token) rv.top = 1; }
    if (token !== rv.token) return;
    rv.loading = false;
    updateRival();
  }
  const gcEntry = e => ({ key: 'r' + e.rank, name: e.name || 'SURVIVOR', score: e.score, rank: e.rank });
  function localEntries(board) {
    const runs = api.store.get('runs', []).filter(filters[board] || (() => true)).sort((a, b) => b.score - a.score);
    return runs.map((r, i) => ({ key: 'l' + i, name: i ? 'YOUR #' + (i + 1) + ' RUN' : 'YOUR BEST', score: r.score, rank: i + 1 }));
  }
  async function startRivals(type) {
    const token = ++rv.token;
    Object.assign(rv, { active: !!BOARD_OF[type], entries: [], idx: 0, top: 1, source: 'local', loading: false, board: BOARD_OF[type] || 'alltime', ready: false });
    renderRival();
    if (!rv.active) return;
    let entries = null;
    if (await signedIn()) {
      try {
        const head = await loadBoard(rv.board, { count: 1 });
        const total = head.total || 0, me = head.player;
        if (total) {
          const start = me ? Math.max(1, me.rank - Math.floor(WINDOW / 2)) : Math.max(1, total - WINDOW + 1);
          const r = await loadBoard(rv.board, { start, count: WINDOW });
          entries = (r.entries || []).filter(e => !e.isLocal).map(gcEntry);
          rv.top = start;
        } else entries = [];
        rv.source = 'gc';
      } catch { entries = null; }
    }
    if (token !== rv.token) return;
    if (!entries) { entries = localEntries(rv.board); rv.source = 'local'; rv.top = 1; }
    addEntries(entries);
    const score = api.state.score || 0;
    while (rv.idx < rv.entries.length && rv.entries[rv.idx].score < score) rv.idx++;
    rv.ready = true;
    updateRival();
  }
  bus.on('run:start', ({ type }) => startRivals(type));
  bus.on('kill', updateRival);
  bus.on('wave:clear', updateRival);

  let runMeta = null;
  bus.on('run:start', e => { runMeta = { type: e.type, start: e.startWave || e.opts?.startWave || api.state.startWave || 1, diff: e.difficultyId }; });
  async function recordSprint(cs) {
    const c = comp(), list = c.sprint ||= [], prevBest = list[0]?.cs;
    list.push({ cs, date: Date.now(), diff: runMeta.diff || api.settings.difficulty, code: api.myCode() });
    list.sort((a, b) => a.cs - b.cs);
    c.sprint = list.slice(0, 10);
    api.saveProfile();
    const best = !prevBest || cs < prevBest;
    api.toast('⏱ SPRINT ' + SPRINT_WAVE + ' · ' + sprintTime(cs) + (best ? ' · NEW BEST' : ''), 2.6);
    if (best) { api.haptic('HEAVY'); api.sfx.perk?.(); }
    bus.emit('sprint', { cs, best });
    if (!(await signedIn())) return;
    try { await gc.call('submitScore', { leaderboardId: BOARDS.sprint, score: cs, context: api.myCode() }); } catch {}
  }
  bus.on('wave:clear', ({ wave }) => {
    if (wave !== SPRINT_WAVE || !runMeta || runMeta.start !== 1 || !['normal', 'ranked'].includes(runMeta.type) || api.state.net) return;
    const cs = Math.round(api.state.clock * 100);
    if (cs < SPRINT_WAVE * 600) return;
    recordSprint(cs);
  });

  const over = $('#over-extras'), overBox = el('div', 'cm-over'), overText = el('span');
  function renderOver(run, extra) {
    const l = currentLeague(), parts = [];
    if (run.type === 'daily') {
      const d = comp().daily;
      if (run.cleared) parts.push('WAVE ' + (run.maxWave || DAILY_WAVES) + ' CLEARED');
      parts.push('DAILY BEST ' + fmt(d?.best || run.score));
      if (d?.rank) parts.push('#' + fmt(d.rank) + ' / ' + fmt(d.total));
      if (d?.attempts) parts.push('ATTEMPT ' + d.attempts);
      if (run.difficultyId === ROOKIE_DIFFICULTY) parts.push('ROOKIE BRACKET');
    } else if (run.type === 'ranked') {
      if (l) parts.push(...[pctText(l)].filter(Boolean), 'WEEKLY #' + fmt(l.rank) + ' / ' + fmt(l.total));
      else parts.push(gc.available() ? 'WEEKLY BEST ' + fmt(comp().weekly?.best || run.score) : 'LEAGUES USE GAME CENTER');
    } else parts.push(l ? 'PLAY RANKED TO CLIMB' : 'PLAY ⚔ RANKED TO EARN A LEAGUE');
    if (extra) parts.push(extra);
    overText.textContent = parts.join(' · ');
    overBox.replaceChildren(badge(l), overText);
    if (!overBox.isConnected) over.appendChild(overBox);
  }
  let lastRun = null;
  bus.on('run:end', run => {
    rv.active = false; rv.token++;
    renderRival();
    lastRun = run;
    const c = comp();
    if (run.type === 'daily' && run.seed === daily().seed) {
      if (c.daily?.date !== daily().date) c.daily = { date: daily().date, best: 0, attempts: 0 };
      c.daily.best = Math.max(c.daily.best || 0, run.score);
      c.daily.attempts = (c.daily.attempts || 0) + 1;
    }
    if (run.type === 'daily' && run.cleared) setTimeout(() => { const h = $('#over h2'); if (h) h.textContent = 'DAILY COMPLETE'; }, 0);
    if (run.type === 'ranked') {
      if (c.weekly?.week !== weekKey()) c.weekly = { week: weekKey(), best: 0 };
      c.weekly.best = Math.max(c.weekly.best || 0, run.score);
    }
    api.saveProfile();
    if (BOARD_OF[run.type]) selectBoard(BOARD_OF[run.type]);
    renderOver(run);
  });
  bus.on('run:submitted', ({ type, result }) => {
    if (!lastRun || lastRun.type !== type || !result || result.rejected) return;
    if (type === 'daily') { comp().daily = { ...comp().daily, date: daily().date, rank: result.rank, total: result.total }; api.saveProfile(); }
    if (type === 'ranked') setLeague(result.rank, result.total);
    renderOver(lastRun);
  });
  bus.on('app:ready', () => { payWeek(); if (gc.available()) refreshLeague().then(payWeek); });
  bus.on('screen', ({ id }) => { if (id === 'menu') payWeek(); });

  api.competitive = { BOARDS, LEAGUES, leagueFor, dailyChallenge: () => daily(), dailyBracket: () => dailyBracket(api.levelInfo().level), boardId, rankedLoadout: () => rankedLoadout(api), plausible: run => plausible(run, api), rival: rv, openDaily, openRanked, openBoard, refreshLeague, payWeek, heldRank, sprintTime };
}
