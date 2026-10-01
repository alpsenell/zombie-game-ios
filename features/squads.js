export const id = 'squads';
export const BONDS = [3, 10, 25];
export const BOARD = 'deadzone.daily.squad';
export const squadKey = mates => mates.map(m => (/^G:/.test(m.id || '') ? m.id : 'N:' + String(m.name || '').toUpperCase())).sort().join('|');
export function trackSquad(profile, mates, run = {}) {
  if (!mates?.length) return null;
  const key = squadKey(mates), squads = (profile.squads ||= {});
  const s = (squads[key] ||= { runs: 0, names: [], best: 0, last: 0 });
  s.runs++;
  s.names = mates.map(m => String(m.name || '').toUpperCase()).slice(0, 3);
  s.best = Math.max(s.best, run.wave || 0);
  s.last = Date.now();
  profile.squadBest = Math.max(profile.squadBest || 0, s.runs);
  const tier = BONDS.indexOf(s.runs);
  return { key, squad: s, tier: tier >= 0 ? tier + 1 : 0 };
}
export const nextBond = runs => BONDS.find(b => b > runs) || null;

const CSS = `
.sq-banner{margin:8px auto 4px;padding:8px 14px;border-radius:12px;border:1px solid #6fe3ff55;background:#0b161b;font:800 10px var(--ui);letter-spacing:1.4px;color:#bff6ff;text-align:center;max-width:min(92vw,520px)}
.sq-banner b{color:#fff}
.sq-banner.bond{border-color:#ffc34d;color:#ffe08a;box-shadow:0 0 18px #ffc34d33}
#over-quick{display:inline-flex;flex-direction:column;align-items:center;gap:2px;line-height:1.1}
#over-quick small{font:700 8px var(--ui);letter-spacing:1.2px;color:#6fe3ff}
#over-quick.hidden{display:none}
`;

export function init(api) {
  const { $, bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n || 0).toLocaleString();
  profile.squads ||= {}; profile.squadBest ||= 0;
  const titleIndex = n => api.SLOTS.find(s => s.id === 'title').items.findIndex(it => it.req === 'squad:' + n);
  api.reqs.squad = { met: n => (profile.squadBest || 0) >= +n, text: n => 'PLAY ' + n + ' CO-OP RUNS WITH THE SAME SQUAD' };

  const banner = el('div', 'sq-banner hidden');
  banner.id = 'sq-banner';
  $('#over-extras')?.appendChild(banner);
  const quick = el('button', 'ghost');
  quick.id = 'over-quick';
  quick.append(el('span', '', '👥 FIND A SQUAD'), el('small', '', 'CO-OP QUICK MATCH'));
  quick.onclick = () => { api.sfx.init?.(); api.coop?.quick?.(); };
  $('#again')?.after(quick);

  const mates = () => (api.coop?.squad?.() || []).filter(p => !p.me);
  function bannerFor(run) {
    if (run?.type !== 'coop') return null;
    const m = mates();
    if (!m.length) return null;
    const s = profile.squads[squadKey(m)], runs = s?.runs || 0, next = nextBond(runs);
    return { names: m.map(p => String(p.name).toUpperCase()), runs, next, text: 'SQUAD · ' + m.map(p => String(p.name).toUpperCase()).join(' + ') + ' · ' + runs + ' RUN' + (runs === 1 ? '' : 'S') + ' TOGETHER' + (next ? ' · NEXT BOND AT ' + next : ' · EVERY BOND EARNED') };
  }
  let lastBond = null;
  function track(run) {
    const r = trackSquad(profile, mates(), run);
    if (!r) return null;
    lastBond = r.tier ? r : null;
    if (r.tier) {
      const i = titleIndex(BONDS[r.tier - 1]);
      if (i > 0 && !profile.fresh.includes('title:' + i)) profile.fresh.push('title:' + i);
      const title = api.TITLES[i] || 'SQUAD TITLE';
      api.message('SQUAD BOND', r.squad.runs + ' RUNS TOGETHER · ' + title + ' TITLE UNLOCKED', 2.8);
      api.haptic('HEAVY');
      bus.emit('squad:bond', { key: r.key, runs: r.squad.runs, tier: r.tier, names: r.squad.names, title });
    }
    api.saveProfile();
    return r;
  }

  async function submitSquadDaily(run) {
    const date = api.state.runOpts?.squadDaily;
    if (!date || !run.score || !api.gameCenter.available()) return null;
    const rankEl = $('#over-rank');
    if (rankEl) rankEl.textContent = 'SUBMITTING TO THE SQUAD DAILY BOARD…';
    try {
      if (!api.gameCenter.player && !(await api.gameCenter.signIn())) { if (rankEl) rankEl.textContent = 'SIGN IN TO GAME CENTER TO RANK YOUR SQUAD'; return null; }
      await api.gameCenter.call('submitScore', { leaderboardId: BOARD, score: run.score, context: api.encodeLoadout({ ...profile.loadout, primary: api.player.slots[0] }, api.levelInfo().level) });
      const r = await api.gameCenter.rank(BOARD);
      if (rankEl) rankEl.textContent = r ? 'SQUAD DAILY RANK #' + fmt(r.rank) : 'SQUAD DAILY SCORE SUBMITTED';
      bus.emit('run:submitted', { type: 'coop', board: BOARD, result: r });
      return r;
    } catch { if (rankEl) rankEl.textContent = 'SQUAD DAILY SCORE NOT SUBMITTED'; return null; }
  }

  bus.on('run:end', run => {
    const coop = run.type === 'coop';
    quick.classList.toggle('hidden', coop || run.type === 'tutorial' || !api.coop);
    if (!coop) { banner.classList.add('hidden'); return; }
    track(run);
    const b = bannerFor(run);
    banner.classList.toggle('hidden', !b);
    banner.classList.toggle('bond', !!lastBond);
    if (b) { banner.replaceChildren(); const strong = el('b', '', b.names.join(' + ')); banner.append('SQUAD · ', strong, ' · ' + b.runs + ' RUN' + (b.runs === 1 ? '' : 'S') + ' TOGETHER' + (lastBond ? ' · BOND ' + lastBond.tier + ' EARNED' : b.next ? ' · NEXT BOND AT ' + b.next : ' · EVERY BOND EARNED')); }
    if (api.state.runOpts?.squadDaily) {
      setTimeout(() => { const h = $('#over h2'); if (h) h.textContent = run.cleared ? 'SQUAD DAILY COMPLETE' : 'SQUAD WIPED · SQUAD DAILY'; }, 0);
      submitSquadDaily(run);
    }
  });

  api.squads = { BONDS, BOARD, key: squadKey, track, bannerFor, nextBond, best: () => profile.squadBest || 0, squads: () => profile.squads };
}
