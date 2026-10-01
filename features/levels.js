import { SLOTS, EXTRA_SLOTS } from '../character.js';

export const id = 'levels';
export const CRATE_EVERY = 5, SCRAP_CAP = 1500, CRATE_FALLBACK = 1000;
export const levelScrap = level => Math.min(SCRAP_CAP, 100 * level);
export const isCrateLevel = level => level > 1 && level % CRATE_EVERY === 0;

export function cratePool(profile) {
  const out = [];
  for (const s of [...SLOTS, ...EXTRA_SLOTS]) {
    if (s.hidden) continue;
    s.items.forEach((it, i) => { if (it.cost > 0 && !it.req && !it.premium && !profile.owned?.[s.id + ':' + i]) out.push({ slot: s.id, label: s.label, i, name: it.name, cost: it.cost }); });
  }
  return out;
}
export function rewardsFor(level, profile, rnd = Math.random) {
  const list = [{ kind: 'scrap', amount: levelScrap(level) }];
  if (isCrateLevel(level)) {
    const pool = cratePool(profile);
    if (pool.length) list.push({ kind: 'item', ...pool[Math.floor(rnd() * pool.length)] });
    else list.push({ kind: 'scrap', amount: CRATE_FALLBACK, crate: true });
  }
  return list;
}
export const label = r => (r.kind === 'item' ? '🎁 LEVEL CRATE: ' + r.name : (r.crate ? '🎁 LEVEL CRATE: ' : '+') + r.amount.toLocaleString() + ' 🔩');

const CSS = `
.lv-sheet{position:fixed;inset:0;z-index:36;display:grid;place-items:center;background:#010406c0;padding:16px}
.lv-card{width:min(340px,92vw);padding:20px 18px 16px;border-radius:18px;background:#081115f8;border:1px solid #ffc34d77;box-shadow:0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center;animation:pgIn .35s cubic-bezier(.2,1.4,.4,1) both}
.lv-card small{font:900 10px var(--ui);letter-spacing:2px;color:var(--amber)}
.lv-card h3{margin:0;font:900 34px/1 var(--display);letter-spacing:1.5px}
.lv-card h3 em{color:var(--amber);font-style:normal}
.lv-card .lv-box{font-size:40px;line-height:1}
.lv-card p{margin:0;font:800 11px/1.6 var(--ui);letter-spacing:1.1px}
.lv-card p b{color:var(--amber)}
.lv-card p.dim{color:var(--dim);font-size:10px}
.lv-card .cta{margin-top:6px;padding:12px 30px}
.lv-note{position:fixed;left:50%;top:max(14px,var(--st));transform:translateX(-50%);z-index:30;max-width:92vw;padding:8px 14px;border-radius:20px;background:#081115f0;border:1px solid #ffc34d77;color:var(--amber);font:900 10px var(--ui);letter-spacing:1.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity .3s}
.lv-note.on{opacity:1}
`;

export function init(api) {
  const { bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const L = () => { const l = profile.levels ||= { paid: 0 }; if (!l.paid) l.paid = api.levelInfo().level; return l; };
  L();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function grant(r) {
    if (r.kind === 'scrap') { profile.scrap += r.amount; return; }
    const key = r.slot + ':' + r.i;
    profile.owned[key] = true;
    if (!profile.fresh.includes(key)) profile.fresh.push(key);
  }
  function chips(granted) {
    const box = api.$('#over-rewards');
    if (!box) return;
    for (const g of granted) for (const r of g.rewards) { const c = el('span', r.kind === 'item' || r.crate ? 'hot' : 'gold', label(r) + (r.kind === 'scrap' && !r.crate ? ' LEVEL ' + g.level : '')); box.appendChild(c); }
  }
  const note = el('div', 'lv-note');
  document.body.appendChild(note);
  let noteTimer = null;
  function toast(granted) {
    note.textContent = '⬆️ LEVEL ' + granted[granted.length - 1].level + ' · ' + granted.flatMap(g => g.rewards.map(label)).join(' · ');
    note.classList.add('on');
    clearTimeout(noteTimer); noteTimer = setTimeout(() => note.classList.remove('on'), 3500);
  }
  function modal(granted) {
    if (api.activeScreen !== api.ui.menu) return toast(granted);
    api.queueModal(done => {
      const sheet = el('div', 'lv-sheet'), card = el('div', 'lv-card'), top = granted[granted.length - 1].level, ok = el('button', 'cta', 'COLLECT');
      const h = el('h3', '', 'LEVEL ');
      h.appendChild(el('em', '', String(top)));
      const p = el('p');
      for (const g of granted) for (const r of g.rewards) { if (p.childNodes.length) p.appendChild(el('br')); p.appendChild(el('b', '', label(r))); p.append(granted.length > 1 ? ' · LEVEL ' + g.level : ''); }
      const hasItem = granted.some(g => g.rewards.some(r => r.kind === 'item'));
      card.append(el('small', '', 'LEVEL UP'), el('div', 'lv-box', hasItem ? '🎁' : '⬆️'), h, p, el('p', 'dim', hasItem ? 'YOUR NEW ITEM IS WAITING IN THE LOCKER' : 'A LEVEL CRATE WITH A FREE COSMETIC EVERY ' + CRATE_EVERY + ' LEVELS'), ok);
      sheet.appendChild(card);
      document.body.appendChild(sheet);
      ok.onclick = () => { sheet.remove(); api.sfx.pickup?.(); api.haptic('MEDIUM'); done(); };
    }, 1);
  }
  function check(where = 'menu') {
    const lv = api.levelInfo().level, st = L();
    if (lv <= st.paid) return [];
    const granted = [];
    for (let l = st.paid + 1; l <= lv; l++) { const rewards = rewardsFor(l, profile); rewards.forEach(grant); granted.push({ level: l, rewards }); }
    st.paid = lv;
    api.saveProfile();
    api.refreshProfileUI();
    if (where === 'over') chips(granted); else modal(granted);
    api.haptic('HEAVY');
    bus.emit('level:reward', { levels: granted });
    return granted;
  }

  bus.on('run:end', () => setTimeout(() => check('over'), 0));
  bus.on('mission:complete', () => check('menu'));
  bus.on('season:claim', () => check('menu'));
  bus.on('cloud:restored', () => { const st = L(); st.paid = Math.max(st.paid, api.levelInfo().level); api.saveProfile(); });
  bus.on('screen', ({ id }) => { if (id !== 'game' && id !== 'over') check('menu'); });

  api.levels = { check, rewardsFor: l => rewardsFor(l, profile), cratePool: () => cratePool(profile), levelScrap, isCrateLevel, get state() { return L(); } };
}
