// Fenster: Besonnung, Verschattung und Lichtbahnen durch die Fenster.
import { sun } from './sky.js'; // Aufbau-Reihenfolge: nach light/sky
import { V3 } from '../three-global.js';
import { smooth } from '../core/util.js';
import { XW } from '../model/measures.js';
import { cur, LD, state } from '../state.js';
import { scene } from '../scene/renderer.js';
import { occluders, windows } from '../model/geometry.js';
import { envBlocked } from '../model/environment.js';
import { sdUpdateLit } from '../model/sundial.js';
import { lightStr, moonCur, useMoon } from './sun.js';

/* ---------------- Fenster-Update: Besonnung, Verschattung, Lichtbahnen ---------------- */
export const rc = new THREE.Raycaster();
rc.far = 260;
export let litCount = 0;
export const eclLW = new V3(),
  eclTmp = new V3();
export function updateWindows() {
  scene.updateMatrixWorld();
  const up = useMoon ? moonCur.el > 0.3 : cur.el > 0.15,
    skyLum = 0.1 + 1.05 * smooth(-6, 18, cur.el),
    d = LD.clone().negate(),
    sc = sun.color;
  litCount = 0;
  for (const w of windows) {
    const facing = Math.max(0, w.outN.dot(LD));
    let lit = 0;
    if (up && facing > 0.01) {
      let ok = 0;
      for (const o of w.occ) {
        rc.set(o, LD);
        if (!envBlocked(o) && rc.intersectObjects(occluders, false).length === 0) ok++;
      }
      lit = ok / w.occ.length;
    }
    const direct = lightStr * facing * lit;
    w.lit = direct;
    if (direct > 0.02) litCount++;
    const b = skyLum * 0.75 + direct * 2.4;
    w.paneIn.material.color.setRGB(b * (0.8 + 0.2 * sc.r), b * (0.8 + 0.2 * sc.g), b * (0.8 + 0.2 * sc.b));
    if (w.med) w.med.material.color.copy(w.paneIn.material.color);
    if (state.beams && direct > 0.015) {
      const C = w.center;
      let t = d.y < -1e-3 ? C.y / -d.y : 200;
      const bx0 = Math.min(XW + 0.6, C.x),
        bx1 = Math.max(50.5, C.x),
        bz0 = Math.min(-25.5, C.z),
        bz1 = Math.max(29.2, C.z);
      if (d.x > 1e-4) t = Math.min(t, (bx1 - C.x) / d.x);
      else if (d.x < -1e-4) t = Math.min(t, (bx0 - C.x) / d.x);
      if (d.z > 1e-4) t = Math.min(t, (bz1 - C.z) / d.z);
      else if (d.z < -1e-4) t = Math.min(t, (bz0 - C.z) / d.z);
      t = Math.max(1.5, Math.min(t, 140));
      const pa = w.beam.geometry.attributes.position,
        N = w.ptsIn.length;
      for (let i = 0; i < N; i++) {
        const p = w.ptsIn[i];
        pa.setXYZ(i, p.x, p.y, p.z);
        pa.setXYZ(N + i, p.x + d.x * t, p.y + d.y * t, p.z + d.z * t);
      }
      pa.needsUpdate = true;
      w.beam.material.uniforms.uI.value = direct * (w.type >= 0 ? 0.07 : 0.038);
      if (w.type < 0) w.beam.material.uniforms.uColor.value.setRGB(sc.r, sc.g * 0.95, sc.b * 0.85);
      w.beam.visible = true;
    } else w.beam.visible = false;
  }
  sdUpdateLit();
}
