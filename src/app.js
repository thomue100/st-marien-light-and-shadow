// St. Marien – Licht und Schatten: Render-Schleife und Start.
//
// Das Programm ist auf Module verteilt (src/core, src/model, src/scene, src/light, src/ui). Sie bauen sich in einer festen
// Reihenfolge auf – derselben wie früher in einer einzigen großen Datei: Jedes Modul importiert als Erstes seinen Vorgänger,
// app.js als Erstes das letzte Modul (ui/share.js). Module dürfen sich gegenseitig importieren; eine Variable eines anderen
// Moduls neu zuweisen geht aber nicht – dafür gibt es Setter wie setLang() oder requestRender(). Siehe README, „Aufbau-Reihenfolge“.
// Reihenfolge: core/loader → core/util → core/i18n → core/prefs → model/measures → state → scene/renderer → scene/textures → scene/shaders → scene/materials → model/geometry → model/church → model/clock → model/environment → model/sundial → light/sky → light/windows → light/sun → scene/camera → scene/labels → ui/readouts → ui/controls → ui/year → ui/panels → ui/clockcard → ui/tour → ui/moontowers → ui/experiments → ui/quiz → ui/share → app.
import { applyCode } from './ui/share.js'; // Aufbau-Reihenfolge: nach ui/share
import { berlinNow, localToUtc, sunPos } from './astro/index.js';
import { ldBar, ldDone, ldT0, step } from './core/loader.js';
import { $, lsGet } from './core/util.js';
import { fmtDeg, pad2, tr } from './core/i18n.js';
import { AXIS_MEASURED } from './model/measures.js';
import { cur, state } from './state.js';
import { camera, renderer, requestRender, scene, stage, takeDirty } from './scene/renderer.js';
import { clk, clockUpdate } from './model/clock.js';
import { applyEnv } from './model/environment.js';
import { sdDrawPlate, sdOrient } from './model/sundial.js';
import { pathGroup, placeMoon, placeMoonAt, sky, skyMat, stars } from './light/sky.js';
import { eclObsc, moonStr, updateSun, useMoon } from './light/sun.js';
import {
  busyHide,
  busyState,
  clampWalk,
  controls,
  cubeCam,
  goView,
  joy,
  joyMove,
  keyMove,
  keys,
  panoCam,
  panoMarks,
  panoScene,
  panoUniforms,
  stepTween,
  tween,
} from './scene/camera.js';
import { placeLabels } from './scene/labels.js';
import { chart, CHW, computeDay, drawChart, updateReadouts } from './ui/readouts.js';
import { setAmb, setCut, setExp } from './ui/controls.js';
import { yearTick, yr } from './ui/year.js';
import { showTour, tour } from './ui/tour.js';
import { MZT } from './ui/moontowers.js';
import { LK, setExpReady } from './ui/experiments.js';

/* ---------------- Größe & Render-Schleife ---------------- */

function resize() {
  const w = stage.clientWidth || innerWidth,
    h = stage.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => {
  if (state.pano) {
    panoUniforms();
    requestRender();
  }
}).observe(stage);
new ResizeObserver(() => {
  const tb = document.querySelector('.timebar');
  document.documentElement.style.setProperty('--tbh', Math.ceil(tb.offsetHeight) + 'px');
}).observe(document.querySelector('.timebar')); // Karten und Hinweise sitzen über der Zeitleiste
new ResizeObserver(() => {
  if (Math.abs((chart.clientWidth || 0) - CHW) > 2) {
    drawChart();
    updateReadouts();
  }
}).observe(chart);
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  if (MZT.busy || LK.busy) {
    last = now;
    return;
  } // während der Terminsuche nicht zeichnen
  const dt = Math.min(0.06, (now - last) / 1000);
  last = now;
  if (state.playing && yr.on) yearTick(dt);
  else if (state.playing) {
    const fast = cur.el < -4 && !(useMoon && moonStr > 0.05) ? 6 : 1;
    let m = state.minutes + state.speed * dt * fast;
    if (m >= 1440) m -= 1440;
    state.minutes = m;
    updateSun();
    if (state.pano) panoMarks();
  }
  if (tween) stepTween(now);
  if (clk.pending && now - clk.lastDraw >= 70) clockUpdate(null);
  if (keys.size) keyMove(dt);
  if (joy.id !== null) joyMove(dt);
  if (!tween && controls.update()) {
    requestRender();
    if (state.walk) clampWalk();
    if (state.mode === 'orbit' && camera.position.y < 1.5) {
      camera.position.y = 1.5;
      camera.lookAt(controls.target);
    }
  }
  if (takeDirty()) renderFrame();
}
export function renderFrame() {
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  pathGroup.position.copy(camera.position);
  if (state.pano) {
    placeMoonAt();
    pathGroup.visible = false;
    cubeCam.position.copy(camera.position);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true; // Schatten nur einmal je Bild
    cubeCam.update(renderer, scene);
    renderer.shadowMap.autoUpdate = true;
    renderer.render(panoScene, panoCam);
    pathGroup.visible = true;
    if (busyState.hideOnPano) {
      busyState.hideOnPano = false;
      requestAnimationFrame(busyHide);
    }
  } else {
    const ev = state.view === 'finsternis';
    pathGroup.visible = !ev;
    skyMat.uniforms.uGlow.value = (1 - eclObsc) * (ev ? 0.3 : 1);
    placeMoon();
    renderer.render(scene, camera);
    placeLabels();
  }
}

await step(tr('Sonnenstand und Verschattung werden berechnet', 'Computing sun position and shading'), 84);
/* ---------------- Start ---------------- */
const n0 = berlinNow();
state.y = n0.y;
state.m = n0.m;
state.d = n0.d;
$('#date').value = n0.y + '-' + pad2(n0.m + 1) + '-' + pad2(n0.d);
{
  const s = sunPos(localToUtc(n0.y, n0.m, n0.d, n0.minutes));
  state.minutes = s.el > 3 ? n0.minutes : 12 * 60 + 30;
}
$('#speed').value = '30';
setAmb(0.3);
setExp(1.0);
state.axis = AXIS_MEASURED;
$('#axis').value = AXIS_MEASURED;
$('#axisOut').textContent = fmtDeg(AXIS_MEASURED);
applyEnv();
setCut(60);
sdOrient();
sdDrawPlate();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sdDrawPlate());
resize();
computeDay();
updateSun(true);
goView('sued', true);
const fromLink = applyCode(location.hash);
await step(tr('Darstellung wird vorbereitet', 'Preparing the display'), 94);
setExpReady(true);
stars.position.copy(camera.position);
pathGroup.position.copy(camera.position);
placeMoon();
renderer.compile(scene, camera);
renderer.render(scene, camera);
placeLabels(); // Shader übersetzen und Texturen hochladen, solange die Anzeige steht
requestAnimationFrame(loop);
requestAnimationFrame(() => {
  if (ldBar) ldBar.style.width = '100%';
  ldDone();
  if (!fromLink && lsGet('stm-welcomed') !== '1') {
    tour.i = -1;
    showTour();
  }
  console.log('[St. Marien] Aufbau in', Math.round(performance.now() - ldT0), 'ms');
});
