import { BLITZ_SECONDS, BLITZ_DIFFICULTY, BLITZ_ALIVE, SPRINT_WAVE, sprintTime } from './competitive.js';

export const id = 'blitz';
export { BLITZ_SECONDS, BLITZ_DIFFICULTY, BLITZ_ALIVE };
export const clockText = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

const CSS = `
#bz-open small{color:#ffe08a}
#sp20-open small{color:#6fe3ff}
#bz-hud{position:absolute;left:50%;top:max(8px,var(--st));transform:translateX(-50%);z-index:5;padding:6px 14px;border-radius:14px;background:#081115d8;border:1px solid #ffe08a88;color:#ffe08a;font:900 15px var(--ui);letter-spacing:2px;pointer-events:none;white-space:nowrap}
#bz-hud.low{color:#ff6a4d;border-color:#ff6a4d;animation:bz-blink .6s steps(2) infinite}
@keyframes bz-blink{50%{opacity:.45}}
#bz-hud.hidden{display:none}
.bz-cells{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.bz-cells div{padding:10px 6px;border-radius:12px;border:1px solid var(--line);background:#0b161b;text-align:center}
.bz-cells b{display:block;font:900 18px var(--display);letter-spacing:1px}
.bz-cells small{display:block;margin-top:3px;font:800 8.5px var(--ui);letter-spacing:1.4px;color:var(--dim)}
.bz-rules{margin:0 0 12px;font:800 10px/1.6 var(--ui);letter-spacing:1.1px;color:var(--dim);text-align:center}
@media (max-height:430px) and (orientation:landscape){#bz-sheet .panel,#sp20-sheet .panel{width:min(94vw,620px);padding:16px 20px}.bz-rules{margin-bottom:8px}}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n).toLocaleString();
  const comp = () => (profile.competitive ||= {});
  const B = () => { const c = comp(); if (!c.blitz || c.blitz.date !== dayKey()) c.blitz = { date: dayKey(), best: c.blitz?.best || 0, allTime: Math.max(c.blitz?.allTime || 0, c.blitz?.best || 0), runs: 0, last: 0 }; return c.blitz; };
  const isBlitz = () => api.state.runType === 'blitz';
  const opts = () => ({ type: 'blitz', difficulty: BLITZ_DIFFICULTY, timeLimit: BLITZ_SECONDS, autoWave: true, aliveCap: BLITZ_ALIVE, startWave: 1, replay: opts });
  const sprintOpts = () => ({ type: 'normal', startWave: 1, sprint: true });

  const bzBtn = el('button', 'ghost cm-mode'), spBtn = el('button', 'ghost cm-mode');
  bzBtn.id = 'bz-open'; spBtn.id = 'sp20-open';
  const bzSub = el('small', '', BLITZ_SECONDS / 60 + ' MINUTES · SCORE ATTACK'), spSub = el('small', '', 'FASTEST TO WAVE ' + SPRINT_WAVE);
  bzBtn.append(el('span', '', '⚡ BLITZ'), bzSub);
  spBtn.append(el('span', '', '⏱ SPRINT ' + SPRINT_WAVE), spSub);
  $('#menu-modes')?.append(bzBtn, spBtn);
  function renderMenu() {
    const b = B(), s = (comp().sprint || [])[0];
    bzSub.textContent = b.allTime ? 'BEST ' + fmt(b.allTime) + ' · ' + BLITZ_SECONDS / 60 + ' MIN' : BLITZ_SECONDS / 60 + ' MINUTES · SCORE ATTACK';
    spSub.textContent = s ? 'BEST ' + sprintTime(s.cs) : 'FASTEST TO WAVE ' + SPRINT_WAVE;
  }

  function sheetFor(id, title, sub, rules, goText, onGo, board) {
    const sheet = el('section', 'screen'), panel = el('div', 'panel'), cells = el('div', 'bz-cells'), go = el('button', 'cta', goText), lb = el('button', 'ghost', '🏆 LEADERBOARD'), back = el('button', 'ghost', 'BACK'), row = el('div', 'row');
    sheet.id = id;
    row.append(go, lb, back);
    panel.append(el('h2', '', title), el('div', 'cm-sub', sub), cells, el('p', 'bz-rules', rules), row);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);
    api.registerScreen(sheet);
    go.onclick = onGo;
    lb.onclick = () => api.competitive?.openBoard?.(board);
    back.onclick = () => api.showScreen(api.ui.menu);
    return { sheet, cells };
  }
  const cell = (box, value, label) => { const d = el('div'); d.append(el('b', '', value), el('small', '', label)); box.appendChild(d); };
  const bz = sheetFor('bz-sheet', '⚡ BLITZ', BLITZ_DIFFICULTY.toUpperCase() + ' · ALL WEAPONS · OWN LEADERBOARD',
    'FIVE MINUTES ON THE CLOCK. WAVES ROLL STRAIGHT INTO EACH OTHER WITH NO PERK SCREEN: A RANDOM UPGRADE IS APPLIED AFTER EVERY WAVE, A RARE ONE AFTER A BOSS. UP TO ' + BLITZ_ALIVE + ' INFECTED AT ONCE. WHEN THE TIMER ENDS YOUR SCORE IS BANKED; DYING BANKS WHAT YOU HAVE. NO REVIVES, NO EVENT TWISTS, SCRAP AND XP AS NORMAL.',
    'START BLITZ', () => api.startGame(opts()), 'blitz');
  const sp = sheetFor('sp20-sheet', '⏱ SPRINT ' + SPRINT_WAVE, 'CLEAR WAVE ' + SPRINT_WAVE + ' FROM WAVE 1 · LOWER TIME WINS',
    'A NORMAL DEPLOY ON YOUR SELECTED DIFFICULTY, STARTED AT WAVE 1. THE CLOCK STOPS WHEN WAVE ' + SPRINT_WAVE + ' IS CLEARED AND YOUR TIME GOES TO THE SPRINT BOARD. PERK SCREENS DO NOT COUNT AGAINST YOU. CHECKPOINT STARTS AND CO-OP ARE EXCLUDED.',
    'START SPRINT', () => api.startGame(sprintOpts()), 'sprint');
  function renderSheets() {
    const b = B(), list = comp().sprint || [], best = list[0];
    bz.cells.innerHTML = '';
    cell(bz.cells, b.allTime ? fmt(b.allTime) : '—', 'BEST SCORE');
    cell(bz.cells, b.best ? fmt(b.best) : '—', 'BEST TODAY');
    cell(bz.cells, String(b.runs || 0), 'RUNS TODAY');
    sp.cells.innerHTML = '';
    cell(sp.cells, best ? sprintTime(best.cs) : '—', best ? 'BEST · ' + (api.DIFFICULTIES[best.diff]?.name || 'SURVIVOR') : 'NO SPRINT YET');
    cell(sp.cells, String(list.length), 'SPRINTS LOGGED');
    cell(sp.cells, (api.DIFFICULTIES[api.settings.difficulty]?.name || 'SURVIVOR'), 'DIFFICULTY');
  }
  const open = () => { api.sfx.init?.(); renderSheets(); api.showScreen(bz.sheet); };
  const openSprint = () => { api.sfx.init?.(); renderSheets(); api.showScreen(sp.sheet); };
  bzBtn.onclick = open;
  spBtn.onclick = openSprint;

  const hud = el('div', 'hidden');
  hud.id = 'bz-hud';
  $('#hud')?.appendChild(hud);
  function renderHud() {
    const st = api.state;
    if (!isBlitz() || !['playing', 'paused', 'perk', 'revive', 'extract'].includes(st.mode)) { hud.classList.add('hidden'); return; }
    const left = Math.max(0, st.timeLimit - st.clock);
    hud.textContent = '⚡ ' + clockText(left) + ' · ' + fmt(st.score);
    hud.classList.toggle('low', left <= 30);
    hud.classList.remove('hidden');
  }
  setInterval(renderHud, 200);

  const taken = name => api.state.perks.filter(n => n === name).length;
  function autoPerk(wave) {
    const rare = wave % 5 === 0;
    const ok = p => (!p.when || p.when()) && (!p.max || taken(p.name) < p.max) && !p.legendary && (rare ? p.rare : !p.rare);
    let pool = api.PERKS.filter(ok);
    if (!pool.length) pool = api.PERKS.filter(p => (!p.when || p.when()) && (!p.max || taken(p.name) < p.max) && !p.legendary);
    if (!pool.length) return null;
    const p = pool[(api.R() * pool.length) | 0];
    p.apply();
    api.state.perks.push(p.name);
    bus.emit('perk', { name: p.name, icon: p.icon, rare: !!p.rare, legendary: false, wave, kit: false, auto: true });
    api.toast(p.icon + ' ' + p.name, 1.6);
    api.sfx.perk?.();
    return p;
  }

  bus.on('run:start', () => { renderHud(); });
  bus.on('wave:clear', ({ wave }) => { if (isBlitz() && !api.state.cleared) api.schedule(.4, () => { if (isBlitz() && api.state.mode === 'playing') autoPerk(wave); }); });
  bus.on('run:end', run => {
    renderHud();
    if (run.type !== 'blitz') return;
    const b = B();
    b.runs = (b.runs || 0) + 1;
    b.last = run.score;
    b.best = Math.max(b.best || 0, run.score);
    b.allTime = Math.max(b.allTime || 0, run.score);
    api.saveProfile();
    setTimeout(() => { const h = $('#over h2'); if (h) h.textContent = run.cleared ? 'TIME UP' : 'BLITZ OVER'; const sub = $('#over-sub'); if (sub && run.cleared) sub.textContent = 'WAVE ' + run.wave + ' WHEN THE CLOCK RAN OUT'; }, 0);
  });
  bus.on('screen', ({ id }) => { if (id === 'menu') renderMenu(); if (id === 'bz-sheet' || id === 'sp20-sheet') renderSheets(); renderHud(); });
  bus.on('cloud:restored', renderMenu);
  renderMenu();

  api.blitz = { opts, sprintOpts, open, openSprint, BLITZ_SECONDS, BLITZ_DIFFICULTY, BLITZ_ALIVE, clockText, state: () => B(), autoPerk };
}
