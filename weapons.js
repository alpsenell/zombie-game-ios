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
const S = new THREE.SphereGeometry(1, 14, 10);
const T = new THREE.TorusGeometry(1, .22, 8, 20);

export function buildGun(w, mats) {
  const g = new THREE.Group();
  const accent = w.accent ? new THREE.MeshStandardMaterial({ color: w.accent, emissive: w.accent, emissiveIntensity: .8, roughness: .3 }) : null;
  const glass = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: .35 });
  const M = { b: mats.base, m: mats.metal, d: mats.dark, a: accent || mats.metal, g: glass, r: new THREE.MeshBasicMaterial({ color: 0xff2a1a }) };
  const box = (k, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(B, M[k]); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const cyl = (k, x, y, z, r, len, parent = g) => { const o = new THREE.Mesh(C, M[k]); o.position.set(x, y, z); o.scale.set(r, len, r); o.rotation.x = Math.PI / 2; parent.add(o); return o; };
  const ball = (k, x, y, z, r) => { const o = new THREE.Mesh(S, M[k]); o.position.set(x, y, z); o.scale.setScalar(r); g.add(o); return o; };
  const ring = (k, x, y, z, r) => { const o = new THREE.Mesh(T, M[k]); o.position.set(x, y, z); o.scale.setScalar(r); g.add(o); return o; };
  switch (w.id) {
    case 'm4':
      box('m', 0, 0, -.08, .08, .1, .4); box('d', 0, .06, -.14, .045, .02, .52); box('b', 0, -.005, -.44, .09, .09, .32);
      for (let i = 0; i < 4; i++) box('d', 0, -.005, -.34 - i * .07, .092, .015, .04);
      cyl('d', 0, .005, -.72, .015, .28); cyl('d', 0, .005, -.88, .026, .07);
      box('d', 0, -.13, -.13, .055, .2, .09, .28); box('d', 0, -.1, .06, .05, .13, .06, -.35); box('b', 0, -.02, .24, .06, .09, .26);
      box('d', 0, .105, -.07, .05, .06, .09); cyl('g', 0, .11, -.02, .024, .02); ball('r', 0, .112, -.035, .006); box('d', 0, .05, -.58, .02, .04, .02);
      break;
    case 'r870':
      box('m', 0, 0, -.05, .085, .11, .32); box('d', .044, .01, -.07, .02, .05, .12);
      cyl('d', 0, .028, -.55, .024, .72); cyl('m', 0, -.025, -.47, .018, .56);
      g.userData.pump = box('b', 0, -.028, -.45, .085, .075, .22);
      box('b', 0, -.09, .1, .055, .12, .07, -.4); box('b', 0, -.06, .3, .065, .09, .3, -.12); ball('a', 0, .05, -.9, .01);
      break;
    case 'mp7':
      box('m', 0, 0, -.1, .07, .1, .3); box('d', 0, .06, -.1, .04, .02, .3); cyl('d', 0, .01, -.33, .016, .14); cyl('d', 0, .01, -.41, .022, .05);
      box('d', 0, -.17, .02, .045, .24, .06); box('d', 0, -.1, -.2, .04, .1, .04); box('b', 0, -.01, .14, .04, .05, .2);
      box('d', 0, .1, -.12, .04, .05, .07); ball('r', 0, .103, -.09, .006);
      break;
    case 'ak':
      box('d', 0, 0, -.06, .075, .1, .42); box('m', 0, .05, -.08, .07, .02, .3); box('b', 0, -.005, -.42, .08, .08, .24);
      cyl('m', 0, .045, -.42, .014, .26); cyl('d', 0, .005, -.68, .015, .3); box('d', 0, .05, -.8, .012, .05, .012);
      box('d', 0, -.14, -.14, .05, .14, .08, .3); box('d', 0, -.25, -.1, .05, .12, .08, .65);
      box('b', 0, -.1, .07, .05, .13, .06, -.35); box('b', 0, -.05, .28, .06, .1, .3, -.12);
      break;
    case 'deagle':
      box('m', 0, .03, -.14, .05, .07, .3); box('d', 0, -.015, -.13, .045, .05, .24); cyl('d', 0, .03, -.3, .014, .02);
      box('b', 0, -.1, 0, .045, .15, .07, -.25); box('d', 0, -.065, -.07, .01, .05, .06); box('d', 0, .075, -.26, .01, .015, .01); box('d', 0, .075, -.02, .03, .015, .01);
      break;
    case 'boom':
      for (const x of [-.022, .022]) cyl('d', x, .02, -.5, .021, .72);
      box('m', 0, 0, -.06, .075, .085, .16); box('b', 0, -.03, -.34, .07, .05, .24);
      box('b', 0, -.08, .09, .055, .12, .07, -.4); box('b', 0, -.05, .28, .065, .1, .3, -.15);
      box('m', 0, .055, -.02, .02, .02, .05);
      break;
    case 'm24':
      box('b', 0, -.03, -.08, .07, .1, .78); cyl('d', 0, .02, -.66, .016, .7); box('m', 0, .02, -.03, .06, .07, .22);
      cyl('d', 0, .11, -.08, .032, .34); cyl('d', 0, .11, -.27, .042, .06); cyl('d', 0, .11, .1, .038, .05); cyl('g', 0, .11, -.3, .036, .01);
      box('d', 0, .065, -.08, .02, .04, .03); box('d', 0, .065, .02, .02, .04, .03);
      g.userData.pump = box('m', .05, .03, .02, .05, .015, .015); ball('m', .08, .03, .02, .015);
      box('b', 0, -.09, .08, .05, .12, .06, -.35);
      break;
    case 'm249':
      box('m', 0, 0, -.06, .1, .13, .38); box('d', 0, .085, -.1, .06, .05, .2); cyl('d', 0, .01, -.6, .021, .5);
      box('d', 0, .045, -.5, .05, .025, .3); box('b', -.02, -.14, -.08, .13, .13, .14); box('d', 0, -.11, .08, .05, .13, .06, -.35);
      box('b', 0, -.03, .26, .06, .1, .26, -.1); for (const x of [-.02, .02]) cyl('d', x, -.04, -.72, .007, .2);
      break;
    case 'm79':
      cyl('m', 0, .02, -.4, .046, .42); cyl('d', 0, .02, -.61, .05, .02); box('m', 0, 0, -.13, .08, .1, .14);
      box('b', 0, -.07, .08, .055, .13, .07, -.4); box('b', 0, -.04, .24, .07, .11, .28, -.1); box('d', 0, .085, -.24, .03, .04, .01);
      break;
    case 'flamer':
      box('m', 0, 0, -.1, .08, .1, .3); cyl('b', 0, -.13, -.1, .06, .34); cyl('d', 0, .02, -.46, .026, .46); cyl('m', 0, .02, -.7, .034, .05);
      ball('a', 0, -.02, -.72, .014); box('d', 0, -.12, .1, .05, .13, .06, -.35); box('b', 0, -.02, .24, .06, .09, .24);
      g.userData.pilot = new THREE.Mesh(S, new THREE.MeshBasicMaterial({ color: 0x5ab0ff })); g.userData.pilot.position.set(0, -.02, -.735); g.userData.pilot.scale.setScalar(.012); g.add(g.userData.pilot);
      break;
    case 'tesla':
      box('d', 0, 0, -.08, .09, .11, .36); cyl('m', 0, .01, -.44, .018, .5);
      for (let i = 0; i < 4; i++) ring('a', 0, .01, -.28 - i * .1, .045).rotation.y = 0;
      ball('a', 0, .03, .09, .045); for (const x of [-.03, .03]) box('m', x, .01, -.7, .012, .012, .06);
      box('d', 0, -.12, .06, .05, .13, .06, -.35); box('b', 0, -.02, .25, .06, .09, .24); box('b', 0, .085, -.1, .06, .03, .2);
      break;
    case 'cryo':
      box('b', 0, 0, -.1, .085, .1, .38); cyl('g', 0, .1, -.06, .045, .26); cyl('a', 0, .1, -.06, .03, .24);
      cyl('m', 0, .005, -.56, .02, .56); for (let i = 0; i < 3; i++) box('m', 0, .005, -.45 - i * .1, .1, .006, .03);
      for (let i = 0; i < 3; i++) ring('a', 0, .005, -.5 - i * .1, .032); cyl('a', 0, .005, -.84, .012, .04);
      box('d', 0, -.12, .06, .05, .13, .06, -.35); box('b', 0, -.02, .24, .06, .09, .24);
      break;
    case 'singularity':
      box('d', 0, 0, -.12, .13, .14, .42); cyl('m', 0, .01, -.44, .07, .2); ring('a', 0, .01, -.55, .09); ring('a', 0, .01, -.42, .075);
      ball('a', 0, .01, -.2, .055); cyl('g', 0, .01, -.2, .06, .12); box('m', 0, .09, -.12, .03, .03, .36);
      box('d', 0, -.14, .08, .06, .14, .07, -.35); box('b', 0, -.03, .26, .07, .1, .24);
      break;
    case 'dragon': {
      box('d', 0, 0, .02, .16, .15, .26); box('m', 0, .11, -.02, .03, .07, .14); box('d', 0, .15, -.02, .12, .02, .03);
      const spin = new THREE.Group(); spin.position.set(0, 0, -.45); g.add(spin);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl('d', Math.cos(a) * .035, Math.sin(a) * .035, 0, .012, .7, spin); }
      cyl('m', 0, 0, .12, .06, .05, spin); cyl('m', 0, 0, -.2, .055, .03, spin); cyl('a', 0, 0, -.35, .052, .015, spin);
      g.userData.spin = spin;
      box('b', 0, -.12, .18, .09, .1, .2); box('d', 0, -.14, .08, .05, .12, .06, -.35);
      break;
    }
  }
  g.userData.accent = accent;
  return g;
}
