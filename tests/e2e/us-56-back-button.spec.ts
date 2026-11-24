import { expect, test, type Page } from '@playwright/test'
import { newTaskForm, signIn, task } from './helpers/app'
import { uniqueEmail } from './helpers/mailbox'

// US-56 · Volver con el botón atrás (#106)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// El botón atrás de Android hace lo mismo que el del navegador (`page.goBack()`): volver a la
// entrada anterior del historial.

const historyHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Histórico' })
const tasksList = (page: Page) => page.getByRole('list', { name: 'Tus tareas' })

async function openHistory(page: Page) {
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(historyHeading(page)).toBeVisible()
}

/** Entra y deja otra página detrás en el historial, para ver adónde lleva el botón atrás desde «Tus tareas». */
async function signInFromAnotherPage(page: Page) {
  await signIn(page, uniqueEmail())
  await page.goto('/favicon.svg')
  await page.goto('/')
  await expect(task(page, 'Superficies')).toBeVisible()
}

/** Comprueba que atrás sale de la app: vuelve a la página de antes. */
async function expectBackLeavesTheApp(page: Page) {
  await page.goBack()
  await expect(page).toHaveURL(/\/favicon\.svg$/)
}

test.describe('US-56 · Volver con el botón atrás', () => {
  test('desde el histórico, atrás vuelve a «Tus tareas», como «Volver»', async ({ page }) => {
    await signInFromAnotherPage(page)
    await openHistory(page)

    await page.goBack()

    await expect(task(page, 'Superficies')).toBeVisible()
    await expect(historyHeading(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeFocused()
  })

  test('al volver con atrás, «Tus tareas» sigue como estaba: lo escrito y el sitio de la página', async ({
    page,
  }) => {
    await signInFromAnotherPage(page)
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    await newTaskForm(page).getByLabel('Nombre').fill('Limpiar el horno')
    // La página, un poco bajada (en el móvil la lista no cabe entera).
    await page.evaluate(() => window.scrollTo(0, 200))
    const scrolled = await page.evaluate(() => window.scrollY)
    await openHistory(page)

    await page.goBack()

    await expect(newTaskForm(page).getByLabel('Nombre')).toHaveValue('Limpiar el horno')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled)
  })

  test('en «Tus tareas», atrás sale de la app', async ({ page }) => {
    await signInFromAnotherPage(page)
    await expectBackLeavesTheApp(page)
  })

  test('después de volver del histórico con atrás, atrás sale de la app', async ({ page }) => {
    await signInFromAnotherPage(page)
    await openHistory(page)
    await page.goBack()
    await expect(tasksList(page)).toBeVisible()

    await expectBackLeavesTheApp(page)
  })

  test('después de volver del histórico con «Volver», atrás sale de la app (no hace falta pulsarlo dos veces)', async ({
    page,
  }) => {
    await signInFromAnotherPage(page)
    await openHistory(page)
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(tasksList(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeFocused()

    await expectBackLeavesTheApp(page)
  })

  test('si recargo la página en el histórico, sigo en el histórico, y atrás vuelve a «Tus tareas»', async ({
    page,
  }) => {
    await signInFromAnotherPage(page)
    await openHistory(page)

    await page.reload()
    await expect(historyHeading(page)).toBeVisible()

    await page.goBack()
    await expect(task(page, 'Superficies')).toBeVisible()
    await expectBackLeavesTheApp(page)
  })
})
