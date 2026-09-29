import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const DAY = 864e5;
const SAT = Date.UTC(2026, 8, 26, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

async function open({ now = SAT, profile = null } = {}) {
  const init = `
    { const real = Date.now, off = ${now} - real(); Date.now = () => real() + off; }
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      localStorage.setItem('deadzone.tutorial', 'true');
    }`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(700);
  return page;
}
const dismissStreak = page => page.evaluate(() => document.querySelector('.pg-modal .ghost, .pg-modal .cta')?.click());

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const E = await import('./features/events.js'), C = await import('./features/competitive.js'), B = await import('./features/comeback.js');
    const at = t => { const e = E.eventAt(t); return [e.id, e.live]; };
    const fri = Date.UTC(2026, 8, 25, 0, 0, 1), mon = Date.UTC(2026, 8, 28, 0, 0, 1), fri2 = Date.UTC(2026, 9, 2, 1), fri5 = Date.UTC(2026, 9, 23, 1);
    const ev = E.eventAt(fri);
    return {
      fri: at(fri), mon: at(mon), fri2: at(fri2), fri5: at(fri5), midweek: at(Date.UTC(2026, 8, 23)),
      daily: E.modsFor(ev, 'daily'), ranked: E.modsFor(ev, 'ranked'), normal: E.modsFor(ev, 'normal'), off: E.modsFor(E.eventAt(mon), 'normal'),
      sprint: [C.sprintTime(81235), C.sprintTime(5999), C.sprintTime(360000)],
      settleUp: C.settleWeek({ league: { id: 'gold', week: '2026-09-21' }, held: { id: 'silver', week: '2026-09-14' } }, '2026-09-28'),
      settleDown: C.settleWeek({ league: { id: 'bronze', week: '2026-09-21' }, held: { id: 'gold', week: '2026-09-14' } }, '2026-09-28'),
      settleSame: C.settleWeek({ league: { id: 'gold', week: '2026-09-28' } }, '2026-09-28'),
      settlePaid: C.settleWeek({ league: { id: 'gold', week: '2026-09-21' }, paidWeek: '2026-09-21' }, '2026-09-28'),
      visitNew: B.visit({ last: null }, 100), visitSoon: B.visit({ last: 95 }, 100), visitAway: (() => { const c = { last: 80, boost: 0 }; return [B.visit(c, 100), c.boost, c.last]; })(),
    };
  });
  check(pure.fri.join() === 'bloodmoon,true' && pure.mon.join() === 'scraprush,false' && pure.fri2.join() === 'scraprush,true' && pure.fri5.join() === 'bloodmoon,true', 'weekend events run Fri–Sun UTC and rotate every week', pure);
  check(pure.midweek[1] === false, 'no event live midweek');
  check(pure.daily.scrap === 1 && pure.daily.elite === 0, 'daily challenge ignores events');
  check(pure.ranked.scrap === 1.5 && pure.ranked.elite === 0 && pure.normal.elite === .08 && pure.normal.scrap === 1.5, 'ranked gets only scrap/xp boosts, normal gets the full event', [pure.ranked, pure.normal]);
  check(pure.off.scrap === 1 && pure.off.label === '', 'no boosts outside the event window');
  check(pure.sprint.join() === '13:32.35,0:59.99,60:00.00', 'sprint times format as m:ss.hh', pure.sprint);
  check(pure.settleUp.move === 'up' && pure.settleUp.scrap === 800 && pure.settleDown.move === 'down' && pure.settleDown.from === 'gold' && !pure.settleSame && !pure.settlePaid, 'weekly settle pays once and reports promotion/relegation', [pure.settleUp, pure.settleDown]);
  check(!pure.visitNew && !pure.visitSoon && pure.visitAway[0]?.days === 20 && pure.visitAway[0].scrap === 1250 && pure.visitAway[1] === 3 && pure.visitAway[2] === 100, 'comeback crate only after 7+ days away', pure.visitAway);

  await dismissStreak(page);
  const chip = await page.evaluate(() => document.querySelector('#ev-chip').textContent);
  check(/BLOOD MOON/.test(chip) && /LIVE/.test(chip), 'menu shows the live weekend event', chip);
  await page.click('#ev-chip');
  const sheet = await page.evaluate(() => document.querySelector('.ev-card').textContent);
  check(/ECLIPSE/.test(sheet) && /CLEAR WAVE 10/.test(sheet), 'event sheet names the reward and goal', sheet.slice(0, 120));
  await page.evaluate(() => window.__game.api.events.close());

  const run = await page.evaluate(() => {
    const { api } = window.__game, gun = api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'event:bloodmoon');
    api.startGame({ map: 'street' });
    const normal = { ...api.live };
    const locked = api.reqMet('event:bloodmoon');
    api.bus.emit('wave:clear', { wave: 9 });
    const early = api.reqMet('event:bloodmoon');
    api.bus.emit('wave:clear', { wave: 10 });
    const won = api.reqMet('event:bloodmoon');
    api.startGame({ type: 'ranked' });
    const ranked = { ...api.live };
    api.gameOver();
    return { normal, ranked, locked, early, won, fresh: api.profile.fresh.includes('gun:' + gun) };
  });
  check(run.normal.elite === .08 && run.normal.scrap === 1.5 && run.ranked.elite === 0 && run.ranked.scrap === 1.5, 'run start applies event boosts by mode', [run.normal, run.ranked]);
  check(!run.locked && !run.early && run.won && run.fresh, 'clearing wave 10 during the event unlocks its skin');
  await page.waitForTimeout(1200);
  const chips = await page.evaluate(() => document.querySelector('#over-rewards').textContent);
  check(/BLOOD MOON x1.5/.test(chips), 'run rewards show the event scrap boost', chips);

  const sprint = await page.evaluate(() => {
    const { api } = window.__game;
    api.startGame({ map: 'street' });
    api.state.clock = 812.345;
    api.bus.emit('wave:clear', { wave: 20 });
    api.startGame({ map: 'street', startWave: 5 });
    api.state.clock = 400;
    api.bus.emit('wave:clear', { wave: 20 });
    api.startGame({ map: 'street' });
    api.state.clock = 50;
    api.bus.emit('wave:clear', { wave: 20 });
    api.gameOver();
    return api.profile.competitive.sprint.map(x => x.cs);
  });
  check(sprint.join() === '81235', 'SPRINT 20 records only full runs with plausible times', sprint);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__game.api.toMenu(); window.__game.api.competitive.openBoard('sprint'); });
  await page.waitForTimeout(500);
  const board = await page.evaluate(() => ({ note: document.querySelector('.cm-board-note').textContent, rows: [...document.querySelectorAll('#board-list li')].map(li => li.textContent) }));
  check(/WAVE 20/.test(board.note) && board.rows.length === 1 && board.rows[0].includes('13:32.35'), 'SPRINT 20 board lists local times', board);
  await page.close();
}

{
  const now = Date.UTC(2026, 9, 6, 12);
  const weekOf = t => { const d = Math.floor(t / DAY); return new Date((d - (d + 3) % 7) * DAY).toISOString().slice(0, 10); };
  const last = weekOf(now - 7 * DAY), prev = weekOf(now - 14 * DAY), today = Math.floor(now / DAY);
  const profile = { scrap: 100, xp: 0, loadout: {}, competitive: { league: { id: 'diamond', rank: 12, total: 2000, pct: .006, week: last, at: now - 3 * DAY }, held: { id: 'gold', week: prev }, resets: {} }, comeback: { last: today - 12, boost: 0 }, progression: { mastery: { m4: 1e7 } } };
  const page = await open({ now, profile });
  const s0 = 100;
  await page.waitForSelector('.cm-pay-card', { timeout: 4000 });
  const pay = await page.evaluate(() => document.querySelector('.cm-pay-card').textContent);
  check(/PROMOTED/.test(pay) && /GOLD → DIAMOND/.test(pay) && /2,500/.test(pay), 'weekly league payout shows promotion', pay);
  await page.click('.cm-pay-card .cta');
  await page.waitForSelector('.cb-card', { timeout: 4000 });
  const crate = await page.evaluate(() => document.querySelector('.cb-card').textContent);
  check(/WELCOME BACK/.test(crate) && /12 DAYS/.test(crate), 'returning player sees the comeback crate', crate);
  await page.click('.cb-card .cta');
  const after = await page.evaluate(s0 => { const { api } = window.__game; return { scrap: api.profile.scrap - s0, boost: api.comeback.state.boost, diamond: api.reqMet('league:diamond'), paid: api.profile.competitive.paidWeek }; }, s0);
  check(after.scrap === 1000 + 2500 && after.boost === 3 && after.diamond && after.paid === last, 'crate + league scrap granted, DIAMOND LEAGUE skin unlocked', after);
  const kept = await page.evaluate(() => {
    const { api } = window.__game, gun = api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'league:diamond');
    api.profile.loadout.gun = gun; api.refreshProfileUI();
    const worn = api.profile.loadout.gun === gun;
    api.profile.competitive.held.week = '2020-01-06'; api.refreshProfileUI();
    return { worn, lost: !api.reqMet('league:diamond'), reset: api.profile.loadout.gun };
  });
  check(kept.worn && kept.lost && kept.reset === 0, 'the Diamond skin is removed once you drop out of Diamond', kept);

  const boost = await page.evaluate(() => {
    const { api } = window.__game;
    api.startGame({ map: 'street' });
    const x = api.live.comebackXp;
    api.state.score = 5000; api.state.kills = 40; api.state.wave = 4;
    api.gameOver();
    return { x, left: api.comeback.state.boost };
  });
  await page.waitForTimeout(1200);
  const seasonChip = await page.evaluate(() => document.querySelector('#sp-over').textContent + ' | ' + document.querySelector('.cb-over').textContent);
  check(boost.x === 2 && boost.left === 2 && /\(x2\)/.test(seasonChip) && /COMEBACK/.test(seasonChip), 'comeback doubles season XP for the next runs', { boost, seasonChip });

  await page.evaluate(() => window.__game.api.toMenu());
  await page.waitForTimeout(400);
  await page.click('[data-open="armory"]');
  await page.evaluate(() => [...document.querySelectorAll('#weapon-grid .wcard')].find(c => c.textContent.includes('M4A1'))?.click());
  await page.waitForSelector('#pg-prestige');
  await page.click('#pg-prestige');
  const armed = await page.evaluate(() => document.querySelector('#pg-prestige').textContent);
  const ps = await page.evaluate(() => window.__game.api.profile.scrap);
  await page.click('#pg-prestige');
  const pr = await page.evaluate(ps => {
    const { api } = window.__game, gun = api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'prestige:1');
    return { n: api.progression.prestigeOf('m4'), mastery: api.progression.mastery('m4').level, scrap: api.profile.scrap - ps, unlocked: api.reqMet('prestige:1'), five: api.reqMet('prestige:5'), fresh: api.profile.fresh.includes('gun:' + gun), card: [...document.querySelectorAll('#weapon-grid .wcard')].find(c => c.textContent.includes('M4A1'))?.textContent, button: !!document.querySelector('#pg-prestige') };
  }, ps);
  check(/TAP AGAIN/.test(armed), 'prestige asks for confirmation', armed);
  check(pr.n === 1 && pr.mastery === 1 && pr.scrap === 1500 && pr.unlocked && !pr.five && pr.fresh && /✦/.test(pr.card) && !pr.button, 'prestige resets mastery, pays scrap, adds a star and unlocks the PRESTIGE skin', pr);
  const anim = await page.evaluate(async () => {
    const { animateGunMaterials, WEAPON_SKINS } = await import('./character.js');
    const THREE = await import('./vendor/three.module.js');
    const i = WEAPON_SKINS.findIndex(s => s.name === 'ASCENDANT');
    const mats = { base: new THREE.MeshStandardMaterial(), dark: new THREE.MeshStandardMaterial() };
    animateGunMaterials(mats, i, 0); const a = [mats.dark.emissiveIntensity, mats.base.emissive.getHex()];
    animateGunMaterials(mats, i, 1.3); const b = [mats.dark.emissiveIntensity, mats.base.emissive.getHex()];
    return { a, b };
  });
  check(anim.a[0] !== anim.b[0] && anim.a[1] !== anim.b[1], 'animated prestige skins pulse and cycle colour', anim);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL LIVE-OPS CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
