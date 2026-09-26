import { LoopbackTransport, GameKitTransport, MAX_PLAYERS } from './net.js';
import { injectStyles, createLobby, createHud, Avatar, overTable } from './coop-view.js';

export const id = 'coop';
export const config = { perkTimeout: 20, perkGrace: 2, bleed: 20, reviveTime: 3, reviveRange: 2, snapHz: 10, stateHz: 15, hitHz: 20, interp: .12, joinTimeout: 3000 };

const HOST_ONLY = new Set(['go', 's', 'z+', 'z-', 'sp', 'k+', 'w', 'wc', 'hu', 'rv', 'out', 'end', 'busy', 'full']);
const PICKUPS = ['health', 'ammo', 'grenade'];
const now = () => performance.now();
const c100 = v => Math.round(v * 100);

let api, H, lobby, hud, S = null, KINDS = [], pendingGK = null, overTitle = '', overBox, lobbyBtn;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const hostId = () => [...S.players.keys()].sort()[0] || '';
const isHost = () => !!S && S.host === S.t.id;
const send = (msg, to) => S?.t.send(msg, { reliable: true, to });
const sendU = (msg, to) => S?.t.send(msg, { reliable: false, to });
const posOf = p => (p.me ? api.camera.position : p);

function myName() {
  const q = new URLSearchParams(location.search).get('name');
  if (q) return q.slice(0, 16);
  if (api.gameCenter.player?.displayName) return api.gameCenter.player.displayName;
  api.profile.coop ||= {};
  if (!api.profile.coop.name) { api.profile.coop.name = 'SURVIVOR-' + Math.random().toString(36).slice(2, 5).toUpperCase(); api.saveProfile(); }
  return api.profile.coop.name;
}

function addPlayer(pid, name, code, me) {
  const known = S.players.get(pid);
  if (known) { if (name) known.name = String(name).toUpperCase().slice(0, 16); return known; }
  const p = {
    id: pid, name: String(name || 'SURVIVOR').toUpperCase().slice(0, 16), code: code || 0, ready: false, me: !!me,
    x: 0, z: 30, yaw: 0, pitch: 0, hp: 100, maxHp: 100, weapon: 0, st: 0, bleed: 0, rev: 0,
    kills: 0, heads: 0, revives: 0, downs: 0, shots: 0, hits: 0, perked: 0, seen: now(), rtt: 0, budget: { v: 40000, t: now() },
  };
  p.pos = { remote: true, x: 0, z: 30, hurt: (amount, from) => send(['hu', +amount.toFixed(1), c100(from.x), c100(from.z)], pid) };
  S.players.set(pid, p);
  if (me) S.me = p;
  S.host = hostId();
  return p;
}

function newSession(t, room) {
  S = {
    t, room, phase: 'lobby', players: new Map(), left: [], host: '', me: null, diff: api.settings.difficulty,
    zmap: new Map(), gone: new Set(), zseq: 0, kseq: 0, seq: 0, lastSeq: -1, offset: null, hits: new Map(),
    stateAt: 0, snapAt: 0, hitAt: 0, pingAt: 0, fired: false, lastKillPts: 0, hitter: null,
    perkShownAt: 0, perkDeadline: 0, waveQueued: false, over: null, slamZ: null,
  };
  addPlayer(t.id, t.name || myName(), api.myCode(), true);
  const s = S;
  t.on('join', peer => {
    if (S !== s) return;
    if (s.phase !== 'lobby' || s.players.size >= MAX_PLAYERS) {
      if (isHost()) send([s.phase !== 'lobby' ? 'busy' : 'full'], peer.id);
      return;
    }
    addPlayer(peer.id, peer.name, 0);
    sendHi(peer.id);
    refresh();
  });
  t.on('leave', pid => S === s && peerLeft(pid));
  t.on('message', (from, m) => { if (S === s) { try { onMessage(from, m); } catch (e) { console.error('[coop]', m[0], e); } } });
  t.on('version', () => S === s && lobby.status('VERSION MISMATCH — UPDATE THE GAME', true));
  t.on('error', text => S === s && connectionLost(text));
}

function sendHi(to) {
  send(['hi', S.me.name, api.myCode(), S.me.ready ? 1 : 0, S.phase === 'lobby' ? 0 : 1, isHost() ? api.settings.difficulty : ''], to);
}

function leave() {
  if (!S) return;
  const s = S;
  S = null;
  s.t.close();
  for (const p of s.players.values()) p.avatar?.dispose();
  api.state.net = null;
  H.slamRing.visible = false;
  hud.show(false);
  api.hint('');
}

function refresh() {
  if (!S || S.phase === 'run') return;
  const list = [...S.players.values()].sort(byId), host = isHost();
  const allReady = list.every(p => p.id === S.host || p.ready);
  lobby.render({
    room: S.room, diff: api.DIFFICULTIES[S.diff]?.name || 'SURVIVOR', waiting: true,
    players: list.map(p => ({ id: p.id, name: p.name, code: p.code, ready: p.ready, host: p.id === S.host, me: p.me })),
    mainText: host ? 'START' : S.me.ready ? 'CANCEL READY' : 'READY',
    mainDisabled: host && (list.length < 2 || !allReady),
  });
  lobby.status(host ? (list.length < 2 ? 'WAITING FOR SURVIVORS…' : allReady ? 'SQUAD READY — START WHEN YOU ARE' : 'WAITING FOR SQUAD TO READY UP') : 'WAITING FOR HOST TO START');
}

function openLobby() {
  const gk = GameKitTransport.available();
  lobby.setModes({ gamekit: gk, local: !gk && LoopbackTransport.available() });
  if (S) refresh(); else { lobby.showPick(); lobby.status(''); }
  api.showScreen(lobby.root);
}

const actions = {
  host() {
    if (S) leave();
    const room = LoopbackTransport.code();
    newSession(new LoopbackTransport(room, true, myName()), room);
    refresh();
  },
  join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { lobby.status('ENTER A 4-LETTER ROOM CODE', true); return; }
    if (S) leave();
    newSession(new LoopbackTransport(code, false, myName()), code);
    const s = S;
    refresh();
    lobby.status('JOINING ' + code + '…');
    setTimeout(() => {
      if (S !== s || S.players.size > 1) return;
      leave();
      lobby.showPick();
      lobby.status('ROOM ' + code + ' NOT FOUND', true);
    }, config.joinTimeout);
  },
  async find(invite) {
    if (!api.gameCenter.player && !(await api.gameCenter.signIn())) { lobby.status('SIGN IN TO GAME CENTER TO PLAY CO-OP', true); return; }
    if (S) leave();
    pendingGK?.close();
    const t = pendingGK = new GameKitTransport();
    lobby.status('OPENING GAME CENTER…');
    try {
      const r = await GameKitTransport.call('findMatch', { minPlayers: 2, maxPlayers: MAX_PLAYERS, invite });
      if (r?.status === 'cancelled') { if (pendingGK === t) { t.close(); pendingGK = null; } lobby.status(''); }
      else if (!S) lobby.status('CONNECTING…');
    } catch (e) {
      if (pendingGK === t) { t.close(); pendingGK = null; }
      lobby.status(String(e?.message || 'MATCHMAKING FAILED').toUpperCase(), true);
    }
  },
  main() {
    if (!S) return;
    if (isHost()) { startMatch(); return; }
    S.me.ready = !S.me.ready;
    sendHi();
    refresh();
  },
  back() {
    if (S) { leave(); lobby.showPick(); lobby.status(''); return; }
    api.showScreen(api.ui.menu);
  },
};

function onMatchFound(d) {
  if (!d?.localId) return;
  const t = pendingGK || new GameKitTransport();
  pendingGK = null;
  if (S) leave();
  t.id = d.localId;
  t.name = (d.players || []).find(p => p.id === d.localId)?.name || myName();
  newSession(t, null);
  t.adopt(d);
  openLobby();
}

function startMatch() {
  if (!isHost() || S.phase !== 'lobby') return;
  const list = [...S.players.values()];
  if (list.length < 2 || !list.every(p => p.me || p.ready)) return;
  const seed = (Math.random() * 2 ** 31) | 0, diff = api.settings.difficulty, ids = list.map(p => p.id);
  send(['go', seed, diff, ids]);
  startRun(seed, diff, ids);
}

function startRun(seed, diff, ids) {
  if (!ids.includes(S.t.id)) { leave(); lobby.showPick(); lobby.status('MATCH STARTED WITHOUT YOU', true); return; }
  for (const pid of [...S.players.keys()]) if (!ids.includes(pid)) S.players.delete(pid);
  Object.assign(S, { phase: 'run', left: [], zseq: 0, kseq: 0, seq: 0, lastSeq: -1, offset: null, stateAt: 0, snapAt: 0, hitAt: 0, perkShownAt: 0, perkDeadline: 0, waveQueued: false, over: null, diff });
  S.zmap.clear(); S.gone.clear(); S.hits.clear();
  const order = [...ids].sort();
  for (const p of S.players.values()) {
    Object.assign(p, { st: 0, bleed: 0, rev: 0, kills: 0, heads: 0, revives: 0, downs: 0, shots: 0, hits: 0, perked: 0, hp: 100, maxHp: 100, left: false });
    p.x = p.pos.x = (order.indexOf(p.id) - (order.length - 1) / 2) * 2.4;
    p.z = p.pos.z = 30;
  }
  api.state.net = net;
  api.startGame({ type: 'coop', seed, difficulty: diff });
  api.camera.position.x = S.me.x;
  hud.show(true);
}

function peerLeft(pid) {
  const p = S.players.get(pid);
  if (!p) return;
  S.players.delete(pid);
  p.avatar?.dispose();
  p.avatar = null;
  const was = S.host;
  S.host = hostId();
  if (S.phase === 'run') {
    p.left = true;
    S.left.push(p);
    api.toast(p.name + ' LEFT THE SQUAD', 2.2);
    if (S.host !== was) {
      S.lastSeq = -1; S.offset = null;
      for (const z of api.zombies) if (z.userData.buf) z.userData.buf.length = 0;
      if (isHost()) becomeHost();
      else api.toast('HOST LEFT — ' + (S.players.get(S.host)?.name || 'NEW HOST') + ' IS HOSTING', 2.5);
    }
    if (isHost()) { checkPerks(); checkAllDown(); }
  }
  refresh();
}

function becomeHost() {
  const st = api.state;
  let top = 0, alive = 0;
  for (const z of api.zombies) {
    const u = z.userData;
    if (u.dead || !u.nid) continue;
    top = Math.max(top, u.nid);
    alive++;
    Object.assign(u, { buf: null, swing: 0, pathT: 0, nextAttack: st.clock + .6, slamT: 0, cs: '', spitWind: 0 });
    if (u.frozenT > 0) H.thaw(z);
  }
  S.zseq = top + 1000;
  S.kseq = Math.max(...api.pickups.map(p => p.userData.nid || 0), 0) + 1000;
  if (!st.between && st.wave > 0) {
    const left = Math.max(0, st.waveTotal - st.waveDone - alive);
    st.queue = H.waveComposition(st.wave).filter(e => !api.ZT[e.kind].boss).slice(0, left);
    st.spawnGap = 1;
  } else if (st.between) {
    S.perkDeadline = now() + (config.perkTimeout + config.perkGrace) * 1000;
    S.waveQueued = false;
  }
  api.toast('HOST LEFT — YOU ARE NOW HOSTING', 2.5);
}

function connectionLost(text) {
  if (S?.phase === 'run') {
    api.message('CONNECTION LOST', String(text || '').toUpperCase(), 2.4);
    finish(summary());
  } else if (S) {
    leave();
    lobby.showPick();
    lobby.status(String(text || 'CONNECTION LOST').toUpperCase(), true);
  }
}

function summary() {
  const st = api.state;
  const row = p => {
    const shots = p.me ? st.shots : p.shots, hits = p.me ? st.hits : p.hits;
    return [p.id, p.name, p.code, p.kills, p.heads, p.revives, p.downs, shots ? Math.round(hits / shots * 100) : 0, p.left ? 1 : 0];
  };
  return [st.score, st.wave, Math.round(st.clock), [...[...S.players.values()].sort(byId), ...S.left].map(row)];
}

function endRun() {
  if (!isHost() || S.phase !== 'run') return;
  const data = summary();
  send(['end', ...data]);
  finish(data);
}

function finish([score, wave, , rows]) {
  if (!S || S.phase !== 'run') return;
  S.phase = 'over';
  S.over = {
    score, wave,
    players: rows.map(r => ({ id: r[0], name: r[1], code: r[2], kills: r[3], heads: r[4], revives: r[5], downs: r[6], acc: r[7], left: !!r[8], me: r[0] === S.t.id })),
  };
  const st = api.state, mine = S.over.players.find(p => p.me);
  st.score = score;
  st.wave = Math.max(st.wave, wave);
  if (mine) { st.kills = mine.kills; st.heads = mine.heads; }
  for (const p of S.players.values()) { p.ready = false; p.avatar?.dispose(); p.avatar = null; }
  H.slamRing.visible = false;
  hud.show(false);
  api.hint('');
  api.state.net = null;
  if (st.mode === 'perk' || st.mode === 'paused') st.mode = 'playing';
  H.gameOver();
}

function backToLobby() {
  if (!S) { openLobby(); return; }
  S.phase = 'lobby';
  S.me.ready = false;
  sendHi();
  openLobby();
}

function onMessage(from, m) {
  const p = S.players.get(from);
  if (!p) return;
  p.seen = now();
  const type = m[0], st = api.state;
  if (HOST_ONLY.has(type) && from !== S.host) return;
  switch (type) {
    case 'hi': {
      if (S.t.kind === 'local' && m[1]) p.name = String(m[1]).toUpperCase().slice(0, 16);
      if (api.decodeLoadout(m[2])) p.code = m[2];
      p.ready = !!m[3];
      if (from === S.host && m[5]) S.diff = m[5];
      if (m[4] && from === S.host && S.phase === 'lobby' && !isHost()) { leave(); lobby.showPick(); lobby.status('MATCH IN PROGRESS — TRY AGAIN LATER', true); return; }
      refresh();
      return;
    }
    case 'busy': case 'full':
      leave(); lobby.showPick(); lobby.status(type === 'busy' ? 'MATCH IN PROGRESS — TRY AGAIN LATER' : 'ROOM IS FULL', true);
      return;
    case 'go':
      if (S.phase !== 'run' && Array.isArray(m[3])) startRun(m[1] | 0, api.DIFFICULTIES[m[2]] ? m[2] : 'survivor', m[3]);
      return;
    case 'pi': sendU(['po', m[1]], from); return;
    case 'po': p.rtt = p.rtt ? p.rtt * .7 + (now() - m[1]) * .3 : now() - m[1]; return;
  }
  if (S.phase !== 'run') return;
  switch (type) {
    case 'p': {
      p.x = p.pos.x = m[1] / 100; p.z = p.pos.z = m[2] / 100;
      p.yaw = m[3] / 100; p.pitch = m[4] / 100; p.hp = m[5]; p.maxHp = m[6]; p.weapon = m[7] | 0;
      p.shots = m[9] | 0; p.hits = m[10] | 0;
      if (m[8] && p.avatar && st.mode === 'playing') p.avatar.fire();
      return;
    }
    case 's': return onSnapshot(m);
    case 'z+': return onSpawn(m);
    case 'z-': return onDeath(m);
    case 'sp': { const z = S.zmap.get(m[1]); if (z && !z.userData.dead) H.spit(z, { x: m[2] / 100, z: m[3] / 100 }); return; }
    case 'x': api.explode(m[1] / 100, m[2] / 100, { remote: true, color: m[3], radius: m[4] }); return;
    case 'k+':
      if (!isHost() && PICKUPS.includes(m[2])) { api.dropPickup(m[3] / 100, m[4] / 100, m[2]); api.pickups[api.pickups.length - 1].userData.nid = m[1]; }
      return;
    case 'k-': {
      const i = api.pickups.findIndex(k => k.userData.nid === m[1]);
      if (i >= 0) { api.scene.remove(api.pickups[i]); api.pickups.splice(i, 1); }
      return;
    }
    case 'w':
      if (isHost()) return;
      if (st.mode === 'perk') autoPick();
      net.mod = m[2] || null;
      st.wave = (m[1] | 0) - 1;
      api.nextWave();
      return;
    case 'wc': if (!isHost() && !st.between) H.waveCleared(); return;
    case 'hu': {
      api.hurtPlayer(+m[1] || 0, { x: m[2] / 100, z: m[3] / 100 });
      if (m[4] != null) {
        const c = api.camera.position;
        for (let i = 0; i < 10; i++) {
          const nx = c.x + m[4] / 100 * .3, nz = c.z + m[5] / 100 * .3;
          if (api.blocked(nx, nz, .36)) break;
          c.x = nx; c.z = nz;
        }
      }
      return;
    }
    case 'h': if (isHost()) applyClaims(from, m.slice(1)); return;
    case 'dn': {
      if (p.st !== 0) return;
      if (isHost()) {
        if ((m[1] | 0) !== st.wave) return;
        p.downs++;
      }
      p.st = 1; p.bleed = config.bleed; p.rev = 0;
      api.toast(p.name + ' IS DOWN — REVIVE THEM', 2);
      if (isHost()) checkAllDown();
      return;
    }
    case 'rv': { const t = S.players.get(m[1]), by = S.players.get(m[2]); if (t) revived(t, by); return; }
    case 'out': { const t = S.players.get(m[1]); if (t) bledOut(t); return; }
    case 'pk': if (isHost()) { p.perked = m[1] | 0; checkPerks(); } return;
    case 'end': finish(m.slice(1)); return;
  }
}

function spawnLocal(nid, kind, elite, x, z, rise, maxHp) {
  if (!api.ZT[kind]) return null;
  const zb = api.makeZombie(kind, x, z, rise, !!elite), u = zb.userData;
  Object.assign(u, { nid, buf: [], nf: 0, netRise: rise ? 1 : 0, seenAt: api.state.clock });
  if (maxHp > 0) u.hp = u.maxHp = maxHp;
  S.zmap.set(nid, zb);
  return zb;
}

function onSpawn([, nid, ki, elite, x, z, maxHp, rise]) {
  if (isHost() || S.gone.has(nid)) return;
  const kind = KINDS[ki], known = S.zmap.get(nid);
  if (known) { if (maxHp > 0) { known.userData.maxHp = maxHp; } return; }
  const zb = spawnLocal(nid, kind, elite, x / 100, z / 100, !!rise, maxHp);
  if (!zb) return;
  const st = api.state, T = api.ZT[kind];
  if (!st.seen.has(kind)) {
    st.seen.add(kind);
    if (T.intro && !T.boss) api.schedule(.6, () => api.toast('NEW THREAT: ' + T.name + ' — ' + T.intro, 3.2));
  }
  if (T.boss) {
    st.boss = zb;
    api.ui.bossBar.classList.remove('hidden');
    api.ui.bossName.textContent = T.name;
    api.message(T.name, T.intro.toUpperCase(), 3);
    api.sfx.roar(); api.look.shake = .6; api.haptic('HEAVY');
  }
}

function onDeath([, nid, head, killer, pts]) {
  if (isHost()) return;
  const z = S.zmap.get(nid), st = api.state;
  S.gone.add(nid);
  S.zmap.delete(nid);
  if (S.gone.size > 4000) S.gone = new Set([...S.gone].slice(-2000));
  const k = S.players.get(killer);
  if (k) { k.kills++; if (head) k.heads++; }
  if (!z || z.userData.dead) return;
  const u = z.userData, last = u.buf?.[u.buf.length - 1];
  if (last) { z.position.x = last.x; z.position.z = last.z; }
  z.position.y = 0;
  H.killZombie(z, !!head, true);
  if (u.T.boss && pts) st.bossKinds.push(u.kind);
  if (killer === S.me.id && pts) {
    api.floater(z.position.x, 2.2 * u.sc, z.position.z, '+' + pts, head ? 'head' : '');
    if (head) api.toast('HEADSHOT', .8);
    api.bus.emit('kill', { kind: u.kind, head: !!head, elite: u.elite, boss: !!u.T.boss, points: pts, weapon: api.WEAPONS[api.player.weapon].id, combo: 0, frozen: false, burning: false });
  }
}

function onSnapshot(m) {
  const [, seq, part, t, , score, total, done, , zl, pl] = m;
  if (isHost() || seq < S.lastSeq || !Array.isArray(zl)) return;
  S.lastSeq = seq;
  const st = api.state, ht = t / 100, o = ht - st.clock;
  S.offset = S.offset == null || Math.abs(o - S.offset) > 1 ? o : S.offset + (o - S.offset) * .1;
  st.score = score; st.waveTotal = total; st.waveDone = done;
  for (const e of zl) {
    const [nid, ki, elite, x, z, r, hp, rise, fl] = e;
    if (S.gone.has(nid)) continue;
    const zb = S.zmap.get(nid) || spawnLocal(nid, KINDS[ki], elite, x / 100, z / 100, rise > 0, 0);
    if (!zb) continue;
    const u = zb.userData;
    u.buf ||= [];
    if (u.buf.length && u.buf[u.buf.length - 1].t >= ht) continue;
    u.buf.push({ t: ht, x: x / 100, z: z / 100, r: r / 100 });
    if (u.buf.length > 6) u.buf.shift();
    u.hp = hp / 1000 * u.maxHp; u.nf = fl; u.netRise = rise / 100; u.seenAt = st.clock;
  }
  if (!part && Array.isArray(pl)) {
    for (const e of pl) {
      const p = S.players.get(e[0]);
      if (!p) continue;
      if (!p.me) p.st = e[1];
      else if (e[1] === 2 && p.st === 1) bledOut(p);
      Object.assign(p, { bleed: e[2] / 10, rev: e[3] / 100, kills: e[4], heads: e[5], downs: e[6], revives: e[7], perked: e[8] });
    }
  }
}

function syncZombies(dt) {
  const st = api.state, zs = api.zombies, rt = st.clock + (S.offset ?? 0) - config.interp;
  let slam = null;
  for (let k = zs.length - 1; k >= 0; k--) {
    const z = zs[k], u = z.userData;
    if (H.animateZombie(z, dt)) { api.scene.remove(z); zs.splice(k, 1); if (S.zmap.get(u.nid) === z) S.zmap.delete(u.nid); continue; }
    if (u.dead || !u.buf?.length) continue;
    const b = u.buf;
    let a = b[0], c = b[b.length - 1];
    if (rt >= c.t) a = c;
    else if (rt > a.t) for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; break; }
    const f = c.t > a.t ? Math.min(1, Math.max(0, (rt - a.t) / (c.t - a.t))) : 1;
    z.position.x = a.x + (c.x - a.x) * f;
    z.position.z = a.z + (c.z - a.z) * f;
    let dr = c.r - a.r; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    z.rotation.y = a.r + dr * f;
    const fl = u.nf, T = u.T;
    u.rise = Math.max(0, u.rise - dt * .9);
    if (Math.abs(u.rise - u.netRise) > .2) u.rise = u.netRise;
    z.position.y = -1.9 * u.sc * u.rise * u.rise;
    u.moving = !!(fl & 16);
    if (u.moving) u.walk += dt * T.stride;
    if (fl & 4) { if (!u.swingOn) { u.swingOn = true; u.swing = .45; } } else u.swingOn = false;
    u.swing = Math.max(0, u.swing - dt);
    if (fl & 8) {
      if (!(u.frozenT > 0)) for (const m of u.meshes) if (!m.userData.glow) m.material = H.iceMat;
      u.frozenT = 1;
    } else if (u.frozenT > 0) H.thaw(z);
    if (fl & 128 && Math.random() < .5) H.sparks.emit(z.position.x + (Math.random() - .5) * .4 * u.sc, (.4 + Math.random() * 1.2) * u.sc, z.position.z + (Math.random() - .5) * .4 * u.sc, 1, { speed: 1, spread: .8, life: .5, grav: -3, colors: [0xffa040, 0xff5a1a, 0xffd27a] });
    const cs = fl & 256 ? 'wind' : fl & 512 ? 'run' : fl & 1024 ? 'stun' : '';
    if (cs !== u.cs && T.boss) {
      if (cs === 'wind') { api.sfx.roar(); api.toast('CHARGE INCOMING — SIDESTEP!', 1.2); api.haptic('MEDIUM'); }
      if (cs === 'stun') { api.sfx.boom(); api.toast(T.name + ' IS STUNNED — HIT HIM!', 1.6); }
    }
    u.cs = cs;
    if (fl & 32) {
      if (!u.slamOn) { u.slamOn = st.clock; api.sfx.roar(); }
      u.slamT = .5;
      slam = z;
    } else if (u.slamOn) {
      u.slamOn = 0; u.slamT = 0;
      api.sfx.boom(); api.haptic('HEAVY');
      api.look.shake = Math.max(api.look.shake, .45 * Math.max(0, 1 - Math.hypot(api.camera.position.x - z.position.x, api.camera.position.z - z.position.z) / 20));
    }
    u.spitWind = fl & 2048 ? .3 : 0;
    if (fl & 64 && !u.enraged) {
      u.enraged = true;
      if (T.boss) { api.ui.bossName.textContent = T.name + ' · ENRAGED'; api.toast(T.name + ' IS ENRAGED', 1.6); api.sfx.roar(); }
    }
  }
  const ring = H.slamRing;
  if (slam) {
    const k = Math.min(1, (st.clock - slam.userData.slamOn) / .9);
    ring.visible = true;
    ring.position.set(slam.position.x, .05, slam.position.z);
    ring.scale.setScalar(H.SLAM_R * Math.max(.05, k));
    ring.material.opacity = .4 + Math.sin(st.clock * 30) * .3;
    S.slamZ = slam;
  } else if (S.slamZ) { ring.visible = false; S.slamZ = null; }
}

function flags(u) {
  return (u.rise > 0 ? 2 : 0) | (u.swing > 0 ? 4 : 0) | (u.frozenT > 0 ? 8 : 0) | (u.moving ? 16 : 0) | (u.slamT > 0 ? 32 : 0) | (u.enraged ? 64 : 0) | (u.burnT > 0 ? 128 : 0)
    | (u.cs === 'wind' ? 256 : u.cs === 'run' ? 512 : u.cs === 'stun' ? 1024 : 0) | (u.spitWind > 0 ? 2048 : 0);
}

function sendSnapshot() {
  const st = api.state, zl = [];
  for (const z of api.zombies) {
    const u = z.userData;
    if (u.dead || !u.nid) continue;
    zl.push([u.nid, KINDS.indexOf(u.kind), u.elite ? 1 : 0, c100(z.position.x), c100(z.position.z), c100(z.rotation.y), Math.max(0, Math.round(u.hp / u.maxHp * 1000)), Math.round(u.rise * 100), flags(u)]);
  }
  const pl = [...S.players.values()].map(p => [p.id, p.st, Math.round(p.bleed * 10), Math.round(p.rev * 100), p.kills, p.heads, p.downs, p.revives, p.perked]);
  const head = [Math.round(st.clock * 100), st.wave, st.score, st.waveTotal, st.waveDone, st.between ? 1 : 0];
  S.seq++;
  for (let i = 0, part = 0; i < zl.length || !part; i += 14, part++) sendU(['s', S.seq, part, ...head, zl.slice(i, i + 14), part ? 0 : pl]);
}

function sendState() {
  const c = api.camera.position, P = api.player;
  sendU(['p', c100(c.x), c100(c.z), c100(api.look.yaw), c100(api.look.pitch), Math.ceil(P.hp), Math.round(api.stats.maxHp), P.weapon, S.fired ? 1 : 0, api.state.shots, api.state.hits]);
  S.fired = false;
}

function queueHit(nid, dmg, f, v) {
  const key = nid + ':' + f, h = S.hits.get(key);
  if (h) { h.d += dmg; h.v = Math.max(h.v, v); } else S.hits.set(key, { nid, d: dmg, f, v });
}

function flushHits(t) {
  if (!S.hits.size || t - S.hitAt < 1 / config.hitHz) return;
  S.hitAt = t;
  send(['h', ...[...S.hits.values()].map(h => [h.nid, Math.round(h.d * 10) / 10, h.f, Math.round(h.v * 100) / 100])]);
  S.hits.clear();
}

function applyClaims(from, list) {
  const p = S.players.get(from);
  if (!p || p.st === 2) return;
  const t = now(), b = p.budget;
  b.v = Math.min(40000, b.v + (t - b.t) / 1000 * 25000);
  b.t = t;
  for (const e of list.slice(0, 80)) {
    if (!Array.isArray(e)) continue;
    const z = S.zmap.get(e[0]), f = e[2] | 0;
    if (!z || z.userData.dead) continue;
    const u = z.userData, dmg = Math.max(0, Math.min(6000, +e[1] || 0)), v = Math.max(0, +e[3] || 0);
    if (Math.hypot(z.position.x - p.x, z.position.z - p.z) > 150 || dmg > b.v) continue;
    b.v -= dmg;
    S.hitter = from;
    if (f & 4) { H.ignite(z, Math.min(200, v)); u.burnBy = from; }
    if (f & 8) H.chill(z, Math.min(1, v));
    if (dmg > 0) api.damageZombie(z, f & 2 && u.T.armor ? dmg * u.T.armor : dmg, null, !!(f & 1), null);
    S.hitter = null;
  }
}

function checkPerks() {
  const st = api.state;
  if (!isHost() || S.phase !== 'run' || S.waveQueued || !st.between || st.wave < 1) return;
  if ([...S.players.values()].every(p => p.perked >= st.wave)) proceedWave();
}

function proceedWave() {
  if (S.waveQueued) return;
  S.waveQueued = true;
  api.schedule(1.4, api.nextWave);
}

function autoPick() { document.querySelector('#perk-list .perk')?.click(); }

function revived(p, by) {
  p.st = 0; p.rev = 0; p.bleed = 0;
  if (p.me) {
    api.player.hp = api.stats.maxHp * .35;
    api.message('REVIVED', by ? 'BY ' + by.name : '', 1.6);
    api.haptic('MEDIUM');
  } else api.toast((by?.me ? 'YOU REVIVED ' : (by?.name || 'SQUAD') + ' REVIVED ') + p.name, 1.6);
}

function bledOut(p) {
  p.st = 2; p.rev = 0; p.bleed = 0;
  if (p.me) { api.player.hp = 0; api.message('BLED OUT', 'BACK IN THE FIGHT NEXT WAVE', 2.4); }
  else api.toast(p.name + ' BLED OUT', 1.6);
}

function checkAllDown() {
  if (isHost() && S.phase === 'run' && [...S.players.values()].every(p => p.st !== 0)) endRun();
}

function hostTick(dt) {
  const list = [...S.players.values()];
  for (const p of list) {
    if (p.st !== 1) continue;
    const a = posOf(p);
    const helper = list.find(q => q !== p && q.st === 0 && Math.hypot(posOf(q).x - a.x, posOf(q).z - a.z) < config.reviveRange);
    if (helper) {
      p.rev += dt / config.reviveTime;
      if (p.rev >= 1) { helper.revives++; send(['rv', p.id, helper.id]); revived(p, helper); }
    } else {
      p.rev = 0;
      p.bleed -= dt;
      if (p.bleed <= 0) { send(['out', p.id]); bledOut(p); checkAllDown(); }
    }
  }
}

function updateView(dt) {
  const W = innerWidth, Ht = innerHeight, c = api.camera.position, me = S.me, mates = [];
  for (const p of S.players.values()) {
    if (p.me) continue;
    p.avatar ||= new Avatar(api, p, hud.tags);
    p.avatar.update(dt, api.camera, api.look, W, Ht);
    mates.push(p);
  }
  hud.team(mates);
  if (me.st === 1) hud.down("YOU'RE DOWN", me.rev > 0 ? 'SQUAD IS REVIVING YOU…' : 'BLEEDING OUT · ' + Math.ceil(me.bleed) + 'S — HOLD ON, THE SQUAD CAN REVIVE YOU', me.rev > 0 ? me.rev : null);
  else if (me.st === 2) hud.down('BLED OUT', 'SPECTATING — BACK IN THE FIGHT NEXT WAVE');
  else hud.down(null);
  let text = null, k = null;
  if (me.st === 0) {
    let best = null, bd = 1e9;
    for (const p of mates) if (p.st === 1) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = p; } }
    if (best) {
      if (bd < config.reviveRange) { text = 'REVIVING ' + best.name + ' — STAY CLOSE'; k = best.rev; }
      else text = best.name + ' DOWNED — HOLD NEAR TO REVIVE · ' + Math.round(bd) + 'M';
    }
  }
  hud.prompt(text, k);
  const hostP = S.players.get(S.host);
  const rtt = isHost() ? Math.max(0, ...mates.map(p => p.rtt)) : hostP?.rtt || 0;
  const stale = isHost() ? 0 : now() - (hostP?.seen || now());
  const q = stale > 1500 ? 1 : rtt < 80 ? 4 : rtt < 160 ? 3 : rtt < 300 ? 2 : 1;
  hud.net(q, (isHost() ? 'HOST · ' : '') + (stale > 1500 ? 'LAG' : Math.round(rtt) + 'MS'));
}

function update(dt) {
  const st = api.state, t = st.clock, me = S.me;
  if (me.st !== 0) api.camera.position.y = me.st === 1 ? .55 : .4;
  if (t - S.stateAt >= 1 / config.stateHz) { S.stateAt = t; sendState(); }
  if (isHost()) {
    hostTick(dt);
    if (S.phase === 'run' && t - S.snapAt >= 1 / config.snapHz) { S.snapAt = t; sendSnapshot(); }
  } else flushHits(t);
  if (S?.phase === 'run') updateView(dt);
}

const net = {
  mod: null,
  get host() { return isHost(); },
  get downed() { return !!S && S.me.st !== 0; },
  get out() { return !!S && S.me.st === 2; },
  get immune() { return !!S && S.me.st !== 0; },
  spawned(z) {
    if (!isHost()) return;
    const u = z.userData;
    u.nid = ++S.zseq;
    S.zmap.set(u.nid, z);
    send(['z+', u.nid, KINDS.indexOf(u.kind), u.elite ? 1 : 0, c100(z.position.x), c100(z.position.z), Math.round(u.maxHp), u.rise > 0 ? 1 : 0]);
  },
  targetFor(z) {
    const u = z.userData;
    let best = null, bd = 1e9, bid = '';
    for (const p of S.players.values()) {
      if (p.st !== 0) continue;
      const o = posOf(p), d = Math.hypot(o.x - z.position.x, o.z - z.position.z) - (u.tgt === p.id ? 1.5 : 0);
      if (d < bd) { bd = d; best = p.me ? o : p.pos; bid = p.id; }
    }
    u.tgt = bid;
    return best;
  },
  claim(z, amount, head, armored, point) {
    const u = z.userData;
    if (isHost()) {
      u.lastBy = S.hitter || (point ? S.me.id : u.burnT > 0 && u.burnBy ? u.burnBy : u.lastBy || S.me.id);
      return false;
    }
    if (u.nid) queueHit(u.nid, amount, (head ? 1 : 0) | (armored ? 2 : 0), 0);
    return true;
  },
  fx(z, kind, v) {
    const u = z.userData;
    if (isHost()) { if (!S.hitter && kind === 0) u.burnBy = S.me.id; return false; }
    if (u.nid && !u.dead) queueHit(u.nid, 0, kind ? 8 : 4, v);
    return true;
  },
  killed(z, head, noScore) {
    const u = z.userData;
    if (!isHost() || !u.nid) return;
    S.zmap.delete(u.nid);
    const killer = noScore ? '' : u.lastBy || S.me.id, k = S.players.get(killer);
    if (k) { k.kills++; if (head) k.heads++; }
    send(['z-', u.nid, head ? 1 : 0, killer, noScore ? 0 : S.lastKillPts]);
    S.lastKillPts = 0;
  },
  exploded(x, z, o) {
    if (o.remote) return true;
    if (o.hostile) return !isHost();
    send(['x', c100(x), c100(z), o.color ?? 0xffa040, +(o.radius ?? 6.5).toFixed(2)]);
    return false;
  },
  spat(z, at) { if (isHost() && z.userData.nid) send(['sp', z.userData.nid, c100(at.x), c100(at.z)]); },
  aoe(pos, r, dmg) {
    for (const p of S.players.values()) {
      if (p.st !== 0) continue;
      const o = posOf(p);
      if (Math.hypot(o.x - pos.x, o.z - pos.z) >= r) continue;
      if (p.me) api.hurtPlayer(dmg, pos); else p.pos.hurt(dmg, pos);
    }
  },
  charge(z, r, dmg, dx, dz) {
    for (const p of S.players.values()) {
      if (p.me || p.st !== 0 || Math.hypot(p.x - z.position.x, p.z - z.position.z) >= r) continue;
      send(['hu', +dmg.toFixed(1), c100(z.position.x), c100(z.position.z), c100(dx), c100(dz)], p.id);
      return true;
    }
    return false;
  },
  dropped(g) {
    if (!isHost()) return;
    g.userData.nid = ++S.kseq;
    send(['k+', g.userData.nid, g.userData.kind, c100(g.position.x), c100(g.position.z)]);
  },
  collected(g) { if (g.userData.nid) send(['k-', g.userData.nid]); },
  perked() {
    const st = api.state;
    S.me.perked = st.wave;
    S.perkShownAt = 0;
    if (isHost()) checkPerks(); else send(['pk', st.wave]);
  },
  down() {
    const me = S.me;
    if (me.st !== 0) return;
    me.st = 1; me.bleed = config.bleed; me.rev = 0;
    api.player.hp = 0;
    api.haptic('HEAVY');
    send(['dn', api.state.wave]);
    if (isHost()) { me.downs++; checkAllDown(); }
  },
  radar(plot) {
    for (const p of S.players.values()) if (!p.me) plot(p.x, p.z, 7, p.st === 0 ? '#4ad8ff' : '#ffc34d');
  },
  syncZombies,
  update,
};

function tick() {
  if (!S) return;
  const t = now();
  if (t - S.pingAt > 1000) { S.pingAt = t; sendU(['pi', Math.round(t)]); }
  if (S.phase !== 'run') return;
  const st = api.state;
  if (st.mode === 'perk' && S.perkShownAt) {
    const left = config.perkTimeout - (t - S.perkShownAt) / 1000;
    const picked = [...S.players.values()].filter(p => p.perked >= st.wave).length;
    hud.perkWait('SQUAD PICKING · ' + picked + '/' + S.players.size + ' · AUTO-PICK IN ' + Math.max(0, Math.ceil(left)) + 'S');
    if (left <= 0) autoPick();
  } else hud.perkWait('');
  if (st.mode === 'playing' && st.between && st.wave > 0 && S.me.perked >= st.wave && !S.waveQueued) {
    const picked = [...S.players.values()].filter(p => p.perked >= st.wave).length;
    api.hint(picked < S.players.size ? 'WAITING FOR SQUAD · ' + picked + '/' + S.players.size + ' PICKED' : '');
  }
  if (isHost() && st.between && S.perkDeadline && t > S.perkDeadline && !S.waveQueued) {
    if (st.mode === 'perk') autoPick();
    proceedWave();
  }
}

export function init(a) {
  api = a;
  H = api.netHooks;
  KINDS = Object.keys(api.ZT);
  injectStyles();
  lobby = createLobby(api, actions);
  hud = createHud(api);
  const b = document.createElement('button');
  b.className = 'ghost';
  b.id = 'coop-open';
  b.textContent = 'CO-OP';
  b.onclick = () => { api.sfx.init(); openLobby(); };
  api.$('#menu-modes').appendChild(b);
  overTitle = api.$('#over h2').textContent;
  overBox = document.createElement('div');
  api.$('#over-extras').appendChild(overBox);
  lobbyBtn = document.createElement('button');
  lobbyBtn.className = 'cta hidden';
  lobbyBtn.textContent = 'SQUAD LOBBY';
  lobbyBtn.onclick = backToLobby;
  api.$('#again').after(lobbyBtn);
  setInterval(tick, 250);
  if (GameKitTransport.available()) GameKitTransport.listen('matchFound', onMatchFound);

  api.bus.on('shot', () => { if (S) S.fired = true; });
  api.bus.on('kill', e => { if (S) S.lastKillPts = e.points; });
  api.bus.on('wave:start', e => {
    if (S?.phase !== 'run') return;
    if (isHost()) {
      send(['w', e.wave, e.mod]);
      for (const p of S.players.values()) if (p.st !== 0 && !p.me) { p.st = 0; p.bleed = 0; p.rev = 0; }
    }
    if (S.me.st !== 0) { S.me.st = 0; S.me.rev = 0; api.player.hp = api.stats.maxHp * .5; api.toast('BACK IN THE FIGHT', 1.6); }
    S.waveQueued = false; S.perkDeadline = 0; S.perkShownAt = 0;
    api.hint('');
  });
  api.bus.on('wave:clear', e => {
    if (S?.phase !== 'run') return;
    if (isHost()) send(['wc', e.wave]);
    if (S.me.st !== 0) api.player.hp = 0;
  });
  api.bus.on('screen', e => {
    if (e.id === 'menu' && S) leave();
    if (e.id === 'perks' && S?.phase === 'run') {
      if (!api.state.between) { autoPick(); return; }
      S.perkShownAt = now();
      if (isHost()) S.perkDeadline = now() + (config.perkTimeout + config.perkGrace) * 1000;
    }
  });
  api.bus.on('run:start', e => { if (e.type !== 'coop' && S) leave(); });
  api.bus.on('run:end', e => {
    const coop = e.type === 'coop';
    api.$('#over').classList.toggle('coop', coop);
    api.$('#over h2').textContent = coop ? 'SQUAD WIPED' : overTitle;
    api.$('#again').classList.toggle('hidden', coop);
    lobbyBtn.classList.toggle('hidden', !coop || !S);
    overBox.replaceChildren(...(coop && S?.over ? [overTable(api, S.over)] : []));
  });

  api.coop = { config, net, actions, leave, open: openLobby, lobby: backToLobby, get session() { return S; } };
}
