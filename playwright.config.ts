import { defineConfig, devices } from '@playwright/test'

// Pruebas de extremo a extremo (e2e): abren la app en un navegador de verdad
// y la usan como lo haría una persona. Están en tests/e2e/.
//
// Se prueban contra la versión compilada (npm run build + npm run preview),
// no contra el servidor de desarrollo, porque es lo más parecido a lo que publica Vercel
// (incluido el service worker de la PWA).

const port = 4173
const isCI = !!process.env.CI

export default defineConfig({
  testDir: 'tests/e2e',
  // En la CI, un test.only olvidado hace fallar la ejecución en lugar de saltarse el resto.
  forbidOnly: isCI,
  // Un reintento en la CI para absorber fallos puntuales de red; en local, ninguno.
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // La app sale en el idioma del navegador (US-52). Las pruebas de cada historia buscan
    // los textos en castellano; las del inglés lo cambian con test.use({ locale: 'en-US' }).
    locale: 'es-ES',
    // Si una prueba falla, guarda una traza para ver paso a paso qué pasó.
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // La app se usará sobre todo en el móvil.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
