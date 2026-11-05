// Texturen: Backstein, Dächer, Putz, Glas; Fotos der Glasmalereien.
import { maxAniso } from './renderer.js';   // Aufbau-Reihenfolge: nach scene/renderer
import { DATA } from '../data.js';

/* ---------------- Texturen ---------------- */

export function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function canvasTex(w,h,draw,rep,srgb){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(rep) t.repeat.set(rep[0],rep[1]);
  if(srgb!==false) t.encoding=THREE.sRGBEncoding; t.anisotropy=maxAniso; return t;
}
// Backsteinfarben nach Fotos (2026): gedecktes Rotbraun, G/R ≈ 0,6, dazu sintergebrannte dunkle und einzelne hellere Steine
export function brickCol(r,dark){ const t=r(); if(t<(dark===undefined?0.1:dark)) return [60+r()*18,43+r()*10,39+r()*8]; if(t>0.86) return [158+r()*20,98+r()*14,76+r()*12]; return [130+r()*26,77+r()*16,61+r()*12]; }
export const brickTex=canvasTex(512,256,(g,w,h)=>{
  const r=rng(11); g.fillStyle='#968a80'; g.fillRect(0,0,w,h);
  const bw=64, bh=h/12;
  for(let row=0;row<12;row++){ const off=(row%2)*bw/2;
    for(let i=-1;i<9;i++){ const x=i*bw+off, y=row*bh, k=r(); let c;
      c=brickCol(r);
      g.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; g.fillRect(x+2,y+2,bw-3,bh-3); } }
},[1/2.4,1/1.2]);
export const slabTex=canvasTex(512,512,(g,w,h)=>{   // roter Ziegelboden (nach Innenfotos), 30 × 15 cm
  const r=rng(5); g.fillStyle='#b8a594'; g.fillRect(0,0,w,h); const bw=64, bh=32;
  for(let row=0;row<h/bh;row++){ const off=(row%2)*bw/2; for(let i=-1;i<=w/bw;i++){ const t=r(); const c=t<0.08?[120,62,48]:[150+r()*28,70+r()*18,52+r()*14];
    g.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; g.fillRect(i*bw+off+2,row*bh+2,bw-4,bh-4); } }
  for(let i=0;i<4000;i++){ g.fillStyle='rgba('+(r()<.5?'0,0,0':'255,255,255')+','+(r()*0.05)+')'; g.fillRect(r()*w,r()*h,2,2); }
},[1/2.4,1/2.4]);
export const groundTex=canvasTex(256,256,(g,w,h)=>{
  const r=rng(9); g.fillStyle='#5d5a55'; g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16) for(let x=0;x<w;x+=16){ const t=118+r()*40; g.fillStyle='rgb('+t+','+(t-3)+','+(t-8)+')'; g.beginPath(); g.ellipse(x+8+r()*2,y+8+r()*2,7,6.5,0,0,Math.PI*2); g.fill(); }
},[3333,3333]);
export const copperTex=canvasTex(256,256,(g,w,h)=>{   // Kupfer mit hellem Grünspan (Luftbilder)
  const r=rng(21); g.fillStyle='#7dbdb0'; g.fillRect(0,0,w,h);   // Grünspan türkisgrau (Luftbilder, Foto vom Petriturm)
  for(let i=0;i<900;i++){ const t=r(); g.fillStyle=t<.5?'rgba(92,146,138,.32)':'rgba(170,216,206,.30)'; g.fillRect(r()*w,r()*h,6+r()*20,4+r()*14); }
  for(let i=0;i<30;i++){ g.fillStyle='rgba(50,80,70,.16)'; g.fillRect(r()*w,0,2+r()*3,h); }
  g.fillStyle='rgba(50,90,78,.45)'; for(let x=0;x<w;x+=32) g.fillRect(x,0,2,h); for(let y=0;y<h;y+=64) g.fillRect(0,y,w,1);
},[1/4.8,1/4.8]);
export const diamondTex=canvasTex(128,128,(g,w,h)=>{   // helle Rechteckverglasung in Blei (nach Fotos des Obergadens)
  const r=rng(4); for(let j=0;j<2;j++) for(let i=0;i<3;i++){ const t=222+r()*18; g.fillStyle='rgb('+(t-4|0)+','+(t+2|0)+','+(t|0)+')'; g.fillRect(i*w/3,j*h/2,w/3,h/2); }
  for(let i=0;i<300;i++){ g.fillStyle='rgba(255,250,235,'+(r()*0.35)+')'; g.fillRect(r()*w,r()*h,3,3); }
  g.strokeStyle='#3a3d40'; g.lineWidth=3; for(let i=0;i<=3;i++){ g.beginPath(); g.moveTo(i*w/3,0); g.lineTo(i*w/3,h); g.stroke(); } for(let j=0;j<=2;j++){ g.beginPath(); g.moveTo(0,j*h/2); g.lineTo(w,j*h/2); g.stroke(); }
},null);

/* Glasmalerei-Atlas: 8 Spalten = 8 Fenstertypen. Typen 1, 2, 4, 5, 6 = eigene Fotos der Fenster (2026, entzerrt); 0 Westfenster = neutrale Platzhalter-Verglasung (Bildrechte), 3 = gemalt.
   Gezeichnet wird in 256 × 1024 Einheiten pro Spalte, gespeichert mit doppelter Auflösung (512 × 2048 Pixel). */
export const NT=8, ATL=1024, COL=256, AS=2;
const GLASS=await DATA.glass;
const HASPHOTO=k=>Object.prototype.hasOwnProperty.call(GLASS,String(k));   // Spalten mit Foto werden nicht erst gemalt
const atlasCanvas=document.createElement('canvas'); atlasCanvas.width=COL*NT*AS; atlasCanvas.height=ATL*AS;
(function paintAtlas(){
  const g=atlasCanvas.getContext('2d'); g.scale(AS,AS);
  const pick=(arr,r)=>arr[(r()*arr.length)|0];
  function cells(ox,seed,colorAt){ const r=rng(seed); let y=0;
    while(y<ATL){ const rh=16+r()*22; let x=0;
      while(x<COL){ const w=Math.min(14+r()*30,COL-x); const u=(x+w/2)/COL, v=1-(y+rh/2)/ATL;
        g.fillStyle=colorAt(u,v,r); g.fillRect(ox+x,y,w,rh); g.strokeStyle='rgba(22,20,20,.92)'; g.lineWidth=2.2; g.strokeRect(ox+x+1,y+1,w-2,rh-2); x+=w; }
      y+=rh; } }
  const clip=ox=>{ g.save(); g.beginPath(); g.rect(ox,0,COL,ATL); g.clip(); };
  // 0 Westfenster: bewusst neutrale, nicht nachempfundene Verglasung (Bildrechte des Kunstwerks); helle getönte Rechteckscheiben
  { const ox=0; const tints=['#f2ece0','#e9e4d8','#efe7d2','#e3e8ea','#ece2cf','#f4f0e6','#dfe4e2','#eadfca'];
    cells(ox,101,(u,v,rr)=>tints[(rr()*tints.length)|0]); }
  // 1 Totentanz: Craquelé-Grund, Reigen aus Tod und Lebenden in drei Bahnen
  if(HASPHOTO(1)) { g.fillStyle='#8c8f96'; g.fillRect(1*COL,0,COL,ATL); } else
  { const ox=COL, r=rng(202); g.fillStyle='#eceee9'; g.fillRect(ox,0,COL,ATL); clip(ox);
    const S=26, pts=[]; for(let y=-S;y<=ATL+S;y+=S){ const row=[]; for(let x=-S;x<=COL+S;x+=S) row.push([ox+x+(r()-0.5)*S*0.8,y+(r()-0.5)*S*0.8]); pts.push(row); }
    g.strokeStyle='rgba(70,72,76,.75)'; g.lineWidth=1.6;
    for(let j=0;j<pts.length;j++) for(let i=0;i<pts[j].length;i++){ const p=pts[j][i]; if(i+1<pts[j].length){ const q=pts[j][i+1]; g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); } if(j+1<pts.length){ const q=pts[j+1][i]; g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); } }
    const robes=['#2f4fa8','#e0c020','#b0281e','#5a3a8a','#6b4a2a','#2f7a5a','#c86a20','#7a2a6a'];
    for(let row=0;row<6;row++) for(let lane=0;lane<3;lane++){ const cx=ox+COL*(lane+0.5)/3, cy=ATL*(0.17+row*0.128), s=0.62, col=pick(robes,r);
      if((row+lane)%2===0){ g.globalAlpha=0.85; g.fillStyle=col; g.beginPath(); g.moveTo(cx-10*s,cy-40*s); g.quadraticCurveTo(cx+42*s,cy+10*s,cx+22*s,cy+72*s); g.lineTo(cx-30*s,cy+72*s); g.quadraticCurveTo(cx-42*s,cy+10*s,cx-10*s,cy-40*s); g.fill(); g.globalAlpha=1;
        g.strokeStyle='#2b2b2e'; g.lineWidth=5*s; g.beginPath(); g.moveTo(cx,cy-40*s); g.lineTo(cx,cy+30*s); g.lineTo(cx-14*s,cy+70*s); g.moveTo(cx,cy+30*s); g.lineTo(cx+16*s,cy+70*s); g.moveTo(cx,cy-25*s); g.lineTo(cx-28*s,cy-50*s); g.moveTo(cx,cy-25*s); g.lineTo(cx+30*s,cy-5*s); g.stroke();
        g.fillStyle='#e8e6dc'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy-54*s,12*s,0,7); g.fill(); g.stroke(); }
      else { g.fillStyle=col; g.strokeStyle='#222'; g.lineWidth=2; g.beginPath(); g.moveTo(cx-14*s,cy-38*s); g.lineTo(cx+14*s,cy-38*s); g.lineTo(cx+30*s,cy+72*s); g.lineTo(cx-30*s,cy+72*s); g.closePath(); g.fill(); g.stroke();
        g.fillStyle='#f0d9c0'; g.beginPath(); g.arc(cx,cy-52*s,12*s,0,7); g.fill(); g.stroke();
        g.fillStyle=pick(['#c8a030','#8a2a20','#333333','#2a4a8a'],r); g.fillRect(cx-14*s,cy-70*s,28*s,10*s); } }
    g.fillStyle='#b8261c'; g.fillRect(ox,ATL*0.94,COL,ATL*0.06); g.fillStyle='#1d3a9a'; for(let x=0;x<COL;x+=40) g.fillRect(ox+x,ATL*0.94,14,ATL*0.06);
    g.fillStyle='#e07a20'; g.fillRect(ox,0,COL*0.33,ATL*0.06); g.fillStyle='#2e56b8'; g.fillRect(ox+COL*0.67,0,COL*0.33,ATL*0.06); g.restore(); }
  // 2 Briefkapelle: weißes Glas mit roten und schwarzen Zickzackbändern (Ersatz, falls das Foto fehlt)
  if(HASPHOTO(2)) { g.fillStyle='#8c8f96'; g.fillRect(2*COL,0,COL,ATL); } else
  { const whites=['#f2f1ec','#e1e3df','#f7f6f1','#d6d9d6','#ebeae4'];
    cells(2*COL,303,(u,v,r)=> r()<0.04?'#3e5d93':pick(whites,r));
    const zr=rng(9); clip(2*COL);
    for(let k=0;k<6;k++){ let x=2*COL+20+zr()*216, y=-20; const pts=[[x,y]];
      while(y<ATL+20){ x+=(zr()<.5?-1:1)*(24+zr()*46); x=Math.min(3*COL-8,Math.max(2*COL+8,x)); y+=36+zr()*70; pts.push([x,y]); }
      g.lineJoin='miter'; g.strokeStyle='#141414'; g.lineWidth=11; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke();
      g.strokeStyle=k%3===2?'#262626':'#b3222b'; g.lineWidth=6; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); }
    g.restore(); }
  // 3 (nicht mehr verwendet) Wappen von Lübeck, Hamburg, Bremen, Textband
  { const ox=3*COL; g.fillStyle='#e4e8e7'; g.fillRect(ox,0,COL,ATL);
    clip(ox); g.strokeStyle='#3a3d42'; g.lineWidth=2.2; g.beginPath();
    for(let k=-ATL;k<ATL+COL;k+=34){ g.moveTo(ox+k,0); g.lineTo(ox+k+ATL,ATL); g.moveTo(ox+k,ATL); g.lineTo(ox+k+ATL,0); } g.stroke(); g.restore();
    const shield=(cy,fill)=>{ const cx=ox+128, w=150, h=190; g.beginPath(); g.moveTo(cx-w/2,cy-h/2); g.lineTo(cx+w/2,cy-h/2); g.lineTo(cx+w/2,cy); g.quadraticCurveTo(cx+w/2,cy+h*0.42,cx,cy+h/2); g.quadraticCurveTo(cx-w/2,cy+h*0.42,cx-w/2,cy); g.closePath(); g.fillStyle=fill; g.fill(); g.strokeStyle='#151515'; g.lineWidth=6; g.stroke(); return [cx,cy]; };
    { const cy=ATL*(1-0.76), cx=ox+128; g.fillStyle='#202020'; g.beginPath(); g.ellipse(cx-62,cy-30,52,26,-0.5,0,Math.PI*2); g.ellipse(cx+62,cy-30,52,26,0.5,0,Math.PI*2); g.fill();
      g.beginPath(); g.arc(cx-26,cy-108,14,0,Math.PI*2); g.arc(cx+26,cy-108,14,0,Math.PI*2); g.fill();
      g.save(); shield(cy,'#f2f0ea'); g.clip(); g.fillStyle='#b5202a'; g.fillRect(cx-80,cy,160,120); g.restore(); shield(cy,'rgba(0,0,0,0)'); }
    { const [cx,cy]=shield(ATL*(1-0.5),'#b5202a'); g.fillStyle='#f2f0ea'; g.fillRect(cx-46,cy-6,92,52); g.fillRect(cx-14,cy-52,28,50); g.fillRect(cx-50,cy-34,20,32); g.fillRect(cx+30,cy-34,20,32); g.fillStyle='#b5202a'; g.fillRect(cx-10,cy+16,20,30); }
    { const [cx,cy]=shield(ATL*(1-0.26),'#b5202a'); g.save(); g.translate(cx,cy); g.rotate(-0.75); g.fillStyle='#f2f0ea'; g.fillRect(-6,-70,12,120); g.beginPath(); g.arc(0,-78,20,0,Math.PI*2); g.fill(); g.fillRect(0,32,28,10); g.fillRect(0,46,22,9); g.fillStyle='#b5202a'; g.beginPath(); g.arc(0,-78,9,0,Math.PI*2); g.fill(); g.restore(); }
    g.fillStyle='#d7b257'; g.fillRect(ox+18,ATL*(1-0.09),COL-36,46); g.fillStyle='#3a2a10'; const tr=rng(55); for(let x=ox+26;x<ox+COL-30;x+=9){ g.fillRect(x,ATL*(1-0.09)+14+tr()*4,5,12+tr()*6); } }
  // 4 Tympanon über dem Nordportal: große Farbflächen, Flammen, kräftige Bleilinien
  if(HASPHOTO(4)) { g.fillStyle='#8c8f96'; g.fillRect(4*COL,0,COL,ATL); } else
  { const ox=4*COL, r=rng(404);
    cells(ox,404,(u,v,rr)=>{ if(v<0.12) return pick(['#dfe3e6','#c9ced2','#eef0f0'],rr);
      if(u<0.32&&v<0.6) return pick(['#1b2fd0','#2440e0','#1426a0'],rr);
      if(u<0.56&&v<0.42) return pick(['#9c1414','#c22020','#7a0f0f'],rr);
      if(u>0.62&&v<0.45) return pick(['#3fae2a','#2f8a20','#cfd6d0','#b9c0bc'],rr);
      if(v>0.62) return pick(['#e9ecee','#d6dadd','#c4c9cc'],rr);
      return pick(['#f1f2ef','#d9dcda','#b8bdb9','#8e9590'],rr); });
    clip(ox);
    for(const [fu,fv] of [[0.2,0.76],[0.36,0.84],[0.52,0.8],[0.7,0.78],[0.84,0.7]]){ const cx=ox+fu*COL, cy=ATL*(1-fv); g.fillStyle='#e8501c'; g.beginPath(); g.moveTo(cx,cy-70); g.quadraticCurveTo(cx+30,cy-10,cx+12,cy+30); g.quadraticCurveTo(cx,cy+10,cx-12,cy+30); g.quadraticCurveTo(cx-30,cy-10,cx,cy-70); g.fill(); g.fillStyle='#f6c040'; g.beginPath(); g.ellipse(cx,cy+8,9,20,0,0,7); g.fill(); }
    g.strokeStyle='#151515'; g.lineWidth=6; for(let k=0;k<14;k++){ let x=ox+r()*COL, y=r()*ATL; g.beginPath(); g.moveTo(x,y); for(let s=0;s<4;s++){ x+=(r()-0.5)*90; y+=(r()-0.5)*160; g.lineTo(x,y); } g.stroke(); }
    g.fillStyle='#b01818'; for(let y=20;y<ATL;y+=60){ g.beginPath(); g.arc(ox+10,y,6,0,7); g.fill(); g.beginPath(); g.arc(ox+COL-10,y,6,0,7); g.fill(); } g.restore(); }
  // 5 Wappenfenster der Marientidenkapelle (Foto; gemalter Ersatz: Schriftzeilen auf hellem Glas, Wappenreihen)
  if(HASPHOTO(5)) { g.fillStyle='#8c8f96'; g.fillRect(5*COL,0,COL,ATL); } else
  { const ox=5*COL, r=rng(505); g.fillStyle='#e8eae4'; g.fillRect(ox,0,COL,ATL); clip(ox);
    g.fillStyle='#2a2622';
    for(let y=ATL*0.08;y<ATL;y+=13){ for(let x=ox+6;x<ox+COL-6;){ const w=2+r()*5; if(r()<0.12){ x+=8; continue; } g.fillRect(x,y,w,7+r()*3); x+=w+1.5; } }
    g.strokeStyle='rgba(40,40,40,.85)'; g.lineWidth=3; for(let y=0;y<ATL;y+=ATL/16){ g.beginPath(); g.moveTo(ox,y); g.lineTo(ox+COL,y); g.stroke(); }
    const tinct=[['#f2f0ea','#1a1a1a'],['#c01e24','#f2f0ea'],['#e8c020','#1a1a1a'],['#1d3e8f','#e8c020'],['#f2f0ea','#c01e24'],['#2f7a3a','#f2f0ea']];
    const shp=(cx,cy,w,h)=>{ g.beginPath(); g.moveTo(cx-w/2,cy-h/2); g.lineTo(cx+w/2,cy-h/2); g.lineTo(cx+w/2,cy); g.quadraticCurveTo(cx+w/2,cy+h*0.42,cx,cy+h/2); g.quadraticCurveTo(cx-w/2,cy+h*0.42,cx-w/2,cy); g.closePath(); };
    const shield=(cx,cy,w,h,t)=>{ g.save(); shp(cx,cy,w,h); g.fillStyle=t[0]; g.fill(); g.clip(); g.fillStyle=t[1]; const k=(r()*4)|0;
      if(k===0) g.fillRect(cx-w/2,cy,w,h); else if(k===1) g.fillRect(cx-w/8,cy-h/2,w/4,h); else if(k===2){ g.beginPath(); g.ellipse(cx,cy,w*0.28,h*0.3,0,0,7); g.fill(); } else { g.fillRect(cx-w/2,cy-h/2,w/2,h/2); g.fillRect(cx,cy,w/2,h/2); }
      g.restore(); g.strokeStyle='#151515'; g.lineWidth=2.5; shp(cx,cy,w,h); g.stroke(); };
    for(const fy of [0.27,0.45,0.62,0.8]) for(const fx of [1/6,1/2,5/6]){ const cx=ox+COL*fx, cy=ATL*fy; g.fillStyle='#f4f1e6'; g.fillRect(cx-36,cy-46,72,92); shield(cx,cy+4,56,70,pick(tinct,r)); }
    for(let k=0;k<40;k++) shield(ox+10+r()*(COL-20),r()*ATL,12,15,pick(tinct,r));
    g.fillStyle='#1a1a1a'; for(const fx of [1/6,1/2,5/6]){ const cx=ox+COL*fx, cy=ATL*0.05; g.fillRect(cx-3,cy-18,6,36); g.fillRect(cx-14,cy-6,28,6); }
    g.restore(); }
  g.fillStyle='#e6e8e4'; g.fillRect(6*COL,0,COL,ATL);
  // 7 Gedenkkapelle: helle Bleiverglasung, wird durch das Foto des Wappenfensters ersetzt
  cells(7*COL,707,(u,v,r)=>r()<0.05?pick(['#c9b27a','#9fb3c8'],r):pick(['#e9ece6','#dfe5df','#f2f2ec','#d5ddd8'],r));
})();
function texFromCanvas(c,mip){ const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; if(!mip){ t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; } else t.anisotropy=maxAniso; return t; }
export const atlasMip=texFromCanvas(atlasCanvas,true);
export const atlasLin=new THREE.CanvasTexture(atlasCanvas); atlasLin.generateMipmaps=false; atlasLin.minFilter=THREE.LinearFilter;
// mittlere Farbe je Spalte: über eine kleine verkleinerte Kopie gelesen (das Auslesen des großen Atlas dauerte mehrere Sekunden)
const ccCanvas=document.createElement('canvas'); ccCanvas.width=NT*8; ccCanvas.height=32;
function colColor(k){ const cg=ccCanvas.getContext('2d'); cg.clearRect(k*8,0,8,32); cg.drawImage(atlasCanvas,k*COL*AS,0,COL*AS,ATL*AS,k*8,0,8,32);
  const d=cg.getImageData(k*8,0,8,32).data; let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; } const c=new THREE.Color(r/n/255,g/n/255,b/n/255); const m=Math.max(c.r,c.g,c.b,1e-3); return c.multiplyScalar(1/m); }
// gemalte Spalten: feste Mittelwerte (spart das langsame Auslesen des großen Atlas); Fotospalten: aus dem Foto selbst
export const typeColor=[[1,.97,.92],[1,.98,.95],[1,.93,.92],[1,.92,.92],[.8,.8,1],[1,1,.96],[1,.98,.95],[1,1,1]].map(c=>new THREE.Color(c[0],c[1],c[2]));
function imgColor(img){ const cg=ccCanvas.getContext('2d'); cg.clearRect(0,0,8,32); cg.drawImage(img,0,0,8,32); const d=cg.getImageData(0,0,8,32).data; let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; } const c=new THREE.Color(r/n/255,g/n/255,b/n/255); const m=Math.max(c.r,c.g,c.b,1e-3); return c.multiplyScalar(1/m); }
// Fotos der Fenster laden und in ihre Spalten legen (bis dahin stehen die gemalten Fassungen)
async function loadGlassPhotos(){   // Fotos dekodieren und in ihre Spalten legen, bevor der Atlas zur Grafikkarte geht
  const g=atlasCanvas.getContext('2d');
  await Promise.all(Object.keys(GLASS).map(async key=>{ const k=+key, img=new Image(); img.src=GLASS[key];
    try{ await img.decode(); }catch(e){ return; }
    g.setTransform(1,0,0,1,0,0); g.drawImage(img,k*COL*AS,0,COL*AS,ATL*AS); typeColor[k]=imgColor(img); }));
  atlasMip.needsUpdate=true; atlasLin.needsUpdate=true;
}
await loadGlassPhotos();
// Gewölbekappen: heller Putz mit Ziegelzeichnung und Rankenmalerei (nach Innenfotos)
export const vaultTex=canvasTex(512,512,(g,w,h)=>{
  const r=rng(77); g.fillStyle='#ece6da'; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(150,118,96,.10)'; g.lineWidth=1; for(let y=0;y<h;y+=12){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); for(let x=(y/12%2)*16;x<w;x+=32){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+12); g.stroke(); } }
  for(let k=0;k<7;k++){ const x0=r()*w, y0=r()*h, len=60+r()*80, a=r()*Math.PI*2;
    g.strokeStyle='#7a3a2a'; g.lineWidth=2.2; g.beginPath(); g.moveTo(x0,y0); const pts=[];
    for(let s=1;s<=6;s++){ const t=s/6, x=x0+Math.cos(a)*len*t+Math.sin(t*6)*10, y=y0+Math.sin(a)*len*t+Math.cos(t*6)*10; g.lineTo(x,y); pts.push([x,y]); } g.stroke();
    for(const [x,y] of pts){ g.fillStyle='#5e7a5a'; g.beginPath(); g.ellipse(x+6,y-4,7,3.2,a+0.8,0,7); g.fill(); g.beginPath(); g.ellipse(x-6,y+4,7,3.2,a-0.8,0,7); g.fill(); }
    const [fx,fy]=pts[pts.length-1]; g.fillStyle='#a8402c'; for(let q=0;q<5;q++){ const b=q/5*Math.PI*2; g.beginPath(); g.arc(fx+Math.cos(b)*6,fy+Math.sin(b)*6,4,0,7); g.fill(); } g.fillStyle='#d8b050'; g.beginPath(); g.arc(fx,fy,3.5,0,7); g.fill(); }
  for(let i=0;i<3000;i++){ g.fillStyle='rgba(120,100,80,'+(r()*0.05)+')'; g.fillRect(r()*w,r()*h,2,2); }
},[1,1]);
