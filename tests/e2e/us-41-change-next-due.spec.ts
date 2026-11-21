import { expect, test, type Page } from '@playwright/test'
import { addDays, formatShortDate } from '../../src/domain/dates'
import { newTaskForm, signIn, task, taskNames, todayInMadrid } from './helpers/app'
import { setTaskCreatedOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-41 · Cambiar cuándo toca la próxima vez (#59)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// «Hoy» es el de Madrid, con el reloj de verdad: el de la base de datos, que es quien
// rechaza un día pasado. Cuándo toca y el orden se prueban también en tests/unit/domain/
// (frequency y agenda), y las reglas de la base de datos en
// tests/integration/interval-next-due-on.test.ts.
//
// Se usa Baño, una de las tareas por defecto: cada 3 días y sin partes. Recién creada, toca hoy.

/** Un día respecto a hoy en Madrid. */
const day = (days: number) => addDays(todayInMadrid(), days)
/** «Toca: mié 25 nov», para un día que no es hoy ni mañana. */
const dueText = (days: number) => `Toca: ${formatShortDate(day(days), 'es')}`

function changeButton(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', { name: `Cambiar fecha de ${taskName}` })
}

function dateForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Fecha de ${taskName}` })
}

/** Cambia cuándo toca la próxima vez esa tarea, desde su tarjeta. */
async function changeNextDue(page: Page, taskName: string, newDay: string) {
  await changeButton(page, taskName).click()
  await dateForm(page, taskName).getByLabel('Fecha').fill(newDay)
  await dateForm(page, taskName).getByRole('button', { name: 'Guardar' }).click()
}

async function signInAs(page: Page) {
  const email = uniqueEmail()
  await signIn(page, email)
  await expect(task(page, 'Baño')).toContainText('Toca: hoy')
  return email
}

test.describe('US-41 · Cambiar cuándo toca la próxima vez', () => {
  test('puedo cambiar el día en que toca la próxima vez', async ({ page }) => {
    await signInAs(page)
    const card = task(page, 'Baño')
    await expect(changeButton(page, 'Baño')).toHaveText('Cambiar fecha')

    await changeButton(page, 'Baño').click()
    const form = dateForm(page, 'Baño')
    // Empieza con el día en que toca ahora, y siempre hay uno: no se puede quitar.
    await expect(form.getByLabel('Fecha')).toBeFocused()
    await expect(form.getByLabel('Fecha')).toHaveValue(todayInMadrid())
    await expect(form.getByRole('button', { name: 'Quitar fecha' })).toHaveCount(0)
    await form.getByLabel('Fecha').fill(day(5))
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(card).toContainText(dueText(5))
    // Al cerrarse, el foco vuelve al botón.
    await expect(changeButton(page, 'Baño')).toBeFocused()
    await page.reload()
    await expect(card).toContainText(dueText(5))

    // Se puede volver a cambiar, también a hoy.
    await changeButton(page, 'Baño').click()
    await expect(dateForm(page, 'Baño').getByLabel('Fecha')).toHaveValue(day(5))
    await dateForm(page, 'Baño').getByLabel('Fecha').fill(todayInMadrid())
    await dateForm(page, 'Baño').getByRole('button', { name: 'Guardar' }).click()
    await expect(card).toContainText('Toca: hoy')
  })

  test('una tarea retrasada, pasada a hoy o a otro día, deja de estar retrasada', async ({ page }) => {
    const email = await signInAs(page)
    // Creada hace 5 días y nunca hecha: tocaba ese día.
    await setTaskCreatedOn(email, 'Baño', day(-5))
    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Retrasada 5 días')
    await expect(taskNames(page).first()).toHaveText('Baño')

    await changeNextDue(page, 'Baño', todayInMadrid())
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(task(page, 'Baño')).not.toContainText('Retrasada')

    await changeNextDue(page, 'Baño', day(2))
    await expect(task(page, 'Baño')).toContainText(dueText(2))
    await page.reload()
    await expect(task(page, 'Baño')).toContainText(dueText(2))
  })

  test('solo se puede elegir hoy o un día futuro', async ({ page }) => {
    await signInAs(page)
    await changeButton(page, 'Baño').click()
    const form = dateForm(page, 'Baño')

    await form.getByLabel('Fecha').fill(day(-1))
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Elige hoy o un día futuro.')
    await expect(form.getByLabel('Fecha')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByLabel('Fecha')).toBeFocused()

    // Sin día tampoco: siempre tiene uno.
    await form.getByLabel('Fecha').fill('')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Elige hoy o un día futuro.')

    await page.reload()
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
  })

  test('después, las siguientes se cuentan desde el día en que se termine, como siempre', async ({ page }) => {
    await signInAs(page)
    await changeNextDue(page, 'Baño', day(5))
    await expect(task(page, 'Baño')).toContainText(dueText(5))

    // Se hace hoy, antes del día elegido: la próxima, 3 días después de hoy.
    await task(page, 'Baño').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Baño')).toContainText(dueText(3))
    await page.reload()
    await expect(task(page, 'Baño')).toContainText(dueText(3))
  })

  test('con «Cancelar», el día se queda como estaba', async ({ page }) => {
    await signInAs(page)
    await changeButton(page, 'Baño').click()
    await dateForm(page, 'Baño').getByLabel('Fecha').fill(day(5))
    await dateForm(page, 'Baño').getByRole('button', { name: 'Cancelar' }).click()

    await expect(dateForm(page, 'Baño')).toHaveCount(0)
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(changeButton(page, 'Baño')).toBeFocused()
  })

  test('al cambiar el día, las partes ya hechas se conservan', async ({ page }) => {
    await signInAs(page)
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    const form = newTaskForm(page)
    await form.getByLabel('Nombre').fill('Cocina a fondo')
    await form.getByLabel('Cada N días desde la última vez').check()
    await form.getByLabel('Cada cuántos días').fill('7')
    for (const [index, part] of ['Horno', 'Nevera'].entries()) {
      await form.getByRole('button', { name: 'Añadir parte' }).click()
      await form.getByLabel(`Parte ${index + 1}`, { exact: true }).fill(part)
    }
    await form.getByRole('button', { name: 'Guardar tarea' }).click()
    const card = task(page, 'Cocina a fondo')
    await card.getByRole('button', { name: 'Marcar Horno como hecha' }).click()
    await expect(card).toContainText('Llevas 50 %')

    await changeNextDue(page, 'Cocina a fondo', day(5))
    await expect(card).toContainText(dueText(5))
    await page.reload()
    await expect(card).toContainText(dueText(5))
    await expect(card).toContainText('Llevas 50 %')
  })

  test('las tareas de fin de semana no tienen el botón', async ({ page }) => {
    await signInAs(page)
    await expect(task(page, 'Superficies').getByRole('button', { name: /fecha/ })).toHaveCount(0)
  })

  test('si falla el guardado, la app lo dice y el día no cambia', async ({ page }) => {
    await signInAs(page)
    await page.route('**/rest/v1/rpc/set_task_next_due_on*', (route) => route.abort('internetdisconnected'))
    await changeButton(page, 'Baño').click()
    const form = dateForm(page, 'Baño')
    await form.getByLabel('Fecha').fill(day(5))
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(form.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('el botón, el formulario y el día salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Send me the code' }).click()
      await page.goto((await waitForSignInEmail(email)).link)
      const card = page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: 'Bathroom', exact: true }) })
      await expect(card).toContainText('Due: today')

      await card.getByRole('button', { name: 'Change date of Bathroom' }).click()
      const form = page.getByRole('form', { name: 'Date of Bathroom' })
      await form.getByLabel('Date').fill(day(-1))
      await form.getByRole('button', { name: 'Save' }).click()
      await expect(form).toContainText('Choose today or a later day.')

      await form.getByLabel('Date').fill(day(5))
      await form.getByRole('button', { name: 'Save' }).click()
      await expect(card).toContainText(`Due: ${formatShortDate(day(5), 'en')}`)
    })
  })
})
