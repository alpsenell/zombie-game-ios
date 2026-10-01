export const id = 'featured';
export const FEATURED_XP = 1.5, EPOCH = Date.UTC(2026, 8, 21);
const DAY = 864e5, WEEK = 7 * DAY;
export const weekIndex = (t = Date.now()) => Math.floor((t - EPOCH) / WEEK);
export const featuredId = (maps, t = Date.now()) => { const n = maps.length; return n ? maps[((weekIndex(t) % n) + n) % n].id : null; };
export const weekEnd = (t = Date.now()) => EPOCH + (weekIndex(t) + 1) * WEEK;
export const timeLeft = ms => { const h = Math.max(1, Math.ceil(ms / 36e5)), d = Math.floor(h / 24); return d ? d + 'D ' + h % 24 + 'H' : h + 'H'; };

const CSS = `
.map-card .mp-feat{position:absolute;right:10px;top:9px;padding:2px 7px;border-radius:6px;background:#ffc34d;color:#1a1206;font:900 8px var(--ui);letter-spacing:1.2px}
#map-chip.featured b:after{content:" ★";color:#ffc34d}
#ft-note{margin:0 0 8px;font:800 9px var(--ui);letter-spacing:1.4px;color:#ffc34d}
`;

export function init(api) {
  const { $, bus } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const current = () => featuredId(api.MAPS);
  const name = id => api.MAPS.find(m => m.id === id)?.name || '';

  const note = document.createElement('div');
  note.id = 'ft-note';
  $('#maps h2')?.after(note);
  function renderMaps() {
    const f = current();
    note.textContent = f ? '⭐ FEATURED THIS WEEK: ' + name(f) + ' · XP ×' + FEATURED_XP + ' · ' + timeLeft(weekEnd() - Date.now()) + ' LEFT' : '';
    for (const card of document.querySelectorAll('.map-card')) {
      card.querySelector('.mp-feat')?.remove();
      if (card.dataset.map === f) { const tag = document.createElement('span'); tag.className = 'mp-feat'; tag.textContent = '★ FEATURED · XP ×' + FEATURED_XP; card.appendChild(tag); }
    }
    $('#map-chip')?.classList.toggle('featured', api.currentMap === f);
  }
  bus.on('run:start', e => {
    const f = current();
    if (!f || e.map !== f || e.type === 'tutorial') return;
    api.live.featured = FEATURED_XP;
    api.schedule?.(1.8, () => api.toast('⭐ FEATURED MAP · XP ×' + FEATURED_XP, 2));
  });
  bus.on('screen', ({ id }) => { if (id === 'maps' || id === 'menu') renderMaps(); });
  bus.on('map', renderMaps);
  renderMaps();

  api.featured = { FEATURED_XP, id: current, name: () => name(current()), weekEnd, isFeatured: id => id === current() };
}
