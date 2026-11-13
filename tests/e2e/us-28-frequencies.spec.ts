import { expect, test } from '@playwright/test'
import { addDays, formatShortDate } from '../../src/domain/dates'
import { signIn, task, todayInMadrid } from './helpers/app'
import { setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-28 · Frecuencias (#37)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// Las reglas de cada frecuencia (plazos, años bisiestos, cambio de hora, terminar antes o
// después de tiempo) se prueban en tests/unit/domain/frequency.test.ts. Aquí se comprueba
// lo que se ve.

test.describe('US-28 · Frecuencias', () => {
  test('la primera vez, las tareas de cada N días tocan desde hoy', async ({ page }) => {
    await signIn(page, uniqueEmail())

    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: hoy')
  })

  // Necesita marcar una tarea (US-30). El día en que se hace lo pone la base de datos
  // (hoy en Madrid), así que se usa el reloj de verdad.
  test('en «cada N días», la próxima se cuenta desde el día en que se terminó', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')

    await task(page, 'Baño').getByRole('button', { name: 'Marcar como hecha' }).click()

    const inThreeDays = addDays(todayInMadrid(), 3)
    await expect(task(page, 'Baño')).toContainText(`Toca: ${formatShortDate(inThreeDays, 'es')}`)
  })

  test('las puntuales van sin fecha', async ({ page }) => {
    await signIn(page, uniqueEmail())

    for (const name of ['Cepillar suelo', 'Limpiar juntas']) {
      await expect(task(page, name)).toContainText('Sin fecha')
      await expect(task(page, name)).not.toContainText('Toca:')
    }
  })

  // Se fija la hora del navegador en un día concreto para comprobar el finde exacto, con
  // las tareas creadas antes (si no, su primera vuelta sería posterior: US-48).
  test('las de fin de semana dicen de qué finde son', async ({ page }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00')) // miércoles
    await signIn(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await page.reload()

    // Entre semana sigue siendo la vuelta del finde anterior (plazo hasta el viernes),
    // con retraso desde el lunes (US-29).
    await expect(task(page, 'Superficies')).toContainText(
      'Retrasada 3 días (tocaba el finde del 31 oct)',
    )
    // Antes del primer finde de Cati, toca el primero.
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText('Toca: finde del 5 dic')
  })

  // Regresión: en el móvil, la app puede quedarse abierta en segundo plano de un día para
  // otro. Al volver a ella, «hoy» tiene que ser el día nuevo.
  test('al volver a la app otro día, «Toca» se actualiza', async ({ page }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-11-06T22:00:00+01:00')) // viernes
    await signIn(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await page.reload()
    await expect(task(page, 'Superficies')).toContainText('tocaba el finde del 31 oct')

    await page.clock.setFixedTime(new Date('2026-11-07T09:00:00+01:00')) // sábado
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 7 nov')
  })
})
