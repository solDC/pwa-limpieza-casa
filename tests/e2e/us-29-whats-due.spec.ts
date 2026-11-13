import { expect, test, type Page } from '@playwright/test'
import { signIn, task, taskNames } from './helpers/app'
import { setAllTasksCreatedOn, setTaskCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-29 · Qué toca (#38)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas y preparan
// en la base de datos tareas creadas hace días (helpers/database.ts).
//
// El reloj del navegador se fija en días anteriores a hoy: aquí no se marca nada, así
// que la fecha de la base de datos no importa. Los casos límite (fin de mes, cambio de
// hora, años bisiestos) se prueban en tests/unit/domain/agenda.test.ts.

/** Fija el día (en Madrid, a mediodía) y vuelve a cargar la app. */
async function setToday(page: Page, day: string) {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00+01:00`))
  await page.reload()
}

test.describe('US-29 · Qué toca', () => {
  test('las retrasadas dicen cuántos días de retraso llevan y salen primero, por orden', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-10-28T12:00:00+01:00')) // un miércoles
    await signIn(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await setTaskCreatedOn(email, 'Baño', '2026-10-26')
    await setTaskCreatedOn(email, 'Cristales y espejos', '2026-10-28')
    await page.reload()

    await expect(task(page, 'Superficies')).toContainText(
      'Retrasada 3 días (tocaba el finde del 24 oct)',
    )
    await expect(task(page, 'Baño')).toContainText('Retrasada 2 días (tocaba el lun 26 oct)')
    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: hoy')
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText('Toca: finde del 5 dic')

    await expect(taskNames(page)).toHaveText([
      'Superficies',
      'Baño',
      'Cristales y espejos',
      'Cepillar suelo',
      'Limpiar juntas',
      'Aspirar cosas de Cati',
    ])
  })

  test('las de fin de semana tocan sábado y domingo, van con retraso de lunes a viernes y el sábado empieza otra vuelta', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00+01:00')) // sábado
    await signIn(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await page.reload()
    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 31 oct')
    await expect(task(page, 'Superficies')).not.toContainText('Retrasada')

    await setToday(page, '2026-11-01') // domingo
    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 31 oct')
    await expect(task(page, 'Superficies')).not.toContainText('Retrasada')

    await setToday(page, '2026-11-02') // lunes
    await expect(task(page, 'Superficies')).toContainText(
      'Retrasada 1 día (tocaba el finde del 31 oct)',
    )

    await setToday(page, '2026-11-06') // viernes
    await expect(task(page, 'Superficies')).toContainText(
      'Retrasada 5 días (tocaba el finde del 31 oct)',
    )

    await setToday(page, '2026-11-07') // sábado: vuelta nueva
    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 7 nov')
    await expect(task(page, 'Superficies')).not.toContainText('Retrasada')
  })

  test('en las de cada N días, el retraso cuenta desde el día siguiente; las puntuales nunca van con retraso', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-10-27T12:00:00+01:00'))
    await signIn(page, email)
    await setTaskCreatedOn(email, 'Baño', '2026-10-27')
    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')

    await setToday(page, '2026-10-28')
    await expect(task(page, 'Baño')).toContainText('Retrasada 1 día (tocaba el mar 27 oct)')

    // Una puntual creada hace casi dos años sigue sin fecha y sin retraso.
    await setTaskCreatedOn(email, 'Cepillar suelo', '2025-01-01')
    await page.reload()
    for (const name of ['Cepillar suelo', 'Limpiar juntas']) {
      await expect(task(page, name)).toContainText('Sin fecha')
      await expect(task(page, name)).not.toContainText('Retrasada')
    }
  })

  test('las que tocan más adelante salen al final, por fecha', async ({ page }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-10-28T12:00:00+01:00')) // un miércoles
    await signIn(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await setTaskCreatedOn(email, 'Cristales y espejos', '2026-10-30')
    await setTaskCreatedOn(email, 'Baño', '2026-12-10')
    await page.reload()

    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: vie 30 oct')
    await expect(task(page, 'Baño')).toContainText('Toca: jue 10 dic')
    await expect(taskNames(page)).toHaveText([
      'Superficies',
      'Cepillar suelo',
      'Limpiar juntas',
      'Cristales y espejos', // 30 oct
      'Aspirar cosas de Cati', // 5 dic
      'Baño', // 10 dic
    ])
  })
})
