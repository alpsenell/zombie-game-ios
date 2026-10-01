export const id = 'mapevents';
export const EVENT_EVERY = 7, EVENT_DELAY = 6, EVENT_SECONDS = 20;
export const MAP_EVENTS = {
  street: { id: 'blackout', name: 'STREETLIGHTS FAIL', desc: 'THE BLOCK GOES DARK · WATCH THE EYES', secs: 20 },
  mall: { id: 'flood', name: 'THE FOUNTAIN FLOODS', desc: 'CRAWLERS SLOW TO A CRAWL IN THE WATER', secs: 20 },
  overpass: { id: 'collapse', name: 'PILE-UP COLLAPSE', desc: 'A WRECK DROPS ONTO THE ROAD · THE HORDE REROUTES', secs: 0 },
  base: { id: 'searchlights', name: 'SEARCHLIGHTS', desc: 'STALKERS ARE EXPOSED IN THE BEAMS', secs: 20 },
};
export const eventWave = wave => wave > 0 && wave % EVENT_EVERY === 0;
export const eventFor = map => MAP_EVENTS[map] || null;

export function init(api) {
  const { bus } = api;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const style = document.createElement('style');
  style.textContent = '#me-hud{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:5px 9px;border-radius:9px;background:#081014aa;border:1px solid #b48cff55;font:900 9px var(--ui);letter-spacing:1.3px;color:#d8c8ff;white-space:nowrap}#me-hud.hidden{display:none}';
  document.head.appendChild(style);
  const hud = el('div', 'hidden');
  hud.id = 'me-hud';
  api.$('#hud-extras')?.appendChild(hud);
  const log = [];
  let timer = null;

  function fire(wave) {
    const ev = eventFor(api.currentMap);
    if (!ev || api.state.mode !== 'playing') return null;
    const started = api.startMapEvent?.(ev.id, ev.secs);
    if (!started) return null;
    api.message('MAP EVENT', ev.name + ' · ' + ev.desc, 2.8);
    api.haptic('HEAVY');
    log.push({ id: ev.id, map: api.currentMap, wave });
    bus.emit('map:event', { id: ev.id, name: ev.name, map: api.currentMap, wave, secs: ev.secs });
    renderHud();
    return ev;
  }
  function renderHud() {
    const e = api.state.mapEvent, ev = e && Object.values(MAP_EVENTS).find(x => x.id === e.id);
    if (!ev || !ev.secs || api.state.mode === 'menu') { hud.classList.add('hidden'); return; }
    hud.textContent = '⚠ ' + ev.name + ' · ' + Math.max(0, Math.ceil(e.until - api.state.clock)) + 'S';
    hud.classList.remove('hidden');
  }
  setInterval(renderHud, 250);

  bus.on('wave:start', e => {
    if (e.checkpoint || e.resumed || !eventWave(e.wave)) return;
    if (api.state.runType === 'tutorial' || (api.state.net && !api.state.net.host)) return;
    api.schedule?.(EVENT_DELAY, () => { if (api.state.wave === e.wave) fire(e.wave); });
  });
  bus.on('run:start', () => { log.length = 0; hud.classList.add('hidden'); });
  bus.on('run:end', () => hud.classList.add('hidden'));

  api.mapEvents = { MAP_EVENTS, EVENT_EVERY, eventWave, eventFor, fire: wave => fire(wave ?? api.state.wave), log: () => [...log] };
}
