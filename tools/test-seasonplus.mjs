import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

async function open({ now = NOW } = {}) {
  const init = `
    window.__now = ${now};
    Date.now = () => window.__now;
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', JSON.stringify({ runs: 3, bestWave: 9, scrap: 300, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } }));`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}

{
  const page = await open();
  const ch = await page.evaluate(() => {
    const { api } = window.__game, pg = api.progression, list = pg.challenges();
    pg.openMissions('season');
    return { n: list.length, xp: list.map(m => [m.scrap, m.xp, m.seasonXp]), texts: list.map(m => pg.data.missionText(m, { maps: api.MAPS, weaponName: id => api.WEAPONS.find(w => w.id === id)?.name })), key: pg.state.season.key, tab: document.querySelector('.pg-tabs button.on')?.dataset.pg, h2: document.querySelector('#missions h2').textContent, sub: document.querySelector('.pg-sub').textContent, reroll: !![...document.querySelectorAll('#missions .pg-m button')].find(b => b.textContent === 'REROLL'), rows: [...document.querySelectorAll('#missions .pg-m em')].map(e => e.textContent) };
  });
  check(ch.n === 3 && ch.xp.every(x => x.join() === '300,1000,1500') && ch.key === '2026-W40', 'three weekly season challenges worth 1,500 season XP', ch);
  check(ch.tab === 'season' && ch.h2 === 'SEASON CHALLENGES' && /1,500 SEASON XP EACH/.test(ch.sub) && !ch.reroll && ch.rows.every(r => /1,500 SEASON XP/.test(r)), 'the SEASON tab lists them without rerolls', ch);
  await page.screenshot({ path: '/tmp/season-challenges.png' });
  const done = await page.evaluate(() => new Promise(res => {
    const { api } = window.__game, pg = api.progression, s = pg.state, events = [];
    api.bus.on('mission:complete', e => events.push(e));
    s.season.list[0] = { id: 'season:test:0', t: 'sheads', n: 5, arg: null, p: 0, done: false, claimed: false, scrap: 300, xp: 1000, seasonXp: 1500 };
    api.levels.state.paid = 99;
    const sx0 = api.season.state().xp, scrap0 = api.profile.scrap;
    api.bus.emit('run:start', { type: 'normal', difficultyId: 'survivor', map: 'street' });
    for (let i = 0; i < 5; i++) api.bus.emit('kill', { kind: 'walker', head: true, weapon: 'm4', combo: 1 });
    const doneFlag = s.season.list[0].done;
    const claimed = pg.claim('season:test:0');
    setTimeout(() => res({ doneFlag, claimed, seasonXp: api.season.state().xp - sx0, scrap: api.profile.scrap - scrap0, event: events[0], badge: document.querySelector('#menu-extras .pg-btn .badge').textContent }), 50);
  }));
  check(done.doneFlag && done.claimed && done.seasonXp === 1500 && done.scrap === 300 && done.event?.seasonXp === 1500 && done.event.period === 'season', 'a completed challenge pays 1,500 season XP past the mission cap', done);
  const map = await page.evaluate(() => {
    const { api } = window.__game, pg = api.progression, s = pg.state;
    s.season.list[1] = { id: 'season:test:1', t: 'smap', n: 12, arg: 'mall', p: 0, done: false, claimed: false, scrap: 300, xp: 1000, seasonXp: 1500 };
    api.bus.emit('run:start', { type: 'normal', difficultyId: 'survivor', map: 'street' });
    api.bus.emit('wave:start', { wave: 12 });
    const wrongMap = s.season.list[1].p;
    api.bus.emit('run:start', { type: 'normal', difficultyId: 'survivor', map: 'mall' });
    api.bus.emit('wave:start', { wave: 12 });
    return { wrongMap, right: s.season.list[1].p, done: s.season.list[1].done, text: pg.data.missionText(s.season.list[1], { maps: api.MAPS }) };
  });
  check(map.wrongMap === 0 && map.right === 12 && map.done && /REACH WAVE 12 ON DEAD MALL/.test(map.text), 'map challenges only count runs on that map', map);

  const bonus = await page.evaluate(() => {
    const { api } = window.__game, S = api.season;
    S.state().xp = 0; S.addXP(29000);
    const t30 = { tier: S.tierOf(S.state().xp), bonus: S.bonusCount(S.state().xp), claimable: S.claimable().filter(c => c[0] === 'bonus').length };
    S.addXP(2000);
    const b1 = { bonus: S.bonusCount(S.state().xp), claimable: S.claimable().filter(c => c[0] === 'bonus').length };
    S.open();
    const ui = { tier: document.querySelector('#sp-tier').textContent, xp: document.querySelector('#sp-xp').textContent, cell: document.querySelector('.sp-col.bonus .sp-cell.free').textContent, state: document.querySelector('.sp-col.bonus .sp-cell.free').className };
    const scrap0 = api.profile.scrap;
    document.querySelector('.sp-col.bonus .sp-cell.free').click();
    const after = { scrap: api.profile.scrap - scrap0, claimed: S.state().bonus.slice(), again: S.claim('bonus', 1), cell: document.querySelector('.sp-col.bonus .sp-cell.free').textContent };
    S.addXP(4000);
    const owned0 = Object.keys(api.profile.owned).length;
    const r2 = S.claim('bonus', 2), r3 = S.claim('bonus', 3);
    return { t30, b1, ui, after, r2, r3, ownedDelta: Object.keys(api.profile.owned).length - owned0, bonus: S.bonusCount(S.state().xp) };
  });
  check(bonus.t30.tier === 30 && bonus.t30.bonus === 0 && bonus.t30.claimable === 0 && bonus.b1.bonus === 1 && bonus.b1.claimable === 1, 'XP past tier 30 keeps counting and opens a bonus tier every 2,000', bonus);
  check(/TIER 30 \/ 30 \+1/.test(bonus.ui.tier) && /TO BONUS TIER 2/.test(bonus.ui.xp) && /1 BONUS TIER/.test(bonus.ui.cell) && /ready/.test(bonus.ui.state), 'the season screen shows the bonus tier', bonus.ui);
  check(bonus.after.scrap === 1500 && bonus.after.claimed.join() === '1' && bonus.after.again === false && /CLAIMED/.test(bonus.after.cell), 'claiming a bonus tier pays 1,500 scrap once', bonus.after);
  check(bonus.r2?.kind === 'scrap' && bonus.r3?.kind === 'crate' && bonus.r3.got && bonus.ownedDelta === 1 && bonus.bonus === 3, 'every third bonus tier is a crate with a cosmetic', { r2: bonus.r2, r3: bonus.r3, ownedDelta: bonus.ownedDelta });
  await page.screenshot({ path: '/tmp/season-bonus.png' });

  const drop = await page.evaluate(() => {
    const { api } = window.__game, S = api.season;
    S.state().xp = 0; S.addXP(26000);
    const day = S.seasonAt().day, locked = S.dropLocked(), r = S.reward(1, 25, 'free');
    const claimableBefore = S.claimable().some(c => c[0] === 'free' && c[1] === 25), tryClaim = S.claim('free', 25);
    S.render();
    const cell = [...document.querySelectorAll('.sp-cell.free')].find(c => c.dataset.tier === '25');
    const before = { day, locked, kind: r.kind, claimableBefore, tryClaim, text: cell?.textContent, cls: cell?.className };
    window.__now += 5 * 864e5;
    const owned0 = Object.keys(api.profile.owned).length;
    const unlocked = !S.dropLocked(), claimableAfter = S.claimable().some(c => c[0] === 'free' && c[1] === 25), got = S.claim('free', 25);
    S.render();
    const cell2 = [...document.querySelectorAll('.sp-cell.free')].find(c => c.dataset.tier === '25');
    return { before, after: { day: S.seasonAt().day, unlocked, claimableAfter, got, ownedDelta: Object.keys(api.profile.owned).length - owned0, text: cell2?.textContent } };
  });
  check(drop.before.day === 11 && drop.before.locked && drop.before.kind === 'drop' && !drop.before.claimableBefore && drop.before.tryClaim === false && /WEEK 3/.test(drop.before.text) && /locked/.test(drop.before.cls), 'the mid-season drop at tier 25 stays locked before week 3', drop.before);
  check(drop.after.day === 16 && drop.after.unlocked && drop.after.claimableAfter && drop.after.got?.kind === 'drop' && drop.after.got.got && drop.after.ownedDelta === 1 && /CLAIMED/.test(drop.after.text), 'from day 14 the drop opens and grants a cosmetic', drop.after);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL SEASON PLUS CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
