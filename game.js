import * as THREE from './vendor/three.module.js';

const $ = s => document.querySelector(s);
const ui = {
  hud: $('#hud'), menu: $('#menu'), pauseMenu: $('#pausemenu'), settings: $('#settings'), perks: $('#perks'), over: $('#over'),
  hpNum: $('#hp-num'), hpFill: $('#hp-fill'), hpLag: $('#hp-lag'), waveNum: $('#wave-num'), alive: $('#alive'), waveFill: $('#wave-fill'),
  score: $('#score'), combo: $('#combo'), radar: $('#radar'), bossBar: $('#bossbar'), bossName: $('#boss-name'), bossFill: $('#boss-fill'),
  crosshair: $('#crosshair'), hit: $('#hit'), ring: $('#reticle-ring'), message: $('#message'), toast: $('#toast'), floaters: $('#floaters'),
  damage: $('#damage'), lowhp: $('#lowhp'), indicators: $('#indicators'), stickZone: $('#stick-zone'), stick: $('#stick'), dot: $('#stick-dot'),
  gunName: $('#gun-name'), ammo: $('#ammo'), fire: $('#fire'), reload: $('#reload'), reloadRing: $('#reload .ring circle'),
  grenade: $('#grenade'), nades: $('#nades'), swap: $('#swap'), pause: $('#pause'), hint: $('#hint'), perkList: $('#perk-list'), perkTitle: $('#perk-title'),
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('deadzone.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('deadzone.' + k, JSON.stringify(v)); } catch {} },
};
const settings = Object.assign({ sensitivity: 1, aimAssist: true, autoFire: false, invert: false, sound: true, haptics: true }, store.get('settings', {}));
const records = Object.assign({ score: 0, wave: 0 }, store.get('records', {}));
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
addEventListener('resize', resize);

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
function bakeStatic(roots) {
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
    scene.add(m);
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

const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({
  side: THREE.BackSide, fog: false, depthWrite: false,
  map: canvasTexture(8, 256, (cx) => {
    const g = cx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#020409'); g.addColorStop(.3, '#081624'); g.addColorStop(.46, '#1b2c38');
    g.addColorStop(.5, '#4a2c1e'); g.addColorStop(.53, '#0b1820'); g.addColorStop(1, '#0b1820');
    cx.fillStyle = g; cx.fillRect(0, 0, 8, 256);
  }),
}));
scene.add(sky);
{
  const n = 350, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = .15 + Math.random() * 1.3;
    pos.set([Math.cos(a) * Math.cos(e) * 88, Math.sin(e) * 88, Math.sin(a) * Math.cos(e) * 88], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: .7 })));
}
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
scene.add(new THREE.HemisphereLight(0x8bbfd2, 0x2a2016, 1.5));

function buildWorld() {
  const road = mesh(new THREE.PlaneGeometry(18, 96), new THREE.MeshStandardMaterial({ map: gritTexture('#2f3c43', '#a8c0be', 4, 20), roughness: .9, metalness: .1 }), 0, 0, 0);
  road.rotation.x = -Math.PI / 2;
  const ground = mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: gritTexture('#2b3136', '#899499', 16, 16), roughness: .98 }), 0, -.03, 0);
  ground.rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) {
    const curb = mesh(new THREE.BoxGeometry(.4, .16, 96), mat(0x5b6468, { roughness: .9 }), sx * 9.1, .08, 0);
    curb.castShadow = false;
    const walk = mesh(new THREE.BoxGeometry(2.4, .14, 96), mat(0x3a4246, { roughness: .95 }), sx * 10.5, .07, 0);
    walk.castShadow = false;
  }
  const lineMat = mat(0x9c8a5a, { roughness: .9 });
  for (let z = -44; z < 46; z += 6) mesh(new THREE.BoxGeometry(.18, .02, 2.4), lineMat, 0, .012, z).castShadow = false;

  const windowGeo = new THREE.BoxGeometry(.6, .9, .05);
  const winDark = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: .3, metalness: .6 });
  const winLit = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xff8a2a, emissiveIntensity: 1.3 });
  const winBlue = new THREE.MeshStandardMaterial({ color: 0x0a1822, emissive: 0x3aa0ff, emissiveIntensity: .7 });
  function building(x, z, w, d, h, c) {
    const b = mesh(new THREE.BoxGeometry(w, h, d), mat(c, { roughness: .88 }), x, h / 2, z);
    solids.push(b);
    obstacles.push({ x, z, w: w + .5, d: d + .5 });
    mesh(new THREE.BoxGeometry(w + .4, .35, d + .4), mat(0x121a1f), x, h + .17, z);
    const face = x < 0 ? 1 : -1;
    for (let y = 2.2; y < h - 1; y += 2.6) {
      for (let zz = -d * .36; zz <= d * .37; zz += d * .24) {
        const r = Math.random();
        const m = r > .82 ? winLit : r > .76 ? winBlue : winDark;
        const win = new THREE.Mesh(windowGeo, m);
        win.rotation.y = Math.PI / 2;
        win.position.set(x + face * (w / 2 + .03), y, z + zz);
        scene.add(win);
      }
    }
    mesh(new THREE.BoxGeometry(.06, 2.2, 1.4), mat(0x0b0f12), x + face * (w / 2 + .03), 1.1, z);
  }
  [[-15, -18, 9, 10, 16], [15, -17, 8, 11, 19], [-15, 3, 10, 9, 21], [15, 7, 9, 12, 17], [-16, 27, 8, 11, 20], [16, 28, 11, 10, 23], [-9, -36, 5, 8, 13], [10, -36, 6, 7, 15]]
    .forEach((v, i) => building(v[0], v[1], v[2], v[3], v[4], [0x252b31, 0x1b262d, 0x2d2628][i % 3]));

  const far = new THREE.MeshBasicMaterial({ color: 0x060b10, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + Math.random() * .1, r = 70 + Math.random() * 10, h = 12 + Math.random() * 26, w = 6 + Math.random() * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), far);
    b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    b.lookAt(0, h / 2, 0);
    scene.add(b);
  }

  const carColors = [0x6b1f1c, 0x2d4a5c, 0x3c3f41, 0x7a6a3a, 0x1f3a2b];
  function car(x, z, rot, color, tilt = 0) {
    const o = new THREE.Group();
    const paint = mat(color, { roughness: .45, metalness: .55 });
    mesh(new THREE.BoxGeometry(2.1, .6, 4.3), paint, 0, .62, 0, o);
    mesh(new THREE.BoxGeometry(1.9, .55, 2.1), paint, 0, 1.18, -.2, o);
    mesh(new THREE.BoxGeometry(1.94, .44, 2.14), mat(0x0c1418, { roughness: .1, metalness: .9 }), 0, 1.2, -.2, o);
    mesh(new THREE.BoxGeometry(2.14, .2, .2), mat(0x1a1d1f), 0, .45, 2.15, o);
    mesh(new THREE.BoxGeometry(2.14, .2, .2), mat(0x1a1d1f), 0, .45, -2.15, o);
    for (const sx of [-.7, .7]) {
      mesh(new THREE.BoxGeometry(.4, .14, .05), mat(0x331b0a, { emissive: 0xffc27a, emissiveIntensity: Math.random() > .5 ? .8 : 0 }), sx, .72, 2.16, o);
      mesh(new THREE.BoxGeometry(.4, .14, .05), mat(0x330808, { emissive: 0xff2a1a, emissiveIntensity: .6 }), sx, .72, -2.16, o);
    }
    for (const sx of [-.98, .98]) for (const sz of [-1.35, 1.35]) {
      const wh = mesh(new THREE.CylinderGeometry(.38, .38, .26, 14), mat(0x0a0c0d, { roughness: .9 }), sx, .38, sz, o);
      wh.rotation.z = Math.PI / 2;
    }
    o.position.set(x, 0, z); o.rotation.set(0, rot, tilt);
    scene.add(o);
    solids.push(o);
    obstacles.push({ x, z, w: 2.9, d: 4.7 });
  }
  car(-4, -10, .3, carColors[0]); car(5, 8, -.25, carColors[1]); car(-5, 34, 2.8, carColors[2]); car(6.5, -24, 1.4, carColors[3], .05);

  const sandMat = mat(0x6d624a, { roughness: 1, flatShading: true });
  const bagGeo = lumpy(new THREE.CapsuleGeometry(.22, .5, 3, 6), .2);
  function sandbags(x, z, rot, len = 5) {
    const g = new THREE.Group();
    for (let row = 0; row < 3; row++) for (let i = 0; i < len - row % 2; i++) {
      const b = mesh(bagGeo, sandMat, (i - (len - 1) / 2 + (row % 2) * .5) * .78, .2 + row * .34, 0, g);
      b.rotation.z = Math.PI / 2; b.scale.set(1, 1, .75); b.rotation.y = (Math.random() - .5) * .2;
    }
    g.position.set(x, 0, z); g.rotation.y = rot;
    scene.add(g); solids.push(g);
    const ww = Math.abs(Math.cos(rot)) * len * .8 + .7, dd = Math.abs(Math.sin(rot)) * len * .8 + .7;
    obstacles.push({ x, z, w: ww, d: dd });
  }
  sandbags(-5, 18, 0); sandbags(4.5, 25, .4, 4); sandbags(-2, -30, -.2, 4);

  const concrete = mat(0x8b8f88, { roughness: .95 });
  function jersey(x, z) {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(2.2, .35, .7), concrete, 0, .17, 0, g);
    mesh(new THREE.BoxGeometry(2.2, .6, .32), concrete, 0, .63, 0, g);
    mesh(new THREE.BoxGeometry(2.21, .18, .33), mat(0xc2402c), 0, .78, 0, g);
    g.position.set(x, 0, z); g.rotation.y = (Math.random() - .5) * .3;
    scene.add(g); solids.push(g);
  }
  for (let x = -8; x <= 8; x += 2.4) { jersey(x, 43); jersey(x + 1, -44); }

  const crateMat = mat(0x5a4630, { roughness: .9 });
  for (const [x, z] of [[6, 25], [-6.2, 20.5], [5, -28]]) {
    const c = mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), crateMat, x, .55, z);
    c.rotation.y = Math.random(); solids.push(c);
    obstacles.push({ x, z, w: 1.6, d: 1.6 });
  }

  const poleMat = mat(0x22292c, { metalness: .6, roughness: .5 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-8.6, -6], [8.6, 16], [-8.6, 40], [8.6, -32]]) {
    const s = Math.sign(x);
    mesh(new THREE.CylinderGeometry(.08, .12, 6, 8), poleMat, x, 3, z);
    mesh(new THREE.BoxGeometry(1.6, .08, .08), poleMat, x - s * .8, 6, z);
    mesh(new THREE.BoxGeometry(.5, .12, .3), mat(0x2a2a20, { emissive: 0xffd08a, emissiveIntensity: 2 }), x - s * 1.5, 5.93, z);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.8, 20, 1, true), beamMat);
    beam.position.set(x - s * 1.5, 3, z);
    scene.add(beam);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc080, transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x - s * 1.5, .03, z);
    scene.add(pool);
    obstacles.push({ x, z, w: .5, d: .5 });
  }
}
const beforeWorld = new Set(scene.children);
buildWorld();

const fires = [];
function barrel(x, z) {
  const g = new THREE.Group();
  const drum = mesh(new THREE.CylinderGeometry(.34, .32, .9, 14, 1, true), mat(0x3b2a1e, { metalness: .6, roughness: .6, side: THREE.DoubleSide }), 0, .45, 0, g);
  for (const y of [.2, .7]) mesh(new THREE.TorusGeometry(.345, .025, 5, 16), mat(0x2a1a10, { metalness: .7 }), 0, y, 0, g).rotation.x = Math.PI / 2;
  const coals = new THREE.Mesh(new THREE.CircleGeometry(.3, 14), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  coals.rotation.x = -Math.PI / 2; coals.position.y = .84; g.add(coals);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: i ? 0xff7a26 : 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set((Math.random() - .5) * .2, 1.1 + i * .15, (Math.random() - .5) * .2);
    g.add(f); flames.push(f);
  }
  g.position.set(x, 0, z); scene.add(g); solids.push(drum);
  obstacles.push({ x, z, w: .9, d: .9 });
  const light = new THREE.PointLight(0xff7026, 22, 14, 2);
  light.position.set(x, 1.8, z); scene.add(light);
  fires.push({ light, flames, seed: Math.random() * 10 });
}
[[-6, -4], [6.5, 21], [-4, 30], [4, -17]].forEach(p => barrel(...p));
bakeStatic(scene.children.filter(c => !beforeWorld.has(c)));

function blocked(x, z, r = .32) {
  if (Math.abs(x) > 42 || Math.abs(z) > 42.5) return true;
  for (const o of obstacles) if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r) return true;
  return false;
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
const tracers = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(tracerGeo, tracerMat); m.visible = false; m.userData.t = 0; scene.add(m); return m; });
let tracerCursor = 0;
function tracer(from, to) {
  const t = tracers[tracerCursor = (tracerCursor + 1) % tracers.length];
  const len = from.distanceTo(to);
  t.position.copy(from); t.lookAt(to); t.scale.set(.018, .018, len);
  t.visible = true; t.userData.t = .045;
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
  walker: { hp: 80, speed: 1.15, dmg: 7, scale: 1, bulk: 1, score: 100, lean: .22, stride: 6.5, eye: 0xffb23f, drop: .12 },
  runner: { hp: 48, speed: 3.1, dmg: 5, scale: .94, bulk: .85, score: 150, lean: .6, stride: 11, eye: 0xff2a1a, drop: .12 },
  brute: { hp: 420, speed: .9, dmg: 17, scale: 1.4, bulk: 1.35, score: 450, lean: .12, stride: 4.4, eye: 0x7dff5a, drop: .55 },
  boss: { hp: 2600, speed: 1.15, dmg: 30, scale: 2.3, bulk: 1.3, score: 3000, lean: .18, stride: 3.6, eye: 0xd35bff, drop: 1 },
};
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
};
const flashMat = new THREE.MeshBasicMaterial({ color: 0xff5540 });
const zombieMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true });
const pick = a => a[(Math.random() * a.length) | 0];

const zombieVariants = new Map();
function zombieVariant(kind) {
  const list = zombieVariants.get(kind) || [];
  zombieVariants.set(kind, list);
  if (list.length >= 4) return pick(list);
  const skin = pick(SKINS), cloth = pick(CLOTHES), pants = pick(PANTS), blood = 0x5a0a08, bone = 0xd9d0b4;
  const piece = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => ({ geo, color, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const spine = [
    piece(ZG.belly, Math.random() > .5 ? skin : cloth, 0, .12, 0),
    piece(ZG.torso, cloth, 0, .44, 0),
    piece(ZG.wound, blood, (Math.random() - .5) * .25, .3 + Math.random() * .2, .158),
  ];
  if (Math.random() > .4) for (let i = 0; i < 3; i++) spine.push(piece(ZG.rib, bone, .1, .3 + i * .04, .17));
  for (let i = 0; i < 3; i++) spine.push(piece(ZG.strip, cloth, (Math.random() - .5) * .4, .1, .16, .1, 0, (Math.random() - .5) * .5));
  const spikes = kind === 'boss' ? 5 : kind === 'brute' ? 3 : 0;
  for (let i = 0; i < spikes; i++) spine.push(piece(ZG.spike, bone, (i - (spikes - 1) / 2) * .12, .55, -.18, -.6));
  const head = [piece(ZG.head, skin, 0, .19, 0, 0, 0, 0, 1, 1.12, 1.05)];
  if (Math.random() > .35) head.push(piece(ZG.hair, pick(HAIR), 0, .27, -.03, 0, 0, 0, 1, .55, 1));
  const arm = () => Math.random() > .5 ? cloth : skin;
  const shin = () => Math.random() > .7 ? skin : pants;
  const v = {
    pelvis: mergeGeos([piece(ZG.pelvis, pants, 0, 0, 0)]),
    thigh: mergeGeos([piece(ZG.thigh, pants, 0, -.2, 0)]),
    shinL: mergeGeos([piece(ZG.shin, shin(), 0, -.2, 0), piece(ZG.foot, 0x15191b, 0, -.42, .05)]),
    shinR: mergeGeos([piece(ZG.shin, shin(), 0, -.2, 0), piece(ZG.foot, 0x15191b, 0, -.42, .05)]),
    spine: mergeGeos(spine),
    head: mergeGeos(head),
    eyes: mergeGeos([piece(ZG.eye, 0, -.07, .21, .17), piece(ZG.eye, 0, .07, .21, .17)]),
    jaw: mergeGeos([piece(ZG.jaw, skin, 0, -.03, .06)]),
    upperL: mergeGeos([piece(ZG.upper, arm(), 0, -.16, 0)]),
    upperR: mergeGeos([piece(ZG.upper, arm(), 0, -.16, 0)]),
    fore: mergeGeos([piece(ZG.fore, skin, 0, -.14, 0), piece(ZG.hand, skin, 0, -.32, .01)]),
  };
  list.push(v);
  return v;
}

function makeZombie(kind, x, z, rise = true) {
  const T = ZT[kind], V = zombieVariant(kind);
  const eyeMat = mat(T.eye, { emissive: T.eye, emissiveIntensity: 5 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.scale.set(T.scale * T.bulk, T.scale, T.scale * T.bulk);
  const P = {}, meshes = [];
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const part = (geo, parent, shadow, material = zombieMat) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow; m.userData.zroot = root; m.userData.base = material;
    parent.add(m); meshes.push(m); return m;
  };
  P.hips = joint(body, 0, .92, 0);
  part(V.pelvis, P.hips, true);
  for (const s of [-1, 1]) {
    const leg = joint(P.hips, s * .13, -.06, 0), knee = joint(leg, 0, -.42, 0);
    part(V.thigh, leg, true);
    part(s < 0 ? V.shinL : V.shinR, knee, false);
    P[s < 0 ? 'legL' : 'legR'] = leg; P[s < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  P.spine = joint(P.hips, 0, .1, 0); P.spine.rotation.x = T.lean;
  part(V.spine, P.spine, true);
  P.head = joint(P.spine, 0, .7, .02);
  part(V.head, P.head, true).userData.head = true;
  const eyes = part(V.eyes, P.head, false, eyeMat); eyes.userData.head = true; eyes.userData.glow = true;
  P.jaw = joint(P.head, 0, .07, .03);
  part(V.jaw, P.jaw, false).userData.head = true;
  for (const s of [-1, 1]) {
    const sh = joint(P.spine, s * .33, .6, 0), el = joint(sh, 0, -.34, 0);
    part(s < 0 ? V.upperL : V.upperR, sh, false);
    part(V.fore, el, false);
    P[s < 0 ? 'armL' : 'armR'] = sh; P[s < 0 ? 'elbowL' : 'elbowR'] = el;
  }
  const hp = T.hp * (1 + (state.wave - 1) * .14);
  root.userData = {
    zombie: true, kind, T, P, meshes, hp, maxHp: hp, speed: T.speed * (1 + Math.min(.45, (state.wave - 1) * .035)) * (.9 + Math.random() * .2),
    walk: Math.random() * 6, phase: Math.random() * 6, flash: 0, nextAttack: 0, swing: 0, dead: false, deathT: 0, rise: rise ? 1 : 0,
    side: Math.random() > .5 ? 1 : -1, kx: 0, kz: 0, radius: .34 * T.scale * T.bulk, groanAt: Math.random() * 5,
  };
  root.position.set(x, rise ? -1.9 * T.scale : 0, z);
  scene.add(root);
  zombies.push(root);
  return root;
}

function flashZombie(z) {
  const u = z.userData;
  u.flash = .07;
  for (const m of u.meshes) if (!m.userData.glow) m.material = flashMat;
}

function animateZombie(z, dt) {
  const u = z.userData, P = u.P, T = u.T;
  if (u.flash > 0) { u.flash -= dt; if (u.flash <= 0) for (const m of u.meshes) m.material = m.userData.base; }
  if (u.dead) {
    u.deathT += dt;
    const k = Math.min(1, u.deathT / .55), e = 1 - (1 - k) * (1 - k);
    z.children[0].rotation.x = -e * 1.5;
    P.armL.rotation.x = P.armR.rotation.x = -2.6 * e;
    P.legL.rotation.x = P.legR.rotation.x = 0;
    if (u.deathT > 2.8) z.position.y -= dt * .45;
    return u.deathT > 5;
  }
  const s = Math.sin(u.walk), c = Math.cos(u.walk), amp = u.moving ? 1 : .25;
  P.legL.rotation.x = s * .55 * amp; P.legR.rotation.x = -s * .55 * amp;
  P.kneeL.rotation.x = Math.max(0, c) * .9 * amp; P.kneeR.rotation.x = Math.max(0, -c) * .9 * amp;
  P.hips.position.y = .92 + Math.abs(s) * .04 * amp;
  P.hips.rotation.y = s * .12 * amp;
  P.head.rotation.z = Math.sin(state.clock * 1.3 + u.phase) * .28;
  P.head.rotation.x = Math.sin(state.clock * .9 + u.phase) * .12;
  P.jaw.rotation.x = .15 + Math.abs(Math.sin(state.clock * 3 + u.phase)) * .35;
  let armX = -1.3, armSway = Math.sin(u.walk * .5 + u.phase) * .18;
  if (u.kind === 'runner') { armX = -.4; armSway = s * 1.1; }
  if (u.swing > 0) { const k = u.swing / .45; armX = -1.3 - Math.sin(k * Math.PI) * 1.4; }
  P.armL.rotation.x = armX + armSway; P.armR.rotation.x = armX - armSway;
  P.armL.rotation.z = -.15; P.armR.rotation.z = .15;
  P.elbowL.rotation.x = P.elbowR.rotation.x = u.kind === 'runner' ? -.9 : -.25;
  return false;
}

const WEAPONS = [
  { id: 'rifle', name: 'M4A1', mag: 30, reserve: 180, maxReserve: 360, rate: .095, damage: 30, head: 2.3, pellets: 1, spread: .008, moveSpread: .025, range: 70, reloadTime: 1.6, kick: .012, recoil: .045, auto: true },
  { id: 'shotgun', name: 'R-870', mag: 8, reserve: 32, maxReserve: 64, rate: .8, damage: 16, head: 1.6, pellets: 9, spread: .065, moveSpread: .02, range: 24, reloadTime: 2.2, kick: .05, recoil: .16, auto: false, knock: 1.4 },
];

const guns = WEAPONS.map(w => {
  const g = new THREE.Group();
  const metal = mat(0x3a464b, { roughness: .35, metalness: .7 }), dark = mat(0x1a2024, { roughness: .5, metalness: .5 });
  const poly = mat(0x33392f, { roughness: .8 }), wood = mat(0x8a5428, { roughness: .55 }), tan = mat(0xa38b62, { roughness: .75 });
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  if (w.id === 'rifle') {
    add(new THREE.BoxGeometry(.08, .1, .4), metal, 0, 0, -.08);
    add(new THREE.BoxGeometry(.045, .02, .52), dark, 0, .06, -.14);
    add(new THREE.BoxGeometry(.09, .09, .32), tan, 0, -.005, -.44);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(.092, .015, .04), dark, 0, -.005, -.34 - i * .07);
    add(new THREE.CylinderGeometry(.015, .015, .28, 8), dark, 0, .005, -.72, Math.PI / 2);
    add(new THREE.CylinderGeometry(.026, .026, .07, 8), dark, 0, .005, -.88, Math.PI / 2);
    add(new THREE.BoxGeometry(.055, .2, .09), dark, 0, -.13, -.13, .28);
    add(new THREE.BoxGeometry(.05, .13, .06), poly, 0, -.1, .06, -.35);
    add(new THREE.BoxGeometry(.06, .09, .26), tan, 0, -.02, .24);
    add(new THREE.BoxGeometry(.05, .06, .09), dark, 0, .105, -.07);
    add(new THREE.CylinderGeometry(.024, .024, .02, 12), new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: .35 }), 0, .11, -.02, Math.PI / 2);
    add(new THREE.SphereGeometry(.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), 0, .112, -.035);
    add(new THREE.BoxGeometry(.02, .04, .02), dark, 0, .05, -.58);
  } else {
    add(new THREE.BoxGeometry(.085, .11, .32), metal, 0, 0, -.05);
    add(new THREE.BoxGeometry(.02, .05, .12), dark, .044, .01, -.07);
    add(new THREE.CylinderGeometry(.024, .024, .72, 10), dark, 0, .028, -.55, Math.PI / 2);
    add(new THREE.CylinderGeometry(.018, .018, .56, 10), metal, 0, -.025, -.47, Math.PI / 2);
    g.userData.pump = add(new THREE.BoxGeometry(.085, .075, .22), wood, 0, -.028, -.45);
    add(new THREE.BoxGeometry(.055, .12, .07), wood, 0, -.09, .1, -.4);
    add(new THREE.BoxGeometry(.065, .09, .3), wood, 0, -.06, .3, -.12);
    add(new THREE.SphereGeometry(.01, 6, 6), mat(0xffc34d, { emissive: 0xffc34d, emissiveIntensity: 1 }), 0, .05, -.9);
  }
  const sleeve = mat(0x2d3b2a, { roughness: 1, flatShading: true }), glove = mat(0x161a1c, { roughness: .9 });
  const armR = add(new THREE.CapsuleGeometry(.055, .38, 4, 8), sleeve, .06, -.2, .28, -1.1); armR.rotation.z = .25;
  add(new THREE.BoxGeometry(.07, .08, .1), glove, .02, -.12, .05);
  const armL = add(new THREE.CapsuleGeometry(.05, .5, 4, 8), sleeve, -.14, -.2, -.2, -1.25); armL.rotation.z = -.6;
  add(new THREE.BoxGeometry(.09, .06, .12), glove, -.04, -.06, w.id === 'rifle' ? -.42 : -.45);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0, .01, w.id === 'rifle' ? -.97 : -.95); flash.visible = false; g.add(flash);
  g.userData.flash = flash;
  const light = new THREE.PointLight(0xffa050, 0, 3, 2); light.position.set(0, .05, -.9); g.add(light); g.userData.light = light;
  g.visible = false;
  viewScene.add(g);
  return g;
});

const stats = {};
const player = {};
const state = { mode: 'menu', wave: 0, clock: 0 };
const look = { yaw: 0, pitch: 0, recoil: 0, shake: 0, swayX: 0, swayY: 0, bob: 0, fov: 74, assist: 1 };
const move = { x: 0, y: 0, sprint: false };
const keys = {};
let firing = false, aimTarget = null, menuAngle = 0, menuTarget = new THREE.Vector3();

function schedule(delay, fn) { scheduled.push({ at: state.clock + delay, fn }); }

function resetRun() {
  Object.assign(stats, { damage: 1, fireRate: 1, reload: 1, speed: 1, maxHp: 100, mag: 1, headMul: 1, leech: 0, nadeMax: 3, armor: 1, luck: 1, secondWind: false });
  Object.assign(player, { hp: 100, lagHp: 100, nades: 2, weapon: 0, reloading: 0, swapT: 0, nextShot: 0, lastHurt: -9, unlocked: 1, pumpT: 0, lastBeat: 0,
    ammo: WEAPONS.map(w => w.mag), reserve: WEAPONS.map(w => w.reserve) });
  Object.assign(state, { wave: 0, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, combo: 0, bestCombo: 0, lastKill: -9, spawnLeft: 0, waveTotal: 0,
    waveDone: 0, clock: 0, between: true, boss: null, moved: false, looked: false });
  scheduled.length = 0;
  ui.bossBar.classList.add('hidden');
  ui.swap.classList.add('hidden');
  ui.lowhp.classList.remove('on');
  hint('');
  for (const z of zombies) scene.remove(z);
  zombies.length = 0;
  for (const p of pickups) scene.remove(p);
  pickups.length = 0;
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
}

function magSize(i) { return Math.round(WEAPONS[i].mag * stats.mag); }

function startGame() {
  sfx.init();
  resetRun();
  camera.position.set(0, 1.64, 30);
  look.yaw = 0; look.pitch = 0; look.recoil = 0;
  camera.fov = 74; camera.updateProjectionMatrix();
  state.mode = 'playing';
  showScreen(null);
  ui.hud.classList.add('on');
  selectWeapon(0, true);
  schedule(.8, nextWave);
  if (!tutorialDone) schedule(.3, () => hint('Drag anywhere on the left to move'));
  haptic('MEDIUM');
}

function waveComposition(w) {
  const list = [];
  const total = 4 + w * 2 + Math.floor(w * w * .12);
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    if (w >= 4 && r < Math.min(.18, (w - 3) * .04)) list.push('brute');
    else if (w >= 2 && r < Math.min(.4, (w - 1) * .08) + .18) list.push('runner');
    else list.push('walker');
  }
  if (w % 5 === 0) list.splice(Math.floor(list.length / 3), 0, 'boss');
  return list;
}

function nextWave() {
  state.wave++;
  state.queue = waveComposition(state.wave);
  state.waveTotal = state.queue.length;
  state.waveDone = 0;
  state.between = false;
  state.spawnGap = 0;
  if (state.wave === 3 && player.unlocked < 2) {
    player.unlocked = 2;
    ui.swap.classList.remove('hidden');
    schedule(2.2, () => toast('NEW WEAPON: R-870 SHOTGUN — TAP ⇄ TO SWAP', 3));
  }
  const boss = state.wave % 5 === 0;
  message('WAVE ' + state.wave, boss ? 'SOMETHING BIG IS COMING' : state.wave === 1 ? 'THE DEAD ARE COMING' : 'HOLD THE LINE', 2.2);
  sfx.wave();
  haptic('MEDIUM');
}

function findSpawn(minD = 16, maxD = 32) {
  const fwdX = -Math.sin(look.yaw), fwdZ = -Math.cos(look.yaw);
  let best = null;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const x = camera.position.x + Math.cos(a) * d, z = camera.position.z + Math.sin(a) * d;
    if (blocked(x, z, 1)) continue;
    const facing = (Math.cos(a) * fwdX + Math.sin(a) * fwdZ);
    if (!best || facing > best.facing) best = { x, z, facing };
    if (facing > .2 && Math.random() > .4) break;
  }
  return best || { x: 0, z: -30 };
}

function spawnTick(dt) {
  if (state.between || !state.queue?.length) return;
  state.spawnGap -= dt;
  const alive = zombies.filter(z => !z.userData.dead).length;
  if (state.spawnGap > 0 || alive >= Math.min(5 + state.wave, 16)) return;
  const kind = state.queue.shift();
  const p = findSpawn();
  const z = makeZombie(kind, p.x, p.z);
  state.spawnGap = kind === 'boss' ? 1.5 : Math.max(.35, 1.1 - state.wave * .06);
  if (kind === 'boss') {
    state.boss = z;
    ui.bossBar.classList.remove('hidden');
    ui.bossName.textContent = ['ABOMINATION', 'THE BUTCHER', 'GOLIATH', 'PLAGUE KING'][Math.floor(state.wave / 5 - 1) % 4];
    sfx.roar(); look.shake = .6; haptic('HEAVY');
  }
}

function hurtPlayer(amount, from) {
  if (state.mode !== 'playing') return;
  amount *= stats.armor;
  player.hp = Math.max(0, player.hp - amount);
  player.lastHurt = state.clock;
  look.shake = Math.min(.5, look.shake + amount * .02);
  ui.damage.style.opacity = Math.min(1, .35 + amount / 20);
  setTimeout(() => (ui.damage.style.opacity = 0), 140);
  sfx.hurt();
  haptic(amount > 12 ? 'HEAVY' : 'MEDIUM');
  if (from) damageIndicator(from);
  if (player.hp <= 0) {
    if (stats.secondWind) {
      stats.secondWind = false;
      player.hp = stats.maxHp * .5;
      message('SECOND WIND', 'BACK ON YOUR FEET', 1.8);
      explode(camera.position.x, camera.position.z, true);
      return;
    }
    gameOver();
  }
}

function killZombie(z, head) {
  const u = z.userData;
  u.dead = true; u.deathT = 0;
  if (head) { u.P.head.scale.setScalar(.001); gore.emit(z.position.x, 1.9 * u.T.scale, z.position.z, 26, { speed: 4, spread: 1.6, life: 1.2, colors: [0x6a0a08, 0x8a120e, 0x3a0605] }); }
  decal(z.position.x, z.position.z, 1.2 + u.T.scale * .6);
  if (!state.between && state.mode === 'playing') {
    state.kills++;
    if (head) state.heads++;
    state.combo = state.clock - state.lastKill < 3 ? state.combo + 1 : 1;
    state.lastKill = state.clock;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const mult = comboMult();
    const pts = Math.round(u.T.score * (head ? 1.5 : 1) * mult);
    state.score += pts;
    state.waveDone++;
    floater(z.position.x, 2.2 * u.T.scale, z.position.z, '+' + pts, head ? 'head' : '');
    if (head) toast('HEADSHOT', .8);
    if (stats.leech) player.hp = Math.min(stats.maxHp, player.hp + stats.leech);
    ui.combo.classList.add('pop'); setTimeout(() => ui.combo.classList.remove('pop'), 120);
    const drops = u.kind === 'boss' ? 4 : Math.random() < u.T.drop * stats.luck ? 1 : 0;
    for (let i = 0; i < drops; i++) dropPickup(z.position.x + (Math.random() - .5) * 2, z.position.z + (Math.random() - .5) * 2, u.kind === 'boss' ? ['health', 'ammo', 'grenade', 'ammo'][i] : null);
    if (z === state.boss) { state.boss = null; ui.bossBar.classList.add('hidden'); message('BOSS DOWN', '+' + pts, 2); look.shake = .5; }
  }
  sfx.kill();
  haptic(head ? 'MEDIUM' : 'LIGHT');
}

function comboMult() { return state.combo > 1 ? Math.min(4, 1 + (state.combo - 1) * .25) : 1; }

function damageZombie(z, amount, point, head, dir) {
  const u = z.userData;
  if (u.dead) return;
  u.hp -= amount;
  flashZombie(z);
  if (dir) { u.kx += dir.x * (u.T.scale > 1.3 ? .3 : 1); u.kz += dir.z * (u.T.scale > 1.3 ? .3 : 1); }
  if (point) {
    gore.emit(point.x, point.y, point.z, head ? 12 : 7, { dir: dir ? { x: dir.x, y: .5, z: dir.z } : null, speed: 3, spread: 1.4, life: .8, colors: [0x7a0c09, 0x4a0605, 0x9a1a10] });
    floater(point.x, point.y + .2, point.z, Math.round(amount), head ? 'head' : '');
  }
  if (u.hp <= 0) killZombie(z, head);
}

function selectWeapon(i, instant) {
  if (i >= player.unlocked) return;
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
function shoot() {
  const i = player.weapon, w = WEAPONS[i], g = guns[i];
  if (state.mode !== 'playing' || player.swapT > 0 || state.clock < player.nextShot) return;
  if (player.reloading > 0) {
    if (w.id === 'shotgun' && player.ammo[i] > 0) player.reloading = 0; else return;
  }
  if (player.ammo[i] <= 0) {
    player.nextShot = state.clock + .3;
    sfx.dry();
    if (player.reserve[i] > 0) reload(); else toast('OUT OF AMMO — FIND SUPPLIES', 1.2);
    return;
  }
  player.ammo[i]--;
  player.nextShot = state.clock + w.rate / stats.fireRate;
  state.shots++;
  look.recoil += w.kick;
  look.yaw += (Math.random() - .5) * w.kick * .4;
  g.userData.kick = w.recoil;
  g.userData.flash.visible = true; g.userData.flash.material.rotation = Math.random() * 6;
  g.userData.flash.scale.setScalar(w.id === 'shotgun' ? .5 : .32 + Math.random() * .1);
  g.userData.flashT = .05;
  muzzleWorld.intensity = 14;
  if (w.id === 'shotgun') { sfx.shotgun(); haptic('MEDIUM'); player.pumpT = .55; setTimeout(() => sfx.pump(), 260); }
  else { sfx.rifle(); haptic('LIGHT'); }

  camera.updateMatrixWorld();
  const origin = camera.getWorldPosition(tmp);
  const muzzle = camera.localToWorld(tmp3.set(.22, -.2, -.9));
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const moving = Math.hypot(move.x, move.y) > .1 ? w.moveSpread : 0;
  const spread = w.spread + moving;
  const targets = zombies.filter(z => !z.userData.dead && z.userData.rise < .5);
  let anyHit = false;
  const hitMap = new Map();
  for (let p = 0; p < w.pellets; p++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    raycaster.set(origin, dir); raycaster.far = w.range;
    const hits = raycaster.intersectObjects([...targets, ...solids], true);
    const h = hits[0];
    const end = h ? h.point : tmp2.copy(origin).addScaledVector(dir, w.range);
    if (p < 3) tracer(muzzle, end);
    if (!h) continue;
    const z = h.object.userData.zroot;
    if (z) {
      const head = !!h.object.userData.head;
      const falloff = w.pellets > 1 ? Math.max(.35, 1 - h.distance / w.range) : 1;
      const dmg = w.damage * stats.damage * falloff * (head ? w.head * stats.headMul : 1);
      const e = hitMap.get(z) || { dmg: 0, head: false, point: h.point, dir };
      e.dmg += dmg; e.head ||= head; hitMap.set(z, e);
      anyHit = true;
    } else {
      sparks.emit(h.point.x, h.point.y, h.point.z, 5, { dir: h.face ? h.face.normal : null, speed: 3.5, spread: 1.2, life: .35, grav: 12, colors: [0xffd080, 0xffa040] });
    }
  }
  let killed = false, headHit = false;
  for (const [z, e] of hitMap) {
    damageZombie(z, e.dmg, e.point, e.head, w.knock ? tmp2.set(e.dir.x * w.knock, 0, e.dir.z * w.knock) : null);
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
  if (player.ammo[i] === 0 && player.reserve[i] > 0) schedule(.2, reload);
}

const nadeGeo = new THREE.SphereGeometry(.09, 10, 8);
const nadeMat = mat(0x3d4a2a, { roughness: .6, metalness: .3 });
function throwGrenade() {
  if (state.mode !== 'playing' || player.nades <= 0) return;
  player.nades--;
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow = true;
  m.position.copy(camera.position).addScaledVector(fwd, .6); m.position.y -= .2;
  scene.add(m);
  grenades.push({ mesh: m, vx: fwd.x * 14, vy: fwd.y * 14 + 4.5, vz: fwd.z * 14, t: 1.6 });
  sfx.throw(); haptic('LIGHT');
}

function explode(x, z, friendly) {
  blast.position.set(x, .6, z); blast.scale.setScalar(.2); blast.visible = true; blast.userData.t = 0;
  blastLight.position.set(x, 1.5, z); blastLight.intensity = 90;
  sparks.emit(x, .5, z, 60, { speed: 11, spread: 2.2, life: .7, grav: 8, dir: { x: 0, y: .8, z: 0 }, colors: [0xffd080, 0xff8030, 0xff5010] });
  gore.emit(x, .4, z, 40, { speed: 4, spread: 2, life: 1.6, grav: -1.2, drag: 1.5, dir: { x: 0, y: 1, z: 0 }, colors: [0x2a2a2a, 0x3a3632, 0x1a1a1a] });
  decal(x, z, 3.2, 0x222222);
  const d = Math.hypot(camera.position.x - x, camera.position.z - z);
  look.shake = Math.max(look.shake, Math.max(.15, 1 - d / 18));
  sfx.boom(); haptic('HEAVY');
  const R = 6.5;
  for (const zb of [...zombies]) {
    const u = zb.userData;
    if (u.dead) continue;
    const dd = Math.hypot(zb.position.x - x, zb.position.z - z);
    if (dd > R) continue;
    const k = 1 - dd / R;
    const dir = tmp2.set((zb.position.x - x) / (dd || 1) * 3 * k, 0, (zb.position.z - z) / (dd || 1) * 3 * k);
    damageZombie(zb, (friendly ? 500 : 340) * stats.damage * (.35 + k * .65), null, false, dir);
  }
}

const PICKUP_KINDS = {
  health: { color: 0x6dff8a, label: '+HEALTH' },
  ammo: { color: 0xffc34d, label: '+AMMO' },
  grenade: { color: 0xff7a4d, label: '+GRENADE' },
};
function dropPickup(x, z, kind) {
  if (!kind) {
    const r = Math.random(), lowHp = player.hp < stats.maxHp * .5;
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
}

function collect(p) {
  const k = p.userData.kind;
  if (k === 'health') player.hp = Math.min(stats.maxHp, player.hp + 35);
  if (k === 'ammo') WEAPONS.forEach((w, i) => (player.reserve[i] = Math.min(w.maxReserve, player.reserve[i] + magSize(i) * (i ? 1 : 2))));
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

function offerPerks() {
  state.mode = 'perk';
  ui.perkTitle.textContent = 'WAVE ' + state.wave + ' CLEARED';
  const pool = PERKS.filter(p => (!p.when || p.when()) && (!p.rare || Math.random() < .3));
  const picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  ui.perkList.innerHTML = '';
  for (const p of picks) {
    const b = document.createElement('button');
    b.className = 'perk' + (p.rare ? ' rare' : '');
    b.innerHTML = `<div class="ico">${p.icon}</div><b>${p.name}</b><span>${p.desc}</span>`;
    b.onclick = () => {
      p.apply(); sfx.perk(); haptic('MEDIUM');
      showScreen(null);
      state.mode = 'playing';
      toast(p.name, 1.4);
      schedule(1.4, nextWave);
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
  WEAPONS.forEach((w, i) => (player.reserve[i] = Math.min(w.maxReserve, player.reserve[i] + magSize(i))));
  message('SECTOR CLEAR', 'BONUS +' + bonus, 2);
  sfx.clear(); haptic('MEDIUM');
  schedule(2.2, offerPerks);
}

function gameOver() {
  state.mode = 'dead';
  firing = false;
  const secs = Math.round(state.clock);
  const best = state.score > records.score;
  records.score = Math.max(records.score, state.score);
  records.wave = Math.max(records.wave, state.wave);
  store.set('records', records);
  $('#over-sub').textContent = 'THE HORDE GOT YOU ON WAVE ' + state.wave;
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
  for (let i = 0; i < 7; i++) makeZombie(i === 3 ? 'brute' : i === 5 ? 'runner' : 'walker', (Math.random() - .5) * 12, -4 + (Math.random() - .5) * 16, false);
  menuTarget.set(0, 0, 0);
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  firing = false;
  showScreen(ui.pauseMenu);
}
function resume() {
  state.mode = 'playing';
  showScreen(null);
}

let activeScreen = ui.menu;
function showScreen(el) {
  for (const s of [ui.menu, ui.pauseMenu, ui.settings, ui.perks, ui.over]) s.classList.toggle('hidden', s !== el);
  activeScreen = el;
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
  for (const z of zombies) if (!z.userData.dead) plot(z.position.x, z.position.z, z.userData.kind === 'boss' ? 11 : z.userData.kind === 'brute' ? 8 : 6, z.userData.kind === 'boss' ? '#d35bff' : '#ff4a3a');
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
  setText(ui.waveNum, 'WAVE ' + Math.max(1, state.wave));
  const left = state.waveTotal - state.waveDone;
  setText(ui.alive, state.wave === 0 ? 'GET READY' : state.between ? 'SECTOR SECURE' : left + ' INFECTED LEFT');
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
    if (u.dead || u.rise > .3) continue;
    tmp.set(z.position.x, z.position.y + 1.3 * u.T.scale, z.position.z).sub(camera.position);
    const d = tmp.length();
    if (d > 40) continue;
    tmp.divideScalar(d);
    const ang = Math.acos(Math.min(1, fwd.dot(tmp)));
    const allow = .06 + Math.atan(.45 * u.T.scale * u.T.bulk / d);
    const s = ang / allow;
    if (s < bestScore) { bestScore = s; best = { z, dir: tmp.clone(), score: s }; }
  }
  return best;
}

function updatePlayer(dt) {
  const w = WEAPONS[player.weapon];
  let mx = move.x + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), my = move.y + (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const mag = Math.min(1, Math.hypot(mx, my));
  const sprint = (move.sprint || keys.shift) && my > .5 && player.reloading <= 0;
  if (mag > .05) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    const speed = (sprint ? 6.2 : 3.6) * stats.speed * mag * dt;
    const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw);
    const fx = -sy * my + cy * mx, fz = -cy * my - sy * mx;
    const nx = camera.position.x + fx * speed, nz = camera.position.z + fz * speed;
    if (!blocked(nx, camera.position.z, .36)) camera.position.x = nx;
    if (!blocked(camera.position.x, nz, .36)) camera.position.z = nz;
    look.bob += dt * (sprint ? 13 : 9) * mag;
    if (!state.moved) { state.moved = true; if (!tutorialDone) hint('Drag the right side to aim · hold FIRE to shoot (you can aim while holding it)'); }
  }
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
    if (d < 3.5) { p.position.x += dx / d * dt * 6; p.position.z += dz / d * dt * 6; }
    if (d < 1.1) { collect(p); scene.remove(p); pickups.splice(k, 1); }
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

function updateZombies(dt, playing, target = menuTarget) {
  if (target === menuTarget && Math.hypot(zombies[0]?.position.x - menuTarget.x, zombies[0]?.position.z - menuTarget.z) < 3) menuTarget.set((Math.random() - .5) * 10, 0, -6 + (Math.random() - .5) * 20);
  let nearestGroan = null, ng = 14;
  for (let k = zombies.length - 1; k >= 0; k--) {
    const z = zombies[k], u = z.userData, T = u.T;
    if (animateZombie(z, dt)) { scene.remove(z); zombies.splice(k, 1); continue; }
    if (u.dead) continue;
    if (u.rise > 0) {
      u.rise = Math.max(0, u.rise - dt * .9);
      z.position.y = -1.9 * T.scale * u.rise * u.rise;
      if (Math.random() < .5) gore.emit(z.position.x, .05, z.position.z, 2, { speed: 2, spread: 2, life: .6, colors: [0x3a3226, 0x2a241c] });
      z.rotation.y = Math.atan2(target.x - z.position.x, target.z - z.position.z);
      continue;
    }
    const dx = target.x - z.position.x, dz = target.z - z.position.z, d = Math.hypot(dx, dz);
    const reach = .75 + T.scale * .45;
    let vx = 0, vz = 0;
    u.moving = d > reach;
    if (u.moving) {
      let ax = dx / d, az = dz / d;
      const step = u.speed * (playing ? 1 : .6) * dt;
      const r = u.radius;
      if (blocked(z.position.x + ax * step * 4, z.position.z + az * step * 4, r)) {
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
    vx += u.kx * dt * 6; vz += u.kz * dt * 6;
    u.kx *= Math.max(0, 1 - dt * 7); u.kz *= Math.max(0, 1 - dt * 7);
    if (!blocked(z.position.x + vx, z.position.z, u.radius * .8)) z.position.x += vx;
    if (!blocked(z.position.x, z.position.z + vz, u.radius * .8)) z.position.z += vz;
    const face = Math.atan2(dx, dz);
    let df = face - z.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
    z.rotation.y += df * Math.min(1, dt * 8);
    if (playing) {
      if (u.swing > 0) {
        const before = u.swing; u.swing -= dt;
        if (before > .18 && u.swing <= .18 && d < reach + .5) hurtPlayer(T.dmg * (1 + (state.wave - 1) * .05), z.position);
      } else if (!u.moving && state.clock > u.nextAttack) {
        u.swing = .45; u.nextAttack = state.clock + (u.kind === 'runner' ? .7 : 1.05);
      }
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
  if (g.userData.pump) {
    player.pumpT = Math.max(0, player.pumpT - dt);
    const pt = player.pumpT > 0 && player.pumpT < .4 ? Math.sin((.4 - player.pumpT) / .4 * Math.PI) : 0;
    g.userData.pump.position.z = -.45 + pt * .1;
  }
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
    blast.scale.setScalar(.3 + t * 4.2); blast.material.opacity = Math.max(0, 1 - t);
    if (t >= 1) blast.visible = false;
  }
  blastLight.intensity = Math.max(0, blastLight.intensity - dt * 220);
  const now = performance.now() / 1000;
  for (const f of fires) {
    f.light.intensity = 18 + Math.sin(now * 9 + f.seed) * 3 + Math.sin(now * 23 + f.seed) * 2;
    f.flames.forEach((s, i) => { const k = .55 + Math.sin(now * (10 + i * 3) + f.seed + i) * .12; s.scale.set(k * (1 - i * .2), k * 1.4 * (1 - i * .15), 1); });
  }
}

function update(dt) {
  state.clock += dt;
  for (let k = scheduled.length - 1; k >= 0; k--) if (state.clock >= scheduled[k].at) { const s = scheduled.splice(k, 1)[0]; s.fn(); }
  spawnTick(dt);
  updatePlayer(dt);
  updateZombies(dt, true, camera.position);
  if (!state.between && !state.queue?.length && zombies.every(z => z.userData.dead) && state.waveTotal > 0 && state.mode === 'playing') waveCleared();
  if (!tutorialDone && state.moved && state.looked && state.clock > 4) { tutorialDone = true; store.set('tutorial', true); hint(''); }
  updateView(dt);
  updateHud(dt);
}

function updateMenu(dt) {
  state.clock += dt;
  menuAngle += dt * .07;
  camera.position.set(Math.sin(menuAngle) * 13, 3.2, 4 + Math.cos(menuAngle) * 13);
  camera.lookAt(0, 1.4, -2);
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
tapButton(ui.swap, () => selectWeapon((player.weapon + 1) % player.unlocked));
tapButton(ui.pause, pause);

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (state.mode === 'playing') {
    if (k === 'r') reload();
    if (k === 'g') throwGrenade();
    if (k === 'q' || k === '1' || k === '2') selectWeapon(k === '1' ? 0 : k === '2' ? 1 : (player.weapon + 1) % player.unlocked);
    if (e.code === 'Space') firing = true;
  }
  if (k === 'escape' || k === 'p') state.mode === 'playing' ? pause() : state.mode === 'paused' && resume();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.code === 'Space') firing = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

$('#start').onclick = startGame;
$('#again').onclick = startGame;
$('#to-menu').onclick = toMenu;
$('#resume').onclick = resume;
$('#quit').onclick = toMenu;

let settingsReturn = null;
document.querySelectorAll('[data-open="settings"]').forEach(b => (b.onclick = () => { settingsReturn = activeScreen; syncSettingsUI(); showScreen(ui.settings); }));
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
}

resetRun();
resize();
refreshRecords();
populateMenu();
syncSettingsUI();
frame();

