import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek } from '../../src/domain/dates'
import { describeHistoryDay, describeWeekendDays } from '../../src/domain/history'
import { signIn, task, todayInMadrid } from './helpers/app'
import { addPastPartCompletions, setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-31 · Histórico de cada vuelta (#40)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// El día lo apunta la base de datos (hoy en Madrid), así que usan el reloj de verdad. Qué
// vueltas salen y en qué día, con todos los casos (findes movidos, cada 15 días, a medias sin
// plazo…), se prueba en tests/unit/domain/history.test.ts.

/** El sábado de la vuelta de fin de semana anterior a la de hoy, y el viernes en que acabó. */
function previousWeekend() {
  const today = todayInMadrid()
  const saturday = addDays(today, -((dayOfWeek(today) + 1) % 7) - 7)
  return { saturday, friday: addDays(saturday, 6) }
}

/** El grupo de un día del histórico, por su título («Hoy», «Ayer», «Viernes 20 de noviembre»). */
function historyDay(page: Page, day: string) {
  return page.getByRole('region', { name: describeHistoryDay(day, todayInMadrid(), 'es'), exact: true })
}

/** Una vuelta del histórico, en el día en que sale, por el nombre de la tarea. */
function historyEntry(page: Page, day: string, taskName: string) {
  return historyDay(page, day).getByRole('listitem').filter({ hasText: taskName })
}

/** Los títulos de los días del histórico, en el orden en que salen. */
function dayHeadings(page: Page) {
  return page.getByRole('region', { name: 'Histórico', exact: true }).getByRole('heading', { level: 3 })
}

async function openHistory(page: Page) {
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Histórico' })).toBeVisible()
}

/** Entra con las tareas por defecto creadas hace `days` días: así ya tienen vueltas pasadas. */
async function signInWithTasksFrom(page: Page, days: number) {
  const email = uniqueEmail()
  await signIn(page, email)
  await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -days))
  await page.reload()
  await expect(task(page, 'Superficies')).toBeVisible()
  return email
}

test.describe('US-31 · Histórico de cada vuelta', () => {
  test('«Histórico», en «Tus tareas», abre una pantalla aparte, y «Volver» vuelve a las tareas', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await openHistory(page)
    await expect(page.getByRole('list', { name: 'Tus tareas' })).toBeHidden()
    // Con las tareas recién creadas, aún no hay nada.
    await expect(page.getByText('Aún no hay nada en el histórico.')).toBeVisible()

    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(task(page, 'Superficies')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeFocused()
  })

  test('lo que marco como hecho sale como completado, el día en que lo hice: también las puntuales, que desaparecen de la lista', async ({
    page,
  }) => {
    await signInWithTasksFrom(page, 30)
    await task(page, 'Baño').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Baño')).toContainText('Toca:')
    await task(page, 'Superficies').getByRole('button', { name: 'Marcar todo como hecho' }).click()
    await expect(task(page, 'Superficies').getByRole('button', { name: 'Marcar todo como hecho' })).toBeHidden()
    await task(page, 'Cepillar suelo').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Cepillar suelo')).toBeHidden()

    await openHistory(page)
    const today = todayInMadrid()
    await expect(dayHeadings(page).first()).toHaveText('Hoy')
    await expect(historyDay(page, today).getByRole('listitem')).toHaveText([
      /^Superficies\s*Completada$/,
      /^Baño\s*Completada$/,
      /^Cepillar suelo\s*Completada$/,
    ])
  })

  test('una vuelta de fin de semana que pasa de su plazo sale como parcial, con su %, o como no completada, el viernes y con su finde', async ({
    page,
  }) => {
    const email = await signInWithTasksFrom(page, 30)
    // El finde pasado, solo la cocina (50 %) de Superficies.
    await addPastPartCompletions(email, 'Superficies', ['Cocina'], 1)
    await openHistory(page)

    const { saturday, friday } = previousWeekend()
    const partial = historyEntry(page, friday, 'Superficies')
    await expect(partial).toContainText('Parcial (50 %)')
    await expect(partial).toContainText(describeWeekendDays(saturday, 'es'))

    // El finde anterior, nada.
    const notCompleted = historyEntry(page, addDays(friday, -7), 'Superficies')
    await expect(notCompleted).toContainText('No completada')
    await expect(notCompleted).toContainText(describeWeekendDays(addDays(saturday, -7), 'es'))

    // La vuelta en curso sigue en la lista, no en el histórico, aunque vaya con retraso.
    await expect(historyDay(page, addDays(friday, 7))).toBeHidden()
  })

  test('sale lo de las últimas 4 semanas, de lo más reciente a lo más antiguo, y «Ver más» carga 4 semanas más', async ({
    page,
  }) => {
    await signInWithTasksFrom(page, 60)
    await openHistory(page)

    const { friday } = previousWeekend()
    const today = todayInMadrid()
    // Los viernes de las vueltas de Superficies que no hice, de las últimas 4 semanas.
    const shown = [0, 1, 2, 3].map((week) => addDays(friday, -7 * week)).filter((day) => day > addDays(today, -28))
    await expect(dayHeadings(page)).toHaveText(
      shown.map((day) => describeHistoryDay(day, today, 'es')),
    )
    const older = addDays(shown[shown.length - 1], -7)
    await expect(historyDay(page, older)).toBeHidden()

    await page.getByRole('button', { name: 'Ver más' }).click()
    await expect(historyEntry(page, older, 'Superficies')).toContainText('No completada')
    await expect(dayHeadings(page).first()).toHaveText(
      describeHistoryDay(shown[0], today, 'es'),
    )
  })
})
