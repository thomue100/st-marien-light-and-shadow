// Sonnenuhr am südlichen Strebepfeiler: Zifferblatt, Schattenstab, Ablesung.
import { envBlocked } from './environment.js'; // Aufbau-Reihenfolge: nach model/environment
import { berlinOffsetMin, LAT, localToUtc, nrm360, rad, sunPos } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { step } from '../core/loader.js';
import { $ } from '../core/util.js';
import { dc, fmtDeg, fmtT, LANG, pad2, tr, tzN } from '../core/i18n.js';
import { PX } from './measures.js';
import { cur, LD, lightUp, state } from '../state.js';
import { cutPlane, maxAniso, requestRender, scene } from '../scene/renderer.js';
import { rng } from '../scene/textures.js';
import { darkMat, lin } from '../scene/materials.js';
import { occluders, polyGeo } from './geometry.js';
import { SD_FACE, SD_PIER } from './church.js';
import { rc } from '../light/windows.js';
import { lightStr, moonCur, useMoon } from '../light/sun.js';
import { day } from '../ui/readouts.js';

await step(tr('Sonnenuhr wird aufgebaut', 'Building the sundial'), 74);
/* ---------------- Sonnenuhr am südlichen Strebepfeiler ---------------- */
// Gemalte Stundenlinien: im entzerrten Foto vermessen (Strebenfuß senkrecht unter dem Stabansatz). Sie stimmen auf 0,6° (RMS)
// mit der Sollteilung einer senkrechten Uhr für 53,87° Breite an einer genau nach Süden zeigenden Wand überein: tan θ = cos φ · tan τ.
const SD_PAINT = (function () {
  const a = [[6, -90]];
  for (let h = 7; h <= 17; h++) a.push([h, Math.atan(Math.cos(LAT * rad) * Math.tan((h - 12) * 15 * rad)) / rad]);
  a.push([18, 90]);
  return a;
})();
export const SD = { pier: SD_PIER, y: 16.0, size: 0.9, foot: [0.53, 0.215], strut: [0.53, 0.9] };
export const sdX = PX[SD.pier],
  sdZ = SD_FACE + 0.1;
const sdGroup = new THREE.Group();
sdGroup.position.set(sdX, SD.y, sdZ);
scene.add(sdGroup);
const sdCanvas = document.createElement('canvas');
sdCanvas.width = sdCanvas.height = 512;
const sdTex = new THREE.CanvasTexture(sdCanvas);
sdTex.encoding = THREE.sRGBEncoding;
sdTex.anisotropy = maxAniso;
{
  const pm = new THREE.MeshStandardMaterial({ map: sdTex, roughness: 0.85 });
  pm.clippingPlanes = [cutPlane];
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(SD.size, SD.size), pm);
  plate.receiveShadow = true;
  sdGroup.add(plate);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(SD.size + 0.12, SD.size + 0.12, 0.1), darkMat);
  fr.position.z = -0.055;
  fr.castShadow = true;
  sdGroup.add(fr);
  // Kasten aus schwarzem Blech, ringsum bündig (Foto 2026): oben ein etwas tieferes Dachbrett, seitlich helle Halteleisten mit Schrauben
  const W = SD.size + 0.12,
    rim = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      sdGroup.add(m);
    };
  rim(W, 0.04, 0.17, 0, SD.size / 2 + 0.04, 0.08);
  rim(W, 0.04, 0.09, 0, -SD.size / 2 - 0.04, 0.04);
  rim(0.04, SD.size + 0.04, 0.09, -SD.size / 2 - 0.04, 0, 0.04);
  rim(0.04, SD.size + 0.04, 0.09, SD.size / 2 + 0.04, 0, 0.04);
}
// Halteleisten liegen flach auf der Backsteinwand neben dem Kasten (auch links, wo der Keil den Kasten vorstehen lässt)
const sdMetal = new THREE.MeshStandardMaterial({ color: lin(0x9ea3a6), roughness: 0.5, metalness: 0.6 });
sdMetal.clippingPlanes = [cutPlane];
let sdStrips = null;
const sdLocal = (px, py) => new V3((px - 0.5) * SD.size, (0.5 - py) * SD.size, 0);
const sdFootL = sdLocal(SD.foot[0], SD.foot[1]),
  sdStrutL = sdLocal(SD.strut[0], SD.strut[1]);
// Stab: vom Ansatz in der senkrechten Ebene quer zur Platte, 90° − φ gegen die Platte geneigt (richtig für eine Südwand).
// Strebe: steht senkrecht auf der Platte, Fuß mittig unten bei der 12.
const sdStrutLen = sdFootL.distanceTo(sdStrutL) * Math.tan((90 - LAT) * rad);
const sdTipL = sdStrutL.clone().add(new V3(0, 0, sdStrutLen));
const rodMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.5, metalness: 0.6 });
rodMat.clippingPlanes = [cutPlane];
const sdRod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8), rodMat);
sdRod.castShadow = true;
sdGroup.add(sdRod);
const sdStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 8), rodMat);
sdGroup.add(sdStrut);
const shMat = new THREE.MeshBasicMaterial({ color: 0x151210, transparent: true, opacity: 0.72, depthWrite: false });
shMat.clippingPlanes = [cutPlane];
const sdShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shMat);
sdShadow.visible = false;
sdGroup.add(sdShadow);
function placeBar(mesh, a, b) {
  const len = a.distanceTo(b);
  mesh.scale.set(1, len, 1);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
}
placeBar(sdRod, sdFootL, sdTipL);
placeBar(sdStrut, sdStrutL, sdTipL);
// Keil: Die Platte ist um eine senkrechte Achse aus der Wand gedreht, die westliche (linke) Kante steht vor.
// Detailfoto: Kastenkanten waagerecht, Ziegelschichten um ca. 4° steigend -> geschätzt 6–9°, genau nach Süden wären 8,5°.
let sdWedgeMesh = null;
export function sdOrient() {
  const psi = state.sdWedge * rad,
    half = SD.size / 2 + 0.06,
    wallZ = SD_FACE;
  sdGroup.rotation.y = psi;
  sdGroup.position.set(sdX, SD.y, wallZ + 0.105 * Math.cos(psi) + half * Math.sin(psi));
  sdGroup.updateMatrixWorld();
  if (sdWedgeMesh) {
    scene.remove(sdWedgeMesh);
    sdWedgeMesh.geometry.dispose();
    sdWedgeMesh = null;
  }
  const w = (x, y) => new V3(x, y, -0.105).applyMatrix4(sdGroup.matrixWorld),
    wp = v => new V3(v.x, v.y, wallZ);
  if (sdStrips) {
    scene.remove(sdStrips);
    sdStrips.traverse(o => o.geometry && o.geometry.dispose());
  }
  sdStrips = new THREE.Group();
  {
    const H = (SD.size + 0.12) * 0.92;
    for (const sx of [-1, 1]) {
      const ex = w(sx * half, 0).x + sx * 0.0375;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.075, H, 0.015), sdMetal);
      st.position.set(ex, SD.y, wallZ + 0.0075);
      st.castShadow = true;
      sdStrips.add(st);
      for (let k = 0; k < 4; k++) {
        const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), darkMat);
        bo.rotation.x = Math.PI / 2;
        bo.position.set(ex + sx * 0.005, SD.y + (k - 1.5) * (SD.size + 0.12) * 0.26, wallZ + 0.02);
        sdStrips.add(bo);
      }
    }
    scene.add(sdStrips);
  }
  if (psi > 0.001) {
    const bl = w(-half, -half),
      tl = w(-half, half),
      br = w(half, -half),
      tr = w(half, half);
    const f = [
      [wp(bl), bl, tl, wp(tl)],
      [wp(tl), tl, tr, wp(tr)],
      [wp(bl), bl, br, wp(br)],
    ];
    sdWedgeMesh = new THREE.Mesh(polyGeo(f), darkMat);
    sdWedgeMesh.castShadow = true;
    scene.add(sdWedgeMesh);
  }
  const o = $('#sdWedgeOut');
  if (o) o.textContent = fmtDeg(state.sdWedge);
  const face = state.axis + 90 - state.sdWedge;
  const fo = $('#sdFace');
  if (fo)
    fo.textContent =
      tr('Zifferblatt zeigt auf ', 'Dial faces ') +
      fmtDeg(((face % 360) + 360) % 360) +
      (Math.abs(face - 180) < 0.3 ? tr(' (genau Süd)', ' (due south)') : '');
}
const SD_FIELD = { x0: 0.16, x1: 0.875, y0: 0.205, y1: 0.89 };
function fieldHit(th) {
  const [fx, fy] = SD.foot,
    dx = Math.sin(th * rad),
    dy = Math.cos(th * rad);
  let t = 1e9;
  if (dy > 1e-6) t = Math.min(t, (SD_FIELD.y1 - fy) / dy);
  if (dx > 1e-6) t = Math.min(t, (SD_FIELD.x1 - fx) / dx);
  else if (dx < -1e-6) t = Math.min(t, (SD_FIELD.x0 - fx) / dx);
  return [fx + dx * t, fy + dy * t];
}
export function sdDrawPlate() {
  const g = sdCanvas.getContext('2d'),
    S = 512,
    r = rng(17);
  g.fillStyle = '#3e4c68';
  g.fillRect(0, 0, S, S); // schieferblau mit hellen Linien und goldener Sonne (Fotos 2026)
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = 'rgba(' + (r() < 0.5 ? '30,36,50' : '150,165,190') + ',' + r() * 0.14 + ')';
    g.fillRect(r() * S, r() * S, 2 + r() * 5, 2 + r() * 4);
  }
  g.strokeStyle = '#e8e5d8';
  g.lineWidth = 4;
  g.strokeRect(SD_FIELD.x0 * S, SD_FIELD.y0 * S, (SD_FIELD.x1 - SD_FIELD.x0) * S, (SD_FIELD.y1 - SD_FIELD.y0) * S);
  const [fx, fy] = SD.foot;
  g.save();
  g.translate(fx * S, fy * S);
  g.strokeStyle = '#efe2a6';
  g.lineWidth = 4;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 56, Math.sin(a) * 56);
    g.lineTo(Math.cos(a + 0.1) * (k % 2 ? 80 : 96), Math.sin(a + 0.1) * (k % 2 ? 80 : 96));
    g.stroke();
  }
  g.fillStyle = '#e3bd3c';
  g.beginPath();
  g.arc(0, 0, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#7a5a14';
  g.stroke();
  g.fillStyle = '#7a5a14';
  g.beginPath();
  g.arc(-18, -10, 5, 0, 7);
  g.arc(18, -10, 5, 0, 7);
  g.fill();
  g.beginPath();
  g.arc(0, 14, 16, 0.2, Math.PI - 0.2);
  g.stroke();
  g.restore();
  g.strokeStyle = '#ecebe2';
  g.lineWidth = 5;
  g.fillStyle = '#ecebe2';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 46px "Alegreya SC", Georgia, serif';
  for (const [h, th] of SD_PAINT) {
    const hit = fieldHit(th),
      s0 = 0.17;
    if (h !== 6 && h !== 18) {
      g.beginPath();
      g.moveTo((fx + Math.sin(th * rad) * s0) * S, (fy + Math.cos(th * rad) * s0) * S);
      g.lineTo(hit[0] * S, hit[1] * S);
      g.stroke();
    }
    let lx = hit[0],
      ly = hit[1];
    if (Math.abs(hit[1] - SD_FIELD.y1) < 1e-3) ly += 0.055;
    else if (th < 0) lx -= 0.075;
    else lx += 0.075;
    if (h === 6) {
      lx = 0.085;
      ly = 0.27;
    }
    if (h === 18) {
      lx = 0.93;
      ly = 0.27;
    }
    g.fillText(String(h > 12 ? h - 12 : h), lx * S, ly * S);
  }
  g.font = '600 26px "Alegreya SC", Georgia, serif';
  g.textAlign = 'left';
  g.fillText('REN', 0.05 * S, 0.1 * S);
  g.textAlign = 'right';
  g.fillText('1968', 0.95 * S, 0.1 * S);
  sdTex.needsUpdate = true;
  requestRender();
}
function paintedReading(th) {
  for (let i = 0; i < SD_PAINT.length - 1; i++) {
    const a = SD_PAINT[i],
      b = SD_PAINT[i + 1];
    if (th >= a[1] && th <= b[1]) return a[0] + ((th - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
  }
  return null;
}
export const sd = { lit: false, front: false, theta: null, show: null, woz: null, moonCorr: null };
function sdLocalSun() {
  return LD.clone().applyQuaternion(sdGroup.quaternion.clone().invert());
}
export function sdUpdate() {
  const n = new V3(0, 0, 1),
    Ls = sdLocalSun();
  sd.front = Ls.dot(n) > 0.005 && lightUp();
  sd.moonCorr = useMoon ? nrm360(moonCur.ra - moonCur.raSun) / 15 : null; // Mondzeit + (α Mond − α Sonne) = wahre Ortszeit
  const s = sunPos(localToUtc(state.y, state.m, state.d, state.minutes));
  sd.woz = (((12 + s.H / 15) % 24) + 24) % 24;
  if (sd.front) {
    const off = sdTipL.clone().sub(sdFootL).dot(n) / Ls.dot(n);
    const T = sdTipL.clone().addScaledVector(Ls, -off);
    const v = T.clone().sub(sdFootL);
    sd.theta = Math.atan2(v.x, -v.y) / rad;
    sd.show = paintedReading(sd.theta);
    const dir = v.clone().normalize(),
      half = SD.size / 2 - 0.01;
    let tmax = v.length();
    for (const [c, dc] of [
      [sdFootL.x, dir.x],
      [sdFootL.y, dir.y],
    ]) {
      if (dc > 1e-6) tmax = Math.min(tmax, (half - c) / dc);
      else if (dc < -1e-6) tmax = Math.min(tmax, (-half - c) / dc);
    }
    placeShadow(sdFootL, sdFootL.clone().addScaledVector(dir, tmax));
    sdShadow.visible = sd.lit && lightStr > 0.05;
    shMat.opacity = useMoon ? 0.45 : 0.72;
  } else {
    sd.theta = null;
    sd.show = null;
    sdShadow.visible = false;
  }
  updateSdReadouts();
}
function placeShadow(a, b) {
  const len = Math.max(0.001, a.distanceTo(b));
  sdShadow.scale.set(0.022, len, 1);
  sdShadow.position.copy(a).add(b).multiplyScalar(0.5);
  sdShadow.position.z = 0.003;
  sdShadow.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
}
export function sdUpdateLit() {
  if (!(sdLocalSun().z > 0.005 && lightUp())) {
    sd.lit = false;
    return;
  }
  const c = new V3(0, 0.1, 0.25).applyMatrix4(sdGroup.matrixWorld);
  rc.set(c, LD);
  sd.lit = !envBlocked(c) && rc.intersectObjects(occluders, false).length === 0;
}
const fmtHM = h => {
  if (h === null || h === undefined) return '–';
  let m = Math.round(h * 60);
  m = ((m % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
};
function fmtDiff(min) {
  const s = min < 0 ? '−' : '+';
  const a = Math.round(Math.abs(min));
  return s + (a >= 60 ? Math.floor(a / 60) + ' h ' + pad2(a % 60) : a) + ' min';
}
function fmtDur(hh) {
  const m = Math.round(hh * 60);
  return (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + pad2(m % 60) + ' min';
}
/** Weitere Anzeigen der Sonnenuhr (Handy, Desktop-Anzeige oben links) melden sich hier an. */
let sdHook = null;
export function setSdHook(f) {
  sdHook = f;
}
export function moonAge(utc) {
  const ln = day.nm1 !== null && day.nm1 <= utc ? day.nm1 : day.nm0;
  return ln ? (utc - ln) / 86400000 : null;
}
function updateSdReadouts() {
  const utc = localToUtc(state.y, state.m, state.d, state.minutes),
    clockH = state.minutes / 60,
    tz = tzN(berlinOffsetMin(utc));
  $('#sdClock').textContent = fmtT(state.minutes) + ' ' + tz;
  const mm = useMoon;
  $('#sdShowLbl').textContent = mm
    ? tr('Mondschatten zeigt', 'Moon shadow shows')
    : tr('Sonnenuhr zeigt', 'Sundial shows');
  $('#sdDiffLbl').textContent = mm
    ? tr('Korrektur (Mondalter)', 'Correction (moon age)')
    : tr('gegenüber Uhrzeit', 'vs. clock time');
  $('#sdErrLbl').textContent = mm ? tr('korrigiert', 'corrected') : tr('Ablesefehler', 'Reading error');
  $('#sdWoz').textContent = cur.el > 0 || mm ? fmtHM(sd.woz) : '–';
  const ok = sd.show !== null && sd.lit;
  $('#sdShow').textContent = ok ? fmtHM(sd.show) : '–';
  if (mm) {
    $('#sdDiff').textContent = ok ? '+' + fmtDur(sd.moonCorr) : '–';
    $('#sdErr').textContent = ok ? fmtHM(sd.show + sd.moonCorr) : '–';
  } else {
    $('#sdDiff').textContent = ok ? fmtDiff((sd.show - clockH) * 60) : '–';
    $('#sdErr').textContent = ok ? fmtDiff((sd.show - sd.woz) * 60) : '–';
  }
  let st;
  if (mm) {
    const age = moonAge(utc);
    if (!sd.front)
      st = tr(
        'Der Mond steht hinter der Wand, das Zifferblatt liegt im Dunkeln.',
        'The moon is behind the wall; the dial is in the dark.',
      );
    else if (!sd.lit)
      st = tr(
        'Das Zifferblatt liegt im Mondschatten der Umgebung oder der Kirche.',
        'The dial lies in the moon shadow of the surroundings or the church.',
      );
    else {
      let e = (((sd.show + sd.moonCorr - sd.woz) % 24) + 24) % 24;
      if (e > 12) e -= 24;
      const ag = age !== null ? dc(age.toFixed(1)) : '–';
      st =
        LANG === 'en'
          ? 'Moon shadow: the dial shows lunar time. The moon is ' +
            ag +
            ' days old and lags the sun by ' +
            fmtDur(sd.moonCorr) +
            (age !== null ? ' (rule of thumb 48 min per day: ' + fmtDur(age * 0.8) + ')' : '') +
            (Math.abs(e * 60) < 1
              ? '. The corrected reading matches apparent solar time.'
              : '. The corrected reading is off by ' + fmtDiff(e * 60) + ' from apparent solar time.')
          : 'Mondschatten: Die Uhr zeigt die Mondzeit. Der Mond ist ' +
            ag +
            ' Tage alt und steht ' +
            fmtDur(sd.moonCorr) +
            ' hinter der Sonne zurück' +
            (age !== null ? ' (Faustregel 48 min pro Tag: ' + fmtDur(age * 0.8) + ')' : '') +
            (Math.abs(e * 60) < 1
              ? '. Die korrigierte Ablesung stimmt mit der wahren Ortszeit überein.'
              : '. Die korrigierte Ablesung weicht ' +
                fmtDiff(e * 60)
                  .replace('+', 'um +')
                  .replace('−', 'um −') +
                ' von der wahren Ortszeit ab.');
    }
  } else if (cur.el <= 0)
    st =
      tr('Die Sonne ist untergegangen.', 'The sun has set.') +
      (state.moon && moonCur && moonCur.el > 0
        ? moonCur.k < 0.25
          ? tr(' Der Mond gibt zu wenig Licht für einen Schatten.', ' The moon gives too little light for a shadow.')
          : tr(
              ' Der Mond gibt noch kein Licht für einen Schatten.',
              ' The moon does not yet give enough light for a shadow.',
            )
        : '');
  else if (!sd.front)
    st = tr(
      'Die Sonne steht hinter der Wand, das Zifferblatt liegt im Schatten.',
      'The sun is behind the wall; the dial is in shade.',
    );
  else if (!sd.lit)
    st = tr(
      'Das Zifferblatt liegt im Schatten der Umgebung oder der Kirche.',
      'The dial lies in the shadow of the surroundings or the church.',
    );
  else st = tr('Das Zifferblatt ist besonnt.', 'The dial is in sunshine.');
  $('#sdState').textContent = st;
  if (sdHook) sdHook(ok, st);
  const m = $('#yNow');
  if (m) {
    const nx = YX(dayOfYear());
    m.setAttribute('x1', nx);
    m.setAttribute('x2', nx);
  }
}
const YX = d => 10 + (d / 365) * 278;
export function dayOfYear() {
  return (Date.UTC(state.y, state.m, state.d) - Date.UTC(state.y, 0, 1)) / 86400000;
}
export function drawYearChart() {
  const el = $('#sdChart');
  const lo = -6,
    hi = 36,
    yv = m => 8 + ((hi - m) / (hi - lo)) * 68;
  const pts = [];
  let mn = 1e9,
    mx = -1e9;
  for (let d = 0; d < 366; d += 2) {
    const s = sunPos(Date.UTC(state.y, 0, 1) + d * 86400000 + 11 * 3600000);
    const noon = (-s.H / 15) * 60;
    pts.push(YX(d).toFixed(1) + ',' + yv(noon).toFixed(1));
    mn = Math.min(mn, noon);
    mx = Math.max(mx, noon);
  }
  let h = '';
  for (const [m, t] of [
    [0, '12:00'],
    [17.3, '12:17'],
    [30, '12:30'],
  ])
    h +=
      '<line class="grid" x1="10" x2="288" y1="' +
      yv(m) +
      '" y2="' +
      yv(m) +
      '"/><text x="292" y="' +
      (yv(m) + 3) +
      '">' +
      t +
      '</text>';
  const mon = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  for (let k = 0; k < 12; k++) {
    const d = (Date.UTC(state.y, k, 15) - Date.UTC(state.y, 0, 1)) / 86400000;
    h += '<text x="' + YX(d) + '" y="90" text-anchor="middle">' + mon[k] + '</text>';
  }
  h +=
    '<polyline class="curve" points="' +
    pts.join(' ') +
    '"/><line class="now" id="yNow" x1="0" x2="0" y1="6" y2="78"/>';
  el.innerHTML = h;
  $('#sdRange').textContent = tr(
    'Bei richtiger Ausrichtung steht der Schatten im Jahr ' +
      state.y +
      ' zwischen ' +
      fmtHM(12 + mn / 60) +
      ' und ' +
      fmtHM(12 + mx / 60) +
      ' MEZ auf der 12, in der Sommerzeit eine Stunde später.',
    'With correct alignment the shadow falls on the 12 between ' +
      fmtHM(12 + mn / 60) +
      ' and ' +
      fmtHM(12 + mx / 60) +
      ' CET in ' +
      state.y +
      ', an hour later in summer time.',
  );
}
