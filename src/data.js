// Daten des Modells. Bilder und JSON liegen als eigene Dateien unter src/assets und src/data;
// Vite liefert sie in der Webfassung als Dateien aus und bettet sie in der Offline-Fassung ein.
const name = p => p.split('/').pop().replace(/\.\w+$/, '');
const urls = files => Object.fromEntries(Object.entries(files).map(([p, u]) => [name(p), u]));

const glassImg = import.meta.glob('./assets/glas/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' });
const clockImg = import.meta.glob('./assets/uhr/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' });

const fail = (what, fallback) => e => { console.warn('[St. Marien] Daten fehlen', what, e); return fallback; };

export const DATA = {
  // Glasmalereien: Fenster-Nummer -> Bildadresse
  glass: Promise.resolve(urls(glassImg)),
  // Astronomische Uhr: Kalender- und Finsternisdaten, dazu die Bilder (img: Name -> Bildadresse)
  clock: import('./data/uhr.json').then(m => ({ ...m.default, img: urls(clockImg) })).catch(fail('uhr.json', null)),
  // Umgebung: LoD2-Gebäude, Gelände, Bäume
  env: import('./data/umgebung.json').then(m => m.default).catch(fail('umgebung.json', null)),
};
