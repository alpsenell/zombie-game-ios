import { serve, launch, openGame } from './smoke.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/tmp/zombie-shots';
mkdirSync(SHOTS, { recursive: true });
const failures = [];
const check = (ok, label, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failures.push(label);
};

const NEW = ['screamer', 'shield', 'stalker', 'juggernaut'];
const DIFFS = ['recruit', 'survivor', 'veteran', 'nightmare'];

const helpers = () => {
  const g = window.__game, { api } = g, T = window.__t = {};
  T.fresh = (difficulty, seed = 1) => {
    api.startGame({ seed, difficulty });
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    T.quiet();
  };
  T.quiet = () => {
    const { state, stats, settings } = api;
    state.between = true; state.queue = [];
    stats.armor = 0; settings.autoFire = false; settings.aimAssist = false;
    for (const z of api.zombies) api.scene.remove(z);
    api.zombies.length = 0;
    for (const p of api.pickups) api.scene.remove(p);
    api.pickups.length = 0;
  };
  T.ahead = (dist, side = 0) => {
    const c = api.camera.position, y = api.look.yaw;
    return [c.x - Math.sin(y) * dist + Math.cos(y) * side, c.z - Math.cos(y) * dist - Math.sin(y) * side];
  };
  T.clearAhead = () => {
    const c = api.camera.position;
    let best = null;
    for (let a = 0; a < 64; a++) {
      const yaw = a / 64 * Math.PI * 2;
      let ok = 0;
      for (let d = 1; d <= 22; d++) if (!api.blocked(c.x - Math.sin(yaw) * d, c.z - Math.cos(yaw) * d, 1.4)) ok++; else break;
      if (!best || ok > best.ok) best = { yaw, ok };
    }
    api.look.yaw = best.yaw; api.look.pitch = 0;
    return best.ok;
  };
  T.aimAt = (x, y, z) => {
    const c = api.camera.position, tx = x - c.x, tz = z - c.z;
    api.look.pitch = Math.atan2(y - c.y, Math.hypot(tx, tz));
    api.look.recoil = 0; api.look.shake = 0;
    api.camera.rotation.set(api.look.pitch, Math.atan2(-tx, -tz), 0);
    api.look.yaw = Math.atan2(-tx, -tz);
  };
  T.shot = () => {
    const n = api.state.shots;
    api.state.clock += 2; api.player.nextShot = 0; api.player.reloading = 0; api.player.swapT = 0;
    api.player.ammo[api.player.weapon] = 30;
    api.scene.updateMatrixWorld(true);
    g.setFiring(true); g.update(1 / 60); g.setFiring(false);
    return api.state.shots - n;
  };
};

const { server, url } = await serve();
const browser = await launch();
const { page, errors } = await openGame(browser, url);
await page.evaluate(helpers);

const roster = await page.evaluate(({ NEW, DIFFS }) => {
  const { api } = window.__game, st = api.state, H = api.netHooks, out = { seen: {}, n10: {}, capOk: true, recruitGentle: 0, nightmareSpecial: 0 };
  for (const d of DIFFS) {
    st.runDifficulty = d; st.mod = null;
    const seen = out.seen[d] = {};
    api.rng.set(99);
    for (let w = 1; w <= 40; w++) {
      const list = H.waveComposition(w), count = {};
      for (const e of list) { seen[e.kind] = Math.min(seen[e.kind] ?? w, w); count[e.kind] = (count[e.kind] || 0) + 1; }
      for (const k in count) { const cap = api.ZT[k].cap; if (cap && count[k] > cap[0] + Math.floor(w / cap[1])) out.capOk = false; }
      if (w === 12) {
        const wt = api.rosterWeights(w, api.DIFFICULTIES[d]), sum = Object.values(wt).reduce((a, b) => a + b, 0), sp = 1 - wt.walker / sum;
        if (d === 'recruit') out.recruitGentle = sp;
        if (d === 'nightmare') out.nightmareSpecial = sp;
      }
    }
    const agg = out.n10[d] = {};
    for (let i = 0; i < 6; i++) for (const e of H.waveComposition(10)) agg[e.kind] = (agg[e.kind] || 0) + 1;
  }
  st.runDifficulty = null;
  api.rng.set(null);
  return out;
}, { NEW, DIFFS });

const firstSeen = (d, k) => roster.seen[d][k] ?? '-';
console.log('\nfirst wave seen (waves 1-40):');
console.log('type'.padEnd(12) + DIFFS.map(d => d.padStart(10)).join(''));
for (const k of ['walker', 'runner', 'crawler', 'spitter', 'bloater', 'riot', 'brute', ...NEW]) console.log(k.padEnd(12) + DIFFS.map(d => String(firstSeen(d, k)).padStart(10)).join(''));
console.log('');
for (const k of NEW) check(!roster.seen.recruit[k], `roster: RECRUIT never spawns ${k}`);
for (const k of ['shield', 'stalker', 'juggernaut']) check(!roster.seen.survivor[k], `roster: SURVIVOR never spawns ${k}`);
for (const k of ['stalker', 'juggernaut']) check(!roster.seen.veteran[k], `roster: VETERAN never spawns ${k}`);
check(roster.seen.survivor.screamer >= 5, 'roster: SURVIVOR meets the screamer in mid waves', 'wave ' + roster.seen.survivor.screamer);
check(roster.seen.veteran.shield && roster.seen.veteran.screamer, 'roster: VETERAN adds shieldbearers and screamers');
check(NEW.every(k => roster.n10.nightmare[k] > 0), 'roster: NIGHTMARE wave 10 composition includes every new type', JSON.stringify(roster.n10.nightmare));
check(roster.capOk, 'roster: per-wave caps respected (screamer, juggernaut)');
check(roster.nightmareSpecial > roster.recruitGentle + .15, 'roster: NIGHTMARE has a much heavier special mix than RECRUIT', `${roster.recruitGentle.toFixed(2)} vs ${roster.nightmareSpecial.toFixed(2)}`);

const det = await page.evaluate(() => {
  const g = window.__game, { api } = g, T = window.__t, st = api.state;
  const record = seed => {
    T.fresh('nightmare', seed);
    api.camera.position.set(g.world.map.start.x, 1.64, g.world.map.start.z); api.look.yaw = g.world.map.start.yaw;
    const seq = [];
    for (let w = 0; w < 12; w++) {
      st.between = true;
      api.nextWave();
      seq.push('W' + st.wave + ':' + (st.mod || '') + ':' + (st.mutation || ''));
      let guard = 0;
      while (st.queue.length && guard++ < 4000) {
        g.update(1 / 30);
        for (const z of api.zombies) seq.push(z.userData.kind + (z.userData.elite ? '*' : '') + '@' + z.position.x.toFixed(1) + ',' + z.position.z.toFixed(1));
        for (const z of api.zombies) api.scene.remove(z);
        api.zombies.length = 0;
      }
    }
    T.quiet();
    return seq;
  };
  const a = record(31337), b = record(31337), c = record(4242);
  return { same: JSON.stringify(a) === JSON.stringify(b), differs: JSON.stringify(a) !== JSON.stringify(c), n: a.length, kinds: [...new Set(a.map(s => s.split('@')[0].replace('*', '')).filter(s => !s.startsWith('W')))], mutations: a.filter(s => s.startsWith('W') && !s.endsWith(':')).length };
});
check(det.same && det.n > 200, 'seeded: two NIGHTMARE runs with the same seed spawn identical sequences', det.n + ' entries');
check(det.differs, 'seeded: a different seed spawns a different sequence');
check(NEW.every(k => det.kinds.includes(k)), 'seeded: the 12-wave NIGHTMARE sequence spawns every new type', det.kinds.join(','));
check(det.mutations > 0, 'seeded: NIGHTMARE rolls per-wave mutations', det.mutations + ' mutated waves');

const behave = await page.evaluate(({ NEW, DIFFS }) => {
  const g = window.__game, { api } = g, T = window.__t, st = api.state, out = {};
  const kills = [];
  const off = api.bus.on('kill', e => kills.push(e.kind));
  for (const d of DIFFS) for (const kind of [...NEW, 'crawler', 'bloater']) {
    T.fresh(d);
    T.clearAhead();
    st.mode = 'playing'; st.wave = 8;
    const dist = { screamer: 19, shield: 9, stalker: 18, juggernaut: 13, crawler: 7, bloater: 7 }[kind];
    const [x, z] = T.ahead(dist);
    const zb = api.makeZombie(kind, x, z, false), u = zb.userData;
    const [bx, bz] = T.ahead(dist + 1.5, 1.5);
    const buddy = kind === 'screamer' ? api.makeZombie('walker', bx, bz, false) : null;
    if (buddy) buddy.userData.speed = 0;
    const hurt0 = api.player.lastHurt, x0 = zb.position.x, z0 = zb.position.z, total0 = st.waveTotal;
    const r = { moved: 0, attacked: false, hidden: false, charged: false, screamed: false, lunged: false, swelled: false, hasted: false, died: false, killed: false };
    for (let f = 0; f < 30 * 14 && !u.dead; f++) {
      api.player.hp = api.stats.maxHp;
      g.update(1 / 30);
      r.moved = Math.max(r.moved, Math.hypot(zb.position.x - x0, zb.position.z - z0));
      if (u.hidden) r.hidden = true;
      if (u.cs === 'run') r.charged = true;
      if (u.screamT > 0) r.screamed = true;
      if (u.lungeT > 0) r.lunged = true;
      if (u.swellT > 0) r.swelled = true;
      if (buddy?.userData.hasteT > 0) r.hasted = true;
      if (api.player.lastHurt !== hurt0) r.attacked = true;
    }
    r.summoned = st.waveTotal - total0;
    if (u.dead) r.died = true;
    else { const n = kills.length; st.between = false; api.damageZombie(zb, 1e9, null, false, null); st.between = true; r.died = u.dead; r.killed = kills[n] === kind; }
    out[d + ':' + kind] = r;
    T.quiet();
  }
  off();
  return out;
}, { NEW, DIFFS });

for (const d of DIFFS) {
  const b = k => behave[d + ':' + k];
  check(b('screamer').moved > 1 && b('screamer').screamed && b('screamer').hasted && b('screamer').died && b('screamer').killed, `${d}: screamer approaches, screams (hastes the horde) and dies with a kill event`, JSON.stringify(b('screamer')));
  check(b('screamer').summoned > 0, `${d}: screamer summons reinforcements`, 'summoned ' + b('screamer').summoned);
  check(b('shield').moved > 1 && b('shield').attacked && b('shield').killed, `${d}: shieldbearer advances, attacks and dies`, JSON.stringify(b('shield')));
  check(b('stalker').moved > 3 && b('stalker').hidden && b('stalker').attacked && b('stalker').killed, `${d}: stalker fades out, flanks in, attacks and dies`, JSON.stringify(b('stalker')));
  check(b('juggernaut').charged && b('juggernaut').attacked && b('juggernaut').killed, `${d}: juggernaut charges, hits and dies`, JSON.stringify(b('juggernaut')));
  check(b('crawler').lunged === (d !== 'recruit') && b('crawler').attacked, `${d}: crawler ${d === 'recruit' ? 'does not lunge' : 'lunges'} and attacks`, JSON.stringify(b('crawler')));
  check(b('bloater').swelled && b('bloater').died, `${d}: bloater swells (telegraph) before bursting`, JSON.stringify(b('bloater')));
}

const mech = await page.evaluate(() => {
  const g = window.__game, { api } = g, T = window.__t, st = api.state, out = {};
  T.fresh('veteran');
  T.clearAhead();
  const [x, z] = T.ahead(6);
  const zb = api.makeZombie('shield', x, z, false), u = zb.userData;
  u.hp = u.maxHp = 1e6; u.speed = 0;
  for (let i = 0; i < 20; i++) g.update(1 / 30);
  const hit = aim => { const h = u.hp; aim(); T.shot(); return h - u.hp; };
  const chest = () => T.aimAt(zb.position.x, 1.05 * u.sc, zb.position.z);
  api.scene.updateMatrixWorld(true);
  const hp = new api.THREE.Vector3(); u.P.head.getWorldPosition(hp);
  const head = () => T.aimAt(hp.x, hp.y + .1 * u.sc, hp.z);
  out.front = hit(chest);
  out.head = hit(head);
  zb.rotation.y += Math.PI;
  out.back = hit(chest);
  zb.rotation.y -= Math.PI;
  const h0 = u.hp; api.explode(zb.position.x, zb.position.z, { radius: 4, zdmg: 300 }); out.blast = h0 - u.hp;
  T.quiet();

  T.fresh('nightmare');
  T.clearAhead();
  const [sx, sz] = T.ahead(9);
  const s = api.makeZombie('screamer', sx, sz, false), su = s.userData;
  su.hp = su.maxHp = 1e6; su.speed = 0; su.nextScream = 0; su.clear = true;
  st.mode = 'playing';
  g.update(1 / 30);
  out.winding = su.screamT > 0;
  api.scene.updateMatrixWorld(true);
  s.userData.P.head.getWorldPosition(hp);
  T.aimAt(hp.x, hp.y + .05, hp.z);
  api.damageZombie(s, 5, hp.clone(), true, null);
  out.interrupted = su.screamT === 0 && su.nextScream > st.clock;
  T.quiet();

  T.fresh('nightmare');
  T.clearAhead();
  st.mode = 'playing'; st.wave = 12;
  const spitters = [];
  for (let i = 0; i < 8; i++) { const [px, pz] = T.ahead(9 + (i % 4), (i - 4) * 1.4); const p = api.makeZombie('spitter', px, pz, false); p.userData.speed = 0; p.userData.nextSpit = 0; p.userData.clear = true; spitters.push(p); }
  let maxWind = 0;
  for (let f = 0; f < 30 * 6; f++) { api.player.hp = api.stats.maxHp; g.update(1 / 30); maxWind = Math.max(maxWind, spitters.filter(p => p.userData.spitWind > 0).length); }
  out.maxWind = maxWind; out.rangedCap = api.diff().ranged;
  T.quiet();

  T.fresh('nightmare');
  st.mutation = 'hardened';
  const a = api.makeZombie('walker', 0, 0, false).userData.maxHp;
  st.mutation = null;
  const b2 = api.makeZombie('walker', 0, 0, false).userData.maxHp;
  out.hardened = a / b2;
  st.mutation = 'regen'; st.mode = 'playing';
  T.clearAhead();
  const [rx, rz] = T.ahead(15);
  const rz0 = api.makeZombie('walker', rx, rz, false), ru = rz0.userData;
  ru.speed = 0; ru.hp = ru.maxHp * .5; ru.hitAt = -9;
  for (let f = 0; f < 30; f++) g.update(1 / 30);
  out.regen = ru.hp / ru.maxHp;
  st.mutation = null;
  T.quiet();
  return out;
});
check(mech.front > 0 && mech.front < mech.back * .2, 'shieldbearer: frontal body fire is heavily reduced, flanking hits land fully', `front ${mech.front.toFixed(1)} vs back ${mech.back.toFixed(1)}`);
check(mech.head > mech.front * 4, 'shieldbearer: headshots bypass the shield', `head ${mech.head.toFixed(1)}`);
check(mech.blast > 100, 'shieldbearer: explosives bypass the shield', `blast ${mech.blast.toFixed(0)}`);
check(mech.winding && mech.interrupted, 'screamer: telegraphed wind-up, headshot interrupts the scream');
check(mech.maxWind > 0 && mech.maxWind <= mech.rangedCap, 'ranged attackers capped simultaneously', `${mech.maxWind} winding (cap ${mech.rangedCap})`);
check(Math.abs(mech.hardened - 1.25) < .01, 'mutation HARDENED: +25% hp');
check(mech.regen > .52, 'mutation REGENERATING: unhurt infected heal', mech.regen.toFixed(3));

const comp = await page.evaluate(async () => {
  const g = window.__game, { api } = g, st = api.state;
  const { plausible } = await import('./features/competitive.js');
  const out = {};
  let worst = 0;
  const modMax = Math.max(1, ...Object.values(api.MODS).map(m => m.score ?? 1));
  for (const k in api.ZT) if (!api.ZT[k].boss) worst = Math.max(worst, api.ZT[k].score * 2 * 1.5 * 4 * modMax);
  out.worstPerKill = worst;
  api.startGame({ seed: 777, difficulty: 'nightmare', type: 'ranked', slots: api.loadoutWeapons() });
  api.settings.autoFire = true; api.settings.aimAssist = true;
  const seen = new Set();
  for (let i = 0; i < 30 * 600 && st.wave < 11; i++) {
    api.player.hp = api.stats.maxHp;
    if (st.mode === 'perk') document.querySelector('.perk').click();
    if (st.mode !== 'playing') break;
    let best = null, bd = 1e9;
    for (const z of api.zombies) { const u = z.userData; seen.add(u.kind); if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
    if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
    g.update(1 / 30); api.scene.updateMatrixWorld();
  }
  st.mode = 'playing'; st.between = false;
  const c = api.camera.position;
  for (let i = 0; i < 40; i++) {
    const k = ['screamer', 'shield', 'stalker', 'juggernaut'][i % 4], z = api.makeZombie(k, c.x + 3, c.z + 3, false, true);
    seen.add(k);
    api.damageZombie(z, 1e9, new api.THREE.Vector3(c.x + 3, 1.8, c.z + 3), true, null);
  }
  st.between = true;
  const run = api.runSummary();
  out.run = { wave: run.wave, kills: run.kills, score: run.score, time: Math.round(run.time) };
  out.verdict = plausible(run, api);
  const maxed = { ...run, score: Math.round(run.kills * worst * api.DIFFICULTIES.nightmare.score) };
  out.maxedVerdict = plausible(maxed, api);
  out.seen = [...seen];
  g.gameOver();
  return out;
});
check(comp.worstPerKill <= 7100, 'competitive: max non-boss points per kill stays under plausible() per-kill budget', comp.worstPerKill + ' / 7100');
check(comp.verdict === null, 'competitive: plausible() accepts a legit NIGHTMARE run with the new types', JSON.stringify(comp.run) + ' → ' + comp.verdict);
check(comp.maxedVerdict === null, 'competitive: plausible() accepts every kill at max elite/head/combo/mod points');
console.log('  bot run met: ' + comp.seen.join(','));

const draw = await page.evaluate(({ NEW }) => {
  const g = window.__game, { api } = g, T = window.__t;
  const measure = kinds => {
    T.fresh('nightmare');
    T.clearAhead();
    kinds.forEach((k, i) => { const [x, z] = T.ahead(8 + (i % 4) * 2.5, ((i / 4) | 0) * 2 - 3); const zb = api.makeZombie(k, x, z, false); zb.userData.speed = 0; zb.userData.hidden = false; });
    for (let i = 0; i < 5; i++) g.update(1 / 30);
    api.scene.updateMatrixWorld(true);
    g.renderer.render(api.scene, api.camera);
    const calls = g.renderer.info.render.calls;
    const meshes = api.zombies.reduce((a, z) => a + z.userData.meshes.length, 0);
    T.quiet();
    return { calls, meshes };
  };
  const walkers = measure(Array(12).fill('walker'));
  const mixed = measure(Array.from({ length: 12 }, (_, i) => NEW[i % 4]));
  const per = {};
  for (const k of ['walker', 'brute', ...NEW]) { per[k] = api.makeZombie(k, 0, 0, false).userData.meshes.length; }
  T.quiet();
  return { walkers, mixed, per };
}, { NEW });
console.log(`\ndraw calls, 12 walkers: ${draw.walkers.calls} (${draw.walkers.meshes} meshes) · 12 new types: ${draw.mixed.calls} (${draw.mixed.meshes} meshes)`);
console.log('meshes per zombie: ' + JSON.stringify(draw.per));
check(draw.mixed.calls <= draw.walkers.calls * 1.1, 'draw calls: a horde of new types costs about the same as walkers', `${draw.mixed.calls} vs ${draw.walkers.calls}`);

await page.close();
const view = await openGame(browser, url, { width: 852, height: 393 });
await view.page.evaluate(helpers);
const shots = [];
const snap = async (name, fn, arg) => {
  await view.page.evaluate(fn, arg);
  await view.page.waitForTimeout(800);
  const path = `${SHOTS}/${name}.png`;
  await view.page.screenshot({ path });
  shots.push(path);
};
const pose = ({ kinds, close, map }) => {
  const g = window.__game, { api } = g, T = window.__t;
  if (map && api.currentMap !== map) api.loadMap(map);
  T.fresh('nightmare');
  api.hint('');
  T.clearAhead();
  const st = api.state;
  st.mode = 'playing'; st.wave = 12;
  const zs = kinds.map((k, i) => {
    const [x, z] = close ? T.ahead(2 + api.ZT[k].scale, 0) : T.ahead(6.5 + (i % 4) * 2.6 + ((i * 7) % 3) * .4, ((i % 5) - 2) * 1.7);
    const zb = api.makeZombie(k, x, z, false);
    zb.userData.speed = 0; zb.userData.nextAttack = 1e9; zb.userData.nextScream = 1e9; zb.userData.nextCharge = 1e9; zb.userData.nextSpit = 1e9; zb.userData.nextLunge = 1e9;
    return zb;
  });
  for (let i = 0; i < 20; i++) { g.update(1 / 30); api.player.hp = api.stats.maxHp; }
  if (close) {
    const zb = zs[0];
    const tx = zb.position.x - api.camera.position.x, tz = zb.position.z - api.camera.position.z;
    api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2(zb.userData.sc * (zb.userData.T.crawl ? .4 : .95) - 1.64, Math.hypot(tx, tz));
  } else api.look.pitch = -.03;
  g.update(1 / 30);
  api.ui.message.classList.remove('on');
  st.mode = 'paused';
};
await view.page.evaluate(pose, { kinds: ['walker'], close: true });
await view.page.waitForTimeout(1500);
for (const k of NEW) await snap(`${k}-close`, pose, { kinds: [k], close: true });
for (const k of NEW) await snap(`${k}-horde`, pose, { kinds: [k, 'walker', k, 'runner', k, 'walker', k, 'crawler'], close: false });
await snap('nightmare-mix-horde', pose, { kinds: ['juggernaut', 'screamer', 'shield', 'stalker', 'walker', 'shield', 'runner', 'spitter', 'stalker', 'walker', 'riot', 'brute'], close: false });
await snap('nightmare-mix-mall', pose, { kinds: ['juggernaut', 'screamer', 'shield', 'stalker', 'walker', 'shield', 'runner', 'walker'], close: false, map: 'mall' });
const fade = () => {
  const g = window.__game, { api } = g;
  api.state.mode = 'playing';
  for (let i = 0; i < 20; i++) { for (const z of api.zombies) if (z.userData.kind === 'stalker') Object.assign(z.userData, { hidden: true, stalkT: 9, hitAt: -9 }); g.update(1 / 30); }
  api.state.mode = 'paused';
};
await view.page.evaluate(pose, { kinds: ['stalker', 'walker', 'stalker', 'runner', 'stalker', 'walker'], close: false, map: 'street' });
await snap('stalker-faded-horde', fade);
await view.page.evaluate(() => { window.__game.api.state.mode = 'playing'; window.__game.api.toMenu(); });
console.log('\nscreenshots: ' + SHOTS);
for (const p of shots) console.log('  ' + p);

const allErrors = [...errors, ...view.errors];
check(!allErrors.length, 'no page errors', allErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} FAILED:\n  ` + failures.join('\n  ')); process.exit(1); }
console.log('\nzombies ok');
