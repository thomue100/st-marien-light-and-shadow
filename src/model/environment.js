// Umgebung: LoD2-Gebäude, Gelände und Bäume (LVermGeo SH); Verschattung durch die Nachbarschaft.
import './clock.js'; // Aufbau-Reihenfolge: nach model/clock
import { DATA } from '../data.js';
import { step } from '../core/loader.js';
import { tr } from '../core/i18n.js';
import { LD, state } from '../state.js';
import { requestRender, scene } from '../scene/renderer.js';
import { rng } from '../scene/textures.js';
import { lin } from '../scene/materials.js';
import { groundMesh } from './church.js';

await step(
  tr('Umgebung wird geladen (273 Gebäude, Gelände, Bäume)', 'Loading surroundings (273 buildings, terrain, trees)'),
  58,
);
/* ---------------- Umgebung: LoD2-Gebäude, Gelände und Bäume (LVermGeo SH) ---------------- */
// Gebäude: LoD2 (CityGML, 2025). Gelände und Bäume: aus dem Oberflächenmodell bDOM20 (2023) abgeleitet.
// Verschattung: Strahlverfolgung über ein 1-m-Höhenraster (Dächer aus bDOM20, Bäume abschaltbar).
// Altstadtinsel (ENV.far): übrige LoD2-Gebäude der Insel als Kulisse, Gelände im 8-m-Raster, Bodenkarte aus
// OpenStreetMap (Wasser, Grün, Plätze, Straßen) und ein 2-m-Fernraster der hohen Bauten (Kirchtürme) für die Verschattung.
export const ENV = await DATA.env;
export let envH = null,
  envCls = null,
  envG = null,
  envMax = -1e9;
let farShade = null, // dichtes 2-m-Raster der hohen Bauten außerhalb des Nahbereichs
  farMax = -1e9,
  groundTex = null; // Bodenkarte (OSM)
export const envGroup = new THREE.Group(),
  treeGroup = new THREE.Group();
scene.add(envGroup);
scene.add(treeGroup);
let churchLines = null;
function b64(s) {
  const bin = atob(s),
    u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function u16grid(s, base) {
  const b = b64(s),
    n = b.length / 2,
    out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = base + (b[2 * k] | (b[2 * k + 1] << 8)) / 100;
  return out;
}
function i16arr(s) {
  const b = b64(s);
  return new Int16Array(b.buffer, b.byteOffset, b.length / 2);
}
/** Base64 → gzip entpacken (Daten der Altstadtinsel). */
async function gunzip(s) {
  const ds = new DecompressionStream('gzip');
  return new Uint8Array(await new Response(new Blob([b64(s)]).stream().pipeThrough(ds)).arrayBuffer());
}
const F = ENV && ENV.far;
if (F) {
  // Bodenkarte: Palettenindex je Pixel → Farbtextur (lineare Farben)
  const T = F.tex,
    ti = await gunzip(T.idx),
    n = T.n,
    P = T.pal.map(c => c.map(v => Math.round(Math.min(1, v) * 255))),
    rgba = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    const c = P[ti[k]];
    rgba[4 * k] = c[0];
    rgba[4 * k + 1] = c[1];
    rgba[4 * k + 2] = c[2];
    rgba[4 * k + 3] = 255;
  }
  groundTex = new THREE.DataTexture(rgba, n, n, THREE.RGBAFormat);
  groundTex.magFilter = THREE.LinearFilter;
  groundTex.minFilter = THREE.LinearMipmapLinearFilter;
  groundTex.generateMipmaps = true;
  groundTex.anisotropy = 8;
  groundTex.needsUpdate = true;
  // Fernraster für die Verschattung
  const S = F.shade;
  if (S) {
    const I = new Int16Array((await gunzip(S.i)).buffer),
      J = new Int16Array((await gunzip(S.j)).buffer),
      Hh = new Uint16Array((await gunzip(S.h)).buffer);
    let i0 = 1e9,
      i1 = -1e9,
      j0 = 1e9,
      j1 = -1e9;
    for (let k = 0; k < I.length; k++) {
      i0 = Math.min(i0, I[k]);
      i1 = Math.max(i1, I[k]);
      j0 = Math.min(j0, J[k]);
      j1 = Math.max(j1, J[k]);
    }
    const ni = i1 - i0 + 1,
      nj = j1 - j0 + 1,
      h = new Float32Array(ni * nj).fill(-1e9);
    for (let k = 0; k < I.length; k++) h[(J[k] - j0) * ni + (I[k] - i0)] = S.base + Hh[k] / 100;
    farShade = { step: S.step, i0, j0, ni, nj, h };
    farMax = S.max;
  }
}
/** Texturkoordinaten der Bodenkarte für eine Ebene aus x/z-Positionen. */
function groundUV(pos) {
  const T = F.tex,
    nv = pos.length / 3,
    uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    uv[2 * i] = (pos[3 * i] - T.x0) / T.size;
    uv[2 * i + 1] = (pos[3 * i + 2] - T.z0) / T.size;
  }
  return new THREE.BufferAttribute(uv, 2);
}
if (ENV) {
  const n = ENV.n,
    st = ENV.step,
    o = ENV.origin;
  envH = u16grid(ENV.occ, ENV.base);
  envCls = b64(ENV.cls);
  envG = u16grid(ENV.ground, ENV.base);
  for (let k = 0; k < envH.length; k++) if (envH[k] > envMax) envMax = envH[k];
  const r = rng(31);
  // Gelände (2-m-Raster)
  {
    const gn = ENV.gn,
      gs = ENV.gstep,
      pos = new Float32Array(gn * gn * 3),
      col = new Float32Array(gn * gn * 3);
    for (let j = 0; j < gn; j++)
      for (let i = 0; i < gn; i++) {
        const k = j * gn + i;
        pos[3 * k] = o + i * gs;
        pos[3 * k + 1] = envG[k];
        pos[3 * k + 2] = o + j * gs;
        const t = 0.92 + r() * 0.1,
          c = groundTex ? [0.96, 0.96, 0.96] : [0.235, 0.228, 0.215]; // mit Bodenkarte nur leichte Streuung
        col[3 * k] = c[0] * t;
        col[3 * k + 1] = c[1] * t;
        col[3 * k + 2] = c[2] * t;
      }
    const idx = new Uint32Array((gn - 1) * (gn - 1) * 6);
    let p = 0;
    for (let j = 0; j < gn - 1; j++)
      for (let i = 0; i < gn - 1; i++) {
        const a = j * gn + i,
          b = a + 1,
          c = a + gn,
          d = c + 1;
        idx[p++] = a;
        idx[p++] = c;
        idx[p++] = b;
        idx[p++] = b;
        idx[p++] = c;
        idx[p++] = d;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (groundTex) g.setAttribute('uv', groundUV(pos));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundTex,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    envGroup.add(mesh);
  }
  // LoD2-Gebäude
  {
    const P = i16arr(ENV.bld.pos),
      K = b64(ENV.bld.kind),
      ib = b64(ENV.bld.idx);
    const idx = ENV.bld.i32
      ? new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4)
      : new Uint16Array(ib.buffer, ib.byteOffset, ib.length / 2);
    const nv = P.length / 3,
      pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) pos[i] = P[i] / 100;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const nor = g.attributes.normal.array,
      col = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const ny = nor[3 * i + 1],
        jit = 0.94 + ((((i * 2654435761) >>> 0) % 1000) / 1000) * 0.1;
      let c;
      if (K[i] === 1)
        c = ny > 0.985 ? [0.2, 0.2, 0.21] : [0.35, 0.125, 0.08]; // Luftbild: Flachdach grau, Steildach Ziegel terrakotta (linear)
      else c = [0.29, 0.26, 0.225]; // Wand gedeckt warmgrau, damit die Kirche im Vordergrund bleibt
      col[3 * i] = c[0] * jit;
      col[3 * i + 1] = c[1] * jit;
      col[3 * i + 2] = c[2] * jit;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    envGroup.add(mesh);
  }
  // Bäume und sonstige Objekte (1-m-Zellen aus bDOM20 außerhalb der Gebäude)
  {
    const pos = [],
      idx = [];
    let v = 0;
    const H = (i, j) => envH[j * n + i];
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        if (envCls[j * n + i] !== 2) continue;
        const x = o + i * st,
          z = o + j * st;
        pos.push(x, H(i, j), z, x + st, H(i + 1, j), z, x, H(i, j + 1), z + st, x + st, H(i + 1, j + 1), z + st);
        idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 4;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: lin(0x56683f), roughness: 0.95, side: THREE.DoubleSide }); // Laubgrün wie im Luftbild
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    treeGroup.add(mesh);
  }
  // Altstadtinsel: Gelände außerhalb des Nahbereichs (8-m-Raster, Bodenkarte) und die übrigen Gebäude der Insel
  if (F) {
    const G = F.ground,
      nx = G.nx,
      nz = G.nz,
      H = new Uint16Array((await gunzip(G.h)).buffer),
      pos = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[3 * k] = G.x0 + i * G.step;
        pos[3 * k + 1] = G.base + H[k] / 100;
        pos[3 * k + 2] = G.z0 + j * G.step;
      }
    const near = k => Math.abs(pos[3 * k]) < -o + 1e-3 && Math.abs(pos[3 * k + 2]) < -o + 1e-3,
      idx = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i,
          b = a + 1,
          c = a + nx,
          d = c + 1;
        if (near(a) && near(b) && near(c) && near(d)) continue; // dort liegt das genaue Gelände
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', groundUV(pos));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 4,
      }),
    );
    mesh.receiveShadow = true;
    mesh.userData.far = true;
    envGroup.add(mesh);
    // Gebäude: Wände, Steildächer, Flachdächer; die hohen werfen Schatten (bis zur Kirche), die übrigen nur Kulisse
    const COL = { wall: [0.29, 0.26, 0.225], roof: [0.35, 0.125, 0.08], flat: [0.2, 0.2, 0.21] };
    for (const grp of ['low', 'tall'])
      for (const c of ['wall', 'roof', 'flat']) {
        const D = F[grp + '_' + c];
        if (!D) continue;
        const P = new Int16Array((await gunzip(D.pos)).buffer),
          ib = await gunzip(D.idx),
          ix = D.i32 ? new Uint32Array(ib.buffer) : new Uint16Array(ib.buffer),
          pos = new Float32Array(P.length);
        for (let i = 0; i < P.length; i++) pos[i] = P[i] / F.scale;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setIndex(new THREE.BufferAttribute(ix, 1));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(
          g,
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setRGB(...COL[c]),
            roughness: 0.88,
            metalness: 0,
            flatShading: true,
            side: THREE.DoubleSide,
          }),
        );
        mesh.castShadow = grp === 'tall';
        mesh.receiveShadow = true;
        mesh.userData.far = true; // nicht für Sichtstrahlen (zu viele Dreiecke); Verschattung über das Fernraster
        envGroup.add(mesh);
      }
  }
  // LoD2-Umriss der Kirche zum Vergleich mit dem Modell
  {
    const S = i16arr(ENV.church),
      pos = new Float32Array(S.length);
    for (let i = 0; i < S.length; i++) pos[i] = S[i] / 100;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    churchLines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, depthTest: false, fog: false }),
    );
    churchLines.renderOrder = 20;
    churchLines.visible = false;
    scene.add(churchLines);
  }
}
export function envSample(arr, nn, stp, x, z) {
  const fi = (x - ENV.origin) / stp,
    fj = (z - ENV.origin) / stp;
  if (fi < 0 || fj < 0 || fi > nn - 1 || fj > nn - 1) return -1e9;
  const i = Math.floor(fi),
    j = Math.floor(fj),
    i1 = Math.min(i + 1, nn - 1),
    j1 = Math.min(j + 1, nn - 1),
    tx = fi - i,
    tz = fj - j;
  return (
    (arr[j * nn + i] * (1 - tx) + arr[j * nn + i1] * tx) * (1 - tz) +
    (arr[j1 * nn + i] * (1 - tx) + arr[j1 * nn + i1] * tx) * tz
  );
}
export function envHeightAt(x, z) {
  const n = ENV.n,
    i = Math.round((x - ENV.origin) / ENV.step),
    j = Math.round((z - ENV.origin) / ENV.step);
  if (i < 0 || j < 0 || i >= n || j >= n) return -1e9;
  const k = j * n + i;
  if (envCls[k] === 2 && !state.trees) return envSample(envG, ENV.gn, ENV.gstep, x, z);
  return envH[k];
}
export function envBlocked(o) {
  if (!state.env || !envH) return false;
  const hz = Math.hypot(LD.x, LD.z);
  if (LD.y <= 0) return true;
  const dt = 0.5 / Math.max(hz, 1e-3),
    lim = -ENV.origin,
    top = Math.max(envMax, farMax);
  for (let t = dt; t < 3000; t += dt) {
    const y = o.y + LD.y * t;
    if (y > top) return false;
    const x = o.x + LD.x * t,
      z = o.z + LD.z * t;
    if (Math.abs(x) > lim || Math.abs(z) > lim) {
      // jenseits des Nahbereichs: nur noch die hohen Bauten der Altstadtinsel (Kirchtürme)
      if (!farShade) return false;
      const S = farShade,
        i = Math.floor(x / S.step) - S.i0,
        j = Math.floor(z / S.step) - S.j0;
      if (i < 0 || j < 0 || i >= S.ni || j >= S.nj) {
        if ((x / S.step < S.i0 && LD.x < 0) || (x / S.step > S.i0 + S.ni && LD.x > 0)) return false;
        if ((z / S.step < S.j0 && LD.z < 0) || (z / S.step > S.j0 + S.nj && LD.z > 0)) return false;
        continue;
      }
      if (S.h[j * S.ni + i] > y) return true;
      continue;
    }
    if (envHeightAt(x, z) > y) return true;
  }
  return false;
}
export function applyEnv() {
  envGroup.visible = state.env;
  treeGroup.visible = state.env && state.trees;
  if (churchLines) churchLines.visible = state.lodChurch;
  groundMesh.position.y = state.env && ENV ? (F ? F.ground.base + 6.5 : ENV.base - 0.3) : 0; // unter dem Wasser der Insel
  requestRender();
}
