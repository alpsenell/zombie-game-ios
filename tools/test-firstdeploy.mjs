import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

async function open({ profile = null, flag = false, width = 844, height = 390 } = {}) {
  const init = `
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
      ${flag ? "localStorage.setItem('deadzone.tutorial', 'true');" : ''}
    }`;
  const { page, errors } = await openGame(browser, url, { width, height, init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(800);
  return page;
}
const vis = page => page.evaluate(() => {
  const v = sel => { const e = document.querySelector(sel); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; };
  const missions = [...document.querySelectorAll('#menu-extras .pg-btn')].find(b => b.textContent.startsWith('MISSIONS'));
  return { daily: v('#cm-daily'), ranked: v('#cm-ranked'), coop: v('#coop-open'), league: v('#cm-league'), season: v('#sp-open'), event: v('#ev-chip'), missions: !!missions && !missions.classList.contains('hidden'), streak: v('#menu-extras .pg-btn:nth-of-type(2)'), nextup: v('#nu-chip'), armory: v('[data-open="armory"]'), locker: v('[data-open="locker"]'), diff: v('#diff'), skip: v('#tut-skip'), note: v('#tut-note'), start: document.querySelector('#start').textContent, modal: !!document.querySelector('.pg-modal') };
});
const playTutorial = page => page.evaluate(() => new Promise(resolve => {
  const g = window.__game, { api } = g, hints = new Set(), toasts = new Set();
  api.settings.autoFire = true;
  let frames = 0, firstQueue = null, firstDiff = null;
  const tick = () => {
    for (let k = 0; k < 20; k++) {
      frames++;
      if (api.state.mode === 'perk') { document.querySelector('.perk').click(); continue; }
      if (api.state.mode !== 'playing') return resolve({ frames, mode: api.state.mode, hints: [...hints], toasts: [...toasts], firstQueue, firstDiff, wave: api.state.wave, type: api.state.runType });
      if (frames > 30 * 400) return resolve({ frames, mode: 'timeout', hints: [...hints], toasts: [...toasts], firstQueue, firstDiff, wave: api.state.wave, type: api.state.runType });
      if (!firstQueue && api.state.waveTotal) { firstQueue = api.state.waveTotal; firstDiff = api.diff().name; }
      let best = null, bd = 1e9;
      for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
      if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
      api.move.y = bd < 4 ? -1 : 0;
      api.state.moved = api.state.looked = true;
      g.update(1 / 30); g.scene.updateMatrixWorld();
      const h = document.querySelector('#hint'); if (h.classList.contains('on') && h.textContent) hints.add(h.textContent);
      const t = document.querySelector('#toast'); if (t.classList.contains('on') && t.textContent) toasts.add(t.textContent);
    }
    setTimeout(tick, 0);
  };
  tick();
}));

{
  const page = await open();
  const m0 = await vis(page);
  check(m0.start === 'START TRAINING' && m0.skip && m0.note && !m0.diff, 'a fresh install offers training instead of DEPLOY', m0);
  check(!m0.daily && !m0.ranked && !m0.coop && !m0.league && !m0.season && !m0.event && !m0.missions && m0.streak && m0.nextup && m0.armory && m0.locker, 'stage 0 hides the competitive, social and live-ops entries', m0);
  check(!m0.modal, 'no streak popup before the first run');
  await page.screenshot({ path: '/tmp/firstdeploy-menu.png' });
  const nu = await page.evaluate(() => document.querySelector('#nu-chip').textContent);
  check(/MP7/.test(nu), 'NEXT UP points at the MP7 the training will unlock', nu);
  await page.click('#start');
  await page.waitForTimeout(200);
  const r = await playTutorial(page);
  check(r.type === 'tutorial' && r.firstDiff === 'RECRUIT' && r.firstQueue === 4, 'training runs on Recruit with a fixed 4-walker first wave', r);
  check(r.mode === 'dead' && r.wave === 3, 'training ends by itself after wave 3', { mode: r.mode, wave: r.wave, frames: r.frames });
  check(r.hints.some(h => /RELOAD/.test(h)) && r.hints.some(h => /RADAR/.test(h)) && r.hints.some(h => /LAST TRAINING WAVE/.test(h)), 'reload, radar and last-wave hints appear during training', r.hints);
  check(r.toasts.some(t => /WAVE 1 OF 3/.test(t)) && r.toasts.some(t => /WAVE 1 OF 3 CLEAR/.test(t)), 'wave progress toasts', r.toasts);
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  const over = await page.evaluate(() => { const { api } = window.__game; return { h2: document.querySelector('#over h2').textContent, rank: document.querySelector('#over-rank').textContent, chips: [...document.querySelectorAll('#over-rewards span')].map(s => s.textContent), mp7: !!api.profile.arsenal.owned.mp7, primary: api.profile.arsenal.primary, done: api.profile.tutorial.done, reward: api.profile.tutorial.reward, bestWave: api.profile.bestWave, record: api.records.score, runs: api.store.get('runs', []).length, scrap: api.profile.scrap }; });
  check(over.h2 === 'TRAINING COMPLETE' && over.rank === '' && over.chips.some(c => /MP7 UNLOCKED/.test(c)), 'the game-over screen celebrates the training and the unlock', over);
  check(over.mp7 && over.primary === 'mp7' && over.done && over.reward, 'the MP7 is owned and equipped as primary', over);
  check(over.bestWave === 0 && over.record === 0 && over.runs === 0 && over.scrap > 300, 'training pays scrap but sets no records, saves no run and submits nothing', over);
  await page.screenshot({ path: '/tmp/firstdeploy-over.png' });
  await page.evaluate(() => window.__game.api.toMenu());
  await page.waitForTimeout(900);
  const m1 = await vis(page);
  check(m1.start === 'DEPLOY' && !m1.skip && !m1.note && m1.diff && m1.modal, 'after training DEPLOY is back, difficulty is shown and the streak popup appears', m1);
  check(!m1.daily && !m1.missions, 'stage 0 still applies until wave 5', m1);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  const again = await page.evaluate(() => { const o = window.__game.api.deployOpts(); return { type: o.type || 'normal' }; });
  check(again.type === 'normal', 'DEPLOY now starts a normal run', again);
  await page.evaluate(() => { const { api } = window.__game; api.profile.bestWave = 5; api.showScreen(api.ui.menu); });
  const m2 = await vis(page);
  check(m2.daily && m2.missions && m2.event && !m2.ranked && !m2.coop && !m2.season && !m2.league, 'reaching wave 5 reveals the Daily, missions and events', m2);
  await page.evaluate(() => { const { api } = window.__game; api.profile.bestWave = 10; api.showScreen(api.ui.menu); });
  await page.waitForTimeout(1100);
  const m3 = await vis(page);
  check(m3.ranked && m3.coop && m3.season && m3.league, 'reaching wave 10 reveals ranked, co-op and the season', m3);
  await page.close();
}

{
  const page = await open();
  await page.click('#tut-skip');
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => { const { api } = window.__game; return { done: api.profile.tutorial.done, skipped: api.profile.tutorial.skipped, mp7: !!api.profile.arsenal.owned.mp7, start: document.querySelector('#start').textContent, type: api.deployOpts().type || 'normal' }; });
  check(s.done && s.skipped && !s.mp7 && s.start === 'DEPLOY' && s.type === 'normal', 'SKIP TRAINING goes straight to normal runs without the reward', s);
  await page.evaluate(() => { const g = window.__game, { api } = g; api.startGame({ map: 'street' }); Object.assign(api.state, { score: 2000, wave: 3, kills: 20 }); g.gameOver(); });
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
  const r = await page.evaluate(() => { const { api } = window.__game; return { mp7: !!api.profile.arsenal.owned.mp7, reward: api.profile.tutorial.reward, chips: [...document.querySelectorAll('#over-rewards span')].map(s => s.textContent), h2: document.querySelector('#over h2').textContent }; });
  check(r.mp7 && r.reward && r.chips.some(c => /MP7 UNLOCKED/.test(c)) && r.h2 === 'YOU DIED', 'the first normal run to reach wave 3 still grants the MP7', r);
  await page.close();
}

{
  const page = await open({ profile: { runs: 12, bestWave: 8, scrap: 500, xp: 20000, kills: 400, owned: {}, loadout: {}, arsenal: { owned: {} } } });
  const m = await vis(page);
  const t = await page.evaluate(() => window.__game.api.profile.tutorial);
  check(m.start === 'DEPLOY' && !m.skip && m.daily && m.ranked && m.coop && m.season && m.missions && m.event, 'an existing player sees the full menu and no training', { m, t });
  check(t.done && t.reward && !t.staged, 'existing profiles are marked done with no retroactive reward', t);
  await page.close();
}

{
  const page = await open({ flag: true });
  const m = await vis(page);
  check(m.start === 'DEPLOY' && m.daily && m.ranked, 'an install that already finished the old controls tutorial is treated as existing', m);
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  const m = await vis(page);
  check(m.start === 'START TRAINING' && m.skip && m.note, 'portrait menu shows the training call to action', m);
  await page.screenshot({ path: '/tmp/firstdeploy-portrait.png' });
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL FIRST DEPLOY CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
