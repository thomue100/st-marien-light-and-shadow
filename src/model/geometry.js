// Geometrie-Helfer (Wände mit Öffnungen, Spitzbögen, Verschattung) und die Liste aller Fenster.
import { doorMat, outerBack, outerFront, wallMat } from '../scene/materials.js'; // Aufbau-Reihenfolge: nach scene/materials
import { V3 } from '../three-global.js';
import { step } from '../core/loader.js';
import { tr } from '../core/i18n.js';
import { SQ3 } from './measures.js';
import { cutPlane, scene } from '../scene/renderer.js';
import { atlasMip, diamondTex, NT, typeColor } from '../scene/textures.js';
import { insideJS, MAXW, TINT } from '../scene/shaders.js';

/* ---------------- Geometrie-Helfer ---------------- */

export const building = new THREE.Group();
scene.add(building);
export const occluders = [];
export function addMesh(geo, mat, cast, recv) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast !== false;
  m.receiveShadow = recv !== false;
  building.add(m);
  if (m.castShadow) occluders.push(m);
  return m;
}
export function scaleUV(g, sx, sy) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return g;
}
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv,
    dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  return g;
}
export function box(x0, x1, y0, y1, z0, z1, mat) {
  const g = boxGeo(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return addMesh(g, mat || wallMat);
}
export function polyGeo(faces) {
  const pos = [],
    uv = [],
    ab = new V3(),
    ac = new V3(),
    n = new V3(),
    e2 = new V3(),
    tmp = new V3();
  for (const f of faces) {
    const a = f[0];
    ab.subVectors(f[1], a);
    ac.subVectors(f[2], a);
    n.crossVectors(ab, ac).normalize();
    const e1 = ab.clone().normalize();
    e2.crossVectors(n, e1);
    const push = v => {
      pos.push(v.x, v.y, v.z);
      tmp.subVectors(v, a);
      uv.push(tmp.dot(e1), tmp.dot(e2));
    };
    push(f[0]);
    push(f[1]);
    push(f[2]);
    if (f.length === 4) {
      push(f[0]);
      push(f[2]);
      push(f[3]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
export function mergeGeos(gs) {
  let pc = 0,
    ic = 0;
  for (const g of gs) {
    pc += g.attributes.position.count;
    ic += g.index.count;
  }
  const pos = new Float32Array(pc * 3),
    nor = new Float32Array(pc * 3),
    uv = new Float32Array(pc * 2),
    idx = new Uint32Array(ic);
  let po = 0,
    io = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, po * 3);
    nor.set(g.attributes.normal.array, po * 3);
    uv.set(g.attributes.uv.array, po * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + po;
    po += g.attributes.position.count;
    io += gi.length;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
export const P = (x, y, z) => new V3(x, y, z);

/* Spitzbogen (gleichseitig): Punkte von links unten über den Scheitel nach rechts unten */
export function lancet(c, hw, bottom, spring, n) {
  n = n || 10;
  const pts = [
      [c - hw, bottom],
      [c - hw, spring],
    ],
    r = 2 * hw;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI - ((Math.PI / 3) * i) / n;
    pts.push([c + hw + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  for (let i = 1; i <= n; i++) {
    const a = Math.PI / 3 - ((Math.PI / 3) * i) / n;
    pts.push([c - hw + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  pts.push([c + hw, bottom]);
  return pts;
}
function wallGeo(Lw, H, t, openings, ext, top) {
  const s = new THREE.Shape();
  s.moveTo(-ext, 0);
  openings
    .filter(o => o.kind === 'door')
    .sort((a, b) => a.u - b.u)
    .forEach(d => {
      lancet(d.u, d.hw, 0, d.spring, 10).forEach(p => s.lineTo(p[0], p[1]));
    });
  s.lineTo(Lw + ext, 0);
  if (top) top.forEach(p => s.lineTo(p[0], p[1]));
  else {
    s.lineTo(Lw + ext, H);
    s.lineTo(-ext, H);
  }
  openings
    .filter(o => o.kind === 'win' && !o.inDoor)
    .forEach(w => {
      const pts = lancet(w.u, w.hw, w.bottom, w.spring, 10);
      const path = new THREE.Path();
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
      s.holes.push(path);
    });
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
}
export const windows = [];
export function wall(p0, p1, o) {
  const dx = p1[0] - p0[0],
    dz = p1[1] - p0[1],
    Lw = Math.hypot(dx, dz);
  const X = new V3(dx / Lw, 0, dz / Lw),
    Y = new V3(0, 1, 0),
    Z = new V3().crossVectors(X, Y);
  const t = o.t,
    y0 = o.y0 || 0,
    ext = o.ext !== undefined ? o.ext : t / 2,
    ops = o.openings || [];
  const g = wallGeo(Lw, o.h, t, ops, ext, o.top);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  m.setPosition(new V3(p0[0], y0, p0[1]).addScaledVector(Z, -t / 2));
  g.applyMatrix4(m);
  addMesh(g, o.mat || wallMat);
  ops.forEach(w => {
    if (w.kind === 'win') registerWindow(p0, X, Z, y0, w, t);
  });
  if (o.doorLeaf)
    ops
      .filter(d => d.kind === 'door')
      .forEach(d => {
        const tw = ops.find(w => w.inDoor && Math.abs(w.u - d.u) < 0.01),
          sh = new THREE.Shape(); // mit Oberlicht: Türblatt nur bis unter das Glas
        const pts = tw
          ? [
              [d.u - d.hw, 0],
              [d.u - d.hw, tw.bottom],
              [d.u + d.hw, tw.bottom],
              [d.u + d.hw, 0],
            ]
          : lancet(d.u, d.hw, 0, d.spring, 10);
        sh.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
        const dg = new THREE.ShapeGeometry(sh);
        dg.translate(0, 0, t * 0.55);
        dg.applyMatrix4(m);
        addMesh(dg, doorMat);
      }); // geschlossene Außentür
}
export const W = (u, hw, bottom, spring, glass, inDoor) => ({
  kind: 'win',
  u,
  hw,
  bottom,
  spring,
  glass: glass === undefined ? -1 : glass,
  inDoor: !!inDoor,
}); // inDoor: Oberlicht im Türbogen, kein eigenes Wandloch
export const D = (u, hw, spring) => ({ kind: 'door', u, hw, spring });

await step(tr('Fenster werden angelegt', 'Placing the windows'), 22);
/* ---------------- Fenster: Glas, Lichtbahn, Datensatz ---------------- */
const beamVS = `attribute float aA; varying float vA;
#include <clipping_planes_pars_vertex>
void main(){ vA=aA; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;
#include <clipping_planes_vertex>
}`;
const beamFS = `uniform vec3 uColor; uniform float uI; varying float vA;
#include <clipping_planes_pars_fragment>
void main(){
#include <clipping_planes_fragment>
 float a=pow(vA,1.5); gl_FragColor=vec4(uColor*a*uI,1.0); }`;
export const mullionGeos = [];
const archY = (u, hw, sp) => sp + Math.sqrt(Math.max(0, 4 * hw * hw - Math.pow(u <= 0 ? u - hw : u + hw, 2)));
function registerWindow(p0, X, Z, y0, o, t) {
  const apex = o.spring + SQ3 * o.hw,
    mid = (o.bottom + apex) / 2,
    Y = new V3(0, 1, 0);
  const O = new V3(p0[0] + X.x * o.u, y0, p0[1] + X.z * o.u);
  const test = O.clone().addScaledVector(Z, t / 2 + 0.8);
  test.y += mid;
  const inward = insideJS(test.x, test.y, test.z) ? Z.clone() : Z.clone().negate();
  const outN = inward.clone().negate(),
    type = o.glass;
  const fs = new V3().crossVectors(outN, Y).dot(X) < 0 ? -1 : 1; // Glasbild von innen seitenrichtig: links/rechts wie vom Kirchenraum aus gesehen
  const w = {
    O,
    X: X.clone(),
    Z: Z.clone(),
    inward,
    outN,
    hw: o.hw,
    bottom: o.bottom,
    spring: o.spring,
    apex,
    type,
    t,
    lit: 0,
  };
  const pts = lancet(0, o.hw, o.bottom, o.spring, 12);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  const basis = new THREE.Matrix4().makeBasis(X, Y, Z);
  function pane(off, mat) {
    const g = new THREE.ShapeGeometry(shape);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      if (type >= 0)
        uv.setXY(i, (type + 0.02 + (0.96 * (fs * u + o.hw)) / (2 * o.hw)) / NT, (v - o.bottom) / (apex - o.bottom));
      else uv.setXY(i, u * 1.25, v * 1.25);
    }
    const m = basis.clone();
    m.setPosition(O.clone().addScaledVector(inward, off));
    g.applyMatrix4(m);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    building.add(mesh);
    return mesh;
  }
  const inMat = new THREE.MeshBasicMaterial({
    map: type >= 0 ? atlasMip : diamondTex,
    side: inward.dot(Z) > 0 ? THREE.FrontSide : THREE.BackSide,
  });
  inMat.clippingPlanes = [cutPlane];
  w.paneIn = pane(0.04, inMat);
  w.paneOut = pane(-0.04, outN.dot(Z) > 0 ? outerFront : outerBack);
  // Lichtbahn
  const N = pts.length;
  w.ptsIn = pts.map(p =>
    O.clone()
      .addScaledVector(X, p[0])
      .addScaledVector(Y, p[1])
      .addScaledVector(inward, t / 2 + 0.03),
  );
  const pos = new Float32Array(N * 6),
    al = new Float32Array(N * 2),
    idx = [];
  for (let i = 0; i < N; i++) {
    al[i] = 1;
    al[N + i] = 0;
    const j = (i + 1) % N;
    idx.push(i, j, N + i, j, N + j, N + i);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bg.setAttribute('aA', new THREE.BufferAttribute(al, 1));
  bg.setIndex(idx);
  const bm = new THREE.ShaderMaterial({
    vertexShader: beamVS,
    fragmentShader: beamFS,
    uniforms: {
      uColor: { value: type >= 0 ? typeColor[type].clone() : new THREE.Color(1, 0.93, 0.8) },
      uI: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    clipping: true,
  });
  bm.clippingPlanes = [cutPlane];
  w.beam = new THREE.Mesh(bg, bm);
  w.beam.frustumCulled = false;
  w.beam.visible = false;
  w.beam.renderOrder = 5;
  scene.add(w.beam);
  w.center = O.clone()
    .addScaledVector(Y, mid)
    .addScaledVector(inward, t / 2);
  w.occ = [o.bottom + 0.8, mid, apex - 0.9].map(v =>
    O.clone()
      .addScaledVector(Y, v)
      .addScaledVector(outN, t / 2 + 0.35),
  );
  windows.push(w);
  {
    const nL =
        o.glass === 4 || o.inDoor ? 1 : o.glass === 1 || o.glass === 6 ? 3 : o.hw >= 3 ? 4 : o.hw >= 1.35 ? 3 : 2,
      B = new THREE.Matrix4().makeBasis(X, Y, Z); // Fensterpfosten
    for (let k = 1; k < nL; k++) {
      const u = -o.hw + (2 * o.hw * k) / nL,
        top = archY(u, o.hw, o.spring) - 0.04;
      if (top - o.bottom < 0.3) continue;
      const g = boxGeo(0.16, top - o.bottom, t * 0.85);
      const m = B.clone();
      m.setPosition(
        O.clone()
          .addScaledVector(X, u)
          .addScaledVector(Y, (o.bottom + top) / 2),
      );
      g.applyMatrix4(m);
      mullionGeos.push(g);
    }
    // Maßwerk im Bogenfeld (Fotos der Fenster): über jedem Licht ein Spitzbögchen, darüber ein Kreis
    if (nL >= 2 && o.hw >= 0.7) {
      const hl = (o.hw / nL) * 0.94,
        ys = o.spring - 0.1,
        pt = (u, y) => O.clone().addScaledVector(X, u).addScaledVector(Y, y),
        bar = ps =>
          mullionGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps), ps.length, 0.085, 4, false));
      for (let k = 0; k < nL; k++) {
        const cu = -o.hw + (2 * o.hw * (k + 0.5)) / nL,
          ps = lancet(cu, hl, ys, ys, 7)
            .slice(1, -1)
            .map(p => pt(p[0], p[1]));
        if (ps.length > 2) bar(ps);
      }
      const subTop = ys + SQ3 * hl,
        rc = Math.min(o.hw * 0.4, (apex - subTop) * 0.38);
      if (rc > 0.22) {
        const cy = subTop + rc + 0.1,
          ps = [];
        for (let a = 0; a <= 16; a++)
          ps.push(pt(rc * Math.cos((a * Math.PI) / 8), cy + rc * Math.sin((a * Math.PI) / 8)));
        bar(ps);
      }
    }
  }
  if (type >= 0) {
    const k = TINT.uWinCount.value;
    if (k < MAXW) {
      TINT.uWinO.value[k].copy(O);
      TINT.uWinU.value[k].copy(X).multiplyScalar(fs);
      TINT.uWinN.value[k].copy(Z);
      TINT.uWinP.value[k].set(o.hw, o.bottom, o.spring, apex);
      TINT.uWinT.value[k] = type;
      TINT.uWinCount.value = k + 1;
    }
  }
}
