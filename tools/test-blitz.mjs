import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ now = NOW, profile }) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});
    const others = n => Array.from({ length: n }, (_, i) => ({ name: 'PLAYER' + (i + 1), score: 100000 - i * 1000, context: 0 }));
    const boards = {};
    for (const id of ['deadzone.highscore', 'deadzone.bestwave', 'deadzone.daily', 'deadzone.daily.rookie', 'deadzone.weekly', 'deadzone.weekly.veteran', 'deadzone.weekly.survivor', 'deadzone.extract', 'deadzone.sprint20', 'deadzone.event']) boards[id] = { others: [], me: null };
    boards['deadzone.blitz'] = { others: others(20), me: null };
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
const PROFILE = { runs: 3, bestWave: 12, scrap: 5000, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } };
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock({ profile: PROFILE, ...opts }) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const tick = (page, secs) => page.evaluate(s => { const g = window.__game; for (let i = 0; i < s * 30; i++) { if (g.api.state.mode !== 'playing') break; g.update(1 / 30); } return g.api.state.mode; }, secs);

{
  const page = await open();
  const menu = await page.evaluate(() => {
    const modes = [...document.querySelectorAll('#menu-modes > *')].map(b => b.id);
    document.querySelector('#bz-open').click();
    const sheet = document.querySelector('#bz-sheet'), text = sheet.textContent;
    return { modes, visible: !sheet.classList.contains('hidden'), text, cells: [...sheet.querySelectorAll('.bz-cells b')].map(b => b.textContent), bz: document.querySelector('#bz-open').textContent, sp: document.querySelector('#sp20-open').textContent };
  });
  check(menu.modes.includes('bz-open') && menu.modes.includes('sp20-open') && menu.visible && /FIVE MINUTES/.test(menu.text) && /START BLITZ/.test(menu.text) && menu.cells.join() === '—,—,0' && /5 MINUTES · SCORE ATTACK/.test(menu.bz) && /FASTEST TO WAVE 20/.test(menu.sp), 'BLITZ and SPRINT 20 sit in the mode row with their sheets', menu);
  await page.screenshot({ path: '/tmp/blitz-sheet.png' });

  await page.evaluate(() => document.querySelector('#bz-sheet .cta').click());
  await tick(page, 1.5);
  const run = await page.evaluate(() => {
    const { api } = window.__game, s = api.state, E = api.events;
    return { type: s.runType, diff: s.runDifficulty, limit: s.timeLimit, auto: s.autoWave, cap: s.aliveCap, start: s.startWave, hud: document.querySelector('#bz-hud').textContent, hidden: document.querySelector('#bz-hud').classList.contains('hidden'), live: { ...api.live }, boards: api.gameCenter.boards('blitz', { type: 'blitz' }) };
  });
  check(run.type === 'blitz' && run.diff === 'veteran' && run.limit === 300 && run.auto && run.cap === 20 && run.start === 1 && /⚡ [45]:\d\d/.test(run.hud) && !run.hidden && run.boards.join() === 'deadzone.blitz', 'a Blitz run is Veteran, five minutes, auto-wave and counts down on the HUD', run);

  const auto = await page.evaluate(() => {
    const g = window.__game, { api } = g, perks = [];
    api.bus.on('perk', e => perks.push(e));
    const wave0 = api.state.wave, perks0 = api.state.perks.length;
    api.state.queue = [];
    for (const z of api.zombies) api.damageZombie(z, 1e6, null, false, null);
    let frames = 0, modes = new Set();
    while (frames++ < 120 && api.state.wave === wave0) { g.update(1 / 30); modes.add(api.state.mode); }
    while (frames++ < 240 && api.state.perks.length === perks0) { g.update(1 / 30); modes.add(api.state.mode); }
    return { wave0, wave: api.state.wave, modes: [...modes], perks: api.state.perks.length - perks0, event: perks[0], toast: document.querySelector('#toast')?.textContent };
  });
  check(auto.wave === auto.wave0 + 1 && auto.modes.join() === 'playing' && auto.perks === 1 && auto.event?.auto === true && !auto.event.rare && !auto.event.legendary, 'waves roll on without a perk screen and a random upgrade is applied', auto);

  const timeup = await page.evaluate(async () => {
    const g = window.__game, { api } = g, events = [];
    api.levels.state.paid = 99;
    api.bus.on('run:timeup', e => events.push(e));
    window.__calls.length = 0;
    api.state.clock = 299.5;
    api.state.score = 90500; api.state.kills = 80; api.state.heads = 20;
    for (let i = 0; i < 30 && api.state.mode === 'playing' && !api.state.cleared; i++) g.update(1 / 30);
    const cleared = api.state.cleared, between = api.state.between, msg = document.querySelector('#message').textContent, modeAfter = api.state.mode;
    for (let i = 0; i < 90 && api.state.mode === 'playing'; i++) g.update(1 / 30);
    await new Promise(r => setTimeout(r, 500));
    return { cleared, between, msg, modeAfter, mode: api.state.mode, events, h2: document.querySelector('#over h2').textContent, sub: document.querySelector('#over-sub').textContent, rank: document.querySelector('#over-rank').textContent, submits: window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId), runs: api.profile.runs, blitz: api.profile.competitive.blitz, sheetBest: (api.blitz.open(), document.querySelector('#bz-sheet .bz-cells').textContent), menu: (api.showScreen(api.ui.menu), document.querySelector('#bz-open').textContent) };
  });
  check(timeup.cleared && timeup.between && /TIME/.test(timeup.msg) && /90,500/.test(timeup.msg) && timeup.modeAfter === 'playing' && timeup.mode === 'dead' && timeup.events[0]?.score === 90500, 'the clock ends the run with the score banked', { cleared: timeup.cleared, msg: timeup.msg, mode: timeup.mode });
  check(timeup.h2 === 'TIME UP' && /WHEN THE CLOCK RAN OUT/.test(timeup.sub) && /BLITZ RANK #11/.test(timeup.rank) && timeup.submits.join() === 'deadzone.blitz' && timeup.runs === 4 && timeup.blitz.best === 90500 && timeup.blitz.runs === 1, 'a Blitz run submits only to the Blitz board and records the best', { h2: timeup.h2, rank: timeup.rank, submits: timeup.submits, blitz: timeup.blitz });
  check(/90,500/.test(timeup.sheetBest) && /BEST 90,500/.test(timeup.menu), 'the sheet and the mode button show the best score', { sheet: timeup.sheetBest, menu: timeup.menu });
  await page.screenshot({ path: '/tmp/blitz-over.png' });

  const guards = await page.evaluate(async () => {
    const g = window.__game, { api } = g, E = await import('./features/events.js'), base = { type: 'blitz', seed: null, score: 20000, wave: 8, kills: 100, heads: 10, time: 290, slots: [0, 1], bosses: [], startWave: 1 };
    const sat = E.eventAt(Date.UTC(2026, 8, 26, 12));
    const runs0 = api.profile.runs;
    api.startGame(api.blitz.opts());
    for (let i = 0; i < 45; i++) g.update(1 / 30);
    api.hurtPlayer(1e7);
    const died = api.state.mode;
    await new Promise(r => setTimeout(r, 100));
    g.gameOver(); g.gameOver();
    const runs = api.profile.runs - runs0;
    const rerollHidden = document.querySelector('#perk-reroll').classList.contains('hidden');
    api.toMenu();
    return { ok: api.competitive.plausible({ ...base, difficultyId: 'veteran' }), diff: api.competitive.plausible({ ...base, difficultyId: 'survivor' }), long: api.competitive.plausible({ ...base, difficultyId: 'veteran', time: 400 }), mods: E.modsFor(sat, 'blitz'), died, runs, rerollHidden };
  });
  check(guards.ok === null && /NOT THE BLITZ DIFFICULTY/.test(guards.diff) && /5 MINUTES/.test(guards.long), 'anti-cheat keeps Blitz on Veteran within five minutes', guards);
  check(guards.mods.elite === 0 && guards.mods.eliteHeadOnly === false && guards.mods.scrap === 1.5 && guards.died === 'dead' && guards.runs === 1 && guards.rerollHidden, 'Blitz gets no event twists, no revive, no perk reroll, and game over runs once', { mods: guards.mods, died: guards.died, runs: guards.runs });

  const sprint = await page.evaluate(() => {
    const { api } = window.__game;
    api.profile.competitive.sprint = [{ cs: 81234, diff: 'veteran', date: Date.now(), code: 'x' }];
    api.showScreen(api.ui.menu);
    document.querySelector('#sp20-open').click();
    const sheet = document.querySelector('#sp20-sheet'), text = sheet.textContent, cells = [...sheet.querySelectorAll('.bz-cells b')].map(b => b.textContent);
    sheet.querySelector('.cta').click();
    const started = { type: api.state.runType, start: api.state.startWave, mode: api.state.mode };
    api.gameOver(); api.toMenu();
    api.competitive.openBoard('blitz');
    return { text, cells, started, menu: document.querySelector('#sp20-open').textContent, tab: document.querySelector('#cm-boards button.on')?.dataset.board, note: document.querySelector('.cm-board-note').textContent };
  });
  check(/SPRINT 20/.test(sprint.text) && /START SPRINT/.test(sprint.text) && sprint.cells[0] === '13:32.34' && sprint.started.type === 'normal' && sprint.started.start === 1 && /BEST 13:32.34/.test(sprint.menu), 'the Sprint 20 sheet shows the best time and starts a wave-1 run', sprint);
  check(sprint.tab === 'blitz' && /5-MINUTE SCORE ATTACK/.test(sprint.note), 'the RANKS screen has a BLITZ tab', { tab: sprint.tab, note: sprint.note });
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL BLITZ CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
