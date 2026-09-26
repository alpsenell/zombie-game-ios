import * as THREE from './vendor/three.module.js';
import { WEAPONS, buildGun } from './weapons.js';

const SKIN_TONES = [0xf1c7a5, 0xe0ac7e, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbb4, 0xa0765a, 0x3d2616];
const HAIR_COLORS = [0x1a1410, 0x4a2e1a, 0xd8b060, 0x9a3a1a, 0x8a8a8a, 0xeeeeee, 0x2a6adf, 0xe05a9a];
const OUTFIT_COLORS = [0x3b4a2e, 0x1d2733, 0x6b1f1c, 0x3a3a3a, 0xc9b48a, 0xe8e4d8, 0x121316, 0x2e5d8a, 0xb33a2a, 0xd98a1f, 0x5a7a2a, 0x6b4ea0, 0xe0c23a, 0x1f8a7a, 0xd66a9a, 0x7a5a3a];
const PANTS_COLORS = [0x23262b, 0x2e3f5c, 0x4a4230, 0x3d4a2a, 0x6a6258, 0x121316, 0x7a2a2a, 0xb8a888];

export const WEAPON_SKINS = [
  { name: 'FACTORY', base: 0xa38b62, metal: 0x3a464b, dark: 0x1a2024 },
  { name: 'DESERT', base: 0xc9a86a, metal: 0x8a7550, dark: 0x4a3c28, camo: ['#c9a86a', '#a8844a', '#e0c890'], cost: 150 },
  { name: 'ARCTIC', base: 0xe8eef0, metal: 0xb8c4c8, dark: 0x5a646a, camo: ['#eef3f5', '#c8d2d6', '#9aa6ac'], cost: 300 },
  { name: 'WOODLAND', base: 0x4a5a30, metal: 0x3a3a2a, dark: 0x1e2016, camo: ['#4a5a30', '#2e3a1e', '#6a5a38', '#1a1a12'], cost: 300 },
  { name: 'CRIMSON', base: 0x9a1a18, metal: 0x3a1210, dark: 0x1a0a0a, cost: 500 },
  { name: 'CARBON', base: 0x222428, metal: 0x2e3238, dark: 0x0e0f11, stripes: true, cost: 600 },
  { name: 'URBAN', base: 0x8a8e92, metal: 0x4a4e52, dark: 0x1e2022, camo: ['#8a8e92', '#5a5e62', '#b8bcc0', '#2a2c2e'], cost: 700 },
  { name: 'NEON', base: 0x14161a, metal: 0x1a1c20, dark: 0x0a0a0c, glow: 0x19f0ff, cost: 1000 },
  { name: 'COBALT', base: 0x1f4fb0, metal: 0x2a3a5a, dark: 0x101828, cost: 800 },
  { name: 'SAKURA', base: 0xf0b0c8, metal: 0xe8e0e4, dark: 0x6a4a58, cost: 900 },
  { name: 'TOXIC', base: 0x3a5a1a, metal: 0x1e2a12, dark: 0x0e140a, glow: 0x7dff3a, req: 'boss:plague' },
  { name: 'BUTCHER', base: 0x5a0e0c, metal: 0x8a949a, dark: 0x2a0606, camo: ['#5a0e0c', '#3a0606', '#7a1a14'], req: 'boss:butcher' },
  { name: 'BLOOD MOON', base: 0x3a0a0a, metal: 0x1a0606, dark: 0x0a0202, glow: 0xff2a1a, req: 'kills:2500' },
  { name: 'OBSIDIAN', base: 0x0c0c10, metal: 0x2a2a34, dark: 0x050508, glow: 0xa66bff, req: 'level:20' },
  { name: 'GOLD', base: 0xd8a72a, metal: 0xf0c850, dark: 0x6a4a10, metallic: true, req: 'wave:30' },
  { name: 'DIAMOND', base: 0xbfefff, metal: 0xe8faff, dark: 0x5a8a9a, metallic: true, glow: 0x6fe3ff, req: 'level:35' },
];

export const TITLES = ['ROOKIE', 'SURVIVOR', 'SCAVENGER', 'SHARPSHOOTER', 'HEADHUNTER', 'BRUISER BANE', "BUTCHER'S BANE", 'PLAGUE DOCTOR', 'GIANT SLAYER', 'NIGHTMARE WALKER', 'HORDE BREAKER', 'UNKILLABLE', 'VETERAN', 'WARLORD', 'LEGEND', 'LAST STAND'];

export const SLOTS = [
  { id: 'skin', label: 'SKIN', bits: 3, items: SKIN_TONES.map((c, i) => ({ name: 'TONE ' + (i + 1), swatch: c })) },
  { id: 'hair', label: 'HAIR', bits: 3, items: [
    { name: 'BUZZ' }, { name: 'SHORT' }, { name: 'SPIKY', cost: 150 }, { name: 'LONG', cost: 250 },
    { name: 'PONYTAIL', cost: 250 }, { name: 'AFRO', cost: 300 }, { name: 'MOHAWK', cost: 500 }, { name: 'BALD' }] },
  { id: 'hairColor', label: 'HAIR COLOR', bits: 3, items: [
    { name: 'BLACK' }, { name: 'BROWN' }, { name: 'BLONDE' }, { name: 'AUBURN', cost: 100 },
    { name: 'GREY', cost: 100 }, { name: 'PLATINUM', req: 'level:5' }, { name: 'ELECTRIC', cost: 400 }, { name: 'BUBBLEGUM', cost: 400 }].map((it, i) => ({ ...it, swatch: HAIR_COLORS[i] })) },
  { id: 'head', label: 'HEADGEAR', bits: 3, items: [
    { name: 'NONE' }, { name: 'CAP' }, { name: 'BEANIE', cost: 150 }, { name: 'BANDANA', cost: 200 },
    { name: 'COWBOY HAT', cost: 600 }, { name: 'COMBAT HELMET', req: 'boss:abomination' }, { name: 'GAS MASK', req: 'wave:15' }, { name: 'BONE CROWN', req: 'boss:plague' }] },
  { id: 'face', label: 'FACE', bits: 3, items: [
    { name: 'CLEAN' }, { name: 'STUBBLE' }, { name: 'FULL BEARD', cost: 150 }, { name: 'SCAR', cost: 200 },
    { name: 'WAR PAINT', cost: 300 }, { name: 'SHADES', cost: 400 }, { name: 'GOGGLES', req: 'level:8' }, { name: 'SKULL MASK', req: 'nightmare:10' }] },
  { id: 'top', label: 'OUTFIT', bits: 3, items: [
    { name: 'T-SHIRT' }, { name: 'HOODIE' }, { name: 'LEATHER JACKET', cost: 500 }, { name: 'TACTICAL VEST', cost: 800 },
    { name: 'MILITARY', req: 'wave:20' }, { name: 'TRENCH COAT', cost: 1200 }, { name: 'TRACKSUIT', cost: 400 }, { name: 'HAZMAT', req: 'boss:goliath' }] },
  { id: 'topColor', label: 'OUTFIT COLOR', bits: 4, items: [
    'OLIVE', 'NAVY', 'MAROON', 'CHARCOAL', 'SAND', 'BONE', 'BLACK', 'DENIM', 'RED', 'ORANGE', 'MOSS', 'VIOLET', 'HAZARD', 'TEAL', 'ROSE', 'BROWN']
    .map((name, i) => ({ name, swatch: OUTFIT_COLORS[i], cost: i < 4 ? 0 : i < 8 ? 100 : 250 })) },
  { id: 'pants', label: 'PANTS', bits: 3, items: ['CHARCOAL', 'DENIM', 'KHAKI', 'OLIVE', 'STONE', 'BLACK', 'OXBLOOD', 'CREAM']
    .map((name, i) => ({ name, swatch: PANTS_COLORS[i], cost: i < 3 ? 0 : 100 })) },
  { id: 'boots', label: 'BOOTS', bits: 2, items: [{ name: 'COMBAT' }, { name: 'SNEAKERS', cost: 100 }, { name: 'WORK BOOTS', cost: 150 }, { name: 'HI-TOPS', cost: 400 }] },
  { id: 'back', label: 'BACK', bits: 3, items: [
    { name: 'NONE' }, { name: 'BACKPACK', cost: 200 }, { name: 'BEDROLL', cost: 250 }, { name: 'RADIO PACK', cost: 500 },
    { name: 'KATANA', req: 'heads:250' }, { name: 'CAPE', cost: 1000 }, { name: 'GUITAR', cost: 800 }, { name: 'CLEAVER', req: 'boss:butcher' }] },
  { id: 'gun', label: 'WEAPON SKIN', bits: 4, items: WEAPON_SKINS.map(s => ({ name: s.name, swatch: s.base, cost: s.cost, req: s.req })) },
  { id: 'title', label: 'TITLE', bits: 4, items: [
    { req: '' }, { req: 'level:3' }, { cost: 300 }, { req: 'heads:100' }, { req: 'heads:500' }, { req: 'boss:abomination' }, { req: 'boss:butcher' }, { req: 'boss:plague' },
    { req: 'boss:goliath' }, { req: 'nightmare:10' }, { req: 'kills:5000' }, { req: 'wave:30' }, { req: 'veteran:15' }, { req: 'level:25' }, { req: 'level:40' }, { req: 'wave:50' }]
    .map((it, i) => ({ ...it, name: TITLES[i] })) },
  { id: 'primary', label: 'PRIMARY', bits: 4, hidden: true, items: WEAPONS.map(w => ({ name: w.name })) },
];

export const DEFAULT_LOADOUT = Object.fromEntries(SLOTS.map(s => [s.id, 0]));
DEFAULT_LOADOUT.skin = 1;
DEFAULT_LOADOUT.hair = 1;
DEFAULT_LOADOUT.hairColor = 1;

export function encodeLoadout(loadout, level = 1) {
  let code = 1, base = 4;
  for (const s of SLOTS) {
    const size = 2 ** s.bits;
    code += (Math.max(0, Math.min(size - 1, loadout[s.id] | 0))) * base;
    base *= size;
  }
  return code + Math.max(1, Math.min(255, level | 0)) * base;
}

export function decodeLoadout(code) {
  code = Number(code);
  if (!Number.isSafeInteger(code) || code <= 0 || code % 4 !== 1) return null;
  let rest = Math.floor(code / 4);
  const loadout = {};
  for (const s of SLOTS) {
    const size = 2 ** s.bits, v = rest % size;
    rest = Math.floor(rest / size);
    loadout[s.id] = v < s.items.length ? v : 0;
  }
  return { loadout, level: Math.max(1, rest % 256) };
}

export function describeLoadout(l) {
  const n = id => SLOTS.find(s => s.id === id).items[l[id]]?.name || '';
  const parts = [
    ['OUTFIT', n('topColor') + ' ' + n('top')],
    ['HAIR', l.hair === 7 ? 'BALD' : n('hairColor') + ' ' + n('hair')],
    ['HEADGEAR', n('head')],
    ['FACE', n('face')],
    ['BACK', n('back')],
    ['WEAPON', (l.gun ? n('gun') + ' ' : '') + (WEAPONS[l.primary]?.name || 'M4A1')],
  ];
  return parts.filter(([, v]) => v && v !== 'NONE' && v !== 'CLEAN');
}

const matCache = new Map();
function m(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: .05, ...o }));
  return matCache.get(key);
}
const camoCache = new Map();
export function skinTexture(skin) {
  if (!skin.camo && !skin.stripes) return null;
  if (camoCache.has(skin.name)) return camoCache.get(skin.name);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  if (skin.stripes) {
    cx.fillStyle = '#1c1e22'; cx.fillRect(0, 0, 128, 128);
    for (let i = -128; i < 256; i += 8) { cx.fillStyle = i % 16 ? '#2a2d33' : '#16181b'; cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + 4, 0); cx.lineTo(i + 132, 128); cx.lineTo(i + 128, 128); cx.fill(); }
  } else {
    cx.fillStyle = skin.camo[0]; cx.fillRect(0, 0, 128, 128);
    let seed = skin.name.length * 97;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 1; k < skin.camo.length; k++) for (let i = 0; i < 14; i++) {
      cx.fillStyle = skin.camo[k];
      cx.beginPath();
      const x = rnd() * 128, y = rnd() * 128;
      for (let a = 0; a < 7; a++) { const r = 8 + rnd() * 14, t = a / 7 * Math.PI * 2; cx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r * .7); }
      cx.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  camoCache.set(skin.name, t);
  return t;
}
export function paintGunMaterials(mats, skinIndex) {
  const s = WEAPON_SKINS[skinIndex] || WEAPON_SKINS[0], map = skinTexture(s);
  for (const [k, color] of [['base', s.base], ['metal', s.metal], ['dark', s.dark]]) {
    const mt = mats[k];
    if (!mt) continue;
    mt.color.setHex(map && k === 'base' ? 0xffffff : color);
    mt.map = k === 'base' ? map : null;
    mt.metalness = s.metallic ? .9 : k === 'base' ? .1 : .6;
    mt.roughness = s.metallic ? .25 : k === 'base' ? .7 : .4;
    mt.emissive?.setHex(s.glow && k !== 'metal' ? s.glow : 0);
    mt.emissiveIntensity = s.glow ? (k === 'dark' ? .6 : .07) : 0;
    mt.needsUpdate = true;
  }
}
export function outfitColors(l) {
  const topStyle = l.top, top = OUTFIT_COLORS[l.topColor] ?? OUTFIT_COLORS[0];
  const gloved = topStyle === 3 || topStyle === 4 || topStyle === 7 || topStyle === 2;
  return { sleeve: topStyle === 0 ? SKIN_TONES[l.skin] : top, glove: gloved ? 0x16181b : SKIN_TONES[l.skin] ?? SKIN_TONES[1] };
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 6),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  torus: new THREE.TorusGeometry(1, .18, 8, 20),
  taper: new THREE.CylinderGeometry(.707, .6, 1, 4, 1).rotateY(Math.PI / 4),
};
const UP = new THREE.Vector3(0, -1, 0);
function solveArm(upper, el, shoulder, target, pole, l1, l2) {
  const toT = target.clone().sub(shoulder);
  const d = Math.min(toT.length(), l1 + l2 - .002);
  const dir = toT.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const elbow = shoulder.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  const hand = shoulder.clone().addScaledVector(dir, d);
  const q1 = new THREE.Quaternion().setFromUnitVectors(UP, elbow.clone().sub(shoulder).normalize());
  upper.quaternion.copy(q1);
  const d2 = hand.sub(elbow).normalize().applyQuaternion(q1.clone().invert());
  el.quaternion.setFromUnitVectors(UP, d2);
}
function part(parent, geo, material, [x, y, z], [sx, sy, sz], rot) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  o.castShadow = true;
  parent.add(o);
  return o;
}
function limb(parent, material, len, r, pos, rot) {
  const j = new THREE.Group();
  j.position.set(...pos);
  if (rot) j.rotation.set(...rot);
  parent.add(j);
  part(j, G.capsule, material, [0, -len / 2, 0], [r, len / 2 / 1.5 + r * .1, r]);
  return j;
}

export function buildSurvivor(l) {
  const root = new THREE.Group();
  const skinC = SKIN_TONES[l.skin] ?? SKIN_TONES[1], hairC = HAIR_COLORS[l.hairColor] ?? HAIR_COLORS[0];
  const topC = OUTFIT_COLORS[l.topColor] ?? OUTFIT_COLORS[0], pantsC = PANTS_COLORS[l.pants] ?? PANTS_COLORS[0];
  const skin = m(skinC, { roughness: .6 }), hairM = m(hairC, { roughness: .9 });
  const style = l.top, hazmat = style === 7;
  const top = m(topC, { roughness: style === 2 ? .35 : .85, metalness: style === 2 ? .15 : .02 });
  const topDark = m(new THREE.Color(topC).multiplyScalar(.6).getHex(), { roughness: .9 });
  const pants = hazmat ? top : m(pantsC, { roughness: .9 });
  const under = m(0x2a2e30, { roughness: .9 });
  const glove = m(0x16181b, { roughness: .8 });
  const black = m(0x0b0c0e, { roughness: .5 });
  const gloved = [2, 3, 4, 7].includes(style);
  const longSleeve = style !== 0;
  const body = new THREE.Group();
  root.add(body);

  const bootC = [[0x16181b, 0x0b0c0e], [0xe8e8e8, 0x2e5d8a], [0x6a4428, 0x2a1a0e], [0xb82a22, 0xf2f2f2]][l.boots] || [0x16181b, 0x0b0c0e];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .11, .9, 0); body.add(hip);
    part(hip, G.capsule, pants, [0, -.21, 0], [.088, .155, .092]);
    const knee = new THREE.Group(); knee.position.set(0, -.42, 0); hip.add(knee);
    part(knee, G.capsule, pants, [0, -.2, 0], [.074, .15, .077]);
    part(knee, G.box, hazmat ? black : m(bootC[0]), [0, -.41, .04], [.13, .11, .26]);
    part(knee, G.box, hazmat ? black : m(bootC[1]), [0, -.465, .04], [.136, .03, .27]);
    if (l.boots === 0 || l.boots === 2) part(knee, G.box, hazmat ? black : m(bootC[0]), [0, -.32, 0], [.125, .14, .15]);
  }
  part(body, G.box, pants, [0, .93, 0], [.34, .18, .21]);
  part(body, G.box, m(0x1a1410), [0, 1.0, 0], [.35, .045, .22]);
  part(body, G.box, m(0x9a8a60, { metalness: .6, roughness: .3 }), [0, 1.0, .112], [.05, .035, .01]);

  const torso = new THREE.Group(); torso.position.y = 1.02; body.add(torso);
  const chest = style === 3 ? under : top;
  part(torso, G.taper, chest, [0, .25, 0], [.44, .52, .24]);
  part(torso, G.sphere, chest, [0, .48, 0], [.22, .06, .12]);
  if (style === 1) {
    part(torso, G.hemi, topDark, [0, .5, -.09], [.17, .16, .11], [-.4, 0, 0]);
    part(torso, G.box, topDark, [0, .1, .118], [.24, .13, .01]);
    for (const s of [-1, 1]) part(torso, G.cyl, m(0xeeeeee), [s * .05, .36, .12], [.006, .12, .006]);
  }
  if (style === 2) {
    for (const s of [-1, 1]) part(torso, G.box, topDark, [s * .08, .42, .117], [.1, .14, .01], [0, 0, s * .5]);
    part(torso, G.box, m(0xcfcfcf, { metalness: .8, roughness: .2 }), [.02, .22, .118], [.012, .42, .005]);
  }
  if (style === 3) {
    part(torso, G.taper, top, [0, .26, 0], [.48, .42, .29]);
    for (let i = -1; i <= 1; i++) part(torso, G.box, topDark, [i * .12, .14, .14], [.1, .12, .05]);
    part(torso, G.box, topDark, [-.1, .38, .14], [.08, .06, .03]);
  }
  if (style === 4) {
    for (const s of [-1, 1]) part(torso, G.box, topDark, [s * .1, .34, .118], [.12, .1, .02]);
    part(torso, G.box, topDark, [0, .03, 0], [.41, .06, .24]);
    part(torso, G.box, topDark, [.13, .2, -.02], [.13, .18, .25]);
  }
  if (style === 5) {
    part(torso, G.taper, top, [0, -.26, 0], [.46, .62, .29], [Math.PI, 0, 0]);
    for (const s of [-1, 1]) part(torso, G.box, topDark, [s * .09, .38, .12], [.1, .22, .02], [0, 0, s * .35]);
    part(torso, G.box, topDark, [0, .02, 0], [.42, .05, .25]);
  }
  if (style === 6) {
    for (const s of [-1, 1]) part(torso, G.box, m(0xf2f2f2), [s * .2, .25, 0], [.012, .48, .235]);
    part(torso, G.box, m(0xf2f2f2), [0, .47, .1], [.2, .03, .03]);
  }
  if (hazmat) part(torso, G.box, m(0x111111), [0, .3, .118], [.14, .09, .01]);

  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .235, .45, 0); torso.add(sh);
    part(sh, G.sphere, style === 3 ? under : longSleeve ? top : chest, [0, -.01, 0], [.075, .07, .075]);
    const upper = limb(sh, style === 3 ? under : longSleeve || style === 0 ? top : skin, .29, .058, [0, 0, 0]);
    if (style === 0) part(upper, G.capsule, skin, [0, -.22, 0], [.052, .05, .052]);
    const el = new THREE.Group(); el.position.y = -.29; upper.add(el);
    part(el, G.capsule, style === 3 ? under : longSleeve ? top : skin, [0, -.12, 0], [.05, .09, .05]);
    part(el, G.box, gloved ? glove : skin, [0, -.28, .01], [.065, .1, .085]);
    arms[s] = { sh, upper, el };
  }

  const neck = part(torso, G.cyl, skin, [0, .53, 0], [.055, .08, .055]);
  neck.castShadow = false;
  const head = new THREE.Group(); head.position.set(0, .56, .01); torso.add(head);
  part(head, G.sphere, skin, [0, .14, 0], [.118, .14, .125]);
  part(head, G.sphere, skin, [0, .065, .035], [.085, .07, .085]);
  for (const s of [-1, 1]) {
    part(head, G.sphere, skin, [s * .12, .13, -.005], [.025, .04, .02]);
    part(head, G.sphere, m(0xf4f4f0), [s * .045, .16, .108], [.02, .014, .01]);
    part(head, G.sphere, black, [s * .045, .16, .116], [.009, .009, .006]);
    part(head, G.box, hairM, [s * .047, .195, .114], [.045, .01, .01]);
  }
  part(head, G.box, skin, [0, .125, .125], [.028, .045, .03]);
  part(head, G.box, m(new THREE.Color(skinC).multiplyScalar(.65).getHex()), [0, .07, .114], [.045, .008, .01]);

  const hairTop = (sy = .17) => part(head, G.hemi, hairM, [0, .115, -.008], [.13, sy, .135]);
  const covered = [2, 4, 5].includes(l.head);
  const h = covered && [2, 5, 6].includes(l.hair) ? 1 : l.hair;
  if (h === 0) hairTop(.16);
  if (h === 1) { hairTop(.18); part(head, G.box, hairM, [0, .14, -.08], [.23, .14, .08]); }
  if (h === 2) { hairTop(.18); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(head, G.cone, hairM, [Math.cos(a) * .07, .27, Math.sin(a) * .07 - .01], [.035, .09, .035], [Math.sin(a) * .5, 0, -Math.cos(a) * .5]); } }
  if (h === 3) { hairTop(.185); part(head, G.box, hairM, [0, .02, -.1], [.25, .3, .06]); for (const s of [-1, 1]) part(head, G.box, hairM, [s * .125, .06, -.02], [.03, .22, .12]); }
  if (h === 4) { hairTop(.18); part(head, G.capsule, hairM, [0, .05, -.16], [.04, .09, .04], [.5, 0, 0]); part(head, G.torus, m(0xb33a2a), [0, .14, -.13], [.03, .03, .03]); }
  if (h === 5) part(head, G.sphere, hairM, [0, .21, -.03], [.2, .17, .19]);
  if (h === 6) for (let i = 0; i < 6; i++) part(head, G.box, hairM, [0, .28 - Math.abs(i - 2.5) * .012, .08 - i * .045], [.035, .09, .04]);
  if (l.face === 1) part(head, G.sphere, m(new THREE.Color(hairC).lerp(new THREE.Color(skinC), .55).getHex()), [0, .062, .037], [.089, .073, .089]);
  if (l.face === 2) { part(head, G.sphere, hairM, [0, .05, .045], [.1, .085, .092]); part(head, G.box, hairM, [0, .088, .118], [.07, .016, .018]); for (const s of [-1, 1]) part(head, G.box, hairM, [s * .1, .1, .02], [.03, .1, .08]); }
  if (l.face === 3) part(head, G.box, m(0x8a2a22), [.045, .16, .122], [.008, .09, .008], [0, 0, .35]);
  if (l.face === 4) for (const s of [-1, 1]) { part(head, G.box, black, [s * .045, .13, .118], [.06, .012, .01]); part(head, G.box, m(0xb33a2a), [s * .045, .115, .116], [.06, .01, .01]); }
  if (l.face === 5) { for (const s of [-1, 1]) part(head, G.box, black, [s * .045, .16, .122], [.06, .035, .012]); part(head, G.box, black, [0, .17, .122], [.03, .008, .01]); }
  if (l.face === 6) { part(head, G.torus, black, [0, .2, 0], [.125, .125, .1], [Math.PI / 2, 0, 0]); for (const s of [-1, 1]) part(head, G.cyl, m(0xff9a3a, { emissive: 0xff7a1a, emissiveIntensity: .6, metalness: .3, roughness: .1 }), [s * .045, .2, .12], [.035, .03, .035], [Math.PI / 2, 0, 0]); }
  if (l.face === 7) { part(head, G.box, m(0xe8e4d8), [0, .06, .085], [.18, .11, .1]); for (let i = -2; i <= 2; i++) part(head, G.box, black, [i * .025, .06, .136], [.006, .06, .004]); }

  if (l.head === 1) { const cc = m(OUTFIT_COLORS[(l.topColor + 1) % 16]); part(head, G.hemi, cc, [0, .13, -.005], [.137, .17, .142]); part(head, G.box, cc, [0, .14, .15], [.2, .015, .12]); }
  if (l.head === 2) { part(head, G.hemi, topDark, [0, .15, -.005], [.138, .15, .142]); part(head, G.cyl, topDark, [0, .165, -.005], [.14, .04, .144]); part(head, G.sphere, topDark, [0, .31, 0], [.035, .035, .035]); }
  if (l.head === 3) { part(head, G.cyl, m(0xb33a2a), [0, .2, 0], [.13, .035, .135]); part(head, G.box, m(0xb33a2a), [0, .19, -.14], [.05, .06, .04], [0, 0, .7]); }
  if (l.head === 4) { const br = m(0x6a4428, { roughness: .9 }); part(head, G.cyl, br, [0, .21, 0], [.26, .015, .26]); part(head, G.cyl, br, [0, .28, 0], [.12, .13, .12]); part(head, G.cyl, m(0x2a1a0e), [0, .235, 0], [.122, .025, .122]); }
  if (l.head === 5) { const hm = m(0x3b4a2e, { roughness: .6 }); part(head, G.hemi, hm, [0, .15, -.005], [.15, .16, .16]); part(head, G.cyl, hm, [0, .15, -.005], [.152, .02, .162]); for (const s of [-1, 1]) part(head, G.box, black, [s * .12, .06, .02], [.01, .14, .015]); }
  if (l.head === 6) { part(head, G.box, black, [0, .12, .1], [.2, .16, .08]); for (const s of [-1, 1]) part(head, G.cyl, m(0x5a8a7a, { metalness: .5, roughness: .1 }), [s * .05, .165, .145], [.035, .015, .035], [Math.PI / 2, 0, 0]); part(head, G.cyl, m(0x3a3a3a, { metalness: .5 }), [0, .06, .17], [.045, .06, .045], [Math.PI / 2, 0, 0]); part(head, G.torus, black, [0, .16, -.01], [.13, .13, .1], [Math.PI / 2, 0, 0]); }
  if (l.head === 7) { for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; part(head, G.cone, m(0xd9d0b4), [Math.sin(a) * .11, .33, Math.cos(a) * .11], [.025, .12, .025], [Math.cos(a) * .25, 0, -Math.sin(a) * .25]); } part(head, G.torus, m(0x7dff3a, { emissive: 0x5aff2a, emissiveIntensity: 1.2 }), [0, .27, 0], [.12, .12, .12], [Math.PI / 2, 0, 0]); }

  const back = m(0x4a4a34, { roughness: .9 });
  if (l.back === 1) { part(torso, G.box, back, [0, .26, -.2], [.32, .38, .16]); part(torso, G.box, m(0x3a3a28), [0, .12, -.29], [.24, .14, .05]); for (const s of [-1, 1]) part(torso, G.box, black, [s * .1, .3, .118], [.03, .4, .01]); }
  if (l.back === 2) part(torso, G.cyl, m(0x5a6a3a), [0, .5, -.17], [.07, .38, .07], [0, 0, Math.PI / 2]);
  if (l.back === 3) { part(torso, G.box, m(0x3a4030), [0, .24, -.2], [.28, .34, .15]); part(torso, G.cyl, black, [.1, .62, -.22], [.008, .5, .008]); part(torso, G.box, m(0x9a3a1a, { emissive: 0xff3a1a, emissiveIntensity: .8 }), [-.06, .34, -.28], [.03, .03, .01]); }
  if (l.back === 4) { part(torso, G.box, m(0xcfd6da, { metalness: .9, roughness: .2 }), [0, .2, -.15], [.025, .9, .05], [0, 0, .7]); part(torso, G.box, black, [.27, .52, -.15], [.035, .22, .04], [0, 0, .7]); }
  if (l.back === 5) part(torso, G.box, m(0x7a1a1a, { roughness: 1, side: THREE.DoubleSide }), [0, -.05, -.14], [.46, 1, .02], [.12, 0, 0]);
  if (l.back === 6) { const w = m(0x8a4a1a, { roughness: .4 }); part(torso, G.cyl, w, [-.05, .05, -.16], [.16, .06, .16], [Math.PI / 2, 0, 0]); part(torso, G.cyl, w, [.03, .22, -.16], [.12, .06, .12], [Math.PI / 2, 0, 0]); part(torso, G.box, m(0x2a1a0e), [.14, .5, -.16], [.04, .45, .02], [0, 0, -.35]); }
  if (l.back === 7) { part(torso, G.box, m(0x9aa4a8, { metalness: .9, roughness: .25 }), [0, .25, -.16], [.03, .5, .28], [0, 0, -.5]); part(torso, G.box, m(0x5a0a08), [.05, .12, -.16], [.032, .15, .282], [0, 0, -.5]); }

  const wdef = WEAPONS[l.primary] || WEAPONS[0];
  const gm = { base: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), dark: new THREE.MeshStandardMaterial() };
  paintGunMaterials(gm, l.gun);
  if (wdef.id === 'r870' && !l.gun) gm.base.color.setHex(0x8a5428);
  const gun = new THREE.Group();
  const model = buildGun(wdef, gm);
  model.rotation.y = Math.PI;
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  gun.add(model);
  const pistol = wdef.id === 'deagle', heavy = wdef.id === 'dragon';
  gun.position.set(pistol ? -.02 : -.07, pistol ? 1.28 : heavy ? 1.08 : 1.2, pistol ? .36 : .26);
  gun.rotation.set(pistol ? .25 : .42, .16, 0);
  body.add(gun);
  root.updateMatrixWorld(true);
  const torsoOffset = new THREE.Vector3(0, 1.02, 0);
  const grip = model.localToWorld(new THREE.Vector3(...wdef.grip)).sub(torsoOffset);
  const guard = model.localToWorld(new THREE.Vector3(...wdef.guard)).sub(torsoOffset);
  solveArm(arms[-1].upper, arms[-1].el, arms[-1].sh.position, grip, new THREE.Vector3(-1, -.4, -.8), .29, .29);
  solveArm(arms[1].upper, arms[1].el, arms[1].sh.position, guard, new THREE.Vector3(1, -1, -.2), .29, .29);

  root.userData = { torso, head, gun, arms };
  return root;
}

export function createPreview() {
  const canvas = document.createElement('canvas');
  canvas.className = 'char-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x2a2016, 1.6));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.6);
  key.position.set(1.5, 3, 3); key.castShadow = true; key.shadow.mapSize.set(512, 512);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a3a, 2.4);
  rim.position.set(-2, 2, -2.5);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x5ab8ff, 1.4);
  rim2.position.set(2.5, 1.5, -2);
  scene.add(rim2);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(.75, 40), new THREE.ShadowMaterial({ opacity: .45 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .66, 48), new THREE.MeshBasicMaterial({ color: 0xe5483a, transparent: true, opacity: .55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .005;
  scene.add(ring);
  const cam = new THREE.PerspectiveCamera(28, 1, .1, 30);
  let model = null, code = -1, spin = .5, auto = true, drag = null, w = 0, h = 0, t = 0, mode = 'full';

  function show(loadout, force) {
    const c = encodeLoadout(loadout);
    if (c === code && !force) return;
    code = c;
    if (model) scene.remove(model);
    model = buildSurvivor(loadout);
    scene.add(model);
  }
  function frame(kind) {
    mode = kind;
    if (kind === 'portrait') { cam.fov = 24; cam.position.set(0, 1.66, 1.45); cam.lookAt(0, 1.6, 0); }
    else if (kind === 'weapon') { cam.fov = 30; cam.position.set(0, .5, 3.3); cam.lookAt(0, .12, 0); }
    else { cam.fov = 28; cam.position.set(0, 1.12, 5.1); cam.lookAt(0, 1.02, 0); }
    ring.visible = floor.visible = kind === 'full';
    cam.updateProjectionMatrix();
  }
  function size(cw, ch) {
    if (cw === w && ch === h) return;
    w = cw; h = ch;
    renderer.setSize(cw, ch, false);
    cam.aspect = cw / ch;
    cam.updateProjectionMatrix();
  }
  function render(dt = 0) {
    if (!model || !canvas.isConnected || !w) return;
    t += dt;
    if (auto && !drag) spin += dt * .5;
    model.rotation.y = spin;
    if (model.userData.torso) {
      model.userData.torso.position.y = 1.02 + Math.sin(t * 2) * .006;
      model.userData.head.rotation.y = Math.sin(t * .7) * .15;
    } else model.position.y = Math.sin(t * 1.6) * .03;
    renderer.render(scene, cam);
  }
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * .012; });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    canvas,
    attach(el, kind = 'full', autoSpin = true) {
      if (canvas.parentElement !== el) el.appendChild(canvas);
      auto = autoSpin;
      frame(kind);
      const r = el.getBoundingClientRect();
      size(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    },
    detach() { canvas.remove(); },
    show,
    render,
    showWeapon(gunGroup) {
      code = -2;
      if (model) scene.remove(model);
      const holder = new THREE.Group(), inner = new THREE.Group();
      inner.add(gunGroup);
      inner.scale.setScalar(1.25);
      inner.position.set(0, .15, .3);
      holder.add(inner);
      model = holder;
      scene.add(model);
    },
    get visible() { return canvas.isConnected && canvas.offsetParent !== null; },
    thumbnail(loadout, px = 96) {
      const prev = { w, h, mode, spin, auto };
      size(px, px);
      frame('portrait');
      show(loadout);
      model.rotation.y = .35;
      model.userData.torso.position.y = 1.02;
      model.userData.head.rotation.y = 0;
      renderer.render(scene, cam);
      const url = canvas.toDataURL('image/png');
      size(prev.w || 1, prev.h || 1);
      frame(prev.mode);
      spin = prev.spin; auto = prev.auto;
      return url;
    },
  };
}
