const css = `
#revive{background:radial-gradient(ellipse at center,#3a0806b0 0,#010406ee 78%)}
#revive .rv{display:flex;flex-direction:column;align-items:center;gap:10px}
#revive h2{margin:0;font:900 clamp(34px,7vw,50px)/1 var(--display);letter-spacing:3px;color:var(--red);text-shadow:0 4px 18px #000}
#revive .rv-sub{max-width:86vw;font:800 10px var(--ui);letter-spacing:1.8px;color:var(--dim)}
.rv-ring{position:relative;width:82px;height:82px}
.rv-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.rv-ring circle{fill:none;stroke-width:6}
.rv-ring .bg{stroke:#ffffff18}
.rv-ring .fg{stroke:var(--amber);stroke-dasharray:251.3;stroke-linecap:round;transition:stroke-dashoffset .1s linear}
.rv-ring b{position:absolute;inset:0;display:grid;place-items:center;font:900 36px var(--display)}
#rv-yes{padding:16px 30px}
#rv-no{padding:10px 20px;font-size:11px}
#rv-bal{font:800 10px var(--ui);letter-spacing:1.6px;color:var(--dim)}
@media (max-height:430px){#revive .rv{gap:7px}.rv-ring{width:64px;height:64px}.rv-ring b{font-size:28px}#rv-yes{padding:13px 26px}}
`;

export const reviveCost = wave => 150 + Math.max(0, wave - 1) * 25;
const DURATION = 5000;

export default {
  id: 'revive',
  init(api) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const el = document.createElement('section');
    el.id = 'revive';
    el.className = 'screen';
    el.innerHTML = '<div class="rv"><h2>YOU\'RE DOWN</h2><div class="rv-sub">ONE REVIVE PER RUN · 50% HEALTH · NOVA CLEARS NEARBY INFECTED</div>'
      + '<div class="rv-ring"><svg viewBox="0 0 90 90"><circle class="bg" cx="45" cy="45" r="40"/><circle class="fg" cx="45" cy="45" r="40"/></svg><b id="rv-count">5</b></div>'
      + '<button class="cta gold" id="rv-yes"></button><div id="rv-bal"></div><button class="ghost" id="rv-no">GIVE UP</button></div>';
    document.body.appendChild(el);
    api.registerScreen(el);
    const $ = s => el.querySelector(s), fg = $('.fg');
    let used = false, timer = null, cost = 0, until = 0;

    const stop = () => { clearInterval(timer); timer = null; };
    const decline = () => {
      if (api.state.mode !== 'revive') return;
      stop();
      api.showScreen(null);
      api.gameOver();
    };
    const accept = () => {
      if (api.state.mode !== 'revive' || api.profile.scrap < cost) return;
      stop();
      api.profile.scrap -= cost;
      api.saveProfile();
      api.refreshProfileUI();
      api.player.hp = api.player.lagHp = api.stats.maxHp * .5;
      api.state.mode = 'playing';
      api.showScreen(null);
      api.nova(9);
      api.message('REVIVED', 'BACK IN THE FIGHT', 1.8);
      api.sfx.perk();
      api.haptic('HEAVY');
      api.bus.emit('revive', { cost, wave: api.state.wave });
    };
    const tick = () => {
      const left = Math.max(0, until - performance.now());
      $('#rv-count').textContent = Math.ceil(left / 1000);
      fg.style.strokeDashoffset = 251.3 * (1 - left / DURATION);
      if (left <= 0) decline();
    };
    $('#rv-yes').onclick = accept;
    $('#rv-no').onclick = decline;

    api.deathGuards.push(() => {
      const s = api.state;
      if (used || s.runType === 'daily' || s.runType === 'ranked') return false;
      cost = reviveCost(s.wave);
      if (api.profile.scrap < cost) return false;
      used = true;
      s.mode = 'revive';
      $('#rv-yes').textContent = 'REVIVE — 🔩 ' + cost.toLocaleString();
      $('#rv-bal').textContent = 'YOU HAVE 🔩 ' + api.profile.scrap.toLocaleString();
      until = performance.now() + DURATION;
      api.hint('');
      api.showScreen(el);
      api.haptic('HEAVY');
      tick();
      timer = setInterval(tick, 100);
      return true;
    });
    api.bus.on('run:start', () => { used = false; stop(); });
    api.bus.on('run:end', stop);
  },
};
