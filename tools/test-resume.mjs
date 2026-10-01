import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

const PROFILE = { runs: 3, bestWave: 9, scrap: 2000, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } };
async function open({ now = NOW, extra = '' } = {}) {
  const init = `
    window.__now = ${now};
    Date.now = () => window.__now;
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(PROFILE))});
    ${extra}`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  return page;
}
const tick = (page, secs) => page.evaluate(s => { const g = window.__game; for (let i = 0; i < s * 30; i++) { if (g.api.state.mode !== 'playing') break; g.update(1 / 30); window.__now += 1000 / 30; } return g.api.state.mode; }, secs);
const hide = page => page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  return { mode: window.__game.api.state.mode, snap: JSON.parse(localStorage.getItem('deadzone.resume')) };
});

let snapshot = null;
{
  const page = await open();
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  const none = await page.evaluate(() => ({ card: !!document.querySelector('.rs-card'), pending: window.__game.api.resume.pending() }));
  check(!none.card && none.pending === null, 'no offer without a saved run', none);

  await page.evaluate(() => { const { api } = window.__game; api.startGame({ map: 'street' }); });
  await tick(page, 4);
  const first = await page.evaluate(() => {
    const { api } = window.__game, s = api.state;
    const p = api.PERKS.find(x => x.name === 'HOLLOW POINTS');
    p.apply(); s.perks.push(p.name);
    Object.assign(s, { score: 4321, kills: 17, heads: 5, bestCombo: 4 });
    api.player.hp = 61; api.player.nades = 1;
    api.dropPickup(api.camera.position.x + 3, api.camera.position.z + 3, 'ammo');
    return { wave: s.wave, zombies: api.zombies.filter(z => !z.userData.dead).length, damage: api.stats.damage, cam: [api.camera.position.x, api.camera.position.z], ammo: api.player.ammo.slice(), weapon: api.player.weapon, mode: s.mode, clock: s.clock };
  });
  const hidden = await hide(page);
  snapshot = hidden.snap;
  check(hidden.mode === 'paused' && snapshot && snapshot.v === 1 && snapshot.state.wave === first.wave && snapshot.state.score === 4321 && snapshot.state.kills === 17 && snapshot.state.perks.join() === 'HOLLOW POINTS' && snapshot.player.hp === 61 && snapshot.player.nades === 1 && snapshot.zombies.length === first.zombies && first.zombies >= 1 && snapshot.pickups.some(p => p.kind === 'ammo') && snapshot.state.runType === 'normal' && snapshot.map === 'street', 'hiding the page pauses and snapshots the run', { mode: hidden.mode, wave: snapshot?.state.wave, zombies: snapshot?.zombies.length, perks: snapshot?.state.perks });

  const quit = await page.evaluate(() => { const { api } = window.__game; api.toMenu(); return { pending: api.resume.pending(), stored: localStorage.getItem('deadzone.resume') }; });
  check(quit.pending === null && quit.stored === 'null', 'quitting to the menu discards the snapshot', quit);

  const excluded = await page.evaluate(() => {
    const g = window.__game, { api } = g, out = {};
    for (const opts of [{ type: 'ranked', map: 'street' }, api.blitz.opts(), { type: 'daily', map: 'street', seed: 'd' }]) {
      api.startGame(opts);
      for (let i = 0; i < 60; i++) g.update(1 / 30);
      api.state.mode = 'paused';
      out[opts.type] = api.resume.save();
      api.toMenu();
    }
    return out;
  });
  check(excluded.ranked === null && excluded.blitz === null && excluded.daily === null, 'ranked, Blitz and Daily runs are never snapshotted', excluded);

  const ended = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.levels.state.paid = 99;
    api.startGame({ map: 'street' });
    for (let i = 0; i < 90; i++) g.update(1 / 30);
    api.state.mode = 'paused';
    const saved = !!api.resume.save();
    api.state.mode = 'playing';
    g.gameOver();
    return { saved, after: api.resume.pending() };
  });
  check(ended.saved && ended.after === null, 'ending the run clears the snapshot', ended);
  await page.evaluate(() => window.__game.api.toMenu());

  const extract = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.startGame(api.extract.opts());
    for (let i = 0; i < 90; i++) g.update(1 / 30);
    api.state.score = 777;
    api.state.mode = 'paused';
    const snap = api.resume.save();
    api.toMenu();
    const ok = api.resume.restore(snap);
    return { type: snap?.state.runType, ok, runType: api.state.runType, score: api.state.score, mode: api.state.mode, hud: document.querySelector('#ex-hud')?.classList.contains('hidden'), pending: api.resume.pending() };
  });
  check(extract.type === 'extract' && extract.ok && extract.runType === 'extract' && extract.score === 777 && extract.mode === 'playing' && extract.hud === false && extract.pending === null, 'an extraction run restores with its mode intact', extract);
  await page.evaluate(() => { window.__game.gameOver(); window.__game.api.toMenu(); });
  await page.close();
}

{
  const page = await open({ now: snapshot.at + 2 * 60e3, extra: `localStorage.setItem('deadzone.resume', ${JSON.stringify(JSON.stringify(snapshot))});` });
  const offer = await page.evaluate(() => { const c = document.querySelector('.rs-card'); return { card: !!c, text: c?.textContent, streak: !!document.querySelector('.pg-modal') }; });
  check(offer.card && /INTERRUPTED RUN/.test(offer.text) && /WAVE 1/.test(offer.text) && /4,321 PTS/.test(offer.text) && /17 KILLS/.test(offer.text) && /2 MIN AGO/.test(offer.text), 'the next launch offers to resume the run', offer);
  await page.screenshot({ path: '/tmp/resume-offer.png' });
  const restored = await page.evaluate(() => new Promise(res => {
    const g = window.__game, { api } = g, events = [];
    api.bus.on('run:resume', e => events.push(e));
    document.querySelector('.rs-card .cta').click();
    const s = api.state;
    const out = { mode: s.mode, wave: s.wave, score: s.score, kills: s.kills, heads: s.heads, perks: s.perks.slice(), damage: api.stats.damage, hp: api.player.hp, nades: api.player.nades, zombies: api.zombies.filter(z => !z.userData.dead).length, pickups: api.pickups.map(p => p.userData.kind), cam: [api.camera.position.x, api.camera.position.z], stored: localStorage.getItem('deadzone.resume'), card: !!document.querySelector('.rs-card'), event: events[0], hud: document.querySelector('#wave-num').textContent };
    for (let i = 0; i < 45; i++) g.update(1 / 30);
    out.waveAfter = s.wave; out.modeAfter = s.mode; out.zombiesAfter = api.zombies.filter(z => !z.userData.dead).length;
    setTimeout(() => res(out), 50);
  }));
  check(restored.mode === 'playing' && restored.wave === snapshot.state.wave && restored.score === 4321 && restored.kills === 17 && restored.heads === 5 && restored.perks.join() === 'HOLLOW POINTS' && Math.abs(restored.damage - 1.1) < 1e-9 && restored.hp === 61 && restored.nades === 1, 'resuming restores the score, perks and player', restored);
  check(restored.zombies === snapshot.zombies.length && restored.pickups.includes('ammo') && Math.abs(restored.cam[0] - snapshot.cam.x) < .01 && restored.stored === 'null' && !restored.card && restored.event?.wave === snapshot.state.wave && /WAVE 1/.test(restored.hud), 'the horde, pickups and position come back and the save is consumed', { zombies: [restored.zombies, snapshot.zombies.length], pickups: restored.pickups, stored: restored.stored });
  check(restored.waveAfter === snapshot.state.wave && restored.modeAfter === 'playing' && restored.zombiesAfter >= 1, 'play continues on the same wave without a restart', { waveAfter: restored.waveAfter, modeAfter: restored.modeAfter });
  await page.screenshot({ path: '/tmp/resume-play.png' });
  const over = await page.evaluate(async () => { const g = window.__game, { api } = g; api.levels.state.paid = 99; const runs = api.profile.runs; g.gameOver(); await new Promise(r => setTimeout(r, 200)); return { runs: api.profile.runs - runs, score: document.querySelector('#st-score').textContent }; });
  check(over.runs === 1 && over.score === '4,321', 'the resumed run ends and counts like any other', over);
  await page.close();
}

{
  const page = await open({ now: snapshot.at + 11 * 60e3, extra: `localStorage.setItem('deadzone.resume', ${JSON.stringify(JSON.stringify(snapshot))});` });
  const expired = await page.evaluate(() => ({ card: !!document.querySelector('.rs-card'), pending: window.__game.api.resume.pending(), stored: localStorage.getItem('deadzone.resume') }));
  check(!expired.card && expired.pending === null && expired.stored === 'null', 'a snapshot older than ten minutes is dropped', expired);
  await page.close();
}

{
  const page = await open({ now: snapshot.at + 60e3, extra: `localStorage.setItem('deadzone.resume', ${JSON.stringify(JSON.stringify(snapshot))});` });
  const discard = await page.evaluate(() => { document.querySelector('.rs-card .ghost').click(); return { card: !!document.querySelector('.rs-card'), pending: window.__game.api.resume.pending(), mode: window.__game.api.state.mode }; });
  check(!discard.card && discard.pending === null && discard.mode === 'menu', 'DISCARD drops the save and stays on the menu', discard);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL RESUME CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
