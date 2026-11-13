// Bau der Kirche: Langhaus, Chor, Kapellen, Gewölbe, Dächer, Türme, Dachreiter, Strebewerk, Ausstattung.
import {
  addMesh,
  box,
  boxGeo,
  building,
  D,
  lancet,
  mergeGeos,
  mullionGeos,
  occluders,
  P,
  polyGeo,
  scaleUV,
  W,
  wall,
  windows,
} from './geometry.js'; // Aufbau-Reihenfolge: nach model/geometry
import { V3 } from '../three-global.js';
import { step } from '../core/loader.js';
import { tr } from '../core/i18n.js';
import {
  AMB,
  AMB_N,
  APSE_GAL,
  APSE_WB,
  APSE_WS,
  ARC_SP,
  CHAPELS,
  CHOIR,
  choirOff,
  GK,
  HAN,
  HAS,
  HCS,
  HJ,
  HN,
  HR,
  MT,
  NB,
  offPoly,
  PX,
  SQ3,
  TW,
  X0,
  XC,
  XT,
  XW,
  ZAN,
  ZAS,
  ZCS,
  ZKN,
  ZN,
  ZNF,
  ZSI,
  SV_IN,
} from './measures.js';
import { cutPlane, scene } from '../scene/renderer.js';
import { brickCol, brickTex, canvasTex, rng, vaultTex } from '../scene/textures.js';
import { enhance } from '../scene/shaders.js';
import {
  arcadeMat,
  darkMat,
  darkRoofMat,
  floorMat,
  goldMat,
  graniteMat,
  groundMat,
  lin,
  mullionMat,
  revealMat,
  roofMat,
  stoneLedgeMat,
  towerMatW,
  wallMat,
  woodMat,
} from '../scene/materials.js';

await step(tr('Kirche wird aufgebaut', 'Building the church'), 32);
/* ---------------- Bau der Kirche (Maße abgeglichen mit LoD2 2025 und bDOM20 2023) ---------------- */
export const groundMesh = (function () {
  const gg = new THREE.PlaneGeometry(10000, 10000);
  gg.rotateX(-Math.PI / 2);
  const gm = new THREE.Mesh(gg, groundMat);
  gm.receiveShadow = true;
  scene.add(gm);
  return gm;
})();
function floorPoly(pts) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.04, 0);
  addMesh(g, floorMat, false, true);
}
const floorRect = (x0, x1, z0, z1) =>
  floorPoly([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
floorRect(XW, X0, -ZNF, ZNF);
floorRect(GK.x0, GK.x1, GK.z0, GK.z1);
floorRect(X0, XC, -ZAN, 0);
floorRect(X0, CHAPELS[0].x1, 0, ZSI);
floorRect(CHAPELS[0].x1, XT, 0, ZAS);
floorRect(XT, XC, 0, ZCS);
floorRect(X0, XT, -ZKN, -ZAN);
for (const c of CHAPELS) floorRect(c.x0, c.x1, c.s > 0 ? c.zi : -c.zo, c.s > 0 ? c.zo : -c.zi);
floorPoly(AMB);
floorPoly(MT);
const bayMid = i => (PX[i] + PX[i + 1]) / 2,
  bayW = i => PX[i + 1] - PX[i];

// Arkadenwände Mittelschiff und Chor (Pfeiler + Obergaden), 10 Joche nach LoD2
for (const s of [-1, 1]) {
  const ops = [];
  for (let i = 0; i < NB; i++) {
    const u = bayMid(i) - X0,
      bw = bayW(i);
    ops.push(D(u, (bw - 2) / 2, ARC_SP));
    ops.push(W(u, Math.min(1.9, (bw - 2.6) / 2), 29.8, 34.8));
  } // Obergaden bis ≈38 m (Fotos)
  wall([X0, s * ZN], [XC, s * ZN], { h: HN, t: 1.4, ext: 0.7, openings: ops, mat: arcadeMat });
}
// Obergaden innen (Fotos aus dem Mittelschiff): unter jedem Fenster eine Blende bis zum Ornamentfries bei 21,4 m,
// die Pfosten laufen herunter, unten je drei gemalte Heilige unter Baldachinen
{
  const Y0 = 21.6,
    Y1 = 29.8,
    mk = (w, h, draw) => {
      const m = enhance(
        new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw, [1, 1]), roughness: 0.9, side: THREE.DoubleSide }),
        {},
      );
      return m;
    };
  const nicheMat = mk(256, 512, (g, w, h) => {
    const r = rng(31);
    g.fillStyle = '#e6e0d4';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,110,92,.28)';
    g.lineWidth = 1;
    for (let y = 8; y < h; y += 17) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      for (let x = (((y / 17) | 0) % 2) * 20; x < w; x += 40) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 17);
        g.stroke();
      }
    }
    g.fillStyle = '#8a4a38';
    g.fillRect(0, 0, 7, h);
    g.fillRect(w - 7, 0, 7, h);
    g.fillStyle = '#2f3433';
    g.fillRect(9, 0, 5, h);
    g.fillRect(w - 14, 0, 5, h);
    const lane = (w - 28) / 3,
      robes = ['#9a4632', '#5d6f58', '#a8743c', '#7a3a2e', '#55617a', '#8c5a3a'];
    for (let k = 0; k < 3; k++) {
      const x0 = 14 + k * lane,
        cx = x0 + lane / 2;
      if (k > 0) {
        g.fillStyle = '#2f3433';
        g.fillRect(x0 - 3, 0, 6, h);
      }
      // Baldachin
      g.fillStyle = 'rgba(120,128,110,.85)';
      g.fillRect(cx - lane * 0.36, h * 0.5, lane * 0.72, h * 0.08);
      g.fillStyle = 'rgba(176,120,70,.85)';
      for (const dx of [-0.26, 0, 0.26]) {
        g.fillRect(cx + dx * lane - 5, h * 0.4, 10, h * 0.1);
        g.beginPath();
        g.moveTo(cx + dx * lane - 7, h * 0.4);
        g.lineTo(cx + dx * lane, h * 0.36);
        g.lineTo(cx + dx * lane + 7, h * 0.4);
        g.fill();
      }
      g.strokeStyle = 'rgba(90,60,40,.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - lane * 0.34, h * 0.6);
      g.quadraticCurveTo(cx, h * 0.53, cx + lane * 0.34, h * 0.6);
      g.stroke();
      // Figur mit Nimbus
      const rb = robes[(k + ((r() * 6) | 0)) % robes.length];
      g.fillStyle = 'rgba(200,160,80,.85)';
      g.beginPath();
      g.arc(cx, h * 0.655, lane * 0.14, 0, 7);
      g.fill();
      g.fillStyle = '#d8bfa4';
      g.beginPath();
      g.arc(cx, h * 0.66, lane * 0.085, 0, 7);
      g.fill();
      g.fillStyle = rb;
      g.beginPath();
      g.moveTo(cx - lane * 0.12, h * 0.69);
      g.lineTo(cx + lane * 0.12, h * 0.69);
      g.lineTo(cx + lane * 0.24, h * 0.95);
      g.lineTo(cx - lane * 0.24, h * 0.95);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(40,30,25,.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx, h * 0.7);
      g.lineTo(cx + lane * 0.04, h * 0.94);
      g.stroke();
      g.fillStyle = 'rgba(60,50,40,.55)';
      g.fillRect(cx + lane * 0.15, h * 0.7, 3, h * 0.2);
    }
    g.fillStyle = 'rgba(140,90,70,.35)';
    g.fillRect(0, h * 0.965, w, h * 0.035);
  });
  const friezeMat = mk(256, 32, (g, w, h) => {
    g.fillStyle = '#d9cfbf';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8e4630';
    g.fillRect(0, 0, w, 4);
    g.fillRect(0, h - 4, w, 4);
    g.strokeStyle = '#4f6a52';
    g.lineWidth = 3;
    for (let x = 0; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x + 4, 6);
      g.lineTo(x + 28, h - 6);
      g.moveTo(x + 28, 6);
      g.lineTo(x + 4, h - 6);
      g.stroke();
    }
    g.fillStyle = '#a8402c';
    for (let x = 16; x < w; x += 32) {
      g.beginPath();
      g.arc(x, h / 2, 4, 0, 7);
      g.fill();
    }
  });
  const ng = [],
    fg = [];
  for (const s of [-1, 1]) {
    const zf = s * (ZN - 0.71);
    for (let i = 0; i < NB; i++) {
      const u = bayMid(i),
        bw = bayW(i),
        hw = Math.min(1.9, (bw - 2.6) / 2) + 0.2;
      const p = new THREE.PlaneGeometry(2 * hw, Y1 - Y0);
      if (s > 0) p.rotateY(Math.PI);
      p.translate(u, (Y0 + Y1) / 2, zf);
      ng.push(p);
    }
    const L = XC - X0,
      f = new THREE.PlaneGeometry(L, 0.42);
    scaleUV(f, L / 1.6, 1);
    if (s > 0) f.rotateY(Math.PI);
    f.translate((X0 + XC) / 2, Y0 - 0.21, zf + 0.005 * -s);
    fg.push(f);
  }
  const m1 = new THREE.Mesh(mergeGeos(ng), nicheMat),
    m2 = new THREE.Mesh(mergeGeos(fg), friezeMat);
  m1.receiveShadow = m2.receiveShadow = true;
  building.add(m1);
  building.add(m2);
}
// Binnenchor: drei Seiten des Achtecks (Grundriss), Arkaden zum Umgang, je ein hohes Obergadenfenster (Drohnenfoto von Osten)
for (let k = 0; k < 3; k++) {
  const a = CHOIR[k],
    b = CHOIR[k + 1],
    Lw = Math.hypot(b[0] - a[0], b[1] - a[1]);
  wall(a, b, {
    h: HN,
    t: 1.4,
    ext: 0.35,
    mat: arcadeMat,
    openings: [
      D(Lw / 2, Math.min(1.7, (Lw - 1.6) / 2), 13.6),
      W(Lw / 2, Math.min(1.5, (Lw - 2.2) / 2), APSE_WB, APSE_WS),
    ],
  });
}
// Chorschluss innen (Fotos aus dem Mittelschiff): Laufgang mit Maßwerkbrüstung über den Arkaden, darüber Blendmaßwerk bis zu den Fenstern
{
  const ci = choirOff(-0.72),
    mk = draw => {
      const m = new THREE.MeshStandardMaterial({
        map: canvasTex(256, 128, draw, [1, 1]),
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      m.clippingPlanes = [cutPlane];
      return m;
    };
  const balMat = mk((g, w, h) => {
    g.fillStyle = '#d9d0c2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a3a32';
    for (let x = 32; x < w; x += 64) {
      for (const [dx, dy] of [
        [0, -14],
        [14, 0],
        [0, 14],
        [-14, 0],
      ]) {
        g.beginPath();
        g.arc(x + dx, 64 + dy, 12, 0, 7);
        g.fill();
      }
    }
    g.fillStyle = '#b9ad9c';
    g.fillRect(0, 0, w, 14);
    g.fillRect(0, h - 12, w, 12);
    for (let x = 0; x <= w; x += 64) g.fillRect(x - 3, 0, 6, h);
  });
  const blendMat = mk((g, w, h) => {
    g.fillStyle = '#d6ccbc';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8f5340';
    g.lineWidth = 6;
    for (let x = 0; x < w; x += 42) {
      g.beginPath();
      g.moveTo(x + 6, h);
      g.lineTo(x + 6, 40);
      g.quadraticCurveTo(x + 21, 4, x + 36, 40);
      g.lineTo(x + 36, h);
      g.stroke();
    }
  });
  const bg = [],
    lg = [];
  for (let k = 0; k < 3; k++) {
    const a = ci[k],
      b = ci[k + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      cx = (a[0] + b[0]) / 2,
      cz = (a[1] + b[1]) / 2,
      ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const p1 = new THREE.PlaneGeometry(L, 1.2);
    scaleUV(p1, L / 2.4, 1);
    p1.rotateY(ang);
    p1.translate(cx, APSE_GAL + 0.6, cz);
    bg.push(p1);
    const p2 = new THREE.PlaneGeometry(L, APSE_WB - APSE_GAL - 1.2);
    scaleUV(p2, L / 1.8, 1);
    p2.rotateY(ang);
    p2.translate(cx, (APSE_GAL + 1.2 + APSE_WB) / 2, cz);
    lg.push(p2);
  }
  const m1 = new THREE.Mesh(mergeGeos(bg), balMat),
    m2 = new THREE.Mesh(mergeGeos(lg), blendMat);
  m1.receiveShadow = m2.receiveShadow = true;
  building.add(m1);
  building.add(m2);
}

// Nördliches Seitenschiff: Langhaus mit niedriger Kapellenreihe davor, im Chor Öffnungen zu Totentanz- und Chorkapellen
{
  const ops = [];
  for (let i = 0; i < NB; i++) {
    const u = bayMid(i) - X0,
      bw = bayW(i);
    if (PX[i] < XT - 0.1) {
      ops.push(D(u, Math.min(2.3, (bw - 1.8) / 2), 3.6));
      ops.push(W(u, 1.8, 11.0, 16.6));
    } else ops.push(D(u, (bw - 1.8) / 2, PX[i] < 14 ? 13.0 : 11.0));
  }
  wall([X0, -ZAN], [XC, -ZAN], { h: HAN, t: 1.2, ext: 0.6, openings: ops });
}
// Südliches Seitenschiff, Langhaus. Nach dem Grundriss liegt die Seitenschiffwand bei z = 17,3; dahinter in den beiden
// westlichen Jochen die Briefkapelle, in den übrigen vier Jochen Kapellen zwischen den Strebepfeilern (Warendorp-, Stotebrügge-,
// Segeberg-, Divessen-Kapelle). Die Außenwand bei z = 21,2 (LoD2) trägt die Kapellenfenster.
{
  const ops = [],
    bx = CHAPELS[0].x1;
  for (let i = 0; i < 6; i++) {
    const a = PX[i],
      b = PX[i + 1];
    if (b <= bx + 0.01) continue;
    else if (a < bx) {
      ops.push(W((bx + b) / 2 - bx, Math.min(1.9, (b - bx - 1.6) / 2), 5, 14.0));
    } else ops.push(W((a + b) / 2 - bx, 1.9, 5, 14.0));
  }
  wall([bx, ZAS], [XT, ZAS], { h: HAS, t: 1.2, ext: 0.6, openings: ops });
  wall([X0, ZAS], [bx, ZAS], { y0: 12.6, h: HAS - 12.6, t: 1.2, ext: 0.6 }); // über dem Dach der Briefkapelle
  const iops = [];
  for (let i = 0; i < 6; i++) {
    const a = PX[i],
      b = PX[i + 1];
    if (b <= bx + 0.01) {
      if (i === 1) iops.push(D((a + b) / 2 - X0, 1.3, 3.6));
    } // Tür zur Briefkapelle
    else {
      const aa = Math.max(a, bx);
      iops.push(D((aa + b) / 2 - X0, Math.min(2.3, (b - aa - 2.0) / 2), 11.2));
    }
  }
  wall([X0, ZSI], [XT, ZSI], { h: HAS - 0.5, t: 1.2, ext: 0.6, openings: iops });
  // Strebepfeiler zwischen den Kapellen (innen), Kapellengewölbe
  for (let i = 3; i < 6; i++) box(PX[i] - 0.8, PX[i] + 0.8, 0, 19.6, ZSI + 0.6, ZAS - 0.6);
}
// Südliches Chorseitenschiff: Öffnungen zu Südvorhalle und Bürgermeisterkapelle
{
  const ops = [];
  for (let i = 6; i < NB; i++) ops.push(D(bayMid(i) - XT, (bayW(i) - 1.8) / 2, 11.0));
  wall([XT, ZCS], [XC, ZCS], { h: HCS, t: 1.2, ext: 0.6, openings: ops });
}
// Übergang Chorseitenschiffe -> Umgang

// Niedrige Kapellenreihe an der Nordseite des Langhauses
{
  const ops = [];
  for (let i = 0; i < 6; i++) ops.push(W(bayMid(i) - X0, 1.25, 1.6, 4.6));
  wall([X0, -ZKN], [XT, -ZKN], { h: 8.1, t: 1.0, ext: 0.5, openings: ops });
  addMesh(
    polyGeo([
      [
        P(X0 - 0.3, 9.3, -(ZAN + 0.6)),
        P(XT, 9.3, -(ZAN + 0.6)),
        P(XT, 8.1, -(ZKN + 0.7)),
        P(X0 - 0.3, 8.1, -(ZKN + 0.7)),
      ],
    ]),
    roofMat,
  );
  box(X0 + 0.3, XT, 7.6, 7.85, -(ZKN - 0.5), -(ZAN + 0.6));
}
// Chorumgang mit Kapellenkranz
// (Grundriss 1906: je Seite eine schräge Wand und eine dreiseitige Kapelle, alle Wände mit hohen Fenstern; nach Osten offen zur Marientidenkapelle)
for (let k = 0; k < AMB.length - 1; k++) {
  if (k === 4) continue;
  const a = AMB[k],
    b = AMB[k + 1],
    Lw = Math.hypot(b[0] - a[0], b[1] - a[1]);
  wall(a, b, { h: HCS, t: 1.2, ext: 0.45, openings: [W(Lw / 2, Math.min(1.5, (Lw - 2.0) / 2), 4.5, 16.6)] });
}
// Dächer des Kapellenkranzes (Drohnenfoto von Osten): Pultdach an der schrägen Wand, Kapelle mit radialem First und Walm,
// dazwischen Kehlen; First an der Chorwand unter den Obergadenfenstern
const MT_APEX = 31.0,
  HRC = APSE_WB - 0.4; // Dächer des Kapellenkranzes enden unter den tiefer sitzenden Chorfenstern
const nrm2 = (x, z) => {
  const l = Math.hypot(x, z);
  return [x / l, z / l];
};
const AMB_BN = (function () {
  const [, P1, P2, P3] = AMB_N,
    e1 = [P2[0] - P1[0], P2[1] - P1[1]],
    e2 = [P3[0] - P2[0], P3[1] - P2[1]],
    n1 = nrm2(e1[1], -e1[0]),
    n2 = nrm2(e2[1], -e2[0]);
  return {
    1: nrm2(P1[0] - CHOIR[0][0], P1[1] - CHOIR[0][1]),
    2: nrm2(n1[0] + n2[0], n1[1] + n2[1]),
    3: nrm2(P3[0] - CHOIR[1][0], P3[1] - CHOIR[1][1]),
  };
})();
function AMB_ROOF(s) {
  const m = -s,
    q = (p, y) => P(p[0], y, m * p[1]);
  const ao = offPoly(AMB, 0.7, [0, -1], [0, 1], false).slice(0, 5);
  ao[0] = [XC, -(ZAN + 0.8)];
  const [, , P2, P3] = AMB_N,
    mid = [(P2[0] + P3[0]) / 2, (P2[1] + P3[1]) / 2],
    e = nrm2(P3[0] - P2[0], P3[1] - P2[1]),
    d = [-e[1], e[0]]; // d: nach innen
  const co = choirOff(0.7),
    A = co[0],
    B = co[1],
    bx = B[0] - A[0],
    bz = B[1] - A[1],
    den = d[0] * bz - d[1] * bx;
  const t = ((A[0] - mid[0]) * bz - (A[1] - mid[1]) * bx) / den,
    Rin = [mid[0] + d[0] * t, mid[1] + d[1] * t],
    Rout = [mid[0] + d[0] * 4.9, mid[1] + d[1] * 4.9];
  const mo = offPoly(MT, 0.7, null, null, true),
    Wn = [MT[0][0], mo[0][1]],
    e0 = [co[1][0] - 0.3, -0.1];
  const H = HCS,
    f = [];
  f.push([q(ao[0], H), q(ao[1], H), q(Rin, HRC)], [q(ao[0], H), q(Rin, HRC), q([XC, -ZNF], HJ)]);
  f.push(
    [q(ao[1], H), q(ao[2], H), q(Rout, HRC)],
    [q(ao[1], H), q(Rout, HRC), q(Rin, HRC)],
    [q(ao[2], H), q(ao[3], H), q(Rout, HRC)],
  );
  f.push([q(ao[3], H), q(ao[4], H), q(Rin, HRC)], [q(ao[3], H), q(Rin, HRC), q(Rout, HRC)]);
  f.push([q(ao[4], H), q(Wn, 21.9), q(Rin, HRC)], [q(Wn, 21.9), P(e0[0], HRC, e0[1]), q(Rin, HRC)]);
  return f;
}
// Westwand zwischen den Türmen: Portal, Westfenster, Giebel
wall([XW, -ZNF], [XW, ZNF], {
  h: HN,
  t: 1.2,
  ext: 0.9,
  mat: towerMatW,
  openings: [D(ZNF, 2.2, 5.5), W(ZNF, 1.9, 10.5, 19.4, 0)],
  top: [
    [2 * ZNF + 0.9, HN],
    [ZNF, HR],
    [-0.9, HN],
  ],
}); // Westfenster nach Foto: 3,8 × 12,2 m

// Kreuzrippengewölbe (nach Innenfotos): bemalte Kappen, rote Rippen, Schlusssteine; Seitenschiffe ebenso
const VSP_N = 31.0,
  VCR_N = 38.5,
  VSP_A = 13.5,
  VCR_A = 20.4;
const vf = t => Math.sqrt(Math.max(0, 1 - t * t));
const vaultGeos = [],
  ribGeos = [],
  keyGeos = [];
function tube(pts, r) {
  ribGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r, 6, false));
}
function bayVault(xa, xb, za, zb, sp, cr, o) {
  o = o || {};
  const xm = (xa + xb) / 2,
    zm = (za + zb) / 2,
    hx = (xb - xa) / 2,
    hz = (zb - za) / 2,
    NX = 24,
    NZ = 24,
    rr = o.rib || 0.16;
  const hy = (x, z) => sp + (cr - sp) * Math.max(vf((z - zm) / hz), vf((x - xm) / hx));
  const pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= NZ; j++)
    for (let i = 0; i <= NX; i++) {
      const x = xa + (2 * hx * i) / NX,
        z = za + (2 * hz * j) / NZ;
      pos.push(x, hy(x, z), z);
      uv.push(x / 3, z / 3);
    }
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i,
        b = a + 1,
        c = a + NX + 1,
        d = c + 1;
      if ((i - NX / 2 + 0.5) * (j - NZ / 2 + 0.5) > 0) {
        idx.push(a, c, d, a, d, b);
      } else {
        idx.push(a, c, b, b, c, d);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  vaultGeos.push(g);
  const N = 14,
    dy = -0.14;
  for (const [cx, cz] of [
    [xa, za],
    [xb, za],
    [xa, zb],
    [xb, zb],
  ]) {
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N,
        x = cx + (xm - cx) * t,
        z = cz + (zm - cz) * t;
      pts.push(P(x, hy(x, z) + dy, z));
    }
    tube(pts, rr);
  }
  if (!o.noWest) {
    const pts = [];
    for (let k = 0; k <= N * 2; k++) {
      const z = za + ((zb - za) * k) / (N * 2);
      pts.push(P(xa, hy(xa, z) + dy, z));
    }
    tube(pts, rr * 1.15);
  }
  if (o.east) {
    const pts = [];
    for (let k = 0; k <= N * 2; k++) {
      const z = za + ((zb - za) * k) / (N * 2);
      pts.push(P(xb, hy(xb, z) + dy, z));
    }
    tube(pts, rr * 1.15);
  }
  for (const zz of [za, zb]) {
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const x = xa + ((xb - xa) * k) / N;
      pts.push(P(x, hy(x, zz) + dy, zz));
    }
    tube(pts, rr * 0.7);
  }
  const kg = new THREE.CylinderGeometry(rr * 3.4, rr * 3.4, 0.14, 20);
  kg.translate(xm, cr - 0.12, zm);
  keyGeos.push(kg);
}
// Mittelschiff: Turmhalle + 10 Joche; Seitenschiffe je Joch
bayVault(XW + 0.6, X0, -ZNF, ZNF, VSP_N, VCR_N, { rib: 0.17 });
for (let i = 0; i < NB; i++)
  bayVault(PX[i], PX[i + 1], -(ZN - 0.7), ZN - 0.7, VSP_N, VCR_N, { rib: 0.17, east: i === NB - 1 });
for (let i = 0; i < NB; i++) {
  bayVault(PX[i], PX[i + 1], -(ZAN - 0.6), -(ZN + 0.7), VSP_A, VCR_A, { rib: 0.13, east: i === NB - 1 });
  bayVault(PX[i], PX[i + 1], ZN + 0.7, (i < 6 ? ZSI : ZCS) - 0.6, VSP_A, VCR_A, { rib: 0.13, east: i === NB - 1 });
  if (i >= 2 && i < 6)
    bayVault(
      i === 2 ? CHAPELS[0].x1 + 0.5 : PX[i] + 0.8,
      PX[i + 1] - (i === 5 ? 0.5 : 0.8),
      ZSI + 0.6,
      ZAS - 0.6,
      13.2,
      18.6,
      { rib: 0.11, east: true },
    ); // Kapellen zwischen den Strebepfeilern
}
// Chorpolygon: Fächergewölbe mit Rippen zu den Polygonecken
{
  const CI = choirOff(-0.7),
    NR = 12,
    NS = 8,
    pos = [],
    uv = [],
    idx = [];
  let cols;
  const bnd = [];
  for (let k = 0; k < 3; k++)
    for (let s = 0; s < (k === 2 ? NS + 1 : NS); s++) {
      const a = CI[k],
        b = CI[k + 1],
        t = s / NS;
      bnd.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  cols = bnd.length;
  for (let j = 0; j <= NR; j++) {
    const r = j / NR;
    for (const p of bnd) {
      const x = XC + (p[0] - XC) * r,
        z = p[1] * r,
        y = VSP_N + (VCR_N - VSP_N) * vf(r);
      pos.push(x, y, z);
      uv.push(x / 3, z / 3);
    }
  }
  for (let j = 0; j < NR; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  vaultGeos.push(g);
  for (const v of [
    CI[1],
    CI[2],
    [(CI[0][0] + CI[1][0]) / 2, (CI[0][1] + CI[1][1]) / 2],
    [(CI[2][0] + CI[3][0]) / 2, (CI[2][1] + CI[3][1]) / 2],
  ]) {
    const pts = [];
    for (let k = 0; k <= 14; k++) {
      const r = 1 - k / 14;
      pts.push(P(XC + (v[0] - XC) * r, VSP_N + (VCR_N - VSP_N) * vf(r) - 0.14, v[1] * r));
    }
    tube(pts, 0.17);
  }
}
const vaultMat = enhance(
  new THREE.MeshStandardMaterial({ map: vaultTex, roughness: 0.92, side: THREE.DoubleSide }),
  {},
);
const ribMat = enhance(new THREE.MeshStandardMaterial({ color: 0x9a4630, roughness: 0.8 }), {});
const keyMat = enhance(new THREE.MeshStandardMaterial({ color: 0xc79a3e, roughness: 0.45, metalness: 0.25 }), {});
{
  const vm = addMesh(mergeGeos(vaultGeos), vaultMat);
  occluders.splice(occluders.indexOf(vm), 1);
} // nicht in die Strahlprüfung (nur innen sichtbar)
addMesh(mergeGeos(ribGeos), ribMat, false);
addMesh(mergeGeos(keyGeos), keyMat, false);
// Umgang: flache Decke wie bisher
{
  const ci = choirOff(0.7),
    out = AMB.concat([[XC, ZN + 0.7]], ci.slice(1, 3).reverse(), [[XC, -(ZN + 0.7)]]);
  const s = new THREE.Shape();
  out.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 20.5, 0);
  addMesh(g, wallMat);
}
// Dienste (rote Wandvorlagen an den Pfeilern), Zuganker und Hängeleuchten
{
  const dg = [],
    ig = [];
  // Bündelpfeiler (Fotos aus dem Mittelschiff): an jeder Pfeilerfläche ein kräftiger Rundstab in der Achse, zwei
  // schlankere daneben, an den Kanten zum Arkadenbogen je ein Eckrundstab mit Kapitellring auf Kämpferhöhe.
  const shaft = (x, z, r, y0, y1, into) => {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, 12, 1, false, Math.PI, Math.PI);
    g.rotateY(into > 0 ? 0 : Math.PI); // offene Seite zur Wand
    g.translate(x, (y0 + y1) / 2, z);
    dg.push(g);
  };
  const ring = (x, z, r, y) => {
    const g = new THREE.CylinderGeometry(r, r, 0.3, 12, 1, false, Math.PI, Math.PI);
    g.rotateY(Math.PI);
    g.translate(x, y, z);
    dg.push(g);
  };
  for (let i = 1; i < NB; i++)
    for (const s of [-1, 1]) {
      const zf = s * (ZN - 0.7), // Pfeilerfläche zum Mittelschiff
        za = s * (ZN + 0.7), // zum Seitenschiff
        top = VSP_N - 0.6;
      for (const [dx, r] of [
        [0, 0.26],
        [-0.46, 0.15],
        [0.46, 0.15],
      ]) {
        shaft(PX[i] + dx, zf, r, 0, top, -s);
        ring(PX[i] + dx, zf, r + 0.09, top + 0.15);
      }
      for (const dx of [-0.82, 0.82]) {
        shaft(PX[i] + dx, zf, 0.19, 0, ARC_SP - 0.4, -s);
        ring(PX[i] + dx, zf, 0.28, ARC_SP - 0.25);
      }
      // Seitenschiffseite: Rundstab bis unter das Seitenschiffgewölbe, Eckrundstäbe bis zum Kämpfer
      shaft(PX[i], za, 0.22, 0, VSP_A - 0.5, s);
      ring(PX[i], za, 0.31, VSP_A - 0.35);
      for (const dx of [-0.82, 0.82]) {
        shaft(PX[i] + dx, za, 0.17, 0, ARC_SP - 0.4, s);
        ring(PX[i] + dx, za, 0.26, ARC_SP - 0.25);
      }
      const lamp = new THREE.CylinderGeometry(0.12, 0.15, 0.45, 12);
      lamp.translate(PX[i] + 0.9, 9.6, s * 5.4);
      ig.push(lamp);
      const wire = new THREE.CylinderGeometry(0.012, 0.012, 30.6 - 9.9, 4);
      wire.translate(PX[i] + 0.9, (30.6 + 9.9) / 2, s * 5.4);
      ig.push(wire);
    }
  for (let i = 1; i <= NB; i++) {
    const rod = new THREE.CylinderGeometry(0.045, 0.045, 2 * (ZN - 0.7), 6);
    rod.rotateX(Math.PI / 2);
    rod.translate(PX[i], 30.6, 0);
    ig.push(rod);
    const rod2 = new THREE.CylinderGeometry(0.04, 0.04, 2 * (ZN - 0.7), 6);
    rod2.rotateX(Math.PI / 2);
    rod2.translate(PX[i] + 0.9, 30.6, 0);
    if (i < NB) ig.push(rod2);
  }
  const dienstMat = enhance(new THREE.MeshStandardMaterial({ color: 0x8a3a24, roughness: 0.85 }), {});
  const ironMat = enhance(new THREE.MeshStandardMaterial({ color: 0x232224, roughness: 0.6, metalness: 0.4 }), {});
  {
    const dm = addMesh(mergeGeos(dg), dienstMat);
    occluders.splice(occluders.indexOf(dm), 1);
  }
  addMesh(mergeGeos(ig), ironMat, false);
}

// Dächer: Mittelschiff mit Chorpolygon, Pultdächer der Seitenschiffe, Umgang
{
  const f = [],
    RE = ZNF + 0.2;
  for (const s of [-1, 1]) f.push([P(XW - 0.7, HN, s * RE), P(XC, HN, s * RE), P(XC, HR, 0), P(XW - 0.7, HR, 0)]);
  {
    const co = choirOff(RE - ZN);
    co[0][0] = XC;
    co[3][0] = XC;
    for (let k = 0; k < 3; k++) {
      const a = co[k],
        b = co[k + 1];
      f.push([P(a[0], HN, a[1]), P(b[0], HN, b[1]), P(XC, HR, 0)]);
    }
  }
  f.push([P(X0 - 0.7, HAN, -(ZAN + 0.8)), P(XC, HAN, -(ZAN + 0.8)), P(XC, HJ, -ZNF), P(X0 - 0.7, HJ, -ZNF)]);
  f.push([P(X0 - 0.7, HAS, ZAS + 0.8), P(XT, HAS, ZAS + 0.8), P(XT, HJ, ZNF), P(X0 - 0.7, HJ, ZNF)]);
  f.push([P(XT, SV_IN, ZCS), P(XC, SV_IN, ZCS), P(XC, HJ, ZNF), P(XT, HJ, ZNF)]); // eine Fläche mit Südervorhalle und Bürgermeisterkapelle
  for (const s of [-1, 1]) {
    const r = AMB_ROOF(s);
    r.forEach(t => f.push(t));
  }
  addMesh(polyGeo(f), roofMat);
}

// Kapellen und Vorhallen nach LoD2: Lage, Außenflucht, Traufe, First
function chapel(c) {
  const s = c.s,
    zi = c.zi,
    zo = c.zo,
    Lx = c.x1 - c.x0,
    Lz = zo - zi;
  const rz = c.rzo || zo; // rzo: Dachtraufe weiter innen als die Außenwand (Südervorhalle: gemeinsames Dach mit der Bürgermeisterkapelle, Fassade steht vor)
  const prof =
    c.roof === 'lean'
      ? [
          [zi, c.ridge],
          [rz + 0.6, c.h],
        ]
      : c.roof === 'gableX'
        ? [
            [zi, c.hin],
            [c.zr, c.ridge],
            [rz + 0.6, c.h],
          ]
        : null;
  const yAt = z => {
    if (!prof) return c.h;
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i],
        b = prof[i + 1];
      if (z <= b[0]) return a[1] + ((z - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
    return prof[prof.length - 1][1];
  };
  let top = null;
  if (c.roof === 'gableZ') {
    top = [[Lx + 0.5, c.h]];
    for (let g = c.gables.length - 1; g >= 0; g--) {
      const [a, b] = c.gables[g];
      top.push([b - c.x0, c.h], [(a + b) / 2 - c.x0, c.ridge], [a - c.x0, c.h]);
    }
    top.push([-0.5, c.h]);
  }
  wall([c.x0, s * zo], [c.x1, s * zo], { h: c.h, t: 1.0, ext: 0.5, openings: c.outer || [], top, doorLeaf: true });
  const endTop = prof
    ? [[Lz + 0.5, yAt(zo + 0.5)]]
        .concat(
          prof
            .slice(1)
            .reverse()
            .filter(p => p[0] < zo + 0.5) // Traufe hinter einer vorstehenden Fassade (Südervorhalle) mitnehmen
            .map(p => [p[0] - zi, p[1]]),
        )
        .concat([[-0.6, yAt(zi)]])
    : null;
  // Giebelwände knapp unter der Dachfläche enden lassen (sonst stehen sie bei durchlaufendem Dach als Grat heraus)
  if (endTop) for (const p of endTop) p[1] -= 0.12;
  if (!c.noWest)
    wall([c.x0, s * zi], [c.x0, s * zo], { h: c.h, t: 1.0, ext: 0.5, openings: c.west || [], top: endTop });
  wall([c.x1, s * zi], [c.x1, s * zo], { h: c.h, t: 1.0, ext: 0.5, openings: c.east || [], top: endTop });
  box(c.x0 + 0.4, c.x1 - 0.4, c.ceil, c.ceil + 0.25, s * (zi + 0.6), s * (zo - 0.4));
  const f = [],
    g = [];
  if (prof) {
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i],
        b = prof[i + 1];
      f.push([
        P(c.x0 - 0.6, a[1], s * a[0]),
        P(c.x1 + 0.6, a[1], s * a[0]),
        P(c.x1 + 0.6, b[1], s * b[0]),
        P(c.x0 - 0.6, b[1], s * b[0]),
      ]);
    }
    if (prof[0][1] > HAN) box(c.x0, c.x1, HAN - 0.2, prof[0][1] - 0.45, s * (zi - 0.6), s * (zi + 0.6)); // bleibt unter der Dachfläche
  } else
    for (const [a, b] of c.gables) {
      const m = (a + b) / 2;
      f.push([
        P(a - 0.3, c.h, s * zi),
        P(a - 0.3, c.h, s * (zo + 0.6)),
        P(m, c.ridge, s * (zo + 0.6)),
        P(m, c.ridge, s * zi),
      ]);
      f.push([
        P(b + 0.3, c.h, s * zi),
        P(b + 0.3, c.h, s * (zo + 0.6)),
        P(m, c.ridge, s * (zo + 0.6)),
        P(m, c.ridge, s * zi),
      ]);
      g.push([P(a, c.h, s * zi), P(m, c.ridge, s * zi), P(b, c.h, s * zi)]);
    }
  addMesh(polyGeo(f), roofMat);
  if (g.length) addMesh(polyGeo(g), wallMat);
  if (c.rzo) box(c.x0 - 0.5, c.x1 + 0.5, c.h - 0.05, c.h + 0.12, s * (c.rzo + 0.4), s * (zo + 0.62), roofMat); // Abdeckung der vorstehenden Fassade
}
CHAPELS[0].outer = [
  D(2.92, 1.0, 3.0),
  W(2.92, 1.0, 2.99, 3.0, 2, true),
  W(1.62, 0.72, 6.2, 10.4 - SQ3 * 0.72, 2),
  W(4.22, 0.72, 6.2, 10.4 - SQ3 * 0.72, 2),
  W(8.15, 0.74, 3.6, 11.4 - SQ3 * 0.74, 2),
  W(10.3, 0.74, 3.6, 11.4 - SQ3 * 0.74, 2),
  W(12.45, 0.74, 3.6, 11.4 - SQ3 * 0.74, 2),
]; // Fotos 2026: westliches Joch mit Steinportal und zwei gekuppelten Fenstern darüber, östliches Joch mit drei hohen zweibahnigen Fenstern   // Fenster beiderseits des durchgehenden Strebepfeilers CHAPELS[0].east=[W(2.82,1.15,3.2,8.8,2)];
CHAPELS[1].gables = [
  [XT, PX[7]],
  [PX[7], 15.0],
];
CHAPELS[1].outer = [
  D(3.5, 1.25, 2.96),
  W(3.5, 1.25, 2.95, 2.96, 4, true),
  W(3.5, 1.3, 5.9, 16.0 - SQ3 * 1.3, 6),
  W(10.3, 1.3, 5.9, 16.0 - SQ3 * 1.3, 1),
]; // Fotos innen (2026): Nordportal mit Oberlicht (Lüpertz) im westlichen Joch, darüber das linke Totentanzfenster; beide Fenster ab 5,9 m, Scheitel 16 m
CHAPELS[1].west = [W(5.8, 1.25, 9.0, 13.5)];
CHAPELS[1].east = [D(4.25, 2.5, 10.5)];
CHAPELS[2].outer = [W(3.5, 1.6, 5, 11.5), W(10.3, 1.6, 5, 11.5)];
CHAPELS[2].east = [W(4.3, 1.3, 5, 11.5)];
CHAPELS[3].west = [D(1.85, 1.6, 12.0)];
CHAPELS[3].outer = [
  D(3.5, 1.25, 3.4),
  W(3.5, 1.25, 3.39, 3.4, -1, true),
  W(3.5, 1.75, 8.3, 14.2 - SQ3 * 1.75),
  W(10.9, 1.45, 9.4, 14.0 - SQ3 * 1.45),
]; // Foto 2026: Südportal im westlichen Teil (Südervorhalle) mit großem Fenster darüber, östlich das Fenster der Tesdorpf-Kapelle
CHAPELS[4].west = [D(5.5, 2.2, 9.5)];
CHAPELS[4].outer = [W(3.2, 1.4, 4, 11.0), W(9.4, 1.4, 4, 11.0)];
CHAPELS[4].east = [W(5.5, 1.2, 4, 11)];
CHAPELS.forEach(chapel);
// Fassadendetails nach Fotos (2026): Granitsockel, Gesimse, Bogenfriese, Steinportal der Briefkapelle, Vierpassfries und Portalbogen an der Südervorhalle
{
  const outerZ = c => c.s * (c.zo + 0.5);
  const granite = new THREE.MeshStandardMaterial({ color: lin(0x6d6e69), roughness: 0.9 });
  granite.clippingPlanes = [cutPlane];
  const sg = [],
    lg = [];
  const along = (c, u0, u1, y0, y1, d, arr) => {
    const g = boxGeo(u1 - u0, y1 - y0, d);
    g.translate(c.x0 + (u0 + u1) / 2, (y0 + y1) / 2, outerZ(c) + (c.s * d) / 2);
    arr.push(g);
  };
  for (const c of CHAPELS) {
    const L = c.x1 - c.x0,
      doors = (c.outer || [])
        .filter(o => o.kind === 'door')
        .map(o => [o.u - o.hw - 0.15, o.u + o.hw + 0.15])
        .sort((a, b) => a[0] - b[0]);
    let u = -0.5;
    for (const [d0, d1] of doors.concat([[L + 0.5, L + 0.5]])) {
      if (d0 > u + 0.05) along(c, u, d0, 0, 0.9, 0.14, sg);
      u = d1;
    }
  }
  const BK = CHAPELS[0],
    SV = CHAPELS[3];
  along(BK, 7.4, 14.4, 3.35, 3.55, 0.18, lg); // Sohlbankgesims unter den drei hohen Fenstern
  along(BK, -0.4, 5.85, 5.62, 5.8, 0.2, lg); // Abschluss über dem Steinportal
  addMesh(mergeGeos(sg), granite, false);
  addMesh(mergeGeos(lg), stoneLedgeMat, false);
  // helles Steinportal der Briefkapelle: Quaderfläche mit Spitzbogenöffnung
  {
    const stone = new THREE.MeshStandardMaterial({ color: lin(0xb3aca2), roughness: 0.85, side: THREE.DoubleSide });
    stone.clippingPlanes = [cutPlane];
    const u = 2.92,
      sh = new THREE.Shape();
    sh.moveTo(u - 1.9, 0);
    sh.lineTo(u - 1.9, 5.62);
    sh.lineTo(u + 1.9, 5.62);
    sh.lineTo(u + 1.9, 0);
    const hole = lancet(u, 1.0, 0, 3.0, 10);
    sh.lineTo(hole[hole.length - 1][0], 0);
    for (let i = hole.length - 1; i >= 0; i--) sh.lineTo(hole[i][0], hole[i][1]);
    sh.lineTo(u - 1.9, 0);
    const g = new THREE.ShapeGeometry(sh);
    g.translate(BK.x0, 0, outerZ(BK) + 0.04);
    const m = new THREE.Mesh(g, stone);
    m.receiveShadow = true;
    building.add(m);
    const ring = new THREE.Shape(),
      o = lancet(u, 1.55, 0, 3.0, 12),
      i2 = lancet(u, 1.08, 0, 3.0, 12);
    ring.moveTo(o[0][0], o[0][1]);
    o.slice(1).forEach(q => ring.lineTo(q[0], q[1]));
    for (let i = i2.length - 1; i >= 0; i--) ring.lineTo(i2[i][0], i2[i][1]);
    const rg = new THREE.ShapeGeometry(ring);
    rg.translate(BK.x0, 0, outerZ(BK) + 0.07);
    const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: lin(0x8f897f), roughness: 0.85 }));
    rm.material.clippingPlanes = [cutPlane];
    building.add(rm);
  }
  // Bogenfries unter der Traufe (Briefkapelle, Südervorhalle): Rundbögen im Backstein mit Schatten
  const arcTex = canvasTex(
    128,
    64,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,16,12,.75)';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(14, 64);
      g.lineTo(14, 30);
      g.arc(64, 30, 50, Math.PI, 0);
      g.lineTo(114, 64);
      g.stroke();
      g.fillStyle = 'rgba(30,16,12,.35)';
      g.beginPath();
      g.moveTo(18, 64);
      g.lineTo(18, 32);
      g.arc(64, 32, 46, Math.PI, 0);
      g.lineTo(110, 64);
      g.fill();
    },
    [1, 1],
  );
  const arcMat = new THREE.MeshStandardMaterial({ map: arcTex, transparent: true, depthWrite: false, roughness: 0.9 });
  arcMat.clippingPlanes = [cutPlane];
  const ag = [];
  const arcRow = (c, u0, u1, y) => {
    const L = u1 - u0,
      n = Math.max(1, Math.round(L / 0.62));
    const g = new THREE.PlaneGeometry(L, 0.31);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
    if (c.s < 0) g.rotateY(Math.PI);
    g.translate(c.x0 + (u0 + u1) / 2, y, outerZ(c) + c.s * 0.03);
    ag.push(g);
  };
  arcRow(BK, -0.3, 5.85, BK.h - 0.9);
  arcRow(BK, 7.45, 14.3, BK.h - 0.9);
  arcRow(SV, 0.3, 6.9, SV.h - 0.9);
  // Südervorhalle: Vierpassfries über dem Portal, zwei Rundfenster-Blenden, tiefer Portalbogen
  const qTex = canvasTex(
    128,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,16,12,.8)';
      g.lineWidth = 7;
      g.beginPath();
      g.arc(64, 64, 52, 0, 7);
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      for (const [dx, dy] of [
        [0, -20],
        [20, 0],
        [0, 20],
        [-20, 0],
      ]) {
        g.moveTo(64 + dx + 20, 64 + dy);
        g.arc(64 + dx, 64 + dy, 20, 0, 7);
      }
      g.stroke();
    },
    [1, 1],
  );
  const qMat = new THREE.MeshStandardMaterial({ map: qTex, transparent: true, depthWrite: false, roughness: 0.9 });
  qMat.clippingPlanes = [cutPlane];
  const qg = [];
  {
    const g = new THREE.PlaneGeometry(6.0, 0.6);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 10);
    g.translate(SV.x0 + 3.5, 7.55, outerZ(SV) + 0.03);
    qg.push(g);
    for (const du of [-2.45, 2.45]) {
      const r = new THREE.PlaneGeometry(0.75, 0.75);
      r.translate(SV.x0 + 3.5 + du, 6.55, outerZ(SV) + 0.03);
      qg.push(r);
    }
  }
  for (const y of [7.15, 7.95]) {
    const g = boxGeo(6.4, 0.15, 0.16);
    g.translate(SV.x0 + 3.5, y, outerZ(SV) + 0.08);
    addMesh(g, stoneLedgeMat, false);
  }
  {
    const ring = new THREE.Shape(),
      o = lancet(3.5, 2.05, 0, 3.4, 12),
      i2 = lancet(3.5, 1.3, 0, 3.4, 12);
    ring.moveTo(o[0][0], o[0][1]);
    o.slice(1).forEach(q => ring.lineTo(q[0], q[1]));
    for (let i = i2.length - 1; i >= 0; i--) ring.lineTo(i2[i][0], i2[i][1]);
    const rg = new THREE.ShapeGeometry(ring);
    rg.translate(SV.x0, 0, outerZ(SV) + 0.05);
    const rm = new THREE.Mesh(rg, revealMat);
    building.add(rm);
  }
  building.add(new THREE.Mesh(mergeGeos(ag), arcMat));
  building.add(new THREE.Mesh(mergeGeos(qg), qMat));
}
// Briefkapelle: zwei schlanke Granitsäulen in der Mittelachse (Grundriss 1906), Stern-/Palmengewölbe mit Rippen, die von den Säulen ausstrahlen
// Fotos 2026: Säulen und Wanddienste ockergelb gefasst, schlank bis hoch unter das Gewölbe; Rippen rot und blau
{
  const c = CHAPELS[0],
    xa = c.x0 + 0.6,
    xb = c.x1 - 0.5,
    za = c.zi + 0.6,
    zb = c.zo - 0.5,
    zc = (za + zb) / 2,
    cols = [-31.8, -27.9],
    HC = 9.6,
    HW = 11.4,
    HK = 12.2,
    RC = 2.6,
    RW = 1.2;
  const ochre = enhance(new THREE.MeshStandardMaterial({ color: lin(0xc69a3e), roughness: 0.6, metalness: 0.1 }), {}),
    capM = enhance(new THREE.MeshStandardMaterial({ color: lin(0xa8782a), roughness: 0.5, metalness: 0.3 }), {});
  // Kapitell nach Foto: Ring (Astragal), Kelch, darüber die Deckplatte, auf der die Rippen aufsetzen
  const capital = (x, z, r, y, out) => {
    const gs = [];
    const a = new THREE.TorusGeometry(r * 1.12, r * 0.22, 6, 14);
    a.rotateX(Math.PI / 2);
    a.translate(x, y, z);
    gs.push(a);
    const bell = new THREE.CylinderGeometry(r * (1.1 + out), r * 1.05, 0.46, 14);
    bell.translate(x, y + 0.26, z);
    gs.push(bell);
    const ab = new THREE.CylinderGeometry(r * (1.3 + out), r * (1.2 + out), 0.16, 14);
    ab.translate(x, y + 0.57, z);
    gs.push(ab);
    return mergeGeos(gs);
  };
  for (const x of cols) {
    const g = new THREE.CylinderGeometry(0.19, 0.22, HC, 14);
    g.translate(x, HC / 2, zc);
    addMesh(g, ochre);
    const sr = new THREE.TorusGeometry(0.235, 0.055, 6, 14); // Schaftring (Foto: dunkles Band)
    sr.rotateX(Math.PI / 2);
    sr.translate(x, HC * 0.56, zc);
    addMesh(sr, capM, false);
    addMesh(capital(x, zc, 0.21, HC - 0.12, 0.55), capM, false);
  }
  const HS = HW - 1.3, // Wanddienste an den Fensterpfeilern und in den Ecken
    RS = 2.4, // Halbmesser der Gewölbeanfänger über den Wanddiensten
    shafts = [];
  {
    const sh = [],
      cp = [];
    const add = (x, z) => {
      shafts.push([x, z]);
      const g = new THREE.CylinderGeometry(0.13, 0.13, HS, 10);
      g.translate(x, HS / 2, z);
      sh.push(g);
      cp.push(capital(x, z, 0.14, HS - 0.08, 0.7));
    };
    for (const x of [xa + 0.15, -33.88, -30.15, -27.57, -25.42, xb - 0.15]) {
      add(x, za + 0.12);
      add(x, zb - 0.12);
    }
    for (const z of [zc]) {
      add(xa + 0.12, z);
      add(xb - 0.12, z);
    }
    addMesh(mergeGeos(sh), ochre);
    addMesh(mergeGeos(cp), capM, false);
    // Blendmaßwerk auf der fensterlosen Nordwand (Foto): je Wandfeld eine Spitzbogenblende mit zwei Bögchen und Kreis
    {
      const bl = [],
        xs = shafts.filter(s => s[1] < zc).map(s => s[0]),
        bar = ps => bl.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps), ps.length, 0.06, 4, false)),
        pt = (x, y) => P(x, y, za + 0.07);
      for (let k = 0; k + 1 < xs.length; k++) {
        const cx = (xs[k] + xs[k + 1]) / 2,
          hw = (xs[k + 1] - xs[k]) / 2 - 0.34,
          bot = 1.3,
          spr = 6.0;
        if (hw < 0.45) continue;
        bar(lancet(cx, hw, bot, spr, 8).map(p => pt(p[0], p[1])));
        const hl = hw * 0.46,
          ys = spr - 1.9;
        for (const d of [-1, 1])
          bar(
            lancet(cx + d * hl * 1.06, hl, ys, ys, 6)
              .slice(1, -1)
              .map(p => pt(p[0], p[1])),
          );
        const rc = Math.min(hw * 0.4, 0.42),
          cy = ys + Math.sqrt(3) * hl + rc + 0.14,
          ps = [];
        for (let a = 0; a <= 14; a++)
          ps.push(pt(cx + rc * Math.cos((a * Math.PI) / 7), cy + rc * Math.sin((a * Math.PI) / 7)));
        bar(ps);
      }
      if (bl.length) addMesh(mergeGeos(bl), mullionMat, false);
    }
  }
  const fr = t => {
    t = Math.min(1, Math.max(0, t));
    return Math.sqrt(1 - (1 - t) * (1 - t));
  };
  // Oberkante der Deckplatten: dort setzen Kappen und Rippen auf (Foto); vorher lag die Gewölbefläche darunter,
  // sodass die Kapitelle hindurchstießen und die Rippen frei darüber begannen
  const CAPC = HC + 0.53,
    CAPS = HS + 0.59,
    RCAP = 0.3;
  const hy = (x, z) => {
    const dc = Math.min(...cols.map(cx => Math.hypot(x - cx, z - zc))),
      dw = Math.min(x - xa, xb - x, z - za, zb - z),
      ds = Math.min(...shafts.map(s => Math.hypot(x - s[0], s[1] === undefined ? z : z - s[1])));
    return Math.min(
      CAPC + (HK - CAPC) * fr(Math.max(0, dc - RCAP) / RC),
      HW + (HK - HW) * fr(dw / RW),
      CAPS + (HK - CAPS) * fr(Math.max(0, ds - 0.22) / RS),
    );
  };
  const NX = 62,
    NZ = 42,
    VM = 0.6,
    pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= NZ; j++)
    for (let i = 0; i <= NX; i++) {
      // die Fläche reicht ringsum 0,6 m über das Gewölbefeld hinaus bis in die Wände (Höhe wie am Rand): vorher blieb
      // zwischen Gewölbe und Wand ein Spalt, durch den man über die Dienste hinweg ins Mauerwerk sah
      const x = xa - VM + ((xb - xa + 2 * VM) * i) / NX,
        z = za - VM + ((zb - za + 2 * VM) * j) / NZ;
      pos.push(x, hy(Math.min(xb, Math.max(xa, x)), Math.min(zb, Math.max(za, z))), z);
      uv.push(x / 3, z / 3);
    }
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const vm = addMesh(g, vaultMat);
  occluders.splice(occluders.indexOf(vm), 1);
  const rg = [],
    rgB = [],
    xm = (cols[0] + cols[1]) / 2;
  // Die Rippen setzen auf der Deckplatte auf und laufen von dort über die Kappen: erster Punkt auf dem Kapitell,
  // danach eng gestufte Punkte, damit der steile Anlauf rund bleibt
  const SS = [0.36, 0.5, 0.68, 0.9, 1.2];
  for (let s = 1.55; s < 12; s += 0.35) SS.push(s);
  for (const cx of cols)
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8,
        dx = Math.cos(a),
        dz = Math.sin(a),
        pts = [P(cx + dx * 0.22, CAPC - 0.02, zc + dz * 0.22)];
      for (const s of SS) {
        const x = cx + dx * s,
          z = zc + dz * s;
        if (x < xa + 0.05 || x > xb - 0.05 || z < za + 0.05 || z > zb - 0.05) break;
        if (cx < xm !== x < xm) break;
        pts.push(P(x, hy(x, z) - 0.07, z));
      }
      if (pts.length > 2)
        (k % 2 ? rgB : rg).push(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.07, 5, false),
        );
    }
  // Rippen über den Wanddiensten: je drei, in den Raum hinein bis zum Scheitel
  for (const [sx, sz] of shafts) {
    const nx = sx < xa + 0.3 ? 1 : sx > xb - 0.3 ? -1 : 0,
      nz = sz < za + 0.3 ? 1 : sz > zb - 0.3 ? -1 : 0,
      a0 = Math.atan2(nz, nx);
    for (const da of [-0.7, 0, 0.7]) {
      const dx = Math.cos(a0 + da),
        dz = Math.sin(a0 + da),
        pts = [P(sx + dx * 0.15, CAPS - 0.02, sz + dz * 0.15)];
      for (const s of [0.3, 0.42, 0.58, 0.78, 1.05, 1.35, 1.7, 2.05, 2.4]) {
        if (s > RS) break;
        const x = sx + dx * s,
          z = sz + dz * s;
        if (x < xa + 0.05 || x > xb - 0.05 || z < za + 0.05 || z > zb - 0.05) break;
        pts.push(P(x, hy(x, z) - 0.06, z));
      }
      if (pts.length > 2)
        (da ? rgB : rg).push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.055, 5, false));
    }
  }
  addMesh(mergeGeos(rg), ribMat, false);
  addMesh(mergeGeos(rgB), enhance(new THREE.MeshStandardMaterial({ color: lin(0x4a6a96), roughness: 0.8 }), {}), false);
} // Rippen abwechselnd rot und blau (Foto)
// Marientidenkapelle (Vorjoch und Rechteckjoch mit polygonalem Schluss, Ostende bei x = 51,1)
// Wappenfenster nach Foto (Glasart 5); das westliche Vorjoch hat geschlossene, dicke Wände (Grundriss)
for (let k = 0; k < MT.length - 1; k++) {
  const a = MT[k],
    b = MT[k + 1],
    Lw = Math.hypot(b[0] - a[0], b[1] - a[1]);
  wall(a, b, {
    h: 21.9,
    t: k === 0 || k === 6 ? 1.6 : 1.0,
    ext: 0.3,
    openings: k === 0 || k === 6 ? [] : [W(Lw / 2, Math.min(1.15, (Lw - 1.4) / 2), 4.5, 14.2, 5)],
  });
}
{
  const out = offPoly(MT, 0.7, null, null, true),
    fr = [],
    ap = P(46.3, MT_APEX, -0.1),
    xCh = choirOff(0.7)[1][0] - 0.3, // Chorwand: hier stirbt der First
    fW = P(xCh, MT_APEX, -0.1), // Firstende an der Chorwand – waagerechter First
    eA = P(xCh, HRC, -0.1); // Anschlusspunkt des Kapellenkranzdachs (gleicher Punkt wie in AMB_ROOF)
  // Rippengewölbe über zwei Jochen (Foto der Marientidenkapelle): die Kappen steigen von den Wänden und vom Gurtbogen
  // zu zwei Scheiteln; vorher war hier eine ebene Decke.
  {
    const SPm = 13.8,
      CRm = 18.2,
      Rm = 3.5,
      XD = 44.0, // Gurtbogen zwischen Vorjoch und Ostjoch
      JA = [MT[0], MT[1], MT[6], MT[7]],
      mid = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length],
      cA = mid(JA),
      cB = mid([MT[1], MT[2], MT[3], MT[4], MT[5], MT[6]]),
      segs = MT.map((p, k) => [p, MT[(k + 1) % MT.length]]).concat([
        [
          [XD, -5.33],
          [XD, 5.03],
        ],
      ]);
    const dSeg = (x, z, [a, b]) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
      return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    };
    const inMT = (x, z) => {
      let w = false;
      for (let k = 0, j = MT.length - 1; k < MT.length; j = k++)
        if (
          MT[k][1] > z !== MT[j][1] > z &&
          x < ((MT[j][0] - MT[k][0]) * (z - MT[k][1])) / (MT[j][1] - MT[k][1]) + MT[k][0]
        )
          w = !w;
      return w;
    };
    const hm = (x, z) => {
      if (!inMT(x, z)) return SPm;
      const d = Math.min(...segs.map(s => dSeg(x, z, s)));
      return SPm + (CRm - SPm) * vf(1 - Math.min(1, d / Rm));
    };
    const x0 = 37.9,
      x1 = 51.0,
      z0 = -5.9,
      z1 = 5.7,
      st = 0.28,
      NXm = Math.ceil((x1 - x0) / st),
      NZm = Math.ceil((z1 - z0) / st),
      vp = [],
      vu = [],
      vi = [];
    for (let j = 0; j <= NZm; j++)
      for (let i = 0; i <= NXm; i++) {
        const x = x0 + ((x1 - x0) * i) / NXm,
          z = z0 + ((z1 - z0) * j) / NZm;
        vp.push(x, hm(x, z), z);
        vu.push(x / 3, z / 3);
      }
    const outM = offPoly(MT, 0.45, null, null, true),
      inOut = (x, z) => {
        let w = false;
        for (let k = 0, j = outM.length - 1; k < outM.length; j = k++)
          if (
            outM[k][1] > z !== outM[j][1] > z &&
            x < ((outM[j][0] - outM[k][0]) * (z - outM[k][1])) / (outM[j][1] - outM[k][1]) + outM[k][0]
          )
            w = !w;
        return w;
      };
    for (let j = 0; j < NZm; j++)
      for (let i = 0; i < NXm; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / NXm,
          z = z0 + ((z1 - z0) * (j + 0.5)) / NZm;
        if (!inOut(x, z)) continue;
        const a = j * (NXm + 1) + i;
        vi.push(a, a + NXm + 1, a + 1, a + 1, a + NXm + 1, a + NXm + 2);
      }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    gm.setAttribute('uv', new THREE.Float32BufferAttribute(vu, 2));
    gm.setIndex(vi);
    gm.computeVertexNormals();
    const mv = addMesh(gm, vaultMat);
    occluders.splice(occluders.indexOf(mv), 1);
    // Rippen: Gurtbogen, Schildbögen an den Wänden, Diagonalen zu den beiden Schlusssteinen
    const rm = [],
      arc = (a, b) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t;
          pts.push(P(x, hm(x, z) - 0.09, z));
        }
        rm.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.085, 5, false));
      };
    for (const [a, b] of segs) arc(a, b);
    for (const p of JA) arc(p, cA);
    for (const k of [1, 2, 3, 4, 5, 6]) arc(MT[k], cB);
    addMesh(mergeGeos(rm), ribMat, false);
    for (const cq of [cA, cB]) {
      const kg = new THREE.SphereGeometry(0.26, 10, 8);
      kg.translate(cq[0], hm(cq[0], cq[1]) - 0.16, cq[1]);
      addMesh(kg, ribMat, false);
    }
  }
  const q = (p, y) => P(p[0], y, p[1]);
  for (let k = 2; k < 5; k++) fr.push([q(out[k], 21.9), q(out[k + 1], 21.9), ap]); // Polygonschluss: Walm
  for (const [i0, i2] of [
    [0, 2],
    [7, 5],
  ]) {
    const w = [MT[i0][0], out[i0][1]];
    fr.push([q(w, 21.9), q(out[i2], 21.9), ap]);
    fr.push([q(w, 21.9), ap, fW]);
    fr.push([q(w, 21.9), fW, eA]); // Kehle: schließt bündig an das Dach des Kapellenkranzes an
  } // Langseiten, waagerechter First bis an die Chorwand
  addMesh(polyGeo(fr), roofMat);
}

// Doppelturmfassade nach Fotos der Westseite (vermessen) und Luftbildern:
// Turmschaft bis 60 m, vier Giebel je Turm bis 72,7 m (LoD2-Wandoberkante ≈ Giebelspitze, bDOM vorn 73,5 m),
// achtseitiger Rhombenhelm von den Ecken (60 m) und Giebelspitzen bis 124,75 / 124,95 m.
// Geschossgliederung nach Foto (Maßstab aus der Turmbreite): Friese 58,6 / 50,1 / 40,6 / 30,9 m,
// gekuppelte Spitzbogenfenster 52,2–57,0 / 43,2–48,3 / 34,5–39,3 m.
export const T_EAVE = 60,
  T_GTIP = [73.19, 73.08],
  T_HELM = [46.56, 46.47]; // Nordturm, Südturm: Giebelspitze, Helm bis Knauf (Vermessung, Unterlage „Maße Türme“)
// darüber Knauf 0,90 m, Helmstange 3,30 m, Hahn 1,00 m → Gesamthöhe Nordturm 124,95 m, Südturm 124,75 m (der Nordhahn kräht höher)
const T_FRIEZE = [58.6, 50.1, 40.6, 30.9],
  T_LEVELS = [
    [52.2, 57.0],
    [43.2, 48.3],
    [34.5, 39.3],
  ];
function brickCanvas(g, w, h, r, bw, bh, dark) {
  g.fillStyle = '#968a80';
  g.fillRect(0, 0, w, h);
  for (let row = 0; row < h / bh; row++) {
    const off = ((row % 2) * bw) / 2;
    for (let i = -1; i <= w / bw; i++) {
      const c = brickCol(r, dark || 0.08);
      g.fillStyle = 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
      g.fillRect(i * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
}
// Turmwände: Backstein mit dunklem Rautenmuster aus glasierten Köpfen (Foto)
const diaperTex = canvasTex(
  512,
  512,
  (g, w, h) => {
    const r = rng(41);
    brickCanvas(g, w, h, r, 22, 10.7, 0.03);
    g.strokeStyle = 'rgba(48,34,30,.85)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let y = 48; y < h; y += 128)
      for (let x = ((y / 128) % 2) * 64 + 32; x < w; x += 128) {
        g.beginPath();
        g.moveTo(x - 9, y - 9);
        g.lineTo(x + 9, y + 9);
        g.moveTo(x + 9, y - 9);
        g.lineTo(x - 9, y + 9);
        g.stroke();
      }
  },
  [1 / 4.8, 1 / 4.8],
);
towerMatW.map = diaperTex;
towerMatW.needsUpdate = true; // Mittelbau ebenfalls mit Rautenmuster
const towerMat = enhance(new THREE.MeshStandardMaterial({ map: diaperTex, roughness: 0.92, side: THREE.DoubleSide }), {
  mask: true,
});
function gableCanvas(kind) {
  return (g, w, h) => {
    const r = rng(kind === 'trio' ? 31 : 32);
    brickCanvas(g, w, h, r, 40, 13);
    if (kind === 'trio') {
      // Süd-/Nordgiebel (Foto vom Petriturm): drei große Dreipässe und ein kleiner Kreis, im Backstein mit dunkel profiliertem Rand
      const cp = document.createElement('canvas');
      cp.width = w;
      cp.height = h;
      cp.getContext('2d').drawImage(g.canvas, 0, 0);
      const tre = (cx, cy, R) => {
        const L = [];
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
          L.push([cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62]);
        }
        return L;
      };
      const shapes = [
        [tre(254, 214, 74), 44],
        [tre(158, 416, 74), 44],
        [tre(350, 416, 74), 44],
        [[[255, 336]], 29],
      ];
      for (const [cs, r] of shapes) {
        g.fillStyle = 'rgba(40,22,18,.85)';
        g.beginPath();
        for (const [x, y] of cs) {
          g.moveTo(x + r + 7, y);
          g.arc(x, y, r + 7, 0, 7);
        }
        g.fill();
        g.save();
        g.beginPath();
        for (const [x, y] of cs) {
          g.moveTo(x + r, y);
          g.arc(x, y, r, 0, 7);
        }
        g.clip();
        g.drawImage(cp, 0, 0);
        g.restore();
        g.strokeStyle = 'rgba(196,140,110,.55)';
        g.lineWidth = 2;
        g.beginPath();
        for (const [x, y] of cs) {
          g.moveTo(x + r - 2, y);
          g.arc(x, y, r - 2, 0, 7);
        }
        g.stroke();
      }
    } else if (kind === 'wheel') {
      // Ostgiebel Nordturm (Foto vom Dach): Radfenster mit Speichen, darunter Zickzackfries
      const cx = 256,
        cy = 250,
        R = 92;
      g.fillStyle = 'rgba(112,46,32,.92)';
      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.fill();
      g.strokeStyle = '#c99e84';
      g.lineWidth = 7;
      g.stroke();
      g.lineWidth = 5;
      g.beginPath();
      g.arc(cx, cy, R * 0.3, 0, 7);
      g.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3);
        g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        g.stroke();
      }
      g.strokeStyle = '#c99e84';
      g.lineWidth = 5;
      g.beginPath();
      for (let x = 40; x <= 472; x += 24) {
        g.lineTo(x, (x / 24) % 2 < 1 ? 452 : 430);
      }
      g.stroke();
      g.fillStyle = 'rgba(60,26,18,.85)';
      g.fillRect(36, 458, 440, 10);
    } else if (kind === 'rose') {
      // Nordgiebel Nordturm (Luftbild von Norden): große Rosette mit Achtpass
      const cx = 256,
        cy = 268,
        R = 104;
      g.fillStyle = 'rgba(112,46,32,.92)';
      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.fill();
      g.strokeStyle = '#c99e84';
      g.lineWidth = 7;
      g.stroke();
      g.lineWidth = 5;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        g.beginPath();
        g.arc(cx + Math.cos(a) * R * 0.52, cy + Math.sin(a) * R * 0.52, R * 0.36, 0, 7);
        g.stroke();
      }
      g.beginPath();
      g.arc(cx, cy, R * 0.2, 0, 7);
      g.stroke();
    } else if (kind === 'diaper') {
      // Ostgiebel Südturm (Drohnenfoto): Gitter aus schwarz glasierten Steinen, dazwischen Vierpässe aus hellem Backstein
      const st = 40;
      g.fillStyle = 'rgba(28,24,24,.95)';
      for (let y = 60; y < 508; y += st) g.fillRect(0, y - 3, 512, 6);
      for (let x = 16; x < 512; x += st) g.fillRect(x - 3, 50, 6, 460);
      for (let y = 60 + st / 2; y < 508; y += st)
        for (let x = 16 + st / 2; x < 512; x += st) {
          g.fillStyle = 'rgba(28,24,24,.95)';
          g.beginPath();
          g.moveTo(x, y - st / 2);
          g.lineTo(x + st / 2, y);
          g.lineTo(x, y + st / 2);
          g.lineTo(x - st / 2, y);
          g.closePath();
          g.fill();
          g.fillStyle = '#c4734f';
          for (const [dx, dy] of [
            [0, -7],
            [7, 0],
            [0, 7],
            [-7, 0],
          ]) {
            g.beginPath();
            g.arc(x + dx, y + dy, 8.5, 0, 7);
            g.fill();
          }
        }
    } else {
      // Westgiebel (Foto von Westen): Kreis mit profiliertem dunklem Rand und Vierpass im Backstein, darunter eine kleine Lanzette
      {
        const cp = document.createElement('canvas');
        cp.width = w;
        cp.height = h;
        cp.getContext('2d').drawImage(g.canvas, 0, 0);
        g.fillStyle = 'rgba(40,22,18,.85)';
        g.beginPath();
        g.arc(256, 240, 70, 0, 7);
        g.fill();
        g.save();
        g.beginPath();
        g.arc(256, 240, 62, 0, 7);
        g.clip();
        g.drawImage(cp, 0, 0);
        g.restore();
        g.strokeStyle = 'rgba(40,22,18,.8)';
        g.lineWidth = 5;
        g.beginPath();
        for (const [dx, dy] of [
          [0, -24],
          [24, 0],
          [0, 24],
          [-24, 0],
        ]) {
          g.moveTo(256 + dx + 24, 240 + dy);
          g.arc(256 + dx, 240 + dy, 24, 0, 7);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(70,30,22,.9)';
      g.beginPath();
      g.moveTo(222, 512);
      g.lineTo(222, 415);
      g.quadraticCurveTo(225, 365, 256, 345);
      g.quadraticCurveTo(287, 365, 290, 415);
      g.lineTo(290, 512);
      g.fill();
      g.strokeStyle = '#cfa98c';
      g.lineWidth = 5;
      g.stroke();
    }
    g.strokeStyle = '#c99e84';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(4, 508);
    g.lineTo(256, 6);
    g.lineTo(508, 508);
    g.stroke();
  };
}
const gableMatWE = new THREE.MeshStandardMaterial({
  map: canvasTex(512, 512, gableCanvas('one'), null),
  roughness: 0.9,
  side: THREE.DoubleSide,
});
gableMatWE.clippingPlanes = [cutPlane];
const gableMatNS = new THREE.MeshStandardMaterial({
  map: canvasTex(512, 512, gableCanvas('trio'), null),
  roughness: 0.9,
  side: THREE.DoubleSide,
});
gableMatNS.clippingPlanes = [cutPlane];
const gableMatWheel = new THREE.MeshStandardMaterial({
  map: canvasTex(512, 512, gableCanvas('wheel'), null),
  roughness: 0.9,
  side: THREE.DoubleSide,
});
gableMatWheel.clippingPlanes = [cutPlane];
const gableMatRose = new THREE.MeshStandardMaterial({
  map: canvasTex(512, 512, gableCanvas('rose'), null),
  roughness: 0.9,
  side: THREE.DoubleSide,
});
gableMatRose.clippingPlanes = [cutPlane];
const gableMatDiaper = new THREE.MeshStandardMaterial({
  map: canvasTex(512, 512, gableCanvas('diaper'), null),
  roughness: 0.9,
  side: THREE.DoubleSide,
});
gableMatDiaper.clippingPlanes = [cutPlane];
const discFriezeTex = canvasTex(
  128,
  128,
  (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#efe9df';
    g.beginPath();
    g.arc(64, 64, 40, 0, 7);
    g.fill();
  },
  [1, 1],
); // unterstes Band: weiße Scheiben (Foto vom Petriturm)   // weiße Vierpässe unter den Giebeln (Drohnenfoto)
const discFriezeMat = new THREE.MeshStandardMaterial({
  map: discFriezeTex,
  roughness: 0.85,
  alphaTest: 0.5,
  transparent: false,
});
discFriezeMat.clippingPlanes = [cutPlane];
const friezeTex = canvasTex(
  128,
  128,
  (g, w, h) => {
    // weißes Fries: je Kachel ein Kreuz mit runden Armenden (Foto vom Petriturm)
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#efe9df';
    const c = 64;
    g.fillRect(c - 9, c - 30, 18, 60);
    g.fillRect(c - 30, c - 9, 60, 18);
    for (const [dx, dy] of [
      [0, -30],
      [0, 30],
      [-30, 0],
      [30, 0],
    ]) {
      g.beginPath();
      g.arc(c + dx, c + dy, 15, 0, 7);
      g.fill();
    }
  },
  [1, 1],
);
const arcadeFriezeTex = canvasTex(
  256,
  64,
  (g, w, h) => {
    // weißer Kleeblattbogenfries des Mittelbaus (Foto der Westfront): volle helle Dreipässe mit
    // Backstein dazwischen. Das Band ist 0,9 m hoch und wiederholt sich alle 3,6 m, die Bildpunkte
    // sind also quadratisch: ein Kleeblatt je 64 Pixel entspricht 0,9 m Breite wie auf dem Foto.
    g.fillStyle = '#6d3e2f'; // Backsteingrund wie die umgebende Wand, damit das Band nicht als Streifen wirkt
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7c6f66'; // Lager- und Stoßfugen, damit der Grund nicht glatt wirkt
    for (let r = 0, y = 0; y < h; r++, y += 6.4) {
      g.fillRect(0, y, w, 1.1);
      for (let x = (r % 2) * 7.5; x < w; x += 15) g.fillRect(x, y, 1.1, 6.4);
    }
    const lobe = (x, y, r) => {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = '#f2ece2';
      lobe(x + 18, 36, 11); // linker Lappen
      lobe(x + 32, 24, 12); // Scheitellappen
      lobe(x + 46, 36, 11); // rechter Lappen
      g.fillRect(x + 19, 34, 26, 20); // Kern und kurze Kämpfer bis zur Sohlbank
      g.fillStyle = 'rgba(120,70,50,.28)'; // weiche Schattierung in den Bogenzwickeln
      g.fillRect(x + 19, 48, 26, 6);
      g.fillStyle = '#f2ece2';
    }
    g.fillStyle = 'rgba(90,52,38,.5)'; // Schattenfuge unter dem Fries
    g.fillRect(0, 54, w, 10);
  },
  [1, 1],
);
const friezeMat = new THREE.MeshStandardMaterial({
  map: friezeTex,
  roughness: 0.85,
  alphaTest: 0.5,
  transparent: false,
});
friezeMat.clippingPlanes = [cutPlane];
const arcFriezeMat = new THREE.MeshStandardMaterial({ map: arcadeFriezeTex, roughness: 0.85 });
arcFriezeMat.clippingPlanes = [cutPlane];
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xefe9df, roughness: 0.85, side: THREE.DoubleSide });
whiteMat.clippingPlanes = [cutPlane];
function triUV(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  g.computeVertexNormals();
  return g;
}
// Fläche auf einer Wandseite: (cx,cz) Mitte der Wand, (nx,nz) Außennormale, u seitlich, Grundriss als Punktliste [u,y]
function facePoly(cx, cz, nx, nz, pts, off) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => s.lineTo(p[0], p[1]));
  const g = new THREE.ShapeGeometry(s);
  const X = new V3(-nz, 0, nx),
    Y = new V3(0, 1, 0),
    Z = new V3(nx, 0, nz);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(new V3(cx, 0, cz).addScaledVector(Z, off || 0.06)));
  return g;
}
const lanc = (u, hw, bot, top) => lancet(u, hw, bot, Math.max(bot + 0.01, top - SQ3 * hw), 8);
// gekuppeltes Spitzbogenfenster: heller Rahmen, zwei dunkle Lanzetten, weißer Vierpass im Bogenfeld
function twinWindow(acc, cx, cz, nx, nz, u, bot, top, hw) {
  hw = hw || 1.25;
  acc.reveal.push(facePoly(cx, cz, nx, nz, lanc(u, hw, bot, top), 0.05));
  const lt = top - 1.35;
  for (const d of [-0.42, 0.42]) acc.dark.push(facePoly(cx, cz, nx, nz, lanc(u + d, 0.3, bot + 0.15, lt), 0.08));
  const q = new THREE.CircleGeometry(0.34, 14);
  const X = new V3(-nz, 0, nx),
    Z = new V3(nx, 0, nz);
  for (const [du, dv] of [
    [0, 0.28],
    [0, -0.28],
    [-0.28, 0],
    [0.28, 0],
  ]) {
    const c = q.clone();
    c.applyMatrix4(
      new THREE.Matrix4().makeBasis(X, new V3(0, 1, 0), Z).setPosition(
        new V3(cx, 0, cz)
          .addScaledVector(X, u + du)
          .addScaledVector(Z, 0.09)
          .setY(top - 0.78 + dv),
      ),
    );
    acc.white.push(c);
  }
}
const facadeAcc = { reveal: [], dark: [], white: [] };
for (const zz of [TW.n, TW.s]) {
  const z0 = zz[0],
    z1 = zz[1],
    zc = (z0 + z1) / 2,
    south = zz === TW.s,
    T_GABLE = (south ? T_GTIP[1] : T_GTIP[0]) - T_EAVE,
    apexY = T_EAVE + T_GABLE + (south ? T_HELM[1] : T_HELM[0]);
  const xa = TW.x0,
    xb = TW.x1,
    hx = (xb - xa) / 2,
    hz = (z1 - z0) / 2,
    xc = (xa + xb) / 2,
    zo = south ? z1 : z0,
    zi = south ? z0 : z1,
    so = south ? 1 : -1;
  if (south) {
    // Gedenkkapelle im Erdgeschoss des Südturms
    box(xa, xb, GK.h, T_EAVE, z0, z1, towerMat);
    wall([GK.x0, GK.z1], [GK.x1, GK.z1], { h: GK.h, t: 0.9, ext: 0.45, mat: towerMat }); // Südseite unten geschlossen (Fotos)
    wall([GK.x0, GK.z0], [GK.x1, GK.z0], {
      h: GK.h,
      t: 0.9,
      ext: 0.45,
      mat: towerMat,
      openings: [D((GK.x1 - GK.x0) / 2, 1.6, 4.5)],
    });
    wall([GK.x0, GK.z0], [GK.x0, GK.z1], {
      h: GK.h,
      t: 0.9,
      ext: 0.45,
      mat: towerMat,
      openings: [W((GK.z1 - GK.z0) / 2, 0.95, 6.8, 20.6 - SQ3 * 0.95, 5)],
    }); // das hohe Fenster vorn in der Westseite; die Südseite ist unten geschlossen
    wall([GK.x1, GK.z0], [GK.x1, GK.z1], {
      h: GK.h,
      t: 0.9,
      ext: 0.45,
      mat: towerMat,
      openings: [D((GK.z1 - GK.z0) / 2, 2.0, 6.0)],
    });
    box(GK.x0 + 0.45, GK.x1 - 0.45, GK.ceil, GK.h, GK.z0 + 0.45, GK.z1 - 0.45);
  } else box(xa, xb, 0, T_EAVE, z0, z1, towerMat);
  // Ecken (60 m), Giebelspitzen (72,7 m), Helmspitze; Giebel West/Ost mit Rosette und Blende, Nord/Süd mit Dreipass
  const C = [P(xa, T_EAVE, z0), P(xb, T_EAVE, z0), P(xb, T_EAVE, z1), P(xa, T_EAVE, z1)];
  const G = [
    P(xc, T_EAVE + T_GABLE, z0),
    P(xb, T_EAVE + T_GABLE, zc),
    P(xc, T_EAVE + T_GABLE, z1),
    P(xa, T_EAVE + T_GABLE, zc),
  ];
  const A = P(xc, apexY, zc);
  for (let k = 0; k < 4; k++)
    addMesh(
      triUV(C[k], C[(k + 1) % 4], G[k]),
      k === 3
        ? gableMatWE
        : k === 1
          ? south
            ? gableMatDiaper
            : gableMatWheel
          : k === 0 && !south
            ? gableMatRose
            : gableMatNS,
    ); // Nordturm Nordgiebel: Rosette (Luftbild)   // Ost: Süd Rautenmuster, Nord Radfenster (Foto)
  const f = [];
  for (let k = 0; k < 4; k++) {
    f.push([A, C[k], G[k]]);
    f.push([A, G[k], C[(k + 1) % 4]]);
  }
  addMesh(polyGeo(f), roofMat);
  // goldene Knäufe auf den Giebelspitzen, Helmstange, Kugel, Wetterhahn
  for (const gp of G) {
    const r = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5);
    r.translate(gp.x, gp.y + 0.6, gp.z);
    addMesh(r, darkMat, false);
    const b = new THREE.SphereGeometry(0.32, 10, 8);
    b.translate(gp.x, gp.y + 1.3, gp.z);
    addMesh(b, goldMat, false);
  }
  {
    const k0 = apexY,
      k1 = k0 + 0.9,
      r1 = k1 + 3.3; // Knauf, Helmstange, Hahn
    const g = new THREE.CylinderGeometry(0.07, 0.07, r1 - k0, 6);
    g.translate(xc, (k0 + r1) / 2, zc);
    addMesh(g, darkMat, false);
    const b = new THREE.SphereGeometry(0.47, 12, 8);
    b.translate(xc, k0 + 0.45, zc);
    addMesh(b, goldMat, false);
    const body = new THREE.SphereGeometry(0.4, 10, 8);
    body.scale(1.3, 1, 0.15);
    body.translate(xc, r1 + 0.35, zc);
    addMesh(body, goldMat, false);
    const tail = new THREE.ConeGeometry(0.35, 0.75, 6);
    tail.scale(1, 1, 0.15);
    tail.translate(xc - 0.5, r1 + 0.6, zc);
    addMesh(tail, goldMat, false);
    const head = new THREE.SphereGeometry(0.17, 8, 6);
    head.scale(1, 1, 0.3);
    head.translate(xc + 0.45, r1 + 0.8, zc);
    addMesh(head, goldMat, false);
  }
  // Friesbänder
  {
    const fg = [],
      dg = [],
      ledgeG = [];
    for (const y of T_FRIEZE)
      for (const [cx, cz, len, rot, side] of [
        [xa - 0.07, zc, 2 * hz, -Math.PI / 2, 'w'],
        [xb + 0.07, zc, 2 * hz, Math.PI / 2, 'e'],
        [xc, zo + so * 0.07, 2 * hx, south ? 0 : Math.PI, 'o'],
        [xc, zi - so * 0.07, 2 * hx, south ? Math.PI : 0, 'i'],
      ]) {
        if ((side === 'e' && y < HJ + 1) || (side === 'i' && y < HN + 1.5)) continue;
        const disc = (side === 'o' || side === 'e') && y < 35,
          nT = disc ? 7 : side === 'o' ? 6 : 9,
          bh = disc ? 1.0 : 0.95; // Motive je Seite nach Fotos: außen 6 Kreuze, West/Ost/innen 9, unterstes Band 7 Scheiben
        const g = new THREE.PlaneGeometry(len - 0.4, bh);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * nT);
        g.rotateY(rot);
        g.translate(cx, y, cz);
        (disc ? dg : fg).push(g);
        const lg = boxGeo(len + 0.3, 0.16, 0.22);
        lg.rotateY(rot);
        lg.translate(cx, y + 0.62, cz);
        ledgeG.push(lg);
      } // unterstes Band außen und östlich als Scheibenfries (Foto vom Petriturm)
    const m = new THREE.Mesh(mergeGeos(fg), friezeMat);
    m.receiveShadow = true;
    building.add(m);
    if (dg.length) {
      const m2 = new THREE.Mesh(mergeGeos(dg), discFriezeMat);
      m2.receiveShadow = true;
      building.add(m2);
    }
    addMesh(mergeGeos(ledgeG), stoneLedgeMat, false);
  } // hellgraues Gesims über jedem Fries (Foto)
  // gekuppelte Fenster: zwei je Seite und Geschoss (Achsen bei ±24 % der Breite); innen/Ost nur über dem Dach
  // Achsen bei ±16 % der Breite (Fotos West, Süd, Ost); Ostseite über den Seitenschiffdächern, Innenseite über der Mittelschifftraufe
  // Westseite: nur die drei Geschosse über den Friesen (Foto von Westen); unter dem untersten Fries ein kleines Einzelfenster
  for (const [bot, top] of T_LEVELS.concat([[24.8, 29.4]])) {
    for (const d of [-0.16, 0.16]) {
      if (bot > 30) twinWindow(facadeAcc, xa, zc, -1, 0, d * 2 * hz, bot, top);
      twinWindow(facadeAcc, xc, zo, 0, so, d * 2 * hx, bot, top);
      if (bot >= HJ + 2) twinWindow(facadeAcc, xb, zc, 1, 0, d * 2 * hz, bot, top);
      if (bot >= HN + 2) twinWindow(facadeAcc, xc, zi, 0, -so, d * 2 * hx, bot, top);
    }
  }
  // kleine Blende in jedem Giebel ist Teil der Giebeltextur; unten: kleines und hohes Spitzbogenfenster auf West- und Außenseite
  for (const [cx, cz, nx, nz, tall] of [
    [xa, zc, -1, 0, true],
    [xc, zo, 0, so, !south],
  ]) {
    if (nx < 0) {
      facadeAcc.reveal.push(facePoly(cx, cz, nx, nz, lanc(0, 0.85, 25.0, 28.9), 0.05));
      facadeAcc.dark.push(facePoly(cx, cz, nx, nz, lanc(0, 0.6, 25.2, 28.6), 0.08));
    }
    if (tall) {
      facadeAcc.reveal.push(facePoly(cx, cz, nx, nz, lanc(0, 1.25, 6.5, 21.0), 0.05));
      facadeAcc.dark.push(facePoly(cx, cz, nx, nz, lanc(0, 0.95, 6.8, 20.6), 0.08));
    }
  } // Südturm vorn: dahinter das verglaste Fenster der Gedenkkapelle (die dunkle Fläche wirft keinen Schatten)
}
// Mittelbau zwischen den Türmen (Foto): Giebel bis zum First, Rautenmuster, zwei Spitzbogennischen mit Fenstern und Kupferbrüstung,
// kleines Giebelfenster, weißer Bogenfries bei 32,4 m; unten Westportal mit Maßwerk-Tympanon und das Westfenster
{
  const zL = TW.n[1],
    zR = TW.s[0],
    cx = TW.x0;
  facadeAcc.dark.push(facePoly(cx, 0, -1, 0, lanc(0, 0.42, 42.6, 45.4), 0.08));
  // kleines Spitzbogenfenster zwischen Bogenfries und Westfenster (Foto von Westen)
  facadeAcc.reveal.push(facePoly(cx, 0, -1, 0, lanc(0, 0.85, 23.4, 26.9), 0.05));
  facadeAcc.dark.push(facePoly(cx, 0, -1, 0, lanc(0, 0.6, 23.6, 26.6), 0.08));
  for (const u of [-3.3, 3.3]) {
    facadeAcc.reveal.push(facePoly(cx, 0, -1, 0, lanc(u, 1.45, 35.4, 42.4), 0.05));
    facadeAcc.dark.push(facePoly(cx, 0, -1, 0, lanc(u, 0.5, 35.6, 38.8), 0.08));
    const ledge = boxGeo(1.6, 0.5, 0.45);
    ledge.translate(cx - 0.22, 35.55, -u);
    addMesh(ledge, roofMat, false);
  }
  {
    const g = new THREE.PlaneGeometry(zR - zL, 0.9);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * (zR - zL)) / 3.6);
    g.rotateY(-Math.PI / 2);
    g.translate(cx - 0.07, 32.4, 0);
    const m = new THREE.Mesh(g, arcFriezeMat);
    building.add(m);
  }
  for (const [u, y] of [
    [-4.2, 44],
    [4.2, 44],
    [-2.2, 46.3],
    [2.2, 46.3],
    [-6, 41],
    [6, 41],
    [-1.4, 40.8],
    [1.4, 40.8],
  ]) {
    // weiße Kreuze im Giebel
    for (const [w, h] of [
      [0.7, 0.18],
      [0.18, 0.7],
    ]) {
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(-Math.PI / 2);
      g.translate(cx - 0.09, y, u);
      facadeAcc.white.push(g);
    }
  }
  // Tympanon über dem Westportal: helles Maßwerk mit Rosette
  {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb9b1a6, roughness: 0.85, side: THREE.DoubleSide });
    stoneMat.clippingPlanes = [cutPlane];
    {
      const tp = facePoly(cx, 0, -1, 0, lanc(0, 2.2, 5.5, 9.3), 0.02);
      const m = new THREE.Mesh(tp, stoneMat);
      m.receiveShadow = true;
      building.add(m);
      const tp2 = facePoly(cx + 1.2, 0, -1, 0, lanc(0, 2.2, 5.5, 9.3), -0.02);
      building.add(new THREE.Mesh(tp2, stoneMat));
    }
    const ring = new THREE.RingGeometry(0.9, 1.15, 24);
    ring.rotateY(-Math.PI / 2);
    ring.translate(cx - 0.09, 7.3, 0);
    facadeAcc.dark.push(ring);
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 - Math.PI / 2,
        r2 = new THREE.RingGeometry(0.32, 0.42, 16);
      r2.rotateY(-Math.PI / 2);
      r2.translate(cx - 0.1, 7.3 + Math.sin(a) * -0.4, Math.cos(a) * 0.4);
      facadeAcc.dark.push(r2);
    }
  }
}
{
  const mk = (arr, mat) => {
    const m = new THREE.Mesh(mergeGeos(arr), mat);
    m.receiveShadow = true;
    building.add(m);
  };
  mk(facadeAcc.reveal, revealMat);
  mk(facadeAcc.dark, darkMat);
  mk(facadeAcc.white, whiteMat);
}
// Obergaden außen: tiefe Spitzbogenblenden um jedes Fenster (Fotos von Süden)
{
  const gs = [],
    recessMat = new THREE.MeshStandardMaterial({
      map: brickTex,
      color: 0x8a827a,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
  recessMat.clippingPlanes = [cutPlane]; // Blende im selben Backstein, im Schatten etwas dunkler
  for (let i = 0; i < NB; i++) {
    const bw = PX[i + 1] - PX[i],
      hwO = bw / 2 - 0.55,
      hwW = Math.min(1.9, (bw - 2.6) / 2),
      um = (PX[i] + PX[i + 1]) / 2;
    const outer = lancet(0, hwO, 29.0, 40.2 - SQ3 * hwO, 10),
      inner = lancet(0, hwW, 29.8, 34.8, 10);
    const sh = new THREE.Shape();
    sh.moveTo(outer[0][0], outer[0][1]);
    outer.slice(1).forEach(q => sh.lineTo(q[0], q[1]));
    const hole = new THREE.Path();
    hole.moveTo(inner[0][0], inner[0][1]);
    inner.slice(1).forEach(q => hole.lineTo(q[0], q[1]));
    sh.holes.push(hole);
    for (const sgn of [-1, 1]) {
      const g = new THREE.ShapeGeometry(sh);
      if (sgn < 0) g.rotateY(Math.PI);
      g.translate(um, 0, sgn * (ZN + 0.74));
      gs.push(g);
    }
  }
  const m = new THREE.Mesh(mergeGeos(gs), recessMat);
  m.receiveShadow = true;
  building.add(m);
}
// Chorhaupt nach Drohnenfotos von Osten und Norden: Umgang mit Pultdach je Joch zwischen den Strebepfeilern,
// Schmuckgiebel mit Blendnischen an den Giebeln der nördlichen Chorkapellen; keine Fialen (Luftbild von Osten)
{
  // Ostgiebel der nördlichen Chorkapellen: abgestufte Blendnischen
  const gd = [];
  for (const c of [CHAPELS[2]]) {
    const s3 = c.s,
      zi = c.zi,
      zo = c.zo,
      zr = c.zr,
      x = c.x1 + 0.52;
    const yAt = z =>
      z <= zr
        ? c.hin + ((z - zi) / (zr - zi)) * (c.ridge - c.hin)
        : c.ridge + ((z - zr) / (zo + 0.6 - zr)) * (c.h - c.ridge);
    for (const f of [-0.75, -0.4, 0, 0.4, 0.75]) {
      const z = zr + f * (f < 0 ? zr - zi : zo - zr),
        ytop = yAt(z) - 1.2,
        ybot = Math.min(c.h, c.hin) - 2.5;
      if (ytop - ybot < 1.5) continue;
      gd.push(facePoly(x, s3 * z, 1, 0, lanc(0, 0.42, ybot, ytop), 0.02));
    }
  }
  // Westgiebel der nördlichen Chorkapellen über dem Dach der Totentanzkapelle (Luftbild von Norden; war offen)
  {
    const c = CHAPELS[2],
      s3 = c.s,
      zi = c.zi,
      zo = c.zo,
      zr = c.zr,
      x = c.x0,
      yb = c.h - 2.2;
    const yAt = z =>
      z <= zr
        ? c.hin + ((z - zi) / (zr - zi)) * (c.ridge - c.hin)
        : c.ridge + ((z - zr) / (zo + 0.6 - zr)) * (c.h - c.ridge);
    const q = (z, y) => P(x, y, s3 * z);
    addMesh(
      polyGeo([
        [q(zi - 0.6, yb), q(zr, yb), q(zr, c.ridge), q(zi - 0.6, yAt(zi - 0.6))],
        [q(zr, yb), q(zo + 0.5, yb), q(zo + 0.5, yAt(zo + 0.5)), q(zr, c.ridge)],
      ]),
      wallMat,
    );
    for (const f of [-0.75, -0.4, 0, 0.4, 0.75]) {
      const z = zr + f * (f < 0 ? zr - zi : zo - zr),
        ytop = yAt(z) - 1.2,
        ybot = yb + 0.6;
      if (ytop - ybot < 1.5) continue;
      gd.push(facePoly(x - 0.02, s3 * z, -1, 0, lanc(0, 0.42, ybot, ytop), 0.04));
    }
  }
  if (gd.length) building.add(new THREE.Mesh(mergeGeos(gd), darkMat));
}
// Treppentürme der Westtürme (Grundriss 1906: achteckig, mittig vor der Nordseite des Nordturms und der Südseite des Südturms;
// Foto von Südwesten: Süden bis knapp unter das unterste Friesband, Kupferhaube)
function stairTurret(x, z, R, h, cap, mat) {
  const g = new THREE.CylinderGeometry(R, R, h, 8);
  g.rotateY(Math.PI / 8);
  scaleUV(g, 2 * Math.PI * R, h);
  g.translate(x, h / 2, z);
  addMesh(g, wallMat);
  const c = new THREE.ConeGeometry(R * 1.12, cap, 8);
  c.rotateY(Math.PI / 8);
  c.translate(x, h + cap / 2, z);
  addMesh(c, mat || roofMat);
}
stairTurret(-43.4, TW.n[0] - 0.6, 1.6, 40.3, 3.2); // Nordturm: höher geführt, bis etwa 3 m über das zweite Friesband (Foto von Westen)
stairTurret(-43.6, TW.s[1] + 0.6, 1.6, 27.4, 3.2);
// Sockel aus Granit und helle Eckquader an den Westecken der Türme (Fotos der Westseite)
{
  const sg = [],
    qg = [],
    H0 = 1.9;
  const plinth = (x0, x1, z0, z1) => {
    const g = boxGeo(Math.abs(x1 - x0), H0, Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, H0 / 2, (z0 + z1) / 2);
    sg.push(g);
  };
  plinth(TW.x0 - 0.15, TW.x0 + 0.1, TW.n[0] - 0.15, TW.s[1] + 0.15);
  plinth(TW.x0 - 0.15, TW.x1, TW.n[0] - 0.15, TW.n[0] + 0.1);
  plinth(TW.x0 - 0.15, CHAPELS[0].x0 - 0.5, TW.s[1] - 0.1, TW.s[1] + 0.15);
  for (const [cx, sx] of [
    [TW.x0, 1],
    [TW.x1, -1],
  ])
    for (const [cz, sz] of [
      [TW.n[0], -1],
      [TW.n[1], 1],
      [TW.s[0], -1],
      [TW.s[1], 1],
    ])
      for (let y = H0, i = 0; y < T_EAVE - 0.3; y += 0.62, i++) {
        const long = i % 2 === 0;
        if (sx < 0 && y < HN + 0.5) continue; // Ostecken erst über den Dächern sichtbar
        const a = boxGeo(0.14, 0.58, long ? 1.1 : 0.55);
        a.translate(cx - sx * 0.05, y + 0.29, cz - sz * (long ? 0.55 : 0.275));
        qg.push(a);
        const b = boxGeo(long ? 0.55 : 1.1, 0.58, 0.14);
        b.translate(cx + sx * (long ? 0.275 : 0.55), y + 0.29, cz + sz * 0.05);
        qg.push(b);
      }
  const qm = new THREE.MeshStandardMaterial({ color: lin(0x9a958c), roughness: 0.88 });
  qm.clippingPlanes = [cutPlane];
  addMesh(mergeGeos(sg), graniteMat);
  addMesh(mergeGeos(qg), qm, false);
}
// Dachreiter (LoD2: x = 11,9)
// Dachreiter nach Fotos (Nordseite aus der Ferne, Nahaufnahmen von Süden): geschlossener Unterbau bis 2,4 m über den First mit Galerie,
// offene Laterne mit acht Pfosten und schlanken Eckfialen, goldene Krone (Bögen mit Muschelfächern, Fialenkranz),
// achtseitiger Helm mit Krabben, Kugel, Stange und Wetterhahn. Grün patiniertes Metall, dunkler als das Kupferdach.
{
  const xc = 11.9,
    yF = HR + 2.4,
    R = 1.6,
    hL = 5.2,
    SPL = 17.0,
    ys = yF + hL + 0.8,
    A = k => (k * Math.PI) / 4 + Math.PI / 8;
  const dark = new THREE.MeshStandardMaterial({
    color: 0x27322e,
    roughness: 0.75,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  dark.clippingPlanes = [cutPlane];
  const dk = [],
    gd = [];
  {
    const yb = HR - 2.6;
    const base = new THREE.CylinderGeometry(R + 0.25, R + 0.45, yF - yb, 8);
    base.rotateY(Math.PI / 8);
    base.translate(xc, (yb + yF) / 2, 0);
    dk.push(base);
    const led = new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.22, 8);
    led.rotateY(Math.PI / 8);
    led.translate(xc, yF - 0.11, 0);
    dk.push(led);
  } // Gesims unter der Galerie
  for (let k = 0; k < 8; k++) {
    const a = A(k),
      c = Math.cos(a),
      s = Math.sin(a);
    const p = boxGeo(0.18, hL, 0.18);
    p.translate(xc + R * c, yF + hL / 2, R * s);
    dk.push(p); // Pfosten
    const f = new THREE.CylinderGeometry(0.05, 0.07, hL + 0.9, 4);
    f.translate(xc + (R + 0.42) * c, yF + (hL + 0.9) / 2 - 0.2, (R + 0.42) * s);
    dk.push(f); // Eckfiale
    const ft = new THREE.ConeGeometry(0.09, 0.5, 4);
    ft.translate(xc + (R + 0.42) * c, yF + hL + 0.95, (R + 0.42) * s);
    gd.push(ft);
    const b = boxGeo(0.06, 0.06, 0.42);
    b.rotateY(-a);
    b.translate(xc + (R + 0.21) * c, yF + hL * 0.55, (R + 0.21) * s);
    dk.push(b); // Strebe zur Fiale
    const a1 = A(k + 1),
      p0 = [xc + R * c, R * s],
      p1 = [xc + R * Math.cos(a1), R * Math.sin(a1)],
      L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]),
      ang = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]),
      mx = (p0[0] + p1[0]) / 2,
      mz = (p0[1] + p1[1]) / 2;
    for (const yy of [0.5, 1.0]) {
      const r = boxGeo(L, 0.05, 0.05);
      r.rotateY(ang);
      r.translate(mx, yF + yy, mz);
      dk.push(r);
    } // Galeriegeländer
    // Krone: goldener Bogen mit Muschelfächer je Seite, darüber Gesims und Fialenkranz
    const am = (a + a1) / 2,
      out = Math.PI / 2 - am;
    const fan = new THREE.CircleGeometry(0.62, 9, 0, Math.PI);
    fan.rotateY(out);
    fan.translate(xc + R * 0.93 * Math.cos(am), yF + hL - 0.72, R * 0.93 * Math.sin(am));
    gd.push(fan);
    const arch = new THREE.TorusGeometry(0.66, 0.05, 4, 12, Math.PI);
    arch.rotateY(out);
    arch.translate(xc + R * 0.94 * Math.cos(am), yF + hL - 0.72, R * 0.94 * Math.sin(am));
    gd.push(arch);
    const pc = new THREE.ConeGeometry(0.14, 1.15, 4);
    pc.translate(xc + (R + 0.3) * c, yF + hL + 0.8 + 0.55, (R + 0.3) * s);
    gd.push(pc);
    const pm = new THREE.ConeGeometry(0.09, 0.75, 4);
    pm.translate(xc + (R + 0.2) * Math.cos(am), yF + hL + 0.8 + 0.35, (R + 0.2) * Math.sin(am));
    gd.push(pm);
  }
  const core = new THREE.CylinderGeometry(0.28, 0.28, hL, 8);
  core.translate(xc, yF + hL / 2, 0);
  dk.push(core); // Mittelsäule (Glockenstuhl); ringsum ist Platz zum Umhergehen
  {
    const g1 = new THREE.CylinderGeometry(R + 0.36, R + 0.32, 0.4, 8);
    g1.rotateY(Math.PI / 8);
    g1.translate(xc, yF + hL + 0.2, 0);
    gd.push(g1);
    const g2 = new THREE.CylinderGeometry(R + 0.3, R + 0.36, 0.4, 8);
    g2.rotateY(Math.PI / 8);
    g2.translate(xc, yF + hL + 0.6, 0);
    dk.push(g2);
  }
  // Helm mit Krabben auf den Graten
  // Helm braun-bronzefarben, Krabben hell patiniert (Foto vom Petriturm 2010)
  const sp = new THREE.ConeGeometry(R + 0.15, SPL, 8, 1, true);
  sp.rotateY(Math.PI / 8);
  sp.translate(xc, ys + SPL / 2, 0);
  const helmMat = new THREE.MeshStandardMaterial({
    color: lin(0x40362f), // dunkel, fast schwarzbraun (Fotos von Süden und Osten)
    roughness: 0.6,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  helmMat.clippingPlanes = [cutPlane];
  addMesh(sp, helmMat);
  const cr = [];
  for (let k = 0; k < 8; k++) {
    const a = A(k);
    for (let t = 0.06; t < 0.94; t += 0.75 / SPL) {
      const r = (R + 0.15) * (1 - t) + 0.06,
        c = boxGeo(0.13, 0.13, 0.13);
      c.translate(xc + r * Math.cos(a), ys + t * SPL, r * Math.sin(a));
      cr.push(c);
    }
  }
  const crMat = new THREE.MeshStandardMaterial({ color: lin(0x9fc2b2), roughness: 0.7 });
  crMat.clippingPlanes = [cutPlane];
  addMesh(mergeGeos(cr), crMat, false);
  addMesh(mergeGeos(dk), dark);
  addMesh(mergeGeos(gd), goldMat, false);
  const top = ys + SPL,
    b = new THREE.SphereGeometry(0.32, 12, 10);
  b.translate(xc, top + 0.25, 0);
  addMesh(b, goldMat, false);
  const rod = new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6);
  rod.translate(xc, top + 1.2, 0);
  addMesh(rod, goldMat, false);
  // Wetterhahn (Umriss)
  const hs = new THREE.Shape(
    [
      [-0.42, 0.02],
      [-0.3, 0.18],
      [-0.12, 0.22],
      [0.06, 0.2],
      [0.16, 0.36],
      [0.12, 0.5],
      [0.2, 0.62],
      [0.3, 0.58],
      [0.36, 0.48],
      [0.3, 0.36],
      [0.26, 0.2],
      [0.2, 0.05],
      [0.06, -0.08],
      [0.04, -0.2],
      [0.12, -0.3],
      [-0.1, -0.3],
      [-0.04, -0.18],
      [-0.16, -0.08],
      [-0.36, -0.2],
      [-0.52, -0.05],
      [-0.6, 0.22],
      [-0.5, 0.3],
    ].map(p => new THREE.Vector2(p[0], p[1])),
  );
  const hg = new THREE.ShapeGeometry(hs);
  hg.scale(1.15, 1.15, 1);
  hg.translate(xc, top + 2.45, 0);
  addMesh(hg, goldMat, false);
}
// Gauben im Kupferdach des Mittelschiffs: eine Reihe je Seite im unteren Drittel, je Joch eine Gaube über dem Fenster (Foto von St. Petri, Fernfoto von Norden)
{
  const dg = [],
    wg = [],
    RE = ZNF + 0.2,
    slope = (HR - HN) / RE;
  for (const s of [-1, 1])
    for (const yb of [43.2])
      for (let i = 0; i < NB; i++) {
        const x = bayMid(i);
        const z = s * (RE - (yb - HN) / slope),
          d = boxGeo(1.0, 1.0, 1.1);
        d.translate(x, yb + 0.5, z);
        dg.push(d);
        const roof = new THREE.ConeGeometry(0.78, 0.5, 4);
        roof.rotateY(Math.PI / 4);
        roof.scale(1, 1, 1.3);
        roof.translate(x, yb + 1.25, z);
        dg.push(roof);
        const w = new THREE.PlaneGeometry(0.55, 0.6);
        if (s < 0) w.rotateY(Math.PI);
        w.translate(x, yb + 0.5, z + s * 0.56);
        wg.push(w);
      }
  addMesh(mergeGeos(dg), roofMat, false);
  building.add(new THREE.Mesh(mergeGeos(wg), darkMat));
}

// Strebepfeiler und Strebebögen (Lage aus LoD2). Nach Luftbild und Hinweis eines Bauingenieurs: kräftige Bögen mit gerader,
// kupferbedeckter Oberkante und gekrümmter Unterseite; die Pfeiler enden ohne Fialen unter einer schrägen Kupferabdeckung,
// die die Oberkante des Bogens nach außen fortsetzt.
const UP = new V3(0, 1, 0);
/** Ebenes Profil [s, y] (s waagerecht ab a in Richtung u) als Körper der Breite w quer dazu */
function profileMesh(pts, a, u, w, mat) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 1 });
  const n = new V3().crossVectors(u, UP);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(u, UP, n));
  g.translate(a.x - (n.x * w) / 2, 0, a.z - (n.z * w) / 2);
  return addMesh(g, mat);
}
/**
 * Strebebogen von a (Oberkante am Pfeiler) nach b (Oberkante an der Hochschiffwand): oben gerade, unten ein flacher Bogen.
 * hA, hB: Höhe des Bogens am Pfeiler bzw. an der Wand; head: Länge des Pfeilerkopfs hinter a (nach außen), mit Abdeckung.
 */
function flyer(a, b, { hA = 3.2, hB = 2.2, sag = 1.4, w = 1.1, head = 0, hw = 1.6 } = {}) {
  const u = new V3(b.x - a.x, 0, b.z - a.z),
    L = u.length();
  u.divideScalar(L);
  const k = (b.y - a.y) / L,
    N = 14,
    arch = [
      [0, a.y],
      [L, b.y],
    ];
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    arch.push([t * L, a.y - hA + t * (b.y - hB - a.y + hA) + sag * 4 * t * (1 - t)]);
  }
  const cap = (s0, s1, cw) =>
    profileMesh(
      [
        [s0, a.y + k * s0],
        [s1, a.y + k * s1],
        [s1, a.y + k * s1 + 0.16],
        [s0, a.y + k * s0 + 0.16],
      ],
      new V3(a.x, 0, a.z),
      u,
      cw,
      roofMat,
    );
  profileMesh(arch, new V3(a.x, 0, a.z), u, w, wallMat);
  cap(0, L, w + 0.3);
  if (head > 0) {
    profileMesh(
      [
        [-head, a.y - hA],
        [0, a.y - hA],
        [0, a.y],
        [-head, a.y - k * head],
      ],
      new V3(a.x, 0, a.z),
      u,
      hw,
      wallMat,
    );
    cap(-head - 0.15, 0, hw + 0.15);
  }
}
/** Pfeiler im Langhaus: Schaft bis unter den Kopf, darüber Kopf und Bogen zur Hochschiffwand (s: −1 Nord, +1 Süd) */
const FLY = { yW: 37.0, k: 0.577, hA: 5.5 };
function naveButtress(x, s, dIn, dOut, y0) {
  const yA = FLY.yW - FLY.k * (dIn - ZNF);
  box(x - 0.8, x + 0.8, y0, yA - FLY.hA + 0.01, s * dIn, s * dOut);
  flyer(P(x, yA, s * dIn), P(x, FLY.yW, s * (ZNF - 0.05)), { hA: FLY.hA, hB: 2.3, sag: 2.8, w: 1.4, head: dOut - dIn });
}
/** schräge Kupferabdeckung eines niedrigen Pfeilers (nach außen fallend) */
function pierCap(x, s, dIn, dOut, y) {
  profileMesh(
    [
      [0, y + 0.9],
      [dOut - dIn + 0.15, y],
      [dOut - dIn + 0.15, y - 0.16],
      [0, y + 0.74],
    ],
    new V3(x, 0, s * dIn),
    new V3(0, 0, s),
    1.9,
    roofMat,
  );
  profileMesh(
    [
      [0, y],
      [dOut - dIn, y],
      [0, y + 0.82],
    ],
    new V3(x, 0, s * dIn),
    new V3(0, 0, s),
    1.8,
    wallMat,
  );
}
// Bei XT stoßen das steilere Pultdach der westlichen Seitenschiffjoche und die flachere gemeinsame Fläche über Südervorhalle
// und Chorseitenschiff aneinander: Giebeldreieck dazwischen
profileMesh(
  [
    [0, HJ],
    [ZCS - ZNF, SV_IN],
    [ZCS - ZNF, HAS + ((HJ - HAS) / (ZAS + 0.8 - ZNF)) * (ZAS + 0.8 - ZCS)],
  ],
  new V3(XT, 0, ZNF),
  new V3(0, 0, 1),
  0.6,
  wallMat,
);
const SB_FACE = 23.6; // Außenflucht der südlichen Strebepfeiler im Langhaus (LoD2)
export const SD_PIER = 1,
  SD_FACE = 29.8,
  SD_TOP = 17.6; // Sonnenuhr: erster Strebepfeiler östlich des Südturms, vor der Briefkapelle bis zum Boden geführt (LoD2: Außenflucht z = 29,8)
for (let i = 1; i < NB; i++) {
  const x = PX[i];
  // Nord: Pfeiler zwischen den niedrigen Kapellen bzw. über den Chorkapellen
  if (x < XT - 0.1) naveButtress(x, -1, ZAN + 0.6, ZKN + 0.5, 0);
  else naveButtress(x, -1, ZAN + 0.6, 21.4, HAN - 0.5);
  // Süd: wie im Norden an jedem Pfeiler ein Bogen; östlich von XT stehen die Pfeiler auf der Dachfläche über Südervorhalle
  // und Bürgermeisterkapelle (Luftbilder)
  const zs = x < XT - 0.1 ? ZAS : ZCS;
  naveButtress(x, 1, zs - 0.7, zs + 0.75, HAS - 1.5);
  if (x > XT + 0.1 && x < XC - 2) {
    // Strebepfeiler vor der Front von Südervorhalle und Bürgermeisterkapelle, schräg abgedeckt knapp unter der Traufe (Luftbild)
    box(x - 0.8, x + 0.8, 0, 19.0, CHAPELS[3].zo - 0.1, CHAPELS[3].zo + 1.3);
    pierCap(x, 1, CHAPELS[3].zo - 0.1, CHAPELS[3].zo + 1.3, 19.0);
  }
  if (x < XT - 0.1 && x > CHAPELS[0].x1) {
    box(x - 0.9, x + 0.9, 0, 18.4, ZAS + 0.6, SB_FACE);
    pierCap(x, 1, ZAS + 0.6, SB_FACE, 18.4);
  }
  if (i === SD_PIER) {
    box(x - 0.8, x + 0.8, 0, SD_TOP, CHAPELS[0].zo + 0.45, SD_FACE);
    box(x - 0.8, x + 0.8, 12.6, SD_TOP, ZAS + 0.6, CHAPELS[0].zo + 0.5);
    box(x - 0.9, x + 0.9, SD_TOP, SD_TOP + 0.12, CHAPELS[0].zo + 0.3, SD_FACE + 0.1, darkRoofMat);
  } // flach abgedeckt, gut 1 m über der Sonnenuhr (Fotos 2026)
}
// Strebepfeiler des Kapellenkranzes in Richtung der Chorecken (Grundriss) mit Strebebögen zu den Polygonecken (Drohnenfoto)
{
  const co = choirOff(0.75),
    CHF = { hA: 2.4, hB: 1.8, sag: 0.9, w: 1.0 };
  for (const s of [-1, 1])
    for (const k of [1, 2, 3]) {
      const v = AMB_N[k],
        n = AMB_BN[k],
        L = k === 2 ? 1.8 : 3.2,
        c = [v[0] + n[0] * (0.6 + L / 2), -s * (v[1] + n[1] * (0.6 + L / 2))];
      const m = addMesh(boxGeo(1.5, HCS + 1.4, L), wallMat);
      m.position.set(c[0], (HCS + 1.4) / 2, c[1]);
      m.lookAt(c[0] + n[0], (HCS + 1.4) / 2, c[1] - s * n[1]);
    }
  for (const s of [-1, 1]) {
    const v1 = AMB_N[1],
      n1 = AMB_BN[1],
      v3 = AMB_N[3],
      n3 = AMB_BN[3];
    flyer(P(v1[0] + n1[0] * 0.8, 21.6, -s * (v1[1] + n1[1] * 0.8)), P(XC + 0.2, 34.5, s * (ZNF + 0.05)), CHF);
    flyer(P(v3[0] + n3[0] * 0.8, 21.6, -s * (v3[1] + n3[1] * 0.8)), P(co[1][0], 34.5, -s * co[1][1]), CHF);
  }
}
// Treppentürme an den Anschlüssen des Umgangs (Grundriss; Drohnenfoto: dunkles Kegeldach)
// Nord: (28,5 / −18,8) über die Dächer geführt, dunkles Kegeldach (Luftbilder von Osten); Süd: (26,4 / 17,6) endet unter den Dächern
stairTurret(28.5, -18.8, 1.35, 27.0, 5.0, darkRoofMat);
stairTurret(26.4, 17.6, 1.35, 21.2, 1.2, darkRoofMat);

// Ausstattung: Gestühl und Altar sind im Zuge der Sanierung aus der Kirche entfernt und deshalb nicht dargestellt.
box(31.4, 31.6, 6.0, 12.4, -0.14, 0.14, woodMat);
box(31.4, 31.6, 10.2, 10.5, -1.6, 1.6, woodMat); // Triumphkreuz, frei hängend (nach Innenfoto)
{
  const g = new THREE.CylinderGeometry(0.012, 0.012, 30.6 - 12.4, 4);
  g.translate(31.5, (30.6 + 12.4) / 2, 0);
  addMesh(g, darkMat, false);
}

// Fensterpfosten aller Fenster als ein Netz (werfen Schatten, sind aber nicht Teil der Strahlprüfung)
{
  const m = new THREE.Mesh(mergeGeos(mullionGeos), mullionMat);
  m.castShadow = true;
  m.receiveShadow = true;
  building.add(m);
}
// Wappenscheiben (Stiftungen von 1953) in den hellen Fenstern der Chorkapellen: kleine farbige Felder im unteren Fensterdrittel (Fotos 2026).
// Die Motive sind vereinfacht und nicht einzelnen Fenstern zugeordnet.
{
  const T = 128,
    medTex = canvasTex(
      T * 4,
      T * 2,
      g => {
        g.clearRect(0, 0, T * 4, T * 2);
        const shield = (x, y, fill) => {
          g.save();
          g.translate(x, y);
          g.beginPath();
          g.moveTo(18, 14);
          g.lineTo(110, 14);
          g.lineTo(110, 62);
          g.quadraticCurveTo(108, 104, 64, 120);
          g.quadraticCurveTo(20, 104, 18, 62);
          g.closePath();
          g.save();
          g.clip();
          fill(g);
          g.restore();
          g.lineWidth = 5;
          g.strokeStyle = '#2a2420';
          g.stroke();
          g.restore();
        };
        const disc = (x, y, ring, fill) => {
          g.save();
          g.translate(x + 64, y + 64);
          g.beginPath();
          g.arc(0, 0, 58, 0, 7);
          g.fillStyle = ring;
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2a2420';
          g.stroke();
          g.beginPath();
          g.arc(0, 0, 40, 0, 7);
          g.save();
          g.clip();
          fill(g);
          g.restore();
          g.stroke();
          g.restore();
        };
        const eagle = (g, c) => {
          g.fillStyle = c;
          g.beginPath();
          g.ellipse(64, 62, 10, 22, 0, 0, 7);
          g.fill();
          g.beginPath();
          g.moveTo(60, 50);
          g.lineTo(22, 34);
          g.lineTo(30, 58);
          g.lineTo(22, 64);
          g.lineTo(56, 70);
          g.fill();
          g.beginPath();
          g.moveTo(68, 50);
          g.lineTo(106, 34);
          g.lineTo(98, 58);
          g.lineTo(106, 64);
          g.lineTo(72, 70);
          g.fill();
          g.beginPath();
          g.arc(64, 36, 7, 0, 7);
          g.fill();
          g.beginPath();
          g.moveTo(54, 84);
          g.lineTo(64, 104);
          g.lineTo(74, 84);
          g.fill();
        };
        shield(0, 0, g => {
          g.fillStyle = '#f2efe6';
          g.fillRect(0, 0, T, 64);
          g.fillStyle = '#c0262d';
          g.fillRect(0, 64, T, 64);
        }); // geteilt Silber über Rot
        shield(T, 0, g => {
          g.fillStyle = '#e7b631';
          g.fillRect(0, 0, T, T);
          eagle(g, '#1e1a18');
        });
        shield(2 * T, 0, g => {
          g.fillStyle = '#e9bf3a';
          g.fillRect(0, 0, T, T);
          g.fillStyle = '#2546a8';
          for (const y of [40, 84]) {
            g.beginPath();
            g.ellipse(64, y, 30, 13, 0, 0, 7);
            g.fill();
            g.fillRect(36, y - 3, 8, 18);
            g.fillRect(80, y - 3, 8, 18);
          }
        });
        disc(3 * T, 0, '#c0262d', g => {
          g.fillStyle = '#f2efe6';
          g.fillRect(-60, -60, 120, 120);
          g.fillStyle = '#1e1a18';
          g.fillRect(-6, -34, 12, 68);
          g.fillRect(-34, -6, 68, 12);
        });
        shield(0, T, g => {
          g.fillStyle = '#2546a8';
          g.fillRect(0, 0, T, T);
          for (let k = 0; k < 6; k++) {
            g.fillStyle = k % 2 ? '#f2efe6' : '#c0262d';
            g.fillRect(36, 22 + k * 13, 56, 13);
          }
        });
        disc(T, T, '#d9a441', g => {
          g.fillStyle = '#3d6fc4';
          g.fillRect(-60, -60, 120, 120);
          g.fillStyle = '#7a3b22';
          g.beginPath();
          g.moveTo(-26, 8);
          g.lineTo(26, 8);
          g.lineTo(18, 22);
          g.lineTo(-18, 22);
          g.fill();
          g.fillStyle = '#f2efe6';
          g.beginPath();
          g.moveTo(-2, 6);
          g.lineTo(-2, -30);
          g.lineTo(-22, 4);
          g.fill();
          g.fillStyle = '#c0262d';
          g.beginPath();
          g.moveTo(2, 6);
          g.lineTo(2, -26);
          g.lineTo(20, 4);
          g.fill();
        });
        disc(2 * T, T, '#e0b13a', g => {
          g.fillStyle = '#2b56b0';
          g.fillRect(-60, -60, 120, 120);
          g.fillStyle = '#f2efe6';
          for (let k = 0; k < 5; k++) {
            const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
            g.beginPath();
            g.arc(Math.cos(a) * 16, Math.sin(a) * 16, 13, 0, 7);
            g.fill();
          }
          g.fillStyle = '#c0262d';
          g.beginPath();
          g.arc(0, 0, 11, 0, 7);
          g.fill();
          g.fillStyle = '#1e1a18';
          g.fillRect(-2, -8, 4, 16);
          g.fillRect(-6, -3, 12, 4);
        });
        shield(3 * T, T, g => {
          for (let i = 0; i < 8; i++)
            for (let j = 0; j < 9; j++) {
              g.fillStyle = (i + j) % 2 ? '#f2efe6' : '#3d82d0';
              g.beginPath();
              const x = i * 16 + (j % 2) * 8,
                y = j * 14;
              g.moveTo(x, y - 8);
              g.lineTo(x + 8, y);
              g.lineTo(x, y + 8);
              g.lineTo(x - 8, y);
              g.fill();
            }
        });
      },
      null,
    );
  medTex.encoding = THREE.sRGBEncoding;
  let k = 0;
  for (const w of windows) {
    if (w.type >= 0 || w.bottom > 10 || w.apex > 22) continue;
    const c = w.center;
    if (!(c.x > 8.6 && (Math.abs(c.z) > 15 || c.x > XC))) continue;
    const id = (k * 5 + 3) % 8,
      sz = w.hw >= 1.2 ? 0.72 : 0.6,
      g = new THREE.PlaneGeometry(sz, sz),
      uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, ((id % 4) + uv.getX(i)) / 4, (uv.getY(i) - Math.floor(id / 4)) / 2 + 0.5); // Atlas 4×2, obere Reihe = v 0,5…1
    const XR = new V3(0, 1, 0).cross(w.inward).normalize(); // von innen gesehen nach rechts: Bild seitenrichtig
    const mat = new THREE.MeshBasicMaterial({ map: medTex, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.clippingPlanes = [cutPlane];
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    const pos = w.O.clone()
      .addScaledVector(new V3(0, 1, 0), w.bottom + Math.min(1.5, 0.2 * (w.apex - w.bottom)))
      .addScaledVector(w.inward, 0.06)
      .addScaledVector(XR, w.hw >= 1.35 ? 0 : -w.hw / 2); // zweibahnig: in die linke Bahn, nicht auf den Pfosten
    mesh.matrix.copy(new THREE.Matrix4().makeBasis(XR, new V3(0, 1, 0), w.inward.clone()).setPosition(pos));
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    building.add(mesh);
    w.med = mesh;
    k++;
  }
  console.log('[St. Marien] Wappenscheiben: ' + k);
}
