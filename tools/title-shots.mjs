// Retakes the title-screen App Store screenshots (iPhone 6.9" and iPad 13") from the web build.
//   npm run prepare:web && node tools/title-shots.mjs
import { serve, launch } from './smoke.mjs';

const out = new URL('../appstore-assets/screenshots/', import.meta.url).pathname;
const DEVICES = [
  { file: 'iphone-6.9-inch/01-title.png', width: 440, height: 956, dsf: 3 },
  { file: 'ipad-13-inch/01-title.png', width: 1032, height: 1376, dsf: 2 },
];
const init = () => {
  localStorage.setItem('deadzone.tutorial', 'true');
  localStorage.setItem('deadzone.settings', JSON.stringify({ sound: false, haptics: false, aimAssist: false, difficulty: 'survivor' }));
  localStorage.setItem('deadzone.profile', JSON.stringify({ xp: 160000, scrap: 4820, kills: 3120, heads: 910, runs: 64, bestWave: 34 }));
};

const { server, url } = await serve();
const browser = await launch();
for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dsf, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(init);
  await page.goto(url + '?debug');
  await page.waitForFunction(() => window.__game?.api?.season);
  await page.addStyleTag({ content: '.pg-note{display:none!important}' });
  const later = page.getByRole('button', { name: 'LATER', exact: true });
  if (await later.isVisible().catch(() => false)) await later.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + d.file });
  console.log('✓', d.file, d.width * d.dsf + '×' + d.height * d.dsf);
  await ctx.close();
}
await browser.close();
server.close();
