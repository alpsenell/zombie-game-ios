export const id = 'friends';
export const BOARD_OF = { daily: 'daily', ranked: 'weekly', normal: 'alltime', extract: 'extract', blitz: 'blitz' };
export function passedFriends(entries, score, prevBest = 0) {
  const friends = (entries || []).filter(e => !e.isLocal && Number.isFinite(e.score));
  const passed = friends.filter(f => f.score < score && f.score >= prevBest).sort((a, b) => b.score - a.score);
  const ahead = friends.filter(f => f.score >= score).sort((a, b) => a.score - b.score);
  return { passed, next: ahead[0] || null, total: friends.length };
}

const CSS = `
.fr-line{margin:6px auto 2px;padding:7px 14px;border-radius:12px;border:1px solid #6fe3ff55;background:#0b161b;font:800 10px var(--ui);letter-spacing:1.4px;color:#bff6ff;text-align:center;max-width:min(92vw,520px)}
.fr-line b{color:#fff}
.fr-line.passed{border-color:var(--green);color:#c8ffd8;box-shadow:0 0 16px #6dff8a33}
.fr-line.hidden{display:none}
`;

export function init(api) {
  const { $, bus, profile, store } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n || 0).toLocaleString();
  const line = el('div', 'fr-line hidden');
  line.id = 'fr-line';
  $('#over-extras')?.prepend(line);

  const comp = () => profile.competitive || {};
  function bestOn(board) {
    if (board === 'alltime') return api.records.score || 0;
    if (board === 'daily') return comp().daily?.date === api.competitive?.dailyChallenge?.()?.date ? comp().daily.best || 0 : 0;
    if (board === 'weekly') return comp().weekly?.best || 0;
    if (board === 'blitz') return comp().blitz?.allTime || 0;
    if (board === 'extract') return Math.max(0, ...store.get('runs', []).filter(r => r.type === 'extract').map(r => r.score || 0));
    return 0;
  }
  let prevBest = 0, board = null, lastResult = null, token = 0;
  bus.on('run:start', e => {
    board = !api.state.net && e.type !== 'tutorial' ? BOARD_OF[e.type || 'normal'] || null : null;
    prevBest = board ? bestOn(board) : 0;
    lastResult = null;
    line.classList.add('hidden');
  });
  bus.on('run:submitted', async ({ type, board: boardId, result }) => {
    const t = ++token;
    if (!board || !boardId || !result || result.rejected || !api.gameCenter.available()) return;
    const score = api.state.score || 0;
    let r = null;
    try { r = await api.gameCenter.call('loadScores', { leaderboardId: boardId, count: 25, scope: 'friends' }); } catch { return; }
    if (t !== token || api.state.mode !== 'dead') return;
    const res = passedFriends(r?.entries, score, prevBest);
    store.set('friendsCount', res.total);
    lastResult = { board, ...res, score, prevBest };
    line.replaceChildren();
    line.classList.remove('hidden', 'passed');
    if (res.passed.length) {
      line.classList.add('passed');
      line.append('👥 YOU PASSED ', el('b', '', res.passed.length === 1 ? res.passed[0].name : res.passed.length + ' FRIENDS'), res.passed.length > 1 ? ' · ' + res.passed.map(f => f.name).slice(0, 3).join(', ') : '');
      if (res.next) line.append(' · NEXT ' + res.next.name + ' ' + fmt(res.next.score - score + 1) + ' AWAY');
      api.haptic('MEDIUM');
      bus.emit('friends:passed', { board, count: res.passed.length, names: res.passed.map(f => f.name), next: res.next?.name || null });
    } else if (res.next) {
      line.append('👥 NEXT FRIEND ', el('b', '', res.next.name), ' · ' + fmt(res.next.score - score + 1) + ' TO PASS');
    } else if (res.total) {
      line.append('👥 ', el('b', '', 'YOU LEAD YOUR FRIENDS'), ' · ' + res.total + ' ON THE BOARD');
    } else {
      line.append('👥 NO FRIENDS ON THIS BOARD YET · INVITE YOUR SQUAD');
    }
  });
  bus.on('screen', ({ id }) => { if (id !== 'over') line.classList.add('hidden'); });

  api.friends = { passedFriends, lastResult: () => lastResult, prevBest: () => prevBest, bestOn };
}
