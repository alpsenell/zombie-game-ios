import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const DAY = 86400000, T0 = Date.UTC(2026, 8, 26, 12);
const shots = process.env.SHOTS || join(tmpdir(), 'deadzone-progression');
mkdirSync(shots, { recursive: true });
const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function initScript({ now = T0, profile = null, nativeMock = true } = {}) {
  return `
    window.__now = ${now};
    Date.now = () => window.__now;
    window.__calls = [];
    ${nativeMock ? `window.Capacitor = { PluginHeaders: [{ name: 'Achievements' }], nativePromise: (plugin, method, opts) => {
      window.__calls.push({ plugin, method, opts });
      return Promise.resolve(method === 'loadProgress' ? { achievements: [{ id: 'deadzone.ach.wave_10', percent: 100, completed: true }] } : {});
    } };` : ''}
    ${profile ? `if (!localStorage.getItem('deadzone.profile')) localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
  `;
}
async function open(opts = {}, size = {}) {
  const { page, errors } = await openGame(browser, url, { ...size, init: { content: initScript(opts) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(700);
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(shots, name + '.png') });
const P = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.api.profile.progression)));

{
  const lists = p => p.evaluate(() => {
    const s = window.__game.api.profile.progression;
    return { daily: s.daily, weekly: s.weekly };
  });
  const b = await open(), lb = await lists(b);
  await b.close();
  const a = await open(), la = await lists(a);
  check(la.daily.key === '2026-09-26' && la.weekly.key === '2026-W39', 'period keys from UTC date / ISO week', [la.daily.key, la.weekly.key]);
  check(la.daily.list.length === 3 && la.weekly.list.length === 3, '3 daily + 3 weekly missions');
  check(JSON.stringify(la) === JSON.stringify(lb), 'same date + profile → identical missions');
  const scan = await a.evaluate(({ T0, DAY }) => {
    const { api } = window.__game, D = api.progression.data;
    const ctx = { tier: 0, bestWave: 0, owned: api.WEAPONS.filter(w => api.weaponOwned(w)), hasDaily: false, weaponName: id => id };
    const all = [];
    for (let i = 0; i < 90; i++) all.push(...D.generate('daily', D.dayKey(T0 + i * DAY), ctx), ...D.generate('weekly', D.weekKey(T0 + i * 7 * DAY), ctx));
    const vet = { ...ctx, tier: 2, bestWave: 20, owned: [...ctx.owned, api.WEAPONS.find(w => w.id === 'flamer')], hasDaily: true };
    const adv = [];
    for (let i = 0; i < 90; i++) adv.push(...D.generate('daily', D.dayKey(T0 + i * DAY), vet));
    return {
      weaponArgs: [...new Set(all.filter(m => m.t === 'weapon').map(m => m.arg))],
      kinds: [...new Set(all.map(m => m.t))],
      waveArgs: [...new Set(all.filter(m => m.t === 'wave').map(m => m.arg))],
      advKinds: [...new Set(adv.map(m => m.t))],
      advWave: [...new Set(adv.filter(m => m.t === 'wave').map(m => m.arg))],
      differs: JSON.stringify(D.generate('daily', '2026-09-26', ctx)) !== JSON.stringify(D.generate('daily', '2026-09-27', ctx)),
      reset: [D.resetAt('daily', T0) - T0, D.resetAt('weekly', T0) - T0],
    };
  }, { T0, DAY });
  check(scan.weaponArgs.every(w => ['m4', 'r870'].includes(w)) && scan.weaponArgs.length > 0, 'weapon missions only use owned weapons', scan.weaponArgs);
  check(!scan.kinds.some(k => ['burn', 'elite', 'daily', 'boss'].includes(k)), 'new player gets no burn/elite/boss/daily-challenge missions', scan.kinds);
  check(scan.waveArgs.every(d => d === 'survivor'), 'new player wave missions stay on survivor', scan.waveArgs);
  check(['burn', 'elite', 'daily', 'boss'].every(k => scan.advKinds.includes(k)) && scan.advWave.includes('nightmare'), 'veteran with flamer + daily mode unlocks harder pool', scan);
  check(scan.differs, 'different day → different missions');
  check(scan.reset[0] === 12 * 3600000 && scan.reset[1] === 36 * 3600000, 'reset times: next UTC midnight / Monday', scan.reset);

  const r = await a.evaluate(() => {
    const { api } = window.__game, pg = api.progression, s = pg.state, bus = api.bus, events = [];
    bus.on('mission:complete', e => events.push(e));
    const mk = (t, n, arg, i) => ({ id: 'daily:test:' + i, t, n, arg, p: 0, done: false, claimed: false, scrap: 100, xp: 400 });
    s.daily.list = [mk('heads', 3, null, 0), mk('wave', 3, 'veteran', 1), mk('accuracy', 55, null, 2)];
    s.weekly.list[0] = { id: 'weekly:test:0', t: 'missions', n: 1, arg: null, p: 0, done: false, claimed: false, scrap: 600, xp: 2500 };
    bus.emit('run:start', { type: 'normal', difficultyId: 'survivor' });
    for (let i = 0; i < 3; i++) bus.emit('kill', { kind: 'walker', head: true, weapon: 'm4', combo: 1 });
    bus.emit('wave:start', { wave: 3 });
    const waveOnSurvivor = s.daily.list[1].p;
    bus.emit('run:end', { type: 'normal', difficultyId: 'survivor', wave: 3, kills: 3, accuracy: .6, bestCombo: 3 });
    bus.emit('run:start', { type: 'normal', difficultyId: 'veteran' });
    bus.emit('wave:start', { wave: 3 });
    const feed = [...document.querySelectorAll('.pg-note')].map(n => n.textContent);
    const done = s.daily.list.map(m => m.done);
    const badge = document.querySelector('#menu-extras .pg-btn .badge').textContent;
    const before = { scrap: api.profile.scrap, xp: api.profile.xp };
    const claimed = pg.claim('daily:test:0');
    const again = pg.claim('daily:test:0');
    return { waveOnSurvivor, done, feed, badge, before, after: { scrap: api.profile.scrap, xp: api.profile.xp }, claimed, again, events, weeklyDone: s.weekly.list[0].done };
  });
  check(r.waveOnSurvivor === 0, 'veteran wave mission ignores survivor runs', r.waveOnSurvivor);
  check(r.done.every(Boolean), 'headshot / wave / accuracy missions complete from events', r.done);
  check(r.feed.some(t => t.includes('MISSION COMPLETE') && t.includes('3 HEADSHOTS')), 'mid-run mission toast', r.feed);
  check(r.badge === '3', 'menu badge shows claimable count', r.badge);
  check(r.claimed && !r.again && r.after.scrap === r.before.scrap + 100 && r.after.xp === r.before.xp + 400, 'claim grants scrap + XP once', r);
  check(r.events.length === 1 && r.events[0].id === 'daily:test:0' && r.events[0].period === 'daily' && r.events[0].scrap === 100, 'mission:complete emitted on claim', r.events);
  check(r.weeklyDone, 'weekly "complete daily missions" counts claims');

  await a.evaluate(() => {
    const { api } = window.__game, s = api.progression.state;
    s.daily.list[0] = { id: 'daily:test:3', t: 'kills', n: 50, arg: null, p: 10, done: false, claimed: false, scrap: 100, xp: 400 };
    api.progression.openMissions('daily');
  });
  await a.waitForTimeout(200);
  await shot(a, 'missions-landscape');
  const rr = await a.evaluate(DAY => {
    const { api } = window.__game, pg = api.progression, s = pg.state;
    const beforeT = s.daily.list.map(m => m.t);
    const btn = [...document.querySelectorAll('#missions .pg-m button')].find(b => b.textContent === 'REROLL');
    const hadBtn = !!btn;
    btn?.click();
    const afterT = s.daily.list.map(m => m.t);
    const second = pg.reroll('daily', 0);
    const scrap0 = api.profile.scrap;
    window.__now += DAY;
    pg.refreshMissions();
    return { hadBtn, beforeT, afterT, second, collected: api.profile.scrap - scrap0, newKey: s.daily.key, free: !!pg.reroll('daily', 0) };
  }, DAY);
  check(rr.hadBtn && rr.afterT.join() !== rr.beforeT.join() && new Set(rr.afterT).size === 3, 'reroll swaps an unfinished mission for a new template', rr);
  check(rr.second === null, 'only one free reroll per day');
  check(rr.collected === 200, 'unclaimed completed missions auto-collected at rollover', rr.collected);
  check(rr.newKey === '2026-09-27' && rr.free, 'new day → new missions and a fresh reroll', rr);
  await a.close();
}

{
  const page = await open({ now: T0 });
  const r = await page.evaluate(async () => {
    const { api } = window.__game, pg = api.progression, bus = api.bus;
    await new Promise(r => setTimeout(r, 50));
    window.__calls.length = 0;
    bus.emit('run:start', { type: 'normal', difficultyId: 'nightmare' });
    bus.emit('kill', { kind: 'walker', head: false, weapon: 'm4', combo: 1 });
    bus.emit('kill', { kind: 'butcher', boss: true, head: false, weapon: 'm4', combo: 2 });
    bus.emit('wave:clear', { wave: 10 });
    await new Promise(r => setTimeout(r, 50));
    const s = pg.state;
    return { ach: Object.keys(s.ach), calls: window.__calls.map(c => c.method + ':' + c.opts.id + ':' + c.opts.percent), reported: s.reported };
  });
  check(['first_blood', 'boss_butcher', 'nightmare_10', 'wave_10'].every(k => r.ach.includes(k)), 'achievements unlock (first kill, boss, nightmare wave 10, restored from Game Center load)', r.ach);
  check(r.calls.includes('report:deadzone.ach.first_blood:100') && r.calls.includes('report:deadzone.ach.boss_butcher:100'), 'native report called for unlocks', r.calls);
  check(r.calls.some(c => c.startsWith('report:deadzone.ach.kills_100:')) && !r.calls.includes('report:deadzone.ach.wave_10:100'), 'progress reported, already-complete GC achievements skipped', r.calls);
  check(r.reported.first_blood === 100, 'reported percent persisted');

  const m = await page.evaluate(() => {
    const { api } = window.__game, pg = api.progression, bus = api.bus;
    const scrap0 = api.profile.scrap;
    for (let i = 0; i < 6; i++) bus.emit('kill', { kind: 'walker', head: true, weapon: 'r870', combo: 1 });
    const l2 = pg.mastery('r870'), scrap1 = api.profile.scrap;
    const feed = [...document.querySelectorAll('.pg-note')].map(n => n.textContent);
    pg.state.mastery.m4 = 14500;
    bus.emit('kill', { kind: 'goliath', boss: true, head: true, weapon: 'm4', combo: 1 });
    return { l2, gained: scrap1 - scrap0, feed, m4: pg.mastery('m4'), ach: !!pg.state.ach.mastery_max, scrap2: api.profile.scrap - scrap1 };
  });
  check(m.l2.level === 2 && m.gained === 100, 'weapon mastery levels up with scrap reward', m);
  check(m.feed.some(t => t.includes('MASTERY 2') && t.includes('R-870')), 'mastery level-up toast', m.feed);
  check(m.m4.max && m.m4.level === 10 && m.ach && m.scrap2 >= 1000, 'mastery 10 → MASTERED + achievement + big reward', m);
  await page.evaluate(() => window.__game.api.bus.emit('run:end', { type: 'normal', difficultyId: 'nightmare', wave: 10, kills: 9, accuracy: .5 }));

  await page.evaluate(() => window.__game.api.progression.openMissions('ach'));
  await page.waitForTimeout(200);
  await shot(page, 'achievements-landscape');
  await page.evaluate(() => { const { api } = window.__game; api.showScreen(api.ui.menu); document.querySelector('[data-open="armory"]').click(); });
  await page.waitForTimeout(400);
  const arm = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.wcard .pg-wm')].map(e => e.textContent),
    mastered: document.querySelectorAll('.wcard.pg-mastered').length,
    detail: document.querySelector('#armory-stage .pg-ad')?.textContent,
  }));
  check(arm.cards.includes('★ MASTERED') && arm.cards.includes('★ 2') && arm.mastered === 1, 'armory cards show mastery', arm);
  check(/MASTERED/.test(arm.detail), 'armory detail shows mastery', arm.detail);
  await shot(page, 'armory-landscape');
  await page.evaluate(() => [...document.querySelectorAll('.wcard')].find(c => c.textContent.includes('R-870')).click());
  await page.waitForTimeout(300);
  const det = await page.evaluate(() => document.querySelector('#armory-stage .pg-ad')?.textContent);
  check(/MASTERY 2\/10/.test(det), 'armory detail updates for selected weapon', det);
  await page.close();
}

{
  const page = await open({ now: T0, nativeMock: false });
  const r = await page.evaluate(() => {
    const { api } = window.__game;
    api.bus.emit('kill', { kind: 'walker', weapon: 'm4', combo: 1 });
    return !!api.profile.progression.ach.first_blood;
  });
  check(r, 'achievements work without Game Center');
  await page.close();
}

{
  const page = await open({ now: T0 });
  const s1 = await page.evaluate(() => ({ st: { ...window.__game.api.profile.progression.streak }, modal: !!document.querySelector('.pg-modal'), text: document.querySelector('.pg-card')?.textContent }));
  check(s1.st.count === 1 && s1.modal && /DAY 1 STREAK/.test(s1.text), 'first visit: day 1 popup', s1);
  await shot(page, 'streak-landscape');
  const deployClickable = await page.evaluate(() => { const r = document.querySelector('#start').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id; });
  check(deployClickable === 'start', 'streak popup does not block DEPLOY', deployClickable);
  const days = await page.evaluate(async DAY => {
    const { api } = window.__game, pg = api.progression, out = [];
    const step = async d => {
      window.__now += d * DAY;
      pg.streakCheck();
      await new Promise(r => setTimeout(r, 500));
      const s = pg.state.streak, scrap = api.profile.scrap;
      const row = { count: s.count, broken: s.broken, text: document.querySelector('.pg-card')?.textContent || '' };
      const btn = [...document.querySelectorAll('.pg-card button')].find(b => b.textContent.startsWith('CLAIM'));
      btn?.click();
      out.push({ ...row, gained: api.profile.scrap - scrap });
      await new Promise(r => setTimeout(r, 1000));
    };
    await step(0);
    for (let i = 0; i < 6; i++) await step(1);
    const ach7 = !!pg.state.ach.streak_7, shields7 = pg.state.streak.shields, earned7 = out[6].text;
    await step(0);
    await step(2);
    const shielded = { count: pg.state.streak.count, shields: pg.state.streak.shields, shielded: pg.state.streak.shielded, text: out[8].text };
    await step(2);
    pg.openStreak();
    const s = pg.state.streak;
    const btn = [...document.querySelectorAll('.pg-card button')].find(b => b.textContent.startsWith('RESTORE'));
    const broken = { count: s.count, broken: s.broken, offer: s.repair && { was: s.repair.was, cost: s.repair.cost }, text: out[9].text, button: btn?.textContent || '' };
    const scrap0 = api.profile.scrap;
    btn?.click();
    await new Promise(r => setTimeout(r, 300));
    const repaired = { count: pg.state.streak.count, repair: pg.state.streak.repair, cost: scrap0 - api.profile.scrap, text: document.querySelector('.pg-card')?.textContent || '', again: pg.repairStreak() };
    await step(2);
    pg.state.streak.repair.until = Date.now() - 1;
    pg.openStreak();
    const expired = { offer: pg.data.repairOffer(pg.state.streak), button: !![...document.querySelectorAll('.pg-card button')].find(b => b.textContent.startsWith('RESTORE')), repaired: pg.repairStreak() };
    pg.state.streak.repair = null;
    const cap = (() => { const t = { count: 13, last: 100, shields: 2, best: 13 }; pg.data.streakVisit(t, 101); return t.shields; })();
    const twoMissed = (() => { const t = { count: 19, last: 100, shields: 2, best: 19 }; pg.data.streakVisit(t, 103); return [t.count, t.shields, t.shielded]; })();
    return { out, ach7, again: out[7].gained, shields7, earned7, shielded, broken, repaired, expired, cap, twoMissed, cost: pg.data.repairCost(8) };
  }, DAY);
  const counts = days.out.map(d => d.count), gains = days.out.map(d => d.gained);
  check(counts.slice(0, 7).join() === '1,2,3,4,5,6,7' && gains.slice(0, 7).join() === '50,75,100,125,150,200,400', 'streak increments daily with escalating rewards', { counts, gains });
  check(days.ach7, '7-day streak achievement');
  check(days.again === 0, 'streak reward claimable once per day');
  check(days.shields7 === 1 && /SHIELD EARNED/.test(days.earned7), 'day 7 earns a streak shield and the modal says so', { shields: days.shields7, text: days.earned7 });
  check(days.shielded.count === 8 && days.shielded.shields === 0 && days.shielded.shielded === 1 && /SHIELD USED/.test(days.shielded.text) && gains[8] === 50, 'a missed day is covered by the shield: streak continues at day 8', days.shielded);
  check(days.broken.count === 1 && /STREAK RESET TO DAY 1 \(WAS 8\)/.test(days.broken.text) && days.broken.offer?.was === 8 && days.broken.offer.cost === days.cost && /RESTORE DAY 9 STREAK/.test(days.broken.button), 'a second miss without a shield breaks the streak and offers a paid restore', days.broken);
  check(days.repaired.count === 9 && !days.repaired.repair && days.repaired.cost === days.cost && /DAY 9/.test(days.repaired.text) && !/RESET/.test(days.repaired.text) && days.repaired.again === 0, 'RESTORE pays scrap, brings the streak back to day 9 and cannot be used twice', days.repaired);
  check(!days.expired.offer && !days.expired.button && days.expired.repaired === 0, 'the restore offer expires after 24 h', days.expired);
  check(days.cap === 2 && days.twoMissed.join() === '20,0,2', 'shields cap at 2 and two shields cover two missed days', { cap: days.cap, twoMissed: days.twoMissed });
  await page.evaluate(() => { const s = window.__game.api.profile.progression.streak; s.count = 13; s.last -= 1; s.shown = null; s.claimed = null; window.__game.api.progression.streakCheck(); });
  await page.waitForTimeout(600);
  const m14 = await page.evaluate(() => { const scrap = window.__game.api.profile.scrap; return { gained: window.__game.api.progression.claimStreak() , count: window.__game.api.profile.progression.streak.count, scrap: window.__game.api.profile.scrap - scrap }; });
  check(m14.count === 14 && m14.scrap === 400 + 750, 'day 14 milestone bonus', m14);
  await page.close();
}

async function overRun(size, name) {
  const page = await open({ now: T0 }, size);
  await page.evaluate(() => document.querySelector('.pg-card .ghost')?.click());
  await page.evaluate(() => { const s = window.__game.api.profile.progression; s.daily.list[0] = { id: 'daily:x:0', t: 'kills', n: 5, arg: null, p: 0, done: false, claimed: false, scrap: 100, xp: 400 }; });
  await page.click('#start');
  const out = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.settings.autoFire = true;
    for (let i = 0; i < 30 * 40; i++) {
      if (api.state.mode === 'perk') document.querySelector('.perk').click();
      if (api.state.mode !== 'playing') break;
      let best = null, bd = 1e9;
      for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
      if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
      g.update(1 / 30); g.scene.updateMatrixWorld();
    }
    const feed = [...document.querySelectorAll('#hud-extras .pg-note')].map(n => n.textContent);
    g.gameOver();
    return { feed, kills: api.state.kills };
  });
  await page.waitForTimeout(1500);
  const over = await page.evaluate(() => [...document.querySelectorAll('#over-extras .pg-over > *')].map(e => e.textContent));
  await shot(page, 'over-' + name);
  await page.evaluate(() => [...document.querySelectorAll('#over-extras button')].find(b => b.textContent.startsWith('CLAIM'))?.click());
  await page.waitForTimeout(200);
  await shot(page, 'missions-from-over-' + name);
  const back = await page.evaluate(() => { document.querySelector('#missions .pg-close').click(); return document.querySelector('#over').classList.contains('hidden'); });
  await page.close();
  return { ...out, over, backHidden: back };
}
{
  const r = await overRun({}, 'landscape');
  check(r.kills >= 5 && r.feed.some(t => t.includes('MISSION COMPLETE')), 'headless run completes a mission mid-run with HUD toast', r);
  check(r.over.some(t => t.includes('✔ 5 KILLS')) && r.over.some(t => /★/.test(t)) && r.over.some(t => t.startsWith('CLAIM')), 'game-over extras list mission, mastery and claim button', r.over);
  check(!r.backHidden, 'missions BACK returns to game-over screen');
  const p = await overRun({ width: 390, height: 844 }, 'portrait');
  check(p.over.length >= 3, 'portrait game-over extras', p.over);
}

{
  const page = await open({ now: T0 }, { width: 390, height: 844 });
  await shot(page, 'streak-portrait');
  await page.evaluate(() => document.querySelector('.pg-card .ghost')?.click());
  await shot(page, 'menu-portrait');
  await page.evaluate(() => window.__game.api.progression.openMissions('daily'));
  await page.waitForTimeout(200);
  await shot(page, 'missions-portrait');
  await page.evaluate(() => window.__game.api.progression.openMissions('ach'));
  await page.waitForTimeout(200);
  await shot(page, 'achievements-portrait');
  await page.evaluate(() => { const { api } = window.__game; api.profile.progression.mastery.m4 = 900; api.showScreen(api.ui.menu); document.querySelector('[data-open="armory"]').click(); });
  await page.waitForTimeout(400);
  await shot(page, 'armory-portrait');
  const fits = await page.evaluate(() => {
    const bad = [];
    for (const e of document.querySelectorAll('.pg-wm, .pg-ad, .wcard')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) bad.push(e.className); }
    return bad;
  });
  check(!fits.length, 'portrait armory decorations fit on screen', fits);
  await page.close();
  const land = await open({ now: T0 });
  await land.evaluate(() => document.querySelector('.pg-card .ghost')?.click());
  await shot(land, 'menu-landscape');
  const menuFit = await land.evaluate(() => { const b = [...document.querySelectorAll('#menu-extras > button')]; return b.length > 0 && b.every(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }); });
  check(menuFit, 'menu extras visible in landscape');
  await land.close();
}

await browser.close();
server.close();
check(!pageErrors.length, 'no page errors', pageErrors);
console.log('screenshots: ' + shots);
if (failures.length) { console.error(failures.length + ' failed'); process.exit(1); }
console.log('progression ok');
