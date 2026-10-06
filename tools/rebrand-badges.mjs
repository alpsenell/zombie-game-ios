// One-off: replaces the game name printed on the Game Center achievement badges
// (and renamed achievement titles) without redrawing the medal artwork.
//   node tools/rebrand-badges.mjs
import sharp from 'sharp';
import { readdirSync } from 'node:fs';

const dir = new URL('../appstore-assets/achievements/', import.meta.url).pathname;
const NAME = 'HORDE BREAKERS';
const RETITLE = { wave_20: 'BREAKING POINT', wave_50: 'HORDE LEGEND' };
const S = 1024, CX = 512, CY = 429, R_OUT = 318, GRID = 64;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgText = (text, y, size, fill, spacing, shadow = '') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${shadow}<text x="${CX}" y="${y}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="700" font-size="${size}" letter-spacing="${spacing}" fill="${fill}">${esc(text)}</text></svg>`);

// Fill the masked pixels of a text box from the background grid one or more
// periods away (same row or column), which hides the old text without blurring the grid.
function inpaint(px, box, isText, axis, [ax, up, down] = [3, 3, 3]) {
  const [x0, y0, x1, y1] = box, mask = new Uint8Array(S * S);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * S + x) * 3;
    if (!isText(px[i], px[i + 1], px[i + 2])) continue;
    for (let dy = -up; dy <= down; dy++) for (let dx = -ax; dx <= ax; dx++) mask[(y + dy) * S + x + dx] = 1;
  }
  const src = Buffer.from(px);
  for (let y = y0 - up; y <= y1 + down; y++) for (let x = x0 - ax; x <= x1 + ax; x++) {
    if (!mask[y * S + x]) continue;
    const i = (y * S + x) * 3;
    const d = Math.hypot(x - CX, y - CY);
    if (axis === 'y' && d <= R_OUT + 2) {
      // Ring and its rim are vertically symmetric: mirror from the bottom of the ring.
      const j = ((2 * CY - y) * S + x) * 3, t = Math.min(1, Math.max(0, R_OUT + 2 - d) / 2);
      const k = ((y - GRID) * S + x) * 3;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(src[j + c] * t + src[k + c] * (1 - t));
      continue;
    }
    for (let n = 1; n < 8; n++) {
      const cand = axis === 'y' ? [[x, y - n * GRID]] : [[x - n * GRID, y], [x + n * GRID, y]];
      const ok = cand.find(([cx, cy]) => cx >= 0 && cx < S && cy >= 0 && !mask[cy * S + cx]);
      if (ok) { const j = (ok[1] * S + ok[0]) * 3; px[i] = src[j]; px[i + 1] = src[j + 1]; px[i + 2] = src[j + 2]; break; }
    }
  }
}

for (const f of readdirSync(dir).filter(f => f.endsWith('.png'))) {
  const slug = f.replace(/^deadzone\.ach\.|\.png$/g, '');
  const file = dir + f;
  const { data } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const grey = (r, g, b) => Math.abs(r - g) < 24 && Math.abs(g - b) < 24 && r > 70;
  inpaint(data, [185, 90, 839, 124], (r, g, b) => grey(r, g, b), 'y');
  const layers = [{ input: svgText(NAME, 119, 34, '#a59a87', 11) }];
  if (RETITLE[slug]) {
    inpaint(data, [90, 812, 934, 880], (r, g, b) => r > 90 && b > 70, 'x', [10, 6, 22]);
    const t = RETITLE[slug], attrs = `text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="700" font-size="80" letter-spacing="3"`;
    const shadow = `<defs><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs><text x="${CX}" y="881" ${attrs} fill="#000" opacity=".75" filter="url(#b)">${esc(t)}</text>`;
    layers.push({ input: svgText(t, 875, 80, '#f6f1e7', 3, shadow) });
  }
  await sharp(data, { raw: { width: S, height: S, channels: 3 } }).composite(layers).png().toFile(file + '.tmp');
  const { renameSync } = await import('node:fs');
  renameSync(file + '.tmp', file);
  console.log('✓', f);
}
