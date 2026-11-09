// Astronomische Uhr (Paul Behrens, 1955–1976) an der Ostwand der Totentanzkapelle: Gehäuse, Zifferblatt, Kalenderscheibe.
import './church.js'; // Aufbau-Reihenfolge: nach model/church
import { berlinOffsetMin, rad } from '../astro/index.js';
import { DATA, LATER } from '../data.js';
import { smooth } from '../core/util.js';
import { cur } from '../state.js';
import { maxAniso, requestRender } from '../scene/renderer.js';
import { enhance } from '../scene/shaders.js';
import { darkMat } from '../scene/materials.js';
import { addMesh, box, building } from './geometry.js';
import { updateClockCard } from '../ui/clockcard.js';

/* ---------------- Astronomische Uhr (Paul Behrens, 1955–1976) an der Ostwand der Totentanzkapelle ---------------- */
// Gehäuse: entzerrtes Frontalfoto (13,45 m hoch, Zifferblatt und Kalenderscheibe je 3 m Durchmesser).
// Zifferblatt und Kalenderscheibe werden live gezeichnet, Rechnung und Bilder nach der App „astro-uhr-app“ (ClockRenderer, AstroCalc, config).
export const CK = await DATA.clock;
export const CLK = { x: 13.6, back: 14.5, z: -21.7, w: 6.2, h0: 0.8, h1: 13.45, dialY: 6.19, calY: 2.31, R: 1.5 };
export const clk = {
  em: [],
  img: {},
  ctx: null,
  tex: null,
  cal: null,
  st: null,
  lastUtc: null,
  lastDraw: 0,
  pending: false,
};
async function ckImg(src) {
  const im = new Image();
  im.src = src;
  try {
    await im.decode();
    return im;
  } catch (e) {
    return null;
  }
}
// Handy: die drei großen Bilder (Gehäuse, Kalenderscheibe, Sternenhimmel; 0,6 MB) erst nach dem Start (loadClockLater)
const BIG = ['gehaeuse', 'kalender', 'stern'];
if (CK && CK.img) {
  const ks = Object.keys(CK.img).filter(k => !LATER || !BIG.includes(k)),
    ims = await Promise.all(ks.map(k => ckImg(CK.img[k])));
  ks.forEach((k, i) => {
    if (ims[i]) clk.img[k] = ims[i];
  });
}
/** Foto des Gehäuses als Textur (sobald geladen) */
function caseTex() {
  const I = clk.img,
    m = clk.caseMat;
  if (!I.gehaeuse || m.map) return;
  const t = ckTex(I.gehaeuse);
  m.map = t;
  m.emissiveMap = t;
  m.emissive = new THREE.Color(0.16, 0.15, 0.14);
  m.needsUpdate = true;
  clk.em.push([m, 0.155]);
}
/** Kalenderscheibe als Textur (sobald geladen) */
function calTex() {
  const I = clk.img,
    m = clk.calMat;
  if (!I.kalender || m.map) return;
  const t = ckTex(I.kalender);
  m.color.set(0xffffff);
  m.map = t;
  m.emissiveMap = t;
  m.emissive = new THREE.Color(0.16, 0.16, 0.16);
  m.needsUpdate = true;
  clk.em.push([m, 0.16]);
}
let clockP = null;
/** Handy: die großen Bilder der Uhr nachladen und einsetzen (einmalig). */
export function loadClockLater() {
  return (clockP ||= (async () => {
    if (!LATER || !CK || !CK.img) return;
    const ks = BIG.filter(k => CK.img[k] && !clk.img[k]),
      ims = await Promise.all(ks.map(k => ckImg(CK.img[k])));
    ks.forEach((k, i) => {
      if (ims[i]) clk.img[k] = ims[i];
    });
    caseTex();
    calTex();
    clockUpdate(null, true); // Zifferblatt mit Sternenhimmel neu zeichnen
    requestRender();
  })());
}
function ckTex(img, srgb) {
  const t = new THREE.Texture(img);
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}
{
  const I = clk.img,
    x0 = CLK.x,
    zc = CLK.z,
    toWall = g => {
      g.rotateY(-Math.PI / 2);
      return g;
    };
  // Holzkörper (wirft die Schatten), Sockel mit Gesims und zwei Füßen
  const wood = enhance(new THREE.MeshStandardMaterial({ color: 0x6e4529, roughness: 0.6 }), {});
  box(x0, CLK.back, CLK.h0, 9.25, zc - 2.55, zc + 2.55, wood);
  box(x0 + 0.35, CLK.back, 9.25, 12.3, zc - 0.95, zc + 0.95, wood);
  box(x0 - 0.15, CLK.back, 0.3, CLK.h0, zc - 2.8, zc + 2.8, wood);
  for (const s of [-1, 1]) box(x0, CLK.back, 0, 0.3, zc + s * 1.9, zc + s * 2.45, wood);
  // Front: Foto mit Freistellmaske (Figurenaufsatz vor der Wand)
  const caseMat = enhance(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    {},
  );
  clk.caseMat = caseMat;
  caseTex();
  if (I.maske) {
    caseMat.alphaMap = ckTex(I.maske, false);
  }
  const hh = CLK.h1 - CLK.h0,
    cg = toWall(new THREE.PlaneGeometry(CLK.w, hh));
  cg.translate(x0 - 0.02, CLK.h0 + hh / 2, zc);
  addMesh(cg, caseMat, false, true);
  // Zifferblatt: Canvas, bei jeder Zeitänderung neu gezeichnet
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  clk.ctx = cv.getContext('2d');
  clk.canvas = cv;
  clk.tex = new THREE.CanvasTexture(cv);
  clk.tex.encoding = THREE.sRGBEncoding;
  clk.tex.anisotropy = maxAniso;
  const dialMat = enhance(
    new THREE.MeshStandardMaterial({
      map: clk.tex,
      emissiveMap: clk.tex,
      emissive: new THREE.Color(0.2, 0.2, 0.2),
      roughness: 0.4,
      metalness: 0.1,
      alphaTest: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    {},
  );
  clk.em.push([dialMat, 0.2]);
  const dg = toWall(new THREE.CircleGeometry(CLK.R, 128));
  dg.translate(x0 - 0.05, CLK.dialY, zc);
  addMesh(dg, dialMat, false, true);
  // Kalenderscheibe: dreht sich einmal im Jahr, der feste Zeiger links weist auf den Tag
  const calMat = enhance(
    new THREE.MeshStandardMaterial({
      color: I.kalender ? 0xffffff : 0x1e3a5f,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    {},
  );
  clk.calMat = calMat;
  calTex();
  const cgrp = new THREE.Group();
  cgrp.position.set(x0 - 0.05, CLK.calY, zc);
  cgrp.rotation.y = -Math.PI / 2;
  building.add(cgrp);
  clk.cal = new THREE.Mesh(new THREE.CircleGeometry(CLK.R, 160), calMat);
  clk.cal.receiveShadow = true;
  cgrp.add(clk.cal);
  const pc = document.createElement('canvas');
  pc.width = 512;
  pc.height = 128;
  {
    const g = pc.getContext('2d'),
      gr = g.createLinearGradient(0, 52, 0, 76);
    gr.addColorStop(0, '#fff1b8');
    gr.addColorStop(0.5, '#d9a531');
    gr.addColorStop(1, '#7d5a14');
    g.fillStyle = gr;
    g.fillRect(0, 56, 400, 16);
    g.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8,
        r = k % 2 ? 18 : 58;
      g.lineTo(424 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(80,55,10,.8)';
    g.lineWidth = 2;
    g.stroke();
  }
  const pMat = enhance(
    new THREE.MeshStandardMaterial({
      map: ckTex(pc),
      alphaTest: 0.4,
      roughness: 0.35,
      metalness: 0.5,
      emissive: new THREE.Color(0.12, 0.09, 0.02),
      side: THREE.DoubleSide,
    }),
    {},
  );
  const pg = toWall(new THREE.PlaneGeometry(0.8, 0.2));
  pg.translate(x0 - 0.08, CLK.calY, zc - 1.217 - (424 / 512 - 0.5) * 0.8);
  addMesh(pg, pMat, false, false);
  // Gitter vor der Uhr (schwarzes Eisen)
  const iron = darkMat,
    rx = x0 - 1.6,
    za = zc - 3.2,
    zb = zc + 3.2;
  for (const y of [0.12, 0.98]) {
    box(rx - 0.025, rx + 0.025, y - 0.02, y + 0.02, za, zb, iron);
    for (const z of [za, zb]) box(rx, x0 - 0.1, y - 0.02, y + 0.02, z - 0.025, z + 0.025, iron);
  }
  for (let k = 0; k <= 5; k++) {
    const z = za + ((zb - za) * k) / 5;
    box(rx - 0.025, rx + 0.025, 0, 1.0, z - 0.025, z + 0.025, iron);
  }
}
// Rechnung der Uhr (Paul Behrens): Sonnenzeiger einmal in 24 h (gesetzliche Zeit), Mond 6705:6940, Sternscheibe 366¼:365¼
export const CKR = { MR: 6705 / 6940, MC: (19 * 365.25) / 235, REF: Date.UTC(2025, 10, 5, 13, 19) };
export const CK_W = [36.7, 27.9, 20.1, 35.7, 44.1, 23.0, 6.7, 18.6, 33.4, 27.9, 24.2, 37.2, 24.7];
export const CK_N = [
  'stier',
  'zwilling',
  'krebs',
  'loewe',
  'jungfrau',
  'waage',
  'skorpion',
  'schlangentraeger',
  'schuetze',
  'steinbock',
  'wassermann',
  'fische',
  'widder',
];
const CK_TW = [-1, -3, -4.3, -6.1, 0, 4, -12, -3, -2.5, 2, 0, -2.7, -1.5];
const CK_SC = [10, 7, 6, 8, 7.5, 8, 0.01, 6, 6, 6, 9, 10, 6],
  CK_RO = [-0.085, 0.035, 0.032, -0.085, 0.035, -0.05, 0, -0.07, 0.03, -0.015, -0.05, -0.08, 0.03];
const CK_ANG = CK_W.map((w, k) => {
  let s = 0;
  for (let j = 0; j < k; j++) s += j === 0 ? CK_W[0] / 2 : CK_W[j];
  return (-90 - (k ? s + w / 2 : 0) + CK_TW[k]) * rad;
});
export const CK_DE = {
  stier: 'Stier',
  zwilling: 'Zwillinge',
  krebs: 'Krebs',
  loewe: 'Löwe',
  jungfrau: 'Jungfrau',
  waage: 'Waage',
  skorpion: 'Skorpion',
  schlangentraeger: 'Schlangenträger',
  schuetze: 'Schütze',
  steinbock: 'Steinbock',
  wassermann: 'Wassermann',
  fische: 'Fische',
  widder: 'Widder',
};
export const CK_EN = {
  stier: 'Taurus',
  zwilling: 'Gemini',
  krebs: 'Cancer',
  loewe: 'Leo',
  jungfrau: 'Virgo',
  waage: 'Libra',
  skorpion: 'Scorpius',
  schlangentraeger: 'Ophiuchus',
  schuetze: 'Sagittarius',
  steinbock: 'Capricornus',
  wassermann: 'Aquarius',
  fische: 'Pisces',
  widder: 'Aries',
};
// Grenzen der Sternbilder auf der Ekliptik (IAU, J2000), Beginn in Grad Länge
export const CK_IAU = [
  ['widder', 29.09],
  ['stier', 53.47],
  ['zwilling', 90.43],
  ['krebs', 118.26],
  ['loewe', 138.18],
  ['jungfrau', 174.15],
  ['waage', 218.02],
  ['skorpion', 241.13],
  ['schlangentraeger', 247.7],
  ['schuetze', 266.28],
  ['steinbock', 299.68],
  ['wassermann', 327.87],
  ['fische', 351.57],
];
// Kalenderscheibe: 366 Tageszeilen (der 29. Februar steht immer darauf). Ungedreht steht der 3. Juni (Zeile 154) am Zeiger.
// Die Zeilen des Fotos sind nicht ganz gleichmäßig verteilt; Korrektur in Tagen, an den Monatsersten abgelesen.
const CK_CAL = [
  [0, -3],
  [31, -2],
  [60, -1],
  [91, 0],
  [121, 0],
  [152, 0],
  [182, 0],
  [213, -1],
  [244, -2],
  [302, -3],
  [334, -3],
  [366, -3],
];
function ckCalAngle(ix) {
  let k = 0;
  while (k < CK_CAL.length - 2 && ix > CK_CAL[k + 1][0]) k++;
  const a = CK_CAL[k],
    b = CK_CAL[k + 1],
    d = a[1] + ((b[1] - a[1]) * (ix - a[0])) / (b[0] - a[0]);
  return ((ix - 154 - d) * 2 * Math.PI) / 366;
}
export const ckLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function ckDoy(y, m, d) {
  return Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
}
function ckState(utc) {
  const off = berlinOffsetMin(utc),
    l = new Date(utc + off * 60000),
    y = l.getUTCFullYear(),
    mo = l.getUTCMonth(),
    d = l.getUTCDate(),
    TP = 2 * Math.PI;
  const hrs = l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600,
    aSun = (hrs / 24) * TP - 1.5 * Math.PI;
  const days = (utc - CKR.REF) / 864e5;
  let age = (CKR.MC / 2 + days) % CKR.MC;
  if (age < 0) age += CKR.MC;
  const md = (((Math.PI + days * TP * (CKR.MR - 1)) % TP) + TP) % TP;
  const N = ckLeap(y) ? 366 : 365,
    doy = ckDoy(y, mo, d);
  return {
    utc,
    off,
    y,
    mo,
    d,
    hrs,
    aSun,
    aMoon: aSun + md,
    md,
    age,
    aZod: ((doy - ckDoy(y, 5, 2)) / N) * TP + aSun + Math.PI / 2,
    aCal: ckCalAngle(doy - 1 + (N === 365 && mo >= 2 ? 1 : 0)),
    doy,
    N,
  };
}
function ckDraw(st) {
  const g = clk.ctx,
    S = 1024,
    L = S / 0.888,
    c = S / 2,
    rL = L * 0.37,
    rO = rL * 1.12,
    rS = L * 0.32,
    rM = (rL + rS) / 2,
    I = clk.img,
    TP = 2 * Math.PI;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.save();
  g.translate(c, c);
  g.beginPath();
  g.arc(0, 0, rO, 0, TP);
  g.arc(0, 0, rL * 1.005, 0, TP, true);
  g.fillStyle = '#6d87a5';
  g.fill();
  g.strokeStyle = 'gold';
  g.lineWidth = 2;
  for (const r of [rO, rL * 1.005]) {
    g.beginPath();
    g.arc(0, 0, r, 0, TP);
    g.stroke();
  }
  if (I.ziffer) {
    const s = rL * 2.4;
    g.drawImage(I.ziffer, -s / 2, -s / 2, s, s);
  }
  g.save();
  g.rotate(st.aZod);
  if (I.stern) g.drawImage(I.stern, -rL, -rL, 2 * rL, 2 * rL);
  else {
    g.beginPath();
    g.arc(0, 0, rL, 0, TP);
    g.fillStyle = '#1d3d78';
    g.fill();
  }
  const fs = L * 0.02,
    rb = rS * 0.8;
  CK_N.forEach((n, k) => {
    const im = I['z_' + n];
    if (!im || CK_SC[k] < 0.1) return;
    const rp = rb + rS * CK_RO[k],
      s = fs * CK_SC[k];
    g.save();
    g.translate(Math.cos(CK_ANG[k]) * rp, Math.sin(CK_ANG[k]) * rp);
    g.rotate(-st.aZod);
    g.drawImage(im, -s / 2, -s / 2, s, s);
    g.restore();
  });
  g.restore();
  // Zeiger kräftiger als in der App gezeichnet, damit sie im Raum aus einigen Metern Abstand erkennbar bleiben
  const ptr = (a, len, w) => {
    g.save();
    g.rotate(a);
    const gr = g.createLinearGradient(0, -w, 0, w);
    gr.addColorStop(0, '#fff0b0');
    gr.addColorStop(0.5, '#d6a23a');
    gr.addColorStop(1, '#7a5512');
    g.beginPath();
    g.moveTo(-len * 0.1, -w);
    g.lineTo(len, -w * 0.35);
    g.lineTo(len, w * 0.35);
    g.lineTo(-len * 0.1, w);
    g.closePath();
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(60,40,8,.75)';
    g.lineWidth = 1.3;
    g.stroke();
    g.restore();
  };
  ptr(st.aSun, rL * 0.96, L * 0.009);
  {
    const s = L * 0.1,
      r = rL * 1.13 - s / 2;
    g.save();
    g.rotate(st.aSun);
    if (I.sonne) g.drawImage(I.sonne, r - s / 2, -s / 2, s, s);
    else {
      g.beginPath();
      g.arc(r, 0, s / 2, 0, TP);
      g.fillStyle = 'gold';
      g.fill();
    }
    g.restore();
  }
  {
    const r = L * 0.022,
      ph = st.age / CKR.MC,
      wax = ph < 0.5,
      x = Math.cos(st.aMoon) * rM,
      y = Math.sin(st.aMoon) * rM,
      hx = -r * 0.35,
      hy = -r * 0.35;
    const gold = g.createRadialGradient(hx, hy, r * 0.05, 0, 0, r * 1.05);
    gold.addColorStop(0, '#FFF3C4');
    gold.addColorStop(0.35, '#FFD866');
    gold.addColorStop(0.7, '#D4A017');
    gold.addColorStop(1, '#8A6A14');
    const dark = g.createRadialGradient(hx * 0.5, hy * 0.5, r * 0.05, 0, 0, r * 1.05);
    dark.addColorStop(0, '#3A3D44');
    dark.addColorStop(0.6, '#22242A');
    dark.addColorStop(1, '#131418');
    const lf = wax ? dark : gold,
      rf = wax ? gold : dark,
      ef = wax ? (ph < 0.25 ? dark : gold) : ph < 0.75 ? gold : dark;
    g.save();
    g.translate(x, y);
    g.rotate(st.aMoon + Math.PI / 2);
    g.beginPath();
    g.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5);
    g.fillStyle = lf;
    g.fill();
    g.beginPath();
    g.arc(0, 0, r, Math.PI * 1.5, Math.PI / 2);
    g.fillStyle = rf;
    g.fill();
    g.beginPath();
    g.ellipse(0, 0, r * Math.abs(Math.cos(ph * TP)), r, 0, 0, TP);
    g.fillStyle = ef;
    g.fill();
    g.beginPath();
    g.arc(0, 0, r, 0, TP);
    g.strokeStyle = 'rgba(255,216,102,0.55)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }
  ptr(st.aMoon, rM * 0.95, L * 0.0075);
  if (I.heiland) {
    const s = L * 0.29;
    g.drawImage(I.heiland, -s / 2, -s / 2, s, s);
  }
  g.restore();
}
export function clockUpdate(utc, force) {
  if (!clk.ctx) return;
  if (utc === undefined || utc === null) utc = clk.lastReq;
  else clk.lastReq = utc;
  if (utc === undefined) return;
  const st = ckState(utc);
  clk.st = st;
  if (clk.cal) clk.cal.rotation.z = -st.aCal;
  {
    const k = 0.22 + 0.78 * smooth(-8, 4, cur.el);
    for (const [m, b] of clk.em) m.emissive.setScalar(b * k);
  } // Eigenhelligkeit (Strahler) tagsüber, nachts gedämpft
  const now = performance.now(),
    stale = force || clk.lastUtc === null || Math.abs(utc - clk.lastUtc) >= 20000;
  if (!stale) clk.pending = false;
  else if (!force && now - clk.lastDraw < 70) clk.pending = true;
  else {
    ckDraw(st);
    clk.tex.needsUpdate = true;
    clk.lastDraw = now;
    clk.lastUtc = utc;
    clk.pending = false;
    requestRender();
  }
  if (typeof updateClockCard === 'function') updateClockCard();
}
