import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, formatDayMonth, formatShortDate } from '../../src/domain/dates'
import { newTaskForm, signIn, task, taskParts, todayInMadrid } from './helpers/app'
import { setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-39 · Marcar una parte como hecha (#57)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// El día lo apunta la base de datos (hoy en Madrid), así que usan el reloj de verdad, como
// las de la US-30. El progreso se prueba también en tests/unit/domain/progress.test.ts, y
// que la base de datos termina la vuelta con la última parte (y que la app no elige el peso
// ni el día), en tests/integration/task-part-completions.test.ts.

function markPart(page: Page, taskName: string, part: string) {
  return task(page, taskName).getByRole('button', { name: `Marcar ${part} como hecha` })
}

function markAll(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', { name: 'Marcar todo como hecho' })
}

/**
 * Entra con «Superficies» (Cocina 50 %, Salón 25 %, Dormitorio 25 %) en una vuelta que se
 * puede marcar: creada hace un mes, porque si fuera de hoy y hoy es entre semana, su primera
 * vuelta sería el sábado siguiente (US-48).
 */
async function signInWithSurfaces(page: Page) {
  const email = uniqueEmail()
  await signIn(page, email)
  await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -30))
  await page.reload()
  await expect(markPart(page, 'Superficies', 'Cocina')).toBeVisible()
}

/** Añade una tarea con dos partes, Horno (60 %) y Nevera (40 %), con esa frecuencia. */
async function addTaskWithParts(page: Page, name: string, frequency: 'Puntual' | 'Cada N días desde la última vez') {
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  const form = newTaskForm(page)
  await form.getByLabel('Nombre').fill(name)
  await form.getByLabel(frequency).check()
  if (frequency !== 'Puntual') await form.getByLabel('Cada cuántos días').fill('7')
  for (const [index, part] of ['Horno', 'Nevera'].entries()) {
    await form.getByRole('button', { name: 'Añadir parte' }).click()
    await form.getByLabel(`Parte ${index + 1}`, { exact: true }).fill(part)
  }
  await form.getByLabel('Peso de la parte 1', { exact: true }).fill('60')
  await form.getByLabel('Peso de la parte 2', { exact: true }).fill('40')
  await form.getByRole('button', { name: 'Guardar tarea' }).click()
  await expect(task(page, name)).toBeVisible()
}

function nextWeekend() {
  const saturday = addDays(todayInMadrid(), -((dayOfWeek(todayInMadrid()) + 1) % 7))
  return `Toca: finde del ${formatDayMonth(addDays(saturday, 7), 'es')}`
}

test.describe('US-39 · Marcar una parte como hecha', () => {
  test('marco cada parte por separado y veo lo que llevo de la vuelta, también al volver a entrar', async ({
    page,
  }) => {
    await signInWithSurfaces(page)
    const surfaces = task(page, 'Superficies')
    await expect(surfaces).toContainText('Llevas 0 %')

    await markPart(page, 'Superficies', 'Cocina').click()

    await expect(surfaces).toContainText('Llevas 50 %')
    await expect(taskParts(surfaces)).toContainText([
      'Cocina 50 % · hecha',
      'Salón 25 %',
      'Dormitorio 25 %',
    ])
    // La parte hecha ya no se puede marcar; las otras, sí.
    await expect(markPart(page, 'Superficies', 'Cocina')).toHaveCount(0)
    await expect(markPart(page, 'Superficies', 'Salón')).toBeVisible()

    await page.reload()
    await expect(surfaces).toContainText('Llevas 50 %')
    await expect(taskParts(surfaces).first()).toContainText('Cocina 50 % · hecha')

    await markPart(page, 'Superficies', 'Dormitorio').click()
    await expect(surfaces).toContainText('Llevas 75 %')
  })

  test('al marcar todas las partes, la vuelta queda completada', async ({ page }) => {
    await signInWithSurfaces(page)
    const surfaces = task(page, 'Superficies')

    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(surfaces).toContainText('Llevas 50 %')
    await markPart(page, 'Superficies', 'Salón').click()
    await expect(surfaces).toContainText('Llevas 75 %')
    await markPart(page, 'Superficies', 'Dormitorio').click()

    // Como al marcar una tarea entera (US-30): pasa al finde siguiente, que aún no se puede marcar.
    await expect(surfaces).toContainText(nextWeekend())
    await expect(surfaces.getByRole('button')).toHaveCount(0)
    await expect(surfaces).not.toContainText('Llevas')
    await expect(taskParts(surfaces)).toContainText(['Cocina 50 %', 'Salón 25 %', 'Dormitorio 25 %'])
    await expect(surfaces).not.toContainText('hecha')

    await page.reload()
    await expect(surfaces).toContainText(nextWeekend())
    await expect(surfaces.getByRole('button')).toHaveCount(0)
  })

  test('con «Marcar todo como hecho» marco de una vez las partes que faltan', async ({ page }) => {
    await signInWithSurfaces(page)
    const surfaces = task(page, 'Superficies')
    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(surfaces).toContainText('Llevas 50 %')

    await markAll(page, 'Superficies').click()

    await expect(surfaces).toContainText(nextWeekend())
    await page.reload()
    await expect(surfaces).toContainText(nextWeekend())
  })

  // Al marcar una parte, su botón desaparece: el foco no se pierde (teclado y VoiceOver).
  test('al marcar una parte, el foco pasa a la siguiente por hacer y, al terminar, al nombre de la tarea', async ({
    page,
  }) => {
    await signInWithSurfaces(page)

    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(markPart(page, 'Superficies', 'Salón')).toBeFocused()
    await markPart(page, 'Superficies', 'Dormitorio').click()
    await expect(markPart(page, 'Superficies', 'Salón')).toBeFocused()
    await markPart(page, 'Superficies', 'Salón').click()

    await expect(task(page, 'Superficies')).toContainText(nextWeekend())
    await expect(page.getByRole('heading', { level: 3, name: 'Superficies' })).toBeFocused()
  })

  test('con una sola parte por hacer, basta su botón: no hay «Marcar todo como hecho»', async ({
    page,
  }) => {
    await signInWithSurfaces(page)
    await expect(markAll(page, 'Superficies')).toBeVisible()
    await markPart(page, 'Superficies', 'Cocina').click()
    await markPart(page, 'Superficies', 'Salón').click()

    await expect(task(page, 'Superficies')).toContainText('Llevas 75 %')
    await expect(markAll(page, 'Superficies')).toHaveCount(0)
    await expect(markPart(page, 'Superficies', 'Dormitorio')).toBeVisible()
  })

  test('en una tarea de cada N días, al marcar todas las partes vuelve a tocar N días después', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await addTaskWithParts(page, 'Cocina a fondo', 'Cada N días desde la última vez')
    const kitchen = task(page, 'Cocina a fondo')

    await markPart(page, 'Cocina a fondo', 'Horno').click()
    await expect(kitchen).toContainText('Llevas 60 %')
    await expect(kitchen).toContainText('Toca: hoy')
    await markPart(page, 'Cocina a fondo', 'Nevera').click()

    const next = `Toca: ${formatShortDate(addDays(todayInMadrid(), 7), 'es')}`
    await expect(kitchen).toContainText(next)
    // Ya está hecha hoy: las partes de la vuelta siguiente no se marcan el mismo día.
    await expect(kitchen.getByRole('button')).toHaveCount(0)
    await page.reload()
    await expect(kitchen).toContainText(next)
  })

  test('una tarea puntual desaparece al marcar su última parte', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await addTaskWithParts(page, 'Cocina a fondo', 'Puntual')

    await markPart(page, 'Cocina a fondo', 'Nevera').click()
    await expect(task(page, 'Cocina a fondo')).toContainText('Llevas 40 %')
    await page.reload()
    await expect(task(page, 'Cocina a fondo')).toContainText('Llevas 40 %')
    await markPart(page, 'Cocina a fondo', 'Horno').click()

    await expect(task(page, 'Cocina a fondo')).toHaveCount(0)
    await page.reload()
    await expect(task(page, 'Baño')).toBeVisible()
    await expect(task(page, 'Cocina a fondo')).toHaveCount(0)
  })

  test('antes de que empiece su vuelta, las partes se ven pero no se pueden marcar', async ({ page }) => {
    await signInWithSurfaces(page)
    await markAll(page, 'Superficies').click()

    // El finde siguiente aún no ha empezado.
    const surfaces = task(page, 'Superficies')
    await expect(surfaces).toContainText(nextWeekend())
    await expect(taskParts(surfaces)).toHaveCount(3)
    await expect(surfaces.getByRole('button')).toHaveCount(0)
  })

  test('si falla el guardado, la app lo dice y la parte no se muestra como hecha', async ({ page }) => {
    await signInWithSurfaces(page)
    const surfaces = task(page, 'Superficies')

    // Sin conexión con Supabase al guardar.
    await page.route('**/rest/v1/task_part_completions*', (route) => route.abort('internetdisconnected'))
    await markPart(page, 'Superficies', 'Cocina').click()

    await expect(surfaces.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(surfaces).toContainText('Llevas 0 %')
    await expect(surfaces).not.toContainText('hecha')
    await expect(markPart(page, 'Superficies', 'Cocina')).toBeEnabled()

    await page.unroute('**/rest/v1/task_part_completions*')
    await page.reload()
    await expect(surfaces).toContainText('Llevas 0 %')
    await expect(markPart(page, 'Superficies', 'Cocina')).toBeVisible()
  })

  test('si Supabase da un error al marcarlo todo, la app lo dice y no se marca ninguna parte', async ({
    page,
  }) => {
    await signInWithSurfaces(page)
    const surfaces = task(page, 'Superficies')

    await page.route('**/rest/v1/task_part_completions*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'XX000', message: 'Error interno', details: null, hint: null }),
      }),
    )
    await markAll(page, 'Superficies').click()

    await expect(surfaces.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(surfaces).toContainText('Llevas 0 %')
    await expect(markAll(page, 'Superficies')).toBeEnabled()
  })

  // Dos dispositivos (aquí, dos pestañas) con la lista abierta.
  test('si la parte ya se había marcado en otro dispositivo, la app lo dice y la muestra al día', async ({
    page,
    context,
  }) => {
    await signInWithSurfaces(page)
    const other = await context.newPage()
    await other.goto('/')
    await expect(markPart(other, 'Superficies', 'Cocina')).toBeVisible()

    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(task(page, 'Superficies')).toContainText('Llevas 50 %')

    await markPart(other, 'Superficies', 'Cocina').click()
    await expect(task(other, 'Superficies').getByRole('alert')).toHaveText('Ya estaba marcada como hecha.')
    await expect(task(other, 'Superficies')).toContainText('Llevas 50 %')
    await expect(markPart(other, 'Superficies', 'Cocina')).toHaveCount(0)
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('las partes, el progreso y los botones salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Send me the code' }).click()
      await page.goto((await waitForSignInEmail(email)).link)
      await expect(page.getByRole('list', { name: 'Your tasks' })).toBeVisible()
      await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -30))
      await page.reload()
      const surfaces = page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: 'Surfaces', exact: true }) })

      await expect(surfaces).toContainText('0 % done')
      await surfaces.getByRole('button', { name: 'Mark Kitchen as done' }).click()

      await expect(surfaces).toContainText('50 % done')
      await expect(taskParts(surfaces)).toContainText([
        'Kitchen 50 % · done',
        'Living room 25 %',
        'Bedroom 25 %',
      ])
      await expect(surfaces.getByRole('button', { name: 'Mark all as done' })).toBeVisible()
    })
  })
})
