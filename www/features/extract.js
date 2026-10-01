export const id = 'extract';
export const EXTRACT_EVERY = 10, MULTS = [1.25, 1.5, 1.75, 2], CRATE_PER_WAVE = 30;
export const pointIndex = wave => Math.floor(wave / EXTRACT_EVERY);
export const multAt = wave => MULTS[Math.min(MULTS.length, Math.max(1, pointIndex(wave))) - 1];
export const crateAt = wave => wave * CRATE_PER_WAVE;
export const nextPoint = wave => (pointIndex(wave) + 1) * EXTRACT_EVERY;
export const isPoint = wave => wave > 0 && wave % EXTRACT_EVERY === 0;

const CSS = `
#ex-open small{color:#6dffa0}
#ex-hud{display:inline-flex;gap:6px;align-items:center;margin-top:6px;padding:5px 9px;border-radius:9px;background:#081014aa;border:1px solid #6dffa044;font:900 9px var(--ui);letter-spacing:1.3px;color:#bff5d0;white-space:nowrap}
#ex-hud b{color:var(--green)}
#extract{background:radial-gradient(ellipse at center,#06301cb0 0,#010406ee 78%)}
#extract .ex{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(94vw,560px)}
#extract h2{margin:0;font:900 clamp(32px,7vw,48px)/1 var(--display);letter-spacing:3px;color:var(--green);text-shadow:0 4px 18px #000}
#extract .ex-sub{font:800 10px var(--ui);letter-spacing:1.8px;color:var(--dim)}
.ex-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.ex-choice button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 12px;border-radius:16px;text-align:center}
.ex-choice b{font:900 18px var(--display);letter-spacing:1.5px}
.ex-choice span{font:800 10px/1.4 var(--ui);letter-spacing:1.1px}
.ex-choice .cta.gold span{color:#1a1206}
.ex-choice .ghost{border-color:#ffffff33}
.ex-choice .ghost b{color:#fff}
.ex-choice .ghost span{color:var(--dim)}
#ex-sheet .panel{width:min(94vw,560px)}
#ex-sheet .ex-rules{margin:0 0 14px;color:var(--dim);font:600 11px/1.5 var(--ui);letter-spacing:.3px;text-align:left}
#ex-sheet .ex-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 12px}
#ex-sheet .ex-steps div{padding:8px 4px;border-radius:10px;background:#ffffff0a;border:1px solid var(--line)}
#ex-sheet .ex-steps b{display:block;font:900 16px var(--display);color:var(--green)}
#ex-sheet .ex-steps small{font:800 8px var(--ui);letter-spacing:1.2px;color:var(--dim)}
.ex-over{display:inline-block;margin:0 4px 12px;padding:6px 11px;border-radius:20px;background:#6dffa018;border:1px solid #6dffa055;color:var(--green);font:900 11px var(--ui);letter-spacing:1.2px}
@media (max-height:430px){#extract .ex{gap:7px}.ex-choice button{padding:11px 10px}#ex-sheet .ex-rules{margin-bottom:8px}}
@media (orientation:portrait){.ex-choice{grid-template-columns:1fr}}
`;

export function init(api) {
  const { bus, $ } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = n => Math.round(n).toLocaleString();
  const isExtract = () => api.state.runType === 'extract';

  const opts = () => ({ type: 'extract', difficulty: api.settings.difficulty, replay: opts });

  const btn = el('button', 'ghost cm-mode');
  btn.id = 'ex-open';
  btn.append(el('span', '', '🚁 EXTRACTION'), el('small', '', 'BANK YOUR SCORE · EVERY ' + EXTRACT_EVERY + ' WAVES'));
  $('#menu-modes')?.appendChild(btn);

  const sheet = el('section', 'screen');
  sheet.id = 'ex-sheet';
  const panel = el('div', 'panel'), steps = el('div', 'ex-steps');
  MULTS.forEach((m, i) => { const d = el('div'); d.append(el('b', '', '×' + m), el('small', '', 'WAVE ' + (i + 1) * EXTRACT_EVERY + (i === MULTS.length - 1 ? '+' : ''))); steps.appendChild(d); });
  const go = el('button', 'cta', 'START EXTRACTION'), back = el('button', 'ghost', 'BACK'), row = el('div', 'row');
  row.append(go, back);
  panel.append(el('h2', '', 'EXTRACTION'), el('div', 'cm-sub', 'ALL WEAPONS · ANY DIFFICULTY · OWN LEADERBOARD'), steps,
    el('p', 'ex-rules', 'SURVIVE TO WAVE ' + EXTRACT_EVERY + ', ' + 2 * EXTRACT_EVERY + ' OR ' + 3 * EXTRACT_EVERY + ' AND CHOOSE: EXTRACT NOW TO BANK YOUR SCORE WITH THE MULTIPLIER AND A SCRAP CRATE, OR HOLD THE LINE FOR A BIGGER MULTIPLIER AT THE NEXT POINT. DIE BEFORE YOU EXTRACT AND YOU KEEP ONLY THE RAW SCORE. BANKED SCORES RANK ON THE EXTRACT BOARD.'), row);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
  api.registerScreen(sheet);
  const open = () => { api.sfx.init?.(); api.showScreen(sheet); };
  btn.onclick = open;
  back.onclick = () => api.showScreen(api.ui.menu);
  go.onclick = () => api.startGame(opts());

  const hud = el('div');
  hud.id = 'ex-hud';
  hud.classList.add('hidden');
  $('#hud-extras')?.appendChild(hud);
  function renderHud() {
    if (!isExtract()) { hud.classList.add('hidden'); return; }
    const p = nextPoint(Math.max(0, api.state.wave - 1));
    hud.replaceChildren('🚁 EXTRACT AT WAVE ', el('b', '', String(p)), ' · ', el('b', '', '×' + multAt(p)));
    hud.classList.remove('hidden');
  }

  const screen = el('section', 'screen');
  screen.id = 'extract';
  const box = el('div', 'ex'), h2 = el('h2', '', 'EXTRACTION POINT'), sub = el('div', 'ex-sub'), choice = el('div', 'ex-choice');
  const goBtn = el('button', 'cta gold'), holdBtn = el('button', 'ghost');
  choice.append(goBtn, holdBtn);
  box.append(h2, sub, choice);
  screen.appendChild(box);
  document.body.appendChild(screen);
  api.registerScreen(screen);
  let offer = null;

  function show(wave) {
    const mult = multAt(wave), raw = api.state.score, banked = Math.round(raw * mult), crate = crateAt(wave), next = nextPoint(wave);
    offer = { wave, mult, raw, banked, crate };
    sub.textContent = 'WAVE ' + wave + ' CLEARED · SCORE ' + fmt(raw);
    goBtn.replaceChildren(el('b', '', 'EXTRACT NOW'), el('span', '', '×' + mult + ' → ' + fmt(banked) + ' BANKED · +' + fmt(crate) + ' 🔩 CRATE'));
    const nm = multAt(next);
    holdBtn.replaceChildren(el('b', '', 'HOLD THE LINE'), el('span', '', 'NEXT EXTRACTION AT WAVE ' + next + ' · ×' + nm + (nm === MULTS[MULTS.length - 1] ? ' MAX' : '') + ' · DIE AND THE BONUS IS GONE'));
    api.state.mode = 'extract';
    api.hint('');
    api.showScreen(screen);
    api.haptic('MEDIUM');
    bus.emit('extract:offer', { wave, mult });
  }
  function hold() {
    if (api.state.mode !== 'extract') return;
    const o = offer; offer = null;
    api.state.mode = 'playing';
    api.showScreen(null);
    api.toast('HOLDING — NEXT EXTRACTION AT WAVE ' + nextPoint(o.wave), 2.2);
    api.haptic('LIGHT');
    bus.emit('extract:hold', { wave: o.wave });
  }
  function extract() {
    if (api.state.mode !== 'extract') return;
    const o = offer; offer = null;
    api.state.score = o.banked;
    api.state.cleared = true;
    api.state.extracted = o.wave;
    api.state.mode = 'playing';
    api.showScreen(null);
    api.message('EXTRACTED', 'SCORE ×' + o.mult + ' BANKED', 2.4);
    api.sfx.clear?.(); api.haptic('HEAVY');
    bus.emit('extract:go', o);
    api.gameOver();
  }
  goBtn.onclick = extract;
  holdBtn.onclick = hold;

  const over = el('span', 'ex-over hidden');
  $('#over-extras')?.appendChild(over);
  let last = null;
  bus.on('run:start', () => { offer = null; last = null; renderHud(); });
  bus.on('wave:start', renderHud);
  bus.on('wave:clear', e => { if (isExtract() && isPoint(e.wave) && api.state.mode === 'playing') show(e.wave); });
  bus.on('run:end', s => {
    hud.classList.add('hidden');
    over.classList.toggle('hidden', s.type !== 'extract');
    if (s.type !== 'extract') return;
    last = s;
    if (s.extracted) {
      const crate = crateAt(s.extracted);
      api.grantScrap(crate);
      over.textContent = '🚁 EXTRACTED AT WAVE ' + s.extracted + ' · ×' + multAt(s.extracted) + ' BANKED';
      setTimeout(() => { const h = $('#over h2'); if (h) h.textContent = 'EXTRACTED'; const box = $('#over-rewards'); if (box) box.appendChild(el('span', 'gold', '+' + fmt(crate) + ' 🔩 EXTRACTION CRATE')); }, 0);
    } else over.textContent = '🚁 NO EXTRACTION · BONUS FORFEITED · NEXT POINT WAS WAVE ' + nextPoint(s.wave);
  });

  api.extract = { opts, open, show, hold, extract, multAt, crateAt, nextPoint, isPoint, get offer() { return offer; } };
}
