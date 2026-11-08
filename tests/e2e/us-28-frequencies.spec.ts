import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-28 · Frecuencias (#37)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// Las reglas de cada frecuencia (plazos, años bisiestos, cambio de hora, terminar antes o
// después de tiempo) se prueban en tests/unit/domain/frequency.test.ts. Aquí se comprueba
// lo que se ve.
//
// PENDIENTE PARA LA US-30: «cada N días cuenta desde que se terminó» solo se puede ver
// cuando se pueda marcar una tarea. La US-30 debe añadir aquí una prueba: marcar el Baño
// hoy y comprobar que dice «Toca:» con la fecha de dentro de 3 días.

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

test.describe('US-28 · Frecuencias', () => {
  test('la primera vez, las tareas de cada N días tocan desde hoy', async ({ page }) => {
    await signIn(page, uniqueEmail())

    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: hoy')
  })

  test('las puntuales van sin fecha', async ({ page }) => {
    await signIn(page, uniqueEmail())

    for (const name of ['Cepillar suelo', 'Limpiar juntas']) {
      await expect(task(page, name)).toContainText('Sin fecha')
      await expect(task(page, name)).not.toContainText('Toca:')
    }
  })

  // Se fija la hora del navegador en un día concreto para comprobar el finde exacto.
  // Las de fin de semana no dependen del día en que se crearon las tareas.
  test('las de fin de semana dicen de qué finde son', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00')) // miércoles
    await signIn(page, uniqueEmail())

    // Entre semana sigue siendo la vuelta del finde anterior (plazo hasta el viernes).
    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 31 oct')
    // Antes del primer finde de Cati, toca el primero.
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText('Toca: finde del 5 dic')
  })

  // Regresión: en el móvil, la app puede quedarse abierta en segundo plano de un día para
  // otro. Al volver a ella, «hoy» tiene que ser el día nuevo.
  test('al volver a la app otro día, «Toca» se actualiza', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-06T22:00:00+01:00')) // viernes
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 31 oct')

    await page.clock.setFixedTime(new Date('2026-11-07T09:00:00+01:00')) // sábado
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 7 nov')
  })
})
