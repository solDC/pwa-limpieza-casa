import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, formatDayMonth, formatShortDate } from '../../src/domain/dates'
import { describeHistoryDay } from '../../src/domain/history'
import { signIn, task, todayInMadrid } from './helpers/app'
import { addPastRound, setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-53 · Cambiar cada cuánto toca una tarea (#93)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// El día lo pone la base de datos (hoy en Madrid), así que usan el reloj de verdad. Los casos
// de fechas (vuelta a medias en fin de semana, cada 15 días…) se prueban en
// tests/unit/domain/change-frequency.test.ts y tests/integration/change-task-frequency.test.ts.

function frequencyForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Frecuencia de ${taskName}` })
}

async function openFrequencyForm(page: Page, taskName: string) {
  await page.getByRole('button', { name: `Cambiar frecuencia de ${taskName}` }).click()
  await expect(frequencyForm(page, taskName)).toBeVisible()
  return frequencyForm(page, taskName)
}

/** El sábado del finde en que empieza una tarea de fin de semana cambiada hoy, sin retraso. */
function firstWeekendFromToday() {
  const today = todayInMadrid()
  const saturday = addDays(today, -((dayOfWeek(today) + 1) % 7))
  // En sábado o domingo, ese finde; entre semana, el siguiente.
  return addDays(today, -1) <= saturday ? saturday : addDays(saturday, 7)
}

/** Entra con las tareas por defecto creadas hace `days` días. */
async function signInWithTasksFrom(page: Page, days: number) {
  const email = uniqueEmail()
  await signIn(page, email)
  if (days > 0) {
    await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -days))
    await page.reload()
  }
  await expect(task(page, 'Baño')).toBeVisible()
  return email
}

test.describe('US-53 · Cambiar cada cuánto toca una tarea', () => {
  test('«Cambiar frecuencia» muestra las cuatro, con la que tiene elegida; con «Cancelar» se queda como estaba', async ({
    page,
  }) => {
    await signInWithTasksFrom(page, 0)
    const form = await openFrequencyForm(page, 'Baño')
    await expect(form.getByRole('radio')).toHaveCount(4)
    await expect(form.getByLabel('Cada N días desde la última vez')).toBeChecked()
    await expect(form.getByLabel('Cada cuántos días')).toHaveValue('3')

    await form.getByLabel('Semanal, en fin de semana').check()
    await form.getByRole('button', { name: 'Cancelar' }).click()

    await expect(frequencyForm(page, 'Baño')).toBeHidden()
    await expect(task(page, 'Baño')).toContainText('Cada 3 días desde la última vez')
    await expect(page.getByRole('button', { name: 'Cambiar frecuencia de Baño' })).toBeFocused()
  })

  test('cambio una de cada N días a semanal: muestra la frecuencia nueva y cuándo toca, sin retraso', async ({
    page,
  }) => {
    // Baño, creado hace 5 días y nunca hecho: va con retraso.
    await signInWithTasksFrom(page, 5)
    await expect(task(page, 'Baño')).toContainText('Retrasada')

    const form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Semanal, en fin de semana').check()
    await form.getByRole('button', { name: 'Guardar' }).click()

    const bathroom = task(page, 'Baño')
    await expect(bathroom).toContainText('Semanal, en fin de semana')
    await expect(bathroom).toContainText(`Toca: finde del ${formatDayMonth(firstWeekendFromToday(), 'es')}`)
    await expect(bathroom).not.toContainText('Retrasada')

    // También al volver a entrar.
    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Semanal, en fin de semana')
  })

  test('cambio solo el número de días; si nunca la he hecho, toca hoy', async ({ page }) => {
    await signInWithTasksFrom(page, 5)
    const form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Cada cuántos días').fill('7')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(task(page, 'Baño')).toContainText('Cada 7 días desde la última vez')
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
  })

  test('a cada N días, la próxima se cuenta desde la última vez que se hizo; si ya ha pasado, toca hoy', async ({
    page,
  }) => {
    const email = await signInWithTasksFrom(page, 30)
    // Superficies (semanal) se hizo hace 10 días.
    const tenDaysAgo = addDays(todayInMadrid(), -10)
    await addPastRound(email, 'Superficies', {
      startsOn: addDays(tenDaysAgo, -((dayOfWeek(tenDaysAgo) + 1) % 7)),
      dueBy: addDays(tenDaysAgo, 6 - ((dayOfWeek(tenDaysAgo) + 1) % 7)),
      completedOn: tenDaysAgo,
    })
    await page.reload()

    let form = await openFrequencyForm(page, 'Superficies')
    await form.getByLabel('Cada N días desde la última vez').check()
    await form.getByLabel('Cada cuántos días').fill('30')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${formatShortDate(addDays(tenDaysAgo, 30), 'es')}`)

    form = await openFrequencyForm(page, 'Superficies')
    await form.getByLabel('Cada cuántos días').fill('7')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Superficies')).toContainText('Toca: hoy')
  })

  test('si la vuelta en curso estaba a medias, sus partes hechas no pasan a la vuelta nueva', async ({ page }) => {
    await signInWithTasksFrom(page, 30)
    await task(page, 'Superficies').getByRole('button', { name: 'Marcar Cocina como hecha' }).click()
    await expect(task(page, 'Superficies')).toContainText('Llevas 50 %')

    const form = await openFrequencyForm(page, 'Superficies')
    await form.getByLabel('Cada N días desde la última vez').check()
    await form.getByLabel('Cada cuántos días').fill('3')
    await form.getByRole('button', { name: 'Guardar' }).click()

    const surfaces = task(page, 'Superficies')
    await expect(surfaces).toContainText('Cada 3 días desde la última vez')
    await expect(surfaces).toContainText('Llevas 0 %')
    await expect(surfaces.getByRole('button', { name: 'Marcar Cocina como hecha' })).toBeVisible()
    await page.reload()
    await expect(task(page, 'Superficies')).toContainText('Llevas 0 %')
  })

  test('una semanal hecha el finde pasado y a medias este finde, pasada a cada 7 días, no se queda con sus partes hechas', async ({
    page,
  }) => {
    const email = await signInWithTasksFrom(page, 30)
    // El finde pasado se hizo entera; este finde (o el último, entre semana), la cocina.
    const today = todayInMadrid()
    const saturday = addDays(today, -((dayOfWeek(today) + 1) % 7))
    await addPastRound(email, 'Superficies', {
      startsOn: addDays(saturday, -7),
      dueBy: addDays(saturday, -1),
      completedOn: addDays(saturday, -7),
    })
    await page.reload()
    await task(page, 'Superficies').getByRole('button', { name: 'Marcar Cocina como hecha' }).click()
    await expect(task(page, 'Superficies')).toContainText('Llevas 50 %')

    const form = await openFrequencyForm(page, 'Superficies')
    await form.getByLabel('Cada N días desde la última vez').check()
    await form.getByLabel('Cada cuántos días').fill('7')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(task(page, 'Superficies')).toContainText('Cada 7 días desde la última vez')
    await expect(task(page, 'Superficies')).toContainText('Llevas 0 %')
    await page.reload()
    await expect(task(page, 'Superficies')).toContainText('Llevas 0 %')
  })

  test('una tarea hecha hoy y pasada a puntual sigue en la lista', async ({ page }) => {
    await signInWithTasksFrom(page, 0)
    await task(page, 'Baño').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Baño')).toContainText('Toca:')

    const form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Puntual').check()
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(task(page, 'Baño')).toContainText('Puntual')
    await expect(task(page, 'Baño')).toContainText('Sin fecha')
    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Sin fecha')
  })

  test('a cada 15 días, eligiendo el primer finde; a puntual, con fecha', async ({ page }) => {
    await signInWithTasksFrom(page, 0)
    const first = firstWeekendFromToday()
    let form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Fin de semana cada 15 días').check()
    await form.getByLabel(`Finde del ${formatDayMonth(addDays(first, 7), 'es')}`).check()
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Baño')).toContainText('Fin de semana cada 15 días')
    await expect(task(page, 'Baño')).toContainText(`Toca: finde del ${formatDayMonth(addDays(first, 7), 'es')}`)

    const nextWeek = addDays(todayInMadrid(), 7)
    form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Puntual').check()
    await form.getByLabel('Fecha (opcional)').fill(nextWeek)
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Baño')).toContainText(`Toca: ${formatShortDate(nextWeek, 'es')}`)
  })

  test('las vueltas ya terminadas se conservan, y el histórico sigue mostrando las de antes con su frecuencia', async ({
    page,
  }) => {
    // Superficies (semanal), creada hace 30 días: sus findes pasados, sin hacer.
    await signInWithTasksFrom(page, 30)
    await task(page, 'Baño').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Baño')).toContainText('Toca:')

    for (const name of ['Baño', 'Superficies']) {
      const form = await openFrequencyForm(page, name)
      await form.getByLabel(name === 'Baño' ? 'Semanal, en fin de semana' : 'Cada N días desde la última vez').check()
      if (name === 'Superficies') await form.getByLabel('Cada cuántos días').fill('3')
      await form.getByRole('button', { name: 'Guardar' }).click()
      await expect(frequencyForm(page, name)).toBeHidden()
    }

    await page.getByRole('button', { name: 'Histórico' }).click()
    const today = todayInMadrid()
    const todayGroup = page.getByRole('region', { name: 'Hoy', exact: true })
    await expect(todayGroup.getByRole('listitem').filter({ hasText: 'Baño' })).toContainText('Completada')
    // El último finde pasado de Superficies, que era semanal: no completado.
    const lastFriday = addDays(today, -((dayOfWeek(today) + 2) % 7) - (dayOfWeek(today) === 5 ? 7 : 0))
    const friday = page.getByRole('region', { name: describeHistoryDay(lastFriday, today, 'es'), exact: true })
    await expect(friday.getByRole('listitem').filter({ hasText: 'Superficies' })).toContainText('No completada')
  })

  test('si falta lo que pide la frecuencia, lo dice y no guarda; sin cambiar nada, «Guardar» lo cierra', async ({
    page,
  }) => {
    await signInWithTasksFrom(page, 0)
    let form = await openFrequencyForm(page, 'Baño')
    await form.getByLabel('Cada cuántos días').fill('')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form.getByText('Escribe cada cuántos días: de 1 a 365.')).toBeVisible()
    await expect(form.getByLabel('Cada cuántos días')).toBeFocused()
    await form.getByRole('button', { name: 'Cancelar' }).click()

    form = await openFrequencyForm(page, 'Baño')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(frequencyForm(page, 'Baño')).toBeHidden()
    await expect(task(page, 'Baño')).toContainText('Cada 3 días desde la última vez')
  })
})
