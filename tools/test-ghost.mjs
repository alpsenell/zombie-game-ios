import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ now = NOW, profile, gc = true }) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});
    if (!${gc}) return;
    const boards = {};
    for (const id of ['deadzone.highscore', 'deadzone.bestwave', 'deadzone.daily', 'deadzone.daily.rookie', 'deadzone.weekly', 'deadzone.weekly.veteran', 'deadzone.weekly.survivor', 'deadzone.extract', 'deadzone.sprint20', 'deadzone.event', 'deadzone.blitz', 'deadzone.daily.squad']) boards[id] = { others: [], me: null };
    boards['deadzone.daily'].others = [{ name: 'NIGHTOWL', score: 50000, context: 0 }, { name: 'SECOND', score: 30000, context: 0 }];
    boards['deadzone.daily.rookie'].others = [{ name: 'ROOKIEKING', score: 20000, context: 0 }];
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
const PROFILE = { runs: 6, bestWave: 14, scrap: 500, xp: 20000, kills: 300, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } };
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock({ profile: PROFILE, ...opts }) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); const { api } = window.__game; api.levels.state.paid = 99; api.settings.sound = false; });
  return page;
}

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const G = await import('./features/ghost.js');
    return { shares: [1, 5, 9, 10].map(w => Math.round(G.paceShare(w, 10) * 1000) / 1000), mono: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => G.paceShare(w, 10)).every((v, i, a) => i === 0 || v > a[i - 1]), boss: G.waveWeight(5) > G.waveWeight(4) * 1.5, signed: [G.signed(120), G.signed(-5, 'S'), G.signed(0)], clock: [G.clockText(65), G.clockText(0)] };
  });
  check(pure.shares[3] === 1 && pure.shares[0] > 0 && pure.shares[0] < .1 && pure.mono && pure.boss && pure.signed.join() === '+120,−5S,±0' && pure.clock.join() === '1:05,0:00', 'the pace curve is monotonic, boss-weighted and ends at 100%', pure);

  const daily = await page.evaluate(async () => {
    const g = window.__game, { api } = g, events = [];
    for (const n of ['ghost:top', 'ghost:mark', 'ghost:saved']) api.bus.on(n, e => events.push([n, e]));
    const level = api.levelInfo().level;
    api.startGame(api.competitive.dailyChallenge() && { type: 'daily', seed: api.competitive.dailyChallenge().seed, difficulty: api.competitive.dailyChallenge().difficulty, slots: api.competitive.dailyChallenge().slots, maxWave: 10, map: 'street' });
    await new Promise(r => setTimeout(r, 300));
    const st = api.ghost.state();
    const before = api.ghost.text();
    api.state.wave = 2; api.state.clock = 40; api.state.score = 1800;
    api.bus.emit('wave:clear', { wave: 2 });
    const w2 = { text: api.ghost.text(), cls: document.querySelector('.cm-ghost').className };
    api.state.wave = 5; api.state.clock = 120; api.state.score = 20000;
    api.bus.emit('wave:clear', { wave: 5 });
    const w5 = { text: api.ghost.text(), cls: document.querySelector('.cm-ghost').className };
    api.state.wave = 6;
    api.ghost.render();
    const between = api.ghost.text();
    Object.assign(api.state, { wave: 6, score: 21000, kills: 60 });
    g.gameOver();
    await new Promise(r => setTimeout(r, 100));
    const hidden = document.querySelector('.cm-ghost').classList.contains('hidden');
    api.toMenu();
    return { level, top: st.top, before, w2, w5, between, events: events.map(e => e[0]), saved: events.find(e => e[0] === 'ghost:saved')?.[1], ghost: api.profile.ghost.daily, pace2: Math.round(st.top.score * api.ghost.paceShare(2, 10)), pace5: Math.round(st.top.score * api.ghost.paceShare(5, 10)), hidden, calls: window.__calls.filter(c => c.method === 'loadScores').map(c => c.opts.leaderboardId) };
  });
  const expectBoard = daily.level < 10 ? 'ROOKIEKING' : 'NIGHTOWL';
  check(daily.top?.name === expectBoard && daily.top.rank === 1 && daily.calls.some(id => /deadzone\.daily/.test(id)) && /#1 (ROOKIEKING|NIGHTOWL) · PACE BY W1/.test(daily.before), 'a Daily run loads the #1 score and shows their pace for the next wave', { top: daily.top, before: daily.before, calls: daily.calls });
  check(new RegExp('#1 PACE · W2 · ' + daily.pace2.toLocaleString() + ' · YOU' + (1800 >= daily.pace2 ? '\\+' : '−')).test(daily.w2.text) && new RegExp('#1 PACE · W5 · ' + daily.pace5.toLocaleString()).test(daily.w5.text) && /ahead|behind/.test(daily.w2.cls) && /PACE BY W7/.test(daily.between), 'after each clear the line compares the score with the #1 pace', { w2: daily.w2, w5: daily.w5, between: daily.between, pace: [daily.pace2, daily.pace5] });
  check(daily.events[0] === 'ghost:top' && daily.events.filter(e => e === 'ghost:mark').length === 2 && daily.saved?.score === 21000 && daily.ghost?.marks.length === 2 && daily.ghost.marks[1].t === 120 && daily.hidden, 'the run becomes the Daily ghost and the line hides on game over', { events: daily.events, ghost: daily.ghost });
  await page.screenshot({ path: '/tmp/ghost-daily.png' });

  const own = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    api.startGame({ map: 'street' });
    await new Promise(r => setTimeout(r, 50));
    const none = api.ghost.text();
    api.state.wave = 1; api.state.clock = 30; api.state.score = 500; api.bus.emit('wave:clear', { wave: 1 });
    api.state.wave = 2; api.state.clock = 65; api.state.score = 1500; api.bus.emit('wave:clear', { wave: 2 });
    Object.assign(api.state, { wave: 3, score: 2000, kills: 20 });
    g.gameOver(); await new Promise(r => setTimeout(r, 50)); api.toMenu();
    const ghost = api.profile.ghost.normal;
    api.startGame({ map: 'street' });
    await new Promise(r => setTimeout(r, 50));
    api.state.clock = 10; api.ghost.render();
    const target = { text: api.ghost.text(), cls: document.querySelector('.cm-ghost').className };
    api.state.wave = 1; api.state.clock = 26; api.state.score = 600; api.bus.emit('wave:clear', { wave: 1 });
    const ahead = { text: api.ghost.text(), cls: document.querySelector('.cm-ghost').className };
    api.state.wave = 2; api.state.clock = 80; api.state.score = 1200; api.bus.emit('wave:clear', { wave: 2 });
    const behind = { text: api.ghost.text(), cls: document.querySelector('.cm-ghost').className };
    Object.assign(api.state, { wave: 2, score: 1200, kills: 10 });
    g.gameOver(); await new Promise(r => setTimeout(r, 50)); api.toMenu();
    const kept = api.profile.ghost.normal.score;
    api.startGame({ type: 'ranked', map: 'street' });
    await new Promise(r => setTimeout(r, 50));
    const ranked = api.ghost.text();
    g.gameOver(); api.toMenu();
    api.startGame({ type: 'tutorial', map: 'street' });
    const tut = api.ghost.state().cur;
    g.gameOver(); api.toMenu();
    return { none, ghost, target, ahead, behind, kept, ranked, tut };
  });
  check(own.none === '' && own.ghost?.marks.length === 2 && own.ghost.score === 2000 && /YOUR BEST · W1 BY 0:30 · 0:20 LEFT/.test(own.target.text) && /ahead/.test(own.target.cls), 'a normal run saves its wave times as the player\'s ghost and the next run shows the target', { none: own.none, target: own.target });
  check(/YOUR BEST · W1 · 0:30 · YOU 0:26/.test(own.ahead.text) && /\+4S/.test(own.ahead.text) && /ahead/.test(own.ahead.cls) && /YOUR BEST · W2 · 1:05 · YOU 1:20/.test(own.behind.text) && /−15S/.test(own.behind.text) && /behind/.test(own.behind.cls) && own.kept === 2000, 'clears show the time delta against the ghost and a worse run keeps the old ghost', { ahead: own.ahead, behind: own.behind, kept: own.kept });
  check(own.ranked === '' && own.tut === null, 'ranked runs with no ghost show nothing and training has no ghost', { ranked: own.ranked, tut: own.tut });
  await page.close();
}

{
  const page = await open({ gc: false });
  const offline = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    const d = api.competitive.dailyChallenge();
    api.startGame({ type: 'daily', seed: d.seed, difficulty: d.difficulty, slots: d.slots, maxWave: 10, map: 'street' });
    await new Promise(r => setTimeout(r, 200));
    const st = api.ghost.state();
    api.state.wave = 1; api.state.clock = 20; api.state.score = 400; api.bus.emit('wave:clear', { wave: 1 });
    const text = api.ghost.text();
    g.gameOver(); api.toMenu();
    return { top: st.top, text };
  });
  check(offline.top === null && offline.text === '', 'without Game Center the Daily shows no #1 pace and no line until a ghost exists', offline);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL GHOST CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
