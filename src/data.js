// Daten des Modells. Bilder und JSON liegen als eigene Dateien unter src/assets und src/data;
// Vite liefert sie in der Webfassung als Dateien aus und bettet sie in der Offline-Fassung ein.
const name = p =>
  p
    .split('/')
    .pop()
    .replace(/\.\w+$/, '');
const urls = files => Object.fromEntries(Object.entries(files).map(([p, u]) => [name(p), u]));

const glassImg = import.meta.glob('./assets/glas/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' });
const clockImg = import.meta.glob('./assets/uhr/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' });

const fail = (what, fallback) => e => {
  console.warn('[St. Marien] Daten fehlen', what, e);
  return fallback;
};

/** Handy-Fassung (dieselbe Abfrage schaltet ui/phone.js um). Schon hier, weil davon abhängt, was beim Start geladen wird. */
export const PHONE = matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse)');
/** Handy: Umgebung und große Bilder der Astronomischen Uhr erst nach dem Start im Hintergrund laden (2,7 MB weniger
 * vor dem ersten Bild). Gilt für die ganze Sitzung, auch wenn das Fenster später breiter wird. */
export const LATER = PHONE.matches;
let envP = null;
const loadEnv = () => (envP ||= import('./data/umgebung.json').then(m => m.default).catch(fail('umgebung.json', null)));
if (!LATER) loadEnv(); // Computer: wie bisher sofort anfordern

export const DATA = {
  // Glasmalereien: Fenster-Nummer -> Bildadresse
  glass: Promise.resolve(urls(glassImg)),
  // Astronomische Uhr: Kalender- und Finsternisdaten, dazu die Bilder (img: Name -> Bildadresse)
  clock: import('./data/uhr.json').then(m => ({ ...m.default, img: urls(clockImg) })).catch(fail('uhr.json', null)),
  // Umgebung: LoD2-Gebäude, Gelände, Bäume (Funktion: auf dem Handy erst bei Bedarf angefordert)
  env: loadEnv,
};
