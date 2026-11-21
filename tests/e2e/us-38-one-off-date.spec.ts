import { expect, test, type Page } from '@playwright/test'
import { addDays, formatShortDate } from '../../src/domain/dates'
import { newTaskForm, signIn, task, taskNames, todayInMadrid } from './helpers/app'
import { completeOneOffTask, setTaskDueOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-38 · Poner fecha a una tarea puntual (#54)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// «Hoy» es el de Madrid, con el reloj de verdad: el de la base de datos, que es quien
// rechaza una fecha pasada. Cuándo toca y el orden se prueban también en
// tests/unit/domain/ (frequency, agenda y new-task), y las reglas de la base de datos en
// tests/integration/one-off-due-on.test.ts.

/** Un día respecto a hoy en Madrid. */
const day = (days: number) => addDays(todayInMadrid(), days)
/** «Toca: mié 25 nov», para un día que no es hoy ni mañana. */
const dueText = (days: number) => `Toca: ${formatShortDate(day(days), 'es')}`

function dueOnButton(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', {
    name: new RegExp(`^(Poner fecha a|Cambiar la fecha de) ${taskName}$`),
  })
}

function dueOnForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Fecha de ${taskName}` })
}

/** Abre el formulario «Nueva tarea» con una puntual con ese nombre (sin guardarla). */
async function fillNewOneOff(page: Page, name: string, dueOn?: string) {
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  const form = newTaskForm(page)
  await form.getByLabel('Nombre').fill(name)
  await form.getByLabel('Puntual').check()
  if (dueOn) await form.getByLabel('Fecha (opcional)').fill(dueOn)
}

async function signInAs(page: Page) {
  const email = uniqueEmail()
  await signIn(page, email)
  await expect(task(page, 'Cepillar suelo')).toContainText('Sin fecha')
  return email
}

test.describe('US-38 · Poner fecha a una tarea puntual', () => {
  test('al añadir una puntual puedo ponerle fecha; si no, queda «Sin fecha»', async ({ page }) => {
    await signInAs(page)

    await fillNewOneOff(page, 'Limpiar el horno', day(5))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Limpiar el horno')).toContainText(dueText(5))

    await fillNewOneOff(page, 'Limpiar la nevera')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Limpiar la nevera')).toContainText('Sin fecha')

    await page.reload()
    await expect(task(page, 'Limpiar el horno')).toContainText(dueText(5))
    await expect(task(page, 'Limpiar la nevera')).toContainText('Sin fecha')
  })

  test('el campo de la fecha solo sale en las puntuales', async ({ page }) => {
    await signInAs(page)
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    const form = newTaskForm(page)
    await expect(form.getByLabel('Fecha (opcional)')).toHaveCount(0)
    await form.getByLabel('Puntual').check()
    await expect(form.getByLabel('Fecha (opcional)')).toBeVisible()
    await form.getByLabel('Semanal, en fin de semana').check()
    await expect(form.getByLabel('Fecha (opcional)')).toHaveCount(0)
  })

  test('en una puntual que ya existe, puedo ponerle fecha, cambiarla y quitarla', async ({ page }) => {
    await signInAs(page)
    const card = task(page, 'Cepillar suelo')

    await dueOnButton(page, 'Cepillar suelo').click()
    await expect(dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha')).toBeFocused()
    // Sin fecha aún, no hay nada que quitar.
    await expect(dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Quitar fecha' })).toHaveCount(0)
    await dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha').fill(day(5))
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Guardar' }).click()
    await expect(card).toContainText(dueText(5))
    // Al cerrarse, el foco vuelve al botón, que ahora es para cambiarla.
    await expect(card.getByRole('button', { name: 'Cambiar la fecha de Cepillar suelo' })).toBeFocused()
    await expect(card.getByRole('button', { name: 'Cambiar la fecha de Cepillar suelo' })).toHaveText('Cambiar fecha')

    await page.reload()
    await expect(card).toContainText(dueText(5))

    await dueOnButton(page, 'Cepillar suelo').click()
    await expect(dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha')).toHaveValue(day(5))
    await dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha').fill(todayInMadrid())
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Guardar' }).click()
    await expect(card).toContainText('Toca: hoy')

    await dueOnButton(page, 'Cepillar suelo').click()
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Quitar fecha' }).click()
    await expect(card).toContainText('Sin fecha')
    await expect(card.getByRole('button', { name: 'Poner fecha a Cepillar suelo' })).toHaveText('Poner fecha')

    await page.reload()
    await expect(card).toContainText('Sin fecha')
  })

  test('con «Cancelar», la fecha se queda como estaba', async ({ page }) => {
    await signInAs(page)
    const card = task(page, 'Cepillar suelo')
    await dueOnButton(page, 'Cepillar suelo').click()
    await dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha').fill(day(5))
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Cancelar' }).click()

    await expect(dueOnForm(page, 'Cepillar suelo')).toHaveCount(0)
    await expect(card).toContainText('Sin fecha')
    await expect(dueOnButton(page, 'Cepillar suelo')).toBeFocused()
  })

  test('si llega la fecha sin hacerse, aparece como retrasada', async ({ page }) => {
    const email = await signInAs(page)
    await setTaskDueOn(email, 'Cepillar suelo', day(-3))
    await page.reload()

    await expect(task(page, 'Cepillar suelo')).toContainText(
      `Retrasada 3 días (tocaba el ${formatShortDate(day(-3), 'es')})`,
    )
    // Las retrasadas salen primero (US-29).
    await expect(taskNames(page).first()).toHaveText('Cepillar suelo')

    // Ese mismo día aún no va con retraso: toca hoy.
    await setTaskDueOn(email, 'Cepillar suelo', todayInMadrid())
    await page.reload()
    await expect(task(page, 'Cepillar suelo')).toContainText('Toca: hoy')
  })

  test('una puntual retrasada se puede pasar a otro día', async ({ page }) => {
    const email = await signInAs(page)
    await setTaskDueOn(email, 'Cepillar suelo', day(-3))
    await page.reload()

    await dueOnButton(page, 'Cepillar suelo').click()
    await dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha').fill(day(5))
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Cepillar suelo')).toContainText(dueText(5))
  })

  test('al crearla, no se puede elegir un día pasado', async ({ page }) => {
    await signInAs(page)
    await fillNewOneOff(page, 'Limpiar el horno', day(-1))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    const field = newTaskForm(page).getByLabel('Fecha (opcional)')
    await expect(newTaskForm(page)).toContainText('Elige hoy o un día futuro.')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toBeFocused()
    await expect(task(page, 'Limpiar el horno')).toHaveCount(0)
  })

  test('al cambiarla, no se puede elegir un día pasado', async ({ page }) => {
    await signInAs(page)
    await dueOnButton(page, 'Cepillar suelo').click()
    const form = dueOnForm(page, 'Cepillar suelo')
    await form.getByLabel('Fecha').fill(day(-1))
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form).toContainText('Elige hoy o un día futuro.')
    await expect(form.getByLabel('Fecha')).toHaveAttribute('aria-invalid', 'true')
    await page.reload()
    await expect(task(page, 'Cepillar suelo')).toContainText('Sin fecha')
  })

  test('al cambiar la fecha, las partes ya hechas se conservan', async ({ page }) => {
    await signInAs(page)
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    const form = newTaskForm(page)
    await form.getByLabel('Nombre').fill('Cocina a fondo')
    await form.getByLabel('Puntual').check()
    for (const [index, part] of ['Horno', 'Nevera'].entries()) {
      await form.getByRole('button', { name: 'Añadir parte' }).click()
      await form.getByLabel(`Parte ${index + 1}`, { exact: true }).fill(part)
    }
    await form.getByRole('button', { name: 'Guardar tarea' }).click()
    const card = task(page, 'Cocina a fondo')
    await card.getByRole('button', { name: 'Marcar Horno como hecha' }).click()
    await expect(card).toContainText('Llevas 50 %')

    await dueOnButton(page, 'Cocina a fondo').click()
    await dueOnForm(page, 'Cocina a fondo').getByLabel('Fecha').fill(day(5))
    await dueOnForm(page, 'Cocina a fondo').getByRole('button', { name: 'Guardar' }).click()
    await expect(card).toContainText(dueText(5))

    await page.reload()
    await expect(card).toContainText(dueText(5))
    await expect(card).toContainText('Llevas 50 %')
  })

  // El aviso se va con la tarjeta: que se vea igual es de la US-47 (avisos de error visibles).
  test('si la tarea ya se había hecho en otro dispositivo, la lista se pone al día y la quita', async ({
    page,
  }) => {
    const email = await signInAs(page)
    await completeOneOffTask(email, 'Cepillar suelo')

    await dueOnButton(page, 'Cepillar suelo').click()
    await dueOnForm(page, 'Cepillar suelo').getByLabel('Fecha').fill(day(5))
    await dueOnForm(page, 'Cepillar suelo').getByRole('button', { name: 'Guardar' }).click()

    // La lista se pone al día y la puntual, ya hecha, desaparece.
    await expect(task(page, 'Cepillar suelo')).toHaveCount(0)
    await expect(task(page, 'Limpiar juntas')).toBeVisible()
  })

  test('si falla el guardado, la app lo dice y la fecha no cambia', async ({ page }) => {
    await signInAs(page)
    await page.route('**/rest/v1/rpc/set_task_due_on*', (route) => route.abort('internetdisconnected'))
    await dueOnButton(page, 'Cepillar suelo').click()
    const form = dueOnForm(page, 'Cepillar suelo')
    await form.getByLabel('Fecha').fill(day(5))
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(task(page, 'Cepillar suelo')).toContainText('Sin fecha')
    await expect(form.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('el botón, el formulario y la fecha salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Send me the code' }).click()
      await page.goto((await waitForSignInEmail(email)).link)
      const card = page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: 'Scrub the floor', exact: true }) })
      await expect(card).toContainText('No date')

      await card.getByRole('button', { name: 'Set a date for Scrub the floor' }).click()
      const form = page.getByRole('form', { name: 'Date of Scrub the floor' })
      await form.getByLabel('Date').fill(day(-1))
      await form.getByRole('button', { name: 'Save' }).click()
      await expect(form).toContainText('Choose today or a later day.')

      await form.getByLabel('Date').fill(day(5))
      await form.getByRole('button', { name: 'Save' }).click()
      await expect(card).toContainText(`Due: ${formatShortDate(day(5), 'en')}`)
      await expect(card.getByRole('button', { name: 'Change the date of Scrub the floor' })).toHaveText(
        'Change date',
      )

      await page.getByRole('button', { name: 'Add task' }).click()
      await page.getByRole('form', { name: 'New task' }).getByLabel('One-off').check()
      await expect(page.getByRole('form', { name: 'New task' }).getByLabel('Date (optional)')).toBeVisible()
    })
  })
})
