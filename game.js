import * as THREE from './vendor/three.module.js';
import { createBus, rng, R, hashSeed, mulberry32 } from './core.js';
import { MAPS } from './maps.js';
import { FEATURES } from './features/index.js';
import { WEAPONS, STORE_PREFIX, buildGun, weaponIndex, weaponStats, WOOD, woodStock } from './weapons.js';
import { SLOTS, EXTRA_SLOTS, LOCKER_GROUPS, BODY, TITLES, DEFAULT_LOADOUT, encodeLoadout, decodeLoadout, describeLoadout, createPreview, paintGunMaterials, outfitColors } from './character.js';

const $ = s => document.querySelector(s);
const bus = createBus();
const ui = {
  hud: $('#hud'), menu: $('#menu'), pauseMenu: $('#pausemenu'), settings: $('#settings'), perks: $('#perks'), over: $('#over'), board: $('#board'), locker: $('#locker'), inspect: $('#inspect'), armory: $('#armory'),
  hpNum: $('#hp-num'), hpFill: $('#hp-fill'), hpLag: $('#hp-lag'), waveNum: $('#wave-num'), alive: $('#alive'), waveFill: $('#wave-fill'),
  score: $('#score'), combo: $('#combo'), radar: $('#radar'), bossBar: $('#bossbar'), bossName: $('#boss-name'), bossFill: $('#boss-fill'),
  crosshair: $('#crosshair'), hit: $('#hit'), ring: $('#reticle-ring'), message: $('#message'), toast: $('#toast'), floaters: $('#floaters'),
  damage: $('#damage'), lowhp: $('#lowhp'), edge: $('#edge'), indicators: $('#indicators'), stickZone: $('#stick-zone'), stick: $('#stick'), dot: $('#stick-dot'),
  gunName: $('#gun-name'), ammo: $('#ammo'), fire: $('#fire'), reload: $('#reload'), reloadRing: $('#reload .ring circle'),
  grenade: $('#grenade'), nades: $('#nades'), swap: $('#swap'), pause: $('#pause'), hint: $('#hint'), perkList: $('#perk-list'), perkTitle: $('#perk-title'), perkSub: $('#perk-sub'),
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('deadzone.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('deadzone.' + k, JSON.stringify(v)); } catch {} },
};
const settings = Object.assign({ sensitivity: 1, aimAssist: true, autoFire: false, invert: false, sound: true, haptics: true, difficulty: 'survivor' }, store.get('settings', {}));
const records = Object.assign({ score: 0, wave: 0, rank: 0 }, store.get('records', {}));
let tutorialDone = store.get('tutorial', false);

const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1820, .03);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, .05, 140);
camera.rotation.order = 'YXZ';
scene.add(camera);

const preview = createPreview();
const viewScene = new THREE.Scene();
const viewCam = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, .01, 10);
viewScene.add(new THREE.HemisphereLight(0xb8dcea, 0x3a2c20, 2.6));
const viewSun = new THREE.DirectionalLight(0xcfe8ff, 3.2);
viewSun.position.set(-1, 2, 1);
viewScene.add(viewSun);
const viewRim = new THREE.DirectionalLight(0xff9a5a, 2.2);
viewRim.position.set(2, .5, -2);
viewScene.add(viewRim);

const timer = new THREE.Timer();
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
const zombies = [], obstacles = [], solids = [], pickups = [], grenades = [], scheduled = [];

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = viewCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  viewCam.updateProjectionMatrix();
  placeStickHome();
}
const onResize = () => { resize(); placePreview(); };
addEventListener('resize', onResize);
addEventListener('orientationchange', () => [120, 400, 800].forEach(t => setTimeout(onResize, t)));
window.visualViewport?.addEventListener('resize', onResize);

const matCache = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .05, ...o }));
  return matCache.get(key);
}
function mesh(geo, material, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function lumpy(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const n = (h - Math.floor(h)) - .5;
    p.setXYZ(i, x * (1 + n * amt), y * (1 + n * amt * .6), z * (1 + n * amt));
  }
  geo.computeVertexNormals();
  return geo;
}
function mergeGeos(items) {
  let count = 0;
  const prepared = items.map(({ geo, matrix, color }) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    count += g.attributes.position.count;
    return { g, color };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const c = new THREE.Color();
  let off = 0;
  for (const { g, color } of prepared) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    c.setHex(color ?? 0xffffff);
    for (let i = 0; i < n; i++) { col[(off + i) * 3] = c.r; col[(off + i) * 3 + 1] = c.g; col[(off + i) * 3 + 2] = c.b; }
    off += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
function bakeStatic(roots, parent = scene) {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const root of roots) root.traverse(o => {
    if (!o.isMesh || o.material.map || o.material.transparent) return;
    const key = o.material.uuid + (o.castShadow ? '|s' : '');
    if (!groups.has(key)) groups.set(key, { material: o.material, shadow: o.castShadow, items: [] });
    groups.get(key).items.push({ geo: o.geometry, matrix: o.matrixWorld.clone() });
    o.visible = false;
  });
  for (const { material, shadow, items } of groups.values()) {
    const m = new THREE.Mesh(mergeGeos(items), material);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
  }
}
function canvasTexture(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function gritTexture(base, accent, rx, ry) {
  return canvasTexture(256, 256, (cx) => {
    cx.fillStyle = base; cx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      cx.fillStyle = accent; cx.globalAlpha = Math.random() * .16;
      const s = Math.random() * 3; cx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    cx.globalAlpha = 1;
    for (let i = 0; i < 18; i++) {
      cx.strokeStyle = 'rgba(0,0,0,.18)'; cx.lineWidth = Math.random() * 2;
      cx.beginPath(); cx.moveTo(Math.random() * 256, Math.random() * 256); cx.lineTo(Math.random() * 256, Math.random() * 256); cx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const g = cx.createRadialGradient(0, 0, 0, 0, 0, 30);
      g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.save(); cx.translate(Math.random() * 256, Math.random() * 256); cx.fillStyle = g; cx.fillRect(-30, -30, 60, 60); cx.restore();
    }
  }, [rx, ry]);
}
const glowTex = canvasTexture(64, 64, (cx) => {
  const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,220,160,.8)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
});
const flashTex = canvasTexture(128, 128, (cx) => {
  cx.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    cx.rotate(Math.PI * 2 / 7);
    const g = cx.createLinearGradient(0, 0, 0, -60);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(-7, 0); cx.lineTo(0, -40 - Math.random() * 22); cx.lineTo(7, 0); cx.fill();
  }
  const g = cx.createRadialGradient(0, 0, 0, 0, 0, 26);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(1, 'rgba(255,170,60,0)');
  cx.fillStyle = g; cx.fillRect(-26, -26, 52, 52);
});
const splatTex = canvasTexture(128, 128, (cx) => {
  cx.translate(64, 64); cx.fillStyle = '#5a0605';
  cx.beginPath(); cx.arc(0, 0, 30, 0, 7); cx.fill();
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 7, d = 22 + Math.random() * 30, r = 4 + Math.random() * 10;
    cx.beginPath(); cx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 7); cx.fill();
  }
});

const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
scene.add(sky);
function skyTexture(stops) {
  return canvasTexture(8, 256, (cx) => {
    const g = cx.createLinearGradient(0, 0, 0, 256);
    for (const [t, c] of stops) g.addColorStop(t, c);
    cx.fillStyle = g; cx.fillRect(0, 0, 8, 256);
  });
}
const stars = (() => {
  const n = 350, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = .15 + Math.random() * 1.3;
    pos.set([Math.cos(a) * Math.cos(e) * 88, Math.sin(e) * 88, Math.sin(a) * Math.cos(e) * 88], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: .7 }));
  scene.add(p);
  return p;
})();
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), new THREE.MeshBasicMaterial({ color: 0xd6efff, fog: false }));
moonDisc.position.set(-24, 34, -70);
scene.add(moonDisc);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8fc9ff, fog: false, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
moonHalo.position.copy(moonDisc.position); moonHalo.scale.setScalar(26);
scene.add(moonHalo);
const moon = new THREE.DirectionalLight(0x9fdaff, 2.6);
moon.position.set(-18, 28, -15);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 90 });
scene.add(moon);
const hemi = new THREE.HemisphereLight(0x8bbfd2, 0x2a2016, 1.5);
scene.add(hemi);

const fires = [];
const world = { group: null, map: null, tex: [] };
let bounds = MAPS[0].bounds;
const edge = { t: 0, side: 0 };
function worldCtx(group) {
  const track = t => (world.tex.push(t), t);
  return {
    THREE, mat, lumpy, glowTex,
    mesh: (geo, material, x, y, z, parent = group) => mesh(geo, material, x, y, z, parent),
    grit: (...a) => track(gritTexture(...a)), canvas: (...a) => track(canvasTexture(...a)),
    add: o => (group.add(o), o), solid: o => (solids.push(o), o), block: (x, z, w, d) => obstacles.push({ x, z, w, d }),
    animate: f => fires.push(f),
  };
}
function clearWorld() {
  if (!world.group) return;
  scene.remove(world.group);
  const cached = new Set(matCache.values());
  world.group.traverse(o => {
    if (!o.isSprite) o.geometry?.dispose();
    if (o.material && !cached.has(o.material)) o.material.dispose();
  });
  for (const t of world.tex) t.dispose();
  world.tex.length = obstacles.length = solids.length = fires.length = 0;
  world.group = null;
}
function applyEnv(map) {
  const E = map.env;
  sky.material.map?.dispose();
  sky.material.map = skyTexture(map.sky); sky.material.needsUpdate = true;
  stars.visible = E.stars > 0; stars.material.opacity = E.stars;
  moonDisc.position.set(...E.moon.pos); moonDisc.material.color.setHex(E.moon.color); moonDisc.scale.setScalar(E.moon.size);
  moonHalo.position.copy(moonDisc.position); moonHalo.material.color.setHex(E.moon.halo); moonHalo.material.opacity = E.moon.opacity; moonHalo.scale.setScalar(E.moon.haloSize);
  moon.color.setHex(E.key); moon.intensity = E.keyI; moon.position.set(...E.keyPos);
  hemi.color.setHex(E.hemi[0]); hemi.groundColor.setHex(E.hemi[1]); hemi.intensity = E.hemi[2];
  renderer.toneMappingExposure = E.exposure;
  embers.points.material.color.setHex(E.embers);
  scene.fog.color.setHex(map.fog.color); scene.fog.density = map.fog.density;
}
function loadMap(id) {
  const map = MAPS.find(m => m.id === id) || world.map || MAPS[0];
  if (map === world.map) return false;
  clearWorld();
  for (const d of decals) d.visible = false;
  world.map = map; bounds = map.bounds;
  world.group = new THREE.Group(); world.group.name = 'world';
  scene.add(world.group);
  applyEnv(map);
  map.build(worldCtx(world.group), map.bounds);
  bakeStatic([world.group], world.group);
  buildNav();
  return true;
}

function blocked(x, z, r = .32) {
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return true;
  for (const o of obstacles) if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r) return true;
  return false;
}

const NAV = { minX: 0, minZ: 0, w: 0, h: 0, cell: -1, t: 0, builds: 0 };
function buildNav() {
  NAV.minX = Math.round(bounds.minX); NAV.minZ = Math.round(bounds.minZ);
  NAV.w = Math.round(bounds.maxX) - NAV.minX + 1; NAV.h = Math.round(bounds.maxZ) - NAV.minZ + 1;
  const n = NAV.w * NAV.h;
  NAV.solid = new Uint8Array(n);
  NAV.dist = new Int32Array(n).fill(-1);
  NAV.queue = new Int32Array(n);
  NAV.cell = -1; NAV.builds++;
  for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) NAV.solid[j * NAV.w + i] = blocked(NAV.minX + i, NAV.minZ + j, .5) ? 1 : 0;
}
function navCell(x, z) {
  const i = Math.round(x - NAV.minX), j = Math.round(z - NAV.minZ);
  return i < 0 || j < 0 || i >= NAV.w || j >= NAV.h ? -1 : j * NAV.w + i;
}
function updateNav(x, z) {
  const start = navCell(x, z);
  if (start < 0 || start === NAV.cell) return;
  NAV.cell = start;
  const { w, h, solid, dist, queue } = NAV;
  dist.fill(-1);
  dist[start] = 0;
  let head = 0, tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    const c = queue[head++], ci = c % w, cj = (c - ci) / w, nd = dist[c] + 1;
    if (ci > 0 && !solid[c - 1] && dist[c - 1] < 0) { dist[c - 1] = nd; queue[tail++] = c - 1; }
    if (ci < w - 1 && !solid[c + 1] && dist[c + 1] < 0) { dist[c + 1] = nd; queue[tail++] = c + 1; }
    if (cj > 0 && !solid[c - w] && dist[c - w] < 0) { dist[c - w] = nd; queue[tail++] = c - w; }
    if (cj < h - 1 && !solid[c + w] && dist[c + w] < 0) { dist[c + w] = nd; queue[tail++] = c + w; }
  }
}
function navStep(x, z) {
  const c = navCell(x, z);
  if (c < 0) return null;
  const { w, dist } = NAV;
  let best = -1, bd = dist[c] < 0 ? 1e9 : dist[c];
  const ci = c % w;
  for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ni = ci + di;
    if (ni < 0 || ni >= w) continue;
    const n = c + dj * w + di;
    if (n < 0 || n >= dist.length || dist[n] < 0) continue;
    if (di && dj && (dist[c + di] < 0 || dist[c + dj * w] < 0)) continue;
    const nd = dist[n] + (di && dj ? .4 : 0);
    if (nd < bd) { bd = nd; best = n; }
  }
  if (best < 0) return null;
  const bi = best % w;
  return { x: NAV.minX + bi, z: NAV.minZ + (best - bi) / w };
}
function lineClear(x0, z0, x1, z1, r = .3) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .7);
  for (let k = 1; k < n; k++) if (blocked(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, r)) return false;
  return true;
}

const sfx = (() => {
  let ctx, master, noiseBuf;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = settings.sound ? .8 : 0; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  }
  function ok() { return ctx && settings.sound && ctx.state === 'running'; }
  function env(vol, dur, attack = .004) {
    const g = ctx.createGain(), t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    g.connect(master); return g;
  }
  function noise(dur, freq, vol, type = 'lowpass', q = .8, sweep) {
    if (!ok()) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, ctx.currentTime + dur);
    src.connect(f).connect(env(vol, dur)); src.start(); src.stop(ctx.currentTime + dur);
  }
  function tone(freq, dur, type, vol, slide, attack) {
    if (!ok()) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + dur);
    o.connect(env(vol, dur, attack)); o.start(); o.stop(ctx.currentTime + dur);
  }
  function groan(vol) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = .8 + Math.random() * .7;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70 + Math.random() * 50;
    o.frequency.linearRampToValueAtTime(50 + Math.random() * 30, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6 + Math.random() * 5; lg.gain.value = 14;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 2.2;
    o.connect(f).connect(env(vol, dur, .15)); o.start(); lfo.start(); o.stop(t + dur); lfo.stop(t + dur);
  }
  return {
    init,
    setEnabled(on) { if (master) master.gain.value = on ? .8 : 0; },
    rifle() { noise(.16, 2400, .55, 'lowpass', .7, 400); tone(160, .09, 'square', .12, 55); },
    shotgun() { noise(.4, 1500, .9, 'lowpass', .6, 180); tone(95, .22, 'sawtooth', .25, 35); },
    dry() { tone(1300, .03, 'square', .06); },
    hit() { tone(900, .045, 'square', .05, 600); },
    head() { tone(1500, .08, 'triangle', .09, 2100); },
    kill() { tone(420, .12, 'triangle', .08, 180); noise(.15, 700, .2, 'bandpass', 1.5); },
    hurt() { tone(80, .2, 'sawtooth', .2, 45); noise(.12, 500, .25); },
    reload() { tone(260, .05, 'square', .05); setTimeout(() => tone(180, .06, 'square', .05), 140); },
    reloaded() { tone(520, .05, 'square', .05); setTimeout(() => tone(700, .05, 'square', .05), 70); },
    pump() { noise(.08, 1800, .25, 'bandpass', 2); setTimeout(() => noise(.08, 1200, .25, 'bandpass', 2), 130); },
    swap() { noise(.1, 2500, .15, 'highpass', 1); },
    pickup() { tone(660, .08, 'triangle', .1); setTimeout(() => tone(990, .12, 'triangle', .1), 70); },
    throw() { noise(.2, 900, .15, 'bandpass', 1, 2400); },
    smg() { noise(.1, 3200, .4, 'lowpass', .7, 700); tone(210, .06, 'square', .08, 90); },
    cannon() { noise(.35, 1400, 1, 'lowpass', .6, 120); tone(70, .3, 'sawtooth', .3, 30); },
    sniper() { noise(.6, 2600, 1, 'lowpass', .5, 90); tone(120, .35, 'square', .2, 40); },
    thump() { tone(160, .15, 'sine', .4, 60); noise(.12, 600, .3, 'lowpass', 1); },
    flame() { noise(.12, 900, .22, 'bandpass', .8, 1600); },
    zap() { tone(1800, .12, 'sawtooth', .07, 300); noise(.1, 5000, .2, 'highpass', 2); },
    cryo() { noise(.1, 6000, .14, 'highpass', 1.5, 3000); tone(2400, .06, 'sine', .03, 1800); },
    void() { tone(90, 1.2, 'sine', .45, 30); tone(180, 1.2, 'triangle', .12, 40); noise(1, 400, .3, 'lowpass', 1, 80); },
    minigun() { noise(.07, 2800, .35, 'lowpass', .7, 500); tone(150, .05, 'square', .06, 70); },
    spit() { noise(.25, 700, .35, 'bandpass', 3, 1800); tone(220, .2, 'sawtooth', .06, 90); },
    sizzle() { noise(.2, 3200, .12, 'highpass', 1); },
    scream() { tone(620, .9, 'sawtooth', .1, 1500, .25); tone(655, .9, 'sawtooth', .08, 1620, .3); noise(.9, 2600, .2, 'bandpass', 3, 4800); },
    hiss() { noise(.45, 5200, .16, 'highpass', 1.5, 2600); },
    swell() { tone(120, .55, 'sine', .3, 380); noise(.5, 320, .22, 'lowpass', 2, 900); },
    boom() { noise(1.2, 900, 1.1, 'lowpass', .5, 60); tone(55, .8, 'sine', .5, 28); },
    wave() { tone(110, 1.2, 'sawtooth', .12, 104, .2); tone(165, 1.2, 'sawtooth', .08, 160, .2); },
    clear() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .09), i * 90)); },
    perk() { tone(784, .15, 'triangle', .1, 1175); },
    roar() { groan(.5); setTimeout(() => groan(.45), 120); noise(1, 300, .4, 'lowpass', 1); },
    groan,
    heartbeat() { tone(60, .12, 'sine', .35); setTimeout(() => tone(52, .14, 'sine', .28), 180); },
  };
})();

let lastHaptic = 0;
function haptic(style = 'LIGHT') {
  if (!settings.haptics) return;
  const now = performance.now();
  if (style === 'LIGHT' && now - lastHaptic < 70) return;
  lastHaptic = now;
  const cap = window.Capacitor;
  if (cap?.nativePromise && cap.PluginHeaders?.some(h => h.name === 'Haptics')) cap.nativePromise('Haptics', 'impact', { style }).catch(() => {});
  else navigator.vibrate?.(style === 'HEAVY' ? 45 : style === 'MEDIUM' ? 22 : 10);
}

function particleSystem(count, size, additive) {
  const pos = new Float32Array(count * 3).fill(-999), col = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size, vertexColors: true, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, map: additive ? glowTex : null,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const data = Array.from({ length: count }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, r: 0, g: 0, b: 0, max: 1 }));
  let cursor = 0;
  return {
    emit(x, y, z, n, o) {
      for (let k = 0; k < n; k++) {
        const i = cursor = (cursor + 1) % count, p = data[i], sp = o.speed * (.35 + Math.random() * .65);
        const dx = (o.dir?.x ?? 0) + (Math.random() - .5) * o.spread, dy = (o.dir?.y ?? .4) + (Math.random() - .5) * o.spread, dz = (o.dir?.z ?? 0) + (Math.random() - .5) * o.spread;
        const l = Math.hypot(dx, dy, dz) || 1;
        p.vx = dx / l * sp; p.vy = dy / l * sp; p.vz = dz / l * sp;
        p.life = p.max = o.life * (.6 + Math.random() * .4); p.grav = o.grav ?? 9; p.drag = o.drag ?? .5;
        const c = o.colors[(Math.random() * o.colors.length) | 0];
        p.r = (c >> 16 & 255) / 255; p.g = (c >> 8 & 255) / 255; p.b = (c & 255) / 255;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        const p = data[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { pos[i * 3 + 1] = -999; continue; }
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * dt;
        pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
        if (pos[i * 3 + 1] < .02) { pos[i * 3 + 1] = .02; p.vx *= .5; p.vz *= .5; p.vy = 0; }
        const f = additive ? p.life / p.max : 1;
        col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
      }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
  };
}
const gore = particleSystem(500, .09, false);
const sparks = particleSystem(400, .16, true);
const embers = (() => {
  const n = 220, pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos.set([(Math.random() - .5) * 50, Math.random() * 14, (Math.random() - .5) * 50], i * 3); vel.push(.2 + Math.random() * .5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff9a4a, size: .07, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.frustumCulled = false; scene.add(p);
  return {
    points: p,
    update(dt, t) {
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] += vel[i] * dt;
        pos[i * 3] += Math.sin(t * .7 + i) * dt * .3;
        if (pos[i * 3 + 1] > 14) { pos[i * 3 + 1] = 0; pos[i * 3] = camera.position.x + (Math.random() - .5) * 50; pos[i * 3 + 2] = camera.position.z + (Math.random() - .5) * 50; }
      }
      g.attributes.position.needsUpdate = true;
    },
  };
})();

const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe3a8, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
const tracerGeo = new THREE.BoxGeometry(1, 1, 1); tracerGeo.translate(0, 0, -.5);
const tracers = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(tracerGeo, tracerMat.clone()); m.visible = false; m.userData.t = 0; scene.add(m); return m; });
let tracerCursor = 0;
function tracer(from, to, color = 0xffe3a8, width = .018, life = .045) {
  const t = tracers[tracerCursor = (tracerCursor + 1) % tracers.length];
  const len = from.distanceTo(to);
  t.position.copy(from); t.lookAt(to); t.scale.set(width, width, len);
  t.material.color.setHex(color);
  t.visible = true; t.userData.t = life;
}
const decals = Array.from({ length: 36 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - i * .01 }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; m.userData.t = 0; scene.add(m); return m;
});
let decalCursor = 0;
function decal(x, z, size, color = 0xffffff) {
  const d = decals[decalCursor = (decalCursor + 1) % decals.length];
  d.position.set(x, .025 + decalCursor * .0004, z); d.rotation.z = Math.random() * 7; d.scale.setScalar(size);
  d.material.color.setHex(color); d.material.opacity = .92; d.visible = true; d.userData.t = 24;
}
const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
blast.visible = false; scene.add(blast);
const blastLight = new THREE.PointLight(0xff8a30, 0, 22, 2); scene.add(blastLight);
const muzzleWorld = new THREE.PointLight(0xffb060, 0, 9, 2); camera.add(muzzleWorld); muzzleWorld.position.set(.3, -.1, -1);

const ZT = {
  walker: { name: 'WALKER', hp: 80, speed: 1.15, dmg: 7, scale: 1, bulk: 1, score: 100, lean: .22, stride: 6.5, eye: 0xffb23f, drop: .12, mix: [0, 0, 10, 10] },
  runner: { name: 'RUNNER', hp: 48, speed: 3.1, dmg: 5, scale: .94, bulk: .85, score: 150, lean: .6, stride: 11, eye: 0xff2a1a, drop: .12, mix: [0, 2, 1.2, 6], intro: 'Fast and fragile' },
  crawler: { name: 'CRAWLER', hp: 60, speed: 1.8, dmg: 6, scale: 1, bulk: 1, score: 175, lean: 1.35, stride: 7, eye: 0xffe14a, drop: .15, crawl: true, lunge: 1, aimY: .4, mix: [0, 3, 1, 4], intro: 'Low to the ground — aim down' },
  spitter: { name: 'SPITTER', hp: 70, speed: 1.3, dmg: 6, scale: 1.02, bulk: .9, score: 250, lean: .35, stride: 6, eye: 0x7dff3a, drop: .25, ranged: true, sacs: 3, skin: 0x7f9a62, mix: [0, 4, .6, 3], intro: 'Spits acid from range — keep moving' },
  bloater: { name: 'BLOATER', hp: 140, speed: .95, dmg: 0, scale: 1.1, bulk: 1.65, score: 300, lean: .05, stride: 4.5, eye: 0xff8a1a, drop: .3, explode: true, sacs: 7, skin: 0x9a8a6a, mix: [0, 6, .6, 3], intro: 'Swells and bursts — shoot it from a distance' },
  riot: { name: 'RIOT', hp: 150, speed: 1.2, dmg: 10, scale: 1.05, bulk: 1.1, score: 350, lean: .15, stride: 6, eye: 0x6ad8ff, drop: .3, armor: .3, helmet: true, mix: [0, 7, .5, 3], intro: 'Armored body — go for the head' },
  brute: { name: 'BRUTE', hp: 420, speed: .9, dmg: 17, scale: 1.4, bulk: 1.35, score: 450, lean: .12, stride: 4.4, eye: 0x7dff5a, drop: .55, spikes: 3, mix: [0, 8, .4, 2.5], intro: 'Tough as nails — save a grenade' },
  screamer: { name: 'SCREAMER', hp: 65, speed: 1.25, dmg: 5, scale: 1.14, bulk: .7, score: 300, lean: -.05, stride: 5.5, eye: 0xff3ad0, drop: .3, scream: true, skin: 0xd9d2c6, cloth: 0x8c8294, radar: '#ff5ad8', mix: [1, 6, .35, 1.4], cap: [2, 10], intro: 'Its scream speeds up the horde — headshot interrupts it' },
  shield: { name: 'SHIELDBEARER', hp: 170, speed: 1.1, dmg: 11, scale: 1.08, bulk: 1.12, score: 375, lean: .08, stride: 5.5, eye: 0xffd23a, drop: .3, armor: .12, shield: true, helmet: true, turn: 1.7, armorColor: 0x1b2330, radar: '#6a9cff', mix: [2, 6, .5, 2.4], intro: 'Shield stops frontal fire — flank it, headshot it or blow it up' },
  stalker: { name: 'STALKER', hp: 85, speed: 2.6, dmg: 9, scale: 1.02, bulk: .78, score: 350, lean: .55, stride: 10, eye: 0x9ffff0, drop: .25, stalk: true, claws: true, skin: 0x2b2438, cloth: 0x120e18, radar: '#b58cff', mix: [3, 7, .5, 2.5], intro: 'Fades from sight and flanks — watch for its eyes' },
  juggernaut: { name: 'JUGGERNAUT', hp: 650, speed: .85, dmg: 18, scale: 1.6, bulk: 1.42, score: 450, lean: .1, stride: 3.8, eye: 0xff6a1a, drop: .8, charge: true, chargeSpeed: 9.5, plated: true, armor: .55, spikes: 4, armorColor: 0x6a3a1c, radar: '#ffb21a', mix: [3, 8, .25, 1], cap: [1, 12], intro: 'Charges through anything — sidestep, then punish the stun' },
  abomination: { boss: true, name: 'ABOMINATION', hp: 2600, speed: 1.15, dmg: 30, scale: 2.3, bulk: 1.3, score: 3000, lean: .18, stride: 3.6, eye: 0xd35bff, drop: 1, spikes: 5, slam: true, intro: 'Ground slam — back off when the ring appears' },
  butcher: { boss: true, name: 'THE BUTCHER', hp: 2400, speed: 1.35, dmg: 34, scale: 2.1, bulk: 1.2, score: 3500, lean: .25, stride: 4.2, eye: 0xff2a1a, drop: 1, charge: true, cleaver: true, cloth: 0x6a1410, intro: 'Charges — sidestep, then punish while stunned' },
  plague: { boss: true, name: 'PLAGUE KING', hp: 2800, speed: 1, dmg: 26, scale: 2.2, bulk: 1.25, score: 4000, lean: .2, stride: 3.4, eye: 0x7dff3a, drop: 1, ranged: true, volley: 3, summon: true, crown: true, sacs: 8, skin: 0x6f8f4a, intro: 'Spits acid volleys and raises the dead' },
  goliath: { boss: true, name: 'GOLIATH', hp: 3800, speed: 1.1, dmg: 38, scale: 2.7, bulk: 1.35, score: 6000, lean: .15, stride: 3.2, eye: 0xffffff, drop: 1, slam: true, charge: true, armor: .6, helmet: true, spikes: 7, intro: 'Armored, slams and charges — aim for the head' },
};
const BOSS_ORDER = ['abomination', 'butcher', 'plague', 'goliath'];
const DIFFICULTIES = {
  recruit: { name: 'RECRUIT', desc: 'Weaker, slower infected. Score x0.5', hp: .7, dmg: .55, speed: .9, count: .8, elite: 0, score: .5, drops: 1.3, shift: 0, rank: 0, mix: .45, ranged: 1 },
  survivor: { name: 'SURVIVOR', desc: 'The intended experience. Score x1', hp: 1, dmg: 1, speed: 1, count: 1, elite: .02, score: 1, drops: 1, shift: 0, rank: 1, mix: 1, ranged: 2 },
  veteran: { name: 'VETERAN', desc: 'Bigger hordes, more elites. Score x1.75', hp: 1.3, dmg: 1.35, speed: 1.08, count: 1.2, elite: .06, score: 1.75, drops: .85, shift: 1, rank: 2, mix: 1.25, ranged: 3 },
  nightmare: { name: 'NIGHTMARE', desc: 'Brutal, scarce supplies. Score x3', hp: 1.65, dmg: 1.8, speed: 1.15, count: 1.4, elite: .12, score: 3, drops: .6, shift: 2, rank: 3, mix: 1.5, ranged: 3, mutate: .55 },
};
const MUTATIONS = {
  regen: { name: 'REGENERATING', desc: 'WOUNDS CLOSE — FINISH THEM FAST', regen: .05 },
  frenzy: { name: 'FRENZIED', desc: 'FASTER, HUNGRIER DEAD', speed: 1.15, rate: .75 },
  hardened: { name: 'HARDENED', desc: 'THICKER HIDE ON EVERY INFECTED', hp: 1.25 },
};
const MODS = {
  horde: { name: 'HORDE', desc: 'TWICE THE DEAD, SLIGHTLY WEAKER', count: 1.7, hp: .75, score: 1.2 },
  bloodmoon: { name: 'BLOOD MOON', desc: 'THEY MOVE FASTER', speed: 1.25, score: 1.3, fog: 0x2a0b0b },
  blackout: { name: 'BLACKOUT', desc: 'VISIBILITY IS LOW', fogDensity: .065, score: 1.3, fog: 0x05080a },
};
const diff = () => DIFFICULTIES[state.runDifficulty || settings.difficulty] || DIFFICULTIES.survivor;
const SKINS = [0x7f8f76, 0x8d9a82, 0x6e7e6a, 0x9a9178, 0x7a8a86];
const CLOTHES = [0x1e292a, 0x2c2a3a, 0x3a3224, 0x4a1f1c, 0x24323c, 0x3d4a2a];
const PANTS = [0x1a2226, 0x2a241c, 0x1c1e2a];
const HAIR = [0x14100c, 0x3a2a1a, 0x5a5048];
const ZG = {
  pelvis: lumpy(new THREE.BoxGeometry(.46, .24, .28, 2, 1, 2), .12),
  belly: lumpy(new THREE.BoxGeometry(.44, .24, .27, 2, 2, 2), .15),
  torso: lumpy(new THREE.BoxGeometry(.54, .44, .31, 2, 2, 2), .14),
  head: lumpy(new THREE.IcosahedronGeometry(.19, 1), .22),
  jaw: lumpy(new THREE.BoxGeometry(.24, .08, .22), .2),
  eye: new THREE.SphereGeometry(.036, 6, 6),
  hair: lumpy(new THREE.IcosahedronGeometry(.2, 1), .5),
  upper: new THREE.CapsuleGeometry(.08, .24, 3, 6),
  fore: new THREE.CapsuleGeometry(.065, .24, 3, 6),
  hand: lumpy(new THREE.BoxGeometry(.11, .15, .07), .3),
  thigh: new THREE.CapsuleGeometry(.1, .28, 3, 6),
  shin: new THREE.CapsuleGeometry(.085, .3, 3, 6),
  foot: new THREE.BoxGeometry(.13, .08, .26),
  wound: new THREE.BoxGeometry(.16, .13, .02),
  rib: new THREE.BoxGeometry(.13, .018, .02),
  strip: new THREE.BoxGeometry(.1, .26, .01),
  spike: new THREE.ConeGeometry(.06, .3, 5),
  sac: lumpy(new THREE.IcosahedronGeometry(.09, 1), .3),
  helmet: new THREE.SphereGeometry(.235, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  visor: new THREE.BoxGeometry(.4, .05, .12),
  vest: new THREE.BoxGeometry(.62, .52, .38),
  pad: new THREE.BoxGeometry(.2, .1, .22),
  blade: new THREE.BoxGeometry(.03, .38, .22),
  claw: new THREE.ConeGeometry(.022, .24, 4),
  shield: new THREE.BoxGeometry(.66, .98, .05),
  stripe: new THREE.BoxGeometry(.64, .07, .012),
  port: new THREE.BoxGeometry(.4, .12, .012),
};
const flashMat = new THREE.MeshBasicMaterial({ color: 0xff5540 });
const zombieMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true });
const pick = a => a[(Math.random() * a.length) | 0];

const zombieVariants = new Map();
function zombieVariant(kind) {
  const T = ZT[kind];
  const list = zombieVariants.get(kind) || [];
  zombieVariants.set(kind, list);
  if (list.length >= (T.boss ? 1 : 4)) return pick(list);
  const skin = T.skin ?? pick(SKINS), cloth = T.cloth ?? pick(CLOTHES), pants = T.stalk ? 0x0e0b12 : pick(PANTS), blood = 0x5a0a08, bone = 0xd9d0b4, armor = T.armorColor ?? 0x2a3440;
  const suit = T.helmet || T.plated;
  const piece = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => ({ geo, color, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const spine = [
    piece(ZG.belly, Math.random() > .5 ? skin : cloth, 0, .12, 0),
    piece(ZG.torso, cloth, 0, .44, 0),
    piece(ZG.wound, blood, (Math.random() - .5) * .25, .3 + Math.random() * .2, .158),
  ];
  if (T.scream || T.stalk || Math.random() > .4) for (let i = 0; i < (T.scream ? 5 : 3); i++) spine.push(piece(ZG.rib, bone, T.scream ? (i % 2 ? .1 : -.1) : .1, .3 + i * .045, .17));
  for (let i = 0; i < 3; i++) spine.push(piece(ZG.strip, cloth, (Math.random() - .5) * .4, .1, .16, .1, 0, (Math.random() - .5) * .5));
  const spikes = T.spikes || 0;
  for (let i = 0; i < spikes; i++) spine.push(piece(ZG.spike, bone, (i - (spikes - 1) / 2) * .1, .55, -.18, -.6));
  if (suit) spine.push(piece(ZG.vest, armor, 0, .4, 0));
  if (T.plated) spine.push(piece(ZG.vest, 0x8a4a22, 0, .5, .04, 0, 0, 0, .8, .45, 1.02), piece(ZG.pad, armor, -.36, .7, 0, 0, 0, .5, 1.7, 1.6, 1.5), piece(ZG.pad, armor, .36, .7, 0, 0, 0, -.5, 1.7, 1.6, 1.5));
  const head = [piece(ZG.head, skin, 0, .19, 0, 0, 0, 0, 1, T.scream || T.stalk ? 1.32 : 1.12, 1.05)];
  if (T.plated) head.push(piece(ZG.helmet, armor, 0, .22, -.01, 0, 0, 0, 1.05, 1.1, 1.05), piece(ZG.visor, 0x3a2414, 0, .19, .17, 0, 0, 0, 1, 3.2, 1), piece(ZG.visor, 0x0a0706, 0, .23, .19, 0, 0, 0, .8, .6, 1));
  else if (T.helmet) head.push(piece(ZG.helmet, armor, 0, .22, -.01), piece(ZG.visor, 0x0a0f14, 0, .27, .17));
  else if (T.scream) head.push(piece(ZG.hair, 0x1a1418, 0, .18, -.1, .25, 0, 0, 1.05, 1.5, .8));
  else if (Math.random() > .35 && !T.crown && !T.stalk) head.push(piece(ZG.hair, pick(HAIR), 0, .27, -.03, 0, 0, 0, 1, .55, 1));
  if (T.crown) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; head.push(piece(ZG.spike, bone, Math.sin(a) * .14, .42, Math.cos(a) * .14, Math.cos(a) * .3, 0, -Math.sin(a) * .3)); }
  const sacs = [];
  for (let i = 0; i < (T.sacs || 0); i++) {
    const a = (i / (T.sacs || 1)) * Math.PI * 2;
    sacs.push(T.explode
      ? piece(ZG.sac, 0, Math.sin(a) * .26, .15 + (i % 3) * .14, Math.cos(a) * .17, 0, 0, 0, 1.2, 1.2, 1.2)
      : piece(ZG.sac, 0, (i - (T.sacs - 1) / 2) * .13, .35 + (i % 2) * .12, -.17));
  }
  if (T.scream) sacs.push(piece(ZG.sac, 0, 0, .6, .14, 0, 0, 0, 1.5, 1.2, 1.2));
  const arm = () => Math.random() > .5 ? cloth : skin;
  const shin = () => Math.random() > .7 ? skin : pants;
  const upper = () => mergeGeos([piece(ZG.upper, suit ? armor : arm(), 0, -.16, 0), ...(suit ? [piece(ZG.pad, armor, 0, -.02, 0)] : [])]);
  const claws = T.claws ? [-.035, 0, .035].map(x => piece(ZG.claw, bone, x, -.5, .03, Math.PI, 0, 0)) : [];
  const v = {
    pelvis: mergeGeos([piece(ZG.pelvis, pants, 0, 0, 0)]),
    thigh: mergeGeos([piece(ZG.thigh, pants, 0, -.2, 0)]),
    shinL: mergeGeos([piece(ZG.shin, shin(), 0, -.2, 0), piece(ZG.foot, 0x15191b, 0, -.42, .05)]),
    shinR: mergeGeos([piece(ZG.shin, shin(), 0, -.2, 0), piece(ZG.foot, 0x15191b, 0, -.42, .05)]),
    spine: mergeGeos(spine),
    sacs: sacs.length ? mergeGeos(sacs) : null,
    head: mergeGeos(head),
    eyes: mergeGeos([piece(ZG.eye, 0, -.07, .21, .17), piece(ZG.eye, 0, .07, .21, .17)]),
    jaw: mergeGeos([piece(ZG.jaw, T.ranged ? 0x5f8a3a : T.scream ? 0x3a0a14 : skin, 0, T.scream ? -.09 : -.03, .06, 0, 0, 0, T.scream ? .9 : 1, T.scream ? 2.6 : 1, 1)]),
    shield: T.shield ? mergeGeos([piece(ZG.shield, 0x4a6272, 0, 0, 0), piece(ZG.port, 0xb8d4e4, 0, .3, .031), piece(ZG.stripe, 0xe8c23a, 0, .08, .031), piece(ZG.stripe, 0xe8c23a, 0, -.34, .031)]) : null,
    upperL: upper(),
    upperR: upper(),
    foreL: mergeGeos([piece(ZG.fore, skin, 0, -.14, 0), piece(ZG.hand, skin, 0, -.32, .01), ...claws]),
    foreR: mergeGeos([piece(ZG.fore, skin, 0, -.14, 0), piece(ZG.hand, skin, 0, -.32, .01), ...claws, ...(T.cleaver ? [piece(ZG.blade, 0x9aa4a8, 0, -.5, .12), piece(ZG.blade, blood, 0, -.62, .12, 0, 0, 0, 1.1, .3, 1.02)] : [])]),
  };
  list.push(v);
  return v;
}

function makeZombie(kind, x, z, rise = true, elite = false) {
  const T = ZT[kind], V = zombieVariant(kind), D = diff(), M = MODS[state.mod] || {}, X = MUTATIONS[state.mutation] || {};
  const glow = elite ? 0x9ff4ff : T.eye;
  const eyeMat = mat(glow, { emissive: glow, emissiveIntensity: 5 });
  const skinMat = T.stalk ? Object.assign(zombieMat.clone(), { transparent: true }) : zombieMat;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const sc = T.scale * (elite ? 1.12 : 1);
  body.scale.set(sc * T.bulk, sc, sc * T.bulk);
  const P = {}, meshes = [];
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const part = (geo, parent, shadow, material = skinMat) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow && !T.stalk; m.userData.zroot = root; m.userData.base = material;
    parent.add(m); meshes.push(m); return m;
  };
  P.hips = joint(body, 0, T.crawl ? .3 : .92, 0);
  part(V.pelvis, P.hips, true);
  if (!T.crawl) for (const s of [-1, 1]) {
    const leg = joint(P.hips, s * .13, -.06, 0), knee = joint(leg, 0, -.42, 0);
    part(V.thigh, leg, true);
    part(s < 0 ? V.shinL : V.shinR, knee, false);
    P[s < 0 ? 'legL' : 'legR'] = leg; P[s < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  P.spine = joint(P.hips, 0, .1, 0); P.spine.rotation.x = T.lean;
  part(V.spine, P.spine, true);
  if (V.shield) { P.shield = joint(P.spine, -.04, .3, .36); part(V.shield, P.shield, true); }
  if (V.sacs) part(V.sacs, P.spine, false, eyeMat).userData.glow = true;
  P.head = joint(P.spine, 0, .7, .02);
  part(V.head, P.head, true).userData.head = true;
  const eyes = part(V.eyes, P.head, false, eyeMat); eyes.userData.head = true; eyes.userData.glow = true;
  P.jaw = joint(P.head, 0, .07, .03);
  part(V.jaw, P.jaw, false).userData.head = true;
  for (const s of [-1, 1]) {
    const sh = joint(P.spine, s * .33, .6, 0), el = joint(sh, 0, -.34, 0);
    part(s < 0 ? V.upperL : V.upperR, sh, false);
    part(s < 0 ? V.foreL : V.foreR, el, false);
    P[s < 0 ? 'armL' : 'armR'] = sh; P[s < 0 ? 'elbowL' : 'elbowR'] = el;
  }
  if (elite) {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6fe3ff, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
    aura.position.y = (T.crawl ? .5 : 1.2) * sc; aura.scale.setScalar(2.4 * sc);
    root.add(aura);
  }
  const bossTier = T.boss ? 1 + Math.floor((state.wave - 1) / 20) * .6 : 1;
  const hp = T.hp * (1 + (state.wave - 1) * (T.boss ? .08 : .12)) * D.hp * (M.hp ?? 1) * (X.hp ?? 1) * (elite ? 2.2 : 1) * bossTier;
  const now = state.clock;
  root.userData = {
    zombie: true, kind, T, P, meshes, hp, maxHp: hp, elite, sc,
    speed: T.speed * (1 + Math.min(.45, (state.wave - 1) * .035)) * D.speed * (M.speed ?? 1) * (X.speed ?? 1) * (elite ? 1.1 : 1) * (.9 + R() * .2),
    walk: Math.random() * 6, phase: Math.random() * 6, flash: 0, nextAttack: 0, swing: 0, dead: false, deathT: 0, rise: rise ? 1 : 0,
    side: R() > .5 ? 1 : -1, kx: 0, kz: 0, radius: .34 * sc * T.bulk, groanAt: Math.random() * 5,
    nextSpit: now + 2 + Math.random() * 2, spitWind: 0, nextSlam: now + 3, slamT: 0, nextCharge: now + 2, cs: '', ct: 0, nextSummon: now + 8, enraged: false,
    nextScream: now + 3 + Math.random() * 2, screamT: 0, summons: 0, hasteT: 0, stalkT: 1.5, hidden: false, vis: 1, skinMat: T.stalk ? skinMat : null,
    nextLunge: now + .5, lungeT: 0, lungeGo: 0, swellT: 0, hitAt: -9,
  };
  root.position.set(x, rise ? -1.9 * sc : 0, z);
  scene.add(root);
  zombies.push(root);
  state.net?.spawned(root);
  return root;
}

function flashZombie(z) {
  const u = z.userData;
  u.flash = .07;
  for (const m of u.meshes) if (!m.userData.glow) m.material = flashMat;
}

const HASTE_FX = { speed: .6, spread: 1, life: .4, grav: -2, colors: [0xff5ad8, 0xffa0ec] };
const SCREAM_FX = { speed: 7, spread: 2.4, life: .5, grav: 0, drag: 2, colors: [0xff5ad8, 0xffa0ec, 0xffffff] };
const SHADOW_FX = { speed: 2, spread: 2, life: 1.2, grav: -1.5, drag: 1.5, colors: [0x2a1a3a, 0x4a2a6a, 0x120a1a] };
const METAL_FX = { speed: 4, spread: 2, life: .5, grav: 10, colors: [0xffd080, 0xcfe6ff, 0xff9a40] };
function animateZombie(z, dt) {
  const u = z.userData, P = u.P, T = u.T;
  if (u.flash > 0) { u.flash -= dt; if (u.flash <= 0) for (const m of u.meshes) m.material = u.frozenT > 0 && !m.userData.glow ? iceMat : m.userData.base; }
  if (u.skinMat) {
    u.vis += ((u.hidden && !u.dead ? 0 : 1) - u.vis) * Math.min(1, dt * 5);
    const o = u.vis > .97 ? 1 : (.05 + .95 * u.vis) * (Math.random() < .25 ? .3 : 1);
    u.skinMat.opacity = o; u.skinMat.depthWrite = o > .9;
  }
  if (u.hasteT > 0 && !u.dead && Math.random() < dt * 10) sparks.emit(z.position.x, 1.7 * u.sc, z.position.z, 1, HASTE_FX);
  if (u.swellT > 0 && !u.dead) { const k = 1 + (1 - u.swellT / .55) * .4 + Math.sin(state.clock * 45) * .05; z.children[0].scale.set(u.sc * T.bulk * k, u.sc * k, u.sc * T.bulk * k); }
  if (u.frozenT > 0 && !u.dead) return false;
  if (u.dead) {
    u.deathT += dt;
    const k = Math.min(1, u.deathT / .55), e = 1 - (1 - k) * (1 - k);
    if (T.crawl) z.children[0].rotation.z = e * .4;
    else {
      z.children[0].rotation.x = -e * 1.5;
      P.legL.rotation.x = P.legR.rotation.x = 0;
    }
    P.armL.rotation.x = P.armR.rotation.x = -2.6 * e;
    if (u.deathT > 2.8) z.position.y -= dt * .45;
    return u.deathT > 5;
  }
  const s = Math.sin(u.walk), c = Math.cos(u.walk), amp = u.moving ? 1 : .25;
  P.head.rotation.z = Math.sin(state.clock * 1.3 + u.phase) * .28;
  P.head.rotation.x = Math.sin(state.clock * .9 + u.phase) * .12;
  P.jaw.rotation.x = .15 + Math.abs(Math.sin(state.clock * 3 + u.phase)) * .35;
  if (T.crawl) {
    P.head.rotation.x = -1.15;
    P.armL.rotation.x = -2.1 + s * .8; P.armR.rotation.x = -2.1 - s * .8;
    P.armL.rotation.z = -.35; P.armR.rotation.z = .35;
    P.elbowL.rotation.x = P.elbowR.rotation.x = -.5;
    P.hips.position.y = .3 + Math.abs(s) * .05 * amp + (u.lungeT > 0 ? .2 : 0);
    if (u.lungeT > 0) P.head.rotation.x = -1.5;
    P.hips.rotation.y = s * .2 * amp;
    return false;
  }
  P.legL.rotation.x = s * .55 * amp; P.legR.rotation.x = -s * .55 * amp;
  P.kneeL.rotation.x = Math.max(0, c) * .9 * amp; P.kneeR.rotation.x = Math.max(0, -c) * .9 * amp;
  P.hips.position.y = .92 + Math.abs(s) * .04 * amp;
  P.hips.rotation.y = s * .12 * amp;
  let armX = -1.3, armSway = Math.sin(u.walk * .5 + u.phase) * .18;
  let armZ = .15;
  if (u.kind === 'runner' || T.stalk || u.cs === 'run') { armX = -.4; armSway = s * 1.1; }
  if (u.swing > 0) { const k = u.swing / .45; armX = -1.3 - Math.sin(k * Math.PI) * 1.4; }
  if (u.slamT > 0 || u.cs === 'wind') { armX = -2.9; armSway = 0; }
  if (u.spitWind > 0) { P.head.rotation.x = -.7 + (1 - u.spitWind / .5) * .9; P.jaw.rotation.x = .7; }
  if (u.cs === 'stun') { P.head.rotation.x = .6; armX = -.2; }
  if (u.screamT > 0) { armX = -2.6; armSway = Math.sin(state.clock * 40) * .08; armZ = .75; P.head.rotation.x = -.8; P.jaw.rotation.x = 1.1; }
  P.armL.rotation.x = armX + armSway; P.armR.rotation.x = armX - armSway;
  P.armL.rotation.z = -armZ; P.armR.rotation.z = armZ;
  P.elbowL.rotation.x = P.elbowR.rotation.x = u.kind === 'runner' || T.stalk ? -.9 : -.25;
  if (T.shield) { P.armL.rotation.x = -1.2; P.armL.rotation.z = .35; P.elbowL.rotation.x = -1.1; }
  return false;
}

const guns = WEAPONS.map(w => {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial(), dark = new THREE.MeshStandardMaterial(), base = new THREE.MeshStandardMaterial();
  const model = buildGun(w, { base, metal, dark });
  g.add(model);
  g.userData.pump = model.userData.pump;
  g.userData.pumpZ = model.userData.pump?.position.z;
  g.userData.pumpX = model.userData.pump?.position.x;
  g.userData.spin = model.userData.spin;
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2d3b2a, roughness: 1, flatShading: true }), glove = new THREE.MeshStandardMaterial({ color: 0x161a1c, roughness: .9 });
  g.userData.mats = { base, metal, dark, sleeve, glove };
  const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); g.add(o); return o; };
  const [gx, gy, gz] = w.grip, [hx, hy, hz] = w.guard;
  add(new THREE.CapsuleGeometry(.055, .38, 4, 8), sleeve, gx + .06, gy - .08, gz + .23, -1.1, .25);
  add(new THREE.BoxGeometry(.07, .08, .1), glove, gx + .02, gy, gz);
  add(new THREE.CapsuleGeometry(.05, .5, 4, 8), sleeve, hx - .1, hy - .14, hz + .22, -1.25, -.6);
  add(new THREE.BoxGeometry(.09, .06, .12), glove, hx - .04, hy, hz);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: w.flashColor ?? 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0, .01, w.muzzle); flash.visible = false; g.add(flash);
  g.userData.flash = flash;
  const light = new THREE.PointLight(w.flashColor ?? 0xffa050, 0, 3, 2); light.position.set(0, .05, w.muzzle + .07); g.add(light); g.userData.light = light;
  g.visible = false;
  viewScene.add(g);
  return g;
});

function applyLoadoutToGuns() {
  const l = profile.loadout, c = outfitColors(l);
  guns.forEach((g, i) => {
    const m = g.userData.mats;
    paintGunMaterials(m, l.gun);
    if (WOOD.has(WEAPONS[i].id) && l.gun === 0) woodStock(m.base);
    m.sleeve.color.setHex(c.sleeve);
    m.glove.color.setHex(c.glove);
  });
}

const profile = Object.assign({ loadout: { ...DEFAULT_LOADOUT }, owned: {}, scrap: 300, xp: 0, kills: 0, heads: 0, bosses: {}, bestWave: 0, bestByDiff: {}, runs: 0, lastDaily: '', fresh: [], iap: {} }, store.get('profile', {}));
profile.loadout = { ...DEFAULT_LOADOUT, ...profile.loadout };
profile.loadout.body = profile.loadout.body === 1 ? 1 : 0;
profile.arsenal = { owned: {}, primary: 'm4', secondary: 'r870', ...profile.arsenal };
profile.iap ||= {};
function weaponOwned(w) {
  if (w.premium) return !!profile.iap[w.productId];
  return !w.price || !!profile.arsenal.owned[w.id];
}
function loadoutWeapons() {
  let p = WEAPONS.find(w => w.id === profile.arsenal.primary), q = WEAPONS.find(w => w.id === profile.arsenal.secondary);
  if (!p || !weaponOwned(p)) p = WEAPONS[0];
  if (!q || !weaponOwned(q) || q === p) q = p === WEAPONS[1] ? WEAPONS[0] : WEAPONS[1];
  return [weaponIndex(p.id), weaponIndex(q.id)];
}
function saveProfile() { store.set('profile', profile); }
function levelInfo(xp = profile.xp) {
  let level = 1, need = 1000, rest = xp;
  while (rest >= need) { rest -= need; level++; need = Math.round(1000 * level ** 1.3); }
  return { level, into: rest, need };
}
function myCode() { profile.loadout.primary = loadoutWeapons()[0]; return encodeLoadout(profile.loadout, levelInfo().level); }
function reqMet(req) {
  if (!req) return true;
  const [k, v] = req.split(':'), n = +v;
  if (k === 'level') return levelInfo().level >= n;
  if (k === 'wave') return profile.bestWave >= n;
  if (k === 'boss') return (profile.bosses[v] || 0) > 0;
  if (k === 'heads') return profile.heads >= n;
  if (k === 'kills') return profile.kills >= n;
  if (k === 'nightmare') return (profile.bestByDiff.nightmare || 0) >= n;
  if (k === 'veteran') return Math.max(profile.bestByDiff.veteran || 0, profile.bestByDiff.nightmare || 0) >= n;
  if (k === 'season') return !!profile.season?.suits?.[v];
  return false;
}
function reqText(req) {
  const [k, v] = req.split(':'), n = (+v).toLocaleString();
  return { level: 'REACH LEVEL ' + n, wave: 'REACH WAVE ' + n, boss: 'DEFEAT ' + (ZT[v]?.name || v), heads: n + ' HEADSHOTS', kills: n + ' KILLS', nightmare: 'WAVE ' + n + ' ON NIGHTMARE', veteran: 'WAVE ' + n + ' ON VETERAN+', season: 'SEASON ' + n + ' PASS' }[k] || req;
}
const ALL_SLOTS = [...SLOTS, ...EXTRA_SLOTS];
const slotById = id => id === BODY.id ? BODY : ALL_SLOTS.find(s => s.id === id);
function isOwned(slotId, i) {
  const it = slotById(slotId).items[i];
  if (!it) return false;
  if (it.premium) return !!profile.iap[STORE_PREFIX + it.premium];
  if (it.req) return reqMet(it.req);
  return !it.cost || !!profile.owned[slotId + ':' + i];
}
function unlockedSet() {
  const set = new Set();
  for (const s of ALL_SLOTS) s.items.forEach((it, i) => { if (it.req && reqMet(it.req)) set.add(s.id + ':' + i); });
  return set;
}

const stats = {};
const player = {};
const state = { mode: 'menu', wave: 0, clock: 0 };
const look = { yaw: 0, pitch: 0, recoil: 0, shake: 0, swayX: 0, swayY: 0, bob: 0, fov: 74, assist: 1 };
const move = { x: 0, y: 0, sprint: false };
const keys = {};
let firing = false, aimTarget = null, menuAngle = 0, menuTarget = new THREE.Vector3();

function schedule(delay, fn) { scheduled.push({ at: state.clock + delay, fn }); }

function resetRun() {
  Object.assign(stats, { damage: 1, fireRate: 1, reload: 1, speed: 1, maxHp: 100, mag: 1, headMul: 1, leech: 0, nadeMax: 3, armor: 1, luck: 1, secondWind: false,
    pierce: 0, explosive: 0, adrenaline: 0, berserk: 0, magnet: 1, refund: 0, frost: 0, incendiary: 0, nadeRegen: 0, secondMag: false, fortune: 1, phoenix: 0, timeWarp: false, chain: 0, overclock: false });
  const slots = loadoutWeapons();
  Object.assign(player, { hp: 100, lagHp: 100, nades: 2, weapon: slots[0], slots, reloading: 0, swapT: 0, nextShot: 0, lastHurt: -9, pumpT: 0, lastBeat: 0, spin: 0, shotN: 0, adrenT: 0, invulnUntil: 0,
    ammo: WEAPONS.map(w => w.mag), reserve: WEAPONS.map(w => w.reserve) });
  Object.assign(state, { wave: 0, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, combo: 0, bestCombo: 0, lastKill: -9, spawnLeft: 0, waveTotal: 0,
    waveDone: 0, clock: 0, between: true, boss: null, moved: false, looked: false, mod: null, startedAt: Date.now(), bossKinds: [], seen: new Set(), queue: [], difficulty: settings.difficulty, mutation: null,
    warpT: 0, killTimes: [], perks: [], startWave: 1, kitTotal: 0 });
  scheduled.length = 0;
  applyMod(null);
  for (const p of projectiles) scene.remove(p.mesh);
  projectiles.length = 0;
  for (const p of shells) scene.remove(p.mesh);
  shells.length = 0;
  for (const v of singularities) scene.remove(v.g);
  singularities.length = 0;
  for (const h of hazards) h.mesh.visible = false;
  hazards.length = 0;
  slamRing.visible = false;
  ui.bossBar.classList.add('hidden');
  ui.swap.classList.add('hidden');
  ui.lowhp.classList.remove('on');
  edge.t = 0; ui.edge.style.opacity = 0;
  hint('');
  for (const z of zombies) scene.remove(z);
  zombies.length = 0;
  for (const p of pickups) scene.remove(p);
  pickups.length = 0;
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
}

function magSize(i) { return Math.round(WEAPONS[i].mag * stats.mag); }

function startGame(opts = {}) {
  sfx.init();
  loadMap(opts.map || world.map.id);
  store.set('map', world.map.id);
  state.runType = opts.type || 'normal';
  state.runDifficulty = opts.difficulty || null;
  rng.set(opts.seed ?? null);
  resetRun();
  state.runType = opts.type || 'normal';
  state.runDifficulty = opts.difficulty || null;
  state.seed = opts.seed ?? null;
  state.runOpts = opts;
  if (opts.slots) { player.slots = [...opts.slots]; player.weapon = player.slots[0]; }
  state.startWave = state.runType === 'normal' ? Math.max(1, Math.min(999, opts.startWave | 0)) : 1;
  state.wave = state.startWave - 1;
  const S = world.map.start;
  camera.position.set(S.x, 1.64, S.z);
  look.yaw = S.yaw; look.pitch = 0; look.recoil = 0;
  camera.fov = 74; camera.updateProjectionMatrix();
  state.mode = 'playing';
  showScreen(null);
  ui.hud.classList.add('on');
  applyLoadoutToGuns();
  selectWeapon(player.slots[0], true);
  ui.swap.classList.toggle('hidden', player.slots[0] === player.slots[1]);
  if (state.startWave > 1) {
    state.kitTotal = Math.min(10, Math.ceil((state.startWave - 1) / 2));
    player.nades = stats.nadeMax;
    player.slots.forEach(i => (player.reserve[i] = WEAPONS[i].maxReserve));
    schedule(.8, () => offerPerks(state.kitTotal));
  } else if (!state.net || state.net.host) schedule(.8, nextWave);
  if (!tutorialDone) schedule(.3, () => hint('Drag anywhere on the left to move'));
  haptic('MEDIUM');
  bus.emit('run:start', { type: state.runType, difficulty: diff(), difficultyId: state.runDifficulty || settings.difficulty, seed: state.seed, slots: [...player.slots], map: world.map.id, startWave: state.startWave, opts });
}

function rosterWeights(w, D = diff()) {
  const e = w + D.shift, out = {};
  for (const k in ZT) {
    const m = ZT[k].mix;
    if (!m || D.rank < m[0] || e < m[1]) continue;
    out[k] = Math.min(m[3], (e - m[1] + 1) * m[2]) * (k === 'walker' ? 1 : D.mix);
  }
  return out;
}
function waveComposition(w) {
  const D = diff(), M = MODS[state.mod] || {}, bossWave = w % 5 === 0;
  const weights = rosterWeights(w, D), sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const total = Math.min(70, Math.round((4 + w * 2 + w * w * .12) * D.count * (M.count ?? 1) * (bossWave ? .6 : 1)));
  const eliteChance = w >= 5 ? D.elite + (w - 5) * .01 : 0;
  const list = [], count = {};
  for (let i = 0; i < total; i++) {
    let r = R() * sum, kind = 'walker';
    for (const k in weights) { r -= weights[k]; if (r <= 0) { kind = k; break; } }
    const cap = ZT[kind].cap;
    if (cap && (count[kind] || 0) >= cap[0] + Math.floor(w / cap[1])) kind = 'walker';
    count[kind] = (count[kind] || 0) + 1;
    list.push({ kind, elite: R() < eliteChance });
  }
  if (bossWave) list.splice(Math.floor(list.length / 3), 0, { kind: BOSS_ORDER[(w / 5 - 1) % BOSS_ORDER.length], elite: false });
  return list;
}

function applyMod(id) {
  const M = MODS[id] || {};
  scene.fog.color.setHex(M.fog ?? world.map.fog.color);
  scene.fog.density = M.fogDensity ?? world.map.fog.density;
}

function nextWave() {
  state.wave++;
  const modKeys = Object.keys(MODS);
  state.mod = state.net && !state.net.host ? state.net.mod : state.wave >= 6 && state.wave % 5 !== 0 && R() < .35 ? modKeys[(R() * modKeys.length) | 0] : null;
  const mutKeys = Object.keys(MUTATIONS), D = diff();
  state.mutation = state.net && !state.net.host ? state.net.mutation || null : !state.mod && D.mutate && state.wave >= 3 && state.wave % 5 !== 0 && R() < D.mutate ? mutKeys[(R() * mutKeys.length) | 0] : null;
  applyMod(state.mod);
  state.queue = waveComposition(state.wave);
  state.waveTotal = state.queue.length;
  state.waveDone = 0;
  state.between = false;
  state.spawnGap = 0;
  const boss = state.wave % 5 === 0, M = MODS[state.mod], X = MUTATIONS[state.mutation];
  message('WAVE ' + state.wave, M ? M.name + ' — ' + M.desc : X ? 'MUTATION: ' + X.name + ' — ' + X.desc : boss ? 'SOMETHING BIG IS COMING' : state.wave === 1 ? 'THE DEAD ARE COMING' : 'HOLD THE LINE', 2.4);
  sfx.wave();
  haptic('MEDIUM');
  bus.emit('wave:start', { wave: state.wave, mod: state.mod, mutation: state.mutation, boss: boss, checkpoint: state.startWave > 1 && state.wave === state.startWave });
}

function findSpawn(minD = 16, maxD = 32) {
  const fwdX = -Math.sin(look.yaw), fwdZ = -Math.cos(look.yaw);
  let best = null;
  for (let i = 0; i < 30; i++) {
    const a = R() * Math.PI * 2, d = minD + R() * (maxD - minD);
    const x = camera.position.x + Math.cos(a) * d, z = camera.position.z + Math.sin(a) * d;
    if (blocked(x, z, 1)) continue;
    const c = navCell(x, z);
    if (c < 0 || NAV.dist[c] < 0 || NAV.dist[c] > d * 1.8) continue;
    const facing = (Math.cos(a) * fwdX + Math.sin(a) * fwdZ);
    if (!best || facing > best.facing) best = { x, z, facing };
    if (facing > .2 && R() > .4) break;
  }
  if (best) return best;
  let far = null, fd = -1;
  for (const [x, z] of world.map.spawns) {
    const c = navCell(x, z), d = Math.hypot(x - camera.position.x, z - camera.position.z);
    if (c >= 0 && NAV.dist[c] >= 0 && d > fd) { fd = d; far = { x, z }; }
  }
  return far || { x: world.map.spawns[0][0], z: world.map.spawns[0][1] };
}

function spawnTick(dt) {
  if (state.between || !state.queue?.length) return;
  state.spawnGap -= dt;
  const alive = zombies.filter(z => !z.userData.dead).length;
  if (state.spawnGap > 0 || alive >= Math.min(5 + state.wave, 16)) return;
  const { kind, elite } = state.queue.shift();
  const T = ZT[kind];
  const p = findSpawn(T.boss ? 20 : 16);
  const z = makeZombie(kind, p.x, p.z, true, elite);
  state.spawnGap = T.boss ? 1.5 : Math.max(.35, 1.1 - state.wave * .06);
  if (!state.seen.has(kind)) {
    state.seen.add(kind);
    if (T.intro && !T.boss) schedule(.6, () => toast('NEW THREAT: ' + T.name + ' — ' + T.intro, 3.2));
  }
  if (T.boss) {
    state.boss = z;
    ui.bossBar.classList.remove('hidden');
    ui.bossName.textContent = T.name;
    message(T.name, T.intro.toUpperCase(), 3);
    sfx.roar(); look.shake = .6; haptic('HEAVY');
  }
}

function hurtPlayer(amount, from, quiet) {
  if (state.mode !== 'playing' || state.clock < player.invulnUntil || state.net?.immune) return;
  amount *= stats.armor * diff().dmg;
  player.hp = Math.max(0, player.hp - amount);
  player.lastHurt = state.clock;
  look.shake = Math.min(.5, look.shake + amount * .02);
  ui.damage.style.opacity = Math.min(1, .35 + amount / 20);
  setTimeout(() => (ui.damage.style.opacity = 0), 140);
  if (!quiet) { sfx.hurt(); haptic(amount > 12 ? 'HEAVY' : 'MEDIUM'); }
  if (from) damageIndicator(from);
  if (player.hp <= 0) {
    if (stats.secondWind) {
      stats.secondWind = false;
      player.hp = stats.maxHp * .5;
      message('SECOND WIND', 'BACK ON YOUR FEET', 1.8);
      explode(camera.position.x, camera.position.z, { friendly: true });
      return;
    }
    if (stats.phoenix > 0) {
      stats.phoenix--;
      player.hp = stats.maxHp;
      message('PHOENIX', 'RISEN FROM THE ASHES', 2);
      nova(10);
      return;
    }
    if (state.net) { state.net.down(); return; }
    bus.emit('player:death', { from, amount });
    if (deathGuards.some(g => g())) return;
    gameOver();
  }
}

function killZombie(z, head, noScore) {
  const u = z.userData, T = u.T, burning = u.burnT > 0;
  u.dead = true; u.deathT = 0; u.cs = ''; u.slamT = 0; u.burnT = 0;
  if (u.frozenT > 0) {
    gore.emit(z.position.x, 1 * u.sc, z.position.z, 40, { speed: 5, spread: 2, life: 1.2, colors: [0xdff8ff, 0x9fd8f0, 0xffffff] });
    z.visible = false; u.deathT = 4.9; u.frozenT = 0;
    sfx.cryo();
  }
  if (head) { u.P.head.scale.setScalar(.001); gore.emit(z.position.x, 1.9 * u.sc, z.position.z, 26, { speed: 4, spread: 1.6, life: 1.2, colors: [0x6a0a08, 0x8a120e, 0x3a0605] }); }
  decal(z.position.x, z.position.z, 1.2 + u.sc * .6);
  if (T.explode) {
    const x = z.position.x, zz = z.position.z;
    z.visible = false; u.deathT = 4.9;
    schedule(.08, () => explode(x, zz, { hostile: true, radius: 4.6, zdmg: 220, pdmg: 32, color: 0xb6ff4a }));
    if (diff().rank >= 2) schedule(.12, () => acidPuddle(x, zz));
  }
  if (T.scream) { u.screamT = 0; sparks.emit(z.position.x, 1.6 * u.sc, z.position.z, 24, SCREAM_FX); }
  if (T.stalk) gore.emit(z.position.x, 1 * u.sc, z.position.z, 30, SHADOW_FX);
  if (T.shield || T.plated) sparks.emit(z.position.x, 1.1 * u.sc, z.position.z, T.plated ? 34 : 18, METAL_FX);
  if (T.plated) { look.shake = Math.max(look.shake, .25); sfx.thump(); }
  if (z === state.boss) { state.boss = null; ui.bossBar.classList.add('hidden'); slamRing.visible = false; }
  if (!state.between && state.mode === 'playing') {
    state.waveDone++;
    if (!noScore) {
      state.kills++;
      if (head) state.heads++;
      state.combo = state.clock - state.lastKill < 3 ? state.combo + 1 : 1;
      state.lastKill = state.clock;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const pts = Math.round(T.score * (u.elite ? 2 : 1) * (head ? 1.5 : 1) * comboMult() * diff().score * (MODS[state.mod]?.score ?? 1));
      state.score += pts;
      bus.emit('kill', { kind: u.kind, head, elite: u.elite, boss: !!T.boss, points: pts, weapon: WEAPONS[player.weapon].id, combo: state.combo, frozen: false, burning });
      floater(z.position.x, 2.2 * u.sc, z.position.z, '+' + pts, head ? 'head' : '');
      if (head) toast('HEADSHOT', .8);
      else if (u.elite) toast('ELITE DOWN', .8);
      if (stats.leech) player.hp = Math.min(stats.maxHp, player.hp + stats.leech);
      perkOnKill(z);
      ui.combo.classList.add('pop'); setTimeout(() => ui.combo.classList.remove('pop'), 120);
      const drops = T.boss ? 4 : R() < T.drop * stats.luck * diff().drops * (u.elite ? 2 : 1) ? 1 : 0;
      for (let i = 0; i < drops; i++) dropPickup(z.position.x + (Math.random() - .5) * 2, z.position.z + (Math.random() - .5) * 2, T.boss ? ['health', 'ammo', 'grenade', 'ammo'][i] : null);
      if (T.boss) { state.bossKinds.push(u.kind); message(T.name + ' DOWN', '+' + pts.toLocaleString(), 2.2); look.shake = .5; }
    }
  }
  sfx.kill();
  haptic(head ? 'MEDIUM' : 'LIGHT');
  state.net?.killed(z, head, noScore);
}

function comboMult() { return state.combo > 1 ? Math.min(4, 1 + (state.combo - 1) * .25) : 1; }
function dmgMul() { return stats.damage * (1 + stats.berserk * Math.max(0, 1 - player.hp / stats.maxHp)); }
function perkOnKill(z) {
  if (stats.adrenaline) player.adrenT = 2.5;
  if (stats.timeWarp) {
    state.killTimes = state.killTimes.filter(t => state.clock - t < 1.2);
    state.killTimes.push(state.clock);
    if (state.killTimes.length >= 3 && !(state.warpT > 0)) { state.warpT = 3; state.killTimes.length = 0; toast('TIME WARP', 1.2); }
  }
  if (stats.chain && !z.userData.T.explode && R() < stats.chain) {
    const x = z.position.x, zz = z.position.z;
    schedule(.15, () => explode(x, zz, { radius: 3.8, zdmg: 220 * stats.damage, color: 0xff6a2a, small: true }));
  }
}
function nova(r = 9) {
  const x = camera.position.x, z = camera.position.z;
  explode(x, z, { friendly: true, radius: r, zdmg: 800 * stats.damage, color: 0xffd27a });
  for (const zb of [...zombies]) {
    const u = zb.userData;
    if (!u.dead && !u.T.boss && Math.hypot(zb.position.x - x, zb.position.z - z) < r) damageZombie(zb, u.hp + 1, null, false, null);
  }
  for (const p of projectiles) scene.remove(p.mesh);
  projectiles.length = 0;
  player.invulnUntil = state.clock + 1.5;
}
const deathGuards = [];

function shieldFacing(z) {
  const dx = camera.position.x - z.position.x, dz = camera.position.z - z.position.z, d = Math.hypot(dx, dz) || 1;
  return (Math.sin(z.rotation.y) * dx + Math.cos(z.rotation.y) * dz) / d > .35;
}
function damageZombie(z, amount, point, head, dir) {
  const u = z.userData, T = u.T;
  if (u.dead) return;
  const armored = point && !head && T.armor && (!T.shield || shieldFacing(z));
  const remote = state.net?.claim(z, amount, head, !!armored, point);
  if (armored) amount *= T.armor;
  if (u.cs === 'stun') amount *= 2;
  if (u.frozenT > 0) amount *= 1.3;
  if (!remote) u.hp -= amount;
  u.hitAt = state.clock;
  flashZombie(z);
  const heavy = u.sc > 1.3 ? .3 : 1;
  if (dir) { u.kx += dir.x * heavy; u.kz += dir.z * heavy; }
  if (point) {
    if (armored) sparks.emit(point.x, point.y, point.z, 6, { speed: 3, spread: 1.5, life: .3, grav: 10, colors: [0xcfe6ff, 0xffd080] });
    else gore.emit(point.x, point.y, point.z, head ? 12 : 7, { dir: dir ? { x: dir.x, y: .5, z: dir.z } : null, speed: 3, spread: 1.4, life: .8, colors: [0x7a0c09, 0x4a0605, 0x9a1a10] });
    if (amount >= 20 || head) floater(point.x, point.y + .2, point.z, Math.round(amount), head ? 'head' : armored ? 'armor' : '');
  }
  if (remote) return;
  if (head && u.screamT > 0) { u.screamT = 0; u.nextScream = state.clock + 4; toast('SCREAM INTERRUPTED', 1); }
  if (T.boss && !u.enraged && u.hp < u.maxHp * .5 && u.hp > 0) {
    u.enraged = true; u.speed *= 1.3;
    ui.bossName.textContent = T.name + ' · ENRAGED';
    toast(T.name + ' IS ENRAGED', 1.6);
    sfx.roar(); look.shake = .4; haptic('HEAVY');
  }
  if (u.hp <= 0) killZombie(z, head);
}

function otherSlot() { return player.weapon === player.slots[0] ? player.slots[1] : player.slots[0]; }
function selectWeapon(i, instant) {
  if (!player.slots.includes(i)) return;
  const prev = player.weapon, n = Math.min(magSize(prev) - player.ammo[prev], player.reserve[prev]);
  if (!instant && stats.secondMag && prev !== i && n > 0) { player.ammo[prev] += n; player.reserve[prev] -= n; }
  player.spin = 0;
  player.weapon = i;
  player.reloading = 0;
  player.swapT = instant ? 0 : .35;
  guns.forEach((g, k) => (g.visible = k === i));
  ui.gunName.textContent = WEAPONS[i].name;
  if (!instant) { sfx.swap(); haptic('LIGHT'); }
}

function reload() {
  const i = player.weapon, w = WEAPONS[i];
  if (state.mode !== 'playing' || player.reloading > 0 || player.swapT > 0 || player.ammo[i] >= magSize(i) || player.reserve[i] <= 0) return;
  player.reloading = w.reloadTime * stats.reload;
  player.reloadTotal = player.reloading;
  sfx.reload();
  haptic('LIGHT');
}

function finishReload() {
  const i = player.weapon, n = Math.min(magSize(i) - player.ammo[i], player.reserve[i]);
  player.ammo[i] += n; player.reserve[i] -= n;
  sfx.reloaded();
}

const center = new THREE.Vector2();
const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x3a8aa8, emissiveIntensity: .6, roughness: .1, metalness: .1 });
function ignite(z, dps) {
  const u = z.userData;
  if (state.net?.fx(z, 0, dps)) return;
  u.burnT = 3;
  u.burnDps = Math.max(u.burnDps || 0, dps);
}
function chill(z, amount) {
  const u = z.userData;
  if (u.dead || state.net?.fx(z, 1, amount)) return;
  u.chill = Math.min(1, (u.chill || 0) + amount * (u.T.boss ? .35 : 1));
  if (u.chill >= 1 && !(u.frozenT > 0)) {
    u.frozenT = u.T.boss ? .8 : 2.2;
    for (const m of u.meshes) if (!m.userData.glow) m.material = iceMat;
  }
}
function thaw(z) {
  const u = z.userData;
  u.frozenT = 0; u.chill = .4;
  for (const m of u.meshes) m.material = m.userData.base;
}
function bolt(from, to, color = 0x8fe8ff) {
  let prev = from.clone();
  for (let k = 1; k <= 5; k++) {
    const p = from.clone().lerp(to, k / 5);
    if (k < 5) p.add(tmp2.set((Math.random() - .5) * .5, (Math.random() - .5) * .5, (Math.random() - .5) * .5));
    tracer(prev, p, color, .035, .09);
    prev = p;
  }
}

function shoot() {
  const i = player.weapon, w = WEAPONS[i], g = guns[i];
  if (state.mode !== 'playing' || player.swapT > 0 || state.clock < player.nextShot || state.net?.out) return;
  if (w.spinup && player.spin < 1) return;
  if (player.reloading > 0) {
    if (w.pump && player.ammo[i] > 0) player.reloading = 0; else return;
  }
  if (player.ammo[i] <= 0) {
    player.nextShot = state.clock + .3;
    sfx.dry();
    if (player.reserve[i] > 0) reload(); else toast('OUT OF AMMO — FIND SUPPLIES OR SWAP', 1.2);
    return;
  }
  player.ammo[i]--;
  player.nextShot = state.clock + w.rate / stats.fireRate;
  state.shots++;
  bus.emit('shot', { weapon: w.id });
  look.recoil += w.kick;
  look.yaw += (Math.random() - .5) * w.kick * .4;
  g.userData.kick = w.recoil;
  if (w.flash !== 0) {
    g.userData.flash.visible = true; g.userData.flash.material.rotation = Math.random() * 6;
    g.userData.flash.scale.setScalar((w.flash ?? .35) + Math.random() * .08);
    g.userData.flashT = .05;
    muzzleWorld.color.setHex(w.flashColor ?? 0xffb060);
    muzzleWorld.intensity = 14;
  }
  (sfx[w.sound] || sfx.rifle)();
  haptic(w.pellets > 1 || w.damage >= 100 || w.projectile ? 'MEDIUM' : 'LIGHT');
  if (w.pump) { player.pumpT = .55; setTimeout(() => sfx.pump(), 260); }

  camera.updateMatrixWorld();
  const sd = dmgMul();
  let impact = null;
  const origin = camera.getWorldPosition(tmp).clone();
  const muzzle = camera.localToWorld(tmp3.set(.22, -.2, -.9)).clone();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const spread = w.spread + (Math.hypot(move.x, move.y) > .1 ? w.moveSpread : 0);
  const targets = zombies.filter(z => !z.userData.dead && z.userData.rise < .5);
  const hitMap = new Map();
  const addHit = (z, dmg, head, point, dir) => {
    const e = hitMap.get(z) || { dmg: 0, head: false, point, dir };
    e.dmg += dmg; e.head ||= head; hitMap.set(z, e);
  };

  if (w.projectile) {
    launchShell(w, muzzle, fwd);
  } else if (w.chain) {
    raycaster.set(origin, fwd); raycaster.far = w.range;
    const h = raycaster.intersectObjects([...targets, ...solids], true)[0];
    const end = h ? h.point.clone() : origin.clone().addScaledVector(fwd, w.range);
    bolt(muzzle, end);
    if (h) impact = end;
    let z = h?.object.userData.zroot;
    if (z) {
      const head = !!h.object.userData.head;
      let dmg = w.damage * sd * (head ? w.head * stats.headMul : 1);
      addHit(z, dmg, head, h.point, fwd);
      const chained = new Set([z]);
      let from = end;
      for (let k = 0; k < w.chain.count; k++) {
        let best = null, bd = w.chain.range;
        for (const o of targets) {
          if (chained.has(o)) continue;
          const d = o.position.distanceTo(z.position);
          if (d < bd) { bd = d; best = o; }
        }
        if (!best) break;
        const to = best.position.clone(); to.y += (best.userData.T.aimY ?? 1.2) * best.userData.sc;
        bolt(from, to);
        dmg *= w.chain.falloff;
        addHit(best, dmg / stats.damage * stats.damage, false, to, null);
        chained.add(best); z = best; from = to;
      }
    } else if (h) sparks.emit(end.x, end.y, end.z, 8, { speed: 3, spread: 2, life: .3, grav: 6, colors: [0x8fe8ff, 0xffffff] });
  } else {
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      raycaster.set(origin, dir); raycaster.far = w.range;
      const hits = raycaster.intersectObjects([...targets, ...solids], true);
      let end = origin.clone().addScaledVector(dir, w.range), pierce = (w.pierce || 0) + stats.pierce, mult = 1;
      const seen = new Set();
      for (const h of hits) {
        const z = h.object.userData.zroot;
        if (!z) {
          end = h.point.clone();
          if (!w.flame) sparks.emit(end.x, end.y, end.z, 5, { dir: h.face ? h.face.normal : null, speed: 3.5, spread: 1.2, life: .35, grav: 12, colors: w.freeze ? [0xbff6ff, 0xffffff] : [0xffd080, 0xffa040] });
          break;
        }
        if (seen.has(z)) continue;
        seen.add(z);
        const head = !!h.object.userData.head;
        const falloff = w.pellets > 1 ? Math.max(.35, 1 - h.distance / w.range) : 1;
        addHit(z, w.damage * sd * falloff * mult * (head ? w.head * stats.headMul : 1), head, h.point, dir);
        end = h.point.clone();
        if (pierce-- <= 0) break;
        mult *= .8;
      }
      if (p === 0 && hits.length) impact = end;
      if (w.flame) {
        if (p === 0) sparks.emit(muzzle.x, muzzle.y, muzzle.z, 7, { dir, speed: 10, spread: .35, life: .45, grav: -3, drag: 1.5, colors: [0xffd27a, 0xff8a2a, 0xff4a1a, 0xffffff] });
      } else if (p < 3) tracer(muzzle, end, w.freeze ? 0xbff6ff : w.burn ? 0xffa050 : w.pierce ? 0xfff4d0 : 0xffe3a8, w.freeze ? .03 : w.pierce ? .026 : .018, w.freeze ? .07 : .045);
    }
  }

  let killed = false, headHit = false, anyHit = false;
  for (const [z, e] of hitMap) {
    anyHit = true;
    if (w.burn) ignite(z, w.burn * sd);
    if (w.freeze) chill(z, w.freeze);
    if (stats.frost && R() < stats.frost) chill(z, .55);
    if (stats.incendiary && R() < stats.incendiary) ignite(z, 24 * sd);
    damageZombie(z, e.dmg, e.point, e.head, w.knock && e.dir ? tmp2.set(e.dir.x * w.knock, 0, e.dir.z * w.knock) : null);
    if (w.freeze && !z.userData.dead) gore.emit(e.point.x, e.point.y, e.point.z, 3, { speed: 2, spread: 1.5, life: .5, colors: [0xdff8ff, 0x9fd8f0] });
    killed ||= z.userData.dead; headHit ||= e.head;
  }
  if (anyHit) {
    state.hits++;
    headHit ? sfx.head() : sfx.hit();
    ui.hit.className = 'center' + (killed ? ' kill' : headHit ? ' head' : '');
    void ui.hit.offsetWidth;
    ui.hit.classList.add('show');
    clearTimeout(ui.hit._t); ui.hit._t = setTimeout(() => ui.hit.classList.remove('show'), 110);
  }
  if (headHit && stats.refund) player.ammo[i] = Math.min(magSize(i), player.ammo[i] + stats.refund);
  if (stats.explosive && impact && ++player.shotN % [10, 7, 5][Math.min(2, stats.explosive - 1)] === 0) explode(impact.x, impact.z, { radius: 2.8, zdmg: 110 * sd, color: 0xffb040, small: true });
  if (player.ammo[i] === 0 && player.reserve[i] > 0) schedule(.2, reload);
}

const shells = [];
const shellGeo = new THREE.SphereGeometry(.07, 10, 8);
const shellMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, metalness: .6, roughness: .4 });
const voidMat = new THREE.MeshBasicMaterial({ color: 0x14002a });
function launchShell(w, from, dir) {
  const P = w.projectile;
  const m = new THREE.Mesh(shellGeo, P.blackhole ? voidMat : shellMat);
  if (P.blackhole) {
    m.scale.setScalar(2);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: P.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(4);
    m.add(halo);
  }
  m.position.copy(from);
  scene.add(m);
  shells.push({ mesh: m, w, vx: dir.x * P.speed, vy: dir.y * P.speed + (P.gravity ? 1.5 : 0), vz: dir.z * P.speed, t: 3 });
}
function updateShells(dt) {
  for (let k = shells.length - 1; k >= 0; k--) {
    const s = shells[k], m = s.mesh, P = s.w.projectile;
    s.t -= dt; s.vy -= P.gravity * dt;
    m.position.x += s.vx * dt; m.position.y += s.vy * dt; m.position.z += s.vz * dt;
    sparks.emit(m.position.x, m.position.y, m.position.z, 1, { speed: .4, spread: 1, life: .3, grav: 0, colors: [P.color] });
    let hit = s.t <= 0 || m.position.y < .06 || blocked(m.position.x, m.position.z, 0);
    if (!hit) for (const z of zombies) {
      const u = z.userData;
      if (u.dead || u.rise > .5) continue;
      if (Math.hypot(z.position.x - m.position.x, z.position.z - m.position.z) < .45 * u.sc * u.T.bulk + .15 && m.position.y < 2.1 * u.sc) { hit = true; break; }
    }
    if (!hit) continue;
    scene.remove(m); shells.splice(k, 1);
    if (P.blackhole) spawnSingularity(m.position.x, m.position.z, s.w);
    else explode(m.position.x, m.position.z, { radius: P.radius, zdmg: s.w.damage * stats.damage, color: P.color });
  }
}

const singularities = [];
const voidCoreGeo = new THREE.SphereGeometry(.5, 20, 14);
function spawnSingularity(x, z, w) {
  const g = new THREE.Group();
  g.position.set(x, 1.1, z);
  const core = new THREE.Mesh(voidCoreGeo, new THREE.MeshBasicMaterial({ color: 0x050008 }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xa66bff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(4.5);
  const disc = new THREE.Mesh(new THREE.RingGeometry(.7, 1.25, 48), new THREE.MeshBasicMaterial({ color: 0xc9a0ff, transparent: true, opacity: .6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2.4;
  g.add(core, halo, disc);
  scene.add(g);
  singularities.push({ g, core, halo, disc, x, z, t: 0, dur: 2.6, dps: w.damage * 3 * stats.damage, tick: 0 });
  sfx.void(); haptic('HEAVY');
  look.shake = Math.max(look.shake, .2);
}
function updateSingularities(dt) {
  for (let k = singularities.length - 1; k >= 0; k--) {
    const v = singularities[k];
    v.t += dt;
    const grow = Math.min(1, v.t / .3);
    v.core.scale.setScalar(grow * (1 + Math.sin(v.t * 30) * .06));
    v.disc.rotation.z += dt * 6;
    v.halo.material.opacity = .6 + Math.sin(v.t * 12) * .3;
    const a = Math.random() * Math.PI * 2;
    sparks.emit(v.x + Math.cos(a) * 4, 1 + Math.random(), v.z + Math.sin(a) * 4, 2, { dir: { x: -Math.cos(a), y: 0, z: -Math.sin(a) }, speed: 8, spread: .2, life: .45, grav: 0, drag: 0, colors: [0xc9a0ff, 0x7a3aff] });
    v.tick -= dt;
    const doTick = v.tick <= 0;
    if (doTick) v.tick = .25;
    for (const zb of zombies) {
      const u = zb.userData;
      if (u.dead || u.rise > .3) continue;
      const dx = v.x - zb.position.x, dz = v.z - zb.position.z, d = Math.hypot(dx, dz);
      if (d > 10) continue;
      if (d > .7) {
        const pull = (1 - d / 10) * (u.T.boss ? 1.8 : 8) * dt;
        const nx = zb.position.x + dx / d * pull, nz = zb.position.z + dz / d * pull;
        if (!blocked(nx, zb.position.z, u.radius * .8)) zb.position.x = nx;
        if (!blocked(zb.position.x, nz, u.radius * .8)) zb.position.z = nz;
      }
      if (doTick && d < 4) damageZombie(zb, v.dps * .25, null, false, null);
    }
    if (v.t >= v.dur) {
      scene.remove(v.g); singularities.splice(k, 1);
      explode(v.x, v.z, { radius: 6.5, zdmg: 360 * stats.damage, color: 0xa66bff });
    }
  }
}

const nadeGeo = new THREE.SphereGeometry(.09, 10, 8);
const nadeMat = mat(0x3d4a2a, { roughness: .6, metalness: .3 });
function throwGrenade() {
  if (state.mode !== 'playing' || player.nades <= 0 || state.net?.out) return;
  player.nades--;
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow = true;
  m.position.copy(camera.position).addScaledVector(fwd, .6); m.position.y -= .2;
  scene.add(m);
  grenades.push({ mesh: m, vx: fwd.x * 14, vy: fwd.y * 14 + 4.5, vz: fwd.z * 14, t: 1.6 });
  sfx.throw(); haptic('LIGHT');
}

function explode(x, z, o = {}) {
  const R = o.radius ?? 6.5, visualOnly = state.net?.exploded(x, z, o);
  blast.material.color.setHex(o.color ?? 0xffa040);
  blast.position.set(x, .6, z); blast.scale.setScalar(.2); blast.visible = true; blast.userData.t = 0; blast.userData.r = R / 6.5;
  blastLight.color.setHex(o.color ?? 0xff8a30);
  blastLight.position.set(x, 1.5, z); blastLight.intensity = 90;
  const fire = o.hostile ? [0xd8ff80, 0x9aff40, 0xffd060] : [0xffd080, 0xff8030, 0xff5010];
  sparks.emit(x, .5, z, 60, { speed: 11, spread: 2.2, life: .7, grav: 8, dir: { x: 0, y: .8, z: 0 }, colors: fire });
  gore.emit(x, .4, z, 40, { speed: 4, spread: 2, life: 1.6, grav: -1.2, drag: 1.5, dir: { x: 0, y: 1, z: 0 }, colors: o.hostile ? [0x3a4a1a, 0x5a6a20, 0x2a2a1a] : [0x2a2a2a, 0x3a3632, 0x1a1a1a] });
  decal(x, z, R * .5, o.hostile ? 0x8aff4a : 0x222222);
  const d = Math.hypot(camera.position.x - x, camera.position.z - z);
  look.shake = Math.max(look.shake, o.small ? .06 : Math.max(.15, 1 - d / 18));
  sfx.boom(); haptic(o.small ? 'MEDIUM' : 'HEAVY');
  if (o.hostile && d < R) hurtPlayer(o.pdmg * (1 - d / R * .6), { x, z });
  if (visualOnly) return;
  for (const zb of [...zombies]) {
    const u = zb.userData;
    if (u.dead) continue;
    const dd = Math.hypot(zb.position.x - x, zb.position.z - z);
    if (dd > R) continue;
    const k = 1 - dd / R;
    const dir = tmp2.set((zb.position.x - x) / (dd || 1) * 3 * k, 0, (zb.position.z - z) / (dd || 1) * 3 * k);
    const base = o.zdmg ?? (o.friendly ? 500 : 340) * stats.damage;
    damageZombie(zb, base * (.35 + k * .65), null, false, dir);
  }
}

const acidGeo = new THREE.SphereGeometry(.15, 8, 6);
const acidMat = new THREE.MeshBasicMaterial({ color: 0xa6ff3a });
const projectiles = [];
const hazards = [];
const puddleMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x7dff2a, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending });
const puddlePool = Array.from({ length: 8 }, () => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), puddleMat);
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m;
});
let puddleCursor = 0;
const slamRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
slamRing.rotation.x = -Math.PI / 2; slamRing.visible = false; scene.add(slamRing);
const SLAM_R = 5.6;

function spit(z, at = camera.position) {
  const u = z.userData, count = u.T.volley || 1;
  const fx = z.position.x, fy = 1.55 * u.sc, fz = z.position.z;
  state.net?.spat(z, at);
  for (let i = 0; i < count; i++) {
    const tx = at.x + (i ? (Math.random() - .5) * 4 : move.x * 1.2), tz = at.z + (i ? (Math.random() - .5) * 4 : 0);
    const dist = Math.hypot(tx - fx, tz - fz), t = THREE.MathUtils.clamp(dist / 11, .7, 1.5), G = 14;
    const m = new THREE.Mesh(acidGeo, acidMat);
    m.position.set(fx, fy, fz);
    scene.add(m);
    projectiles.push({ mesh: m, vx: (tx - fx) / t, vy: (1.1 - fy + .5 * G * t * t) / t, vz: (tz - fz) / t, dmg: u.T.boss ? 16 : 11, from: { x: fx, z: fz } });
  }
  sfx.spit();
}

function acidPuddle(x, z) {
  const m = puddlePool[puddleCursor = (puddleCursor + 1) % puddlePool.length];
  m.position.set(x, .04, z); m.visible = true; m.scale.setScalar(.2);
  const old = hazards.findIndex(h => h.mesh === m);
  if (old >= 0) hazards.splice(old, 1);
  hazards.push({ mesh: m, x, z, t: 5, tick: 0 });
}

function updateHazards(dt) {
  for (let k = projectiles.length - 1; k >= 0; k--) {
    const p = projectiles[k], m = p.mesh;
    p.vy -= 14 * dt;
    m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    if (Math.random() < .6) sparks.emit(m.position.x, m.position.y, m.position.z, 1, { speed: .3, spread: 1, life: .3, grav: 2, colors: [0x9aff3a, 0x5aff2a] });
    const hitPlayer = m.position.distanceTo(tmp.set(camera.position.x, camera.position.y - .5, camera.position.z)) < .75;
    if (hitPlayer || m.position.y < .06 || blocked(m.position.x, m.position.z, 0)) {
      if (hitPlayer) hurtPlayer(p.dmg, p.from);
      else acidPuddle(m.position.x, m.position.z);
      sparks.emit(m.position.x, Math.max(.1, m.position.y), m.position.z, 10, { speed: 2.5, spread: 2, life: .4, grav: 8, colors: [0x9aff3a, 0xd8ff80] });
      scene.remove(m); projectiles.splice(k, 1);
    }
  }
  for (let k = hazards.length - 1; k >= 0; k--) {
    const h = hazards[k];
    h.t -= dt;
    h.mesh.scale.setScalar(Math.min(1, h.mesh.scale.x + dt * 4) * (h.t < 1 ? h.t : 1));
    if (h.t <= 0) { h.mesh.visible = false; hazards.splice(k, 1); continue; }
    h.tick -= dt;
    if (h.tick <= 0 && Math.hypot(camera.position.x - h.x, camera.position.z - h.z) < 1.5) { h.tick = .5; hurtPlayer(3.5, null, true); sfx.sizzle(); }
  }
}

function bossAbilities(z, dt, d, dx, dz) {
  const u = z.userData, T = u.T;
  if (T.summon && state.clock > u.nextSummon) {
    u.nextSummon = state.clock + (u.enraged ? 9 : 13);
    let n = 0;
    for (let i = 0; i < 4 && n < 3; i++) {
      const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 2.5;
      const x = z.position.x + Math.cos(a) * r, zz = z.position.z + Math.sin(a) * r;
      if (blocked(x, zz, .6)) continue;
      makeZombie(Math.random() < .5 ? 'crawler' : 'walker', x, zz, true);
      n++;
    }
    state.waveTotal += n;
    if (n) { toast(T.name + ' RAISES THE DEAD', 1.6); sfx.roar(); }
  }
  if (T.slam && !u.cs) {
    if (u.slamT > 0) {
      u.slamT -= dt;
      slamRing.visible = true;
      slamRing.position.set(z.position.x, .05, z.position.z);
      const k = 1 - u.slamT / .9;
      slamRing.scale.setScalar(SLAM_R * k);
      slamRing.material.opacity = .4 + Math.sin(state.clock * 30) * .3;
      if (u.slamT <= 0) {
        slamRing.visible = false;
        u.nextSlam = state.clock + (u.enraged ? 3.5 : 5);
        look.shake = Math.max(look.shake, .45);
        gore.emit(z.position.x, .2, z.position.z, 50, { speed: 7, spread: 2, life: .9, grav: 6, dir: { x: 0, y: .4, z: 0 }, colors: [0x3a3226, 0x2a241c, 0x4a4238] });
        sfx.boom(); haptic('HEAVY');
        if (state.net) state.net.aoe(z.position, SLAM_R, T.dmg * .8); else if (d < SLAM_R) hurtPlayer(T.dmg * .8, z.position);
      }
      return true;
    }
    if (d < SLAM_R - .8 && state.clock > u.nextSlam) { u.slamT = .9; sfx.roar(); return true; }
  }
  if (T.charge) {
    if (u.cs === 'wind') {
      u.ct -= dt;
      if (u.ct <= 0) {
        u.cs = 'run'; u.ct = 2;
        u.cdx = dx / d; u.cdz = dz / d;
      }
      return true;
    }
    if (u.cs === 'run') {
      u.ct -= dt;
      const step = (T.chargeSpeed ?? 11) * dt;
      const nx = z.position.x + u.cdx * step, nz = z.position.z + u.cdz * step;
      u.walk += dt * T.stride * 3;
      u.moving = true;
      if (blocked(nx, nz, u.radius)) {
        u.cs = 'stun'; u.ct = 2.4; look.shake = Math.max(look.shake, .3); sfx.boom();
        toast(T.name + ' IS STUNNED — HIT HIM!', 1.6);
      } else {
        z.position.x = nx; z.position.z = nz;
        gore.emit(nx, .1, nz, 2, { speed: 2, spread: 2, life: .5, colors: [0x3a3226] });
      }
      if (u.cs === 'run' && state.net?.charge(z, .9 + u.sc * .5, T.dmg * 1.2, u.cdx, u.cdz)) { u.cs = ''; u.nextCharge = state.clock + 6; }
      const pd = Math.hypot(camera.position.x - z.position.x, camera.position.z - z.position.z);
      if (u.cs === 'run' && pd < .9 + u.sc * .5 && !state.net?.immune) {
        hurtPlayer(T.dmg * 1.2, z.position);
        for (let i = 0; i < 10; i++) {
          const px = camera.position.x + u.cdx * .3, pz = camera.position.z + u.cdz * .3;
          if (blocked(px, pz, .36)) break;
          camera.position.x = px; camera.position.z = pz;
        }
        u.cs = ''; u.nextCharge = state.clock + 6;
      } else if (u.cs === 'run' && u.ct <= 0) { u.cs = ''; u.nextCharge = state.clock + (u.enraged ? 4.5 : 6.5); }
      return true;
    }
    if (u.cs === 'stun') {
      u.ct -= dt; u.moving = false;
      if (u.ct <= 0) { u.cs = ''; u.nextCharge = state.clock + 5; }
      return true;
    }
    if (d > 5.5 && d < 28 && state.clock > u.nextCharge && u.slamT <= 0) {
      u.cs = 'wind'; u.ct = .85; u.moving = false;
      sfx.roar(); toast('CHARGE INCOMING — SIDESTEP!', 1.2); haptic('MEDIUM');
      return true;
    }
  }
  return false;
}

function specialAbilities(z, dt, d) {
  const u = z.userData, T = u.T;
  if (T.scream) {
    if (u.screamT > 0) { if ((u.screamT -= dt) <= 0) scream(z); return true; }
    if (state.clock > u.nextScream && d < 20 && u.clear) { u.screamT = .9; sfx.scream(); return true; }
  }
  if (T.stalk) {
    u.stalkT -= dt;
    if (d < 6 || u.burnT > 0 || u.chill > .3 || state.clock - u.hitAt < 1) { if (u.hidden) { u.hidden = false; u.stalkT = 1.6; if (d < 14) sfx.hiss(); } }
    else if (u.stalkT <= 0) { u.hidden = !u.hidden; u.stalkT = u.hidden ? 2.4 + Math.random() : 1.1 + Math.random() * .6; if (!u.hidden && d < 14) sfx.hiss(); }
  }
  if (T.lunge && diff().rank >= T.lunge) {
    if (u.lungeT > 0) { if ((u.lungeT -= dt) <= 0) u.lungeGo = .32; return true; }
    if (u.lungeGo > 0) u.lungeGo -= dt;
    else if (d > 1.6 && d < 4.2 && state.clock > u.nextLunge && u.clear) { u.lungeT = .4; u.nextLunge = state.clock + 3 + Math.random() * 2; sfx.hiss(); return true; }
  }
  return false;
}
function scream(z) {
  const u = z.userData, x = z.position.x, zz = z.position.z;
  u.nextScream = state.clock + (diff().rank >= 3 ? 6 : 7.5);
  screamFx(z);
  let alive = 0;
  for (const o of zombies) {
    const v = o.userData;
    if (v.dead) continue;
    alive++;
    if (o !== z && !v.T.boss && Math.hypot(o.position.x - x, o.position.z - zz) < 11) v.hasteT = 6;
  }
  let n = 0;
  for (let i = 0; i < 4 && n < 2 && u.summons < 4 && alive + n < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 2, sx = x + Math.cos(a) * r, sz = zz + Math.sin(a) * r;
    if (blocked(sx, sz, .6)) continue;
    makeZombie(R() < .5 ? 'runner' : 'walker', sx, sz, true);
    n++; u.summons++;
  }
  state.waveTotal += n;
}
function screamFx(z) {
  const d = Math.hypot(camera.position.x - z.position.x, camera.position.z - z.position.z);
  sparks.emit(z.position.x, 1.8 * z.userData.sc, z.position.z, 36, SCREAM_FX);
  if (d > 25) return;
  look.shake = Math.max(look.shake, .18 * (1 - d / 25));
  toast('THE SCREAM RILES THE HORDE', 1.2); haptic('MEDIUM');
}

const PICKUP_KINDS = {
  health: { color: 0x6dff8a, label: '+HEALTH' },
  ammo: { color: 0xffc34d, label: '+AMMO' },
  grenade: { color: 0xff7a4d, label: '+GRENADE' },
};
function dropPickup(x, z, kind) {
  if (!kind) {
    const r = R(), lowHp = player.hp < stats.maxHp * .5;
    kind = r < (lowHp ? .5 : .3) ? 'health' : r < .82 ? 'ammo' : 'grenade';
  }
  if (blocked(x, z, .2)) { x = camera.position.x * .3 + x * .7; z = camera.position.z * .3 + z * .7; }
  const g = new THREE.Group(), K = PICKUP_KINDS[kind];
  const inner = new THREE.Group(); g.add(inner);
  if (kind === 'health') {
    mesh(new THREE.BoxGeometry(.5, .32, .36), mat(0xe8ece8, { roughness: .5 }), 0, 0, 0, inner);
    mesh(new THREE.BoxGeometry(.3, .08, .37), mat(0xd42a22, { emissive: 0xd42a22, emissiveIntensity: .6 }), 0, 0, 0, inner);
    mesh(new THREE.BoxGeometry(.08, .3, .37), mat(0xd42a22, { emissive: 0xd42a22, emissiveIntensity: .6 }), 0, 0, 0, inner).rotation.z = Math.PI / 2;
  } else if (kind === 'ammo') {
    mesh(new THREE.BoxGeometry(.55, .28, .34), mat(0x4a5230, { roughness: .8 }), 0, 0, 0, inner);
    for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(.025, .025, .16, 6), mat(0xd8a640, { metalness: .8, roughness: .3 }), -.18 + i * .09, .22, 0, inner);
  } else {
    mesh(new THREE.SphereGeometry(.16, 12, 10), nadeMat, 0, 0, 0, inner);
    mesh(new THREE.CylinderGeometry(.05, .05, .1, 8), mat(0x777777, { metalness: .8 }), 0, .17, 0, inner);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 4, 10, 1, true), new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 2; g.add(beam);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: K.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.3); g.add(glow);
  g.position.set(x, .5, z);
  g.userData = { kind, t: 25, inner };
  scene.add(g);
  pickups.push(g);
  state.net?.dropped(g);
}

function collect(p) {
  const k = p.userData.kind;
  if (k === 'health') player.hp = Math.min(stats.maxHp, player.hp + 35);
  if (k === 'ammo') player.slots.forEach(i => (player.reserve[i] = Math.min(WEAPONS[i].maxReserve, player.reserve[i] + magSize(i) * (WEAPONS[i].pickup ?? 1))));
  if (k === 'grenade') player.nades = Math.min(stats.nadeMax, player.nades + 1);
  floater(p.position.x, 1.3, p.position.z, PICKUP_KINDS[k].label, 'pick');
  sfx.pickup(); haptic('LIGHT');
}

const PERKS = [
  { icon: '💥', name: 'HOLLOW POINTS', desc: '+20% weapon damage', apply: () => (stats.damage *= 1.2) },
  { icon: '⚡', name: 'HAIR TRIGGER', desc: '+18% fire rate', apply: () => (stats.fireRate *= 1.18) },
  { icon: '❤️', name: 'THICK SKIN', desc: '+25 max health and a full heal', apply: () => { stats.maxHp += 25; player.hp = stats.maxHp; } },
  { icon: '🔄', name: 'SLEIGHT OF HAND', desc: '30% faster reloads', apply: () => (stats.reload *= .7) },
  { icon: '👟', name: 'CARDIO', desc: '+12% move speed', apply: () => (stats.speed *= 1.12) },
  { icon: '📦', name: 'EXTENDED MAGS', desc: '+40% magazine size', apply: () => { stats.mag *= 1.4; } },
  { icon: '🎯', name: 'DEADEYE', desc: '+40% headshot damage', apply: () => (stats.headMul *= 1.4) },
  { icon: '🩸', name: 'VAMPIRE', desc: 'Heal 4 HP on every kill', apply: () => (stats.leech += 4) },
  { icon: '💣', name: 'DEMOLITIONS', desc: '+1 grenade slot, refill all', apply: () => { stats.nadeMax++; player.nades = stats.nadeMax; } },
  { icon: '🛡️', name: 'KEVLAR', desc: 'Take 15% less damage', apply: () => (stats.armor *= .85) },
  { icon: '🍀', name: 'SCAVENGER', desc: '+50% supply drop chance', apply: () => (stats.luck *= 1.5) },
  { icon: '👼', name: 'SECOND WIND', desc: 'Survive one fatal hit', rare: true, when: () => !stats.secondWind, apply: () => (stats.secondWind = true) },
  { icon: '☢️', name: 'NUCLEAR ROUNDS', desc: '+45% damage, +15% fire rate', rare: true, apply: () => { stats.damage *= 1.45; stats.fireRate *= 1.15; } },
];

function offerPerks(kit = 0) {
  state.mode = 'perk';
  ui.perkTitle.textContent = kit ? 'STARTING KIT' : 'WAVE ' + state.wave + ' CLEARED';
  ui.perkSub.textContent = kit ? 'UPGRADE ' + (state.kitTotal - kit + 1) + ' OF ' + state.kitTotal + ' · WAVE ' + state.startWave + ' CHECKPOINT' : 'CHOOSE AN UPGRADE';
  const r = state.seed == null ? R : mulberry32(hashSeed(state.seed + ':perks:' + state.wave));
  const ok = p => !p.when || p.when();
  const pool = PERKS.filter(p => !p.legendary && ok(p) && (!p.rare || r() < .3));
  const picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice((r() * pool.length) | 0, 1)[0]);
  const legends = PERKS.filter(p => p.legendary && ok(p));
  if (state.wave >= 10 && legends.length && r() < .08) picks.splice(Math.min(1, picks.length), picks.length > 1 ? 1 : 0, legends[(r() * legends.length) | 0]);
  state.perkOffer = picks.map(p => p.name);
  ui.perkList.innerHTML = '';
  for (const p of picks) {
    const b = document.createElement('button');
    b.className = 'perk' + (p.legendary ? ' legendary' : p.rare ? ' rare' : '');
    b.innerHTML = `<div class="ico">${p.icon}</div><b>${p.name}</b><span>${p.desc}</span>`;
    b.onclick = () => {
      if (state.mode !== 'perk') return;
      p.apply(); sfx.perk(); haptic(p.legendary ? 'HEAVY' : 'MEDIUM');
      state.perks.push(p.name);
      bus.emit('perk', { name: p.name, icon: p.icon, rare: !!p.rare, legendary: !!p.legendary, wave: state.wave, kit: !!kit });
      if (kit > 1) { offerPerks(kit - 1); return; }
      showScreen(null);
      state.mode = 'playing';
      toast(p.name, 1.4);
      if (state.net) state.net.perked(p); else schedule(1.4, nextWave);
    };
    ui.perkList.appendChild(b);
  }
  showScreen(ui.perks);
}

function waveCleared() {
  state.between = true;
  const bonus = state.wave * 250;
  state.score += bonus;
  player.hp = Math.min(stats.maxHp, player.hp + stats.maxHp * .2);
  player.slots.forEach(i => (player.reserve[i] = Math.min(WEAPONS[i].maxReserve, player.reserve[i] + magSize(i))));
  if (stats.nadeRegen) player.nades = Math.min(stats.nadeMax, player.nades + stats.nadeRegen);
  message('SECTOR CLEAR', 'BONUS +' + bonus, 2);
  bus.emit('wave:clear', { wave: state.wave, bonus, hp: player.hp });
  sfx.clear(); haptic('MEDIUM');
  schedule(2.2, offerPerks);
}

function runSummary() {
  return {
    type: state.runType || 'normal', seed: state.seed, difficultyId: state.runDifficulty || settings.difficulty,
    score: state.score, wave: state.wave, startWave: state.startWave, kills: state.kills, heads: state.heads, shots: state.shots, hits: state.hits,
    accuracy: state.shots ? state.hits / state.shots : 0, bestCombo: state.bestCombo, time: state.clock,
    bosses: [...state.bossKinds], slots: [...player.slots], weapon: WEAPONS[player.slots[0]].id, map: world.map.id, perks: [...state.perks],
  };
}

const reachedWave = () => state.startWave === 1 || state.wave > state.startWave ? state.wave : 0;

function gameOver() {
  state.mode = 'dead';
  firing = false;
  bus.emit('run:end', runSummary());
  const coop = state.runType === 'coop';
  if (!coop) saveRun();
  grantRewards();
  const rankEl = $('#over-rank'), summary = runSummary();
  if (!state.score || coop) rankEl.textContent = '';
  else if (!gameCenter.available()) rankEl.textContent = 'GLOBAL RANKINGS ARE AVAILABLE IN THE iOS APP';
  else {
    rankEl.textContent = 'SUBMITTING TO GLOBAL LEADERBOARD…';
    const run = state.startedAt, label = { daily: 'DAILY RANK #', ranked: 'WEEKLY RANK #' }[summary.type] || 'GLOBAL RANK #';
    gameCenter.submit(state.score, state.wave, encodeLoadout({ ...profile.loadout, primary: player.slots[0] }, levelInfo().level), summary).then(p => {
      if (state.startedAt !== run) return;
      if (p && !p.rejected && gameCenter.boards(summary.type)[0] === LEADERBOARDS.score) { records.rank = p.rank; store.set('records', records); }
      rankEl.textContent = p?.rejected ? 'SCORE NOT SUBMITTED — ' + p.rejected : p ? label + p.rank.toLocaleString() : 'SIGN IN TO GAME CENTER TO RANK GLOBALLY';
      bus.emit('run:submitted', { type: summary.type, board: gameCenter.boards(summary.type)[0], result: p });
    });
  }
  const secs = Math.round(state.clock);
  const best = !coop && state.score > records.score;
  if (!coop) {
    records.score = Math.max(records.score, state.score);
    records.wave = Math.max(records.wave, reachedWave());
    store.set('records', records);
  }
  $('#over-sub').textContent = 'WAVE ' + state.wave + (state.startWave > 1 ? ' · STARTED AT WAVE ' + state.startWave : '') + ' · ' + diff().name + ' · ' + world.map.name;
  $('#newbest').classList.toggle('hidden', !best || state.score === 0);
  $('#st-score').textContent = state.score.toLocaleString();
  $('#st-kills').textContent = state.kills;
  $('#st-heads').textContent = state.heads;
  $('#st-acc').textContent = (state.shots ? Math.round(state.hits / state.shots * 100) : 0) + '%';
  $('#st-combo').textContent = state.bestCombo;
  $('#st-time').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  haptic('HEAVY');
  setTimeout(() => { ui.hud.classList.remove('on'); showScreen(ui.over); }, 900);
}

function grantRewards() {
  const box = $('#over-rewards');
  box.innerHTML = '';
  const chip = (text, cls = '') => { const e = document.createElement('span'); e.textContent = text; if (cls) e.className = cls; box.appendChild(e); };
  const before = unlockedSet(), lvlBefore = levelInfo().level;
  const today = new Date().toDateString(), daily = profile.lastDaily !== today && state.score > 0;
  const played = state.wave - state.startWave + 1;
  const scrap = Math.round((state.score / 150 + played * 6 + state.bossKinds.length * 60) * (daily ? 2 : 1) * stats.fortune);
  const xp = Math.round(state.score / 10 + played * 50);
  profile.scrap += scrap;
  profile.xp += xp;
  profile.kills += state.kills;
  profile.heads += state.heads;
  profile.runs++;
  for (const k of state.bossKinds) profile.bosses[k] = (profile.bosses[k] || 0) + 1;
  profile.bestWave = Math.max(profile.bestWave, reachedWave());
  const runDiff = state.runDifficulty || settings.difficulty;
  profile.bestByDiff[runDiff] = Math.max(profile.bestByDiff[runDiff] || 0, reachedWave());
  if (daily) profile.lastDaily = today;
  const lvlAfter = levelInfo().level;
  const fresh = [...unlockedSet()].filter(k => !before.has(k));
  profile.fresh = [...new Set([...profile.fresh, ...fresh])];
  saveProfile();
  chip('+' + scrap.toLocaleString() + ' 🔩 SCRAP' + (daily ? ' (DAILY x2)' : ''), 'gold');
  chip('+' + xp.toLocaleString() + ' XP');
  if (lvlAfter > lvlBefore) chip('LEVEL UP · ' + lvlAfter, 'hot');
  if (fresh.length === 1) {
    const [slot, i] = fresh[0].split(':');
    chip('🔓 UNLOCKED: ' + slotById(slot).items[i].name, 'hot');
  } else if (fresh.length) chip('🔓 ' + fresh.length + ' NEW ITEMS IN LOCKER', 'hot');
  refreshProfileUI();
}

function toMenu() {
  resetRun();
  state.mode = 'menu';
  ui.hud.classList.remove('on');
  guns.forEach(g => (g.visible = false));
  showScreen(ui.menu);
  refreshRecords();
  populateMenu();
}

function populateMenu() {
  state.wave = 1;
  const [hx, hz, sx, sz] = world.map.menu.horde;
  ['walker', 'crawler', 'bloater', 'riot', 'spitter', 'brute', 'runner', 'walker'].forEach(k => {
    let x = hx, z = hz;
    for (let t = 0; t < 12; t++) { x = hx + (Math.random() - .5) * sx; z = hz + (Math.random() - .5) * sz; if (!blocked(x, z, .6)) break; }
    makeZombie(k, x, z, false);
  });
  menuTarget.set(hx, 0, hz + 4);
}
function menuWander() {
  const [tx, tz, sx, sz] = world.map.menu.target;
  menuTarget.set(tx + (Math.random() - .5) * sx, 0, tz + (Math.random() - .5) * sz);
}
function selectMap(id) {
  if (loadMap(id) && state.mode === 'menu') {
    for (const z of zombies) scene.remove(z);
    zombies.length = 0;
    populateMenu();
  }
  store.set('map', world.map.id);
  bus.emit('map', { id: world.map.id });
  return world.map.id;
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = state.net ? 'playing' : 'paused';
  firing = false;
  showScreen(ui.pauseMenu);
}
function resume() {
  state.mode = 'playing';
  showScreen(null);
}

let activeScreen = ui.menu;
const screens = new Set([ui.menu, ui.pauseMenu, ui.settings, ui.perks, ui.over, ui.board, ui.locker, ui.inspect, ui.armory]);
function registerScreen(el) { screens.add(el); el.classList.add('hidden'); return el; }
function showScreen(el) {
  for (const s of screens) s.classList.toggle('hidden', s !== el);
  activeScreen = el;
  placePreview();
  bus.emit('screen', { id: el?.id || 'game' });
}
function placePreview() {
  const el = activeScreen;
  if (el === ui.menu && getComputedStyle($('#menu-char')).display !== 'none') { preview.show(profile.loadout); preview.attach($('#menu-char'), 'full', true); }
  else if (el === ui.locker) preview.attach($('#locker-stage'), 'full', false);
  else if (el === ui.inspect) preview.attach($('#inspect-stage'), 'full', true);
  else if (el === ui.armory) preview.attach($('#armory-stage'), 'weapon', true);
  else preview.detach();
}

const floaterPool = Array.from({ length: 24 }, () => { const e = document.createElement('div'); e.className = 'floater'; ui.floaters.appendChild(e); return { e, t: 0, p: new THREE.Vector3() }; });
let floaterCursor = 0;
function floater(x, y, z, text, cls) {
  const f = floaterPool[floaterCursor = (floaterCursor + 1) % floaterPool.length];
  f.p.set(x + (Math.random() - .5) * .3, y, z + (Math.random() - .5) * .3); f.t = .9;
  f.e.textContent = text; f.e.className = 'floater ' + (cls || '');
}
function updateFloaters(dt) {
  for (const f of floaterPool) {
    if (f.t <= 0) continue;
    f.t -= dt;
    tmp.copy(f.p); tmp.y += (.9 - f.t) * .8; tmp.project(camera);
    if (tmp.z > 1 || f.t <= 0) { f.e.style.opacity = 0; continue; }
    const x = (tmp.x * .5 + .5) * innerWidth, y = (-tmp.y * .5 + .5) * innerHeight;
    f.e.style.opacity = Math.min(1, f.t * 3);
    f.e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${1 + Math.max(0, f.t - .75) * 2})`;
  }
}

const indPool = Array.from({ length: 4 }, () => { const e = document.createElement('div'); e.className = 'ind'; ui.indicators.appendChild(e); return e; });
let indCursor = 0;
function damageIndicator(from) {
  const e = indPool[indCursor = (indCursor + 1) % indPool.length];
  const dx = from.x - camera.position.x, dz = from.z - camera.position.z;
  const f = dx * -Math.sin(look.yaw) + dz * -Math.cos(look.yaw), r = dx * Math.cos(look.yaw) + dz * -Math.sin(look.yaw);
  e.style.transition = 'none'; e.style.opacity = 1; e.style.transform = `rotate(${Math.atan2(r, f)}rad)`;
  void e.offsetWidth; e.style.transition = ''; setTimeout(() => (e.style.opacity = 0), 200);
}

let msgTimer, toastTimer;
function message(text, sub, dur = 1.8) {
  ui.message.innerHTML = text + (sub ? '<strong>' + sub + '</strong>' : '');
  ui.message.classList.add('on');
  clearTimeout(msgTimer); msgTimer = setTimeout(() => ui.message.classList.remove('on'), dur * 1000);
}
function toast(text, dur = 1.2) {
  ui.toast.textContent = text; ui.toast.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('on'), dur * 1000);
}
function hint(text) {
  ui.hint.textContent = text; ui.hint.classList.toggle('on', !!text);
}

const radarCtx = ui.radar.getContext('2d');
function drawRadar() {
  const c = radarCtx, W = 192, R = 90, range = 30;
  c.clearRect(0, 0, W, W);
  c.save(); c.translate(W / 2, W / 2);
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2;
  for (const r of [R * .33, R * .66]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
  c.fillStyle = 'rgba(120,200,255,.08)';
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -Math.PI / 2 - .64, -Math.PI / 2 + .64); c.fill();
  const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw);
  const plot = (x, z, size, color) => {
    const dx = x - camera.position.x, dz = z - camera.position.z;
    const f = -dx * sy - dz * cy, r = dx * cy - dz * sy;
    let px = r / range * R, py = -f / range * R;
    const l = Math.hypot(px, py);
    if (l > R - size) { px *= (R - size) / l; py *= (R - size) / l; }
    c.fillStyle = color; c.beginPath(); c.arc(px, py, size, 0, 7); c.fill();
  };
  for (const p of pickups) plot(p.position.x, p.position.z, 5, '#6dff8a');
  for (const z of zombies) {
    const u = z.userData;
    if (u.dead || u.vis < .4) continue;
    plot(z.position.x, z.position.z, u.T.boss ? 11 : u.sc > 1.3 ? 8 : 6, u.T.boss ? '#d35bff' : u.elite ? '#8ff0ff' : u.T.radar || (u.T.explode ? '#ff9a2a' : u.T.ranged ? '#9aff3a' : '#ff4a3a'));
  }
  state.net?.radar(plot);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 6); c.lineTo(-6, 6); c.fill();
  c.restore();
}

const hudCache = new Map();
function setText(el, v) { if (hudCache.get(el) !== v) { hudCache.set(el, v); el.textContent = v; } }
function setHTML(el, v) { if (hudCache.get(el) !== v) { hudCache.set(el, v); el.innerHTML = v; } }
function updateHud(dt) {
  const i = player.weapon;
  setText(ui.hpNum, Math.ceil(player.hp));
  const hpPct = player.hp / stats.maxHp;
  ui.hpFill.style.transform = `scaleX(${hpPct})`;
  player.lagHp += (player.hp - player.lagHp) * Math.min(1, dt * 2.5);
  ui.hpLag.style.transform = `scaleX(${player.lagHp / stats.maxHp})`;
  ui.lowhp.classList.toggle('on', hpPct < .3 && state.mode === 'playing');
  if (hpPct < .3 && state.clock - player.lastBeat > 1 && state.mode === 'playing') { player.lastBeat = state.clock; sfx.heartbeat(); }
  setText(ui.waveNum, 'WAVE ' + Math.max(state.startWave || 1, state.wave));
  const left = state.waveTotal - state.waveDone;
  setText(ui.alive, state.wave < (state.startWave || 1) ? 'GET READY' : state.between ? 'SECTOR SECURE' : (state.mod ? MODS[state.mod].name + ' · ' : state.mutation ? MUTATIONS[state.mutation].name + ' · ' : '') + left + ' INFECTED LEFT');
  ui.waveFill.style.transform = `scaleX(${state.waveTotal ? 1 - state.waveDone / state.waveTotal : 0})`;
  setText(ui.score, state.score.toLocaleString());
  const comboOn = state.combo > 1 && state.clock - state.lastKill < 3;
  ui.combo.classList.toggle('on', comboOn);
  if (comboOn) setText(ui.combo, `${state.combo} STREAK · x${comboMult().toFixed(2).replace(/0$/, '')}`);
  const mag = magSize(i), a = player.ammo[i];
  setHTML(ui.ammo, `${a}<span>/${player.reserve[i]}</span>`);
  ui.ammo.className = a === 0 ? 'empty' : a <= mag * .25 ? 'low' : '';
  ui.reload.classList.toggle('warn', a <= mag * .25 && player.reserve[i] > 0 && player.reloading <= 0);
  ui.reloadRing.style.strokeDashoffset = player.reloading > 0 ? 189 * (player.reloading / player.reloadTotal) : 189;
  setText(ui.nades, player.nades);
  ui.grenade.classList.toggle('off', player.nades <= 0);
  ui.fire.classList.toggle('auto', settings.autoFire);
  if (state.boss) ui.bossFill.style.transform = `scaleX(${Math.max(0, state.boss.userData.hp / state.boss.userData.maxHp)})`;
  const spread = 7 + (WEAPONS[i].spread + (Math.hypot(move.x, move.y) > .1 ? WEAPONS[i].moveSpread : 0)) * 260 + look.recoil * 160;
  const ch = ui.crosshair.children;
  ch[0].style.transform = `translateY(${-spread - 9}px)`; ch[1].style.transform = `translateY(${spread}px)`;
  ch[2].style.transform = `translateX(${-spread - 9}px)`; ch[3].style.transform = `translateX(${spread}px)`;
  ui.crosshair.classList.toggle('target', !!aimTarget);
  ui.ring.classList.toggle('on', player.reloading > 0);
  drawRadar();
}

function assistTarget() {
  const fwd = camera.getWorldDirection(tmp2);
  let best = null, bestScore = 1;
  for (const z of zombies) {
    const u = z.userData;
    if (u.dead || u.rise > .3 || u.vis < .5) continue;
    tmp.set(z.position.x, z.position.y + (u.T.aimY ?? 1.3) * u.sc, z.position.z).sub(camera.position);
    const d = tmp.length();
    if (d > 40) continue;
    tmp.divideScalar(d);
    const ang = Math.acos(Math.min(1, fwd.dot(tmp)));
    const allow = .06 + Math.atan(.45 * u.sc * u.T.bulk / d);
    const s = ang / allow;
    if (s < bestScore) { bestScore = s; best = { z, dir: tmp.clone(), score: s }; }
  }
  return best;
}

function updatePlayer(dt) {
  const w = WEAPONS[player.weapon];
  if (player.adrenT > 0) player.adrenT = Math.max(0, player.adrenT - dt);
  let mx = move.x + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), my = move.y + (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const mag = Math.min(1, Math.hypot(mx, my));
  let push = 0;
  const sprint = (move.sprint || keys.shift) && my > .5 && player.reloading <= 0;
  if (mag > .05 && !state.net?.downed) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    const speed = (sprint ? 6.2 : 3.6) * stats.speed * (w.mobility ?? 1) * (player.adrenT > 0 ? 1 + .3 * stats.adrenaline : 1) * mag * dt;
    const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw);
    const fx = -sy * my + cy * mx, fz = -cy * my - sy * mx;
    const nx = camera.position.x + fx * speed, nz = camera.position.z + fz * speed;
    if (!blocked(nx, camera.position.z, .36)) camera.position.x = nx;
    if (!blocked(camera.position.x, nz, .36)) camera.position.z = nz;
    const ox = nx > bounds.maxX ? 1 : nx < bounds.minX ? -1 : 0, oz = nz > bounds.maxZ ? 1 : nz < bounds.minZ ? -1 : 0;
    if (ox || oz) { const l = Math.hypot(ox, oz); push = Math.max(0, (fx * ox + fz * oz) / l) * mag; edge.side = (ox * cy - oz * sy) / l; }
    look.bob += dt * (sprint ? 13 : 9) * mag;
    if (!state.moved) { state.moved = true; if (!tutorialDone) hint('Drag the right side to aim · hold FIRE to shoot (you can aim while holding it)'); }
  }
  const et = edge.t;
  edge.t = push > edge.t ? Math.min(push, edge.t + dt * 4) : Math.max(0, edge.t - dt * 2);
  if (edge.t || et) { ui.edge.style.opacity = (edge.t * .75).toFixed(3); ui.edge.style.setProperty('--ex', (50 - edge.side * 38).toFixed(1) + '%'); }
  player.sprinting = !!sprint && mag > .05;
  ui.stick.classList.toggle('sprint', player.sprinting);
  const targetFov = sprint ? 82 : 74;
  if (Math.abs(camera.fov - targetFov) > .05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }

  aimTarget = null;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(center, camera); raycaster.far = w.range;
  const live = zombies.filter(z => !z.userData.dead && z.userData.rise < .5);
  const h = raycaster.intersectObjects([...live, ...solids], true)[0];
  if (h?.object.userData.zroot) aimTarget = h.object.userData.zroot;

  look.assist = 1;
  if (settings.aimAssist) {
    const t = assistTarget();
    if (t) {
      look.assist = .45 + .55 * t.score;
      if ((mag > .1 || firing) && t.score < 1) {
        const ty = Math.atan2(-t.dir.x, -t.dir.z), tp = Math.asin(THREE.MathUtils.clamp(t.dir.y, -1, 1));
        let dy = ty - look.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const pull = (1 - t.score) * dt * (firing ? 3 : 1.6);
        look.yaw += dy * Math.min(1, pull);
        look.pitch += (tp - look.pitch) * Math.min(1, pull * .6);
      }
    }
  }

  const wantFire = firing || keys.mouse || (settings.autoFire && aimTarget);
  if (w.spinup) player.spin = Math.max(0, Math.min(1, player.spin + (wantFire ? dt / w.spinup : -dt * 1.2)));
  if (wantFire && (w.auto || !player.triggerHeld || settings.autoFire)) shoot();
  player.triggerHeld = firing || keys.mouse;

  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) { player.reloading = 0; finishReload(); }
  }
  if (player.swapT > 0) player.swapT = Math.max(0, player.swapT - dt);

  for (let k = pickups.length - 1; k >= 0; k--) {
    const p = pickups[k], u = p.userData;
    u.t -= dt;
    u.inner.rotation.y += dt * 2; u.inner.position.y = Math.sin(state.clock * 3 + k) * .08;
    p.visible = u.t > 5 || Math.sin(state.clock * 16) > 0;
    const dx = camera.position.x - p.position.x, dz = camera.position.z - p.position.z, d = Math.hypot(dx, dz);
    if (d < 3.5 * stats.magnet) { p.position.x += dx / d * dt * 6 * stats.magnet; p.position.z += dz / d * dt * 6 * stats.magnet; }
    if (d < 1.1 && !state.net?.downed) { collect(p); state.net?.collected(p); scene.remove(p); pickups.splice(k, 1); }
    else if (u.t <= 0) { scene.remove(p); pickups.splice(k, 1); }
  }

  for (let k = grenades.length - 1; k >= 0; k--) {
    const g = grenades[k], m = g.mesh;
    g.t -= dt; g.vy -= 20 * dt;
    const nx = m.position.x + g.vx * dt, nz = m.position.z + g.vz * dt;
    if (blocked(nx, m.position.z, .1)) g.vx *= -.4; else m.position.x = nx;
    if (blocked(m.position.x, nz, .1)) g.vz *= -.4; else m.position.z = nz;
    m.position.y += g.vy * dt;
    if (m.position.y < .09) { m.position.y = .09; g.vy *= -.35; g.vx *= .6; g.vz *= .6; }
    m.rotation.x += dt * 8;
    if (Math.random() < .5) sparks.emit(m.position.x, m.position.y + .1, m.position.z, 1, { speed: .4, spread: 1, life: .25, grav: -1, colors: [0xff6020] });
    if (g.t <= 0) { explode(m.position.x, m.position.z); scene.remove(m); grenades.splice(k, 1); }
  }
}

function updateZombies(dt, playing, target0 = menuTarget) {
  if (target0 === menuTarget && Math.hypot(zombies[0]?.position.x - menuTarget.x, zombies[0]?.position.z - menuTarget.z) < 3) menuWander();
  let nearestGroan = null, ng = 14, ranged = 0;
  const D = diff(), X = MUTATIONS[state.mutation] || {};
  if (playing) for (const o of zombies) { const v = o.userData; if (!v.dead && (v.spitWind > 0 || state.clock - (v.spatAt ?? -9) < 1.2)) ranged++; }
  for (let k = zombies.length - 1; k >= 0; k--) {
    const z = zombies[k], u = z.userData, T = u.T, target = (playing && state.net?.targetFor(z)) || target0;
    if (animateZombie(z, dt)) { scene.remove(z); zombies.splice(k, 1); continue; }
    if (u.dead) continue;
    if (u.rise > 0) {
      u.rise = Math.max(0, u.rise - dt * .9);
      z.position.y = -1.9 * u.sc * u.rise * u.rise;
      if (Math.random() < .5) gore.emit(z.position.x, .05, z.position.z, 2, { speed: 2, spread: 2, life: .6, colors: [0x3a3226, 0x2a241c] });
      z.rotation.y = Math.atan2(target.x - z.position.x, target.z - z.position.z);
      continue;
    }
    if (u.burnT > 0) {
      u.burnT -= dt; u.burnTick = (u.burnTick || 0) - dt;
      if (Math.random() < .5) sparks.emit(z.position.x + (Math.random() - .5) * .4 * u.sc, (.4 + Math.random() * 1.2) * u.sc, z.position.z + (Math.random() - .5) * .4 * u.sc, 1, { speed: 1, spread: .8, life: .5, grav: -3, colors: [0xffa040, 0xff5a1a, 0xffd27a] });
      if (u.burnTick <= 0) { u.burnTick = .3; damageZombie(z, u.burnDps * .3, null); if (u.dead) continue; }
    }
    if (u.frozenT > 0) { u.frozenT -= dt; if (u.frozenT <= 0) thaw(z); else continue; }
    else if (u.chill > 0) u.chill = Math.max(0, u.chill - dt * .35);
    if (u.hasteT > 0) u.hasteT -= dt;
    if (X.regen && playing && !T.boss && u.hp < u.maxHp && state.clock - u.hitAt > 2) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * X.regen * dt);
    const dx = target.x - z.position.x, dz = target.z - z.position.z, d = Math.hypot(dx, dz) || .001;
    const reach = .75 + u.sc * .45;
    let vx = 0, vz = 0;
    if (playing && T.explode) {
      if (u.swellT > 0) { if ((u.swellT -= dt) <= 0) { killZombie(z, false, true); continue; } }
      else if (d < reach + 1.1) { u.swellT = .55; sfx.swell(); }
    }
    const busy = playing && ((T.boss || T.charge) && bossAbilities(z, dt, d, dx, dz) || specialAbilities(z, dt, d));
    if (u.dead) continue;
    u.pathT = (u.pathT || 0) - dt;
    if (playing && u.pathT <= 0) { u.pathT = .3 + Math.random() * .15; u.clear = lineClear(z.position.x, z.position.z, target.x, target.z, Math.min(.6, u.radius)); }
    const hold = playing && u.clear && (T.ranged ? d > 4.5 && d < 13 : !!T.scream && d > 7 && d < 16);
    if (playing && T.ranged && hold) {
      if (u.spitWind > 0) {
        u.spitWind -= dt;
        if (u.spitWind <= 0) { spit(z, target); u.spatAt = state.clock; u.nextSpit = state.clock + (T.boss ? (u.enraged ? 2.4 : 3.4) : 2.6 + Math.random()); }
      } else if (state.clock > u.nextSpit && (T.boss || ranged < D.ranged)) { u.spitWind = .5; ranged++; }
    } else u.spitWind = 0;
    u.moving = d > reach && !hold && !busy;
    if (busy && u.cs === 'run') u.moving = true;
    if (u.moving && !busy) {
      let ax = dx / d, az = dz / d;
      const step = u.speed * (playing ? 1 : .6) * (1 - (u.chill || 0) * .6) * (u.hasteT > 0 ? 1.35 : 1) * (u.lungeGo > 0 ? 3.4 : 1) * (u.hidden ? 1.2 : 1) * dt;
      const r = u.radius;
      const wp = playing && !u.clear && !target.remote ? navStep(z.position.x, z.position.z) : null;
      if (T.stalk && !wp && d > 5) {
        const a = Math.atan2(ax, az) + u.side * Math.min(.75, (d - 5) * .1), fx = Math.sin(a), fz = Math.cos(a);
        if (!blocked(z.position.x + fx * 2, z.position.z + fz * 2, r)) { ax = fx; az = fz; }
      }
      if (wp) { const wx = wp.x - z.position.x, wz = wp.z - z.position.z, wl = Math.hypot(wx, wz) || 1; ax = wx / wl; az = wz / wl; }
      else if (blocked(z.position.x + ax * step * 4, z.position.z + az * step * 4, r)) {
        for (const off of [.7, 1.3, 1.9]) {
          const a = Math.atan2(ax, az) + off * u.side;
          const tx = Math.sin(a), tz = Math.cos(a);
          if (!blocked(z.position.x + tx * step * 4, z.position.z + tz * step * 4, r)) { ax = tx; az = tz; break; }
        }
      }
      vx = ax * step; vz = az * step;
      u.walk += dt * T.stride * (playing ? 1 : .6);
    }
    for (const o of zombies) {
      if (o === z || o.userData.dead) continue;
      const ox = z.position.x - o.position.x, oz = z.position.z - o.position.z, od = Math.hypot(ox, oz), min = u.radius + o.userData.radius + .15;
      if (od < min && od > 0.001) { vx += ox / od * (min - od) * .5; vz += oz / od * (min - od) * .5; }
    }
    if (playing && d < reach * .85) { const push = (reach * .85 - d) * Math.min(1, dt * 8); vx -= dx / d * push; vz -= dz / d * push; }
    vx += u.kx * dt * 6; vz += u.kz * dt * 6;
    u.kx *= Math.max(0, 1 - dt * 7); u.kz *= Math.max(0, 1 - dt * 7);
    if (!blocked(z.position.x + vx, z.position.z, u.radius * .8)) z.position.x += vx;
    if (!blocked(z.position.x, z.position.z + vz, u.radius * .8)) z.position.z += vz;
    const face = Math.atan2(dx, dz);
    let df = face - z.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
    z.rotation.y += df * Math.min(1, dt * (T.turn ?? 8));
    if (playing && !T.explode && !busy) {
      if (u.swing > 0) {
        const before = u.swing; u.swing -= dt;
        if (before > .18 && u.swing <= .18 && d < reach + .5) (target.hurt || hurtPlayer)(T.dmg * (1 + (state.wave - 1) * .05) * (u.elite ? 1.4 : 1), z.position);
      } else if (!u.moving && d <= reach + .1 && state.clock > u.nextAttack) {
        u.swing = .45; u.nextAttack = state.clock + (u.kind === 'runner' ? .7 : 1.05) * (X.rate ?? 1);
      }
    }
    if (playing) {
      u.groanAt -= dt;
      if (d < ng && u.groanAt <= 0) { ng = d; nearestGroan = z; }
    }
  }
  if (nearestGroan) { nearestGroan.userData.groanAt = 3 + Math.random() * 4; sfx.groan(Math.max(.05, .3 * (1 - ng / 14))); }
}

function updateView(dt) {
  const g = guns[player.weapon], w = WEAPONS[player.weapon];
  look.recoil = Math.max(0, look.recoil - dt * (look.recoil * 9 + .02));
  look.shake = Math.max(0, look.shake - dt * 1.6);
  const shake = look.shake * look.shake;
  const bobY = Math.abs(Math.sin(look.bob)) * .045, bobX = Math.cos(look.bob) * .025;
  camera.position.y = 1.64 + bobY * .6;
  camera.rotation.set(look.pitch + look.recoil + (Math.random() - .5) * shake * .08, look.yaw + (Math.random() - .5) * shake * .08, (Math.random() - .5) * shake * .05);
  look.swayX *= Math.max(0, 1 - dt * 10); look.swayY *= Math.max(0, 1 - dt * 10);
  g.userData.kick = Math.max(0, (g.userData.kick || 0) - dt * .9);
  const k = g.userData.kick;
  let rx = k * 2.2, ry = 0, rz = 0, px = (camera.aspect < 1 ? .1 : .21) + bobX + look.swayX, py = -.2 - bobY * .5 + look.swayY, pz = -.36 + k * .9;
  if (player.reloading > 0) {
    const t = 1 - player.reloading / player.reloadTotal, e = Math.sin(t * Math.PI);
    rx -= e * .55; rz += e * .5; py -= e * .08;
  }
  if (player.swapT > 0) py -= player.swapT * .9;
  if (player.sprinting) { ry = .5; rz = .3; px -= .03; py -= .04; }
  if (w.view) { px += w.view[0]; py += w.view[1]; pz += w.view[2]; }
  if (g.userData.pump) {
    player.pumpT = Math.max(0, player.pumpT - dt);
    const pt = player.pumpT > 0 && player.pumpT < .4 ? Math.sin((.4 - player.pumpT) / .4 * Math.PI) : 0;
    g.userData.pump.position.z = g.userData.pumpZ + pt * .1;
  }
  if (g.userData.spin) g.userData.spin.rotation.z += dt * player.spin * 40;
  g.position.set(px, py, pz);
  g.rotation.set(rx, ry, rz);
  const fl = g.userData.flash;
  g.userData.flashT = (g.userData.flashT || 0) - dt;
  fl.visible = g.userData.flashT > 0;
  g.userData.light.intensity = fl.visible ? 6 : 0;
  muzzleWorld.intensity = Math.max(0, muzzleWorld.intensity - dt * 300);
}

function updateEffects(dt) {
  gore.update(dt); sparks.update(dt); embers.update(dt, performance.now() / 1000);
  for (const t of tracers) if (t.visible && (t.userData.t -= dt) <= 0) t.visible = false;
  for (const d of decals) if (d.visible) { d.userData.t -= dt; if (d.userData.t < 4) d.material.opacity = Math.max(0, d.userData.t / 4 * .92); if (d.userData.t <= 0) d.visible = false; }
  if (blast.visible) {
    blast.userData.t += dt;
    const t = blast.userData.t / .45;
    blast.scale.setScalar((.3 + t * 4.2) * (blast.userData.r ?? 1)); blast.material.opacity = Math.max(0, 1 - t);
    if (t >= 1) blast.visible = false;
  }
  blastLight.intensity = Math.max(0, blastLight.intensity - dt * 220);
  const now = performance.now() / 1000;
  for (const f of fires) {
    if (f.tick) { f.tick(now); continue; }
    f.light.intensity = 18 + Math.sin(now * 9 + f.seed) * 3 + Math.sin(now * 23 + f.seed) * 2;
    f.flames.forEach((s, i) => { const k = (.55 + Math.sin(now * (10 + i * 3) + f.seed + i) * .12) * (f.s ?? 1); s.scale.set(k * (1 - i * .2), k * 1.4 * (1 - i * .15), 1); });
  }
}

function update(dt) {
  state.clock += dt;
  for (let k = scheduled.length - 1; k >= 0; k--) if (state.clock >= scheduled[k].at) { const s = scheduled.splice(k, 1)[0]; s.fn(); }
  updateNav(camera.position.x, camera.position.z);
  const warp = state.warpT > 0 ? .35 : 1;
  if (state.warpT > 0) state.warpT = Math.max(0, state.warpT - dt);
  ui.hud.classList.toggle('warp', state.warpT > 0);
  const client = state.net && !state.net.host;
  if (!client) spawnTick(dt);
  updatePlayer(dt);
  updateHazards(dt * warp);
  updateShells(dt);
  updateSingularities(dt);
  if (client) state.net.syncZombies(dt * warp); else updateZombies(dt * warp, true, camera.position);
  if (!client && !state.between && !state.queue?.length && zombies.every(z => z.userData.dead) && state.waveTotal > 0 && state.mode === 'playing') waveCleared();
  if (!tutorialDone && state.moved && state.looked && state.clock > 4) { tutorialDone = true; store.set('tutorial', true); hint(''); bus.emit('tutorial:done', {}); }
  updateView(dt);
  state.net?.update(dt);
  updateHud(dt);
}

function updateMenu(dt) {
  state.clock += dt;
  menuAngle += dt * .07;
  const M = world.map.menu;
  camera.position.set(M.orbit[0] + Math.sin(menuAngle) * M.r, M.y, M.orbit[1] + Math.cos(menuAngle) * M.r);
  camera.lookAt(...M.look);
  updateZombies(dt, false);
}

function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), .05);
  if (state.mode === 'playing') update(dt);
  else if (state.mode === 'menu') updateMenu(dt);
  else if (state.mode === 'dead') { state.clock += dt; updateZombies(dt, false, camera.position); }
  if (state.mode !== 'paused' && state.mode !== 'perk') updateEffects(dt);
  if (state.mode === 'playing' || state.mode === 'perk' || state.mode === 'paused') updateFloaters(dt);
  if (activeScreen === ui.menu || activeScreen === ui.locker || activeScreen === ui.inspect || activeScreen === ui.armory) preview.render(dt);
  sky.position.copy(camera.position);
  renderer.clear();
  renderer.render(scene, camera);
  if (state.mode !== 'menu' && state.mode !== 'dead') {
    renderer.clearDepth();
    renderer.render(viewScene, viewCam);
  }
}

const stickHome = { x: 0, y: 0 };
function placeStickHome() {
  const r = ui.stickZone.getBoundingClientRect();
  stickHome.x = Math.max(96, r.width * .32); stickHome.y = r.height - 96;
  if (stickPointer === null) positionStick(stickHome.x, stickHome.y);
}
function positionStick(x, y) { ui.stick.style.left = x + 'px'; ui.stick.style.top = y + 'px'; }
let stickPointer = null, stickOrigin = { x: 0, y: 0 };
const lookPointers = new Map();

ui.stickZone.addEventListener('pointerdown', e => {
  if (stickPointer !== null) return;
  e.preventDefault();
  stickPointer = e.pointerId;
  ui.stickZone.setPointerCapture(e.pointerId);
  const r = ui.stickZone.getBoundingClientRect();
  stickOrigin = { x: Math.max(62, Math.min(r.width - 62, e.clientX - r.left)), y: Math.max(62, Math.min(r.height - 62, e.clientY - r.top)) };
  positionStick(stickOrigin.x, stickOrigin.y);
  ui.stick.classList.add('active');
  stickMove(e);
});
function stickMove(e) {
  const r = ui.stickZone.getBoundingClientRect();
  const dx = e.clientX - r.left - stickOrigin.x, dy = e.clientY - r.top - stickOrigin.y, l = Math.hypot(dx, dy), max = 50;
  const cl = Math.min(max, l), a = Math.atan2(dy, dx);
  const dead = 6;
  const n = l < dead ? 0 : (cl - dead) / (max - dead);
  move.x = Math.cos(a) * n; move.y = -Math.sin(a) * n;
  move.sprint = l > max * 1.35 && move.y > .7;
  ui.dot.style.transform = `translate(${Math.cos(a) * cl}px,${Math.sin(a) * cl}px)`;
}
function stickEnd() {
  stickPointer = null; move.x = move.y = 0; move.sprint = false;
  ui.dot.style.transform = ''; ui.stick.classList.remove('active', 'sprint');
  positionStick(stickHome.x, stickHome.y);
}

function beginLook(e) { lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
function lookMove(e) {
  const p = lookPointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  applyLook(dx, dy, .0055);
}
function applyLook(dx, dy, base) {
  if (state.mode !== 'playing') return;
  const s = base * settings.sensitivity * look.assist;
  look.yaw -= dx * s;
  look.pitch = THREE.MathUtils.clamp(look.pitch - dy * s * .85 * (settings.invert ? -1 : 1), -1.2, 1.1);
  look.swayX = THREE.MathUtils.clamp(look.swayX - dx * .0004, -.03, .03);
  look.swayY = THREE.MathUtils.clamp(look.swayY + dy * .0004, -.03, .03);
  if (Math.abs(dx) + Math.abs(dy) > 2) state.looked = true;
}

addEventListener('pointermove', e => {
  if (e.pointerId === stickPointer) stickMove(e);
  else if (lookPointers.has(e.pointerId)) lookMove(e);
  else if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) applyLook(e.movementX, e.movementY, .0028);
});
function pointerEnd(e) {
  if (e.pointerId === stickPointer) stickEnd();
  lookPointers.delete(e.pointerId);
  if (e.pointerId === ui.fire._pid) { firing = false; ui.fire._pid = null; ui.fire.classList.remove('press'); }
}
addEventListener('pointerup', pointerEnd);
addEventListener('pointercancel', pointerEnd);

canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'playing') return;
  if (e.pointerType === 'mouse') {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    else if (e.button === 0) keys.mouse = true;
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  beginLook(e);
});
addEventListener('mouseup', () => (keys.mouse = false));

ui.fire.addEventListener('pointerdown', e => {
  e.preventDefault();
  ui.fire.setPointerCapture(e.pointerId);
  ui.fire._pid = e.pointerId;
  ui.fire.classList.add('press');
  firing = true;
  beginLook(e);
  shoot();
});
function tapButton(el, fn) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 120);
    fn();
  });
}
tapButton(ui.reload, reload);
tapButton(ui.grenade, throwGrenade);
tapButton(ui.swap, () => selectWeapon(otherSlot()));
tapButton(ui.pause, pause);

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (state.mode === 'playing') {
    if (k === 'r') reload();
    if (k === 'g') throwGrenade();
    if (k === 'q' || k === '1' || k === '2') selectWeapon(k === '1' ? player.slots[0] : k === '2' ? player.slots[1] : otherSlot());
    if (e.code === 'Space') firing = true;
  }
  if (k === 'escape' || k === 'p') state.mode === 'playing' ? pause() : state.mode === 'paused' && resume();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.code === 'Space') firing = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

$('#start').onclick = () => startGame(api.deployOpts());
$('#again').onclick = () => startGame(state.runOpts?.replay?.() || state.runOpts || {});
$('#to-menu').onclick = toMenu;
$('#resume').onclick = resume;
$('#quit').onclick = toMenu;

let settingsReturn = null;
document.querySelectorAll('[data-open="settings"]').forEach(b => (b.onclick = () => { settingsReturn = activeScreen; syncSettingsUI(); showScreen(ui.settings); }));

const LEADERBOARDS = { score: 'deadzone.highscore', wave: 'deadzone.bestwave', daily: 'deadzone.daily', weekly: 'deadzone.weekly' };
const gameCenter = {
  player: null,
  available() { const cap = window.Capacitor; return !!(cap?.nativePromise && cap.PluginHeaders?.some(h => h.name === 'GameCenter')); },
  call(method, opts = {}) { return this.available() ? window.Capacitor.nativePromise('GameCenter', method, opts) : Promise.reject(new Error('Game Center is only available in the iOS app')); },
  async signIn() {
    try { const r = await this.call('signIn'); this.player = r?.authenticated ? r : null; } catch { this.player = null; }
    return this.player;
  },
  async rank(leaderboardId = LEADERBOARDS.score) {
    if (!this.player) return null;
    try { const r = await this.call('loadScores', { leaderboardId, count: 1 }); return r.player ? { ...r.player, total: r.total } : null; } catch { return null; }
  },
  boards(type) { return type === 'daily' ? [LEADERBOARDS.daily] : type === 'ranked' ? [LEADERBOARDS.weekly, LEADERBOARDS.score, LEADERBOARDS.wave] : [LEADERBOARDS.score, LEADERBOARDS.wave]; },
  guard: null,
  async submit(score, wave, context, run) {
    const rejected = run && this.guard?.(run);
    if (rejected) return { rejected };
    if (!this.player && !(await this.signIn())) return null;
    const ids = this.boards(run?.type);
    await Promise.allSettled(ids.map(id => this.call('submitScore', { leaderboardId: id, score: id === LEADERBOARDS.wave ? wave : score, context })));
    return this.rank(ids[0]);
  },
};

function saveRun() {
  if (!state.score) return;
  const runs = store.get('runs', []);
  runs.push({ score: state.score, wave: state.wave, kills: state.kills, diff: state.runDifficulty || settings.difficulty, date: Date.now(), code: myCode(), type: state.runType || 'normal', seed: state.seed, start: state.startWave });
  runs.sort((a, b) => b.score - a.score);
  store.set('runs', runs.slice(0, 25));
}

let boardTab = 'global', boardReturn = null, boardToken = 0;
const boardView = { id: LEADERBOARDS.score, filter: null };
const avatarCache = new Map();
function avatarFor(code) {
  const d = decodeLoadout(code), key = d ? encodeLoadout(d.loadout) : 0;
  if (!avatarCache.has(key)) avatarCache.set(key, preview.thumbnail(d ? d.loadout : DEFAULT_LOADOUT, 96));
  return avatarCache.get(key);
}
function boardRow(rank, title, sub, score, me, code, extra = {}) {
  const li = document.createElement('li');
  if (me) li.className = 'me';
  const r = document.createElement('b'); r.textContent = '#' + rank;
  const img = document.createElement('img'); img.alt = ''; img.src = avatarFor(code);
  const d = decodeLoadout(code);
  const name = document.createElement('span'); name.textContent = title;
  const sm = document.createElement('small');
  sm.textContent = [d ? TITLES[d.loadout.title] + ' · LV ' + d.level : '', sub].filter(Boolean).join(' · ');
  name.appendChild(sm);
  const sc = document.createElement('span'); sc.textContent = score.toLocaleString();
  li.append(r, img, name, sc);
  li.onclick = () => openInspect({ rank, name: title, score, code, ...extra });
  return li;
}
let inspectReturn = null;
function openInspect(p) {
  const d = decodeLoadout(p.code);
  const l = d ? d.loadout : DEFAULT_LOADOUT;
  inspectReturn = activeScreen;
  $('#in-rank').textContent = p.rankLabel || 'GLOBAL RANK #' + p.rank.toLocaleString();
  $('#in-name').textContent = p.name;
  $('#in-title').textContent = d ? TITLES[l.title] : 'NO LOADOUT ON RECORD';
  $('#in-score').textContent = p.score.toLocaleString();
  $('#in-level').textContent = d ? d.level : '—';
  const gear = $('#in-gear');
  gear.innerHTML = '';
  for (const [k, v] of describeLoadout(l)) {
    const li = document.createElement('li'), b = document.createElement('b');
    b.textContent = k; li.append(b, document.createTextNode(v));
    gear.appendChild(li);
  }
  preview.show(l);
  showScreen(ui.inspect);
}
$('#inspect-close').onclick = () => showScreen(inspectReturn || ui.board);

function renderLocalRuns(list) {
  const runs = store.get('runs', []).filter(r => !boardView.filter || boardView.filter(r));
  if (!runs.length) { $('#board-status').textContent = 'No runs yet — deploy and set a score.'; return; }
  runs.forEach((r, i) => list.appendChild(boardRow(i + 1, (DIFFICULTIES[r.diff]?.name || 'SURVIVOR') + ' · WAVE ' + r.wave + (r.start > 1 ? ' (FROM ' + r.start + ')' : ''), new Date(r.date).toLocaleDateString() + ' · ' + r.kills + ' KILLS', r.score, false, r.code || myCode(), { rankLabel: 'YOUR RUN #' + (i + 1), name: 'YOU' })));
}
async function renderBoard() {
  const token = ++boardToken, list = $('#board-list'), status = $('#board-status');
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === boardTab));
  list.innerHTML = ''; status.textContent = '';
  $('#gc-open').classList.toggle('hidden', !gameCenter.available());
  if (boardTab === 'local') { renderLocalRuns(list); return; }
  if (!gameCenter.available()) {
    status.textContent = 'Global and friends rankings use Game Center in the iOS app. Showing your runs on this device.';
    renderLocalRuns(list);
    return;
  }
  status.textContent = 'Loading rankings…';
  if (!gameCenter.player) await gameCenter.signIn();
  if (token !== boardToken) return;
  if (!gameCenter.player) { status.textContent = 'Sign in to Game Center (Settings → Game Center) to compete globally.'; return; }
  try {
    const r = await gameCenter.call('loadScores', { leaderboardId: boardView.id, count: 25, scope: boardTab });
    if (token !== boardToken) return;
    status.textContent = r.total ? r.total.toLocaleString() + ' SURVIVORS RANKED' : 'No scores yet — be the first.';
    for (const e of r.entries || []) list.appendChild(boardRow(e.rank, e.name, '', e.score, e.isLocal, e.context));
    if (r.player && !(r.entries || []).some(e => e.isLocal)) {
      const gap = document.createElement('li'); gap.className = 'gap'; gap.textContent = '···'; list.appendChild(gap);
      list.appendChild(boardRow(r.player.rank, r.player.name + ' (YOU)', '', r.player.score, true, r.player.context));
    }
    if (r.player && boardView.id === LEADERBOARDS.score) { records.rank = r.player.rank; store.set('records', records); refreshRecords(); }
  } catch (e) {
    if (token === boardToken) status.textContent = 'Could not load rankings: ' + e.message;
  }
}
document.querySelectorAll('[data-open="board"]').forEach(b => (b.onclick = () => { boardReturn = activeScreen; showScreen(ui.board); renderBoard(); }));
document.querySelectorAll('.tabs button').forEach(b => (b.onclick = () => { boardTab = b.dataset.tab; renderBoard(); }));
$('#board-close').onclick = () => showScreen(boardReturn || ui.menu);
$('#gc-open').onclick = () => gameCenter.call('showLeaderboard', {}).catch(() => {});

let lockerSlot = 'top', pendingBuy = null, tryOn = null;
function refreshProfileUI() {
  const lv = levelInfo(), l = profile.loadout;
  if (l.suit && !isOwned('suit', l.suit)) { l.suit = 0; saveProfile(); }
  $('#menu-level').textContent = 'LV ' + lv.level;
  $('#menu-title').textContent = TITLES[l.title];
  $('#lk-level').textContent = 'LEVEL ' + lv.level;
  $('#lk-xp').style.width = (lv.into / lv.need * 100).toFixed(1) + '%';
  $('#lk-xptext').textContent = TITLES[l.title] + ' · ' + lv.into.toLocaleString() + ' / ' + lv.need.toLocaleString() + ' XP';
  $('#lk-scrap').textContent = profile.scrap.toLocaleString();
  const affordable = ALL_SLOTS.some(s => s.items.some((it, i) => !isOwned(s.id, i) && it.cost && !it.req && it.cost <= profile.scrap));
  $('#locker-badge').textContent = profile.fresh.length ? profile.fresh.length : affordable ? '!' : '';
  const gunAffordable = WEAPONS.some(w => w.price && !weaponOwned(w) && reqMet(w.req) && w.price <= profile.scrap);
  $('#armory-badge').textContent = gunAffordable ? '!' : '';
  applyLoadoutToGuns();
}
const groupOf = id => LOCKER_GROUPS.find(g => g.slots.includes(id)) || LOCKER_GROUPS[3];
function renderLocker() {
  const groups = $('#slot-groups'), tabs = $('#slot-tabs'), grid = $('#item-grid'), group = groupOf(lockerSlot);
  groups.innerHTML = ''; tabs.innerHTML = ''; grid.innerHTML = '';
  const isNew = id => profile.fresh.some(k => k.startsWith(id + ':'));
  for (const g of LOCKER_GROUPS) {
    const b = document.createElement('button');
    b.textContent = g.label;
    b.className = (g === group ? 'on' : '') + (g.slots.some(isNew) ? ' new' : '');
    b.onclick = () => { if (g === group) return; lockerSlot = g.slots.find(isNew) || g.slots[0]; pendingBuy = null; renderLocker(); };
    groups.appendChild(b);
  }
  for (const id of group.slots) {
    const s = slotById(id);
    const b = document.createElement('button');
    b.textContent = s.id === 'suit' ? '★ ' + s.label : s.label;
    b.className = (s.id === lockerSlot ? 'on' : '') + (isNew(s.id) ? ' new' : '');
    b.onclick = () => { lockerSlot = s.id; pendingBuy = null; renderLocker(); };
    tabs.appendChild(b);
  }
  if (activeScreen === ui.locker) preview.attach($('#locker-stage'), group.id === 'face' || group.id === 'hair' ? 'bust' : 'full', false);
  const slot = slotById(lockerSlot);
  slot.items.forEach((it, i) => {
    const key = slot.id + ':' + i, owned = isOwned(slot.id, i), equipped = profile.loadout[slot.id] === i;
    const b = document.createElement('button');
    b.className = 'item ' + (it.premium ? 'premium ' : '') + (equipped ? 'equipped' : owned ? 'owned' : it.req || it.premium ? 'locked' : 'cost') + (tryOn?.[slot.id] === i && !equipped ? ' trying' : '') + (pendingBuy === key ? ' confirm' : '') + (profile.fresh.includes(key) ? ' fresh' : '');
    if (it.swatch !== undefined) { const sw = document.createElement('i'); sw.style.background = '#' + it.swatch.toString(16).padStart(6, '0'); b.appendChild(sw); }
    const name = document.createElement('b'); name.textContent = it.name;
    const st = document.createElement('small');
    st.textContent = equipped ? 'EQUIPPED' : owned ? 'OWNED' : it.premium ? (storeKit.products[STORE_PREFIX + it.premium]?.price || (storeKit.available() ? 'APP STORE' : 'iOS APP')) : it.req ? '🔒 ' + reqText(it.req) : pendingBuy === key ? 'TAP AGAIN TO BUY' : '🔩 ' + it.cost.toLocaleString();
    b.append(name, st);
    b.onclick = () => lockerPick(slot, i);
    grid.appendChild(b);
  });
}
function lockerPick(slot, i) {
  const key = slot.id + ':' + i, it = slot.items[i];
  if (slot.id === 'body' && i === 1 && profile.loadout.body !== 1 && profile.loadout.hair === DEFAULT_LOADOUT.hair) { profile.loadout.hair = 3; profile.owned['hair:3'] = true; }
  tryOn = { ...profile.loadout, [slot.id]: i };
  preview.show(tryOn);
  haptic('LIGHT');
  const buy = $('#lk-buy');
  buy.classList.add('hidden');
  if (it.premium && !isOwned(slot.id, i)) {
    pendingBuy = null;
    if (storeKit.available()) {
      const price = storeKit.products[STORE_PREFIX + it.premium]?.price || '';
      buy.textContent = 'BUY ' + price;
      buy.classList.remove('hidden');
      buy.onclick = async () => {
        buy.disabled = true;
        $('#lk-hint').textContent = 'Opening the App Store…';
        const r = await storeKit.purchase(STORE_PREFIX + it.premium);
        buy.disabled = false;
        if (r.status === 'purchased') { profile.loadout[slot.id] = i; tryOn = null; saveProfile(); buy.classList.add('hidden'); }
        $('#lk-hint').textContent = storeKit.message(r, it.name) + (r.status === 'purchased' ? ' Equipped.' : '');
        refreshProfileUI();
        renderLocker();
      };
      $('#lk-hint').textContent = it.desc + ' Exclusive outfit — try it on free.';
    } else $('#lk-hint').textContent = it.desc + ' iOS exclusive — purchase it in the iPhone app.';
  } else if (isOwned(slot.id, i)) {
    profile.loadout[slot.id] = i;
    tryOn = null; pendingBuy = null;
    saveProfile();
    $('#lk-hint').textContent = it.name + ' equipped.' + (!['suit', 'body', 'skin', 'build', 'height', 'jaw', 'eyes', 'brows', 'skinMark', 'gun', 'title', 'accessory'].includes(slot.id) && profile.loadout.suit ? ' (Hidden while an exclusive outfit is worn — pick NONE under OUTFIT › ★ EXCLUSIVE.)' : '');
  } else if (it.req) {
    pendingBuy = null;
    $('#lk-hint').textContent = 'Locked — ' + reqText(it.req).toLowerCase() + ' to unlock.';
  } else if (pendingBuy === key) {
    if (profile.scrap >= it.cost) {
      profile.scrap -= it.cost;
      profile.owned[key] = true;
      bus.emit('purchase', { kind: 'scrap', item: key, cost: it.cost });
      profile.loadout[slot.id] = i;
      tryOn = null; pendingBuy = null;
      saveProfile();
      sfx.pickup(); haptic('MEDIUM');
      $('#lk-hint').textContent = 'Bought and equipped ' + it.name + '!';
    } else {
      pendingBuy = null;
      $('#lk-hint').textContent = 'Need ' + (it.cost - profile.scrap).toLocaleString() + ' more scrap — survive longer runs to earn it.';
    }
  } else {
    pendingBuy = key;
    $('#lk-hint').textContent = profile.scrap >= it.cost ? 'Tap again to buy for ' + it.cost.toLocaleString() + ' scrap.' : 'Costs ' + it.cost.toLocaleString() + ' scrap — you have ' + profile.scrap.toLocaleString() + '.';
  }
  refreshProfileUI();
  renderLocker();
}
function openLocker() {
  sfx.init();
  tryOn = null; pendingBuy = null;
  $('#lk-buy').classList.add('hidden');
  storeKit.refresh();
  showScreen(ui.locker);
  preview.show(profile.loadout);
  const firstFresh = profile.fresh[0];
  if (firstFresh) lockerSlot = firstFresh.split(':')[0];
  $('#lk-hint').textContent = 'Tap an item to try it on. Earn scrap and XP every run.';
  refreshProfileUI();
  renderLocker();
}
document.querySelectorAll('[data-open="locker"]').forEach(b => (b.onclick = openLocker));
$('#menu-char').onclick = openLocker;
$('#locker-done').onclick = () => {
  $('#lk-buy').classList.add('hidden');
  profile.loadout.primary = loadoutWeapons()[0];
  profile.fresh = [];
  saveProfile();
  tryOn = null;
  preview.show(profile.loadout);
  refreshProfileUI();
  showScreen(ui.menu);
};

const storeKit = {
  products: {},
  pending: false,
  available() { const cap = window.Capacitor; return !!(cap?.nativePromise && cap.PluginHeaders?.some(h => h.name === 'Store')); },
  call(method, opts = {}) { return window.Capacitor.nativePromise('Store', method, opts); },
  extra: [],
  ids() { return [...WEAPONS.filter(w => w.productId).map(w => w.productId), ...SLOTS.find(s => s.id === 'suit').items.filter(it => it.premium).map(it => STORE_PREFIX + it.premium), ...this.extra]; },
  async register(ids) {
    this.extra.push(...ids);
    if (!this.available()) return;
    try { for (const p of (await this.call('getProducts', { ids })).products || []) this.products[p.id] = p; } catch {}
  },
  apply(owned) {
    profile.iap = Object.fromEntries((owned || []).map(id => [id, true]));
    saveProfile();
    refreshProfileUI();
    if (activeScreen === ui.armory) renderArmory();
    if (activeScreen === ui.locker) renderLocker();
  },
  async init() {
    if (!this.available()) return;
    try { for (const p of (await this.call('getProducts', { ids: this.ids() })).products || []) this.products[p.id] = p; } catch {}
    await this.refresh();
    window.Capacitor.Plugins?.Store?.addListener?.('entitlementsChanged', d => this.apply(d.owned));
  },
  async refresh() {
    if (!this.available()) return;
    try { this.apply((await this.call('getEntitlements')).owned); } catch {}
  },
  async purchase(productId) {
    if (this.pending) return { status: 'busy' };
    this.pending = true;
    let result;
    try {
      result = await this.call('purchase', { id: productId });
      if (result.status === 'purchased') {
        bus.emit('purchase', { kind: 'iap', productId });
        profile.iap[productId] = true;
        saveProfile();
        await this.refresh();
        sfx.clear(); haptic('HEAVY');
      }
    } catch (e) { result = { status: 'failed', error: e.message }; }
    this.pending = false;
    return result;
  },
  message(r, name) {
    if (r.status === 'purchased') return name + ' unlocked!';
    if (r.status === 'pending') return 'Purchase pending approval.';
    if (r.status === 'failed') return 'Purchase failed: ' + r.error;
    return 'Purchase cancelled.';
  },
  async buy(w) {
    renderArmory('Opening the App Store…');
    const r = await this.purchase(w.productId);
    armoryNote = r.status === 'purchased' ? w.name + ' unlocked — equip it below!' : this.message(r, w.name);
    renderArmory();
  },
  async restore() {
    renderArmory('Restoring purchases…');
    try { this.apply((await this.call('restore')).owned); armoryNote = 'Purchases restored.'; } catch (e) { armoryNote = 'Restore failed: ' + e.message; }
    renderArmory();
  },
};

let armorySel = 'm4', armoryNote = '', armoryConfirm = null;
const armoryMats = { base: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), dark: new THREE.MeshStandardMaterial() };
function weaponStatus(w) {
  const [p, q] = loadoutWeapons(), idx = weaponIndex(w.id);
  if (weaponOwned(w)) return idx === p ? 'PRIMARY' : idx === q ? 'SECONDARY' : 'OWNED';
  if (w.premium) return storeKit.products[w.productId]?.price || (storeKit.available() ? 'APP STORE' : 'iOS APP');
  if (w.req && !reqMet(w.req)) return '🔒 ' + reqText(w.req);
  return '🔩 ' + w.price.toLocaleString();
}
function showArmoryWeapon(w) {
  paintGunMaterials(armoryMats, profile.loadout.gun);
  if (WOOD.has(w.id) && !profile.loadout.gun) woodStock(armoryMats.base);
  preview.showWeapon(buildGun(w, armoryMats));
  $('#ar-name').textContent = w.name;
  $('#ar-type').textContent = w.type + (w.premium ? ' · iOS EXCLUSIVE' : '');
  $('#ar-desc').textContent = w.desc;
  const box = $('#ar-stats');
  box.innerHTML = '';
  for (const [label, v] of weaponStats(w)) {
    const row = document.createElement('div'); row.className = 'stat';
    const l = document.createElement('span'); l.textContent = label;
    const bar = document.createElement('i'); bar.style.setProperty('--v', Math.round(v * 100) + '%');
    row.append(l, bar); box.appendChild(row);
  }
}
function renderArmory(note) {
  const [p, q] = loadoutWeapons(), w = WEAPONS.find(x => x.id === armorySel) || WEAPONS[0];
  $('#ar-scrap').textContent = profile.scrap.toLocaleString();
  $('#ar-primary b').textContent = WEAPONS[p].name;
  $('#ar-secondary b').textContent = WEAPONS[q].name;
  $('#ar-restore').classList.toggle('hidden', !storeKit.available());
  const grid = $('#weapon-grid');
  grid.innerHTML = '';
  for (const x of WEAPONS) {
    const idx = weaponIndex(x.id), owned = weaponOwned(x);
    const c = document.createElement('button');
    c.className = 'wcard' + (x.premium ? ' premium' : '') + (owned ? ' owned' : x.req && !reqMet(x.req) ? ' locked' : ' cost') + (x.id === armorySel ? ' sel' : '') + (idx === p || idx === q ? ' eq' : '');
    const n = document.createElement('b'); n.textContent = x.name;
    const t = document.createElement('em'); t.textContent = x.type;
    const st = document.createElement('small'); st.textContent = weaponStatus(x);
    c.append(n, t, st);
    if (idx === p || idx === q) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = idx === p ? 'P' : 'S'; c.appendChild(tag); }
    c.onclick = () => { armorySel = x.id; armoryConfirm = null; armoryNote = ''; showArmoryWeapon(x); renderArmory(); haptic('LIGHT'); };
    grid.appendChild(c);
  }
  const act = $('#ar-actions');
  act.innerHTML = '';
  const btn = (text, cls, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = text; b.onclick = fn; act.appendChild(b); return b; };
  const info = text => { const e = document.createElement('span'); e.className = 'note'; e.textContent = text; act.appendChild(e); };
  const idx = weaponIndex(w.id);
  if (weaponOwned(w)) {
    btn(idx === p ? 'PRIMARY ✓' : 'EQUIP PRIMARY', 'ghost', () => equipWeapon(w, 'primary')).disabled = idx === p;
    btn(idx === q ? 'SECONDARY ✓' : 'EQUIP SECONDARY', 'ghost', () => equipWeapon(w, 'secondary')).disabled = idx === q;
  } else if (w.premium) {
    if (storeKit.available()) btn('BUY ' + (storeKit.products[w.productId]?.price || ''), 'cta gold', () => storeKit.buy(w)).disabled = storeKit.pending;
    else info('iOS exclusive — purchase it in the iPhone app.');
  } else if (w.req && !reqMet(w.req)) info('Locked — ' + reqText(w.req).toLowerCase() + '.');
  else btn(armoryConfirm === w.id ? 'CONFIRM 🔩 ' + w.price.toLocaleString() : 'BUY 🔩 ' + w.price.toLocaleString(), 'cta', () => buyWeapon(w));
  if (note ?? armoryNote) info(note ?? armoryNote);
  bus.emit('armory:render', { grid, weapon: w });
}
function buyWeapon(w) {
  if (profile.scrap < w.price) { armoryNote = 'Need ' + (w.price - profile.scrap).toLocaleString() + ' more scrap.'; armoryConfirm = null; renderArmory(); return; }
  if (armoryConfirm !== w.id) { armoryConfirm = w.id; armoryNote = ''; renderArmory(); return; }
  profile.scrap -= w.price;
  profile.arsenal.owned[w.id] = true;
  bus.emit('purchase', { kind: 'scrap', item: 'weapon:' + w.id, cost: w.price });
  armoryConfirm = null;
  saveProfile();
  sfx.pickup(); haptic('MEDIUM');
  armoryNote = w.name + ' purchased!';
  refreshProfileUI();
  renderArmory();
}
function equipWeapon(w, slot) {
  const other = slot === 'primary' ? 'secondary' : 'primary';
  if (profile.arsenal[other] === w.id) profile.arsenal[other] = profile.arsenal[slot];
  profile.arsenal[slot] = w.id;
  profile.loadout.primary = loadoutWeapons()[0];
  saveProfile();
  haptic('LIGHT'); sfx.swap();
  armoryNote = w.name + ' equipped as ' + slot + '.';
  renderArmory();
}
function openArmory() {
  sfx.init();
  armoryNote = ''; armoryConfirm = null;
  armorySel = WEAPONS[loadoutWeapons()[0]].id;
  showScreen(ui.armory);
  showArmoryWeapon(WEAPONS.find(x => x.id === armorySel));
  renderArmory();
  storeKit.refresh();
}
document.querySelectorAll('[data-open="armory"]').forEach(b => (b.onclick = openArmory));
$('#armory-done').onclick = () => { preview.show(profile.loadout, true); refreshProfileUI(); showScreen(ui.menu); };
$('#ar-restore').onclick = () => storeKit.restore();
document.addEventListener('visibilitychange', () => { if (!document.hidden) storeKit.refresh(); });

function syncDifficultyUI() {
  document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.diff === settings.difficulty));
  $('#diff-desc').textContent = diff().desc;
}
document.querySelectorAll('#diff button').forEach(b => (b.onclick = () => {
  settings.difficulty = b.dataset.diff;
  store.set('settings', settings);
  syncDifficultyUI();
  haptic('LIGHT');
}));
$('#close-settings').onclick = () => { store.set('settings', settings); showScreen(settingsReturn); };
const sens = $('#sens');
sens.oninput = () => { settings.sensitivity = +sens.value; $('#sens-val').textContent = settings.sensitivity.toFixed(1) + 'x'; };
document.querySelectorAll('.toggle').forEach(t => (t.onclick = () => {
  const k = t.dataset.key;
  settings[k] = !settings[k];
  t.classList.toggle('on', settings[k]);
  if (k === 'sound') sfx.setEnabled(settings.sound);
  if (k === 'haptics' && settings.haptics) haptic('MEDIUM');
}));
function syncSettingsUI() {
  sens.value = settings.sensitivity;
  $('#sens-val').textContent = settings.sensitivity.toFixed(1) + 'x';
  document.querySelectorAll('.toggle').forEach(t => t.classList.toggle('on', !!settings[t.dataset.key]));
}
function refreshRecords() {
  $('#best-score').textContent = records.score.toLocaleString();
  $('#best-wave').textContent = records.wave;
  $('#best-rank').textContent = records.rank ? '#' + records.rank.toLocaleString() : '—';
}

loadMap(store.get('map', 'street'));
resetRun();
resize();
profile.loadout.primary = loadoutWeapons()[0];
refreshProfileUI();
placePreview();
storeKit.init();

const modalQueue = [];
let modalOpen = false;
function queueModal(open, priority = 0) {
  modalQueue.push({ open, priority });
  modalQueue.sort((a, b) => b.priority - a.priority);
  pumpModal();
}
function pumpModal() {
  if (modalOpen || !modalQueue.length) return;
  modalOpen = true;
  let done = false;
  modalQueue.shift().open(() => { if (done) return; done = true; modalOpen = false; setTimeout(pumpModal, 300); });
}
function grantScrap(n) { profile.scrap += Math.round(n); saveProfile(); refreshProfileUI(); }
function grantXP(n) { profile.xp += Math.round(n); saveProfile(); refreshProfileUI(); }
const api = {
  THREE, bus, rng, R, hashSeed, $, ui, state, player, stats, look, move, settings, records, profile, store, scene, camera, zombies, pickups,
  WEAPONS, SLOTS, TITLES, DIFFICULTIES, MODS, ZT, PERKS, BOSS_ORDER, sfx, haptic, preview, gameCenter, storeKit, LEADERBOARDS, boardView, renderBoard,
  saveProfile, refreshProfileUI, refreshRecords, levelInfo, reqMet, reqText, myCode, loadoutWeapons, weaponOwned, weaponIndex, encodeLoadout, decodeLoadout,
  startGame, toMenu, showScreen, registerScreen, get activeScreen() { return activeScreen; }, toast, message, hint, floater, schedule, nextWave,
  makeZombie, damageZombie, hurtPlayer, explode, dropPickup, blocked, selectWeapon, runSummary, grantScrap, grantXP, diff, queueModal,
  MAPS: MAPS.map(({ id, name, desc }) => ({ id, name, desc })), get currentMap() { return world.map.id; }, loadMap: selectMap,
  offerPerks, nova, deathGuards, gameOver, deployOpts: () => ({}),
};
Object.assign(api, { MUTATIONS, rosterWeights, netHooks: { animateZombie, killZombie, ignite, chill, thaw, iceMat, spit, tracer, sparks, slamRing, SLAM_R, waveComposition, waveCleared, gameOver, screamFx } });
for (const f of FEATURES) { try { f.init(api); } catch (e) { console.error('feature init failed', f.id, e); } }
if ($('#cm-league')) $('#menu .records').appendChild($('#cm-league'));
if (new URLSearchParams(location.search).has('debug')) window.__game = { api, update, scene, shells, singularities, projectiles, hazards, setFiring: v => (firing = v), gameOver, renderer, NAV, findSpawn, updateNav, navCell, obstacles, solids, world, fires };
bus.emit('app:ready', {});
refreshRecords();
populateMenu();
syncSettingsUI();
syncDifficultyUI();
frame();
if (gameCenter.available()) gameCenter.signIn().then(() => gameCenter.rank()).then(p => { if (p) { records.rank = p.rank; store.set('records', records); refreshRecords(); } });

