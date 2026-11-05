// Gemeinsamer Zustand: Datum, Uhrzeit, Ansicht und Schalter (state), Sonnenstand, Lichtrichtung.
import './model/measures.js';   // Aufbau-Reihenfolge: nach model/measures
import { rad } from './astro/index.js';
import { V3 } from './three-global.js';
import { moonCur, useMoon } from './light/sun.js';

export const state={y:2026,m:9,d:26,minutes:720,playing:false,speed:30,axis:98.5,env:true,trees:true,lodChurch:false,sdWedge:8.5,cut:60,beams:true,tint:true,amb:0.3,exp:1.0,labels:true,moon:true,sunPath:true,moonPath:true,mode:'orbit'};
export const cur={el:0,az:0};
export const L=new V3(0,1,0);
export const LD=new V3(0,1,0);   // Richtung der aktiven Lichtquelle: Sonne, nachts der Mond
export const lightUp=()=>useMoon?moonCur.el>0:cur.el>0;
export function sunVec(el,az,out){
  const ce=Math.cos(el*rad), E=ce*Math.sin(az*rad), N=ce*Math.cos(az*rad), U=Math.sin(el*rad), b=state.axis*rad;
  return out.set(E*Math.sin(b)+N*Math.cos(b),U,E*Math.cos(b)-N*Math.sin(b));
}
