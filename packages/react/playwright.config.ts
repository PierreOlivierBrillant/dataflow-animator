import { defineConfig } from '@playwright/test';

// Régression visuelle de la planche-contact (cf. docs/AI-VALIDATION.md).
// Le rendu étant déterministe (`evaluate(timeline, t)`), les goldens sont
// stables — pas de flakiness liée à une horloge. On réutilise le Chrome
// système (`channel: 'chrome'`) pour ne pas télécharger Chromium.
//
// NB : les goldens dépendent du rendu des polices de la machine. Régénère-les
// dans l'environnement cible (`npm run test:visual -- --update-snapshots`) ou
// exécute la CI dans l'image Docker officielle de Playwright. Le seuil
// `maxDiffPixelRatio` absorbe les micro-écarts d'anti-aliasing.
export default defineConfig({
  testDir: './scripts/validation-harness',
  testMatch: '**/*.visual.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'line',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: 'http://localhost:5199',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run harness',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
