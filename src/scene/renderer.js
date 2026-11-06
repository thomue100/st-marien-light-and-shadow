// Renderer, Szene, Kamera-Objekt, Schnittebene; Merker „neu zeichnen“.
import '../state.js'; // Aufbau-Reihenfolge: nach state
import { V3 } from '../three-global.js';
import { ldDone, step } from '../core/loader.js';
import { $ } from '../core/util.js';
import { tr } from '../core/i18n.js';
import { stateCode } from '../ui/share.js';

if (!window.THREE || !THREE.OrbitControls) {
  ldDone();
  document.getElementById('stage').innerHTML =
    '<div class="err">' +
    tr(
      'Die 3D-Bibliothek konnte nicht geladen werden. Bitte Seite neu laden.',
      'The 3D library could not be loaded. Please reload the page.',
    ) +
    '</div>';
  throw new Error('St. Marien: 3D-Bibliothek fehlt');
}
await step(tr('Texturen und Glasmalereien', 'Textures and stained glass'), 12);
/* ---------------- Renderer ---------------- */

export const stage = $('#stage');
export const coarse = matchMedia('(pointer:coarse)').matches;
export const lowEnd = coarse && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4); // ältere Handys: weniger Pixel, kleinere Schatten- und Umgebungstexturen
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  ldDone();
  stage.innerHTML =
    '<div class="err">' +
    tr('WebGL ist in diesem Browser nicht verfügbar.', 'WebGL is not available in this browser.') +
    '</div>';
  throw new Error('St. Marien: WebGL nicht verfügbar', { cause: e });
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : coarse ? 1.5 : 2)); // Handy: weniger Pixel, flüssiger
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Handy im Hintergrund o. Ä.: Browser entzieht den Grafikspeicher. Statt schwarzer Fläche Hinweis und Neuladen mit der aktuellen Ansicht
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  if (document.getElementById('glLost')) return;
  const d = document.createElement('div');
  d.id = 'glLost';
  d.className = 'err';
  d.innerHTML =
    '<div><p>' +
    tr(
      'Der Browser hat die 3D-Darstellung unterbrochen (z. B. weil die Seite im Hintergrund war).',
      'The browser interrupted the 3D view (for example because the page was in the background).',
    ) +
    '</p><button class="btn" id="glReload">' +
    tr('Neu laden', 'Reload') +
    '</button></div>';
  document.getElementById('stage').appendChild(d);
  document.getElementById('glReload').addEventListener('click', () => {
    try {
      history.replaceState(null, '', '#' + stateCode());
    } catch (x) {}
    location.reload();
  });
});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.localClippingEnabled = true;
stage.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb6cfe6, 350, 1700);
export const camera = new THREE.PerspectiveCamera(55, 1, 0.2, 5000);
export const cutPlane = new THREE.Plane(new V3(0, -1, 0), 200);
export const maxAniso = renderer.capabilities.getMaxAnisotropy();
// Bild neu zeichnen, sobald sich etwas geändert hat (die Render-Schleife in app.js fragt den Merker ab)
let dirty = true;
export function requestRender() {
  dirty = true;
}
export function takeDirty() {
  const d = dirty;
  dirty = false;
  return d;
}
