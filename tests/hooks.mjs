// Testhaken: macht interne Namen für die Browser-Tests (tests/*.cjs) erreichbar – nur in der Testfassung
// (npm run build:test, über vite.config.mjs), nie in Web- oder Offline-Fassung.
//
// 1. Jedes Modul unter src/ meldet die Namen, die HOOKS braucht, in globalThis.__T an (als Getter, also immer der aktuelle Wert).
// 2. Am Ende von src/app.js – nach dem Aufbau – werden daraus die window.__…-Haken gebildet, die die Tests benutzen.
// Fehlt ein Name oder gibt es ihn in zwei Modulen, bricht der Testbau mit einer Meldung ab.
import { parse } from 'acorn';

export const HOOKS = `
window.__V=__T.VIEWS;
window.__go=(n,i)=>__T.goView(n,i);
window.__mv=(f,s)=>{ __T.moveBy(f,s,0); const c=__T.camera.position; return [c.x,c.y,c.z]; };
window.__dbg=()=>({int:__T.sun.intensity,col:__T.sun.color.toArray(),exp:__T.renderer.toneMappingExposure,hemi:__T.hemi.intensity,useMoon:__T.useMoon,moonStr:__T.moonStr,lightStr:__T.lightStr,LD:__T.LD.toArray()});
window.__clk=__T.clk;
window.__ecl=()=>({eclObsc:__T.eclObsc,eclL:__T.eclL,eclS:__T.eclS,nx:__T.nextEclipses()});
window.__goEcl=k=>__T.goEclipse(__T.nextEclipses()[k]);
window.__goEclAt=(t,k)=>__T.goEclipse(__T.eclipseScan(t,1,k)[0]);
window.__win=__T.windows; window.__cam=__T.camera; window.__sd=__T.sd;
window.__A={sunPos:__T.sunPos,moonPos:__T.moonPos,moonRiseSet:__T.moonRiseSet,moonPhaseTime:__T.moonPhaseTime,localToUtc:__T.localToUtc,
  berlinOffsetMin:__T.berlinOffsetMin,dstInfo:__T.dstInfo,day:()=>__T.day,setDate:__T.setDate,setMinutes:__T.setMinutes};
window.__MZT=__T.MZT; window.__LK=__T.LK;
`;
const NEEDED = new Set([...HOOKS.matchAll(/__T\.(\w+)/g)].map(m => m[1]));

/** Namen, die ein Modul auf oberster Ebene deklariert (auch exportierte). */
function topLevelNames(code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const names = [];
  const pat = p => {
    if (!p) return;
    if (p.type === 'Identifier') names.push(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument));
    else if (p.type === 'ArrayPattern') p.elements.forEach(pat);
    else if (p.type === 'AssignmentPattern') pat(p.left);
    else if (p.type === 'RestElement') pat(p.argument);
  };
  for (let st of ast.body) {
    if (st.type === 'ExportNamedDeclaration' && st.declaration) st = st.declaration;
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') names.push(st.id.name);
    else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => pat(d.id));
  }
  return names;
}

/** Vite-Plugin für den Testbau. */
export function testHooks() {
  const found = new Map(); // Name -> Modul
  return {
    name: 'st-marien-testhaken',
    enforce: 'pre',
    transform(code, id) {
      const file = id.replace(/\\/g, '/').split('?')[0];
      if (!/\/src\/.*\.js$/.test(file) || file.includes('/node_modules/')) return null;
      const mine = topLevelNames(code).filter(n => NEEDED.has(n));
      for (const n of mine) {
        if (found.has(n) && found.get(n) !== file) this.error(`Testhaken: ${n} gibt es in ${found.get(n)} und ${file}`);
        found.set(n, file);
      }
      let add = '';
      if (mine.length)
        add += `\n;Object.defineProperties(globalThis.__T??={},{${mine.map(n => `${n}:{get:()=>${n},configurable:true}`).join(',')}});\n`;
      if (file.endsWith('/src/app.js')) add += '\n// Testhaken (nur Testfassung)\n' + HOOKS;
      return add ? { code: code + add, map: null } : null;
    },
    buildEnd() {
      const missing = [...NEEDED].filter(n => !found.has(n));
      if (missing.length) this.error('Testhaken: nicht gefunden: ' + missing.join(', '));
    },
  };
}
