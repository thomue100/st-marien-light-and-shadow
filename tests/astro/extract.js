// Holt die Astronomie-Funktionen unverändert aus src/marienkirche.html und macht daraus ein Node-Modul.
// So prüfen die Tests genau den Code, der im Browser läuft – ohne 3D-Teil und ohne Browser.
const fs=require('fs'), path=require('path'), acorn=require('acorn'), walk=require('acorn-walk');
const SRC=path.join(__dirname,'../../src/marienkirche.html');
const NEED=['trueNoon','sunPos','moonPos','sunDay','moonRiseSet','moonPhaseTime','eclipseScan','localToUtc','berlinOffsetMin','lastSundayUtc','dstRange','LAT','LON'];
function build(){
  const html=fs.readFileSync(SRC,'utf8');
  const m=html.match(/<script>\n(\(async function\(\)\{[\s\S]*?\}\)\(\);)\n<\/script>/); if(!m) throw new Error('Hauptskript nicht gefunden');
  const code=m[1], ast=acorn.parse(code,{ecmaVersion:2022,allowAwaitOutsideFunction:true});
  const body=ast.body[0].expression.callee.body.body;   // Rumpf der async-IIFE
  const decl=new Map();   // Name -> {node, deps}
  for(const st of body){
    const names=[]; if(st.type==='FunctionDeclaration') names.push(st.id.name);
    else if(st.type==='VariableDeclaration') for(const d of st.declarations){ if(d.id.type==='Identifier') names.push(d.id.name); }
    if(!names.length) continue;
    const deps=new Set(), skip=new Set();   // Eigenschaftsnamen (a.b, {b:…}) sind keine Abhängigkeiten
    walk.full(st,n=>{ if(n.type==='MemberExpression'&&!n.computed) skip.add(n.property); if(n.type==='Property'&&!n.computed&&!n.shorthand) skip.add(n.key); });
    const local=new Set();   // innen deklarierte Namen (Parameter, lokale Variablen) überdecken gleichnamige äußere
    const pat=p=>{ if(!p) return; if(p.type==='Identifier') local.add(p.name); else if(p.type==='AssignmentPattern') pat(p.left); else if(p.type==='ArrayPattern') p.elements.forEach(pat); else if(p.type==='ObjectPattern') p.properties.forEach(q=>pat(q.value||q.argument)); else if(p.type==='RestElement') pat(p.argument); };
    walk.full(st,n=>{ if(/Function/.test(n.type)&&n!==st){ n.params.forEach(pat); if(n.id&&n.type==='FunctionDeclaration') local.add(n.id.name); }
      if(n.type==='FunctionDeclaration'&&n===st) n.params.forEach(pat);
      if(n.type==='VariableDeclarator'&&st.type==='FunctionDeclaration') pat(n.id); if(n.type==='CatchClause') pat(n.param); });
    walk.full(st,n=>{ if(n.type==='Identifier'&&!skip.has(n)&&!local.has(n.name)) deps.add(n.name); });
    for(const nm of names) decl.set(nm,{node:st,deps});
  }
  const keep=new Set(), todo=[...NEED];
  while(todo.length){ const n=todo.pop(); if(keep.has(n)||!decl.has(n)) continue; keep.add(n); for(const d of decl.get(n).deps) if(!keep.has(d)&&decl.has(d)) todo.push(d); }
  if(process.env.DEBUG) console.log([...keep].join(' '));
  const nodes=[...new Set([...keep].map(n=>decl.get(n).node))].sort((a,b)=>a.start-b.start);
  const out=nodes.map(n=>code.slice(n.start,n.end)).join('\n');
  return '// automatisch erzeugt aus src/marienkirche.html – nicht von Hand ändern\n'+out+'\nmodule.exports={'+NEED.join(',')+'};\n';
}
if(require.main===module){ const s=build(); fs.writeFileSync(path.join(__dirname,'astro.gen.js'),s); console.log('astro.gen.js',s.length,'Zeichen'); }
module.exports={build};
