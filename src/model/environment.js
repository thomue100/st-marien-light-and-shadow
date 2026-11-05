// Umgebung: LoD2-Gebäude, Gelände und Bäume (LVermGeo SH); Verschattung durch die Nachbarschaft.
import './clock.js';   // Aufbau-Reihenfolge: nach model/clock
import { DATA } from '../data.js';
import { step } from '../core/loader.js';
import { tr } from '../core/i18n.js';
import { LD, state } from '../state.js';
import { requestRender, scene } from '../scene/renderer.js';
import { rng } from '../scene/textures.js';
import { lin } from '../scene/materials.js';
import { groundMesh } from './church.js';

await step(tr('Umgebung wird geladen (273 Gebäude, Gelände, Bäume)','Loading surroundings (273 buildings, terrain, trees)'),58);
/* ---------------- Umgebung: LoD2-Gebäude, Gelände und Bäume (LVermGeo SH) ---------------- */
// Gebäude: LoD2 (CityGML, 2025). Gelände und Bäume: aus dem Oberflächenmodell bDOM20 (2023) abgeleitet.
// Verschattung: Strahlverfolgung über ein 1-m-Höhenraster (Dächer aus bDOM20, Bäume abschaltbar).
export const ENV=await DATA.env;
export let envH=null, envCls=null, envG=null, envMax=-1e9;
const envGroup=new THREE.Group(), treeGroup=new THREE.Group(); scene.add(envGroup); scene.add(treeGroup);
let churchLines=null;
function b64(s){ const bin=atob(s), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
function u16grid(s,base){ const b=b64(s), n=b.length/2, out=new Float32Array(n); for(let k=0;k<n;k++) out[k]=base+(b[2*k]|(b[2*k+1]<<8))/100; return out; }
function i16arr(s){ const b=b64(s); return new Int16Array(b.buffer,b.byteOffset,b.length/2); }
if(ENV){
  const n=ENV.n, st=ENV.step, o=ENV.origin;
  envH=u16grid(ENV.occ,ENV.base); envCls=b64(ENV.cls); envG=u16grid(ENV.ground,ENV.base);
  for(let k=0;k<envH.length;k++) if(envH[k]>envMax) envMax=envH[k];
  const r=rng(31);
  // Gelände (2-m-Raster)
  { const gn=ENV.gn, gs=ENV.gstep, pos=new Float32Array(gn*gn*3), col=new Float32Array(gn*gn*3);
    for(let j=0;j<gn;j++) for(let i=0;i<gn;i++){ const k=j*gn+i; pos[3*k]=o+i*gs; pos[3*k+1]=envG[k]; pos[3*k+2]=o+j*gs;
      const t=0.92+r()*0.1; col[3*k]=0.235*t; col[3*k+1]=0.228*t; col[3*k+2]=0.215*t; }
    const idx=new Uint32Array((gn-1)*(gn-1)*6); let p=0;
    for(let j=0;j<gn-1;j++) for(let i=0;i<gn-1;i++){ const a=j*gn+i,b=a+1,c=a+gn,d=c+1; idx[p++]=a; idx[p++]=c; idx[p++]=b; idx[p++]=b; idx[p++]=c; idx[p++]=d; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
    const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.castShadow=true; envGroup.add(mesh); }
  // LoD2-Gebäude
  { const P=i16arr(ENV.bld.pos), K=b64(ENV.bld.kind), ib=b64(ENV.bld.idx);
    const idx=ENV.bld.i32?new Uint32Array(ib.buffer,ib.byteOffset,ib.length/4):new Uint16Array(ib.buffer,ib.byteOffset,ib.length/2);
    const nv=P.length/3, pos=new Float32Array(nv*3); for(let i=0;i<nv*3;i++) pos[i]=P[i]/100;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeVertexNormals();
    const nor=g.attributes.normal.array, col=new Float32Array(nv*3);
    for(let i=0;i<nv;i++){ const ny=nor[3*i+1], jit=0.94+((i*2654435761>>>0)%1000)/1000*0.1; let c;
      if(K[i]===1) c=ny>0.985?[0.20,0.20,0.21]:[0.35,0.125,0.08];   // Luftbild: Flachdach grau, Steildach Ziegel terrakotta (linear)
      else c=[0.29,0.26,0.225];                                    // Wand gedeckt warmgrau, damit die Kirche im Vordergrund bleibt
      col[3*i]=c[0]*jit; col[3*i+1]=c[1]*jit; col[3*i+2]=c[2]*jit; }
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.88,metalness:0,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; envGroup.add(mesh); }
  // Bäume und sonstige Objekte (1-m-Zellen aus bDOM20 außerhalb der Gebäude)
  { const pos=[], idx=[]; let v=0; const H=(i,j)=>envH[j*n+i];
    for(let j=0;j<n-1;j++) for(let i=0;i<n-1;i++){ if(envCls[j*n+i]!==2) continue;
      const x=o+i*st, z=o+j*st;
      pos.push(x,H(i,j),z, x+st,H(i+1,j),z, x,H(i,j+1),z+st, x+st,H(i+1,j+1),z+st); idx.push(v,v+2,v+1,v+1,v+2,v+3); v+=4; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({color:lin(0x56683f),roughness:0.95,side:THREE.DoubleSide});   // Laubgrün wie im Luftbild
    const mesh=new THREE.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; treeGroup.add(mesh); }
  // LoD2-Umriss der Kirche zum Vergleich mit dem Modell
  { const S=i16arr(ENV.church), pos=new Float32Array(S.length); for(let i=0;i<S.length;i++) pos[i]=S[i]/100;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    churchLines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xffc93c,transparent:true,opacity:0.9,depthTest:false,fog:false}));
    churchLines.renderOrder=20; churchLines.visible=false; scene.add(churchLines); }
}
export function envSample(arr,nn,stp,x,z){ const fi=(x-ENV.origin)/stp, fj=(z-ENV.origin)/stp; if(fi<0||fj<0||fi>nn-1||fj>nn-1) return -1e9;
  const i=Math.floor(fi), j=Math.floor(fj), i1=Math.min(i+1,nn-1), j1=Math.min(j+1,nn-1), tx=fi-i, tz=fj-j;
  return (arr[j*nn+i]*(1-tx)+arr[j*nn+i1]*tx)*(1-tz)+(arr[j1*nn+i]*(1-tx)+arr[j1*nn+i1]*tx)*tz; }
export function envHeightAt(x,z){ const n=ENV.n, i=Math.round((x-ENV.origin)/ENV.step), j=Math.round((z-ENV.origin)/ENV.step);
  if(i<0||j<0||i>=n||j>=n) return -1e9; const k=j*n+i;
  if(envCls[k]===2&&!state.trees) return envSample(envG,ENV.gn,ENV.gstep,x,z);
  return envH[k]; }
export function envBlocked(o){
  if(!state.env||!envH) return false;
  const hz=Math.hypot(LD.x,LD.z); if(LD.y<=0) return true;
  const dt=0.5/Math.max(hz,1e-3), lim=-ENV.origin;
  for(let t=dt;t<3000;t+=dt){ const y=o.y+LD.y*t; if(y>envMax) return false; const x=o.x+LD.x*t, z=o.z+LD.z*t;
    if(Math.abs(x)>lim||Math.abs(z)>lim) return false; if(envHeightAt(x,z)>y) return true; }
  return false;
}
export function applyEnv(){ envGroup.visible=state.env; treeGroup.visible=state.env&&state.trees; if(churchLines) churchLines.visible=state.lodChurch;
  groundMesh.position.y=(state.env&&ENV)?ENV.base-0.3:0; requestRender(); }
