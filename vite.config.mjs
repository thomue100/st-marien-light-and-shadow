// Bauen mit Vite:
//   npm run dev            lokaler Entwicklungsserver mit automatischem Neuladen
//   npm run build:web      Webfassung nach web/  (relativ, läuft in jedem Unterordner, z. B. /licht-und-schatten/)
//   npm run build:offline  eine einzige Datei nach dist/, startet per Doppelklick ohne Server
//   npm run build:test     wie offline, aber mit Testhaken, als tests/test.html
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { testHooks } from './tests/hooks.mjs';

const OFFLINE_NAME = 'St-Marien-Licht-und-Schatten-offline.html';

/** Benennt die erzeugte index.html der Einzeldatei-Fassungen um. */
function renameOutput(dir, target) {
  return {
    name: 'st-marien-dateiname',
    apply: 'build',
    closeBundle(error) {
      if (error || !existsSync(resolve(dir, 'index.html'))) return;   // Bau fehlgeschlagen: die eigentliche Meldung kommt von Vite
      renameSync(resolve(dir, 'index.html'), resolve(target));
      if (resolve(target, '..') !== resolve(dir)) rmSync(resolve(dir), { recursive: true, force: true });
    },
  };
}

/** Offline-Fassung: Schriften sind eingebettet und sofort da – kurz warten statt Ersatzschrift (wie bisher). */
function fontDisplayBlock() {
  return {
    name: 'st-marien-schriften-offline',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/styles/fonts.css')) return null;
      return { code: code.replaceAll('font-display:swap', 'font-display:block'), map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'offline' || mode === 'test';
  const outDir = mode === 'offline' ? 'dist' : mode === 'test' ? 'tests/.build' : 'web';
  return {
    base: './',
    publicDir: single ? false : 'public',
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2020',
      chunkSizeWarningLimit: 2000,   // Umgebungsdaten (1,1 MB) sind bewusst ein eigener großer Block
      cssMinify: false,   // CSS unverändert ausliefern: der Minifier ließ z. B. backdrop-filter weg und behielt nur -webkit-backdrop-filter (Unschärfe fehlte in Chrome)
      ...(single ? { assetsInlineLimit: Infinity, cssCodeSplit: false } : {}),
    },
    plugins: [
      mode === 'test' && testHooks(),
      single && fontDisplayBlock(),
      single && viteSingleFile(),
      mode === 'offline' && renameOutput('dist', 'dist/' + OFFLINE_NAME),
      mode === 'test' && renameOutput('tests/.build', 'tests/test.html'),
    ].filter(Boolean),
  };
});
