export const id = 'cloudsave';
export const KEY = 'deadzone.save', VERSION = 1, DEBOUNCE = 1500, SYNC_KEYS = ['profile', 'runs', 'records'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const num = v => (Number.isFinite(+v) ? +v : 0);
const maxMap = (a = {}, b = {}) => { const out = { ...a }; for (const k in b) out[k] = Math.max(num(out[k]), num(b[k])); return out; };
const union = (a = {}, b = {}) => ({ ...b, ...a });
const unionList = (a = [], b = []) => [...new Set([...a, ...b])];
const later = (a, b) => (a == null ? b : b == null ? a : a >= b ? a : b);

export const isPristine = p => !isObj(p) || (!num(p.runs) && !num(p.xp) && !num(p.kills) && !Object.keys(p.owned || {}).length && !Object.keys(p.arsenal?.owned || {}).length);

function mergePeriod(a, b) {
  if (!a || !b) return a || b;
  if (a.key !== b.key) return String(a.key) > String(b.key) ? a : b;
  const byId = new Map((b.list || []).map(m => [m.id, m]));
  return { key: a.key, list: (a.list || []).map(m => { const o = byId.get(m.id); return o ? { ...m, p: Math.max(num(m.p), num(o.p)), done: !!(m.done || o.done), claimed: !!(m.claimed || o.claimed) } : m; }) };
}
function mergeStreak(a = {}, b = {}) {
  const s = { ...(num(b.last) > num(a.last) ? b : a) };
  s.best = Math.max(num(a.best), num(b.best), num(s.count));
  if (a.last != null && a.last === b.last) { s.count = Math.max(num(a.count), num(b.count)); s.claimed = later(a.claimed, b.claimed); s.shown = later(a.shown, b.shown); s.broken = 0; }
  return s;
}
function mergeSeason(a, b) {
  if (!isObj(a) || !isObj(b)) return a || b;
  const s = num(b.n) > num(a.n) ? { ...b } : { ...a };
  if (num(a.n) === num(b.n)) { s.xp = Math.max(num(a.xp), num(b.xp)); s.free = unionList(a.free, b.free); s.premium = unionList(a.premium, b.premium); }
  s.suits = union(a.suits, b.suits); s.skins = union(a.skins, b.skins); s.flair = maxMap(a.flair, b.flair);
  return s;
}
function mergeBest(a, b, k) {
  if (!a || !b) return a || b;
  if (a[k] !== b[k]) return String(b[k] ?? '') > String(a[k] ?? '') ? b : a;
  return { ...b, ...a, best: Math.max(num(a.best), num(b.best)) };
}
function mergeCompetitive(a, b) {
  if (!isObj(a) || !isObj(b)) return a || b;
  const c = { ...b, ...a }, seen = new Set(), key = x => x.cs + ':' + x.date;
  c.sprint = [...(a.sprint || []), ...(b.sprint || [])].filter(x => x && !seen.has(key(x)) && seen.add(key(x))).sort((x, y) => x.cs - y.cs).slice(0, 10);
  c.daily = mergeBest(a.daily, b.daily, 'date');
  c.weekly = mergeBest(a.weekly, b.weekly, 'week');
  if (b.league && (!a.league || String(b.league.week) > String(a.league.week) || (b.league.week === a.league.week && num(b.league.at) > num(a.league.at)))) c.league = b.league;
  if (b.held && (!a.held || String(b.held.week) > String(a.held.week))) c.held = b.held;
  c.paidWeek = later(a.paidWeek, b.paidWeek);
  c.resets = { ...b.resets, ...a.resets };
  return c;
}

export function mergeProfile(local, cloud) {
  if (!isObj(cloud)) return clone(local);
  if (isPristine(local)) return clone(cloud);
  const cloudWins = num(cloud.runs) > num(local.runs) || (num(cloud.runs) === num(local.runs) && num(cloud.xp) > num(local.xp));
  const a = clone(cloudWins ? cloud : local), b = clone(cloudWins ? local : cloud);
  for (const k of ['scrap', 'xp', 'kills', 'heads', 'bestWave', 'runs']) a[k] = Math.max(num(a[k]), num(b[k]));
  a.bosses = maxMap(a.bosses, b.bosses);
  a.bestByDiff = maxMap(a.bestByDiff, b.bestByDiff);
  a.owned = union(a.owned, b.owned);
  a.iap = union(a.iap, b.iap);
  a.arsenal = { ...b.arsenal, ...a.arsenal, owned: union(a.arsenal?.owned, b.arsenal?.owned) };
  a.fresh = unionList(a.fresh, b.fresh);
  if (!a.recruit?.done && b.recruit?.done) a.recruit = b.recruit;
  if (isObj(b.progression)) {
    const p = a.progression = isObj(a.progression) ? a.progression : {}, q = b.progression;
    p.mastery = maxMap(p.mastery, q.mastery);
    p.prestige = maxMap(p.prestige, q.prestige);
    p.ach = union(p.ach, q.ach);
    p.reported = maxMap(p.reported, q.reported);
    p.rerolls = Math.max(num(p.rerolls), num(q.rerolls));
    p.reroll = later(p.reroll, q.reroll);
    p.streak = mergeStreak(p.streak, q.streak);
    if (isObj(p.stats) || isObj(q.stats)) p.stats = { ...maxMap(p.stats, q.stats), bosses: maxMap(p.stats?.bosses, q.stats?.bosses) };
    p.daily = mergePeriod(p.daily, q.daily);
    p.weekly = mergePeriod(p.weekly, q.weekly);
  }
  a.season = mergeSeason(a.season, b.season);
  a.competitive = mergeCompetitive(a.competitive, b.competitive);
  if (isObj(a.events) || isObj(b.events)) a.events = { ...b.events, ...a.events, won: union(a.events?.won, b.events?.won) };
  if (isObj(a.comeback) || isObj(b.comeback)) { const c = num(b.comeback?.last) > num(a.comeback?.last) ? b.comeback : a.comeback; a.comeback = { ...c, count: Math.max(num(a.comeback?.count), num(b.comeback?.count)) }; }
  if (isObj(a.checkpoint) || isObj(b.checkpoint)) a.checkpoint = { ...b.checkpoint, ...a.checkpoint, cleared: maxMap(a.checkpoint?.cleared, b.checkpoint?.cleared), pick: a.checkpoint?.pick || b.checkpoint?.pick || {} };
  for (const k in b) if (!(k in a)) a[k] = b[k];
  return a;
}
export function mergeRuns(a = [], b = []) {
  const seen = new Set(), key = r => [r.date, r.score, r.wave, r.type].join(':');
  return [...a, ...b].filter(r => isObj(r) && !seen.has(key(r)) && seen.add(key(r))).sort((x, y) => y.score - x.score).slice(0, 25);
}
export function mergeRecords(a = {}, b = {}) {
  const top = num(a.score) >= num(b.score) ? a : b;
  return { ...b, ...a, score: Math.max(num(a.score), num(b.score)), wave: Math.max(num(a.wave), num(b.wave)), rank: num(top.rank) || num(a.rank) || num(b.rank) };
}
export function mergeAll(local, cloud) {
  return { profile: mergeProfile(local.profile, cloud.profile), runs: mergeRuns(local.runs, cloud.runs), records: mergeRecords(local.records, cloud.records), at: num(cloud.at), device: cloud.device || '' };
}
export function assignDeep(target, source) {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  for (const k in source) { const v = source[k]; if (isObj(v) && isObj(target[k])) assignDeep(target[k], v); else target[k] = clone(v); }
  return target;
}
export function timeAgo(t, now = Date.now()) {
  const m = Math.floor((now - t) / 6e4);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago';
}

const CSS = `
.cs-note{position:fixed;left:50%;top:max(14px,var(--st));transform:translateX(-50%);z-index:30;padding:8px 14px;border-radius:20px;background:#081115f0;border:1px solid #6fe3ff66;color:#bff6ff;font:900 10px var(--ui);letter-spacing:1.6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .3s}
.cs-note.on{opacity:1}
#cs-row small{min-height:14px}
#cs-sync{padding:9px 12px;font-size:10px}
`;

export function init(api) {
  const { bus, profile, store } = api;
  const native = {
    ok: () => { const c = window.Capacitor; return !!(c?.nativePromise && c.PluginHeaders?.some(h => h.name === 'CloudSave')); },
    call: (m, o = {}) => window.Capacitor.nativePromise('CloudSave', m, o),
  };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const meta = Object.assign({ device: Math.random().toString(36).slice(2, 10), pushedAt: 0, pulledAt: 0, restoredAt: 0 }, store.get('cloud', {}));
  const rawSet = store.set.bind(store);
  const saveMeta = () => rawSet('cloud', meta);
  saveMeta();
  const status = { icloud: null, error: '', last: null };
  let timer = null, lastPushed = '', busy = null, pending = null, noteTimer = null;

  const note = document.createElement('div');
  note.className = 'cs-note';
  document.body.appendChild(note);
  const say = text => { note.textContent = text; note.classList.add('on'); clearTimeout(noteTimer); noteTimer = setTimeout(() => note.classList.remove('on'), 3200); };

  const localData = () => ({ profile, runs: store.get('runs', []), records: api.records });
  const snapshot = () => ({ v: VERSION, at: Date.now(), device: meta.device, profile: clone(profile), runs: store.get('runs', []), records: clone(api.records) });
  const fingerprint = s => JSON.stringify({ ...s, at: 0 });

  async function push() {
    clearTimeout(timer); timer = null;
    if (!native.ok()) return false;
    const snap = snapshot(), body = fingerprint(snap);
    if (body === lastPushed) return false;
    try {
      await native.call('write', { key: KEY, value: JSON.stringify(snap) });
      lastPushed = body; meta.pushedAt = snap.at; saveMeta(); status.error = '';
      bus.emit('cloud:pushed', { at: snap.at });
      return true;
    } catch (e) { status.error = String(e?.message || e); return false; }
  }
  const schedule = () => { if (!native.ok()) return; clearTimeout(timer); timer = setTimeout(push, DEBOUNCE); };
  store.set = (k, v) => { rawSet(k, v); if (SYNC_KEYS.includes(k)) schedule(); };

  function apply(merged) {
    assignDeep(profile, merged.profile);
    assignDeep(api.records, merged.records);
    rawSet('runs', merged.runs);
    rawSet('records', api.records);
    api.saveProfile();
    meta.restoredAt = Date.now(); saveMeta();
    api.refreshProfileUI(); api.refreshRecords();
    if (api.activeScreen === api.ui.menu) api.showScreen(api.ui.menu);
    say('☁︎ PROGRESS RESTORED FROM iCLOUD');
    bus.emit('cloud:restored', { at: merged.at, device: merged.device });
    status.last = 'restored';
    schedule();
  }

  async function pull(reason = 'manual') {
    if (!native.ok()) return null;
    if (busy) return busy;
    busy = (async () => {
      let r = null;
      try { r = await native.call('read', { key: KEY }); meta.pulledAt = Date.now(); saveMeta(); status.error = ''; }
      catch (e) { status.error = String(e?.message || e); return { action: 'error', reason }; }
      let cloud = null;
      try { cloud = r?.value ? JSON.parse(r.value) : null; } catch { cloud = null; }
      if (!isObj(cloud) || !isObj(cloud.profile)) { schedule(); return { action: 'push', reason }; }
      if (cloud.device === meta.device && num(cloud.at) <= num(meta.pushedAt)) return { action: 'same', reason };
      const local = localData(), merged = mergeAll(local, cloud);
      const changed = JSON.stringify(merged.profile) !== JSON.stringify(local.profile) || JSON.stringify(merged.runs) !== JSON.stringify(local.runs) || JSON.stringify(merged.records) !== JSON.stringify(local.records);
      if (!changed) { schedule(); return { action: 'same', reason }; }
      if (api.state.mode !== 'menu') { pending = merged; return { action: 'deferred', reason }; }
      apply(merged);
      return { action: 'restored', reason };
    })();
    const out = await busy;
    busy = null;
    return out;
  }

  const row = document.createElement('div');
  row.className = 'opt';
  row.id = 'cs-row';
  row.innerHTML = '<div>iCloud progress sync<small id="cs-status"></small></div><button class="ghost" id="cs-sync">SYNC NOW</button>';
  api.$('#settings .opts')?.appendChild(row);
  const statusEl = row.querySelector('#cs-status'), syncBtn = row.querySelector('#cs-sync');
  function renderStatus() {
    if (!native.ok()) { statusEl.textContent = 'Available in the iOS app'; syncBtn.classList.add('hidden'); return; }
    syncBtn.classList.remove('hidden');
    statusEl.textContent = status.error ? 'Last sync failed: ' + status.error
      : status.icloud === false ? 'Sign in to iCloud in iOS Settings to back up your progress'
      : meta.pushedAt ? 'Backed up ' + timeAgo(meta.pushedAt) + (meta.restoredAt ? ' · restored ' + timeAgo(meta.restoredAt) : '')
      : 'Not backed up yet';
  }
  syncBtn.onclick = async () => {
    syncBtn.disabled = true; statusEl.textContent = 'Syncing…';
    try { status.icloud = !!(await native.call('status'))?.available; } catch { status.icloud = null; }
    const r = await pull('manual');
    if (r?.action !== 'restored') await push();
    syncBtn.disabled = false;
    renderStatus();
    api.haptic('LIGHT');
  };

  bus.on('app:ready', () => pull('launch'));
  bus.on('screen', ({ id }) => {
    if (id === 'settings') { renderStatus(); if (native.ok()) native.call('status').then(r => { status.icloud = !!r?.available; renderStatus(); }).catch(() => {}); }
    if (id === 'menu' && pending && api.state.mode === 'menu') { const m = pending; pending = null; apply(m); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) push(); else pull('resume'); });
  if (native.ok()) window.Capacitor.Plugins?.CloudSave?.addListener?.('changed', () => pull('external'));

  api.cloud = { KEY, pull, push, schedule, mergeAll, mergeProfile, mergeRuns, mergeRecords, available: native.ok, get meta() { return meta; }, get status() { return status; }, get pending() { return pending; } };
}
