// Browser-Tests mit Playwright (tests/e2e). Aufruf: npm run test:e2e
// Die Tests laufen in Chromium mit Software-Grafik (SwiftShader), damit sie auch ohne Grafikkarte (z. B. auf GitHub) gehen.
import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/.results',
  timeout: 240_000, // das Modell braucht mit Software-Grafik einige Sekunden zum Aufbau
  expect: { timeout: 30_000 },
  workers: CI ? 2 : undefined, // ohne Angabe: halb so viele wie Prozessorkerne; jeder Test rechnet die Grafik selbst
  retries: CI ? 1 : 0,
  reporter: CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'tests/.report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'tests/.report' }]],
  use: {
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1400, height: 850 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  // Webfassung (web/) für tests/e2e/webfassung.spec.js
  webServer: {
    command: 'npx vite preview --outDir web --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
