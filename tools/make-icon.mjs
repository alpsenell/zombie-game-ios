// Draws the Horde Breakers app icon (cracked skull emblem) and writes it to the
// Xcode asset catalog and assets/icon.png.
//   node tools/make-icon.mjs
import sharp from 'sharp';

const S = 1024;
// Skull, drawn once and split along a jagged crack into two halves.
const skull = `
  <path d="M512 214c-150 0-262 104-262 248 0 84 38 150 98 190v86c0 22 18 40 40 40h248c22 0 40-18 40-40v-86c60-40 98-106 98-190 0-144-112-248-262-248z" fill="url(#bone)"/>
  <path d="M398 418c-46 0-80 36-80 78 0 36 26 58 62 58 50 0 86-40 86-84 0-30-28-52-68-52zM626 418c40 0 68 22 68 52 0 44-36 84-86 84-36 0-62-22-62-58 0-42 34-78 80-78z" fill="#120708"/>
  <circle cx="392" cy="490" r="20" fill="#ff5a3c" filter="url(#glow)"/>
  <circle cx="632" cy="490" r="20" fill="#ff5a3c" filter="url(#glow)"/>
  <path d="M512 560l-40 76h80z" fill="#120708"/>
  <g fill="#120708"><rect x="404" y="700" width="20" height="78" rx="6"/><rect x="460" y="700" width="20" height="78" rx="6"/><rect x="544" y="700" width="20" height="78" rx="6"/><rect x="600" y="700" width="20" height="78" rx="6"/></g>`;
const crack = 'M520 180 L496 300 L540 380 L488 470 L534 560 L492 660 L526 760 L506 880';
const left = `M0 0 H520 L496 300 L540 380 L488 470 L534 560 L492 660 L526 760 L506 880 V${S} H0Z`;
const right = `M${S} 0 H520 L496 300 L540 380 L488 470 L534 560 L492 660 L526 760 L506 880 V${S} H${S}Z`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#1d4a50"/><stop offset=".55" stop-color="#0c1f23"/><stop offset="1" stop-color="#050b0d"/></radialGradient>
  <radialGradient id="flare" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff7a3c" stop-opacity=".95"/><stop offset=".35" stop-color="#e5483a" stop-opacity=".55"/><stop offset="1" stop-color="#e5483a" stop-opacity="0"/></radialGradient>
  <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf7ec"/><stop offset="1" stop-color="#cfc6b2"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a4d"/><stop offset="1" stop-color="#a3241a"/></linearGradient>
  <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".7"/></filter>
  <clipPath id="L"><path d="${left}"/></clipPath>
  <clipPath id="R"><path d="${right}"/></clipPath>
</defs>
<rect width="${S}" height="${S}" fill="url(#bg)"/>
<circle cx="512" cy="512" r="390" fill="none" stroke="url(#ring)" stroke-width="34"/>
<circle cx="512" cy="512" r="350" fill="none" stroke="#e5483a" stroke-opacity=".35" stroke-width="6" stroke-dasharray="18 22"/>
<ellipse cx="512" cy="520" rx="150" ry="420" fill="url(#flare)"/>
<path d="${crack}" fill="none" stroke="#ffb15c" stroke-width="10" stroke-linejoin="round" filter="url(#glow)"/>
<g filter="url(#shadow)">
  <g clip-path="url(#L)" transform="translate(-34 6) rotate(-5 512 512)">${skull}</g>
  <g clip-path="url(#R)" transform="translate(34 -6) rotate(5 512 512)">${skull}</g>
</g>
</svg>`;

const png = await sharp(Buffer.from(svg)).flatten({ background: '#050b0d' }).removeAlpha().png().toBuffer();
for (const out of ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'assets/icon.png']) {
  await sharp(png).toFile(new URL('../' + out, import.meta.url).pathname);
  console.log('✓', out);
}
