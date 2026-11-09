import { expect, test } from '@playwright/test'

// Prueba de humo: comprueba que la app compilada arranca y es una PWA instalable.
// Si esto falla, no tiene sentido mirar nada más.

test('la app carga y muestra su nombre', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Limpieza de casa')
  await expect(page.getByRole('heading', { level: 1, name: 'Limpieza de casa' })).toBeVisible()
})

test('al instalarla en el iPhone, propone el nombre completo', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    'content',
    'Limpieza de casa',
  )
})

test('el manifiesto de la PWA está enlazado y es correcto (US-24)', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const response = await request.get(href!)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'Limpieza de casa',
    // Bajo el icono en Android: corto, para que no salga cortado.
    short_name: 'Limpieza',
    lang: 'es',
    display: 'standalone',
  })
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)
})

test('el service worker se registra y queda activo (US-24)', async ({ page }) => {
  await page.goto('/')
  const active = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active !== null
  })
  expect(active).toBe(true)
})
