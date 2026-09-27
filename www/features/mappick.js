const css = `
#map-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:#ffffff0a;font:800 10px var(--ui);letter-spacing:1.4px;color:var(--dim)}
#map-chip b{color:#fff;font:900 11px var(--ui);letter-spacing:1.4px}
#map-chip:after{content:"›";font-size:15px;line-height:10px;color:var(--amber)}
#maps{background:linear-gradient(0deg,#020608f5 0%,#020608b8 40%,#02060800 72%);place-items:end center}
#maps .mp{width:min(100%,920px);text-align:left}
#maps h2{margin:0 0 10px;font:900 30px var(--display);letter-spacing:2px;text-shadow:0 3px 12px #000}
#maps h2 small{margin-left:10px;font:800 10px var(--ui);letter-spacing:2px;color:var(--amber)}
.map-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.map-card{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:122px;padding:12px;border-radius:14px;border:1px solid var(--line);text-align:left;overflow:hidden;background:#0e191e;transition:transform .12s}
.map-card:active{transform:scale(.97)}
.map-card:before{content:"";position:absolute;inset:0;background:var(--tint);opacity:.9}
.map-card>*{position:relative}
.map-card b{font:900 20px/1 var(--display);letter-spacing:1px}
.map-card span{margin-top:5px;color:#c8d4d2;font:700 9px/1.45 var(--ui);letter-spacing:.9px}
.map-card.on{border-color:var(--red);box-shadow:inset 0 0 0 1px var(--red),0 0 20px #e5483a55}
.map-card.on:after{content:"SELECTED";position:absolute;left:12px;top:9px;padding:2px 6px;border-radius:5px;background:var(--red);font:900 8px var(--ui);letter-spacing:1px;color:#fff}
.map-card[data-map=street]{--tint:linear-gradient(165deg,#24384a 0,#0b1820 55%,#4a2c1e)}
.map-card[data-map=mall]{--tint:linear-gradient(165deg,#3a4c56 0,#121a1e 50%,#4a1a34)}
.map-card[data-map=overpass]{--tint:linear-gradient(165deg,#2e1840 0,#7a3448 45%,#e0784a)}
.map-card[data-map=base]{--tint:linear-gradient(165deg,#0f2224 0,#0a1512 50%,#34462a)}
.mp-row{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
@media (orientation:portrait){.map-cards{grid-template-columns:1fr 1fr}#maps .mp{text-align:center}.map-card{min-height:136px}.mp-row{justify-content:center}}
@media (max-height:430px){.map-card{min-height:126px;padding:10px}#maps h2{font-size:24px;margin-bottom:6px}.mp-row{margin-top:8px}.mp-row button{padding:12px 22px}}
`;

export default {
  id: 'mappick',
  init(api) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const chip = document.createElement('button');
    chip.id = 'map-chip';
    chip.innerHTML = 'MAP <b></b>';
    api.$('#menu-modes').appendChild(chip);

    const el = document.createElement('section');
    el.id = 'maps';
    el.className = 'screen';
    el.innerHTML = '<div class="mp"><h2>SELECT MAP<small>TAP TO PREVIEW</small></h2><div class="map-cards"></div><div class="mp-row"><button class="ghost" id="maps-back">BACK</button><button class="cta" id="maps-go">DEPLOY</button></div></div>';
    document.body.appendChild(el);
    api.registerScreen(el);
    const cards = el.querySelector('.map-cards');
    for (const m of api.MAPS) {
      const b = document.createElement('button');
      b.className = 'map-card';
      b.dataset.map = m.id;
      const n = document.createElement('b'); n.textContent = m.name;
      const d = document.createElement('span'); d.textContent = m.desc;
      b.append(n, d);
      b.onclick = () => { api.loadMap(m.id); api.haptic('LIGHT'); };
      cards.appendChild(b);
    }
    const sync = () => {
      const cur = api.MAPS.find(m => m.id === api.currentMap);
      chip.querySelector('b').textContent = cur ? cur.name : '';
      for (const b of cards.children) b.classList.toggle('on', b.dataset.map === api.currentMap);
    };
    chip.onclick = () => { sync(); api.showScreen(el); };
    el.querySelector('#maps-back').onclick = () => api.showScreen(api.ui.menu);
    el.querySelector('#maps-go').onclick = () => api.startGame(api.deployOpts());
    api.bus.on('map', sync);
    api.bus.on('screen', sync);
    sync();
  },
};
