export const id = 'events';

const DAY = 864e5, WEEK = 7 * DAY;
export const EVENT_EPOCH = Date.UTC(2026, 8, 25);
export const EVENT_DAYS = 3, GOAL_WAVE = 10, GOAL_PLAYED = 8, GOAL_SCORE = 50000, GOAL_SCRAP = 1500, GOAL_TOP = .1, BOARD_MIN = 20;
export const EVENTS = [
  { id: 'bloodmoon', name: 'BLOOD MOON', icon: '🌕', color: '#ff4a3a', desc: 'ELITES EVERYWHERE · +50% SCRAP', twist: 'ELITES DROP HEALTH ONLY ON HEADSHOTS', mods: { elite: .08, scrap: 1.5, eliteHeadOnly: true } },
  { id: 'scraprush', name: 'SCRAP RUSH', icon: '🔩', color: '#ffc34d', desc: 'DOUBLE SCRAP FROM EVERY RUN', twist: 'A SCRAP BAG DROPS EVERY 20 SECONDS · GRAB IT BEFORE IT VANISHES', mods: { scrap: 2, scrapBag: 20 } },
  { id: 'headhunter', name: 'HEADHUNTER', icon: '🎯', color: '#e8e4d8', desc: 'HEADSHOT KILLS SCORE DOUBLE · +50% XP', twist: 'NO AIM ASSIST', mods: { headScore: 2, xp: 1.5, noAssist: true } },
  { id: 'hordenight', name: 'HORDE NIGHT', icon: '🧟', color: '#9aff3a', desc: '+30% BIGGER WAVES · DOUBLE SEASON XP', twist: 'UP TO 24 INFECTED ON THE FIELD AT ONCE', mods: { count: 1.3, seasonXp: 2, alive: 24 } },
];
const FAIR = ['ranked', 'blitz'];
const EVENT_ONLY = ['elite', 'headScore', 'count', 'eliteHeadOnly', 'scrapBag', 'noAssist', 'alive'];
const DEFAULTS = { count: 1, elite: 0, headScore: 1, scrap: 1, xp: 1, seasonXp: 1, label: '', event: false, alive: 0, noAssist: false, eliteHeadOnly: false, scrapBag: 0, mutScore: 1, noRadar: false, noPickups: false, runners: 1, featured: 1 };

export function eventAt(t = Date.now()) {
  const k = Math.floor((t - EVENT_EPOCH) / WEEK), start = EVENT_EPOCH + k * WEEK, end = start + EVENT_DAYS * DAY;
  const ev = EVENTS[((k % EVENTS.length) + EVENTS.length) % EVENTS.length];
  if (t >= start && t < end) return { ...ev, live: true, start, end };
  const nk = k + 1, ns = EVENT_EPOCH + nk * WEEK;
  return { ...EVENTS[((nk % EVENTS.length) + EVENTS.length) % EVENTS.length], live: false, start: ns, end: ns + EVENT_DAYS * DAY };
}
export const ladderRun = (type, t = Date.now()) => eventAt(t).live && (type || 'normal') === 'normal';
export function modsFor(ev, type) {
  if (!ev?.live || type === 'daily') return { ...DEFAULTS };
  const out = { ...DEFAULTS, label: ev.name, event: ladderRun(type, ev.start) };
  for (const [k, v] of Object.entries(ev.mods)) if (!FAIR.includes(type) || !EVENT_ONLY.includes(k)) out[k] = v;
  return out;
}
export function timeLeft(ms) {
  const m = Math.max(1, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return d ? d + 'D ' + h + 'H' : h ? h + 'H ' + (m % 60) + 'M' : m + 'M';
}
export const normGoals = w => (w == null ? null : typeof w === 'number' ? { skin: w } : w);
export function goalsOf(profile, evId) { return normGoals(profile?.events?.won?.[evId]) || {}; }
export const goalCount = g => ['skin', 'score', 'board'].filter(k => g?.[k]).length;
export const topRank = (rank, total) => total >= BOARD_MIN && rank > 0 && rank / total <= GOAL_TOP;

const CSS = `
.ev-chip{padding:7px 12px;font-size:11px;letter-spacing:1.4px;display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;line-height:1.1;border-color:color-mix(in srgb,var(--c) 60%,transparent);max-width:min(52vw,230px);white-space:nowrap}
.ev-chip span,.ev-chip small{overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ev-chip small{font:700 8.5px var(--ui);letter-spacing:1.2px;color:var(--c)}
.ev-chip.live{background:color-mix(in srgb,var(--c) 14%,transparent);animation:ev-pulse 2.4s ease-in-out infinite}
@keyframes ev-pulse{50%{box-shadow:0 0 16px color-mix(in srgb,var(--c) 55%,transparent)}}
.ev-sheet{position:fixed;inset:0;z-index:35;display:grid;place-items:center;background:#010406b8;padding:16px}
.ev-card{width:min(380px,92vw);max-height:92vh;overflow:auto;padding:16px 18px;border-radius:18px;background:#081115f8;border:1px solid color-mix(in srgb,var(--c) 60%,transparent);box-shadow:0 20px 60px #000;text-align:center;display:grid;gap:7px;justify-items:center}
.ev-card small{font:900 10px var(--ui);letter-spacing:2px;color:var(--c)}
.ev-card h3{margin:0;font:900 28px/1 var(--display);letter-spacing:1.5px}
.ev-card p{margin:0;font:800 11px/1.5 var(--ui);letter-spacing:1.1px}
.ev-card p.dim{color:var(--dim);font-size:10px}
.ev-card p.twist{color:var(--c)}
.ev-card .cta{margin-top:4px;padding:11px 26px}
.ev-ladder{width:100%;display:grid;gap:4px;text-align:left}
.ev-goal{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:#0b161b;font:800 10px var(--ui);letter-spacing:1px}
.ev-goal i{font-style:normal;font-size:14px;text-align:center}
.ev-goal b{display:block;font:900 11px var(--ui);letter-spacing:1.2px}
.ev-goal small{display:block;color:var(--dim);font:700 8.5px var(--ui);letter-spacing:1px;margin-top:2px}
.ev-goal em{font-style:normal;font:900 10px var(--ui);letter-spacing:1px;color:var(--dim);white-space:nowrap}
.ev-goal.done{border-color:color-mix(in srgb,var(--green) 60%,transparent);background:color-mix(in srgb,var(--green) 10%,#0b161b)}
.ev-goal.done em{color:var(--green)}
.ev-cal{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
.ev-cal span{padding:3px 8px;border-radius:10px;border:1px solid var(--line);font:800 9px var(--ui);letter-spacing:1px;color:var(--c);opacity:.7}
.ev-cal span.on{opacity:1;border-color:var(--c)}
.ev-over{margin-top:6px;font:900 10px var(--ui);letter-spacing:1.6px;color:var(--c)}
.ev-over.hidden{display:none}
@media (max-height:430px) and (orientation:landscape){.ev-card{grid-template-columns:1fr 1fr;column-gap:12px;align-items:start}.ev-card>*{grid-column:1/-1}.ev-card>.ev-ladder{grid-column:2;grid-row:2/span 5;align-self:center}.ev-card>small,.ev-card>h3,.ev-card>p{grid-column:1}.ev-card>.ev-cal,.ev-card>.row{grid-column:1/-1}}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const E = () => {
    const e = (profile.events ||= { won: {} });
    e.won ||= {}; e.ladder ||= {};
    for (const k of Object.keys(e.won)) if (typeof e.won[k] === 'number') e.won[k] = { skin: e.won[k] };
    return e;
  };
  E();
  const goals = evId => E().won[evId] || {};
  const ladder = evId => (E().ladder[evId] ||= { score: 0, rank: 0, total: 0 });
  const gunSlot = () => api.SLOTS.find(s => s.id === 'gun');
  const skinIndex = (evId, kind = 'event') => gunSlot().items.findIndex(it => it.req === kind + ':' + evId);
  const skinName = (evId, kind) => gunSlot().items[skinIndex(evId, kind)]?.name || '';
  const evName = evId => EVENTS.find(e => e.id === evId)?.name || evId.toUpperCase();
  api.reqs.event = { met: evId => !!goals(evId).skin, text: evId => 'WIN THE ' + evName(evId) + ' WEEKEND EVENT' };
  api.reqs.eventtop = { met: evId => !!goals(evId).board, text: evId => 'FINISH IN THE TOP 10% OF THE ' + evName(evId) + ' EVENT BOARD' };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const chip = el('button', 'ghost ev-chip');
  chip.id = 'ev-chip';
  const chipName = el('span'), chipSub = el('small');
  chip.append(chipName, chipSub);
  (document.querySelector('#menu .menu-top') || $('#menu-modes'))?.prepend(chip);
  function renderChip() {
    const ev = eventAt(), n = goalCount(goals(ev.id));
    chip.style.setProperty('--c', ev.color);
    chip.classList.toggle('live', ev.live);
    chipName.textContent = ev.icon + ' ' + ev.name;
    chipSub.textContent = ev.live ? (n === 3 ? '✓ LADDER COMPLETE · ' : 'LIVE · ' + n + '/3 · ') + 'ENDS IN ' + timeLeft(ev.end - Date.now()) : 'WEEKEND EVENT IN ' + timeLeft(ev.start - Date.now());
  }
  renderChip();

  function goalRows(ev) {
    const g = goals(ev.id), l = ladder(ev.id), fmt = n => Math.round(n).toLocaleString();
    const rows = [
      { icon: '🔫', done: !!g.skin, title: 'CLEAR WAVE ' + GOAL_WAVE, sub: skinName(ev.id) + ' WEAPON SKIN · ' + GOAL_PLAYED + '+ WAVES PLAYED, ANY MODE BUT THE DAILY', state: g.skin ? '✓ UNLOCKED' : 'WAVE ' + GOAL_WAVE },
      { icon: '🏆', done: !!g.score, title: 'SCORE ' + fmt(GOAL_SCORE) + ' IN ONE RUN', sub: fmt(GOAL_SCRAP) + ' SCRAP · NORMAL DEPLOY DURING THE EVENT', state: g.score ? '✓ PAID' : l.score ? 'BEST ' + fmt(l.score) : '0 / ' + fmt(GOAL_SCORE) },
      { icon: '📈', done: !!g.board, title: 'TOP 10% ON THE EVENT BOARD', sub: skinName(ev.id, 'eventtop') + ' ANIMATED SKIN · AT LEAST ' + BOARD_MIN + ' PLAYERS ON THE BOARD', state: g.board ? '✓ UNLOCKED' : l.rank ? '#' + fmt(l.rank) + ' / ' + fmt(l.total) : 'NOT RANKED' },
    ];
    const box = el('div', 'ev-ladder');
    for (const r of rows) {
      const row = el('div', 'ev-goal' + (r.done ? ' done' : '')), mid = el('div');
      mid.append(el('b', '', r.title), el('small', '', r.sub));
      row.append(el('i', '', r.icon), mid, el('em', '', r.state));
      box.appendChild(row);
    }
    return box;
  }

  let sheet = null;
  function close() { sheet?.remove(); sheet = null; }
  function open() {
    close();
    const ev = eventAt(), n = goalCount(goals(ev.id));
    sheet = el('div', 'ev-sheet');
    const card = el('div', 'ev-card');
    card.style.setProperty('--c', ev.color);
    const cal = el('div', 'ev-cal');
    for (const e of EVENTS) { const s = el('span', e.id === ev.id ? 'on' : '', e.icon + ' ' + e.name); s.style.setProperty('--c', e.color); cal.appendChild(s); }
    const ok = el('button', 'cta', ev.live ? 'DEPLOY' : 'CLOSE');
    ok.onclick = () => { close(); if (ev.live) api.startGame(api.deployOpts()); };
    const board = el('button', 'ghost', '🏆 EVENT BOARD');
    board.id = 'ev-board';
    board.onclick = () => { close(); api.competitive?.openBoard?.('event'); };
    const back = el('button', 'ghost', 'BACK');
    back.onclick = close;
    const row = el('div', 'row');
    row.append(ok, ...(ev.live ? [board, back] : []));
    card.append(
      el('small', '', ev.live ? 'WEEKEND EVENT · LIVE NOW · ENDS IN ' + timeLeft(ev.end - Date.now()) : 'NEXT WEEKEND EVENT · STARTS IN ' + timeLeft(ev.start - Date.now())),
      el('h3', '', ev.icon + ' ' + ev.name),
      el('p', '', ev.desc),
      el('p', 'twist', '⚠ ' + ev.twist),
      el('small', '', 'EVENT LADDER · ' + n + ' / 3'),
      goalRows(ev),
      el('p', 'dim', 'EVERY WEEKEND FRI–SUN (UTC). DAILY CHALLENGE IS UNAFFECTED; RANKED GETS ONLY THE SCRAP/XP BOOSTS. THE EVENT BOARD AND THE SCORE GOAL COUNT NORMAL DEPLOYS ONLY.'),
      cal, row,
    );
    sheet.appendChild(card);
    sheet.onclick = e => { if (e.target === sheet) close(); };
    document.body.appendChild(sheet);
  }
  chip.onclick = () => { api.sfx.init?.(); open(); };

  const overLine = el('div', 'ev-over hidden');
  overLine.id = 'ev-over';
  $('#over-rewards')?.after(overLine);
  function renderOver(ev, run) {
    const l = ladder(ev.id), n = goalCount(goals(ev.id));
    overLine.style.setProperty('--c', ev.color);
    overLine.textContent = ev.icon + ' ' + ev.name + ' · LADDER ' + n + '/3' + (l.rank ? ' · EVENT RANK #' + l.rank.toLocaleString() + ' / ' + l.total.toLocaleString() : run?.event && api.gameCenter.available() ? ' · EVENT RANK PENDING' : '');
    overLine.classList.remove('hidden');
  }

  function award(ev, goal, text) {
    const g = (E().won[ev.id] ||= {});
    if (g[goal]) return false;
    g[goal] = Date.now();
    const kind = goal === 'board' ? 'eventtop' : goal === 'skin' ? 'event' : null, i = kind ? skinIndex(ev.id, kind) : -1;
    if (i > 0 && !profile.fresh.includes('gun:' + i)) profile.fresh.push('gun:' + i);
    if (goal === 'score') profile.scrap += GOAL_SCRAP;
    api.saveProfile();
    api.refreshProfileUI?.();
    api.message(ev.icon + ' EVENT GOAL', text, 2.6);
    api.haptic('HEAVY');
    bus.emit('event:goal', { id: ev.id, goal, count: goalCount(g) });
    if (goal === 'skin') bus.emit('event:won', { id: ev.id });
    return true;
  }

  let runEv = null, runStart = 1, lastRun = null;
  bus.on('run:start', e => {
    const ev = eventAt();
    runEv = ev.live && e.type !== 'daily' ? ev : null;
    runStart = e.startWave || 1;
    lastRun = null;
    const { label, ...m } = modsFor(ev, e.type);
    Object.assign(api.live, m, { label });
    if (runEv) api.schedule?.(.6, () => api.toast(ev.icon + ' ' + ev.name + ' ACTIVE · ' + ev.twist, 2.6));
  });
  bus.on('wave:clear', ({ wave }) => {
    if (!runEv || goals(runEv.id).skin || wave < GOAL_WAVE || wave - runStart + 1 < GOAL_PLAYED) return;
    award(runEv, 'skin', skinName(runEv.id) + ' SKIN UNLOCKED');
  });
  bus.on('run:end', run => {
    if (!runEv) return;
    lastRun = run;
    if (run.event && run.score > 0) {
      const l = ladder(runEv.id);
      l.score = Math.max(l.score, run.score);
      const paid = run.score >= GOAL_SCORE && award(runEv, 'score', '+' + GOAL_SCRAP.toLocaleString() + ' SCRAP · ' + GOAL_SCORE.toLocaleString() + ' POINTS IN ONE RUN');
      if (!paid) api.saveProfile();
      if (paid) setTimeout(() => $('#over-rewards')?.appendChild(el('span', 'gold', '+' + GOAL_SCRAP.toLocaleString() + ' 🔩 EVENT GOAL')), 0);
    }
    setTimeout(() => renderOver(runEv, run), 0);
  });
  bus.on('run:submitted', async ({ type, result }) => {
    const ev = runEv, run = lastRun;
    if (!ev || !run?.event || type !== 'normal' || !result || result.rejected) return;
    let r = null;
    try { r = await api.gameCenter.rank(api.LEADERBOARDS.event); } catch { r = null; }
    if (!r || runEv !== ev) return;
    const l = ladder(ev.id);
    l.rank = r.rank; l.total = r.total;
    if (topRank(r.rank, r.total)) award(ev, 'board', skinName(ev.id, 'eventtop') + ' SKIN UNLOCKED · TOP 10%');
    else api.saveProfile();
    renderOver(ev, run);
    bus.emit('event:rank', { id: ev.id, rank: r.rank, total: r.total });
  });
  bus.on('screen', ({ id }) => { if (id === 'menu') renderChip(); if (id !== 'over') overLine.classList.add('hidden'); });
  setInterval(() => { if (api.activeScreen === api.ui.menu) renderChip(); }, 30000);

  api.events = { EVENTS, GOAL_SCORE, GOAL_SCRAP, BOARD_MIN, eventAt, modsFor, ladderRun, goals, ladder, open, close, renderChip, award: (goal, evId = eventAt().id) => award(EVENTS.find(e => e.id === evId), goal, 'TEST') };
}
