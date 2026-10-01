import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const shots = process.env.SHOTS || join(tmpdir(), 'deadzone-coop-shots');
mkdirSync(shots, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function check(cond, label, extra) {
  console.log((cond ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''));
  if (!cond) failed++;
}

const initPage = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafOn = false;
  window.requestAnimationFrame = fn => raf(function tick(t) { if (window.__rafOn) fn(t); else raf(tick); });
};
const initGameCenter = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafOn = false;
  window.requestAnimationFrame = fn => raf(function tick(t) { if (window.__rafOn) fn(t); else raf(tick); });
  window.__calls = [];
  window.Capacitor = {
    PluginHeaders: [{ name: 'GameCenter' }],
    nativePromise: (plugin, method) => {
      window.__calls.push(plugin + '.' + method);
      return Promise.resolve(method === 'signIn' ? { authenticated: true, displayName: 'Alpha' } : {});
    },
  };
};
const initMatch = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  window.__calls = [];
  window.__listeners = {};
  window.Capacitor = {
    PluginHeaders: [{ name: 'GameCenter' }, { name: 'Match' }],
    nativePromise: (plugin, method, opts) => {
      window.__calls.push({ plugin, method, opts });
      if (method === 'signIn') return Promise.resolve({ authenticated: true, displayName: 'Delta' });
      if (method === 'findMatch') return Promise.resolve({ status: 'found' });
      return Promise.resolve({});
    },
    addListener: (plugin, event, fn) => { (window.__listeners[plugin + ':' + event] ||= []).push(fn); return { remove() {} }; },
  };
};

async function step(page, secs, dt = 1 / 30) {
  return page.evaluate(([secs, dt]) => {
    const g = window.__game;
    for (let i = 0, n = Math.round(secs / dt); i < n; i++) {
      if (g.api.state.mode !== 'playing') break;
      g.update(dt);
      g.scene.updateMatrixWorld();
    }
  }, [secs, dt]);
}
async function lockstep(pages, secs, slice = .1) {
  for (let t = 0; t < secs - 1e-6; t += slice) {
    for (const p of pages) await step(p, slice);
    await sleep(4);
  }
}
async function until(pages, page, fn, arg, maxSecs) {
  for (let t = 0; t < maxSecs; t += .2) {
    if (await page.evaluate(fn, arg)) return true;
    await lockstep(pages, .2);
  }
  return page.evaluate(fn, arg);
}
async function waitReal(page, fn, arg, ms) {
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true, () => false);
}
const raf = (page, on) => page.evaluate(v => { window.__rafOn = v; }, on);
async function shot(page, name, settle = 450) {
  await raf(page, true);
  await sleep(settle);
  await page.screenshot({ path: join(shots, name) });
  await raf(page, false);
  console.log('     screenshot ' + join(shots, name));
}
const info = page => page.evaluate(() => {
  const { api } = window.__game, s = api.coop.session, st = api.state;
  return s && {
    id: s.t.id, host: s.host, phase: s.phase, mode: st.mode, wave: st.wave, between: st.between, score: st.score, hp: api.player.hp,
    players: [...s.players.values()].map(p => ({ id: p.id, name: p.name, st: p.st, kills: p.kills, revives: p.revives, avatar: !!p.avatar, perked: p.perked })),
  };
});
const zlist = page => page.evaluate(() => window.__game.api.zombies.filter(z => !z.userData.dead && z.userData.nid)
  .map(z => ({ nid: z.userData.nid, x: z.position.x, z: z.position.z, rise: z.userData.rise, kind: z.userData.kind, tgt: z.userData.tgt, hp: z.userData.hp })));
const place = (page, x, z, yaw, pitch = -.05) => page.evaluate(([x, z, yaw, pitch]) => {
  const { api } = window.__game;
  api.camera.position.x = x; api.camera.position.z = z;
  if (yaw != null) { api.look.yaw = yaw; api.look.pitch = pitch; }
}, [x, z, yaw, pitch]);
const cfg = (page, o) => page.evaluate(o => Object.assign(window.__game.api.coop.config, o), o);
const clearZombies = (page, keepWave = true) => page.evaluate(keep => {
  const { api } = window.__game;
  if (keep && api.state.queue.length < 20) { api.state.queue.push(...Array.from({ length: 30 }, () => ({ kind: 'walker', elite: false }))); api.state.waveTotal += 30; }
  for (const z of [...api.zombies]) if (!z.userData.dead) api.damageZombie(z, 1e7, null, false, null);
}, keepWave);
async function prep(page, name, look) {
  await page.evaluate(([name, look]) => {
    const { api } = window.__game;
    api.settings.aimAssist = false;
    api.settings.sound = false;
    if (name) api.profile.coop = { name };
    if (look) Object.assign(api.profile.loadout, look);
    api.coop.config.perkTimeout = 2;
    api.coop.config.perkGrace = 1;
  }, [name, look]);
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).click();

const { server, url } = await serve();
const browser = await launch(['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']);
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
async function open(init, name, look) {
  const { page, errors: e } = await openGame(ctx, url, { init });
  errors.push(e);
  await page.waitForFunction(() => window.__game.api.coop);
  await prep(page, name, look);
  return page;
}

// ---------- lobby ----------
const A = await open(initGameCenter);
await A.waitForFunction(() => window.__game.api.gameCenter.player);
const B = await open(initPage, 'BRAVO', { top: 3, topColor: 8, head: 5, hair: 2, hairColor: 3, pants: 1 });
await A.evaluate(() => window.__game.api.loadMap('mall'));
await B.evaluate(() => window.__game.api.loadMap('street'));
await A.click('#coop-open');
await button(A, 'HOST LOCAL');
const code = await A.textContent('.coop-room-head b');
check(/^[A-Z]{4}$/.test(code), 'host shows room code', code);
await B.click('#coop-open');
await B.fill('.coop-code-in', code.toLowerCase());
await button(B, 'JOIN LOCAL');
check(await waitReal(A, () => window.__game.api.coop.session.players.size === 2, null, 4000), 'client joins host room over BroadcastChannel');
check(await waitReal(B, () => window.__game.api.coop.session.players.size === 2, null, 4000), 'client sees host');
await button(B, 'READY');
check(await waitReal(A, () => [...window.__game.api.coop.session.players.values()].every(p => p.me || p.ready), null, 3000), 'host sees client ready');
await A.waitForFunction(() => [...document.querySelectorAll('.coop-players img')].every(i => i.complete && i.naturalWidth));
const names = await A.$$eval('.coop-players li b', els => els.map(e => e.textContent));
check(names.includes('ALPHA') && names.includes('BRAVO'), 'lobby lists both players with Game Center / local names', names);
await shot(A, 'coop-lobby.png', 200);
check(/MALL/.test(await B.textContent('.coop-room-head')), 'client lobby shows the host map', await B.textContent('.coop-room-head'));

const badJoin = await open(initPage, 'ZULU');
await badJoin.click('#coop-open');
await badJoin.fill('.coop-code-in', 'QQQQ');
await button(badJoin, 'JOIN LOCAL');
check(await waitReal(badJoin, () => /NOT FOUND/.test(document.querySelector('.coop-status').textContent), null, 5000), 'joining an unknown room fails cleanly');
await badJoin.close();

await button(A, 'START');
const started = p => p.waitForFunction(() => window.__game.api.state.mode === 'playing' && window.__game.api.state.runType === 'coop', null, { timeout: 4000 }).then(() => true, () => false);
check(await started(A) && await started(B), 'host starts the run on both pages (type coop)');
const maps = [await A.evaluate(() => window.__game.api.currentMap), await B.evaluate(() => window.__game.api.currentMap)];
check(maps[0] === 'mall' && maps[1] === 'mall', 'client loads the host map', maps);
const inv = await B.evaluate(() => { const { api } = window.__game, before = api.reqMet('recruit:1'), scrap = api.profile.scrap; const got = api.coop.session.invite && api.coop.grantRecruit(); return { before, got, after: api.reqMet('recruit:1'), again: api.coop.grantRecruit(), scrap: api.profile.scrap - scrap, fresh: api.profile.fresh.some(k => k.startsWith('suit:')) }; });
check(!inv.before && inv.got && inv.after && !inv.again && inv.scrap === 500 && inv.fresh, 'invited squad earns BLOOD BROTHERS once (+500 scrap)', inv);
await raf(A, false); await raf(B, false);
const idA = (await info(A)).id, idB = (await info(B)).id;
check((await info(A)).host === idA && (await info(B)).host === idA, 'host is the lowest id', { idA, idB });
for (const p of [A, B]) await p.evaluate(() => { window.__game.api.stats.armor = .02; });

// ---------- zombie replication ----------
check(await until([A, B], A, () => window.__game.api.zombies.filter(z => !z.userData.dead && z.userData.nid && z.userData.rise === 0).length >= 3, null, 20), 'host spawns wave 1');
await lockstep([A, B], 1);
await step(B, .4);
const hz = await zlist(A), cz = await zlist(B);
const missing = hz.filter(h => !cz.some(c => c.nid === h.nid));
const drift = Math.max(...hz.map(h => { const c = cz.find(c => c.nid === h.nid); return c ? Math.hypot(c.x - h.x, c.z - h.z) : 0; }));
check(hz.length >= 3 && !missing.length, 'every host zombie exists on client with the same id', { host: hz.length, client: cz.length, missing: missing.map(m => m.nid) });
check(drift < .75, 'client zombie positions match host within tolerance', { drift: +drift.toFixed(3) });
check((await B.evaluate(() => window.__game.api.state.wave)) === 1, 'client receives wave start');

// ---------- hit claims ----------
const target = hz.find(h => h.rise === 0);
await B.evaluate(nid => {
  const { api } = window.__game, z = api.coop.session.zmap.get(nid);
  api.damageZombie(z, 50000, z.position.clone().setY(1.7), true, null);
}, target.nid);
check((await zlist(B)).some(z => z.nid === target.nid), 'client does not kill locally before host confirms');
await lockstep([B, A, B], .4);
const hostDead = !(await zlist(A)).some(z => z.nid === target.nid);
const clientDead = !(await zlist(B)).some(z => z.nid === target.nid);
check(hostDead, 'client hit claim kills the zombie on host');
check(clientDead, 'death replicates back to the client');
check((await info(A)).players.find(p => p.id === idB).kills >= 1, 'host credits the kill to the client');
await place(B, 1.2, 30, 0);
const aimNid = await A.evaluate(() => window.__game.api.makeZombie('walker', 1.2, 21, false).userData.nid);
await lockstep([A, B], .4);
await B.evaluate(() => window.__game.setFiring(true));
for (let i = 0; i < 25; i++) {
  await B.evaluate(nid => {
    const g = window.__game, { api } = g;
    const best = api.coop.session.zmap.get(nid);
    for (let k = 0; k < 3; k++) {
      if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
      g.update(1 / 30); g.scene.updateMatrixWorld();
    }
  }, aimNid);
  await step(A, .1);
  await sleep(4);
}
await B.evaluate(() => window.__game.setFiring(false));
await lockstep([A, B], .3);
const bInfo = await info(B), clientHits = await B.evaluate(() => window.__game.api.state.hits);
check(clientHits > 0 && bInfo.players.find(p => p.id === idB).kills >= 2, 'client shooting kills zombies through host', { clientHits, kills: bInfo.players.find(p => p.id === idB).kills });

// ---------- nearest player targeting ----------
await clearZombies(A);
await lockstep([A, B], .3);
await place(A, 0, 36, 0);
await place(B, 3, -34, Math.PI);
await lockstep([A, B], .3);
const near = await A.evaluate(() => {
  const { api } = window.__game;
  const a = api.makeZombie('walker', 0, 30, false), b = api.makeZombie('walker', 3, -28, false);
  return [a.userData.nid, b.userData.nid];
});
await lockstep([A, B], 2.5);
const nz = await zlist(A);
const za = nz.find(z => z.nid === near[0]), zb = nz.find(z => z.nid === near[1]);
check(za && za.tgt === idA && za.z > 31, 'zombie near host chases host', za);
check(zb && zb.tgt === idB && zb.z < -29, 'zombie near client chases client', zb);
const onClient = (await zlist(B)).find(z => z.nid === near[1]);
check(onClient && Math.abs(onClient.z - zb.z) < .75, 'client renders the chasing zombie', onClient);

// ---------- new zombie types replicate ----------
await clearZombies(A);
await lockstep([A, B], .3);
const newIds = await A.evaluate(() => {
  const { api } = window.__game, c = api.camera.position, out = [];
  for (const [k, dx] of [['screamer', 0], ['shield', 2.5], ['stalker', -2.5], ['juggernaut', 5]]) {
    const zb = api.makeZombie(k, c.x + dx, c.z + 12, false);
    Object.assign(zb.userData, { speed: 0, nextScream: 1e9, nextCharge: 1e9, stalkT: 1e9, hitAt: -1e9, hidden: k === 'stalker' });
    out.push(zb.userData.nid);
  }
  return out;
});
await lockstep([A, B], .6);
const repl = await B.evaluate(ids => ids.map(id => { const z = window.__game.api.zombies.find(z => z.userData.nid === id); return z && { kind: z.userData.kind, hidden: z.userData.hidden }; }), newIds);
check(repl.map(r => r?.kind).join() === 'screamer,shield,stalker,juggernaut' && repl[2].hidden && !repl[1].hidden, 'client replicates new zombie types and the stalker fade', repl);

// ---------- mid-fight screenshots ----------
await clearZombies(A);
await lockstep([A, B], .3);
await place(A, -2.5, 22, -Math.PI / 2 + .25);
await place(B, 2.5, 22, Math.PI / 2 - .25);
await A.evaluate(() => {
  const { api } = window.__game;
  for (const [k, x, z] of [['walker', 0, 13], ['runner', 5, 15], ['brute', -4, 12], ['walker', 7, 26], ['spitter', -7, 29]]) api.makeZombie(k, x, z, false);
});
await lockstep([A, B], .8);
for (const p of [A, B]) await p.evaluate(() => { window.__game.setFiring(true); window.__game.api.settings.autoFire = false; });
await raf(A, true); await raf(B, true);
await sleep(500);
await A.screenshot({ path: join(shots, 'coop-host-view.png') });
await B.screenshot({ path: join(shots, 'coop-client-view.png') });
console.log('     screenshot ' + join(shots, 'coop-host-view.png') + ' / coop-client-view.png');
for (const p of [A, B]) await p.evaluate(() => window.__game.setFiring(false));
await raf(A, false); await raf(B, false);
const tagVisible = await A.evaluate(() => [...document.querySelectorAll('.coop-tag')].some(t => !t.classList.contains('hidden') && t.textContent.includes('BRAVO')));
check(tagVisible, 'host sees client avatar name tag', await A.evaluate(() => { const { api } = window.__game, p = [...api.coop.session.players.values()].find(p => !p.me); return { p: [p.x, p.z], av: [p.avatar.x, p.avatar.z], cam: [api.camera.position.x, api.camera.position.z], yaw: api.look.yaw, tag: p.avatar.tag.className }; }));
check(await B.evaluate(() => [...document.querySelectorAll('.coop-tag')].some(t => !t.classList.contains('hidden') && t.textContent.includes('ALPHA'))), 'client sees host avatar name tag');

const diag = async () => ({
  host: await A.evaluate(() => { const { api } = window.__game, s = api.coop.session, p = [...s.players.values()].find(p => !p.me); return { mode: api.state.mode, cam: [api.camera.position.x, api.camera.position.z], b: [p.x, p.z, p.st, p.rev, p.bleed] }; }),
  client: await B.evaluate(() => { const { api } = window.__game; return { mode: api.state.mode, cam: [api.camera.position.x, api.camera.position.z], st: api.coop.session.me.st, hp: api.player.hp }; }),
});
// ---------- downed / revive ----------
await clearZombies(A);
await lockstep([A, B], .5);
await place(A, -3, 21, 0);
await place(B, 4, 20, 0);
await B.evaluate(() => window.__game.api.hurtPlayer(1e7, { x: 4, z: 18 }));
await lockstep([B, A], .4);
check((await info(B)).players.find(p => p.id === idB).st === 1, 'client goes DOWNED instead of game over', await B.evaluate(() => window.__game.api.state.mode));
check((await info(A)).players.find(p => p.id === idB).st === 1, 'host sees client downed');
await lockstep([A, B], 1);
const xDowned = await B.evaluate(() => window.__game.api.camera.position.x);
await B.evaluate(() => { window.__game.api.move.y = 1; });
await lockstep([A, B], .5);
check(Math.abs((await B.evaluate(() => window.__game.api.camera.position.x)) - xDowned) < .01, 'downed player cannot move');
await B.evaluate(() => { window.__game.api.move.y = 0; });
check(/HOLD NEAR TO REVIVE/.test(await A.textContent('#coop-prompt')), 'host gets DOWNED — HOLD NEAR TO REVIVE prompt', await A.textContent('#coop-prompt'));
await place(A, 2.4, 20.5, Math.atan2(-1.6, .5), -.6);
await lockstep([A, B], 1.3);
check(/REVIVING BRAVO/.test(await A.textContent('#coop-prompt')), 'revive progress prompt shown near downed teammate');
await shot(A, 'coop-revive-host.png', 250);
await shot(B, 'coop-downed-client.png', 250);
await until([A, B], B, () => window.__game.api.coop.session.me.st === 0, null, 4);
const rv = await info(B);
check(rv.players.find(p => p.id === idB).st === 0 && rv.hp > 0, 'standing next to teammate for 3 s revives them', await diag());
check((await info(A)).players.find(p => p.id === idA).revives === 1, 'host credited with the revive');

// ---------- perk sync + timeout ----------
const perkLog = p => p.evaluate(() => { window.__perks = []; window.__game.api.bus.on('perk', e => window.__perks.push(e.name)); });
await perkLog(A); await perkLog(B);
async function clearWave() {
  await cfg(A, {});
  await A.evaluate(() => { window.__game.api.state.queue = []; });
  await clearZombies(A, false);
  const hostPerk = await until([A, B], A, () => window.__game.api.state.mode === 'perk', null, 8);
  const clientPerk = await until([B], B, () => window.__game.api.state.mode === 'perk', null, 4);
  return hostPerk && clientPerk;
}
await cfg(A, { perkTimeout: 30, perkGrace: 2 }); await cfg(B, { perkTimeout: 30 });
let waveBefore = (await info(A)).wave;
check(await clearWave(), 'wave clear replicates and each player gets their own perk choice');
await A.click('#perk-list .perk');
await lockstep([A], 1.8);
check((await info(A)).wave === waveBefore, 'host waits for the squad before the next wave');
check(/WAITING FOR SQUAD · 1\/2/.test(await A.textContent('#hint')), 'host shows waiting-for-squad hint', await A.textContent('#hint'));
check(/SQUAD PICKING/.test(await B.textContent('#coop-perkwait')), 'client perk screen shows squad countdown', await B.textContent('#coop-perkwait'));
await cfg(B, { perkTimeout: .5 });
check(await waitReal(B, () => window.__perks.length === 1 && window.__game.api.state.mode === 'playing', null, 4000), 'client auto-picks a perk when its timer runs out');
check(await until([A, B], B, w => window.__game.api.state.wave === w + 1, waveBefore, 4), 'next wave starts once everyone picked');
check((await info(A)).wave === waveBefore + 1, 'host advanced to the next wave');
await lockstep([A, B], 1);
await cfg(A, { perkTimeout: 1, perkGrace: 1 }); await cfg(B, { perkTimeout: 30 });
waveBefore = (await info(A)).wave;
check(await clearWave(), 'second wave clear offers perks again');
await A.click('#perk-list .perk');
await sleep(2300);
check(await until([A, B], B, w => window.__game.api.state.wave === w + 1 && window.__game.api.state.mode === 'playing', waveBefore, 4), 'host timeout forces the next wave and auto-picks for a stalled client');
check((await B.evaluate(() => window.__perks.length)) === 2, 'stalled client still received a perk');

// ---------- all down -> shared game over ----------
const scrapBefore = await B.evaluate(() => window.__game.api.profile.scrap);
await B.evaluate(() => window.__game.api.hurtPlayer(1e7));
await lockstep([B, A], .3);
check((await info(A)).mode === 'playing', 'run continues while one survivor stands');
await A.evaluate(() => window.__game.api.hurtPlayer(1e7));
await lockstep([A, B], .3);
await sleep(200);
const endA = await info(A), endB = await info(B);
check(endA.mode === 'dead' && endB.mode === 'dead', 'all players down ends the run for everyone', [endA.mode, endB.mode]);
await sleep(1100);
check(await A.evaluate(() => !document.querySelector('#over').classList.contains('hidden') && document.querySelector('#over h2').textContent === 'SQUAD WIPED'), 'shared co-op game over screen');
check((await B.$$eval('.coop-over tr', r => r.length)) === 3, 'game over lists team stats per player');
check(await B.evaluate(() => document.querySelector('#again').classList.contains('hidden')), 'solo redeploy hidden in co-op');
check((await B.evaluate(() => window.__game.api.profile.scrap)) > scrapBefore, 'co-op still grants scrap');
check(!(await A.evaluate(() => window.__calls.some(c => /submitScore/.test(c)))), 'co-op never submits to leaderboards');
check(!(await A.evaluate(() => (JSON.parse(localStorage.getItem('deadzone.runs') || '[]')).length)), 'co-op runs are not saved as solo runs');
await shot(B, 'coop-game-over.png', 100);

// ---------- run 2: three players, client and host disconnects ----------
await button(A, 'SQUAD LOBBY');
await button(B, 'SQUAD LOBBY');
const C = await open(initPage, 'CHARLIE', { top: 5, topColor: 11, head: 1 });
await C.click('#coop-open');
await C.fill('.coop-code-in', code);
await button(C, 'JOIN LOCAL');
check(await waitReal(A, () => window.__game.api.coop.session.players.size === 3, null, 4000), 'third player joins between runs');
await button(B, 'READY');
await button(C, 'READY');
await A.waitForFunction(() => [...window.__game.api.coop.session.players.values()].every(p => p.me || p.ready));
await button(A, 'START');
check(await started(A) && await started(B) && await started(C), 'second run starts for three players');
for (const p of [A, B, C]) { await raf(p, false); await p.evaluate(() => { window.__game.api.stats.armor = .02; }); }
const idC = (await info(C)).id;
check(await until([A, B, C], A, () => window.__game.api.zombies.filter(z => !z.userData.dead && z.userData.rise === 0).length >= 2, null, 20), 'zombies spawn in run 2');
await lockstep([A, B, C], .6);
check((await info(A)).players.filter(p => p.avatar).length === 2, 'host renders two teammates');

await A.close();
check(await waitReal(B, () => { const s = window.__game.api.coop.session; return s.players.size === 2 && s.host === s.t.id; }, null, 14000), 'host leaving promotes the next-lowest id to host');
check(await waitReal(C, id => window.__game.api.coop.session.host === id, idB, 3000), 'remaining client follows the new host');
const beforeC = await zlist(C);
await lockstep([B, C], 2);
const afterB = await zlist(B), afterC = await zlist(C);
const moved = afterC.filter(z => { const o = beforeC.find(b => b.nid === z.nid); return o && Math.hypot(o.x - z.x, o.z - z.z) > .2; }).length;
check(afterB.length > 0 && moved > 0, 'new host keeps simulating and streaming zombies', { host: afterB.length, clientMoved: moved });
check(await B.evaluate(() => window.__game.api.state.mode === 'playing' && window.__game.api.coop.net.host), 'run continues after host migration');

const avatarsBefore = await B.evaluate(() => window.__game.api.scene.children.filter(o => o.children[0]?.userData?.torso).length);
await C.close();
check(await waitReal(B, () => window.__game.api.coop.session.players.size === 1, null, 14000), 'client leaving is detected');
await lockstep([B], .2);
check((await info(B)).players.every(p => p.id !== idC) && (await B.evaluate(() => document.querySelectorAll('.coop-tag').length)) === 0, 'departed client avatar and tag removed');
check((await B.evaluate(() => window.__game.api.scene.children.filter(o => o.children[0]?.userData?.torso).length)) === 0 && avatarsBefore === 1, 'avatar removed from scene');
await B.evaluate(() => window.__game.api.hurtPlayer(1e7));
await lockstep([B], .3);
check((await info(B)).mode === 'dead', 'last survivor down ends the run');
await sleep(1000);
check((await B.$$eval('.coop-over tr', r => r.length)) === 4, 'game over table keeps players who left', await B.$$eval('.coop-over td:first-child', r => r.map(e => e.textContent)));
await B.click('#to-menu');
check(await B.evaluate(() => !window.__game.api.coop.session && !window.__game.api.state.net), 'returning to menu leaves the session');
await B.close();

// ---------- Game Center transport contract (mocked native plugin) ----------
const gctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const { page: G, errors: gErr } = await openGame(gctx, url, { init: initMatch });
errors.push(gErr);
await G.waitForFunction(() => window.__game.api.coop && window.__game.api.gameCenter.player);
await G.click('#coop-open');
check(await G.evaluate(() => !document.querySelector('#coop .coop-pick .row').classList.contains('hidden') && document.querySelector('.coop-code-in').closest('.row').classList.contains('hidden')), 'iOS shows FIND MATCH / INVITE FRIENDS, hides local play');
await button(G, 'INVITE FRIENDS');
await G.waitForFunction(() => window.__calls.some(c => c.method === 'findMatch'));
check(await G.evaluate(() => { const c = window.__calls.find(c => c.method === 'findMatch'); return c.plugin === 'Match' && c.opts.minPlayers === 2 && c.opts.maxPlayers === 4 && c.opts.invite === true; }), 'findMatch called on Match plugin with 2-4 players');
await G.evaluate(() => window.__listeners['Match:matchFound'].forEach(f => f({ players: [{ id: 'G:200', name: 'Delta' }, { id: 'G:100', name: 'Echo' }], localId: 'G:200' })));
check(await G.evaluate(() => { const s = window.__game.api.coop.session; return s && s.players.size === 2 && s.host === 'G:100' && !window.__game.api.coop.net.host; }), 'matchFound builds a lobby, lowest player id hosts');
check(await G.evaluate(() => window.__calls.some(c => c.method === 'send' && c.opts.to?.[0] === 'G:100' && JSON.parse(c.opts.data)[1] === 'hi')), 'hello sent through Match.send as versioned JSON');
await G.evaluate(() => window.__listeners['Match:data'].forEach(f => f({ from: 'G:100', data: JSON.stringify([1, 'hi', 'x', 5, 1, 0, 'veteran']) })));
check(/VETERAN/.test(await G.textContent('.coop-room-head')), 'data events from the plugin reach the session');
await G.evaluate(() => window.__listeners['Match:data'].forEach(f => f({ from: 'G:100', data: JSON.stringify([99, 'hi']) })));
check(/VERSION MISMATCH/.test(await G.textContent('.coop-status')), 'mismatched protocol version rejected');
await G.evaluate(() => window.__listeners['Match:playerState'].forEach(f => f({ id: 'G:100', connected: false })));
check(await G.evaluate(() => window.__game.api.coop.session.players.size === 1 && window.__game.api.coop.net.host), 'playerState disconnect removes player and re-elects host');
await button(G, 'LEAVE');
check(await G.evaluate(() => window.__calls.some(c => c.method === 'disconnect')), 'leaving calls Match.disconnect');
await gctx.close();

await ctx.close().catch(() => {});
await browser.close();
server.close();
const errs = errors.flat().filter(e => !/net::ERR|favicon/.test(e));
if (errs.length) { console.error(errs.join('\n')); failed++; }
console.log(failed ? failed + ' CHECK(S) FAILED' : 'coop ok');
process.exit(failed ? 1 : 0);
