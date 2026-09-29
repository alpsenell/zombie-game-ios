import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { serve, launch, openGame } from './smoke.mjs';

const W = 440, H = 956, DSF = 3, OUT_W = W * DSF, OUT_H = H * DSF;
const metaDir = new URL('../appstore-assets/metadata/', import.meta.url).pathname;
const outDir = new URL('../appstore-assets/screenshots/marketing/', import.meta.url).pathname;
const checkOnly = process.argv.includes('--check');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const locales = readdirSync(metaDir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(l => !only.length || only.includes(l));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = [
  { file: '01-coop', take: coopShot },
  { file: '02-daily', take: dailyShot },
  { file: '03-action', take: actionShot },
  { file: '04-locker', take: lockerShot },
  { file: '05-season', take: seasonShot },
];

const storekit = readFileSync(new URL('../ios/App/App/Products.storekit', import.meta.url), 'utf8');
const prices = Object.fromEntries([...storekit.matchAll(/"displayPrice"\s*:\s*"([^"]+)"[\s\S]*?"productID"\s*:\s*"([^"]+)"/g)].map(m => [m[2], '$' + m[1]]));

function seed(prices, gate, who) {
  if (gate) {
    const raf = window.requestAnimationFrame.bind(window);
    window.__rafOn = false;
    window.requestAnimationFrame = fn => raf(function tick(t) { if (window.__rafOn) fn(t); else raf(tick); });
  }
  localStorage.setItem('deadzone.tutorial', 'true');
  localStorage.setItem('deadzone.settings', JSON.stringify({ sound: false, haptics: false, aimAssist: false, difficulty: 'survivor' }));
  localStorage.setItem('deadzone.profile', JSON.stringify({ xp: 160000, scrap: 4820, kills: 3120, heads: 910, runs: 64, bestWave: 34 }));
  const others = n => Array.from({ length: n }, (_, i) => ({ name: ['GRAVESHIFT', 'NightOwl', 'KOMRADE', 'la_vibora', 'Tanuki77', 'HexenJäger', 'ONE_TAP', 'MAREA'][i % 8] + (i >= 8 ? i : ''), score: 184000 - i * 1730, context: 0 }));
  const boards = { 'deadzone.daily': others(40), 'deadzone.weekly': others(200), 'deadzone.highscore': others(60), 'deadzone.bestwave': [] };
  window.Capacitor = {
    PluginHeaders: [{ name: 'GameCenter', methods: [] }, { name: 'Haptics', methods: [] }, { name: 'Store', methods: [] }],
    async nativePromise(plugin, method, opts = {}) {
      if (plugin === 'Store') return method === 'getProducts' ? { products: (opts.ids || []).filter(id => prices[id]).map(id => ({ id, price: prices[id] })) } : method === 'getEntitlements' ? { owned: [] } : {};
      if (plugin === 'Haptics' || method === 'submitScore' || method === 'showLeaderboard') return {};
      if (method === 'signIn') return { authenticated: true, displayName: who };
      if (method === 'loadScores') {
        const all = [...(boards[opts.leaderboardId] || []), { name: 'VIPER', score: 151300, isLocal: true }].sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1, isLocal: !!e.isLocal }));
        const start = opts.start || 1, res = { total: 4812, start, entries: all.slice(start - 1, start - 1 + (opts.count || 10)), player: all.find(e => e.isLocal) };
        return Object.assign(res, { recurring: true, nextStart: Date.now() + 7.3 * 3600e3 });
      }
      return {};
    },
  };
}

async function page(browser, url, gate = false, who = 'VIPER') {
  const { page, errors } = await openGame(browser, url, { width: W, height: H, init: `(${seed})(${JSON.stringify(prices)}, ${gate}, ${JSON.stringify(who)})` });
  await page.waitForFunction(() => window.__game.api.competitive && window.__game.api.season);
  await page.addStyleTag({ content: '.pg-note{display:none!important}' });
  page.on('pageerror', e => console.log('   page error:', e.message));
  return { page, errors };
}

const spawnAhead = (page, list) => page.evaluate(list => {
  const { api } = window.__game, c = api.camera.position, yaw = api.look.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const [kind, fwd, side] of list) {
    const z = api.makeZombie(kind, c.x + fx * fwd + rx * side, c.z + fz * fwd + rz * side, false);
    z.rotation.y = Math.atan2(c.x - z.position.x, c.z - z.position.z);
  }
}, list);

const run = (page, secs) => page.evaluate(secs => {
  const g = window.__game;
  for (let i = 0; i < secs * 30; i++) { if (g.api.state.mode !== 'playing') break; g.update(1 / 30); }
  g.scene.updateMatrixWorld();
}, secs);

async function coopShot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  try {
    const A = (await page(ctx, url, true)).page, B = (await page(ctx, url, true, 'BRAVO')).page;
    await B.evaluate(() => { const { api } = window.__game; api.profile.coop = { name: 'BRAVO' }; Object.assign(api.profile.loadout, { top: 3, topColor: 8, head: 5, hair: 2, hairColor: 3, pants: 1 }); });
    await A.evaluate(() => { window.__game.api.profile.coop = { name: 'VIPER' }; window.__game.api.loadMap('street'); });
    await A.click('#coop-open');
    await A.getByRole('button', { name: 'HOST LOCAL', exact: true }).click();
    const code = await A.textContent('.coop-room-head b');
    await B.click('#coop-open');
    await B.fill('.coop-code-in', code);
    await B.getByRole('button', { name: 'JOIN LOCAL', exact: true }).click();
    await A.waitForFunction(() => window.__game.api.coop.session.players.size === 2, null, { timeout: 8000 });
    await B.getByRole('button', { name: 'READY', exact: true }).click();
    await A.waitForFunction(() => [...window.__game.api.coop.session.players.values()].every(p => p.me || p.ready), null, { timeout: 8000 });
    await A.getByRole('button', { name: 'START', exact: true }).click();
    for (const p of [A, B]) await p.waitForFunction(() => window.__game.api.state.mode === 'playing', null, { timeout: 8000 });
    for (const p of [A, B]) await p.evaluate(() => { const { api } = window.__game; api.stats.armor = .02; api.settings.autoFire = false; });
    const lockstep = async secs => { for (let t = 0; t < secs; t += .1) { for (const p of [A, B]) await run(p, .1); await sleep(4); } };
    const place = (p, x, z, yaw, pitch = -.03) => p.evaluate(([x, z, yaw, pitch]) => { const { api } = window.__game; api.camera.position.x = x; api.camera.position.z = z; api.look.yaw = yaw; api.look.pitch = pitch; }, [x, z, yaw, pitch]);
    await lockstep(3);
    await A.evaluate(() => { const { api } = window.__game; for (const z of [...api.zombies]) if (!z.userData.dead) api.damageZombie(z, 1e7, null, false, null); });
    await place(A, -1.4, 27.5, -.08);
    await place(B, -.2, 23, .05);
    await lockstep(.5);
    await A.evaluate(() => {
      const { api } = window.__game;
      for (const [k, x, z] of [['brute', -1.8, 14.5], ['walker', 1.6, 16], ['runner', 3.8, 13.5], ['walker', -3.6, 11], ['spitter', .4, 9], ['walker', 5, 8], ['walker', -5.2, 7]]) api.makeZombie(k, x, z, false);
    });
    await lockstep(.6);
    await place(A, -1.4, 27.5, -.08);
    await B.evaluate(() => window.__game.setFiring(true));
    await lockstep(.3);
    await A.evaluate(() => { window.__rafOn = true; });
    await sleep(350);
    const buf = await A.screenshot();
    await A.evaluate(() => { window.__rafOn = false; });
    return buf;
  } finally { await ctx.close(); }
}

async function dailyShot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  try {
    const { page: p } = await page(ctx, url);
    await sleep(500);
    await p.click('#cm-daily');
    await p.waitForFunction(() => /#\d/.test(document.querySelector('#comp-sheet .cm-grid').textContent), null, { timeout: 5000 }).catch(() => {});
    await sleep(400);
    return await p.screenshot();
  } finally { await ctx.close(); }
}

async function actionShot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  try {
    const { page: p } = await page(ctx, url);
    await p.evaluate(() => { const { api } = window.__game; api.startGame({ map: 'mall', startWave: 12 }); api.stats.armor = .02; api.state.score = 48210; });
    await sleep(800);
    await p.evaluate(() => { const { api } = window.__game; for (const z of [...api.zombies]) if (!z.userData.dead) api.damageZombie(z, 1e7, null, false, null); });
    await spawnAhead(p, [['walker', 5.2, -1.2], ['brute', 7, 1.4], ['runner', 6.2, -2.8], ['walker', 9, -.2], ['walker', 10.5, 2.8], ['spitter', 12, -2.6], ['walker', 14, .8], ['runner', 16, -1]]);
    await p.evaluate(() => { const { api } = window.__game; api.look.pitch = .03; api.look.yaw += .06; window.__game.setFiring(true); });
    await sleep(450);
    await p.evaluate(() => window.__game.setFiring(false));
    await sleep(120);
    const buf = await p.screenshot();
    await p.evaluate(() => window.__game.setFiring(false));
    return buf;
  } finally { await ctx.close(); }
}

async function lockerShot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  try {
    const { page: p } = await page(ctx, url);
    await sleep(300);
    await p.click('#menu-dock [data-open="locker"]');
    await sleep(500);
    await p.click('#slot-tabs button:has-text("EXCLUSIVE")').catch(e => console.log('   no exclusive tab:', e.message.split('\n')[0]));
    await sleep(300);
    await p.click('#item-grid > *:nth-child(2)').catch(() => {});
    await sleep(1200);
    return await p.screenshot();
  } finally { await ctx.close(); }
}

async function seasonShot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  try {
    const { page: p } = await page(ctx, url);
    await p.evaluate(() => { const { api } = window.__game; api.season.addXP(7400); api.season.open(); });
    await sleep(1500);
    return await p.screenshot();
  } finally { await ctx.close(); }
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function frameHTML(locale, caption, img) {
  const cjk = locale === 'ja';
  const font = cjk ? "'IPAGothic','IPAPGothic','Hiragino Sans','Noto Sans CJK JP','WenQuanYi Zen Hei',sans-serif" : "'Liberation Sans','Helvetica Neue',Arial,'DejaVu Sans',sans-serif";
  const [head, tail] = caption.split(/\s+[—–]\s+|:\s+/);
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
html,body{width:${OUT_W}px;height:${OUT_H}px;overflow:hidden}
body{background:radial-gradient(120% 60% at 50% 0%,#5a1410 0%,#240807 38%,#07090b 72%),#07090b;font-family:${font};color:#fff;display:flex;flex-direction:column;align-items:center}
.cap{height:640px;width:100%;padding:150px 90px 0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:26px}
h1{font-size:${cjk ? 104 : 118}px;line-height:1.06;font-weight:900;letter-spacing:${cjk ? '0' : '-1px'};text-transform:${cjk ? 'none' : 'uppercase'};text-wrap:balance;word-break:${cjk ? 'auto-phrase' : 'normal'};text-shadow:0 6px 30px #000a}
h2{font-size:${cjk ? 66 : 70}px;font-weight:700;color:#ffc34d;text-wrap:balance;line-height:1.1}
.bar{width:140px;height:10px;border-radius:5px;background:#e8322a;margin-bottom:10px}
.shot{flex:none;width:${Math.round((OUT_H - 760) * OUT_W / OUT_H)}px;height:${OUT_H - 760}px;border-radius:72px;overflow:hidden;border:10px solid #1c1f22;box-shadow:0 40px 120px #000c,0 0 0 3px #ffffff14;background:#000}
.shot img{width:100%;height:100%;display:block;object-fit:cover}
</style></head><body><div class="cap"><div class="bar"></div><h1>${esc(tail ? head : caption)}</h1>${tail ? `<h2>${esc(tail)}</h2>` : ''}</div>
<div class="shot"><img src="data:image/png;base64,${img.toString('base64')}"></div></body></html>`;
}

const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, keywords: 100, whatsNew: 4000 };
let problems = 0;
console.table(locales.map(locale => {
  const m = JSON.parse(readFileSync(metaDir + locale + '.json', 'utf8')), row = { locale };
  const nameWords = m.name.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean), kw = m.keywords.split(',');
  for (const [k, max] of Object.entries(LIMITS)) { const n = [...(m[k] || '')].length; row[k] = n + '/' + max + (n > max || !n ? ' !!' : ''); if (n > max || !n) problems++; }
  if (/,\s/.test(m.keywords) || kw.some(w => !w || nameWords.includes(w.toLowerCase()))) { row.keywords += ' !!'; problems++; }
  const caps = m.screenshotCaptions || [];
  row.captions = caps.length + ' (max ' + Math.max(0, ...caps.map(c => [...c].length)) + '/40)';
  if (caps.length !== SHOTS.length || caps.some(c => [...c].length > 40)) { row.captions += ' !!'; problems++; }
  return row;
}));
if (problems) console.log(problems + ' metadata problem(s) marked !!');
if (checkOnly) process.exit(problems ? 1 : 0);

const { server, url } = await serve();
const browser = await launch(['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']);
const raw = [];
try {
  for (const s of SHOTS) {
    if (process.env.SHOT && !s.file.includes(process.env.SHOT)) continue;
    const t0 = Date.now();
    try { raw.push({ ...s, img: await s.take(browser, url) }); console.log(`captured ${s.file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
    catch (e) { console.log(`FAILED ${s.file}: ${e.message.split('\n')[0]}`); }
  }
  const comp = await browser.newPage({ viewport: { width: OUT_W, height: OUT_H }, deviceScaleFactor: 1 });
  for (const locale of locales) {
    const meta = JSON.parse(readFileSync(metaDir + locale + '.json', 'utf8'));
    const dir = outDir + locale + '/';
    mkdirSync(dir, { recursive: true });
    for (const s of raw) {
      const caption = meta.screenshotCaptions?.[SHOTS.indexOf(SHOTS.find(x => x.file === s.file))];
      if (!caption) { console.log(`skip ${locale}/${s.file}: no caption`); continue; }
      try {
        await comp.setContent(frameHTML(locale, caption, s.img), { waitUntil: 'load' });
        await comp.evaluate(() => document.fonts.ready);
        writeFileSync(dir + s.file + '.png', await comp.screenshot({ type: 'png' }));
        console.log(`wrote ${locale}/${s.file}.png`);
      } catch (e) { console.log(`FAILED ${locale}/${s.file}: ${e.message.split('\n')[0]}`); }
    }
  }
} finally {
  await browser.close();
  server.close();
}
