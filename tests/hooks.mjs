// Testhaken: macht interne Funktionen und Werte für die Browser-Tests (tests/*.js) erreichbar.
// Wird nur in der Testfassung eingesetzt (npm run build:test, über vite.config.mjs), nie in Web- oder Offline-Fassung.
// Jede Ersetzung muss genau einmal greifen – sonst bricht der Testbau mit einer Meldung ab.
export const HOOKS = [
  [/^const VIEWS=\{/m, 'const VIEWS=window.__V={'],
  [/^function goView\(name,instant\)\{/m,
    'window.__go=(n,i)=>goView(n,i); window.__mv=(f,s)=>{ moveBy(f,s,0); return [camera.position.x,camera.position.y,camera.position.z]; }; ' +
    'window.__dbg=()=>({int:sun.intensity,col:sun.color.toArray(),exp:renderer.toneMappingExposure,hemi:hemi.intensity,useMoon,moonStr,lightStr,LD:LD.toArray()});\n' +
    'function goView(name,instant){'],
  [/^const clk=\{em:\[\], img:\{\}/m, 'const clk=window.__clk={em:[], img:{}'],
  [/^function goEclipse\(e\)\{/m,
    'window.__ecl=()=>({eclObsc,eclL,eclS,nx:nextEclipses()}); window.__goEcl=k=>goEclipse(nextEclipses()[k]); window.__goEclAt=(t,k)=>goEclipse(eclipseScan(t,1,k)[0]);\n' +
    'function goEclipse(e){'],
  [/^const quiz=\{/m,
    'window.__win=windows; window.__cam=camera; window.__sd=sd; ' +
    'window.__A={sunPos,moonPos,moonRiseSet,moonPhaseTime,localToUtc,berlinOffsetMin,dstInfo,day:()=>day,setDate,setMinutes}; window.__MZT=MZT; window.__LK=LK; ' +
    'const quiz={'],
];

/** Vite-Plugin: setzt die Testhaken in src/app.js ein. */
export function testHooks() {
  return {
    name: 'st-marien-testhaken',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/app.js')) return null;
      for (const [re, by] of HOOKS) {
        const n = (code.match(new RegExp(re.source, 'gm')) || []).length;
        if (n !== 1) this.error(`Testhaken ${re} greift ${n}-mal statt einmal – src/app.js wurde geändert, bitte tests/hooks.mjs anpassen.`);
        code = code.replace(re, () => by);
      }
      return { code, map: null };
    },
  };
}
