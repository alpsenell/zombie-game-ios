export const id = 'firstdeploy';
export const TUTORIAL_WAVES = 3, REWARD_WEAPON = 'mp7', STAGES = [5, 10], HINT_MS = 4200;
export const WAVES = [
  [['walker', 4]],
  [['walker', 5], ['runner', 2]],
  [['walker', 6], ['crawler', 2], ['runner', 2]],
];
export const HIDE = {
  0: ['#cm-daily', '#cm-ranked', '#coop-open', '#cm-league', '#sp-open', '#ev-chip', '#ex-open', 'missions'],
  1: ['#cm-ranked', '#coop-open', '#cm-league', '#sp-open'],
  2: [],
};
const ALL = ['#cm-daily', '#cm-ranked', '#coop-open', '#cm-league', '#sp-open', '#ev-chip', '#ex-open'];
export const stageFor = profile => (profile.bestWave >= STAGES[1] ? 2 : profile.bestWave >= STAGES[0] ? 1 : 0);
export const waveList = w => (WAVES[w - 1] || WAVES[WAVES.length - 1]).flatMap(([kind, n]) => Array.from({ length: n }, () => ({ kind, elite: false })));

const CSS = `
#tut-skip{padding:9px 12px;font-size:10px;letter-spacing:1.4px;white-space:nowrap}
.menu-go.training .cta{background:linear-gradient(180deg,#ffd36a,#e0a02a);color:#1a1206;box-shadow:0 5px 0 #7a5410,0 12px 28px #000c}
#tut-note{margin:-4px 0 10px;font:700 11px/1.5 var(--ui);letter-spacing:.3px;color:var(--amber)}
@media (max-height:430px){#tut-note{margin:-2px 0 6px;font-size:10px}}
`;

export function init(api) {
  const { bus, profile, store, $ } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const T = () => (profile.tutorial ||= { done: false, reward: false, skipped: false, staged: true });
  if (!profile.tutorial) {
    const veteran = !!store.get('tutorial', false) || (profile.runs || 0) > 0 || (profile.bestWave || 0) > 0;
    profile.tutorial = { done: veteran, reward: veteran, skipped: false, staged: !veteran };
    api.saveProfile();
  }
  const pending = () => !T().done;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const inner = api.deployOpts;
  const tutorialOpts = () => ({ type: 'tutorial', difficulty: 'recruit', seed: api.hashSeed('tutorial'), map: 'street', replay: () => (pending() ? tutorialOpts() : inner()) });
  api.deployOpts = () => (pending() ? tutorialOpts() : inner());

  const go = $('.menu-go'), start = $('#start'), skip = el('button', 'ghost', 'SKIP TRAINING'), note = el('div');
  skip.id = 'tut-skip';
  note.id = 'tut-note';
  note.textContent = 'TRAINING: THREE SHORT WAVES TO LEARN THE CONTROLS. FINISH IT AND THE MP7 IS YOURS.';
  go?.appendChild(skip);
  go?.before(note);
  skip.onclick = () => { const t = T(); t.done = true; t.skipped = true; api.saveProfile(); api.haptic('LIGHT'); renderMenu(); bus.emit('tutorial:skip', {}); };

  const missionsBtn = () => [...document.querySelectorAll('#menu-extras .pg-btn')].find(b => b.textContent.startsWith('MISSIONS'));
  function applyStage() {
    const t = T(), st = t.staged ? stageFor(profile) : 2, hide = new Set(HIDE[st]);
    for (const sel of ALL) for (const n of document.querySelectorAll(sel)) n.classList.toggle('hidden', hide.has(sel));
    missionsBtn()?.classList.toggle('hidden', hide.has('missions'));
    return st;
  }
  function renderMenu() {
    const p = pending();
    start.textContent = p ? 'START TRAINING' : 'DEPLOY';
    go?.classList.toggle('training', p);
    skip.classList.toggle('hidden', !p);
    note.classList.toggle('hidden', !p);
    $('#diff')?.classList.toggle('hidden', p);
    $('#diff-desc')?.classList.toggle('hidden', p);
    applyStage();
  }

  let won = false, hints = {}, hintToken = 0, hintsOn = false;
  const hint = (key, text) => {
    if (hints[key] || api.state.runType !== 'tutorial' || api.state.mode !== 'playing') return;
    hints[key] = true;
    const tok = ++hintToken;
    api.hint(text);
    setTimeout(() => { if (hintToken === tok) api.hint(''); }, HINT_MS);
  };
  const near = r => api.zombies.filter(z => !z.userData.dead && z.userData.rise < .5 && Math.hypot(z.position.x - api.camera.position.x, z.position.z - api.camera.position.z) < r).length;

  bus.on('run:start', e => { won = false; hints = {}; hintsOn = !!store.get('tutorial', false); if (e.type === 'tutorial') api.schedule(1.2, () => api.toast('TRAINING · WAVE 1 OF ' + TUTORIAL_WAVES, 2)); });
  bus.on('tutorial:done', () => { hintsOn = true; });
  bus.on('wave:start', e => {
    if (api.state.runType !== 'tutorial') return;
    const list = waveList(e.wave);
    api.state.queue = list; api.state.waveTotal = list.length; api.state.waveDone = 0;
    if (e.wave === 2) api.schedule(2.6, () => hint('radar', 'THE RADAR (TOP RIGHT) SHOWS WHERE THEY COME FROM — RED IS CLOSE'));
    if (e.wave === TUTORIAL_WAVES) api.schedule(2.6, () => hint('last', 'LAST TRAINING WAVE — HOLD THE LINE AND THE MP7 IS YOURS'));
  });
  bus.on('shot', () => {
    if (api.state.runType !== 'tutorial' || !hintsOn) return;
    const p = api.player;
    if (p.ammo[p.weapon] === 0 && p.reserve[p.weapon] > 0) hint('reload', 'MAG EMPTY — IT RELOADS BY ITSELF. TAP ⟳ TO RELOAD EARLY');
    else if (p.nades > 0 && near(7) >= 3) hint('nade', "THEY'RE BUNCHED UP — TAP 💣 TO THROW A GRENADE");
  });
  bus.on('kill', () => {
    if (api.state.runType !== 'tutorial' || !hintsOn) return;
    if (api.pickups.length) hint('pick', 'A SUPPLY DROP — WALK OVER IT TO GRAB IT');
    else if (api.player.hp < api.stats.maxHp * .5) hint('hp', 'LOW HEALTH — CLEARING A WAVE HEALS 20%, SUPPLY DROPS HEAL MORE');
  });
  bus.on('wave:clear', e => {
    if (api.state.runType !== 'tutorial') return;
    if (e.wave >= TUTORIAL_WAVES) { won = true; api.message('TRAINING COMPLETE', 'MP7 UNLOCKED', 2.4); api.schedule(1.6, () => api.gameOver()); }
    else api.schedule(.4, () => api.toast('WAVE ' + e.wave + ' OF ' + TUTORIAL_WAVES + ' CLEAR — PICK AN UPGRADE', 2));
  });
  bus.on('screen', ({ id }) => {
    if (id === 'perks' && api.state.runType === 'tutorial') { const sub = $('#perk-sub'); if (sub) sub.textContent = 'TRAINING · PICK ONE — UPGRADES STACK FOR THE WHOLE RUN'; }
    if (id === 'menu') renderMenu();
  });

  function grantReward() {
    const t = T(), w = api.WEAPONS.find(x => x.id === REWARD_WEAPON);
    t.reward = true;
    if (!profile.arsenal.owned[REWARD_WEAPON]) {
      profile.arsenal.owned[REWARD_WEAPON] = true;
      if (profile.arsenal.secondary === REWARD_WEAPON) profile.arsenal.secondary = profile.arsenal.primary;
      profile.arsenal.primary = REWARD_WEAPON;
    }
    api.saveProfile();
    api.refreshProfileUI();
    bus.emit('purchase', { kind: 'reward', item: 'weapon:' + REWARD_WEAPON, cost: 0 });
    setTimeout(() => { const box = $('#over-rewards'); if (box) box.appendChild(el('span', 'hot', '🔓 ' + (w?.name || REWARD_WEAPON.toUpperCase()) + ' UNLOCKED · EQUIPPED AS PRIMARY')); }, 0);
    bus.emit('tutorial:reward', { weapon: REWARD_WEAPON });
  }
  bus.on('run:end', s => {
    const t = T();
    if (s.type === 'tutorial') {
      if (won) t.done = true;
      const h2 = $('#over h2');
      if (h2) h2.textContent = won ? 'TRAINING COMPLETE' : 'TRAINING OVER';
      api.saveProfile();
    }
    if (!t.reward && s.wave >= TUTORIAL_WAVES && (s.type === 'tutorial' ? won : s.type === 'normal')) grantReward();
  });
  bus.on('app:ready', renderMenu);
  setInterval(() => { if (api.activeScreen === api.ui.menu) applyStage(); }, 1000);
  renderMenu();

  api.firstdeploy = { pending, stage: () => (T().staged ? stageFor(profile) : 2), applyStage, renderMenu, tutorialOpts, waveList, get state() { return T(); } };
}
