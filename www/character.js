import * as THREE from './vendor/three.module.js';
import { WEAPONS, buildGun, WOOD, woodStock } from './weapons.js';

const SKIN_TONES = [0xf1c7a5, 0xe0ac7e, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbb4, 0xa0765a, 0x3d2616];
const HAIR_COLORS = [0x1a1410, 0x4a2e1a, 0xd8b060, 0x9a3a1a, 0x8a8a8a, 0xeeeeee, 0x2a6adf, 0xe05a9a];
const OUTFIT_COLORS = [0x3b4a2e, 0x1d2733, 0x6b1f1c, 0x3a3a3a, 0xc9b48a, 0xe8e4d8, 0x121316, 0x2e5d8a, 0xb33a2a, 0xd98a1f, 0x5a7a2a, 0x6b4ea0, 0xe0c23a, 0x1f8a7a, 0xd66a9a, 0x7a5a3a];
const PANTS_COLORS = [0x23262b, 0x2e3f5c, 0x4a4230, 0x3d4a2a, 0x6a6258, 0x121316, 0x7a2a2a, 0xb8a888];
const EYE_COLORS = [0x4a2c18, 0x7a5a2a, 0x3a70a8, 0x4a7a3e, 0x6f7f8a, 0xb07a1a, 0x7a4ab8];
const ACCENT_COLORS = [null, 0x16171a, 0xefece4, 0xc2a878, 0x55653a, 0xc0302a, 0xf2701a, 0x19c0dc];

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
  { name: 'TIGER', base: 0xd9791a, metal: 0x2a2420, dark: 0x120e0a, stripes: ['#d9791a', '#1a120a', '#b85e10'], req: 'level:3', like: 1 },
  { name: 'JUNGLE', base: 0x2f4a22, metal: 0x2a3020, dark: 0x121810, camo: ['#3a5a26', '#1e3014', '#5a7a30', '#6a5a2a'], req: 'level:6', like: 3 },
  { name: 'MIDNIGHT', base: 0x141a3a, metal: 0x20284a, dark: 0x080a18, camo: ['#161c3e', '#0a0e22', '#2a3464'], req: 'level:9', like: 8 },
  { name: 'HAZARD', base: 0xe0c23a, metal: 0x1a1a1a, dark: 0x0e0e0e, stripes: ['#e0c23a', '#141414', '#e0c23a'], req: 'level:12', like: 5 },
  { name: 'EMERALD', base: 0x1a8a4a, metal: 0x3ac07a, dark: 0x0a3a1e, metallic: true, req: 'level:16', like: 10 },
  { name: 'INFERNO', base: 0x2a0a04, metal: 0x3a1a0a, dark: 0x1a0602, glow: 0xff6a1a, req: 'level:25', like: 12 },
  { name: 'ROSE GOLD', base: 0xe0a090, metal: 0xf0c0b0, dark: 0x7a4a40, metallic: true, req: 'level:30', like: 14 },
  { name: 'PLASMA', base: 0x1a0a24, metal: 0x2a1438, dark: 0x0a0410, glow: 0xff3af0, req: 'level:40', like: 7 },
  { name: 'DARK MATTER', base: 0x06060a, metal: 0x18182a, dark: 0x000000, metallic: true, glow: 0x6a3aff, req: 'level:50', like: 13 },
  { name: 'HARVEST MOON', base: 0x3a1a08, metal: 0xc07a1a, dark: 0x1a0a02, camo: ['#4a2008', '#e06a10', '#2a1004'], glow: 0xffa02a, req: 'seasonskin:1', season: 1, like: 12 },
  { name: 'ABYSSAL', base: 0x0a2a30, metal: 0xc08a2a, dark: 0x041418, glow: 0x3ae0d0, metallic: true, req: 'seasonskin:2', season: 2, like: 8 },
];

export const TITLES = ['ROOKIE', 'SURVIVOR', 'SCAVENGER', 'SHARPSHOOTER', 'HEADHUNTER', 'BRUISER BANE', "BUTCHER'S BANE", 'PLAGUE DOCTOR', 'GIANT SLAYER', 'NIGHTMARE WALKER', 'HORDE BREAKER', 'UNKILLABLE', 'VETERAN', 'WARLORD', 'LEGEND', 'LAST STAND'];

export const SUITS = [
  null,
  { id: 'ronin', name: 'CYBER RONIN', premium: 'outfit.ronin', desc: 'Neon-lined tech suit, holo visor and a light-blade katana.', base: { top: 2, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 6, hairColor: 6, back: 0, pantsStyle: 3, gloves: 3, accent: 1 }, sleeve: 0x121316, glove: 0x0b0c0e, accent: 0x19f0ff },
  { id: 'knight', name: 'INFERNAL KNIGHT', premium: 'outfit.knight', desc: 'Black iron plate cracked with molten embers. Horned helm.', base: { top: 4, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 3 }, sleeve: 0x1c1c20, glove: 0x2a2a2e, accent: 0xff5a1a },
  { id: 'spectre', name: 'SPECTRE', premium: 'outfit.spectre', desc: 'A floor-length shadow cloak. Only the eyes remain.', base: { top: 1, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 3 }, sleeve: 0x100c18, glove: 0x100c18, accent: 0xb48cff },
  { id: 'wolf', name: 'ARCTIC WOLF', premium: 'outfit.wolf', desc: 'Fur parka with a wolf-head hood, snow goggles and fur boots.', base: { top: 1, topColor: 5, pants: 4, boots: 2, head: 0, face: 6, hair: 7, back: 1, pantsStyle: 1, gloves: 5 }, sleeve: 0xe8e4d8, glove: 0x6a6258, accent: 0xffa040 },
  { id: 'hollow', name: 'HOLLOW JACK', season: 1, desc: 'Season 1 exclusive. A carved pumpkin head that burns from within, patched scarecrow coat.', base: { top: 5, topColor: 15, pants: 2, boots: 2, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 2, gloves: 5 }, sleeve: 0x3a2a1a, glove: 0xa8844a, accent: 0xff9a1a },
  { id: 'diver', name: 'DEEP DIVER', season: 2, desc: 'Season 2 exclusive. Riveted brass dive helmet, canvas suit and twin air tanks.', base: { top: 4, topColor: 4, pants: 4, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 4 }, sleeve: 0x8a7a5a, glove: 0x1a1a1a, accent: 0x3ae0d0 },
  { id: 'crimson-ronin', parts: 'ronin', like: 1, name: 'CRIMSON RONIN', req: 'level:10', desc: 'Blood-red circuitry and a visor that never blinks.', base: { top: 2, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 6, hairColor: 0, back: 0, pantsStyle: 3, gloves: 3, accent: 1 }, sleeve: 0x16080a, glove: 0x0b0c0e, accent: 0xff2a3a },
  { id: 'timber-wolf', parts: 'wolf', like: 4, name: 'TIMBER WOLF', req: 'level:18', desc: 'Grey-brown pelt hood with a glowing green stare.', base: { top: 1, topColor: 15, pants: 2, boots: 2, head: 0, face: 6, hair: 7, back: 1, pantsStyle: 1, gloves: 5 }, sleeve: 0x6a5a48, glove: 0x3a2e24, accent: 0x7dff3a, fur: 0x8a7a66, hood: 0x5a5048 },
  { id: 'frost-knight', parts: 'knight', like: 2, name: 'FROST KNIGHT', req: 'level:28', desc: 'Rime-crusted plate that leaks freezing light.', base: { top: 4, topColor: 5, pants: 4, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 3 }, sleeve: 0xb8c8d0, glove: 0x8a9aa4, accent: 0x6fe3ff, iron: 0x9aaab4, cloth: 0x1a3a5a },
  { id: 'void-spectre', parts: 'spectre', like: 3, name: 'VOID SPECTRE', req: 'level:38', desc: 'A cloak torn from the dark between stars.', base: { top: 1, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 3 }, sleeve: 0x06040c, glove: 0x06040c, accent: 0x7dff3a, cloth: 0x0a0612 },
  { id: 'gilded-knight', parts: 'knight', like: 2, name: 'GILDED WARLORD', req: 'level:50', desc: 'Gold-plated war armour for those who outlasted everything.', base: { top: 4, topColor: 6, pants: 5, boots: 0, head: 0, face: 0, hair: 7, back: 0, pantsStyle: 0, gloves: 3 }, sleeve: 0x8a6a1a, glove: 0x6a4a10, accent: 0xffd36a, iron: 0xd8a72a, cloth: 0x4a0a0a },
];

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
  { id: 'face', label: 'FACE STYLE', bits: 3, items: [
    { name: 'CLEAN' }, { name: 'STUBBLE' }, { name: 'FULL BEARD', cost: 150 }, { name: 'SCAR', cost: 200 },
    { name: 'WAR PAINT', cost: 300 }, { name: 'SHADES', cost: 400 }, { name: 'GOGGLES', req: 'level:8' }, { name: 'SKULL MASK', req: 'nightmare:10' }] },
  { id: 'top', label: 'TOP', bits: 3, items: [
    { name: 'T-SHIRT' }, { name: 'HOODIE' }, { name: 'LEATHER JACKET', cost: 500 }, { name: 'TACTICAL VEST', cost: 800 },
    { name: 'MILITARY', req: 'wave:20' }, { name: 'TRENCH COAT', cost: 1200 }, { name: 'TRACKSUIT', cost: 400 }, { name: 'HAZMAT', req: 'boss:goliath' }] },
  { id: 'topColor', label: 'TOP COLOR', bits: 4, items: [
    'OLIVE', 'NAVY', 'MAROON', 'CHARCOAL', 'SAND', 'BONE', 'BLACK', 'DENIM', 'RED', 'ORANGE', 'MOSS', 'VIOLET', 'HAZARD', 'TEAL', 'ROSE', 'BROWN']
    .map((name, i) => ({ name, swatch: OUTFIT_COLORS[i], cost: i < 4 ? 0 : i < 8 ? 100 : 250 })) },
  { id: 'pants', label: 'PANTS COLOR', bits: 3, items: ['CHARCOAL', 'DENIM', 'KHAKI', 'OLIVE', 'STONE', 'BLACK', 'OXBLOOD', 'CREAM']
    .map((name, i) => ({ name, swatch: PANTS_COLORS[i], cost: i < 3 ? 0 : 100 })) },
  { id: 'boots', label: 'FOOTWEAR', bits: 2, items: [{ name: 'COMBAT BOOTS' }, { name: 'SNEAKERS', cost: 100 }, { name: 'WORK BOOTS', cost: 150 }, { name: 'HI-TOPS', cost: 400 }] },
  { id: 'back', label: 'BACK', bits: 3, items: [
    { name: 'NONE' }, { name: 'BACKPACK', cost: 200 }, { name: 'BEDROLL', cost: 250 }, { name: 'RADIO PACK', cost: 500 },
    { name: 'KATANA', req: 'heads:250' }, { name: 'CAPE', cost: 1000 }, { name: 'GUITAR', cost: 800 }, { name: 'CLEAVER', req: 'boss:butcher' }] },
  { id: 'gun', label: 'WEAPON SKIN', bits: 4, items: WEAPON_SKINS.map(s => ({ name: s.name, swatch: s.base, cost: s.cost, req: s.req, season: s.season, like: s.like })) },
  { id: 'title', label: 'TITLE', bits: 4, items: [
    { req: '' }, { req: 'level:3' }, { cost: 300 }, { req: 'heads:100' }, { req: 'heads:500' }, { req: 'boss:abomination' }, { req: 'boss:butcher' }, { req: 'boss:plague' },
    { req: 'boss:goliath' }, { req: 'nightmare:10' }, { req: 'kills:5000' }, { req: 'wave:30' }, { req: 'veteran:15' }, { req: 'level:25' }, { req: 'level:40' }, { req: 'wave:50' }]
    .map((it, i) => ({ ...it, name: TITLES[i] })) },
  { id: 'primary', label: 'PRIMARY', bits: 4, hidden: true, items: WEAPONS.map(w => ({ name: w.name })) },
  { id: 'suit', label: 'EXCLUSIVE', bits: 3, items: SUITS.map(x => x ? { name: x.name, premium: x.premium, season: x.season, req: x.season ? 'season:' + x.season : x.req, desc: x.desc, swatch: x.accent, like: x.like } : { name: 'NONE' }) },
];

export const EXTRA_SLOTS = [
  { id: 'build', label: 'BUILD', bits: 2, items: [{ name: 'ATHLETIC' }, { name: 'SLIM' }, { name: 'STOCKY' }, { name: 'MUSCULAR', cost: 300 }] },
  { id: 'height', label: 'HEIGHT', bits: 2, items: [{ name: 'AVERAGE' }, { name: 'SHORT' }, { name: 'TALL' }] },
  { id: 'jaw', label: 'FACE SHAPE', bits: 2, items: [{ name: 'OVAL' }, { name: 'SQUARE' }, { name: 'ROUND' }, { name: 'ANGULAR', cost: 150 }] },
  { id: 'pantsStyle', label: 'PANTS STYLE', bits: 2, items: [{ name: 'CHINOS' }, { name: 'CARGO', cost: 150 }, { name: 'JEANS', cost: 100 }, { name: 'TACTICAL', cost: 350 }] },
  { id: 'accent', label: 'ACCENT COLOR', bits: 3, items: ['AUTO', 'BLACK', 'WHITE', 'TAN', 'OLIVE', 'RED', 'BLAZE', 'CYAN']
    .map((name, i) => ({ name, swatch: ACCENT_COLORS[i] ?? undefined, cost: i < 3 ? 0 : i < 5 ? 100 : 250 })) },
  { id: 'eyes', label: 'EYE COLOR', items: ['BROWN', 'HAZEL', 'BLUE', 'GREEN', 'GREY', 'AMBER', 'VIOLET']
    .map((name, i) => ({ name, swatch: EYE_COLORS[i], cost: i < 5 ? 0 : 200 })) },
  { id: 'brows', label: 'EYEBROWS', items: [{ name: 'NATURAL' }, { name: 'THICK' }, { name: 'THIN' }, { name: 'ARCHED' }, { name: 'SLASHED', cost: 150 }] },
  { id: 'beardColor', label: 'BEARD COLOR', items: [{ name: 'MATCH HAIR' }, ...SLOTS[2].items.map(it => ({ name: it.name, swatch: it.swatch, cost: it.req ? 200 : it.cost }))] },
  { id: 'skinMark', label: 'SKIN DETAIL', items: [{ name: 'NONE' }, { name: 'FRECKLES' }, { name: 'BROW SCAR', cost: 100 }, { name: 'CHEEK SCAR', cost: 100 }, { name: 'NECK TATTOO', cost: 250 }, { name: 'SLEEVE TATTOO', cost: 300 }, { name: 'TEARDROP INK', req: 'level:10' }] },
  { id: 'gloves', label: 'GLOVES', items: [{ name: 'AUTO' }, { name: 'BARE HANDS' }, { name: 'FINGERLESS', cost: 100 }, { name: 'TACTICAL', cost: 200 }, { name: 'LEATHER', cost: 250 }, { name: 'WORK', cost: 150 }] },
  { id: 'accessory', label: 'ACCESSORY', items: [{ name: 'NONE' }, { name: 'DOG TAGS', cost: 100 }, { name: 'WATCH', cost: 150 }, { name: 'EARRINGS', cost: 150 }, { name: 'GOLD CHAIN', cost: 400 }, { name: 'FULL KIT', req: 'level:12' }] },
];
const LEVEL_CAP = 63;
export const BODY = { id: 'body', label: 'BODY', items: [{ name: 'MALE' }, { name: 'FEMALE' }] };
export const LOCKER_GROUPS = [
  { id: 'body', label: 'BODY', slots: ['body', 'skin', 'build', 'height', 'skinMark'] },
  { id: 'face', label: 'FACE', slots: ['jaw', 'eyes', 'brows', 'face', 'beardColor'] },
  { id: 'hair', label: 'HAIR', slots: ['hair', 'hairColor', 'head'] },
  { id: 'outfit', label: 'OUTFIT', slots: ['suit', 'top', 'topColor', 'accent', 'pantsStyle', 'pants', 'boots', 'gloves'] },
  { id: 'gear', label: 'GEAR', slots: ['back', 'accessory', 'gun', 'title'] },
];

export const DEFAULT_LOADOUT = Object.fromEntries([...SLOTS, ...EXTRA_SLOTS].map(s => [s.id, 0]));
DEFAULT_LOADOUT.skin = 1;
DEFAULT_LOADOUT.hair = 1;
DEFAULT_LOADOUT.hairColor = 1;
DEFAULT_LOADOUT.body = 0;

const ENCODED = EXTRA_SLOTS.filter(s => s.bits), EXT_SHIFT = 2n ** 53n, CODE_LIMIT = 2n ** 64n;
const ALL_IDS = ['body', ...SLOTS.map(s => s.id), ...EXTRA_SLOTS.map(s => s.id)];
export const loadoutKey = l => ALL_IDS.map(id => l[id] | 0).join('.');
const clampBits = (s, v) => {
  v |= 0;
  if (v >= 2 ** s.bits) v = s.items[v]?.like ?? 0;
  return Math.max(0, Math.min(2 ** s.bits - 1, v));
};

export function encodeLoadout(loadout, level = 1) {
  let code = loadout.body === 1 ? 3 : 1, base = 4;
  for (const s of SLOTS) {
    code += clampBits(s, loadout[s.id]) * base;
    base *= 2 ** s.bits;
  }
  code += Math.max(1, Math.min(LEVEL_CAP, level | 0)) * base;
  let ext = 0, eb = 1;
  for (const s of ENCODED) { ext += clampBits(s, loadout[s.id]) * eb; eb *= 2 ** s.bits; }
  return ext ? (BigInt(ext) * EXT_SHIFT + BigInt(code)).toString() : code;
}

export function decodeLoadout(code) {
  let big = null;
  if (typeof code === 'bigint') big = code;
  else if (typeof code === 'number') big = Number.isSafeInteger(code) ? BigInt(code) : null;
  else if (typeof code === 'string' && /^\d{1,20}$/.test(code)) big = BigInt(code);
  if (big === null || big <= 0n || big >= CODE_LIMIT) return null;
  const low = Number(big % EXT_SHIFT), tag = low % 4;
  if (tag !== 1 && tag !== 3) return null;
  const body = tag === 3 ? 1 : 0;
  let rest = Math.floor(low / 4), ext = Number(big / EXT_SHIFT);
  const loadout = {};
  for (const s of SLOTS) {
    const size = 2 ** s.bits, v = rest % size;
    rest = Math.floor(rest / size);
    loadout[s.id] = v < s.items.length ? v : 0;
  }
  for (const s of EXTRA_SLOTS) {
    if (!s.bits) { loadout[s.id] = 0; continue; }
    const size = 2 ** s.bits, v = ext % size;
    ext = Math.floor(ext / size);
    loadout[s.id] = v < s.items.length ? v : 0;
  }
  loadout.body = body;
  return { loadout, level: Math.max(1, rest % (LEVEL_CAP + 1)), body };
}

const slotOf = id => id === 'body' ? BODY : SLOTS.find(s => s.id === id) || EXTRA_SLOTS.find(s => s.id === id);
export function describeLoadout(l) {
  const n = id => slotOf(id).items[l[id] | 0]?.name || '';
  const suit = SUITS[l.suit], body = ['BODY', [BODY.items[l.body === 1 ? 1 : 0].name, l.build ? n('build') : '', l.height ? n('height') : ''].filter(Boolean).join(' · ')];
  if (suit) return [body, ['OUTFIT', suit.name + ' (EXCLUSIVE)'], ['WEAPON', (l.gun ? n('gun') + ' ' : '') + (WEAPONS[l.primary]?.name || 'M4A1')]];
  const parts = [
    body,
    ['OUTFIT', n('topColor') + ' ' + n('top')],
    ['PANTS', n('pants') + ' ' + n('pantsStyle')],
    ['HAIR', l.hair === 7 ? 'BALD' : n('hairColor') + ' ' + n('hair')],
    ['HEADGEAR', n('head')],
    ['FACE', n('face')],
    ['BACK', n('back')],
    ['WEAPON', (l.gun ? n('gun') + ' ' : '') + (WEAPONS[l.primary]?.name || 'M4A1')],
  ];
  return parts.filter(([, v]) => v && v !== 'NONE' && v !== 'CLEAN');
}

const PI = Math.PI, TAU = 2 * PI;
const gs = x => Math.exp(-x * x);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const sq = (c, e = .55) => Math.sign(c) * Math.abs(c) ** e;

function makeRand(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
function grain(cx, w, h, base, amp, seed) {
  const img = cx.createImageData(w, h), r = makeRand(seed);
  for (let i = 0; i < w * h; i++) { const v = base + (r() - .5) * 2 * amp; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  cx.putImageData(img, 0, 0);
  return r;
}
const TEXDEF = {
  cotton: [64, 64, [7, 7], (cx, w, h) => { grain(cx, w, h, 238, 9, 11); for (let y = 0; y < h; y += 2) { cx.fillStyle = 'rgba(0,0,0,.06)'; cx.fillRect(0, y, w, 1); } for (let x = 1; x < w; x += 2) { cx.fillStyle = 'rgba(0,0,0,.03)'; cx.fillRect(x, 0, 1, h); } }],
  twill: [64, 64, [4, 9], (cx, w, h) => { grain(cx, w, h, 236, 8, 17); cx.strokeStyle = 'rgba(0,0,0,.08)'; cx.lineWidth = 1.2; for (let i = -h; i < w; i += 4) { cx.beginPath(); cx.moveTo(i, h); cx.lineTo(i + h, 0); cx.stroke(); } cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(0, 0, 1.5, h); cx.fillRect(w - 1.5, 0, 1.5, h); }],
  denim: [128, 128, [2, 6], (cx, w, h) => {
    const r = grain(cx, w, h, 225, 14, 23);
    cx.strokeStyle = 'rgba(255,255,255,.2)'; cx.lineWidth = 1.4; for (let i = -h; i < w; i += 3) { cx.beginPath(); cx.moveTo(i, h); cx.lineTo(i + h * .5, 0); cx.stroke(); }
    for (let i = 0; i < 26; i++) { cx.fillStyle = `rgba(255,255,255,${.04 + r() * .08})`; cx.fillRect(r() * w, 0, 1 + r() * 3, h); }
    cx.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < 40; i++) cx.fillRect(r() * w, r() * h, 2, 8);
    cx.fillStyle = 'rgba(0,0,0,.3)'; cx.fillRect(w / 2 - 2, 0, 4, h);
    cx.fillStyle = 'rgba(255,220,150,.55)'; for (let y = 0; y < h; y += 6) { cx.fillRect(w / 2 - 5, y, 1.5, 3.5); cx.fillRect(w / 2 + 4, y, 1.5, 3.5); }
  }],
  leather: [128, 128, [3, 3], (cx, w, h) => {
    const r = grain(cx, w, h, 222, 10, 31);
    for (let i = 0; i < 260; i++) { cx.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},${.03 + r() * .05})`; cx.beginPath(); cx.arc(r() * w, r() * h, 1 + r() * 4, 0, TAU); cx.fill(); }
    cx.strokeStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 14; i++) { cx.beginPath(); const x = r() * w, y = r() * h; cx.moveTo(x, y); cx.quadraticCurveTo(x + r() * 20, y + r() * 6, x + 10 + r() * 30, y - 4 + r() * 8); cx.stroke(); }
  }],
  knit: [32, 32, [18, 5], (cx, w, h) => { grain(cx, w, h, 230, 8, 5); for (let x = 0; x < w; x += 4) { cx.fillStyle = 'rgba(0,0,0,.14)'; cx.fillRect(x, 0, 1.5, h); cx.fillStyle = 'rgba(255,255,255,.1)'; cx.fillRect(x + 2, 0, 1, h); } }],
  camo: [128, 128, [2, 3], (cx, w, h) => {
    const r = grain(cx, w, h, 238, 6, 41);
    for (const [shade, n] of [[190, 16], [150, 14], [110, 10]]) for (let i = 0; i < n; i++) {
      cx.fillStyle = `rgb(${shade},${shade},${shade})`; cx.beginPath();
      const x = r() * w, y = r() * h;
      for (let a = 0; a < 9; a++) { const rr = 5 + r() * 12, t = a / 9 * TAU; cx.lineTo(x + Math.cos(t) * rr * 1.4, y + Math.sin(t) * rr); }
      cx.fill();
    }
  }],
  molle: [64, 64, [1, 7], (cx, w, h) => { grain(cx, w, h, 228, 10, 7); cx.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 16) cx.fillRect(x, 0, 1, h); cx.fillStyle = 'rgba(0,0,0,.28)'; cx.fillRect(0, h * .45, w, 2); cx.fillStyle = 'rgba(255,255,255,.1)'; cx.fillRect(0, h * .45 + 2, w, 3); }],
  hair: [128, 64, [7, 1], (cx, w, h) => {
    const r = makeRand(53); cx.fillStyle = '#c8c8c8'; cx.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { const v = 150 + r() * 105 | 0; cx.fillStyle = `rgb(${v},${v},${v})`; cx.fillRect(r() * w, 0, .6 + r() * 1.6, h); }
    const gr = cx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, w, h);
  }],
  stubble: [128, 64, [6, 2], (cx, w, h) => { const r = grain(cx, w, h, 250, 4, 67); for (let i = 0; i < 1400; i++) { cx.fillStyle = `rgba(0,0,0,${.2 + r() * .35})`; cx.fillRect(r() * w, r() * h, 1, 1.4); } }],
  fur: [64, 64, [6, 5], (cx, w, h) => { const r = grain(cx, w, h, 225, 20, 71); for (let i = 0; i < 300; i++) { cx.strokeStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},.25)`; cx.beginPath(); const x = r() * w, y = r() * h; cx.moveTo(x, y); cx.lineTo(x + r() * 4 - 2, y + 4 + r() * 5); cx.stroke(); } }],
  canvas: [64, 64, [6, 6], (cx, w, h) => { grain(cx, w, h, 232, 14, 83); for (let y = 0; y < h; y += 3) { cx.fillStyle = 'rgba(0,0,0,.1)'; cx.fillRect(0, y, w, 1); } for (let x = 0; x < w; x += 3) { cx.fillStyle = 'rgba(0,0,0,.08)'; cx.fillRect(x, 0, 1, h); } }],
  skin: [64, 64, [3, 3], (cx, w, h) => { const r = grain(cx, w, h, 246, 5, 91); for (let i = 0; i < 40; i++) { cx.fillStyle = `rgba(160,60,50,${.02 + r() * .03})`; cx.beginPath(); cx.arc(r() * w, r() * h, 2 + r() * 6, 0, TAU); cx.fill(); } }],
  rubber: [64, 64, [4, 4], (cx, w, h) => { grain(cx, w, h, 235, 7, 97); }],
};
function skinBase(cx, w, h) {
  const r = grain(cx, w, h, 247, 4, 101);
  for (let i = 0; i < 120; i++) { cx.fillStyle = `rgba(150,60,50,${.015 + r() * .025})`; cx.beginPath(); cx.arc(r() * w, r() * h, 2 + r() * 8, 0, TAU); cx.fill(); }
  return r;
}
const FACE_X = ph => (ph / TAU + .5) * 512, FACE_Y = th => th / PI * 256;
const MARKS = {
  1: (cx, r) => { for (let i = 0; i < 170; i++) { const ph = (r() - .5) * 1.25, th = 1.5 + r() * .32 - .1 * Math.abs(ph); cx.fillStyle = `rgba(130,70,35,${.15 + r() * .25})`; cx.beginPath(); cx.arc(FACE_X(ph), FACE_Y(th), .6 + r() * 1.1, 0, TAU); cx.fill(); } },
  2: cx => { cx.strokeStyle = 'rgba(190,90,90,.85)'; cx.lineWidth = 2.2; cx.beginPath(); cx.moveTo(FACE_X(.3), FACE_Y(1.14)); cx.lineTo(FACE_X(.43), FACE_Y(1.62)); cx.stroke(); cx.strokeStyle = 'rgba(255,230,220,.5)'; cx.lineWidth = .8; cx.stroke(); },
  3: cx => { cx.strokeStyle = 'rgba(170,80,80,.8)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(FACE_X(-.95), FACE_Y(1.52)); cx.quadraticCurveTo(FACE_X(-.62), FACE_Y(1.75), FACE_X(-.4), FACE_Y(2.05)); cx.stroke(); cx.strokeStyle = 'rgba(120,40,40,.5)'; cx.lineWidth = 1; for (let i = 0; i < 6; i++) { const t = i / 5, x = lerp(-.9, -.43, t), y = lerp(1.55, 2.0, t); cx.beginPath(); cx.moveTo(FACE_X(x - .04), FACE_Y(y - .02)); cx.lineTo(FACE_X(x + .04), FACE_Y(y + .02)); cx.stroke(); } },
  6: cx => { cx.fillStyle = 'rgba(25,30,45,.9)'; cx.beginPath(); const x = FACE_X(.44), y = FACE_Y(1.64); cx.moveTo(x, y); cx.quadraticCurveTo(x + 4, y + 7, x, y + 9); cx.quadraticCurveTo(x - 4, y + 7, x, y); cx.fill(); const sx = FACE_X(.86), sy = FACE_Y(1.34); cx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? 2.4 : 6, t = i / 10 * TAU - PI / 2; cx.lineTo(sx + Math.cos(t) * rr, sy + Math.sin(t) * rr); } cx.fill(); },
};
function tribal(cx, w, h, r, dense) {
  cx.fillStyle = 'rgba(20,26,40,.88)';
  for (let k = 0; k < (dense ? 7 : 3); k++) {
    const x0 = r() * w, y0 = r() * h * .8;
    cx.beginPath(); cx.moveTo(x0, y0);
    cx.bezierCurveTo(x0 + 18, y0 + 8, x0 + 26, y0 + 30, x0 + 6, y0 + 44);
    cx.bezierCurveTo(x0 + 16, y0 + 26, x0 + 8, y0 + 14, x0 - 6, y0 + 8);
    cx.fill();
  }
}
const texCache = new Map();
function texture(name) {
  if (texCache.has(name)) return texCache.get(name);
  const cv = document.createElement('canvas'), [base, arg] = name.split(':');
  let t;
  if (TEXDEF[base]) {
    const [w, h, rep, draw] = TEXDEF[base];
    cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(cv); t.repeat.set(...rep);
  } else if (base === 'face') {
    cv.width = 512; cv.height = 256;
    const cx = cv.getContext('2d'), r = skinBase(cx, 512, 256), stub = name.split(':')[2];
    if (stub) {
      const c = new THREE.Color(+stub).multiplyScalar(.55), rs = makeRand(3);
      for (let i = 0; i < 9000; i++) {
        const ph = (rs() - .5) * 3.2, th = 1.6 + rs() * 1.3, a = Math.abs(ph), edge = lerp(1.97, 1.42, sstep(.22, 1.4, a));
        const lip = a < .24 && th > 1.95 && th < 2.2, mst = a < .3 && th > 1.78 && th < 1.95;
        const w = lip ? 0 : mst ? .8 : sstep(edge - .02, edge + .12, th) * (1 - sstep(1.45, 1.6, a));
        if (rs() > w) continue;
        cx.fillStyle = `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${.3 + rs() * .4})`;
        cx.fillRect(FACE_X(ph), FACE_Y(th), 1.3, 1.6);
      }
    }
    MARKS[+arg]?.(cx, r);
    t = new THREE.CanvasTexture(cv);
  } else if (base === 'ink') {
    cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), r = skinBase(cx, 128, 128);
    if (arg === 'arm') tribal(cx, 128, 128, r, true);
    else { cx.save(); cx.translate(28, 40); cx.scale(1.3, 1.1); tribal(cx, 30, 30, makeRand(5), false); cx.restore(); cx.save(); cx.translate(84, 40); cx.scale(-1.3, 1.1); tribal(cx, 30, 30, makeRand(9), false); cx.restore(); }
    t = new THREE.CanvasTexture(cv);
  } else if (base === 'eye') {
    cv.width = 128; cv.height = 64;
    const cx = cv.getContext('2d'), c = '#' + (EYE_COLORS[+arg] ?? EYE_COLORS[0]).toString(16).padStart(6, '0'), r = makeRand(7 + +arg);
    const g = cx.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#d8bcb4'); g.addColorStop(.18, '#f4efe8'); g.addColorStop(.32, '#f4efe8'); g.addColorStop(.5, '#d8bcb4'); g.addColorStop(1, '#d8bcb4');
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 64);
    cx.fillStyle = c; cx.beginPath(); cx.arc(32, 32, 10.5, 0, TAU); cx.fill();
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; cx.strokeStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},${.15 + r() * .25})`; cx.beginPath(); cx.moveTo(32 + Math.cos(a) * 4, 32 + Math.sin(a) * 4); cx.lineTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); cx.stroke(); }
    cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(32, 32, 10.3, 0, TAU); cx.stroke();
    cx.fillStyle = '#060606'; cx.beginPath(); cx.arc(32, 32, 4.2, 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.9)'; cx.beginPath(); cx.arc(29.5, 29, 1.6, 0, TAU); cx.fill();
    t = new THREE.CanvasTexture(cv);
  }
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(name, t);
  return t;
}

const matCache = new Map();
function m(color, o = {}) {
  const key = color + JSON.stringify(o);
  let mat = matCache.get(key);
  if (!mat) {
    const { tex, bump, ...rest } = o;
    mat = new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: .05, vertexColors: true, ...rest });
    if (tex) { mat.map = texture(tex); if (bump) { mat.bumpMap = mat.map; mat.bumpScale = bump; } }
    matCache.set(key, mat);
  }
  return mat;
}
const camoCache = new Map();
export function skinTexture(skin) {
  if (!skin.camo && !skin.stripes) return null;
  if (camoCache.has(skin.name)) return camoCache.get(skin.name);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  if (skin.stripes) {
    const [bg, a, b] = Array.isArray(skin.stripes) ? skin.stripes : ['#1c1e22', '#2a2d33', '#16181b'];
    cx.fillStyle = bg; cx.fillRect(0, 0, 128, 128);
    for (let i = -128; i < 256; i += 8) { cx.fillStyle = i % 16 ? a : b; cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + 4, 0); cx.lineTo(i + 132, 128); cx.lineTo(i + 128, 128); cx.fill(); }
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
const GLOVES = { tactical: 0x1c1e21, leather: 0x4a2e1a, work: 0xb89a6a, fingerless: 0x1a1a1c };
function gloveKind(l) {
  const g = l.gloves | 0;
  if (g === 1) return null;
  if (g) return ['fingerless', 'tactical', 'leather', 'work'][g - 2];
  return [2, 3, 4, 7].includes(l.top) ? 'tactical' : null;
}
export function outfitColors(l) {
  const suit = SUITS[l.suit];
  if (suit) return { sleeve: suit.sleeve, glove: suit.glove };
  const top = OUTFIT_COLORS[l.topColor] ?? OUTFIT_COLORS[0], skin = SKIN_TONES[l.skin] ?? SKIN_TONES[1], g = gloveKind(l);
  return { sleeve: l.top === 0 ? skin : top, glove: g ? (l.top === 7 && !l.gloves ? 0x1a1a1a : GLOVES[g]) : skin };
}

const geos = new Map();
const white = g => { if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
function shell(key, n, k, fn, out) {
  if (geos.has(key)) return geos.get(key);
  const pos = [], idx = [], uv = [], col = [];
  for (let j = 0; j <= k; j++) for (let i = 0; i <= n; i++) {
    const p = fn(i / n, j / k, i, j), c = p[3] ?? 1;
    pos.push(p[0], p[1], p[2]);
    uv.push(i / n, 1 - j / k);
    if (Array.isArray(c)) col.push(c[0], c[1], c[2]); else col.push(c, c, c);
  }
  let flip = false;
  if (out) {
    const at = (i, j) => new THREE.Vector3().fromArray(pos, (j * (n + 1) + i) * 3), i = n >> 1, j = k >> 1, p = at(i, j);
    const nrm = at(i, j + 1).sub(p).cross(at(i + 1, j).sub(p));
    let o;
    if (out === 'c') { const c = new THREE.Vector3(); for (let q = 0; q < pos.length; q += 3) c.add(_v.fromArray(pos, q)); o = p.clone().sub(c.multiplyScalar(3 / pos.length)); }
    else o = new THREE.Vector3(...out(i / n, j / k));
    flip = nrm.dot(o) < 0;
  }
  for (let j = 0; j < k; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + n + 1; flip ? idx.push(a, a + 1, b, b, a + 1, b + 1) : idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal.array, sum = new Map(), keyOf = v => [0, 1, 2].map(c => Math.round(pos[v * 3 + c] * 1e4)).join();
  for (let v = 0; v < nr.length / 3; v++) { const kk = keyOf(v), a = sum.get(kk) || [0, 0, 0]; for (let c = 0; c < 3; c++) a[c] += nr[v * 3 + c]; sum.set(kk, a); }
  for (let v = 0; v < nr.length / 3; v++) { const a = sum.get(keyOf(v)), d = Math.hypot(...a) || 1; for (let c = 0; c < 3; c++) nr[v * 3 + c] = a[c] / d; }
  geos.set(key, g);
  return g;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function merge(key, build) {
  if (geos.has(key)) return geos.get(key);
  const pos = [], nor = [], uvs = [], col = [], idx = [];
  let off = 0;
  for (const [g, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], c = 1] of build()) {
    _m4.compose(_p.set(...p), r.isQuaternion ? r : _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(...s));
    _n3.getNormalMatrix(_m4);
    const flip = _m4.determinant() < 0, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, cc = Array.isArray(c) ? c : [c, c, c];
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m4); pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nor.push(_v.x, _v.y, _v.z);
      uvs.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      for (let j = 0; j < 3; j++) col.push((C ? C.getComponent(i, j) : 1) * cc[j]);
    }
    const ix = g.index ? Array.from(g.index.array) : [...Array(P.count).keys()];
    for (let i = 0; i < ix.length; i += 3) flip ? idx.push(ix[i] + off, ix[i + 2] + off, ix[i + 1] + off) : idx.push(ix[i] + off, ix[i + 1] + off, ix[i + 2] + off);
    off += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  geos.set(key, out);
  return out;
}
const Y = new THREE.Vector3(0, 1, 0), UP = new THREE.Vector3(0, -1, 0);
function seg(a, b, w, d = w) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  return [A.clone().add(B).multiplyScalar(.5).toArray(), [w, A.distanceTo(B), d], new THREE.Quaternion().setFromUnitVectors(Y, B.sub(A).normalize())];
}
function superEllipsoid(e) {
  const g = shell('se' + e, 16, 12, (u, v) => {
    const ph = -PI + u * TAU, th = v * PI;
    return [sq(Math.sin(th), e) * sq(Math.sin(ph), e), sq(Math.cos(th), e), sq(Math.sin(th), e) * sq(Math.cos(ph), e)];
  });
  return g;
}

const G = Object.fromEntries(Object.entries({
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  lowSphere: new THREE.SphereGeometry(1, 10, 7),
  eye: new THREE.SphereGeometry(1, 18, 12),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 8),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  torus: new THREE.TorusGeometry(1, .18, 8, 20),
  taper: new THREE.CylinderGeometry(.707, .6, 1, 4, 1).rotateY(Math.PI / 4),
  rbox: superEllipsoid(.28),
  pill: superEllipsoid(.6),
}).map(([k, g]) => [k, white(g)]));

const HS = [[.113, .14, .125], [.104, .134, .118]], HANG = .58 * PI;
const JAWS = [[.3, .36, .04, 0, .09], [.14, .24, .16, 0, .07], [.16, .22, 0, .11, .04], [.42, .46, 0, -.03, .13]];
function hp(th, ph, r, f, hang) {
  const g = f & 1, J = JAWS[f >> 1] || JAWS[0], [sx, sy, sz] = HS[g];
  let drop = 0;
  if (hang && th > HANG) { drop = (th - HANG) * .14; th = HANG; }
  const st = Math.sin(th), dx = st * Math.sin(ph), dy = Math.cos(th), dz = st * Math.cos(ph);
  const s = Math.min(1, Math.max(0, (.15 - dy) / 1.15)) ** 1.15;
  const jw = 1 - J[g] * s + J[2] * gs((dy + .62) / .22) + J[3] * gs((dy + .3) / .25);
  const chin = dz > 0 ? J[4] * (g ? .7 : 1) * gs((dy + .8) / .14) * Math.max(0, Math.cos(ph)) ** 8 : 0;
  const zb = dz > 0 ? 1 - .05 * s : 1.04 - .1 * s;
  let x = dx * r * sx * jw * (1 + drop * 1.2), y = .14 + dy * r * sy * (dy < 0 ? (g ? .96 : 1.04) : 1) - drop, z = (dz * r * sz * zb + chin * r * sz) * (1 + drop * .5) - drop * drop * Math.abs(dx);
  if (!hang) {
    const k = g ? .93 : 1, jawY = lerp(.056, .004, sstep(-.03, .085, z)) * k, n = z > -.03 ? sstep(jawY + .012, jawY - .03, y) : sstep(.085 * k, .025 * k, y);
    const cz = -.012, rr = Math.hypot(x, z - cz), rn = (g ? .036 : .044) * Math.max(0, 1 - .15 * sstep(.02, -.03, y)) * (1 + (r - 1) * 1.6);
    if (n > 0 && rr > rn) { const f = lerp(1, rn / rr, n); x *= f; z = cz + (z - cz) * f; }
  }
  return [x, y, z];
}
function relief(hf) {
  const g = hf & 1, jaw = hf >> 1;
  return (th, ph) => {
    const a = Math.abs(ph);
    if (a > 1.5) return 0;
    const nl = gs((a - (.2 + .45 * (th - 1.72))) / .035) * sstep(1.66, 1.76, th) * sstep(2.12, 2.02, th);
    return -.075 * gs((th - 1.45) / .08) * gs((a - .41) / .15) - .018 * nl + .012 * gs((th - 1.82) / .1) * gs((a - .42) / .14)
      + (g ? .012 : .03) * gs((th - 1.25) / .08) * gs((a - .33) / .3)
      + (jaw === 3 ? .04 : .026) * gs((th - 1.66) / .1) * gs((a - .64) / .17)
      - (jaw === 3 ? .03 : jaw === 2 ? 0 : .014) * gs((th - 1.97) / .1) * gs((a - .62) / .15)
      + .06 * gs((th - 1.98) / .2) * gs(ph / .32)
      - .014 * gs((th - 1.2) / .15) * gs((a - 1.05) / .2)
      + .016 * gs((th - 1.47) / .07) * gs(ph / .1);
  };
}
function faceShade(fem) {
  return (th, ph) => {
    const a = Math.abs(ph);
    const blush = (fem ? .1 : .06) * gs((th - 1.74) / .15) * gs((a - .56) / .2) + .05 * gs((th - 1.6) / .08) * gs(ph / .12);
    const nl = gs((a - (.2 + .45 * (th - 1.72))) / .04) * sstep(1.66, 1.76, th) * sstep(2.12, 2.02, th);
    const k = 1 - .16 * gs((th - 1.4) / .1) * gs((a - .41) / .22) * (fem ? 1.3 : 1) - .08 * nl - .16 * sstep(2.3, 2.95, th) - .05 * gs((th - 2.1) / .1) * gs((a - .35) / .1);
    return [k, k * (1 - blush), k * (1 - blush * 1.25)];
  };
}
const fnOf = x => typeof x === 'function' ? x : () => x;
function scalp(key, f, [ph0, ph1], th0, th1, rf, { hang = false, n = 24, k = 10, shade } = {}) {
  const a0 = fnOf(th0), a1 = fnOf(th1), r = fnOf(rf);
  return shell(key + ':' + f, n, k, (u, v, i) => {
    const ph = ph0 + (ph1 - ph0) * u, a = a0(ph, i), th = a + (a1(ph, i) - a) * v, p = hp(th, ph, r(v, ph, th), f, hang);
    if (shade) p.push(shade(th, ph, v));
    return p;
  });
}
const HAIRLINE = [[0, .29], [.45, .27], [.8, .31], [1.15, .4], [1.33, .55], [1.46, .45], [1.72, .44], [1.95, .6], [2.4, .72], [PI, .76]];
const menLine = ph => PI * curve(HAIRLINE, Math.abs(ph))[0];
const fadeR = v => 1.022 + .004 * (1 - v) - .012 * sstep(.85, 1, v);
const line = (fr, sd, bk, burn = 0, p = 2) => ph => { const c = Math.cos(ph), w = Math.abs(c) ** p; return PI * (sd + ((c > 0 ? fr : bk) - sd) * w + burn * Math.exp(-(((Math.abs(ph) - 1.3) / .2) ** 2))); };
const RING = [-PI, PI];

function hairSpec(h, f, hat) {
  if (hat && [2, 5, 6].includes(h)) h = h === 6 ? 0 : 1;
  if (h === 7) return null;
  const front = ph => Math.max(0, Math.cos(ph));
  const S = {
    0: { th: menLine, r: fadeR },
    1: f ? { th: (ph, i) => line(.3, .72, .72, 0, 5)(ph) + (i % 2) * .05 * PI * front(ph) ** 3, r: (v, ph, th) => 1.03 + .07 * (1 - Math.min(1, th / HANG) ** 2), hang: true }
      : { base: menLine, th: ph => lerp(menLine(ph) + .01 * PI, PI * (.37 + .18 * sstep(1.6, 2.9, Math.abs(ph))), sstep(.75, 1.15, Math.abs(ph))), r: (v, ph) => 1.024 + .05 * (1 - v ** 1.5) * (.55 + .45 * front(ph)) + .02 * front(ph) ** 2 * Math.sin(PI * Math.min(1, v * 1.4)) },
    2: { base: menLine, th: ph => PI * (.28 + .06 * sstep(.3, 1.4, Math.abs(ph)) + .1 * sstep(1.7, 2.9, Math.abs(ph))), r: v => 1.024 + .03 * (1 - v * v) },
    3: { th: (ph, i) => line(.3, f ? .9 : .78, f ? 1.3 : 1.02, 0, 4)(ph) + (i % 2) * .03 * PI * front(ph) ** 4, r: (v, ph, th) => 1.03 + .07 * (1 - Math.min(1, th / HANG) ** 2), hang: true },
    4: { th: line(.3, .5, .66, .05, 4), r: v => 1.025 + .035 * (1 - v ** 2) },
    5: { th: line(.31, .58, .72, 0, 3), r: (v, ph, th) => 1.025 + .46 * (1 - v ** 4) * (1 + .06 * Math.sin(ph * 5 + th * 7)) },
    6: { th: menLine, r: fadeR },
  }[h];
  const r = hat ? (v, ph, th) => Math.min(1.05, S.r(v, ph, th)) : S.r;
  return { h, ...S, r, at: (th, ph) => th <= S.th(ph, 0) ? r(th / S.th(ph, 0), ph, th) : 1 };
}
function part(parent, geo, material, [x, y, z], [sx, sy, sz] = [1, 1, 1], rot) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  if (rot) rot.isQuaternion ? o.quaternion.copy(rot) : o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  o.castShadow = true;
  parent.add(o);
  return o;
}
const whole = (parent, geo, mat) => part(parent, geo, mat, [0, 0, 0]);
function span(parent, geo, mat, a, b, w, d = w) {
  const [p, s, q] = seg(a, b, w, d);
  return part(parent, geo, mat, p, s, q);
}
function outward(o, ph, tilt = 0) { o.rotation.set(PI / 2 + tilt, ph, 0, 'YXZ'); return o; }

function lidGeo(fem, lower) {
  return shell('lid' + fem + lower, 18, 6, (u, v) => {
    const ph = u * TAU, th = v * (lower ? .22 : .35) * PI, r = 1 + (fem && !lower ? .12 * sstep(.75, 1, v) * sstep(0, 1, Math.cos(ph)) : 0);
    const c = v > .82 ? (lower ? .72 : fem ? .18 : .45) : 1;
    return [Math.sin(th) * Math.cos(ph) * r, Math.cos(th) * r, Math.sin(th) * Math.sin(ph) * r, c];
  }, 'c');
}
function earGeo() {
  return shell('ear', 18, 7, (u, v) => {
    const a = u * TAU, rim = sstep(.62, .9, v) * (1 - sstep(.95, 1, v)), lobe = Math.max(0, -Math.sin(a)) ** 3;
    const r = v * (1 + .12 * lobe), z = .42 * rim + .22 * (1 - v) ** 2 - .1 * gs((v - .45) / .2) * (1 - lobe) + .12 * lobe * v;
    return [Math.cos(a) * r * (.78 - .1 * lobe), Math.sin(a) * r, z, .72 + .28 * rim + .2 * lobe];
  }, () => [0, 0, 1]);
}
function noseGeo(hf) {
  const fem = hf & 1, rel = relief(hf), k = fem ? .78 : 1;
  return shell('nose' + hf, 12, 16, (u, v) => {
    const x = u * 2 - 1, th = 1.43 + v * (fem ? .3 : .34), wph = (.06 + .05 * v + .1 * gs((v - .86) / .1)) * (fem ? .82 : 1);
    const ph = x * wph, tip = gs((v - (fem ? .8 : .83)) / .14), prof = (.03 + .16 * v ** 1.5) * (1 - sstep(.86, 1, v)) + .04 * tip * (1 - sstep(.94, 1, v));
    const ala = .045 * gs((v - .86) / .07) * gs((Math.abs(x) - .75) / .25);
    const h = (prof * (1 - x * x) ** .7 + ala) * k;
    const p = hp(th, ph, 1 + rel(th, ph) + h - .004, hf);
    const nostril = v > .9 && Math.abs(x) > .2 && Math.abs(x) < .7 ? .45 : 1;
    return [p[0], p[1], p[2], [nostril, nostril * (1 - .06 * tip), nostril * (1 - .08 * tip)]];
  });
}
function lipGeo(hf) {
  const fem = hf & 1, rel = relief(hf);
  return shell('lips' + hf, 16, 12, (u, v) => {
    const x = u * 2 - 1, th = (fem ? 1.95 : 1.99) + v * (fem ? .2 : .17) - .02 * x * x - (fem ? .03 : .015) * gs(x / .2) * gs(v / .18), ph = x * (fem ? .22 : .23);
    const up = (fem ? .05 : .026) * gs((v - .3) / (fem ? .17 : .22)), lo = (fem ? .062 : .04) * gs((v - .7) / (fem ? .18 : .24));
    const h = ((up + lo) * (1 - x * x) ** (fem ? .5 : .8) - (fem ? .01 : .005) * gs((v - .5) / .06) * (1 - x * x)) * Math.sin(PI * v) ** (fem ? .35 : .7);
    const p = hp(th, ph, 1 + rel(th, ph) + h - .003, hf);
    const c = 1 - (fem ? .5 : .32) * gs((v - .5) / .07) * (1 - x * x) - (fem ? .15 : .06) * v;
    return [p[0], p[1], p[2], c];
  });
}
function browGeo(hf, style, s) {
  const lo = s < 0 ? -.74 : .1, hi = s < 0 ? -.1 : .74, fem = hf & 1;
  const T = [fem ? .05 : .075, fem ? .085 : .11, .032, .045, fem ? .05 : .075][style] || .06, A = [.035, .03, .04, .09, .035][style] || .035;
  const base = ph => { const t = (Math.abs(ph) - .1) / .64; return 1.33 - (fem ? .03 : 0) - A * Math.sin(PI * Math.min(1, t * 1.25)) + .03 * t; };
  return scalp('brow' + style + s, hf, [lo, hi], ph => { const t = (Math.abs(ph) - .1) / .64, gap = style === 4 && t > .42 && t < .56 ? 0 : 1; return base(ph) - T * (1 - .7 * t) * gap; }, base,
    (v, ph, th) => 1.035 + relief(hf)(th, ph) + .006 * Math.sin(PI * v), { n: 14, k: 3 });
}

function buildHead(head, l, hf, M) {
  const fem = hf & 1, P = (th, ph, r = 1, hang) => hp(th, ph, r, hf, hang), rel = relief(hf);
  const { skin, face, hairC, skinC, black, topDark } = M;
  const hairM = m(hairC, { roughness: .55, tex: 'hair', side: THREE.DoubleSide });
  whole(head, scalp('head', hf, RING, 0, PI, (v, ph, th) => 1 + rel(th, ph), { n: 52, k: 36, shade: faceShade(fem) }), face);
  const hat = [1, 2, 4, 5].includes(l.head), hs = hairSpec(l.hair, fem, hat);
  const hr = hs ? hs.at : () => 1, hk = (hs ? hs.h : 7) + (hat ? 'h' : '');
  const eye = [1.45, fem ? .41 : .4], er = fem ? .019 : .018;
  const browC = new THREE.Color(l.hair === 7 ? 0x3a2a20 : hairC).lerp(new THREE.Color(skinC), fem ? .25 : .15).getHex();
  const eyeM = m(0xffffff, { tex: 'eye:' + (l.eyes | 0), roughness: .08 });
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(...P(eye[0], s * eye[1], .87));
    eg.rotation.y = s * .1;
    head.add(eg);
    part(eg, G.eye, eyeM, [0, 0, 0], [er, er, er], [0, PI / 2 * 0, 0]);
    part(eg, lidGeo(fem, 0), skin, [0, 0, 0], [er * 1.1, er * 1.1, er * 1.1], [.18, 0, s * (fem ? -.12 : -.05)]);
    part(eg, lidGeo(fem, 1), skin, [0, 0, 0], [er * 1.07, er * 1.07, er * 1.07], [PI - .42, 0, 0]);
    whole(head, browGeo(hf, l.brows | 0, s), m(browC, { roughness: .9, tex: 'hair' }));
    const ear = P(1.6, s * 1.47, .97);
    if (!hs || !(hs.h === 3 || hs.h === 5 || (fem && hs.h === 1))) part(head, earGeo(), skin, [ear[0] - s * .004, ear[1], ear[2] - .004], fem ? [.021, .028, .02] : [.025, .033, .024], [0, s * (PI / 2 - .12), s * .08]);
    if (l.accessory === 3 || l.accessory === 5) part(head, G.torus, m(0xe8c060, { metalness: .9, roughness: .2 }), [ear[0] + s * .004, ear[1] - .032, ear[2] + .004], [.009, .009, .009], [0, PI / 2, 0]);
  }
  whole(head, noseGeo(hf), face);
  const lipC = fem ? new THREE.Color(skinC).lerp(new THREE.Color(0xb8405a), .5).getHex() : new THREE.Color(skinC).lerp(new THREE.Color(0xa65a52), .2).getHex();
  whole(head, lipGeo(hf), m(lipC, { roughness: fem ? .3 : .55 }));

  if (hs) {
    if (hs.base) whole(head, scalp('hairbase', hf, RING, 0, hs.base, fadeR, { n: 48, k: 14 }), m(new THREE.Color(hairC).lerp(new THREE.Color(skinC), .1).getHex(), { roughness: .8, tex: 'stubble' }));
    whole(head, scalp('hair' + hk, hf, RING, 0, hs.th, hs.r, { hang: hs.hang, n: 48, k: hs.hang ? 18 : 12, shade: (th, ph, v) => .7 + .3 * sstep(0, .3, v) - (hs.base ? 0 : .2 * sstep(.85, 1, v)) }), hs.h === 0 || hs.h === 6 ? m(new THREE.Color(hairC).lerp(new THREE.Color(skinC), .3).getHex(), { roughness: .9, tex: 'stubble' }) : hairM);
    if (hs.h === 2) whole(head, merge('spikes' + hf + hk, () => {
      const out = [];
      for (const [th, n, off] of [[0, 1, 0], [.15 * PI, 6, 0], [.3 * PI, 9, .3]]) for (let i = 0; i < n; i++) {
        const ph = i / n * 2 * PI + off;
        if (th > hs.th(ph, 0) - .06 * PI) continue;
        const p = new THREE.Vector3(...P(th, ph, hr(th, ph) - .02)), d = p.clone().sub(new THREE.Vector3(0, .1, 0)).normalize();
        out.push([G.cone, p.addScaledVector(d, .03).toArray(), [.026, .075, .026], new THREE.Quaternion().setFromUnitVectors(Y, d)]);
      }
      return out;
    }), hairM);
    if (hs.h === 6) whole(head, shell('crest:' + hf, 3, 18, (u, v, i) => {
      const a = .3 * PI - v * .95 * PI, p = P(Math.abs(a), a >= 0 ? 0 : PI, 1.01), c = new THREE.Vector3(0, p[1] - .12, p[2]).normalize();
      const tip = i === 1 || i === 2, ht = tip ? (.035 + .065 * Math.sin(PI * Math.min(1, v * 1.15))) * (Math.round(v * 18) % 2 ? .82 : 1) : 0;
      return [(i < 2 ? -1 : 1) * (tip ? .007 : .026), p[1] + c.y * ht, p[2] + c.z * ht];
    }), hairM);
    if (hs.h === 4) {
      const t0 = P(.6 * PI, PI, hr(.6 * PI, PI) + .01), t1 = [0, t0[1] - .06, t0[2] - .06], t2 = [0, t0[1] - (fem ? .26 : .19), t0[2] - .05];
      whole(head, merge('pony' + hf, () => [[G.sphere, ...seg(t0, t1, .042, .048)], [G.sphere, ...seg([0, t1[1] + .04, t1[2]], t2, .036, .04)]]), hairM);
      span(head, G.cyl, m(0xb33a2a), t0, t0.map((c, j) => c + (t1[j] - c) * .3), .036);
    }
  }

  const beardC = l.beardColor ? HAIR_COLORS[l.beardColor - 1] : hairC;
  if (l.face === 2) {
    const top = ph => lerp(1.97, 1.4, sstep(.22, 1.4, Math.abs(ph))), mouth = (th, ph) => Math.abs(ph) < .25 && th < 2.2 ? -.06 : 0;
    const bm = m(beardC, { roughness: .8, tex: 'hair' });
    whole(head, scalp('beard', hf, [-.53 * PI, .53 * PI], top, .96 * PI, (v, ph, th) => 1.026 + rel(th, ph) + .07 * v * Math.cos(ph) ** 2 + mouth(th, ph), { n: 36, k: 12, shade: (th, ph, v) => .72 + .28 * Math.sin(PI * Math.min(1, v * 1.3)) }), bm);
    whole(head, scalp('stache', hf, [-.34, .34], ph => 1.8 + .1 * Math.abs(ph), ph => 1.9 + .28 * Math.abs(ph) ** 1.5, (v, ph, th) => 1.04 + rel(th, ph) + .025 * Math.sin(PI * v) * Math.cos(ph * 3), { n: 14, k: 4, shade: (th, ph, v) => .8 + .2 * Math.sin(PI * v) }), bm);
  }
  if (l.face === 3) whole(head, scalp('scar', hf, [.43, .49], ph => 1.14 + (ph - .43) * 1.5, ph => 1.76 + (ph - .43) * 1.5, (v, ph, th) => 1.012 + rel(th, ph) + .01 * Math.sin(PI * (ph - .43) / .06), { n: 3, k: 16, shade: (th, ph, v) => .8 + .2 * Math.sin(PI * v) }), m(0xa84848, { roughness: .45 }));
  if (l.face === 4) {
    whole(head, merge('paintblack' + hf, () => [[scalp('pb-', hf, [-.78, -.18], 1.56, 1.62, (v, ph, th) => 1.006 + rel(th, ph), { n: 10, k: 2 })], [scalp('pb+', hf, [.18, .78], 1.56, 1.62, (v, ph, th) => 1.006 + rel(th, ph), { n: 10, k: 2 })]]), m(0x0e0f10, { roughness: .9 }));
    whole(head, merge('paintred' + hf, () => [[scalp('pr-', hf, [-.74, -.22], 1.66, 1.7, (v, ph, th) => 1.006 + rel(th, ph), { n: 10, k: 2 })], [scalp('pr+', hf, [.22, .74], 1.66, 1.7, (v, ph, th) => 1.006 + rel(th, ph), { n: 10, k: 2 })]]), m(0xb33a2a, { roughness: .9 }));
  }
  if (l.face === 5) {
    const lens = m(0x0a0c10, { roughness: .05, metalness: .6 });
    whole(head, merge('shades' + hf, () => [-1, 1].map(s => [G.pill, P(eye[0] + .02, s * eye[1], 1.1), [.03, .02, .008], [0, s * .38, 0]])), lens);
    whole(head, merge('shadeframe' + hf, () => [[G.box, P(eye[0] - .06, 0, 1.1), [.032, .006, .008]], ...[-1, 1].map(s => [G.box, ...seg(P(eye[0] - .04, s * .72, 1.1), P(1.5, s * 1.55, 1.08), .005, .006)])]), black);
  }
  if (l.face === 6) {
    whole(head, scalp('gstrap' + hk, hf, RING, .3 * PI, .35 * PI, (v, ph, th) => hr(th, ph) + .02, { n: 24, k: 1 }), black);
    for (const s of [-1, 1]) outward(part(head, G.cyl, m(0xff9a3a, { emissive: 0xff7a1a, emissiveIntensity: .6, metalness: .3, roughness: .1 }), P(.34 * PI, s * .34, hr(.34 * PI, s * .34) + .05), [.027, .03, .027]), s * .34, -.35);
  }
  if (l.face === 7) {
    whole(head, scalp('skull', hf, [-.5 * PI, .5 * PI], .57 * PI, .97 * PI, (v, ph, th) => 1.1 + rel(th, ph) * .5, { n: 18, k: 8 }), m(0xe8e4d8, { roughness: .5 }));
    whole(head, merge('skullteeth' + hf, () => [...[-2, -1, 0, 1, 2].map(i => [G.box, P(2.05, i * .13, 1.12), [.006, .05, .006], [0, i * .13, 0]]), ...[-1, 1].map(s => [G.sphere, P(1.45, s * .4, 1.1), [.03, .026, .012], [0, s * .4, 0]])]), black);
  }
  const k = fem ? .93 : 1;
  if (l.head === 1) {
    const cc = m(OUTFIT_COLORS[(l.topColor + 1) % 16], { tex: 'twill', roughness: .9 });
    whole(head, scalp('cap', hf, RING, 0, line(.36, .47, .5), (v, ph) => 1.1 + .01 * Math.sin(ph * 6) * v, { k: 8, shade: (th, ph, v) => .85 + .15 * v }), cc);
    whole(head, shell('brim' + hf, 16, 4, (u, v) => {
      const ph = (u - .5) * 1.9, q = P(.36 * PI, ph, 1.1), d = Math.hypot(q[0], q[2]), out = .075 * (1 - .45 * (2 * u - 1) ** 2) * v;
      return [q[0] + q[0] / d * out, q[1] - .004 - .018 * v * v - .012 * (2 * u - 1) ** 2 * v, q[2] + q[2] / d * out, 1 - .15 * v];
    }), m(OUTFIT_COLORS[(l.topColor + 1) % 16], { tex: 'twill', roughness: .9, side: THREE.DoubleSide }));
    part(head, G.sphere, cc, P(0, 0, 1.1), [.016, .01, .016]);
  }
  if (l.head === 2) {
    const kn = m(new THREE.Color(topDark.color).getHex(), { tex: 'knit', roughness: 1 });
    whole(head, scalp('beanie', hf, RING, 0, line(.33, .5, .56), (v, ph) => 1.11 + .012 * Math.cos(ph * 12), { n: 48, k: 6 }), kn);
    whole(head, scalp('cuff', hf, RING, line(.25, .42, .48), line(.33, .5, .56), (v) => 1.15 + .01 * Math.sin(PI * v), { k: 3 }), kn);
    const t = P(0, 0, 1.11);
    part(head, G.lowSphere, kn, [0, t[1] + .025, t[2]], [.035, .035, .035]);
  }
  if (l.head === 3) {
    const red = m(0xb33a2a, { tex: 'cotton' });
    whole(head, scalp('band' + hk, hf, RING, line(.28, .36, .43), line(.33, .42, .5), (v, ph, th) => hr(th, ph) + .025, { n: 24, k: 2 }), red);
    const kn = P(.47 * PI, PI, hr(.47 * PI, PI) + .05);
    whole(head, merge('bandknot' + hf + hk, () => [[G.sphere, kn, [.025, .022, .02]], ...[-1, 1].map(s => [G.box, [kn[0] + s * .02, kn[1] - .045, kn[2] - .01], [.03, .07, .008], [.2, 0, s * .35]])]), red);
  }
  if (l.head === 4) {
    const br = m(0x6a4428, { roughness: .9, tex: 'leather' }), y = P(.4 * PI, 0, 1)[1] - .005;
    part(head, G.cyl, br, [0, y, -.005], [.27 * k, .014, .25 * k]);
    part(head, G.cyl, br, [0, y + .07, -.005], [.13 * k, .13, .145 * k]);
    part(head, G.box, m(0x5a3a20, { roughness: .9 }), [0, y + .135, -.005], [.03, .012, .2 * k]);
    part(head, G.cyl, m(0x2a1a0e), [0, y + .025, -.005], [.132 * k, .025, .142 * k]);
  }
  if (l.head === 5) {
    const hm = m(0x3b4a2e, { roughness: .8, tex: 'canvas', bump: 1 });
    whole(head, scalp('helm', hf, RING, 0, line(.37, .56, .6), 1.22, { k: 7 }), hm);
    whole(head, scalp('helmrim', hf, RING, line(.35, .53, .57), line(.38, .57, .61), 1.27, { k: 1 }), hm);
    whole(head, merge('helmstrap' + hf, () => [-1, 1].map(s => [G.box, ...seg(P(.57 * PI, s * .5 * PI, 1.15), P(.9 * PI, s * .25 * PI, 1.04), .012, .014)])), black);
  }
  if (l.head === 6) {
    const rub = m(0x1a1c1e, { roughness: .7, tex: 'rubber' });
    whole(head, scalp('mask', hf, [-.42 * PI, .42 * PI], .36 * PI, .92 * PI, (v, ph, th) => 1.1 + .1 * Math.sin(v * PI) * Math.cos(ph) ** 4 + .14 * gs((th - 1.66) / .14) * gs(ph / .25), { n: 18, k: 12 }), rub);
    whole(head, scalp('mstrap' + hk, hf, [.4 * PI, 1.6 * PI], .42 * PI, .47 * PI, (v, ph, th) => hr(th, ph) + .02, { n: 16, k: 1 }), black);
    for (const s of [-1, 1]) outward(part(head, G.cyl, m(0x5a8a7a, { metalness: .5, roughness: .1 }), P(eye[0], s * eye[1], 1.16), [.03, .02, .03]), s * eye[1]);
    outward(part(head, G.cyl, m(0x3a3a3a, { metalness: .5 }), P(.68 * PI, 0, 1.3), [.042, .06, .042]), 0, .35);
  }
  if (l.head === 7) {
    const th = .2 * PI;
    whole(head, scalp('crown' + hk, hf, RING, th - .03, th + .03, (v, ph, t) => hr(t, ph) + .015, { n: 24, k: 1 }), m(0x7dff3a, { emissive: 0x5aff2a, emissiveIntensity: 1.2 }));
    whole(head, merge('crownspikes' + hf + hk, () => Array.from({ length: 7 }, (_, i) => {
      const ph = i / 7 * 2 * PI, p = new THREE.Vector3(...P(th - .05, ph, hr(th, ph) + .01)), d = new THREE.Vector3(Math.sin(ph) * .3, 1, Math.cos(ph) * .3).normalize();
      return [G.cone, p.addScaledVector(d, .03).toArray(), [.018, .07, .018], new THREE.Quaternion().setFromUnitVectors(Y, d)];
    })), m(0xd9d0b4));
  }
}

const TORSO = [[
  [-.2, 0, 0, 0], [-.185, .07, .05, .06], [-.15, .146, .086, .106], [-.08, .166, .097, .114], [0, .16, .098, .104], [.08, .152, .1, .094],
  [.17, .156, .106, .094], [.27, .172, .118, .1], [.36, .188, .124, .104], [.43, .194, .116, .102], [.475, .18, .096, .096], [.51, .135, .074, .082], [.54, .082, .056, .062], [.565, .062, .05, .054],
], [
  [-.2, 0, 0, 0], [-.185, .08, .05, .068], [-.15, .168, .086, .118], [-.08, .19, .094, .13], [0, .172, .09, .11], [.08, .136, .08, .086],
  [.16, .118, .078, .078], [.24, .128, .084, .08], [.32, .145, .088, .084], [.39, .152, .088, .086], [.435, .148, .08, .084], [.47, .12, .064, .073], [.5, .07, .047, .053], [.525, .05, .04, .045],
]];
const BUILDS = [
  { w: 1, d: 1, sh: 1, limb: 1, belly: 0, pec: 1, neck: 1 },
  { w: .86, d: .84, sh: .9, limb: .8, belly: 0, pec: .5, neck: .86 },
  { w: 1.2, d: 1.24, sh: 1.08, limb: 1.16, belly: 1.5, pec: .8, neck: 1.22 },
  { w: 1.04, d: 1.1, sh: 1.2, limb: 1.3, belly: 0, pec: 3, neck: 1.25 },
];
function curve(T, y) {
  const n = T.length;
  if (y <= T[0][0]) return T[0].slice(1);
  if (y >= T[n - 1][0]) return T[n - 1].slice(1);
  let i = 1;
  while (y > T[i][0]) i++;
  const A = T[i - 1], B = T[i], Pp = T[i - 2], Q = T[i + 1], h = B[0] - A[0], t = (y - A[0]) / h, t2 = t * t, t3 = t2 * t;
  return A.slice(1).map((a, j) => {
    const b = B[j + 1], m0 = Pp ? (b - Pp[j + 1]) / (B[0] - Pp[0]) * h : b - a, m1 = Q ? (Q[j + 1] - a) / (Q[0] - A[0]) * h : b - a;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1;
  });
}
const shapes = new Map();
function shapeOf(f, b) {
  const key = f + '' + b;
  if (shapes.has(key)) return shapes.get(key);
  const T = TORSO[f], B = BUILDS[b];
  const S = {
    key, f, B,
    shx: (f ? .168 : .2) * B.sh, shy: f ? .41 : .438, top: T[T.length - 1][0],
    at(y, a, e = 0) {
      const [hw0, df0, db0] = curve(T, y), wf = B.w + (B.sh - B.w) * sstep(.3, .47, y);
      const hw = hw0 * wf, sa = Math.sin(a), ca = Math.cos(a), xs = sq(sa, .62), zs = sq(ca, .62), x = hw * xs, ax = Math.abs(x);
      let d;
      if (ca >= 0) {
        d = df0 * B.d;
        if (f) d += .062 * (b === 1 ? .8 : b === 2 ? 1.15 : 1) * gs((y - .315) / (y < .315 ? .045 : .09)) * gs((ax - .072) / .06);
        else d += .014 * B.pec * gs((y - .37) / (y < .37 ? .045 : .075)) * gs((ax - .085) / .065);
        d += .032 * B.belly * gs((y - .12) / .13) * gs(x / .13);
      } else {
        d = db0 * B.d + .008 * gs((y - .38) / .06) * gs((ax - .085) / .05) - .007 * gs(x / .016) * sstep(0, .1, y) * sstep(.5, .4, y)
          + (f ? .022 : .012) * gs((y + .1) / .065) * gs((ax - .075) / .07) - .01 * gs(x / .012) * sstep(-.04, -.1, y);
      }
      const z = (d + e) * zs;
      if (f && ca > 0 && y < .315 && y > .1) { const za = S.at(.315, a, e)[2] - .42 * (.315 - y); if (za > z) return [(hw + e) * xs, y, lerp(z, za, sstep(.1, .2, y))]; }
      return [(hw + e) * xs, y, z];
    },
  };
  shapes.set(key, S);
  return S;
}
function tsurf(key, S, n, k, fn) {
  return shell(key + '@' + S.key, n, k, (u, v, i) => { const [y, a, e, c] = fn(u, v, i), p = S.at(y, a, e); if (c !== undefined) p.push(c); return p; },
    (u, v) => { const [y, a, e] = fn(u, v, 0), p = S.at(y, a, e), q = S.at(y, a, e + .01); return [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; });
}
const pillowEdge = (t, k) => Math.min(1, Math.sin(PI * Math.min(1, Math.max(0, t))) * k) ** .5;
function tband(key, S, y0, y1, e, h = 0, shade) {
  return tsurf('band' + key + [y0, y1, e, h], S, 36, 3, (u, v) => { const y = lerp(y1, y0, v); return [y, PI + u * TAU, e + h * pillowEdge(v, 3), shade?.(u, v)]; });
}
function tpatch(key, S, y0, y1, a0, a1, e, h, edge = 4, shade) {
  if (a0 > a1) [a0, a1] = [a1, a0];
  return tsurf('patch' + key + [y0, y1, a0, a1, e, h, edge], S, 10, 8, (u, v) => [lerp(y1, y0, v), lerp(a0, a1, u), e + h * pillowEdge(u, edge) * pillowEdge(v, edge), shade?.(u, v)]);
}

function tube(key, len, prof, { n = 16, k = 24, from, to } = {}) {
  if (geos.has(key)) return geos.get(key);
  const r0 = Math.max(...prof(0, 0).slice(0, 2)), r1 = Math.max(...prof(1, 0).slice(0, 2));
  const s0 = from ?? -r0, s1 = to ?? len + r1;
  return shell(key, n, k, (u, v) => {
    const s = lerp(s0, s1, v), t = Math.min(1, Math.max(0, s / len)), a = PI + u * TAU;
    const [rx, rz, zc = 0, c = 1] = prof(t, a, s);
    let f = 1;
    if (s < 0) f = Math.sqrt(Math.max(0, 1 - (s / r0) ** 2));
    if (s > len) f = Math.sqrt(Math.max(0, 1 - ((s - len) / r1) ** 2));
    return [Math.sin(a) * rx * f, -s, zc + Math.cos(a) * rz * f, c];
  }, 'c');
}
function lsurf(key, len, prof, n, k, fn) {
  return shell(key, n, k, (u, v) => {
    const [t, a, e, c] = fn(u, v), [rx, rz, zc = 0] = prof(Math.min(1, Math.max(0, t)), a, t * len);
    return [Math.sin(a) * (rx + e), -t * len, zc + Math.cos(a) * (rz + e), c ?? 1];
  }, (u, v) => { const a = fn(u, v)[1]; return [Math.sin(a), 0, Math.cos(a)]; });
}

function handGeo(fem, b, which) {
  return merge('hand' + fem + b + which, () => {
    const k = (fem ? .84 : 1) * [1, .95, 1.06, 1.08][b], out = [];
    if (which !== 'digits') out.push([G.rbox, [0, -.044 * k, 0], [.037 * k, .046 * k, .016 * k]]);
    if (which === 'palm') return out;
    const lens = [.034, .038, .036, .028];
    for (let i = 0; i < 4; i++) {
      const r = (i === 3 ? .0075 : .0088) * k;
      let p = new THREE.Vector3((-.026 + i * .0175) * k, -.086 * k + (i === 0 || i === 3 ? .004 : 0), .002);
      [[.8, .45], [1.8, .32], [2.6, .23]].forEach(([th, fr]) => {
        const d = new THREE.Vector3(0, -Math.cos(th), Math.sin(th)), L = lens[i] * k * fr / .45 * .5;
        const c = p.clone().addScaledVector(d, L / 2);
        out.push([white(new THREE.CapsuleGeometry(r, L, 2, 6)), c.toArray(), [1, 1, 1], new THREE.Quaternion().setFromUnitVectors(Y, d)]);
        p = p.addScaledVector(d, L);
      });
    }
    let p = new THREE.Vector3(.03 * k, -.02 * k, .006);
    for (const [dx, dy, dz, L] of [[.3, -.7, .6, .03], [-.2, -.5, .8, .026]]) {
      const d = new THREE.Vector3(dx, dy, dz).normalize(), c = p.clone().addScaledVector(d, L * k / 2);
      out.push([white(new THREE.CapsuleGeometry(.0105 * k, L * k, 2, 6)), c.toArray(), [1, 1, 1], new THREE.Quaternion().setFromUnitVectors(Y, d)]);
      p = p.addScaledVector(d, L * k);
    }
    return out;
  });
}

function footOutline(a, bw) {
  const c = Math.cos(a), w = (.04 + .009 * Math.max(0, c) - .007 * Math.max(0, -c) - .006 * Math.max(0, c) ** 6) * bw;
  return [w * sq(Math.sin(a), .75), .072 * bw + .148 * bw * sq(c, .85)];
}
const BOOT = [
  { hc: .2, color: 0x1d1e21, rough: .5, sole: .028, lace: 0x111214 },
  { hc: .088, color: 0xffffff, rough: .6, sole: .034, lace: 0xf2f2f2 },
  { hc: .15, color: 0x6e4526, rough: .55, sole: .032, lace: 0xc8a060 },
  { hc: .165, color: 0xffffff, rough: .5, sole: .03, lace: 0xf2f2f2 },
];
function bootPoint(style, bw, a, v, e = 0) {
  const B = BOOT[style], [x0, z0] = footOutline(a, bw), ca = Math.cos(a), sa = Math.sin(a), ha = .085, w = (ca + 1) / 2;
  const ring = (h, rx, rz, zc) => [(rx * bw + e) * sa, h, zc * bw + (rz * bw + e) * ca];
  const P0 = [x0 * (1 + e * 8), 0, z0 + e * ca], P1 = [lerp(x0 * 1.03, x0 * .96, w), lerp(.045, .05, w), lerp(z0 - .004, z0 - .03, w)], P2 = ring(ha, .047, .07, .016);
  const hc = B.hc + (style === 1 ? .014 * -ca : 0), vA = hc > ha + .02 ? .55 : 1;
  if (v <= vA) { const t = v / vA, q = 1 - t; return [0, 1, 2].map(i => q * q * P0[i] + 2 * t * q * P1[i] + t * t * P2[i]).map((c, i) => i === 1 ? c : c); }
  const t = (v - vA) / (1 - vA), P3 = ring(hc, .051, .056, .002);
  return [0, 1, 2].map(i => lerp(P2[i], P3[i], t) + (i !== 1 ? (i === 0 ? sa : ca) * .004 * sstep(.8, 1, t) : 0));
}
function bootShade(style, a, v, y, z) {
  const ca = Math.cos(a), sa = Math.sin(a), hc = BOOT[style].hc;
  if (style === 0) return y > hc - .018 ? .6 : ca > .5 && y < .06 ? 1.35 : y < .01 ? .8 : 1;
  if (style === 2) return y > hc - .016 ? .55 : Math.abs(y - .014) < .003 ? 1.8 : ca > .55 && y < .055 ? .78 : 1;
  if (style === 1) {
    const swoosh = Math.abs(sa) > .45 && ca < .7 && Math.abs(y - (.03 + .1 * (.14 - z))) < .009;
    return swoosh || (ca < -.8 && y > .05) ? [.16, .34, .56] : ca > .5 && y < .018 ? .82 : .95;
  }
  const toe = ca > .42 && y < .048, fox = y < .013, patch = Math.abs(sa) > .82 && Math.abs(y - .115) < .02 && Math.abs(ca) < .35;
  return toe || fox || patch ? .96 : [.72, .15, .12];
}
function bootGeos(style, fem) {
  const bw = fem ? .86 : 1, B = BOOT[style];
  const upper = shell('boot' + style + fem, 36, 20, (u, v) => {
    const a = PI + u * TAU, p = bootPoint(style, bw, a, v);
    p.push(bootShade(style, a, v, p[1], p[2]));
    return p;
  }, 'c');
  const soleKey = 'sole' + style + fem;
  let sole = geos.get(soleKey);
  if (!sole) {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 40; i++) { const [x, z] = footOutline(i / 40 * TAU, bw * 1.07); i ? sh.lineTo(x, -z + .0) : sh.moveTo(x, -z); }
    const bt = .005;
    sole = new THREE.ExtrudeGeometry(sh, { depth: B.sole - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: .004, bevelSegments: 2, curveSegments: 4 });
    sole.rotateX(-PI / 2); sole.translate(0, bt, 0);
    const P = sole.attributes.position, c = [];
    const top = [[.07, .07, .075], [.95, .95, .93], [.78, .58, .34], [.95, .95, .93]][style], bot = [[.03, .03, .03], [.3, .3, .32], [.12, .1, .08], [.25, .25, .27]][style];
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), t = sstep(.004, .012, y); c.push(...top.map((v, j) => lerp(bot[j], v, t))); }
    sole.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    sole.computeVertexNormals();
    geos.set(soleKey, sole);
  }
  const laces = merge('laces' + style + fem, () => {
    const out = [], rows = style === 1 ? [.5, .6, .7, .8, .9] : style === 2 ? [.42, .5, .58, .7, .82, .94] : [.44, .52, .62, .72, .82, .92];
    for (const v of rows) {
      const A = bootPoint(style, bw, -.32, v, .004), Bp = bootPoint(style, bw, .32, v + .05, .004), C = bootPoint(style, bw, .32, v, .004), D = bootPoint(style, bw, -.32, v + .05, .004);
      out.push([G.box, ...seg(A, Bp, .004, .003)], [G.box, ...seg(C, D, .004, .003)]);
    }
    return out;
  });
  return { upper, sole, laces, sy: B.sole };
}

function sleeveFold(t, a, amt) { return 1 + amt * Math.sin(a * 3 + t * 21) * (gs((t - .95) / .1) + gs((t - .05) / .1)); }

export function buildSurvivor(l0) {
  const suit = SUITS[l0.suit] || null;
  const l = suit ? { ...l0, ...suit.base } : l0;
  const f = l.body === 1 ? 1 : 0, b = BUILDS[l.build] ? l.build | 0 : 0, S = shapeOf(f, b), B = S.B;
  const hf = f | ((JAWS[l.jaw] ? l.jaw | 0 : 0) << 1);
  const root = new THREE.Group(), body = new THREE.Group();
  body.scale.setScalar((f ? .95 : 1) * ([1, .94, 1.06][l.height] || 1));
  root.add(body);
  const skinC = SKIN_TONES[l.skin] ?? SKIN_TONES[1], hairC = HAIR_COLORS[l.hairColor] ?? HAIR_COLORS[0];
  const topC = OUTFIT_COLORS[l.topColor] ?? OUTFIT_COLORS[0], pantsC = PANTS_COLORS[l.pants] ?? PANTS_COLORS[0];
  const style = l.top, hazmat = style === 7, mark = l.skinMark | 0, ps = l.pantsStyle | 0;
  const accentC = ACCENT_COLORS[l.accent] ?? null;
  const beardHex = l.beardColor ? HAIR_COLORS[l.beardColor - 1] : hairC;
  const skin = m(skinC, { roughness: .55, tex: 'skin' }), face = m(skinC, { roughness: .5, tex: 'face:' + ([1, 2, 3, 6].includes(mark) ? mark : 0) + (l.face === 1 ? ':' + beardHex : '') });
  const topTex = suit?.id === 'diver' ? 'canvas' : { 2: 'leather', 3: 'canvas', 4: 'camo', 7: 'rubber', 1: 'cotton', 6: 'cotton' }[style] || 'cotton';
  const top = m(topC, { roughness: style === 2 ? .38 : style === 7 ? .45 : .88, metalness: style === 2 ? .12 : .02, tex: topTex, bump: style === 2 || style === 4 ? .6 : .3 });
  const darkC = new THREE.Color(topC).multiplyScalar(.6).getHex();
  const topDark = m(darkC, { roughness: .9, tex: style === 1 || style === 6 ? 'knit' : 'cotton' });
  const accent = m(accentC ?? darkC, { roughness: .7, tex: 'cotton' });
  const pants = hazmat ? top : m(pantsC, { roughness: .92, tex: ps === 2 ? 'denim' : 'twill', bump: .4 });
  const under = m(accentC ?? (style === 2 ? 0xd8d4c8 : 0x2a2e30), { roughness: .9, tex: 'cotton' });
  const black = m(0x0b0c0e, { roughness: .5 });
  const metal = m(0xb8bcc0, { metalness: .85, roughness: .3 }), brass = m(0xb8943a, { metalness: .85, roughness: .3 });
  const gk = hazmat && !l.gloves ? 'hazmat' : gloveKind(l);
  const glove = gk === 'hazmat' ? m(0x1a1a1a, { roughness: .45, tex: 'rubber' }) : gk ? m(GLOVES[gk], { roughness: gk === 'leather' ? .45 : .8, tex: gk === 'tactical' || gk === 'fingerless' ? 'canvas' : 'leather', bump: .4 }) : skin;
  const armSkin = mark === 5 ? m(skinC, { roughness: .55, tex: 'ink:arm' }) : skin;
  const neckSkin = mark === 4 ? m(skinC, { roughness: .55, tex: 'ink:neck' }) : skin;
  const tucked = [3, 4].includes(style), longSleeve = style !== 0;
  const legs = [];

  const lk = f ? .92 : 1, L = B.limb;
  const bagg = [1, 1.12, .92, 1.04][ps] * (hazmat ? 1.12 : 1), lw = 1 + (B.limb - 1) * .7;
  const boot = bootGeos(hazmat ? 0 : l.boots | 0, f), bootStyle = hazmat ? 0 : l.boots | 0, tuck = bootStyle === 0 || hazmat;
  const hemY = tuck ? .17 : bootStyle === 1 ? .1 : BOOT[bootStyle].hc + .012, shinLen = .48 - boot.sy - hemY;
  const thighProf = (t, a) => {
    const r = curve([[0, f ? .1 : .094], [.35, f ? .086 : .084], [.75, f ? .068 : .07], [1, f ? .058 : .063]], t)[0] * lk * lw * lerp(1, bagg, sstep(.1, .6, t));
    const fold = 1 + .035 * Math.sin(a * 4 + t * 26) * gs((t - .95) / .08) * (Math.cos(a) < 0 ? 1.5 : .5);
    return [r * fold, r * 1.03 * fold, .004, .88 + .12 * sstep(0, .2, t) - (ps === 2 ? -.12 * gs((t - .85) / .12) * Math.max(0, Math.cos(a)) : 0)];
  };
  const shinProf = (t, a) => {
    let r = curve([[0, f ? .058 : .063], [.3, f ? .058 : .064], [.75, f ? .05 : .056], [1, tuck ? .044 : .062]], t)[0] * lk * (tuck ? 1 + (lw - 1) * .5 : lw * lerp(1, bagg, .6));
    const bunch = tuck ? 0 : .045 * Math.sin(a * 5 + t * 30) * sstep(.75, 1, t);
    return [r * (1 + bunch), r * (1 + bunch) * 1.04, .002, (t > .96 && !tuck ? .75 : 1) * (1 + (ps === 2 ? .1 * gs((t - .1) / .15) * Math.max(0, Math.cos(a)) : 0))];
  };
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * (f ? .098 : .1) * (1 + (B.w - 1) * .7), .9, 0); body.add(hip);
    if (f) hip.rotation.z = s * .025;
    whole(hip, tube('thigh' + f + b + ps + hazmat, .42, thighProf, { n: 18, k: 24, to: .42 + .06 }), pants);
    const knee = new THREE.Group(); knee.position.set(0, -.42, 0); hip.add(knee);
    if (f) knee.rotation.z = -s * .025;
    whole(knee, tube('shin' + f + b + ps + hazmat + bootStyle, shinLen, shinProf, { n: 18, k: 22, to: shinLen }), pants);
    const bootM = hazmat ? m(0x121314, { roughness: .5, tex: 'rubber' }) : m(BOOT[bootStyle].color, { roughness: BOOT[bootStyle].rough, tex: 'leather', bump: .5 });
    whole(knee, boot.upper, bootM).position.y = -.48 + boot.sy;
    whole(knee, boot.sole, hazmat ? black : m(0xffffff, { roughness: .85, tex: 'rubber' })).position.y = -.48;
    whole(knee, boot.laces, m(hazmat ? 0x0b0c0e : BOOT[bootStyle].lace, { roughness: .9 })).position.y = -.48 + boot.sy;
    if (ps === 1 || ps === 3) whole(hip, lsurf('cargo' + f + b + ps + s, .42, thighProf, 8, 8, (u, v) => {
      const flap = v < .2, t = lerp(.36, ps === 3 ? .56 : .64, v), a = s * PI / 2 + (u - .5) * (ps === 3 ? .8 : 1.05);
      return [t, a, .004 + (flap ? .02 : .016) * pillowEdge(u, 4) * pillowEdge(v, 5), flap ? .8 : v > .95 ? .8 : 1];
    }), pants);
    if (ps === 3) whole(knee, merge('kneepad' + f, () => [[G.rbox, [0, .005, .058 * lk], [.052 * lk, .07, .026 * lk], [-.08, 0, 0]], [G.box, [0, -.035, 0], [.13 * lk, .016, .13 * lk]]]), m(0x16171a, { roughness: .6, tex: 'rubber' }));
    legs.push({ hip, knee, s });
  }

  const pelvis = new THREE.Group(); pelvis.position.y = 1.02; body.add(pelvis);
  whole(pelvis, tsurf('pelvis' + hazmat, S, 36, 12, (u, v) => { const y = lerp(.04, -.2, v), a = PI + u * TAU; return [y, a, hazmat ? .01 : .002, 1 - .12 * sstep(-.14, -.2, y)]; }), pants);
  if (!hazmat && tucked) {
    whole(pelvis, tband('belt', S, -.035, .005, .008, .004), m(0x1e1712, { roughness: .45, tex: 'leather', bump: .5 }));
    part(pelvis, G.rbox, m(accentC && l.accent > 2 ? accentC : 0xa8a080, { metalness: .85, roughness: .25 }), S.at(-.015, 0, .016), [.024, .018, .005]);
  }
  if (!hazmat && style !== 5) whole(pelvis, merge('bpockets' + S.key, () => [-1, 1].map(s => [tpatch('bpocket' + s, S, -.14, -.07, PI + s * .28, PI + s * .82, .004, .003, 6, (u, v) => v < .12 ? .8 : 1)])), pants);

  const torso = new THREE.Group(); torso.position.y = 1.02; body.add(torso);
  const trunk = f ? new THREE.Group() : torso;
  if (f) { trunk.scale.set(.86, .93, .94); torso.add(trunk); }
  const bulk = hazmat ? .018 : style === 5 ? .012 : style === 3 || style === 4 ? .006 : .004;
  const hemLow = tucked ? -.005 : style === 2 ? -.045 : -.075;
  const shirtShade = (y, a) => {
    const ax = Math.abs(Math.sin(a)), c = Math.cos(a);
    let k = 1 - .12 * gs((y - .41) / .06) * ax ** 6 - .05 * Math.abs(Math.sin(a * 3 + y * 40)) * gs((y - .08) / .08);
    if (f) k -= .1 * gs((y - .255) / .03) * Math.max(0, c) * gs((Math.abs(Math.sin(a)) - .45) / .3);
    if (!tucked && y < hemLow + .025) k *= style === 1 || style === 6 ? .78 : .88;
    return k;
  };
  const shirtGeo = (key, e0, from = hemLow) => tsurf('shirt' + key + from + e0, S, 44, 36, (u, v) => {
    const y = lerp(S.top, from, v), a = PI + u * TAU;
    const e = e0 + (tucked ? 0 : .012 * sstep(.06, hemLow, y) * (1 + .4 * Math.sin(a * 7))) + (style === 1 || style === 6 ? .01 * sstep(.2, hemLow, y) : 0);
    return [y, a, e, shirtShade(y, a)];
  });
  const chestM = style === 3 ? under : top;
  if (style === 2) {
    whole(torso, shirtGeo('u', 0, .0), under);
    whole(torso, tsurf('jacket' + hemLow, S, 40, 34, (u, v) => { const y = lerp(S.top - .01, hemLow, v), a = lerp(.26 - .1 * sstep(.35, .5, y), TAU - .26 + .1 * sstep(.35, .5, y), u); return [y, a, .012 + .01 * sstep(-.01, hemLow, y), shirtShade(y, a) * (y < hemLow + .03 ? .8 : 1)]; }), top);
    whole(torso, merge('lapels' + S.key, () => [-1, 1].map(s => [tsurf('lapel' + s, S, 6, 10, (u, v) => { const y = lerp(.52, .3, v), w = lerp(.32, .02, v); return [y, s * (.2 + u * w), .02 + .008 * Math.sin(PI * u), .92]; })])), top);
    whole(torso, merge('zips' + S.key, () => [-1, 1].map(s => [tpatch('zip' + s, S, hemLow + .005, .31, s * .245, s * .27, .016, .002, 8)])), metal);
  } else whole(torso, shirtGeo(style, bulk), chestM);

  if (style === 0) whole(torso, tband('collar', S, S.top - .028, S.top - .004, .006, .004), accentC ? accent : topDark);
  if (style === 1) {
    whole(torso, shell('hood' + S.key, 24, 10, (u, v) => {
      const a = lerp(.6, TAU - .6, u), back = (1 - Math.cos(a)) / 2, c = S.at(.515, a, .012 + .03 * back), r = .022 + .032 * back, n = new THREE.Vector2(c[0], c[2]).normalize(), t = v * TAU;
      return [c[0] + n.x * r * Math.cos(t), c[1] + r * Math.sin(t) * (1 + back * .6) - back * .02, c[2] + n.y * r * Math.cos(t), .8 + .2 * Math.sin(t)];
    }, (u, v) => { const a = lerp(.6, TAU - .6, u), c = S.at(.515, a, .02), n = new THREE.Vector2(c[0], c[2]).normalize(), t = v * TAU; return [n.x * Math.cos(t), Math.sin(t), n.y * Math.cos(t)]; }), top);
    whole(torso, tpatch('kanga', S, .03, .19, -.8, .8, .011, .008, 5, (u, v) => v < .1 ? .75 : 1), top);
    whole(torso, merge('strings' + S.key, () => [-1, 1].flatMap(s => { const a = S.at(.5, s * .22, .018), b = S.at(.36, s * .24, .022); return [[G.cyl, ...seg(a, b, .004)], [G.cyl, ...seg(b, [b[0], b[1] - .018, b[2]], .006)]]; })), accentC ? accent : m(0xeeeeee, { roughness: .8 }));
  }
  if (style === 3) {
    const vestM = m(topC, { roughness: .85, tex: 'molle', bump: .8 });
    whole(torso, merge('vest' + S.key, () => [
      [tpatch('plateF', S, .1, .47, -1.15, 1.15, .02, .014, 5)], [tpatch('plateB', S, .1, .47, PI - 1.2, PI + 1.2, .02, .014, 5)],
      [tband('cumm', S, .1, .2, .018, .004)],
      ...[-1, 1].map(s => [tsurf('strap' + s, S, 4, 14, (u, v) => { const a = s * lerp(.55, PI - .55, v), y = .455 + .085 * Math.sin(PI * v) ** .7; return [Math.min(y, S.top - .012), a + s * (u - .5) * .3, .024 + .004 * Math.sin(PI * u)]; })]),
    ]), vestM);
    whole(torso, merge('pouches' + S.key, () => [-.36, 0, .36].map(a => [tpatch('pouch' + a, S, .13, .25, a - .15, a + .15, .03, .03, 9, (u, v) => v < .22 ? .82 : 1)]).concat([[tpatch('admin', S, .33, .43, -.62, -.28, .03, .014, 7)]])), m(new THREE.Color(topC).multiplyScalar(.85).getHex(), { roughness: .85, tex: 'canvas', bump: .6 }));
    whole(torso, tpatch('velcro', S, .38, .44, .3, .58, .036, .002, 8), accentC ? accent : topDark);
  }
  if (style === 4) {
    whole(torso, merge('bdu' + S.key, () => [
      ...[-1, 1].map(s => [tpatch('cpocket' + s, S, .26, .38, s * .22, s * .62, bulk + .004, .012, 6, (u, v) => v < .3 ? .8 : 1)]),
      [tpatch('placket', S, -.0, S.top - .04, -.05, .05, bulk + .003, .002, 8)],
      [tband('bducollar', S, S.top - .04, S.top + .004, .016, .006)],
    ]), top);
    whole(torso, merge('buttons' + S.key, () => [.08, .2, .32, .44].map(y => [G.lowSphere, S.at(y, 0, bulk + .007), [.007, .007, .004]])), m(0x2a2a24, { roughness: .6 }));
    whole(torso, tpatch('nametape', S, .4, .425, -.6, -.24, bulk + .018, .001, 8), accentC ? accent : topDark);
  }
  if (style === 5) {
    whole(torso, shell('skirt' + S.key, 36, 16, (u, v) => {
      const a = lerp(.2, TAU - .2, u), y = lerp(.06, -.58, v), t = sstep(0, 1, v), base = S.at(Math.max(y, -.1), a, .016);
      const rx = Math.max(Math.abs(base[0]), (.2 + .06 * t) * Math.abs(Math.sin(a))) * Math.sign(Math.sin(a)) * (1 + .025 * Math.sin(a * 9) * t), rz = (Math.cos(a) > 0 ? Math.max(base[2], (.15 + .05 * t) * Math.cos(a)) : Math.min(base[2], (.16 + .05 * t) * Math.cos(a))) * (1 + .025 * Math.sin(a * 9) * t);
      return [rx, y, rz, (v > .95 ? .8 : 1) * (.92 + .08 * Math.sin(a * 9))];
    }), top);
    whole(torso, merge('trench' + S.key, () => [
      ...[-1, 1].map(s => [tsurf('tlapel' + s, S, 6, 10, (u, v) => { const y = lerp(S.top + .005, .3, v), w = lerp(.5, .05, v); return [y, s * (.12 + u * w), bulk + .014 + .01 * Math.sin(PI * u)]; })]),
      [tband('tbelt', S, .06, .11, bulk + .012, .004)],
      ...[-1, 1].map(s => [tpatch('epaul' + s, S, S.top - .06, S.top - .03, s * 1.1, s * 1.9, bulk + .01, .004, 6)]),
    ]), topDark);
    whole(torso, merge('tbuttons' + S.key, () => [.18, .28, .38].flatMap(y => [-1, 1].map(s => [G.lowSphere, S.at(y, s * .3, bulk + .012), [.009, .009, .005]]))), m(0x2a2018, { roughness: .4 }));
    part(torso, G.rbox, m(accentC ?? 0x8a7a50, { metalness: .7, roughness: .3 }), S.at(.085, 0, bulk + .02), [.022, .02, .005]);
  }
  if (style === 6) {
    const stripe = accentC ? accent : m(0xf2f2f2, { roughness: .6 });
    whole(torso, tband('tcollar', S, S.top - .03, S.top + .01, .014, .004), top);
    whole(torso, merge('tstripes' + S.key, () => [-1, 1].map(s => [tpatch('tside' + s, S, hemLow + .02, .43, s * (PI / 2 - .06), s * (PI / 2 + .06), bulk + .002, .001, 8)])), stripe);
    whole(torso, tpatch('tzip', S, hemLow + .01, S.top + .005, -.025, .025, bulk + .003, .002, 8), metal);
    part(torso, G.rbox, stripe, S.at(.47, 0, bulk + .012), [.008, .016, .004]);
  }
  if (hazmat) {
    whole(torso, tpatch('hzflap', S, -.08, S.top - .02, -.09, .09, bulk + .004, .006, 6), top);
    whole(torso, tpatch('hzid', S, .3, .38, .2, .55, bulk + .01, .002, 8), m(0x111111));
    whole(torso, tband('hzcollar', S, S.top - .03, S.top + .02, bulk + .01, .008), m(accentC ?? 0x111111, { roughness: .6, tex: 'rubber' }));
  }

  const arms = {}, ak = (f ? .82 : 1) * L;
  const upperProf = (t, a) => {
    const r = curve([[0, .058], [.2, .056], [.45, .053], [.75, .046], [1, .041]], t)[0] * ak;
    return [r, r * (1 + .06 * gs((t - .45) / .2) * (b === 3 ? 2 : 1)), 0, 1];
  };
  const foreProf = (t, a) => {
    const r = curve([[0, .046], [.18, .048], [.55, .038], [1, .029]], t)[0] * ak;
    return [r, r * (1 - .18 * t), 0, 1];
  };
  const sleeveOut = hazmat ? .016 : style === 5 ? .012 : style === 2 ? .008 : .006;
  const upperSleeve = (t, a) => { const [rx, rz] = upperProf(t, a), fo = sleeveFold(t, a, .04); return [(rx + sleeveOut) * fo, (rz + sleeveOut) * fo, 0, 1 - .15 * gs((t - 1) / .1)]; };
  const foreSleeve = (t, a) => { const [rx, rz] = foreProf(t, a), o = sleeveOut + .006 * sstep(.6, 1, t), fo = sleeveFold(t, a, .05), cuff = t > .88; return [(rx + o + (cuff ? .003 : 0)) * fo, (rz + o + (cuff ? .003 : 0)) * fo, 0, cuff ? (style === 1 || style === 6 || hazmat ? .72 : .85) : 1]; };
  const armM = style === 3 ? under : top;
  const hands = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * S.shx, S.shy, 0); torso.add(sh);
    const upper = new THREE.Group(); sh.add(upper);
    if (longSleeve) whole(upper, tube('usl' + f + b + style, .29, upperSleeve, { n: 16, k: 22, to: .29 + .05 }), armM);
    else {
      whole(upper, tube('uarm' + f + b, .29, upperProf, { n: 16, k: 22 }), armSkin);
      whole(upper, tube('tsl' + f + b, .29, (t, a) => { const [rx, rz] = upperProf(t, a), o = .006 + .004 * sstep(.2, .42, t); return [rx + o, rz + o, 0, t > .38 ? .82 : 1]; }, { n: 16, k: 10, to: .42 * .29 }), accentC && style === 0 ? accent : top);
    }
    const el = new THREE.Group(); el.position.y = -.29; upper.add(el);
    whole(el, longSleeve ? tube('fsl' + f + b + style, .25, foreSleeve, { n: 16, k: 20, to: .25 - (gk ? .02 : 0) }) : tube('farm' + f + b, .25, foreProf, { n: 16, k: 20 }), longSleeve ? armM : armSkin);
    if (style === 6) {
      const stripe = accentC ? accent : m(0xf2f2f2, { roughness: .6 });
      whole(upper, lsurf('ustripe' + f + b, .29, upperSleeve, 3, 10, (u, v) => [lerp(-.05, 1, v), PI / 2 + (u - .5) * .35, .002]), stripe);
      whole(el, lsurf('fstripe' + f + b, .25, foreSleeve, 3, 10, (u, v) => [lerp(0, .86, v), PI / 2 + (u - .5) * .35, .002]), stripe);
    }
    if (s === 1 && (l.accessory === 2 || l.accessory === 5)) {
      whole(el, lsurf('watchband' + f + b, .25, foreProf, 16, 3, (u, v) => [lerp(.8, .88, v), PI + u * TAU, (longSleeve ? sleeveOut + .006 : .003) + .003 * Math.sin(PI * v)]), m(0x1a1a1c, { roughness: .6, tex: 'rubber' }));
      const [rx] = foreProf(.84, 0);
      part(el, G.cyl, m(0x9aa0a6, { metalness: .9, roughness: .2 }), [rx + (longSleeve ? sleeveOut + .01 : .007), -.21, 0], [.013, .008, .013], [0, 0, PI / 2]);
    }
    const hand = new THREE.Group(); hand.position.y = -.25; el.add(hand);
    if (gk === 'fingerless') { whole(hand, handGeo(f, b, 'palm'), glove); whole(hand, handGeo(f, b, 'digits'), skin); }
    else whole(hand, handGeo(f, b, 'all'), glove);
    if (gk === 'tactical') part(hand, G.rbox, m(0x0e0f10, { roughness: .4 }), [0, -.078 * (f ? .84 : 1), -.014], [.038 * (f ? .84 : 1), .011, .008]);
    hand.scale.x = s;
    hands.push(hand);
    arms[s] = { sh, upper, el, hand };
  }

  const nk = (f ? .76 : 1) * B.neck;
  const head = new THREE.Group(); head.position.set(0, f ? .52 : .565, .012); torso.add(head);
  head.scale.setScalar(f ? .9 : .9);
  whole(torso, shell('neck' + f + b, 18, 10, (u, v) => {
    const a = PI + u * TAU, y = lerp(head.position.y + .1, S.top - .07, v), rx = .052 * nk * (1 + .1 * v * v), rz = .05 * nk * (1 + .05 * v);
    const adam = f ? 0 : .008 * gs((y - .61) / .016) * gs(Math.sin(a) / .25) * Math.max(0, Math.cos(a));
    return [Math.sin(a) * rx, y, .004 + Math.cos(a) * rz + adam, 1 - .18 * (1 - sstep(.1, .5, v)) * Math.max(0, Math.cos(a))];
  }), neckSkin).castShadow = false;
  buildHead(head, l, hf, { skin, face, skinC, hairC, black, topDark });

  if (l.accessory === 1 || l.accessory === 4 || l.accessory === 5) {
    const gold = l.accessory === 4;
    whole(torso, merge('chain' + S.key + gold, () => {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const a = PI + i / 40 * TAU, dip = ((1 + Math.cos(a)) / 2) ** (gold ? 5 : 4); pts.push(new THREE.Vector3(...S.at(S.top - .018 - (gold ? .1 : .16) * dip, a, bulk + .006 + (style === 3 ? .03 : 0) * dip))); }
      const out = [[white(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 60, gold ? .0035 : .0016, 5, true))]];
      if (!gold) { const c = S.at(S.top - .19, 0, bulk + .008 + (style === 3 ? .03 : 0)); out.push([G.rbox, [c[0] - .006, c[1] - .012, c[2] + .002], [.009, .014, .0015], [0, 0, .1]], [G.rbox, [c[0] + .006, c[1] - .015, c[2] + .004], [.009, .014, .0015], [0, 0, -.15]]); }
      return out;
    }), gold ? m(0xe8c060, { metalness: .9, roughness: .22 }) : metal);
  }

  const back = m(0x4a4a34, { roughness: .9, tex: 'canvas', bump: .5 });
  if (l.back === 1) {
    whole(trunk, merge('pack', () => [[G.rbox, [0, .26, -.2], [.16, .19, .08]], [G.rbox, [0, .12, -.285], [.12, .07, .03]], [G.rbox, [0, .38, -.215], [.15, .04, .075]]]), back);
    whole(trunk, merge('packstraps', () => [-1, 1].flatMap(s => [[G.box, [s * .1, .3, .118], [.03, .4, .01]], [G.box, ...seg([s * .1, .5, .1], [s * .1, .52, -.13], .03, .01)]])), black);
  }
  if (l.back === 2) { part(trunk, G.cyl, m(0x5a6a3a, { tex: 'canvas' }), [0, .5, -.17], [.07, .38, .07], [0, 0, Math.PI / 2]); part(trunk, G.cyl, black, [0, .5, -.17], [.072, .012, .072], [0, 0, Math.PI / 2]); }
  if (l.back === 3) { whole(trunk, merge('radio', () => [[G.rbox, [0, .24, -.2], [.14, .17, .075]], [G.rbox, [0, .45, -.2], [.1, .04, .06]]]), m(0x3a4030, { tex: 'canvas' })); part(trunk, G.cyl, black, [.1, .62, -.22], [.008, .5, .008]); part(trunk, G.box, m(0x9a3a1a, { emissive: 0xff3a1a, emissiveIntensity: .8 }), [-.06, .34, -.28], [.03, .03, .01]); }
  if (l.back === 4) { part(trunk, G.box, m(0xcfd6da, { metalness: .9, roughness: .2 }), [0, .2, -.15], [.025, .9, .05], [0, 0, .7]); part(trunk, G.box, black, [.27, .52, -.15], [.035, .22, .04], [0, 0, .7]); }
  if (l.back === 5) part(trunk, shell('cape', 16, 10, (u, v) => [lerp(-.23, .23, u) * (1 + .3 * v), .5 - v * 1.02, -.13 - .05 * v - .02 * Math.sin(u * PI * 4) * v, .85 + .15 * Math.sin(u * PI * 4)]), m(0x7a1a1a, { roughness: 1, side: THREE.DoubleSide, tex: 'cotton' }), [0, 0, 0]);
  if (l.back === 6) { const w = m(0x8a4a1a, { roughness: .4 }); part(trunk, G.cyl, w, [-.05, .05, -.16], [.16, .06, .16], [Math.PI / 2, 0, 0]); part(trunk, G.cyl, w, [.03, .22, -.16], [.12, .06, .12], [Math.PI / 2, 0, 0]); part(trunk, G.box, m(0x2a1a0e), [.14, .5, -.16], [.04, .45, .02], [0, 0, -.35]); }
  if (l.back === 7) { part(trunk, G.box, m(0x9aa4a8, { metalness: .9, roughness: .25 }), [0, .25, -.16], [.03, .5, .28], [0, 0, -.5]); part(trunk, G.box, m(0x5a0a08), [.05, .12, -.16], [.032, .15, .282], [0, 0, -.5]); }

  if (suit) suitParts(suit, { body, torso, trunk, head, arms, legs, S, hf, f });

  const wdef = WEAPONS[l.primary] || WEAPONS[0];
  const gm = { base: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), dark: new THREE.MeshStandardMaterial() };
  paintGunMaterials(gm, l.gun);
  if (WOOD.has(wdef.id) && !l.gun) woodStock(gm.base);
  const gun = new THREE.Group();
  const model = buildGun(wdef, gm);
  model.rotation.y = Math.PI;
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  gun.add(model);
  const pistol = wdef.id === 'deagle', heavy = wdef.id === 'dragon';
  gun.position.set(pistol ? -.02 : -.07, pistol ? 1.28 : heavy ? 1.08 : 1.2, pistol ? .36 : .31);
  gun.rotation.set(pistol ? .25 : .42, .16, 0);
  body.add(gun);
  root.updateMatrixWorld(true);
  const grip = torso.worldToLocal(model.localToWorld(new THREE.Vector3(...wdef.grip)));
  const guard = torso.worldToLocal(model.localToWorld(new THREE.Vector3(...wdef.guard)));
  solveArm(arms[-1].upper, arms[-1].el, arms[-1].sh.position, grip, new THREE.Vector3(-1, -.4, -.8), .29, .29);
  solveArm(arms[1].upper, arms[1].el, arms[1].sh.position, guard, new THREE.Vector3(1, -1, -.2), .29, .29);
  root.updateMatrixWorld(true);
  orientHand(arms[-1], new THREE.Vector3(1, .15, 0));
  orientHand(arms[1], new THREE.Vector3(-.6, .8, 0));

  root.userData = { torso, head, gun, arms, legs };
  return root;
}
function orientHand({ el, hand }, dir) {
  const d = dir.normalize().applyQuaternion(el.getWorldQuaternion(new THREE.Quaternion()).invert());
  hand.rotation.y = Math.atan2(d.x, d.z);
}

function hornGeo(key, pts, r0) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), up = new THREE.Vector3(0, 0, 1);
  const frame = (u, v) => { const t = c.getTangentAt(v), n = up.clone().cross(t).normalize(), bn = t.clone().cross(n), a = u * TAU; return n.multiplyScalar(Math.cos(a)).addScaledVector(bn, Math.sin(a)); };
  return shell(key, 10, 14, (u, v) => {
    const p = c.getPointAt(v), d = frame(u, v), r = r0 * (1 - v * .92) * (1 + .08 * Math.sin(v * 40));
    return [p.x + d.x * r, p.y + d.y * r, p.z + d.z * r, .7 + .3 * v];
  }, (u, v) => frame(u, v).toArray());
}
function suitParts(suit, { body, torso, trunk, head, arms, legs, S, hf, f }) {
  const glow = m(suit.accent, { emissive: suit.accent, emissiveIntensity: 1.3, roughness: .3 });
  const black = m(0x0b0c0e, { roughness: .5 });
  const P = (th, ph, r = 1) => hp(th, ph, r, hf);
  const kind = suit.parts || suit.id;
  if (kind === 'ronin') {
    const plate = m(0x16181c, { metalness: .6, roughness: .3 });
    whole(torso, merge('roninlines' + S.key, () => [
      ...[-1, 1].map(s => [tpatch('rl' + s, S, .02, .47, s * .3, s * .34, .03, .001, 8)]),
      [tpatch('rlc', S, .395, .405, -.9, .9, .03, .001, 8)], [tband('rlw', S, .05, .06, .03, 0)],
    ]), glow);
    part(arms[1].sh, G.rbox, plate, [.025, .0, 0], [.075, .045, .08], [0, 0, -.35]);
    for (const s of [-1, 1]) {
      whole(arms[s].upper, lsurf('rua' + f, .29, () => [.06, .06], 2, 6, (u, v) => [lerp(.1, .9, v), (u - .5) * .08, .006]), glow);
      whole(arms[s].el, lsurf('rfa' + f, .25, () => [.052, .045], 2, 6, (u, v) => [lerp(.1, .8, v), (u - .5) * .08, .006]), glow);
    }
    for (const { hip, knee } of legs) { part(hip, G.box, glow, [0, -.21, .1], [.008, .3, .006]); part(knee, G.box, glow, [0, -.14, .072], [.008, .18, .006]); }
    whole(head, scalp('visor', hf, [-1.25, 1.25], 1.3, 1.62, 1.12, { n: 20, k: 3 }), m(0x08090b, { metalness: .7, roughness: .1 }));
    whole(head, scalp('visorglow', hf, [-1.15, 1.15], 1.43, 1.49, 1.125, { n: 20, k: 1 }), glow);
    part(trunk, G.box, m(0x9ff8ff, { emissive: suit.accent, emissiveIntensity: 1.8 }), [0, .25, -.15], [.016, .9, .03], [0, 0, .7]);
    part(trunk, G.box, black, [.28, .55, -.15], [.035, .22, .045], [0, 0, .7]);
    part(trunk, G.cyl, plate, [.21, .45, -.15], [.03, .012, .05], [0, 0, .7 + PI / 2]);
  }
  if (kind === 'knight') {
    const iron = m(suit.iron ?? 0x3a3a42, { metalness: .9, roughness: .34, tex: 'leather', bump: .3 }), bone = m(0xd9d0b4, { roughness: .6 });
    whole(torso, merge('kplate' + S.key, () => [[tband('kcuir', S, -.02, .49, .035, .012)], [tband('kfauld', S, -.1, -.01, .045, .01)]]), iron);
    whole(torso, merge('kcracks' + S.key, () => [[-.08, .3, .4], [-.02, .22, -.5], [.06, .34, .3], [.1, .16, -.6], [-.1, .12, .5], [.02, .42, .2]].map(([a, y, r]) => [tpatch('kc' + a + y, S, y - .045, y + .045, a + r * .1 - .012, a + r * .1 + .012, .049, .001, 8)])), glow);
    for (const s of [-1, 1]) {
      whole(arms[s].sh, merge('pauldron' + f, () => [[G.sphere, [0, .02, 0], [.095, .075, .095]], [G.sphere, [0, -.03, 0], [.1, .05, .1]], [G.cone, [0, .11, 0], [.022, .09, .022], [0, 0, -.2]]]), iron).scale.x = s;
      whole(arms[s].el, lsurf('vamb' + f, .25, (t) => [.05 * (1 - .3 * t), .045 * (1 - .3 * t)], 16, 4, (u, v) => [lerp(.3, .92, v), PI + u * TAU, .02 + .004 * Math.sin(PI * v)]), iron);
      part(arms[s].el, G.box, glow, [0, -.16, .068], [.02, .02, .005]);
      whole(arms[s].hand, merge('gauntlet', () => [[G.rbox, [0, -.04, 0], [.042, .05, .022]], [G.rbox, [0, -.09, .012], [.04, .02, .02]]]), iron);
    }
    for (const { knee } of legs) { part(knee, G.rbox, iron, [0, -.16, .04], [.07, .15, .05]); part(knee, G.sphere, iron, [0, 0, .06], [.07, .06, .05]); }
    whole(head, scalp('khelm', hf, RING, 0, .8 * PI, 1.22, { n: 28, k: 12 }), iron);
    whole(head, scalp('kvisor', hf, [-.9, .9], 1.38, 1.52, 1.235, { n: 14, k: 1 }), black);
    whole(head, scalp('kslit', hf, [-.8, .8], 1.43, 1.47, 1.24, { n: 14, k: 1 }), glow);
    whole(head, merge('horns', () => [-1, 1].map(s => [hornGeo('horn' + s, [[s * .1, .24, 0], [s * .17, .28, -.01], [s * .22, .35, -.02], [s * .23, .43, .0], [s * .2, .49, .03]], .03)])), bone);
    whole(head, scalp('kcrest', hf, [-.08, .08], .05 * PI, .55 * PI, (v, ph) => 1.26 + .06 * Math.sin(PI * v) * Math.cos(ph * 18), { n: 4, k: 10 }), iron);
    whole(torso, shell('tabard' + S.key, 6, 8, (u, v) => { const y = lerp(-.02, -.62, v), c = S.at(-.02, 0, .05); return [lerp(-.09, .09, u) * (1 + v * .2), y, c[2] + .02 * v, .9 + .1 * Math.sin(u * PI)]; }), m(suit.cloth ?? 0x3a0a08, { roughness: 1, side: THREE.DoubleSide, tex: 'canvas' }));
    part(trunk, shell('kcape', 14, 10, (u, v) => [lerp(-.22, .22, u) * (1 + .35 * v), .52 - v * 1.1, -.16 - .05 * v - .025 * Math.sin(u * PI * 5) * v, .8 + .2 * Math.sin(u * PI * 5)]), m(suit.cloth ?? 0x3a0a08, { roughness: 1, side: THREE.DoubleSide, tex: 'canvas' }), [0, 0, 0]);
  }
  if (kind === 'spectre') {
    const cloth = m(suit.cloth ?? 0x140f1e, { roughness: 1, tex: 'cotton', side: THREE.DoubleSide }), deep = m(0x000000, { roughness: 1 });
    whole(torso, shell('cloak' + S.key, 40, 22, (u, v) => {
      const a = PI + u * TAU, y = lerp(S.top - .02, -1.0, v), t = sstep(0, 1, v), base = S.at(Math.max(y, -.1), a, .03);
      const fold = 1 + .05 * Math.sin(a * 11) * t, hem = y + (v > .95 ? .03 * Math.sin(a * 13) : 0);
      const rx = Math.sign(base[0]) * Math.max(Math.abs(base[0]), (.22 + .14 * t) * Math.abs(Math.sin(a))), rz = Math.cos(a) > 0 ? Math.max(base[2], (.17 + .12 * t) * Math.cos(a)) : Math.min(base[2], (.18 + .14 * t) * Math.cos(a));
      return [rx * fold, hem, rz * fold, .75 + .25 * Math.sin(a * 11)];
    }), cloth);
    whole(head, scalp('hood', hf, [.3 * PI, 1.7 * PI], 0, PI * .95, (v, ph) => 1.32 + .1 * v, { n: 30, k: 14 }), cloth);
    whole(head, scalp('hoodtop', hf, [-.35 * PI, .35 * PI], 0, ph => .36 * PI + .06 * Math.cos(ph * 3), (v, ph) => 1.32 + .12 * v, { n: 12, k: 6 }), cloth);
    part(head, G.sphere, deep, [0, .13, .07], [.1, .12, .07]);
    whole(head, merge('specteyes', () => [-1, 1].map(s => [G.sphere, [s * .04, .15, .135], [.024, .011, .01], [0, 0, s * -.2]])), m(suit.accent, { emissive: suit.accent, emissiveIntensity: 3 }));
    for (const s of [-1, 1]) whole(arms[s].el, tube('bell' + f, .25, t => [.05 + .05 * t, .05 + .05 * t, 0, .8], { n: 16, k: 8, from: -.02, to: .21 }), cloth);
    whole(body, merge('wisps', () => Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU; return [G.lowSphere, [Math.cos(a) * .45, .1 + (i % 3) * .25, Math.sin(a) * .45], [.016, .016, .016]]; })), glow);
  }
  if (kind === 'wolf') {
    const fur = m(suit.fur ?? 0xe8e4d8, { roughness: 1, tex: 'fur', bump: 1.5 }), grey = m(suit.hood ?? 0xa8acb0, { roughness: 1, tex: 'fur', bump: 1.5 }), amber = m(suit.fur ? suit.accent : 0xffb040, { emissive: suit.fur ? suit.accent : 0xff8a1a, emissiveIntensity: 1.2 });
    const noisy = (a, y) => .012 * Math.sin(a * 17 + y * 50) * Math.sin(a * 5 - y * 30);
    whole(torso, tsurf('ruff', S, 40, 5, (u, v) => { const a = PI + u * TAU, y = lerp(S.top + .01, S.top - .09, v); return [y, a, .045 + .03 * Math.sin(PI * v) + noisy(a, y) * 2]; }), fur);
    whole(torso, tsurf('parkahem', S, 40, 4, (u, v) => { const a = PI + u * TAU, y = lerp(-.02, -.12, v); return [y, a, .04 + .02 * Math.sin(PI * v) + noisy(a, y) * 2]; }), fur);
    whole(head, scalp('wolfhood', hf, [-.8 * PI, .8 * PI], 0, .62 * PI, (v, ph) => 1.28 + .03 * Math.sin(ph * 9), { n: 30, k: 10 }), grey);
    whole(head, scalp('wolfback', hf, [.75 * PI, 1.25 * PI], 0, .8 * PI, 1.3, { n: 8, k: 10 }), grey);
    whole(head, merge('wolfsnout', () => [[G.pill, [0, .27, .15], [.058, .045, .1], [.25, 0, 0]], [G.pill, [0, .245, .19], [.04, .02, .07], [.1, 0, 0]]]), grey);
    part(head, G.sphere, black, [0, .285, .245], [.02, .015, .014]);
    whole(head, merge('wolfears', () => [-1, 1].map(s => [G.cone, [s * .09, .37, -.03], [.045, .12, .028], [0, 0, -s * .3]])), grey);
    whole(head, merge('wolfeyes', () => [-1, 1].map(s => [G.sphere, [s * .05, .305, .14], [.014, .01, .008], [0, 0, s * .3]])), amber);
    for (const s of [-1, 1]) whole(arms[s].el, lsurf('furcuff' + f, .25, () => [.04, .036], 16, 4, (u, v) => { const a = PI + u * TAU; return [lerp(.78, .96, v), a, .02 + .015 * Math.sin(PI * v) + noisy(a, v)]; }), fur);
    for (const { knee } of legs) part(knee, tube('furboot' + f, .1, () => [.075, .08, .01], { n: 18, k: 6 }), fur, [0, -.28, 0]);
  }
  if (kind === 'hollow') {
    const pumpkin = m(0xe06a10, { roughness: .65, bump: .8, tex: 'skin' }), stem = m(0x3a4a1a, { roughness: 1 });
    const straw = m(0xd8b45a, { roughness: 1, flatShading: true }), fire = m(0xffb02a, { emissive: suit.accent, emissiveIntensity: 2.2 });
    part(head, shell('pumpkin', 32, 16, (u, v) => {
      const ph = u * TAU, th = v * PI, r = (1 + .07 * Math.cos(ph * 9) ** 2 * Math.sin(th)) * (1 - .12 * Math.cos(th) ** 8);
      return [Math.sin(th) * Math.sin(ph) * r * .18, Math.cos(th) * r * .16, Math.sin(th) * Math.cos(ph) * r * .17, .78 + .22 * Math.abs(Math.cos(ph * 9 / 2)) ** .3];
    }), pumpkin, [0, .15, 0]);
    part(head, G.cyl, stem, [.01, .32, 0], [.02, .06, .02], [0, 0, -.35]);
    whole(head, merge('jackface', () => [
      ...[-1, 1].map(s => [G.cone, [s * .06, .19, .158], [.03, .04, .012], [PI / 2, 0, PI]]),
      [G.cone, [0, .145, .172], [.018, .024, .01], [PI / 2, 0, PI]],
      ...[-3, -2, -1, 0, 1, 2, 3].map(i => [G.box, [i * .026, .09 + (i % 2 ? .012 : 0) + Math.abs(i) * .006, .163 - Math.abs(i) * .01], [.022, .03, .012], [0, i * .14, i % 2 ? PI / 4 : 0]]),
    ]), fire);
    whole(torso, merge('strawcollar' + S.key, () => Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU, p = S.at(S.top - .02, a, .03); return [G.cone, p, [.022, .09, .022], [Math.sin(a) * .9, 0, -Math.cos(a) * .9]]; })), straw);
    whole(torso, tband('rope', S, .06, .09, .03, .01), m(0x8a6a3a, { roughness: 1, tex: 'canvas' }));
    whole(torso, merge('patches' + S.key, () => [[tpatch('p1', S, .26, .36, -.7, -.35, .03, .003, 8)], [tpatch('p2', S, -.3, -.2, .5, .8, .04, .003, 8)]]), m(0x5a6a3a, { roughness: 1, tex: 'canvas' }));
    whole(torso, tpatch('p3', S, .12, .2, .25, .55, .03, .003, 8), m(0x8a2a1a, { roughness: 1, tex: 'canvas' }));
    for (const s of [-1, 1]) whole(arms[s].el, merge('strawcuff' + f, () => Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU; return [G.cone, [Math.cos(a) * .04, -.23, Math.sin(a) * .04], [.016, .07, .016], [Math.sin(a) * .5 + PI, 0, -Math.cos(a) * .5]]; })), straw);
    whole(body, merge('embers', () => [0, 1, 2].map(i => [G.lowSphere, [Math.cos(i * 2.1) * .5, .4 + i * .35, Math.sin(i * 2.1) * .5], [.02, .02, .02]])), glow);
  }
  if (kind === 'diver') {
    const brass = m(0xc08a2a, { metalness: .85, roughness: .28 }), copper = m(0x9a5a2a, { metalness: .8, roughness: .35 });
    const lead = m(0x4a4e52, { metalness: .6, roughness: .5 }), glass = m(0x1a3a40, { emissive: suit.accent, emissiveIntensity: .9, metalness: .4, roughness: .05 });
    whole(torso, tsurf('corselet', S, 40, 6, (u, v) => { const a = PI + u * TAU; return [lerp(S.top + .03, .4, v), a, .03 + .03 * Math.sin(PI * v)]; }), brass);
    whole(torso, merge('bolts' + S.key, () => Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU; return [G.lowSphere, S.at(.43, a, .058), [.011, .011, .011]]; })), copper);
    part(head, G.sphere, brass, [0, .15, 0], [.2, .2, .2]);
    part(head, G.cyl, copper, [0, .01, 0], [.17, .05, .17]);
    part(head, G.torus, copper, [0, .15, .185], [.085, .085, .1]);
    part(head, G.sphere, glass, [0, .15, .178], [.075, .075, .03]);
    whole(head, merge('grille', () => [-.03, 0, .03].map(x => [G.box, [x, .15, .2], [.008, .15, .008]])), copper);
    whole(head, merge('sideports', () => [-1, 1].map(s => [G.torus, [s * .185, .16, .02], [.05, .05, .07], [0, PI / 2, 0]])), copper);
    whole(head, merge('sideglass', () => [-1, 1].map(s => [G.sphere, [s * .18, .16, .02], [.02, .044, .044]])), glass);
    part(head, G.cyl, copper, [0, .35, 0], [.03, .04, .03]);
    whole(trunk, merge('tanks', () => [-.075, .075].flatMap(x => [[G.capsule, [x, .24, -.22], [.07, .17, .07]]])), m(0xb8bcc0, { metalness: .8, roughness: .3 }));
    whole(trunk, merge('valves', () => [-.075, .075].map(x => [G.cyl, [x, .52, -.22], [.025, .05, .025]])), brass);
    whole(torso, merge('hose' + S.key, () => [[white(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.08, .72, -.08), new THREE.Vector3(.2, .66, -.12), new THREE.Vector3(.16, .5, -.22), new THREE.Vector3(.08, .52, -.24)]), 16, .016, 8))]]), m(0x1a1a1a, { roughness: .8 }));
    whole(torso, merge('weights' + S.key, () => [-2, -1, 0, 1, 2].map(i => [tpatch('lw' + i, S, -.01, .07, i * .32 - .13, i * .32 + .13, .015, .022, 8)])), lead);
    for (const { knee } of legs) { part(knee, G.rbox, lead, [0, -.44, .06], [.075, .045, .13]); part(knee, G.box, brass, [0, -.41, .19], [.1, .04, .02]); }
    for (const s of [-1, 1]) whole(arms[s].el, lsurf('brasscuff' + f, .25, () => [.036, .03], 16, 3, (u, v) => [lerp(.82, .92, v), PI + u * TAU, .012 + .004 * Math.sin(PI * v)]), brass);
  }
}
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
  let model = null, code = null, spin = .5, auto = true, drag = null, w = 0, h = 0, t = 0, mode = 'full';

  function show(loadout, force) {
    const c = loadoutKey(loadout);
    if (c === code && !force) return;
    code = c;
    if (model) scene.remove(model);
    model = buildSurvivor(loadout);
    scene.add(model);
  }
  function frame(kind) {
    mode = kind;
    if (kind === 'portrait') { cam.fov = 24; cam.position.set(0, 1.64, 1.55); cam.lookAt(0, 1.58, 0); }
    else if (kind === 'bust') { cam.fov = 30; cam.position.set(0, 1.45, 2.6); cam.lookAt(0, 1.35, 0); }
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
      const r = canvas.getBoundingClientRect();
      size(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    },
    frame,
    detach() { canvas.remove(); },
    show,
    render,
    showWeapon(gunGroup) {
      code = null;
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
