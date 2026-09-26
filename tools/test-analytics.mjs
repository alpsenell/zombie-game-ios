import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { serve, launch, openGame } from './smoke.mjs';

const APP_ID = 'TEST-APP-0000';
const shots = process.env.SHOTS_DIR || '/tmp/deadzone-analytics-shots';
mkdirSync(shots, { recursive: true });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const failures = [];
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures.push(msg); };
const initFor = appId => `try { localStorage.setItem('deadzone.analytics.test', ${JSON.stringify(JSON.stringify({ appId }))}); } catch {}`;

async function open(browser, url, size = {}) {
  const net = { mode: 'ok', batches: [], attempts: 0 };
  const g = await openGame(browser, url, { ...size, init: initFor(APP_ID) });
  await g.page.route('https://nom.telemetrydeck.com/**', route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    net.attempts++;
    if (net.mode === 'offline') return route.abort('internetdisconnected');
    if (net.mode === '503') return route.fulfill({ status: 503, headers: cors, body: '' });
    net.batches.push({ url: req.url(), headers: req.headers(), body: JSON.parse(req.postData()) });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '[]' });
  });
  return { ...g, net };
}
const signals = net => net.batches.flatMap(b => b.body);
const types = net => signals(net).map(s => s.type);
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

const playRun = page => page.evaluate(() => {
  const g = window.__game, { api } = g;
  api.settings.autoFire = true;
  api.state.moved = api.state.looked = true;
  for (let i = 0; i < 30 * 90; i++) {
    if (api.state.mode === 'perk') document.querySelector('.perk').click();
    if (api.state.mode !== 'playing') break;
    let best = null, bd = 1e9;
    for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
    if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
    g.update(1 / 30); g.scene.updateMatrixWorld();
  }
  if (api.state.mode === 'perk') document.querySelector('.perk').click();
  const z = api.zombies.find(z => !z.userData.dead) || api.makeZombie('runner', 0, 26, false);
  api.stats.secondWind = false;
  api.hurtPlayer(1e5, z.position);
  return { kind: z.userData.kind, summary: api.runSummary(), code: api.myCode() };
});

const { server, url } = await serve();
const browser = await launch();
const allErrors = [];
try {
  console.log('consent + first launch');
  const A = await open(browser, url);
  const { page, net } = A;
  await page.waitForTimeout(2500);
  check(await page.isVisible('#analytics-consent'), 'consent sheet appears on first launch over the title screen');
  check(net.attempts === 0 && !(await ls(page, 'deadzone.analytics.queue'))?.length, 'nothing sent or queued before consent');
  await page.waitForTimeout(600);
  await page.screenshot({ path: shots + '/consent-844x390.png' });
  await page.click('#analytics-consent [data-v="1"]');
  check(!(await page.isVisible('#analytics-consent')), 'sheet closes after ALLOW');
  check((await ls(page, 'deadzone.settings')).analytics === true, 'consent stored in settings');
  check(await waitFor(() => types(net).includes('App.opened'), 8000), 'first flush after consent');
  check(['TelemetryDeck.Session.started', 'TelemetryDeck.Acquisition.newInstallDetected', 'App.opened'].every(t => types(net).includes(t)), 'session start, new install and app open signals');
  check(net.batches[0].url === 'https://nom.telemetrydeck.com/v2/' && /application\/json/.test(net.batches[0].headers['content-type']), 'POST JSON array to nom.telemetrydeck.com/v2/');

  console.log('headless run');
  await page.click('#start');
  const before = net.batches.length;
  const run = await playRun(page);
  check(await waitFor(() => types(net).includes('Run.ended'), 8000), 'run end triggers a flush');
  check(net.batches.length - before <= 3, 'run signals are batched (' + (net.batches.length - before) + ' requests)');
  const T = types(net);
  for (const t of ['Run.started', 'Run.waveReached', 'Run.waveCleared', 'Perk.picked', 'Run.ended', 'Weapon.used', 'Tutorial.completed', 'Screen.viewed']) check(T.includes(t), 'signal ' + t);
  check(T.filter(t => t === 'Weapon.used').length <= 4, 'weapon usage is aggregated per run');
  const ended = signals(net).find(s => s.type === 'Run.ended');
  check(ended.payload.cause === run.kind, 'death cause recorded (' + ended.payload.cause + ')');
  check(+ended.payload.wave === run.summary.wave && ended.floatValue === run.summary.wave && /^\d/.test(ended.payload.score) && /-|\+/.test(ended.payload.score), 'run end has wave and bucketed score ' + ended.payload.score);

  const install = await ls(page, 'deadzone.analytics.install');
  const hash = createHash('sha256').update(install.id).digest('hex');
  const sessions = new Set(signals(net).map(s => s.sessionID));
  check(signals(net).every(s => s.appID === APP_ID && s.clientUser === hash && typeof s.sessionID === 'string' && s.sessionID.length >= 16 && typeof s.type === 'string' && s.isTestMode === true), 'every signal has appID, SHA-256 clientUser, sessionID, type, isTestMode');
  check(sessions.size === 1, 'one session id for the launch');
  check(signals(net).every(s => s.payload && Object.values(s.payload).every(v => typeof v === 'string' && v.length <= 200)), 'payload is a flat string dictionary');
  const raw = JSON.stringify(net.batches.map(b => b.body));
  check(!raw.includes(install.id) && !raw.includes(run.code), 'no raw install id or player card code');

  console.log('allowlist forwarding');
  await page.evaluate(() => {
    const { bus } = window.__game.api;
    bus.emit('share', { platform: 'messages', playerName: 'SENTINEL_NAME', text: 'look at my run!' });
    bus.emit('mission:complete', { id: 'kill_50', reward: 250, title: 'Kill 50 zombies' });
    bus.emit('season:tier', { tier: 3, gcPlayerID: 'G:123456' });
    bus.emit('unlisted:event', { a: 1 });
    window.__game.api.analytics.flush();
  });
  check(await waitFor(() => types(net).includes('Mission.complete'), 8000), 'allowlisted feature events forwarded');
  const fw = signals(net).filter(s => ['Share', 'Mission.complete', 'Season.tier'].includes(s.type));
  check(fw.length === 3 && !types(net).includes('Unlisted.event'), 'only allowlisted events forwarded');
  check(!JSON.stringify(fw).match(/SENTINEL|look at|Kill 50|G:123456/), 'forwarded payloads drop names, ids and free text');

  console.log('offline queue + retry');
  net.mode = 'offline';
  const failedBefore = net.attempts;
  await page.evaluate(() => { window.__game.api.analytics.track('Test.offline', { n: 1 }); return window.__game.api.analytics.flush(); });
  check(net.attempts > failedBefore, 'send attempted while offline');
  check((await ls(page, 'deadzone.analytics.queue')).some(s => s.type === 'Test.offline'), 'failed signal kept in persisted queue');
  const st = await page.evaluate(() => window.__game.api.analytics.state);
  check(st.failed >= 1 && st.queued >= 1, 'failure counted, queue ' + st.queued);
  net.mode = 'ok';
  check(await waitFor(() => types(net).includes('Test.offline'), 25000), 'retried automatically with backoff');
  check(!(await ls(page, 'deadzone.analytics.queue')).length, 'queue drained after retry');
  net.mode = '503';
  await page.evaluate(() => { window.__game.api.analytics.track('Test.persist'); return window.__game.api.analytics.flush(); });
  net.mode = 'ok';
  await page.reload();
  await page.waitForFunction(() => window.__game);
  check(await waitFor(() => types(net).includes('Test.persist'), 8000), 'queued signal survives relaunch and is sent');
  await page.waitForTimeout(1600);
  check(!(await page.isVisible('#analytics-consent')), 'consent sheet does not reappear');

  console.log('dev stats');
  await page.evaluate(() => { const l = document.querySelector('#menu .logo'); for (let i = 0; i < 3; i++) l.click(); });
  check(await page.isVisible('#devstats') && (await page.locator('#devstats .ad-log li').count()) > 1, 'triple tap on logo opens DEV STATS with signal log');
  await page.screenshot({ path: shots + '/devstats-844x390.png' });
  await page.click('#devstats [data-a="close"]');

  console.log('opt out');
  net.mode = 'offline';
  await page.evaluate(() => { window.__game.api.analytics.track('Test.pending'); return window.__game.api.analytics.flush(); });
  check((await ls(page, 'deadzone.analytics.queue')).length > 0, 'queue non-empty before opt out');
  net.mode = 'ok';
  await page.click('#menu [data-open="settings"]');
  const toggle = page.locator('.toggle[data-key="analytics"]');
  check(await toggle.evaluate(e => e.classList.contains('on')), 'settings toggle shows ON');
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: shots + '/settings-844x390.png' });
  await toggle.click();
  check((await ls(page, 'deadzone.settings')).analytics === false, 'opt out persisted immediately');
  check((await ls(page, 'deadzone.analytics.queue')).length === 0, 'opt out clears the queue');
  check(!(await ls(page, 'deadzone.analytics.install')).id, 'opt out forgets the install id');
  const sent = net.attempts;
  await page.click('#close-settings');
  await page.evaluate(() => {
    const { api, gameOver } = window.__game;
    api.analytics.track('Test.afterOptOut');
    api.startGame({});
    api.bus.emit('share', { platform: 'x' });
    gameOver();
  });
  await page.waitForTimeout(11000);
  check(net.attempts === sent && !types(net).includes('Test.afterOptOut'), 'nothing sent after opt out');
  await page.reload();
  await page.waitForFunction(() => window.__game);
  await page.waitForTimeout(1600);
  check(!(await page.isVisible('#analytics-consent')), 'no consent sheet after opt out');
  await page.click('#menu [data-open="settings"]');
  check(!(await toggle.evaluate(e => e.classList.contains('on'))), 'toggle OFF persists across relaunch');
  await toggle.click();
  check(await waitFor(() => types(net).filter(t => t === 'App.opened').length >= 3, 8000), 'opting back in resumes sending');
  const hash2 = createHash('sha256').update((await ls(page, 'deadzone.analytics.install')).id).digest('hex');
  check(hash2 !== hash, 'opting back in uses a fresh anonymous id');
  await page.reload();
  await page.waitForFunction(() => window.__game);
  await page.click('#menu [data-open="settings"]');
  check(await toggle.evaluate(e => e.classList.contains('on')), 'toggle ON persists across relaunch');
  allErrors.push(...A.errors);
  await page.close();

  console.log('decline + portrait');
  const B = await open(browser, url, { width: 390, height: 844 });
  await B.page.waitForTimeout(2500);
  check(await B.page.isVisible('#analytics-consent'), 'consent sheet in portrait');
  await B.page.waitForTimeout(600);
  await B.page.screenshot({ path: shots + '/consent-390x844.png' });
  await B.page.click('#analytics-consent [data-v="0"]');
  check((await ls(B.page, 'deadzone.settings')).analytics === false, 'NO THANKS stored');
  await B.page.click('#menu [data-open="settings"]');
  await B.page.locator('.toggle[data-key="analytics"]').scrollIntoViewIfNeeded();
  await B.page.screenshot({ path: shots + '/settings-390x844.png' });
  await B.page.click('#close-settings');
  await B.page.click('#start');
  await playRun(B.page);
  await B.page.waitForTimeout(11000);
  check(B.net.attempts === 0 && !(await ls(B.page, 'deadzone.analytics.queue'))?.length, 'declined player: nothing sent or queued');
  await B.page.reload();
  await B.page.waitForFunction(() => window.__game);
  await B.page.waitForTimeout(1600);
  check(!(await B.page.isVisible('#analytics-consent')), 'sheet shown only once after declining');
  allErrors.push(...B.errors);
  await B.page.close();

  console.log('no APP_ID = local log only');
  const C = await openGame(browser, url, { init: initFor('') });
  let hits = 0;
  await C.page.route('https://nom.telemetrydeck.com/**', r => { hits++; r.abort(); });
  await C.page.waitForTimeout(1500);
  await C.page.click('#analytics-consent [data-v="1"]');
  await C.page.click('#start');
  await playRun(C.page);
  await C.page.waitForTimeout(1500);
  const cs = await C.page.evaluate(() => window.__game.api.analytics.state);
  check(hits === 0 && cs.queued === 0 && cs.log.length > 5, 'empty APP_ID: no network, signals only in local log (' + cs.log.length + ')');
  allErrors.push(...C.errors);
} finally {
  await browser.close();
  server.close();
}
const pageErrors = allErrors.filter(e => !/^Failed to load resource: (net::ERR_INTERNET_DISCONNECTED|the server responded with a status of 503)/.test(e));
if (pageErrors.length) { console.error(pageErrors.join('\n')); failures.push('page errors'); }
console.log('screenshots in ' + shots);
if (failures.length) { console.error(failures.length + ' failed'); process.exit(1); }
console.log('analytics ok');
