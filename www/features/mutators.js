export const id = 'mutators';
export const MAX_PICK = 3, MUT_MAX = 2.5;
export const MUTATORS = [
  { id: 'noradar', icon: '📡', name: 'NO RADAR', desc: 'THE MINIMAP IS OFF', mult: 1.15 },
  { id: 'runners', icon: '🏃', name: 'DOUBLE RUNNERS', desc: 'TWICE AS MANY RUNNERS IN EVERY WAVE', mult: 1.2 },
  { id: 'nopickups', icon: '🚫', name: 'NO PICKUPS', desc: 'THE DEAD DROP NOTHING', mult: 1.25 },
  { id: 'glass', icon: '🩸', name: 'GLASS CANNON', desc: '+50% DAMAGE · 50 MAX HEALTH', mult: 1.2 },
  { id: 'ironsights', icon: '🎯', name: 'IRON SIGHTS', desc: 'NO AIM ASSIST', mult: 1.1 },
];
export const multiplierOf = ids => Math.round(ids.reduce((m, id) => m * (MUTATORS.find(x => x.id === id)?.mult || 1), 1) * 100) / 100;
export const clean = ids => [...new Set((Array.isArray(ids) ? ids : []).filter(id => MUTATORS.some(m => m.id === id)))].slice(0, MAX_PICK);

const CSS = `
#mut-chip{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:7px 12px;border-radius:12px;border:1px solid var(--line);background:#ffffff0d;font:900 10px var(--ui);letter-spacing:1.3px;color:var(--dim);line-height:1.1}
#mut-chip b{color:#fff;font:900 14px var(--display);letter-spacing:1px}
#mut-chip.on{border-color:#b48cff;color:#d8c8ff;background:#b48cff1a}
#mut-chip.on b{color:#b48cff}
#mut-chip.hidden{display:none}
#mutators .panel{width:min(94vw,600px)}
.mut-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0}
.mut-card{display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:#0b161b;text-align:left}
.mut-card i{font-style:normal;font-size:20px;text-align:center}
.mut-card b{display:block;font:900 11px var(--ui);letter-spacing:1.4px}
.mut-card small{display:block;margin-top:2px;font:700 8.5px var(--ui);letter-spacing:1px;color:var(--dim)}
.mut-card em{font-style:normal;font:900 12px var(--display);letter-spacing:1px;color:#b48cff}
.mut-card.on{border-color:#b48cff;background:#b48cff1a;box-shadow:inset 0 0 0 1px #b48cff}
.mut-card:disabled{opacity:.4}
#mut-total{font:900 12px var(--ui);letter-spacing:1.6px;color:#b48cff;text-align:center;margin-bottom:8px}
.mut-note{margin:0 0 10px;font:800 9.5px/1.5 var(--ui);letter-spacing:1px;color:var(--dim);text-align:center}
@media (max-height:430px) and (orientation:landscape){#mutators .panel{width:min(96vw,760px);padding:14px 18px}.mut-grid{grid-template-columns:repeat(3,1fr);gap:6px}.mut-card{padding:8px 10px}}
`;

export function init(api) {
  const { $, bus, store } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let picked = clean(store.get('mutators', []));
  const save = () => store.set('mutators', picked);
  const mult = () => multiplierOf(picked);

  const chip = el('button', 'ghost');
  chip.id = 'mut-chip';
  const chipLabel = el('span', '', 'MUTATORS'), chipVal = el('b');
  chip.append(chipLabel, chipVal);
  const go = document.querySelector('#menu .menu-go');
  if (go) go.insertBefore(chip, $('#start'));
  function renderChip() {
    chip.classList.toggle('on', picked.length > 0);
    chipVal.textContent = picked.length ? '×' + mult().toFixed(2) : 'OFF';
  }

  const screen = el('section', 'screen');
  screen.id = 'mutators';
  screen.innerHTML = '<div class="panel"><h2>MUTATORS</h2><div class="cm-sub">NORMAL DEPLOYS ONLY · PICK UP TO ' + MAX_PICK + ' · SCORE MULTIPLIER STACKS</div><div class="mut-grid" id="mut-grid"></div><div id="mut-total"></div><p class="mut-note">MUTATORS APPLY TO NORMAL DEPLOYS AND SHOW ON YOUR RUN CARD. THE DAILY, RANKED, BLITZ AND EXTRACTION IGNORE THEM.</p><div class="row" style="justify-content:center"><button class="ghost" id="mut-clear">CLEAR</button><button class="cta" id="mut-done">DONE</button></div></div>';
  document.body.appendChild(screen);
  api.registerScreen(screen);
  const grid = screen.querySelector('#mut-grid');
  function render() {
    grid.innerHTML = '';
    for (const m of MUTATORS) {
      const on = picked.includes(m.id), b = el('button', 'mut-card' + (on ? ' on' : ''));
      b.dataset.mut = m.id;
      b.disabled = !on && picked.length >= MAX_PICK;
      const mid = el('div'); mid.append(el('b', '', m.name), el('small', '', m.desc));
      b.append(el('i', '', m.icon), mid, el('em', '', '×' + m.mult.toFixed(2)));
      b.onclick = () => { toggle(m.id); };
      grid.appendChild(b);
    }
    screen.querySelector('#mut-total').textContent = picked.length ? picked.length + ' ACTIVE · SCORE ×' + mult().toFixed(2) : 'NO MUTATORS · SCORE ×1.00';
    renderChip();
  }
  function toggle(id) {
    if (picked.includes(id)) picked = picked.filter(x => x !== id);
    else if (picked.length < MAX_PICK) picked = [...picked, id];
    else return false;
    save(); render(); api.haptic('LIGHT');
    return true;
  }
  screen.querySelector('#mut-clear').onclick = () => { picked = []; save(); render(); };
  screen.querySelector('#mut-done').onclick = () => api.showScreen(api.ui.menu);
  const open = () => { api.sfx.init?.(); render(); api.showScreen(screen); };
  chip.onclick = open;

  const inner = api.deployOpts;
  api.deployOpts = () => { const o = inner(); return picked.length ? { ...o, mutators: [...picked] } : o; };

  let active = [];
  bus.on('run:start', e => {
    active = (e.type || 'normal') === 'normal' && !api.state.net ? clean(e.opts?.mutators) : [];
    const L = api.live;
    L.mutScore = multiplierOf(active);
    L.noRadar = active.includes('noradar');
    L.noPickups = active.includes('nopickups');
    L.runners = active.includes('runners') ? 2 : 1;
    if (active.includes('ironsights')) L.noAssist = true;
    if (active.includes('glass')) { api.stats.damage *= 1.5; api.stats.maxHp = 50; api.player.hp = api.player.lagHp = 50; }
    api.ui.radar?.classList.toggle('hidden', L.noRadar);
    if (active.length) api.schedule?.(1.2, () => api.toast('MUTATORS · SCORE ×' + L.mutScore.toFixed(2), 2.2));
  });
  bus.on('run:end', run => {
    api.ui.radar?.classList.remove('hidden');
    if (run.type === 'normal' && run.mutators?.length) setTimeout(() => { const box = $('#over-rewards'); if (box) box.appendChild(el('span', 'hot', '🧬 ' + run.mutators.map(id => MUTATORS.find(m => m.id === id)?.name || id).join(' + ') + ' · SCORE ×' + run.mutScore.toFixed(2))); }, 0);
  });
  bus.on('screen', ({ id }) => { if (id === 'menu') { renderChip(); chip.classList.toggle('hidden', !!api.firstdeploy?.pending?.()); } });
  renderChip();

  api.mutators = { MUTATORS, MAX_PICK, picked: () => [...picked], active: () => [...active], toggle, clear: () => { picked = []; save(); render(); }, multiplier: mult, multiplierOf, open };
}
