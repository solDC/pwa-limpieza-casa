import { expect, test, type Page } from '@playwright/test'
import { signIn, task } from './helpers/app'
import { setAllTasksCreatedOn, setTaskCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-48 · Las tareas nuevas no empiezan con retraso (#71)
//
// Necesitan Supabase en local (npx supabase start). El reloj del navegador se fija en el
// día de la prueba, y el día en que se crearon las tareas se cambia en la base de datos
// (helpers/database.ts). Los casos límite se prueban en tests/unit/domain/frequency.test.ts.

/** Entra con un usuario nuevo el día `today` (en Madrid, a mediodía). */
async function signInOn(page: Page, today: string): Promise<string> {
  const email = uniqueEmail()
  await page.clock.setFixedTime(new Date(`${today}T12:00:00+01:00`))
  await signIn(page, email)
  return email
}

test.describe('US-48 · Las tareas nuevas no empiezan con retraso', () => {
  test('una tarea de fin de semana creada de lunes a viernes empieza el sábado siguiente, sin retraso', async ({
    page,
  }) => {
    const email = await signInOn(page, '2026-11-11') // miércoles
    await setTaskCreatedOn(email, 'Superficies', '2026-11-11')
    await page.reload()

    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 14 nov')
    await expect(task(page, 'Superficies')).not.toContainText('Retrasada')
  })

  test('creada en sábado o domingo, toca ese mismo fin de semana', async ({ page }) => {
    const email = await signInOn(page, '2026-11-15') // domingo
    await setTaskCreatedOn(email, 'Superficies', '2026-11-15')
    await page.reload()

    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 14 nov')
    await expect(task(page, 'Superficies')).not.toContainText('Retrasada')
  })

  test('en las de cada 15 días, la primera vuelta es la primera de su calendario desde el día en que se crea', async ({
    page,
  }) => {
    // «Aspirar cosas de Cati» toca un finde sí y otro no desde el 5 de diciembre de 2026.
    const email = await signInOn(page, '2026-12-09') // miércoles, después de un finde que tocaba
    await setTaskCreatedOn(email, 'Aspirar cosas de Cati', '2026-12-09')
    await page.reload()

    await expect(task(page, 'Aspirar cosas de Cati')).toContainText('Toca: finde del 19 dic')
    await expect(task(page, 'Aspirar cosas de Cati')).not.toContainText('Retrasada')
  })

  test('si alguien se da de alta entre semana, sus tareas por defecto de fin de semana no salen retrasadas', async ({
    page,
  }) => {
    const email = await signInOn(page, '2026-12-10') // jueves
    await setAllTasksCreatedOn(email, '2026-12-10')
    await page.reload()

    await expect(task(page, 'Superficies')).toContainText('Toca: finde del 12 dic')
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText('Toca: finde del 19 dic')
    await expect(page.getByRole('list', { name: 'Tus tareas' })).not.toContainText('Retrasada')
  })
})
