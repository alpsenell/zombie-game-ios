import * as THREE from './vendor/three.module.js';

const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function bufGeo(pos, nor, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function merged(geos) {
  const pos = [], nor = [], uv = [];
  for (const g of geos) {
    const n = g.toNonIndexed();
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); uv.push(...n.attributes.uv.array);
    n.dispose(); g.dispose();
  }
  return bufGeo(pos, nor, uv);
}

function flat(rects, uv) {
  const pos = [], nor = [], uvs = [];
  for (const [x0, z0, x1, z1, y = 0] of rects) for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) { pos.push(x, y, z); nor.push(0, 1, 0); uvs.push(...uv(x, z)); }
  return bufGeo(pos, nor, uvs);
}

function hazardStripe(c, B, y = .015, tint = 0x9a9a9a) {
  const tex = c.canvas(64, 64, cx => {
    cx.fillStyle = '#16140f'; cx.fillRect(0, 0, 64, 64);
    cx.fillStyle = '#d6a22a'; cx.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 260; i++) { cx.fillStyle = `rgba(${Math.random() < .5 ? '10,9,6' : '120,110,90'},${Math.random() * .35})`; const s = Math.random() * 3; cx.fillRect(Math.random() * 64, Math.random() * 64, s, s * 3); }
  }, [1, 1]);
  const i = .45, o = .3, { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } = B;
  const g = flat([[x0 - o, z0 - o, x1 + o, z0 + i, y], [x0 - o, z1 - i, x1 + o, z1 + o, y], [x0 - o, z0 + i, x0 + i, z1 - i, y], [x1 - i, z0 + i, x1 + o, z1 - i, y]], (x, z) => [(x + z) / 1.3, (x - z) / 1.3]);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: .85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  return c.add(m);
}

function chainFence(c, segs, h = 2.8) {
  const tex = c.canvas(64, 64, cx => {
    cx.strokeStyle = '#c8ccc8'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(64, 64); cx.moveTo(64, 0); cx.lineTo(0, 64); cx.stroke();
  }, [1, 1]);
  const pos = [], nor = [], uv = [];
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0), nx = (z1 - z0) / len, nz = -(x1 - x0) / len, u = len / 1.2, v = h / 1.2;
    for (const [x, y, z, a, b] of [[x0, 0, z0, 0, 0], [x1, 0, z1, u, 0], [x1, h, z1, u, v], [x0, 0, z0, 0, 0], [x1, h, z1, u, v], [x0, h, z0, 0, v]]) { pos.push(x, y, z); nor.push(nx, 0, nz); uv.push(a, b); }
  }
  c.add(new THREE.Mesh(bufGeo(pos, nor, uv), new THREE.MeshStandardMaterial({ map: tex, alphaTest: .4, side: THREE.DoubleSide, metalness: .6, roughness: .5, color: 0x9aa0a0 })));
  const post = c.mat(0x3a3e40, { metalness: .6, roughness: .5 }), wire = c.mat(0x7a7e80, { metalness: .8, roughness: .4 });
  c.coilGeo ||= new THREE.TorusGeometry(.3, .025, 3, 8);
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k <= n; k++) c.mesh(box(.12, h + .3, .12), post, x0 + (x1 - x0) * k / n, (h + .3) / 2, z0 + (z1 - z0) * k / n);
    c.mesh(box(.07, .07, len), post, (x0 + x1) / 2, h, (z0 + z1) / 2).rotation.y = ry;
    for (let k = 0; k < len / .8; k++) {
      const t = k * .8 / len, r = c.mesh(c.coilGeo, wire, x0 + (x1 - x0) * t, h + .5, z0 + (z1 - z0) * t);
      r.rotation.y = ry; r.castShadow = false;
    }
  }
}

function barrel(c, x, z) {
  const g = new THREE.Group();
  const drum = c.mesh(new THREE.CylinderGeometry(.34, .32, .9, 14, 1, true), c.mat(0x3b2a1e, { metalness: .6, roughness: .6, side: THREE.DoubleSide }), 0, .45, 0, g);
  for (const y of [.2, .7]) c.mesh(new THREE.TorusGeometry(.345, .025, 5, 16), c.mat(0x2a1a10, { metalness: .7 }), 0, y, 0, g).rotation.x = PI / 2;
  const coals = new THREE.Mesh(new THREE.CircleGeometry(.3, 14), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  coals.rotation.x = -PI / 2; coals.position.y = .84; g.add(coals);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.glowTex, color: i ? 0xff7a26 : 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set((Math.random() - .5) * .2, 1.1 + i * .15, (Math.random() - .5) * .2);
    g.add(f); flames.push(f);
  }
  g.position.set(x, 0, z); c.add(g); c.solid(drum);
  c.block(x, z, .9, .9);
  const light = new THREE.PointLight(0xff7026, 22, 14, 2);
  light.position.set(x, 1.8, z); c.add(light);
  c.animate({ light, flames, seed: Math.random() * 10 });
}

function blaze(c, x, y, z, s = 1.8) {
  const g = new THREE.Group(), flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.glowTex, color: i ? 0xff6a1a : 0xffc860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set((Math.random() - .5) * .5, i * .35 * s, (Math.random() - .5) * .5);
    g.add(f); flames.push(f);
  }
  g.position.set(x, y, z); c.add(g);
  const light = new THREE.PointLight(0xff6a22, 26, 16, 2);
  light.position.set(x, y + 1, z); c.add(light);
  c.animate({ light, flames, seed: Math.random() * 10, s });
}

function blockLine(c, x0, z0, x1, z1, w) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (w * .7)));
  for (let k = 0; k <= n; k++) c.block(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, w, w);
}

function fitBlock(c, x, z, rot, w, d, pad = .5) {
  const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  c.block(x, z, cs * w + sn * d + pad, sn * w + cs * d + pad);
}

const carColors = [0x6b1f1c, 0x2d4a5c, 0x3c3f41, 0x7a6a3a, 0x1f3a2b];
function car(c, x, z, rot, color, o = {}) {
  const g = new THREE.Group();
  const paint = c.mat(color, { roughness: o.burnt ? .95 : .45, metalness: o.burnt ? .2 : .55 });
  c.mesh(box(2.1, .6, 4.3), paint, 0, .62, 0, g);
  c.mesh(box(1.9, .55, 2.1), paint, 0, 1.18, -.2, g);
  c.mesh(box(1.94, .44, 2.14), c.mat(0x0c1418, { roughness: .1, metalness: .9 }), 0, 1.2, -.2, g);
  c.mesh(box(2.14, .2, .2), c.mat(0x1a1d1f), 0, .45, 2.15, g);
  c.mesh(box(2.14, .2, .2), c.mat(0x1a1d1f), 0, .45, -2.15, g);
  for (const sx of [-.7, .7]) {
    c.mesh(box(.4, .14, .05), c.mat(0x331b0a, { emissive: 0xffc27a, emissiveIntensity: !o.burnt && Math.random() > .5 ? .8 : 0 }), sx, .72, 2.16, g);
    c.mesh(box(.4, .14, .05), c.mat(0x330808, { emissive: 0xff2a1a, emissiveIntensity: o.burnt ? 0 : .6 }), sx, .72, -2.16, g);
  }
  for (const sx of [-.98, .98]) for (const sz of [-1.35, 1.35]) {
    const wh = c.mesh(new THREE.CylinderGeometry(.38, .38, .26, 14), c.mat(0x0a0c0d, { roughness: .9 }), sx, .38, sz, g);
    wh.rotation.z = PI / 2;
  }
  g.position.set(x, o.y || 0, z); g.rotation.set(o.pitch || 0, rot, (o.tilt || 0) + (o.roll || 0));
  c.add(g);
  c.solid(g);
  if (o.fit) fitBlock(c, x, z, rot, 2.2, 4.4);
  else if (o.block !== false) c.block(x, z, 2.9, 4.7);
  return g;
}

const sandMat = c => c.mat(0x6d624a, { roughness: 1, flatShading: true });
function sandbags(c, x, z, rot, len = 5, block = true) {
  c.bagGeo ||= c.lumpy(new THREE.CapsuleGeometry(.22, .5, 3, 6), .2);
  const g = new THREE.Group();
  for (let row = 0; row < 3; row++) for (let i = 0; i < len - row % 2; i++) {
    const b = c.mesh(c.bagGeo, sandMat(c), (i - (len - 1) / 2 + (row % 2) * .5) * .78, .2 + row * .34, 0, g);
    b.rotation.z = PI / 2; b.scale.set(1, 1, .75); b.rotation.y = (Math.random() - .5) * .2;
  }
  g.position.set(x, 0, z); g.rotation.y = rot;
  c.add(g); c.solid(g);
  const ww = Math.abs(Math.cos(rot)) * len * .8 + .7, dd = Math.abs(Math.sin(rot)) * len * .8 + .7;
  if (block) c.block(x, z, ww, dd);
}

function jersey(c, x, z, rot = 0, j = .3) {
  const concrete = c.mat(0x8b8f88, { roughness: .95 });
  const g = new THREE.Group();
  c.mesh(box(2.2, .35, .7), concrete, 0, .17, 0, g);
  c.mesh(box(2.2, .6, .32), concrete, 0, .63, 0, g);
  c.mesh(box(2.21, .18, .33), c.mat(0xc2402c), 0, .78, 0, g);
  g.position.set(x, 0, z); g.rotation.y = rot + (Math.random() - .5) * j;
  c.add(g); c.solid(g);
  return g;
}

function jerseyLine(c, x0, x1, z) {
  const n = Math.ceil((x1 - x0) / 2.2), sp = (x1 - x0) / n;
  for (let k = 0; k < n; k++) jersey(c, x0 + (k + .5) * sp, z, 0, .02);
}

function skyline(c, color, n = 26, r0 = 70) {
  const far = new THREE.MeshBasicMaterial({ color, fog: false });
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2 + Math.random() * .1, r = r0 + Math.random() * 10, h = 12 + Math.random() * 26, w = 6 + Math.random() * 8;
    const b = new THREE.Mesh(box(w, h, w), far);
    b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    b.lookAt(0, h / 2, 0);
    c.add(b);
  }
}

function signTexture(c, w, h, draw) {
  return c.canvas(w, h, cx => { cx.textBaseline = 'middle'; cx.textAlign = 'center'; draw(cx, w, h); });
}

function street(c, B) {
  const { mesh, mat } = c;
  const road = mesh(new THREE.PlaneGeometry(18, 96), new THREE.MeshStandardMaterial({ map: c.grit('#2f3c43', '#a8c0be', 4, 20), roughness: .9, metalness: .1 }), 0, 0, 0);
  road.rotation.x = -PI / 2; road.castShadow = false;
  const ground = mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: c.grit('#2b3136', '#899499', 16, 16), roughness: .98 }), 0, -.03, 0);
  ground.rotation.x = -PI / 2; ground.castShadow = false;
  for (const sx of [-1, 1]) {
    mesh(box(.4, .16, 96), mat(0x5b6468, { roughness: .9 }), sx * 9.1, .08, 0).castShadow = false;
    mesh(box(2.4, .14, 96), mat(0x3a4246, { roughness: .95 }), sx * 10.5, .07, 0).castShadow = false;
  }
  const lineMat = mat(0x9c8a5a, { roughness: .9 });
  for (let z = -44; z < 46; z += 6) mesh(box(.18, .02, 2.4), lineMat, 0, .012, z).castShadow = false;

  const windowGeo = box(.6, .9, .05);
  const winDark = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: .3, metalness: .6 });
  const winLit = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xff8a2a, emissiveIntensity: 1.3 });
  const winBlue = new THREE.MeshStandardMaterial({ color: 0x0a1822, emissive: 0x3aa0ff, emissiveIntensity: .7 });
  function building(x, z, w, d, h, col, out) {
    const b = mesh(box(w, h, d), mat(col, { roughness: .88 }), x, h / 2, z);
    if (!out) { c.solid(b); c.block(x, z, w + .5, d + .5); }
    mesh(box(w + .4, .35, d + .4), mat(0x121a1f), x, h + .17, z);
    const alongZ = !out || out[0], face = out ? out[0] || out[1] : x < 0 ? 1 : -1, L = alongZ ? d : w;
    for (let y = 2.2; y < h - 1; y += 2.6) {
      for (let t = -L * .36; t <= L * .37; t += L * .24) {
        const r = Math.random();
        const win = new THREE.Mesh(windowGeo, r > .82 ? winLit : r > .76 ? winBlue : winDark);
        if (alongZ) { win.rotation.y = PI / 2; win.position.set(x + face * (w / 2 + .03), y, z + t); }
        else win.position.set(x + t, y, z + face * (d / 2 + .03));
        c.add(win);
      }
    }
    if (!out) mesh(box(.06, 2.2, 1.4), mat(0x0b0f12), x + face * (w / 2 + .03), 1.1, z);
  }
  [[-15, -18, 9, 10, 16], [15, -17, 8, 11, 19], [-15, 3, 10, 9, 21], [15, 7, 9, 12, 17], [-16, 27, 8, 11, 20], [16, 28, 11, 10, 23], [-9, -36, 5, 8, 13], [10, -36, 6, 7, 15]]
    .forEach((v, i) => building(v[0], v[1], v[2], v[3], v[4], [0x252b31, 0x1b262d, 0x2d2628][i % 3]));
  const cols = [0x252b31, 0x1b262d, 0x2d2628];
  for (const s of [-1, 1]) {
    for (let z = -55, i = 0; z < 55; i++) { const d = rnd(9, 14), e = Math.min(55, z + d); building(s * 50, (z + e) / 2, 8, e - z, rnd(11, 24), cols[i % 3], [-s, 0]); z = e; }
    for (const sx of [-1, 1]) for (let x = 13, i = 0; x < 46; i++) { const w = rnd(8, 12), e = Math.min(46, x + w); building(sx * (x + e) / 2, s * 51, e - x, 8, rnd(10, 22), cols[(i + 1) % 3], [0, -s]); x = e; }
  }
  skyline(c, 0x060b10);

  car(c, -4, -10, .3, carColors[0]); car(c, 5, 8, -.25, carColors[1]); car(c, -5, 34, 2.8, carColors[2]); car(c, 6.5, -24, 1.4, carColors[3], { tilt: .05 });
  sandbags(c, -5, 18, 0); sandbags(c, 4.5, 25, .4, 4); sandbags(c, -2, -30, -.2, 4);
  const FX = B.maxX + .4, FZ = B.maxZ + .4;
  chainFence(c, [[-FX, -FZ, -11.8, -FZ], [11.8, -FZ, FX, -FZ], [-FX, FZ, -11.8, FZ], [11.8, FZ, FX, FZ], [FX, -FZ, FX, FZ], [-FX, -FZ, -FX, FZ]]);
  hazardStripe(c, B);
  for (const s of [-1, 1]) {
    jerseyLine(c, -11.8, 11.8, s * (FZ + .35));
    car(c, -6.5, s * 46.2, 1.45, carColors[2], { block: false, burnt: true });
    car(c, -1.5, s * 47, 1.75, carColors[0], { block: false });
    car(c, 3.8, s * 46.4, 1.3, carColors[4], { block: false, burnt: true, tilt: .08 });
    car(c, -3.8, s * 46.6, 1.6, carColors[1], { block: false, burnt: true, y: 1.55, roll: PI });
    car(c, 8.6, s * 47.4, .15, carColors[3], { block: false });
  }

  const crateMat = mat(0x5a4630, { roughness: .9 });
  for (const [x, z] of [[6, 25], [-6.2, 20.5], [5, -28]]) {
    const cr = mesh(box(1.2, 1.1, 1.2), crateMat, x, .55, z);
    cr.rotation.y = Math.random(); c.solid(cr);
    c.block(x, z, 1.6, 1.6);
  }

  const poleMat = mat(0x22292c, { metalness: .6, roughness: .5 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-8.6, -6], [8.6, 16], [-8.6, 40], [8.6, -32]]) {
    const s = Math.sign(x);
    mesh(new THREE.CylinderGeometry(.08, .12, 6, 8), poleMat, x, 3, z);
    mesh(box(1.6, .08, .08), poleMat, x - s * .8, 6, z);
    mesh(box(.5, .12, .3), mat(0x2a2a20, { emissive: 0xffd08a, emissiveIntensity: 2 }), x - s * 1.5, 5.93, z);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.8, 20, 1, true), beamMat);
    beam.position.set(x - s * 1.5, 3, z);
    c.add(beam);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ map: c.glowTex, color: 0xffc080, transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -PI / 2; pool.position.set(x - s * 1.5, .03, z);
    c.add(pool);
    c.block(x, z, .5, .5);
  }
  [[-6, -4], [6.5, 21], [-4, 30], [4, -17]].forEach(p => barrel(c, ...p));
}

function mall(c, B) {
  const { mesh, mat } = c;
  const tiles = c.canvas(256, 256, cx => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      cx.fillStyle = (i + j) % 2 ? '#7d7b72' : '#9a978c'; cx.fillRect(i * 32, j * 32, 32, 32);
      cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.strokeRect(i * 32 + .5, j * 32 + .5, 31, 31);
    }
    for (let i = 0; i < 900; i++) { cx.fillStyle = 'rgba(20,18,14,' + Math.random() * .18 + ')'; const s = Math.random() * 4; cx.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
    for (let i = 0; i < 6; i++) {
      const g = cx.createRadialGradient(0, 0, 0, 0, 0, 40);
      g.addColorStop(0, 'rgba(10,8,6,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.save(); cx.translate(Math.random() * 256, Math.random() * 256); cx.fillStyle = g; cx.fillRect(-40, -40, 80, 80); cx.restore();
    }
  }, [12, 20]);
  const floor = mesh(new THREE.PlaneGeometry(58, 96), new THREE.MeshStandardMaterial({ map: tiles, roughness: .42, metalness: .2 }), 0, 0, 0);
  floor.rotation.x = -PI / 2; floor.castShadow = false;

  const wall = mat(0x3a3f42, { roughness: .9 }), trim = mat(0xb9b4a8, { roughness: .8 }), metal = mat(0x8d969a, { metalness: .7, roughness: .35 });
  const glass = mat(0x0b1a20, { roughness: .08, metalness: .9 }), dark = mat(0x07090a, { roughness: 1 });
  const shutter = mat(0x5b6266, { metalness: .5, roughness: .6 });
  const signs = [0xff3a6a, 0x3af0ff, 0xffc34d, 0x7dff6a, 0xb06aff, 0xff7a2a];
  const tube = mat(0xdde8f0, { emissive: 0xe4f2ff, emissiveIntensity: 2.2 }), tubeOff = mat(0x6a7278, { roughness: .4 });
  const plank = mat(0x5a4630, { roughness: .9 });
  for (const s of [-1, 1]) {
    mesh(box(.6, 13, 82), wall, s * 29, 6.5, 0);
    for (const e of [-1, 1]) mesh(box(4.7, 13, 2.2), wall, s * 26.7, 6.5, e * 37.5);
    for (const [y0, fh] of [[0, 3.6], [5.45, 2.9]]) for (let k = 0; k < 8; k++) {
      const z = -31.5 + k * 9;
      mesh(box(3.6, fh + .4, 8.2), dark, s * 26.4, y0 + fh / 2, z).castShadow = false;
      mesh(box(.12, fh, 7.4), glass, s * 24.35, y0 + fh / 2, z);
      mesh(box(.2, .14, 7.6), metal, s * 24.3, y0 + .07, z);
      mesh(box(.2, .14, 7.6), metal, s * 24.3, y0 + fh, z);
      const lit = Math.random() > .3;
      mesh(box(.3, .8, 6.2), lit ? mat(0x111111, { emissive: signs[(Math.random() * signs.length) | 0], emissiveIntensity: 1.6 }) : mat(0x1a1d20), s * 24.25, y0 + fh + .75, z);
      if (!y0 || Math.random() < .4) {
        const h = y0 ? rnd(.8, fh - .4) : k % 3 === 1 ? fh * .55 : fh;
        mesh(box(.16, h, 7.4), shutter, s * 24.2, y0 + fh - h / 2, z);
        for (let r = .25; r < h; r += .35) mesh(box(.18, .04, 7.4), mat(0x3e4447), s * 24.2, y0 + fh - r, z);
        if (h < fh) for (const [dz, a] of [[-1.8, .35], [1.6, -.3], [-.2, .08]]) mesh(box(.06, .24, 3.4), plank, s * 24.1, rnd(.5, 1.2), z + dz).rotation.x = a;
      }
    }
    for (let k = 0; k <= 8; k++) mesh(box(.9, 11, .9), trim, s * 24.4, 5.5, -36 + k * 9);
    mesh(box(3.6, .45, 82), trim, s * 22.6, 5.2, 0);
    mesh(box(.25, .8, 82), trim, s * 20.8, 5.25, 0);
    for (let z = -40; z <= 40; z += 2.5) mesh(box(.07, 1, .07), metal, s * 20.9, 6.1, z);
    mesh(box(.1, .08, 82), metal, s * 20.9, 6.62, 0);
    mesh(box(.6, 2.2, 82), mat(0x2a2e30), s * 24.5, 11.9, 0);
    for (let z = -27; z <= 27; z += 9) {
      mesh(new THREE.CylinderGeometry(.34, .34, 5, 12), trim, s * 21.2, 2.5, z);
      c.block(s * 21.2, z, .9, .9);
    }
    for (let z = -34; z <= 34; z += 4.5) mesh(box(.28, .06, 2.4), Math.random() > .25 ? tube : tubeOff, s * 22.4, 4.95, z).castShadow = false;
  }
  for (const e of [-1, 1]) {
    mesh(box(58, 13, .6), wall, 0, 6.5, e * 38.8);
    mesh(box(58, 2.2, .7), mat(0x2a2e30), 0, 11.9, e * 38.6);
  }
  mesh(box(16, 5, .15), glass, 0, 2.5, -38.4);
  for (const [e, w] of [[-1, 8], [1, 6]]) {
    for (let x = -w + 1.6; x < w - 1; x += 3.1) for (const y of [.6, 1.3, 2.1, 3.4]) mesh(box(3.3, .28, .07), plank, x + rnd(-.15, .15), y + rnd(-.08, .08), e * 38.3).rotation.z = rnd(-.08, .08);
    for (let x = -w + 2.5; x < w - 2; x += 4) mesh(box(3.6, .3, .07), plank, x, 1.8, e * 38.22).rotation.z = (x > 0 ? 1 : -1) * .7;
  }
  hazardStripe(c, B, .01, 0x8a8a8a);
  for (let x = -8; x <= 8; x += 4) mesh(box(.2, 5, .3), metal, x, 2.5, -38.35);
  mesh(box(16.4, .4, .4), metal, 0, 5.1, -38.35);
  const mega = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: signTexture(c, 512, 96, (cx, w, h) => {
    cx.fillStyle = '#0a0406'; cx.fillRect(0, 0, w, h);
    cx.font = '900 70px Impact, sans-serif'; cx.shadowColor = '#ff2a4a'; cx.shadowBlur = 18;
    cx.fillStyle = '#ff5a7a'; cx.fillText('M E G A M A R T', w / 2, h / 2 + 4);
    cx.fillStyle = '#0a0406'; cx.fillRect(w * .62, 0, 26, h);
  }) }));
  mega.position.set(0, 7.4, -38.35); c.add(mega);
  mesh(box(12, 4.6, .15), glass, 0, 2.3, 38.4);
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ map: signTexture(c, 192, 64, (cx, w, h) => {
    cx.fillStyle = '#021a0a'; cx.fillRect(0, 0, w, h);
    cx.font = '900 46px Impact, sans-serif'; cx.fillStyle = '#5aff8a'; cx.shadowColor = '#2aff6a'; cx.shadowBlur = 12; cx.fillText('EXIT', w / 2, h / 2 + 2);
  }) }));
  exit.position.set(0, 5.6, 38.35); exit.rotation.y = PI; c.add(exit);

  const beam = mat(0x23282b, { metalness: .6, roughness: .5 });
  for (const x of [-16, -8, 0, 8, 16]) mesh(box(.45, .55, 80), beam, x, 12.7, 0);
  for (let z = -36; z <= 36; z += 8) mesh(box(50, .45, .35), beam, 0, 12.6, z);
  const fallen = mesh(box(.45, .55, 9), beam, 13, .3, -31);
  fallen.rotation.y = .7; fallen.rotation.z = .2; c.solid(fallen);
  blockLine(c, 13 - Math.sin(.7) * 4.3, -31 - Math.cos(.7) * 4.3, 13 + Math.sin(.7) * 4.3, -31 + Math.cos(.7) * 4.3, 1);
  for (const x of [-6, 6]) for (let z = -30; z <= 30; z += 10) {
    const broken = Math.random() < .25;
    const f = mesh(box(.3, .1, 3), broken ? tubeOff : tube, x, broken ? 7.2 : 8, z);
    if (broken) f.rotation.x = .7;
    f.castShadow = false;
    mesh(box(.03, 4.6, .03), metal, x, 10.3, z - 1.2).castShadow = false;
    if (!broken) mesh(box(.03, 4.6, .03), metal, x, 10.3, z + 1.2).castShadow = false;
  }

  const stone = mat(0x9c9588, { roughness: .85 });
  const water = mat(0x1d4a52, { roughness: .06, metalness: .5, emissive: 0x0c3a44, emissiveIntensity: .6 });
  const fountain = new THREE.Group();
  mesh(new THREE.CylinderGeometry(3.3, 3.5, .7, 28), stone, 0, .35, 0, fountain);
  mesh(new THREE.CylinderGeometry(3, 3, .1, 28), water, 0, .6, 0, fountain);
  mesh(new THREE.CylinderGeometry(.45, .65, 2.4, 12), stone, 0, 1.6, 0, fountain);
  mesh(new THREE.CylinderGeometry(1.5, .5, .5, 18), stone, 0, 2.7, 0, fountain);
  mesh(new THREE.CylinderGeometry(1.35, 1.35, .06, 18), water, 0, 2.93, 0, fountain);
  mesh(new THREE.CylinderGeometry(.18, .3, 1, 10), stone, 0, 3.3, 0, fountain);
  mesh(new THREE.SphereGeometry(.3, 12, 8), stone, 0, 3.9, 0, fountain);
  c.add(fountain); c.solid(fountain); c.block(0, 0, 7.2, 7.2);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), new THREE.MeshBasicMaterial({ map: c.glowTex, color: 0x3ad8ff, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -PI / 2; glow.position.y = .67; c.add(glow);

  const rubber = mat(0x15181a, { roughness: .7 }), step = mat(0x4d5358, { metalness: .6, roughness: .4 });
  const panel = mat(0x9aa3a6, { metalness: .6, roughness: .35 });
  function escalator(x0, z0, x1, z1) {
    const L = Math.hypot(x1 - x0, z1 - z0), H = 5.2, rot = Math.atan2(x1 - x0, z1 - z0);
    const g = new THREE.Group();
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, H); sh.lineTo(0, 0);
    const wedge = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false });
    wedge.rotateY(-PI / 2); wedge.translate(1.2, 0, -L / 2);
    mesh(wedge, mat(0x6f7478, { metalness: .5, roughness: .5 }), 0, 0, 0, g);
    const hyp = Math.hypot(L, H), ang = Math.atan2(H, L);
    for (let k = 0; k < 14; k++) {
      const t = (k + .5) / 14;
      const st = mesh(box(1.9, .12, hyp / 14 * .8), step, 0, t * H + .08, -L / 2 + t * L, g);
      st.rotation.x = -ang;
    }
    for (const sx of [-1.1, 1.1]) {
      const p = mesh(box(.12, .8, hyp), panel, sx, H / 2 + .45, 0, g); p.rotation.x = -ang;
      const r = mesh(box(.16, .1, hyp + .4), rubber, sx, H / 2 + .9, 0, g); r.rotation.x = -ang;
    }
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = rot;
    c.add(g); c.solid(g);
    fitBlock(c, (x0 + x1) / 2, (z0 + z1) / 2, rot, 2.4, L, .6);
  }
  escalator(-9, -11.6, -9, -22.4);
  escalator(9, 13.5, 20.6, 13.5);
  for (const z of [-24]) {
    mesh(box(42, .5, 3.2), trim, 0, 5.2, z);
    mesh(box(42, .7, .15), mat(0x2a2e30), 0, 5.2, z - 1.6);
    mesh(box(42, .7, .15), mat(0x2a2e30), 0, 5.2, z + 1.6);
    for (const e of [-1, 1]) {
      for (let x = -20; x <= 20; x += 2) mesh(box(.06, .9, .06), metal, x, 5.9, z + e * 1.5);
      mesh(box(42, .07, .1), metal, 0, 6.4, z + e * 1.5);
    }
    mesh(box(1, 5, 1), trim, 0, 2.5, z);
    c.block(0, z, 1.4, 1.4);
    for (let x = -16; x <= 16; x += 8) mesh(box(2.4, .06, .28), tube, x, 4.93, z).castShadow = false;
  }

  function planter(x, z, dead) {
    const g = new THREE.Group();
    mesh(box(2.4, .8, 2.4), mat(0x6a6358, { roughness: .9 }), 0, .4, 0, g);
    mesh(box(2.1, .1, 2.1), mat(0x2a1e14, { roughness: 1 }), 0, .79, 0, g);
    mesh(new THREE.CylinderGeometry(.1, .16, 2.4, 7), mat(0x3a2a1c), 0, 1.9, 0, g);
    const leaves = c.lumpy(new THREE.IcosahedronGeometry(1.15, 1), .35);
    const top = mesh(leaves, mat(dead ? 0x5a4a2a : 0x2f4a2a, { flatShading: true, roughness: .9 }), 0, 3.3, 0, g);
    top.scale.set(1, .8, 1);
    g.position.set(x, 0, z); c.add(g); c.solid(g);
    c.block(x, z, 2.6, 2.6);
  }
  planter(-5, 12); planter(5, -12, true); planter(-15, 0); planter(15, 0, true); planter(15, 31); planter(-15, -31, true);

  function kiosk(x, z, col) {
    const g = new THREE.Group();
    mesh(box(3, 1.1, 2), mat(col, { roughness: .6 }), 0, .55, 0, g);
    mesh(box(3.2, .1, 2.2), trim, 0, 1.15, 0, g);
    for (const sx of [-1.4, 1.4]) mesh(box(.1, 1.3, .1), metal, sx, 1.8, 0, g);
    mesh(box(3.4, .12, 2.4), mat(col, { roughness: .6 }), 0, 2.5, 0, g);
    mesh(box(2.6, .5, .06), mat(0x111111, { emissive: 0xffc34d, emissiveIntensity: 1.2 }), 0, 2.2, 1.01, g);
    g.position.set(x, 0, z); g.rotation.y = x > 0 ? PI : 0;
    c.add(g); c.solid(g); c.block(x, z, 3.4, 2.4);
  }
  kiosk(-13, 20, 0x8a2a2a); kiosk(13, -20, 0x2a5a7a);

  for (const [x, z] of [[-18, -9], [18, -9], [-18, 9], [18, 4]]) {
    const b = mesh(box(.7, .45, 2.4), mat(0x5a3a22, { roughness: .8 }), x, .45, z);
    mesh(box(.12, .45, 2.2), metal, x, .22, z);
    c.solid(b); c.block(x, z, 1, 2.8);
  }
  const vend = new THREE.Group();
  mesh(box(1.1, 2, .9), mat(0xa01c1c, { roughness: .5 }), 0, 0, 0, vend);
  mesh(box(.8, 1.2, .05), mat(0x221010, { emissive: 0xff5a4a, emissiveIntensity: .4 }), -.1, .2, .46, vend);
  vend.position.set(8, .45, 29); vend.rotation.set(-PI / 2, .4, 0);
  c.add(vend); c.solid(vend); c.block(8, 29, 2.3, 2.3);
  const cart = mat(0x9aa2a6, { metalness: .8, roughness: .3 });
  for (const [x, z, r] of [[-7, -30, .5], [10, 4, 2.2], [-19, 24, 1]]) {
    const g = new THREE.Group();
    mesh(box(.7, .5, 1.1), cart, 0, .75, 0, g);
    mesh(box(.6, .04, 1), cart, 0, .3, 0, g);
    for (const sx of [-.3, .3]) for (const sz of [-.45, .45]) mesh(new THREE.CylinderGeometry(.06, .06, .05, 8), rubber, sx, .06, sz, g).rotation.z = PI / 2;
    g.position.set(x, 0, z); g.rotation.y = r; c.add(g); c.solid(g);
    c.block(x, z, 1.3, 1.3);
  }
  const boxMat = mat(0x8a6a44, { roughness: .95 });
  for (const [x, z, s] of [[-20, 30, 1], [-19, 31.5, .8], [-20.5, 31, .6], [20, -30, .9], [19.2, -31.4, .7]]) {
    const b = mesh(box(s, s * .8, s), boxMat, x, s * .4, z);
    b.rotation.y = Math.random(); c.solid(b);
  }
  c.block(-19.8, 30.8, 2.6, 2.6); c.block(19.6, -30.7, 2.2, 2.4);

  const lights = [[0, 7, -18], [0, 7, 6], [0, 7, 28]];
  lights.forEach(([x, y, z], i) => {
    const light = new THREE.PointLight(0xd8ecff, 18, 28, 1.6);
    light.position.set(x, y, z); c.add(light);
    const seed = Math.random() * 100, bad = i === 1;
    c.animate({ light, tick(t) { const n = Math.sin(t * 41 + seed) * Math.sin(t * 7.3 + seed); light.intensity = bad && n > .55 ? 3 : n > .96 ? 7 : 18; } });
  });
}

function overpass(c, B) {
  const { mesh, mat } = c;
  const E = B.maxZ + 2.5, F = E + 8, G = F + 16;
  const road = mesh(flat([[-23, -E, 23, E], [-23, F, 23, G], [-23, -G, 23, -F]], (x, z) => [x / 46 + .5, z / 100 + .5]), new THREE.MeshStandardMaterial({ map: c.grit('#34363a', '#b0a898', 5, 22), roughness: .92, metalness: .05 }), 0, 0, 0);
  road.castShadow = false;
  const dirt = mesh(flat([[-75, -E, 75, E, -.03], [-75, F, 75, 75, -.03], [-75, -75, 75, -F, -.03]], (x, z) => [x / 150 + .5, z / 150 + .5]), new THREE.MeshStandardMaterial({ map: c.grit('#2e2622', '#8a6a58', 18, 18), roughness: 1 }), 0, 0, 0);
  dirt.castShadow = false;
  const white = mat(0xb8b2a2, { roughness: .9 }), yellow = mat(0xc9a038, { roughness: .9 });
  for (const x of [-14.6, -7.3, 7.3, 14.6]) for (let z = -46; z < 46; z += 7) if (Math.abs(z) + 1.5 < E) mesh(box(.16, .02, 3), white, x, .012, z).castShadow = false;
  for (const x of [-21.4, -1.2, 1.2, 21.4]) mesh(box(.16, .02, 2 * E), yellow, x, .012, 0).castShadow = false;

  const concrete = mat(0x8a8478, { roughness: .95 }), darkC = mat(0x5e5a52, { roughness: 1 });
  const W = B.maxX + .9;
  for (const s of [-1, 1]) {
    mesh(box(1, 4.6, 2 * E), concrete, s * W, 2.3, 0);
    mesh(box(1.4, .35, 2 * E), darkC, s * W, 4.7, 0);
    for (let z = -44; z <= 44; z += 8) mesh(box(1.5, 4.8, .8), darkC, s * W, 2.4, z);
    for (let z = -40; z <= 40; z += 16) {
      const bent = Math.random() < .4;
      const p = mesh(new THREE.CylinderGeometry(.1, .14, 8, 8), mat(0x2a2c2e, { metalness: .6, roughness: .5 }), s * (W - .6), 4, z);
      if (bent) { p.rotation.z = s * .35; p.position.x -= s * 1.3; }
      else mesh(box(1.8, .12, .3), mat(0x2a2c2e, { metalness: .6 }), s * (W - 1.4), 8, z);
    }
    for (const e of [-1, 1]) mesh(box(1, 4.6, G - F), concrete, s * W, 2.3, e * (F + G) / 2);
  }
  const rail = mat(0x9aa0a2, { metalness: .6, roughness: .45 }), railPost = mat(0x2a2c2e, { metalness: .6, roughness: .5 });
  const rebar = mat(0x6a3a1e, { metalness: .5, roughness: .7 });
  const chunk = c.lumpy(new THREE.IcosahedronGeometry(1, 0), .3);
  const pit = mat(0x140c10, { roughness: 1 });
  mesh(box(150, .1, F - E + 2), pit, 0, -9, E + (F - E) / 2).castShadow = false;
  mesh(box(150, .1, F - E + 2), pit, 0, -9, -E - (F - E) / 2).castShadow = false;
  const outTex = signTexture(c, 512, 128, (cx, w, h) => {
    cx.fillStyle = '#e8762a'; cx.fillRect(0, 0, w, h);
    cx.fillStyle = '#141210';
    for (let x = -h; x < w; x += 48) { cx.beginPath(); cx.moveTo(x, h); cx.lineTo(x + 24, h); cx.lineTo(x + 24 + h, 0); cx.lineTo(x + h, 0); cx.fill(); }
    cx.fillRect(64, 14, w - 128, h - 28);
    cx.fillStyle = '#f2ead8'; cx.font = '900 64px Impact, sans-serif'; cx.fillText('BRIDGE OUT', w / 2, h / 2 + 3);
  });
  const outMat = new THREE.MeshStandardMaterial({ map: outTex, emissiveMap: outTex, emissive: 0xffffff, emissiveIntensity: .35, roughness: .7 });
  const signs = [];
  for (const e of [-1, 1]) {
    jerseyLine(c, -B.maxX - .4, B.maxX + .4, e * (B.maxZ + .75));
    for (const x of [-13, 0, 13]) {
      signs.push(new THREE.PlaneGeometry(4.4, 1.1).rotateY(e > 0 ? PI : 0).translate(x, 1.75, e * (B.maxZ + 1.25)));
      for (const dx of [-1.8, 1.8]) mesh(box(.12, 2.2, .12), railPost, x + dx, 1.1, e * (B.maxZ + 1.3));
    }
    mesh(box(2 * W, .34, .1), rail, 0, .72, e * (B.maxZ + 1.6));
    for (let x = -W + .6; x < W; x += 2.2) mesh(box(.14, .9, .14), railPost, x, .45, e * (B.maxZ + 1.7));
    for (const z of [E, F]) {
      mesh(box(150, 9, .8), darkC, 0, -4.5, e * (z + (z === E ? .4 : -.4)));
      mesh(box(2 * W + 1, .35, .9), concrete, 0, -.17, e * (z + (z === E ? .45 : -.45)));
      for (let i = 0; i < 16; i++) {
        const r = mesh(box(.05, .05, rnd(.8, 2)), rebar, rnd(-W, W), rnd(-.6, -.1), e * (z + (z === E ? .2 : -.2)));
        r.rotation.set(rnd(-.9, .9) + (z === E ? e : -e) * .6, rnd(-.4, .4), 0); r.castShadow = false;
      }
    }
    for (let i = 0; i < 5; i++) {
      const ch = mesh(chunk, darkC, rnd(-18, 18), -8.4, e * rnd(E + 1.5, F - 1.5)); ch.scale.setScalar(rnd(.6, 1.4)); ch.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    }
  }
  c.add(new THREE.Mesh(merged(signs), outMat));
  hazardStripe(c, B, .016, 0x7a7a7a);
  skyline(c, 0x1a0e1c, 30, 74);

  const deck = new THREE.Group();
  mesh(box(100, 1.2, 11), concrete, 0, 7.6, 0, deck);
  for (const z of [-4, -1.4, 1.4, 4]) mesh(box(100, .9, .5), darkC, 0, 6.6, z, deck);
  for (const z of [-5.4, 5.4]) mesh(box(100, 1, .4), concrete, 0, 8.7, z, deck);
  for (let x = -48; x <= 48; x += 3) mesh(box(.12, .9, .12), mat(0x2a2c2e, { metalness: .6 }), x, 9.6, 5.3, deck);
  const hang = mesh(box(6, .12, .12), mat(0x2a2c2e, { metalness: .6 }), 6, 7.4, 5.7, deck);
  hang.rotation.z = -.6;
  c.add(deck); c.solid(deck);
  for (const x of [-13, 0, 13]) {
    mesh(box(2.6, 1, 9), darkC, x, 6.5, 0);
    for (const z of [-2.8, 2.8]) {
      const col = mesh(new THREE.CylinderGeometry(.8, .9, 6.2, 14), concrete, x, 3.1, z);
      c.solid(col); c.block(x, z, 1.9, 1.9);
    }
  }

  const slab = mesh(box(6, .8, 17), concrete, -17, 2.5, -24);
  slab.rotation.x = Math.atan2(5, 16); slab.rotation.z = .06; c.solid(slab);
  const colB = mesh(new THREE.CylinderGeometry(.7, .8, 3.6, 12), concrete, -17, 1.8, -33.5);
  colB.rotation.z = .12; c.solid(colB);
  for (let i = 0; i < 9; i++) {
    const r = mesh(box(.05, .05, rnd(1, 2.2)), rebar, -19.6 + i * .6, rnd(4.4, 5.4), -33 + rnd(-.3, .3));
    r.rotation.set(rnd(-.8, .8), rnd(-.4, .4), 0);
    r.castShadow = false;
  }
  c.block(-17, -24.5, 6.4, 18); c.block(-17, -33.5, 2, 2);
  for (const [x, z, s] of [[-13.2, -16, .8], [-14.2, -14.5, .5], [-20.6, -15, .7], [-12.8, -30, .6], [8, 2, .4], [-5, -38, .6]]) {
    const ch = mesh(chunk, darkC, x, s * .5, z); ch.scale.setScalar(s); ch.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    c.solid(ch); c.block(x, z, s * 2.2, s * 2.2);
  }

  for (const [z0, z1] of [[12, 19], [24, 31], [-41, -29], [-23, -12]]) {
    for (let z = z0; z < z1 - .5; z += 2.3) jersey(c, 0, z + 1.1, PI / 2);
    c.block(0, (z0 + z1) / 2, 1.1, z1 - z0 + .4);
  }
  jersey(c, -6, -8, 1.1); c.block(-6, -8, 2.2, 2.2);

  car(c, 9, 17.6, .4, carColors[0], { block: false, burnt: true });
  car(c, 10.8, 21.8, 1.9, carColors[1], { block: false });
  car(c, 9.6, 19.4, 1.2, carColors[2], { block: false, y: 2.95, roll: PI, burnt: true });
  c.block(9.8, 19.7, 7, 8.4);
  blaze(c, 9.4, 3.2, 19.2);
  car(c, -9, 11, 2.6, 0x4a4f2a, { block: false });
  car(c, -11.2, 13.6, .9, 0x2a2622, { block: false, burnt: true, tilt: .15 });
  c.block(-10, 12.3, 6.4, 7);
  car(c, 4.5, -34, 2.9, carColors[3], { fit: true, burnt: true });
  blaze(c, 4.5, 1.2, -34, 1.4);
  car(c, -15.5, 33, -.6, carColors[4], { fit: true });
  car(c, 16, 36, .15, carColors[1], { fit: true });
  car(c, -8, -2, 1.7, carColors[0], { fit: true, tilt: .1 });

  const trailer = new THREE.Group();
  mesh(box(2.6, 3, 11), mat(0xc8c2b4, { roughness: .8 }), 0, 1.9, 0, trailer);
  for (let z = -5; z <= 5; z += 1.25) mesh(box(2.64, 2.8, .1), mat(0x8a857a), 0, 1.9, z, trailer);
  mesh(box(2.4, .4, 10.6), mat(0x1c1e20), 0, .45, 0, trailer);
  for (const sz of [-4.2, -3]) for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(.5, .5, .4, 14), mat(0x0a0c0d, { roughness: .9 }), sx, .5, sz, trailer).rotation.z = PI / 2;
  trailer.position.set(12, 0, -24); trailer.rotation.set(0, .5, .06);
  c.add(trailer); c.solid(trailer);
  blockLine(c, 12 + Math.sin(.5) * 5.4, -24 + Math.cos(.5) * 5.4, 12 - Math.sin(.5) * 5.4, -24 - Math.cos(.5) * 5.4, 3);
  const cab = new THREE.Group();
  mesh(box(2.5, 2.4, 3), mat(0x7a1c18, { roughness: .6, metalness: .3 }), 0, 1.7, 0, cab);
  mesh(box(2.3, 1, .1), mat(0x0c1418, { roughness: .1, metalness: .9 }), 0, 2.2, 1.52, cab);
  mesh(box(2.5, .8, 1.4), mat(0x5a1410), 0, .9, 2, cab);
  for (const sz of [-.8, 2]) for (const sx of [-1.15, 1.15]) mesh(new THREE.CylinderGeometry(.55, .55, .4, 14), mat(0x0a0c0d, { roughness: .9 }), sx, .55, sz, cab).rotation.z = PI / 2;
  cab.position.set(16.4, 0, -16.2); cab.rotation.y = -.25;
  c.add(cab); c.solid(cab); c.block(16.4, -16.2, 3.6, 5);
  blaze(c, 16.2, 3.4, -16.4, 2);

  const legMat = mat(0x5a5f62, { metalness: .6, roughness: .5 });
  for (const s of [-1, 1]) { mesh(box(.4, 7.4, .4), legMat, s * 21, 3.7, 17); c.block(s * 21, 17, .9, .9); }
  mesh(box(42.4, .4, .4), legMat, 0, 7.2, 17);
  mesh(box(42.4, .3, .3), legMat, 0, 5.3, 17);
  const signTex = signTexture(c, 1024, 160, (cx, w, h) => {
    cx.fillStyle = '#0e1210'; cx.fillRect(0, 0, w, h);
    for (const [x0, t1, t2] of [[8, 'QUARANTINE', 'EXIT 13 ↗'], [w / 2 + 8, 'I-95 NORTH', 'CLOSED — TURN BACK']]) {
      cx.fillStyle = '#1f5a36'; cx.fillRect(x0, 8, w / 2 - 16, h - 16);
      cx.strokeStyle = '#e8f0e0'; cx.lineWidth = 4; cx.strokeRect(x0 + 8, 16, w / 2 - 32, h - 32);
      cx.fillStyle = '#eef4ea'; cx.font = '900 54px Impact, sans-serif'; cx.fillText(t1, x0 + (w / 2 - 16) / 2, 60);
      cx.font = '800 32px Impact, sans-serif'; cx.fillText(t2, x0 + (w / 2 - 16) / 2, 116);
    }
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.4), new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: .55, roughness: .6 }));
  sign.position.set(-2, 6.25, 17.25); c.add(sign);
  const tire = new THREE.TorusGeometry(.36, .14, 6, 12);
  for (const [x, z] of [[3, 12], [-3.5, 22], [15, -6], [-18, 6]]) {
    const t = mesh(tire, mat(0x121416, { roughness: .9 }), x, .14, z); t.rotation.x = PI / 2;
  }
}

function base(c, B) {
  const { mesh, mat } = c;
  const ground = mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshStandardMaterial({ map: c.grit('#4a4a3a', '#aaa488', 20, 20), roughness: 1 }), 0, -.02, 0);
  ground.rotation.x = -PI / 2; ground.castShadow = false;
  const apron = mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshStandardMaterial({ map: c.grit('#4c4e4a', '#b8b8b0', 4, 2), roughness: .9 }), 0, 0, -12);
  apron.rotation.x = -PI / 2; apron.castShadow = false;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), new THREE.MeshStandardMaterial({ roughness: .9, map: c.canvas(256, 256, cx => {
    cx.fillStyle = '#34372f'; cx.fillRect(0, 0, 256, 256);
    cx.strokeStyle = '#d8b440'; cx.lineWidth = 14; cx.beginPath(); cx.arc(128, 128, 104, 0, 7); cx.stroke();
    cx.fillStyle = '#e8e4d0'; cx.fillRect(78, 64, 26, 128); cx.fillRect(152, 64, 26, 128); cx.fillRect(100, 116, 56, 24);
  }) }));
  pad.rotation.x = -PI / 2; pad.position.set(-15, .02, 22); pad.receiveShadow = true; c.add(pad);

  const F = B.maxX + .4;
  chainFence(c, [[-F, -F, F, -F], [F, -F, F, F], [F, F, -F, F], [-F, F, -F, -F]]);
  hazardStripe(c, B, .006);

  const corr = mat(0x76806c, { metalness: .35, roughness: .6, flatShading: true, side: THREE.DoubleSide });
  const shell = new THREE.CylinderGeometry(11, 11, 14, 20, 1, true, -PI / 2, PI);
  shell.rotateX(-PI / 2);
  const hangar = new THREE.Group();
  mesh(shell, corr, 0, 0, 0, hangar);
  for (let z = -7; z <= 7; z += 2.8) mesh(new THREE.TorusGeometry(11.06, .14, 4, 20, PI), mat(0x3a4036, { metalness: .5 }), 0, 0, z, hangar);
  for (const e of [-1, 1]) {
    const end = mesh(new THREE.CircleGeometry(11, 20, 0, PI), mat(0x4a5244, { roughness: .8, side: THREE.DoubleSide }), 0, 0, e * 7, hangar);
    end.rotation.y = e > 0 ? 0 : PI;
  }
  const door = mat(0x3c4636, { metalness: .4, roughness: .6 });
  mesh(box(6.4, 7, .3), door, -3.6, 3.5, 7.2, hangar);
  mesh(box(6.4, 7, .3), door, 4.2, 3.5, 7.35, hangar);
  mesh(box(1.4, 7, .2), mat(0x050706), .1, 3.5, 7.1, hangar);
  for (let k = 0; k < 16; k++) {
    const s = mesh(box(.6, .5, .05), mat(k % 2 ? 0xd8b440 : 0x121212), -9 + k * 1.2, .25, 7.5, hangar);
    s.castShadow = false;
  }
  mesh(box(3, .5, .1), mat(0x1a1a14, { emissive: 0xff3a2a, emissiveIntensity: 1.4 }), 0, 8.4, 7.4, hangar);
  for (let x = -8; x <= 8; x += 4) mesh(box(.9, .18, .3), mat(0x2a2a20, { emissive: 0xffd08a, emissiveIntensity: 2.4 }), x, 7.4, 7.4, hangar).castShadow = false;
  hangar.position.set(0, 0, -27); c.add(hangar); c.solid(hangar);
  c.block(0, -27, 22.6, 14.8);

  const wood = mat(0x4a3a28, { roughness: .9 }), steel = mat(0x33383a, { metalness: .6, roughness: .5 });
  function tower(x, z, out) {
    const g = new THREE.Group();
    for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) mesh(box(.25, 5, .25), steel, sx, 2.5, sz, g);
    for (const [rx, ry] of [[0, 0], [0, PI / 2]]) for (const e of [-1.2, 1.2]) {
      const b = mesh(box(.08, 3.4, .08), steel, ry ? e : 0, 2.4, ry ? 0 : e, g);
      b.rotation.set(ry ? .62 : 0, 0, ry ? 0 : .62);
    }
    mesh(box(3.2, .3, 3.2), wood, 0, 5, 0, g);
    for (let k = 0; k < 4; k++) {
      const w = mesh(box(3.2, 1, .1), wood, 0, 5.65, 1.55, g);
      w.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), k * PI / 2); w.rotation.y = k * PI / 2;
    }
    for (const sx of [-1.45, 1.45]) for (const sz of [-1.45, 1.45]) mesh(box(.1, 1.8, .1), steel, sx, 6.9, sz, g);
    const roof = mesh(new THREE.ConeGeometry(2.6, 1.1, 4), mat(0x2e3430, { flatShading: true }), 0, 8.3, 0, g);
    roof.rotation.y = PI / 4;
    g.position.set(x, 0, z); c.add(g);
    if (!out) { c.solid(g); c.block(x, z, 3.1, 3.1); }
  }
  for (const [x, z] of [[-28, 24], [28, 24], [-28, -12], [28, -12]]) tower(x, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tower(sx * (F + 2.4), sz * (F + 2.4), true);
    sandbags(c, sx * (F + 1), sz * (F - 5), PI / 2, 5, false);
    sandbags(c, sx * (F - 5), sz * (F + 1), 0, 5, false);
  }
  const beamGeo = new THREE.ConeGeometry(3.2, 34, 20, 1, true);
  beamGeo.translate(0, -17, 0); beamGeo.rotateX(-PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z, ph] of [[-28, -12, 0], [28, -12, 2.4]]) {
    const hx = x - Math.sign(x) * 1.2, hz = z + 1.2;
    const lamp = mesh(new THREE.CylinderGeometry(.35, .3, .6, 12), steel, hx, 6.3, hz);
    lamp.rotation.x = PI / 2;
    const light = new THREE.SpotLight(0xe8f0ff, 150, 60, .2, .45, 1.1);
    light.position.set(hx, 6.4, hz); c.add(light); c.add(light.target);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(light.position); c.add(beam);
    const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.glowTex, color: 0xdfeaff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lens.scale.setScalar(1.6); lens.position.copy(light.position); c.add(lens);
    const cx = x * .35, cz = 2;
    c.animate({ light, tick(t) {
      const a = t * .35 + ph;
      light.target.position.set(cx + Math.sin(a) * 16, 0, cz + Math.cos(a * .7) * 14);
      beam.lookAt(light.target.position);
    } });
  }

  const containerCols = [0x7a2e22, 0x3f5a34, 0x2a4a6a, 0x8a6a3a];
  function container(x, z, rot, col, y = 0) {
    const g = new THREE.Group(), body = mat(col, { roughness: .7, metalness: .3 }), rib = mat(new THREE.Color(col).multiplyScalar(.7).getHex(), { roughness: .7, metalness: .3 });
    mesh(box(2.4, 2.6, 6), body, 0, 1.3, 0, g);
    for (let k = -2.7; k <= 2.7; k += .45) for (const sx of [-1.23, 1.23]) mesh(box(.06, 2.4, .14), rib, sx, 1.3, k, g).castShadow = false;
    for (const sx of [-.6, .6]) mesh(box(1.1, 2.4, .06), rib, sx, 1.3, 3.02, g);
    for (const sx of [-.3, .3]) mesh(box(.05, 2.2, .05), steel, sx * 2, 1.3, 3.08, g);
    g.position.set(x, y, z); g.rotation.y = rot; c.add(g); c.solid(g);
    if (!y) fitBlock(c, x, z, rot, 2.4, 6, .4);
  }
  container(-21.3, 2, 0, containerCols[0]); container(-18.9, 2, 0, containerCols[1]); container(-20.1, 2.2, 0, containerCols[2], 2.6);
  container(18, -3.2, PI / 2, containerCols[3]); container(18, -.8, PI / 2, containerCols[0]); container(18.2, -2, PI / 2, containerCols[1], 2.6);
  container(-6, 18, PI / 2, containerCols[2]);
  container(22, 12, .02, containerCols[1]);

  function ring(cx, cz, r, gap, n) {
    for (let k = 0; k < n; k++) {
      const a = k / n * PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < PI / n * 1.2) continue;
      sandbags(c, cx + Math.sin(a) * r, cz + Math.cos(a) * r, a + PI / 2, 3);
    }
  }
  ring(0, 2, 3.6, 0, 9);
  ring(-12, -6, 2.8, PI / 2, 7);
  ring(12, 10, 2.8, -PI / 2, 7);
  const mg = new THREE.Group();
  for (let k = 0; k < 3; k++) { const l = mesh(box(.05, 1, .05), steel, Math.sin(k * 2.1) * .3, .45, Math.cos(k * 2.1) * .3, mg); l.rotation.set(Math.cos(k * 2.1) * .35, 0, -Math.sin(k * 2.1) * .35); }
  mesh(box(.18, .2, .9), steel, 0, 1, 0, mg);
  mesh(new THREE.CylinderGeometry(.04, .04, 1, 8), steel, 0, 1.02, .9, mg).rotation.x = PI / 2;
  mesh(box(.3, .25, .3), mat(0x3f5a34), .2, .9, -.1, mg);
  mg.position.set(0, 0, 2); mg.rotation.y = PI; c.add(mg); c.solid(mg); c.block(0, 2, .9, .9);

  const olive = mat(0x4a5230, { roughness: .8, metalness: .2 });
  function humvee(x, z, rot) {
    const g = new THREE.Group();
    mesh(box(2.3, 1, 4.6), olive, 0, 1, 0, g);
    mesh(box(2.1, .8, 2.2), olive, 0, 1.9, -.3, g);
    mesh(box(2.14, .45, 2.1), mat(0x0c1418, { roughness: .1, metalness: .9 }), 0, 1.95, -.3, g);
    mesh(box(2.4, .3, .3), mat(0x1a1d1f), 0, .7, 2.35, g);
    for (const sx of [-1.1, 1.1]) for (const sz of [-1.55, 1.55]) mesh(new THREE.CylinderGeometry(.5, .5, .4, 14), mat(0x0a0c0d, { roughness: .9 }), sx, .5, sz, g).rotation.z = PI / 2;
    mesh(new THREE.CylinderGeometry(.45, .45, .3, 14), mat(0x0a0c0d), 0, 1.2, -2.45, g).rotation.x = PI / 2;
    g.position.set(x, 0, z); g.rotation.y = rot; c.add(g); c.solid(g);
    fitBlock(c, x, z, rot, 2.4, 4.8, .4);
  }
  humvee(8, 24, .3); humvee(-4, -14, 1.4);

  const tank = mat(0xbfc4bc, { metalness: .5, roughness: .45 });
  for (const x of [22.5, 25.7]) {
    const t = mesh(new THREE.CylinderGeometry(1.3, 1.3, 6, 18), tank, x, 1.7, -28);
    t.rotation.x = PI / 2; c.solid(t);
    for (const z of [-30, -26]) mesh(box(2.2, .5, .5), steel, x, .25, z);
    mesh(box(.1, .3, 6.02), mat(0xd8b440), x, 2.95, -28);
  }
  c.block(24.1, -28, 6.6, 6.6);

  const crate = mat(0x4a5230, { roughness: .9 });
  for (const [x, z, y] of [[-14, -17, 0], [-12.8, -17.2, 0], [-13.4, -17, 1], [14, -18, 0], [15.2, -18.4, 0]]) {
    const b = mesh(box(1.1, 1, 1.1), crate, x, y + .5, z); b.rotation.y = rnd(-.2, .2); c.solid(b);
  }
  c.block(-13.4, -17.1, 2.8, 1.8); c.block(14.6, -18.2, 2.6, 1.8);

  const mast = new THREE.Group();
  for (const sx of [-.6, .6]) for (const sz of [-.6, .6]) {
    const l = mesh(box(.12, 18, .12), steel, sx * .6, 9, sz * .6, mast); l.rotation.set(sz * -.03, 0, sx * .03);
  }
  for (let y = 1.5; y < 18; y += 1.5) mesh(box(1.1 - y * .03, .06, 1.1 - y * .03), steel, 0, y, 0, mast);
  mast.position.set(-31, 0, -31); c.add(mast); c.solid(mast); c.block(-31, -31, 1.8, 1.8);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.glowTex, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beacon.position.set(-31, 18.3, -31); beacon.scale.setScalar(2.2); c.add(beacon);
  c.animate({ tick(t) { beacon.visible = (t % 1.6) < .5; } });

  const poolMat = new THREE.MeshBasicMaterial({ map: c.glowTex, color: 0xffc080, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z, s] of [[-12.5, -18.5, 1], [12.5, -18.5, -1], [-24, 30, 1], [24, 30, -1]]) {
    mesh(new THREE.CylinderGeometry(.1, .14, 7, 8), steel, x, 3.5, z);
    mesh(box(1.2, .1, .1), steel, x + s * .6, 7, z);
    mesh(box(.7, .2, .45), mat(0x2a2a20, { emissive: 0xffd08a, emissiveIntensity: 2.4 }), x + s * 1.1, 6.9, z);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), poolMat);
    pool.rotation.x = -PI / 2; pool.position.set(x + s * 1.1, .03, z); c.add(pool);
    c.block(x, z, .5, .5);
  }
  barrel(c, -7, 9); barrel(c, 9, -9);
}

export const MAPS = [
  {
    id: 'street', name: 'STREET', desc: 'MOONLIT DOWNTOWN BLOCK. BURNING BARRELS, WRECKED CARS.',
    bounds: { minX: -42, maxX: 42, minZ: -42.5, maxZ: 42.5 }, start: { x: 0, z: 30, yaw: 0 },
    fog: { color: 0x0b1820, density: .03 },
    sky: [[0, '#020409'], [.3, '#081624'], [.46, '#1b2c38'], [.5, '#4a2c1e'], [.53, '#0b1820'], [1, '#0b1820']],
    env: { key: 0x9fdaff, keyI: 2.6, keyPos: [-18, 28, -15], hemi: [0x8bbfd2, 0x2a2016, 1.5], moon: { pos: [-24, 34, -70], color: 0xd6efff, halo: 0x8fc9ff, opacity: .45, size: 1, haloSize: 26 }, stars: .7, embers: 0xff9a4a, exposure: 1.2 },
    menu: { orbit: [0, 4], r: 13, y: 3.2, look: [0, 1.4, -2], horde: [0, -4, 12, 16], target: [0, -6, 10, 20] },
    spawns: [[0, -34], [0, 40], [-3, -40], [3, 0]],
    build: street,
  },
  {
    id: 'mall', name: 'DEAD MALL', desc: 'SHOPPING ATRIUM. FLICKERING FLUORESCENTS, ESCALATORS, A DRY FOUNTAIN.',
    bounds: { minX: -24, maxX: 24, minZ: -38, maxZ: 38 }, start: { x: 0, z: 30, yaw: 0 },
    fog: { color: 0x121a1e, density: .026 },
    sky: [[0, '#020406'], [.3, '#070d12'], [.46, '#0f171b'], [.5, '#141c20'], [.53, '#121a1e'], [1, '#121a1e']],
    env: { key: 0xb0ccff, keyI: 2.1, keyPos: [-10, 30, -12], hemi: [0xa8c0cc, 0x2e2a24, 1.9], moon: { pos: [14, 70, -40], color: 0xd6efff, halo: 0x8fc9ff, opacity: .35, size: .8, haloSize: 20 }, stars: .45, embers: 0xcfd8d0, exposure: 1.25 },
    menu: { orbit: [0, 2], r: 12, y: 3.4, look: [0, 2, -6], horde: [0, -7, 10, 6], target: [0, -8, 12, 8] },
    spawns: [[0, -32], [-18, -20], [18, 24], [0, 34]],
    build: mall,
  },
  {
    id: 'overpass', name: 'OVERPASS', desc: 'HIGHWAY AT DUSK. CAR PILEUPS, CONCRETE PIERS, A COLLAPSED RAMP.',
    bounds: { minX: -22, maxX: 22, minZ: -44, maxZ: 44 }, start: { x: 0, z: 41, yaw: 0 },
    fog: { color: 0x4a2c36, density: .022 },
    sky: [[0, '#0e0820'], [.28, '#2e1840'], [.42, '#7a3448'], [.48, '#e0784a'], [.5, '#ffb070'], [.515, '#6a3a40'], [.53, '#4a2c36'], [1, '#4a2c36']],
    env: { key: 0xffa070, keyI: 2.6, keyPos: [-34, 11, -26], hemi: [0xc890a8, 0x3a2418, 1.7], moon: { pos: [-62, 9, -62], color: 0xffc080, halo: 0xff7a3a, opacity: .75, size: 1.7, haloSize: 46 }, stars: .2, embers: 0xffa050, exposure: 1.25 },
    menu: { orbit: [2, 14], r: 13, y: 3, look: [2, 3.2, 0], horde: [5, 8, 8, 6], target: [5, 6, 8, 10] },
    spawns: [[8, -38], [-8, 40], [16, 0], [-16, 0]],
    build: overpass,
  },
  {
    id: 'base', name: 'FORT HOLLOW', desc: 'OVERRUN ARMY BASE AT NIGHT. SEARCHLIGHTS, CONTAINERS, A HANGAR.',
    bounds: { minX: -36, maxX: 36, minZ: -36, maxZ: 36 }, start: { x: 0, z: 28, yaw: 0 },
    fog: { color: 0x0a1512, density: .028 },
    sky: [[0, '#010307'], [.3, '#06121a'], [.46, '#0f2224'], [.5, '#1e3026'], [.53, '#0a1512'], [1, '#0a1512']],
    env: { key: 0x9fc8ff, keyI: 2.8, keyPos: [-26, 30, 4], hemi: [0x8ab2aa, 0x24221a, 2.1], moon: { pos: [-58, 38, -48], color: 0xe6f4ff, halo: 0x9fd0ff, opacity: .5, size: 1.2, haloSize: 30 }, stars: .85, embers: 0xffb070, exposure: 1.3 },
    menu: { orbit: [0, 10], r: 14, y: 3.4, look: [0, 2, -4], horde: [0, 9, 12, 8], target: [0, 8, 14, 10] },
    spawns: [[0, -16], [-30, 0], [30, 2], [0, 34]],
    build: base,
  },
];
