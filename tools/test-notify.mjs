import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const DAY = 864e5, H = 36e5;
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

function mock({ status = 'notDetermined', native = true, profile = null } = {}) {
  return `(() => {
    const T = ${NOW}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      localStorage.setItem('deadzone.tutorial', 'true');
    }
    window.__status = ${JSON.stringify(status)};
    window.__calls = [];
    window.__pending = [];
    ${native ? `window.Capacitor = {
      PluginHeaders: [{ name: 'Notify' }],
      Plugins: {},
      nativePromise(plugin, method, opts = {}) {
        window.__calls.push({ plugin, method, opts });
        if (plugin !== 'Notify') return Promise.reject(new Error('unmocked ' + plugin));
        if (method === 'status') return Promise.resolve({ status: window.__status });
        if (method === 'request') { if (window.__status === 'notDetermined') window.__status = window.__grant === false ? 'denied' : 'authorized'; return Promise.resolve({ granted: window.__status === 'authorized', status: window.__status }); }
        if (method === 'schedule') { window.__pending.push(...opts.notifications); return Promise.resolve({ scheduled: opts.notifications.map(n => n.id) }); }
        if (method === 'cancelAll') { window.__pending = []; return Promise.resolve({}); }
        if (method === 'clearDelivered') return Promise.resolve({});
        if (method === 'pending') return Promise.resolve({ ids: window.__pending.map(n => n.id) });
        return Promise.reject(new Error('unmocked ' + method));
      },
    };` : ''}
  })();`;
}
async function open(opts = {}) {
  const { page, errors } = await openGame(browser, url, { init: { content: mock(opts) } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  return page;
}
const calls = (page, m) => page.evaluate(m => window.__calls.filter(c => c.method === m).length, m);
const pending = page => page.evaluate(() => window.__pending.map(n => ({ id: n.id, at: n.at, title: n.title, body: n.body })));

{
  const page = await open();
  const pure = await page.evaluate(async ({ NOW, DAY, H }) => {
    const N = await import('./features/notify.js'), E = await import('./features/events.js');
    const today = Math.floor(NOW / DAY);
    const base = { streak: { count: 5, last: today }, daily: { date: '2026-10-01', rank: 42, best: 31000 }, league: { id: 'gold' }, event: { ...E.eventAt(NOW), won: false, skin: 'ECLIPSE' }, lastPlay: NOW, bestWave: 14 };
    const utc = N.planFor(base, NOW, 0), ist = N.planFor(base, NOW, 180), la = N.planFor(base, NOW, -420), syd = N.planFor(base, NOW, 600);
    const kinds = l => l.map(n => n.kind);
    const find = (l, k) => l.find(n => n.kind === k);
    const day1 = N.planFor({ streak: { count: 1, last: today }, lastPlay: NOW }, NOW, 0);
    const none = N.planFor({ lastPlay: NOW }, NOW, 0);
    const live = N.planFor({ event: { ...E.eventAt(Date.UTC(2026, 9, 3, 12)), won: true }, lastPlay: NOW }, Date.UTC(2026, 9, 3, 12), 0);
    const localHour = (t, tz) => (((t + tz * 6e4) % DAY) + DAY) % DAY / H;
    return {
      utc: { kinds: kinds(utc), streak: find(utc, 'streak'), daily: find(utc, 'daily'), league: find(utc, 'league'), event: find(utc, 'event'), lapse: utc.filter(n => n.kind === 'lapse').map(n => n.at) },
      ist: { streakHour: localHour(find(ist, 'streak').at, 180), streakAt: find(ist, 'streak').at, body: find(ist, 'streak').body, daily: !!find(ist, 'daily'), event: !!find(ist, 'event') },
      la: { streakHour: localHour(find(la, 'streak').at, -420), dailyHour: localHour(find(la, 'daily').at, -420), dailyBody: find(la, 'daily').body, event: !!find(la, 'event') },
      syd: { streakHour: localHour(find(syd, 'streak').at, 600), streakAt: find(syd, 'streak').at, daily: !!find(syd, 'daily') },
      perDay: [utc, ist, la, syd].every(l => new Set(l.map(n => Math.floor((n.at + 0) / DAY))).size <= l.length),
      day1: find(day1, 'streak'), none: kinds(none), live: kinds(live), eventStart: E.eventAt(NOW).start,
      eventOnly: N.planFor({ event: { ...E.eventAt(NOW), won: false, skin: 'ECLIPSE' }, lastPlay: NOW }, NOW, 0).find(n => n.kind === 'event'),
    };
  }, { NOW, DAY, H });
  const u = pure.utc, deadline = (Math.floor(NOW / DAY) + 2) * DAY;
  check(u.kinds.join() === 'daily,streak,lapse,league,lapse', 'UTC plan: one per local day in time order (daily today, streak Friday, lapse Sunday, league Monday, lapse +7)', u.kinds);
  check(u.streak.at === deadline - 4 * H && /5-day streak/.test(u.streak.title) && /before 00:00/.test(u.streak.body) && /200 scrap/.test(u.streak.body), 'streak reminder 4 h before the UTC day ends with the next reward', u.streak);
  check(!u.event && /SCRAP RUSH is live too/.test(u.streak.body), 'an event starting on a day that already has a reminder is folded into it', u.streak.body);
  check(u.daily.at === NOW + 10 * H && /#42/.test(u.daily.title) && /31,000/.test(u.daily.body), 'daily reminder 2 h before reset (22:00 local allowed) with rank and best', u.daily);
  check(u.league.at === Date.UTC(2026, 9, 5, 9) && /GOLD League/.test(u.league.title) && /800 scrap/.test(u.league.body), 'league reminder moved from 00:00 to 09:00 local on Monday', u.league);
  check(u.lapse.length === 2 && u.lapse[0] === Date.UTC(2026, 9, 4, 19) && u.lapse[1] === Date.UTC(2026, 9, 8, 19), 'lapse reminders on day 3 and day 7 at 19:00 local', u.lapse);
  check(pure.eventOnly && pure.eventOnly.at === Date.UTC(2026, 9, 2, 9) && /SCRAP RUSH is live/.test(pure.eventOnly.title) && /ECLIPSE/.test(pure.eventOnly.body), 'on its own the event reminder moves from 00:00 UTC to 09:00 local', pure.eventOnly);
  check(pure.ist.streakHour === 20 && pure.ist.streakAt < deadline - H && /before 03:00/.test(pure.ist.body) && !pure.ist.daily && !pure.ist.event, 'UTC+3: streak at 20:00 local naming the 03:00 deadline, daily (01:00 local) dropped, event folded', pure.ist);
  check(pure.la.streakHour === 13 && pure.la.dailyHour === 15 && !pure.la.event && /is live too/.test(pure.la.dailyBody), 'UTC-7: streak at 13:00 (4 h before a 17:00 deadline), daily at 15:00 carries the event', pure.la);
  check(pure.syd.streakHour === 20 && pure.syd.streakAt < deadline - H && !pure.syd.daily, 'UTC+10: streak the evening before a 10:00 deadline outranks the 08:00 daily reminder', pure.syd);
  check(/Day 2 reward/.test(pure.day1.title) && /75 scrap/.test(pure.day1.body), 'first-day players get the day 2 nudge', pure.day1);
  check(pure.none.join() === 'lapse,lapse', 'with nothing to protect only the lapse reminders remain', pure.none);
  check(!pure.live.includes('event'), 'no event reminder while the event is live', pure.live);

  const first = await page.evaluate(() => ({ status: window.__game.api.notify.state.status, requested: window.__calls.some(c => c.method === 'request'), scheduled: window.__calls.some(c => c.method === 'schedule') }));
  check(first.status === 'notDetermined' && !first.requested && !first.scheduled, 'launch only reads the permission state, never prompts', first);
  const claimed = await page.evaluate(() => new Promise(res => { const { api } = window.__game; let ev = null; api.bus.on('streak:claim', e => (ev = e)); document.querySelector('.pg-modal .cta.gold').click(); setTimeout(() => res(ev), 1700); }));
  check(claimed && claimed.count === 1 && claimed.total === 50, 'claiming the streak emits streak:claim', claimed);
  const afterClaim = await page.evaluate(() => ({ asked: window.__game.api.notify.state.asked, status: window.__game.api.notify.state.status, requested: window.__calls.filter(c => c.method === 'request').length }));
  check(afterClaim.asked && afterClaim.status === 'authorized' && afterClaim.requested === 1, 'the first streak claim asks for permission once', afterClaim);
  await page.waitForTimeout(300);
  const p = await pending(page);
  check(p.length >= 3 && p.some(n => n.id.startsWith('streak:')) && p.some(n => n.id.startsWith('lapse:')), 'reminders are scheduled after permission', p.map(n => n.id));
  const n0 = await calls(page, 'schedule');
  await page.evaluate(() => { const { api } = window.__game; api.showScreen(api.ui.menu); api.showScreen(api.ui.menu); });
  await page.waitForTimeout(1200);
  check((await calls(page, 'schedule')) === n0, 'returning to the menu with nothing changed does not reschedule', await calls(page, 'schedule'));
  await page.evaluate(() => { const { api } = window.__game; api.profile.competitive = { ...api.profile.competitive, daily: { date: '2026-10-01', rank: 7, total: 100, best: 9000 } }; api.bus.emit('run:submitted', { type: 'daily', board: 'deadzone.daily', result: { rank: 7, total: 100 } }); });
  await page.waitForTimeout(1200);
  const p2 = await pending(page);
  const dailyOk = await page.evaluate(() => { const tz = -new Date().getTimezoneOffset(), h = (((22 * 60 + tz) % 1440) + 1440) % 1440 / 60; return h >= 8 && h <= 22; });
  check(!dailyOk || p2.some(n => n.id.startsWith('daily:') && /#7/.test(n.title)), 'a Daily rank adds the closing reminder', p2.map(n => n.title));

  await page.evaluate(() => document.querySelector('[data-open="settings"]').click());
  await page.waitForTimeout(300);
  const rowOn = await page.evaluate(() => ({ on: document.querySelector('#nt-toggle').classList.contains('on'), text: document.querySelector('#nt-status').textContent }));
  check(rowOn.on && /at most one a day/.test(rowOn.text), 'settings shows reminders on', rowOn);
  await page.click('#nt-toggle');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({ enabled: window.__game.api.notify.state.enabled, pending: window.__pending.length, text: document.querySelector('#nt-status').textContent }));
  check(!off.enabled && off.pending === 0 && off.text === 'Off', 'turning reminders off cancels everything', off);
  await page.click('#nt-toggle');
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ enabled: window.__game.api.notify.state.enabled, pending: window.__pending.length }));
  check(on.enabled && on.pending >= 3, 'turning reminders back on reschedules', on);
  await page.close();
}

{
  const page = await open({ status: 'denied' });
  await page.evaluate(() => document.querySelector('.pg-modal .cta.gold').click());
  await page.waitForTimeout(1700);
  const r = await page.evaluate(() => { document.querySelector('[data-open="settings"]').click(); return { requested: window.__calls.some(c => c.method === 'request'), scheduled: window.__calls.some(c => c.method === 'schedule'), text: document.querySelector('#nt-status').textContent, on: document.querySelector('#nt-toggle').classList.contains('on') }; });
  check(!r.requested && !r.scheduled && /iOS Settings/.test(r.text) && !r.on, 'denied permission: no prompt, nothing scheduled, settings explains', r);
  await page.close();
}

{
  const page = await open({ native: false });
  const r = await page.evaluate(async () => { const { api } = window.__game; const plan = await api.notify.plan(true); document.querySelector('[data-open="settings"]').click(); return { plan, available: api.notify.available(), text: document.querySelector('#nt-status').textContent, disabled: document.querySelector('#nt-toggle').disabled }; });
  check(r.plan === null && !r.available && /iOS app/.test(r.text) && r.disabled, 'without the plugin the feature is inert', r);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL NOTIFY CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
