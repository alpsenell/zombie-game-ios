import { buildSurvivor, decodeLoadout, DEFAULT_LOADOUT } from '../character.js';

const CSS = `
#coop .panel{width:min(94vw,640px)}
.coop-sub{margin:-10px 0 14px;color:var(--dim);font:800 10px var(--ui);letter-spacing:2px}
.coop-pick{display:grid;gap:10px}
.coop-pick .row,#coop .row{justify-content:center}
.coop-code-in{width:96px;padding:14px 8px;border-radius:12px;border:1px solid var(--line);background:#ffffff0d;color:#fff;font:900 16px var(--ui);letter-spacing:4px;text-align:center;text-transform:uppercase;user-select:text;-webkit-user-select:text;touch-action:manipulation}
.coop-note{color:var(--dim);font:600 11px var(--ui)}
.coop-room-head{display:flex;justify-content:center;gap:10px;align-items:baseline;margin-bottom:10px;font:800 11px var(--ui);letter-spacing:2px;color:var(--dim)}
.coop-room-head b{color:var(--amber);font:900 22px var(--display);letter-spacing:5px}
.coop-players{list-style:none;margin:0 0 6px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.coop-players li{padding:8px 6px;border-radius:12px;background:#ffffff0a;border:1px solid var(--line);min-width:0}
.coop-players li.me{border-color:#e5483a88;background:#e5483a1a}
.coop-players li.empty{border-style:dashed;opacity:.5;display:grid;place-items:center;font:800 10px var(--ui);letter-spacing:1.5px;color:var(--dim)}
.coop-players img{width:64px;height:64px;border-radius:10px;background:#0a1418;display:block;margin:0 auto 6px}
.coop-players b{display:block;font:900 14px var(--display);letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.coop-players small{display:block;color:var(--dim);font:700 9px var(--ui);letter-spacing:1px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.coop-players .tag{display:inline-block;margin-top:6px;padding:3px 8px;border-radius:10px;font:900 9px var(--ui);letter-spacing:1.5px;background:#ffffff12;color:var(--dim)}
.coop-players .tag.ready{background:#6dffa022;color:var(--green)}
.coop-players .tag.host{background:#ffc34d22;color:var(--amber)}
.coop-invite{margin:0 0 10px;padding:7px 10px;border-radius:10px;background:#ff3a2a14;border:1px solid #ff3a2a55;color:#ffb0a8;font:800 10px var(--ui);letter-spacing:1.2px}
.coop-status{min-height:16px;margin:6px 0 12px;font:800 11px var(--ui);letter-spacing:1.5px;color:var(--amber)}
.coop-status.err{color:#ff8a7a}
#coop-tags{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.coop-tag{position:absolute;left:0;top:0;text-align:center;white-space:nowrap;will-change:transform}
.coop-tag b{display:block;font:900 12px var(--ui);letter-spacing:1.2px;color:#8fe4ff}
.coop-tag .hp{display:block;width:54px;height:4px;margin:3px auto 0;border-radius:2px;background:#000a;overflow:hidden}
.coop-tag .hp i{display:block;height:100%;background:#4ad8ff;transform-origin:left}
.coop-tag em{display:none;margin-top:2px;font:900 10px var(--ui);letter-spacing:1.5px;color:var(--amber);font-style:normal}
.coop-tag svg{display:none;width:34px;height:34px;margin:2px auto 0}
.coop-tag.down b,.coop-tag.out b{color:var(--amber)}
.coop-tag.down em,.coop-tag.out em,.coop-tag.down svg{display:block}
.coop-ring-bg{fill:none;stroke:#ffffff26;stroke-width:4}
.coop-ring-fg{fill:none;stroke:var(--green);stroke-width:4;stroke-dasharray:88;stroke-dashoffset:88;transform:rotate(-90deg);transform-origin:center}
.coop-arrow{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px}
.coop-arrow i{position:absolute;inset:0}
.coop-arrow i:before{content:"";position:absolute;left:50%;top:-9px;margin-left:-7px;border:7px solid transparent;border-top:0;border-bottom:10px solid #4ad8ff}
.coop-arrow span{position:absolute;inset:3px;display:grid;place-items:center;border-radius:50%;background:#0a3a4acc;border:1px solid #4ad8ff;font:900 11px var(--ui);color:#fff}
.coop-arrow.down i:before{border-bottom-color:var(--amber)}.coop-arrow.down span{border-color:var(--amber);background:#4a3a0acc}
#coop-team{display:grid;gap:6px;width:min(30vw,190px)}
#coop-team .mate{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 8px;font:900 11px var(--ui);letter-spacing:1px}
#coop-team .mate b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfefff}
#coop-team .mate small{font:800 9px var(--ui);letter-spacing:1px;color:var(--dim)}
#coop-team .mate .bar{grid-column:1/-1;height:5px;margin-top:3px}
#coop-team .mate .bar i{background:linear-gradient(90deg,#1f8ab0,#4ad8ff)}
#coop-team .mate.down b,#coop-team .mate.down small{color:var(--amber)}
#coop-team .mate.out{opacity:.5}
#coop-net{position:absolute;right:max(14px,var(--sr));top:calc(max(12px,var(--st)) + 104px);display:flex;align-items:flex-end;gap:2px;font:900 9px var(--ui);letter-spacing:1px;color:var(--dim)}
#coop-net i{width:4px;border-radius:1px;background:#ffffff2a}
#coop-net i:nth-child(1){height:5px}#coop-net i:nth-child(2){height:8px}#coop-net i:nth-child(3){height:11px}#coop-net i:nth-child(4){height:14px}
#coop-net.q4 i,#coop-net.q3 i:nth-child(-n+3){background:var(--green)}
#coop-net.q2 i:nth-child(-n+2){background:var(--amber)}
#coop-net.q1 i:nth-child(1){background:var(--red)}
#coop-net span{margin-left:5px}
#coop-prompt{position:absolute;left:50%;top:71%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:7px 14px;border-radius:12px;background:#050b0ecc;border:1px solid #ffc34d66;font:900 12px var(--ui);letter-spacing:1.6px;color:var(--amber);white-space:nowrap;opacity:0;transition:opacity .2s}
#coop-prompt.on{opacity:1}
#coop-prompt svg{width:30px;height:30px;display:none}
#coop-prompt.ring svg{display:block}
#coop-down{position:absolute;inset:0;display:none;place-items:center;background:radial-gradient(ellipse at center,transparent 30%,rgba(90,0,0,.72))}
#coop-down.on{display:grid}
#coop-down div{text-align:center;margin-top:-22vh}
#coop-down b{display:block;font:900 clamp(30px,7vw,52px)/1 var(--display);letter-spacing:3px;color:#ff5a4a}
#coop-down small{display:block;margin-top:8px;font:900 12px var(--ui);letter-spacing:2.5px;color:var(--amber)}
#coop-down svg{width:44px;height:44px;margin:8px auto 0;display:none}
#coop-down.ring svg{display:block}
#coop-perkwait{margin-top:14px;font:800 11px var(--ui);letter-spacing:2px;color:var(--dim)}
.coop-over{margin:0 0 12px}
.coop-over h3{margin:0 0 4px;font:900 11px var(--ui);letter-spacing:2px;color:var(--amber)}
.coop-over table{width:100%;border-collapse:collapse;font:800 12px var(--ui)}
.coop-over th{padding:2px 6px;font:800 9px var(--ui);letter-spacing:1.3px;color:var(--dim);text-align:right}
.coop-over td{padding:3px 6px;text-align:right;border-top:1px solid #ffffff12}
.coop-over td:first-child,.coop-over th:first-child{text-align:left;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.coop-over img{width:22px;height:22px;border-radius:5px;vertical-align:middle;margin-right:6px}
.coop-over tr.me td{color:#ffb0a8}
#over.coop #newbest,#over.coop #over-rank:empty{display:none}
`;

const RING = '<svg viewBox="0 0 34 34"><circle class="coop-ring-bg" cx="17" cy="17" r="14"/><circle class="coop-ring-fg" cx="17" cy="17" r="14"/></svg>';

export function injectStyles() {
  const s = document.createElement('style');
  s.id = 'coop-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const ring = (svgHost, k) => { const c = svgHost.querySelector('.coop-ring-fg'); if (c) c.style.strokeDashoffset = 88 * (1 - Math.max(0, Math.min(1, k))); };

const portraits = new Map();
export function portrait(api, code) {
  const d = decodeLoadout(code), key = d ? code : 0;
  if (!portraits.has(key)) portraits.set(key, api.preview.thumbnail(d ? d.loadout : DEFAULT_LOADOUT, 96));
  return portraits.get(key);
}

export function createLobby(api, act) {
  const root = el('section', 'screen');
  root.id = 'coop';
  const panel = el('div', 'panel');
  panel.append(el('h2', '', 'CO-OP'), el('div', 'coop-sub', '2–4 SURVIVORS · SHARED WAVES · REVIVE YOUR SQUAD'));
  const pick = el('div', 'coop-pick');
  const gk = el('div', 'row');
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.onclick = () => { api.sfx.init(); fn(); }; return b; };
  gk.append(btn('FIND MATCH', 'cta', () => act.find(false)), btn('INVITE FRIENDS', 'ghost', () => act.find(true)));
  const local = el('div', 'row');
  const code = el('input', 'coop-code-in');
  Object.assign(code, { maxLength: 4, placeholder: 'CODE', autocomplete: 'off', spellcheck: false });
  code.addEventListener('pointerdown', e => e.stopPropagation());
  code.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') act.join(code.value); });
  local.append(btn('HOST LOCAL', 'cta', () => act.host()), code, btn('JOIN LOCAL', 'ghost', () => act.join(code.value)));
  const note = el('div', 'coop-note', 'LOCAL PLAY LINKS BROWSER TABS ON THIS DEVICE — SHARE THE ROOM CODE');
  const perk = el('div', 'coop-invite', '🤝 INVITE A FRIEND · CLEAR WAVE 5 TOGETHER · YOU BOTH EARN THE BLOOD BROTHERS OUTFIT');
  pick.append(perk, gk, local, note);
  const room = el('div', 'hidden');
  const head = el('div', 'coop-room-head');
  const list = el('ul', 'coop-players');
  room.append(head, list);
  const status = el('div', 'coop-status');
  const actions = el('div', 'row');
  const main = btn('READY', 'cta', () => act.main());
  const back = btn('BACK', 'ghost', () => act.back());
  actions.append(main, back);
  panel.append(pick, room, status, actions);
  root.appendChild(panel);
  document.body.appendChild(root);
  api.registerScreen(root);

  return {
    root, code,
    setModes({ gamekit, local: hasLocal }) {
      gk.classList.toggle('hidden', !gamekit);
      local.classList.toggle('hidden', !hasLocal);
      note.classList.toggle('hidden', !hasLocal);
    },
    status(text, err) { status.textContent = text || ''; status.classList.toggle('err', !!err); },
    showPick() {
      pick.classList.remove('hidden'); room.classList.add('hidden');
      main.classList.add('hidden'); back.textContent = 'BACK';
    },
    render(v) {
      pick.classList.add('hidden'); room.classList.remove('hidden');
      head.replaceChildren();
      if (v.room) head.append(document.createTextNode('ROOM'), el('b', '', v.room));
      head.append(document.createTextNode((v.room ? '· ' : '') + v.diff));
      list.replaceChildren();
      for (const p of v.players) {
        const li = el('li', p.me ? 'me' : '');
        const img = el('img'); img.alt = ''; img.src = portrait(api, p.code);
        const d = decodeLoadout(p.code);
        li.append(img, el('b', '', p.name), el('small', '', d ? 'LV ' + d.level + ' · ' + api.TITLES[d.loadout.title] : '—'));
        li.appendChild(el('span', 'tag' + (p.host ? ' host' : p.ready ? ' ready' : ''), p.host ? 'HOST' : p.ready ? 'READY' : 'NOT READY'));
        list.appendChild(li);
      }
      for (let i = v.players.length; i < 4; i++) list.appendChild(el('li', 'empty', v.waiting ? 'WAITING…' : 'OPEN'));
      main.classList.toggle('hidden', !v.mainText);
      main.textContent = v.mainText || '';
      main.disabled = !!v.mainDisabled;
      main.style.opacity = v.mainDisabled ? .45 : '';
      back.textContent = 'LEAVE';
    },
  };
}

export function createHud(api) {
  const hud = api.$('#hud');
  const tags = el('div'); tags.id = 'coop-tags';
  hud.insertBefore(tags, api.$('#floaters').nextSibling);
  const team = el('div'); team.id = 'coop-team';
  api.$('#hud-extras').appendChild(team);
  const net = el('div'); net.id = 'coop-net';
  net.innerHTML = '<i></i><i></i><i></i><i></i>';
  const netText = el('span'); net.appendChild(netText);
  hud.appendChild(net);
  const prompt = el('div'); prompt.id = 'coop-prompt';
  prompt.innerHTML = RING;
  const promptText = el('span'); prompt.appendChild(promptText);
  hud.appendChild(prompt);
  const down = el('div'); down.id = 'coop-down';
  const downBox = el('div'), downTitle = el('b'), downSub = el('small');
  downBox.append(downTitle, downSub);
  downBox.insertAdjacentHTML('beforeend', RING);
  down.appendChild(downBox);
  hud.insertBefore(down, tags);
  const perkWait = el('div'); perkWait.id = 'coop-perkwait';
  api.$('#perk-list').after(perkWait);
  const rows = new Map();
  const parts = [tags, team, net, prompt, down, perkWait];
  const show = on => parts.forEach(p => p.classList.toggle('hidden', !on));
  show(false);

  return {
    tags,
    show,
    team(mates) {
      for (const [id, r] of rows) if (!mates.some(m => m.id === id)) { r.row.remove(); rows.delete(id); }
      for (const m of mates) {
        let r = rows.get(m.id);
        if (!r) {
          const row = el('div', 'mate'), name = el('b'), st = el('small'), bar = el('div', 'bar'), fill = el('i');
          bar.appendChild(fill); row.append(name, st, bar); team.appendChild(row);
          r = { row, name, st, fill }; rows.set(m.id, r);
        }
        r.name.textContent = m.name;
        r.row.className = 'mate' + (m.st === 1 ? ' down' : m.st === 2 ? ' out' : '');
        r.st.textContent = m.st === 1 ? 'DOWNED ' + Math.ceil(m.bleed) + 'S' : m.st === 2 ? 'OUT' : Math.ceil(m.hp);
        r.fill.style.transform = `scaleX(${m.st ? 0 : Math.max(0, Math.min(1, m.hp / (m.maxHp || 100)))})`;
      }
    },
    net(q, text) { net.className = 'q' + q; netText.textContent = text; },
    prompt(text, k) {
      prompt.classList.toggle('on', !!text);
      prompt.classList.toggle('ring', k != null);
      if (text) promptText.textContent = text;
      if (k != null) ring(prompt, k);
    },
    down(title, sub, k) {
      down.classList.toggle('on', !!title);
      down.classList.toggle('ring', k != null);
      if (!title) return;
      downTitle.textContent = title; downSub.textContent = sub;
      if (k != null) ring(down, k);
    },
    perkWait(text) { perkWait.textContent = text || ''; },
  };
}

const flashTexture = (() => {
  let tex = null;
  return THREE => {
    if (tex) return tex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d'), g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.3, 'rgba(255,200,110,.85)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

export class Avatar {
  constructor(api, p, layer) {
    this.api = api;
    this.p = p;
    const { THREE } = api;
    this.root = new THREE.Group();
    this.root.position.set(p.x, 0, p.z);
    api.scene.add(this.root);
    this.x = p.x; this.z = p.z; this.yaw = p.yaw; this.walk = 0; this.flashT = 0; this.key = '';
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(THREE), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flash.scale.setScalar(.55);
    this.flash.visible = false;
    this.tag = el('div', 'coop-tag');
    this.tagName = el('b');
    const hp = el('i', 'hp'); this.tagHp = el('i'); hp.appendChild(this.tagHp);
    this.tagState = el('em');
    this.tag.append(this.tagName, hp, this.tagState);
    this.tag.insertAdjacentHTML('beforeend', RING);
    this.arrow = el('div', 'coop-arrow');
    this.arrowDir = el('i');
    this.arrowTag = el('span');
    this.arrow.append(this.arrowDir, this.arrowTag);
    layer.append(this.tag, this.arrow);
    this.v = new THREE.Vector3();
    this.aim = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this.rebuild();
  }
  rebuild() {
    const p = this.p, d = decodeLoadout(p.code), l = { ...(d ? d.loadout : DEFAULT_LOADOUT) };
    if (this.api.WEAPONS[p.weapon]) l.primary = p.weapon;
    const key = (p.code || 0) + ':' + l.primary;
    if (key === this.key) return;
    this.key = key;
    if (this.model) this.root.remove(this.model);
    this.model = buildSurvivor(l);
    this.model.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.body = this.model.children[0];
    this.legs = this.body.children.slice(0, 2);
    const w = this.api.WEAPONS[l.primary] || this.api.WEAPONS[0], gun = this.model.userData.gun;
    this.flash.position.set(0, .02, -w.muzzle + .06);
    gun.add(this.flash);
    this.root.add(this.model);
  }
  fire() {
    const { api } = this;
    this.flashT = .06;
    this.flash.material.rotation = Math.random() * 6;
    this.model.updateMatrixWorld(true);
    const from = this.flash.getWorldPosition(this.v).clone();
    const cp = Math.cos(this.p.pitch);
    this.aim.set(-Math.sin(this.yaw) * cp, Math.sin(this.p.pitch), -Math.cos(this.yaw) * cp);
    this.ray.set(from, this.aim);
    this.ray.far = 40;
    const hit = this.ray.intersectObjects(api.zombies.filter(z => !z.userData.dead), true)[0];
    const to = hit ? hit.point : from.clone().addScaledVector(this.aim, 40);
    api.netHooks.tracer(from, to, 0xffe3a8, .02, .05);
  }
  update(dt, camera, look, W, H) {
    const p = this.p, k = Math.min(1, dt * 10);
    this.rebuild();
    const jump = Math.hypot(p.x - this.x, p.z - this.z) > 4;
    const px = this.x, pz = this.z;
    this.x = jump ? p.x : this.x + (p.x - this.x) * k;
    this.z = jump ? p.z : this.z + (p.z - this.z) * k;
    let dy = p.yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 14);
    const speed = jump || !dt ? 0 : Math.hypot(this.x - px, this.z - pz) / dt;
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw + Math.PI;
    const downed = p.st !== 0;
    this.model.rotation.x = downed ? -1.35 : 0;
    this.model.position.y = downed ? .16 : 0;
    const amp = downed ? 0 : Math.min(1, speed / 2.5);
    this.walk += dt * (2 + speed * 2.6);
    const s = Math.sin(this.walk), c = Math.cos(this.walk);
    this.legs.forEach((leg, i) => {
      leg.rotation.x = (i ? -s : s) * .65 * amp;
      const knee = leg.children[1];
      if (knee) knee.rotation.x = Math.max(0, i ? -c : c) * .9 * amp;
    });
    this.body.position.y = Math.abs(s) * .035 * amp;
    const torso = this.model.userData.torso;
    torso.rotation.x = downed ? .5 : -Math.max(-.9, Math.min(.9, p.pitch)) * .45;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;

    const dist = Math.hypot(camera.position.x - this.x, camera.position.z - this.z);
    this.v.set(this.x, downed ? .75 : 2.12, this.z).project(camera);
    const on = this.v.z < 1 && Math.abs(this.v.x) < 1.02 && Math.abs(this.v.y) < 1.02;
    this.tag.className = 'coop-tag' + (p.st === 1 ? ' down' : p.st === 2 ? ' out' : '') + (on ? '' : ' hidden');
    this.tagName.textContent = p.name + (dist > 12 ? ' · ' + Math.round(dist) + 'M' : '');
    this.tagHp.style.transform = `scaleX(${p.st ? 0 : Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)))})`;
    this.tagState.textContent = p.st === 1 ? (p.rev > 0 ? 'REVIVING' : 'DOWNED · ' + Math.ceil(p.bleed) + 'S') : p.st === 2 ? 'OUT' : '';
    if (p.st === 1) ring(this.tag, p.rev || 0);
    if (on) this.tag.style.transform = `translate(${(this.v.x * .5 + .5) * W}px,${(-this.v.y * .5 + .5) * H}px) translate(-50%,-100%)`;
    this.arrow.classList.toggle('hidden', on);
    this.arrow.classList.toggle('down', p.st !== 0);
    if (!on) {
      const dx = this.x - camera.position.x, dz = this.z - camera.position.z;
      const f = dx * -Math.sin(look.yaw) + dz * -Math.cos(look.yaw), r = dx * Math.cos(look.yaw) + dz * -Math.sin(look.yaw);
      const a = Math.atan2(r, f);
      const ax = W / 2 + Math.sin(a) * (W / 2 - 34), ay = H / 2 - Math.cos(a) * (H / 2 - 34);
      this.arrow.style.transform = `translate(${ax}px,${ay}px)`;
      this.arrowDir.style.transform = `rotate(${a}rad)`;
      this.arrowTag.textContent = (p.name || '?')[0];
    }
  }
  dispose() {
    this.api.scene.remove(this.root);
    this.tag.remove();
    this.arrow.remove();
  }
}

export function overTable(api, v) {
  const box = el('div', 'coop-over');
  box.appendChild(el('h3', '', 'SQUAD · WAVE ' + v.wave + ' · ' + v.score.toLocaleString() + ' PTS'));
  const table = el('table'), head = el('tr');
  for (const h of ['SURVIVOR', 'KILLS', 'HEADS', 'REVIVES', 'DOWNS', 'ACC']) head.appendChild(el('th', '', h));
  table.appendChild(head);
  for (const p of v.players) {
    const tr = el('tr', p.me ? 'me' : '');
    const name = el('td');
    const img = el('img'); img.alt = ''; img.src = portrait(api, p.code);
    name.append(img, document.createTextNode(p.name + (p.left ? ' (LEFT)' : '')));
    tr.appendChild(name);
    for (const n of [p.kills, p.heads, p.revives, p.downs, p.acc + '%']) tr.appendChild(el('td', '', String(n)));
    table.appendChild(tr);
  }
  box.appendChild(table);
  return box;
}
