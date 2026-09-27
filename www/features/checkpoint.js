const css = `
#cp-start{display:inline-flex;align-items:stretch;border-radius:12px;border:1px solid var(--line);background:#ffffff0d;overflow:hidden}
#cp-start.hidden{display:none}
#cp-start button{width:38px;border:0;background:none;color:var(--amber);font:900 20px/1 var(--ui)}
#cp-start button:disabled{color:var(--dim);opacity:.35}
#cp-start div{display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:62px;padding:6px 2px}
#cp-start small{font:800 8px var(--ui);letter-spacing:1.3px;color:var(--dim);white-space:nowrap}
#cp-start b{font:900 20px/1.05 var(--display);letter-spacing:1px}
#cp-start.on b{color:var(--amber)}
.menu-go{flex-wrap:nowrap}
@media (max-height:430px){#cp-start button{width:32px}#cp-start div{min-width:56px;padding:4px 2px}#cp-start b{font-size:17px}}
`;

const RANK = { recruit: 0, survivor: 1, veteran: 2, nightmare: 3 };

export default {
  id: 'checkpoint',
  init(api) {
    const { profile, bus, $ } = api;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    if (!profile.checkpoint) {
      const cleared = {}, bump = (d, w) => { if (RANK[d] != null && w > 1) cleared[d] = Math.max(cleared[d] || 0, w - 1); };
      for (const [d, w] of Object.entries(profile.bestByDiff || {})) bump(d, w);
      for (const r of api.store.get('runs', [])) if (r.type !== 'coop') bump(r.diff || 'survivor', r.wave);
      if (!Object.keys(cleared).length && profile.bestWave > 1) bump(api.settings.difficulty, profile.bestWave);
      profile.checkpoint = { cleared, pick: {} };
      api.saveProfile();
    }
    const cp = profile.checkpoint;
    cp.cleared ||= {}; cp.pick ||= {};

    const highest = (d = api.settings.difficulty) => Math.max(0, ...Object.entries(cp.cleared).filter(([k]) => RANK[k] >= (RANK[d] ?? 1)).map(([, v]) => v));
    const options = (d = api.settings.difficulty) => {
      const top = highest(d), list = [1];
      for (let w = 5; w <= top; w += 5) list.push(w);
      if (top > 1 && list[list.length - 1] !== top) list.push(top);
      return list;
    };
    const selected = (d = api.settings.difficulty) => { const o = options(d), p = cp.pick[d] || 1; return o.includes(p) ? p : o.filter(w => w <= p).pop(); };

    const box = document.createElement('div');
    box.id = 'cp-start';
    box.innerHTML = '<button class="cp-dec" aria-label="Earlier start wave">‹</button><div><small>START WAVE</small><b></b></div><button class="cp-inc" aria-label="Later start wave">›</button>';
    $('.menu-go').appendChild(box);
    const [dec, inc] = box.querySelectorAll('button'), val = box.querySelector('b');
    function render() {
      const d = api.settings.difficulty, o = options(d), s = selected(d), i = o.indexOf(s);
      box.classList.toggle('hidden', o.length < 2);
      box.classList.toggle('on', s > 1);
      val.textContent = s;
      dec.disabled = i <= 0;
      inc.disabled = i >= o.length - 1;
    }
    const step = n => {
      const d = api.settings.difficulty, o = options(d), i = Math.max(0, Math.min(o.length - 1, o.indexOf(selected(d)) + n));
      cp.pick[d] = o[i];
      api.saveProfile();
      api.haptic('LIGHT');
      render();
    };
    dec.onclick = () => step(-1);
    inc.onclick = () => step(1);
    $('#diff').addEventListener('click', render);

    let diffId = null;
    bus.on('run:start', e => { diffId = e.type === 'coop' ? null : e.difficultyId; });
    bus.on('wave:clear', e => {
      if (!diffId || !(RANK[diffId] >= 0)) return;
      if (e.wave > (cp.cleared[diffId] || 0)) { cp.cleared[diffId] = e.wave; api.saveProfile(); }
    });
    bus.on('screen', ({ id }) => { if (id === 'menu') render(); });
    api.deployOpts = () => { const s = selected(); return s > 1 ? { startWave: s } : {}; };
    api.checkpoint = { highest, options, selected, render, state: cp };
    render();
  },
};
