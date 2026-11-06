// Shader-Erweiterung: Innenraum-Maske und farbiges Licht durch die Fenster.
import { atlasLin, NT } from './textures.js'; // Aufbau-Reihenfolge: nach scene/textures
import { V3 } from '../three-global.js';
import { ARC_SP, CH_EDGES, F, inAmb, MASK_GLSL, MT_EDGES, NB, PX, ROOMS, XC } from '../model/measures.js';
import { cutPlane } from './renderer.js';

/* ---------------- Shader-Erweiterung: Innenraum-Maske & farbiges Licht ---------------- */

export const MAXW = 16;
export const TINT = {
  uSunL: { value: new V3(0, 1, 0) },
  uWinO: { value: Array.from({ length: MAXW }, () => new V3()) },
  uWinU: { value: Array.from({ length: MAXW }, () => new V3(1, 0, 0)) },
  uWinN: { value: Array.from({ length: MAXW }, () => new V3(0, 0, 1)) },
  uWinP: { value: Array.from({ length: MAXW }, () => new THREE.Vector4(1, 0, 1, 2)) },
  uWinT: { value: new Array(MAXW).fill(0) },
  uWinCount: { value: 0 },
  uAtlas: { value: atlasLin },
  uAmbIn: { value: 0.22 },
  uPlaster: { value: new THREE.Color(0.86, 0.83, 0.76) },
  uPX: { value: PX.slice() },
  uTintOn: { value: 1 },
};
const GL_HEAD = `
varying vec3 vWP;
uniform vec3 uSunL;
uniform vec3 uWinO[${MAXW}];
uniform vec3 uWinU[${MAXW}];
uniform vec3 uWinN[${MAXW}];
uniform vec4 uWinP[${MAXW}];
uniform float uWinT[${MAXW}];
uniform int uWinCount;
uniform sampler2D uAtlas;
uniform float uAmbIn;
uniform vec3 uPlaster;
uniform float uTintOn;
uniform float uPX[${NB + 1}];
float polyD(vec2 q, float step, float lo, float hi){
  float a=degrees(atan(q.y,q.x+1e-5));
  float mid=clamp(lo+step*floor((a-lo)/step+0.5),lo,hi);
  return length(q)*cos(radians(a-mid));
}
${MASK_GLSL}vec3 winTint(vec3 P){
  if(uTintOn<0.5) return vec3(1.0);
  for(int i=0;i<${MAXW};i++){
    if(i>=uWinCount) break;
    vec3 N=uWinN[i];
    float dn=dot(uSunL,N);
    if(abs(dn)<1e-4) continue;
    float t=dot(uWinO[i]-P,N)/dn;
    if(t<=0.0) continue;
    vec3 Q=P+uSunL*t-uWinO[i];
    float u=dot(Q,uWinU[i]);
    float v=Q.y;
    vec4 g=uWinP[i];
    if(abs(u)>g.x || v<g.y || v>g.w) continue;
    if(v>g.z){
      float w=g.x; float dv=v-g.z;
      if((u-w)*(u-w)+dv*dv>4.0*w*w || (u+w)*(u+w)+dv*dv>4.0*w*w) continue;
    }
    vec2 auv=vec2((uWinT[i]+0.02+0.96*(u+g.x)/(2.0*g.x))*${F(1 / NT)},(v-g.y)/(g.w-g.y));
    vec3 c=texture2D(uAtlas,auv).rgb;
    return pow(c,vec3(2.2))*1.7;
  }
  return vec3(1.0);
}
`;
export function insideJS(x, y, z) {
  for (const r of ROOMS) if (x > r[0] && x < r[1] && z > r[2] && z < r[3] && y < r[4]) return true;
  if (x >= XC) {
    if (y < 38.6 && CH_EDGES.every(e => e[0] * (x - e[2]) + e[1] * (z - e[3]) < 0)) return true;
    if (y < 20.6 && inAmb(x, z)) return true;
  }
  if (y < 18.3 && MT_EDGES.every(e => e[0] * (x - e[2]) + e[1] * (z - e[3]) > -0.05)) return true;
  return false;
}
const LFB = (function () {
  const c = THREE.ShaderChunk.lights_fragment_begin;
  const i = c.indexOf('NUM_DIR_LIGHTS > 0');
  if (i < 0) return null;
  const j = c.indexOf('RE_Direct( directLight', i);
  if (j < 0) return null;
  return c.slice(0, j) + 'directLight.color *= winTint( vWP );\n\t\t' + c.slice(j);
})();
export function enhance(mat, o) {
  o = o || {};
  const key = 'stm' + (o.mask ? 1 : 0) + (o.pillar ? 1 : 0);
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = function (sh) {
    Object.assign(sh.uniforms, TINT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n\tvWP=(modelMatrix*vec4(transformed,1.0)).xyz;',
      );
    let f = sh.fragmentShader;
    f = f.replace(
      '#include <common>',
      '#include <common>\n' + (o.mask ? '#define USE_MASK\n' : '') + (o.pillar ? '#define PILLAR\n' : '') + GL_HEAD,
    );
    f = f.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
#ifdef USE_MASK
	{
		float mk=insideMask(vWP);
		vec3 base=uPlaster*(0.92+0.3*dot(diffuseColor.rgb,vec3(0.333)));
#ifdef PILLAR
		if(vWP.x>uPX[0]-0.3 && vWP.x<uPX[${NB}]-0.05){   // Bemalung nach Innenfotos: rote Bogenränder, Rankenbänder an den Pfeilern
			float xm=0.0, hw=1.0, dp=100.0;
			for(int i=0;i<${NB};i++){ if(vWP.x>=uPX[i] && vWP.x<uPX[i+1]){ xm=0.5*(uPX[i]+uPX[i+1]); hw=0.5*(uPX[i+1]-uPX[i])-1.0; } }
			for(int i=0;i<=${NB};i++) dp=min(dp,abs(vWP.x-uPX[i]));
			float u=vWP.x-xm, y=vWP.y, sp=${F(ARC_SP)}, d;
			if(y<sp) d=abs(abs(u)-hw); else { vec2 c=vec2(u<=0.0?hw:-hw,sp); d=abs(length(vec2(u,y)-c)-2.0*hw); }
			vec3 red=vec3(0.68,0.34,0.24), green=vec3(0.42,0.55,0.46);
			if(d<0.38 && y>0.8 && y<${F(ARC_SP + 5.0)}) base=mix(base, d<0.08?vec3(0.48,0.22,0.15):red, 0.8);
			if(dp>0.4 && dp<0.85 && y>0.8 && y<29.5){ float k=fract(y/0.8); vec3 orn=k<0.5?red:green; float q=length(vec2((dp-0.62)/0.17,(fract(y/0.4)-0.5)/0.3)); if(q<1.0) base=mix(base,orn,0.75); if(abs(dp-0.42)<0.03||abs(dp-0.83)<0.03) base=mix(base,red,0.8); }
		}
#endif
		diffuseColor.rgb=mix(diffuseColor.rgb,base,mk);
	}
#endif`,
    );
    if (LFB) f = f.replace('#include <lights_fragment_begin>', LFB);
    f = f.replace(
      '#include <aomap_fragment>',
      `{ float am=mix(1.0,uAmbIn,insideMask(vWP)); reflectedLight.indirectDiffuse*=am; reflectedLight.indirectSpecular*=am; }
#include <aomap_fragment>`,
    );
    sh.fragmentShader = f;
  };
  mat.clippingPlanes = [cutPlane];
  return mat;
}
