import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const root = new URL('../www/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
export async function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([.][.][/\\])+/, '');
    const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(port, r));
  return { server, url: `http://localhost:${server.address().port}/` };
}

export async function launch(args = []) {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...args] });
}

export async function openGame(browser, url, { width = 844, height = 390, init } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(url + '?debug');
  await page.waitForFunction(() => window.__game);
  return { page, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const browser = await launch();
  const { page, errors } = await openGame(browser, url);
  await page.click('#start');
  const out = await page.evaluate(() => {
    const g = window.__game, { api } = g;
    api.settings.autoFire = true;
    for (let i = 0; i < 30 * 120; i++) {
      if (api.state.mode === 'perk') document.querySelector('.perk').click();
      if (api.state.mode !== 'playing') break;
      let best = null, bd = 1e9;
      for (const z of api.zombies) { const u = z.userData; if (u.dead || u.rise > .3) continue; const d = z.position.distanceTo(api.camera.position); if (d < bd) { bd = d; best = z; } }
      if (best) { const u = best.userData, tx = best.position.x - api.camera.position.x, tz = best.position.z - api.camera.position.z; api.look.yaw = Math.atan2(-tx, -tz); api.look.pitch = Math.atan2((u.T.aimY ?? 1.1) * u.sc - api.camera.position.y, Math.hypot(tx, tz)); }
      g.update(1 / 30); g.scene.updateMatrixWorld();
    }
    const summary = api.runSummary();
    g.gameOver();
    return summary;
  });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify({ wave: out.wave, kills: out.kills, score: out.score }));
  await browser.close();
  server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('smoke ok');
}
