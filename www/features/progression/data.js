import { mulberry32, hashSeed } from '../../core.js';
import { EVENTS, eventAt } from '../events.js';

export const DAY = 86400000;
export const dayNum = (t = Date.now()) => Math.floor(t / DAY);
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export function weekKey(t = Date.now()) {
  const d = new Date(dayNum(t) * DAY), wd = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wd);
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}
export function resetAt(period, t = Date.now()) {
  const d = dayNum(t);
  return (period !== 'daily' ? d + 7 - (d + 3) % 7 : d + 1) * DAY;
}
export function timeLeft(ms) {
  const h = Math.floor(ms / 3600000), m = Math.max(1, Math.ceil(ms % 3600000 / 60000));
  return h >= 48 ? Math.floor(h / 24) + 'D ' + h % 24 + 'H' : h ? h + 'H ' + m + 'M' : m + 'M';
}

export const DIFF_RANK = { recruit: 0, survivor: 1, veteran: 2, nightmare: 3 };
const DIFF_NAME = { survivor: 'SURVIVOR', veteran: 'VETERAN', nightmare: 'NIGHTMARE' };
const n0 = v => v.toLocaleString('en-US');

const add = test => (e, m) => m.p + (test(e, m) ? 1 : 0);
export const TEMPLATES = [
  { id: 'kills', ev: 'kill', daily: [60, 100, 150], weekly: [500, 800, 1200], w: 1, fn: add(() => true), text: n => n0(n) + ' KILLS' },
  { id: 'heads', ev: 'kill', daily: [15, 30, 50], weekly: [150, 250, 400], w: 1.2, fn: add(e => e.head), text: n => n0(n) + ' HEADSHOTS' },
  { id: 'weapon', ev: 'kill', daily: [20, 35, 50], weekly: [150, 250, 350], w: 1.1, fn: add((e, m) => e.weapon === m.arg), arg: (c, r) => c.owned[(r() * c.owned.length) | 0].id, text: (n, a, c) => n0(n) + ' KILLS WITH THE ' + (c.weaponName(a) || a) },
  { id: 'wave', ev: 'wave:start', daily: [6, 10, 14], weekly: [12, 16, 22], w: 1.3, drop: { daily: 2, weekly: 3 },
    fn: (e, m, run) => (DIFF_RANK[run.difficultyId] ?? 1) >= DIFF_RANK[m.arg] ? Math.max(m.p, e.wave) : m.p,
    arg: (c, r) => { const opts = ['survivor', 'veteran', 'nightmare'].slice(0, c.tier + 1); return opts[(r() * opts.length) | 0]; },
    text: (n, a) => 'REACH WAVE ' + n + ' ON ' + DIFF_NAME[a] },
  { id: 'boss', ev: 'kill', daily: [1, 1, 2], weekly: [3, 5, 8], w: 1.4, fn: add(e => e.boss), avail: c => c.bestWave >= 4, text: n => n === 1 ? 'KILL A BOSS' : 'KILL ' + n + ' BOSSES' },
  { id: 'burn', ev: 'kill', daily: [10, 20, 30], weekly: [80, 150, 250], w: 1.2, fn: add(e => e.burning), avail: c => c.owned.some(w => w.burn), text: n => n0(n) + ' BURNING KILLS' },
  { id: 'elite', ev: 'kill', daily: [3, 6, 10], weekly: [20, 35, 50], w: 1.3, fn: add(e => e.elite), avail: c => c.tier >= 1, text: n => 'KILL ' + n + ' ELITES' },
  { id: 'combo', ev: 'kill', daily: [8, 12, 16], w: 1.2, fn: (e, m) => Math.max(m.p, e.combo || 0), text: n => 'KILL STREAK OF ' + n },
  { id: 'accuracy', ev: 'run:end', daily: [50, 55, 60], w: 1.2, fn: (e, m) => e.wave - (e.startWave || 1) >= 2 ? Math.max(m.p, Math.floor(e.accuracy * 100)) : m.p, unit: '%', text: n => 'FINISH A RUN WITH ' + n + '% ACCURACY' },
  { id: 'perks', ev: 'perk', daily: [3, 5, 8], w: 1, fn: add(() => true), text: n => 'PICK ' + n + ' PERKS' },
  { id: 'daily', ev: 'run:end', daily: [1, 1, 1], w: 1.1, fn: add(e => e.type === 'daily'), avail: c => c.hasDaily, text: () => 'PLAY THE DAILY CHALLENGE' },
  { id: 'runs', ev: 'run:end', weekly: [5, 8, 10], w: 1, fn: add(e => e.kills > 0), text: n => 'PLAY ' + n + ' RUNS' },
  { id: 'clears', ev: 'wave:clear', weekly: [40, 60, 90], w: 1.1, fn: add(() => true), text: n => 'CLEAR ' + n + ' WAVES' },
  { id: 'missions', ev: 'mission:complete', weekly: [6, 9, 12], w: 1, fn: add(e => e.period === 'daily'), text: n => 'COMPLETE ' + n + ' DAILY MISSIONS' },
  { id: 'smap', ev: 'wave:start', season: [10, 13, 16], w: 1, fn: (e, m, run) => (run.map === m.arg ? Math.max(m.p, e.wave) : m.p), arg: (c, r) => { const maps = c.maps?.length ? c.maps : [{ id: 'street' }]; return maps[(r() * maps.length) | 0].id; }, text: (n, a, c) => 'REACH WAVE ' + n + ' ON ' + (c.maps?.find(m => m.id === a)?.name || String(a).toUpperCase()) },
  { id: 'sboss', ev: 'kill', season: [2, 3, 4], w: 1, fn: add((e, m) => e.boss && e.weapon === m.arg), arg: (c, r) => c.owned[(r() * c.owned.length) | 0].id, avail: c => c.bestWave >= 4, text: (n, a, c) => 'KILL ' + n + ' BOSSES WITH THE ' + (c.weaponName(a) || a) },
  { id: 'sdaily', ev: 'run:end', season: [1, 2, 3], w: 1, fn: add(e => e.type === 'daily' && e.cleared), avail: c => c.hasDaily, text: n => 'CLEAR ' + n + ' DAILY CHALLENGE' + (n > 1 ? 'S' : '') },
  { id: 'sextract', ev: 'run:end', season: [10, 20, 20], w: 1, fn: (e, m) => (e.type === 'extract' && e.extracted >= m.n ? m.n : m.p), text: n => 'EXTRACT AT WAVE ' + n + ' OR LATER' },
  { id: 'sranked', ev: 'run:end', season: [2, 3, 4], w: 1, fn: add(e => e.type === 'ranked' && e.kills > 0), avail: c => c.hasDaily, text: n => 'PLAY ' + n + ' RANKED RUNS' },
  { id: 'sheads', ev: 'kill', season: [150, 250, 400], w: 1, fn: add(e => e.head), text: n => n0(n) + ' HEADSHOTS THIS WEEK' },
  { id: 'selite', ev: 'kill', season: [15, 25, 40], w: 1, fn: add(e => e.elite), avail: c => c.tier >= 1, text: n => 'KILL ' + n + ' ELITES THIS WEEK' },
  { id: 'swaves', ev: 'wave:clear', season: [60, 90, 120], w: 1, fn: add(() => true), text: n => 'CLEAR ' + n + ' WAVES THIS WEEK' },
  { id: 'coopruns', ev: 'run:end', weekly: [2, 3, 4], w: 1.2, fn: add(e => e.type === 'coop' && e.kills > 0), avail: c => c.hasCoop, text: n => 'PLAY ' + n + ' CO-OP RUNS' },
  { id: 'coopwave', ev: 'wave:clear', weekly: [8, 10, 12], w: 1.3, fn: (e, m, run) => (run.type === 'coop' && (run.squad || 0) >= 2 ? Math.max(m.p, e.wave) : m.p), avail: c => c.hasCoop, text: n => 'CLEAR WAVE ' + n + ' IN CO-OP' },
  { id: 'revives', ev: 'coop:revive', weekly: [3, 5, 8], w: 1.3, fn: add(e => e.byMe), avail: c => c.hasCoop, text: n => 'REVIVE ' + n + ' TEAMMATES' },
  { id: 'event', ev: 'wave:clear', daily: [6, 9, 12], w: 1.3, extra: true, fn: (e, m, run) => (run.event ? Math.max(m.p, e.wave) : m.p), arg: c => c.event, text: (n, a) => 'CLEAR WAVE ' + n + ' IN A ' + (EVENTS.find(e => e.id === a)?.name || 'WEEKEND EVENT') + ' RUN' },
];
export const eventDay = key => { const ev = eventAt(Date.parse(key + 'T12:00:00Z')); return ev.live ? ev.id : null; };
export const SEASON_CHALLENGE = { scrap: 300, xp: 1000, seasonXp: 1500 };
export const template = id => TEMPLATES.find(t => t.id === id);

const round = (v, s) => Math.round(v / s) * s;
function build(t, period, key, slot, ctx, rnd, rr = 0) {
  const arg = t.arg ? t.arg(ctx, rnd) : null;
  let n = t[period][ctx.tier];
  if (t.drop && arg) n -= (DIFF_RANK[arg] - 1) * t.drop[period];
  const k = t.w * (1 + ctx.tier * .25);
  const base = { id: period + ':' + key + ':' + slot + (rr ? ':r' + rr : ''), t: t.id, n, arg, p: 0, done: false, claimed: false };
  if (period === 'season') return { ...base, ...SEASON_CHALLENGE };
  return { ...base, scrap: period === 'daily' ? round(100 * k, 5) : round(600 * k, 10), xp: period === 'daily' ? round(400 * k, 50) : round(2500 * k, 50) };
}
function pool(period, ctx, exclude = []) {
  return TEMPLATES.filter(t => t[period] && !t.extra && (!t.avail || t.avail(ctx)) && !exclude.includes(t.id));
}
export function generate(period, key, ctx, count = 3) {
  const rnd = mulberry32(hashSeed(period + ':' + key)), list = pool(period, ctx), out = [];
  while (out.length < count && list.length) out.push(build(list.splice((rnd() * list.length) | 0, 1)[0], period, key, out.length, ctx, rnd));
  const event = period === 'daily' ? eventDay(key) : null;
  if (event) out.push(build(template('event'), period, key, out.length, { ...ctx, event }, rnd));
  return out;
}
export function reroll(period, key, list, slot, ctx, count) {
  const rnd = mulberry32(hashSeed('reroll:' + period + ':' + key + ':' + slot + ':' + count));
  const options = pool(period, ctx, list.map(m => m.t));
  if (!options.length) return null;
  return build(options[(rnd() * options.length) | 0], period, key, slot, ctx, rnd, count);
}
export function missionText(m, ctx) { return template(m.t).text(m.n, m.arg, ctx); }

export const MASTERY_MAX = 10;
export const masteryNeed = level => Math.round(120 * level ** 1.55 / 10) * 10;
export function masteryInfo(xp = 0) {
  let level = 1, rest = xp;
  while (level < MASTERY_MAX && rest >= masteryNeed(level)) { rest -= masteryNeed(level); level++; }
  const max = level >= MASTERY_MAX;
  return { level, into: max ? 0 : rest, need: max ? 0 : masteryNeed(level), max, pct: max ? 1 : rest / masteryNeed(level) };
}
export const masteryXP = e => 10 + (e.head ? 10 : 0) + (e.elite ? 15 : 0) + (e.boss ? 240 : 0);
export const PRESTIGE_MAX = 5, PRESTIGE_REWARD = 1500;
export const prestigeMark = n => n ? '✦'.repeat(n) : '';
export const masteryReward = level => level >= MASTERY_MAX ? 1000 : level * 50;

export const STREAK_DAYS = [50, 75, 100, 125, 150, 200, 400];
export const STREAK_MILESTONES = { 14: 750, 30: 2000, 60: 3000, 100: 5000 };
export function streakReward(count) {
  const base = STREAK_DAYS[(count - 1) % 7], bonus = STREAK_MILESTONES[count] || 0;
  return { base, bonus, total: base + bonus };
}
export const SHIELD_EVERY = 7, SHIELD_MAX = 2, REPAIR_MS = DAY;
export const repairCost = count => Math.min(2000, 100 + count * 25);
export const nextShieldDay = count => (Math.floor(count / SHIELD_EVERY) + 1) * SHIELD_EVERY;
export function streakVisit(s, today, now = today * DAY) {
  if (s.last === today || (s.last != null && s.last > today)) return false;
  const prev = s.count || 0, missed = s.last == null || !prev ? 0 : today - s.last - 1;
  s.shields = s.shields || 0;
  s.shielded = 0; s.shieldEarned = 0; s.broken = 0;
  if (s.last == null || !prev) s.count = 1;
  else if (!missed) s.count = prev + 1;
  else if (missed <= s.shields) { s.shields -= missed; s.shielded = missed; s.count = prev + 1; }
  else { s.broken = prev; s.count = 1; s.repair = { was: prev, day: today, until: now + REPAIR_MS, cost: repairCost(prev) }; }
  if (s.count > 1 && s.count % SHIELD_EVERY === 0 && s.shields < SHIELD_MAX) { s.shields++; s.shieldEarned = today; }
  s.last = today;
  s.best = Math.max(s.best || 0, s.count);
  return true;
}
export const repairOffer = (s, now = Date.now()) => (s.repair && now <= s.repair.until && dayNum(now) >= s.repair.day ? { ...s.repair, count: s.repair.was + (dayNum(now) - s.repair.day) + 1 } : null);
export function repairStreak(s, now = Date.now()) {
  const r = repairOffer(s, now);
  if (!r) return 0;
  s.count = r.count;
  s.best = Math.max(s.best || 0, s.count);
  s.broken = 0; s.repair = null;
  if (s.count % SHIELD_EVERY === 0 && (s.shields || 0) < SHIELD_MAX) { s.shields = (s.shields || 0) + 1; s.shieldEarned = dayNum(now); }
  return s.count;
}
export function nextMilestone(count) {
  const d = Object.keys(STREAK_MILESTONES).map(Number).find(x => x > count);
  return d ? { day: d, bonus: STREAK_MILESTONES[d] } : null;
}

export const ACH_PREFIX = 'deadzone.ach.';
const bossAch = (slug, title, kind, name) => ({ slug, title, desc: 'DEFEAT ' + name, points: 30, prog: s => [Math.min(1, s.bosses[kind] || 0), 1] });
export const ACHIEVEMENTS = [
  { slug: 'first_blood', title: 'FIRST BLOOD', desc: 'KILL YOUR FIRST INFECTED', points: 10, prog: s => [s.kills, 1] },
  { slug: 'kills_100', title: 'CENTURION', desc: 'KILL 100 INFECTED', points: 15, prog: s => [s.kills, 100] },
  { slug: 'kills_1000', title: 'HORDE BREAKER', desc: 'KILL 1,000 INFECTED', points: 40, prog: s => [s.kills, 1000] },
  { slug: 'kills_10000', title: 'EXTINCTION EVENT', desc: 'KILL 10,000 INFECTED', points: 90, prog: s => [s.kills, 10000] },
  { slug: 'heads_100', title: 'HEADHUNTER', desc: 'LAND 100 HEADSHOT KILLS', points: 20, prog: s => [s.heads, 100] },
  { slug: 'heads_1000', title: 'DEADEYE', desc: 'LAND 1,000 HEADSHOT KILLS', points: 60, prog: s => [s.heads, 1000] },
  { slug: 'wave_10', title: 'HOLD THE LINE', desc: 'REACH WAVE 10', points: 20, prog: s => [s.bestWave, 10] },
  { slug: 'wave_20', title: 'BREAKING POINT', desc: 'REACH WAVE 20', points: 40, prog: s => [s.bestWave, 20] },
  { slug: 'wave_30', title: 'UNBREAKABLE', desc: 'REACH WAVE 30', points: 60, prog: s => [s.bestWave, 30] },
  { slug: 'wave_50', title: 'HORDE LEGEND', desc: 'REACH WAVE 50', points: 100, prog: s => [s.bestWave, 50] },
  bossAch('boss_abomination', 'ABOMINATION SLAIN', 'abomination', 'THE ABOMINATION'),
  bossAch('boss_butcher', 'BUTCHERED', 'butcher', 'THE BUTCHER'),
  bossAch('boss_plague', 'REGICIDE', 'plague', 'THE PLAGUE KING'),
  bossAch('boss_goliath', 'GIANT KILLER', 'goliath', 'GOLIATH'),
  { slug: 'nightmare_10', title: 'NIGHTMARE SURVIVOR', desc: 'CLEAR WAVE 10 ON NIGHTMARE', points: 80, prog: s => [s.nightmare, 10] },
  { slug: 'arsenal_5', title: 'ARMS DEALER', desc: 'OWN 5 WEAPONS', points: 20, prog: s => [s.owned, 5] },
  { slug: 'arsenal_scrap', title: 'FULL ARSENAL', desc: 'OWN EVERY SCRAP WEAPON', points: 50, prog: s => [s.scrapOwned, s.scrapTotal] },
  { slug: 'mastery_max', title: 'WEAPON MASTER', desc: 'MAX OUT A WEAPON MASTERY', points: 50, prog: s => [s.maxMastery, MASTERY_MAX] },
  { slug: 'streak_7', title: 'DEDICATED', desc: 'PLAY 7 DAYS IN A ROW', points: 20, prog: s => [s.streak, 7] },
  { slug: 'streak_30', title: 'NEVER MISS A SHIFT', desc: 'PLAY 30 DAYS IN A ROW', points: 50, prog: s => [s.streak, 30] },
  { slug: 'missions_25', title: 'ON DUTY', desc: 'COMPLETE 25 MISSIONS', points: 30, prog: s => [s.missions, 25] },
  { slug: 'combo_25', title: 'CHAIN REACTION', desc: 'HIT A 25 KILL STREAK', points: 30, prog: s => [s.combo, 25] },
  { slug: 'burn_250', title: 'SCORCHED EARTH', desc: '250 BURNING KILLS', points: 30, prog: s => [s.burning, 250] },
  { slug: 'elites_50', title: 'ELITE HUNTER', desc: 'KILL 50 ELITES', points: 30, prog: s => [s.elites, 50] },
  { slug: 'sharpshooter', title: 'SHARPSHOOTER', desc: 'FINISH A WAVE 5+ RUN WITH 70% ACCURACY', points: 30, prog: s => [s.accuracy, 70] },
];
export function achPercent(a, s) {
  const [cur, need] = a.prog(s);
  return Math.max(0, Math.min(100, Math.floor(cur / need * 100)));
}
