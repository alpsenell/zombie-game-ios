import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12), DAY = 864e5;

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

const PROFILE = { runs: 12, bestWave: 14, scrap: 2000, xp: 9000, kills: 1234, heads: 321, bosses: { abomination: 3 }, bestByDiff: { survivor: 14, nightmare: 6 }, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } },
  maps: { street: { runs: 5, bestWave: 14, bestScore: 20000, byDiff: { survivor: 14, veteran: 9 } } }, weaponKills: { m4: 250 }, weaponHeads: { m4: 50 }, playTime: 3725,
  progression: { stats: { kills: 1234, heads: 321, bosses: { abomination: 3 }, bestWave: 14, nightmare: 5, burning: 0, elites: 42, combo: 11, missions: 7, accuracy: 63, runs: 12 }, mastery: { m4: 900 }, prestige: { m4: 1 }, ach: { 'first-blood': 1 }, streak: { count: 2, best: 9, last: null, claimed: null } },
  competitive: { held: { id: 'gold', week: '2026-09-28' }, seasonBest: { season: 1, id: 'platinum' }, sprint: [{ cs: 81234, diff: 'veteran', date: 1 }], blitz: { date: '2026-10-01', best: 1000, allTime: 45678, runs: 1 }, resets: {} }, events: { won: { bloodmoon: { skin: 1 }, scraprush: 5 } } };
const RUNS = [
  { score: 20000, wave: 14, kills: 300, diff: 'survivor', date: NOW - 3 * DAY, type: 'normal', map: 'street', weapon: 'm4', time: 700 },
  { score: 9000, wave: 10, kills: 120, diff: 'veteran', date: NOW - DAY, type: 'extract', map: 'mall', weapon: 'mp7', time: 400, event: true },
  { score: 5000, wave: 7, kills: 60, diff: 'survivor', date: NOW - 10 * DAY, type: 'daily' },
];
async function open() {
  const init = `
    window.__now = ${NOW};
    Date.now = () => window.__now;
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(PROFILE))});
    localStorage.setItem('deadzone.runs', ${JSON.stringify(JSON.stringify(RUNS))});
    localStorage.setItem('deadzone.records', ${JSON.stringify(JSON.stringify({ score: 20000, wave: 14, rank: 77 }))});`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}

{
  const page = await open();
  const ov = await page.evaluate(() => {
    document.querySelector('#ds-open').click();
    const cells = Object.fromEntries([...document.querySelectorAll('#dossier .ds-cell')].map(c => [c.querySelector('small').textContent, c.querySelector('b').textContent]));
    return { visible: !document.querySelector('#dossier').classList.contains('hidden'), sub: document.querySelector('#ds-sub').textContent, tabs: [...document.querySelectorAll('#ds-tabs button')].map(b => b.textContent), on: document.querySelector('#ds-tabs button.on')?.textContent, cells };
  });
  check(ov.visible && ov.tabs.join() === 'OVERVIEW,MAPS,WEAPONS,BOSSES,HISTORY' && ov.on === 'OVERVIEW' && /12 RUNS/.test(ov.sub) && /1H 2M IN THE FIELD/.test(ov.sub), 'the dossier opens on the overview with five tabs', { sub: ov.sub, tabs: ov.tabs });
  const c = ov.cells;
  check(c['BEST SCORE'] === '20,000' && c['BEST WAVE'] === '14' && c['GLOBAL RANK'] === '#77' && c.KILLS === '1,234' && c.HEADSHOTS === '321' && c['HEADSHOT RATE'] === '26%' && c['BOSSES DOWN'] === '3' && c['ELITES DOWN'] === '42' && c['BEST KILL STREAK'] === '11' && c['BEST ACCURACY'] === '63%', 'records and career totals come from the profile', c);
  check(c['LONGEST LOGIN STREAK'] === '9' && c['MISSIONS DONE'] === '7' && /^\d+ \/ \d+$/.test(c.ACHIEVEMENTS) && c.LEAGUE === 'GOLD' && c['SEASON BEST'] === 'PLATINUM' && c['SPRINT 20'] === '13:32.34' && c['BLITZ BEST'] === '45,678' && c['NIGHTMARE BEST'] === 'WAVE 6' && c['EVENT SKINS'] === '2 / 4', 'competitive records and the event ladder show', c);
  await page.screenshot({ path: '/tmp/dossier-overview.png' });

  const maps = await page.evaluate(() => {
    document.querySelector('#ds-tabs [data-tab="maps"]').click();
    const rows = [...document.querySelectorAll('#ds-body .ds-row')];
    return { n: rows.length, first: rows[0].textContent, firstDim: rows[0].classList.contains('dim'), dim: rows.filter(r => r.classList.contains('dim')).length, chips: [...rows[0].querySelectorAll('.ds-chips span')].map(s => s.textContent + (s.classList.contains('on') ? '*' : '')) };
  });
  check(maps.n === 4 && /BEST WAVE 14/.test(maps.first) && /5 RUNS · BEST SCORE 20,000/.test(maps.first) && !maps.firstDim && maps.dim === 3 && maps.chips.join() === 'RECRUIT —,SURVIVOR W14*,VETERAN W9*,NIGHTMARE —', 'the maps tab lists best waves per map and difficulty', maps);

  const weapons = await page.evaluate(() => {
    const { api } = window.__game;
    document.querySelector('#ds-tabs [data-tab="weapons"]').click();
    const rows = [...document.querySelectorAll('#ds-body .ds-row')];
    return { n: rows.length, total: api.WEAPONS.length, first: rows[0].textContent, bar: rows[0].querySelector('.ds-bar i')?.style.width, locked: rows.filter(r => /LOCKED/.test(r.textContent)).length, owned: api.WEAPONS.filter(w => api.weaponOwned(w)).length };
  });
  check(weapons.n === weapons.total && /M4/.test(weapons.first) && /✦/.test(weapons.first) && /250 KILLS/.test(weapons.first) && /MASTERY \d/.test(weapons.first) && /20% HEADSHOTS/.test(weapons.first) && weapons.bar && weapons.locked === weapons.total - weapons.owned, 'the weapons tab shows kills, headshots, mastery and prestige', weapons);

  const bosses = await page.evaluate(() => {
    document.querySelector('#ds-tabs [data-tab="bosses"]').click();
    const rows = [...document.querySelectorAll('#ds-body .ds-row')];
    return { n: rows.length, texts: rows.map(r => r.textContent.slice(0, 40)), dim: rows.filter(r => r.classList.contains('dim')).length };
  });
  check(bosses.n === 4 && /ABOMINATION3 DOWN/.test(bosses.texts[0]) && /FIRST SEEN ON WAVE 5/.test(bosses.texts[0]) && /NOT MET/.test(bosses.texts[1]) && bosses.dim === 3, 'the bosses tab counts each boss', bosses);

  const hist = await page.evaluate(() => {
    document.querySelector('#ds-tabs [data-tab="history"]').click();
    return [...document.querySelectorAll('#ds-body .ds-hist')].map(r => r.textContent);
  });
  check(hist.length === 3 && /W10EXTRACTION · VETERAN · DEAD MALL9,000/.test(hist[0]) && /120 KILLS · MP7 · 6:40 · EVENT/.test(hist[0]) && /W14DEPLOY · SURVIVOR/.test(hist[1]) && /W7DAILY · SURVIVOR5,000/.test(hist[2]), 'the history tab lists saved runs newest first with mode, map and weapon', hist);
  await page.screenshot({ path: '/tmp/dossier-history.png' });

  const tracked = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    api.levels.state.paid = 99;
    api.showScreen(api.ui.menu);
    api.startGame({ map: 'mall' });
    for (let i = 0; i < 3; i++) api.bus.emit('kill', { kind: 'walker', head: i === 0, weapon: 'mp7', combo: 1 });
    Object.assign(api.state, { wave: 12, score: 8000, kills: 90, clock: 333 });
    const play0 = api.profile.playTime;
    g.gameOver();
    await new Promise(r => setTimeout(r, 200));
    const run = api.store.get('runs', []).find(r => r.map === 'mall' && r.score === 8000);
    const m = api.profile.maps.mall;
    api.toMenu();
    api.startGame({ type: 'tutorial', map: 'street' });
    Object.assign(api.state, { wave: 3, score: 500, clock: 60 });
    const street0 = JSON.stringify(api.profile.maps.street);
    g.gameOver();
    await new Promise(r => setTimeout(r, 200));
    api.toMenu();
    return { kills: api.profile.weaponKills.mp7, heads: api.profile.weaponHeads.mp7, mall: m, play: api.profile.playTime - play0, run: run && { map: run.map, weapon: run.weapon, time: run.time }, streetSame: JSON.stringify(api.profile.maps.street) === street0 };
  });
  check(tracked.kills === 3 && tracked.heads === 1 && tracked.mall?.runs === 1 && tracked.mall.bestWave === 12 && tracked.mall.byDiff.survivor === 12 && tracked.mall.bestScore === 8000 && tracked.play === 333 && tracked.run?.map === 'mall' && tracked.run.weapon && tracked.run.time === 333 && tracked.streetSame, 'runs and kills feed the per-map and per-weapon records, training excluded', tracked);

  const merged = await page.evaluate(async () => {
    const C = await import('./features/cloudsave.js');
    const m = C.mergeProfile({ runs: 3, maps: { street: { runs: 2, bestWave: 8, bestScore: 100, byDiff: { survivor: 8 } } }, weaponKills: { m4: 10 }, playTime: 100 }, { runs: 2, maps: { street: { runs: 5, bestWave: 6, bestScore: 900, byDiff: { veteran: 4 } }, mall: { runs: 1, bestWave: 3, bestScore: 50, byDiff: {} } }, weaponKills: { m4: 4, mp7: 9 }, playTime: 400 });
    return { maps: m.maps, kills: m.weaponKills, play: m.playTime };
  });
  check(merged.maps.street.runs === 5 && merged.maps.street.bestWave === 8 && merged.maps.street.bestScore === 900 && merged.maps.street.byDiff.survivor === 8 && merged.maps.street.byDiff.veteran === 4 && merged.maps.mall.bestWave === 3 && merged.kills.m4 === 10 && merged.kills.mp7 === 9 && merged.play === 400, 'the cloud merge keeps the best of each record', merged);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL DOSSIER CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
