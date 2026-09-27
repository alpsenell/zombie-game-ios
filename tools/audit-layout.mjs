import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, launch, openGame } from './smoke.mjs';

const shots = process.env.SHOTS || join(tmpdir(), 'deadzone-layout');
mkdirSync(shots, { recursive: true });

const DEVICES = [
  { name: 'se', width: 667, height: 375, inset: { l: 0, r: 0, t: 0, b: 0 } },
  { name: 'i14', width: 844, height: 390, inset: { l: 47, r: 47, t: 0, b: 21 } },
  { name: 'promax', width: 932, height: 430, inset: { l: 59, r: 59, t: 0, b: 21 } },
  { name: 'android', width: 740, height: 360, inset: { l: 0, r: 0, t: 0, b: 0 } },
  { name: 'p-se', width: 375, height: 667, inset: { l: 0, r: 0, t: 20, b: 0 } },
  { name: 'p-i14', width: 390, height: 844, inset: { l: 0, r: 0, t: 47, b: 34 } },
  { name: 'p-promax', width: 430, height: 932, inset: { l: 0, r: 0, t: 59, b: 34 } },
  { name: 'p-android', width: 360, height: 740, inset: { l: 0, r: 0, t: 24, b: 0 } },
];
const only = process.env.DEVICE;

const insetCss = i => `:root{--sl:${i.l}px!important;--sr:${i.r}px!important;--st:${i.t}px!important;--sb:${i.b}px!important}`;

const probe = inset => {
  const vw = innerWidth, vh = innerHeight;
  const vis = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || e.classList.contains('hidden')) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const clipRect = el => {
    let r = el.getBoundingClientRect(), box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const p = e.getBoundingClientRect();
        box = { l: Math.max(box.l, p.left), t: Math.max(box.t, p.top), r: Math.min(box.r, p.right), b: Math.min(box.b, p.bottom) };
      }
    }
    return box;
  };
  const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + (el.innerText ? ` "${el.innerText.trim().replace(/\s+/g, ' ').slice(0, 24)}"` : '');
  const leaves = [...document.querySelectorAll('button, a, input, select, [role=button], .rec, .stat, .stats > div, h1, h2, h3, .logo, #hint, #weapon, #vitals, #wave-box, #scorebox, #topright, #radar, #bossbar, #stick-zone, #fire, #reload, #swap, #grenade, #hud-rival, #hud-extras, small, p, b, span')]
    .filter(el => vis(el) && ![...el.children].some(c => c.matches('button, a, input')));
  const items = leaves.map(el => ({ el, r: el.getBoundingClientRect(), c: clipRect(el) }));
  const issues = [];
  for (const it of items) {
    const { r, c, el } = it;
    const clipped = (r.right - c.r > 2 || c.l - r.left > 2 || r.bottom - c.b > 2 || c.t - r.top > 2);
    if (el.matches('button, a, input, #fire, #reload, #swap, #grenade')) {
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) issues.push(`OFFSCREEN ${label(el)} [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}]`);
      else if (!clipped && (r.left < inset.l - 1 || r.right > vw - inset.r + 1 || r.top < inset.t - 1 || r.bottom > vh - inset.b + 1)) issues.push(`SAFEAREA ${label(el)} [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}]`);
    }
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && el.matches('button, b, span, small, p, h2')) issues.push(`TEXT-CLIP ${label(el)} ${el.scrollWidth}>${el.clientWidth}`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const A = a.c, B = b.c;
    const w = Math.min(A.r, B.r) - Math.max(A.l, B.l), h = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    if (w > 4 && h > 4) {
      issues.push(`OVERLAP ${label(a.el)} x ${label(b.el)} ${w|0}x${h|0}`);
    }
  }
  const sc = document.querySelector('.screen:not(.hidden)');
  if (sc && sc.scrollHeight > sc.clientHeight + 2) issues.push(`SCROLLS ${label(sc)} ${sc.scrollHeight}>${sc.clientHeight}`);
  return [...new Set(issues)];
};

const report = {};
const { server, url } = await serve();
const browser = await launch();
for (const d of DEVICES) {
  if (only && d.name !== only) continue;
  const { page, errors } = await openGame(browser, url, { width: d.width, height: d.height, init: `localStorage.setItem('deadzone.settings', JSON.stringify({analytics:false}))` });
  await page.addStyleTag({ content: insetCss(d.inset) });
  await page.evaluate(() => { for (const s of document.querySelectorAll('.sheet, .modal, #consent')) s.remove?.(); });
  await page.waitForTimeout(800);
  const snap = async name => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, `${d.name}-${name}.png`) });
    report[`${d.name}/${name}`] = await page.evaluate(probe, d.inset);
  };
  const dismiss = async () => page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (/^(LATER|NO THANKS|CLOSE|DONE|BACK|✕|×)$/i.test(b.innerText.trim()) && b.offsetParent) b.click();
  });
  await dismiss();
  await snap('menu');
  const dock = await page.evaluate(() => [...document.querySelectorAll('#menu-dock button, #menu-extras button, #menu .menu-top button, #menu-modes > button')].filter(b => b.offsetParent).map((b, i) => ({ i, id: b.id, t: b.innerText.trim().replace(/\s+/g, ' ').slice(0, 20) })));
  for (const b of dock) {
    if (/DEPLOY|CO-OP|DAILY|RANKED/i.test(b.t)) continue;
    await page.evaluate(i => [...document.querySelectorAll('#menu-dock button, #menu-extras button, #menu .menu-top button, #menu-modes > button')].filter(b => b.offsetParent)[i].click(), b.i);
    await snap('menu-' + (b.id || b.t).replace(/[^a-z0-9]+/gi, '_').toLowerCase());
    await page.keyboard.press('Escape');
    await dismiss();
    await page.evaluate(() => { for (const b of document.querySelectorAll('.screen:not(.hidden) button')) if (/^(DONE|CLOSE|BACK|✕|×)/i.test(b.innerText.trim())) { b.click(); break; } });
    await page.waitForTimeout(300);
    const onMenu = await page.evaluate(() => !document.querySelector('#menu').classList.contains('hidden'));
    if (!onMenu) { await page.goto(url + '?debug'); await page.waitForFunction(() => window.__game); await page.addStyleTag({ content: insetCss(d.inset) }); await dismiss(); }
  }
  await page.click('#start');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const h = document.querySelector('#hint'); if (h) { h.textContent = 'Drag anywhere on the left to move'; h.style.opacity = 1; } });
  await snap('hud');
  await page.click('#pause').catch(() => {});
  await snap('pause');
  await page.evaluate(() => { const s = [...document.querySelectorAll('#pausemenu button')].find(b => /SETTINGS/i.test(b.innerText)); s?.click(); });
  await snap('settings');
  await page.evaluate(() => window.__game.gameOver());
  await page.waitForTimeout(1200);
  await snap('over');
  report[`${d.name}/errors`] = errors.slice(0, 5);
  await page.close();
}
await browser.close();
server.close();
writeFileSync(join(shots, 'report.json'), JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) { console.log(`== ${k} (${v.length})`); for (const l of v.slice(0, 40)) console.log('  ' + l); }
console.log('shots:', shots);
