export function createBus() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },
    emit(event, data) {
      for (const fn of handlers.get(event) || []) {
        try { fn(data); } catch (e) { console.error('[' + event + ']', e); }
      }
    },
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const rng = {
  seed: null,
  fn: Math.random,
  set(seed) {
    this.seed = seed ?? null;
    this.fn = seed == null ? Math.random : mulberry32(seed);
  },
};
export const R = () => rng.fn();
