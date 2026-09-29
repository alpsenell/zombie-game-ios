export const id = 'comeback';

const DAY = 864e5;
export const AWAY_DAYS = 7, BOOST_RUNS = 3;
export const crate = days => ({ scrap: 1000 + Math.min(4, Math.floor((days - AWAY_DAYS) / 7)) * 250, xp: 2000 });
export const dayNum = (t = Date.now()) => Math.floor(t / DAY);

export function visit(c, today) {
  const away = c.last != null ? today - c.last : 0;
  c.last = today;
  if (away < AWAY_DAYS) return null;
  c.boost = BOOST_RUNS;
  c.count = (c.count || 0) + 1;
  return { days: away, ...crate(away) };
}

const CSS = `
.cb-sheet{position:fixed;inset:0;z-index:36;display:grid;place-items:center;background:#010406c0;padding:16px}
.cb-card{width:min(340px,92vw);padding:20px 18px 16px;border-radius:18px;background:#081115f8;border:1px solid #6dffa077;box-shadow:0 20px 60px #000;text-align:center;display:grid;gap:8px;justify-items:center}
.cb-card small{font:900 10px var(--ui);letter-spacing:2px;color:var(--green)}
.cb-card h3{margin:0;font:900 30px/1 var(--display);letter-spacing:1.5px}
.cb-card .cb-box{font-size:44px;line-height:1;animation:cb-bob 1.4s ease-in-out infinite}
@keyframes cb-bob{50%{transform:translateY(-6px) rotate(-4deg)}}
.cb-card p{margin:0;font:800 11px/1.5 var(--ui);letter-spacing:1.1px}
.cb-card p b{color:var(--amber)}
.cb-card .cta{margin-top:6px;padding:12px 30px}
.cb-over{display:inline-block;margin:0 4px 12px;padding:6px 11px;border-radius:20px;background:#6dffa018;border:1px solid #6dffa055;color:var(--green);font:900 11px var(--ui);letter-spacing:1.2px}
`;

export function init(api) {
  const { bus, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const C = () => (profile.comeback ||= { last: null, boost: 0, count: 0 });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function show(gift) {
    api.queueModal(done => {
      const sheet = el('div', 'cb-sheet'), card = el('div', 'cb-card'), ok = el('button', 'cta', 'OPEN CRATE');
      const p1 = el('p'), p2 = el('p');
      p1.append('+', el('b', '', gift.scrap.toLocaleString() + ' 🔩'), '  +', el('b', '', gift.xp.toLocaleString() + ' XP'));
      p2.textContent = 'DOUBLE SEASON XP FOR YOUR NEXT ' + BOOST_RUNS + ' RUNS';
      card.append(el('small', '', 'AWAY FOR ' + gift.days + ' DAYS'), el('div', 'cb-box', '🎁'), el('h3', '', 'WELCOME BACK'), p1, p2, ok);
      sheet.appendChild(card);
      document.body.appendChild(sheet);
      ok.onclick = () => {
        api.grantScrap(gift.scrap);
        api.grantXP(gift.xp);
        api.sfx.pickup?.(); api.haptic('HEAVY');
        sheet.remove();
        done();
      };
    }, 3);
  }
  function check() {
    const gift = visit(C(), dayNum());
    api.saveProfile();
    if (gift) { show(gift); bus.emit('comeback', gift); }
    return gift;
  }

  let boosted = false;
  bus.on('run:start', () => {
    const c = C();
    boosted = c.boost > 0;
    if (boosted) { c.boost--; api.saveProfile(); }
    api.live.comebackXp = boosted ? 2 : 1;
  });
  const chip = el('span', 'cb-over hidden');
  api.$('#over-extras')?.appendChild(chip);
  bus.on('run:end', () => {
    chip.textContent = '🎁 COMEBACK BOOST · x2 SEASON XP' + (C().boost ? ' · ' + C().boost + ' RUNS LEFT' : '');
    chip.classList.toggle('hidden', !boosted);
  });
  bus.on('app:ready', check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });

  api.comeback = { check, visit, crate, get state() { return C(); } };
}
