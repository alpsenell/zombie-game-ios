import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ now = NOW, profile, gc = true, friends = [] }) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});
    localStorage.setItem('deadzone.records', JSON.stringify({ score: 5000, wave: 8, rank: 0 }));
    if (!${gc}) return;
    const friends = ${JSON.stringify(friends)};
    const boards = {};
    for (const id of ['deadzone.highscore', 'deadzone.bestwave', 'deadzone.daily', 'deadzone.daily.rookie', 'deadzone.weekly', 'deadzone.weekly.veteran', 'deadzone.weekly.survivor', 'deadzone.extract', 'deadzone.sprint20', 'deadzone.event', 'deadzone.blitz', 'deadzone.daily.squad']) boards[id] = { others: [], me: null };
    boards['deadzone.highscore'].others = Array.from({ length: 30 }, (_, i) => ({ name: 'PLAYER' + (i + 1), score: 100000 - i * 2000, context: 0 }));
    const list = (b, scope, id) => [...(scope === 'friends' ? (id === 'deadzone.highscore' ? friends : []) : b.others), ...(b.me ? [{ ...b.me, isLocal: true }] : [])].sort((a, c) => c.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
    window.__calls = [];
    window.Capacitor = {
      PluginHeaders: [{ name: 'GameCenter' }],
      async nativePromise(plugin, method, opts = {}) {
        window.__calls.push({ plugin, method, opts });
        if (method === 'signIn') return { authenticated: true, displayName: 'TESTER' };
        const b = boards[opts.leaderboardId];
        if (!b) throw new Error('Leaderboard not found: ' + opts.leaderboardId);
        if (method === 'submitScore') { if (!b.me || opts.score > b.me.score) b.me = { name: 'TESTER', score: opts.score, context: opts.context }; return {}; }
        if (method === 'loadScores') { const all = list(b, opts.scope, opts.leaderboardId), me = all.find(e => e.isLocal); const start = opts.start || 1; return { total: all.length, start, entries: all.slice(start - 1, start - 1 + (opts.count || 10)), player: me || null }; }
        return {};
      },
    };
  })();`;
}
const PROFILE = { runs: 6, bestWave: 8, scrap: 500, xp: 0, kills: 300, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } };
const FRIENDS = [{ name: 'NIGHTOWL', score: 9000, context: 0 }, { name: 'KAT', score: 7000, context: 0 }, { name: 'BOB', score: 6000, context: 0 }, { name: 'ZED', score: 4000, context: 0 }];
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock({ profile: PROFILE, friends: FRIENDS, ...opts }) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); const { api } = window.__game; api.levels.state.paid = 99; api.settings.sound = false; });
  return page;
}
const endRun = (page, score, opts = { map: 'street' }) => page.evaluate(async ({ score, opts }) => {
  const g = window.__game, { api } = g, events = [];
  api.bus.on('friends:passed', e => events.push(e));
  api.startGame(opts);
  const prev = api.friends.prevBest();
  Object.assign(api.state, { score, wave: 9, kills: 80, heads: 10, clock: 300 });
  g.gameOver();
  await new Promise(r => setTimeout(r, 500));
  const line = document.querySelector('#fr-line');
  return { prev, text: line.textContent, hidden: line.classList.contains('hidden'), passed: line.classList.contains('passed'), events, result: api.friends.lastResult(), count: api.store.get('friendsCount', 0) };
}, { score, opts });

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const F = await import('./features/friends.js');
    const entries = [{ name: 'A', score: 9000 }, { name: 'B', score: 7000 }, { name: 'C', score: 6000 }, { name: 'D', score: 4000 }, { name: 'ME', score: 8000, isLocal: true }];
    const r = F.passedFriends(entries, 8000, 5000), r2 = F.passedFriends(entries, 10000, 0), r3 = F.passedFriends([], 100, 0);
    return { passed: r.passed.map(f => f.name), next: r.next?.name, total: r.total, all: r2.passed.length, lead: r2.next, empty: r3 };
  });
  check(pure.passed.join() === 'B,C' && pure.next === 'A' && pure.total === 4 && pure.all === 4 && pure.lead === null && pure.empty.total === 0, 'friends between the old best and the new score count as passed', pure);

  const r1 = await endRun(page, 8000);
  check(r1.prev === 5000 && !r1.hidden && r1.passed && /YOU PASSED 2 FRIENDS · KAT, BOB · NEXT NIGHTOWL 1,001 AWAY/.test(r1.text) && r1.events[0]?.count === 2 && r1.events[0].names.join() === 'KAT,BOB' && r1.events[0].next === 'NIGHTOWL' && r1.count === 4, 'the game-over screen says which friends were passed and who is next', r1);
  await page.screenshot({ path: '/tmp/friends-over.png' });

  const board = await page.evaluate(async () => {
    const { api } = window.__game;
    document.querySelector('#over [data-open="board"]').click();
    await new Promise(r => setTimeout(r, 300));
    const tab = api.boardTab(), on = document.querySelector('#board .tabs button.on')?.dataset.tab, rows = document.querySelectorAll('#board-list li:not(.gap)').length;
    document.querySelector('#board .tabs [data-tab="global"]').click();
    await new Promise(r => setTimeout(r, 300));
    const picked = api.boardTab();
    document.querySelector('#board-close').click();
    api.toMenu();
    document.querySelector('#menu [data-open="board"]').click();
    await new Promise(r => setTimeout(r, 300));
    const again = api.boardTab();
    document.querySelector('#board-close').click();
    return { tab, on, rows, picked, again };
  });
  check(board.tab === 'friends' && board.on === 'friends' && board.rows === 5 && board.picked === 'global' && board.again === 'global', 'RANKS opens on the FRIENDS tab until the player picks a tab', board);

  const r2 = await endRun(page, 20000);
  check(r2.prev === 8000 && /YOU PASSED NIGHTOWL/.test(r2.text) && r2.passed && !/NEXT/.test(r2.text) && r2.events[0]?.count === 1, 'passing the last friend ahead names them', r2);
  const r3 = await endRun(page, 20500);
  check(/YOU LEAD YOUR FRIENDS · 4 ON THE BOARD/.test(r3.text) && !r3.passed && !r3.events.length, 'leading every friend says so without a celebration', r3);
  const ranked = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    api.startGame({ type: 'ranked', map: 'street' });
    Object.assign(api.state, { score: 3000, wave: 6, kills: 30, clock: 200 });
    return { board: api.friends.prevBest() === 0, type: api.state.runType, after: (g.gameOver(), await new Promise(r => setTimeout(r, 400)), document.querySelector('#fr-line').textContent) };
  });
  check(ranked.type === 'ranked' && /NO FRIENDS ON THIS BOARD YET/.test(ranked.after), 'a board with no friends invites the squad', ranked);
  await page.evaluate(() => window.__game.api.toMenu());
  await page.close();
}

{
  const page = await open({ gc: false });
  const off = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    api.startGame({ map: 'street' });
    Object.assign(api.state, { score: 8000, wave: 9, kills: 80 });
    g.gameOver();
    await new Promise(r => setTimeout(r, 300));
    const hidden = document.querySelector('#fr-line').classList.contains('hidden');
    document.querySelector('#over [data-open="board"]').click();
    await new Promise(r => setTimeout(r, 200));
    return { hidden, tab: api.boardTab() };
  });
  check(off.hidden && off.tab === 'global', 'without Game Center nothing changes', off);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL FRIENDS CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
