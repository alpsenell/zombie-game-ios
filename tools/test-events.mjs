import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const DAY = 864e5;
const SAT = Date.UTC(2026, 8, 26, 12), MON = Date.UTC(2026, 8, 28, 12), SCRAP_SAT = Date.UTC(2026, 9, 3, 12), HEAD_SAT = Date.UTC(2026, 9, 10, 12), HORDE_SAT = Date.UTC(2026, 9, 17, 12), WED = Date.UTC(2026, 8, 30, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ now, profile }) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});
    const others = n => Array.from({ length: n }, (_, i) => ({ name: 'PLAYER' + (i + 1), score: 200000 - i * 1000, context: 0 }));
    const boards = {};
    for (const id of ['deadzone.highscore', 'deadzone.bestwave', 'deadzone.daily', 'deadzone.daily.rookie', 'deadzone.weekly', 'deadzone.weekly.veteran', 'deadzone.weekly.survivor', 'deadzone.extract', 'deadzone.sprint20']) boards[id] = { others: [], me: null };
    boards['deadzone.event'] = { others: others(100), me: null };
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
const PROFILE = { runs: 3, bestWave: 5, scrap: 300, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } }, events: { won: { scraprush: 123 } } };
async function open({ now = SAT, profile = PROFILE } = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock({ now, profile }) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const endRun = (page, score, opts = { map: 'street' }) => page.evaluate(async ({ score, opts }) => {
  const g = window.__game, { api } = g, events = [];
  api.levels.state.paid = 99;
  window.__calls.length = 0;
  const off = api.bus.on('event:goal', e => events.push(e));
  const scrap0 = api.profile.scrap;
  api.startGame(opts);
  const live = { ...api.live };
  Object.assign(api.state, { score, wave: 12, kills: 120, heads: 20, clock: 400 });
  g.gameOver();
  await new Promise(r => setTimeout(r, 500));
  const chips = [...document.querySelectorAll('#over-rewards span')].map(s => s.textContent);
  const base = +(chips[0].match(/\+([\d,]+)/)[1].replace(/,/g, ''));
  return { live, events, scrapDelta: api.profile.scrap - scrap0 - base, chips, over: document.querySelector('#ev-over').textContent, submits: window.__calls.filter(c => c.method === 'submitScore').map(c => c.opts.leaderboardId).sort(), won: JSON.parse(JSON.stringify(api.profile.events.won)), ladder: JSON.parse(JSON.stringify(api.profile.events.ladder)), top: api.reqMet('eventtop:bloodmoon'), fresh: api.profile.fresh.slice() };
}, { score, opts });

{
  const page = await open();
  const pure = await page.evaluate(async ({ MON }) => {
    const E = await import('./features/events.js'), C = await import('./features/cloudsave.js');
    const ev = E.eventAt();
    const m = C.mergeProfile({ runs: 2, events: { won: { bloodmoon: 5 } } }, { runs: 1, events: { won: { bloodmoon: { skin: 7, score: 9 }, scraprush: 4 }, ladder: { bloodmoon: { score: 100, rank: 3, total: 50 } } } });
    return {
      normal: E.modsFor(ev, 'normal'), ranked: E.modsFor(ev, 'ranked'), coop: E.modsFor(ev, 'coop').event,
      ladder: [E.ladderRun('normal'), E.ladderRun(undefined), E.ladderRun('ranked'), E.ladderRun('extract'), E.ladderRun('normal', MON)],
      top: [E.topRank(2, 20), E.topRank(3, 20), E.topRank(1, 10), E.topRank(10, 100), E.topRank(11, 100)],
      goals: [E.goalsOf({ events: { won: { x: 5 } } }, 'x').skin, E.goalCount({ skin: 1, board: 2 }), E.goalCount(null)],
      merged: m.events,
      twists: E.EVENTS.map(e => e.twist),
    };
  }, { MON });
  check(pure.normal.eliteHeadOnly === true && pure.normal.event === true && pure.normal.elite === .08 && pure.ranked.eliteHeadOnly === false && pure.ranked.event === false && pure.ranked.scrap === 1.5 && pure.coop === false, 'twists and the event flag apply to normal deploys only', [pure.normal, pure.ranked]);
  check(pure.ladder.join() === 'true,true,false,false,false', 'ladder runs are normal deploys during a live event', pure.ladder);
  check(pure.top.join() === 'true,false,false,true,false', 'top 10% needs at least 20 players on the board', pure.top);
  check(pure.goals.join() === '5,2,0' && pure.merged.won.bloodmoon.skin === 5 && pure.merged.won.bloodmoon.score === 9 && pure.merged.won.scraprush.skin === 4 && pure.merged.ladder.bloodmoon.score === 100 && pure.merged.ladder.bloodmoon.rank === 3, 'goal helpers and the cloud merge keep every goal from both devices', pure);
  check(pure.twists.every(Boolean) && pure.twists.length === 4, 'every event names its twist', pure.twists);

  const menu = await page.evaluate(() => {
    const { api } = window.__game;
    api.events.open();
    const card = document.querySelector('.ev-card');
    const out = { won: JSON.parse(JSON.stringify(api.profile.events.won)), met: [api.reqMet('event:scraprush'), api.reqMet('eventtop:scraprush'), api.reqMet('event:bloodmoon')], text: api.reqText('eventtop:bloodmoon'), chip: document.querySelector('#ev-chip').textContent, goals: [...card.querySelectorAll('.ev-goal')].map(g => g.textContent), card: card.textContent, board: !!card.querySelector('#ev-board'), boards: [api.gameCenter.boards('normal', { event: true }), api.gameCenter.boards('normal', { event: false }), api.gameCenter.boards('ranked', { event: true, difficultyId: 'survivor' })] };
    return out;
  });
  check(menu.won.scraprush?.skin === 123 && menu.met.join() === 'true,false,false' && /TOP 10%/.test(menu.text) && /BLOOD MOON/.test(menu.text), 'old event wins migrate to the ladder shape', menu.won);
  check(/LIVE · 0\/3/.test(menu.chip) && menu.goals.length === 3 && /ECLIPSE WEAPON SKIN/.test(menu.goals[0]) && /50,000/.test(menu.goals[1]) && /ECLIPSE PRIME/.test(menu.goals[2]) && /ELITES DROP HEALTH ONLY ON HEADSHOTS/.test(menu.card) && /LADDER · 0 \/ 3/.test(menu.card) && menu.board, 'the event card shows the three-goal ladder and the twist', { chip: menu.chip, goals: menu.goals });
  check(menu.boards[0].includes('deadzone.event') && !menu.boards[1].includes('deadzone.event') && !menu.boards[2].includes('deadzone.event'), 'only event deploys submit to the event board', menu.boards);
  await page.screenshot({ path: '/tmp/event-card.png' });
  await page.evaluate(() => window.__game.api.events.close());

  const r1 = await endRun(page, 190500);
  check(r1.live.eliteHeadOnly && r1.live.event && r1.submits.join() === 'deadzone.bestwave,deadzone.event,deadzone.highscore', 'an event deploy plays the twist and submits to the event board', { live: r1.live, submits: r1.submits });
  check(r1.scrapDelta === 1500 && r1.won.bloodmoon?.score > 0 && r1.events[0]?.goal === 'score' && r1.chips.some(c => /EVENT GOAL/.test(c)) && r1.ladder.bloodmoon.score === 190500, 'scoring 50,000 in one event deploy pays 1,500 scrap once', { scrap: r1.scrapDelta, won: r1.won, chips: r1.chips });
  check(/EVENT RANK #11 \/ 101/.test(r1.over) && /LADDER 1\/3/.test(r1.over) && !r1.top && r1.ladder.bloodmoon.rank === 11, 'rank 11 of 101 is outside the top 10%', { over: r1.over, ladder: r1.ladder });
  await page.screenshot({ path: '/tmp/event-over.png' });

  const r2 = await endRun(page, 195500);
  const prime = await page.evaluate(() => window.__game.api.SLOTS.find(s => s.id === 'gun').items.findIndex(it => it.req === 'eventtop:bloodmoon'));
  check(r2.scrapDelta === 0 && r2.top && r2.events.some(e => e.goal === 'board') && r2.fresh.includes('gun:' + prime) && /EVENT RANK #6 \/ 101/.test(r2.over) && /LADDER 2\/3/.test(r2.over), 'a top 10% rank unlocks the animated skin and the score goal does not pay twice', { scrap: r2.scrapDelta, over: r2.over, events: r2.events });

  const r3 = await page.evaluate(() => {
    const { api } = window.__game;
    api.startGame({ map: 'street' });
    api.bus.emit('wave:clear', { wave: 10 });
    const won = api.reqMet('event:bloodmoon');
    api.gameOver();
    api.toMenu();
    return { won, chip: document.querySelector('#ev-chip').textContent, count: api.events.goals('bloodmoon') };
  });
  check(r3.won && /LADDER COMPLETE/.test(r3.chip) && r3.count.skin && r3.count.score && r3.count.board, 'clearing wave 10 completes the ladder', r3);

  const mission = await page.evaluate(() => {
    const { api } = window.__game, pg = api.progression, list = pg.state.daily.list, m = list[3];
    const text = m && pg.data.missionText(m, { maps: api.MAPS, weaponName: () => '' });
    if (m) { m.p = 0; m.done = false; }
    api.startGame({ type: 'ranked' });
    api.bus.emit('wave:clear', { wave: 6 });
    const ranked = m?.p;
    api.startGame({ map: 'street' });
    api.bus.emit('wave:clear', { wave: 6 });
    const normal = { p: m?.p, done: m?.done };
    api.gameOver(); api.toMenu();
    return { n: list.length, t: m?.t, arg: m?.arg, text, ranked, normal, scrap: m?.scrap };
  });
  check(mission.n === 4 && mission.t === 'event' && mission.arg === 'bloodmoon' && mission.text === 'CLEAR WAVE 6 IN A BLOOD MOON RUN' && mission.ranked === 0 && mission.normal.p === 6 && mission.normal.done, 'an extra daily mission counts event deploys only', mission);

  const tab = await page.evaluate(async () => {
    const { api } = window.__game;
    api.competitive.openBoard('event');
    await new Promise(r => setTimeout(r, 300));
    const on = document.querySelector('#cm-boards button.on');
    return { board: on?.dataset.board, hidden: on?.classList.contains('hidden'), note: document.querySelector('.cm-board-note').textContent, id: api.boardView.id };
  });
  check(tab.board === 'event' && !tab.hidden && /BLOOD MOON EVENT/.test(tab.note) && tab.id === 'deadzone.event', 'the RANKS screen has an EVENT tab while the event is live', tab);
  await page.close();
}

{
  const page = await open({ now: SCRAP_SAT, profile: { ...PROFILE, events: { won: {} } } });
  const bag = await page.evaluate(async () => {
    const g = window.__game, { api } = g;
    api.levels.state.paid = 99;
    api.startGame({ map: 'street' });
    const live = { ...api.live };
    let frames = 0, bag = null;
    while (frames++ < 1500 && api.state.mode === 'playing' && !bag) { g.update(1 / 30); bag = api.pickups.find(p => p.userData.kind === 'scrap') || null; }
    const seen = !!bag, life = bag?.userData.t, mode = api.state.mode;
    if (bag) { bag.position.set(api.camera.position.x, bag.position.y, api.camera.position.z); g.update(1 / 30); }
    const bonus = api.state.bonusScrap;
    g.gameOver();
    await new Promise(r => setTimeout(r, 300));
    return { live: live.scrapBag, seen, life, mode, bonus, frames, chips: [...document.querySelectorAll('#over-rewards span')].map(s => s.textContent), summary: api.runSummary().bonusScrap };
  });
  check(bag.live === 20 && bag.seen && bag.life <= 10 && bag.bonus === 50 && bag.summary === 50 && bag.chips.some(c => /\+50 🔩 FROM SCRAP BAGS/.test(c)), 'Scrap Rush drops timed scrap bags worth 50 scrap', bag);
  await page.close();
}

{
  const page = await open({ now: HORDE_SAT, profile: { ...PROFILE, events: { won: {} } } });
  const horde = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.startGame({ map: 'street' });
    const live = { ...api.live };
    let frames = 0;
    while (frames++ < 400 && api.state.between) g.update(1 / 30);
    api.state.wave = 20;
    api.state.queue = Array.from({ length: 40 }, () => ({ kind: 'walker', elite: false }));
    api.state.spawnGap = 0;
    let peak = 0;
    for (let i = 0; i < 360 && api.state.mode === 'playing'; i++) { g.update(1 / 30); peak = Math.max(peak, api.zombies.filter(z => !z.userData.dead).length); }
    g.gameOver();
    return { alive: live.alive, count: live.count, peak };
  });
  check(horde.alive === 24 && horde.count === 1.3 && horde.peak > 16 && horde.peak <= 24, 'Horde Night lets up to 24 infected on the field', horde);
  await page.close();
}

{
  const page = await open({ now: HEAD_SAT, profile: { ...PROFILE, events: { won: {} } } });
  const head = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.settings.aimAssist = true;
    api.startGame({ map: 'street' });
    const live = { ...api.live };
    let frames = 0;
    while (frames++ < 400 && api.state.between) g.update(1 / 30);
    api.makeZombie('walker', api.camera.position.x, api.camera.position.z - 4, false, false);
    const assists = [];
    for (let i = 0; i < 30; i++) { api.look.yaw = 0; api.look.pitch = 0; g.update(1 / 30); assists.push(api.look.assist); }
    g.gameOver();
    return { noAssist: live.noAssist, headScore: live.headScore, assist: Math.min(...assists) };
  });
  check(head.noAssist === true && head.headScore === 2 && head.assist === 1, 'Headhunter turns aim assist off', head);
  await page.close();
}

{
  const page = await open({ now: SAT, profile: { ...PROFILE, events: { won: {} } } });
  const moon = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.startGame({ map: 'street' });
    let frames = 0;
    while (frames++ < 400 && api.state.between) g.update(1 / 30);
    api.stats.luck = 1000;
    const kinds = head => {
      api.pickups.splice(0).forEach(p => api.scene.remove(p));
      const z = api.makeZombie('walker', api.camera.position.x + 3, api.camera.position.z + 3, false, true);
      api.netHooks.killZombie(z, head, false);
      return api.pickups.map(p => p.userData.kind);
    };
    const body = [kinds(false), kinds(false), kinds(false)].flat(), heads = [kinds(true), kinds(true)].flat();
    g.gameOver();
    return { body, heads };
  });
  check(moon.body.length >= 3 && moon.body.every(k => k !== 'health') && moon.heads.length >= 2 && moon.heads.every(k => k === 'health'), 'Blood Moon elites drop health only on headshots', moon);
  await page.close();
}

{
  const page = await open({ now: WED });
  const off = await page.evaluate(async () => {
    const { api } = window.__game, pg = api.progression;
    api.startGame({ map: 'street' });
    const live = { ...api.live };
    api.gameOver(); api.toMenu();
    api.competitive.openBoard('event');
    await new Promise(r => setTimeout(r, 300));
    return { n: pg.state.daily.list.length, chip: document.querySelector('#ev-chip').textContent, event: live.event, alive: live.alive, bags: live.scrapBag, tab: document.querySelector('#cm-boards button.on')?.dataset.board, hidden: document.querySelector('#cm-boards [data-board="event"]').classList.contains('hidden') };
  });
  check(off.n === 3 && /WEEKEND EVENT IN/.test(off.chip) && off.event === false && off.alive === 0 && off.bags === 0 && off.tab === 'alltime' && off.hidden, 'nothing from the ladder leaks outside the event window', off);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL EVENT CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
