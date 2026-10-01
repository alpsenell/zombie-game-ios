import { FEATURES } from './index.js';
import { CSS } from './progression/style.js';
import * as D from './progression/data.js';
import { ladderRun } from './events.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const native = {
  ok() { const c = window.Capacitor; return !!(c?.nativePromise && c.PluginHeaders?.some(h => h.name === 'Achievements')); },
  call(method, opts = {}) { return window.Capacitor.nativePromise('Achievements', method, opts); },
};

function init(api) {
  const { bus, profile, WEAPONS, $ } = api;
  const P = profile.progression = Object.assign({ daily: null, weekly: null, season: null, reroll: '', rerolls: 0, mastery: {}, prestige: {}, ach: {}, reported: {}, stats: null, streak: {} }, profile.progression);
  P.prestige ||= {};
  P.streak = Object.assign({ count: 0, best: 0, last: null, claimed: null, shown: null, broken: 0 }, P.streak);
  P.stats = Object.assign({
    kills: profile.kills || 0, heads: profile.heads || 0, bosses: { ...profile.bosses }, bestWave: profile.bestWave || 0,
    nightmare: Math.max(0, (profile.bestByDiff?.nightmare || 0) - 1), burning: 0, elites: 0, combo: 0, missions: 0, accuracy: 0, runs: profile.runs || 0,
  }, P.stats);
  const save = () => api.saveProfile();
  let run = null, lastRun = null, tab = 'daily', returnTo = null, loaded = false;

  const style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const weaponName = id => WEAPONS.find(w => w.id === id)?.name;
  function ctx() {
    const bestWave = Math.max(profile.bestWave || 0, P.stats.bestWave || 0);
    return {
      tier: bestWave >= 15 ? 2 : bestWave >= 8 ? 1 : 0, bestWave, weaponName, maps: api.MAPS,
      owned: WEAPONS.filter(w => api.weaponOwned(w)),
      hasDaily: FEATURES.some(f => f.id !== 'progression' && /daily|competitive/i.test(f.id)),
      hasCoop: FEATURES.some(f => f.id === 'coop'),
    };
  }
  function achStats() {
    const scrapGuns = WEAPONS.filter(w => !w.premium);
    return {
      ...P.stats, owned: WEAPONS.filter(w => api.weaponOwned(w)).length,
      scrapOwned: scrapGuns.filter(w => api.weaponOwned(w)).length, scrapTotal: scrapGuns.length,
      maxMastery: Object.values(P.prestige).some(n => n > 0) ? D.MASTERY_MAX : Math.max(1, ...Object.values(P.mastery).map(x => D.masteryInfo(x).level)), streak: P.streak.best,
    };
  }

  const feedMenu = el('div', 'pg-feed'), feedRun = el('div', 'pg-feed');
  document.body.appendChild(feedMenu);
  $('#hud-extras')?.appendChild(feedRun);
  function notify(title, text, cls = '') {
    const feed = api.ui.hud.classList.contains('on') ? feedRun : feedMenu;
    const n = el('div', 'pg-note ' + cls);
    n.append(el('em', '', title), document.createTextNode(text));
    feed.appendChild(n);
    while (feed.children.length > 3) feed.firstChild.remove();
    setTimeout(() => n.classList.add('out'), 2800);
    setTimeout(() => n.remove(), 3200);
  }
  function pop(anchor, text) {
    const r = anchor.getBoundingClientRect(), p = el('div', 'pg-pop', text);
    p.style.left = r.left + r.width / 2 + 'px'; p.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }

  function refreshMissions() {
    let collected = 0;
    for (const [period, key] of [['daily', D.dayKey()], ['weekly', D.weekKey()], ['season', D.weekKey()]]) {
      const cur = P[period];
      if (cur?.key === key) continue;
      for (const m of cur?.list || []) if (m.done && !m.claimed) { collected += m.scrap; payout(m, period); }
      P[period] = { key, list: D.generate(period, key, ctx()) };
    }
    if (collected) notify('UNCLAIMED REWARDS COLLECTED', '+' + collected.toLocaleString() + ' 🔩');
    save();
  }
  function payout(m, period) {
    const lvl = api.levelInfo().level;
    m.claimed = true;
    P.stats.missions++;
    api.grantScrap(m.scrap);
    api.grantXP(m.xp);
    bus.emit('mission:complete', { id: m.id, period, xp: m.xp, scrap: m.scrap, seasonXp: m.seasonXp });
    const now = api.levelInfo().level;
    if (now > lvl) notify('LEVEL UP', 'LEVEL ' + now);
    checkAch();
  }
  function claim(id, anchor) {
    for (const period of ['daily', 'weekly', 'season']) {
      const m = P[period]?.list.find(x => x.id === id);
      if (!m || !m.done || m.claimed) continue;
      payout(m, period);
      save();
      api.haptic('HEAVY'); api.sfx.init(); api.sfx.clear();
      if (anchor) pop(anchor, '+' + m.scrap + ' 🔩  +' + m.xp + ' XP');
      updateBadges();
      if (api.activeScreen === screen) render();
      return true;
    }
    return false;
  }
  const rerollTokens = () => profile.market?.rerolls || 0;
  const rerollFree = () => P.reroll !== D.dayKey() || rerollTokens() > 0;
  function reroll(period, idx) {
    const cur = P[period], m = cur?.list[idx];
    if (!m || m.done || !rerollFree()) return null;
    const next = D.reroll(period, cur.key, cur.list, idx, ctx(), ++P.rerolls);
    if (!next) return null;
    cur.list[idx] = next;
    if (P.reroll === D.dayKey()) profile.market.rerolls--; else P.reroll = D.dayKey();
    save();
    api.haptic('LIGHT');
    if (api.activeScreen === screen) render();
    return next;
  }
  function track(ev, e) {
    const rc = run || { difficultyId: api.settings.difficulty, type: 'normal' };
    for (const period of ['daily', 'weekly', 'season']) for (const m of P[period]?.list || []) {
      const t = D.template(m.t);
      if (m.done || !t || t.ev !== ev) continue;
      if (ev === 'coop:revive' && !rc.squad) continue;
      m.p = Math.min(m.n, t.fn(e, m, rc));
      if (m.p < m.n) continue;
      m.done = true;
      run?.missions.push(m.id);
      notify('MISSION COMPLETE', D.missionText(m, ctx()), 'mission');
      api.haptic('MEDIUM'); api.sfx.perk();
      updateBadges();
      save();
    }
  }

  function addMastery(e) {
    const id = e.weapon;
    if (!id || !weaponName(id)) return;
    const before = D.masteryInfo(P.mastery[id]).level, xp = D.masteryXP(e);
    P.mastery[id] = (P.mastery[id] || 0) + xp;
    if (run) run.mastery[id] = (run.mastery[id] || 0) + xp;
    const after = D.masteryInfo(P.mastery[id]).level;
    for (let lv = before + 1; lv <= after; lv++) {
      const scrap = D.masteryReward(lv);
      api.grantScrap(scrap);
      if (run) run.levels[id] = (run.levels[id] || 0) + 1;
      notify(lv >= D.MASTERY_MAX ? '★ MASTERED' : 'MASTERY ' + lv, weaponName(id) + ' · +' + scrap.toLocaleString() + ' 🔩', 'mastery');
      api.haptic('MEDIUM'); api.sfx.perk();
    }
  }

  function checkAch() {
    const s = achStats(), fresh = [];
    for (const a of D.ACHIEVEMENTS) if (!P.ach[a.slug] && D.achPercent(a, s) >= 100) { P.ach[a.slug] = Date.now(); fresh.push(a); run?.ach.push(a.slug); }
    if (!fresh.length) return;
    if (fresh.length > 2) notify('ACHIEVEMENTS UNLOCKED', '🏆 ' + fresh.length + ' NEW', 'ach');
    else fresh.forEach(a => notify('ACHIEVEMENT UNLOCKED', '🏆 ' + a.title, 'ach'));
    api.haptic('MEDIUM');
    save();
    syncNative();
  }
  let syncing = false, resync = false;
  async function syncNative() {
    if (!native.ok()) return;
    if (syncing) { resync = true; return; }
    syncing = true;
    const s = achStats();
    for (const a of D.ACHIEVEMENTS) {
      const pct = P.ach[a.slug] ? 100 : D.achPercent(a, s);
      if (pct <= (P.reported[a.slug] || 0)) continue;
      try { await native.call('report', { id: D.ACH_PREFIX + a.slug, percent: pct }); P.reported[a.slug] = pct; } catch { break; }
    }
    save();
    syncing = false;
    if (resync) { resync = false; syncNative(); }
  }
  async function loadNative() {
    if (!native.ok()) return;
    if (!loaded) {
      try {
        const r = await native.call('loadProgress');
        loaded = true;
        for (const x of r?.achievements || []) {
          const slug = String(x.id || '').replace(D.ACH_PREFIX, '');
          if (!D.ACHIEVEMENTS.some(a => a.slug === slug)) continue;
          P.reported[slug] = Math.max(P.reported[slug] || 0, Math.floor(x.percent || 0));
          if ((x.completed || x.percent >= 100) && !P.ach[slug]) P.ach[slug] = Date.now();
        }
      } catch {}
    }
    syncNative();
  }

  const menuBtn = el('button', 'ghost pg-btn', 'MISSIONS'), menuBadge = el('span', 'badge');
  menuBtn.appendChild(menuBadge);
  menuBtn.onclick = () => openMissions();
  const streakBtn = el('button', 'ghost pg-btn'), streakLabel = el('span'), streakBadge = el('span', 'badge');
  streakBtn.append(streakLabel, streakBadge);
  streakBtn.onclick = () => openStreak();
  $('#menu-extras')?.append(menuBtn, streakBtn);

  const screen = el('section', 'screen');
  screen.id = 'missions';
  screen.innerHTML = '<div class="panel pg-panel"><div class="pg-head"><h2>MISSIONS</h2><div class="scrap">🔩 <span class="pg-scrap">0</span></div></div>' +
    '<div class="pg-tabs"><button data-pg="daily">DAILY<span class="badge"></span></button><button data-pg="weekly">WEEKLY<span class="badge"></span></button><button data-pg="season">SEASON<span class="badge"></span></button><button data-pg="ach">ACHIEVEMENTS</button></div>' +
    '<div class="pg-sub"></div><div class="pg-list"></div><div class="pg-foot"><button class="ghost hidden pg-gc">GAME CENTER</button><button class="cta pg-close">BACK</button></div></div>';
  document.body.appendChild(screen);
  api.registerScreen(screen);
  const q = s => screen.querySelector(s);
  screen.querySelectorAll('.pg-tabs button').forEach(b => (b.onclick = () => { tab = b.dataset.pg; api.haptic('LIGHT'); render(); }));
  q('.pg-close').onclick = () => api.showScreen(returnTo && returnTo !== screen ? returnTo : api.ui.menu);
  q('.pg-gc').onclick = () => native.call('show').catch(() => {});

  function claimable(period) { return (P[period]?.list || []).filter(m => m.done && !m.claimed).length; }
  function updateBadges() {
    const n = claimable('daily') + claimable('weekly') + claimable('season');
    menuBadge.textContent = n || '';
    menuBtn.classList.toggle('hot', n > 0);
    const S = P.streak, today = D.dayNum();
    streakLabel.textContent = '🔥 DAY ' + Math.max(1, S.count);
    streakBadge.textContent = S.last === today && S.claimed !== today ? '!' : '';
    streakBtn.classList.toggle('hot', !!streakBadge.textContent);
    q('[data-pg=daily] .badge').textContent = claimable('daily') || '';
    q('[data-pg=weekly] .badge').textContent = claimable('weekly') || '';
    q('[data-pg=season] .badge').textContent = claimable('season') || '';
  }

  function progressText(m) {
    return D.template(m.t)?.unit === '%' ? 'BEST ' + m.p + '% / ' + m.n + '%' : m.p.toLocaleString() + ' / ' + m.n.toLocaleString();
  }
  function render() {
    refreshMissions();
    screen.querySelectorAll('.pg-tabs button').forEach(b => b.classList.toggle('on', b.dataset.pg === tab));
    q('h2').textContent = tab === 'ach' ? 'ACHIEVEMENTS' : tab === 'season' ? 'SEASON CHALLENGES' : 'MISSIONS';
    q('.pg-scrap').textContent = profile.scrap.toLocaleString();
    q('.pg-head .scrap').classList.toggle('hidden', tab === 'ach');
    q('.pg-gc').classList.toggle('hidden', !native.ok() || tab !== 'ach');
    const list = q('.pg-list'), sub = q('.pg-sub');
    list.textContent = ''; sub.textContent = '';
    const subPart = (label, value) => { const s = el('span', '', label); if (value) s.appendChild(el('b', '', value)); sub.appendChild(s); };
    updateBadges();
    if (tab === 'ach') {
      const s = achStats(), got = D.ACHIEVEMENTS.filter(a => P.ach[a.slug]).length;
      subPart('UNLOCKED ', got + ' / ' + D.ACHIEVEMENTS.length);
      subPart(native.ok() ? 'SYNCED WITH GAME CENTER' : 'GAME CENTER SYNC IN THE iOS APP');
      for (const a of D.ACHIEVEMENTS) {
        const on = !!P.ach[a.slug], [cur, need] = a.prog(s), row = el('div', 'pg-a' + (on ? ' on' : ''));
        const mid = el('div');
        mid.append(el('b', '', a.title), el('small', '', a.desc));
        if (!on) { const bar = el('div', 'pg-bar'), i = el('i'); i.style.setProperty('--v', D.achPercent(a, s) + '%'); bar.appendChild(i); mid.appendChild(bar); }
        row.append(el('div', 'ico', on ? '🏆' : '🔒'), mid, el('span', '', on ? 'UNLOCKED' : Math.min(cur, need).toLocaleString() + ' / ' + need.toLocaleString()));
        list.appendChild(row);
      }
      return;
    }
    subPart('NEW ' + (tab === 'season' ? 'CHALLENGES' : tab.toUpperCase() + ' MISSIONS') + ' IN ', D.timeLeft(D.resetAt(tab) - Date.now()));
    if (tab === 'season') subPart('⚡ ' + D.SEASON_CHALLENGE.seasonXp.toLocaleString() + ' SEASON XP EACH'); else subPart(P.reroll !== D.dayKey() ? '1 FREE REROLL TODAY' + (rerollTokens() ? ' · ' + rerollTokens() + ' TOKEN' + (rerollTokens() > 1 ? 'S' : '') : '') : rerollTokens() ? rerollTokens() + ' REROLL TOKEN' + (rerollTokens() > 1 ? 'S' : '') : 'REROLL USED TODAY');
    const c = ctx();
    P[tab].list.forEach((m, idx) => {
      const row = el('div', 'pg-m' + (m.claimed ? ' claimed' : m.done ? ' done' : '')), mid = el('div');
      const bar = el('div', 'pg-bar'), i = el('i');
      i.style.setProperty('--v', Math.round(m.p / m.n * 100) + '%');
      bar.appendChild(i);
      const info = el('small', '', progressText(m) + ' · ');
      info.appendChild(el('em', '', '🔩 ' + m.scrap.toLocaleString() + ' · ' + m.xp.toLocaleString() + ' XP' + (m.seasonXp ? ' · ⚡ ' + m.seasonXp.toLocaleString() + ' SEASON XP' : '')));
      mid.append(el('b', '', D.missionText(m, c)), bar, info);
      row.appendChild(mid);
      if (m.done && !m.claimed) { const b = el('button', 'cta gold', 'CLAIM'); b.onclick = () => claim(m.id, b); row.appendChild(b); }
      else if (!m.done && tab !== 'season' && rerollFree()) { const b = el('button', 'ghost', 'REROLL'); b.onclick = () => reroll(tab, idx); row.appendChild(b); }
      list.appendChild(row);
    });
  }
  function openMissions(which) {
    returnTo = api.activeScreen === screen ? returnTo : api.activeScreen;
    refreshMissions();
    tab = which || (claimable('daily') ? 'daily' : claimable('weekly') ? 'weekly' : claimable('season') ? 'season' : tab);
    render();
    api.showScreen(screen);
    loadNative();
  }

  function renderOver() {
    const box = $('#over-extras');
    if (!box) return;
    let wrap = box.querySelector('.pg-over');
    if (!wrap) { wrap = el('div', 'pg-over'); box.appendChild(wrap); }
    wrap.textContent = '';
    if (!lastRun) return;
    const c = ctx(), all = [...(P.daily?.list || []), ...(P.weekly?.list || []), ...(P.season?.list || [])];
    for (const id of lastRun.missions) { const m = all.find(x => x.id === id); if (m) wrap.appendChild(el('span', 'm', '✔ ' + D.missionText(m, c))); }
    for (const slug of lastRun.ach) { const a = D.ACHIEVEMENTS.find(x => x.slug === slug); if (a) wrap.appendChild(el('span', 'a', '🏆 ' + a.title)); }
    Object.entries(lastRun.mastery).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([id]) => {
      const info = D.masteryInfo(P.mastery[id]), up = lastRun.levels[id];
      const chip = el('span', 'w', weaponName(id) + (info.max ? ' ★ MASTERED' : ' ★' + info.level) + (up ? ' ▲' + up : ''));
      if (!info.max) { const i = el('i'); i.style.setProperty('--v', Math.round(info.pct * 100) + '%'); chip.appendChild(i); }
      wrap.appendChild(chip);
    });
    const n = claimable('daily') + claimable('weekly');
    if (n) { const b = el('button', '', 'CLAIM ' + n + (n > 1 ? ' REWARDS' : ' REWARD')); b.onclick = () => openMissions(); wrap.appendChild(b); }
  }

  const topPrestige = () => Math.max(0, ...Object.values(P.prestige));
  api.reqs.prestige = { met: n => topPrestige() >= +n, text: n => 'PRESTIGE ANY WEAPON ' + (+n > 1 ? n + ' TIMES' : 'ONCE') };
  let prestigeArm = null;
  function prestige(id) {
    const info = D.masteryInfo(P.mastery[id]), n = P.prestige[id] || 0;
    if (!info.max || n >= D.PRESTIGE_MAX) return false;
    const before = api.reqMet('prestige:1'), before5 = api.reqMet('prestige:5');
    P.prestige[id] = n + 1;
    P.mastery[id] = 0;
    api.grantScrap(D.PRESTIGE_REWARD);
    const gun = api.SLOTS.find(s => s.id === 'gun').items;
    for (const [was, req] of [[before, 'prestige:1'], [before5, 'prestige:5']]) {
      const i = gun.findIndex(it => it.req === req);
      if (!was && api.reqMet(req) && i > 0 && !profile.fresh.includes('gun:' + i)) profile.fresh.push('gun:' + i);
    }
    save();
    notify('PRESTIGE ' + D.prestigeMark(n + 1), weaponName(id) + ' · +' + D.PRESTIGE_REWARD.toLocaleString() + ' 🔩', 'mastery');
    api.haptic('HEAVY'); api.sfx.perk();
    bus.emit('prestige', { weapon: id, level: n + 1 });
    return true;
  }

  function decorateArmory({ grid, weapon }) {
    for (const card of grid?.children || []) {
      const w = WEAPONS.find(x => x.name === card.querySelector('b')?.textContent), xp = w && P.mastery[w.id];
      if (!w || (!xp && !P.prestige[w.id] && !api.weaponOwned(w))) continue;
      const info = D.masteryInfo(xp), row = el('div', 'pg-wm', info.max ? '★ MASTERED' : '★ ' + info.level);
      if (P.prestige[w.id]) row.appendChild(el('span', 'pg-pmark', D.prestigeMark(P.prestige[w.id])));
      if (!info.max) { const bar = el('i'); bar.style.setProperty('--v', Math.round(info.pct * 100) + '%'); row.appendChild(bar); }
      card.appendChild(row);
      card.classList.toggle('pg-mastered', info.max);
    }
    const stage = $('#armory-stage .stage-info');
    if (!stage || !weapon) return;
    let d = stage.querySelector('.pg-ad');
    if (!d) { d = el('div', 'pg-ad'); stage.appendChild(d); }
    d.textContent = '';
    const info = D.masteryInfo(P.mastery[weapon.id]), stars = el('div', 'pg-stars'), pn = P.prestige[weapon.id] || 0;
    stars.append(el('span', '', '★'.repeat(info.level)), document.createTextNode('★'.repeat(D.MASTERY_MAX - info.level)));
    if (pn) stars.appendChild(el('span', 'pg-pmark', D.prestigeMark(pn)));
    d.appendChild(stars);
    if (info.max) {
      d.append(el('div', 'pg-badge', '★ MASTERED' + (pn ? ' · PRESTIGE ' + pn : '')), el('small', '', 'MASTERY 10/10 · ' + (P.mastery[weapon.id] || 0).toLocaleString() + ' XP'));
      if (pn < D.PRESTIGE_MAX) {
        const armed = prestigeArm === weapon.id, b = el('button', 'pg-prestige' + (armed ? ' confirm' : ''), armed ? 'TAP AGAIN · RESET MASTERY FOR ✦' : '✦ PRESTIGE · +' + D.PRESTIGE_REWARD.toLocaleString() + ' 🔩');
        b.id = 'pg-prestige';
        b.onclick = () => {
          if (prestigeArm !== weapon.id) { prestigeArm = weapon.id; decorateArmory({ weapon }); return; }
          prestigeArm = null;
          prestige(weapon.id);
          api.refreshArmory();
        };
        d.appendChild(b);
      }
      return;
    }
    const bar = el('div', 'xp'), i = el('i');
    i.style.width = (info.pct * 100).toFixed(1) + '%';
    bar.appendChild(i);
    d.append(bar, el('small', '', 'MASTERY ' + info.level + '/10 · ' + info.into.toLocaleString() + ' / ' + info.need.toLocaleString() + ' XP · NEXT +' + D.masteryReward(info.level + 1).toLocaleString() + ' 🔩'));
  }

  let modal = null, modalDone = null;
  function closeStreak() { modal?.remove(); modal = null; modalDone?.(); modalDone = null; }
  function streakCheck() {
    if (api.activeScreen !== api.ui.menu) return;
    const S = P.streak, today = D.dayNum();
    if (D.streakVisit(S, today, Date.now())) { checkAch(); save(); }
    updateBadges();
    if (S.shown !== today && (profile.runs || 0) > 0) { S.shown = today; save(); setTimeout(() => api.queueModal(done => { if (api.activeScreen !== api.ui.menu) return done(); openStreak(); modalDone = done; }), 450); }
  }
  function openStreak() {
    closeStreak();
    const S = P.streak, today = D.dayNum();
    if (S.last !== today) return;
    const claimed = S.claimed === today, start = S.count - (S.count - 1) % 7;
    modal = el('div', 'pg-modal');
    const card = el('div', 'pg-card'), h = el('h3', '', 'DAY ');
    h.append(el('em', '', String(S.count)), document.createTextNode(' STREAK'));
    const offer = D.repairOffer(S, Date.now());
    const sub = S.shielded ? el('small', 'shield', '🛡 SHIELD USED — YOU MISSED ' + (S.shielded > 1 ? S.shielded + ' DAYS' : 'A DAY') + ' BUT YOUR STREAK HELD')
      : S.broken ? el('small', 'warn', 'YOU MISSED A DAY — STREAK RESET TO DAY 1 (WAS ' + S.broken + ')')
      : el('small', '', claimed ? 'COME BACK TOMORROW FOR DAY ' + (S.count + 1) : S.count === 1 ? 'PLAY EVERY DAY TO GROW YOUR STREAK' : 'PLAYED ' + S.count + ' DAYS IN A ROW');
    const cal = el('div', 'pg-cal');
    for (let d = start; d < start + 7; d++) {
      const r = D.streakReward(d), done = d < S.count || (d === S.count && claimed);
      const cell = el('div', (d === S.count ? 'today ' : done ? 'past ' : '') + (r.bonus || (d - 1) % 7 === 6 ? 'big' : ''), 'DAY ' + d);
      cell.appendChild(el('b', '', done ? '✔' : r.total.toLocaleString()));
      cell.appendChild(document.createTextNode(r.bonus || (d - 1) % 7 === 6 ? '🎁' : '🔩'));
      cal.appendChild(cell);
    }
    const extra = el('div', 'pg-extra'), next = D.nextMilestone(S.count);
    const line = (label, value) => { const d = el('div', '', label); d.appendChild(el('b', '', value)); extra.appendChild(d); };
    if (next) line('DAY ' + next.day + ' BONUS ', '+' + next.bonus.toLocaleString() + ' 🔩');
    if (S.shieldEarned === today) line('🛡 SHIELD EARNED ', 'COVERS ONE MISSED DAY');
    else line('🛡 STREAK SHIELDS ', S.shields ? '×' + S.shields : 'NONE' + (S.shields < D.SHIELD_MAX ? ' · DAY ' + D.nextShieldDay(S.count) : ''));
    if (profile.lastDaily !== new Date().toDateString()) line('FIRST RUN TODAY EARNS ', 'x2 SCRAP');
    const row = el('div', 'row'), reward = D.streakReward(S.count);
    if (offer) {
      const fix = el('button', 'ghost pg-repair', 'RESTORE DAY ' + offer.count + ' STREAK · 🔩 ' + offer.cost.toLocaleString());
      fix.appendChild(el('small', '', 'OFFER ENDS IN ' + D.timeLeft(offer.until - Date.now()) + ' · YOU HAVE 🔩 ' + profile.scrap.toLocaleString()));
      fix.onclick = () => repairStreak(fix);
      extra.appendChild(fix);
    }
    if (claimed) { const ok = el('button', 'cta', 'OK'); ok.onclick = closeStreak; row.appendChild(ok); }
    else {
      const b = el('button', 'cta gold', 'CLAIM +' + reward.total.toLocaleString() + ' 🔩');
      b.onclick = () => claimStreak(b);
      const later = el('button', 'ghost', 'LATER');
      later.onclick = closeStreak;
      row.append(b, later);
    }
    card.append(h, sub, cal, extra, row);
    modal.appendChild(card);
    document.body.appendChild(modal);
  }
  function claimStreak(anchor) {
    const S = P.streak, today = D.dayNum();
    if (S.last !== today || S.claimed === today) return 0;
    S.claimed = today;
    S.broken = 0;
    const r = D.streakReward(S.count);
    api.grantScrap(r.total);
    save();
    bus.emit('streak:claim', { count: S.count, total: r.total });
    api.haptic('HEAVY'); api.sfx.init(); api.sfx.clear();
    if (anchor) { pop(anchor, '+' + r.total.toLocaleString() + ' 🔩'); anchor.disabled = true; }
    updateBadges();
    setTimeout(closeStreak, 900);
    return r.total;
  }
  function repairStreak(anchor) {
    const S = P.streak, offer = D.repairOffer(S, Date.now());
    if (!offer) return 0;
    if (profile.scrap < offer.cost) { if (anchor) pop(anchor, 'NEED ' + (offer.cost - profile.scrap).toLocaleString() + ' MORE 🔩'); api.haptic('LIGHT'); return 0; }
    profile.scrap -= offer.cost;
    const count = D.repairStreak(S, Date.now());
    if (!count) { profile.scrap += offer.cost; return 0; }
    save();
    api.refreshProfileUI();
    checkAch();
    updateBadges();
    bus.emit('streak:repair', { count, cost: offer.cost });
    api.haptic('HEAVY'); api.sfx.init(); api.sfx.perk();
    notify('STREAK RESTORED', 'DAY ' + count + ' · -' + offer.cost.toLocaleString() + ' 🔩', 'mission');
    openStreak();
    return count;
  }

  function newRun(e) { return { difficultyId: e?.difficultyId || api.settings.difficulty, type: e?.type || 'normal', map: e?.map || api.currentMap, event: ladderRun(e?.type), squad: e?.opts?.squad || 0, missions: [], ach: [], mastery: {}, levels: {} }; }
  bus.on('run:start', e => { closeStreak(); refreshMissions(); run = newRun(e); });
  bus.on('kill', e => {
    const s = P.stats;
    s.kills++;
    if (e.head) s.heads++;
    if (e.elite) s.elites++;
    if (e.burning) s.burning++;
    if (e.boss) s.bosses[e.kind] = (s.bosses[e.kind] || 0) + 1;
    s.combo = Math.max(s.combo, e.combo || 0);
    addMastery(e);
    track('kill', e);
    checkAch();
  });
  bus.on('wave:start', e => { if (e.checkpoint) return; P.stats.bestWave = Math.max(P.stats.bestWave, e.wave); track('wave:start', e); checkAch(); });
  bus.on('wave:clear', e => { if (run?.difficultyId === 'nightmare') P.stats.nightmare = Math.max(P.stats.nightmare, e.wave); track('wave:clear', e); checkAch(); });
  bus.on('perk', e => { if (!e.kit) track('perk', e); });
  bus.on('coop:revive', e => { track('coop:revive', e); checkAch(); });
  bus.on('mission:complete', e => track('mission:complete', e));
  bus.on('purchase', () => checkAch());
  bus.on('run:end', e => {
    run ||= newRun(e);
    P.stats.runs++;
    if (e.wave - (e.startWave || 1) >= 4) P.stats.accuracy = Math.max(P.stats.accuracy, Math.floor(e.accuracy * 100));
    track('run:end', e);
    checkAch();
    lastRun = run;
    run = null;
    save();
    renderOver();
    loadNative();
  });
  bus.on('screen', ({ id }) => {
    if (id === 'menu') { run = null; save(); refreshMissions(); updateBadges(); streakCheck(); }
    else if (id === 'over') renderOver();
    else if (id !== 'missions') closeStreak();
  });
  bus.on('armory:render', decorateArmory);
  bus.on('app:ready', () => { refreshMissions(); checkAch(); updateBadges(); loadNative(); streakCheck(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else streakCheck(); });

  api.progression = {
    state: P, data: D, claim, reroll, refreshMissions, openMissions, openStreak, claimStreak, repairStreak, streakCheck, syncNative,
    missions: () => [...(P.daily?.list || []), ...(P.weekly?.list || []), ...(P.season?.list || [])],
    challenges: () => P.season?.list || [],
    mastery: id => D.masteryInfo(P.mastery[id]),
    prestige, prestigeOf: id => P.prestige[id] || 0,
  };
}

export default { id: 'progression', init };
