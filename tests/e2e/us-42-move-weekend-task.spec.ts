import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, formatDayMonth } from '../../src/domain/dates'
import { openTaskParts, openTaskActions, taskActions, signIn, task, todayInMadrid } from './helpers/app'
import { setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-42 · Mover una tarea de fin de semana a otro finde (#60)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// «Hoy» es el de Madrid, con el reloj de verdad (la base de datos rechaza un finde pasado),
// así que las pruebas valen cualquier día de la semana. Para ver qué pasa después del finde
// movido, se adelanta el reloj del navegador, que es el que decide qué vuelta se muestra.
// Los casos límite, en tests/unit/domain/frequency.test.ts; las reglas de la base de datos,
// en tests/integration/move-weekend-task.test.ts.

const today = todayInMadrid()
const isWeekend = [0, 6].includes(dayOfWeek(today))
/** El sábado del finde actual: el de hoy, si es sábado o domingo; si no, el siguiente. */
const currentSaturday = (() => {
  const day = dayOfWeek(today)
  return day === 6 ? today : day === 0 ? addDays(today, -1) : addDays(today, 6 - day)
})()
/** «finde del 28 nov». */
const weekendOf = (saturday: string) => `finde del ${formatDayMonth(saturday, 'es')}`

function moveButton(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', { name: `Mover ${taskName} a otro finde` })
}

function moveForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Mover ${taskName}` })
}

/** Adelanta el reloj del navegador a ese día (a mediodía en Madrid) y vuelve a cargar. */
async function goTo(page: Page, day: string) {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00+01:00`))
  await page.reload()
}

/** Mueve la tarea al finde que empieza ese sábado, desde su tarjeta. */
async function moveTo(page: Page, taskName: string, saturday: string) {
  await openTaskActions(task(page, taskName))
  await moveButton(page, taskName).click()
  await moveForm(page, taskName).getByLabel('Mover al finde del').selectOption(saturday)
  await moveForm(page, taskName).getByRole('button', { name: 'Guardar' }).click()
}

/** Entra con una cuenta nueva cuyas tareas se crearon hace 4 semanas (con su vuelta en curso). */
async function signInWithOldTasks(page: Page) {
  const email = uniqueEmail()
  await signIn(page, email)
  await setAllTasksCreatedOn(email, addDays(today, -28))
  await page.reload()
  return email
}

test.describe('US-42 · Mover una tarea de fin de semana a otro finde', () => {
  test('puedo mover una semanal a otro finde, a partir del actual', async ({ page }) => {
    await signIn(page, uniqueEmail())
    const card = task(page, 'Superficies')
    // Recién creada, toca el finde actual (US-48).
    await expect(card).toContainText(`Toca: ${weekendOf(currentSaturday)}`)
    await openTaskActions(task(page, 'Superficies'))
    await expect(moveButton(page, 'Superficies')).toHaveText('Mover a otro finde')

    await openTaskActions(task(page, 'Superficies'))
    await moveButton(page, 'Superficies').click()
    const field = moveForm(page, 'Superficies').getByLabel('Mover al finde del')
    await expect(field).toBeFocused()
    // Los 8 próximos, sin el que ya se muestra.
    const options = field.getByRole('option')
    await expect(options).toHaveCount(8)
    await expect(options.first()).toHaveText(weekendOf(addDays(currentSaturday, 7)))
    await field.selectOption(addDays(currentSaturday, 14))
    await moveForm(page, 'Superficies').getByRole('button', { name: 'Guardar' }).click()

    await expect(card).toContainText(`Toca: ${weekendOf(addDays(currentSaturday, 14))}`)
    await expect(taskActions(task(page, 'Superficies'))).toBeFocused()
    await page.reload()
    await expect(card).toContainText(`Toca: ${weekendOf(addDays(currentSaturday, 14))}`)
  })

  test('una semanal con retraso, movida, deja de estar retrasada', async ({ page }) => {
    await signInWithOldTasks(page)
    const card = task(page, 'Superficies')
    // Entre semana va con retraso; en sábado o domingo, toca este finde.
    await expect(card).toContainText(isWeekend ? `Toca: ${weekendOf(currentSaturday)}` : 'Retrasada')

    const target = isWeekend ? addDays(currentSaturday, 7) : currentSaturday
    await moveTo(page, 'Superficies', target)
    await expect(card).toContainText(`Toca: ${weekendOf(target)}`)
    await expect(card).not.toContainText('Retrasada')
  })

  test('en las de cada 15 días se mueve todo el calendario', async ({ page }) => {
    await signIn(page, uniqueEmail())
    const card = task(page, 'Aspirar cosas de Cati')
    await expect(card).toContainText('Toca: finde del')

    // A un finde que no está en su calendario de antes: una semana después del que muestra.
    await openTaskActions(task(page, 'Aspirar cosas de Cati'))
    await moveButton(page, 'Aspirar cosas de Cati').click()
    const field = moveForm(page, 'Aspirar cosas de Cati').getByLabel('Mover al finde del')
    const shown = await card.locator('.due').textContent()
    const values = await field.getByRole('option').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value),
    )
    const target = values.find((value) => !shown?.endsWith(weekendOf(value)))!
    await field.selectOption(target)
    await moveForm(page, 'Aspirar cosas de Cati').getByRole('button', { name: 'Guardar' }).click()

    await expect(card).toContainText(`Toca: ${weekendOf(target)}`)
    await page.reload()
    await expect(card).toContainText(`Toca: ${weekendOf(target)}`)
  })

  test('en las semanales solo se mueve esa vuelta: las siguientes siguen siendo cada finde', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    const moved = addDays(currentSaturday, 14)
    await moveTo(page, 'Superficies', moved)
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(moved)}`)

    // Ese finde toca; el siguiente, otra vez (cada finde, no cada 14 días).
    await goTo(page, moved)
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(moved)}`)
    await goTo(page, addDays(moved, 7))
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(addDays(moved, 7))}`)
    await goTo(page, addDays(moved, 14))
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(addDays(moved, 14))}`)
  })

  test('en las de cada 15 días, las siguientes son cada 15 días desde el finde nuevo', async ({ page }) => {
    await signIn(page, uniqueEmail())
    // Un finde que no estaba en su calendario: el de su vuelta más una semana.
    const shown = await task(page, 'Aspirar cosas de Cati').locator('.due').textContent()
    await openTaskActions(task(page, 'Aspirar cosas de Cati'))
    await moveButton(page, 'Aspirar cosas de Cati').click()
    const values = await moveForm(page, 'Aspirar cosas de Cati')
      .getByLabel('Mover al finde del')
      .getByRole('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
    const moved = values.find((value) => shown?.endsWith(weekendOf(addDays(value, -7))))!
    await moveForm(page, 'Aspirar cosas de Cati').getByLabel('Mover al finde del').selectOption(moved)
    await moveForm(page, 'Aspirar cosas de Cati').getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText(`Toca: ${weekendOf(moved)}`)

    // Ese finde toca; el siguiente no (se ve ya el de 15 días después), y ese, sí.
    await goTo(page, moved)
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText(`Toca: ${weekendOf(moved)}`)
    await goTo(page, addDays(moved, 8)) // el domingo siguiente, ya sin hacer la del finde movido
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText(`Toca: ${weekendOf(addDays(moved, 14))}`)
    await goTo(page, addDays(moved, 14))
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText(`Toca: ${weekendOf(addDays(moved, 14))}`)
  })

  test('si la vuelta tenía partes hechas, la vuelta movida empieza con todas por hacer', async ({ page }) => {
    await signInWithOldTasks(page)
    const card = task(page, 'Superficies')
    await openTaskParts(card)
    await card.getByRole('button', { name: 'Marcar Cocina como hecha' }).click()
    await expect(card).toContainText('Llevas')

    await moveTo(page, 'Superficies', addDays(currentSaturday, 7))
    await expect(card).toContainText(`Toca: ${weekendOf(addDays(currentSaturday, 7))}`)
    // La vuelta movida aún no ha empezado: sin progreso y sin partes hechas.
    await expect(card).not.toContainText('Llevas')
    await expect(card.getByRole('button', { name: 'Hecha' })).toHaveCount(0)
    await page.reload()
    await expect(card.getByRole('button', { name: 'Hecha' })).toHaveCount(0)
  })

  test('con «Cancelar», se queda como estaba', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await openTaskActions(task(page, 'Superficies'))
    await moveButton(page, 'Superficies').click()
    await moveForm(page, 'Superficies').getByLabel('Mover al finde del').selectOption(addDays(currentSaturday, 14))
    await moveForm(page, 'Superficies').getByRole('button', { name: 'Cancelar' }).click()

    await expect(moveForm(page, 'Superficies')).toHaveCount(0)
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(currentSaturday)}`)
    await expect(taskActions(task(page, 'Superficies'))).toBeFocused()
  })

  test('solo las de fin de semana tienen el botón', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await openTaskActions(task(page, 'Aspirar cosas de Cati'))
    await expect(moveButton(page, 'Aspirar cosas de Cati')).toBeVisible()
    for (const name of ['Baño', 'Cristales y espejos', 'Cepillar suelo']) {
      await expect(task(page, name).getByRole('button', { name: /otro finde/ })).toHaveCount(0)
    }
  })

  test('si falla el guardado, la app lo dice y no se mueve', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/move_weekend_task*', (route) => route.abort('internetdisconnected'))
    await moveTo(page, 'Superficies', addDays(currentSaturday, 14))

    const form = moveForm(page, 'Superficies')
    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(task(page, 'Superficies')).toContainText(`Toca: ${weekendOf(currentSaturday)}`)
    await expect(form.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('el botón, el formulario y los findes salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.goto((await waitForSignInEmail(email)).link)
      const card = page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: 'Surfaces', exact: true }) })

      await openTaskActions(card)
      await card.getByRole('button', { name: 'Move Surfaces to another weekend' }).click()
      const form = page.getByRole('form', { name: 'Move Surfaces' })
      const saturday = addDays(currentSaturday, 14)
      await expect(form.getByLabel('Move to the weekend of').getByRole('option').first()).toHaveText(
        `weekend of ${formatDayMonth(addDays(currentSaturday, 7), 'en')}`,
      )
      await form.getByLabel('Move to the weekend of').selectOption(saturday)
      await form.getByRole('button', { name: 'Save' }).click()
      await expect(card).toContainText(`Due: weekend of ${formatDayMonth(saturday, 'en')}`)
    })
  })
})
