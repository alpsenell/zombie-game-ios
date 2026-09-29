import { STORE_PREFIX } from '../weapons.js';
import { SUITS, WEAPON_SKINS } from '../character.js';

export const EPOCH = Date.UTC(2026, 8, 21);
export const SEASON_DAYS = 42, TIERS = 30, TIER_XP = 1000, RUN_CAP = 600, MISSION_CAP = 500;
const DAY = 864e5;
const NAMES = ['BLACK HARVEST', 'DEEP WATER', 'DEAD RECKONING', 'SCORCHED EARTH', 'NIGHT SHIFT', 'LAST LIGHT', 'COLD STORAGE', 'RED TIDE'];

export function seasonAt(t = Date.now()) {
  const now = Math.max(t, EPOCH), i = Math.floor((now - EPOCH) / (SEASON_DAYS * DAY));
  const start = EPOCH + i * SEASON_DAYS * DAY, end = start + SEASON_DAYS * DAY;
  return { n: i + 1, name: NAMES[i % NAMES.length], start, end, daysLeft: Math.max(1, Math.ceil((end - t) / DAY)) };
}
export const passId = n => STORE_PREFIX + 'season.' + n + '.pass';
export function runXP(s) {
  if (!s || !(s.score > 0)) return 0;
  const raw = Math.max(0, (s.wave | 0) - (s.startWave || 1) + 1) * 25 + (s.kills | 0) * 1.5 + (s.heads | 0) + s.score / 250 + (s.bosses?.length || 0) * 50;
  return Math.max(0, Math.min(RUN_CAP, Math.round(raw)));
}
export const seasonSuit = n => SUITS.findIndex(x => x?.season === n);
export const seasonSkin = n => WEAPON_SKINS.findIndex(x => x.season === n);
export function reward(n, t, track) {
  if (track === 'free') {
    if (t === 10) return { kind: 'flair', id: 'badge', label: 'SEASON BADGE' };
    if (t === 30) return { kind: 'flair', id: 'banner', label: 'VETERAN BANNER' };
    if (t % 5 === 0) return { kind: 'scrap', amount: 400 + t * 20 };
    return t % 2 ? { kind: 'scrap', amount: 100 + t * 10 } : { kind: 'xp', amount: 300 + t * 30 };
  }
  const suit = seasonSuit(n), skin = seasonSkin(n);
  if (t === 1) return suit > 0 ? { kind: 'suit', suit, label: SUITS[suit].name } : { kind: 'flair', id: 'frame', label: 'GOLD FRAME' };
  if (t === 5 && suit > 0) return { kind: 'flair', id: 'frame', label: 'GOLD FRAME' };
  if (t === 10) return { kind: 'scrap', amount: 1500 };
  if (t === 15) return { kind: 'flair', id: 'elite', label: 'ELITE BANNER' };
  if (t === 20 && skin > 0) return { kind: 'skin', skin, label: WEAPON_SKINS[skin].name + ' SKIN' };
  if (t === 30) return { kind: 'scrap', amount: 5000 };
  return { kind: 'scrap', amount: 200 + t * 20 };
}
const label = r => r.label || (r.kind === 'scrap' ? r.amount.toLocaleString() + ' SCRAP' : r.amount.toLocaleString() + ' XP');
const icon = r => ({ scrap: '🔩', xp: '⚡', flair: '🎖', suit: '★', skin: '🔫' })[r.kind];
export function flairText(profile) {
  const f = profile.season?.flair || {};
  if (f.elite) return 'SEASON ' + f.elite + ' ELITE';
  if (f.banner) return 'SEASON ' + f.banner + ' VETERAN';
  if (f.badge) return 'SEASON ' + f.badge;
  return '';
}

const CSS = `
#sp-open{border-color:#ffc34d66;color:var(--amber)}
#season{background:#010406f0;padding:0;place-items:stretch;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);overflow:hidden}
.sp{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-width:0;min-height:0;padding:max(12px,var(--st)) max(16px,var(--sr)) max(12px,var(--sb)) max(16px,var(--sl));text-align:left}
.sp-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;flex:none}
.sp-title small{display:block;font:800 10px var(--ui);letter-spacing:2px;color:var(--amber)}
.sp-title h2{margin:2px 0 0;font:900 28px/1 var(--display);letter-spacing:2px}
.sp-prog{flex:1;min-width:170px}
.sp-prog b{font:900 16px var(--display);letter-spacing:1px}
.sp-prog .xp{width:100%;max-width:320px;height:8px}
.sp-prog small{display:block;margin-top:4px;font:800 9px var(--ui);letter-spacing:1.4px;color:var(--dim)}
.sp-track{flex:1 1 0;min-height:0;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;touch-action:pan-x;scrollbar-width:none;padding-bottom:2px}
.sp-track::-webkit-scrollbar{display:none}
.sp-col{flex:none;width:clamp(86px,12vw,112px);display:grid;grid-template-rows:20px 1fr 1fr;gap:6px}
.sp-col.labels{position:sticky;left:0;z-index:2;width:34px;background:#010406}
.sp-col.labels span{display:grid;place-items:center;border-radius:10px;writing-mode:vertical-rl;transform:rotate(180deg);font:900 9px var(--ui);letter-spacing:2px;color:var(--dim);background:#ffffff08}
.sp-col.labels span.p{color:var(--amber);background:#ffc34d18}
.sp-num{display:grid;place-items:center;border-radius:6px;font:900 10px var(--ui);letter-spacing:1px;color:var(--dim)}
.sp-col.cur .sp-num{background:var(--red);color:#fff}
.sp-col.done .sp-num{color:#fff}
.sp-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 4px;border-radius:12px;border:1px solid var(--line);background:#0e191e;text-align:center;min-height:0;overflow:hidden}
.sp-cell i{font-style:normal;font-size:20px;line-height:1}
.sp-cell img{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#16242a}
.sp-cell b{font:800 9px/1.2 var(--ui);letter-spacing:.6px}
.sp-cell small{font:900 8px var(--ui);letter-spacing:1px;color:var(--dim)}
.sp-cell.prem{border-color:#ffc34d44;background:linear-gradient(160deg,#2a2210,#0e191e 70%)}
.sp-cell.prem b{color:var(--amber)}
.sp-cell.locked{opacity:.5}
.sp-cell.claimed{opacity:.6;border-color:#6dffa033}
.sp-cell.claimed small{color:#8fd8a8}
.sp-cell.ready{border-color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber),0 0 14px #ffc34d44;opacity:1}
.sp-cell.ready small{color:#1a1206;background:var(--amber);padding:2px 6px;border-radius:5px}
.sp-cell.pass small{color:var(--amber)}
.sp-cell.big{border-width:2px}
.sp-cell.hero{border-color:#ffd36a;background:linear-gradient(160deg,#4a3510,#1a1408 70%);box-shadow:0 0 18px #ffc34d55}
.sp-cell.hero:before{content:"INSTANT";position:absolute;top:4px;left:50%;transform:translateX(-50%);padding:1px 6px;border-radius:4px;background:linear-gradient(180deg,#ffe08a,#e0a02a);color:#1a1206;font:900 7px var(--ui);letter-spacing:1.2px}
.sp-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;flex-wrap:wrap}
.sp-foot .row{gap:8px;flex-wrap:nowrap}
.sp-foot button{white-space:nowrap}
.sp-side{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.sp-foot .cta{padding:13px 22px}
.sp-foot .ghost{padding:12px 14px}
#sp-note{color:var(--dim);font:600 11px var(--ui);flex:1;min-width:150px}
.sp-active{padding:8px 12px;border-radius:20px;background:#ffc34d22;border:1px solid #ffc34d77;color:var(--amber);font:900 11px var(--ui);letter-spacing:1.5px}
.sp-chip{display:inline-block;margin:0 4px 12px;padding:6px 11px;border-radius:20px;background:#ffc34d18;border:1px solid #ffc34d55;color:var(--amber);font:900 11px var(--ui);letter-spacing:1.2px}
.sp-tag{display:inline-block;margin-bottom:4px;padding:3px 9px;border-radius:6px;background:linear-gradient(90deg,#3a4248,#1a2024);border:1px solid #ffffff33;font:900 9px var(--ui);letter-spacing:2px;color:#dfe9e6}
.sp-tag.elite{background:linear-gradient(90deg,#ffd36a,#e0a02a);color:#1a1206;border-color:#ffe6a0;box-shadow:0 0 12px #ffc34d66}
.nametag.sp-framed{padding:8px 16px 10px;border-radius:14px;border:2px solid #ffc34d;background:#0b0a06aa;box-shadow:0 0 18px #ffc34d55,inset 0 0 12px #ffc34d33}
#inspect .panel.sp-framed{border:2px solid #ffc34d;box-shadow:0 0 26px #ffc34d55,0 20px 60px #000}
#sp-in-tag{align-self:flex-start}
@media (max-height:430px){.sp{gap:6px}.sp-title h2{font-size:22px}.sp-cell i{font-size:16px}.sp-cell img{width:30px;height:30px}.sp-foot .cta{padding:10px 18px}.sp-foot .ghost{padding:9px 12px}}
@media (orientation:portrait){.sp-track{flex:0 1 auto;height:min(52vh,320px)}.sp{justify-content:center}.sp-foot .row{width:100%;flex-wrap:wrap}.sp-foot .row button{flex:1 1 auto}}
`;

export const id = 'season';
export function init(api) {
  const { $, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  let note = '', lastRun = null, inspectMine = false;
  const thumbs = new Map();

  function state() {
    const cur = seasonAt();
    let s = profile.season;
    if (!s || typeof s !== 'object') s = profile.season = {};
    s.suits ||= {}; s.skins ||= {}; s.flair ||= {};
    if (s.n !== cur.n) { Object.assign(s, { n: cur.n, xp: 0, free: [], premium: [] }); api.saveProfile(); }
    s.free ||= []; s.premium ||= [];
    return s;
  }
  const hasPass = n => !!profile.iap?.[passId(n)];
  const tierOf = xp => Math.min(TIERS, 1 + Math.floor(xp / TIER_XP));
  function claimable() {
    const s = state(), tier = tierOf(s.xp), out = [];
    for (let t = 1; t <= tier; t++) {
      if (!s.free.includes(t)) out.push(['free', t]);
      if (hasPass(s.n) && !s.premium.includes(t)) out.push(['premium', t]);
    }
    return out;
  }
  function addXP(n) {
    const s = state(), before = tierOf(s.xp);
    s.xp = Math.min((TIERS - 1) * TIER_XP, s.xp + Math.max(0, Math.round(n) || 0));
    api.saveProfile();
    refresh();
    return { before, after: tierOf(s.xp) };
  }
  function grant(r, n) {
    const s = state();
    if (r.kind === 'scrap') profile.scrap += r.amount;
    if (r.kind === 'xp') profile.xp += r.amount;
    if (r.kind === 'flair') s.flair[r.id] = Math.max(s.flair[r.id] || 0, n);
    if (r.kind === 'suit') {
      s.suits[n] = true;
      const key = 'suit:' + r.suit;
      if (!profile.fresh.includes(key)) profile.fresh.push(key);
    }
    if (r.kind === 'skin') {
      s.skins[n] = true;
      const key = 'gun:' + r.skin;
      if (!profile.fresh.includes(key)) profile.fresh.push(key);
    }
  }
  function claim(track, t) {
    const s = state();
    const list = track === 'free' ? s.free : s.premium;
    if (list.includes(t) || t > tierOf(s.xp) || (track === 'premium' && !hasPass(s.n))) return false;
    list.push(t);
    const r = reward(s.n, t, track);
    grant(r, s.n);
    api.saveProfile();
    api.bus.emit('season:claim', { season: s.n, tier: t, track, reward: r });
    return r;
  }
  function claimAll() {
    const got = claimable().map(([track, t]) => claim(track, t)).filter(Boolean);
    if (got.length) { api.sfx.pickup?.(); api.haptic('MEDIUM'); }
    note = got.length ? 'CLAIMED ' + got.length + ' REWARD' + (got.length > 1 ? 'S' : '') : '';
    api.refreshProfileUI();
    render();
    return got;
  }

  const menuBtn = document.createElement('button');
  menuBtn.className = 'ghost';
  menuBtn.id = 'sp-open';
  menuBtn.append('SEASON');
  const badge = document.createElement('span');
  badge.className = 'badge';
  menuBtn.appendChild(badge);
  $('#menu-extras')?.appendChild(menuBtn);

  const el = document.createElement('section');
  el.id = 'season';
  el.className = 'screen';
  el.innerHTML = `<div class="sp">
    <div class="sp-head">
      <div class="sp-title"><small id="sp-kicker"></small><h2 id="sp-name"></h2></div>
      <div class="sp-prog"><b id="sp-tier"></b><div class="xp"><i id="sp-bar"></i></div><small id="sp-xp"></small></div>
      <div class="sp-side"><span class="sp-active hidden" id="sp-active">★ PASS ACTIVE</span><div class="scrap">🔩 <span id="sp-scrap"></span></div></div>
    </div>
    <div class="sp-track" id="sp-track"></div>
    <div class="sp-foot"><span id="sp-note"></span><div class="row"><button class="ghost" id="sp-claim">CLAIM ALL</button><button class="cta gold" id="sp-buy">BUY PASS</button><button class="cta" id="sp-back">BACK</button></div></div>
  </div>`;
  document.body.appendChild(el);
  api.registerScreen(el);

  function suitThumb(i) {
    if (!thumbs.has(i)) {
      thumbs.set(i, api.preview.thumbnail({ ...profile.loadout, suit: i }, 96));
      api.preview.show(profile.loadout);
    }
    return thumbs.get(i);
  }
  function cell(s, t, track, tier) {
    const r = reward(s.n, t, track), c = document.createElement('button');
    const claimed = (track === 'free' ? s.free : s.premium).includes(t), reached = t <= tier, pass = track === 'free' || hasPass(s.n);
    const st = claimed ? 'claimed' : !reached ? 'locked' : !pass ? 'pass' : 'ready';
    c.className = 'sp-cell ' + (track === 'free' ? 'free ' : 'prem ') + st + (r.kind === 'suit' || r.kind === 'flair' || r.kind === 'skin' ? ' big' : '') + (track === 'premium' && t === 1 && r.kind === 'suit' ? ' hero' : '');
    c.dataset.track = track; c.dataset.tier = t;
    if (r.kind === 'suit') { const img = document.createElement('img'); img.alt = ''; img.src = suitThumb(r.suit); c.appendChild(img); }
    else { const i = document.createElement('i'); i.textContent = icon(r); c.appendChild(i); }
    const b = document.createElement('b'); b.textContent = label(r);
    const sm = document.createElement('small'); sm.textContent = st === 'claimed' ? '✓ CLAIMED' : st === 'ready' ? 'CLAIM' : st === 'pass' ? '★ PASS' : '🔒';
    c.append(b, sm);
    c.onclick = () => {
      if (st === 'ready') {
        const got = claim(track, t);
        if (got) { api.sfx.pickup?.(); api.haptic('MEDIUM'); note = 'CLAIMED ' + label(got) + (got.kind === 'suit' || got.kind === 'skin' ? ' — EQUIP IT IN THE LOCKER' : ''); api.refreshProfileUI(); }
      } else if (st === 'pass') note = 'BUY THE SEASON ' + s.n + ' PASS TO UNLOCK PREMIUM REWARDS';
      else if (st === 'locked') note = 'REACH TIER ' + t + ' TO UNLOCK';
      render();
    };
    return c;
  }
  function render(scroll) {
    const s = state(), cur = seasonAt(), tier = tierOf(s.xp), max = tier >= TIERS;
    $('#sp-kicker').textContent = 'SEASON ' + s.n + ' · ' + cur.daysLeft + (cur.daysLeft === 1 ? ' DAY' : ' DAYS') + ' LEFT';
    $('#sp-name').textContent = cur.name;
    $('#sp-tier').textContent = 'TIER ' + tier + ' / ' + TIERS;
    const into = max ? TIER_XP : s.xp % TIER_XP;
    $('#sp-bar').style.width = (into / TIER_XP * 100).toFixed(1) + '%';
    $('#sp-xp').textContent = max ? 'MAX TIER · ' + s.xp.toLocaleString() + ' SEASON XP' : into.toLocaleString() + ' / ' + TIER_XP.toLocaleString() + ' XP TO TIER ' + (tier + 1);
    $('#sp-scrap').textContent = profile.scrap.toLocaleString();
    const track = $('#sp-track'), left = track.scrollLeft;
    track.innerHTML = '';
    const labels = document.createElement('div');
    labels.className = 'sp-col labels';
    labels.innerHTML = '<div></div><span>FREE</span><span class="p">★ PREMIUM</span>';
    track.appendChild(labels);
    for (let t = 1; t <= TIERS; t++) {
      const col = document.createElement('div');
      col.className = 'sp-col' + (t === tier ? ' cur' : t < tier ? ' done' : '');
      const num = document.createElement('div'); num.className = 'sp-num'; num.textContent = t;
      col.append(num, cell(s, t, 'free', tier), cell(s, t, 'premium', tier));
      track.appendChild(col);
    }
    const n = claimable().length, owned = hasPass(s.n), buy = $('#sp-buy');
    $('#sp-claim').classList.toggle('hidden', n < 2);
    $('#sp-claim').textContent = 'CLAIM ALL (' + n + ')';
    $('#sp-active').classList.toggle('hidden', !owned);
    buy.classList.toggle('hidden', owned);
    const price = api.storeKit.products[passId(s.n)]?.price;
    buy.textContent = 'BUY PASS' + (api.storeKit.available() ? price ? ' · ' + price : '' : ' · iOS APP');
    $('#sp-note').textContent = note || (owned ? 'PREMIUM TRACK UNLOCKED. EARN SEASON XP EVERY RUN.' : api.storeKit.available() ? (seasonSuit(s.n) > 0 ? 'UNLOCK ' + SUITS[seasonSuit(s.n)].name + ' INSTANTLY + EXCLUSIVE WEAPON SKIN, GOLD FRAME AND SCRAP. COSMETIC ONLY.' : 'PREMIUM TRACK: EXCLUSIVE WEAPON SKIN, GOLD FRAME AND SCRAP. COSMETIC ONLY.') : 'THE PREMIUM PASS IS AVAILABLE IN THE iOS APP.');
    if (scroll) {
      const col = track.children[tier];
      track.scrollLeft = col ? Math.max(0, col.offsetLeft - track.clientWidth / 2 + col.offsetWidth / 2) : 0;
    } else track.scrollLeft = left;
  }
  function refresh() {
    const n = claimable().length;
    badge.textContent = n ? n : '';
    const tag = document.querySelector('#menu-char .nametag');
    if (tag) {
      let em = $('#sp-tag');
      const text = flairText(profile);
      if (!em) { em = document.createElement('div'); em.id = 'sp-tag'; tag.prepend(em); }
      em.className = 'sp-tag' + (profile.season?.flair?.elite ? ' elite' : '');
      em.textContent = text;
      em.classList.toggle('hidden', !text);
      tag.classList.toggle('sp-framed', !!profile.season?.flair?.frame);
    }
  }
  function open() {
    note = '';
    api.sfx.init?.();
    api.storeKit.refresh?.();
    api.showScreen(el);
    render(true);
  }
  async function buy() {
    const s = state(), b = $('#sp-buy');
    if (!api.storeKit.available()) { note = 'THE SEASON PASS IS SOLD IN THE iOS APP.'; render(); return; }
    b.disabled = true;
    note = 'OPENING THE APP STORE…'; render();
    const r = await api.storeKit.purchase(passId(s.n));
    b.disabled = false;
    if (hasPass(s.n)) {
      const got = claim('premium', 1);
      if (got) { api.sfx.pickup?.(); api.haptic('HEAVY'); api.refreshProfileUI(); }
      note = got?.kind === 'suit' ? 'PASS UNLOCKED — ' + got.label + ' IS YOURS. EQUIP IT IN THE LOCKER' : 'SEASON ' + s.n + ' PASS UNLOCKED — CLAIM YOUR PREMIUM REWARDS';
    } else note = api.storeKit.message(r, 'SEASON PASS').toUpperCase();
    refresh();
    render();
  }
  menuBtn.onclick = open;
  $('#sp-back').onclick = () => { api.showScreen(api.ui.menu); api.preview.show(profile.loadout); api.refreshProfileUI(); };
  $('#sp-claim').onclick = claimAll;
  $('#sp-buy').onclick = buy;

  const chip = document.createElement('span');
  chip.className = 'sp-chip hidden';
  chip.id = 'sp-over';
  $('#over-extras')?.appendChild(chip);

  api.bus.on('run:end', summary => {
    const mult = (api.live?.seasonXp || 1) * (api.live?.comebackXp || 1), xp = runXP(summary) * mult;
    const { before, after } = addXP(xp);
    lastRun = { xp, before, after };
    chip.textContent = 'SEASON +' + xp.toLocaleString() + ' XP' + (mult > 1 ? ' (x' + mult + ')' : '') + ' · TIER ' + after + (after > before ? ' ▲' : '');
    chip.classList.toggle('hidden', !xp);
  });
  api.bus.on('mission:complete', m => { addXP(Math.min(MISSION_CAP, Math.max(0, +m?.xp || 0))); });
  api.bus.on('purchase', () => { refresh(); if (api.activeScreen === el) render(); });
  document.getElementById('board-list')?.addEventListener('click', e => {
    inspectMine = !!e.target.closest('li')?.classList.contains('me');
  }, true);
  api.bus.on('screen', ({ id }) => {
    if (id === 'menu') refresh();
    if (id !== 'inspect') return;
    const mine = inspectMine || $('#in-rank').textContent.startsWith('YOUR RUN') || $('#in-name').textContent.endsWith('(YOU)');
    inspectMine = false;
    const panel = document.querySelector('#inspect .panel'), text = flairText(profile);
    panel?.classList.toggle('sp-framed', mine && !!profile.season?.flair?.frame);
    let tag = $('#sp-in-tag');
    if (!tag) { tag = document.createElement('div'); tag.id = 'sp-in-tag'; $('#in-rank')?.before(tag); }
    tag.className = 'sp-tag' + (profile.season?.flair?.elite ? ' elite' : '') + (mine && text ? '' : ' hidden');
    tag.textContent = text;
  });

  api.storeKit.register?.([passId(seasonAt().n)]);
  state();
  refresh();
  api.season = { seasonAt, runXP, reward, passId, state, claim, claimAll, claimable, addXP, open, render, tierOf, get lastRun() { return lastRun; } };
}
