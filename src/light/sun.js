// Sonne und Mond anwenden: Lichtquelle, Stärke, Finsternisse; stößt alle Aktualisierungen an.
import { eclLW, eclTmp, updateWindows } from './windows.js';   // Aufbau-Reihenfolge: nach light/windows
import { eclToEqu, horiz, localToUtc, lstDeg, lunarEclipseAt, moonEcl, moonPos, nrm360, rad, solarEclipseAt, sunPos, sunPrecise } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { clamp01, smooth } from '../core/util.js';
import { cur, L, LD, state, sunVec } from '../state.js';
import { renderer, requestRender, scene } from '../scene/renderer.js';
import { TINT } from '../scene/shaders.js';
import { clockUpdate } from '../model/clock.js';
import { sdUpdate } from '../model/sundial.js';
import { buildSunPath, hemi, LM, moonMat, moonMesh, moonPass, SC, setMoonPass, skyAt, skyMat, starMat, stars, sun, SUN_MAG, updateStars } from './sky.js';
import { drawPanoGrid } from '../scene/camera.js';
import { updateReadouts } from '../ui/readouts.js';

/* ---------------- Sonne anwenden ---------------- */

// Licht von Sonne und Mond, Finsternisse (nur hier zugewiesen, von vielen gelesen)
export let moonCur=null, moonStr=0, lightStr=0, useMoon=false;
export let sunStr=0, eclS=null, eclObsc=0, eclL=null, eclLB=1;
let lastWin=0;
export function updateSun(forceWindows){
  const utc=localToUtc(state.y,state.m,state.d,state.minutes);
  if(moonPass&&state.moon&&state.moonPath&&(utc>moonPass.t1||utc<moonPass.from)){ setMoonPass(null); buildSunPath(); if(state.pano) drawPanoGrid(); }
  const s=sunPos(utc); cur.el=s.el; cur.az=s.az; sunVec(s.el,s.az,L);
  sunStr=smooth(-0.8,5,s.el);
  eclS=solarEclipseAt(utc); eclObsc=(eclS&&eclS.cover>0&&s.el>-1.5)?eclS.cover:0; sunStr*=1-eclObsc;   // Sonnenfinsternis: Licht nach bedeckter Fläche
  // Mond: übernimmt nachts die Lichtquelle (mit Schatten). Echtes Mondlicht ist ~400 000-mal schwächer als die Sonne,
  // hier wird es wie beim „Day for Night“ angehoben: Stärke nach beleuchtetem Anteil, Mondhöhe und Dunkelheit.
  const mp=moonPos(utc); moonCur=mp; sunVec(mp.el,mp.az,LM);
  const night=1-smooth(-7,-1.5,s.el);
  moonStr=state.moon?0.55*smooth(-0.6,6,mp.el)*Math.pow(mp.k,1.4)*night:0;
  eclL=lunarEclipseAt(utc); eclLB=1;   // Mondfinsternis: Halbschatten dämpft leicht, im Kernschatten bleibt ein schwaches rotes Licht
  if(eclL&&eclL.pmag>-0.05){ if(eclL.pmag>0){ eclLB=(1-eclL.uCover)*(1-0.5*eclL.pCover*clamp01(eclL.pmag))+eclL.uCover*0.02; moonStr*=eclLB; }
    const m=moonEcl(utc), sa=sunPrecise(utc), qm=eclToEqu(m.lam,m.beta,m.T), qa=eclToEqu(nrm360(sa.lam+180),0,sa.T), lst=lstDeg(utc);
    const hm=horiz(nrm360(lst-qm.ra+180)-180,qm.dec), ha=horiz(nrm360(lst-qa.ra+180)-180,qa.dec); sunVec(ha.el,ha.az,eclLW).sub(sunVec(hm.el,hm.az,eclTmp)); }
  useMoon=sunStr<0.002&&moonStr>0.001;
  LD.copy(useMoon?LM:L); lightStr=useMoon?moonStr:sunStr;
  const warm=smooth(0,28,s.el), sunCol=new THREE.Color(1,0.6+0.36*warm,0.36+0.54*warm);
  if(useMoon){ sun.color.setRGB(0.5,0.62,1.0); if(eclL&&eclL.uCover>0) sun.color.lerp(new THREE.Color(1.0,0.45,0.3),eclL.uCover); sun.intensity=0.5*moonStr; } else { sun.color.copy(sunCol); sun.intensity=3.1*sunStr; }
  sun.position.copy(SC).addScaledVector(LD,400); sun.target.position.copy(SC); sun.target.updateMatrixWorld();
  const z=skyAt(s.el,1,new THREE.Color()), h=skyAt(s.el,2,new THREE.Color());
  if(state.moon){ const mb=Math.min(0.75,moonStr*1.35); z.lerp(new THREE.Color(0x1a2848),mb*night); h.lerp(new THREE.Color(0x34405e),mb*night); }
  if(eclObsc>0){ const kq=1-0.8*smooth(0.45,1,eclObsc); z.multiplyScalar(kq); h.multiplyScalar(kq); }   // Himmel dunkelt bei großer Bedeckung ab
  skyMat.uniforms.uGlow.value=1-eclObsc; skyMat.uniforms.uEcl.value=0;
  if(eclObsc>0){ const vS=sunVec(eclS.sunEl,eclS.sunAz,new V3()), w=sunVec(eclS.moonEl,eclS.moonAz,new V3()).sub(vS); w.addScaledVector(vS,-w.dot(vS));
    skyMat.uniforms.uOcc.value.copy(L).addScaledVector(w,SUN_MAG).normalize(); skyMat.uniforms.uOccC.value=Math.cos(SUN_MAG*eclS.rm*rad); skyMat.uniforms.uEcl.value=1; }
  moonMesh.visible=state.moon&&mp.el>-1.5;
  moonMat.uniforms.uSun.value.copy(L); moonMat.uniforms.uDay.value=smooth(-8,-1,s.el); moonMat.uniforms.uLow.value=1-smooth(1,14,mp.el);
  starMat.uniforms.uA.value=state.moon?(1-smooth(-12,-4,s.el))*(1-0.45*mp.k*smooth(0,10,mp.el)):0; stars.visible=state.moon;
  if(starMat.uniforms.uA.value>0) updateStars(utc);
  renderer.toneMappingExposure=state.exp*(1+0.15*night*(state.moon?1:0));
  skyMat.uniforms.uZen.value.copy(z); skyMat.uniforms.uHor.value.copy(h);
  skyMat.uniforms.uGnd.value.copy(h).multiplyScalar(0.28).lerp(new THREE.Color(0x2c2b28),0.5*smooth(-6,10,s.el));
  skyMat.uniforms.uSun.value.copy(sunCol); skyMat.uniforms.uVis.value=smooth(-2.5,0.5,s.el);
  scene.fog.color.copy(h);
  hemi.intensity=(0.06+0.6*smooth(-8,25,s.el))*(1-0.75*eclObsc)+0.08*moonStr;
  hemi.color.copy(z).lerp(new THREE.Color(0xffffff),0.45); hemi.groundColor.set(0x6a5848);
  TINT.uSunL.value.copy(LD);
  const now=performance.now();
  if(forceWindows||!state.playing||now-lastWin>110){ updateWindows(); lastWin=now; }
  sdUpdate();
  clockUpdate(utc);
  updateReadouts();
  requestRender();
}
