import { mulberry32, hashSeed } from '../core.js';
import { cratePool } from './levels.js';

export const id = 'market';
export const CRATE_COST = 1000, PITY_EVERY = 4, SHARDS_PER_SKIN = 3, EXCLUSIVE_COST = 1200, DISCOUNT = .4, MIN_DISCOUNT_COST = 150, REROLL_PER_WAVE = 100;
export const CONSUMABLES = [
  { id: 'shield', icon: '🛡', name: 'STREAK SHIELD', desc: 'COVERS ONE MISSED DAY OF YOUR STREAK', cost: 600 },
  { id: 'revive', icon: '💉', name: 'REVIVE TOKEN', desc: 'ONE FREE REVIVE · NORMAL AND EXTRACTION RUNS', cost: 500 },
  { id: 'reroll', icon: '🎲', name: 'MISSION REROLL', desc: 'ONE EXTRA MISSION REROLL, ANY DAY', cost: 300 },
];
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const discountPrice = cost => Math.max(50, Math.round(cost * (1 - DISCOUNT) / 10) * 10);
export const exclusives = slots => slots.find(s => s.id === 'gun').items.map((it, i) => ({ ...it, slot: 'gun', i })).filter(it => it.req?.startsWith('market:'));
export function stock(key, profile, slots) {
  const rnd = mulberry32(hashSeed('market:' + key));
  const pool = cratePool(profile).filter(it => it.cost >= MIN_DISCOUNT_COST);
  const disc = pool.length ? pool[(rnd() * pool.length) | 0] : null;
  const ex = exclusives(slots).filter(it => !profile.owned?.['gun:' + it.i]);
  const excl = ex.length ? ex[(rnd() * ex.length) | 0] : null;
  const cons = CONSUMABLES[(rnd() * CONSUMABLES.length) | 0];
  return {
    disc: disc && { slot: disc.slot, i: disc.i, name: disc.name, label: disc.label, cost: disc.cost, price: discountPrice(disc.cost) },
    excl: excl && { slot: 'gun', i: excl.i, name: excl.name, req: excl.req, price: EXCLUSIVE_COST },
    cons: cons.id,
  };
}
export function openCrate(profile, rnd = Math.random) {
  const M = profile.market, pool = cratePool(profile), guns = pool.filter(it => it.slot === 'gun');
  M.crates = (M.crates || 0) + 1;
  if (!pool.length) { M.shards = (M.shards || 0) + 1; return { kind: 'shard', shards: M.shards }; }
  const forced = (M.pity || 0) + 1 >= PITY_EVERY && guns.length > 0;
  const from = forced ? guns : pool, it = from[(rnd() * from.length) | 0];
  profile.owned[it.slot + ':' + it.i] = true;
  M.pity = it.slot === 'gun' ? 0 : (M.pity || 0) + 1;
  return { kind: 'item', slot: it.slot, i: it.i, name: it.name, label: it.label, cost: it.cost, forced };
}

const CSS = `
#mk-open small{color:#ffc34d}
#market .panel{width:min(94vw,620px)}
#market .sub{margin-bottom:10px}
.mk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.mk-card{position:relative;display:grid;gap:4px;justify-items:center;padding:12px 10px 10px;border-radius:14px;border:1px solid var(--line);background:#0b161b;text-align:center;min-width:0}
.mk-card small{font:900 8.5px var(--ui);letter-spacing:1.8px;color:var(--dim)}
.mk-card.deal small{color:#6dff8a}.mk-card.excl small{color:#b48cff}.mk-card.cons small{color:#6fe3ff}.mk-card.crate small{color:#ffc34d}
.mk-card i{font-style:normal;font-size:26px;line-height:1}
.mk-card b{font:900 12px var(--ui);letter-spacing:1.4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.mk-card span{font:700 9px/1.4 var(--ui);letter-spacing:1px;color:var(--dim)}
.mk-card span.was{text-decoration:line-through;opacity:.7}
.mk-card em{font-style:normal;font:900 9px var(--ui);letter-spacing:1.2px;color:#ffc34d}
.mk-card .cta,.mk-card .ghost{margin-top:4px;padding:9px 14px;font-size:10px;width:100%}
.mk-card.sold{opacity:.55}
.mk-card.sold .cta{background:#1a2228;color:var(--dim);box-shadow:none}
.mk-pity{width:100%;height:5px;border-radius:3px;background:#162028;overflow:hidden}
.mk-pity b{display:block;height:100%;background:linear-gradient(90deg,#ffc34d,#ff7a4d);border-radius:3px}
#mk-note{min-height:16px;margin:8px 0 4px;font:800 10px var(--ui);letter-spacing:1.2px;color:#ffc34d}
.mk-sheet{position:fixed;inset:0;z-index:36;display:grid;place-items:center;background:#010406c8;padding:16px}
.mk-reveal{width:min(320px,92vw);padding:20px 18px 16px;border-radius:18px;background:#081115f8;border:1px solid #ffc34d77;box-shadow:0 0 40px #ffc34d33,0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center;animation:mk-pop .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes mk-pop{from{transform:scale(.6);opacity:0}}
.mk-reveal small{font:900 10px var(--ui);letter-spacing:2px;color:#ffc34d}
.mk-reveal i{font-style:normal;font-size:40px;line-height:1}
.mk-reveal h3{margin:0;font:900 26px/1 var(--display);letter-spacing:1.5px}
.mk-reveal p{margin:0;font:800 10px/1.5 var(--ui);letter-spacing:1.1px;color:var(--dim)}
#perk-reroll{margin-top:10px;padding:9px 18px;font-size:10px}
#perk-reroll.hidden{display:none}
@media (max-height:430px) and (orientation:landscape){.mk-grid{grid-template-columns:repeat(4,1fr)}#market .panel{width:min(96vw,760px);padding:16px 18px}.mk-card i{font-size:20px}}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n).toLocaleString();
  const M = () => (profile.market ||= { day: '', stock: null, sold: {}, crates: 0, pity: 0, shards: 0, revives: 0, rerolls: 0, seen: '' });
  const key = () => dayKey();
  function refresh() {
    const m = M();
    if (m.day === key() && m.stock) return m;
    m.day = key(); m.stock = stock(m.day, profile, api.SLOTS); m.sold = {};
    api.saveProfile();
    return m;
  }
  const consOf = id => CONSUMABLES.find(c => c.id === id);
  api.reqs.market = {
    met: v => { const it = exclusives(api.SLOTS).find(x => x.req === 'market:' + v); return !!(it && profile.owned?.['gun:' + it.i]); },
    text: () => 'BLACK MARKET EXCLUSIVE · STOCK ROTATES DAILY',
  };

  const btn = el('button', 'ghost');
  btn.id = 'mk-open';
  const btnLabel = el('span', '', '🕶 MARKET'), badge = el('span', 'badge');
  btn.append(btnLabel, badge);
  $('#menu-extras')?.appendChild(btn);
  function renderMenu() {
    const m = refresh();
    badge.textContent = m.seen !== m.day ? '!' : '';
    badge.classList.toggle('hidden', m.seen === m.day);
  }

  const screen = el('section', 'screen');
  screen.id = 'market';
  screen.innerHTML = '<div class="panel"><h2>BLACK MARKET</h2><div class="sub" id="mk-sub"></div><div class="mk-grid" id="mk-grid"></div><div id="mk-note"></div><div class="row" style="justify-content:center"><button class="ghost" id="mk-back">BACK</button></div></div>';
  document.body.appendChild(screen);
  api.registerScreen(screen);
  const grid = screen.querySelector('#mk-grid'), noteEl = screen.querySelector('#mk-note');
  screen.querySelector('#mk-back').onclick = () => api.showScreen(api.ui.menu);
  let note = '';
  const until = () => { const mins = Math.max(1, Math.ceil((Date.parse(key() + 'T00:00:00Z') + 864e5 - Date.now()) / 6e4)), h = Math.floor(mins / 60), mm = mins % 60; return h ? h + 'H' + (mm ? ' ' + mm + 'M' : '') : mm + 'M'; };

  function card(cls, kicker, icon, name, descParts, action) {
    const c = el('div', 'mk-card ' + cls);
    c.append(el('small', '', kicker), el('i', '', icon), el('b', '', name));
    for (const d of descParts) c.appendChild(d);
    c.appendChild(action);
    return c;
  }
  function render() {
    const m = refresh(), s = m.stock;
    screen.querySelector('#mk-sub').textContent = 'STOCK ROTATES IN ' + until() + ' · YOU HAVE 🔩 ' + fmt(profile.scrap);
    grid.innerHTML = '';
    if (s.disc) {
      const sold = !!m.sold.disc || !!profile.owned[s.disc.slot + ':' + s.disc.i];
      const b = el('button', 'cta', sold ? 'SOLD' : '🔩 ' + fmt(s.disc.price));
      b.dataset.buy = 'disc'; b.disabled = sold;
      b.onclick = () => buy('disc');
      grid.appendChild(card('deal' + (sold ? ' sold' : ''), "TODAY'S DEAL · 40% OFF", '🏷', s.disc.name, [el('span', '', s.disc.label), el('span', 'was', '🔩 ' + fmt(s.disc.cost))], b));
    } else grid.appendChild(card('deal sold', "TODAY'S DEAL", '🏷', 'NOTHING LEFT', [el('span', '', 'YOU OWN EVERY SCRAP COSMETIC')], el('button', 'cta', 'SOLD OUT')));
    if (s.excl) {
      const sold = !!m.sold.excl || !!profile.owned['gun:' + s.excl.i];
      const b = el('button', 'cta', sold ? 'OWNED' : '🔩 ' + fmt(s.excl.price));
      b.dataset.buy = 'excl'; b.disabled = sold;
      b.onclick = () => buy('excl');
      grid.appendChild(card('excl' + (sold ? ' sold' : ''), 'EXCLUSIVE · ONLY SOLD HERE', '🔫', s.excl.name, [el('span', '', 'WEAPON SKIN'), el('span', '', m.shards >= SHARDS_PER_SKIN && !sold ? 'OR REDEEM ' + SHARDS_PER_SKIN + ' SHARDS' : 'BACK IN STOCK SOME OTHER DAY')], b));
    } else grid.appendChild(card('excl sold', 'EXCLUSIVE', '🔫', 'COLLECTION COMPLETE', [el('span', '', 'YOU OWN EVERY MARKET SKIN')], el('button', 'cta', 'SOLD OUT')));
    const c = consOf(s.cons), shields = api.progression?.state?.streak?.shields || 0, max = api.progression?.data?.SHIELD_MAX ?? 2;
    const consSold = !!m.sold.cons, capped = c.id === 'shield' && shields >= max;
    const cb = el('button', 'cta', consSold ? 'SOLD' : capped ? 'SHIELDS FULL' : '🔩 ' + fmt(c.cost));
    cb.dataset.buy = 'cons'; cb.disabled = consSold || capped;
    cb.onclick = () => buy('cons');
    const have = c.id === 'shield' ? '🛡 ×' + shields + ' / ' + max : c.id === 'revive' ? '💉 ×' + (m.revives || 0) : '🎲 ×' + (m.rerolls || 0);
    grid.appendChild(card('cons' + (consSold ? ' sold' : ''), 'SUPPLIES · ONE PER DAY', c.icon, c.name, [el('span', '', c.desc), el('em', '', 'YOU HAVE ' + have)], cb));
    const pool = cratePool(profile), guns = pool.filter(it => it.slot === 'gun'), left = Math.max(1, PITY_EVERY - (m.pity || 0));
    const pity = el('div', 'mk-pity'), fill = el('b');
    fill.style.width = (100 * (m.pity || 0) / PITY_EVERY) + '%';
    pity.appendChild(fill);
    const pityText = !pool.length ? 'POOL EMPTY · CRATES PAY SHARDS' : guns.length ? (left === 1 ? 'NEXT CRATE IS A WEAPON SKIN' : 'WEAPON SKIN GUARANTEED IN ' + left + ' CRATES') : 'ALL WEAPON SKINS OWNED';
    const crb = el('button', 'cta', '🔩 ' + fmt(CRATE_COST));
    crb.dataset.buy = 'crate';
    crb.onclick = () => buyCrate();
    const shardLine = el('em', '', (m.shards || 0) + ' / ' + SHARDS_PER_SKIN + ' SKIN SHARDS' + (pool.length ? '' : ' · +1 PER CRATE'));
    const crate = card('crate', 'SUPPLY CRATE · NO DUPLICATES', '🎁', 'RANDOM COSMETIC', [el('span', '', pool.length + ' LEFT IN THE POOL · ' + (m.crates || 0) + ' OPENED'), el('span', '', pityText), pity, shardLine], crb);
    if ((m.shards || 0) >= SHARDS_PER_SKIN && s.excl && !m.sold.excl && !profile.owned['gun:' + s.excl.i]) {
      const rb = el('button', 'ghost', 'REDEEM ' + SHARDS_PER_SKIN + ' SHARDS → ' + s.excl.name);
      rb.id = 'mk-redeem'; rb.onclick = () => redeem();
      crate.appendChild(rb);
    }
    grid.appendChild(crate);
    noteEl.textContent = note;
  }

  function pay(cost, item) {
    if (profile.scrap < cost) { note = 'NEED ' + fmt(cost - profile.scrap) + ' MORE SCRAP · SURVIVE LONGER RUNS TO EARN IT'; api.haptic('LIGHT'); return false; }
    profile.scrap -= cost;
    bus.emit('purchase', { kind: 'scrap', item, cost });
    bus.emit('market:buy', { item, cost });
    return true;
  }
  function buy(which) {
    const m = refresh(), s = m.stock;
    let ok = false;
    if (which === 'disc' && s.disc && !m.sold.disc && !profile.owned[s.disc.slot + ':' + s.disc.i]) {
      ok = pay(s.disc.price, 'market:' + s.disc.slot + ':' + s.disc.i);
      if (ok) { profile.owned[s.disc.slot + ':' + s.disc.i] = true; m.sold.disc = true; if (!profile.fresh.includes(s.disc.slot + ':' + s.disc.i)) profile.fresh.push(s.disc.slot + ':' + s.disc.i); note = s.disc.name + ' IS YOURS · EQUIP IT IN THE LOCKER'; }
    } else if (which === 'excl' && s.excl && !m.sold.excl && !profile.owned['gun:' + s.excl.i]) {
      ok = pay(s.excl.price, 'market:gun:' + s.excl.i);
      if (ok) { profile.owned['gun:' + s.excl.i] = true; m.sold.excl = true; if (!profile.fresh.includes('gun:' + s.excl.i)) profile.fresh.push('gun:' + s.excl.i); note = s.excl.name + ' IS YOURS · EQUIP IT IN THE LOCKER'; }
    } else if (which === 'cons' && !m.sold.cons) {
      const c = consOf(s.cons), st = api.progression?.state?.streak, max = api.progression?.data?.SHIELD_MAX ?? 2;
      if (c.id === 'shield' && (!st || (st.shields || 0) >= max)) { note = 'YOUR STREAK SHIELDS ARE FULL'; ok = false; }
      else {
        ok = pay(c.cost, 'market:' + c.id);
        if (ok) {
          m.sold.cons = true;
          if (c.id === 'shield') st.shields = (st.shields || 0) + 1;
          if (c.id === 'revive') m.revives = (m.revives || 0) + 1;
          if (c.id === 'reroll') m.rerolls = (m.rerolls || 0) + 1;
          note = c.name + ' ADDED';
        }
      }
    }
    if (ok) { api.saveProfile(); api.refreshProfileUI(); api.sfx.pickup?.(); api.haptic('MEDIUM'); }
    if (api.activeScreen === screen) render();
    return ok;
  }
  let sheet = null;
  function reveal(r) {
    sheet?.remove();
    sheet = el('div', 'mk-sheet');
    const box = el('div', 'mk-reveal'), ok = el('button', 'cta'), close = el('button', 'ghost', 'CLOSE');
    if (r.kind === 'shard') {
      box.append(el('small', '', 'SUPPLY CRATE'), el('i', '', '💠'), el('h3', '', 'SKIN SHARD'), el('p', '', r.shards + ' / ' + SHARDS_PER_SKIN + ' · REDEEM ' + SHARDS_PER_SKIN + ' FOR THE EXCLUSIVE OF THE DAY'));
      ok.textContent = 'OK'; ok.onclick = () => { sheet?.remove(); sheet = null; };
      box.append(ok);
    } else {
      box.append(el('small', '', r.forced ? 'SUPPLY CRATE · GUARANTEED SKIN' : 'SUPPLY CRATE'), el('i', '', r.slot === 'gun' ? '🔫' : '🎁'), el('h3', '', r.name), el('p', '', r.label + ' · WORTH 🔩 ' + fmt(r.cost)));
      ok.textContent = 'EQUIP'; ok.onclick = () => { profile.loadout[r.slot] = r.i; api.saveProfile(); api.refreshProfileUI(); sheet?.remove(); sheet = null; note = r.name + ' EQUIPPED'; if (api.activeScreen === screen) render(); };
      close.onclick = () => { sheet?.remove(); sheet = null; };
      const row = el('div', 'row'); row.append(ok, close); box.append(row);
    }
    sheet.appendChild(box);
    document.body.appendChild(sheet);
  }
  function buyCrate(rnd = Math.random) {
    const m = refresh();
    if (!pay(CRATE_COST, 'market:crate')) { if (api.activeScreen === screen) render(); return null; }
    const r = openCrate(profile, rnd);
    if (r.kind === 'item' && !profile.fresh.includes(r.slot + ':' + r.i)) profile.fresh.push(r.slot + ':' + r.i);
    api.saveProfile(); api.refreshProfileUI();
    api.sfx.pickup?.(); api.haptic('HEAVY');
    bus.emit('market:crate', r);
    note = r.kind === 'shard' ? 'SKIN SHARD ' + m.shards + ' / ' + SHARDS_PER_SKIN : r.name + ' UNLOCKED';
    if (api.activeScreen === screen) { render(); reveal(r); }
    return r;
  }
  function redeem() {
    const m = refresh(), s = m.stock;
    if ((m.shards || 0) < SHARDS_PER_SKIN || !s.excl || m.sold.excl || profile.owned['gun:' + s.excl.i]) return false;
    m.shards -= SHARDS_PER_SKIN;
    profile.owned['gun:' + s.excl.i] = true; m.sold.excl = true;
    if (!profile.fresh.includes('gun:' + s.excl.i)) profile.fresh.push('gun:' + s.excl.i);
    note = s.excl.name + ' REDEEMED · EQUIP IT IN THE LOCKER';
    api.saveProfile(); api.refreshProfileUI(); api.sfx.pickup?.(); api.haptic('HEAVY');
    bus.emit('market:buy', { item: 'market:gun:' + s.excl.i, cost: 0, shards: SHARDS_PER_SKIN });
    if (api.activeScreen === screen) render();
    return true;
  }
  function open() {
    api.sfx.init?.();
    const m = refresh();
    m.seen = m.day; note = '';
    api.saveProfile();
    renderMenu();
    render();
    api.showScreen(screen);
  }
  btn.onclick = open;

  const rerollBtn = el('button', 'ghost hidden', 'REROLL');
  rerollBtn.id = 'perk-reroll';
  $('#perk-list')?.after(rerollBtn);
  let rerolledWave = -1, rerollRun = 0;
  const rerollCost = () => REROLL_PER_WAVE * Math.max(1, api.state.wave);
  function renderReroll() {
    const st = api.state, allowed = !st.perkKit && !st.net && (st.runType === 'normal' || st.runType === 'extract');
    rerollBtn.classList.toggle('hidden', !allowed);
    if (!allowed) return;
    const used = rerolledWave === st.wave && rerollRun === st.startedAt, cost = rerollCost();
    rerollBtn.disabled = used || profile.scrap < cost;
    rerollBtn.textContent = used ? 'REROLLED THIS WAVE' : '🎲 REROLL · 🔩 ' + fmt(cost) + (profile.scrap < cost ? ' · NOT ENOUGH SCRAP' : '');
  }
  rerollBtn.onclick = () => {
    const st = api.state;
    if (st.mode !== 'perk' || rerollBtn.disabled) return;
    const cost = rerollCost();
    if (!pay(cost, 'perk:reroll')) return;
    rerolledWave = st.wave; rerollRun = st.startedAt;
    st.perkRerolls = (st.perkRerolls || 0) + 1;
    api.saveProfile(); api.refreshProfileUI();
    api.sfx.pickup?.(); api.haptic('MEDIUM');
    bus.emit('perk:reroll', { wave: st.wave, cost });
    api.offerPerks(0);
  };
  bus.on('screen', ({ id }) => { if (id === 'menu') renderMenu(); if (id === 'perks') renderReroll(); });
  bus.on('cloud:restored', () => { if (api.activeScreen === screen) render(); });
  renderMenu();

  api.market = {
    CRATE_COST, PITY_EVERY, SHARDS_PER_SKIN, EXCLUSIVE_COST, CONSUMABLES,
    state: () => M(), stock: () => refresh().stock, buy, buyCrate, redeem, open, render,
    hasRevive: () => (M().revives || 0) > 0,
    useRevive: () => { const m = M(); if (!m.revives) return false; m.revives--; api.saveProfile(); return true; },
  };
}
