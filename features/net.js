export const PROTO = 1;
export const MAX_PLAYERS = 4;

const now = () => performance.now();

class Transport {
  constructor() {
    this.id = '';
    this.name = '';
    this.peers = new Map();
    this.handlers = {};
    this.closed = false;
    this.stats = { out: 0, in: 0, dropped: 0 };
    this.bucket = { msgs: 40, bytes: 32000, at: now() };
  }
  on(event, fn) { (this.handlers[event] ||= []).push(fn); }
  emit(event, ...args) {
    for (const fn of this.handlers[event] || []) {
      try { fn(...args); } catch (e) { console.error('[net ' + event + ']', e); }
    }
  }
  allow(size) {
    const b = this.bucket, t = now(), dt = (t - b.at) / 1000;
    b.at = t;
    b.msgs = Math.min(40, b.msgs + dt * 60);
    b.bytes = Math.min(32000, b.bytes + dt * 48000);
    if (b.msgs < 1 || b.bytes < size) return false;
    b.msgs--; b.bytes -= size;
    return true;
  }
  send(msg, { reliable = true, to } = {}) {
    if (this.closed) return false;
    const text = JSON.stringify([PROTO, ...msg]);
    if (!reliable && !this.allow(text.length)) { this.stats.dropped++; return false; }
    this.stats.out += text.length;
    this.raw(text, reliable, to);
    return true;
  }
  receive(from, text) {
    if (this.closed || typeof text !== 'string' || text.length > 65536) return;
    let a;
    try { a = JSON.parse(text); } catch { return; }
    if (!Array.isArray(a) || typeof a[1] !== 'string') return;
    this.stats.in += text.length;
    if (a[0] !== PROTO) { this.emit('version', from, a[0]); return; }
    this.emit('message', from, a.slice(1));
  }
  addPeer(id, name) {
    if (!id || id === this.id) return;
    const known = this.peers.get(id);
    if (known) { if (name) known.name = name; known.seen = now(); return; }
    this.peers.set(id, { id, name: name || 'SURVIVOR', seen: now() });
    this.emit('join', this.peers.get(id));
  }
  dropPeer(id) {
    if (!this.peers.delete(id)) return;
    this.emit('leave', id);
  }
}

export class LoopbackTransport extends Transport {
  static available() { return typeof BroadcastChannel === 'function'; }
  static code() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => abc[(Math.random() * abc.length) | 0]).join('');
  }
  constructor(room, host, name) {
    super();
    this.kind = 'local';
    this.room = room;
    this.name = name;
    this.id = (host ? 'L0' : 'L1') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.ch = new BroadcastChannel('deadzone-coop-' + room);
    this.ch.onmessage = e => this.onRaw(e.data);
    this.timer = setInterval(() => this.beat(), 1000);
    this.onHide = () => this.close();
    addEventListener('pagehide', this.onHide);
    this.post({ k: 'hello' });
  }
  post(o) {
    if (this.closed) return;
    try { this.ch.postMessage({ f: this.id, n: this.name, ...o }); } catch {}
  }
  raw(text, reliable, to) { this.post({ k: 'd', t: to || null, d: text }); }
  onRaw(m) {
    if (this.closed || !m || typeof m.f !== 'string' || m.f === this.id) return;
    if (m.k === 'bye') { this.dropPeer(m.f); return; }
    const fresh = !this.peers.has(m.f);
    this.addPeer(m.f, typeof m.n === 'string' ? m.n.slice(0, 24) : '');
    if (fresh && m.k !== 'reply') this.post({ k: 'reply' });
    if (m.k === 'd' && (!m.t || m.t === this.id)) this.receive(m.f, m.d);
  }
  beat() {
    this.post({ k: 'beat' });
    const t = now();
    for (const p of [...this.peers.values()]) if (t - p.seen > 10000) this.dropPeer(p.id);
  }
  close() {
    if (this.closed) return;
    this.post({ k: 'bye' });
    this.closed = true;
    clearInterval(this.timer);
    removeEventListener('pagehide', this.onHide);
    try { this.ch.close(); } catch {}
  }
}

function capListen(event, fn) {
  const cap = window.Capacitor;
  const h = cap?.addListener ? cap.addListener('Match', event, fn) : cap?.Plugins?.Match?.addListener?.(event, fn);
  return Promise.resolve(h).catch(() => null);
}

export class GameKitTransport extends Transport {
  static available() {
    const cap = window.Capacitor;
    return !!(cap?.nativePromise && cap.PluginHeaders?.some(h => h.name === 'Match'));
  }
  static call(method, opts = {}) { return window.Capacitor.nativePromise('Match', method, opts); }
  static listen(event, fn) { return capListen(event, fn); }
  constructor() {
    super();
    this.kind = 'gamekit';
    this.subs = [
      capListen('data', d => d && this.receive(d.from, d.data)),
      capListen('playerState', d => {
        if (!d?.id) return;
        if (d.connected) this.addPeer(d.id, d.name);
        else this.dropPeer(d.id);
      }),
      capListen('error', d => this.emit('error', d?.message || 'CONNECTION LOST')),
    ];
  }
  adopt({ players, localId }) {
    this.id = localId;
    for (const p of players || []) {
      if (p.id === localId) this.name = p.name;
      else this.addPeer(p.id, p.name);
    }
  }
  raw(text, reliable, to) {
    GameKitTransport.call('send', to ? { data: text, reliable, to: [to] } : { data: text, reliable }).catch(() => { this.stats.dropped++; });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    GameKitTransport.call('disconnect').catch(() => {});
    for (const s of this.subs) s.then(h => h?.remove?.());
  }
}
