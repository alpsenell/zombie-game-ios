import { APP_ID, NAMESPACE, SALT, APP_VERSION } from './analytics-config.js';

export const id = 'analytics';

const HOST = 'https://nom.telemetrydeck.com/v2/';
const CLIENT = 'DeadzoneJS ' + APP_VERSION;
const QUEUE_CAP = 300, BATCH = 100, TICK = 10e3, SESSION_GAP = 300e3, SCREEN_GAP = 30e3, LOG = 20;
const FORWARD = [/^mission:complete$/, /^share$/, /^revive$/, /^season:/, /^coop:/, /^daily:/, /^ranked:/];
const BLOCKED_KEY = /name|alias|player|user|gc|text|msg|message|code|mail|nick|seed/i;
const SAFE_STR = /^[\w.:-]{1,48}$/;
const SCORE = [0, 1, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const COUNT = [0, 1, 10, 25, 50, 100, 200, 400, 800];
const SHOTS = [0, 1, 50, 100, 250, 500, 1000, 2500, 5000];
const RUN_T = [0, 60, 120, 300, 600, 900, 1200, 1800, 2700, 3600];
const WAVE_T = [0, 15, 30, 45, 60, 90, 120, 180, 300];
const SESSION_T = [0, 10, 30, 60, 180, 300, 600, 1200, 1800, 3600];

const ls = {
  get(k, d) { try { const v = localStorage.getItem('deadzone.analytics.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('deadzone.analytics.' + k, JSON.stringify(v)); } catch {} },
};

export function bucket(n, edges) {
  n = Math.max(0, Math.floor(+n || 0));
  let i = 0;
  while (i < edges.length - 1 && n >= edges[i + 1]) i++;
  return i === edges.length - 1 ? edges[i] + '+' : edges[i] === edges[i + 1] - 1 ? String(edges[i]) : edges[i] + '-' + (edges[i + 1] - 1);
}
const pct = p => { const b = Math.min(90, Math.floor(Math.max(0, +p || 0) * 10) * 10); return b + '-' + (b === 90 ? 100 : b + 9); };
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const uid = () => crypto.randomUUID?.() || hex(crypto.getRandomValues(new Uint8Array(16)));
const sha256 = async text => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
const camel = s => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
const signalName = e => e.split(':').map((p, i) => (i ? camel(p) : camel(p).replace(/^\w/, c => c.toUpperCase()))).join('.') || 'Event';
const safe = v => (typeof v === 'string' && SAFE_STR.test(v) ? v : undefined);

function clean(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const [k, v] of Object.entries(d)) {
    if (Object.keys(out).length >= 8 || BLOCKED_KEY.test(k)) continue;
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (safe(v)) out[k] = v;
  }
  return out;
}

const CSS = `
.ad-sheet{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:max(16px,var(--st)) max(16px,var(--sr)) max(16px,var(--sb)) max(16px,var(--sl));background:#000b;touch-action:none;animation:ad-in .25s ease-out}
.ad-card{width:min(92vw,500px);padding:20px 22px;border-radius:18px;background:#081115f7;border:1px solid var(--line);box-shadow:0 20px 60px #000;text-align:left}
.ad-card h3{margin:0 0 8px;font:900 26px/1 var(--display);letter-spacing:1.5px}
.ad-card p{margin:0 0 6px;color:#cfd9d6;font:600 13px/1.5 var(--ui)}
.ad-card small{display:block;margin-bottom:16px;color:var(--dim);font:700 10px var(--ui);letter-spacing:1.4px}
.ad-card .row{justify-content:flex-end;flex-wrap:nowrap}
.ad-card .cta{padding:14px 30px;font-size:15px}
.ad-card .ghost{padding:13px 18px}
.ad-dev{width:min(94vw,680px);text-align:left}
.ad-dev h2{text-align:center}
.ad-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px 14px;margin-bottom:12px;font:800 10px var(--ui);letter-spacing:1.2px;color:var(--dim)}
.ad-kv .wide{grid-column:1/-1}
.ad-kv b{display:block;color:var(--ink);font-size:13px;letter-spacing:.5px;word-break:break-all}
.ad-log{margin:0 0 14px;padding:0;list-style:none;max-height:34vh;overflow:auto;font:500 10px/1.45 ui-monospace,Menlo,monospace;color:#cfd9d6;word-break:break-all;touch-action:pan-y}
.ad-log li{padding:4px 0;border-bottom:1px solid #ffffff12}.ad-log b{color:var(--amber)}
.ad-dev .row{justify-content:center}
@keyframes ad-in{from{opacity:0}}
`;

export function init(api) {
  const { bus, settings, store } = api;
  const debug = new URLSearchParams(location.search).has('debug');
  const override = debug ? ls.get('test', null) : null;
  const appID = override?.appId ?? APP_ID;
  const namespace = override?.namespace ?? NAMESPACE;
  const target = HOST + (namespace ? 'namespace/' + encodeURIComponent(namespace) + '/' : '');
  const native = !!window.Capacitor?.isNativePlatform?.();
  const testMode = !native || debug;
  const install = ls.get('install', null) || { at: Date.now() };
  ls.set('install', install);
  let queue = ls.get('queue', []);
  if (!Array.isArray(queue)) queue = [];
  const stats = Object.assign({ sent: 0, failed: 0, dropped: 0 }, ls.get('stats', {}));
  const log = [];
  let hashP = null, sessionID = null, sessionAt = 0, hiddenAt = 0, sessionRuns = 0, opened = false;
  let inflight = false, fails = 0, retryAt = 0, run = null, prompted = false, devEl = null, devReturn = null;
  const lastScreen = {};

  const enabled = () => settings.analytics === true;
  const days = () => Math.min(999, Math.floor((Date.now() - install.at) / 864e5));
  const save = () => { ls.set('queue', queue); ls.set('stats', stats); };
  const clientUser = () => {
    if (!install.id) { install.id = uid(); ls.set('install', install); }
    return (hashP ||= sha256(install.id + SALT));
  };

  function track(type, payload = {}, value) {
    if (!enabled()) return;
    try {
      if (!sessionID) startSession();
      const p = { 'TelemetryDeck.AppInfo.version': APP_VERSION, 'TelemetryDeck.Device.platform': native ? 'iOS' : 'Web', 'TelemetryDeck.Acquisition.firstSessionDate': new Date(install.at).toISOString().slice(0, 10) };
      for (const [k, v] of Object.entries(payload)) if (v != null && v !== '') p[k] = String(v);
      const s = { type, sessionID, receivedAt: new Date().toISOString(), payload: p };
      if (testMode) s.isTestMode = true;
      if (Number.isFinite(value)) s.floatValue = value;
      log.unshift(s);
      log.length = Math.min(log.length, LOG);
      if (debug) console.debug('[analytics]', type, payload);
      if (appID) {
        queue.push(s);
        if (queue.length > QUEUE_CAP) stats.dropped += queue.splice(0, queue.length - QUEUE_CAP).length;
        save();
      }
      render();
    } catch {}
  }

  function backoff() {
    stats.failed++;
    fails++;
    retryAt = Date.now() + Math.min(300e3, 5e3 * 2 ** (fails - 1)) * (.8 + Math.random() * .4);
    save();
  }

  async function flush(keepalive = false) {
    if (!enabled() || !appID || inflight || !queue.length || Date.now() < retryAt) return;
    if (navigator.onLine === false) return;
    inflight = true;
    const batch = queue.slice(0, keepalive ? 40 : BATCH);
    let more = false;
    try {
      const cu = await clientUser();
      const body = JSON.stringify(batch.map(s => ({ appID, clientUser: cu, telemetryClientVersion: CLIENT, ...s })));
      const res = await fetch(target, { method: 'POST', mode: 'cors', keepalive, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        queue = queue.filter(s => !batch.includes(s));
        if (res.ok) { stats.sent += batch.length; fails = 0; retryAt = 0; more = queue.length > 0; } else stats.dropped += batch.length;
        save();
      } else backoff();
    } catch { backoff(); }
    inflight = false;
    render();
    if (more && !keepalive) flush();
  }

  function startSession() {
    sessionID = uid();
    sessionAt = Date.now();
    sessionRuns = 0;
    track('TelemetryDeck.Session.started');
  }
  function endSegment() {
    if (!sessionAt) return;
    const secs = (Date.now() - sessionAt) / 1000;
    sessionAt = 0;
    track('Session.ended', { duration: bucket(secs, SESSION_T), runs: sessionRuns }, Math.round(secs));
  }

  function start() {
    if (!enabled()) return;
    if (!sessionID) startSession();
    if (!install.sent) { install.sent = true; ls.set('install', install); track('TelemetryDeck.Acquisition.newInstallDetected', { daysSinceInstall: days() }); }
    if (!opened) { opened = true; track('App.opened', { daysSinceInstall: days(), runs: bucket(api.profile?.runs, COUNT) }, days()); }
    flush();
  }
  function stop() {
    queue = [];
    delete install.id;
    ls.set('install', install);
    hashP = null; sessionID = null; sessionAt = 0; opened = false; fails = 0; retryAt = 0;
    save();
    render();
  }
  function setConsent(v) {
    settings.analytics = v;
    store.set('settings', settings);
    document.querySelectorAll('.toggle[data-key="analytics"]').forEach(t => t.classList.toggle('on', v));
    v ? start() : stop();
  }

  function prompt() {
    if (prompted || settings.analytics !== undefined || (navigator.webdriver && !override) || api.activeScreen !== api.ui.menu) return;
    prompted = true;
    api.queueModal(done => {
    if (settings.analytics !== undefined || api.activeScreen !== api.ui.menu) return done();
    const el = document.createElement('div');
    el.className = 'ad-sheet';
    el.id = 'analytics-consent';
    el.innerHTML = '<div class="ad-card" role="dialog" aria-modal="true" aria-labelledby="ad-title"><h3 id="ad-title">HELP IMPROVE THE GAME?</h3>' +
      '<p>Send anonymous gameplay stats (waves, deaths, weapons). No ads, no tracking across apps.</p><small>CHANGE ANYTIME IN SETTINGS</small>' +
      '<div class="row"><button class="ghost" data-v="0">NO THANKS</button><button class="cta" data-v="1">ALLOW</button></div></div>';
    el.querySelectorAll('button').forEach(b => (b.onclick = () => { el.remove(); setConsent(b.dataset.v === '1'); done(); }));
    document.body.appendChild(el);
    }, 10);
  }

  function devScreen() {
    if (!devEl) {
      devEl = document.createElement('section');
      devEl.className = 'screen';
      devEl.id = 'devstats';
      devEl.innerHTML = '<div class="panel ad-dev"><h2>DEV STATS</h2><div class="ad-kv"></div><ol class="ad-log"></ol>' +
        '<div class="row"><button class="ghost" data-a="flush">FLUSH</button><button class="ghost" data-a="clear">CLEAR QUEUE</button><button class="cta" data-a="close">CLOSE</button></div></div>';
      devEl.querySelector('[data-a="flush"]').onclick = () => { retryAt = 0; flush(); };
      devEl.querySelector('[data-a="clear"]').onclick = () => { queue = []; save(); render(); };
      devEl.querySelector('[data-a="close"]').onclick = () => api.showScreen(devReturn || api.ui.menu);
      document.body.appendChild(devEl);
      api.registerScreen(devEl);
    }
    devReturn = api.activeScreen;
    api.showScreen(devEl);
    render();
  }
  function render() {
    if (!devEl || devEl.classList.contains('hidden')) return;
    const kv = [
      ['CONSENT', settings.analytics === undefined ? 'NOT ASKED' : enabled() ? 'ON' : 'OFF'],
      ['APP ID', appID ? 'SET' : 'EMPTY · LOCAL LOG ONLY'], ['MODE', testMode ? 'TEST' : 'LIVE'],
      ['QUEUED', queue.length], ['SENT', stats.sent], ['FAILED', stats.failed], ['DROPPED', stats.dropped],
      ['RETRY', retryAt > Date.now() ? Math.ceil((retryAt - Date.now()) / 1000) + 'S' : '—'], ['ENDPOINT', target.replace('https://', '')],
    ];
    devEl.querySelector('.ad-kv').innerHTML = kv.map(([k]) => `<div${k === 'ENDPOINT' ? ' class="wide"' : ''}>${k}<b></b></div>`).join('');
    devEl.querySelectorAll('.ad-kv b').forEach((b, i) => (b.textContent = kv[i][1]));
    const list = devEl.querySelector('.ad-log');
    list.innerHTML = '';
    for (const s of log) {
      const li = document.createElement('li'), b = document.createElement('b');
      const p = Object.fromEntries(Object.entries(s.payload).filter(([k]) => !k.startsWith('TelemetryDeck.')));
      b.textContent = s.receivedAt.slice(11, 19) + ' ' + s.type;
      li.append(b, ' ' + JSON.stringify(p) + (s.floatValue != null ? ' = ' + s.floatValue : ''));
      list.appendChild(li);
    }
    if (!log.length) list.innerHTML = '<li>NO SIGNALS YET</li>';
  }

  const milestone = w => w <= 10 || w % 5 === 0;
  const runInfo = () => ({ type: run.type, difficulty: run.difficulty, map: run.map });
  function causeOf(from) {
    if (!from) return 'acid';
    let best = null, bd = 2.5;
    for (const z of api.zombies) {
      if (z.position === from) return z.userData.kind;
      const d = Math.hypot(z.position.x - from.x, z.position.z - from.z);
      if (d < bd) { bd = d; best = z; }
    }
    return best?.userData.kind || 'explosion';
  }
  function endRun(s, cause) {
    if (!run || run.ended) return;
    run.ended = true;
    const wave = s?.wave ?? run.wave, deep = wave >= 10;
    track('Run.ended', {
      ...runInfo(), wave, score: bucket(s?.score, SCORE), kills: bucket(s?.kills, COUNT), accuracy: pct(s?.accuracy), duration: bucket(s?.time, RUN_T),
      cause, perks: run.perks.slice(0, 12).join(','), perkCount: run.perks.length, bosses: s?.bosses?.length ?? 0, weapon: run.slots[0], reachedWave10: deep,
    }, wave);
    for (const [w, c] of Object.entries(run.weapons).slice(0, 6)) {
      track('Weapon.used', {
        weapon: w, slot: run.slots[0] === w ? 'primary' : run.slots[1] === w ? 'secondary' : 'other', difficulty: run.difficulty,
        shots: bucket(c.shots, SHOTS), kills: bucket(c.kills, COUNT), heads: bucket(c.heads, COUNT), wave, reachedWave10: deep,
      }, c.kills);
    }
    flush();
  }
  const weapon = w => (run.weapons[w] ||= { shots: 0, kills: 0, heads: 0 });

  bus.on('run:start', d => {
    sessionRuns++;
    const slots = (d.slots || []).map(i => api.WEAPONS[i]?.id).filter(Boolean);
    const map = safe(d.opts?.map) || safe(d.opts?.map?.id);
    run = { type: d.type || 'normal', difficulty: d.difficultyId, map, slots, weapons: {}, perks: [], cause: null, wave: 0, waveAt: 0, snap: null, ended: false };
    const runs = api.profile?.runs ?? 0;
    track('Run.started', { ...runInfo(), primary: slots[0], secondary: slots[1] !== slots[0] ? slots[1] : undefined, firstRun: runs === 0, runs: bucket(runs, COUNT), sessionRun: sessionRuns });
  });
  bus.on('wave:start', d => {
    if (!run) return;
    run.wave = d.wave;
    run.waveAt = api.state.clock;
    if (milestone(d.wave)) track('Run.waveReached', { ...runInfo(), wave: d.wave, boss: !!d.boss, mod: safe(d.mod) }, d.wave);
    if (d.boss) {
      const kind = (api.state.queue || []).find(q => api.ZT?.[q.kind]?.boss)?.kind;
      track('Boss.encountered', { ...runInfo(), boss: safe(kind), wave: d.wave });
    }
  });
  bus.on('wave:clear', d => {
    if (!run || !milestone(d.wave)) return;
    const secs = api.state.clock - run.waveAt;
    track('Run.waveCleared', { ...runInfo(), wave: d.wave, duration: bucket(secs, WAVE_T), hp: pct(d.hp / (api.stats?.maxHp || 100)) }, Math.round(secs));
  });
  bus.on('shot', d => { if (run && d?.weapon) weapon(d.weapon).shots++; });
  bus.on('kill', d => {
    if (!run) return;
    if (d.weapon) { const c = weapon(d.weapon); c.kills++; if (d.head) c.heads++; }
    if (d.boss) track('Boss.killed', { ...runInfo(), boss: safe(d.kind), wave: api.state.wave, weapon: d.weapon });
  });
  bus.on('perk', d => {
    if (run) run.perks.push(d.name);
    track('Perk.picked', { perk: d.name, rare: !!d.rare, wave: d.wave, difficulty: run?.difficulty });
  });
  bus.on('player:death', d => { if (run) run.cause = causeOf(d?.from); });
  bus.on('run:end', s => endRun(s, run?.cause || 'unknown'));
  bus.on('tutorial:done', () => track('Tutorial.completed', { runs: bucket(api.profile?.runs, COUNT) }));
  bus.on('purchase', d => track('Purchase.completed', { kind: safe(d?.kind), product: safe(d?.productId) || safe(d?.item) }));
  bus.on('screen', ({ id } = {}) => {
    if (id === 'pausemenu' && run && !run.ended) run.snap = api.runSummary();
    if (id === 'menu' && run && !run.ended) endRun(run.snap, 'quit');
    if (id === 'menu') setTimeout(prompt, 800);
    if (!id || id === 'game' || id === 'devstats' || Date.now() - (lastScreen[id] || 0) < SCREEN_GAP) return;
    lastScreen[id] = Date.now();
    track('Screen.viewed', { screen: safe(id) });
  });
  bus.on('app:ready', () => {
    if (enabled()) start();
    setTimeout(prompt, 300);
  });

  const emit = bus.emit;
  bus.emit = function (event, data) {
    const r = emit.call(this, event, data);
    try { if (enabled() && FORWARD.some(re => re.test(event))) track(signalName(event), clean(data)); } catch {}
    return r;
  };

  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  document.querySelectorAll('.toggle[data-key="analytics"]').forEach(t => t.addEventListener('click', () => setConsent(settings.analytics === true)));
  const logo = document.querySelector('#menu .logo');
  let taps = [];
  logo?.addEventListener('click', () => {
    const now = Date.now();
    taps = [...taps.filter(t => now - t < 700), now];
    if (taps.length >= 3) { taps = []; devScreen(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (!enabled()) return;
    if (document.hidden) { hiddenAt = Date.now(); endSegment(); flush(true); return; }
    if (Date.now() - hiddenAt > SESSION_GAP) startSession();
    else sessionAt = Date.now();
    flush();
  });
  addEventListener('pagehide', () => flush(true));
  addEventListener('online', () => { retryAt = 0; flush(); });
  setInterval(() => { flush(); render(); }, TICK);

  api.analytics = {
    track: (type, payload) => track(type, clean(payload)), flush,
    get state() { return { enabled: enabled(), appID: !!appID, testMode, target, queued: queue.length, ...stats, log: [...log] }; },
  };
}
