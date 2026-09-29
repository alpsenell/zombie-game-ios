export const id = 'events';

const DAY = 864e5, WEEK = 7 * DAY;
export const EVENT_EPOCH = Date.UTC(2026, 8, 25);
export const EVENT_DAYS = 3, GOAL_WAVE = 10, GOAL_PLAYED = 8;
export const EVENTS = [
  { id: 'bloodmoon', name: 'BLOOD MOON', icon: '🌕', color: '#ff4a3a', desc: 'ELITES EVERYWHERE · +50% SCRAP', mods: { elite: .08, scrap: 1.5 } },
  { id: 'scraprush', name: 'SCRAP RUSH', icon: '🔩', color: '#ffc34d', desc: 'DOUBLE SCRAP FROM EVERY RUN', mods: { scrap: 2 } },
  { id: 'headhunter', name: 'HEADHUNTER', icon: '🎯', color: '#e8e4d8', desc: 'HEADSHOT KILLS SCORE DOUBLE · +50% XP', mods: { headScore: 2, xp: 1.5 } },
  { id: 'hordenight', name: 'HORDE NIGHT', icon: '🧟', color: '#9aff3a', desc: '+30% BIGGER WAVES · DOUBLE SEASON XP', mods: { count: 1.3, seasonXp: 2 } },
];
const SCORE_MODS = ['elite', 'headScore', 'count'];
const DEFAULTS = { count: 1, elite: 0, headScore: 1, scrap: 1, xp: 1, seasonXp: 1, label: '' };

export function eventAt(t = Date.now()) {
  const k = Math.floor((t - EVENT_EPOCH) / WEEK), start = EVENT_EPOCH + k * WEEK, end = start + EVENT_DAYS * DAY;
  const ev = EVENTS[((k % EVENTS.length) + EVENTS.length) % EVENTS.length];
  if (t >= start && t < end) return { ...ev, live: true, start, end };
  const nk = k + 1, ns = EVENT_EPOCH + nk * WEEK;
  return { ...EVENTS[((nk % EVENTS.length) + EVENTS.length) % EVENTS.length], live: false, start: ns, end: ns + EVENT_DAYS * DAY };
}
export function modsFor(ev, type) {
  if (!ev?.live || type === 'daily') return { ...DEFAULTS };
  const out = { ...DEFAULTS, label: ev.name };
  for (const [k, v] of Object.entries(ev.mods)) if (type !== 'ranked' || !SCORE_MODS.includes(k)) out[k] = v;
  return out;
}
export function timeLeft(ms) {
  const m = Math.max(1, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return d ? d + 'D ' + h + 'H' : h ? h + 'H ' + (m % 60) + 'M' : m + 'M';
}

const CSS = `
.ev-chip{padding:7px 12px;font-size:11px;letter-spacing:1.4px;display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;line-height:1.1;border-color:color-mix(in srgb,var(--c) 60%,transparent);max-width:min(52vw,230px);white-space:nowrap}
.ev-chip span,.ev-chip small{overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ev-chip small{font:700 8.5px var(--ui);letter-spacing:1.2px;color:var(--c)}
.ev-chip.live{background:color-mix(in srgb,var(--c) 14%,transparent);animation:ev-pulse 2.4s ease-in-out infinite}
@keyframes ev-pulse{50%{box-shadow:0 0 16px color-mix(in srgb,var(--c) 55%,transparent)}}
.ev-sheet{position:fixed;inset:0;z-index:35;display:grid;place-items:center;background:#010406b8;padding:16px}
.ev-card{width:min(360px,92vw);padding:18px;border-radius:18px;background:#081115f8;border:1px solid color-mix(in srgb,var(--c) 60%,transparent);box-shadow:0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center}
.ev-card small{font:900 10px var(--ui);letter-spacing:2px;color:var(--c)}
.ev-card h3{margin:0;font:900 30px/1 var(--display);letter-spacing:1.5px}
.ev-card p{margin:0;font:800 11px/1.5 var(--ui);letter-spacing:1.1px}
.ev-card p.dim{color:var(--dim);font-size:10px}
.ev-card .done{color:var(--green)}
.ev-card .cta{margin-top:6px;padding:12px 30px}
.ev-cal{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
.ev-cal span{padding:3px 8px;border-radius:10px;border:1px solid var(--line);font:800 9px var(--ui);letter-spacing:1px;color:var(--c);opacity:.7}
.ev-cal span.on{opacity:1;border-color:var(--c)}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const E = () => (profile.events ||= { won: {} });
  E();
  const skinIndex = evId => api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'event:' + evId);
  api.reqs.event = {
    met: evId => !!E().won[evId],
    text: evId => 'WIN THE ' + (EVENTS.find(e => e.id === evId)?.name || evId.toUpperCase()) + ' WEEKEND EVENT',
  };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const chip = el('button', 'ghost ev-chip');
  chip.id = 'ev-chip';
  const chipName = el('span'), chipSub = el('small');
  chip.append(chipName, chipSub);
  (document.querySelector('#menu .menu-top') || $('#menu-modes'))?.prepend(chip);
  function renderChip() {
    const ev = eventAt(), won = E().won[ev.id];
    chip.style.setProperty('--c', ev.color);
    chip.classList.toggle('live', ev.live);
    chipName.textContent = ev.icon + ' ' + ev.name;
    chipSub.textContent = ev.live ? (won ? '✓ WON · ' : 'LIVE · ') + 'ENDS IN ' + timeLeft(ev.end - Date.now()) : 'STARTS IN ' + timeLeft(ev.start - Date.now());
  }
  renderChip();

  let sheet = null;
  function close() { sheet?.remove(); sheet = null; }
  function open() {
    close();
    const ev = eventAt(), won = E().won[ev.id], skin = api.SLOTS.find(s => s.id === 'gun').items[skinIndex(ev.id)];
    sheet = el('div', 'ev-sheet');
    const card = el('div', 'ev-card');
    card.style.setProperty('--c', ev.color);
    const cal = el('div', 'ev-cal');
    for (const e of EVENTS) { const s = el('span', e.id === ev.id ? 'on' : '', e.icon + ' ' + e.name); s.style.setProperty('--c', e.color); cal.appendChild(s); }
    const ok = el('button', 'cta', ev.live ? 'DEPLOY' : 'CLOSE');
    ok.onclick = () => { close(); if (ev.live) api.startGame(api.deployOpts()); };
    const back = el('button', 'ghost', 'BACK');
    back.onclick = close;
    const row = el('div', 'row');
    row.append(ok, ...(ev.live ? [back] : []));
    card.append(
      el('small', '', ev.live ? 'WEEKEND EVENT · LIVE NOW · ENDS IN ' + timeLeft(ev.end - Date.now()) : 'NEXT WEEKEND EVENT · STARTS IN ' + timeLeft(ev.start - Date.now())),
      el('h3', '', ev.icon + ' ' + ev.name),
      el('p', '', ev.desc),
      el('p', won ? 'done' : '', won ? '✓ ' + (skin?.name || '') + ' SKIN UNLOCKED' : 'REWARD: ' + (skin?.name || 'EVENT') + ' WEAPON SKIN · CLEAR WAVE ' + GOAL_WAVE + ' DURING THE EVENT'),
      el('p', 'dim', 'EVERY WEEKEND FRI–SUN (UTC). DAILY CHALLENGE IS UNAFFECTED; RANKED GETS ONLY THE SCRAP/XP BOOSTS.'),
      cal, row,
    );
    sheet.appendChild(card);
    sheet.onclick = e => { if (e.target === sheet) close(); };
    document.body.appendChild(sheet);
  }
  chip.onclick = () => { api.sfx.init?.(); open(); };

  let runEv = null, runStart = 1;
  bus.on('run:start', e => {
    const ev = eventAt();
    runEv = ev.live && e.type !== 'daily' ? ev : null;
    runStart = e.startWave || 1;
    const { label, ...m } = modsFor(ev, e.type);
    Object.assign(api.live, m, { label });
    if (runEv) api.schedule?.(.6, () => api.toast(ev.icon + ' ' + ev.name + ' ACTIVE', 2));
  });
  bus.on('wave:clear', ({ wave }) => {
    if (!runEv || E().won[runEv.id] || wave < GOAL_WAVE || wave - runStart + 1 < GOAL_PLAYED) return;
    E().won[runEv.id] = Date.now();
    const i = skinIndex(runEv.id);
    if (i > 0 && !profile.fresh.includes('gun:' + i)) profile.fresh.push('gun:' + i);
    api.saveProfile();
    api.message(runEv.icon + ' EVENT WON', (api.SLOTS.find(s => s.id === 'gun').items[i]?.name || '') + ' SKIN UNLOCKED', 2.6);
    api.haptic('HEAVY');
    bus.emit('event:won', { id: runEv.id });
  });
  bus.on('screen', ({ id }) => { if (id === 'menu') renderChip(); });
  setInterval(() => { if (api.activeScreen === api.ui.menu) renderChip(); }, 30000);

  api.events = { EVENTS, eventAt, modsFor, open, close, renderChip };
}
