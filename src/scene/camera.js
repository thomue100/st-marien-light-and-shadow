// Kamera und Steuerung: Ansichten, Wechsel zwischen ihnen, Himmelsansicht, Gehen, Tastatur.
import { moonCur } from '../light/sun.js'; // Aufbau-Reihenfolge: nach light/sun
import { localToUtc, moonPos, rad, sunPos } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { $, clamp01 } from '../core/util.js';
import { LANG, tr } from '../core/i18n.js';
import { HR } from '../model/measures.js';
import { cur, state, sunVec } from '../state.js';
import { camera, coarse, lowEnd, renderer, requestRender, scene } from './renderer.js';
import { CLK } from '../model/clock.js';
import { SD, sdX, sdZ } from '../model/sundial.js';
import { envGroup, envH, envHeightAt, farBuildings } from '../model/environment.js';
import { occluders } from '../model/geometry.js';
import { curMoonPass, hourOf, setMoonMag } from '../light/sky.js';
import { updateLabelsVisibility } from './labels.js';
import { setCut, setExp } from '../ui/controls.js';

/* ---------------- Kamera & Steuerung ---------------- */

export const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableKeys = false;
controls.dampingFactor = 0.09;
controls.screenSpacePanning = false;
export let tween = null;
controls.addEventListener('change', () => {
  requestRender();
});
const DR_EYE = HR + 2.4 + 1.65; // Augenhöhe in der Laterne des Dachreiters (Galerieboden 52,0 m, 2,4 m über dem First, nach Fotos)
export const VIEWS = {
  aussen: { pos: [128, 74, 152], tgt: [2, 24, 0], mode: 'orbit', cut: 60, exp: 0.85 },
  westseite: { pos: [-165, 52, 0], tgt: [-50, 70, 0], mode: 'orbit', cut: 60, exp: 0.85 },
  sued: { pos: [-92, 60, 150], tgt: [-4, 40, 0], mode: 'orbit', cut: 60, exp: 0.85 }, // etwa vom Petriturm
  chorost: { pos: [150, 118, 6], tgt: [-6, 34, 0], mode: 'orbit', cut: 60, exp: 0.85 },
  nord: { pos: [75, 120, -150], tgt: [-6, 30, 0], mode: 'orbit', cut: 60, exp: 0.85 },
  tuermeost: { pos: [-2, 57, 0.5], tgt: [-44, 73, 0], mode: 'orbit', cut: 60, exp: 0.85, minD: 1 },
  luft: { pos: [-120, 190, 150], tgt: [-4, 20, 0], mode: 'orbit', cut: 60, exp: 0.85 },
  insel: { pos: [-520, 430, 1030], tgt: [170, -5, -40], mode: 'orbit', cut: 60, exp: 0.85 }, // ganze Altstadtinsel von Südwesten
  himmel: { pos: [0, 140, -170], dir: [0, 0, 1], mode: 'pano', cut: 60, exp: 1.0 },
  // Blick zur Sonne / zum Mond: Standpunkt und Blickziel berechnet bodyView() bei jedem Aufruf neu
  zurSonne: { pos: [-154, 20, 0], tgt: [-4, 47, 0], mode: 'orbit', cut: 60, exp: 0.85, tilt: true },
  zumMond: { pos: [-154, 20, 0], tgt: [-4, 47, 0], mode: 'orbit', cut: 60, exp: 0.85, tilt: true },
  dachreiter: {
    pos: [10.72, DR_EYE, 0.0],
    dir: [-1, 0.1, 0],
    mode: 'inside',
    cut: 60,
    exp: 0.85,
    walk: { cx: 11.9, cz: 0, rMin: 0.62, rMax: 1.28, y: DR_EYE },
  },
  puppe: { pos: [48, 92, 86], tgt: [2, 0, 2], mode: 'orbit', cut: 13.5, exp: 1.0 },
  schiff: { pos: [-46, 1.7, 0], dir: [1, 0.2, 0], mode: 'inside', cut: 60, exp: 1.8 },
  chor: { pos: [21, 1.7, 0], dir: [1, 0.2, 0], mode: 'inside', cut: 60, exp: 1.8 },
  westen: { pos: [22, 1.7, 0], dir: [-1, 0.3, 0], mode: 'inside', cut: 60, exp: 1.8 },
  brief: { pos: [-23.9, 1.6, 24.6], dir: [-1, 0.62, -0.1], mode: 'inside', cut: 60, exp: 1.8, fov: 72 },
  totentanz: { pos: [8.2, 1.6, -18.1], dir: [0, 0.47, -1], mode: 'inside', cut: 60, exp: 1.8, fov: 80 },
  totenkopf: { pos: [6.2, 1.7, -17.2], dir: [-0.13, 0.27, -1], mode: 'inside', cut: 60, exp: 1.8, fov: 62 }, // Quiz-Tipp: Nordportal mit Lüpertz-Oberlicht, auch im Hochformat
  uhr: { pos: [2.5, 1.6, CLK.z], tgt: [CLK.x, 6.1, CLK.z], mode: 'orbit', cut: 60, exp: 1.8, minD: 0.8 },
  uhrblatt: {
    pos: [CLK.x - 4.2, CLK.dialY - 0.4, CLK.z + 0.4],
    tgt: [CLK.x, CLK.dialY, CLK.z],
    mode: 'orbit',
    cut: 60,
    exp: 1.8,
    minD: 0.6,
  },
  uhrkalender: {
    pos: [CLK.x - 4.0, CLK.calY + 0.5, CLK.z - 0.4],
    tgt: [CLK.x, CLK.calY, CLK.z],
    mode: 'orbit',
    cut: 60,
    exp: 1.8,
    minD: 0.6,
  },
  gedenk: { pos: [-39.2, 1.7, 14.1], dir: [-1, 1.05, 0], mode: 'inside', cut: 60, exp: 1.8 },
  gewoelbe: { pos: [-14, 1.7, 0], dir: [0.32, 1.6, 0], mode: 'inside', cut: 60, exp: 1.6 },
  sonnenuhr: {
    pos: [sdX + 1.2, SD.y - 0.9, sdZ + 3.4],
    mob: [sdX + 0.75, SD.y - 0.5, sdZ + 2.2],
    tgt: [sdX, SD.y, sdZ],
    mode: 'orbit',
    cut: 60,
    exp: 0.85,
    minD: 0.6,
  },
};
export function hintFor() {
  if (state.pano)
    return coarse
      ? tr(
          'Ein Finger: Himmel drehen und kippen · zwei Finger: zoomen',
          'One finger: turn and tilt the sky · two fingers: zoom',
        )
      : tr(
          'Ziehen: Himmel drehen und kippen · Mausrad: Ausschnitt vergrößern oder verkleinern',
          'Drag: turn and tilt the sky · Wheel: zoom in or out',
        );
  if (state.mode === 'orbit' && coarse)
    return tr(
      'Ein Finger: drehen · zwei Finger: verschieben und zoomen',
      'One finger: rotate · two fingers: pan and zoom',
    );
  if (state.mode === 'orbit')
    return tr(
      'Ziehen: drehen · Rechtsklick oder zwei Finger: verschieben · Mausrad: zoomen · WASD: gehen',
      'Drag: rotate · Right-click or two fingers: pan · Wheel: zoom · WASD: move',
    );
  if (state.walk)
    return tr(
      'Ziehen: umsehen · W/A/S/D, Pfeiltasten oder Mausrad: in der Laterne umhergehen',
      'Drag: look around · W/A/S/D, arrow keys or wheel: walk around the lantern',
    );
  if (coarse)
    return tr('Ziehen: umsehen · Steuerkreis unten links: gehen', 'Drag: look around · Pad at bottom left: walk');
  return tr(
    'Ziehen: umsehen · Mausrad oder W/S: vorwärts, rückwärts · A/D: seitlich · Q/E: hoch, runter',
    'Drag: look around · Wheel or W/S: forward, back · A/D: sideways · Q/E: up, down',
  );
}
export function applyMode(mode, minD, walk) {
  state.mode = mode;
  state.walk = walk || null;
  state.skyView = false;
  if (mode === 'orbit') {
    Object.assign(controls, {
      enableZoom: true,
      minDistance: minD || 5,
      maxDistance: state.view === 'mtTop' ? 20000 : state.view === 'insel' ? 2400 : 800,
      minPolarAngle: 0.03,
      maxPolarAngle: VIEWS[state.view] && VIEWS[state.view].tilt ? Math.PI * 0.75 : Math.PI * 0.62, // tilt: steiler nach oben
      rotateSpeed: 0.55,
      panSpeed: 1,
    });
  } else {
    Object.assign(controls, {
      enableZoom: false,
      minDistance: 0.05,
      maxDistance: 20,
      minPolarAngle: 0.06 * Math.PI,
      maxPolarAngle: 0.94 * Math.PI,
      rotateSpeed: -0.38,
      panSpeed: 0.7,
    });
  }
  $('#hint').textContent = hintFor();
  if (state.skyView) {
    $('#hint').classList.remove('gone');
    setTimeout(() => $('#hint').classList.add('gone'), 7000);
  }
  if (walk) {
    controls.enablePan = false;
    $('#hint').classList.remove('gone');
    setTimeout(() => $('#hint').classList.add('gone'), 7000);
  } else controls.enablePan = true;
  updateLabelsVisibility();
  joyShow();
}
// Himmelsansicht als Panorama: Die Szene wird in eine Würfelkarte gerendert und in Zylinderprojektion gezeigt
// (Azimut waagerecht, Höhe senkrecht, beide linear). So bleiben die Bahnen von Sonne und Mond auch über 180° und mehr
// als natürliche Bögen sichtbar. Standpunkt: 140 m hoch, 170 m von der Kirche entfernt auf der den Bahnen abgewandten Seite,
// damit die Kirche unten im Bild liegt und nichts den Himmel verdeckt.
const cubeRT = new THREE.WebGLCubeRenderTarget(lowEnd ? 512 : coarse ? 768 : 1280, {
  type: THREE.HalfFloatType,
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
export const cubeCam = new THREE.CubeCamera(0.5, 6000, cubeRT);
const panoMat = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
  uniforms: {
    uCube: { value: cubeRT.texture },
    uAz: { value: 180 },
    uElB: { value: -30 },
    uKx: { value: 6 },
    uKy: { value: 6 },
    uYB: { value: 0 },
    uW: { value: 1000 },
    uAxis: { value: 98.5 },
  },
  vertexShader: 'void main(){ gl_Position=vec4(position.xy,0.0,1.0); }',
  fragmentShader: `uniform samplerCube uCube; uniform float uAz,uElB,uKx,uKy,uYB,uW,uAxis;
  void main(){ float az=radians(uAz+(gl_FragCoord.x-0.5*uW)/uKx), el=radians(clamp(uElB+(gl_FragCoord.y-uYB)/uKy,-89.9,89.9)), b=radians(uAxis);
    float E=cos(el)*sin(az), N=cos(el)*cos(az), U=sin(el);
    vec3 d=vec3(E*sin(b)+N*cos(b),U,E*cos(b)-N*sin(b));
    gl_FragColor=vec4(textureCube(uCube,d).rgb,1.0);
    #include <encodings_fragment>
  }`,
});
export const panoScene = new THREE.Scene(),
  panoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
{
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), panoMat);
  q.frustumCulled = false;
  panoScene.add(q);
}
export const PANO = { az: 180, elB: -38, kx: 6, ky: 6 };
function panoGeom() {
  const r = renderer.domElement.getBoundingClientRect();
  const tb = document.querySelector('.timebar');
  return { W: r.width, H: r.height, yb: tb ? tb.offsetHeight + 22 : 120, top: 64 };
}
function fitSky() {
  const pts = [];
  const add = pos => {
    for (let mi = 0; mi <= 1440; mi += 10) {
      const s = pos(localToUtc(state.y, state.m, state.d, mi));
      if (s.el > -0.5) pts.push(s);
    }
  };
  if (state.sunPath) add(sunPos);
  if (state.moon && state.moonPath) add(moonPos);
  if (!pts.length) add(sunPos);
  if (!pts.length) pts.push({ el: 20, az: 180 });
  let sx = 0,
    sy = 0;
  for (const p of pts) {
    sx += Math.sin(p.az * rad);
    sy += Math.cos(p.az * rad);
  }
  const azc = (Math.atan2(sx, sy) / rad + 360) % 360;
  let dmax = 0,
    emax = 0;
  for (const p of pts) {
    dmax = Math.max(dmax, Math.abs(((p.az - azc + 540) % 360) - 180));
    emax = Math.max(emax, p.el);
  }
  const g = panoGeom(),
    Wp = g.W,
    Hp = Math.max(120, g.H - g.yb - g.top);
  let spanX = Math.min(360, Math.max(110, 2 * dmax + 36));
  const elB = -38;
  let spanY = Math.min(90 - elB, Math.max(70, emax + 12 - elB));
  let kx = Wp / spanX,
    ky = Hp / spanY;
  if (kx > 1.6 * ky) {
    spanX = Math.min(360, Wp / (1.6 * ky));
    kx = Wp / spanX;
  } // Verzerrung begrenzen: lieber mehr Umgebung zeigen
  const kmax = Hp > Wp ? 2.6 : 1.6;
  if (ky > kmax * kx) {
    ky = kmax * kx;
  } // Hochformat: Höhen etwas strecken, damit der Himmel genutzt wird
  Object.assign(PANO, { az: azc, elB, kx, ky });
  const hz = sunVec(0, azc, new V3());
  hz.y = 0;
  hz.normalize();
  VIEWS.himmel.pos = [-hz.x * 170 + 2, 140, -hz.z * 170];
}
export function panoUniforms() {
  const g = panoGeom(),
    pr = renderer.getPixelRatio(),
    u = panoMat.uniforms;
  u.uAz.value = PANO.az;
  u.uElB.value = PANO.elB;
  u.uKx.value = PANO.kx * pr;
  u.uKy.value = PANO.ky * pr;
  u.uYB.value = g.yb * pr;
  u.uW.value = g.W * pr;
  u.uAxis.value = state.axis;
  drawPanoGrid();
}
// Himmelsrichtungen und Höhenlinien als Overlay
export function drawPanoGrid() {
  const svg = $('#panoGrid');
  $('#panoNote').hidden = !state.pano;
  if (!state.pano) {
    svg.setAttribute('hidden', '');
    return;
  }
  svg.removeAttribute('hidden');
  const g = panoGeom(),
    X = az => g.W / 2 + (((az - PANO.az + 540) % 360) - 180) * PANO.kx,
    Y = el => g.H - g.yb - (el - PANO.elB) * PANO.ky;
  svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
  let s = '';
  for (const el of [0, 30, 60]) {
    const y = Y(el);
    if (y < 0 || y > g.H) continue;
    s +=
      '<line class="' +
      (el ? 'el' : 'hz') +
      '" x1="0" x2="' +
      g.W +
      '" y1="' +
      y +
      '" y2="' +
      y +
      '"/>' +
      (el ? '<text class="elt" x="8" y="' + (y - 4) + '">' + el + '°</text>' : '');
  }
  const names =
    LANG === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  for (let k = 0; k < 8; k++) {
    const az = k * 45;
    for (const off of [-360, 0, 360]) {
      const x = g.W / 2 + (az + off - PANO.az) * PANO.kx;
      if (x < -20 || x > g.W + 20) continue;
      s +=
        '<line class="tick" x1="' +
        x +
        '" x2="' +
        x +
        '" y1="' +
        (Y(0) - 6) +
        '" y2="' +
        (Y(0) + 6) +
        '"/><text class="azt" x="' +
        x +
        '" y="' +
        (Y(0) + 20) +
        '">' +
        names[k] +
        '</text>';
    }
  }
  // Bahnen von Sonne und Mond als scharfe Linien mit Stundenmarken (im Panorama statt der 3D-Linien)
  const arc = (pos, cls, t0, t1) => {
    let pts = [],
      out = '';
    const flush = () => {
      if (pts.length > 1)
        out +=
          (cls === 'mp' ? '<polyline class="mpu" points="' + pts.join(' ') + '"/>' : '') +
          '<polyline class="' +
          cls +
          '" points="' +
          pts.join(' ') +
          '"/>';
      pts = [];
    };
    let lastX = null;
    for (let t = t0; t <= t1 + 1; t += 240000) {
      const p = pos(Math.min(t, t1));
      if (p.el < -0.5) {
        flush();
        lastX = null;
        continue;
      }
      const x = X(p.az),
        y = Y(p.el);
      if (lastX !== null && Math.abs(x - lastX) > g.W * 0.5) {
        flush();
      }
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      lastX = x;
    }
    flush();
    for (let u = Math.ceil(t0 / 3600000) * 3600000; u < t1; u += 3600000) {
      const hh = hourOf(u),
        p = pos(u);
      if (p.el < 1) continue;
      const x = X(p.az),
        y = Y(p.el);
      out +=
        '<circle class="' +
        cls +
        'd" cx="' +
        x.toFixed(1) +
        '" cy="' +
        y.toFixed(1) +
        '" r="2.6"/><text class="' +
        cls +
        't" x="' +
        x.toFixed(1) +
        '" y="' +
        (y - 8).toFixed(1) +
        '">' +
        hh +
        '</text>';
    }
    return out;
  };
  if (state.sunPath)
    s += arc(sunPos, 'sp', localToUtc(state.y, state.m, state.d, 0), localToUtc(state.y, state.m, state.d, 1440) - 1);
  if (state.moon && state.moonPath) {
    const mp = curMoonPass();
    if (mp) s += arc(moonPos, 'mp', mp.t0, mp.t1);
  }
  svg.innerHTML = s + '<g id="pmk"></g>';
  panoMarks();
}
// Markierung des Mondes am Himmel: Ring mit Beschriftung (am Taghimmel ist die Scheibe sonst kaum zu sehen)
export function panoMarks() {
  const gEl = document.getElementById('pmk');
  if (!gEl || !state.pano) return;
  let s = '';
  const g = panoGeom(),
    X = az => g.W / 2 + (((az - PANO.az + 540) % 360) - 180) * PANO.kx,
    Y = el => g.H - g.yb - (el - PANO.elB) * PANO.ky;
  if (state.moon && moonCur && moonCur.el > -0.5) {
    const x = X(moonCur.az),
      y = Y(moonCur.el),
      r = 14;
    s +=
      '<circle class="mku" cx="' +
      x.toFixed(1) +
      '" cy="' +
      y.toFixed(1) +
      '" r="' +
      r +
      '"/><circle class="mk" cx="' +
      x.toFixed(1) +
      '" cy="' +
      y.toFixed(1) +
      '" r="' +
      r +
      '"/>' +
      '<text class="mpt mkt" x="' +
      (x + r + 6).toFixed(1) +
      '" y="' +
      (y + 4).toFixed(1) +
      '" style="text-anchor:start">' +
      tr('Mond ', 'Moon ') +
      Math.round(moonCur.k * 100) +
      ' %</text>';
  }
  gEl.innerHTML = s;
}
// Himmelsansicht: ein Finger bzw. die Maus zieht den Ausschnitt, zwei Finger zoomen (spreizen/zusammenziehen)
let panoDrag = null,
  panoPinch = null;
const panoPts = new Map();
const pinchDist = () => {
  const [a, b] = [...panoPts.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
renderer.domElement.addEventListener('pointerdown', e => {
  if (!state.pano) return;
  panoPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  renderer.domElement.setPointerCapture(e.pointerId);
  if (panoPts.size === 2) {
    panoDrag = null;
    panoPinch = pinchDist();
  } else if (panoPts.size === 1) panoDrag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!state.pano || !panoPts.has(e.pointerId)) return;
  panoPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (panoPinch && panoPts.size === 2) {
    const d = pinchDist();
    if (d > 0 && panoPinch > 0) panoZoom(d / panoPinch);
    panoPinch = d;
    return;
  }
  if (!panoDrag) return;
  const dx = e.clientX - panoDrag.x,
    dy = e.clientY - panoDrag.y;
  panoDrag = { x: e.clientX, y: e.clientY };
  PANO.az = (PANO.az - dx / PANO.kx + 360) % 360;
  PANO.elB = Math.max(-70, Math.min(20, PANO.elB + dy / PANO.ky));
  panoUniforms();
  requestRender();
});
const panoUp = e => {
  panoPts.delete(e.pointerId);
  if (panoPts.size < 2) panoPinch = null;
  // nach dem Zoomen mit dem verbliebenen Finger nahtlos weiterziehen
  const rest = [...panoPts.values()][0];
  panoDrag = rest ? { x: rest.x, y: rest.y } : null;
};
renderer.domElement.addEventListener('pointerup', panoUp);
renderer.domElement.addEventListener('pointercancel', panoUp);
function panoZoom(f) {
  const g = panoGeom();
  PANO.kx = Math.max(g.W / 360, Math.min(40, PANO.kx * f));
  PANO.ky = Math.max(1, Math.min(40, PANO.ky * f));
  panoUniforms();
  requestRender();
}
// Blick zur Sonne / zum Mond (wie „Objekt zentrieren“ in Planetariumsprogrammen): Die Kamera fährt auf die dem
// Himmelskörper abgewandte Seite der Kirche, etwas über die Dächer, und blickt in seine Richtung. Die Kirche steht dann im
// unteren Bildteil, Sonne oder Mond mit ihrer Bahn darüber. Steht der Himmelskörper hoch, blickt die Kamera steiler nach
// oben und der Bildwinkel wird größer (bis 75°), damit Kirche und Himmelskörper zwischen Titelleiste und Zeitleiste passen;
// dafür lässt die Steuerung in diesen Ansichten mehr Neigung zu (tilt).
const BODY_C = new V3(-4, 0, 0), // Mitte der Kirche am Boden
  BODY_Q = new V3(-20, 50, 0); // Punkt über dem Dach, der vom Standpunkt aus frei sichtbar sein soll
export const BODY_VIEWS = ['zurSonne', 'zumMond'];
export function bodyViewName(name) {
  return name === 'zurSonne'
    ? tr('Blick zur Sonne', 'Looking at the sun')
    : name === 'zumMond'
      ? tr('Blick zum Mond', 'Looking at the moon')
      : null;
}
function bodyEl(name) {
  return name === 'zumMond' ? (moonCur ? moonCur.el : -90) : cur.el;
}
/** Steht der Standpunkt frei über den Dächern, und ist der Punkt über dem Kirchendach von dort aus zu sehen? */
function clearSight(p) {
  if (!state.env || !envH) return true;
  for (let dx = -4; dx <= 4; dx += 4)
    for (let dz = -4; dz <= 4; dz += 4) if (envHeightAt(p.x + dx, p.z + dz) > p.y - 3) return false;
  const d = BODY_Q.clone().sub(p),
    n = Math.ceil(d.length() / 2);
  for (let i = 1; i < n; i++) {
    const x = p.x + (d.x * i) / n,
      y = p.y + (d.y * i) / n,
      z = p.z + (d.z * i) / n;
    if (Math.abs(x - BODY_C.x) < 56 && Math.abs(z) < 34) break; // an der Kirche angekommen
    if (envHeightAt(x, z) > y - 0.5) return false;
  }
  return true;
}
const bodyRay = new THREE.Raycaster();
/** Ist der Himmelskörper vom Standpunkt aus frei zu sehen, mit 2,5° Abstand zu Kirche und Häusern? */
function bodyFree(p, el, az) {
  const objs = envGroup.visible ? occluders.concat(envGroup.children.filter(m => !m.userData.far)) : occluders,
    d = new V3();
  bodyRay.far = 3000;
  for (const [e, a] of [
    [el, az],
    [Math.max(0.3, el - 2.5), az],
    [el, az - 2.5],
    [el, az + 2.5],
  ]) {
    bodyRay.set(p, sunVec(e, a, d));
    if (bodyRay.intersectObjects(objs, false).length) return false;
  }
  return true;
}
function bodyView(name) {
  const moon = name === 'zumMond',
    el = bodyEl(name),
    az = moon ? (moonCur ? moonCur.az : 180) : cur.az;
  const h = sunVec(0, az, new V3());
  h.y = 0;
  h.normalize();
  // Bildwinkel und Höhe der Bildmitte: unten (über der Zeitleiste) die Kirche ab etwa Dachhöhe, oben (unter der
  // Titelleiste) der Himmelskörper mit etwas Rand
  const W0 = renderer.domElement.clientWidth || innerWidth,
    H0 = renderer.domElement.clientHeight || innerHeight,
    tb = document.querySelector('.timebar'),
    br = document.querySelector('.brand'),
    ub = Math.min(0.35, tb ? tb.offsetHeight / H0 : 0.15),
    ut = Math.min(0.2, br ? br.getBoundingClientRect().bottom / H0 : 0.08),
    lo = Math.max(-8, Math.min(2, el - 30)),
    hi = Math.max(el, 0) + 6,
    fov = Math.max(55, Math.min(75, (hi - lo) / (1 - ub - ut))),
    c = Math.min(40, Math.max(lo + fov / 2 - ub * fov, hi - fov / 2 + ut * fov));
  // Standpunkt: gegenüber dem Himmelskörper, über den Dächern. Stünde er dann hinter Türmen oder Dach (tief stehende
  // Sonne, Mond), rückt der Standpunkt seitlich um die Kirche herum, bis er frei zu sehen ist.
  let P = null,
    phi = 0,
    first = null;
  search: for (const f of [0, 14, -14, 26, -26, 38, -38, 50, -50]) {
    const out = h
      .clone()
      .negate()
      .applyAxisAngle(new V3(0, 1, 0), f * rad);
    for (const R of [150, 130, 175, 110]) {
      let p = null;
      for (let H = 20; H <= 80 && !p; H += 5) {
        const q = BODY_C.clone().addScaledVector(out, R);
        q.y = H;
        if (clearSight(q)) p = q;
      }
      if (!p) continue;
      if (!first) first = { p, f };
      if (el < 0.5 || bodyFree(p, Math.max(el, 0.3), az)) {
        P = p;
        phi = f;
        break search;
      }
    }
  }
  if (!P && first) ({ p: P, f: phi } = first);
  if (!P) {
    P = BODY_C.clone().addScaledVector(h, -150);
    P.y = 80;
  }
  // Blickrichtung: zum Himmelskörper; liegt die Kirche dann zu weit seitlich, etwas zu ihr hin gedreht,
  // solange der Himmelskörper im Bild bleibt
  const hh = Math.atan(Math.tan((fov / 2) * rad) * (W0 / H0)) / rad,
    shift = Math.min(Math.max(0, Math.abs(phi) + 12 - hh), Math.max(0, hh - 8)),
    view = h.clone().applyAxisAngle(new V3(0, 1, 0), Math.sign(phi) * shift * rad), // Kirche liegt um phi gedreht
    R = Math.hypot(P.x - BODY_C.x, P.z - BODY_C.z),
    T = P.clone().addScaledVector(view, R);
  T.y = P.y + R * Math.tan(c * rad); // Drehpunkt etwa über der Kirche, in Blickrichtung
  Object.assign(VIEWS[name], { pos: P.toArray(), tgt: T.toArray(), fov: Math.round(fov) });
}
/** Knöpfe und Randhinweise: zur Sonne oder zum Mond blicken; steht er unter dem Horizont, nur ein Hinweis. */
export function lookToBody(name) {
  if (bodyEl(name) < -1) {
    const h = $('#hint');
    h.textContent =
      name === 'zumMond'
        ? tr('Der Mond steht gerade unter dem Horizont.', 'The moon is below the horizon right now.')
        : tr('Die Sonne steht gerade unter dem Horizont.', 'The sun is below the horizon right now.');
    h.classList.remove('gone');
    setTimeout(() => h.classList.add('gone'), 4000);
    return false;
  }
  goView(name);
  return true;
}
export const busyState = { panoWarm: false, hideOnPano: false };
export function busyShow(t) {
  $('#busyTxt').textContent = t;
  $('#busy').hidden = false;
}
export function busyText(t) {
  $('#busyTxt').textContent = t;
}
export function busyHide() {
  $('#busy').hidden = true;
}
/** Handy: die ganze Altstadtinsel nur dort zeichnen, wo man sie sieht – spart Rechenzeit */
export function farFor(name) {
  farBuildings(
    !document.body.classList.contains('mobile') || ['insel', 'luft', 'himmel', 'mtTop', 'mtCam'].includes(name),
  );
}
export function goView(name, instant) {
  if (name === 'himmel') fitSky();
  if (name === 'zurSonne' || name === 'zumMond') bodyView(name);
  farFor(name);
  let v = VIEWS[name];
  if (!v) return;
  if (v.mob && document.body.classList.contains('mobile')) v = { ...v, pos: v.mob }; // Handy: näher heran
  {
    const far = name === 'mtTop' || name === 'mtCam' || name === 'insel';
    scene.fog.near = far ? 2500 : 350;
    scene.fog.far = far ? 9000 : 1700;
  }
  setMoonMag(name === 'mtCam' ? 1 : 2.2);
  {
    const nf = name === 'mtTop' ? [5, 15000] : [0.2, 5000];
    if (camera.near !== nf[0]) {
      camera.near = nf[0];
      camera.far = nf[1];
      camera.updateProjectionMatrix();
    }
  }
  {
    const fv = v.fov || 55;
    if (camera.fov !== fv) {
      camera.fov = fv;
      camera.updateProjectionMatrix();
    }
  }
  if (v.mode === 'pano' && !busyState.panoWarm) {
    busyShow(tr('Himmelsansicht wird berechnet …', 'Preparing the sky view …'));
    busyState.panoWarm = true;
    busyState.hideOnPano = true;
    requestAnimationFrame(() => setTimeout(() => goView(name, instant), 40));
    return;
  }
  if (v.mode === 'pano') {
    // Panorama: Kamera nur als Standpunkt, Steuerung über eigene Zieh- und Zoomgesten
    document
      .querySelectorAll('#views button')
      .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    $('#viewTxt').textContent = tr('Himmel: Sonnen- und Mondbahn', 'Sky: paths of sun and moon');
    state.view = name;
    tween = null;
    setCut(v.cut);
    setExp(v.exp);
    camera.position.set(...v.pos);
    state.pano = true;
    state.mode = 'pano';
    state.walk = null;
    controls.enabled = false;
    state.pano = true;
    $('#hint').textContent = hintFor();
    $('#hint').classList.remove('gone');
    setTimeout(() => $('#hint').classList.add('gone'), 7000);
    updateLabelsVisibility();
    panoUniforms();
    joyShow();
    requestRender();
    return;
  }
  if (state.pano) {
    state.pano = false;
    controls.enabled = true;
    drawPanoGrid();
  }
  document
    .querySelectorAll('#views button')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  state.view = name;
  {
    const vb = document.querySelector('#views button[data-view="' + name + '"]');
    $('#viewTxt').textContent = vb
      ? vb.textContent
      : name === 'mtTop'
        ? tr('Draufsicht: Standort wählen', 'Top view: choose position')
        : name === 'mtCam'
          ? tr('Blick vom Standort', 'View from your position')
          : name === 'lkIn'
            ? tr('Fenster von innen', 'Window from inside')
            : name === 'totenkopf'
              ? tr('Totentanz: Nordportal', 'Dance of Death: north portal')
              : name === 'sonnenuhr'
                ? tr('Sonnenuhr', 'Sundial')
                : name === 'uhrblatt'
                  ? tr('Uhr: Zifferblatt', 'Clock: dial')
                  : name === 'finsternis'
                    ? tr('Finsternis', 'Eclipse')
                    : name === 'uhrkalender'
                      ? tr('Uhr: Kalenderscheibe', 'Clock: calendar disk')
                      : bodyViewName(name) || tr('eigene', 'custom');
  }
  const tp = new V3(...v.pos);
  const tt = v.mode === 'inside' ? tp.clone().add(new V3(...v.dir).normalize().multiplyScalar(1.2)) : new V3(...v.tgt);
  setCut(v.cut);
  setExp(v.exp);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (instant || reduce) {
    camera.position.copy(tp);
    controls.target.copy(tt);
    camera.lookAt(tt);
    applyMode(v.mode, v.minD, v.walk);
    controls.update();
    requestRender();
    return;
  }
  state.walk = null;
  controls.enabled = false;
  tween = {
    t0: performance.now(),
    dur: v.walk ? 1800 : 1200,
    fp: camera.position.clone(),
    ft: controls.target.clone(),
    tp,
    tt,
    mode: v.mode,
    minD: v.minD,
    walk: v.walk,
  };
}
export function stepTween(now) {
  const k0 = clamp01((now - tween.t0) / tween.dur),
    k = k0 < 0.5 ? 4 * k0 * k0 * k0 : 1 - Math.pow(-2 * k0 + 2, 3) / 2;
  camera.position.lerpVectors(tween.fp, tween.tp, k);
  controls.target.lerpVectors(tween.ft, tween.tt, k);
  camera.lookAt(controls.target);
  requestRender();
  if (k0 >= 1) {
    const m = tween.mode,
      md = tween.minD,
      wk = tween.walk;
    tween = null;
    controls.enabled = true;
    applyMode(m, md, wk);
    controls.update();
  }
}
// Steuerkreis: Gehen mit dem Finger in Innenansichten (Handy, Tablet); vorwärts/rückwärts und seitlich, Umsehen weiter durch Ziehen im Bild
export const joy = { el: document.getElementById('joy'), k: document.getElementById('joyk'), id: null, x: 0, y: 0 };
function joyShow() {
  if (joy.el) joy.el.hidden = !(coarse && state.mode === 'inside' && !state.pano);
}
if (joy.el) {
  const R = 40,
    upd = e => {
      const b = joy.el.getBoundingClientRect();
      let dx = e.clientX - (b.left + b.width / 2),
        dy = e.clientY - (b.top + b.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > R) {
        dx *= R / l;
        dy *= R / l;
      }
      joy.x = dx / R;
      joy.y = dy / R;
      joy.k.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
  joy.el.addEventListener('pointerdown', e => {
    joy.id = e.pointerId;
    joy.el.setPointerCapture(e.pointerId);
    upd(e);
    e.preventDefault();
    e.stopPropagation();
  });
  joy.el.addEventListener('pointermove', e => {
    if (e.pointerId === joy.id) upd(e);
  });
  const end = e => {
    if (e.pointerId !== joy.id) return;
    joy.id = null;
    joy.x = joy.y = 0;
    joy.k.style.transform = '';
  };
  joy.el.addEventListener('pointerup', end);
  joy.el.addEventListener('pointercancel', end);
}
export function joyMove(dt) {
  if (joy.id === null || tween || state.pano) return;
  const sp = (state.walk ? 1.2 : 4) * dt,
    dz = Math.abs(joy.y) < 0.12 ? 0 : joy.y,
    dx = Math.abs(joy.x) < 0.12 ? 0 : joy.x;
  if (dx || dz) moveBy(-dz * sp, dx * sp, 0);
}
export const keys = new Set();
window.addEventListener('keydown', e => {
  const tg = e.target.tagName;
  if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
    keys.add(k);
    if (k.startsWith('arrow')) e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
function moveBy(fwd, side, upd) {
  const f = new V3().subVectors(controls.target, camera.position);
  f.y = 0;
  if (f.lengthSq() < 1e-8) f.set(1, 0, 0);
  f.normalize();
  const r = new V3(-f.z, 0, f.x);
  const m = f.multiplyScalar(fwd).add(r.multiplyScalar(side));
  m.y = upd;
  camera.position.add(m);
  controls.target.add(m);
  if (state.walk) clampWalk();
  else if (state.mode === 'inside') {
    const dy =
      Math.max(state.skyView ? 2 : 0.4, Math.min(state.skyView ? 200 : 37, camera.position.y)) - camera.position.y;
    camera.position.y += dy;
    controls.target.y += dy;
  } else if (camera.position.y < 1) {
    const dy = 1 - camera.position.y;
    camera.position.y += dy;
    controls.target.y += dy;
  }
  requestRender();
}
// Laufbereich (Laterne des Dachreiters): Ring um die Mittelsäule, feste Augenhöhe
export function clampWalk() {
  const w = state.walk;
  if (!w) return;
  const p = camera.position,
    dx = p.x - w.cx,
    dz = p.z - w.cz,
    r = Math.hypot(dx, dz) || 1e-6,
    rr = Math.min(w.rMax, Math.max(w.rMin, r));
  const nx = w.cx + (dx / r) * rr,
    nz = w.cz + (dz / r) * rr,
    d = new V3(nx - p.x, w.y - p.y, nz - p.z);
  if (d.lengthSq() > 1e-10) {
    p.add(d);
    controls.target.add(d);
    requestRender();
  }
}
export function keyMove(dt) {
  if (tween || state.pano) return;
  const sp =
    (keys.has('shift') ? 3 : 1) * (state.walk ? 1.2 : state.skyView ? 25 : state.mode === 'inside' ? 5 : 22) * dt;
  let f = 0,
    s = 0,
    u = 0;
  if (keys.has('w') || keys.has('arrowup')) f += sp;
  if (keys.has('s') || keys.has('arrowdown')) f -= sp;
  if (keys.has('d') || keys.has('arrowright')) s += sp;
  if (keys.has('a') || keys.has('arrowleft')) s -= sp;
  if (keys.has('e')) u += sp;
  if (keys.has('q')) u -= sp;
  if (f || s || u) moveBy(f, s, u);
}
renderer.domElement.addEventListener(
  'wheel',
  e => {
    if (state.pano) {
      e.preventDefault();
      panoZoom(Math.exp(-e.deltaY * 0.0015));
      return;
    }
    if (state.mode !== 'inside' || tween) return;
    e.preventDefault();
    if (state.skyView) {
      camera.fov = Math.max(25, Math.min(110, camera.fov + e.deltaY * 0.04));
      camera.updateProjectionMatrix();
      requestRender();
      return;
    }
    moveBy(-e.deltaY * (state.walk ? 0.003 : 0.012), 0, 0);
  },
  { passive: false },
);
