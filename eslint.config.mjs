// ESLint: findet Fehler im Code (z. B. vertippte oder vergessene Namen). Formatierung macht Prettier.
// Aufruf: npm run lint   (in WebStorm: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint → Automatic)
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'web/',
      'dist/',
      'node_modules/',
      'tests/test.html',
      'tests/.build/',
      'tests/astro/',
      'tests/.results/',
      'tests/.report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  {
    // Programm im Browser
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, THREE: 'readonly' } },
  },
  {
    rules: {
      // „try{ … }catch(e){}“ ist hier gewollt: z. B. Browserspeicher, Teilen, Zwischenablage dürfen fehlschlagen
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { caughtErrors: 'none', varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Bau- und Testwerkzeuge in Node
    files: ['*.mjs', 'tests/**/*.mjs', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // Browser-Tests: laufen in Node, die Funktionen in page.evaluate im Browser
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, THREE: 'readonly' } },
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
