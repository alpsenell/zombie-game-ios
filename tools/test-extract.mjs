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
    const boards = { 'deadzone.extract': { others: others(15), me: null }, 'deadzone.highscore': { others: others(5), me: null }, 'deadzone.bestwave': { others: [], me: null }, 'deadzone.weekly': { others: others(50), me: null }, 'deadzone.daily': { others: [], me: null }, 'deadzone.daily.rookie': { others: [], me: null } };
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
const clearWave = (page, wave, score) => page.evaluate(([wave, score]) => { const g = window.__game, { api } = g; for (const z of api.zombies) api.damageZombie(z, 1e6, null, false, null); Object.assign(api.state, { wave, score, kills: wave * 12, clock: wave * 40 }); api.state.queue = []; api.state.waveTotal = Math.max(1, api.state.waveTotal); g.update(1 / 30); return api.state.mode; }, [wave, score]);
const submits = page => page.evaluate(() => window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId));

{
  const page = await open();
  const pure = await page.evaluate(async () => { const E = await import('./features/extract.js'); return { mult: [10, 15, 20, 30, 40, 70].map(E.multAt), crate: [10, 20, 30].map(E.crateAt), next: [0, 1, 10, 19, 20].map(E.nextPoint), point: [5, 10, 20, 25].map(E.isPoint) }; });
  check(pure.mult.join() === '1.25,1.25,1.5,1.75,2,2' && pure.crate.join() === '300,600,900' && pure.next.join() === '10,10,20,20,30' && pure.point.join() === 'false,true,true,false', 'multipliers, crates and extraction points', pure);
  const menu = await page.evaluate(() => ({ btn: document.querySelector('#ex-open')?.textContent, visible: !document.querySelector('#ex-open').classList.contains('hidden') }));
  check(/EXTRACTION/.test(menu.btn) && menu.visible, 'the menu offers EXTRACTION to an existing player', menu);
  await page.click('#ex-open');
  await page.waitForTimeout(200);
  const sheet = await page.evaluate(() => ({ open: !document.querySelector('#ex-sheet').classList.contains('hidden'), steps: [...document.querySelectorAll('#ex-sheet .ex-steps b')].map(b => b.textContent) }));
  check(sheet.open && sheet.steps.join() === '×1.25,×1.5,×1.75,×2', 'the rules sheet lists the multipliers', sheet);
  await page.screenshot({ path: '/tmp/extract-sheet.png' });
  await page.click('#ex-sheet .cta');
  await tick(page, 1.2);
  const run = await page.evaluate(() => { const { api } = window.__game; return { type: api.state.runType, hud: document.querySelector('#ex-hud').textContent, hidden: document.querySelector('#ex-hud').classList.contains('hidden') }; });
  check(run.type === 'extract' && !run.hidden && /EXTRACT AT WAVE 10/.test(run.hud) && /×1.25/.test(run.hud), 'the HUD shows the next extraction point', run);

  const mode9 = await clearWave(page, 9, 20000);
  await tick(page, 2.5);
  const at9 = await page.evaluate(() => ({ mode: window.__game.api.state.mode, sheet: !document.querySelector('#extract').classList.contains('hidden') }));
  check(mode9 === 'playing' && at9.mode === 'perk' && !at9.sheet, 'wave 9 goes to the normal perk screen', at9);
  await page.evaluate(() => document.querySelector('#perk-list .perk').click());
  await tick(page, 2);
  const mode10 = await clearWave(page, 10, 45000);
  const offer10 = await page.evaluate(() => { const { api } = window.__game; return { mode: api.state.mode, sheet: !document.querySelector('#extract').classList.contains('hidden'), sub: document.querySelector('#extract .ex-sub').textContent, go: document.querySelector('#extract .cta').textContent, hold: document.querySelector('#extract .ghost').textContent, offer: api.extract.offer }; });
  check(mode10 === 'extract' && offer10.sheet && /WAVE 10 CLEARED/.test(offer10.sub) && /×1.25 → 59,375 BANKED/.test(offer10.go) && /\+300 🔩/.test(offer10.go) && /WAVE 20 · ×1.5/.test(offer10.hold), 'wave 10 pauses the run with the extraction offer', offer10);
  await page.screenshot({ path: '/tmp/extract-offer.png' });
  const clock0 = await page.evaluate(() => window.__game.api.state.clock);
  const heldMode = await tick(page, 3);
  const held = await page.evaluate(clock0 => ({ clock: window.__game.api.state.clock - clock0, mode: window.__game.api.state.mode, perks: !document.querySelector('#perks').classList.contains('hidden') }), clock0);
  check(heldMode === 'extract' && held.clock === 0 && !held.perks, 'the game loop, the clock and the perk offer are held while deciding', held);
  await page.evaluate(() => document.querySelector('#extract .ghost').click());
  const afterHold = await page.evaluate(() => ({ mode: window.__game.api.state.mode, sheet: !document.querySelector('#extract').classList.contains('hidden'), toast: document.querySelector('#toast').textContent }));
  check(afterHold.mode === 'playing' && !afterHold.sheet && /NEXT EXTRACTION AT WAVE 20/.test(afterHold.toast), 'HOLD THE LINE resumes the run', afterHold);
  await tick(page, 2.5);
  const perk = await page.evaluate(() => window.__game.api.state.mode);
  check(perk === 'perk', 'the held perk offer arrives once play resumes', perk);
  await page.evaluate(() => document.querySelector('#perk-list .perk').click());
  await tick(page, 2);
  const hud11 = await page.evaluate(() => document.querySelector('#ex-hud').textContent);
  check(/WAVE 20/.test(hud11) && /×1.5/.test(hud11), 'the HUD now points at wave 20', hud11);

  const mode20 = await clearWave(page, 20, 90000);
  check(mode20 === 'extract', 'wave 20 offers again');
  const scrap0 = await page.evaluate(() => window.__game.api.profile.scrap);
  await page.evaluate(() => document.querySelector('#extract .cta').click());
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  await page.waitForFunction(() => /RANK #|SIGN IN|NOT SUBMITTED/.test(document.querySelector('#over-rank').textContent));
  const over = await page.evaluate(scrap0 => { const { api } = window.__game, s = api.runSummary(); return { h2: document.querySelector('#over h2').textContent, score: s.score, cleared: s.cleared, extracted: s.extracted, rank: document.querySelector('#over-rank').textContent, extra: document.querySelector('.ex-over').textContent, chips: [...document.querySelectorAll('#over-rewards span')].map(x => x.textContent), gained: api.profile.scrap - scrap0, runs: api.store.get('runs', []).map(r => r.type) }; }, scrap0);
  check(over.h2 === 'EXTRACTED' && over.score === 142500 && over.cleared && over.extracted === 20, 'extracting banks the score at ×1.5 and ends the run as a win', over);
  check(/RANK #\d/.test(over.rank) && (await submits(page)).join() === 'deadzone.extract' && over.runs.includes('extract'), 'the banked score goes to the extract board', { rank: over.rank, submits: await submits(page), runs: over.runs });
  check(over.chips.some(c => /\+600 🔩 EXTRACTION CRATE/.test(c)) && /EXTRACTED AT WAVE 20 · ×1.5/.test(over.extra) && over.gained > 600, 'the crate pays on top of the run rewards', over);
  await page.screenshot({ path: '/tmp/extract-over.png' });

  await page.evaluate(() => { const g = window.__game, { api } = g; api.startGame(api.state.runOpts.replay()); Object.assign(api.state, { score: 30000, wave: 14, kills: 150, clock: 500 }); g.gameOver(); });
  await page.waitForFunction(() => /RANK #|SIGN IN|NOT SUBMITTED/.test(document.querySelector('#over-rank').textContent));
  const died = await page.evaluate(() => ({ h2: document.querySelector('#over h2').textContent, score: window.__game.api.runSummary().score, extra: document.querySelector('.ex-over').textContent }));
  check(died.h2 === 'YOU DIED' && died.score === 30000 && /BONUS FORFEITED/.test(died.extra) && /WAVE 20/.test(died.extra), 'dying before extracting keeps only the raw score', died);

  const guard = await page.evaluate(() => { const { api } = window.__game, base = { type: 'extract', seed: null, difficultyId: 'survivor', wave: 20, kills: 300, heads: 50, time: 900, slots: [0, 1], bosses: ['abomination', 'butcher', 'plague', 'goliath'] }; let normalCap = 0; for (let x = 100000; x < 1e8; x += 100000) { if (api.competitive.plausible({ ...base, type: 'normal', score: x })) { normalCap = x; break; } } return { normalCap, ok: api.competitive.plausible({ ...base, score: Math.round(normalCap * 1.9) }), tooHigh: api.competitive.plausible({ ...base, score: Math.round(normalCap * 2.2) }) }; });
  check(guard.ok === null && /TOO HIGH/.test(guard.tooHigh), 'anti-cheat allows up to double the normal cap for extraction runs', guard);

  await page.evaluate(() => { window.__game.api.toMenu(); window.__game.api.competitive.openBoard('extract'); });
  await page.waitForTimeout(400);
  const board = await page.evaluate(() => ({ id: window.__game.api.boardView.id, note: document.querySelector('.cm-board-note').textContent, tabs: [...document.querySelectorAll('#cm-boards button')].map(b => b.textContent) }));
  check(board.id === 'deadzone.extract' && /EXTRACTION RUNS/.test(board.note) && board.tabs.includes('EXTRACT'), 'the RANKS screen has an EXTRACT tab', board);
  await page.close();
}

{
  const page = await open({ runs: 0, bestWave: 0, scrap: 300, xp: 0, owned: {}, loadout: {}, arsenal: { owned: {} }, tutorial: { done: true, reward: true, skipped: true, staged: true } });
  const r = await page.evaluate(() => { const { api } = window.__game; const h0 = document.querySelector('#ex-open').classList.contains('hidden'); api.profile.bestWave = 5; api.showScreen(api.ui.menu); return { h0, h1: document.querySelector('#ex-open').classList.contains('hidden') }; });
  check(r.h0 && !r.h1, 'EXTRACTION is hidden at menu stage 0 and appears from wave 5', r);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL EXTRACTION CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
