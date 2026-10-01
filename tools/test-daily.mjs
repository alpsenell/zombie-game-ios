import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock(profile) {
  return `(() => {
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
    const others = n => Array.from({ length: n }, (_, i) => ({ name: 'PLAYER' + (i + 1), score: 100000 - i * 1000, context: 0 }));
    const boards = { 'deadzone.daily': { others: others(30), me: null }, 'deadzone.daily.rookie': { others: others(20), me: null }, 'deadzone.highscore': { others: others(5), me: null }, 'deadzone.bestwave': { others: [], me: null }, 'deadzone.weekly': { others: others(50), me: null } };
    const list = b => [...b.others, ...(b.me ? [{ ...b.me, isLocal: true }] : [])].sort((a, c) => c.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
    window.__calls = [];
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
async function open(profile) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock(profile) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const tick = (page, secs) => page.evaluate(s => { const g = window.__game; for (let i = 0; i < s * 30; i++) { if (g.api.state.mode !== 'playing') break; g.update(1 / 30); } return g.api.state.mode; }, secs);
const submits = page => page.evaluate(() => window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId));

{
  const page = await open();
  const d = await page.evaluate(() => { const { api } = window.__game, d = api.competitive.dailyChallenge(); return { level: api.levelInfo().level, bracket: d.bracket, difficulty: d.difficulty, waves: d.waves, button: document.querySelector('#cm-daily').textContent }; });
  check(d.level === 1 && d.bracket === 'rookie' && d.difficulty === 'survivor' && d.waves === 10 && /10 WAVES · SURVIVOR/.test(d.button), 'a level 1 player gets the rookie Daily on Survivor', d);
  await page.evaluate(() => window.__game.api.competitive.openDaily());
  await page.waitForFunction(() => /#\d|—/.test(document.querySelector('#comp-sheet .cm-grid').textContent));
  const sheet = await page.evaluate(() => ({ grid: document.querySelector('#comp-sheet .cm-grid').textContent, sub: document.querySelector('#comp-sheet .cm-sub').textContent, rules: document.querySelector('#comp-sheet .cm-rules').textContent }));
  check(/ROOKIE BRACKET/.test(sheet.sub) && /10 WAVES/.test(sheet.grid) && /SURVIVOR · ROOKIE/.test(sheet.grid) && /0ATTEMPTS TODAY/.test(sheet.grid) && /UNDER LEVEL 10/.test(sheet.rules), 'the Daily sheet explains the format and the bracket', sheet);
  await page.screenshot({ path: '/tmp/daily-sheet.png' });
  await page.click('#cm-go');
  await tick(page, 1.2);
  const run = await page.evaluate(() => { const { api } = window.__game; return { type: api.state.runType, maxWave: api.state.maxWave, diff: api.state.runDifficulty, wave: document.querySelector('#wave-num').textContent }; });
  check(run.type === 'daily' && run.maxWave === 10 && run.diff === 'survivor' && run.wave === 'WAVE 1 / 10', 'the Daily run is capped at wave 10 and the HUD shows it', run);
  await page.evaluate(() => { const g = window.__game, { api } = g; for (const z of api.zombies) api.damageZombie(z, 1e6, null, false, null); api.state.wave = 10; api.state.score = 48000; api.state.kills = 180; api.state.heads = 40; api.state.shots = 400; api.state.hits = 300; api.state.clock = 420; api.state.queue = []; g.update(1 / 30); });
  const msg = await page.evaluate(() => document.querySelector('#message').textContent);
  check(/CHALLENGE COMPLETE/.test(msg) && /50,500/.test(msg), 'clearing wave 10 announces the final score with the wave bonus', msg);
  const mode = await tick(page, 2.5);
  check(mode === 'dead', 'the run ends by itself after the final wave', mode);
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  await page.waitForFunction(() => /RANK #|SIGN IN|NOT SUBMITTED/.test(document.querySelector('#over-rank').textContent));
  const over = await page.evaluate(() => { const { api } = window.__game; return { h2: document.querySelector('#over h2').textContent, rank: document.querySelector('#over-rank').textContent, extras: document.querySelector('.cm-over').textContent, cleared: api.runSummary().cleared, daily: api.profile.competitive.daily }; });
  check(over.h2 === 'DAILY COMPLETE' && over.cleared, 'the game-over screen reads DAILY COMPLETE', over);
  check(/DAILY RANK #\d/.test(over.rank) && (await submits(page)).join() === 'deadzone.daily.rookie', 'the score goes to the rookie board', { rank: over.rank, submits: await submits(page) });
  check(over.daily.attempts === 1 && /WAVE 10 CLEARED/.test(over.extras) && /ATTEMPT 1/.test(over.extras) && /ROOKIE BRACKET/.test(over.extras), 'attempts are counted and shown', over);
  await page.screenshot({ path: '/tmp/daily-over.png' });

  await page.evaluate(() => { const g = window.__game, { api } = g; api.startGame(api.state.runOpts.replay()); Object.assign(api.state, { score: 9000, wave: 4, kills: 40, clock: 120 }); g.gameOver(); });
  await page.waitForFunction(() => /RANK #|SIGN IN|NOT SUBMITTED/.test(document.querySelector('#over-rank').textContent));
  const died = await page.evaluate(() => ({ h2: document.querySelector('#over h2').textContent, cleared: window.__game.api.runSummary().cleared, attempts: window.__game.api.profile.competitive.daily.attempts, best: window.__game.api.profile.competitive.daily.best, rank: document.querySelector('#over-rank').textContent }));
  check(died.h2 === 'YOU DIED' && !died.cleared && died.attempts === 2 && died.best === 50500 && /DAILY RANK #\d/.test(died.rank), 'a death before wave 10 still submits and counts as an attempt', died);

  const guard = await page.evaluate(() => { const { api } = window.__game, d = api.competitive.dailyChallenge(), base = { type: 'daily', seed: d.seed, difficultyId: 'survivor', score: 20000, wave: 10, kills: 150, heads: 30, time: 400, slots: d.slots, bosses: ['abomination', 'butcher'] }; return { ok: api.competitive.plausible(base), eleven: api.competitive.plausible({ ...base, wave: 11, kills: 170 }), veteran: api.competitive.plausible({ ...base, difficultyId: 'veteran' }), recruit: api.competitive.plausible({ ...base, difficultyId: 'recruit' }) }; });
  check(guard.ok === null && /10 WAVES/.test(guard.eleven) && guard.veteran === null && /DAILY LOADOUT/.test(guard.recruit), 'anti-cheat accepts both brackets and rejects runs past wave 10', guard);

  await page.evaluate(() => { window.__game.api.toMenu(); window.__game.api.competitive.openBoard('daily'); });
  await page.waitForTimeout(400);
  const board = await page.evaluate(() => ({ id: window.__game.api.boardView.id, status: document.querySelector('#board-status').textContent }));
  check(board.id === 'deadzone.daily.rookie' && /21 SURVIVORS/.test(board.status), 'the RANKS screen shows the rookie board to a rookie', board);
  await page.close();
}

{
  const page = await open({ xp: 77100, scrap: 500, runs: 30, kills: 900, owned: {}, loadout: {}, arsenal: { owned: {} } });
  const d = await page.evaluate(() => { const { api } = window.__game, d = api.competitive.dailyChallenge(); return { level: api.levelInfo().level, bracket: d.bracket, difficulty: d.difficulty, board: api.competitive.boardId('daily') }; });
  check(d.level === 10 && d.bracket === 'veteran' && d.difficulty === 'veteran' && d.board === 'deadzone.daily', 'from level 10 the Daily is Veteran on the main board', d);
  await page.evaluate(() => window.__game.api.competitive.openDaily());
  await page.waitForFunction(() => /#\d|—/.test(document.querySelector('#comp-sheet .cm-grid').textContent));
  const sheet = await page.evaluate(() => ({ sub: document.querySelector('#comp-sheet .cm-sub').textContent, grid: document.querySelector('#comp-sheet .cm-grid').textContent }));
  check(/SAME RUN FOR EVERY SURVIVOR/.test(sheet.sub) && /VETERAN · x1.75/.test(sheet.grid), 'the veteran sheet shows the multiplier, not the bracket', sheet);
  await page.click('#cm-go');
  await page.evaluate(() => { const g = window.__game, { api } = g; Object.assign(api.state, { score: 30000, wave: 7, kills: 100, clock: 300 }); g.gameOver(); });
  await page.waitForFunction(() => /RANK #|SIGN IN|NOT SUBMITTED/.test(document.querySelector('#over-rank').textContent));
  check((await submits(page)).join() === 'deadzone.daily', 'a veteran Daily submits to deadzone.daily', await submits(page));
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL DAILY CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
