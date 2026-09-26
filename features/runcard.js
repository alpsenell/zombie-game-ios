import { flairText } from './season.js';

export const id = 'runcard';
export const W = 1080, H = 1350;

const CSS = `
#rc-share{display:inline-flex;align-items:center;gap:6px;margin:0 4px 12px;padding:9px 16px;border-radius:20px;border:1px solid #ffffff44;background:#ffffff14;font:900 12px var(--ui);letter-spacing:2px}
#rc-share svg{width:14px;height:14px;fill:currentColor}
#rc-share:disabled{opacity:.6}
#rc-note{display:block;min-height:0;margin:-6px 0 8px;color:var(--dim);font:600 11px var(--ui)}
#rc-note:empty{display:none}
@media (max-height:430px){#rc-share{padding:6px 12px;font-size:11px;margin-bottom:8px}}
`;

const loadImage = src => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
const DISPLAY = 'Impact, Haettenschweiler, "Arial Narrow Bold", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "SF Pro Text", sans-serif';

function spaced(cx, text, x, y, spacing) {
  if ('letterSpacing' in cx) { cx.letterSpacing = spacing + 'px'; cx.fillText(text, x + (cx.textAlign === 'center' ? spacing / 2 : 0), y); cx.letterSpacing = '0px'; return; }
  cx.fillText(text, x, y);
}
function fit(cx, text, max, size, family, weight = 900) {
  let s = size;
  do { cx.font = `${weight} ${s}px ${family}`; s -= 4; } while (cx.measureText(text).width > max && s > 20);
}
function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

export async function drawCard(cv, d) {
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  const bg = cx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1a1f'); bg.addColorStop(.55, '#050c10'); bg.addColorStop(1, '#020507');
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
  const glow = cx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 520);
  glow.addColorStop(0, '#e5483a66'); glow.addColorStop(.5, '#e5483a18'); glow.addColorStop(1, '#e5483a00');
  cx.fillStyle = glow; cx.fillRect(0, 0, W, H);
  cx.save();
  cx.globalAlpha = .07; cx.strokeStyle = '#ffffff'; cx.lineWidth = 2;
  for (let x = -H; x < W; x += 36) { cx.beginPath(); cx.moveTo(x, H); cx.lineTo(x + H, 0); cx.stroke(); }
  cx.restore();
  cx.fillStyle = '#e5483a'; cx.fillRect(0, 0, W, 14); cx.fillRect(0, H - 14, W, 14);

  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  cx.fillStyle = '#eef6f1'; cx.shadowColor = '#000'; cx.shadowBlur = 24; cx.shadowOffsetY = 6;
  cx.font = `900 124px ${DISPLAY}`;
  spaced(cx, 'LAST STAND', W / 2, 150, 4);
  cx.shadowBlur = 0; cx.shadowOffsetY = 0;
  cx.fillStyle = '#e5483a'; cx.font = `900 44px ${DISPLAY}`;
  spaced(cx, 'DEADZONE', W / 2, 206, 26);

  const px = 500, py = 240, pr = px / 2, pcx = W / 2, pcy = py + pr;
  cx.save();
  cx.beginPath(); cx.arc(pcx, pcy, pr, 0, Math.PI * 2);
  const pg = cx.createRadialGradient(pcx, pcy - 60, 30, pcx, pcy, pr);
  pg.addColorStop(0, '#2a3e46'); pg.addColorStop(1, '#0a1418');
  cx.fillStyle = pg; cx.fill();
  cx.clip();
  if (d.portrait) cx.drawImage(d.portrait, pcx - pr, pcy - pr, px, px);
  cx.restore();
  cx.lineWidth = d.frame ? 12 : 6;
  cx.strokeStyle = d.frame ? '#ffc34d' : '#ffffff44';
  if (d.frame) { cx.shadowColor = '#ffc34d'; cx.shadowBlur = 30; }
  cx.beginPath(); cx.arc(pcx, pcy, pr, 0, Math.PI * 2); cx.stroke();
  cx.shadowBlur = 0;

  const plate = d.name, ph = 58;
  cx.font = `900 30px ${UI}`;
  const pw = Math.min(W - 160, cx.measureText(plate).width + 90);
  roundRect(cx, W / 2 - pw / 2, py + px - 30, pw, ph, 29);
  cx.fillStyle = '#e5483a'; cx.fill();
  cx.fillStyle = '#fff'; cx.textBaseline = 'middle';
  spaced(cx, plate, W / 2, py + px - 30 + ph / 2 + 1, 3);
  if (d.flair) {
    cx.font = `900 22px ${UI}`;
    const fw = cx.measureText(d.flair).width + 60, fy = py - 6;
    roundRect(cx, W / 2 - fw / 2, fy, fw, 40, 10);
    cx.fillStyle = d.elite ? '#ffc34d' : '#2a3238'; cx.fill();
    cx.fillStyle = d.elite ? '#1a1206' : '#dfe9e6';
    spaced(cx, d.flair, W / 2, fy + 21, 4);
  }

  cx.textBaseline = 'alphabetic';
  cx.fillStyle = '#9aa9ab'; cx.font = `800 26px ${UI}`;
  spaced(cx, 'SCORE', W / 2, 826, 8);
  cx.fillStyle = '#ffc34d'; fit(cx, d.score, W - 120, 150, DISPLAY);
  cx.shadowColor = '#ffc34d66'; cx.shadowBlur = 30;
  spaced(cx, d.score, W / 2, 960, 3);
  cx.shadowBlur = 0;
  cx.fillStyle = '#eef6f1'; fit(cx, d.sub, W - 120, 40, UI);
  spaced(cx, d.sub, W / 2, 1014, 4);

  const cols = d.stats, bw = 300, gap = 24, x0 = (W - cols.length * bw - (cols.length - 1) * gap) / 2;
  cols.forEach(([k, v], i) => {
    const x = x0 + i * (bw + gap);
    roundRect(cx, x, 1044, bw, 116, 18);
    cx.fillStyle = '#ffffff10'; cx.fill();
    cx.fillStyle = '#eef6f1'; cx.font = `900 56px ${DISPLAY}`;
    cx.fillText(v, x + bw / 2, 1110);
    cx.fillStyle = '#9aa9ab'; cx.font = `800 20px ${UI}`;
    spaced(cx, k, x + bw / 2, 1142, 3);
  });

  if (d.rank) { cx.fillStyle = '#ffc34d'; cx.font = `900 28px ${UI}`; spaced(cx, d.rank, W / 2, 1206, 4); }
  cx.fillStyle = '#e5483a'; fit(cx, 'CAN YOU OUTLAST ME?', W - 120, 58, DISPLAY);
  spaced(cx, 'CAN YOU OUTLAST ME?', W / 2, d.rank ? 1272 : 1250, 3);
  cx.font = `800 20px ${UI}`; cx.fillStyle = '#9aa9ab';
  cx.textAlign = 'left'; spaced(cx, d.date, 60, 1322, 2);
  cx.textAlign = 'right'; spaced(cx, 'LAST STAND: DEADZONE · iOS', W - 60, 1322, 2);
  return cv;
}

export function init(api) {
  const { $, profile } = api;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  let last = null;

  const btn = document.createElement('button');
  btn.id = 'rc-share';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2l5 5-1.4 1.4L13 5.8V15h-2V5.8L8.4 8.4 7 7zM5 13h2v6h10v-6h2v8H5z"/></svg>';
  btn.append('SHARE');
  const note = document.createElement('span');
  note.id = 'rc-note';
  const box = $('#over-extras');
  box?.append(btn, note);

  api.bus.on('run:end', s => { last = { ...s, date: Date.now() }; btn.disabled = false; note.textContent = ''; });

  function cardData(s) {
    const diff = api.DIFFICULTIES[s.difficultyId] || api.diff();
    const league = profile.competitive?.league;
    const leagueName = typeof league === 'string' ? league : league?.name;
    const rank = [api.records.rank ? 'GLOBAL #' + api.records.rank.toLocaleString() : '', leagueName ? String(leagueName).toUpperCase() + ' LEAGUE' : ''].filter(Boolean).join(' · ');
    return {
      name: api.TITLES[profile.loadout.title] + ' · LV ' + api.levelInfo().level,
      flair: flairText(profile), elite: !!profile.season?.flair?.elite, frame: !!profile.season?.flair?.frame,
      score: s.score.toLocaleString(),
      sub: 'WAVE ' + s.wave + ' · ' + diff.name,
      stats: [['KILLS', s.kills.toLocaleString()], ['HEADSHOTS', s.heads.toLocaleString()], ['ACCURACY', Math.round(s.accuracy * 100) + '%']],
      rank,
      date: new Date(s.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase(),
    };
  }
  async function render(s = last) {
    const d = cardData(s);
    try {
      const url = api.preview.thumbnail({ ...profile.loadout, primary: api.loadoutWeapons()[0] }, 512);
      api.preview.show(profile.loadout);
      d.portrait = await loadImage(url);
    } catch {}
    return drawCard(document.createElement('canvas'), d);
  }
  function download(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deadzone-run.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share() {
    if (!last) return;
    btn.disabled = true;
    note.textContent = '';
    const text = 'I survived to wave ' + last.wave + ' with ' + last.score.toLocaleString() + ' points in Last Stand: Deadzone. Can you outlast me?';
    let method = null;
    try {
      const cv = await render();
      const cap = window.Capacitor;
      if (cap?.nativePromise && cap.PluginHeaders?.some(h => h.name === 'Share')) {
        const r = await cap.nativePromise('Share', 'shareImage', { base64: cv.toDataURL('image/png').split(',')[1], text });
        if (r?.completed !== false) method = 'native';
      } else {
        const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
        const file = typeof File === 'function' ? new File([blob], 'deadzone-run.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); method = 'web'; }
        else { download(blob); method = 'download'; note.textContent = 'RUN CARD SAVED'; }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') note.textContent = 'COULD NOT SHARE';
    }
    btn.disabled = false;
    if (method) { api.bus.emit('share', { kind: 'run', method }); api.haptic('LIGHT'); }
    return method;
  }
  btn.onclick = share;
  api.runCard = { render, share, drawCard, get last() { return last; } };
}
