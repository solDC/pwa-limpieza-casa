import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'

// La app tardaba en pasar a la versión nueva tras un despliegue (#76).
//
// Un despliegue nuevo cambia el service worker (sw.js). Chrome lo pide por su cuenta,
// fuera de la página, así que page.route no lo puede cambiar. Por eso estas pruebas
// sirven la app compilada (dist/, que crea `npm run build` antes de las e2e) con un
// servidor propio, en otro puerto, donde pueden «desplegar» una versión nueva sin
// afectar a las demás pruebas.

/** La ventana del aviso. Cerrada, no cuenta: getByRole solo ve lo que está a la vista. */
function notice(page: import('@playwright/test').Page) {
  return page.getByRole('dialog', { name: 'Hay una versión nueva de la app.' })
}

/** Simula volver a la app (desde otra pestaña, o del segundo plano en el iPhone). */
function returnToApp(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

/** Si la página ya funciona con la versión instalada y no queda ninguna esperando. */
function serviceWorkerState(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      controlled: navigator.serviceWorker.controller !== null,
      waiting: registration?.waiting !== null,
      installing: registration?.installing !== null,
    }
  })
}
const dist = join(process.cwd(), 'dist')
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

let server: Server
let baseUrl: string
/** Lo que se añade a sw.js: cambiarlo es como desplegar una versión nueva. */
let version = ''
/** Código que se añade al final de sw.js, para simular fallos de la versión nueva. */
let swExtra = ''
/** Cuántas veces se ha pedido sw.js: cada vez es una búsqueda de versión nueva. */
let swRequests = 0

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = normalize(join(dist, path === '/' ? 'index.html' : path))
    try {
      let body: Buffer | string = await readFile(file.startsWith(dist) ? file : join(dist, 'index.html'))
      if (path === '/sw.js') {
        swRequests++
        body = `${body}\n// ${version}\n${swExtra}\n`
      }
      response.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      response.end(body)
    } catch {
      // Como Vercel: las rutas que no son archivos devuelven la app.
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end(await readFile(join(dist, 'index.html')))
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

test.beforeEach(() => {
  version = 'versión 1'
  swExtra = ''
})

test.describe('Versión nueva de la app (#76)', () => {
  test('al volver a la app, si hay una versión nueva, sale un aviso y «Actualizar» la carga', async ({
    page,
  }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect(notice(page)).toHaveCount(0)

    version = 'versión 2'
    await returnToApp(page)

    await expect(notice(page)).toBeVisible()
    // En el centro de la pantalla, para que se vea.
    const box = (await notice(page).boundingBox())!
    const viewport = page.viewportSize()!
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(viewport.height / 10)
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(viewport.width / 10)

    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Actualizar' }).click()
    await reloaded
    await expect(page.getByRole('heading', { name: 'Limpieza de casa' })).toBeVisible()
    // Funciona con la versión nueva, y no queda ninguna esperando que hiciera volver el aviso.
    await expect.poll(() => serviceWorkerState(page)).toEqual({
      controlled: true,
      waiting: false,
      installing: false,
    })
    await expect(notice(page)).toHaveCount(0)
  })

  // El caso normal: la app ya se había abierto antes y funciona con la copia guardada.
  test('también con la app abierta antes, «Actualizar» carga la versión nueva', async ({ page }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    version = 'versión 2'
    await returnToApp(page)
    await expect(notice(page)).toBeVisible()
    // La versión nueva espera a que se pulse «Actualizar».
    expect(await serviceWorkerState(page)).toEqual({
      controlled: true,
      waiting: true,
      installing: false,
    })

    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Actualizar' }).click()
    await reloaded
    // La que esperaba es la que manda ahora: ya no queda ninguna esperando.
    await expect.poll(() => serviceWorkerState(page)).toEqual({
      controlled: true,
      waiting: false,
      installing: false,
    })
    await expect(notice(page)).toHaveCount(0)
  })

  test('«Más tarde» cierra el aviso sin recargar, y vuelve a salir al volver a la app', async ({
    page,
  }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    version = 'versión 2'
    await returnToApp(page)
    await expect(notice(page)).toBeVisible()
    // Mientras sale, lo de detrás no se puede usar.
    await expect(page.getByLabel('Email').click({ timeout: 1_000 })).rejects.toThrow()

    // Una marca en la página: si se recargara, desaparecería.
    await page.evaluate(() => ((window as unknown as { notReloaded: boolean }).notReloaded = true))
    const notReloaded = () =>
      page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded)
    await page.getByRole('button', { name: 'Más tarde' }).click()

    await expect(notice(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Limpieza de casa' })).toBeVisible()
    expect(await notReloaded()).toBe(true)
    // Cerrado el aviso, lo de detrás vuelve a funcionar.
    await page.getByLabel('Email').click()

    await returnToApp(page)
    await expect(notice(page)).toBeVisible()

    // La tecla Escape cuenta como «Más tarde».
    await page.keyboard.press('Escape')
    await expect(notice(page)).toHaveCount(0)
    expect(await notReloaded()).toBe(true)
    await returnToApp(page)
    await expect(notice(page)).toBeVisible()
  })

  test('si «Actualizar» no consigue cargar la versión nueva, la ventana no se queda bloqueada', async ({
    page,
  }) => {
    // El reloj de la página lo controla la prueba, para no esperar los 10 segundos de verdad.
    await page.clock.install()
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    // La versión nueva no llega a activarse nunca (como si se cortara a medias).
    version = 'versión 2'
    swExtra = 'self.skipWaiting = () => Promise.resolve()'
    await returnToApp(page)
    await expect(notice(page)).toBeVisible()

    await page.getByRole('button', { name: 'Actualizar' }).click()

    // Mientras se actualiza, no se puede cerrar ni volver a pulsar.
    await expect(page.getByRole('button', { name: 'Actualizando…' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Más tarde' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(notice(page)).toBeVisible()

    // Pasado el tiempo sin recargar, los botones vuelven a funcionar.
    await page.clock.fastForward(10_000)
    await expect(page.getByRole('button', { name: 'Actualizar' })).toBeEnabled()
    await page.getByRole('button', { name: 'Más tarde' }).click()
    await expect(notice(page)).toHaveCount(0)
  })

  test('sin versión nueva, no sale ningún aviso', async ({ page }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    const before = swRequests
    await returnToApp(page)

    // Ha buscado de verdad una versión nueva (ha pedido sw.js otra vez)…
    await expect.poll(() => swRequests).toBeGreaterThan(before)
    // …y, como es la misma, no hay ninguna instalándose ni esperando.
    await expect.poll(() => serviceWorkerState(page)).toMatchObject({
      waiting: false,
      installing: false,
    })
    await expect(page.getByRole('heading', { name: 'Limpieza de casa' })).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
  })
})
