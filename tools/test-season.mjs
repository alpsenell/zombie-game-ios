import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const shots = process.env.SHOTS || join(tmpdir(), 'deadzone-season-shots');
mkdirSync(shots, { recursive: true });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
const pngSize = b64 => { const b = Buffer.from(b64, 'base64'); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const NOW = Date.UTC(2026, 9, 1, 12);

function mock({ now = NOW, owned = [], share = true, profile } = {}) {
  return `(() => {
    const T = ${now}, t0 = performance.now();
    Date.now = () => T + (performance.now() - t0);
    ${profile ? `localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});` : ''}
    const owned = new Set(${JSON.stringify(owned)});
    window.__calls = [];
    window.__shared = [];
    window.Capacitor = {
      PluginHeaders: [{ name: 'Store' }${share ? ", { name: 'Share' }" : ''}],
      Plugins: {},
      nativePromise(plugin, method, opts = {}) {
        __calls.push({ plugin, method, opts });
        if (plugin === 'Store') {
          if (method === 'getProducts') return Promise.resolve({ products: (opts.ids || []).map(id => ({ id, title: id, description: '', price: id.includes('.season.') ? '$4.99' : '$1.99' })) });
          if (method === 'getEntitlements' || method === 'restore') return Promise.resolve({ owned: [...owned] });
          if (method === 'purchase') { owned.add(opts.id); return Promise.resolve({ status: 'purchased', id: opts.id }); }
        }
        if (plugin === 'Share' && method === 'shareImage') { __shared.push(opts); return Promise.resolve({ completed: true, activity: 'com.apple.UIKit.activity.SaveToCameraRoll' }); }
        return Promise.reject(new Error('unmocked ' + plugin + '.' + method));
      },
    };
  })();`;
}

async function endRun(page, run) {
  await page.evaluate(run => {
    const g = window.__game, { api } = g;
    api.startGame();
    Object.assign(api.state, run);
    api.state.bossKinds = run.bossKinds || [];
    g.gameOver();
  }, run);
  await page.waitForFunction(() => !document.querySelector('#over').classList.contains('hidden'));
}

const { server, url } = await serve();
const browser = await launch();
const allErrors = [];

{
  const { page, errors } = await openGame(browser, url, { init: mock() });
  const math = await page.evaluate(async () => {
    const S = await import('./features/season.js');
    const at = d => { const s = S.seasonAt(d); return [s.n, s.daysLeft]; };
    return {
      epoch: at(Date.UTC(2026, 8, 21)), mid: at(Date.UTC(2026, 8, 26, 12)), lastMs: at(Date.UTC(2026, 10, 2) - 1),
      s2: at(Date.UTC(2026, 10, 2)), before: S.seasonAt(Date.UTC(2026, 0, 1)).n, year: at(Date.UTC(2027, 8, 21)),
      pass: S.passId(3), now: S.seasonAt().n,
      xpBig: S.runXP({ score: 999999, wave: 80, kills: 5000, heads: 2000, bosses: ['a', 'b'] }),
      xpSmall: S.runXP({ score: 1000, wave: 2, kills: 10, heads: 2, bosses: [] }), xpZero: S.runXP({ score: 0, wave: 1, kills: 0, heads: 0 }),
      premiumKinds: [...new Set(Array.from({ length: 30 }, (_, i) => S.reward(1, i + 1, 'premium').kind))],
      suitTier: S.reward(1, 20, 'premium'), suit2: S.reward(2, 20, 'premium').label, suit3: S.reward(3, 20, 'premium').kind,
    };
  });
  ok(math.epoch.join() === '1,42', 'season 1 starts at epoch with 42 days left');
  ok(math.mid.join() === '1,37', 'mid-season days remaining rounds up');
  ok(math.lastMs.join() === '1,1', 'last millisecond of season 1 shows 1 day');
  ok(math.s2.join() === '2,42', 'season 2 starts after 6 weeks');
  ok(math.before === 1, 'dates before epoch clamp to season 1');
  ok(math.year.join() === '9,13', 'one year later is season 9 with 13 days left');
  ok(math.pass === 'com.alpsenel.laststanddeadzone.season.3.pass', 'pass product id');
  ok(math.now === 1, 'mocked date resolves to season 1');
  ok(math.xpBig === 600 && math.xpSmall === 71 && math.xpZero === 0, 'run xp formula and per-run cap (' + [math.xpBig, math.xpSmall, math.xpZero] + ')');
  ok(math.premiumKinds.every(k => ['scrap', 'flair', 'suit'].includes(k)), 'premium rewards are cosmetic or scrap only');
  ok(math.suitTier.kind === 'suit' && math.suitTier.suit === 5 && math.suit2 === 'DEEP DIVER' && math.suit3 === 'scrap', 'season suits map to seasons 1 and 2');

  const codec = await page.evaluate(async () => {
    const { SLOTS, SUITS, encodeLoadout, decodeLoadout, DEFAULT_LOADOUT } = await import('./character.js');
    const same = (a, b) => SLOTS.every(s => a[s.id] === b[s.id]);
    const res = [];
    for (const suit of [0, 4, 5, 6]) {
      const max = Object.fromEntries(SLOTS.map(s => [s.id, s.items.length - 1]));
      for (const l of [{ ...DEFAULT_LOADOUT, suit }, { ...max, suit }]) {
        const code = encodeLoadout(l, 63), d = decodeLoadout(code);
        res.push(Number.isSafeInteger(code) && same(d.loadout, l) && d.level === 63);
      }
    }
    const suitSlot = SLOTS.find(s => s.id === 'suit');
    return { res, bits: suitSlot.bits, n: suitSlot.items.length, seasons: SUITS.filter(s => s?.season).map(s => s.season), req: suitSlot.items[5].req, premium: !!suitSlot.items[5].premium };
  });
  ok(codec.res.every(Boolean), 'loadout round-trips through encode/decode including suits 5 and 6');
  ok(codec.bits === 3 && codec.n === 7 && codec.seasons.join() === '1,2' && codec.req === 'season:1' && !codec.premium, 'suit slot keeps 3 bits, 2 season suits appended');

  await page.waitForFunction(() => window.__calls.some(c => c.method === 'getProducts' && c.opts.ids.includes('com.alpsenel.laststanddeadzone.season.1.pass')));
  ok(true, 'season pass product id requested from StoreKit');

  await endRun(page, { score: 50000, wave: 12, kills: 300, heads: 100, shots: 800, hits: 500 });
  const r1 = await page.evaluate(() => ({ xp: window.__game.api.profile.season.xp, chip: document.querySelector('#sp-over').textContent, share: !!document.querySelector('#over-extras #rc-share') }));
  ok(r1.xp === 600, 'big run grants capped 600 season xp');
  ok(r1.chip.includes('+600') && r1.share, 'game-over shows season chip and share button');
  await page.screenshot({ path: join(shots, 'over-844x390.png') });

  await endRun(page, { score: 1000, wave: 2, kills: 10, heads: 2, shots: 30, hits: 12 });
  await page.evaluate(() => window.__game.api.bus.emit('mission:complete', { xp: 99999 }));
  const r2 = await page.evaluate(() => window.__game.api.profile.season.xp);
  ok(r2 === 600 + 71 + 500, 'small run and capped mission xp accrue (' + r2 + ')');

  await page.evaluate(() => { const { api } = window.__game; api.profile.season.xp = 5500; api.saveProfile(); api.toMenu(); });
  const badge = await page.evaluate(() => document.querySelector('#sp-open .badge').textContent);
  ok(badge === '6', 'menu season button badge counts claimable free tiers (' + badge + ')');
  await page.click('#sp-open');
  await page.screenshot({ path: join(shots, 'season-free-844x390.png') });
  const c1 = await page.evaluate(() => {
    const { api } = window.__game, before = api.profile.scrap;
    document.querySelector('.sp-cell[data-track="free"][data-tier="1"]').click();
    return { gained: api.profile.scrap - before, claimedAgain: api.season.claim('free', 1), tooHigh: api.season.claim('free', 7), prem: api.season.claim('premium', 1), cls: document.querySelector('.sp-cell[data-track="free"][data-tier="1"]').className, buy: document.querySelector('#sp-buy').textContent };
  });
  ok(c1.gained === 110 && c1.cls.includes('claimed'), 'claiming free tier 1 grants 110 scrap');
  ok(c1.claimedAgain === false && c1.tooHigh === false && c1.prem === false, 'double claims, unreached tiers and premium without pass are refused');
  ok(c1.buy === 'BUY PASS · $4.99', 'buy button shows localized StoreKit price (' + c1.buy + ')');

  await page.evaluate(() => { const { api } = window.__game; api.profile.season.xp = 21500; api.saveProfile(); api.season.render(true); });
  await page.click('#sp-buy');
  await page.waitForFunction(() => document.querySelector('#sp-buy').classList.contains('hidden'));
  const c2 = await page.evaluate(() => {
    const { api } = window.__game;
    const ready = document.querySelectorAll('.sp-cell.prem.ready').length;
    const scrap = api.profile.scrap;
    const got = api.season.claimAll();
    return { ready, got: got.length, scrap: api.profile.scrap - scrap, s: api.profile.season, iap: api.profile.iap, fresh: api.profile.fresh, note: document.querySelector('#sp-note').textContent };
  });
  ok(c2.iap['com.alpsenel.laststanddeadzone.season.1.pass'], 'mocked StoreKit purchase grants the pass');
  ok(c2.ready === 22, 'premium tiers 1-22 become retroactively claimable (' + c2.ready + ')');
  ok(c2.got === 22 + 21 && c2.s.premium.length === 22 && c2.s.free.length === 22, 'claim all claims remaining free and premium tiers');
  ok(c2.s.suits[1] === true && c2.s.flair.frame === 1 && c2.s.flair.elite === 1 && c2.s.flair.badge === 1 && c2.fresh.includes('suit:5'), 'suit and flair granted');
  await page.screenshot({ path: join(shots, 'season-premium-844x390.png') });

  await page.click('#sp-back');
  const tag = await page.evaluate(() => ({ t: document.querySelector('#sp-tag').textContent, framed: document.querySelector('#menu-char .nametag').classList.contains('sp-framed') }));
  ok(tag.t === 'SEASON 1 ELITE' && tag.framed, 'menu nametag shows season flair and frame');
  await page.screenshot({ path: join(shots, 'menu-844x390.png') });

  await page.click('[data-open="locker"]');
  await page.evaluate(() => { [...document.querySelectorAll('#slot-tabs button')].find(b => b.textContent.includes('EXCLUSIVE')).click(); });
  const lk = await page.evaluate(() => [...document.querySelectorAll('#item-grid .item')].map(b => [b.querySelector('b').textContent, b.className, b.querySelector('small').textContent]));
  const hollow = lk.find(x => x[0] === 'HOLLOW JACK'), diver = lk.find(x => x[0] === 'DEEP DIVER');
  ok(hollow && hollow[1].includes('owned') && !hollow[1].includes('locked'), 'season 1 suit is owned in the locker');
  ok(diver && diver[1].includes('locked') && diver[2].includes('SEASON 2 PASS'), 'season 2 suit is locked behind its pass');
  await page.evaluate(() => [...document.querySelectorAll('#item-grid .item')].find(b => b.textContent.includes('HOLLOW JACK')).click());
  await page.waitForTimeout(300);
  const eq = await page.evaluate(() => window.__game.api.profile.loadout.suit);
  ok(eq === 5, 'season suit can be equipped');
  await page.screenshot({ path: join(shots, 'locker-844x390.png') });
  await page.click('#locker-done');
  const code = await page.evaluate(() => { const { api } = window.__game; return api.decodeLoadout(api.myCode()).loadout.suit; });
  ok(code === 5, 'equipped season suit survives the Game Center score context');

  await page.evaluate(() => { const { api } = window.__game; api.records.rank = 1234; api.profile.competitive = { league: 'gold' }; });
  await endRun(page, { score: 48210, wave: 17, kills: 412, heads: 157, shots: 900, hits: 612 });
  await page.screenshot({ path: join(shots, 'over-season-844x390.png') });
  await page.click('#rc-share');
  await page.waitForFunction(() => window.__shared.length);
  const sh = await page.evaluate(() => ({ opts: window.__shared[0] }));
  const size = pngSize(sh.opts.base64);
  ok(size && size[0] === 1080 && size[1] === 1350, 'native Share receives a 1080x1350 PNG (' + size + ')');
  ok(/wave 17/.test(sh.opts.text) && /48,210/.test(sh.opts.text), 'share text includes wave and score');
  writeFileSync(join(shots, 'card.png'), Buffer.from(sh.opts.base64, 'base64'));
  const ev = await page.evaluate(async () => { let got = null; window.__game.api.bus.on('share', e => (got = e)); await window.__game.api.runCard.share(); return got; });
  ok(ev && ev.kind === 'run', 'share event emitted');

  await page.evaluate(() => document.querySelector('#board-list') && [...document.querySelectorAll('[data-open="board"]')][0].click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#board-list li')?.click());
  await page.waitForTimeout(300);
  const insp = await page.evaluate(() => ({ tag: document.querySelector('#sp-in-tag')?.className, framed: document.querySelector('#inspect .panel').classList.contains('sp-framed') }));
  ok(insp.tag && !insp.tag.includes('hidden') && insp.framed, 'own inspect card shows season flair');
  await page.screenshot({ path: join(shots, 'inspect-844x390.png') });
  allErrors.push(...errors);
  await page.close();
}

{
  const profile = { season: { n: 1, xp: 12345, free: [1, 2], premium: [], suits: {}, flair: {} }, scrap: 500 };
  const { page, errors } = await openGame(browser, url, { width: 390, height: 844, init: mock({ owned: ['com.alpsenel.laststanddeadzone.season.1.pass'], profile }) });
  await page.waitForFunction(() => window.__game.api.profile.iap['com.alpsenel.laststanddeadzone.season.1.pass']);
  await page.evaluate(() => window.__game.api.refreshProfileUI());
  await page.click('#sp-open');
  const p = await page.evaluate(() => ({ ready: document.querySelectorAll('.sp-cell.prem.ready').length, active: !document.querySelector('#sp-active').classList.contains('hidden'), w: document.documentElement.scrollWidth }));
  ok(p.ready === 13 && p.active, 'restored entitlement unlocks premium track (' + p.ready + ')');
  ok(p.w <= 390, 'season screen has no horizontal page overflow in portrait');
  await page.screenshot({ path: join(shots, 'season-390x844.png') });
  await endRun(page, { score: 9000, wave: 6, kills: 70, heads: 20, shots: 200, hits: 120 });
  await page.screenshot({ path: join(shots, 'over-390x844.png') });
  await page.click('#sp-open').catch(() => {});
  allErrors.push(...errors);
  await page.close();
}

{
  const { page, errors } = await openGame(browser, url, { init: mock({ now: Date.UTC(2026, 11, 1), share: false, profile: { season: { n: 1, xp: 20000, free: [1], premium: [], suits: { 1: true }, flair: { badge: 1 } }, loadout: { suit: 5 } } }) });
  const s = await page.evaluate(() => ({ s: window.__game.api.profile.season, suit: window.__game.api.profile.loadout.suit, kicker: (window.__game.api.season.open(), document.querySelector('#sp-kicker').textContent) }));
  ok(s.s.n === 2 && s.s.xp === 0 && !s.s.free.length && s.s.suits[1] && s.s.flair.badge === 1 && s.suit === 5, 'season rollover resets progress but keeps suits and flair');
  ok(s.kicker === 'SEASON 2 · 13 DAYS LEFT', 'season 2 kicker (' + s.kicker + ')');
  await page.evaluate(() => window.__game.api.toMenu());
  await endRun(page, { score: 3000, wave: 3, kills: 20, heads: 5, shots: 40, hits: 30 });
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  const shared = page.evaluate(() => new Promise(r => window.__game.api.bus.on('share', e => r(e.method))));
  await page.click('#rc-share');
  const method = await shared;
  const d = await dl;
  ok(method === 'web' || (method === 'download' && d && d.suggestedFilename() === 'deadzone-run.png'), 'browser fallback shares or downloads the PNG (' + method + ')');
  allErrors.push(...errors);
  await page.close();
}

{
  const { page, errors } = await openGame(browser, url, { width: 390, height: 844, init: mock() });
  await endRun(page, { score: 48210, wave: 17, kills: 412, heads: 157, shots: 900, hits: 612 });
  const b64 = await page.evaluate(async () => (await window.__game.api.runCard.render()).toDataURL('image/png').split(',')[1]);
  writeFileSync(join(shots, 'card-plain.png'), Buffer.from(b64, 'base64'));
  ok(pngSize(b64)?.join() === '1080,1350', 'card renders without season flair');
  allErrors.push(...errors);
  await page.close();
}

await browser.close();
server.close();
if (allErrors.length) { console.error(allErrors.join('\n')); failed++; }
console.log('screenshots in ' + shots);
if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
console.log('season ok');
