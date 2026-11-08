import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, formatDayMonth, formatShortDate, localDateIn } from '../../src/domain/dates'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-30 · Marcar una tarea como hecha (#39)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// El día en que se hace lo apunta la base de datos (hoy en Madrid), así que estas pruebas
// usan el reloj de verdad, sin fijarlo, y calculan las fechas esperadas a partir de hoy.
// Que la app no pueda elegir ese día se prueba en tests/integration/task-rounds.test.ts.

async function signIn(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
  await page.goto((await waitForSignInEmail(email)).link)
  await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
}

function task(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
}

function markDone(page: Page, name: string) {
  return task(page, name).getByRole('button', { name: 'Marcar como hecha' })
}

const today = () => localDateIn('Europe/Madrid', new Date())

test.describe('US-30 · Marcar una tarea como hecha', () => {
  test('una tarea de fin de semana hecha pasa al finde siguiente, también al volver a entrar', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    const saturday = addDays(today(), -((dayOfWeek(today()) + 1) % 7))
    await expect(task(page, 'Superficies')).toContainText(`Toca: finde del ${formatDayMonth(saturday)}`)

    await markDone(page, 'Superficies').click()

    const next = `Toca: finde del ${formatDayMonth(addDays(saturday, 7))}`
    await expect(task(page, 'Superficies')).toContainText(next)
    // La vuelta de este finde ya está hecha: hasta el sábado no hay otra que marcar.
    await expect(markDone(page, 'Superficies')).toHaveCount(0)

    await page.reload()
    await expect(task(page, 'Superficies')).toContainText(next)
  })

  test('una tarea de cada N días vuelve a tocar N días después del día en que la marco', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: hoy')

    await markDone(page, 'Cristales y espejos').click()

    const next = `Toca: ${formatShortDate(addDays(today(), 30))}`
    await expect(task(page, 'Cristales y espejos')).toContainText(next)
    await page.reload()
    await expect(task(page, 'Cristales y espejos')).toContainText(next)
  })

  test('una tarea puntual hecha desaparece', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Cepillar suelo')).toBeVisible()

    await markDone(page, 'Cepillar suelo').click()

    await expect(task(page, 'Cepillar suelo')).toHaveCount(0)
    await expect(task(page, 'Limpiar juntas')).toBeVisible()
    await page.reload()
    await expect(task(page, 'Limpiar juntas')).toBeVisible()
    await expect(task(page, 'Cepillar suelo')).toHaveCount(0)
  })

  test('si falla el guardado, la app lo dice y la tarea no se muestra como hecha', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')

    // Sin conexión con Supabase al guardar.
    await page.route('**/rest/v1/task_rounds*', (route) => route.abort('internetdisconnected'))
    await markDone(page, 'Baño').click()

    await expect(task(page, 'Baño').getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(markDone(page, 'Baño')).toBeEnabled()

    await page.unroute('**/rest/v1/task_rounds*')
    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
  })
})
