import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const shots = process.env.SHOTS || join(tmpdir(), 'deadzone-character-shots');
mkdirSync(shots, { recursive: true });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

const { server, url } = await serve();
const browser = await launch();
const allErrors = [];

{
  const { page, errors } = await openGame(browser, url);
  const codec = await page.evaluate(async () => {
    const { SLOTS, encodeLoadout, decodeLoadout, describeLoadout, DEFAULT_LOADOUT } = await import('./character.js');
    const legacy = (l, level) => {
      let code = 1, base = 4;
      for (const s of SLOTS) { const size = 2 ** s.bits; code += Math.max(0, Math.min(size - 1, l[s.id] | 0)) * base; base *= size; }
      return code + Math.max(1, Math.min(63, level | 0)) * base;
    };
    let seed = 7;
    const rnd = n => (seed = (seed * 16807) % 2147483647) % n;
    const same = (a, b) => SLOTS.every(s => a[s.id] === b[s.id]);
    const res = { legacy: true, female: true, tags: true, safe: true, invalid: true };
    for (let i = 0; i < 400; i++) {
      const l = Object.fromEntries(SLOTS.map(s => [s.id, rnd(s.items.length)])), level = 1 + rnd(63);
      const old = legacy(l, level), d = decodeLoadout(old);
      res.legacy &&= encodeLoadout(l, level) === old && encodeLoadout({ ...l, body: 0 }, level) === old && d.body === 0 && d.loadout.body === 0 && same(d.loadout, l) && d.level === level;
      const fc = encodeLoadout({ ...l, body: 1 }, level), fd = decodeLoadout(fc);
      res.female &&= fd.body === 1 && fd.loadout.body === 1 && same(fd.loadout, l) && fd.level === level && fc === old + 2;
      res.tags &&= old % 4 === 1 && fc % 4 === 3;
    }
    const max = Object.fromEntries(SLOTS.map(s => [s.id, 2 ** s.bits - 1]));
    for (const body of [0, 1]) {
      const c = encodeLoadout({ ...max, body }, 63);
      res.safe &&= Number.isSafeInteger(c) && c <= Number.MAX_SAFE_INTEGER && decodeLoadout(c)?.level === 63 && decodeLoadout(c).body === body;
    }
    const base = encodeLoadout(DEFAULT_LOADOUT, 5);
    res.invalid = decodeLoadout(base - 1) === null && decodeLoadout(base + 1) === null && decodeLoadout(0) === null && decodeLoadout(-3) === null && decodeLoadout(2 ** 53 + 1) === null;
    res.describe = describeLoadout({ ...DEFAULT_LOADOUT, body: 1 })[0].join() === 'BODY,FEMALE' && describeLoadout(DEFAULT_LOADOUT)[0].join() === 'BODY,MALE' && describeLoadout({ ...DEFAULT_LOADOUT, suit: 3, body: 1 })[0][1] === 'FEMALE';
    return res;
  });
  ok(codec.legacy, 'existing male codes (tag 1) decode unchanged and re-encode identically');
  ok(codec.female, 'female loadouts round-trip on tag 3 without touching any slot bits');
  ok(codec.tags, 'male codes keep code % 4 === 1, female use code % 4 === 3');
  ok(codec.safe, 'max values in every slot plus level 63 stay within MAX_SAFE_INTEGER for both bodies');
  ok(codec.invalid, 'codes with tag 0/2, non-positive or unsafe are rejected');
  ok(codec.describe, 'describeLoadout reports the body');

  const build = await page.evaluate(async () => {
    const { buildSurvivor, DEFAULT_LOADOUT, SLOTS } = await import('./character.js');
    const n = id => SLOTS.find(s => s.id === id).items.length;
    let maxMeshes = 0, threw = null;
    const count = o => { let c = 0; o.traverse(x => { if (x.isMesh) c++; }); return c; };
    try {
      for (const body of [0, 1]) {
        for (let hair = 0; hair < n('hair'); hair++) for (let head = 0; head < n('head'); head++) for (const face of [0, 2, 6]) maxMeshes = Math.max(maxMeshes, count(buildSurvivor({ ...DEFAULT_LOADOUT, body, hair, head, face })));
        for (let face = 0; face < n('face'); face++) for (let top = 0; top < n('top'); top++) maxMeshes = Math.max(maxMeshes, count(buildSurvivor({ ...DEFAULT_LOADOUT, body, face, top, back: top })));
        for (let suit = 0; suit < n('suit'); suit++) maxMeshes = Math.max(maxMeshes, count(buildSurvivor({ ...DEFAULT_LOADOUT, body, suit, hair: 3, head: 4 })));
      }
    } catch (e) { threw = e.message; }
    const geos = m => { const s = new Set(); m.traverse(x => x.isMesh && s.add(x.geometry)); return s; };
    const a = geos(buildSurvivor({ ...DEFAULT_LOADOUT, hair: 3, head: 3 })), b = geos(buildSurvivor({ ...DEFAULT_LOADOUT, hair: 3, head: 3 }));
    const m = buildSurvivor(DEFAULT_LOADOUT), f = buildSurvivor({ ...DEFAULT_LOADOUT, body: 1 });
    return { threw, maxMeshes, shared: [...b].every(g => a.has(g)), narrower: f.userData.arms[1].sh.position.x < m.userData.arms[1].sh.position.x, scaled: f.children[0].scale.x < 1 && m.children[0].scale.x === 1 };
  });
  ok(!build.threw, 'every hair x headgear x face x outfit x suit builds for both bodies' + (build.threw ? ' (' + build.threw + ')' : ''));
  ok(build.maxMeshes < 140, 'character mesh count stays bounded (' + build.maxMeshes + ')');
  ok(build.shared, 'head, hair and headgear geometries are cached and shared between builds');
  ok(build.narrower && build.scaled, 'female body is slimmer and slightly smaller');
  allErrors.push(...errors);
  await page.close();
}

{
  const legacyProfile = { loadout: { skin: 2, hair: 3, hairColor: 2, head: 0, face: 0, top: 0, topColor: 0, pants: 0, boots: 0, back: 0, gun: 0, title: 0, primary: 0, suit: 0 }, scrap: 300 };
  const init = `localStorage.getItem('deadzone.profile') || localStorage.setItem('deadzone.profile', ${JSON.stringify(JSON.stringify(legacyProfile))});`;
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(init);
  await page.goto(url + '?debug');
  await page.waitForFunction(() => window.__game);
  const before = await page.evaluate(() => { const { api } = window.__game; return { body: api.profile.loadout.body, tag: api.myCode() % 4, hair: api.profile.loadout.hair }; });
  ok(before.body === 0 && before.tag === 1 && before.hair === 3, 'existing saves default to the male body');
  await page.click('[data-open="locker"]');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#slot-tabs button')].map(b => b.textContent));
  ok(tabs[0] === 'BODY', 'BODY is the first locker tab (' + tabs.slice(0, 3).join(', ') + ')');
  await page.evaluate(() => document.querySelector('#slot-tabs button').click());
  const items = await page.evaluate(() => [...document.querySelectorAll('#item-grid .item')].map(b => [b.querySelector('b').textContent, b.querySelector('small').textContent]));
  ok(items.map(x => x[0]).join() === 'MALE,FEMALE' && items.every(x => x[1] === 'EQUIPPED' || x[1] === 'OWNED'), 'MALE / FEMALE are free and owned');
  await page.evaluate(() => [...document.querySelectorAll('#item-grid .item')].find(b => b.textContent.includes('FEMALE')).click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, 'locker-female.png') });
  await page.click('#locker-done');
  const after = await page.evaluate(() => { const { api } = window.__game, c = api.myCode(); return { body: api.profile.loadout.body, tag: c % 4, d: api.decodeLoadout(c), saved: JSON.parse(localStorage.getItem('deadzone.profile')).loadout.body }; });
  ok(after.body === 1 && after.saved === 1, 'female body is equipped and persisted');
  ok(after.tag === 3 && after.d.body === 1 && after.d.loadout.hair === 3 && after.d.loadout.skin === 2, 'score context carries the female body');
  await page.reload();
  await page.waitForFunction(() => window.__game);
  const reloaded = await page.evaluate(() => window.__game.api.profile.loadout.body);
  ok(reloaded === 1, 'female body survives a reload');
  const swap = await page.evaluate(() => {
    const { api } = window.__game, l = api.profile.loadout;
    const pick = name => [...document.querySelectorAll('#item-grid .item')].find(b => b.querySelector('b').textContent === name).click();
    const run = hair => { Object.assign(l, { body: 0, hair }); document.querySelector('[data-open="locker"]').click(); document.querySelector('#slot-tabs button').click(); pick('FEMALE'); document.querySelector('#locker-done').click(); return { body: l.body, hair: l.hair, owned: !!api.profile.owned['hair:3'] }; };
    const kept = run(4), swapped = run(1);
    return { kept, swapped };
  });
  ok(swap.kept.body === 1 && swap.kept.hair === 4, 'switching to FEMALE keeps a chosen hair style');
  ok(swap.swapped.body === 1 && swap.swapped.hair === 3 && swap.swapped.owned, 'switching to FEMALE from the default hair gives free LONG hair');
  const thumbs = await page.evaluate(() => {
    const { api } = window.__game, l = { ...api.profile.loadout };
    const m = api.encodeLoadout({ ...l, body: 0 }, 10), f = api.encodeLoadout({ ...l, body: 1 }, 10);
    const tm = api.preview.thumbnail(api.decodeLoadout(m).loadout, 96), tf = api.preview.thumbnail(api.decodeLoadout(f).loadout, 96);
    return { differ: tm !== tf, f: tf.split(',')[1] };
  });
  writeFileSync(join(shots, 'avatar-female.png'), Buffer.from(thumbs.f, 'base64'));
  ok(thumbs.differ, 'leaderboard avatars decoded from context render the body');
  allErrors.push(...errors);
  await ctx.close();
}

await browser.close();
server.close();
if (allErrors.length) { console.error(allErrors.join('\n')); failed++; }
console.log('screenshots in ' + shots);
if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
console.log('character ok');
