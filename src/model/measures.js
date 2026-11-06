// Maße der Kirche (abgeglichen mit LoD2 2025 und bDOM20 2023), Grundrisse der Räume, Innenraum-Maske für die Shader.
import '../core/prefs.js'; // Aufbau-Reihenfolge: nach core/prefs

export const SQ3 = Math.sqrt(3);
// Maße der Kirche, abgeglichen mit dem amtlichen LoD2-Gebäudemodell (LVermGeo SH, 2025) und dem Oberflächenmodell bDOM20 (2023).
// Modellkoordinaten: x entlang der Kirchenachse (Ost = +x), z quer (Süd = +z), y Höhe über Fußboden (13,0 m NHN).
export const X0 = -36.8,
  XC = 28.8,
  XT = 1.6,
  XW = -50.3; // Turm-Ostflucht, Beginn Chorpolygon, Beginn Chorjoche, Westwand (Mitte)
export const PX = [X0, -30.15, -24.19, -17.76, -11.32, -4.87, XT, 8.64, 15.0, 22.07, XC]; // Pfeilerachsen aus den Strebepfeilern in LoD2
export const NB = PX.length - 1;
export const ZN = 7.15,
  ZNF = 7.85; // Mittelschiff: Wandmitte, Außenflucht
export const ZAN = 17.45,
  ZAS = 21.2,
  ZCS = 17.5,
  ZKN = 20.5; // Seitenschiffwände (Mitte): Nord, Süd Langhaus, Süd Chor; niedrige Nordkapellen
// Chorschluss nach den Grundrissen (Dehio; Plan von 1906, Maßstab 1:… über die Maßleiste, Pfeilerachsen auf ±0,4 m mit LoD2 übereinstimmend):
// Binnenchor aus drei Seiten des Achtecks, Polygonpfeiler bei x = XC + 4,4 und z = ±3,05 (Wandmitte).
export const CHA = 4.4,
  CHE = 3.05,
  CHOIR = [
    [XC, -ZN],
    [XC + CHA, -CHE],
    [XC + CHA, CHE],
    [XC, ZN],
  ];
// Umgang mit Kapellenkranz (Wandmitte, Nordhälfte; Süd gespiegelt): je Seite eine dreiseitig vortretende Kapelle,
// westlich davon eine schräge Wand, im Osten die Marientidenkapelle. Außenkanten passen zu den LoD2-Wänden.
export const AMB_N = [
  [XC, -17.45],
  [32.2, -12.7],
  [37.2, -13.4],
  [40.2, -10.0],
  [38.4, -5.0],
];
export const AMB = AMB_N.concat(
  AMB_N.slice()
    .reverse()
    .map(p => [p[0], -p[1]]),
);
AMB[AMB.length - 1] = [XC, 17.5];
export const APSE_WB = 25.0,
  APSE_WS = 31.4,
  APSE_GAL = 19.6; // Chorschluss: Fensterbank, Kämpfer der Fenster, Laufgang (nach Innenfotos)
export const ZSI = 17.3; // südliche Seitenschiffwand (Grundriss): dahinter Briefkapelle und vier Kapellen zwischen den Strebepfeilern
// Polygon um d nach außen versetzen (Außennormale (dz,-dx) bei Lauf von Nord nach Süd); n0/n1: Normalen vor dem ersten bzw. nach dem letzten Punkt
export function offPoly(pts, d, n0, n1, closed) {
  const N = pts.length,
    nr = [];
  for (let i = 0; i < N - (closed ? 0 : 1); i++) {
    const a = pts[i],
      b = pts[(i + 1) % N],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    nr.push([dz / l, -dx / l]);
  }
  return pts.map((p, i) => {
    const na = closed ? nr[(i - 1 + N) % N] : i === 0 ? n0 : nr[i - 1],
      nb = closed ? nr[i] : i === N - 1 ? n1 : nr[i];
    const s = d / (1 + na[0] * nb[0] + na[1] * nb[1]);
    return [p[0] + (na[0] + nb[0]) * s, p[1] + (na[1] + nb[1]) * s];
  });
}
export const choirOff = d => offPoly(CHOIR, d, [0, -1], [0, 1], false);
export const HN = 40.9,
  HR = 49.6,
  HJ = 29.4,
  HAN = 22.7,
  HAS = 20.9,
  HCS = 22.7,
  COS18 = Math.cos((18 * Math.PI) / 180);
export const TW = { x0: -50.9, x1: X0, n: [-20.8, -7.2], s: [7.3, 21.0], xc: -43.85 }; // Turmbreiten nach bDOM20 (Schaft 13,6–13,7 m)
export const ARC_SP = 14.0; // Kämpferhöhe der Mittelschiffarkaden
export const GK = { x0: TW.x0 + 0.45, x1: TW.x1 - 0.45, z0: TW.s[0] + 0.45, z1: TW.s[1] - 0.45, h: 23.0, ceil: 22.0 }; // Gedenkkapelle im Südturm (hohe Turmhalle)
export const MT = [
  [38.4, -5.0],
  [43.6, -5.3],
  [47.4, -5.4],
  [50.5, -2.6],
  [50.5, 1.4],
  [47.7, 5.2],
  [43.6, 5.1],
  [38.4, 4.95],
]; // Marientidenkapelle (Wandmitte): westliches Vorjoch ab dem Umgang (Grundriss), Ostteil nach LoD2
export const AXIS_MEASURED = 98.5;
export const F = v => (+v).toFixed(4);
export const CHAPELS = [
  {
    name: 'Briefkapelle',
    s: 1,
    x0: X0,
    x1: -22.46,
    zi: ZSI,
    zo: 26.85,
    h: 14.1,
    roof: 'lean',
    ridge: 21.9,
    ceil: 12.4,
  },
  {
    name: 'Totentanzkapelle',
    s: -1,
    x0: XT,
    x1: 15.0,
    zi: ZAN,
    zo: 25.95,
    h: 22.0,
    roof: 'gableZ',
    ridge: 28.6,
    ceil: 19.0,
  },
  {
    name: 'Nördliche Chorkapellen',
    s: -1,
    x0: 15.0,
    x1: XC,
    zi: ZAN,
    zo: 26.05,
    h: 24.0,
    roof: 'gableX',
    hin: 24.0,
    zr: 22.6,
    ridge: 28.9,
    ceil: 17.0,
    noWest: true,
  },
  {
    name: 'Südvorhalle',
    s: 1,
    x0: XT,
    x1: 16.2,
    zi: ZCS,
    zo: 29.7,
    rzo: 28.5,
    h: 21.3,
    roof: 'gableX',
    hin: 23.4,
    zr: 23.0,
    ridge: 29.7,
    ceil: 16.5,
  }, // ein durchgehendes Dach mit der Bürgermeisterkapelle (Luftbilder)
  {
    name: 'Bürgermeisterkapelle',
    s: 1,
    x0: 16.2,
    x1: XC,
    zi: ZCS,
    zo: 28.5,
    h: 21.3,
    roof: 'gableX',
    hin: 23.4,
    zr: 23.0,
    ridge: 29.7,
    ceil: 16.5,
  },
];
// Innenräume (Rechtecke x0,x1,z0,z1,yMax) für Putzfarbe innen und gedämpftes Streulicht
export const ROOMS = [
  [XW, X0 + 0.1, -ZNF - 0.3, ZNF + 0.3, 38.6],
  [X0, XC, -ZN, ZN, 38.6],
  [X0, XC, -ZAN, 0, 20.6],
  [X0, XT, 0, ZAS, 20.6],
  [XT, XC, 0, ZCS, 20.6],
  [X0, XT, -ZKN, -ZAN, 7.7],
]
  .concat(
    CHAPELS.map(c => (c.s > 0 ? [c.x0, c.x1, c.zi, c.zo, c.ceil + 0.1] : [c.x0, c.x1, -c.zo, -c.zi, c.ceil + 0.1])),
  )
  .concat([[GK.x0, GK.x1, GK.z0, GK.z1, GK.ceil + 0.1]]); // bis zur Wandmitte, damit die Innenseiten erfasst werden
export const CH_EDGES = CHOIR.slice(0, 3).map((a, i) => {
  const b = CHOIR[i + 1],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  return [dz / l, -dx / l, a[0], a[1]];
});
export function inAmb(x, z) {
  let c = false;
  for (let i = 0, j = AMB.length - 1; i < AMB.length; j = i++) {
    const a = AMB[i],
      b = AMB[j];
    if (a[1] === b[1]) continue;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) / (b[1] - a[1])) * (z - a[1]) + a[0]) c = !c;
  }
  return c;
}
export const MT_EDGES = MT.map((a, i) => {
  const b = MT[(i + 1) % MT.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  return [-dz / l, dx / l, a[0], a[1]];
});
export const MASK_GLSL = (function () {
  let s = 'float insideMask(vec3 p){\n';
  for (const r of ROOMS)
    s +=
      '  if(p.x>' +
      F(r[0]) +
      ' && p.x<' +
      F(r[1]) +
      ' && p.z>' +
      F(r[2]) +
      ' && p.z<' +
      F(r[3]) +
      ' && p.y<' +
      F(r[4]) +
      ') return 1.0;\n';
  s +=
    '  if(p.x>=' +
    F(XC) +
    '){\n    if(p.y<38.6' +
    CH_EDGES.map(
      e => ' && dot(vec2(' + F(e[0]) + ',' + F(e[1]) + '),p.xz-vec2(' + F(e[2]) + ',' + F(e[3]) + '))<0.0',
    ).join('') +
    ') return 1.0;\n';
  s += '    if(p.y<20.6){ bool c=false;\n';
  for (let i = 0, j = AMB.length - 1; i < AMB.length; j = i++) {
    const a = AMB[i],
      b = AMB[j];
    if (a[1] === b[1]) continue;
    s +=
      '      if((' +
      F(a[1]) +
      '>p.z)!=(' +
      F(b[1]) +
      '>p.z) && p.x<' +
      F((b[0] - a[0]) / (b[1] - a[1])) +
      '*(p.z-(' +
      F(a[1]) +
      '))+(' +
      F(a[0]) +
      ')' +
      ') c=!c;\n';
  }
  s += '      if(c) return 1.0; }\n  }\n';
  s +=
    '  if(p.y<18.3' +
    MT_EDGES.map(
      e => ' && dot(vec2(' + F(e[0]) + ',' + F(e[1]) + '),p.xz-vec2(' + F(e[2]) + ',' + F(e[3]) + '))>-0.05',
    ).join('') +
    ') return 1.0;\n';
  return s + '  return 0.0;\n}\n';
})();
