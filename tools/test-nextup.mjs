import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

async function open({ profile = null, width = 844, height = 390 } = {}) {
  const init = `
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      localStorage.setItem('deadzone.tutorial', 'true');
    }`;
  const { page, errors } = await openGame(browser, url, { width, height, init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const chip = page => page.evaluate(() => { const c = document.querySelector('#nu-chip'); return { hidden: c.classList.contains('hidden'), ready: c.classList.contains('ready'), text: c.textContent }; });
const rows = page => page.evaluate(() => [...document.querySelectorAll('.nu-row')].map(r => ({ text: r.textContent, pct: r.querySelector('.nu-bar i').style.getPropertyValue('--v'), ready: r.classList.contains('ready') })));

{
  const page = await open();
  const g = await page.evaluate(() => {
    const { api } = window.__game, list = api.nextup.goals();
    return {
      n: list.length, top: list.slice(0, 4).map(x => [x.name, x.cur, x.need, +x.pct.toFixed(3)]),
      names: list.map(x => x.name), premium: list.some(x => x.name === 'CYBER RONIN' || x.name === 'TESLA ARC'), met: list.some(x => x.pct >= 1 && !x.ready),
      p: { level: api.nextup.progress('level:3'), wave: api.nextup.progress('wave:15'), boss: api.nextup.progress('boss:butcher'), heads: api.nextup.progress('heads:250'), league: api.nextup.progress('league:diamond'), prestige: api.nextup.progress('prestige:1'), event: api.nextup.progress('event:bloodmoon'), season: api.nextup.progress('season:1') },
    };
  });
  check(g.n > 30 && g.names.includes('MP7') && g.names.includes('TIGER') && g.names.includes('GAS MASK') && g.names.includes('KATANA') && g.names.includes('M79'), 'goals cover scrap weapons, requirement weapons and locked cosmetics', { n: g.n, names: g.names.slice(0, 12) });
  check(!g.premium && !g.met, 'premium items and met requirements are left out');
  check(g.top[0][0] === 'MP7' && g.top[0][1] === 300 && g.top[0][2] === 800, 'a fresh player\'s closest goal is the MP7 at 300/800 scrap', g.top);
  check(g.p.level.cur === 1 && g.p.level.need === 3 && g.p.level.pct === 0 && g.p.wave.need === 15 && g.p.boss.need === 10 && g.p.boss.unit === 'WAVE' && g.p.heads.need === 250, 'progress maps requirements to counters (bosses count to their first wave)', g.p);
  check(g.p.league && g.p.league.cur === 'UNRANKED' && g.p.league.need === 'DIAMOND' && g.p.prestige.need === 1 && g.p.event === null && g.p.season === null, 'league shows names, event and season requirements are skipped', g.p);
  const c0 = await chip(page);
  check(!c0.hidden && /NEXT UP/.test(c0.text) && /MP7 · 300\/800/.test(c0.text), 'the menu chip names the closest goal', c0);

  await page.evaluate(() => { const { api } = window.__game; api.profile.heads = 240; api.profile.kills = 2000; api.showScreen(api.ui.menu); });
  const c1 = await chip(page);
  check(/KATANA · 240\/250 HEADSHOTS/.test(c1.text), 'the chip follows the player\'s stats', c1);
  await page.click('#nu-chip');
  await page.waitForTimeout(200);
  const r1 = await rows(page);
  check(r1.length === 6 && /KATANA/.test(r1[0].text) && r1[0].pct === '96%' && /BLOOD MOON/.test(r1[1].text) && /2,000 \/ 2,500/.test(r1[1].text), 'the sheet lists the six closest goals with bars', r1.map(r => r.text.slice(0, 40)));
  await page.screenshot({ path: '/tmp/nextup-sheet.png' });
  await page.evaluate(() => document.querySelector('.nu-sheet .ghost').click());
  check(await page.evaluate(() => !document.querySelector('.nu-sheet')), 'BACK closes the sheet');

  await page.evaluate(() => { const { api } = window.__game; api.profile.scrap = 900; api.showScreen(api.ui.menu); });
  const c2 = await chip(page);
  check(c2.ready && /READY · MP7/.test(c2.text), 'an affordable weapon shows as READY', c2);
  await page.click('#nu-chip');
  await page.waitForTimeout(200);
  const r2 = await rows(page);
  check(r2[0].ready && /MP7/.test(r2[0].text) && /READY/.test(r2[0].text), 'the ready weapon tops the sheet', r2[0]);
  await page.evaluate(() => document.querySelector('.nu-row.ready').click());
  await page.waitForTimeout(300);
  const armory = await page.evaluate(() => ({ open: !document.querySelector('#armory').classList.contains('hidden'), sheet: !!document.querySelector('.nu-sheet') }));
  check(armory.open && !armory.sheet, 'tapping a weapon goal opens the Armory', armory);
  await page.evaluate(() => { document.querySelector('#armory-done').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const { api } = window.__game; api.profile.arsenal.owned.mp7 = true; api.bus.emit('purchase', { kind: 'scrap', item: 'weapon:mp7', cost: 800 }); });
  const c3 = await chip(page);
  check(!/MP7/.test(c3.text), 'a bought weapon leaves the list', c3);

  await page.click('#nu-chip');
  await page.waitForTimeout(200);
  await page.evaluate(() => [...document.querySelectorAll('.nu-row')].find(r => /KATANA/.test(r.textContent)).click());
  await page.waitForTimeout(300);
  const locker = await page.evaluate(() => !document.querySelector('#locker').classList.contains('hidden'));
  check(locker, 'tapping a cosmetic goal opens the Locker');
  await page.evaluate(() => document.querySelector('#locker-done').click());
  await page.waitForTimeout(200);

  await page.click('#nu-chip');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.nu-sheet .cta').click());
  await page.waitForTimeout(300);
  const playing = await page.evaluate(() => ({ mode: window.__game.api.state.mode, sheet: !!document.querySelector('.nu-sheet') }));
  check(playing.mode === 'playing' && !playing.sheet, 'DEPLOY from the sheet starts a run', playing);
  await page.evaluate(() => window.__game.gameOver());
  await page.waitForTimeout(1200);
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.click('#nu-chip');
  await page.waitForTimeout(200);
  const fits = await page.evaluate(() => { const r = document.querySelector('.nu-card').getBoundingClientRect(); return r.width <= innerWidth && r.height <= innerHeight && document.querySelectorAll('.nu-row').length === 6; });
  check(fits, 'the sheet fits a portrait phone');
  await page.screenshot({ path: '/tmp/nextup-portrait.png' });
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL NEXT UP CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
