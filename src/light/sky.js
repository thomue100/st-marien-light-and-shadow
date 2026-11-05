// Licht und Himmel: Sonne, Mond, Himmelsfarben, Sterne, Sonnen- und Mondbahn.
import '../model/sundial.js';   // Aufbau-Reihenfolge: nach model/sundial
import { berlinOffsetMin, eclToEqu, horiz, LAT, localToUtc, lstDeg, moonPos, rad, refract, sunPos } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { clamp01 } from '../core/util.js';
import { L, state, sunVec } from '../state.js';
import { camera, coarse, lowEnd, renderer, requestRender, scene } from '../scene/renderer.js';
import { canvasTex, rng } from '../scene/textures.js';
import { eclLW } from './windows.js';
import { eclL, moonCur } from './sun.js';

/* ---------------- Licht & Himmel ---------------- */

export const SC=new V3(7,25,0);
export const sun=new THREE.DirectionalLight(0xffffff,3);
const smSize=Math.min(lowEnd?1024:coarse?2048:4096,renderer.capabilities.maxTextureSize);
sun.castShadow=true; sun.shadow.mapSize.set(smSize,smSize);
Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:800});
sun.shadow.bias=-0.0003; sun.shadow.normalBias=0.05; sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);
export const hemi=new THREE.HemisphereLight(0xbcd4ee,0x6a5848,0.6); scene.add(hemi);
export const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{uL:{value:L},uZen:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uGnd:{value:new THREE.Color()},uSun:{value:new THREE.Color()},uVis:{value:1},uOcc:{value:new V3(0,1,0)},uOccC:{value:1},uEcl:{value:0},uGlow:{value:1}},
  vertexShader:'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform vec3 uL,uZen,uHor,uGnd,uSun,uOcc; uniform float uVis,uOccC,uEcl,uGlow; varying vec3 vD;
  void main(){ vec3 d=normalize(vD); float h=d.y; vec3 c= h>0.0 ? mix(uHor,uZen,pow(h,0.5)) : mix(uHor,uGnd,pow(min(-h*5.0,1.0),0.5));
    float s=max(dot(d,normalize(uL)),0.0);
    c+=uSun*(pow(s,10.0)*0.28+pow(s,300.0)*0.7)*uVis*step(-0.02,h)*uGlow;
    float occ=uEcl*smoothstep(uOccC-0.000004,uOccC+0.000004,dot(d,uOcc));   // Sonnenfinsternis: dunkle Mondscheibe vor der Sonne
    c=mix(c,vec3(1.0,0.97,0.88),smoothstep(0.99982,0.99992,s)*uVis*(1.0-occ));
    gl_FragColor=vec4(c,1.0); }`});
export const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,48,24),skyMat); sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky);
export const SUN_MAG=Math.acos(0.99987)/rad/0.2667;   // die Sonnenscheibe ist vergrößert gezeichnet; bei Finsternissen wird der Mond im selben Maßstab davorgesetzt
const SKY_KEYS=[[-18,'#04060d','#0a0f1c'],[-6,'#101a36','#3a3550'],[-1,'#26386a','#d9845a'],[3,'#2f4f8e','#f0a86e'],[9,'#3b66ae','#efcfa4'],[22,'#3f78c8','#b8d0e8'],[70,'#3570c2','#c6daee']];
const ca=new THREE.Color(), cb=new THREE.Color();
export function skyAt(el,idx,out){ let i=0; while(i<SKY_KEYS.length-1&&el>SKY_KEYS[i+1][0]) i++; const a=SKY_KEYS[i], b=SKY_KEYS[Math.min(i+1,SKY_KEYS.length-1)];
  const t=b[0]===a[0]?0:clamp01((el-a[0])/(b[0]-a[0])); ca.set(a[idx]); cb.set(b[idx]); return out.copy(ca).lerp(cb,t); }
// Mond am Himmel: Scheibe, die zur Kamera zeigt; die Lichtgrenze ergibt sich aus der Sonnenrichtung (beleuchtete Halbkugel),
// die Mare-Zeichnung ist nach dem Himmelsnordpol ausgerichtet. Dargestellt 2,2-fach vergrößert, damit er sichtbar bleibt.
let MOON_MAG=2.2; const SKY_R=1800;   // Assistent »Mond zwischen den Türmen«: Kameraansicht in wahrer Größe
const moonTex=canvasTex(256,256,(g,w,h)=>{
  const r=rng(91); g.fillStyle='#000'; g.fillRect(0,0,w,h);
  g.save(); g.beginPath(); g.arc(128,128,127,0,7); g.clip();
  g.fillStyle='#cfccc5'; g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){ const v=r(); g.fillStyle='rgba('+(v<.5?'150,146,140':'235,232,226')+','+(r()*0.18)+')'; const s=1+r()*4; g.fillRect(r()*w,r()*h,s,s); }
  // Maria (dunkle Ebenen), Lage wie von der Nordhalbkugel gesehen: Norden oben, Mare Crisium rechts
  const P=(x,y)=>[128+x*124,128-y*124];
  const mare=(x,y,rx,ry,rot)=>{ const [cx,cy]=P(x,y); g.save(); g.translate(cx,cy); g.rotate(rot||0);
    for(let k=0;k<5;k++){ g.fillStyle='rgba(112,110,108,'+(0.22+k*0.08)+')'; g.beginPath(); g.ellipse((r()-0.5)*6,(r()-0.5)*6,rx*124*(1-k*0.12),ry*124*(1-k*0.12),0,0,7); g.fill(); } g.restore(); };
  mare(0.70,0.30,0.11,0.09); mare(0.56,-0.10,0.12,0.16,0.3); mare(0.36,0.14,0.17,0.15); mare(0.27,0.42,0.14,0.13);
  mare(-0.22,0.52,0.24,0.20); mare(0.0,0.78,0.42,0.07); mare(0.44,-0.27,0.08,0.08); mare(-0.14,-0.36,0.17,0.14);
  mare(-0.45,-0.42,0.09,0.09); mare(-0.58,0.12,0.24,0.40,0.15); mare(0.05,0.23,0.08,0.06); mare(-0.70,-0.05,0.10,0.18);
  // Krater und Strahlen von Tycho und Kopernikus
  for(let i=0;i<70;i++){ const a=r()*7, d=Math.sqrt(r())*0.92, [cx,cy]=P(Math.cos(a)*d,Math.sin(a)*d), s=1.5+r()*5;
    g.strokeStyle='rgba(90,88,86,.35)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy,s,0,7); g.stroke(); g.fillStyle='rgba(245,243,238,.25)'; g.beginPath(); g.arc(cx-s*0.3,cy-s*0.3,s*0.5,0,7); g.fill(); }
  for(const [x,y,n,l] of [[-0.12,-0.70,26,0.9],[-0.30,0.25,14,0.35]]){ const [cx,cy]=P(x,y);
    g.strokeStyle='rgba(250,248,242,.22)'; g.lineWidth=1.6; for(let k=0;k<n;k++){ const a=k/n*7+r()*0.2; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(a)*l*124*(0.5+r()*0.5),cy+Math.sin(a)*l*124*(0.5+r()*0.5)); g.stroke(); }
    g.fillStyle='#f6f4ee'; g.beginPath(); g.arc(cx,cy,4,0,7); g.fill(); }
  g.restore();
},null);
export const moonMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
  uniforms:{uTex:{value:moonTex},uSun:{value:new V3(0,1,0)},uX:{value:new V3(1,0,0)},uY:{value:new V3(0,1,0)},uZ:{value:new V3(0,0,1)},uDay:{value:0},uLow:{value:0},uShC:{value:new THREE.Vector2()},uShU:{value:0},uShP:{value:0},uShOn:{value:0}},
  vertexShader:'varying vec2 vP; void main(){ vP=position.xy*2.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D uTex; uniform vec3 uSun,uX,uY,uZ; uniform float uDay,uLow,uShU,uShP,uShOn; uniform vec2 uShC; varying vec2 vP;
  void main(){ float r2=dot(vP,vP); if(r2>1.0) discard;
    vec3 n=normalize(vP.x*uX+vP.y*uY+sqrt(1.0-r2)*uZ);
    float l=smoothstep(-0.02,0.05,dot(n,normalize(uSun)));
    vec3 t=texture2D(uTex,vP*0.5+0.5).rgb*mix(vec3(1.0),vec3(1.0,0.74,0.52),uLow);
    vec3 c=t*(l*1.08+0.03*(1.0-uDay));                           // 0,03: Erdschein auf der Nachtseite
    if(uShOn>0.5){ float dd=length(vP-uShC);   // Erdschatten in Mondradien: Halbschatten dunkelt zum Kernschatten hin, im Kernschatten kupferrot
      float pen=smoothstep(uShU,uShP,dd); vec3 cp=c*(0.32+0.68*pen*pen);
      float deep=clamp((uShU-dd)/max(uShU,0.01),0.0,1.0); vec3 cu=t*mix(vec3(0.62,0.2,0.08)*0.5,vec3(0.35,0.08,0.03)*0.3,deep);
      c=mix(cp,cu,1.0-smoothstep(uShU-0.05,uShU+0.03,dd)); }
    float a=mix(1.0,0.75,uDay)*smoothstep(1.0,0.94,r2);   // additiv: die Nachtseite lässt den Himmel durch
    gl_FragColor=vec4(c*a,1.0); }`});
export const moonMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),moonMat); moonMesh.matrixAutoUpdate=false; moonMesh.frustumCulled=false; moonMesh.renderOrder=-8; moonMesh.visible=false; scene.add(moonMesh);
export const LM=new V3(0,-1,0), NCP=new V3(), mX=new V3(), mY=new V3(), mZ=new V3(), mM=new THREE.Matrix4();
export function placeMoonAt(){ placeMoon(); }   // die Scheibe zeigt ohnehin zum Standpunkt (Normale = Richtung zur Kamera)
export function placeMoon(){   // jedes Bild: Mond in fester Entfernung vor der Kamera wie der Himmel
  if(!moonMesh.visible) return;
  sunVec(LAT,0,NCP); mZ.copy(LM).negate(); mY.copy(NCP).addScaledVector(LM,-NCP.dot(LM)).normalize(); mX.crossVectors(mY,mZ);
  const s=2*SKY_R*Math.tan(moonCur.semi*rad)*MOON_MAG;
  mM.makeBasis(mX.clone().multiplyScalar(s),mY.clone().multiplyScalar(s),mZ.clone()); mM.setPosition(camera.position.clone().addScaledVector(LM,SKY_R));
  moonMesh.matrix.copy(mM); moonMesh.matrixWorldNeedsUpdate=true;
  moonMat.uniforms.uX.value.copy(mX); moonMat.uniforms.uY.value.copy(mY); moonMat.uniforms.uZ.value.copy(mZ);
  const on=!!(eclL&&eclL.pmag>-0.05); moonMat.uniforms.uShOn.value=on?1:0;
  if(on){ const cx=eclLW.dot(mX), cy=eclLW.dot(mY), n=Math.hypot(cx,cy)||1, k=eclL.sep/eclL.sm; moonMat.uniforms.uShC.value.set(cx/n*k,cy/n*k);
    moonMat.uniforms.uShU.value=eclL.ru/eclL.sm; moonMat.uniforms.uShP.value=eclL.rp/eclL.sm; }
}
// Die hellsten Sterne (Position J2000, Helligkeit), auf das Datum präzediert
const STARS=[[101.287,-16.716,-1.46],[213.915,19.182,-0.05],[279.234,38.784,0.03],[79.172,45.998,0.08],[78.634,-8.202,0.13],[114.826,5.225,0.34],
  [88.793,7.407,0.5],[297.696,8.868,0.77],[68.980,16.509,0.87],[247.352,-26.432,1.06],[201.298,-11.161,0.98],[116.329,28.026,1.14],[344.413,-29.622,1.16],
  [310.358,45.280,1.25],[152.093,11.967,1.36],[104.656,-28.972,1.5],[113.650,31.888,1.58],[263.402,-37.104,1.62],[81.283,6.350,1.64],[81.573,28.608,1.65],
  [84.053,-1.202,1.69],[85.190,-1.943,1.77],[193.507,55.960,1.77],[51.081,49.861,1.79],[165.932,61.751,1.79],[107.098,-26.393,1.83],[206.885,49.313,1.86],
  [89.882,44.948,1.9],[99.428,16.399,1.93],[37.955,89.264,1.98],[95.675,-17.956,1.98],[141.897,-8.659,1.98],[31.793,23.462,2.0],[154.993,19.842,2.08],
  [283.816,-26.297,2.05],[2.097,29.090,2.06],[17.433,35.621,2.05],[86.939,-9.670,2.07],[222.676,74.156,2.08],[263.734,12.560,2.08],[47.042,40.956,2.1],
  [30.975,42.330,2.1],[177.265,14.572,2.14],[14.177,60.717,2.15],[233.672,26.715,2.23],[83.002,-0.299,2.23],[305.557,40.257,2.23],[10.127,56.537,2.24],
  [269.152,51.489,2.24],[2.295,59.150,2.28],[165.460,56.383,2.37],[326.046,9.875,2.39],[345.944,28.083,2.42],[178.458,53.695,2.44],[346.190,15.205,2.48],
  [21.454,60.235,2.68],[3.309,15.184,2.83],[183.857,57.033,3.31],[200.981,54.925,2.23],[292.680,27.960,3.05],[28.599,63.670,3.37],[45.570,4.090,2.53],
  [168.527,20.524,2.56],[236.067,6.426,2.63],[195.544,10.959,2.83],[83.183,-17.822,2.58]];
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(STARS.length*3),3));
starGeo.setAttribute('aMag',new THREE.BufferAttribute(new Float32Array(STARS.map(s=>s[2])),1));
starGeo.setAttribute('aVis',new THREE.BufferAttribute(new Float32Array(STARS.length),1));
export const starMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{uA:{value:0},uPR:{value:renderer.getPixelRatio()}},
  vertexShader:'attribute float aMag; attribute float aVis; uniform float uA,uPR; varying float vA; void main(){ vA=aVis*uA*clamp(1.12-0.26*aMag,0.25,1.0); gl_PointSize=uPR*clamp(4.4-0.85*aMag,1.7,5.6); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:'varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5||vA<0.004) discard; gl_FragColor=vec4(vec3(1.0,0.97,0.92),vA*smoothstep(0.5,0.12,d)); }'});
export const stars=new THREE.Points(starGeo,starMat); stars.frustumCulled=false; stars.renderOrder=-9; scene.add(stars);
export function updateStars(ms){
  const pa=starGeo.attributes.position, va=starGeo.attributes.aVis, lst=lstDeg(ms), T=(ms/86400000+2440587.5-2451545)/36525;
  const e=23.4393*rad, dl=1.3969713*T;   // allgemeine Präzession in Länge
  for(let i=0;i<STARS.length;i++){ const ra=STARS[i][0]*rad, de=STARS[i][1]*rad;
    const lam=Math.atan2(Math.sin(ra)*Math.cos(e)+Math.tan(de)*Math.sin(e),Math.cos(ra))/rad+dl, bet=Math.asin(Math.sin(de)*Math.cos(e)-Math.cos(de)*Math.sin(e)*Math.sin(ra))/rad;
    const q=eclToEqu(lam,bet,0), hz=horiz(lst-q.ra,q.dec), el=refract(hz.el);
    sunVec(el,hz.az,tmpS).multiplyScalar(SKY_R+80); pa.setXYZ(i,tmpS.x,tmpS.y,tmpS.z); va.setX(i,el>0.5?1:0); }
  pa.needsUpdate=true; va.needsUpdate=true; }
const tmpS=new V3();

// Bahnen von Sonne (gold) und Mond (silbern, gestrichelt) am Himmel. Die Gruppe wandert mit der Kamera wie der Himmel,
// die Bahnen liegen also „im Unendlichen“ und sind von jedem Standpunkt aus richtig.
export const pathGroup=new THREE.Group(); scene.add(pathGroup);
const PATH_R=1500;
const spriteCache={};
function hourSprite(h,moon){ const key=(moon?'m':'s')+h; if(!spriteCache[key]){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.font='600 30px "IBM Plex Mono", monospace'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=5; g.strokeStyle='rgba(20,16,12,.75)'; g.strokeText(String(h),32,33); g.fillStyle=moon?'#dfe6f2':'#ffe2a0'; g.fillText(String(h),32,33);
  const t=new THREE.CanvasTexture(c); spriteCache[key]=new THREE.SpriteMaterial({map:t,fog:false,depthWrite:false,transparent:true}); } return spriteCache[key]; }
const lineMat=new THREE.LineBasicMaterial({color:0xffd27a,fog:false,transparent:true,opacity:0.85});
const moonLineMat=new THREE.LineDashedMaterial({color:0xcfd8e8,fog:false,transparent:true,opacity:0.8,dashSize:14,gapSize:10});
// Lauf des Mondes, der zur eingestellten Zeit am Himmel steht (Aufgang bis Untergang); steht er unter dem Horizont, der nächste Lauf.
// So entsteht keine Lücke bei Mitternacht (der Mond geht jeden Tag rund 50 min später auf). from = ab wann dieser Lauf gilt.
export let moonPass=null;
function computeMoonPass(t){ const st=4*60000, up=x=>moonPos(x).el>-0.5;
  const runTo=(a,dir)=>{ for(let i=0;i<480;i++){ if(!up(a+dir*st)) return a; a+=dir*st; } return a; };
  if(up(t)){ const a=runTo(t,-1); return {t0:a,t1:runTo(t,1),from:a}; }
  let n=t, ok=false; for(let i=0;i<480;i++){ n+=st; if(up(n)){ ok=true; break; } } if(!ok) return null;
  let p=t; for(let i=0;i<480;i++){ if(up(p-st)) break; p-=st; }
  return {t0:n,t1:runTo(n,1),from:p}; }
export function curMoonPass(){ const t=localToUtc(state.y,state.m,state.d,state.minutes); if(!moonPass||t>moonPass.t1||t<moonPass.from) moonPass=computeMoonPass(t); return moonPass; }
export const hourOf=u=>new Date(u+berlinOffsetMin(u)*60000).getUTCHours();
export function buildSunPath(){
  while(pathGroup.children.length){ const c=pathGroup.children.pop(); if(c.geometry) c.geometry.dispose(); }
  const R=PATH_R, ss=PATH_R/700*34;
  const D0=localToUtc(state.y,state.m,state.d,0), D1=localToUtc(state.y,state.m,state.d,1440);
  function arc(pos,mat,t0,t1){ let seg=[];
    const flush=()=>{ if(seg.length>1){ const g=new THREE.BufferGeometry().setFromPoints(seg); const l=new THREE.Line(g,mat); if(mat.isLineDashedMaterial) l.computeLineDistances(); l.frustumCulled=false; pathGroup.add(l); } seg=[]; };
    for(let t=t0;t<=t1+1;t+=360000){ const s=pos(Math.min(t,t1)); if(s.el>-0.5) seg.push(sunVec(s.el,s.az,new V3()).multiplyScalar(R)); else flush(); }
    flush(); }
  function labels(pos,moon,t0,t1){ for(let u=Math.ceil((t0+1)/3600000)*3600000;u<t1;u+=3600000){ const hh=hourOf(u), s=pos(u); if(s.el>1.5){ const sp=new THREE.Sprite(hourSprite(hh,moon)); sunVec(s.el,s.az,sp.position).multiplyScalar(R*0.985); sp.scale.set(ss*(moon?0.85:1),ss*(moon?0.85:1),1); sp.frustumCulled=false; pathGroup.add(sp); } } }
  if(state.sunPath){ arc(sunPos,lineMat,D0,D1); labels(sunPos,false,D0,D1); }
  if(state.moonPath&&state.moon){ const mp=curMoonPass(); if(mp){ arc(moonPos,moonLineMat,mp.t0,mp.t1); labels(moonPos,true,mp.t0-1,mp.t1+1); } }
  requestRender();
}
export function setMoonMag(v){ MOON_MAG=v; }
export function setMoonPass(v){ moonPass=v; }
