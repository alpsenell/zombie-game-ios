export const id = 'resume';
export const RESUME_WINDOW = 10 * 60e3, TYPES = ['normal', 'extract'], KEY = 'resume', VERSION = 1;
const STATE_KEYS = ['wave', 'score', 'kills', 'heads', 'shots', 'hits', 'combo', 'bestCombo', 'lastKill', 'clock', 'between', 'mod', 'mutation', 'startWave', 'runType', 'runDifficulty', 'seed', 'waveTotal', 'waveDone', 'spawnGap', 'bossKinds', 'perks', 'extracted', 'bonusScrap', 'perkRerolls', 'warpT', 'maxWave', 'kitTotal', 'kitMajors', 'bagT'];
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, Array.isArray(o[k]) ? [...o[k]] : o[k]]));
const r2 = v => Math.round(v * 100) / 100;

export function snapshotOf(api, now = Date.now()) {
  const { state, player, camera, look, zombies, pickups } = api;
  if (!TYPES.includes(state.runType) || state.net || state.cleared || !['playing', 'paused'].includes(state.mode) || state.wave < state.startWave) return null;
  const opts = {};
  for (const [k, v] of Object.entries(state.runOpts || {})) if (typeof v !== 'function' && k !== 'resume') opts[k] = v;
  return {
    v: VERSION, at: now, map: api.currentMap, opts,
    state: pick(state, STATE_KEYS),
    queue: (state.queue || []).map(q => ({ kind: q.kind, elite: !!q.elite })),
    seen: [...(state.seen || [])],
    player: pick(player, ['hp', 'nades', 'weapon', 'slots', 'ammo', 'reserve']),
    cam: { x: r2(camera.position.x), z: r2(camera.position.z), yaw: r2(look.yaw), pitch: r2(look.pitch) },
    zombies: zombies.filter(z => !z.userData.dead).map(z => ({ kind: z.userData.kind, x: r2(z.position.x), z: r2(z.position.z), elite: !!z.userData.elite, hp: Math.max(1, Math.round(z.userData.hp)) })),
    pickups: pickups.map(p => ({ kind: p.userData.kind, x: r2(p.position.x), z: r2(p.position.z), t: r2(p.userData.t) })),
  };
}
export const ageText = ms => { const m = Math.round(ms / 6e4); return m < 1 ? 'JUST NOW' : m + ' MIN AGO'; };

const CSS = `
.rs-sheet{position:fixed;inset:0;z-index:37;display:grid;place-items:center;background:#010406c8;padding:16px}
.rs-card{width:min(360px,92vw);padding:20px 18px 16px;border-radius:18px;background:#081115f8;border:1px solid #6fe3ff77;box-shadow:0 0 40px #6fe3ff22,0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center}
.rs-card small{font:900 10px var(--ui);letter-spacing:2px;color:#6fe3ff}
.rs-card h3{margin:0;font:900 30px/1 var(--display);letter-spacing:1.5px}
.rs-card p{margin:0;font:800 10px/1.6 var(--ui);letter-spacing:1.1px;color:var(--dim)}
.rs-card p b{color:var(--text,#e8e4d8)}
.rs-card .row{margin-top:4px}
`;

export function init(api) {
  const { $, bus, store, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n).toLocaleString();
  let taken = false, offered = false, restoring = false;

  const valid = snap => !!snap && snap.v === VERSION && TYPES.includes(snap.state?.runType) && Date.now() - snap.at <= RESUME_WINDOW && Date.now() >= snap.at - 6e4;
  function pending() {
    const snap = store.get(KEY, null);
    if (snap && !valid(snap)) { store.set(KEY, null); return null; }
    return snap;
  }
  function clear() { taken = false; if (store.get(KEY, null)) store.set(KEY, null); }
  function save() {
    if (restoring) return null;
    const snap = snapshotOf(api);
    if (!snap) return null;
    store.set(KEY, snap);
    taken = true;
    bus.emit('run:snapshot', { wave: snap.state.wave, score: snap.state.score, type: snap.state.runType });
    return snap;
  }

  function restore(snap = pending()) {
    if (!snap) return false;
    const { state, player } = api, age = Date.now() - snap.at;
    restoring = true;
    try {
      api.startGame({ ...snap.opts, type: snap.state.runType, difficulty: snap.state.runDifficulty || undefined, map: snap.map, seed: snap.state.seed ?? undefined, startWave: snap.state.startWave, resume: true });
      Object.assign(state, snap.state, { queue: snap.queue.map(q => ({ ...q })), seen: new Set(snap.seen), perks: [], boss: null, cleared: false });
      for (const name of snap.state.perks || []) { const p = api.PERKS.find(x => x.name === name); if (p) { p.apply(); state.perks.push(name); } }
      Object.assign(player, { hp: snap.player.hp, lagHp: snap.player.hp, nades: snap.player.nades, slots: [...snap.player.slots], weapon: snap.player.weapon, ammo: [...snap.player.ammo], reserve: [...snap.player.reserve] });
      api.selectWeapon(player.weapon, true);
      api.ui.swap?.classList.toggle('hidden', player.slots[0] === player.slots[1]);
      api.camera.position.set(snap.cam.x, 1.64, snap.cam.z);
      api.look.yaw = snap.cam.yaw; api.look.pitch = snap.cam.pitch;
      for (const z of snap.zombies) {
        const T = api.ZT[z.kind];
        if (!T) continue;
        const zz = api.makeZombie(z.kind, z.x, z.z, false, z.elite);
        zz.userData.hp = Math.min(zz.userData.maxHp, z.hp);
        if (T.boss) { state.boss = zz; api.ui.bossBar?.classList.remove('hidden'); if (api.ui.bossName) api.ui.bossName.textContent = T.name; }
      }
      for (const p of snap.pickups) { api.dropPickup(p.x, p.z, p.kind); const g = api.pickups[api.pickups.length - 1]; if (g) g.userData.t = p.t; }
      api.applyMod?.(state.mod);
    } finally { restoring = false; }
    clear();
    api.message('RUN RESUMED', 'WAVE ' + state.wave + ' · ' + fmt(state.score) + ' PTS', 2.2);
    api.haptic('MEDIUM');
    bus.emit('run:resume', { wave: state.wave, score: state.score, type: state.runType, age });
    bus.emit('wave:start', { wave: state.wave, mod: state.mod, mutation: state.mutation, boss: state.wave % 5 === 0, checkpoint: false, resumed: true });
    return true;
  }

  function offer() {
    const snap = pending();
    if (!snap || offered) return false;
    offered = true;
    api.queueModal(done => {
      const current = pending();
      if (!current) { done(); return; }
      const sheet = el('div', 'rs-sheet'), card = el('div', 'rs-card'), ok = el('button', 'cta', 'RESUME RUN'), no = el('button', 'ghost', 'DISCARD'), row = el('div', 'row');
      const s = current.state, map = api.MAPS.find(m => m.id === current.map)?.name || current.map.toUpperCase(), diff = api.DIFFICULTIES[s.runDifficulty || api.settings.difficulty]?.name || '';
      const p = el('p');
      p.append(el('b', '', fmt(s.score) + ' PTS'), ' · ' + s.kills + ' KILLS · ' + map + (diff ? ' · ' + diff : ''), el('br'), (s.runType === 'extract' ? 'EXTRACTION RUN · ' : '') + 'SAVED ' + ageText(Date.now() - current.at));
      row.append(ok, no);
      card.append(el('small', '', 'INTERRUPTED RUN'), el('h3', '', 'WAVE ' + s.wave), p, el('p', '', 'PICK UP WHERE YOU LEFT OFF OR START FRESH. THE SAVE EXPIRES ' + Math.round(RESUME_WINDOW / 6e4) + ' MINUTES AFTER IT WAS MADE.'), row);
      sheet.appendChild(card);
      document.body.appendChild(sheet);
      ok.onclick = () => { sheet.remove(); done(); api.sfx.init?.(); restore(current); };
      no.onclick = () => { sheet.remove(); clear(); api.haptic('LIGHT'); done(); };
    }, 5);
    return true;
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', () => save());
  window.addEventListener('beforeunload', () => save());
  bus.on('screen', ({ id }) => { if (id === 'pausemenu') save(); if (id === 'menu' && taken) clear(); });
  bus.on('run:end', () => clear());
  bus.on('run:start', e => { if (!e.opts?.resume) clear(); });
  bus.on('app:ready', () => offer());
  setTimeout(() => offer(), 0);

  api.resume = { RESUME_WINDOW, TYPES, snapshot: () => snapshotOf(api), save, restore, pending, clear, offer: () => { offered = false; return offer(); } };
}
