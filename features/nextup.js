import { SLOTS, EXTRA_SLOTS } from '../character.js';
import { LEAGUES, leagueRank } from './competitive.js';

export const id = 'nextup';
export const SHEET = 6;
const BOSS_WAVE = { abomination: 5, butcher: 10, plague: 15, goliath: 20 };
const SKIP = new Set(['event', 'eventtop', 'recruit', 'season', 'seasonskin']);

export function progress(api, req) {
  const [k, v] = String(req || '').split(':'), n = +v, p = api.profile;
  if (SKIP.has(k)) return null;
  const bar = (cur, need, unit = '') => ({ cur: Math.min(cur, need), need, pct: need ? Math.min(1, cur / need) : 0, unit });
  if (k === 'level') { const lv = api.levelInfo(); return { ...bar(lv.level, n, 'LV'), pct: Math.min(1, (lv.level - 1 + lv.into / lv.need) / Math.max(1, n - 1)) }; }
  if (k === 'wave') return bar(p.bestWave || 0, n, 'WAVE');
  if (k === 'boss') { const w = BOSS_WAVE[v] || 5; return bar(p.bestWave || 0, w, 'WAVE'); }
  if (k === 'heads') return bar(p.heads || 0, n, 'HEADSHOTS');
  if (k === 'kills') return bar(p.kills || 0, n, 'KILLS');
  if (k === 'nightmare') return bar(p.bestByDiff?.nightmare || 0, n, 'NIGHTMARE WAVE');
  if (k === 'veteran') return bar(Math.max(p.bestByDiff?.veteran || 0, p.bestByDiff?.nightmare || 0), n, 'VETERAN WAVE');
  if (k === 'prestige') return bar(Math.max(0, ...api.WEAPONS.map(w => api.progression?.prestigeOf?.(w.id) || 0)), n, 'PRESTIGE');
  if (k === 'league') { const held = api.competitive?.heldRank?.() ?? -1, need = leagueRank(v); return need < 0 ? null : { ...bar(held + 1, need + 1, 'LEAGUE'), cur: held < 0 ? 'UNRANKED' : LEAGUES.find(l => leagueRank(l.id) === held)?.name, need: LEAGUES.find(l => l.id === v)?.name || v.toUpperCase() }; }
  return null;
}

export function goals(api) {
  const { profile } = api, out = [];
  for (const s of [...SLOTS, ...EXTRA_SLOTS]) {
    if (s.hidden) continue;
    s.items.forEach((it, i) => {
      if (!it.req || it.premium || api.reqMet(it.req)) return;
      const p = progress(api, it.req);
      if (p) out.push({ kind: 'item', slot: s.id, i, name: it.name, label: s.label, text: api.reqText(it.req), ...p });
    });
  }
  for (const w of api.WEAPONS) {
    if (w.premium || api.weaponOwned(w)) continue;
    if (w.req && !api.reqMet(w.req)) { const p = progress(api, w.req); if (p) out.push({ kind: 'weapon', id: w.id, name: w.name, label: w.type, text: api.reqText(w.req), ...p }); }
    else if (w.price) out.push({ kind: 'weapon', id: w.id, name: w.name, label: w.type, text: 'BUY FOR 🔩 ' + w.price.toLocaleString(), cur: Math.min(profile.scrap, w.price), need: w.price, pct: Math.min(1, profile.scrap / w.price), unit: '🔩', ready: profile.scrap >= w.price });
  }
  return out.sort((a, b) => b.pct - a.pct || (typeof a.need === 'number' && typeof b.need === 'number' ? a.need - b.need : 0) || a.name.localeCompare(b.name));
}

const CSS = `
#nu-chip{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;line-height:1.1;max-width:min(52vw,250px);white-space:nowrap}
#nu-chip span,#nu-chip small{overflow:hidden;text-overflow:ellipsis;max-width:100%}
#nu-chip small{font:700 8.5px var(--ui);letter-spacing:1.2px;color:var(--amber)}
#nu-chip.ready small{color:var(--green)}
.nu-sheet{position:fixed;inset:0;z-index:35;display:grid;place-items:center;background:#010406b8;padding:16px}
.nu-card{width:min(420px,94vw);max-height:92vh;overflow:auto;padding:18px 16px 14px;border-radius:18px;background:#081115f8;border:1px solid #ffffff2a;box-shadow:0 20px 60px #000;display:grid;gap:8px}
.nu-card h3{margin:0;font:900 26px/1 var(--display);letter-spacing:1.5px;text-align:center}
.nu-card h3 small{display:block;margin-top:4px;font:800 9px var(--ui);letter-spacing:2px;color:var(--dim)}
.nu-row{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;padding:9px 11px;border-radius:12px;background:#ffffff08;border:1px solid var(--line);text-align:left}
.nu-row.ready{border-color:#6dffa066;background:#6dffa012}
.nu-row b{font:900 13px var(--ui);letter-spacing:.8px}
.nu-row b em{margin-left:6px;font:800 8px var(--ui);letter-spacing:1.2px;color:var(--dim);font-style:normal}
.nu-row small{grid-column:1/-1;font:700 9px var(--ui);letter-spacing:1.2px;color:var(--dim)}
.nu-row span{font:900 11px var(--display);letter-spacing:.6px;color:var(--amber);white-space:nowrap}
.nu-row.ready span{color:var(--green)}
.nu-bar{grid-column:1/-1;height:5px;border-radius:3px;background:#ffffff14;overflow:hidden}
.nu-bar i{display:block;height:100%;width:var(--v);background:linear-gradient(90deg,#e5483a,#ffc34d)}
.nu-row.ready .nu-bar i{background:var(--green)}
.nu-list{display:grid;gap:8px}
.nu-card .row{justify-content:center;margin-top:4px}
@media (orientation:landscape){.nu-card{width:min(680px,94vw)}.nu-list{grid-template-columns:1fr 1fr}}
@media (max-height:430px){.nu-card{padding:12px 12px 10px;gap:6px}.nu-card h3{font-size:22px}.nu-list{gap:6px}.nu-row{padding:6px 10px}.nu-card .row{margin-top:0}.nu-card .cta{padding:11px 26px}.nu-card .ghost{padding:10px 16px}}
`;

export function init(api) {
  const { bus, $ } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = v => (typeof v === 'number' ? v.toLocaleString() : String(v));
  const line = g => (g.ready ? 'READY · ' + g.name : g.name + ' · ' + fmt(g.cur) + '/' + fmt(g.need) + (g.unit && g.unit !== 'LV' && g.unit !== 'LEAGUE' ? ' ' + g.unit : ''));

  const chip = el('button', 'ghost');
  chip.id = 'nu-chip';
  const chipName = el('span', '', '🎯 NEXT UP'), chipSub = el('small');
  chip.append(chipName, chipSub);
  $('#menu-extras')?.appendChild(chip);
  let cache = [];
  function render() {
    cache = goals(api);
    const top = cache[0];
    chip.classList.toggle('hidden', !top);
    chip.classList.toggle('ready', !!top?.ready);
    chipSub.textContent = top ? line(top) : '';
    return cache;
  }

  let sheet = null;
  function close() { sheet?.remove(); sheet = null; }
  function go(g) {
    close();
    if (g.kind === 'weapon') { document.querySelector('[data-open="armory"]')?.click(); return; }
    document.querySelector('[data-open="locker"]')?.click();
  }
  function open() {
    close();
    const list = render().slice(0, SHEET);
    sheet = el('div', 'nu-sheet');
    const card = el('div', 'nu-card'), h = el('h3', '', 'NEXT UP');
    h.appendChild(el('small', '', list.length ? 'YOUR CLOSEST UNLOCKS · TAP ONE TO GO THERE' : 'EVERYTHING IS UNLOCKED'));
    card.appendChild(h);
    const wrap = el('div', 'nu-list');
    card.appendChild(wrap);
    for (const g of list) {
      const row = el('button', 'nu-row' + (g.ready ? ' ready' : '')), b = el('b', '', g.name);
      b.appendChild(el('em', '', g.label));
      row.append(b, el('span', '', g.ready ? 'READY' : fmt(g.cur) + ' / ' + fmt(g.need)), el('small', '', g.text));
      const bar = el('div', 'nu-bar'), i = el('i');
      i.style.setProperty('--v', Math.round(g.pct * 100) + '%');
      bar.appendChild(i);
      row.appendChild(bar);
      row.onclick = () => { api.haptic('LIGHT'); go(g); };
      wrap.appendChild(row);
    }
    const row = el('div', 'row'), deploy = el('button', 'cta', 'DEPLOY'), back = el('button', 'ghost', 'BACK');
    deploy.onclick = () => { close(); api.startGame(api.deployOpts()); };
    back.onclick = close;
    row.append(deploy, back);
    card.appendChild(row);
    sheet.appendChild(card);
    sheet.onclick = e => { if (e.target === sheet) close(); };
    document.body.appendChild(sheet);
  }
  chip.onclick = () => { api.sfx.init?.(); api.haptic('LIGHT'); open(); };

  bus.on('screen', ({ id }) => { if (id === 'menu') render(); else close(); });
  bus.on('run:end', render);
  bus.on('purchase', render);
  bus.on('level:reward', render);
  bus.on('app:ready', render);
  render();

  api.nextup = { goals: () => goals(api), progress: req => progress(api, req), open, close, render, get list() { return cache; } };
}
