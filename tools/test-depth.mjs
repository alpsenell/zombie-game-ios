import { serve, launch, openGame } from './smoke.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const failures = [];
const check = (ok, label, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failures.push(label);
};

const helpers = () => {
  const g = window.__game, { api } = g, T = window.__t = {};
  T.freshRun = (opts = {}) => {
    api.startGame({ seed: 1, ...opts });
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
  T.spawn = (kind, dx, dz, hp = 1e6, speed = 0) => {
    const c = api.camera.position, z = api.makeZombie(kind, c.x + dx, c.z + dz, false);
    z.userData.hp = z.userData.maxHp = hp; z.userData.speed = speed;
    return z;
  };
  T.aimAt = (x, y, z) => {
    const c = api.camera.position, tx = x - c.x, tz = z - c.z;
    api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2(y - c.y, Math.hypot(tx, tz));
    api.look.recoil = 0; api.look.shake = 0;
    api.camera.rotation.set(api.look.pitch, api.look.yaw, 0);
  };
  T.aimChest = zb => T.aimAt(zb.position.x, zb.position.y + 1.2 * zb.userData.sc, zb.position.z);
  T.aimHead = zb => {
    api.scene.updateMatrixWorld(true);
    const p = new api.THREE.Vector3();
    zb.userData.P.head.getWorldPosition(p);
    T.aimAt(p.x, p.y + .18 * zb.userData.sc, p.z);
  };
  T.shot = () => {
    const n = api.state.shots;
    api.state.clock += 2; api.player.nextShot = 0; api.player.reloading = 0; api.player.swapT = 0;
    api.scene.updateMatrixWorld(true);
    g.setFiring(true); g.update(1 / 60); g.setFiring(false);
    return api.state.shots - n;
  };
  T.perk = name => {
    const p = api.PERKS.find(p => p.name === name);
    p.apply();
    api.state.perks.push(name);
    api.bus.emit('perk', { name, icon: p.icon, legendary: !!p.legendary, rare: !!p.rare, wave: api.state.wave });
    return p;
  };
  T.bot = (frames, god = true) => {
    const { state, settings } = api;
    settings.autoFire = true; settings.aimAssist = true;
    for (let i = 0; i < frames; i++) {
      if (god) api.player.hp = api.stats.maxHp;
      if (state.mode === 'perk') document.querySelector('.perk').click();
      if (state.mode !== 'playing') break;
      let best = null, bd = 1e9;
      for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
      if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
      g.update(1 / 30); api.scene.updateMatrixWorld();
    }
  };
};

const { server, url } = await serve();
const browser = await launch();
const { page, errors } = await openGame(browser, url);
await page.evaluate(helpers);
const MAPS = await page.evaluate(() => window.__game.api.MAPS);

check(MAPS.length === 4 && MAPS.every(m => m.id && m.name && m.desc && Object.keys(m).length === 3), 'api.MAPS lists 4 maps as { id, name, desc }', MAPS.map(m => m.id).join(','));

const drawCalls = {};
for (const { id } of MAPS) {
  const r = await page.evaluate(id => {
    const g = window.__game, { api } = g, T = window.__t, NAV = g.NAV;
    api.loadMap(api.MAPS.find(m => m.id !== id).id);
    const builds = NAV.builds;
    api.startGame({ map: id, seed: 4242 });
    const B = g.world.map.bounds, out = { current: api.currentMap, rebuilt: NAV.builds, before: builds };
    out.navMatches = NAV.minX === Math.round(B.minX) && NAV.minZ === Math.round(B.minZ) && NAV.w === Math.round(B.maxX) - Math.round(B.minX) + 1 && NAV.h === Math.round(B.maxZ) - Math.round(B.minZ) + 1;
    out.nav = NAV.w + 'x' + NAV.h;
    const S = g.world.map.start;
    out.startFree = !api.blocked(S.x, S.z, .6);
    g.updateNav(S.x, S.z);
    let open = 0, reach = 0;
    for (let k = 0; k < NAV.solid.length; k++) if (!NAV.solid[k]) { open++; if (NAV.dist[k] >= 0) reach++; }
    out.reachFrac = reach / open;
    out.fallbacksOk = g.world.map.spawns.every(([x, z]) => { const c = g.navCell(x, z); return c >= 0 && NAV.dist[c] >= 0; });
    const cells = [];
    for (let k = 0; k < NAV.solid.length; k++) if (NAV.dist[k] >= 0) {
      const i = k % NAV.w, j = (k - i) / NAV.w, x = NAV.minX + i, z = NAV.minZ + j;
      if (!api.blocked(x, z, 1.4)) cells.push([x, z]);
    }
    let seed = 7, bad = 0, total = 0, fallback = 0;
    const pick = () => cells[(seed = (seed * 16807) % 2147483647) % cells.length];
    const positions = [];
    for (let p = 0; p < 30; p++) {
      const [x, z] = pick();
      positions.push([x, z]);
      api.camera.position.set(x, 1.64, z);
      g.updateNav(x, z);
      for (let s = 0; s < 30; s++) {
        const sp = g.findSpawn(16), c = g.navCell(sp.x, sp.z);
        total++;
        if (sp.facing === undefined) fallback++;
        if (c < 0 || NAV.dist[c] < 0) bad++;
      }
    }
    out.spawnBad = bad; out.spawnTotal = total; out.spawnFallback = fallback;
    const ob = g.obstacles.filter(o => o.w >= 1.4 && o.w < 12 && o.d < 12);
    let blockTested = 0, penetrated = 0;
    for (const o of ob) {
      const sz = o.z + o.d / 2 + 1.6;
      if (api.blocked(o.x, sz, .5) || api.blocked(o.x, sz + 1, .5)) continue;
      api.startGame({ map: id, seed: 4242 });
      T.quiet();
      api.camera.position.set(o.x, 1.64, sz); api.look.yaw = 0;
      api.move.y = 1;
      let inside = false;
      for (let f = 0; f < 90; f++) { g.update(1 / 30); if (api.blocked(api.camera.position.x, api.camera.position.z, .3)) inside = true; }
      api.move.y = 0;
      blockTested++;
      if (inside || api.camera.position.z < o.z + o.d / 2) penetrated++;
      if (blockTested >= 6) break;
    }
    out.blockTested = blockTested; out.penetrated = penetrated;
    out.reach = [];
    const tries = [[S.x, S.z], positions[3], positions[11]];
    for (const [px, pz] of tries) {
      api.startGame({ map: id, seed: 99 });
      api.stats.armor = 0; api.settings.autoFire = false; api.settings.aimAssist = false;
      api.camera.position.set(px, 1.64, pz);
      const min = new Map();
      for (let f = 0; f < 30 * 75; f++) {
        g.update(1 / 30);
        for (const z of api.zombies) {
          if (z.userData.rise > 0) continue;
          const d = Math.hypot(z.position.x - api.camera.position.x, z.position.z - api.camera.position.z);
          min.set(z, Math.min(min.get(z) ?? 1e9, d));
        }
      }
      const vals = [...min.values()];
      out.reach.push({ at: [px, pz], spawned: vals.length, reached: vals.filter(d => d < 2.6).length, worst: Math.max(...vals).toFixed(1) });
    }
    api.startGame({ map: id, seed: 5 });
    for (let f = 0; f < 60; f++) g.update(1 / 30);
    api.scene.updateMatrixWorld(true);
    g.renderer.render(api.scene, api.camera);
    out.calls = g.renderer.info.render.calls; out.tris = g.renderer.info.render.triangles;
    let lights = 0; api.scene.traverse(o => { if (o.isLight && o.visible) lights++; });
    out.lights = lights;
    let worldLights = 0; g.world.group.traverse(o => { if (o.isPointLight || o.isSpotLight) worldLights++; });
    out.worldLights = worldLights;
    out.solids = g.solids.length; out.obstacles = g.obstacles.length;
    return out;
  }, id);
  drawCalls[id] = r.calls;
  console.log(`\n[${id}] nav ${r.nav} · draw calls ${r.calls} · tris ${r.tris} · dynamic world lights ${r.worldLights} · obstacles ${r.obstacles}`);
  check(r.current === id && r.rebuilt > r.before, `${id}: startGame({ map }) loads map and recomputes nav`, `builds ${r.before}→${r.rebuilt}`);
  check(r.navMatches, `${id}: nav grid bounds come from the map`);
  check(r.startFree, `${id}: player start is free`);
  check(r.reachFrac > .97, `${id}: open cells reachable from start`, (r.reachFrac * 100).toFixed(1) + '%');
  check(r.fallbacksOk, `${id}: fallback spawns reachable`);
  check(r.spawnBad === 0, `${id}: findSpawn picks only nav-reachable cells`, `${r.spawnTotal - r.spawnBad}/${r.spawnTotal} ok, ${r.spawnFallback} fallbacks, from 30 player positions`);
  check(r.blockTested >= 3 && r.penetrated === 0, `${id}: obstacles block player movement`, `${r.blockTested} obstacles walked into`);
  for (const t of r.reach) check(t.spawned >= 5 && t.reached === t.spawned, `${id}: zombies reach player at (${t.at.join(',')})`, `${t.reached}/${t.spawned} reached, worst min distance ${t.worst}`);
  check(r.worldLights <= 5, `${id}: dynamic lights ≤ 5`, String(r.worldLights));
}
const streetCalls = drawCalls.street;
for (const id in drawCalls) check(drawCalls[id] <= streetCalls * 1.25, `${id}: draw calls comparable to street`, `${drawCalls[id]} vs ${streetCalls}`);

for (const { id } of MAPS) {
  const r = await page.evaluate(id => {
    const g = window.__game, { api } = g;
    api.startGame({ map: id, seed: 3 });
    window.__t.bot(30 * 200);
    return { wave: api.state.wave, kills: api.state.kills, mode: api.state.mode };
  }, id);
  check(r.wave >= 4 && errors.length === 0, `${id}: bot survives waves headlessly without errors`, `wave ${r.wave}, ${r.kills} kills`);
}

const cycle = await page.evaluate(() => {
  const g = window.__game, { api } = g, rows = [], T = api.THREE, disposed = new WeakSet();
  const gd = T.BufferGeometry.prototype.dispose, md = T.Material.prototype.dispose;
  T.BufferGeometry.prototype.dispose = function () { disposed.add(this); return gd.call(this); };
  T.Material.prototype.dispose = function () { disposed.add(this); return md.call(this); };
  api.toMenu();
  const ids = ['street', 'mall', 'overpass', 'base'];
  for (const id of [...ids, ...ids, ...ids, ...ids, ...ids]) {
    const old = [];
    g.world.group.traverse(o => { if (o.geometry && !o.isSprite) old.push(o.geometry); if (o.material) old.push(o.material); });
    api.loadMap(id);
    const kept = old.filter(x => x.isBufferGeometry && !disposed.has(x));
    g.renderer.render(api.scene, api.camera);
    let lights = 0; api.scene.traverse(o => { if (o.isLight) lights++; });
    const m = g.renderer.info.memory;
    rows.push({ id, children: api.scene.children.length, lights, geos: m.geometries, tex: m.textures, obstacles: g.obstacles.length, fires: g.fires.length, oldItems: old.length, undisposed: kept.length, worlds: api.scene.children.filter(c => c.name === 'world').length });
  }
  T.BufferGeometry.prototype.dispose = gd; T.Material.prototype.dispose = md;
  return rows;
});
const byMap = {};
let stable = true;
for (const r of cycle) {
  if (byMap[r.id]) for (const k of ['children', 'lights', 'obstacles', 'fires']) if (byMap[r.id][k] !== r[k]) stable = false;
  byMap[r.id] ||= r;
  if (r.worlds !== 1) stable = false;
}
const first = cycle.slice(12, 16), second = cycle.slice(16, 20);
const undisposed = cycle.reduce((n, r) => n + r.undisposed, 0), texGrowth = Math.max(...second.map((r, i) => r.tex - first[i].tex));
console.log('\nmap switch cycle (steady state):', cycle.slice(12).map(r => `${r.id}(children ${r.children}, lights ${r.lights}, geos ${r.geos}, tex ${r.tex})`).join(' → '));
check(stable, 'map switching keeps scene children, lights, obstacles and fires stable (one world group)');
check(undisposed === 0 && texGrowth === 0, 'map switching disposes every old world geometry and leaks no textures', `${cycle.reduce((n, r) => n + r.oldItems, 0)} old geometries/materials checked, ${undisposed} undisposed geometries, texture growth per cycle ${texGrowth}`);
const menuShows = await page.evaluate(() => {
  const { api } = window.__game;
  api.startGame({ map: 'overpass' }); api.toMenu();
  return [api.currentMap, localStorage.getItem('deadzone.map')];
});
check(menuShows[0] === 'overpass' && menuShows[1] === '"overpass"', 'menu keeps the last played map (persisted)', menuShows.join(' / '));

const perks = await page.evaluate(() => {
  const g = window.__game, { api } = g, T = window.__t, out = {};
  const { stats, player, state } = api;
  out.newCount = api.PERKS.length;
  out.legendary = api.PERKS.filter(p => p.legendary).map(p => p.name);
  T.freshRun({ map: 'street' });

  let booms = 0;
  const boom = api.sfx.boom;
  api.sfx.boom = () => { booms++; };
  T.perk('EXPLOSIVE ROUNDS');
  let z = T.spawn('walker', 0, -6);
  const hitsAt = [];
  for (let k = 0; k < 10; k++) { T.aimChest(z); T.shot(); hitsAt.push(booms); }
  out.explosive = { stat: stats.explosive, boomsAfter9: hitsAt[8], boomsAfter10: hitsAt[9], hits: state.hits };
  api.sfx.boom = boom;
  stats.explosive = 0;

  T.quiet();
  const line = () => [T.spawn('walker', 0, -5), T.spawn('walker', 0, -6.6), T.spawn('walker', 0, -8.2)];
  let zs = line(); T.aimChest(zs[0]); T.shot();
  out.pierce0 = zs.filter(z => z.userData.hp < z.userData.maxHp).length;
  T.quiet(); T.perk('RICOCHET');
  zs = line(); T.aimChest(zs[0]); T.shot();
  out.pierce1 = zs.filter(z => z.userData.hp < z.userData.maxHp).length;
  stats.pierce = 0;

  T.quiet(); T.perk('BERSERKER');
  z = T.spawn('walker', 0, -5);
  player.hp = stats.maxHp; T.aimChest(z); T.shot();
  const full = z.userData.maxHp - z.userData.hp;
  z.userData.hp = z.userData.maxHp; player.hp = stats.maxHp * .2; T.aimChest(z); T.shot();
  const low = z.userData.maxHp - z.userData.hp;
  out.berserk = { full, low, ratio: low / full, stat: stats.berserk };
  stats.berserk = 0; player.hp = stats.maxHp;

  T.quiet(); T.perk('TRIGGER DISCIPLINE');
  z = T.spawn('walker', 0, -4);
  player.ammo[player.weapon] = 20;
  T.aimHead(z); T.shot();
  out.refund = { ammo: player.ammo[player.weapon], dmg: z.userData.maxHp - z.userData.hp };
  stats.refund = 0;
  z.userData.hp = z.userData.maxHp; T.aimHead(z); T.shot();
  out.noRefundAmmo = player.ammo[player.weapon];

  T.quiet();
  const fp = T.perk('FROST ROUNDS'); out.frostStat = stats.frost;
  stats.frost = 1; z = T.spawn('walker', 0, -5); T.aimChest(z); T.shot();
  out.chill = z.userData.chill || 0; stats.frost = 0;
  T.quiet(); T.perk('INCENDIARY ROUNDS'); out.fireStat = stats.incendiary;
  stats.incendiary = 1; z = T.spawn('walker', 0, -5); T.aimChest(z); T.shot();
  out.burn = z.userData.burnT || 0; stats.incendiary = 0;

  T.quiet(); T.perk('ADRENALINE');
  const S = g.world.map.start;
  const run = () => { api.camera.position.set(S.x, 1.64, S.z); api.look.yaw = 0; api.move.y = 1; for (let f = 0; f < 30; f++) g.update(1 / 30); api.move.y = 0; return S.z - api.camera.position.z; };
  const base = run();
  state.between = false;
  const victim = T.spawn('walker', 3, 0, 10); api.damageZombie(victim, 1e6);
  state.between = true;
  out.adrenT = player.adrenT;
  const boosted = run();
  out.adrenaline = { base, boosted, ratio: boosted / base };

  T.quiet();
  const dx = 4.5;
  api.dropPickup(api.camera.position.x, api.camera.position.z - dx, 'health');
  for (let f = 0; f < 45; f++) g.update(1 / 30);
  out.magnetOff = api.pickups.length;
  for (const p of api.pickups) api.scene.remove(p);
  api.pickups.length = 0;
  T.perk('MAGNETIC');
  api.dropPickup(api.camera.position.x, api.camera.position.z - dx, 'health');
  for (let f = 0; f < 45; f++) g.update(1 / 30);
  out.magnetOn = api.pickups.length; out.magnet = stats.magnet;

  T.quiet();
  player.nades = 0; T.perk('GRENADIER');
  out.nadeNow = player.nades;
  player.nades = 0;
  state.between = false; state.waveTotal = 1; state.waveDone = 1; state.queue = [];
  g.update(1 / 30);
  out.nadeAfterWave = player.nades;
  T.quiet();

  const [a, b] = player.slots;
  api.selectWeapon(a, true);
  player.ammo[a] = 5; api.selectWeapon(b);
  out.noSecondMag = player.ammo[a];
  api.selectWeapon(a, true);
  T.perk('SECOND MAG');
  const res0 = player.reserve[a];
  player.ammo[a] = 5; api.selectWeapon(b);
  out.secondMag = { ammo: player.ammo[a], reserveUsed: res0 - player.reserve[a], mag: api.WEAPONS[a].mag };
  api.selectWeapon(a, true);

  const hp0 = stats.maxHp, fr0 = stats.fireRate;
  T.perk('OVERCLOCK');
  out.overclock = { maxHp: stats.maxHp / hp0, fire: stats.fireRate / fr0, hpClamped: player.hp <= stats.maxHp };

  T.quiet(); T.perk('TIME WARP');
  state.between = false;
  for (let k = 0; k < 3; k++) api.damageZombie(T.spawn('walker', 2 + k, 2, 10), 1e6);
  state.between = true;
  out.warpT = state.warpT;
  T.quiet();
  const w = T.spawn('walker', 0, -12, 1e6, 1.2);
  let p0 = w.position.clone(); g.update(1 / 30); const slow = w.position.distanceTo(p0);
  state.warpT = 0; p0 = w.position.clone(); g.update(1 / 30); const fast = w.position.distanceTo(p0);
  out.warpRatio = slow / fast;

  T.quiet(); T.perk('CHAIN REACTION'); out.chainStat = stats.chain;
  stats.chain = 1;
  const cluster = [T.spawn('walker', 0, -8, 50), T.spawn('walker', 1.2, -8.6, 50), T.spawn('walker', -1.2, -8.6, 50), T.spawn('walker', 0, -9.6, 50)];
  state.between = false;
  api.damageZombie(cluster[0], 1e6);
  state.between = true;
  for (let f = 0; f < 12; f++) g.update(1 / 30);
  out.chainKilled = cluster.filter(z => z.userData.dead).length;
  stats.chain = 0;

  T.quiet(); T.perk('PHOENIX');
  const near = [T.spawn('walker', 2, 0, 200), T.spawn('walker', -2, 1, 200), T.spawn('walker', 0, 3, 200)];
  stats.armor = 1; api.hurtPlayer(1e5);
  out.phoenix = { hp: player.hp, maxHp: stats.maxHp, left: stats.phoenix, mode: state.mode, cleared: near.filter(z => z.userData.dead).length };
  return out;
});
check(perks.newCount === 13 + 15 && perks.legendary.length === 4, 'perk list: 11 new + 4 legendary added', `${perks.newCount} total, legendary: ${perks.legendary.join(', ')}`);
check(perks.explosive.boomsAfter9 === 0 && perks.explosive.boomsAfter10 === 1, 'EXPLOSIVE ROUNDS: 10th hit explodes', JSON.stringify(perks.explosive));
check(perks.pierce0 === 1 && perks.pierce1 === 2, 'RICOCHET: pierce +1', `${perks.pierce0} → ${perks.pierce1} bodies per bullet`);
check(Math.abs(perks.berserk.ratio - 1.48) < .03, 'BERSERKER: +48% damage at 20% HP', JSON.stringify(perks.berserk));
check(perks.refund.dmg > 60 && perks.refund.ammo === 20 && perks.noRefundAmmo === 19, 'TRIGGER DISCIPLINE: headshot refunds a round', JSON.stringify(perks.refund));
check(Math.abs(perks.frostStat - .08) < 1e-9 && perks.chill > .5, 'FROST ROUNDS: 8% per stack, chills on proc', `chill ${perks.chill}`);
check(Math.abs(perks.fireStat - .08) < 1e-9 && perks.burn > 2.9, 'INCENDIARY ROUNDS: 8% per stack, ignites on proc', `burnT ${perks.burn}`);
check(perks.adrenT === 2.5 && Math.abs(perks.adrenaline.ratio - 1.3) < .03, 'ADRENALINE: kill gives +30% move speed', JSON.stringify(perks.adrenaline));
check(perks.magnetOff === 1 && perks.magnetOn === 0 && perks.magnet === 2, 'MAGNETIC: 2x pickup range', `off ${perks.magnetOff} left, on ${perks.magnetOn} left`);
check(perks.nadeNow === 1 && perks.nadeAfterWave === 1, 'GRENADIER: +1 grenade now and per wave');
check(perks.noSecondMag === 5 && perks.secondMag.ammo === perks.secondMag.mag && perks.secondMag.reserveUsed === perks.secondMag.mag - 5, 'SECOND MAG: swap reloads the holstered weapon', JSON.stringify(perks.secondMag));
check(Math.abs(perks.overclock.maxHp - .8) < .01 && Math.abs(perks.overclock.fire - 1.4) < 1e-9 && perks.overclock.hpClamped, 'OVERCLOCK: +40% fire rate, -20% max HP');
check(perks.warpT === 3 && Math.abs(perks.warpRatio - .35) < .03, 'TIME WARP: triple kill slows the horde to 35%', `ratio ${perks.warpRatio.toFixed(3)}`);
check(perks.chainStat === .25 && perks.chainKilled === 4, 'CHAIN REACTION: 25% stat; proc explodes the cluster', `${perks.chainKilled}/4 dead`);
check(perks.phoenix.hp === perks.phoenix.maxHp && perks.phoenix.left === 0 && perks.phoenix.mode === 'playing' && perks.phoenix.cleared === 3, 'PHOENIX: revive at full HP with nova', JSON.stringify(perks.phoenix));

const fortune = await page.evaluate(() => {
  const { api } = window.__game, T = window.__t;
  const run = fortune => {
    T.freshRun({ map: 'street' });
    if (fortune) T.perk('FORTUNE');
    api.profile.lastDaily = new Date().toDateString();
    Object.assign(api.state, { score: 15000, wave: 5, bossKinds: [] });
    const s0 = api.profile.scrap;
    api.gameOver();
    return api.profile.scrap - s0;
  };
  return [run(false), run(true)];
});
check(fortune[1] === Math.round(fortune[0] * 1.25), 'FORTUNE: +25% scrap at run end', fortune.join(' → '));

const odds = await page.evaluate(() => {
  const { api } = window.__game, T = window.__t;
  T.freshRun({ map: 'street' });
  const legendary = new Set(api.PERKS.filter(p => p.legendary).map(p => p.name));
  const major = new Set(api.PERKS.filter(p => p.legendary || p.rare).map(p => p.name));
  let minorLeak = 0, milestoneMiss = 0, milestones = 0, offers = 0;
  for (let s = 1; s <= 200; s++) {
    api.state.seed = s;
    for (let w = 1; w <= 20; w++) {
      api.state.wave = w;
      api.offerPerks();
      offers++;
      const o = api.state.perkOffer;
      if (w % 10) minorLeak += o.filter(p => major.has(p)).length;
      else { milestones++; if (!o.some(p => legendary.has(p)) || !o.every(p => major.has(p))) milestoneMiss++; }
    }
  }
  const offersFor = seed => { api.state.seed = seed; return [3, 7, 12].map(w => { api.state.wave = w; api.offerPerks(); return api.state.perkOffer.join('|'); }).join(' / '); };
  const a = offersFor(1234), b = offersFor(1234), c = offersFor(4321);
  api.state.mode = 'playing'; api.showScreen(null);
  return { minorLeak, milestoneMiss, milestones, offers, same: a === b, differs: a !== c, sample: a };
});
check(odds.minorLeak === 0, 'major/legendary upgrades never offered off milestone waves', `${odds.offers} offers`);
check(odds.milestoneMiss === 0, 'every 10th wave offers only major upgrades incl. a legendary', `${odds.milestones} milestone offers`);
check(odds.same && odds.differs, 'same seed → same perk offers (different seed differs)', odds.sample);

const replay = [];
for (let k = 0; k < 2; k++) replay.push(await page.evaluate(() => {
  const g = window.__game, { api } = g, offers = [];
  api.startGame({ map: 'mall', seed: 777 });
  api.settings.autoFire = true;
  for (let i = 0; i < 30 * 200; i++) {
    api.player.hp = api.stats.maxHp;
    if (api.state.mode === 'perk') { offers.push(api.state.perkOffer.join('|')); document.querySelector('.perk').click(); }
    if (api.state.mode !== 'playing' || offers.length >= 4) break;
    let best = null, bd = 1e9;
    for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
    if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
    g.update(1 / 30); api.scene.updateMatrixWorld();
  }
  return offers;
}));
check(replay[0].length >= 3 && replay[0].join() === replay[1].join(), 'seeded replay: identical perk offers across two plays', replay[0].join(' / '));

const revive = await page.evaluate(async () => {
  const { api } = window.__game, T = window.__t, out = {}, events = [];
  api.bus.on('revive', e => events.push(e));
  const die = () => { api.stats.armor = 1; api.player.invulnUntil = 0; api.hurtPlayer(1e5); };
  const visible = () => !document.querySelector('#revive').classList.contains('hidden');
  T.freshRun({ map: 'base', seed: undefined });
  api.profile.scrap = 1000; api.state.wave = 4;
  die();
  out.offered = api.state.mode === 'revive' && visible();
  out.label = document.querySelector('#rv-yes').textContent;
  document.querySelector('#rv-yes').click();
  out.after = { mode: api.state.mode, scrap: api.profile.scrap, hp: api.player.hp, maxHp: api.stats.maxHp, hidden: !visible(), events: [...events] };
  api.state.clock += 5;
  die();
  out.second = api.state.mode;
  T.freshRun({ map: 'base' });
  api.profile.scrap = 1000; die();
  document.querySelector('#rv-no').click();
  out.declined = { mode: api.state.mode, scrap: api.profile.scrap };
  T.freshRun({ map: 'base' });
  api.profile.scrap = 1000; die();
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 5400));
  out.timeout = { mode: api.state.mode, ms: Math.round(performance.now() - t0), scrap: api.profile.scrap };
  for (const type of ['daily', 'ranked']) {
    T.freshRun({ map: 'base', type, seed: 5 });
    api.profile.scrap = 1000; die();
    out[type] = api.state.mode;
  }
  T.freshRun({ map: 'base' });
  api.profile.scrap = 100; die();
  out.poor = api.state.mode;
  out.eventCount = events.length;
  return out;
});
check(revive.offered && revive.label === 'REVIVE — 🔩 225', 'revive: offered on death in a normal run with wave-scaled cost', revive.label);
check(revive.after.mode === 'playing' && revive.after.scrap === 775 && revive.after.hp === revive.after.maxHp * .5 && revive.after.hidden, 'revive: accept deducts scrap, restores 50% HP, resumes', JSON.stringify(revive.after));
check(revive.after.events.length === 1 && revive.after.events[0].cost === 225 && revive.after.events[0].wave === 4, "revive: emits bus 'revive' { cost, wave }", JSON.stringify(revive.after.events));
check(revive.second === 'dead', 'revive: only once per run');
check(revive.declined.mode === 'dead' && revive.declined.scrap >= 1000, 'revive: GIVE UP goes to game over without charging');
check(revive.timeout.mode === 'dead' && revive.timeout.scrap >= 1000, 'revive: 5 s timeout goes to game over', revive.timeout.ms + ' ms');
check(revive.daily === 'dead' && revive.ranked === 'dead', 'revive: disabled for daily and ranked runs');
check(revive.poor === 'dead' && revive.eventCount === 1, 'revive: not offered without enough scrap (scrap only, never real money)');

if (SHOTS) {
  const shot = async (p, name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
  for (const { id } of MAPS) {
    await page.evaluate(id => { const { api } = window.__game; api.toMenu(); api.loadMap(id); }, id);
    await shot(page, `menu-${id}`);
    await page.evaluate(id => {
      const { api } = window.__game, T = window.__t;
      api.startGame({ map: id, seed: 21 });
      api.settings.autoFire = false;
      for (let f = 0; f < 30 * 12; f++) { api.player.hp = api.stats.maxHp; window.__game.update(1 / 30); }
      const z = api.zombies.find(z => !z.userData.dead);
      if (z) T.aimChest(z);
      api.look.pitch = 0;
    }, id);
    await shot(page, `play-${id}`);
  }
  await page.evaluate(() => window.__game.api.toMenu());
  await page.click('#map-chip');
  await shot(page, 'map-picker');
  await page.evaluate(() => {
    const { api } = window.__game, T = window.__t;
    T.freshRun({ map: 'street', seed: 1 });
    for (const n of ['HOLLOW POINTS', 'RICOCHET', 'RICOCHET', 'FROST ROUNDS', 'MAGNETIC', 'TIME WARP', 'SECOND MAG']) T.perk(n);
    const legendary = new Set(api.PERKS.filter(p => p.legendary).map(p => p.name));
    for (let s = 1; s < 500; s++) { api.state.seed = s; api.state.wave = 10; api.offerPerks(); if (api.state.perkOffer.some(p => legendary.has(p))) break; }
  });
  await shot(page, 'perks-legendary');
  await page.evaluate(() => {
    const { api } = window.__game;
    api.state.mode = 'playing'; api.showScreen(null); api.hint('');
    const z = window.__t.spawn('runner', -2, -9, 1e6, 0);
    window.__t.spawn('walker', 3, -12, 1e6, 0);
    window.__t.aimChest(z); api.look.pitch = -.05;
    for (let f = 0; f < 20; f++) window.__game.update(1 / 30);
  });
  await shot(page, 'perk-strip');
  await page.evaluate(() => { const { api } = window.__game; api.state.mode = 'playing'; api.showScreen(null); api.profile.scrap = 1240; api.state.wave = 7; api.stats.armor = 1; api.player.invulnUntil = 0; api.hurtPlayer(1e5); });
  await shot(page, 'revive');
  await page.close();
  const portrait = await openGame(browser, url, { width: 390, height: 844 });
  await portrait.page.evaluate(helpers);
  await shot(portrait.page, 'portrait-menu');
  await portrait.page.click('#map-chip');
  await shot(portrait.page, 'portrait-map-picker');
  await portrait.page.evaluate(() => {
    const { api } = window.__game, T = window.__t;
    T.freshRun({ map: 'overpass', seed: 1 });
    for (const n of ['EXPLOSIVE ROUNDS', 'ADRENALINE', 'PHOENIX']) T.perk(n);
    const legendary = new Set(api.PERKS.filter(p => p.legendary).map(p => p.name));
    for (let s = 1; s < 500; s++) { api.state.seed = s; api.state.wave = 20; api.offerPerks(); if (api.state.perkOffer.some(p => legendary.has(p))) break; }
  });
  await shot(portrait.page, 'portrait-perks');
  await portrait.page.evaluate(() => { const { api } = window.__game; api.state.mode = 'playing'; api.showScreen(null); api.hint(''); for (let f = 0; f < 30; f++) window.__game.update(1 / 30); });
  await shot(portrait.page, 'portrait-strip');
  await portrait.page.evaluate(() => { const { api } = window.__game; api.profile.scrap = 1240; api.state.wave = 7; api.stats.armor = 1; api.player.invulnUntil = 0; api.stats.phoenix = 0; api.hurtPlayer(1e5); });
  await shot(portrait.page, 'portrait-revive');
  errors.push(...portrait.errors);
}

check(errors.length === 0, 'no page errors', errors.slice(0, 5).join('\n'));
console.log('\ndraw calls per map:', JSON.stringify(drawCalls));
await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} FAILED:\n` + failures.join('\n')); process.exit(1); }
console.log('\ndepth test ok');
