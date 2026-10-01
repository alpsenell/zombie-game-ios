export const id = 'dossier';
export const TABS = [['overview', 'OVERVIEW'], ['maps', 'MAPS'], ['weapons', 'WEAPONS'], ['bosses', 'BOSSES'], ['history', 'HISTORY']];
export const MODE_NAME = { normal: 'DEPLOY', daily: 'DAILY', ranked: 'RANKED', extract: 'EXTRACTION', blitz: 'BLITZ', coop: 'CO-OP', tutorial: 'TRAINING' };
const DIFFS = ['recruit', 'survivor', 'veteran', 'nightmare'];

export function trackRun(profile, run) {
  if (!run || run.type === 'tutorial' || !run.map) return null;
  const maps = (profile.maps ||= {}), m = (maps[run.map] ||= { runs: 0, bestWave: 0, bestScore: 0, byDiff: {} });
  const wave = run.startWave > 1 && run.wave <= run.startWave ? 0 : run.wave || 0;
  m.runs++;
  m.bestWave = Math.max(m.bestWave, wave);
  m.bestScore = Math.max(m.bestScore, run.score || 0);
  if (run.difficultyId) m.byDiff[run.difficultyId] = Math.max(m.byDiff[run.difficultyId] || 0, wave);
  profile.playTime = (profile.playTime || 0) + Math.max(0, Math.round(run.time || 0));
  return m;
}
export function trackKill(profile, e) {
  if (!e?.weapon) return;
  const k = (profile.weaponKills ||= {});
  k[e.weapon] = (k[e.weapon] || 0) + 1;
  if (e.head) { const h = (profile.weaponHeads ||= {}); h[e.weapon] = (h[e.weapon] || 0) + 1; }
}
export const playedText = secs => { const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60); return h ? h + 'H ' + m + 'M' : m + 'M'; };
export const dateText = t => { const d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase(); };

const CSS = `
#dossier .panel{width:min(94vw,640px);max-height:92vh;display:flex;flex-direction:column}
#ds-body{overflow:auto;max-height:52vh;min-height:120px;text-align:left}
.ds-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ds-cell{padding:9px 6px;border-radius:11px;border:1px solid var(--line);background:#0b161b;text-align:center;min-width:0}
.ds-cell b{display:block;font:900 17px var(--display);letter-spacing:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-cell small{display:block;margin-top:2px;font:800 8px var(--ui);letter-spacing:1.2px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-row{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;padding:8px 10px;margin-bottom:5px;border-radius:11px;border:1px solid var(--line);background:#0b161b}
.ds-row.dim{opacity:.5}
.ds-row b{font:900 11px var(--ui);letter-spacing:1.4px}
.ds-row em{font-style:normal;font:900 12px var(--display);letter-spacing:1px;color:var(--amber);white-space:nowrap}
.ds-row small{grid-column:1/-1;font:700 8.5px var(--ui);letter-spacing:1px;color:var(--dim)}
.ds-chips{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}
.ds-chips span{padding:2px 7px;border-radius:8px;border:1px solid var(--line);font:800 8px var(--ui);letter-spacing:1px;color:var(--dim)}
.ds-chips span.on{color:var(--ink);border-color:#ffffff33}
.ds-bar{grid-column:1/-1;height:4px;border-radius:2px;background:#162028;overflow:hidden}
.ds-bar i{display:block;height:100%;background:linear-gradient(90deg,#6fe3ff,#9aff3a)}
.ds-hist{display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;align-items:center;padding:7px 10px;margin-bottom:4px;border-radius:10px;border:1px solid var(--line);background:#0b161b;font:800 9px var(--ui);letter-spacing:1px}
.ds-hist b{font:900 13px var(--display);letter-spacing:1px}
.ds-hist em{font-style:normal;color:var(--dim)}
.ds-hist small{grid-column:2/-1;color:var(--dim);font:700 8px var(--ui);letter-spacing:1px}
.ds-empty{padding:20px;text-align:center;font:800 10px var(--ui);letter-spacing:1.4px;color:var(--dim)}
@media (max-height:430px) and (orientation:landscape){#dossier .panel{width:min(96vw,760px);padding:14px 18px}#ds-body{max-height:46vh}.ds-grid{grid-template-columns:repeat(5,1fr)}}
`;

export function init(api) {
  const { $, bus, profile, store } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n || 0).toLocaleString();
  const P = () => profile.progression || {}, S = () => P().stats || {}, comp = () => profile.competitive || {};
  profile.maps ||= {}; profile.weaponKills ||= {}; profile.playTime ||= 0;

  const btn = el('button', 'ghost', '📋 DOSSIER');
  btn.id = 'ds-open';
  $('#menu-extras')?.appendChild(btn);

  const screen = el('section', 'screen');
  screen.id = 'dossier';
  screen.innerHTML = '<div class="panel"><h2>DOSSIER</h2><div class="cm-sub" id="ds-sub"></div><div class="cm-seg" id="ds-tabs"></div><div id="ds-body"></div><div class="row" style="justify-content:center"><button class="ghost" id="ds-back">BACK</button></div></div>';
  document.body.appendChild(screen);
  api.registerScreen(screen);
  const body = screen.querySelector('#ds-body'), tabs = screen.querySelector('#ds-tabs');
  let tab = 'overview';
  for (const [id, label] of TABS) { const b = el('button', '', label); b.dataset.tab = id; b.onclick = () => { tab = id; render(); }; tabs.appendChild(b); }
  screen.querySelector('#ds-back').onclick = () => api.showScreen(api.ui.menu);

  const cell = (box, value, label) => { const d = el('div', 'ds-cell'); d.append(el('b', '', value), el('small', '', label)); box.appendChild(d); };
  function overview() {
    const grid = el('div', 'ds-grid'), r = api.records, s = S(), c = comp(), lv = api.levelInfo(), ach = Object.keys(P().ach || {}).length, total = api.progression?.data?.ACHIEVEMENTS?.length || 0;
    const heads = profile.heads || 0, kills = profile.kills || 0, bosses = Object.values(profile.bosses || {}).reduce((a, b) => a + b, 0);
    const league = c.held?.id ? api.competitive?.LEAGUES?.find?.(l => l.id === c.held.id)?.name || c.held.id.toUpperCase() : 'UNRANKED';
    const seasonBest = c.seasonBest?.id ? c.seasonBest.id.toUpperCase() : '—';
    const sprint = (c.sprint || [])[0], events = Object.values(profile.events?.won || {}).filter(w => w && (typeof w === 'number' || w.skin)).length;
    cell(grid, fmt(r.score), 'BEST SCORE'); cell(grid, String(r.wave || 0), 'BEST WAVE'); cell(grid, r.rank ? '#' + fmt(r.rank) : '—', 'GLOBAL RANK');
    cell(grid, fmt(kills), 'KILLS'); cell(grid, fmt(heads), 'HEADSHOTS'); cell(grid, kills ? Math.round(heads / kills * 100) + '%' : '—', 'HEADSHOT RATE');
    cell(grid, fmt(bosses), 'BOSSES DOWN'); cell(grid, fmt(s.elites), 'ELITES DOWN'); cell(grid, String(s.combo || 0), 'BEST KILL STREAK');
    cell(grid, s.accuracy ? s.accuracy + '%' : '—', 'BEST ACCURACY'); cell(grid, fmt(profile.runs), 'RUNS'); cell(grid, playedText(profile.playTime || 0), 'TIME IN THE FIELD');
    cell(grid, String(P().streak?.best || 0), 'LONGEST LOGIN STREAK'); cell(grid, fmt(s.missions), 'MISSIONS DONE'); cell(grid, ach + (total ? ' / ' + total : ''), 'ACHIEVEMENTS');
    cell(grid, league, 'LEAGUE'); cell(grid, seasonBest, 'SEASON BEST'); cell(grid, sprint && api.competitive?.sprintTime ? api.competitive.sprintTime(sprint.cs) : '—', 'SPRINT 20');
    cell(grid, c.blitz?.allTime ? fmt(c.blitz.allTime) : '—', 'BLITZ BEST'); cell(grid, (profile.bestByDiff?.nightmare || 0) ? 'WAVE ' + profile.bestByDiff.nightmare : '—', 'NIGHTMARE BEST'); cell(grid, events + ' / ' + (api.events?.EVENTS?.length || 4), 'EVENT SKINS');
    body.appendChild(grid);
  }
  function maps() {
    for (const m of api.MAPS) {
      const d = profile.maps[m.id], row = el('div', 'ds-row' + (d ? '' : ' dim'));
      row.append(el('b', '', m.name), el('em', '', d?.bestWave ? 'BEST WAVE ' + d.bestWave : 'NOT PLAYED'));
      if (d) {
        row.appendChild(el('small', '', fmt(d.runs) + ' RUN' + (d.runs === 1 ? '' : 'S') + ' · BEST SCORE ' + fmt(d.bestScore)));
        const chips = el('div', 'ds-chips');
        for (const k of DIFFS) { const w = d.byDiff?.[k] || 0; chips.appendChild(el('span', w ? 'on' : '', (api.DIFFICULTIES[k]?.name || k.toUpperCase()) + ' ' + (w ? 'W' + w : '—'))); }
        row.appendChild(chips);
      } else row.appendChild(el('small', '', m.desc || ''));
      body.appendChild(row);
    }
  }
  function weapons() {
    const list = [...api.WEAPONS].sort((a, b) => (profile.weaponKills[b.id] || 0) - (profile.weaponKills[a.id] || 0));
    for (const w of list) {
      const owned = api.weaponOwned(w), kills = profile.weaponKills[w.id] || 0, heads = profile.weaponHeads?.[w.id] || 0, m = api.progression?.mastery?.(w.id), stars = api.progression?.data?.prestigeMark?.(P().prestige?.[w.id] || 0) || '';
      const row = el('div', 'ds-row' + (owned ? '' : ' dim'));
      row.append(el('b', '', w.name + (stars ? ' ' + stars : '')), el('em', '', owned ? fmt(kills) + ' KILLS' : 'LOCKED'));
      if (owned) {
        row.appendChild(el('small', '', (m ? 'MASTERY ' + m.level + (m.max ? ' · MAX' : ' · ' + Math.round(m.pct * 100) + '%') : '') + (kills ? ' · ' + Math.round(heads / kills * 100) + '% HEADSHOTS' : '')));
        const bar = el('div', 'ds-bar'), fill = el('i'); fill.style.width = (m ? (m.max ? 100 : m.pct * 100) : 0).toFixed(1) + '%'; bar.appendChild(fill); row.appendChild(bar);
      }
      body.appendChild(row);
    }
  }
  function bosses() {
    api.BOSS_ORDER.forEach((kind, i) => {
      const T = api.ZT[kind], n = profile.bosses?.[kind] || 0, row = el('div', 'ds-row' + (n ? '' : ' dim'));
      row.append(el('b', '', T?.name || kind.toUpperCase()), el('em', '', n ? fmt(n) + ' DOWN' : 'NOT MET'), el('small', '', 'FIRST SEEN ON WAVE ' + (i + 1) * 5 + (T?.intro ? ' · ' + T.intro.toUpperCase() : '')));
      body.appendChild(row);
    });
  }
  function history() {
    const runs = store.get('runs', []).slice().sort((a, b) => (b.date || 0) - (a.date || 0));
    if (!runs.length) { body.appendChild(el('div', 'ds-empty', 'NO RUNS LOGGED YET · DEPLOY TO START YOUR RECORD')); return; }
    for (const r of runs) {
      const row = el('div', 'ds-hist'), map = api.MAPS.find(m => m.id === r.map)?.name, weapon = api.WEAPONS.find(w => w.id === r.weapon)?.name;
      row.append(el('b', '', 'W' + r.wave), el('span', '', (MODE_NAME[r.type] || 'DEPLOY') + ' · ' + (api.DIFFICULTIES[r.diff]?.name || 'SURVIVOR') + (map ? ' · ' + map : '')), el('em', '', fmt(r.score)));
      row.appendChild(el('small', '', dateText(r.date) + ' · ' + fmt(r.kills) + ' KILLS' + (weapon ? ' · ' + weapon : '') + (r.time ? ' · ' + Math.floor(r.time / 60) + ':' + String(r.time % 60).padStart(2, '0') : '') + (r.event ? ' · EVENT' : '')));
      body.appendChild(row);
    }
  }
  function render() {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
    $('#ds-sub').textContent = 'LEVEL ' + api.levelInfo().level + ' · ' + fmt(profile.runs) + ' RUNS · ' + playedText(profile.playTime || 0) + ' IN THE FIELD';
    body.innerHTML = '';
    ({ overview, maps, weapons, bosses, history })[tab]();
  }
  const open = (t = tab) => { api.sfx.init?.(); tab = t; render(); api.showScreen(screen); };
  btn.onclick = () => open();

  bus.on('kill', e => trackKill(profile, e));
  bus.on('run:end', run => { if (trackRun(profile, run)) api.saveProfile(); });
  bus.on('screen', ({ id }) => { if (id === 'dossier') render(); });

  api.dossier = { open, render, trackRun: run => trackRun(profile, run), TABS, MODE_NAME };
}
