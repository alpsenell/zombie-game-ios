import { serve, launch, openGame } from './smoke.mjs';

const failures = [];
const check = (ok, name, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === undefined ? '' : ' → ' + JSON.stringify(info))); if (!ok) failures.push(name); };
const NOW = Date.UTC(2026, 9, 1, 12);

const { server, url } = await serve();
const browser = await launch();
const pageErrors = [];

const PROFILE = { runs: 3, bestWave: 9, scrap: 10000, xp: 0, kills: 100, owned: {}, loadout: {}, arsenal: { owned: { mp7: true } } };
async function open({ now = NOW, profile = PROFILE } = {}) {
  const init = `
    window.__now = ${now};
    Date.now = () => window.__now;
    localStorage.clear();
    localStorage.setItem('deadzone.tutorial', 'true');
    localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(profile))});`;
  const { page, errors } = await openGame(browser, url, { init: { content: init } });
  page.on('close', () => pageErrors.push(...errors));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const m = document.querySelector('.pg-modal'); (m?.querySelector('.ghost') || m?.querySelector('.cta'))?.click(); });
  return page;
}

{
  const page = await open();
  const pure = await page.evaluate(async () => {
    const Mk = await import('./features/market.js'), { api } = window.__game, p = { owned: {} };
    const a = Mk.stock('2026-10-01', p, api.SLOTS), b = Mk.stock('2026-10-01', p, api.SLOTS), c = Mk.stock('2026-10-02', p, api.SLOTS), d = Mk.stock('2026-10-03', p, api.SLOTS);
    const owned = { owned: Object.fromEntries(Mk.exclusives(api.SLOTS).map(x => ['gun:' + x.i, true])) };
    return {
      same: JSON.stringify(a) === JSON.stringify(b), differ: [c, d].some(x => JSON.stringify(x) !== JSON.stringify(a)),
      disc: a.disc, excl: a.excl, cons: a.cons, prices: [Mk.discountPrice(1000), Mk.discountPrice(150), Mk.discountPrice(50)],
      exclCount: Mk.exclusives(api.SLOTS).length, soldOut: Mk.stock('2026-10-01', owned, api.SLOTS).excl,
    };
  });
  check(pure.same && pure.differ && pure.disc && pure.disc.cost >= 150 && pure.disc.price < pure.disc.cost && pure.excl?.req.startsWith('market:') && pure.excl.price === 1200 && ['shield', 'revive', 'reroll'].includes(pure.cons), 'the stock is seeded from the day key', pure);
  check(pure.prices.join() === '600,90,50' && pure.exclCount === 6 && pure.soldOut === null, 'discount pricing and six market-only skins', pure);

  const ui = await page.evaluate(() => {
    const { api } = window.__game, btn = document.querySelector('#mk-open');
    const badge = btn.querySelector('.badge').textContent;
    btn.click();
    const cards = [...document.querySelectorAll('#market .mk-card')].map(c => c.className + ' | ' + c.textContent);
    return { badge, visible: !document.querySelector('#market').classList.contains('hidden'), n: cards.length, cards, sub: document.querySelector('#mk-sub').textContent, badgeAfter: btn.querySelector('.badge').textContent, locked: api.reqText('market:onyx') };
  });
  check(ui.badge === '!' && ui.visible && ui.n === 4 && /STOCK ROTATES IN 12H/.test(ui.sub) && /10,000/.test(ui.sub) && ui.badgeAfter === '' && /BLACK MARKET EXCLUSIVE/.test(ui.locked), 'the market opens from the menu with four cards', { badge: ui.badge, n: ui.n, sub: ui.sub });
  check(/deal/.test(ui.cards[0]) && /40% OFF/.test(ui.cards[0]) && /excl/.test(ui.cards[1]) && /ONLY SOLD HERE/.test(ui.cards[1]) && /cons/.test(ui.cards[2]) && /crate/.test(ui.cards[3]) && /WEAPON SKIN GUARANTEED IN 4 CRATES/.test(ui.cards[3]) && /0 \/ 3 SKIN SHARDS/.test(ui.cards[3]), 'cards show the deal, the exclusive, the consumable and the crate pity', ui.cards.map(c => c.slice(0, 80)));
  await page.screenshot({ path: '/tmp/market.png' });

  const deal = await page.evaluate(() => {
    const { api } = window.__game, m = api.market, s = m.stock(), events = [];
    api.bus.on('purchase', e => events.push(e));
    const scrap0 = api.profile.scrap, key = s.disc.slot + ':' + s.disc.i;
    document.querySelector('[data-buy="disc"]').click();
    const first = { scrap: scrap0 - api.profile.scrap, owned: !!api.profile.owned[key], fresh: api.profile.fresh.includes(key), sold: document.querySelector('.mk-card.deal').classList.contains('sold'), btn: document.querySelector('[data-buy="disc"]').textContent };
    const again = m.buy('disc');
    const before = api.reqMet(s.excl.req.slice(7));
    document.querySelector('[data-buy="excl"]').click();
    const excl = { scrap: scrap0 - api.profile.scrap - s.disc.price, met: api.reqMet(s.excl.req), before, owned: !!api.profile.owned['gun:' + s.excl.i], btn: document.querySelector('[data-buy="excl"]').textContent };
    return { price: s.disc.price, first, again, excl, events: events.map(e => e.item + ':' + e.cost) };
  });
  check(deal.first.scrap === deal.price && deal.first.owned && deal.first.fresh && deal.first.sold && deal.first.btn === 'SOLD' && deal.again === false, 'the discounted cosmetic sells once at the reduced price', deal.first);
  check(deal.excl.scrap === 1200 && deal.excl.met && !deal.excl.before && deal.excl.owned && deal.excl.btn === 'OWNED' && deal.events.length === 2, 'the exclusive skin unlocks its market requirement', deal.excl);

  const cons = await page.evaluate(() => {
    const { api } = window.__game, m = api.market, M = m.state(), pg = api.progression, st = pg.state.streak, max = pg.data.SHIELD_MAX;
    M.stock.cons = 'shield'; M.sold.cons = false; st.shields = 0;
    const scrap0 = api.profile.scrap;
    const s1 = m.buy('cons'), shields = st.shields, scrapShield = scrap0 - api.profile.scrap;
    M.sold.cons = false; st.shields = max; m.render();
    const capped = { btn: document.querySelector('[data-buy="cons"]').textContent, res: m.buy('cons'), note: document.querySelector('#mk-note').textContent };
    M.stock.cons = 'reroll'; M.sold.cons = false; m.render();
    const r1 = m.buy('cons'), tokens = M.rerolls, before = pg.state.daily.list.map(x => x.id);
    const a = pg.reroll('daily', 0), b = pg.reroll('daily', 1), c = pg.reroll('daily', 2);
    const after = { free: pg.state.reroll, tokens: M.rerolls, a: !!a, b: !!b, c: !!c };
    M.stock.cons = 'revive'; M.sold.cons = false; m.render();
    const v1 = m.buy('cons'), revives = M.revives;
    return { s1, shields, scrapShield, capped, r1, tokens, after, v1, revives, max };
  });
  check(cons.s1 && cons.shields === 1 && cons.scrapShield === 600 && !cons.capped.res && cons.capped.btn === 'SHIELDS FULL', 'a streak shield adds one shield and stops at the cap', cons);
  check(cons.r1 && cons.tokens === 1 && cons.after.a && cons.after.b && !cons.after.c && cons.after.tokens === 0 && cons.v1 && cons.revives === 1, 'a reroll token allows a second mission reroll and a revive token is stored', cons.after);

  const revive = await page.evaluate(async () => {
    const { api } = window.__game, M = api.market.state();
    api.levels.state.paid = 99;
    api.showScreen(api.ui.menu);
    api.startGame({ map: 'street' });
    const scrap0 = api.profile.scrap;
    api.hurtPlayer(1e7);
    const label = document.querySelector('#rv-yes').textContent, mode = api.state.mode;
    document.querySelector('#rv-yes').click();
    const out = { label, mode, after: api.state.mode, revives: M.revives, scrap: scrap0 - api.profile.scrap, hp: api.player.hp > 0 };
    api.gameOver();
    await new Promise(r => setTimeout(r, 200));
    api.toMenu();
    return out;
  });
  check(revive.mode === 'revive' && /FREE/.test(revive.label) && revive.after === 'playing' && revive.revives === 0 && revive.scrap === 0 && revive.hp, 'a revive token makes the revive free', revive);

  const reroll = await page.evaluate(() => {
    const { api } = window.__game, events = [];
    api.bus.on('perk:reroll', e => events.push(e));
    api.profile.scrap = 5000;
    api.startGame({ map: 'street', seed: 'mk' });
    api.state.wave = 3;
    api.offerPerks();
    const btn = document.querySelector('#perk-reroll');
    const shown = { hidden: btn.classList.contains('hidden'), text: btn.textContent, disabled: btn.disabled };
    const offer0 = api.state.perkOffer.join();
    btn.click();
    const offer1 = api.state.perkOffer.join();
    const afterClick = { text: btn.textContent, disabled: btn.disabled, scrap: api.profile.scrap, rerolls: api.state.perkRerolls };
    api.state.wave = 4; api.offerPerks();
    const nextWave = { text: btn.textContent, disabled: btn.disabled };
    api.offerPerks(2);
    const kit = btn.classList.contains('hidden');
    api.gameOver();
    api.startGame({ type: 'ranked', map: 'street' });
    api.state.wave = 3; api.offerPerks();
    const ranked = btn.classList.contains('hidden');
    api.gameOver();
    return { shown, offer0, offer1, afterClick, nextWave, kit, ranked, events };
  });
  check(!reroll.shown.hidden && /REROLL · 🔩 300/.test(reroll.shown.text) && !reroll.shown.disabled && reroll.offer1 !== reroll.offer0 && reroll.afterClick.scrap === 4700 && reroll.afterClick.rerolls === 1 && /REROLLED THIS WAVE/.test(reroll.afterClick.text) && reroll.afterClick.disabled, 'a perk reroll costs 100 × wave and changes the offer', { shown: reroll.shown, after: reroll.afterClick, offers: [reroll.offer0, reroll.offer1] });
  check(/🔩 400/.test(reroll.nextWave.text) && !reroll.nextWave.disabled && reroll.kit && reroll.ranked && reroll.events[0]?.wave === 3 && reroll.events[0].cost === 300, 'the reroll returns each wave and hides for kits and ranked runs', { next: reroll.nextWave, kit: reroll.kit, ranked: reroll.ranked });
  await page.close();
}

{
  const page = await open({ profile: { ...PROFILE, scrap: 30000 } });
  const crates = await page.evaluate(async () => {
    const Mk = await import('./features/market.js'), { api } = window.__game, m = api.market, M = m.state(), results = [];
    api.bus.on('market:crate', e => results.push(e));
    const scrap0 = api.profile.scrap, pool0 = api.levels.cratePool().length;
    api.market.open();
    const out = [];
    for (let i = 0; i < 4; i++) { out.push(m.buyCrate(() => 0)); }
    const pity = [...document.querySelectorAll('.mk-card.crate span')].map(s => s.textContent);
    const keys = out.map(r => r.slot + ':' + r.i), owned = keys.every(k => api.profile.owned[k]);
    const reveal = document.querySelector('.mk-reveal')?.textContent;
    document.querySelector('.mk-reveal .cta')?.click();
    const equipped = api.profile.loadout[out[3].slot] === out[3].i;
    return { scrap: scrap0 - api.profile.scrap, kinds: out.map(r => r.kind), slots: out.map(r => r.slot), forced: out.map(r => !!r.forced), unique: new Set(keys).size === 4, owned, crates: M.crates, pity: M.pity, pool: pool0 - api.levels.cratePool().length, pityText: pity, events: results.length, reveal, equipped };
  });
  check(crates.scrap === 4000 && crates.kinds.every(k => k === 'item') && crates.unique && crates.owned && crates.crates === 4 && crates.pool === 4 && crates.events === 4, 'four crates pay four different cosmetics for 1,000 scrap each', crates);
  check(crates.slots.slice(0, 3).every(s => s !== 'gun') && crates.slots[3] === 'gun' && crates.forced[3] && crates.pity === 0 && /GUARANTEED SKIN/.test(crates.reveal) && crates.equipped, 'the fourth crate is a guaranteed weapon skin that can be equipped from the reveal', crates);
  await page.screenshot({ path: '/tmp/market-crate.png' });

  const shards = await page.evaluate(() => {
    const { api } = window.__game, m = api.market, M = m.state(), s = m.stock();
    for (const it of api.levels.cratePool()) api.profile.owned[it.slot + ':' + it.i] = true;
    m.render();
    const emptyText = document.querySelector('.mk-card.crate').textContent;
    const r = [m.buyCrate(), m.buyCrate(), m.buyCrate()];
    document.querySelector('.mk-sheet .cta')?.click();
    const redeemBtn = !!document.querySelector('#mk-redeem');
    const before = api.profile.owned['gun:' + s.excl.i];
    document.querySelector('#mk-redeem')?.click();
    return { emptyText, kinds: r.map(x => x.kind), shards: r.map(x => x.shards), redeemBtn, before: !!before, after: !!api.profile.owned['gun:' + s.excl.i], left: M.shards, met: api.reqMet(s.excl.req), card: document.querySelector('.mk-card.excl').textContent };
  });
  check(/POOL EMPTY/.test(shards.emptyText) && shards.kinds.every(k => k === 'shard') && shards.shards.join() === '1,2,3' && shards.redeemBtn && !shards.before && shards.after && shards.left === 0 && shards.met && /OWNED/.test(shards.card), 'an empty pool pays shards and three shards redeem the exclusive', shards);

  const merged = await page.evaluate(async () => {
    const C = await import('./features/cloudsave.js');
    const m = C.mergeProfile({ runs: 3, market: { day: '2026-10-01', sold: { disc: true }, crates: 2, pity: 1, shards: 1, revives: 0, rerolls: 1, seen: '2026-10-01' } }, { runs: 2, market: { day: '2026-10-01', sold: { cons: true }, crates: 5, pity: 0, shards: 2, revives: 1, rerolls: 0, seen: '2026-09-30' } });
    return m.market;
  });
  check(merged.sold.disc && merged.sold.cons && merged.crates === 5 && merged.shards === 2 && merged.revives === 1 && merged.rerolls === 1 && merged.seen === '2026-10-01', 'the cloud merge keeps purchases and tokens from both devices', merged);
  await page.close();
}

{
  const page = await open({ profile: { ...PROFILE, scrap: 100 } });
  const poor = await page.evaluate(() => {
    const { api } = window.__game, m = api.market;
    m.open();
    const r = m.buyCrate();
    return { r, note: document.querySelector('#mk-note').textContent, scrap: api.profile.scrap };
  });
  check(poor.r === null && /NEED 900 MORE SCRAP/.test(poor.note) && poor.scrap === 100, 'a crate cannot be bought without the scrap', poor);
  await page.close();
}

const errs = pageErrors.filter(e => !/favicon|net::ERR|navigator.vibrate/.test(e));
check(!errs.length, 'no page errors', errs.slice(0, 3));
await browser.close();
server.close();
console.log(failures.length ? failures.length + ' FAILED' : 'ALL MARKET CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
