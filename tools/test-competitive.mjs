import assert from 'node:assert/strict';
import { serve, launch, openGame } from './smoke.mjs';

const SHOTS = process.env.SHOTS;

function mockGameCenter() {
  localStorage.setItem('deadzone.tutorial', 'true');
  const others = n => Array.from({ length: n }, (_, i) => ({ name: i === 198 ? '<img src=x onerror="window.__xss=1">' : i === 199 ? 'NightOwl' : 'PLAYER' + (i + 1), score: 200000 - i * 1000, context: 0 }));
  const boards = {
    'deadzone.highscore': { others: others(60), me: null },
    'deadzone.bestwave': { others: [], me: null },
    'deadzone.daily': { others: others(40), me: null },
    'deadzone.daily.rookie': { others: others(40), me: null },
    'deadzone.weekly': { others: others(200), me: null },
  };
  const calls = [];
  const list = b => [...b.others, ...(b.me ? [{ ...b.me, isLocal: true }] : [])].sort((a, c) => c.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
  window.__gc = { calls, boards };
  window.Capacitor = {
    PluginHeaders: [{ name: 'GameCenter', methods: [] }, { name: 'Haptics', methods: [] }],
    async nativePromise(plugin, method, opts = {}) {
      calls.push({ plugin, method, opts });
      if (plugin === 'Haptics') return {};
      if (method === 'signIn') return { authenticated: true, displayName: 'TESTER' };
      if (method === 'showLeaderboard') return {};
      const b = boards[opts.leaderboardId];
      if (!b) throw new Error('Leaderboard not found');
      if (method === 'submitScore') {
        if (!b.me || opts.score > b.me.score) b.me = { name: 'TESTER', score: opts.score, context: opts.context };
        return {};
      }
      if (method === 'loadScores') {
        const all = list(b), start = opts.start || 1, count = opts.count || 10;
        const res = { total: all.length, start, entries: all.slice(start - 1, start - 1 + count) };
        const me = all.find(e => e.isLocal);
        if (me) res.player = me;
        if (opts.leaderboardId === 'deadzone.daily' || opts.leaderboardId === 'deadzone.weekly') Object.assign(res, { recurring: true, nextStart: Date.now() + 5 * 3600e3 });
        return res;
      }
      throw new Error('unknown ' + method);
    },
  };
}

const play = (page, frames) => page.evaluate(frames => {
  const g = window.__game, { api } = g;
  api.settings.autoFire = true;
  for (let i = 0; i < frames; i++) {
    if (api.state.mode === 'perk') document.querySelector('.perk').click();
    if (api.state.mode !== 'playing') break;
    let best = null, bd = 1e9;
    for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
    if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
    g.update(1 / 30); g.scene.updateMatrixWorld();
  }
  return api.runSummary();
}, frames);

const submits = page => page.evaluate(() => window.__gc.calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId));
const resetCalls = page => page.evaluate(() => { window.__gc.calls.length = 0; });
async function endRun(page) {
  await page.evaluate(() => window.__game.gameOver());
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  await page.waitForFunction(() => !/SUBMITTING/.test(document.querySelector('#over-rank').textContent));
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); }

const { server, url } = await serve();
const browser = await launch();
const results = [];
const ok = name => { results.push(name); console.log('ok -', name); };

try {
  const { page, errors } = await openGame(browser, url, { init: mockGameCenter });
  await page.waitForFunction(() => window.__game.api.competitive);

  const league = await page.evaluate(() => {
    const { leagueFor } = window.__game.api.competitive, id = (r, t) => leagueFor(r, t)?.id ?? null;
    return [id(1, 10), id(1, 1000), id(100, 5000), id(101, 5000), id(150, 1000), id(250, 1000), id(251, 1000), id(500, 1000), id(501, 1000), id(1000, 1000), id(0, 50), id(5, 0)];
  });
  assert.deepEqual(league, ['platinum', 'legend', 'legend', 'diamond', 'gold', 'gold', 'silver', 'silver', 'bronze', 'bronze', null, null]);
  ok('league math');

  const det = await page.evaluate(() => {
    const { api } = window.__game, d = api.competitive.dailyChallenge();
    const waves = opts => { api.startGame(opts); const out = []; for (let i = 0; i < 3; i++) { api.nextWave(); out.push(api.state.queue.map(q => q.kind + (q.elite ? '*' : '')).join(',')); } return out; };
    const a = waves({ type: 'daily', seed: d.seed, difficulty: d.difficulty, slots: d.slots });
    const b = waves({ type: 'daily', seed: d.seed, difficulty: d.difficulty, slots: d.slots });
    const c = waves({ type: 'daily', seed: d.seed + 1, difficulty: d.difficulty, slots: d.slots });
    api.toMenu();
    const today = new Date().toISOString().slice(0, 10);
    return { a, b, c, d, expectSeed: api.hashSeed('daily-' + today), premium: d.slots.some(i => api.WEAPONS[i].premium), distinct: d.slots[0] !== d.slots[1] };
  });
  assert.deepEqual(det.a, det.b);
  assert.notDeepEqual(det.a, det.c);
  assert.equal(det.d.seed, det.expectSeed);
  assert.equal(det.d.difficulty, 'survivor');
  assert.ok(!det.premium && det.distinct);
  ok('daily seed determinism (waves 1-3 identical, non-premium loadout)');

  await page.waitForTimeout(300);
  await page.waitForFunction(() => document.querySelector('#cm-league')?.textContent !== '');
  await shot(page, 'menu-844');
  await page.click('#cm-daily');
  await page.waitForFunction(() => /#\d|—/.test(document.querySelector('#comp-sheet .cm-grid').textContent));
  await shot(page, 'daily-844');
  await resetCalls(page);
  await page.evaluate(() => { window.__game.api.settings.autoFire = false; });
  await page.click('#cm-go');
  const dailyStart = await page.evaluate(() => { const { api } = window.__game, d = api.competitive.dailyChallenge(); return { type: api.state.runType, seed: api.state.seed, diff: api.state.runDifficulty, slots: api.player.slots, want: d.slots }; });
  assert.equal(dailyStart.type, 'daily');
  assert.equal(dailyStart.diff, 'survivor');
  assert.deepEqual(dailyStart.slots, dailyStart.want);
  await page.waitForFunction(() => window.__game.api.competitive.rival.ready);
  await play(page, 30 * 25);
  await shot(page, 'hud-daily-844');
  await resetCalls(page);
  await endRun(page);
  assert.deepEqual(await submits(page), ['deadzone.daily.rookie']);
  assert.match(await page.textContent('#over-rank'), /DAILY RANK #\d/);
  ok('daily run submits only to deadzone.daily');

  await page.evaluate(() => { const { api } = window.__game; api.profile.iap[api.WEAPONS.find(w => w.id === 'tesla').productId] = true; api.profile.arsenal.primary = 'tesla'; api.profile.arsenal.secondary = 'r870'; api.saveProfile(); api.toMenu(); });
  const subs = await page.evaluate(() => {
    const { api } = window.__game, ids = s => s.map(i => api.WEAPONS[i].id), c = api.competitive;
    const r1 = ids(c.rankedLoadout().slots);
    api.profile.iap[api.WEAPONS.find(w => w.id === 'cryo').productId] = true;
    api.profile.arsenal.secondary = 'cryo';
    const r2 = ids(c.rankedLoadout().slots);
    api.profile.arsenal.primary = 'r870';
    const r3 = ids(c.rankedLoadout().slots);
    api.profile.arsenal.primary = 'tesla'; api.profile.arsenal.secondary = 'r870';
    return { r1, r2, r3, normal: ids(api.loadoutWeapons()) };
  });
  assert.deepEqual(subs, { r1: ['m4', 'r870'], r2: ['m4', 'r870'], r3: ['r870', 'm4'], normal: ['tesla', 'r870'] });
  await page.click('#cm-ranked');
  await page.waitForFunction(() => /#\d|—/.test(document.querySelector('#comp-sheet .cm-grid').textContent));
  assert.match(await page.textContent('#comp-sheet .cm-note'), /TESLA ARC IS OFF IN RANKED — USING M4A1 \+ R-870/);
  await shot(page, 'ranked-844');
  await page.evaluate(() => { window.__game.api.settings.autoFire = false; });
  await page.click('#cm-go');
  const rk = await page.evaluate(() => { const { api } = window.__game; return { type: api.state.runType, slots: api.player.slots.map(i => api.WEAPONS[i].id), toast: api.ui.toast.textContent }; });
  assert.deepEqual(rk.slots, ['m4', 'r870']);
  assert.equal(rk.type, 'ranked');
  assert.match(rk.toast, /TESLA ARC OFF/);
  ok('ranked substitutes premium weapons and tells the player');

  await page.waitForFunction(() => window.__game.api.competitive.rival.ready);
  const rival = await page.evaluate(() => {
    const g = window.__game, { api } = g, rv = api.competitive.rival, el = document.querySelector('#hud-rival');
    const first = { text: el.textContent, source: rv.source, top: rv.top, n: rv.entries.length };
    const passed = [];
    const off = api.bus.on('rival:passed', e => passed.push(e));
    const haptics = () => window.__gc.calls.filter(c => c.plugin === 'Haptics' && c.opts.style === 'MEDIUM').length;
    const h0 = haptics();
    api.state.score = 1500; api.bus.emit('wave:clear', {});
    const h1 = haptics();
    g.update(.1);
    const afterPass = { text: el.textContent, toast: api.ui.toast.textContent, imgs: el.querySelectorAll('img').length, xss: !!window.__xss };
    api.state.score = 2500; api.bus.emit('kill', {});
    const second = el.textContent;
    api.state.score = 45000; api.bus.emit('kill', {});
    off();
    return { first, afterPass, second, passed, hapticDelta: h1 - h0 };
  });
  assert.equal(rival.first.source, 'gc');
  assert.equal(rival.first.top, 171);
  assert.match(rival.first.text, /▲1,001TO PASSNightOwl#200 · WEEKLY/);
  assert.equal(rival.passed[0].name, 'NightOwl');
  assert.ok(rival.hapticDelta >= 1);
  assert.match(rival.afterPass.toast, /PASSED NightOwl/);
  assert.match(rival.afterPass.text, /501TO PASS<img src=x/);
  assert.equal(rival.afterPass.imgs, 0);
  assert.equal(rival.afterPass.xss, false);
  assert.match(rival.second, /PLAYER198/);
  await page.waitForFunction(() => window.__gc.calls.some(c => c.method === 'loadScores' && c.opts.start === 141 && c.opts.count === 30));
  await page.waitForFunction(() => /PLAYER156/.test(document.querySelector('#hud-rival').textContent));
  ok('live rival: window around player, passing toast + haptic, next target, loads more above');

  await page.evaluate(() => { const { api } = window.__game; api.state.score = 0; api.state.kills = 0; api.state.heads = 0; });
  await play(page, 30 * 25);
  await shot(page, 'hud-ranked-844');
  await resetCalls(page);
  await endRun(page);
  assert.deepEqual((await submits(page)).sort(), ['deadzone.bestwave', 'deadzone.highscore', 'deadzone.weekly']);
  await page.waitForFunction(() => /WEEKLY #/.test(document.querySelector('#over-extras').textContent));
  const lg = await page.evaluate(() => { const { api } = window.__game, l = api.profile.competitive.league; return { league: l, expect: api.competitive.leagueFor(l.rank, l.total).id, text: document.querySelector('#over-extras').textContent }; });
  assert.equal(lg.league.total, 201);
  assert.equal(lg.league.id, lg.expect);
  assert.match(lg.text, new RegExp(lg.league.id.toUpperCase()));
  await shot(page, 'over-ranked-844');
  ok('ranked run submits to weekly + all-time and shows league on game over');

  await page.click('#again');
  const again = await page.evaluate(() => { const { api } = window.__game; return { type: api.state.runType, slots: api.player.slots.map(i => api.WEAPONS[i].id) }; });
  assert.deepEqual(again, { type: 'ranked', slots: ['m4', 'r870'] });
  await play(page, 30 * 10);
  await resetCalls(page);
  await page.evaluate(() => { const { api } = window.__game; api.state.score = 987654321; });
  await endRun(page);
  assert.deepEqual(await submits(page), []);
  assert.match(await page.textContent('#over-rank'), /SCORE NOT SUBMITTED — SCORE TOO HIGH/);
  const cheats = await page.evaluate(() => {
    const { api } = window.__game, t = api.weaponIndex('tesla'), p = api.competitive.plausible, base = { type: 'normal', difficultyId: 'survivor', score: 20000, wave: 5, kills: 50, heads: 10, time: 120, bosses: [], slots: [0, 1] };
    return [p(base), p({ ...base, kills: 5000 }), p({ ...base, time: 1 }), p({ ...base, heads: 60 }), p({ ...base, score: NaN }), p({ ...base, type: 'ranked', slots: [t, 0] }), p({ ...base, type: 'normal', slots: [t, 0] })];
  });
  assert.equal(cheats[0], null);
  assert.ok(cheats.slice(1, 6).every(Boolean));
  assert.equal(cheats[6], null);
  ok('anti-cheat rejects absurd scores (and REDEPLOY replays ranked)');

  await page.evaluate(() => window.__game.api.toMenu());
  await resetCalls(page);
  await page.click('#start');
  assert.equal(await page.evaluate(() => window.__game.api.player.slots.map(i => window.__game.api.WEAPONS[i].id)[0]), 'tesla');
  await page.waitForFunction(() => window.__game.api.competitive.rival.ready);
  assert.match(await page.textContent('#hud-rival'), /ALL-TIME/);
  await play(page, 30 * 20);
  await resetCalls(page);
  await endRun(page);
  assert.deepEqual((await submits(page)).sort(), ['deadzone.bestwave', 'deadzone.highscore']);
  ok('normal run keeps premium weapons and submits to all-time only');

  await page.click('#over [data-open="board"]');
  await page.click('#cm-boards [data-board="weekly"]');
  await page.waitForFunction(() => window.__gc.calls.some(c => c.method === 'loadScores' && c.opts.leaderboardId === 'deadzone.weekly' && c.opts.count === 25));
  await page.waitForFunction(() => document.querySelectorAll('#board-list li').length > 5);
  assert.match(await page.textContent('.cm-board-note'), /RANKED RUNS/);
  await shot(page, 'board-844');
  ok('ranks board selector loads the chosen leaderboard');

  for (const [w, h] of SHOTS ? [[390, 844]] : []) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#board-close');
    await page.evaluate(() => window.__game.api.toMenu());
    await page.waitForTimeout(200);
    await shot(page, 'menu-' + w);
    await page.click('#cm-daily'); await page.waitForTimeout(200); await shot(page, 'daily-' + w);
    await page.click('#cm-back'); await page.click('#cm-ranked'); await page.waitForTimeout(200); await shot(page, 'ranked-' + w);
    await page.click('#cm-go'); await play(page, 30 * 15);
    await page.evaluate(() => { const { api } = window.__game; api.state.score = 1500; api.bus.emit('kill', {}); });
    await page.waitForTimeout(500); await shot(page, 'hud-ranked-' + w);
    await endRun(page); await page.waitForTimeout(1000); await shot(page, 'over-ranked-' + w);
    await page.click('#over [data-open="board"]'); await page.waitForTimeout(300); await shot(page, 'board-' + w);
  }
  assert.deepEqual(errors, []);
  await page.close();

  const b = await openGame(browser, url, {
    init: () => (localStorage.setItem('deadzone.tutorial', 'true'), localStorage.setItem('deadzone.runs', JSON.stringify([
      { score: 5000, wave: 4, kills: 40, diff: 'survivor', date: Date.now(), type: 'normal' },
      { score: 3000, wave: 3, kills: 30, diff: 'survivor', date: Date.now() },
      { score: 9000, wave: 5, kills: 60, diff: 'veteran', date: Date.now(), type: 'ranked', seed: null },
    ]))),
  });
  await b.page.click('#start');
  await b.page.waitForFunction(() => window.__game.api.competitive.rival.ready);
  const fb = await b.page.evaluate(() => {
    const g = window.__game, { api } = g, el = document.querySelector('#hud-rival'), first = el.textContent;
    api.state.score = 3500; api.bus.emit('kill', {}); g.update(.1);
    const second = el.textContent, toast = api.ui.toast.textContent;
    api.state.score = 9500; api.bus.emit('kill', {});
    return { first, second, toast, third: el.textContent, source: api.competitive.rival.source };
  });
  assert.equal(fb.source, 'local');
  assert.match(fb.first, /3,001TO PASSYOUR #3 RUNMY RUNS · ALL-TIME/);
  assert.match(fb.second, /1,501TO PASSYOUR #2 RUN/);
  assert.match(fb.toast, /PASSED YOUR #3 RUN/);
  assert.match(fb.third, /NEW PERSONAL BEST/);
  await b.page.evaluate(() => window.__game.api.toMenu());
  await b.page.click('#menu [data-open="board"]');
  await b.page.click('#cm-boards [data-board="weekly"]');
  assert.equal(await b.page.locator('#board-list li').count(), 1);
  await b.page.click('#cm-boards [data-board="alltime"]');
  assert.equal(await b.page.locator('#board-list li').count(), 3);
  assert.deepEqual(b.errors, []);
  ok('browser fallback: local runs as rivals and filtered boards');
} finally {
  await browser.close();
  server.close();
}
console.log(results.length + ' competitive checks passed');
