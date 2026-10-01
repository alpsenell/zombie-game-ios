import { LEAGUES, LEAGUE_REWARDS, utcDay, weekStart } from './competitive.js';
import { eventAt } from './events.js';
import { streakReward } from './progression/data.js';

export const id = 'notify';
export const PRIORITY = { streak: 1, daily: 2, league: 3, lapse: 4, event: 5 };
export const MAX_PENDING = 8, WINDOW = [8, 22], LAPSE_DAYS = [3, 7];
const DAY = 864e5, H = 36e5, MIN = 6e4;

export const fmtTime = (t, tz) => { const d = new Date(t + tz * MIN); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

export function planFor(s, now = Date.now(), tz = -new Date().getTimezoneOffset()) {
  const off = tz * MIN;
  const localDay = t => Math.floor((t + off) / DAY);
  const localHour = t => (((t + off) % DAY) + DAY) % DAY / H;
  const atLocal = (day, hour) => day * DAY - off + hour * H;
  const inWindow = t => { const h = localHour(t); return h >= WINDOW[0] && h <= WINDOW[1]; };
  const wake = t => (inWindow(t) ? t : atLocal(localDay(t) + (localHour(t) < WINDOW[0] ? 0 : 1), 9));
  const out = [];
  const add = (kind, at, title, body) => { if (at > now + 10 * MIN && at < now + 14 * DAY) out.push({ id: kind + ':' + Math.round(at / MIN), kind, at, title, body, priority: PRIORITY[kind] }); };

  const st = s.streak;
  if (st && st.last != null && st.count >= 1) {
    const deadline = (st.last + 2) * DAY;
    let at = deadline - 4 * H;
    if (!inWindow(at)) { at = atLocal(localDay(deadline - 4 * H), 20); if (at > deadline - H) at -= DAY; }
    const next = streakReward(st.count + 1).total;
    if (st.count >= 2) add('streak', at, 'Your ' + st.count + '-day streak is about to end', 'One run before ' + fmtTime(deadline, tz) + ' keeps it going. Day ' + (st.count + 1) + ' pays ' + next.toLocaleString() + ' scrap.' + (st.shields ? ' You hold ' + st.shields + ' shield' + (st.shields > 1 ? 's' : '') + '.' : ''));
    else add('streak', at, 'Day 2 reward is waiting', 'Play before ' + fmtTime(deadline, tz) + ' to claim ' + next.toLocaleString() + ' scrap and start a streak.');
  }
  if (s.daily && s.daily.date === utcDay(now) && s.daily.rank) {
    const reset = (Math.floor(now / DAY) + 1) * DAY, at = reset - 2 * H;
    if (inWindow(at)) add('daily', at, "You're #" + s.daily.rank.toLocaleString() + ' on today\'s Daily', '2 hours left to climb. Your best today: ' + (s.daily.best || 0).toLocaleString() + '.');
  }
  if (s.league) {
    const lg = LEAGUES.find(l => l.id === s.league.id);
    if (lg) add('league', wake(weekStart(now) + 7 * DAY), lg.name + ' League week complete', 'Collect ' + (LEAGUE_REWARDS[lg.id] || 0).toLocaleString() + ' scrap and see where you placed.');
  }
  if (s.event && !s.event.live) {
    const e = s.event;
    add('event', wake(e.start), e.icon + ' ' + e.name + ' is live', e.desc + (e.won ? '. Boosts run all weekend.' : '. Clear wave 10 for the ' + (e.skin || 'event') + ' skin.'));
  }
  const base = localDay(s.lastPlay || now);
  add('lapse', atLocal(base + LAPSE_DAYS[0], 19), "It's been " + LAPSE_DAYS[0] + ' days', 'The horde is still out there. ' + (s.bestWave ? 'Your best is wave ' + s.bestWave + '.' : 'Your first wave is waiting.'));
  add('lapse', atLocal(base + LAPSE_DAYS[1], 19), 'Your comeback crate is waiting', 'Scrap, XP and double season XP for your next 3 runs.');

  const byDay = new Map();
  for (const n of out) { const d = localDay(n.at); if (!byDay.has(d) || byDay.get(d).priority > n.priority) byDay.set(d, n); }
  const ev = out.find(n => n.kind === 'event');
  if (ev) { const w = byDay.get(localDay(ev.at)); if (w && w !== ev) w.body += ' ' + s.event.icon + ' ' + s.event.name + ' is live too.'; }
  return [...byDay.values()].sort((a, b) => a.at - b.at).slice(0, MAX_PENDING);
}

const CSS = `
.nt-toggle{width:50px;height:30px;flex:none;border-radius:15px;border:0;background:#2b3538;position:relative;transition:background .2s}
.nt-toggle:after{content:"";position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .2s}
.nt-toggle.on{background:#e5483a}.nt-toggle.on:after{transform:translateX(20px)}
.nt-toggle:disabled{opacity:.4}
`;

export function init(api) {
  const { bus, profile, store } = api;
  const native = {
    ok: () => { const c = window.Capacitor; return !!(c?.nativePromise && c.PluginHeaders?.some(h => h.name === 'Notify')); },
    call: (m, o = {}) => window.Capacitor.nativePromise('Notify', m, o),
  };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const N = Object.assign({ enabled: true, asked: false, status: null, planned: [], plannedAt: 0 }, store.get('notify', {}));
  const save = () => store.set('notify', N);
  const allowed = () => N.enabled && (N.status === 'authorized' || N.status === 'provisional' || N.status === 'ephemeral');
  let timer = null, lastPlan = '';

  function stateFor() {
    const c = profile.competitive || {}, st = profile.progression?.streak, ev = eventAt(), week = utcDay(weekStart());
    const skin = api.SLOTS.find(s => s.id === 'gun').items.find(it => it.req === 'event:' + ev.id);
    return {
      streak: st ? { count: st.count, last: st.last, shields: st.shields || 0 } : null,
      daily: c.daily || null,
      league: c.league && c.league.week === week ? { id: c.league.id } : null,
      event: { ...ev, won: !!profile.events?.won?.[ev.id], skin: skin?.name },
      lastPlay: Date.now(), bestWave: profile.bestWave || 0,
    };
  }
  async function plan(force) {
    clearTimeout(timer); timer = null;
    if (!native.ok()) return null;
    if (!allowed()) { if (N.planned.length || force) { try { await native.call('cancelAll'); } catch {} N.planned = []; save(); } return []; }
    const list = planFor(stateFor()), key = JSON.stringify(list.map(n => n.id));
    if (key === lastPlan && !force) return list;
    try {
      await native.call('cancelAll');
      await native.call('schedule', { notifications: list.map(({ id, title, body, at }) => ({ id, title, body, at })) });
      lastPlan = key; N.planned = list.map(n => ({ id: n.id, at: n.at, kind: n.kind })); N.plannedAt = Date.now(); save();
      bus.emit('notify:planned', { list });
    } catch {}
    return list;
  }
  const schedule = () => { if (!native.ok()) return; clearTimeout(timer); timer = setTimeout(() => plan(), 800); };
  async function refreshStatus() {
    if (!native.ok()) return null;
    try { N.status = (await native.call('status'))?.status || null; save(); } catch {}
    return N.status;
  }
  async function request() {
    if (!native.ok()) return false;
    N.asked = true; save();
    try { const r = await native.call('request'); N.status = r?.status || (r?.granted ? 'authorized' : 'denied'); } catch { N.status = 'denied'; }
    save();
    renderRow();
    await plan(true);
    return allowed();
  }

  const row = document.createElement('div');
  row.className = 'opt';
  row.id = 'nt-row';
  row.innerHTML = '<div>Reminders<small id="nt-status"></small></div><button class="nt-toggle" id="nt-toggle" aria-label="Reminders"></button>';
  api.$('#settings .opts')?.appendChild(row);
  const statusEl = row.querySelector('#nt-status'), toggle = row.querySelector('#nt-toggle');
  function renderRow() {
    toggle.classList.toggle('on', N.enabled && N.status !== 'denied');
    toggle.disabled = !native.ok();
    statusEl.textContent = !native.ok() ? 'Available in the iOS app'
      : N.status === 'denied' ? 'Turned off in iOS Settings → Notifications'
      : !N.enabled ? 'Off'
      : N.status === 'notDetermined' || !N.status ? 'Streak, Daily and event reminders · at most one a day'
      : 'On · streak, Daily, league and event reminders, at most one a day';
  }
  toggle.onclick = async () => {
    api.haptic('LIGHT');
    if (N.status === 'denied') { renderRow(); return; }
    N.enabled = !N.enabled; save();
    renderRow();
    if (N.enabled && (N.status === 'notDetermined' || !N.status)) await request(); else await plan(true);
    renderRow();
  };
  renderRow();

  bus.on('app:ready', async () => { await refreshStatus(); renderRow(); if (native.ok()) native.call('clearDelivered').catch(() => {}); schedule(); });
  bus.on('streak:claim', () => { if (!N.asked && (N.status === 'notDetermined' || !N.status)) setTimeout(request, 1200); else schedule(); });
  bus.on('screen', ({ id }) => { if (id === 'menu') schedule(); if (id === 'settings') { renderRow(); refreshStatus().then(renderRow); } });
  bus.on('run:submitted', schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden) plan(); else if (native.ok()) native.call('clearDelivered').catch(() => {}); });

  api.notify = { planFor, plan, request, refreshStatus, stateFor, allowed, available: native.ok, get state() { return N; } };
}
