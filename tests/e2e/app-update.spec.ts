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

const notice = 'Hay una versión nueva de la app.'

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

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = normalize(join(dist, path === '/' ? 'index.html' : path))
    try {
      let body: Buffer | string = await readFile(file.startsWith(dist) ? file : join(dist, 'index.html'))
      if (path === '/sw.js') body = `${body}\n// ${version}\n`
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
})

test.describe('Versión nueva de la app (#76)', () => {
  test('al volver a la app, si hay una versión nueva, sale un aviso y «Actualizar» la carga', async ({
    page,
  }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect(page.getByText(notice)).toHaveCount(0)

    version = 'versión 2'
    // Se vuelve a la app (por ejemplo, desde otra pestaña o del segundo plano en el iPhone).
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText(notice)).toBeVisible()

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
    await expect(page.getByText(notice)).toHaveCount(0)
  })

  // El caso normal: la app ya se había abierto antes y funciona con la copia guardada.
  test('también con la app abierta antes, «Actualizar» carga la versión nueva', async ({ page }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    version = 'versión 2'
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByText(notice)).toBeVisible()
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
    await expect(page.getByText(notice)).toHaveCount(0)
  })

  test('sin versión nueva, no sale ningún aviso', async ({ page }) => {
    await page.goto(baseUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByRole('heading', { name: 'Limpieza de casa' })).toBeVisible()
    // Se comprueba que algo NO pasa: no hay nada que esperar, así que se le da un segundo.
    await page.waitForTimeout(1_000)
    await expect(page.getByText(notice)).toHaveCount(0)
  })
})
