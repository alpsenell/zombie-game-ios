import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const shots = process.env.SHOTS || '/tmp/checkpoint-shots';
mkdirSync(shots, { recursive: true });
const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

const LEGACY = { bestWave: 13, bestByDiff: { survivor: 13, veteran: 6 }, runs: 4, scrap: 300, xp: 0 };
const RUNS = [{ score: 900, wave: 3, kills: 20, diff: 'nightmare', date: 1, type: 'normal', seed: null }, { score: 5000, wave: 30, kills: 20, diff: 'nightmare', date: 1, type: 'coop', seed: 1 }];
async function open({ profile = LEGACY, runs = RUNS, width = 852, height = 393, settings = { difficulty: 'survivor' } } = {}) {
  const init = `
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      localStorage.setItem('deadzone.runs', ${JSON.stringify(JSON.stringify(runs))});
      localStorage.setItem('deadzone.settings', ${JSON.stringify(JSON.stringify(settings))});
    }`;
  const { page, errors } = await openGame(browser, url, { width, height, init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.pg-modal .ghost')?.click());
  return page;
}
const tick = (page, secs) => page.evaluate(s => { const g = window.__game; for (let i = 0; i < s * 30; i++) g.update(1 / 30); }, secs);
const pickAll = page => page.evaluate(() => {
  const g = window.__game, { api } = g;
  let n = 0;
  while (api.state.mode === 'perk' && n < 20) { document.querySelector('#perk-list .perk').click(); n++; }
  return n;
});
const selector = page => page.evaluate(() => {
  const b = document.querySelector('#cp-start');
  return { visible: !!b && b.offsetParent !== null && getComputedStyle(b).display !== 'none', value: b?.querySelector('b').textContent, options: window.__game.api.checkpoint.options() };
});

{
  const page = await open();
  const cp = await page.evaluate(() => window.__game.api.profile.checkpoint.cleared);
  check(cp.survivor === 12 && cp.veteran === 5 && cp.nightmare === 2 && !cp.recruit, 'migration: best wave reached − 1 per difficulty, coop runs ignored', cp);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('deadzone.profile')).checkpoint?.cleared);
  check(persisted?.survivor === 12, 'migrated checkpoints are saved', persisted);

  const per = {};
  for (const d of ['recruit', 'survivor', 'veteran', 'nightmare']) {
    await page.click(`#diff button[data-diff=${d}]`);
    per[d] = await selector(page);
  }
  check(JSON.stringify(per.recruit.options) === '[1,5,10,12]' && JSON.stringify(per.survivor.options) === '[1,5,10,12]', 'recruit/survivor: 1,5,10,12 (higher difficulties count)', per);
  check(JSON.stringify(per.veteran.options) === '[1,5]' && JSON.stringify(per.nightmare.options) === '[1,2]', 'veteran 1,5 · nightmare 1,2', per);
  check(Object.values(per).every(s => s.visible && s.value === '1'), 'selector visible, defaults to wave 1', per);

  await page.click('#diff button[data-diff=survivor]');
  await page.click('#cp-start .cp-inc');
  await page.click('#cp-start .cp-inc');
  check((await selector(page)).value === '10', 'stepping picks wave 10');
  await page.click('#cp-start .cp-inc');
  const top = await page.evaluate(() => ({ v: document.querySelector('#cp-start b').textContent, inc: document.querySelector('#cp-start .cp-inc').disabled }));
  check(top.v === '12' && top.inc, 'stepper stops at the highest cleared wave', top);
  await page.click('#cp-start .cp-dec');
  await page.click('#diff button[data-diff=veteran]');
  check((await selector(page)).value === '1', 'pick is remembered per difficulty (veteran still 1)');
  await page.click('#diff button[data-diff=survivor]');
  check((await selector(page)).value === '10', 'survivor pick restored to 10');

  for (const [name, w, h] of [['landscape-852x393', 852, 393], ['landscape-667x375', 667, 375], ['portrait-393x852', 393, 852]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(shots, 'menu-' + name + '.png') });
    const lay = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, s }; };
      const boxes = ['#start', '#cp-start', '#diff', '#diff-desc', '#menu-modes', '#menu-dock', '.menu-top', '#menu .records'].map(r).filter(Boolean);
      const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) overlaps.push(boxes[i].s + ' × ' + boxes[j].s);
      const cp = r('#cp-start'), go = r('#start');
      const inView = boxes.every(b => b.l >= 0 && b.r <= innerWidth + .5 && b.t >= 0 && b.b <= innerHeight + .5);
      return { overlaps, inView, sameRow: cp && go && Math.abs((cp.t + cp.b) / 2 - (go.t + go.b) / 2) < 4, scroll: document.documentElement.scrollWidth > innerWidth, menuScroll: document.querySelector('#menu').scrollHeight > document.querySelector('#menu').clientHeight + 1 };
    });
    check(!lay.overlaps.length && lay.inView && lay.sameRow && !lay.scroll && !lay.menuScroll, 'menu layout ' + name + ': no overlaps, fits, stepper beside DEPLOY', lay);
  }
  await page.setViewportSize({ width: 852, height: 393 });

  await page.click('#cm-daily');
  await page.waitForTimeout(150);
  check(!(await selector(page)).visible, 'selector hidden on the DAILY sheet');
  await page.click('#cm-go');
  await page.waitForTimeout(100);
  await tick(page, 1.2);
  const daily = await page.evaluate(() => ({ type: window.__game.api.state.runType, start: window.__game.api.state.startWave, wave: window.__game.api.state.wave }));
  check(daily.type === 'daily' && daily.start === 1 && daily.wave === 1, 'DAILY ignores the checkpoint pick (wave 1)', daily);
  const forced = await page.evaluate(() => {
    const { api } = window.__game, out = {};
    for (const type of ['ranked', 'coop', 'daily']) { api.startGame({ type, startWave: 10, difficulty: 'survivor' }); window.__game.update(1); out[type] = [api.state.startWave, api.state.wave]; }
    api.toMenu();
    return out;
  });
  check(Object.values(forced).every(([s, w]) => s === 1 && w === 1), 'ranked/coop/daily always start at wave 1 even when asked for 10', forced);
  await page.waitForTimeout(150);
  await page.click('#cm-ranked');
  await page.waitForTimeout(150);
  check(!(await selector(page)).visible, 'selector hidden on the RANKED sheet');
  await page.click('#cm-back');
  const coopBtn = await page.$('#menu-modes button:has-text("CO-OP")');
  if (coopBtn) { await coopBtn.click(); await page.waitForTimeout(150); check(!(await selector(page)).visible, 'selector hidden on the CO-OP screen'); await page.evaluate(() => window.__game.api.toMenu()); }
  await page.waitForTimeout(150);

  const events = await page.evaluate(() => { const { api } = window.__game; window.__ev = []; for (const e of ['run:start', 'wave:start', 'perk', 'wave:clear']) api.bus.on(e, d => window.__ev.push([e, JSON.parse(JSON.stringify({ ...d, opts: undefined, difficulty: undefined }))])); return true; });
  await page.click('#start');
  await tick(page, 1);
  const kitScreen = await page.evaluate(() => ({ mode: window.__game.api.state.mode, title: document.querySelector('#perk-title').textContent, sub: document.querySelector('#perk-sub').textContent, nades: window.__game.api.player.nades, max: window.__game.api.stats.nadeMax }));
  check(kitScreen.mode === 'perk' && kitScreen.title === 'STARTING KIT' && /1 OF 5/.test(kitScreen.sub) && kitScreen.nades === kitScreen.max, 'wave-10 start opens the starting kit (5 picks, full grenades)', kitScreen);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(shots, 'starting-kit.png') });
  const picks = await pickAll(page);
  await tick(page, 2);
  const s10 = await page.evaluate(() => { const { api } = window.__game; return { wave: api.state.wave, start: api.state.startWave, score: api.state.score, perks: api.state.perks.length, boss: api.state.queue.some(q => api.ZT[q.kind]?.boss), mode: api.state.mode, hud: document.querySelector('#wave-num').textContent }; });
  check(picks === 5 && s10.perks === 5, '5 kit perks applied', { picks, s10 });
  check(s10.wave === 10 && s10.start === 10 && s10.score === 0 && s10.mode === 'playing' && s10.hud === 'WAVE 10', 'wave counter 10, score 0', s10);
  check(s10.boss, 'wave 10 is a boss wave with its boss queued', s10);
  const ev = await page.evaluate(() => window.__ev);
  const ws = ev.filter(e => e[0] === 'wave:start');
  check(ev.find(e => e[0] === 'run:start')?.[1].startWave === 10 && ws.length === 1 && ws[0][1].wave === 10 && ws[0][1].checkpoint === true, 'run:start carries startWave, first wave:start flagged checkpoint', ev.map(e => e[0]));
  check(ev.filter(e => e[0] === 'perk').every(e => e[1].kit === true), 'kit perk events are flagged kit');

  const cleared = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    for (const z of api.zombies) z.userData.dead = true;
    api.state.queue.length = 0;
    api.netHooks.waveCleared();
    for (let i = 0; i < 90 && api.state.mode !== 'perk'; i++) g.update(1 / 30);
    document.querySelector('#perk-list .perk').click();
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    api.state.kills = 60; api.state.heads = 20; api.state.clock = 240;
    return { wave: api.state.wave, score: api.state.score, cp: api.profile.checkpoint.cleared.survivor, stored: JSON.parse(localStorage.getItem('deadzone.profile')).checkpoint.cleared.survivor };
  });
  check(cleared.cp === 12 && cleared.stored === 12, 'clearing wave 10 keeps the higher checkpoint (12)', cleared);
  check(cleared.wave === 11 && cleared.score === 2500, 'wave 11 next, score = wave-10 bonus only', cleared);

  const summary = await page.evaluate(() => window.__game.api.runSummary());
  check(summary.startWave === 10 && summary.wave === 11, 'runSummary has startWave', summary);
  check(await page.evaluate(s => window.__game.api.competitive.plausible(s), summary) === null, 'plausible() accepts the legit wave-10 checkpoint run');
  const pl = await page.evaluate(base => {
    const f = r => window.__game.api.competitive.plausible({ ...base, ...r });
    return {
      legitDeep: f({ startWave: 10, wave: 14, kills: 400, heads: 100, time: 900, score: 90000, bosses: ['tank'] }),
      manyKills: f({ startWave: 10, wave: 11, kills: 900, heads: 10, time: 900, score: 5000 }),
      fast: f({ startWave: 10, wave: 30, kills: 100, heads: 10, time: 20, score: 5000 }),
      hugeScore: f({ startWave: 10, wave: 11, kills: 20, heads: 10, time: 200, score: 5000000 }),
      bonusFarm: f({ startWave: 40, wave: 41, kills: 0, heads: 0, time: 60, score: 125 * 41 * 42 }),
      startPastWave: f({ startWave: 15, wave: 12 }),
      fracStart: f({ startWave: 2.5 }),
      ranked: f({ type: 'ranked', startWave: 10, slots: [0, 1] }),
      fromOne: f({ startWave: 1, wave: 11, time: 10 }),
    };
  }, summary);
  check(pl.legitDeep === null, 'plausible() accepts a deeper legit checkpoint run', pl);
  check(pl.manyKills && pl.fast && pl.hugeScore && pl.bonusFarm && pl.startPastWave && pl.fracStart && pl.ranked && pl.fromOne, 'plausible() rejects absurd / inconsistent checkpoint runs', pl);

  const before = await page.evaluate(() => ({ xp: window.__game.api.profile.xp }));
  await page.evaluate(() => window.__game.gameOver());
  await page.waitForTimeout(1100);
  const over = await page.evaluate(() => ({ sub: document.querySelector('#over-sub').textContent, xp: window.__game.api.profile.xp, runs: JSON.parse(localStorage.getItem('deadzone.runs')) }));
  check(/STARTED AT WAVE 10/.test(over.sub), 'game-over shows STARTED AT WAVE 10', over.sub);
  check(over.xp - before.xp === Math.round(2500 / 10 + 2 * 50), 'XP counts only the 2 waves played', over.xp - before.xp);
  check(over.runs.some(r => r.start === 10 && r.wave === 11), 'saved local run records its start wave');
  await page.screenshot({ path: join(shots, 'game-over-852x393.png') });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shots, 'game-over-393x852.png') });
  await page.setViewportSize({ width: 852, height: 393 });

  await page.click('#again');
  await tick(page, 1);
  const again = await page.evaluate(() => ({ start: window.__game.api.state.startWave, mode: window.__game.api.state.mode }));
  check(again.start === 10 && again.mode === 'perk', 'REDEPLOY replays the wave-10 start', again);
  await pickAll(page);
  await page.evaluate(() => window.__game.api.toMenu());

  const fresh = await page.evaluate(() => {
    const { api } = window.__game;
    api.startGame({});
    const g = window.__game;
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    const w1 = api.state.wave;
    return { w1, start: api.state.startWave };
  });
  check(fresh.w1 === 1 && fresh.start === 1, 'plain startGame() still starts at wave 1', fresh);
  await page.evaluate(() => window.__game.api.toMenu());
  await page.close();
}

{
  const page = await open({ profile: null, runs: [] });
  const s = await selector(page);
  check(!s.visible && JSON.stringify(s.options) === '[1]', 'new player: no checkpoint, selector hidden', s);
  const rec = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.startGame({});
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    for (let w = 0; w < 3; w++) {
      for (const z of api.zombies) z.userData.dead = true;
      api.state.queue.length = 0;
      api.netHooks.waveCleared();
      for (let i = 0; i < 90 && api.state.mode !== 'perk'; i++) g.update(1 / 30);
      document.querySelector('#perk-list .perk').click();
      for (let i = 0; i < 60; i++) g.update(1 / 30);
    }
    const out = { wave: api.state.wave, cleared: { ...api.profile.checkpoint.cleared } };
    api.toMenu();
    return out;
  });
  check(rec.wave === 4 && rec.cleared.survivor === 3, 'clearing waves records the checkpoint immediately (even when quitting)', rec);
  await page.waitForTimeout(150);
  const after = await selector(page);
  check(after.visible && JSON.stringify(after.options) === '[1,3]', 'selector appears with the new checkpoint', after);
  await page.close();
}

{
  const profile = { ...LEGACY, checkpoint: { cleared: { survivor: 50 }, pick: { survivor: 50 } }, progression: { stats: { bestWave: 12 } } };
  const page = await open({ profile });
  const r = await page.evaluate(() => {
    const g = window.__game, { api } = g, P = api.profile.progression;
    P.daily = { key: P.daily.key, list: [{ id: 'x-perks', t: 'perks', n: 3, p: 0 }, { id: 'x-wave', t: 'wave', n: 10, p: 0, arg: 'survivor' }] };
    document.querySelector('#start').click();
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    let picks = 0;
    while (api.state.mode === 'perk' && picks < 20) { document.querySelector('#perk-list .perk').click(); picks++; }
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    const atStart = { wave: api.state.wave, best: P.stats.bestWave, ach: !!P.ach.wave_50 || !!P.ach.wave_20 || !!P.ach.wave_30, missions: P.daily.list.map(m => m.p) };
    g.gameOver();
    const dead = { best: P.stats.bestWave, ach50: !!P.ach.wave_50, ach20: !!P.ach.wave_20 };
    return { picks, atStart, dead };
  });
  check(r.picks === 10, 'wave-50 start gives the capped 10 kit picks', r.picks);
  check(r.atStart.wave === 50 && r.atStart.best === 12 && !r.atStart.ach, 'starting at wave 50 does not count as reaching wave 50', r.atStart);
  check(r.atStart.missions.every(p => p === 0), 'kit perks and the checkpoint wave do not advance missions', r.atStart.missions);
  check(r.dead.best === 12 && !r.dead.ach50 && !r.dead.ach20, 'dying on the start wave awards no wave achievements', r.dead);
  await page.waitForTimeout(1000);
  const r2 = await page.evaluate(() => {
    const g = window.__game, { api } = g, P = api.profile.progression;
    api.startGame({ startWave: 49 });
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    while (api.state.mode === 'perk') document.querySelector('#perk-list .perk').click();
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    for (const z of api.zombies) z.userData.dead = true;
    api.state.queue.length = 0;
    api.netHooks.waveCleared();
    for (let i = 0; i < 90 && api.state.mode !== 'perk'; i++) g.update(1 / 30);
    document.querySelector('#perk-list .perk').click();
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    const out = { wave: api.state.wave, best: P.stats.bestWave, ach50: !!P.ach.wave_50 };
    api.toMenu();
    return out;
  });
  check(r2.wave === 50 && r2.best === 50 && r2.ach50, 'clearing wave 49 in-run and reaching 50 does count', r2);
  await page.close();
}

await browser.close();
server.close();
const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL CHECKPOINT CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
