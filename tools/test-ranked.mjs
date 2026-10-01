import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ now = NOW, profile = null } = {}) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
    const others = n => Array.from({ length: n }, (_, i) => ({ name: 'PLAYER' + (i + 1), score: 200000 - i * 1000, context: 0 }));
    const boards = { 'deadzone.weekly': { others: others(100), me: null }, 'deadzone.weekly.veteran': { others: others(100), me: null }, 'deadzone.weekly.survivor': { others: others(100), me: null }, 'deadzone.highscore': { others: others(5), me: null }, 'deadzone.bestwave': { others: [], me: null }, 'deadzone.daily': { others: [], me: null }, 'deadzone.daily.rookie': { others: [], me: null }, 'deadzone.extract': { others: [], me: null } };
    const list = b => [...b.others, ...(b.me ? [{ ...b.me, isLocal: true }] : [])].sort((a, c) => c.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
    window.__calls = [];
    window.__boards = boards;
    window.Capacitor = {
      PluginHeaders: [{ name: 'GameCenter' }],
      async nativePromise(plugin, method, opts = {}) {
        window.__calls.push({ plugin, method, opts });
        if (method === 'signIn') return { authenticated: true, displayName: 'TESTER' };
        const b = boards[opts.leaderboardId];
        if (!b) throw new Error('Leaderboard not found: ' + opts.leaderboardId);
        if (method === 'submitScore') { if (!b.me || opts.score > b.me.score) b.me = { name: 'TESTER', score: opts.score, context: opts.context }; return {}; }
        if (method === 'loadScores') { const all = list(b), me = all.find(e => e.isLocal); const start = opts.start || 1; return { total: all.length, start, entries: all.slice(start - 1, start - 1 + (opts.count || 10)), player: me || null }; }
        return {};
      },
    };
  })();`;
}
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock(opts) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const submits = page => page.evaluate(() => window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId));
const endRanked = (page, score) => page.evaluate(async score => {
  const g = window.__game, { api } = g;
  window.__calls.length = 0;
  api.startGame(api.competitive.rankedOpts());
  const diff = api.state.runDifficulty;
  Object.assign(api.state, { score, wave: 12, kills: 120, clock: 400 });
  g.gameOver();
  await new Promise(r => setTimeout(r, 400));
  return { diff, rank: document.querySelector('#over-rank').textContent, extras: document.querySelector('.cm-over').textContent, league: api.profile.competitive.league, badge: document.querySelector('#cm-league')?.textContent };
}, score);
const weekOf = t => { const d = Math.floor(t / DAY); return new Date((d - (d + 3) % 7) * DAY).toISOString().slice(0, 10); };

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const C = await import('./features/competitive.js');
    const ids = (list) => list.map(x => x?.id);
    return {
      survivor: ids([C.leagueFor(10, 100, 'survivor'), C.leagueFor(25, 100, 'survivor'), C.leagueFor(26, 100, 'survivor'), C.leagueFor(50, 100, 'survivor'), C.leagueFor(51, 100, 'survivor')]),
      veteran: ids([C.leagueFor(5, 100, 'veteran'), C.leagueFor(11, 100, 'veteran'), C.leagueFor(50, 100, 'veteran'), C.leagueFor(75, 100, 'veteran'), C.leagueFor(76, 100, 'veteran')]),
      nightmare: ids([C.leagueFor(3, 100, 'nightmare'), C.leagueFor(2, 5000, 'nightmare'), C.leagueFor(150, 5000, 'nightmare'), C.leagueFor(60, 100, 'nightmare'), C.leagueFor(61, 100, 'nightmare')]),
      legacy: ids([C.leagueFor(2, 100, undefined), C.leagueFor(40, 100)]),
      brackets: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'].map(C.bracketOf),
      within: [C.withinLeague(30, 100, 'survivor', 'silver'), C.withinLeague(14, 100, 'survivor', 'gold'), C.withinLeague(60, 100, 'veteran', 'gold'), C.withinLeague(70, 100, 'nightmare', 'platinum')],
    };
  });
  check(pure.survivor.join() === 'gold,gold,silver,silver,bronze', 'survivor bracket: top 25% promote to Gold, top 50% Silver, rest Bronze', pure.survivor);
  check(pure.veteran.join() === 'diamond,platinum,platinum,gold,silver', 'veteran bracket: top 10% promote, bottom 25% relegate', pure.veteran);
  check(pure.nightmare.join() === 'legend,legend,diamond,diamond,platinum', 'nightmare bracket: Legend needs top 100 and top 3%, bottom 40% relegate', pure.nightmare);
  check(pure.legacy.join() === 'legend,silver' && pure.brackets.join() === 'survivor,survivor,veteran,veteran,nightmare,nightmare', 'legacy global percentiles still work and leagues map to brackets', pure);
  check(pure.within.join() === '5,14,10,10', 'rank within a league subtracts the players above its band', pure.within);

  const sheet0 = await page.evaluate(() => { const { api } = window.__game; api.settings.difficulty = 'nightmare'; api.competitive.openRanked(); return { sub: document.querySelector('#comp-sheet .cm-sub').textContent, grid: document.querySelector('#comp-sheet .cm-grid').textContent, rules: document.querySelector('#comp-sheet .cm-rules').textContent, badge: document.querySelector('#cm-league').textContent, opts: api.competitive.rankedOpts().difficulty }; });
  check(/SURVIVOR BRACKET · BRONZE & SILVER/.test(sheet0.sub) && /SURVIVOR · x1/.test(sheet0.grid) && /0 \/ 3 RUNS/.test(sheet0.grid) && /PLAY 3 RANKED RUNS/.test(sheet0.rules) && sheet0.opts === 'survivor', 'a new player is in the Survivor bracket with placements, whatever difficulty is selected', sheet0);
  await page.screenshot({ path: '/tmp/ranked-sheet.png' });
  await page.evaluate(() => window.__game.api.showScreen(window.__game.api.ui.menu));

  const r1 = await endRanked(page, 190500);
  check(r1.diff === 'survivor' && (await submits(page)).sort().join() === 'deadzone.bestwave,deadzone.highscore,deadzone.weekly.survivor', 'a ranked run plays the bracket difficulty and submits to the bracket board', { diff: r1.diff, submits: await submits(page) });
  check(r1.league?.id === 'gold' && r1.league.bracket === 'survivor' && /PLACEMENT 1\/3/.test(r1.extras) && /2 MORE RUNS/.test(r1.extras) && /PLACEMENT 1\/3/.test(r1.badge), 'the first run counts as placement 1 of 3 while the live league is computed', r1);
  await endRanked(page, 190500);
  const r3 = await endRanked(page, 190500);
  check(/#11 IN GOLD/.test(r3.extras) && /SURVIVOR BRACKET/.test(r3.extras) && /GOLD/.test(r3.badge) && !/PLACEMENT/.test(r3.badge), 'after three runs the league shows with the rank inside it', r3);
  await page.screenshot({ path: '/tmp/ranked-over.png' });

  const promoted = await page.evaluate(async weekOfNow => {
    const { api } = window.__game, c = api.profile.competitive;
    c.league.week = new Date(Date.parse(weekOfNow + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
    api.toMenu();
    await new Promise(r => setTimeout(r, 600));
    const card = document.querySelector('.cm-pay-card')?.textContent || '';
    document.querySelector('.cm-pay-card .cta')?.click();
    await new Promise(r => setTimeout(r, 400));
    api.competitive.openRanked();
    return { card, held: c.held?.id, bracket: api.competitive.bracket(), diff: api.competitive.rankedOpts().difficulty, sub: document.querySelector('#comp-sheet .cm-sub').textContent, board: api.competitive.boardId('weekly'), seasonBest: c.seasonBest, history: c.seasonHistory };
  }, weekOf(NOW));
  check(/GOLD LEAGUE/.test(promoted.card) && promoted.held === 'gold' && promoted.bracket === 'veteran' && promoted.diff === 'veteran' && /VETERAN BRACKET/.test(promoted.sub) && promoted.board === 'deadzone.weekly.veteran', 'settling a Gold week moves the player into the Veteran bracket', promoted);
  check(promoted.seasonBest?.id === 'gold' && promoted.seasonBest.season === 1 && promoted.history?.[1] === 'gold', 'the best league of the season is recorded', promoted);
  await page.close();
}

{
  const profile = { scrap: 100, xp: 0, runs: 5, loadout: {}, competitive: { seasonBest: { season: 1, id: 'platinum' }, held: { id: 'platinum', week: '2026-10-26' }, resets: {} } };
  const page = await open({ now: Date.UTC(2026, 10, 3, 12), profile });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({ card: document.querySelector('.cm-pay-card')?.textContent || '', scrap: window.__game.api.profile.scrap, paid: window.__game.api.profile.competitive.seasonPaid }));
  check(/SEASON 1 COMPLETE/.test(r.card) && /PLATINUM/.test(r.card) && /3,500/.test(r.card) && r.scrap === 3600 && r.paid === 1, 'a new season pays the reward for the best league held', r);
  await page.evaluate(() => document.querySelector('.cm-pay-card .cta')?.click());
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => { const { api } = window.__game; return { res: api.competitive.paySeason(), scrap: api.profile.scrap, placementsLeft: api.competitive.placementsLeft(), bracket: api.competitive.bracket() }; });
  check(again.res === null && again.scrap === 3600 && again.placementsLeft === 0 && again.bracket === 'veteran', 'the season reward pays once and a held league skips placements', again);
  await page.close();
}

{
  const page = await open();
  const guard = await page.evaluate(() => { const { api } = window.__game, base = { type: 'ranked', seed: null, score: 20000, wave: 10, kills: 100, heads: 10, time: 400, slots: [0, 1], bosses: [] }; return { survivor: api.competitive.plausible({ ...base, difficultyId: 'survivor' }), recruit: api.competitive.plausible({ ...base, difficultyId: 'recruit' }) }; });
  check(guard.survivor === null && /NOT A RANKED DIFFICULTY/.test(guard.recruit), 'anti-cheat rejects ranked runs on Recruit', guard);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL RANKED CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
