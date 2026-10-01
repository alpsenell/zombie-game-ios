import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

async function open({ profile = null } = {}) {
  const init = `
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      localStorage.setItem('deadzone.tutorial', 'true');
    }`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const modalText = page => page.evaluate(() => document.querySelector('.lv-card')?.textContent || '');
const closeModal = page => page.evaluate(() => document.querySelector('.lv-card .cta')?.click());

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const Lv = await import('./features/levels.js');
    const { api } = window.__game;
    return { scrap: [1, 2, 10, 15, 20, 40].map(Lv.levelScrap), crate: [1, 4, 5, 10, 11].map(Lv.isCrateLevel), pool: Lv.cratePool(api.profile).length, poolSample: Lv.cratePool(api.profile).slice(0, 3), paid: api.levels.state.paid, rewards5: Lv.rewardsFor(5, api.profile, () => 0) };
  });
  check(pure.scrap.join() === '100,200,1000,1500,1500,1500' && pure.crate.join() === 'false,false,true,true,false', 'scrap per level caps at 1,500 and crates come every 5 levels', pure);
  check(pure.pool > 40 && pure.poolSample.every(x => x.cost > 0 && x.name) && pure.rewards5.length === 2 && pure.rewards5[1].kind === 'item', 'the crate pool holds every unowned scrap cosmetic', { pool: pure.pool, sample: pure.poolSample, rewards5: pure.rewards5 });
  check(pure.paid === 1, 'a fresh profile starts paid up to level 1', pure.paid);

  const lv2 = await page.evaluate(() => {
    const { api } = window.__game, scrap = api.profile.scrap, got = [];
    api.bus.on('level:reward', e => got.push(e));
    api.grantXP(1000);
    const before = api.profile.scrap - scrap;
    api.showScreen(api.ui.menu);
    return { before, after: api.profile.scrap - scrap, paid: api.levels.state.paid, level: api.levelInfo().level, events: got.length, modal: document.querySelector('.lv-card')?.textContent || '' };
  });
  check(lv2.before === 0 && lv2.after === 200 && lv2.paid === 2 && lv2.level === 2 && lv2.events === 1, 'reaching level 2 pays 200 scrap once', lv2);
  check(/LEVEL UP/.test(lv2.modal) && /LEVEL 2/.test(lv2.modal) && /\+200 🔩/.test(lv2.modal), 'a level-up outside a run shows the reward card', lv2.modal);
  await closeModal(page);
  await page.waitForTimeout(400);

  const lv5 = await page.evaluate(() => {
    const { api } = window.__game, scrap = api.profile.scrap, owned = Object.keys(api.profile.owned).length, fresh = api.profile.fresh.length;
    api.profile.xp = 14100;
    api.showScreen(api.ui.menu);
    const key = Object.keys(api.profile.owned).find(k => !['hair:3'].includes(k)) || '';
    return { level: api.levelInfo().level, scrap: api.profile.scrap - scrap, owned: Object.keys(api.profile.owned).length - owned, fresh: api.profile.fresh.length - fresh, paid: api.levels.state.paid, modal: document.querySelector('.lv-card')?.textContent || '', key, badge: document.querySelector('#locker-badge').textContent };
  });
  check(lv5.level === 5 && lv5.scrap === 300 + 400 + 500 && lv5.paid === 5, 'skipping several levels pays each one', lv5);
  check(lv5.owned === 1 && lv5.fresh === 1 && /LEVEL CRATE:/.test(lv5.modal) && /LOCKER/.test(lv5.modal) && lv5.badge === '1', 'level 5 opens a crate with a cosmetic that shows as NEW in the locker', lv5);
  await closeModal(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => { const { api } = window.__game; api.showScreen(api.ui.menu); });
  check((await modalText(page)) === '', 'no card when nothing is owed');

  const fallback = await page.evaluate(() => {
    const { api } = window.__game;
    for (const x of api.levels.cratePool()) api.profile.owned[x.slot + ':' + x.i] = true;
    const scrap = api.profile.scrap;
    api.profile.xp = 77100;
    api.showScreen(api.ui.menu);
    return { level: api.levelInfo().level, scrap: api.profile.scrap - scrap, expected: 600 + 700 + 800 + 900 + 1000 + 1000, modal: document.querySelector('.lv-card')?.textContent || '' };
  });
  check(fallback.level === 10 && fallback.scrap === fallback.expected && /LEVEL CRATE: 1,000/.test(fallback.modal), 'an empty crate pool pays 1,000 scrap instead', fallback);
  await closeModal(page);
  await page.close();
}

{
  const page = await open({ profile: { xp: 119000, scrap: 500, runs: 40, kills: 1000, owned: {}, loadout: {}, arsenal: { owned: {} } } });
  const r = await page.evaluate(() => { const { api } = window.__game; api.showScreen(api.ui.menu); return { level: api.levelInfo().level, paid: api.levels.state.paid, scrap: api.profile.scrap, modal: !!document.querySelector('.lv-card') }; });
  check(r.level === 11 && r.paid === 11 && r.scrap === 500 && !r.modal, 'an existing profile is paid up to its current level with no windfall', r);
  await page.close();
}

{
  const page = await open();
  await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.startGame({ map: 'street' });
    Object.assign(api.state, { score: 9000, wave: 4, kills: 50, heads: 10, shots: 100, hits: 60 });
    g.gameOver();
  });
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  const r = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#over-rewards span')].map(s => s.textContent), level: window.__game.api.levelInfo().level, paid: window.__game.api.levels.state.paid, scrap: window.__game.api.profile.scrap, modal: !!document.querySelector('.lv-card') }));
  check(r.level === 2 && r.paid === 2 && r.chips.some(c => /LEVEL UP · 2/.test(c)) && r.chips.some(c => /\+200 🔩 LEVEL 2/.test(c)) && !r.modal, 'a level-up at the end of a run adds a reward chip to the game-over screen', r);
  const xpChip = r.chips.find(c => /XP/.test(c)) || '', runScrap = +((r.chips.find(c => /SCRAP/.test(c)) || '').match(/\+([\d,]+)/)?.[1] || '0').replace(/,/g, '');
  check(r.scrap === 300 + runScrap + 200, 'run scrap and level scrap both land in the balance', { scrap: r.scrap, runScrap, xpChip });
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL LEVEL REWARD CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
