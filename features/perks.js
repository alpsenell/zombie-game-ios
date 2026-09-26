const css = `
#perk-strip{display:flex;flex-wrap:wrap;gap:5px;max-width:min(34vw,230px)}
#perk-strip i{position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:7px;background:#081014aa;border:1px solid #ffffff26;font-style:normal;font-size:14px;line-height:1;text-shadow:none}
#perk-strip i.lg{border-color:#ffd36a;background:#2a1e08aa;box-shadow:0 0 10px #ffc34d88}
#perk-strip i.spent{opacity:.35;filter:grayscale(1)}
#perk-strip b{position:absolute;right:-5px;bottom:-5px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:var(--amber);color:#1a1206;font:900 9px/14px var(--ui);text-align:center}
.perk.legendary{position:relative;overflow:hidden;padding-top:26px;border-color:#ffd36a;background:linear-gradient(180deg,#3d2b0a,#170f03 75%);box-shadow:0 0 30px #ffc34d66,inset 0 0 22px #ffc34d2a}
.perk.legendary b{color:#ffd36a;text-shadow:0 0 12px #ffb03a}
.perk.legendary span{color:#f0dcb0}
.perk.legendary:before{content:"LEGENDARY";position:absolute;left:50%;top:8px;transform:translateX(-50%);padding:2px 8px;border-radius:5px;background:linear-gradient(180deg,#ffe08a,#e0a02a);color:#1a1206;font:900 8px var(--ui);letter-spacing:1.8px}
.perk.legendary:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,#fff4 50%,transparent 65%);transform:translateX(-120%);animation:perk-shine 2.6s .6s infinite;pointer-events:none}
@keyframes perk-shine{55%,100%{transform:translateX(120%)}}
#hud.warp:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 42%,rgba(70,150,255,.38));pointer-events:none}
@media (max-height:430px){.perk.legendary{padding-top:22px}}
`;

export default {
  id: 'perks',
  init(api) {
    const { stats, player, PERKS } = api;
    const below = (k, n) => () => stats[k] < n;
    PERKS.push(
      { icon: '🧨', name: 'EXPLOSIVE ROUNDS', desc: 'Every 10th hit explodes (7th, then 5th)', rare: true, when: below('explosive', 3), apply: () => stats.explosive++ },
      { icon: '🪃', name: 'RICOCHET', desc: 'Bullets pierce +1 target', when: below('pierce', 3), apply: () => stats.pierce++ },
      { icon: '💉', name: 'ADRENALINE', desc: 'Kills give +30% move speed for 2.5s', when: below('adrenaline', 2), apply: () => stats.adrenaline++ },
      { icon: '🪓', name: 'BERSERKER', desc: 'Up to +60% damage as health drops', when: below('berserk', 1.2), apply: () => (stats.berserk += .6) },
      { icon: '🧲', name: 'MAGNETIC', desc: 'Pickups fly to you from 2x range', when: below('magnet', 3), apply: () => (stats.magnet += 1) },
      { icon: '🧠', name: 'TRIGGER DISCIPLINE', desc: 'Headshots refund a round', when: below('refund', 3), apply: () => stats.refund++ },
      { icon: '❄️', name: 'FROST ROUNDS', desc: '12% chance per hit to chill', when: below('frost', .35), apply: () => (stats.frost += .12) },
      { icon: '🔥', name: 'INCENDIARY ROUNDS', desc: '12% chance per hit to ignite', when: below('incendiary', .35), apply: () => (stats.incendiary += .12) },
      { icon: '🎒', name: 'GRENADIER', desc: '+1 grenade after every wave', when: below('nadeRegen', 3), apply: () => { stats.nadeRegen++; player.nades = Math.min(stats.nadeMax, player.nades + 1); } },
      { icon: '🔁', name: 'SECOND MAG', desc: 'Swapping reloads the holstered weapon', when: () => !stats.secondMag, apply: () => (stats.secondMag = true) },
      { icon: '💰', name: 'FORTUNE', desc: '+25% scrap at the end of the run', apply: () => (stats.fortune += .25) },
      { icon: '🦅', name: 'PHOENIX', desc: 'Rise from death at full health with a nova', legendary: true, when: () => !stats.phoenix, apply: () => (stats.phoenix = 1) },
      { icon: '⏳', name: 'TIME WARP', desc: 'Triple kills slow the horde for 3s', legendary: true, when: () => !stats.timeWarp, apply: () => (stats.timeWarp = true) },
      { icon: '⛓️', name: 'CHAIN REACTION', desc: 'Kills have a 25% chance to explode', legendary: true, when: () => !stats.chain, apply: () => (stats.chain = .25) },
      { icon: '🔋', name: 'OVERCLOCK', desc: 'All fire rates +40%, max health -20%', legendary: true, when: () => !stats.overclock, apply: () => { stats.overclock = true; stats.fireRate *= 1.4; stats.maxHp = Math.round(stats.maxHp * .8); player.hp = Math.min(player.hp, stats.maxHp); } },
    );

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const strip = document.createElement('div');
    strip.id = 'perk-strip';
    api.$('#hud-extras').appendChild(strip);
    const owned = new Map();
    const render = () => {
      strip.textContent = '';
      for (const [name, o] of owned) {
        const e = document.createElement('i');
        e.className = (o.legendary ? 'lg' : '') + (name === 'PHOENIX' && !stats.phoenix ? ' spent' : '');
        e.textContent = o.icon;
        e.title = name;
        if (o.n > 1) { const b = document.createElement('b'); b.textContent = o.n; e.appendChild(b); }
        strip.appendChild(e);
      }
    };
    api.bus.on('run:start', () => { owned.clear(); render(); });
    api.bus.on('perk', p => {
      const o = owned.get(p.name) || { icon: p.icon, legendary: p.legendary, n: 0 };
      o.n++;
      owned.set(p.name, o);
      render();
    });
    api.bus.on('wave:start', render);
  },
};
