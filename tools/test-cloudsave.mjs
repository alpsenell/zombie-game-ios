import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ cloud = null, native = true, profile = null, runs = null } = {}) {
  return `(() => {
    const T = ${NOW}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      ${runs ? `localStorage.setItem('deadzone.runs', ${JSON.stringify(JSON.stringify(runs))});` : ''}
      localStorage.setItem('deadzone.tutorial', 'true');
    }
    window.__cloud = ${cloud ? JSON.stringify(JSON.stringify(cloud)) : 'null'};
    window.__calls = [];
    window.__listeners = [];
    ${native ? `window.Capacitor = {
      PluginHeaders: [{ name: 'CloudSave' }],
      Plugins: { CloudSave: { addListener: (name, fn) => { window.__listeners.push({ name, fn }); return { remove() {} }; } } },
      nativePromise(plugin, method, opts = {}) {
        window.__calls.push({ plugin, method, opts });
        if (plugin !== 'CloudSave') return Promise.reject(new Error('unmocked ' + plugin));
        if (method === 'read') return Promise.resolve({ key: opts.key, value: window.__cloud });
        if (method === 'write') { window.__cloud = opts.value; return Promise.resolve({ key: opts.key, synchronized: true }); }
        if (method === 'status') return Promise.resolve({ available: true });
        return Promise.reject(new Error('unmocked ' + method));
      },
    };` : ''}
  })();`;
}
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock(opts) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}
const writes = page => page.evaluate(() => window.__calls.filter(c => c.method === 'write').length);
const cloudProfile = page => page.evaluate(() => (window.__cloud ? JSON.parse(window.__cloud).profile : null));

const CLOUD_PROFILE = {
  loadout: { skin: 3, hair: 2, hairColor: 1, head: 0, face: 0, top: 1, topColor: 4, pants: 0, boots: 0, back: 0, gun: 1, title: 0, primary: 2, suit: 0, body: 0 },
  owned: { 'hair:2': true, 'topColor:4': true, 'gun:1': true }, scrap: 900, xp: 5000, kills: 420, heads: 60, bosses: { abomination: 1 }, bestWave: 11, bestByDiff: { survivor: 11 }, runs: 7, lastDaily: '', fresh: [], iap: {},
  arsenal: { owned: { mp7: true }, primary: 'mp7', secondary: 'r870' },
  progression: { mastery: { m4: 900, mp7: 400 }, prestige: {}, ach: { first_blood: 1, kills_100: 1 }, reported: {}, stats: { kills: 420, heads: 60, bosses: { abomination: 1 }, bestWave: 11, runs: 7 }, streak: { count: 4, best: 4, last: Math.floor(NOW / 864e5), claimed: Math.floor(NOW / 864e5), shown: Math.floor(NOW / 864e5), broken: 0 } },
  season: { n: 1, xp: 2500, free: [1, 2], premium: [], suits: {}, skins: {}, flair: {} },
};

{
  const page = await open({ cloud: null });
  const pure = await page.evaluate(async () => {
    const C = await import('./features/cloudsave.js');
    const local = { runs: 3, xp: 1000, scrap: 500, kills: 50, heads: 5, bestWave: 6, bosses: { abomination: 1 }, bestByDiff: { survivor: 6 }, owned: { 'hair:2': true }, iap: {}, arsenal: { owned: { mp7: true }, primary: 'mp7', secondary: 'r870' }, fresh: ['hair:2'], loadout: { hair: 2 }, coop: { name: 'SURVIVOR-ABC' },
      progression: { mastery: { m4: 100, mp7: 900 }, prestige: { m4: 1 }, ach: { first_blood: 1 }, reported: { first_blood: 100 }, rerolls: 1, reroll: '2026-09-30', streak: { count: 2, best: 9, last: 100, claimed: 100 }, stats: { kills: 50, bosses: { abomination: 1 } }, daily: { key: '2026-10-01', list: [{ id: 'daily:a:0', p: 3, done: false, claimed: false }, { id: 'daily:a:1', p: 1, done: true, claimed: true }] } },
      season: { n: 1, xp: 800, free: [1], premium: [], suits: {}, skins: {}, flair: { badge: 0 } }, competitive: { sprint: [{ cs: 90000, date: 1 }], daily: { date: '2026-10-01', best: 500 }, league: { id: 'gold', week: '2026-09-28', at: 5 } }, events: { won: { bloodmoon: 1 } }, checkpoint: { cleared: { survivor: 5 }, pick: { survivor: 5 } } };
    const cloud = { runs: 8, xp: 4000, scrap: 200, kills: 300, heads: 40, bestWave: 12, bosses: { butcher: 2 }, bestByDiff: { veteran: 4 }, owned: { 'top:2': true }, iap: { 'x.weapon.tesla': true }, arsenal: { owned: { ak: true }, primary: 'ak', secondary: 'm4' }, fresh: [], loadout: { hair: 5 },
      progression: { mastery: { m4: 2000, mp7: 100 }, prestige: {}, ach: { kills_100: 2 }, reported: { kills_100: 50 }, rerolls: 4, reroll: '2026-09-20', streak: { count: 3, best: 3, last: 101, claimed: null }, stats: { kills: 300, bosses: { butcher: 2 } }, daily: { key: '2026-10-01', list: [{ id: 'daily:a:0', p: 7, done: true, claimed: false }, { id: 'daily:a:1', p: 0, done: false, claimed: false }] } },
      season: { n: 1, xp: 1500, free: [1, 2], premium: [1], suits: { 1: true }, skins: {}, flair: { badge: 1 } }, competitive: { sprint: [{ cs: 80000, date: 2 }, { cs: 90000, date: 1 }], daily: { date: '2026-10-01', best: 900 }, league: { id: 'silver', week: '2026-09-28', at: 9 } }, events: { won: { scraprush: 2 } }, checkpoint: { cleared: { survivor: 3, veteran: 8 }, pick: { veteran: 5 } } };
    const m = C.mergeProfile(local, cloud);
    const pristine = C.mergeProfile({ runs: 0, xp: 0, kills: 0, scrap: 300, owned: {}, arsenal: { owned: {} } }, cloud);
    const noCloud = C.mergeProfile(local, null);
    const runs = C.mergeRuns([{ date: 1, score: 10, wave: 2, type: 'normal' }, { date: 2, score: 50, wave: 5, type: 'normal' }], [{ date: 2, score: 50, wave: 5, type: 'normal' }, { date: 3, score: 30, wave: 3, type: 'daily' }]);
    const rec = C.mergeRecords({ score: 100, wave: 5, rank: 40 }, { score: 500, wave: 4, rank: 12 });
    const target = { a: { b: 1, keep: { x: 1 } }, gone: 1 }, inner = target.a, keep = target.a.keep;
    C.assignDeep(target, { a: { b: 2, keep: { x: 2, y: 3 } }, added: [1] });
    return { m, pristine: pristine.runs, noCloud: noCloud.runs, runs: runs.map(r => r.score), rec, deep: { same: target.a === inner && target.a.keep === keep, target } };
  });
  const m = pure.m;
  check(m.runs === 8 && m.loadout.hair === 5 && m.scrap === 500 && m.xp === 4000 && m.kills === 300 && m.bestWave === 12, 'higher-runs profile is the base, currencies and counters take the max', { runs: m.runs, scrap: m.scrap, xp: m.xp, hair: m.loadout.hair });
  check(m.owned['hair:2'] && m.owned['top:2'] && m.iap['x.weapon.tesla'] && m.arsenal.owned.mp7 && m.arsenal.owned.ak && m.arsenal.primary === 'ak' && m.fresh.includes('hair:2') && m.coop?.name === 'SURVIVOR-ABC', 'ownership is unioned and local-only keys survive', { owned: m.owned, arsenal: m.arsenal, coop: m.coop });
  check(m.bosses.abomination === 1 && m.bosses.butcher === 2 && m.bestByDiff.survivor === 6 && m.bestByDiff.veteran === 4, 'per-key stats take the max');
  const p = m.progression;
  check(p.mastery.m4 === 2000 && p.mastery.mp7 === 900 && p.prestige.m4 === 1 && p.ach.first_blood && p.ach.kills_100 && p.reported.first_blood === 100 && p.rerolls === 4 && p.reroll === '2026-09-30', 'mastery, prestige, achievements and rerolls merge', { mastery: p.mastery, prestige: p.prestige, ach: Object.keys(p.ach), reroll: p.reroll });
  check(p.streak.last === 101 && p.streak.count === 3 && p.streak.best === 9, 'the streak with the later visit wins, best is kept', p.streak);
  check(p.stats.kills === 300 && p.stats.bosses.abomination === 1 && p.stats.bosses.butcher === 2, 'achievement stats merge per key', p.stats);
  check(p.daily.list[0].p === 7 && p.daily.list[0].done && !p.daily.list[0].claimed && p.daily.list[1].claimed, 'same-day missions merge progress and claims', p.daily.list);
  check(m.season.xp === 1500 && m.season.free.join() === '1,2' && m.season.premium.join() === '1' && m.season.suits[1] && m.season.flair.badge === 1, 'same season: XP max, claims unioned', m.season);
  check(m.competitive.sprint.map(x => x.cs).join() === '80000,90000' && m.competitive.daily.best === 900 && m.competitive.league.id === 'silver', 'competitive: sprint union, best of the day, latest league', m.competitive);
  check(m.events.won.bloodmoon && m.events.won.scraprush && m.checkpoint.cleared.survivor === 5 && m.checkpoint.cleared.veteran === 8 && m.checkpoint.pick.veteran === 5, 'events and checkpoints union', { events: m.events, checkpoint: m.checkpoint });
  check(pure.pristine === 8 && pure.noCloud === 3, 'a pristine local profile takes the cloud copy; no cloud keeps local', [pure.pristine, pure.noCloud]);
  check(pure.runs.join() === '50,30,10' && pure.rec.score === 500 && pure.rec.wave === 5 && pure.rec.rank === 12, 'runs dedupe and sort, records take the best', { runs: pure.runs, rec: pure.rec });
  check(pure.deep.same && pure.deep.target.a.b === 2 && pure.deep.target.a.keep.y === 3 && pure.deep.target.gone === 1 && pure.deep.target.added[0] === 1, 'assignDeep keeps nested object identity and local-only keys', pure.deep);

  await page.evaluate(() => window.__game.api.grantScrap(10));
  await page.waitForTimeout(2200);
  const n = await writes(page), cp = await cloudProfile(page);
  check(n === 1 && cp && cp.scrap === 310, 'a local save pushes the profile to iCloud once (debounced)', { writes: n, scrap: cp?.scrap });
  await page.evaluate(() => { const { api } = window.__game; api.grantScrap(5); api.grantScrap(5); api.saveProfile(); });
  await page.waitForTimeout(2200);
  check((await writes(page)) === 2 && (await cloudProfile(page)).scrap === 320, 'several saves in a row collapse into one push', await writes(page));
  const same = await page.evaluate(() => window.__game.api.cloud.pull());
  check(same?.action === 'same', 'reading back this device\'s own payload is a no-op', same);
  await page.close();
}

{
  const page = await open({ cloud: { v: 1, at: NOW - 60000, device: 'otherdev', profile: CLOUD_PROFILE, runs: [{ score: 42000, wave: 11, kills: 300, diff: 'survivor', date: NOW - 1e6, type: 'normal' }], records: { score: 42000, wave: 11, rank: 77 } } });
  const r = await page.evaluate(() => {
    const { api } = window.__game;
    return { scrap: api.profile.scrap, xp: api.profile.xp, runs: api.profile.runs, mp7: api.weaponOwned(api.WEAPONS.find(w => w.id === 'mp7')), primary: api.profile.arsenal.primary, level: document.querySelector('#menu-level').textContent, best: document.querySelector('#best-score').textContent, note: document.querySelector('.cs-note').textContent, mastery: api.progression.mastery('m4').level, streak: document.querySelector('#menu-extras .pg-btn:nth-child(2)')?.textContent, season: api.season.state().xp, localRuns: api.store.get('runs', []).length, meta: api.cloud.meta.restoredAt > 0 };
  });
  check(r.scrap === 900 && r.xp === 5000 && r.runs === 7 && r.mp7 && r.primary === 'mp7', 'fresh install restores the iCloud profile', r);
  check(r.level === 'LV 3' && r.best === '42,000' && r.localRuns === 1 && r.mastery === 3 && r.season === 2500 && /DAY 4/.test(r.streak), 'menu, records, mastery, season and streak reflect the restored data', r);
  check(/RESTORED/.test(r.note) && r.meta, 'player is told progress was restored', r.note);
  await page.waitForTimeout(2200);
  check((await writes(page)) >= 1, 'the merged profile is pushed back');
  await page.close();
}

{
  const page = await open({ cloud: null, profile: { scrap: 1000, xp: 200, runs: 2, kills: 20, owned: {}, loadout: {}, arsenal: { owned: {} } } });
  const r = await page.evaluate(async () => {
    const { api } = window.__game;
    api.startGame({ map: 'street' });
    const newer = { v: 1, at: Date.now(), device: 'otherdev', profile: { ...JSON.parse(JSON.stringify(api.profile)), scrap: 5000, runs: 9, xp: 9000, levels: { paid: 4 } }, runs: [], records: { score: 1, wave: 1, rank: 0 } };
    window.__cloud = JSON.stringify(newer);
    window.__listeners.find(l => l.name === 'changed')?.fn({ reason: 0, keys: ['deadzone.save'] });
    const r = await api.cloud.pull('external');
    const during = { scrap: api.profile.scrap, pending: !!api.cloud.pending, action: r?.action };
    api.gameOver();
    api.toMenu();
    return { during, after: api.profile.scrap, pendingAfter: !!api.cloud.pending };
  });
  check(r.during.action === 'deferred' && r.during.pending && r.during.scrap === 1000, 'a cloud change during a run is held back', r.during);
  check(r.after === 5000 && !r.pendingAfter, 'the held-back change is applied on returning to the menu', r);
  await page.close();
}

{
  const page = await open({ cloud: null, native: false });
  const r = await page.evaluate(async () => {
    const { api } = window.__game;
    api.grantScrap(1);
    const pull = await api.cloud.pull();
    document.querySelector('[data-open="settings"]').click();
    return { pull, available: api.cloud.available(), status: document.querySelector('#cs-status').textContent, hidden: document.querySelector('#cs-sync').classList.contains('hidden') };
  });
  check(r.pull === null && !r.available && /iOS app/.test(r.status) && r.hidden, 'without the plugin the feature stays inert and says so in settings', r);
  await page.close();
}

{
  const page = await open({ cloud: null });
  await page.evaluate(() => document.querySelector('[data-open="settings"]').click());
  await page.waitForTimeout(300);
  await page.click('#cs-sync');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ status: document.querySelector('#cs-status').textContent, calls: window.__calls.map(c => c.method) }));
  check(/Backed up/.test(r.status) && r.calls.includes('status') && r.calls.includes('write'), 'SYNC NOW pulls, pushes and reports the backup time', r);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL CLOUD SAVE CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
