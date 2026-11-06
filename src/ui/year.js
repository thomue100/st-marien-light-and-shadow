// Jahr im Zeitraffer: die Kirche als Sonnenuhr, Schattenspur der Südturmspitze (Analemma).
import { setDate, setPlaying } from './controls.js'; // Aufbau-Reihenfolge: nach ui/controls
import { berlinOffsetMin, localToUtc, sunPos } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { $ } from '../core/util.js';
import { TW } from '../model/measures.js';
import { state, sunVec } from '../state.js';
import { coarse, requestRender, scene } from '../scene/renderer.js';
import { T_GTIP, T_HELM } from '../model/church.js';
import { ENV, envG, envSample } from '../model/environment.js';
import { goView } from '../scene/camera.js';

/* ---------------- Jahr im Zeitraffer: die Kirche als Sonnenuhr ----------------
   Die Uhrzeit bleibt in MEZ fest (im Sommer zeigt die Uhr daher eine Stunde mehr), das Datum läuft.
   Spur: Schattenpunkt der Südturmspitze auf dem Boden für jeden Tag des Jahres zu dieser Uhrzeit (bei fester mittlerer Zeit eine Acht, das Analemma). */
export const yr = { on: false, rate: 0, mez: 0, acc: 0, year: 0, group: null, marker: null, ray: null };
const YR_TIP = new V3(TW.xc, T_GTIP[1] + T_HELM[1], (TW.s[0] + TW.s[1]) / 2);
function yrGround(x, z) {
  const g = envG ? envSample(envG, ENV.gn, ENV.gstep, x, z) : -1e9;
  return g > -1e8 ? g : 0;
}
function yrPoint(utc, out) {
  const sp = sunPos(utc);
  if (sp.el < 1) return null;
  const d = sunVec(sp.el, sp.az, new V3());
  let p = null,
    gy = 0;
  for (let k = 0; k < 3; k++) {
    const t = (YR_TIP.y - gy) / d.y;
    p = YR_TIP.clone().addScaledVector(d, -t);
    gy = yrGround(p.x, p.z);
  }
  p.y = gy + 0.6;
  return out ? out.copy(p) : p;
}
const yrSeason = doy => {
  const C = [
    [0x2f6fc0, 0],
    [0x3f9a4c, 91],
    [0xe09a1a, 182],
    [0xc0461f, 274],
    [0x2f6fc0, 365],
  ];
  for (let i = 0; i < C.length - 1; i++)
    if (doy <= C[i + 1][1]) {
      const a = new THREE.Color(C[i][0]),
        b = new THREE.Color(C[i + 1][0]);
      return a.lerp(b, (doy - C[i][1]) / (C[i + 1][1] - C[i][1]));
    }
  return new THREE.Color(C[0][0]);
};
export function yrBuild() {
  if (yr.group) {
    scene.remove(yr.group);
    yr.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
  }
  const g = new THREE.Group();
  g.renderOrder = 30;
  const pos = [],
    col = [],
    y = state.y,
    n = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  for (let k = 0; k < n; k++) {
    const utc = Date.UTC(y, 0, 1 + k) + (yr.mez - 60) * 60000,
      p = yrPoint(utc);
    if (!p) continue;
    const c = yrSeason(k);
    pos.push(p.x, p.y, p.z);
    col.push(c.r, c.g, c.b);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dots = new THREE.Points(
    pg,
    new THREE.PointsMaterial({
      size: coarse ? 6 : 8,
      sizeAttenuation: false,
      vertexColors: true,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      fog: false,
    }),
  );
  dots.renderOrder = 30;
  g.add(dots);
  const ln = new THREE.Line(
    pg,
    new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8, fog: false }),
  );
  ln.renderOrder = 29;
  g.add(ln);
  yr.marker = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, depthTest: false, fog: false }),
  );
  yr.marker.renderOrder = 31;
  g.add(yr.marker);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  yr.ray = new THREE.Line(
    rg,
    new THREE.LineBasicMaterial({ color: 0xffe08a, depthTest: false, transparent: true, opacity: 0.9, fog: false }),
  );
  yr.ray.renderOrder = 31;
  g.add(yr.ray);
  yr.group = g;
  yr.year = y;
  scene.add(g);
  yrMark();
}
export function yrMark() {
  if (!yr.group) return;
  const p = yrPoint(localToUtc(state.y, state.m, state.d, state.minutes));
  yr.marker.visible = yr.ray.visible = !!p;
  if (p) {
    yr.marker.position.copy(p);
    const a = yr.ray.geometry.attributes.position;
    a.setXYZ(0, YR_TIP.x, YR_TIP.y, YR_TIP.z);
    a.setXYZ(1, p.x, p.y, p.z);
    a.needsUpdate = true;
  }
  requestRender();
}
export function yrMez() {
  return state.minutes - (berlinOffsetMin(localToUtc(state.y, state.m, state.d, state.minutes)) - 60);
}
export function yearStart(rate) {
  const first = !yr.on;
  yr.on = true;
  yr.rate = rate;
  yr.acc = 0;
  yr.mez = yrMez();
  yrBuild();
  $('#yearNote').hidden = false;
  setPlaying(state.playing);
  if (first && !['sonnenuhr', 'himmel'].includes(state.view)) goView('jahr');
}
export function yearStop() {
  if (!yr.on) return;
  yr.on = false;
  if (yr.group) {
    scene.remove(yr.group);
    yr.group = null;
  }
  $('#yearNote').hidden = true;
  setPlaying(state.playing);
  requestRender();
}
export function yearTick(dt) {
  yr.acc += yr.rate * dt;
  if (yr.acc < 1) return;
  const nd = Math.floor(yr.acc);
  yr.acc -= nd;
  const t = new Date(Date.UTC(state.y, state.m, state.d + nd)),
    y = t.getUTCFullYear(),
    m = t.getUTCMonth(),
    d = t.getUTCDate();
  const off = berlinOffsetMin(Date.UTC(y, m, d, 12));
  state.minutes = Math.max(0, Math.min(1439, yr.mez + (off - 60)));
  setDate(y, m, d);
  if (y !== yr.year) yrBuild();
  else yrMark();
}
