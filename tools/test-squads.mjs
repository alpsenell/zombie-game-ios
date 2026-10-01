import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const initPage = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  localStorage.setItem('deadzone.profile', JSON.stringify({ runs: 5, bestWave: 12, scrap: 1000, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } }));
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafOn = false;
  window.requestAnimationFrame = fn => raf(function tick(t) { if (window.__rafOn) fn(t); else raf(tick); });
};
const initGameCenter = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  localStorage.setItem('deadzone.profile', JSON.stringify({ runs: 5, bestWave: 12, scrap: 1000, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } }));
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafOn = false;
  window.requestAnimationFrame = fn => raf(function tick(t) { if (window.__rafOn) fn(t); else raf(tick); });
  const others = n => Array.from({ length: n }, (_, i) => ({ name: 'SQUAD' + (i + 1), score: 1000 - i * 100, context: 0 }));
  const boards = { 'deadzone.daily.squad': { others: others(5), me: null } };
  for (const id of ['deadzone.highscore', 'deadzone.bestwave', 'deadzone.daily', 'deadzone.daily.rookie', 'deadzone.weekly', 'deadzone.weekly.veteran', 'deadzone.weekly.survivor', 'deadzone.extract', 'deadzone.sprint20', 'deadzone.event', 'deadzone.blitz']) boards[id] = { others: [], me: null };
  const list = b => [...b.others, ...(b.me ? [{ ...b.me, isLocal: true }] : [])].sort((a, c) => c.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
  window.__calls = [];
  window.Capacitor = {
    PluginHeaders: [{ name: 'GameCenter' }],
    async nativePromise(plugin, method, opts = {}) {
      window.__calls.push({ plugin, method, opts });
      if (method === 'signIn') return { authenticated: true, displayName: 'Alpha' };
      const b = boards[opts.leaderboardId];
      if (!b) throw new Error('Leaderboard not found: ' + opts.leaderboardId);
      if (method === 'submitScore') { if (!b.me || opts.score > b.me.score) b.me = { name: 'ALPHA', score: opts.score, context: opts.context }; return {}; }
      if (method === 'loadScores') { const all = list(b), me = all.find(e => e.isLocal); return { total: all.length, start: 1, entries: all.slice(0, 10), player: me || null }; }
      return {};
    },
  };
};

const step = (page, secs, dt = 1 / 30) => page.evaluate(([secs, dt]) => { const g = window.__game; for (let i = 0, n = Math.round(secs / dt); i < n; i++) { if (g.api.state.mode !== 'playing') break; g.update(dt); } }, [secs, dt]);
async function lockstep(pages, secs, slice = .1) { for (let t = 0; t < secs - 1e-6; t += slice) { for (const p of pages) await step(p, slice); await sleep(4); } }
async function waitReal(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } }
const button = (page, name) => page.getByRole('button', { name, exact: true }).click();

const { server, url } = await serve();
const browser = await launch(['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']);
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
async function open(init, name) {
  const { page, errors: e } = await openGame(ctx, url, { init });
  errors.push(e);
  await page.waitForFunction(() => window.__game.api.coop && window.__game.api.squads);
  await page.evaluate(name => { const { api } = window.__game; api.settings.sound = false; api.settings.aimAssist = false; api.profile.coop = { name }; api.coop.config.perkTimeout = 2; api.levels.state.paid = 99; document.querySelector('.pg-modal .ghost, .pg-modal .cta')?.click(); }, name);
  return page;
}

const A = await open(initGameCenter, 'ALPHA');
await A.waitForFunction(() => window.__game.api.gameCenter.player);
const B = await open(initPage, 'BRAVO');

const pure = await A.evaluate(async () => {
  const Sq = await import('./features/squads.js');
  const p = { squads: {}, squadBest: 0 }, mates = [{ id: 'G:9', name: 'zed' }, { id: 'L0abc', name: 'Bravo' }];
  const keys = [Sq.squadKey(mates), Sq.squadKey([...mates].reverse())];
  const tiers = [];
  for (let i = 0; i < 10; i++) tiers.push(Sq.trackSquad(p, mates, { wave: i }).tier);
  return { keys, tiers, best: p.squadBest, squad: p.squads[keys[0]], next: [Sq.nextBond(0), Sq.nextBond(3), Sq.nextBond(25)] };
});
check(pure.keys[0] === 'G:9|N:BRAVO' && pure.keys[0] === pure.keys[1] && pure.tiers.join() === '0,0,1,0,0,0,0,0,0,2' && pure.best === 10 && pure.squad.runs === 10 && pure.squad.best === 9 && pure.next.join() === '3,10,', 'squad keys are stable and bonds land at 3, 10 and 25 runs', pure);

await A.click('#coop-open');
await button(A, 'HOST LOCAL');
const code = await A.textContent('.coop-room-head b');
await B.click('#coop-open');
await B.fill('.coop-code-in', code.toLowerCase());
await button(B, 'JOIN LOCAL');
check(await waitReal(A, () => window.__game.api.coop.session.players.size === 2, null, 5000) && await waitReal(B, () => window.__game.api.coop.session.players.size === 2, null, 5000), 'two players share a local room');
const dailyBtn = { a: await A.evaluate(() => !document.querySelector('.coop-daily').classList.contains('hidden')), b: await B.evaluate(() => document.querySelector('.coop-daily').classList.contains('hidden')) };
check(dailyBtn.a && dailyBtn.b, 'only the host sees the SQUAD DAILY toggle', dailyBtn);
await A.click('.coop-daily');
check(await waitReal(B, () => window.__game.api.coop.session.daily === true, null, 4000), 'the squad-daily flag reaches the client');
const heads = { a: await A.textContent('.coop-room-head'), b: await B.textContent('.coop-room-head'), btn: await A.textContent('.coop-daily') };
check(/SQUAD DAILY · (VETERAN|SURVIVOR) · 10 WAVES/.test(heads.a) && /SQUAD DAILY/.test(heads.b) && /ON/.test(heads.btn), 'the lobby shows the Squad Daily format on both sides', heads);
await A.screenshot({ path: '/tmp/squad-lobby.png' });
await button(B, 'READY');
await waitReal(A, () => [...window.__game.api.coop.session.players.values()].every(p => p.me || p.ready), null, 4000);
await button(A, 'START');
const started = p => p.waitForFunction(() => window.__game.api.state.mode === 'playing' && window.__game.api.state.runType === 'coop', null, { timeout: 5000, polling: 100 }).then(() => true, () => false);
check(await started(A) && await started(B), 'the host starts the Squad Daily on both pages');
const runOf = page => page.evaluate(() => { const { api } = window.__game, d = api.competitive.dailyChallenge(), s = api.state; return { daily: s.runOpts.squadDaily, date: d.date, maxWave: s.maxWave, seed: s.seed, dseed: d.seed, diff: s.runDifficulty, ddiff: d.difficulty, slots: api.player.slots.join(), dslots: d.slots.join(), map: api.currentMap, dmap: d.map?.id, squad: s.runOpts.squad }; });
const ra = await runOf(A), rb = await runOf(B);
check([ra, rb].every(r => r.daily === r.date && r.maxWave === 10 && r.seed === r.dseed && r.diff === r.ddiff && r.slots === r.dslots && (!r.dmap || r.map === r.dmap) && r.squad === 2), 'both players run the Daily seed, loadout, difficulty and 10-wave cap', { ra, rb });

const missions = await A.evaluate(() => {
  const { api } = window.__game, pg = api.progression, s = pg.state;
  const mk = (t, n, i) => ({ id: 'weekly:test:' + i, t, n, arg: null, p: 0, done: false, claimed: false, scrap: 100, xp: 100 });
  s.weekly.list = [mk('coopwave', 8, 0), mk('revives', 1, 1), mk('coopruns', 1, 2)];
  api.bus.emit('wave:clear', { wave: 8, bonus: 0, hp: 50 });
  api.bus.emit('coop:revive', { me: false, byMe: true, name: 'BRAVO', by: 'ALPHA' });
  api.coop.session.me.kills = 5;
  api.state.score = 1500;
  return { wave: s.weekly.list[0].done, revive: s.weekly.list[1].done, runs: s.weekly.list[2].done, texts: s.weekly.list.map(m => pg.data.missionText(m, {})) };
});
check(missions.wave && missions.revive && !missions.runs && missions.texts.join('|') === 'CLEAR WAVE 8 IN CO-OP|REVIVE 1 TEAMMATES|PLAY 1 CO-OP RUNS', 'co-op weekly missions track squad waves and revives', missions);

for (const p of [A, B]) await p.evaluate(() => { window.__game.api.coop.config.bleed = .5; window.__game.api.stats.armor = 1; });
await A.evaluate(() => window.__game.api.hurtPlayer(1e7));
await B.evaluate(() => window.__game.api.hurtPlayer(1e7));
await lockstep([A, B], 3);
const over = p => p.waitForFunction(() => window.__game.api.state.mode === 'dead' && !document.querySelector('#over').classList.contains('hidden'), null, { timeout: 8000, polling: 100 }).then(() => true, e => String(e).slice(0, 160));
const diag = p => p.evaluate(() => { const { api } = window.__game, s = api.coop.session; return { mode: api.state.mode, hidden: document.querySelector('#over').classList.contains('hidden'), phase: s?.phase, me: s?.me && { st: s.me.st, bleed: s.me.bleed }, screen: api.activeScreen?.id }; });
const overA = await over(A), overB = await over(B);
check(overA === true && overB === true, 'the squad wipes and both pages reach the game-over screen', { overA, overB, a: await diag(A), b: await diag(B) });
await sleep(600);
const endA = await A.evaluate(() => {
  const { api } = window.__game, squads = api.profile.squads, key = Object.keys(squads)[0];
  return { key, squad: squads[key], best: api.profile.squadBest, banner: document.querySelector('#sq-banner').textContent, bannerHidden: document.querySelector('#sq-banner').classList.contains('hidden'), h2: document.querySelector('#over h2').textContent, rank: document.querySelector('#over-rank').textContent, quickHidden: document.querySelector('#over-quick').classList.contains('hidden'), submits: window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId), runs: api.progression.state.weekly.list[2].done, card: api.squads.bannerFor({ type: 'coop' })?.text };
});
check(endA.squad?.runs === 1 && endA.squad.names.join() === 'BRAVO' && endA.best === 1 && !endA.bannerHidden && /SQUAD · BRAVO · 1 RUN TOGETHER · NEXT BOND AT 3/.test(endA.banner) && endA.quickHidden && endA.runs, 'the first run with a squad starts its bond and the banner shows it', endA);
check(/SQUAD WIPED · SQUAD DAILY/.test(endA.h2) && endA.submits.join() === 'deadzone.daily.squad' && /SQUAD DAILY RANK #\d/.test(endA.rank) && /NEXT BOND AT 3/.test(endA.card), 'the Squad Daily score goes to its own board and the run card carries the squad', { h2: endA.h2, rank: endA.rank, submits: endA.submits });
const endB = await B.evaluate(() => ({ squad: Object.values(window.__game.api.profile.squads)[0], rank: document.querySelector('#over-rank').textContent }));
check(endB.squad?.runs === 1 && endB.squad.names.join() === 'ALPHA' && endB.rank === '', 'the client records the bond too and submits nothing without Game Center', endB);
await A.screenshot({ path: '/tmp/squad-over.png' });

const bonds = await A.evaluate(() => {
  const { api } = window.__game, events = [];
  api.bus.on('squad:bond', e => events.push(e));
  const r = [];
  for (let i = 0; i < 9; i++) r.push(api.squads.track({ type: 'coop', wave: 6 }));
  const idx = api.SLOTS.find(s => s.id === 'title').items.findIndex(it => it.req === 'squad:3');
  return { runs: r[r.length - 1].squad.runs, best: api.squads.best(), met: [api.reqMet('squad:3'), api.reqMet('squad:10'), api.reqMet('squad:25')], fresh: api.profile.fresh.includes('title:' + idx), events: events.map(e => e.tier + ':' + e.title), text: api.reqText('squad:25') };
});
check(bonds.runs === 10 && bonds.best === 10 && bonds.met.join() === 'true,true,false' && bonds.fresh && bonds.events.join() === '1:SQUADMATE,2:BROTHERS IN ARMS' && /25 CO-OP RUNS WITH THE SAME SQUAD/.test(bonds.text), 'bonds at 3 and 10 runs unlock the squad titles', bonds);

const quick = await B.evaluate(async () => {
  const g = window.__game, { api } = g;
  api.coop.leave();
  api.toMenu();
  api.startGame({ map: 'street' });
  api.state.score = 100;
  g.gameOver();
  await new Promise(r => setTimeout(r, 200));
  const shown = !document.querySelector('#over-quick').classList.contains('hidden');
  document.querySelector('#over-quick').click();
  await new Promise(r => setTimeout(r, 200));
  return { shown, lobby: !document.querySelector('#coop').classList.contains('hidden'), status: document.querySelector('.coop-status').textContent };
});
check(quick.shown && quick.lobby && /QUICK MATCH NEEDS GAME CENTER/.test(quick.status), 'a solo game over offers FIND A SQUAD, which opens the lobby', quick);

const tab = await A.evaluate(async () => { const { api } = window.__game; api.toMenu(); api.competitive.openBoard('squad'); await new Promise(r => setTimeout(r, 300)); return { tab: document.querySelector('#cm-boards button.on')?.dataset.board, note: document.querySelector('.cm-board-note').textContent, id: api.boardView.id }; });
check(tab.tab === 'squad' && /SQUAD DAILY/.test(tab.note) && tab.id === 'deadzone.daily.squad', 'the RANKS screen has a SQUAD tab', tab);

await ctx.close().catch(() => {});
await browser.close();
server.close();
const errs = errors.flat().filter(e => !/net::ERR|favicon|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
console.log(failures.length ? failures.length + ' FAILED' : 'ALL SQUAD CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
