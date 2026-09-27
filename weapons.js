import * as THREE from './vendor/three.module.js';

export const STORE_PREFIX = 'com.alpsenel.laststanddeadzone.';

export const WEAPONS = [
  { id: 'm4', name: 'M4A1', type: 'ASSAULT RIFLE', desc: 'Reliable all-rounder. Accurate on the move.', mag: 30, reserve: 180, maxReserve: 360, rate: .095, damage: 30, head: 2.3, spread: .008, moveSpread: .025, range: 70, reloadTime: 1.6, kick: .012, recoil: .045, auto: true, pickup: 2, sound: 'rifle', muzzle: -.97, grip: [0, -.12, .05], guard: [0, -.06, -.42] },
  { id: 'r870', name: 'R-870', type: 'PUMP SHOTGUN', desc: 'Nine pellets of close-range stopping power.', mag: 8, reserve: 32, maxReserve: 64, rate: .8, damage: 16, head: 1.6, pellets: 9, spread: .065, moveSpread: .02, range: 24, reloadTime: 2.2, kick: .05, recoil: .16, knock: 1.4, pump: true, sound: 'shotgun', flash: .5, muzzle: -.95, grip: [0, -.1, .08], guard: [0, -.06, -.45] },
  { id: 'mp7', name: 'MP7', type: 'SMG', desc: 'Blistering fire rate, barely any spread while running.', price: 800, mag: 40, reserve: 240, maxReserve: 480, rate: .058, damage: 17, head: 2, spread: .013, moveSpread: .006, range: 45, reloadTime: 1.3, kick: .006, recoil: .025, auto: true, pickup: 2, mobility: 1.1, sound: 'smg', flash: .26, muzzle: -.46, grip: [0, -.11, .02], guard: [0, -.12, -.2] },
  { id: 'ak', name: 'AK-47', type: 'ASSAULT RIFLE', desc: 'Hits harder than the M4, kicks like a mule.', price: 1500, mag: 30, reserve: 150, maxReserve: 300, rate: .11, damage: 43, head: 2.2, spread: .013, moveSpread: .03, range: 70, reloadTime: 1.9, kick: .02, recoil: .06, auto: true, pickup: 2, sound: 'rifle', muzzle: -.9, grip: [0, -.12, .06], guard: [0, -.07, -.4] },
  { id: 'deagle', name: '.50 HAND CANNON', type: 'PISTOL', desc: 'Massive headshot damage. Rounds punch through two bodies.', price: 1000, mag: 7, reserve: 49, maxReserve: 98, rate: .3, damage: 110, head: 3.2, spread: .004, moveSpread: .01, range: 60, reloadTime: 1.4, kick: .06, recoil: .14, pierce: 1, mobility: 1.12, sound: 'cannon', flash: .4, muzzle: -.32, grip: [0, -.1, .01], guard: [-.02, -.11, -.04], view: [-.05, .03, .06] },
  { id: 'boom', name: 'BOOMSTICK', type: 'DOUBLE BARREL', desc: 'Two shells, twelve pellets each. Clears a doorway.', price: 1800, mag: 2, reserve: 30, maxReserve: 60, rate: .22, damage: 22, head: 1.5, pellets: 12, spread: .09, moveSpread: .02, range: 16, reloadTime: 1.8, kick: .08, recoil: .22, knock: 2.4, sound: 'shotgun', flash: .6, muzzle: -.88, grip: [0, -.1, .1], guard: [0, -.07, -.36] },
  { id: 'm24', name: 'M24', type: 'SNIPER RIFLE', desc: 'Bolt action. One shot pierces through five infected.', price: 2500, mag: 5, reserve: 30, maxReserve: 60, rate: 1.1, damage: 240, head: 3, spread: .001, moveSpread: .03, range: 130, reloadTime: 2.6, kick: .07, recoil: .2, pierce: 4, pump: true, mobility: .92, sound: 'sniper', flash: .45, muzzle: -1.02, grip: [0, -.11, .05], guard: [0, -.07, -.4] },
  { id: 'm249', name: 'M249', type: 'LIGHT MACHINE GUN', desc: '100-round belt. Slow to reload, slow to stop.', price: 3500, mag: 100, reserve: 300, maxReserve: 600, rate: .075, damage: 30, head: 2, spread: .02, moveSpread: .035, range: 70, reloadTime: 3.8, kick: .01, recoil: .04, auto: true, pickup: 2, mobility: .85, sound: 'rifle', muzzle: -.95, grip: [0, -.13, .06], guard: [0, -.08, -.38] },
  { id: 'm79', name: 'M79', type: 'GRENADE LAUNCHER', desc: 'Explosive rounds that detonate on impact.', price: 4000, req: 'wave:10', mag: 1, reserve: 16, maxReserve: 30, rate: .2, damage: 260, head: 1, spread: 0, moveSpread: .01, range: 60, reloadTime: 1.6, kick: .05, recoil: .2, projectile: { speed: 30, gravity: 9, radius: 4.5, color: 0xffa040 }, sound: 'thump', flash: .45, muzzle: -.62, grip: [0, -.1, .06], guard: [0, -.07, -.3] },
  { id: 'flamer', name: 'INFERNO', type: 'FLAMETHROWER', desc: 'Short range. Sets the horde on fire.', price: 5000, req: 'boss:abomination', mag: 120, reserve: 240, maxReserve: 480, rate: .05, damage: 6, head: 1, pellets: 2, spread: .09, moveSpread: 0, range: 9, reloadTime: 2.4, kick: 0, recoil: .01, auto: true, flame: true, burn: 22, mobility: .95, sound: 'flame', flash: 0, muzzle: -.74, grip: [0, -.1, .06], guard: [0, -.07, -.35] },
  { id: 'tesla', name: 'TESLA ARC', type: 'CHAIN LIGHTNING', desc: 'Lightning jumps between up to five infected.', premium: 'weapon.tesla', mag: 40, reserve: 200, maxReserve: 400, rate: .12, damage: 36, head: 1.5, spread: 0, moveSpread: .01, range: 40, reloadTime: 1.8, kick: .004, recoil: .02, auto: true, chain: { count: 5, range: 7, falloff: .8 }, sound: 'zap', flash: .35, flashColor: 0x7fe8ff, accent: 0x5ad8ff, muzzle: -.72, grip: [0, -.12, .05], guard: [0, -.08, -.36] },
  { id: 'cryo', name: 'CRYO LANCE', type: 'FREEZE BEAM', desc: 'Freezes the horde solid. Frozen infected shatter.', premium: 'weapon.cryo', dps: 420, mag: 60, reserve: 240, maxReserve: 480, rate: .07, damage: 14, head: 1.5, spread: .004, moveSpread: .01, range: 35, reloadTime: 2, kick: .003, recoil: .015, auto: true, freeze: .12, sound: 'cryo', flash: .3, flashColor: 0xbff6ff, accent: 0x9ff4ff, muzzle: -.84, grip: [0, -.12, .05], guard: [0, -.08, -.4] },
  { id: 'singularity', name: 'SINGULARITY', type: 'BLACK HOLE LAUNCHER', desc: 'Fires a black hole that drags the horde in, then detonates.', premium: 'weapon.singularity', dps: 600, mag: 3, reserve: 12, maxReserve: 24, rate: 1.2, damage: 40, head: 1, spread: 0, moveSpread: 0, range: 60, reloadTime: 2.5, kick: .05, recoil: .18, projectile: { speed: 18, gravity: 0, blackhole: true, color: 0xa66bff }, sound: 'void', flash: .5, flashColor: 0xc9a0ff, accent: 0xa66bff, muzzle: -.66, grip: [0, -.13, .08], guard: [0, -.1, -.3] },
  { id: 'dragon', name: "DRAGON'S BREATH", type: 'INCENDIARY MINIGUN', desc: 'Spins up, then shreds and ignites everything in front of you.', premium: 'weapon.dragon', mag: 200, reserve: 400, maxReserve: 800, rate: .042, damage: 17, head: 1.6, spread: .024, moveSpread: .02, range: 60, reloadTime: 4, kick: .004, recoil: .02, auto: true, spinup: .6, burn: 10, pickup: 2, mobility: .8, sound: 'minigun', flash: .38, flashColor: 0xffb070, accent: 0xff6a1a, muzzle: -.86, grip: [0, -.16, .08], guard: [0, .1, -.12] },
];
WEAPONS.forEach(w => { w.pellets ??= 1; w.productId = w.premium ? STORE_PREFIX + w.premium : null; });
export const weaponIndex = id => Math.max(0, WEAPONS.findIndex(w => w.id === id));

export function weaponStats(w) {
  const dps = w.dps ?? w.damage * w.pellets / w.rate * (w.chain ? 2.2 : 1) * (w.projectile?.blackhole ? 4 : 1) * (w.burn ? 1.25 : 1);
  return [
    ['DAMAGE', Math.min(1, dps / 700)],
    ['FIRE RATE', Math.min(1, .12 / w.rate * .75)],
    ['MAGAZINE', Math.min(1, Math.log(w.mag + 1) / Math.log(201))],
    ['RANGE', Math.min(1, w.range / 100)],
    ['MOBILITY', Math.min(1, (w.mobility ?? 1) / 1.15)],
  ];
}

const B = new THREE.BoxGeometry(1, 1, 1);
const C = new THREE.CylinderGeometry(1, 1, 1, 14);

const PI = Math.PI, UVS = 1.6;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

function outline(pts, path = new THREE.Shape()) {
  const n = pts.length;
  pts.forEach(([x, y, r = 0], i) => {
    if (!r) return i ? path.lineTo(x, y) : path.moveTo(x, y);
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], la = Math.hypot(a[0] - x, a[1] - y), lb = Math.hypot(b[0] - x, b[1] - y);
    const ra = Math.min(r, la / 2), rb = Math.min(r, lb / 2), p = [x + (a[0] - x) / la * ra, y + (a[1] - y) / la * ra];
    i ? path.lineTo(...p) : path.moveTo(...p);
    path.quadraticCurveTo(x, y, x + (b[0] - x) / lb * rb, y + (b[1] - y) / lb * rb);
  });
  return path;
}
const oct = (hw, hh, c, cy = 0) => [[-hw + c, cy - hh], [hw - c, cy - hh], [hw, cy - hh + c], [hw, cy + hh - c], [hw - c, cy + hh], [-hw + c, cy + hh], [-hw, cy + hh - c], [-hw, cy - hh + c]];
function extrude(pts, depth, bv, holes = []) {
  const s = outline(pts);
  for (const h of holes) s.holes.push(outline(h, new THREE.Path()));
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(.0005, depth - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: 2, curveSegments: 5 }).translate(0, 0, bv);
}

function kit() {
  const parts = {}, subs = {};
  const put = (k, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
    (parts[k] ||= []).push(geo);
  };
  return {
    parts, subs, put,
    box: (k, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => put(k, new THREE.BoxGeometry(sx, sy, sz), x, y, z, rx, ry, rz),
    cyl: (k, x, y, z, r, len, seg = 12, rf = r) => put(k, new THREE.CylinderGeometry(r, rf, len, seg).rotateX(PI / 2), x, y, z),
    vcyl: (k, x, y, z, r, h, seg = 10, rx = 0, rz = 0) => put(k, new THREE.CylinderGeometry(r, r, h, seg), x, y, z, rx, 0, rz),
    pin: (k, x, y, z, r, len, seg = 8) => put(k, new THREE.CylinderGeometry(r, r, len, seg).rotateZ(PI / 2), x, y, z),
    ball: (k, x, y, z, r, sx = 1, sy = 1, sz = 1) => put(k, new THREE.SphereGeometry(r, 14, 10), x, y, z, 0, 0, 0, sx, sy, sz),
    ring: (k, x, y, z, R, t, rx = 0, ry = 0) => put(k, new THREE.TorusGeometry(R, t, 6, 20), x, y, z, rx, ry),
    lathe(k, prof, x = 0, y = 0, seg = 16, sx = 1, sy = 1) {
      let run = [prof[0]];
      const flush = () => { if (run.length > 1) put(k, new THREE.LatheGeometry(run.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(PI / 2).rotateZ(PI / seg), x, y, 0, 0, 0, 0, sx, sy, 1); };
      for (let i = 1; i < prof.length; i++) {
        run.push(prof[i]);
        const a = prof[i - 1], b = prof[i], c = prof[i + 1];
        if (c && Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])) % (2 * PI) > .6) { flush(); run = [b]; }
      }
      flush();
    },
    side: (k, pts, wd, x = 0, bv = .003, holes) => put(k, extrude(pts, wd, bv, holes).translate(0, 0, -wd / 2).rotateY(-PI / 2), x),
    sect: (k, pts, z0, z1, bv = .002) => put(k, extrude(pts, z1 - z0, bv), 0, 0, z0),
    tube: (k, pts, r, seg = 8, closed = false) => put(k, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed), pts.length * 8, r, seg, closed)),
    rail(k, y, z0, z1, x = 0, wd = .024) {
      put(k, new THREE.BoxGeometry(wd * .7, .008, z1 - z0), x, y + .004, (z0 + z1) / 2);
      for (let z = z0 + .006; z < z1 - .003; z += .015) put(k, new THREE.BoxGeometry(wd, .006, .008), x, y + .011, z);
    },
    sub(name, x, y, z) { const s = kit(); subs[name] = { pos: [x, y, z], parts: s.parts }; return s; },
  };
}

function merge(list) {
  const gs = list.map(g => (g.index ? g.toNonIndexed() : g));
  const n = gs.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  for (let i = 0; i < n; i++) {
    const ax = Math.abs(nor[i * 3]), ay = Math.abs(nor[i * 3 + 1]), az = Math.abs(nor[i * 3 + 2]), x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [z, x] : [x, y];
    uv[i * 2] = u * UVS; uv[i * 2 + 1] = v * UVS;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
const mergeParts = parts => Object.fromEntries(Object.entries(parts).map(([k, l]) => [k, merge(l)]));

const helix = (r, z0, z1, turns, y = 0, n = 10) => Array.from({ length: turns * n + 1 }, (_, i) => { const t = i / (turns * n), a = t * turns * PI * 2; return [Math.cos(a) * r, y + Math.sin(a) * r, z0 + (z1 - z0) * t]; });
function guard(K, k, z0, z1, y0, depth, wd = .012, r = .012) {
  K.side(k, [[z0, y0], [z1, y0], [z1 + .004, y0 - depth, r], [z0, y0 - depth + .004, r]], wd, 0, .002, [[[z0 + .01, y0 - .004], [z1 - .007, y0 - .004], [z1 - .005, y0 - depth + .008, r * .6], [z0 + .01, y0 - depth + .012, r * .6]]]);
  K.side('d', [[z1 - .045, y0], [z1 - .033, y0], [z1 - .04, y0 - depth * .55, .004], [z1 - .052, y0 - depth * .62]], .007, 0, .0015);
}
function aimpoint(K, y, z0, z1) {
  K.box('d', 0, y + .012, (z0 + z1) / 2, .024, .02, (z1 - z0) * .6);
  const c = y + .042, r = .02;
  K.lathe('d', [[r * .78, z1 - .004], [r * .78, z0 + .004], [r * 1.05, z0], [r * 1.1, z0 + .01], [r, z0 + .02], [r, z1 - .01], [r * 1.05, z1], [r * .78, z1 - .004]], 0, c);
  K.cyl('l', 0, c, z0 + .005, r * .8, .002);
  K.cyl('l', 0, c, z1 - .005, r * .8, .002);
  K.ball('r', 0, c, z1 - .0035, .0025);
  K.vcyl('d', 0, c + r + .005, (z0 + z1) / 2, .009, .014);
  K.pin('d', r + .006, c, (z0 + z1) / 2, .009, .014);
}
function reflex(K, y, z0, z1) {
  const c = (z0 + z1) / 2;
  K.box('d', 0, y + .005, c, .03, .01, z1 - z0);
  K.side('d', [[z0, y + .008], [z1, y + .008], [z1 - .008, y + .042, .006], [z0 + .01, y + .042, .006]], .03, 0, .002, [[[z0 + .006, y + .012], [z1 - .008, y + .012], [z1 - .012, y + .036], [z0 + .012, y + .036]]]);
  K.box('l', 0, y + .024, z0 + .008, .024, .024, .002, -.2);
  K.ball('r', 0, y + .024, z0 + .01, .0022);
}
function adStock(K, k, y, z0, z1, h) {
  K.cyl('d', 0, y, (z0 + z1) / 2 - .02, .016, z1 - z0 - .03);
  K.ring('d', 0, y, z0 + .005, .018, .004);
  K.side(k, [[z0 + .07, y + .028], [z1 - .01, y + .034, .01], [z1 + .004, y + .02], [z1 + .004, y - h + .01, .008], [z1 - .03, y - h], [z1 - .07, y - h + .025, .02], [z0 + .16, y - .032, .02], [z0 + .09, y - .026], [z0 + .07, y - .012, .01]], .044, 0, .005);
  K.side('d', [[z0 + .12, y - .026], [z0 + .2, y - .036], [z0 + .2, y - .05, .006], [z0 + .12, y - .04]], .02, 0, .002);
  K.side('d', [[z1, y + .031], [z1 + .014, y + .03, .004], [z1 + .018, y - h + .018, .006], [z1 + .002, y - h]], .048, 0, .003);
  K.box('d', 0, y - .026, z0 + .12, .012, .008, .04);
}
function arGrip(K, k, z, y) {
  K.side(k, [[z, y], [z + .06, y], [z + .104, y - .135, .012], [z + .094, y - .148, .006], [z + .048, y - .148, .008], [z + .036, y - .12], [z + .03, y - .1, .012], [z + .02, y - .07], [z + .018, y - .035, .01]], .044, 0, .006);
}

const DESIGNS = {
  m4(K) {
    K.side('m', [[.115, -.004], [.115, .05, .006], [-.2, .05], [-.2, -.004]], .058, 0, .004);
    K.side('m', [[.115, -.004], [-.168, -.004], [-.172, -.1, .004], [-.088, -.1, .004], [-.084, -.056], [.025, -.056], [.07, -.05], [.115, -.03, .012]], .054, 0, .004);
    K.rail('d', .05, -.2, .1);
    K.sect('b', oct(.034, .038, .013, .012), -.56, -.2, .003);
    K.rail('d', .05, -.555, -.205);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) K.box('d', s * .0342, .012, -.265 - i * .075, .002, .012, .045);
    K.cyl('d', 0, .012, -.56, .03, .012, 16);
    K.lathe('d', [[0, -.945], [.007, -.945], [.007, -.97], [.0165, -.97], [.018, -.964], [.018, -.918], [.0145, -.912], [.0145, -.9], [.0125, -.9], [.0125, -.78], [.014, -.775], [.014, -.56], [0, -.56]], 0, .012);
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + .3; K.box('d', Math.cos(a) * .0175, .012 + Math.sin(a) * .0175, -.944, .005, .005, .036, 0, 0, a); }
    K.side('d', [[-.548, .066], [-.52, .066], [-.527, .1, .003], [-.54, .1, .003]], .012, 0, .002);
    K.side('d', [[.07, .066], [.1, .066], [.098, .092, .003], [.078, .092, .003]], .022, 0, .002);
    aimpoint(K, .066, -.12, -.03);
    const mag = [[-.163, -.07], [-.093, -.07], [-.1, -.18], [-.118, -.26, .012], [-.19, -.25, .012], [-.176, -.17]];
    K.side('d', mag, .044, 0, .004);
    K.side('d', [[-.118, -.255], [-.192, -.244], [-.196, -.262, .004], [-.118, -.272, .004]], .05, 0, .003);
    guard(K, 'm', -.078, .03, -.056, .04);
    arGrip(K, 'b', .012, -.052);
    K.box('d', .03, .022, -.03, .002, .022, .07);
    K.cyl('m', .028, .034, .07, .009, .04, 10);
    K.box('m', .03, .026, .03, .006, .02, .018);
    K.box('d', 0, .052, .125, .032, .01, .025);
    K.box('d', -.029, -.03, -.08, .004, .03, .012);
    K.pin('d', .028, -.048, -.06, .006, .008);
    K.box('d', -.029, -.028, .03, .003, .006, .03, .3);
    for (const z of [-.15, .09]) K.pin('d', 0, -.02, z, .0045, .058);
    adStock(K, 'b', .016, .11, .38, .16);
  },
  r870(K) {
    K.side('m', [[-.19, .055, .006], [.03, .055], [.07, .036, .02], [.07, -.036], [-.19, -.036]], .058, 0, .004);
    K.box('d', .0295, .016, -.08, .002, .03, .1);
    K.box('d', 0, -.037, -.1, .03, .002, .12);
    K.side('d', [[-.035, -.036], [.07, -.036], [.066, -.05, .01], [-.035, -.05]], .05, 0, .003);
    guard(K, 'd', -.03, .05, -.05, .038);
    K.pin('d', 0, -.045, .045, .005, .054);
    for (const z of [-.15, .04]) K.pin('d', 0, -.02, z, .005, .06);
    K.lathe('d', [[0, -.93], [.011, -.93], [.011, -.95], [.0185, -.95], [.019, -.94], [.019, -.19], [0, -.19]], 0, .028);
    K.ball('a', 0, .05, -.935, .0045);
    K.cyl('d', 0, -.022, -.51, .0155, .64);
    K.lathe('d', [[0, -.875], [.012, -.873], [.017, -.86], [.017, -.83], [0, -.83]], 0, -.022);
    K.box('d', 0, .003, -.82, .014, .034, .026);
    const p = K.sub('pump', 0, -.022, -.45), prof = [[0, -.11], [.022, -.11], [.03, -.098]];
    for (let z = -.085; z < .09; z += .022) prof.push([.03, z - .005], [.026, z - .003], [.026, z + .003], [.03, z + .005]);
    prof.push([.03, .1], [.024, .11], [0, .11]);
    p.lathe('b', prof, 0, .004, 18, 1, 1.18);
    for (const s of [-1, 1]) p.box('d', s * .02, .018, .2, .004, .008, .18);
    K.side('b', [[.07, .04], [.14, .033], [.47, .012, .008], [.48, -.14, .01], [.44, -.142], [.22, -.075], [.165, -.07, .01], [.132, -.13, .014], [.092, -.134, .01], [.075, -.05]], .05, 0, .008);
    K.side('d', [[.472, .014], [.492, .015, .004], [.5, -.142, .006], [.48, -.146]], .054, 0, .004);
  },
  mp7(K) {
    K.side('m', [[-.3, -.004], [-.3, .03, .012], [-.22, .05], [.1, .05, .008], [.125, .03, .01], [.125, -.035], [.04, -.045], [-.04, -.045], [-.14, -.03], [-.28, -.022, .01]], .06, 0, .006);
    K.rail('d', .05, -.21, .1, 0, .022);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) K.box('d', s * .0302, .018, -.24 + i * .03, .002, .018, .016);
    reflex(K, .066, -.06, .02);
    K.side('d', [[-.2, .066], [-.18, .066], [-.183, .084, .002], [-.195, .084, .002]], .012, 0, .0015);
    K.lathe('d', [[0, -.44], [.006, -.44], [.006, -.46], [.013, -.46], [.015, -.452], [.015, -.405], [.009, -.398], [.009, -.3], [0, -.3]], 0, .01);
    K.side('b', [[-.03, -.04], [.046, -.04], [.062, -.195, .01], [-.002, -.195, .01], [-.012, -.1]], .046, 0, .006);
    K.side('d', [[.0, -.195], [.058, -.195], [.06, -.24, .004], [.0, -.243, .004]], .04, 0, .003);
    K.box('d', 0, -.247, .03, .046, .01, .068);
    guard(K, 'b', -.1, -.03, -.035, .055, .014);
    K.side('b', [[-.235, -.022], [-.185, -.022], [-.188, -.16, .012], [-.228, -.16, .012]], .032, 0, .005);
    K.pin('d', 0, -.028, -.21, .006, .04);
    for (const s of [-1, 1]) K.cyl('d', s * .022, .012, .15, .006, .1);
    K.side('b', [[.19, .042], [.215, .042, .006], [.215, -.05, .006], [.19, -.042]], .062, 0, .004);
    K.box('d', 0, .058, .105, .026, .01, .02);
    K.pin('d', 0, -.012, -.02, .006, .064);
  },
  ak(K) {
    K.side('m', [[-.21, .036], [.14, .036], [.145, .02], [.14, -.036], [-.21, -.036]], .056, 0, .003);
    K.sect('m', [[-.026, .034], [.026, .034], [.026, .062, .024], [-.026, .062, .024]], -.17, .145, .002);
    for (let i = 0; i < 4; i++) K.box('m', 0, .064, -.1 + i * .06, .028, .002, .012);
    K.side('m', [[-.26, .036], [-.2, .036], [-.2, .062], [-.25, .05]], .04, 0, .003);
    K.box('d', 0, .06, -.23, .03, .004, .05, .06);
    K.cyl('m', 0, .012, -.235, .03, .02, 14);
    K.cyl('m', 0, .042, -.4, .013, .3);
    K.sect('b', [[-.022, .028], [.022, .028], [.022, .044, .018], [-.022, .044, .018]], -.44, -.26, .003);
    K.sect('b', [[-.03, -.032, .012], [.03, -.032, .012], [.033, .028], [-.033, .028]], -.47, -.245, .004);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) K.box('d', s * .031, -.012, -.28 - i * .06, .003, .006, .03);
    K.cyl('m', 0, .008, -.48, .033, .014, 14);
    K.lathe('d', [[0, -.84], [.012, -.84], [.012, -.24], [0, -.24]], 0, .012);
    K.side('m', [[-.58, .056], [-.53, .056], [-.53, .044], [-.55, .002], [-.582, -.004]], .03, 0, .003);
    K.side('m', [[-.8, .04], [-.765, .04], [-.76, -.008], [-.805, -.01]], .028, 0, .003);
    for (const s of [-1, 1]) K.box('m', s * .011, .058, -.79, .004, .036, .012);
    K.box('d', 0, .052, -.79, .004, .028, .005);
    K.box('m', 0, -.018, -.745, .012, .02, .03);
    K.cyl('d', 0, -.016, -.64, .0035, .32, 6);
    K.lathe('d', [[0, -.892], [.007, -.892], [.007, -.9], [.012, -.9], [.015, -.895], [.015, -.84], [0, -.84]], 0, .012);
    K.box('d', 0, .012, -.892, .026, .014, .014, .5);
    K.side('d', [[-.18, -.034], [-.1, -.034], [-.11, -.12], [-.14, -.2], [-.19, -.265, .012], [-.275, -.232, .012], [-.23, -.18], [-.197, -.11]], .046, 0, .004);
    for (const s of [-1, 1]) K.side('d', [[-.17, -.05], [-.155, -.05], [-.19, -.2], [-.2, -.19]], .004, s * .024, 0);
    guard(K, 'm', -.09, .03, -.036, .036, .01);
    K.side('b', [[.03, -.034], [.09, -.034], [.13, -.172, .012], [.114, -.184, .006], [.07, -.184, .008], [.052, -.12], [.044, -.08], [.035, -.05]], .042, 0, .006);
    K.box('m', .03, .012, -.06, .003, .012, .16, .12);
    K.box('m', .03, .03, .12, .006, .006, .03);
    K.side('b', [[.14, .03], [.16, .032], [.47, -.035, .006], [.475, -.162, .008], [.455, -.166], [.15, -.036]], .044, 0, .007);
    K.side('d', [[.468, -.032], [.484, -.032], [.49, -.166, .004], [.472, -.168]], .048, 0, .003);
  },
  deagle(K) {
    K.sect('m', [[-.021, .012], [.021, .012], [.021, .046], [.013, .062], [-.013, .062], [-.021, .046]], -.12, .066, .002);
    K.sect('m', [[-.019, .014], [.019, .014], [.019, .05], [.007, .066], [-.007, .066], [-.019, .05]], -.32, -.12, .002);
    K.box('d', 0, .067, -.22, .006, .002, .18);
    K.cyl('d', 0, .034, -.3205, .009, .002);
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) K.box('d', s * .0212, .036, .004 + i * .008, .002, .034, .0035);
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) K.box('d', s * .0195, .03, -.28 + i * .02, .002, .02, .008);
    K.side('d', [[-.2, .012], [.068, .012], [.068, -.02], [-.2, -.01]], .038, 0, .003);
    guard(K, 'd', -.125, -.02, -.012, .062, .011, .006);
    K.side('d', [[-.03, -.018], [.062, -.018], [.076, -.05], [.09, -.178, .012], [.075, -.19, .008], [.0, -.19, .008], [-.02, -.06]], .036, 0, .004);
    K.side('b', [[-.012, -.03], [.058, -.03], [.07, -.06], [.08, -.168, .01], [.068, -.176, .006], [.008, -.176, .006], [-.008, -.07]], .044, 0, .004);
    K.box('d', 0, -.195, .04, .04, .012, .082);
    K.side('d', [[.06, .03], [.078, .04, .004], [.084, .022], [.068, .012]], .014, 0, .002);
    K.side('d', [[-.312, .066], [-.292, .066], [-.296, .078, .002], [-.306, .078, .002]], .006, 0, .001);
    for (const s of [-1, 1]) K.box('d', s * .009, .068, .052, .008, .014, .012);
    K.box('d', -.023, -.004, -.09, .003, .01, .05);
    K.pin('d', 0, .044, .052, .006, .05);
  },
  boom(K) {
    for (const x of [-.021, .021]) K.lathe('d', [[0, -.86], [.015, -.86], [.015, -.88], [.02, -.88], [.021, -.87], [.022, -.13], [0, -.13]], x, .02);
    K.box('d', 0, .043, -.5, .012, .008, .74);
    K.box('d', 0, -.002, -.5, .012, .008, .72);
    K.ball('a', 0, .05, -.868, .0045);
    K.side('m', [[-.135, .046], [.03, .046], [.055, .035, .01], [.055, -.035], [.0, -.056, .022], [-.1, -.056, .012], [-.135, -.035]], .07, 0, .006);
    K.pin('m', 0, -.018, -.12, .012, .073, 12);
    for (const s of [-1, 1]) K.side('m', [[.03, .032], [.05, .032], [.078, .072, .006], [.066, .078], [.042, .052]], .01, s * .022, .002);
    K.box('m', 0, .052, .035, .012, .008, .05, 0, .3);
    K.side('b', [[-.42, .0], [-.14, .0], [-.14, -.035], [-.2, -.05, .012], [-.4, -.046, .012], [-.43, -.02]], .07, 0, .008);
    guard(K, 'm', -.03, .06, -.05, .042);
    K.side('d', [[.005, -.05], [.015, -.05], [.01, -.075, .003], [.0, -.078]], .007, 0, .0015);
    K.side('b', [[.05, .04], [.12, .03], [.46, .0, .008], [.47, -.14, .01], [.43, -.142], [.22, -.074], [.168, -.07, .01], [.14, -.132, .014], [.1, -.134, .01], [.082, -.052], [.055, -.042]], .056, 0, .008);
    K.side('d', [[.462, .002], [.48, .002, .004], [.49, -.142, .006], [.47, -.146]], .06, 0, .004);
  },
  m24(K) {
    K.side('b', [[-.585, -.002], [-.16, -.002], [-.14, .008], [.05, .008], [.08, -.004], [.11, -.015], [.16, .03, .012], [.44, .04, .01], [.46, .03], [.462, -.13, .012], [.44, -.132], [.2, -.07], [.128, -.062, .012], [.105, -.17, .014], [.058, -.172, .01], [.04, -.062], [-.05, -.052], [-.55, -.052, .012], [-.59, -.03, .012]], .062, 0, .01);
    K.side('d', [[.458, .036], [.474, .036, .004], [.478, -.132, .006], [.46, -.134]], .066, 0, .004);
    K.lathe('m', [[0, -.16], [.022, -.16], [.028, -.15], [.028, .05], [.022, .07], [0, .07]], 0, .02);
    K.box('d', .0275, .03, -.05, .004, .02, .08);
    K.cyl('m', 0, .02, .085, .016, .03);
    K.lathe('d', [[0, -1.0], [.006, -1.0], [.006, -1.02], [.013, -1.02], [.015, -1.012], [.016, -.7], [.02, -.22], [.023, -.2], [.023, -.16], [0, -.16]], 0, .02);
    const c = .11;
    K.lathe('d', [[.026, -.325], [.03, -.335], [.031, -.33], [.031, -.26], [.018, -.215], [.017, .02], [.021, .045], [.023, .06], [.023, .125], [.02, .132]], 0, c, 20);
    K.cyl('l', 0, c, -.328, .026, .002, 20);
    K.cyl('l', 0, c, .128, .019, .002, 20);
    K.vcyl('d', 0, c + .024, -.07, .011, .02, 14);
    K.pin('d', .024, c, -.07, .011, .02, 14);
    K.cyl('d', 0, c, -.07, .021, .04, 14);
    for (let i = 0; i < 3; i++) K.ring('d', 0, c, .07 + i * .014, .0225, .0025);
    for (const z of [-.15, .0]) { K.cyl('d', 0, c, z, .021, .018, 14); K.box('d', 0, .068, z, .022, .04, .018); }
    const b = K.sub('pump', .028, .036, .04);
    b.pin('m', .015, 0, 0, .006, .03);
    b.put('m', new THREE.CylinderGeometry(.005, .005, .04, 8), .033, -.015, .006, .2, 0, .5);
    b.ball('m', .042, -.032, .01, .011);
    guard(K, 'd', -.05, .04, -.052, .04, .012);
    K.box('d', 0, -.054, -.05, .03, .004, .08);
    const bp = [[-.012, -.07], [.012, -.07]];
    for (const [x] of bp) { K.cyl('d', x, -.066, -.4, .0055, .24, 8); K.box('d', x, -.066, -.275, .012, .008, .012); }
    K.box('d', 0, -.058, -.53, .04, .016, .03);
    K.vcyl('d', 0, -.062, .38, .006, .02);
  },
  m249(K) {
    K.side('m', [[-.24, .05], [.1, .05], [.14, .02, .01], [.14, -.04], [.05, -.06], [-.24, -.06]], .07, 0, .004);
    K.side('m', [[-.21, .05], [.07, .05], [.08, .07, .01], [.06, .09], [-.16, .09], [-.21, .07, .012]], .066, 0, .003);
    K.rail('d', .09, -.15, .05, 0, .024);
    K.side('d', [[.03, .101], [.055, .101], [.052, .12, .003], [.035, .12, .003]], .02, 0, .002);
    K.box('d', .038, .018, -.12, .012, .012, .026);
    for (let i = 0; i < 4; i++) K.box('d', -.036, -.01, -.2 + i * .07, .002, .02, .04);
    K.side('b', [[-.19, -.055], [-.02, -.055], [-.02, -.22, .012], [-.19, -.22, .012]], .1, -.03, .008);
    K.box('d', -.081, -.1, -.1, .004, .03, .08);
    for (let i = 0; i < 4; i++) K.box('d', -.05, -.02 - i * .006, -.1 + i * .003, .02, .01, .03);
    arGrip(K, 'b', .03, -.056);
    guard(K, 'm', -.04, .05, -.058, .04);
    K.cyl('d', 0, .01, .2, .014, .12);
    K.side('b', [[.2, .03], [.42, .042, .012], [.43, -.12, .012], [.39, -.122], [.3, -.05, .02], [.2, -.03]], .05, 0, .006, [[[.25, .014], [.38, .02], [.385, -.07, .01], [.35, -.07], [.3, -.024, .01], [.25, -.018]]]);
    K.box('d', -.03, -.058, -.105, .1, .006, .172);
    K.box('d', -.081, -.12, -.105, .004, .018, .03);
    K.side('d', [[.422, .042], [.438, .042, .004], [.442, -.12, .006], [.428, -.124]], .054, 0, .003);
    K.lathe('d', [[0, -.94], [.008, -.94], [.008, -.95], [.018, -.95], [.02, -.945], [.02, -.89], [.015, -.884], [.015, -.24], [0, -.24]], 0, .012);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; K.box('d', Math.cos(a) * .0195, .012 + Math.sin(a) * .0195, -.92, .005, .005, .036, 0, 0, a); }
    K.cyl('d', 0, -.03, -.5, .011, .3);
    K.box('d', 0, -.012, -.65, .026, .05, .03);
    K.sect('b', [[-.036, -.056, .014], [.036, -.056, .014], [.036, -.004], [-.036, -.004]], -.44, -.24, .004);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) K.box('d', s * .0362, -.03, -.27 - i * .045, .002, .03, .016);
    K.sect('d', [[-.024, .012], [.024, .012], [.024, .044, .022], [-.024, .044, .022]], -.5, -.24, .002);
    K.tube('d', [[0, .04, -.27], [0, .09, -.3], [0, .1, -.37], [0, .09, -.44], [0, .04, -.47]], .007);
    K.side('d', [[-.87, .03], [-.855, .03], [-.858, .058], [-.866, .058]], .006, 0, .001);
    for (const s of [-1, 1]) K.cyl('d', s * .014, -.04, -.79, .006, .22, 8);
    K.box('d', 0, -.03, -.68, .04, .02, .03);
  },
  m79(K) {
    K.lathe('m', [[0, -.572], [.036, -.572], [.036, -.62], [.046, -.62], [.048, -.61], [.048, -.14], [0, -.14]], 0, .02, 20);
    K.cyl('d', 0, .02, -.574, .035, .004, 20);
    K.ring('m', 0, .02, -.5, .049, .004);
    K.side('m', [[-.155, .05], [.03, .05], [.062, .03, .016], [.062, -.036], [-.155, -.036]], .074, 0, .006);
    K.pin('m', 0, -.016, -.14, .012, .076, 12);
    K.side('b', [[-.4, -.02], [-.16, -.02], [-.16, -.05], [-.22, -.062, .012], [-.38, -.056, .012], [-.41, -.036]], .07, 0, .008);
    for (const s of [-1, 1]) K.side('d', [[-.275, .064], [-.235, .064], [-.24, .135, .004], [-.26, .135, .004]], .004, s * .018, .001, [[[-.265, .075], [-.245, .075], [-.249, .124], [-.259, .124]]]);
    K.box('d', 0, .066, -.255, .04, .006, .04);
    K.box('d', 0, .128, -.25, .04, .006, .006);
    K.side('d', [[-.59, .066], [-.572, .066], [-.576, .082, .002], [-.586, .082, .002]], .005, 0, .001);
    K.box('m', 0, .054, .02, .014, .01, .05);
    guard(K, 'm', -.04, .06, -.036, .05, .013, .016);
    K.side('b', [[.06, .044], [.12, .036], [.42, .02, .008], [.44, -.15, .012], [.4, -.156], [.2, -.082], [.155, -.076, .01], [.124, -.132, .014], [.085, -.134, .01], [.07, -.05], [.062, -.036]], .058, 0, .008);
    K.side('d', [[.422, .022], [.47, .02, .012], [.478, -.152, .012], [.44, -.158]], .064, 0, .008);
  },
  flamer(K) {
    K.side('m', [[-.22, .05], [.1, .05, .012], [.12, .02], [.12, -.04], [-.22, -.04]], .07, 0, .005);
    K.rail('d', .05, -.2, .08);
    K.lathe('b', [[0, -.31], [.03, -.3], [.05, -.28], [.058, -.25], [.058, .05], [.05, .08], [.03, .096], [0, .104]], 0, -.12, 22);
    for (const z of [-.2, -.05]) K.ring('d', 0, -.12, z, .059, .004);
    K.vcyl('d', 0, -.052, -.12, .01, .03);
    K.cyl('d', 0, -.12, -.315, .012, .02);
    K.ring('m', 0, -.12, -.33, .02, .004);
    K.tube('d', [[.02, -.12, -.3], [.05, -.1, -.37], [.045, -.03, -.44], [.02, .005, -.47]], .008);
    K.lathe('d', [[0, -.72], [.012, -.72], [.012, -.74], [.03, -.74], [.034, -.73], [.034, -.68], [.022, -.66], [.018, -.22], [0, -.22]], 0, .02);
    K.lathe('m', [[.03, -.6], [.036, -.6], [.036, -.3], [.03, -.3], [.03, -.6]], 0, .02, 18);
    for (let i = 0; i < 6; i++) for (const a of [PI / 2, PI / 4, 3 * PI / 4]) K.box('d', Math.cos(a) * .0362, .02 + Math.sin(a) * .0362, -.56 + i * .048, .012, .002, .028, 0, 0, a - PI / 2);
    K.box('d', 0, -.02, -.7, .02, .02, .04);
    K.sub('pilot', 0, -.02, -.728).ball('p', 0, 0, 0, .01);
    K.side('b', [[-.38, -.004], [-.32, -.004], [-.328, -.12, .01], [-.372, -.12, .01]], .034, 0, .005);
    arGrip(K, 'd', .012, -.036);
    guard(K, 'm', -.07, .03, -.04, .04);
    adStock(K, 'b', .016, .12, .36, .14);
  },
  tesla(K) {
    K.side('d', [[-.26, -.01, .01], [-.24, .04, .012], [-.1, .06], [.1, .06, .02], [.14, .02, .01], [.14, -.04], [-.2, -.04, .012]], .08, 0, .006);
    K.side('b', [[-.2, .036], [.08, .046], [.1, .0], [-.18, -.022]], .086, 0, .003);
    for (const s of [-1, 1]) K.box('a', s * .044, .012, -.05, .002, .006, .2);
    K.lathe('m', [[0, -.7], [.008, -.69], [.012, -.66], [.012, -.26], [0, -.26]], 0, .01);
    K.tube('a', helix(.028, -.29, -.6, 9, .01), .0055, 6);
    for (const z of [-.28, -.44, -.61]) K.lathe('m', [[.012, z - .006], [.05, z - .004], [.05, z + .004], [.012, z + .006]], 0, .01, 20);
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + PI / 2; K.cyl('m', Math.cos(a) * .046, .01 + Math.sin(a) * .046, -.445, .004, .33, 6); }
    for (const s of [-1, 1]) { K.tube('m', [[s * .03, .01, -.61], [s * .042, .01, -.66], [s * .02, .01, -.715]], .006, 6); K.ball('a', s * .02, .01, -.718, .008); }
    K.ball('a', 0, .08, .06, .024);
    K.ring('m', 0, .08, .06, .028, .003, PI / 2);
    K.ring('m', 0, .08, .06, .028, .003, 0, PI / 2);
    K.vcyl('m', 0, .06, .06, .022, .012, 14);
    for (let i = 0; i < 5; i++) K.box('m', 0, .07, -.18 + i * .03, .05, .02, .006);
    K.vcyl('g', 0, -.085, -.12, .022, .08, 14);
    K.vcyl('a', 0, -.085, -.12, .012, .076, 10);
    for (const y of [-.042, -.128]) K.vcyl('m', 0, y, -.12, .025, .008, 14);
    arGrip(K, 'b', .02, -.036);
    guard(K, 'd', -.07, .03, -.04, .038);
    K.side('b', [[.14, .045], [.36, .05, .01], [.37, -.1, .012], [.34, -.1], [.2, -.03], [.14, -.03]], .05, 0, .006, [[[.18, .025], [.33, .03], [.335, -.07, .01], [.3, -.07], [.2, -.012]]]);
  },
  cryo(K) {
    K.side('b', [[-.3, .03, .016], [.1, .05, .016], [.14, .02], [.14, -.04], [-.28, -.045, .016]], .085, 0, .008);
    K.lathe('m', [[0, -.21], [.036, -.21], [.047, -.2], [.047, -.18], [0, -.18]], 0, .105, 18);
    K.lathe('m', [[0, .06], [.047, .06], [.047, .08], [.036, .09], [0, .09]], 0, .105, 18);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; K.cyl('m', Math.cos(a) * .045, .105 + Math.sin(a) * .045, -.06, .003, .24, 6); }
    K.cyl('g', 0, .105, -.06, .043, .24, 18);
    K.cyl('a', 0, .105, -.06, .026, .235, 12);
    for (const z of [-.16, .04]) K.box('d', 0, .068, z, .03, .03, .02);
    K.lathe('m', [[0, -.8], [.01, -.8], [.02, -.3], [0, -.3]], 0, .005);
    for (let i = 0; i < 7; i++) K.lathe('m', [[.018, -.4 - i * .04], [.045 - i * .002, -.398 - i * .04], [.045 - i * .002, -.39 - i * .04], [.018, -.388 - i * .04]], 0, .005, 18);
    for (let i = 0; i < 3; i++) K.ring('a', 0, .005, -.335 - i * .02, .024, .005);
    K.lathe('m', [[.012, -.84], [.03, -.83], [.024, -.8], [.014, -.8]], 0, .005, 18);
    K.cyl('a', 0, .005, -.838, .013, .006);
    K.tube('d', [[0, .08, -.2], [0, .06, -.27], [0, .03, -.31]], .008);
    for (const s of [-1, 1]) K.box('a', s * .043, -.01, -.1, .002, .004, .26);
    arGrip(K, 'd', .02, -.04);
    guard(K, 'd', -.07, .03, -.042, .038);
    K.side('b', [[.14, .045], [.36, .045, .01], [.37, -.1, .012], [.34, -.1], [.2, -.03], [.14, -.03]], .05, 0, .006, [[[.18, .022], [.33, .026], [.335, -.07, .01], [.3, -.07], [.2, -.012]]]);
  },
  singularity(K) {
    K.side('d', [[-.12, .07, .02], [.1, .07, .02], [.14, .03], [.14, -.07], [-.12, -.07, .02]], .13, 0, .01);
    K.side('b', [[-.1, .05], [.08, .055], [.1, .0], [.08, -.05], [-.1, -.05]], .136, 0, .004);
    K.cyl('g', 0, .0, -.21, .06, .16, 20);
    K.ball('a', 0, .0, -.21, .038);
    K.ring('a', 0, 0, -.21, .048, .003, PI / 2, .6);
    K.ring('a', 0, 0, -.21, .048, .003, PI / 2, -.6);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; K.cyl('m', Math.cos(a) * .064, Math.sin(a) * .064, -.21, .008, .18, 8); }
    K.lathe('m', [[.044, -.52], [.044, -.64], [.074, -.66], [.078, -.64], [.064, -.6], [.066, -.3], [.07, -.29], [0, -.29]], 0, .0, 24);
    K.cyl('d', 0, 0, -.522, .044, .003, 20);
    K.ball('a', 0, 0, -.53, .014);
    K.ring('a', 0, 0, -.57, .07, .007);
    K.ring('a', 0, 0, -.44, .068, .006);
    for (let i = 0; i < 6; i++) K.box('d', 0, .068, -.36 - i * .03, .02, .006, .012);
    K.box('m', 0, .09, -.14, .03, .03, .38);
    K.rail('d', .105, -.3, .02);
    K.side('d', [[-.33, -.06], [-.27, -.06], [-.28, -.17, .01], [-.32, -.17, .01]], .04, 0, .006);
    arGrip(K, 'd', .04, -.066);
    guard(K, 'm', -.05, .05, -.07, .04);
    K.side('b', [[.14, .05], [.38, .05, .012], [.39, -.1, .012], [.35, -.1], [.2, -.04], [.14, -.04]], .06, 0, .006, [[[.19, .026], [.35, .028], [.355, -.07, .01], [.32, -.07], [.2, -.018]]]);
  },
  dragon(K) {
    K.side('d', [[-.12, .07, .02], [.15, .07, .02], [.17, .03], [.17, -.07, .02], [-.12, -.07, .02]], .15, 0, .01);
    for (const s of [-1, 1]) { K.box('a', s * .0755, .03, .02, .002, .006, .2); K.box('a', s * .0755, -.02, .02, .002, .006, .2); }
    for (let i = 0; i < 5; i++) K.box('m', 0, .075, .1 - i * .025, .12, .012, .008);
    K.tube('m', [[0, .07, .06], [0, .11, .03], [0, .125, -.04], [0, .125, -.16], [0, .1, -.2], [0, .07, -.2]], .011);
    K.cyl('m', 0, -.045, -.15, .035, .08, 16);
    K.cyl('m', 0, 0, -.13, .07, .02, 20);
    const s = K.sub('spin', 0, 0, -.45);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; s.lathe('d', [[0, -.39], [.006, -.39], [.006, -.4], [.0115, -.4], [.0115, .3], [0, .3]], Math.cos(a) * .035, Math.sin(a) * .035, 10); }
    s.cyl('m', 0, 0, 0, .012, .7, 8);
    s.lathe('m', [[.0, .22], [.058, .22], [.06, .23], [.06, .29], [0, .3]], 0, 0, 18);
    for (const z of [-.08, -.36]) s.cyl('m', 0, 0, z, .053, .016, 18);
    s.ring('a', 0, 0, -.375, .051, .006);
    K.side('b', [[-.08, -.02], [.12, -.02], [.12, -.16, .012], [-.08, -.16, .012]], .09, -.12, .008);
    for (let i = 0; i < 3; i++) K.box('d', -.166, -.09, -.04 + i * .06, .004, .1, .012);
    K.tube('d', [[-.12, -.02, .02], [-.11, .01, .0], [-.08, .02, -.02]], .02, 8);
    K.side('d', [[.04, -.065], [.1, -.065], [.14, -.24, .014], [.126, -.25, .006], [.08, -.25, .008], [.06, -.16], [.05, -.1]], .05, 0, .006);
    guard(K, 'd', -.02, .07, -.068, .04);
  },
};

const GEO = new Map(), MAT = new Map();
function gunGeo(w) {
  if (!GEO.has(w.id)) {
    const K = kit();
    DESIGNS[w.id](K);
    GEO.set(w.id, { main: mergeParts(K.parts), subs: Object.entries(K.subs).map(([n, s]) => [n, s.pos, mergeParts(s.parts)]) });
  }
  return GEO.get(w.id);
}
const shared = k => MAT.get(k) ?? MAT.set(k, {
  l: () => new THREE.MeshStandardMaterial({ color: 0x0c1a24, metalness: .9, roughness: .08, emissive: 0x0a2a3a, emissiveIntensity: .6 }),
  r: () => new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  g: () => new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: .3, depthWrite: false }),
  p: () => new THREE.MeshBasicMaterial({ color: 0x5ab0ff }),
}[k]()).get(k);
function accentMat(w) {
  const k = 'a' + w.id;
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshStandardMaterial({ color: w.accent, emissive: w.accent, emissiveIntensity: 1.4, roughness: .3 }));
  return MAT.get(k);
}

export const WOOD = new Set(['r870', 'boom', 'm79', 'm24', 'ak']);
let woodTex;
export function woodStock(mat) {
  if (!woodTex) {
    const cv = document.createElement('canvas'), cx = cv.getContext('2d');
    cv.width = cv.height = 128;
    cx.fillStyle = '#8a5428'; cx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      const y = (i * 37.3) % 128, a = .05 + (i % 5) * .03;
      cx.strokeStyle = i % 3 ? `rgba(60,28,10,${a})` : `rgba(190,120,60,${a})`;
      cx.lineWidth = .6 + (i % 4) * .5;
      cx.beginPath();
      for (let x = 0; x <= 128; x += 8) cx.lineTo(x, y + Math.sin(x / 128 * PI * 2 + i) * 2.5);
      cx.stroke();
    }
    woodTex = new THREE.CanvasTexture(cv);
    woodTex.colorSpace = THREE.SRGBColorSpace;
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(1, 3);
  }
  mat.color.setHex(0xffffff);
  mat.map = woodTex;
  mat.roughness = .55;
  mat.metalness = 0;
  mat.needsUpdate = true;
}

export function buildGun(w, mats) {
  const G = gunGeo(w), g = new THREE.Group(), accent = w.accent ? accentMat(w) : null;
  const M = { b: mats.base, m: mats.metal, d: mats.dark, a: accent || mats.metal, g: shared('g'), l: shared('l'), r: shared('r'), p: shared('p') };
  const fill = (parent, parts) => { for (const k in parts) parent.add(new THREE.Mesh(parts[k], M[k])); };
  fill(g, G.main);
  for (const [name, pos, parts] of G.subs) {
    const o = new THREE.Group();
    o.position.set(...pos);
    fill(o, parts);
    g.add(o);
    g.userData[name] = o;
  }
  g.userData.accent = accent;
  return g;
}
