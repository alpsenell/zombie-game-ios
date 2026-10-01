export const id = 'ghost';
export const BOARD_OF = { daily: 'daily', ranked: 'weekly', normal: 'alltime', extract: 'extract', blitz: 'blitz' };
export const PACE_TYPES = ['daily'];
export const waveWeight = w => (4 + w * 2 + w * w * .12) * (1 + .08 * Math.max(0, w - 5)) + (w % 5 === 0 ? 14 + 6 * (w / 5) : 0);
export function paceShare(wave, maxWave = 10) {
  let sum = 0, upto = 0;
  for (let w = 1; w <= maxWave; w++) { const k = waveWeight(w); sum += k; if (w <= wave) upto += k; }
  return sum ? Math.min(1, upto / sum) : 0;
}
export const clockText = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const signed = (n, unit = '') => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n)).toLocaleString() + unit;

const CSS = `
.cm-ghost{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:4px 10px;border-radius:9px;background:#050b0e99;border:1px solid #b48cff55;white-space:nowrap;font:800 9.5px var(--ui);letter-spacing:1.2px;color:#d8c8ff}
.cm-ghost b{font:900 12px var(--display);letter-spacing:.6px;color:#fff}
.cm-ghost.ahead b{color:var(--green)}.cm-ghost.behind b{color:var(--red)}
.cm-ghost.hidden{display:none}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n || 0).toLocaleString();
  profile.ghost ||= {};
  const line = el('div', 'cm-ghost hidden'), icon = el('span', '', '👻'), text = el('span'), val = el('b');
  line.append(icon, text, val);
  ($('#hud-extras') || $('#hud'))?.appendChild(line);

  let cur = null, top = null, marks = [], lastMark = null;
  const ghostKey = type => (type === 'daily' ? 'daily' : type);
  const myGhost = () => {
    if (!cur) return null;
    const g = profile.ghost[ghostKey(cur.type)];
    if (!g || (cur.type === 'daily' && g.seed !== cur.seed)) return null;
    return g;
  };
  async function loadTop(type) {
    const board = BOARD_OF[type];
    if (!PACE_TYPES.includes(type) || !board || !api.gameCenter.available() || !api.competitive?.boardId) return null;
    try {
      if (!api.gameCenter.player && !(await api.gameCenter.signIn())) return null;
      const r = await api.gameCenter.call('loadScores', { leaderboardId: api.competitive.boardId(board), count: 1 });
      const e = (r.entries || [])[0];
      return e && !e.isLocal && e.score > 0 ? { name: e.name || 'SURVIVOR', score: e.score, rank: e.rank || 1 } : null;
    } catch { return null; }
  }
  function render() {
    if (!cur || !['playing', 'perk', 'paused'].includes(api.state.mode)) { line.classList.add('hidden'); return; }
    const st = api.state, g = myGhost(), wave = st.wave, maxWave = st.maxWave || 10;
    line.classList.remove('ahead', 'behind');
    if (lastMark && lastMark.wave === wave && top && PACE_TYPES.includes(cur.type)) {
      const pace = Math.round(top.score * paceShare(wave, maxWave)), d = lastMark.score - pace;
      text.textContent = '#1 PACE · W' + wave + ' · ' + fmt(pace) + ' · YOU';
      val.textContent = signed(d);
      line.classList.add(d >= 0 ? 'ahead' : 'behind');
    } else if (lastMark && lastMark.wave === wave && g?.marks?.find(m => m.wave === wave)) {
      const m = g.marks.find(x => x.wave === wave), dt = lastMark.t - m.t;
      text.textContent = 'YOUR BEST · W' + wave + ' · ' + clockText(m.t) + ' · YOU ' + clockText(lastMark.t);
      val.textContent = signed(-dt, 'S');
      line.classList.add(dt <= 0 ? 'ahead' : 'behind');
    } else if (top && PACE_TYPES.includes(cur.type) && wave + 1 <= maxWave) {
      const next = wave + 1, pace = Math.round(top.score * paceShare(next, maxWave));
      text.textContent = '#1 ' + top.name + ' · PACE BY W' + next;
      val.textContent = fmt(pace);
    } else if (g?.marks?.length) {
      const m = g.marks.find(x => x.wave === wave + 1) || g.marks[g.marks.length - 1];
      if (!m) { line.classList.add('hidden'); return; }
      const left = m.t - st.clock;
      text.textContent = 'YOUR BEST · W' + m.wave + ' BY ' + clockText(m.t) + (left >= 0 ? ' · ' + clockText(left) + ' LEFT' : ' · LATE');
      val.textContent = fmt(m.score);
      line.classList.add(left >= 0 ? 'ahead' : 'behind');
    } else { line.classList.add('hidden'); return; }
    line.classList.remove('hidden');
  }
  setInterval(render, 1000);

  bus.on('run:start', async e => {
    const type = e.type || 'normal';
    cur = BOARD_OF[type] && !api.state.net && type !== 'tutorial' ? { type, seed: e.seed ?? null, board: BOARD_OF[type] } : null;
    marks = []; lastMark = null; top = null;
    render();
    if (!cur) return;
    const t = await loadTop(type);
    if (cur && cur.type === type) { top = t; render(); if (t) bus.emit('ghost:top', { board: cur.board, ...t }); }
  });
  bus.on('wave:clear', ({ wave }) => {
    if (!cur) return;
    lastMark = { wave, t: Math.round(api.state.clock * 10) / 10, score: api.state.score };
    marks.push(lastMark);
    render();
    const g = myGhost(), m = g?.marks?.find(x => x.wave === wave), pace = top && PACE_TYPES.includes(cur.type) ? Math.round(top.score * paceShare(wave, api.state.maxWave || 10)) : null;
    bus.emit('ghost:mark', { wave, t: lastMark.t, score: lastMark.score, bestT: m?.t ?? null, pace });
  });
  bus.on('run:end', run => {
    if (!cur || !marks.length || !run.score) { cur = null; render(); return; }
    const key = ghostKey(cur.type), prev = profile.ghost[key], better = !prev || (cur.type === 'daily' && prev.seed !== cur.seed) || run.score > prev.score;
    if (better) { profile.ghost[key] = { score: run.score, wave: run.wave, seed: cur.seed, date: Date.now(), marks: marks.slice(0, 60) }; api.saveProfile(); bus.emit('ghost:saved', { type: cur.type, score: run.score, marks: marks.length }); }
    cur = null; render();
  });
  bus.on('screen', ({ id }) => { if (id === 'menu') { cur = null; render(); } });

  api.ghost = { paceShare, waveWeight, BOARD_OF, PACE_TYPES, render, state: () => ({ cur, top, marks: [...marks], last: lastMark }), ghosts: () => profile.ghost, text: () => (line.classList.contains('hidden') ? '' : line.textContent) };
}
