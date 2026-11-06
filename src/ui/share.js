// Teilen und Bild speichern: Link mit Datum, Uhrzeit und Ansicht; Bild als PNG.
import './quiz.js'; // Aufbau-Reihenfolge: nach ui/quiz
import { dstInfo } from '../astro/index.js';
import { $ } from '../core/util.js';
import { fmtT, LANG, pad2, setLang, tr, tzN } from '../core/i18n.js';
import { state } from '../state.js';
import { camera, renderer, requestRender } from '../scene/renderer.js';
import { applyMode, controls, drawPanoGrid, goView, PANO, panoUniforms, VIEWS } from '../scene/camera.js';
import { MON_EN } from './readouts.js';
import { setDate } from './controls.js';
import { refreshLang } from './panels.js';
import { tour, tourEnd } from './tour.js';
import { renderFrame } from '../app.js';

/* ---------------- Teilen und Bild speichern ---------------- */

export function stateCode() {
  const p = new URLSearchParams();
  p.set('d', state.y + '-' + pad2(state.m + 1) + '-' + pad2(state.d));
  p.set('t', String(Math.round(state.minutes)));
  if (state.view) p.set('v', state.view);
  if (state.pano) p.set('p', [PANO.az, PANO.elB, PANO.kx, PANO.ky].map(v => v.toFixed(2)).join(','));
  else {
    p.set(
      'c',
      camera.position
        .toArray()
        .concat(controls.target.toArray())
        .map(v => v.toFixed(2))
        .join(','),
    );
    p.set('m', state.mode);
  }
  if (LANG === 'en') p.set('l', 'en');
  return p.toString();
}
const embedded = (() => {
  try {
    return window.top !== window;
  } catch (e) {
    return true;
  }
})();
function shareLink() {
  return location.href.split('#')[0] + '#' + stateCode();
}
export function updateShare() {
  if ($('#card-share').hidden) return;
  $('#shareUrl').value = shareLink();
  $('#shareMsg').textContent =
    embedded || location.protocol === 'file:'
      ? tr(
          'Hinweis: In dieser Vorschau oder Offline-Datei verweist der Link auf diese Kopie. Auf der Webseite der Kirche öffnet er die Ansicht direkt.',
          'Note: in this preview or offline file the link points to this copy. On the church website it opens the view directly.',
        )
      : '';
}
export function applyCode(str) {
  const q = new URLSearchParams(
    String(str || '')
      .replace(/^[^#]*#/, '')
      .replace(/^#/, ''),
  );
  if (!q.get('d')) return false;
  if (q.get('l') && q.get('l') !== LANG) {
    setLang(q.get('l') === 'en' ? 'en' : 'de');
    refreshLang();
  }
  const [y, mo, d] = q.get('d').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || mo < 1 || mo > 12 || d < 1 || d > 31)
    return false;
  if (tour.i !== null) tourEnd();
  {
    const t = q.get('t') === null || q.get('t') === '' ? NaN : +q.get('t');
    state.minutes = Number.isFinite(t) ? Math.max(0, Math.min(1439, t)) : 720;
  }
  setDate(y, mo - 1, Math.min(d, new Date(Date.UTC(y, mo, 0)).getUTCDate()));
  const v = q.get('v');
  if (v && VIEWS[v]) goView(v, true);
  if (v === 'himmel' && q.get('p')) {
    const a = q.get('p').split(',').map(Number);
    if (a.length === 4 && a.every(Number.isFinite)) {
      Object.assign(PANO, { az: a[0], elB: a[1], kx: a[2], ky: a[3] });
      panoUniforms();
    }
  } else if (q.get('c')) {
    const c = q.get('c').split(',').map(Number);
    if (c.length === 6 && c.every(isFinite)) {
      if (state.pano) {
        state.pano = false;
        controls.enabled = true;
        drawPanoGrid();
      }
      camera.position.set(c[0], c[1], c[2]);
      controls.target.set(c[3], c[4], c[5]);
      camera.lookAt(controls.target);
      const vw = v && VIEWS[v];
      applyMode(q.get('m') === 'inside' ? 'inside' : 'orbit', vw ? vw.minD : undefined, vw ? vw.walk : undefined);
      controls.update();
    }
  }
  requestRender();
  return true;
}
window.addEventListener('hashchange', () => applyCode(location.hash));
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    const i = $('#shareUrl');
    i.focus();
    i.select();
    try {
      return document.execCommand('copy');
    } catch (e2) {
      return false;
    }
  }
}
$('#copyBtn').addEventListener('click', async () => {
  const ok = await copyText($('#shareUrl').value);
  $('#shareMsg').textContent = ok
    ? tr('Link kopiert.', 'Link copied.')
    : tr('Bitte den markierten Link selbst kopieren.', 'Please copy the selected link yourself.');
});
// Teilen-Menü des Systems nur auf der Webseite: Für file:-Links bricht Chrome die Seite ab (RESULT_CODE_KILLED_BAD_MESSAGE)
if (navigator.share && /^https?:$/.test(location.protocol)) {
  $('#nativeShare').hidden = false;
  $('#nativeShare').addEventListener('click', () => {
    try {
      navigator.share({ title: document.title, url: shareLink() }).catch(() => {});
    } catch (e) {}
  });
}
window.addEventListener('hashchange', () => applyCode(location.hash)); // geteilten Link in die Adresszeile einfügen: Ansicht wechselt ohne Neuladen
document.querySelector('button[data-card="share"]').addEventListener('click', () => setTimeout(updateShare, 0));
let dlNS = null;
try {
  if (window.claude && window.claude.use)
    window.claude
      .use('downloads')
      .then(n => {
        dlNS = n;
      })
      .catch(() => {});
} catch (e) {}
const PANO_CSS =
  'line{stroke:rgba(255,255,255,.55);stroke-width:1} line.el{stroke-dasharray:3 6;stroke:rgba(255,255,255,.35)} line.hz{stroke:rgba(255,255,255,.7)} text{fill:#fff;font-family:monospace;font-size:12px;paint-order:stroke;stroke:rgba(0,0,0,.55);stroke-width:3px} .azt{text-anchor:middle} .sp{fill:none;stroke:#ffd27a;stroke-width:2} .mp{fill:none;stroke:#dfe6f2;stroke-width:1.6;stroke-dasharray:6 5} .spd{fill:#ffd27a} .mpd{fill:#dfe6f2} .spt,.mpt{text-anchor:middle;font-size:11px} .spt{fill:#ffe9b8}';
async function saveImage() {
  const msg = $('#shareMsg');
  msg.textContent = tr('Bild wird erstellt …', 'Creating image …');
  renderFrame();
  const src = renderer.domElement,
    W = src.width,
    H = src.height,
    pr = renderer.getPixelRatio(),
    bar = Math.round(40 * pr);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H + bar;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0); // direkt nach dem Zeichnen kopieren
  if (state.pano) {
    try {
      const svg = $('#panoGrid').cloneNode(true);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      st.textContent = PANO_CSS;
      svg.insertBefore(st, svg.firstChild);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await img.decode();
      g.drawImage(img, 0, 0, W, H);
    } catch (e) {}
  }
  const di = dstInfo(state.y, state.m, state.d, state.minutes),
    tzName = tzN(di.off);
  const dateTxt =
    LANG === 'en'
      ? state.d + ' ' + MON_EN[state.m] + ' ' + state.y
      : pad2(state.d) + '.' + pad2(state.m + 1) + '.' + state.y;
  g.fillStyle = '#f5f6f3';
  g.fillRect(0, H, W, bar);
  g.fillStyle = '#1e1a17';
  g.font = '700 ' + Math.round(17 * pr) + 'px Georgia, serif';
  g.textBaseline = 'middle';
  g.fillText(
    tr('St. Marien zu Lübeck – Licht und Schatten', "St. Mary's, Lübeck – Light and Shadow"),
    Math.round(14 * pr),
    H + bar / 2,
  );
  g.font = Math.round(14 * pr) + 'px "IBM Plex Mono", monospace';
  g.textAlign = 'right';
  g.fillStyle = '#5e5852';
  g.fillText(
    dateTxt + ' · ' + fmtT(di.loc) + ' ' + tzName + ' · ' + $('#viewTxt').textContent,
    W - Math.round(14 * pr),
    H + bar / 2,
  );
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob) {
    msg.textContent = tr('Das Bild konnte nicht erstellt werden.', 'The image could not be created.');
    return;
  }
  const name =
    'St-Marien_' +
    state.y +
    '-' +
    pad2(state.m + 1) +
    '-' +
    pad2(state.d) +
    '_' +
    fmtT(state.minutes).replace(':', '') +
    '.png';
  if (dlNS) {
    try {
      await dlNS.save({ filename: name, data: blob });
      msg.textContent = tr('Bild gespeichert.', 'Image saved.');
    } catch (e) {
      msg.textContent =
        e && e.code === 'declined'
          ? tr('Speichern abgebrochen.', 'Saving cancelled.')
          : tr('Speichern ist hier nicht möglich.', 'Saving is not possible here.');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  msg.textContent = tr('Bild gespeichert.', 'Image saved.');
}
$('#saveImg').addEventListener('click', () => {
  saveImage().catch(() => {
    $('#shareMsg').textContent = tr('Das Bild konnte nicht erstellt werden.', 'The image could not be created.');
  });
});
