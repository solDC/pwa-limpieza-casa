import { expect, test, type Page } from '@playwright/test'
import { addDays, formatShortDate } from '../../src/domain/dates'
import { newTaskForm, signIn, task, todayInMadrid } from './helpers/app'
import { setTaskCreatedOn, setTaskNextDueOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-50 · Elegir desde qué día toca una tarea de cada N días (#81)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// «Hoy» es el de Madrid, con el reloj de verdad: el de la base de datos, que es quien
// rechaza un día pasado. La validación se prueba también en tests/unit/domain/new-task.test.ts
// y la base de datos en tests/integration/interval-next-due-on.test.ts.

/** Un día respecto a hoy en Madrid. */
const day = (days: number) => addDays(todayInMadrid(), days)
/** «Toca: mié 25 nov», para un día que no es hoy ni mañana. */
const dueText = (days: number) => `Toca: ${formatShortDate(day(days), 'es')}`

/** Abre «Nueva tarea» con una de cada 7 días con ese nombre (sin guardarla). */
async function fillNewInterval(page: Page, name: string) {
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  const form = newTaskForm(page)
  await form.getByLabel('Nombre').fill(name)
  await form.getByLabel('Cada N días desde la última vez').check()
  await form.getByLabel('Cada cuántos días').fill('7')
}

const firstDueField = (page: Page) => newTaskForm(page).getByLabel('Toca por primera vez el')

test.describe('US-50 · Elegir desde qué día toca una tarea de cada N días', () => {
  test('el formulario pide «Toca por primera vez el», con hoy ya elegido, solo en las de cada N días', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    const form = newTaskForm(page)
    await expect(firstDueField(page)).toHaveCount(0)
    await form.getByLabel('Cada N días desde la última vez').check()
    await expect(firstDueField(page)).toHaveValue(todayInMadrid())
    await expect(firstDueField(page)).toHaveAttribute('min', todayInMadrid())
    await form.getByLabel('Puntual').check()
    await expect(firstDueField(page)).toHaveCount(0)
    await form.getByLabel('Semanal, en fin de semana').check()
    await expect(firstDueField(page)).toHaveCount(0)
  })

  test('sin cambiarlo, toca hoy', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await fillNewInterval(page, 'Regar las plantas')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Regar las plantas')).toContainText('Toca: hoy')
  })

  test('solo puedo elegir hoy o un día futuro', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await fillNewInterval(page, 'Regar las plantas')
    await firstDueField(page).fill(day(-1))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(newTaskForm(page)).toContainText('Elige hoy o un día futuro.')
    await expect(firstDueField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(firstDueField(page)).toBeFocused()
    await expect(task(page, 'Regar las plantas')).toHaveCount(0)

    // Vacío tampoco.
    await firstDueField(page).fill('')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(newTaskForm(page)).toContainText('Elige hoy o un día futuro.')
  })

  test('hasta ese día dice «Toca: <día>», sin retraso', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await fillNewInterval(page, 'Regar las plantas')
    await firstDueField(page).fill(day(5))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    const card = task(page, 'Regar las plantas')
    await expect(card).toContainText(dueText(5))
    await expect(card).not.toContainText('Retrasada')
    await page.reload()
    await expect(card).toContainText(dueText(5))
  })

  test('desde el día siguiente sin hacerla, va con retraso', async ({ page }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await fillNewInterval(page, 'Regar las plantas')
    await firstDueField(page).fill(day(5))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Regar las plantas')).toContainText(dueText(5))

    // Como si hubiera llegado ese día (la app no deja elegir un día pasado): ese día toca
    // hoy, sin retraso.
    await setTaskCreatedOn(email, 'Regar las plantas', day(-5))
    await setTaskNextDueOn(email, 'Regar las plantas', todayInMadrid())
    await page.reload()
    await expect(task(page, 'Regar las plantas')).toContainText('Toca: hoy')

    // Y el día siguiente sin hacerla, 1 día de retraso.
    await setTaskNextDueOn(email, 'Regar las plantas', day(-1))
    await page.reload()
    await expect(task(page, 'Regar las plantas')).toContainText(
      `Retrasada 1 día (tocaba el ${formatShortDate(day(-1), 'es')})`,
    )
  })

  test('después, las siguientes se cuentan desde el día en que se termine', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await fillNewInterval(page, 'Regar las plantas')
    await firstDueField(page).fill(day(5))
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Regar las plantas')).toContainText(dueText(5))

    // Se hace hoy, antes del día elegido: la próxima, 7 días después de hoy.
    await task(page, 'Regar las plantas').getByRole('button', { name: 'Marcar como hecha' }).click()
    await expect(task(page, 'Regar las plantas')).toContainText(dueText(7))
    await page.reload()
    await expect(task(page, 'Regar las plantas')).toContainText(dueText(7))
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('el campo y el aviso salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.goto((await waitForSignInEmail(email)).link)

      await page.getByRole('button', { name: 'Add task' }).click()
      const form = page.getByRole('form', { name: 'New task' })
      await form.getByLabel('Name').fill('Water the plants')
      await form.getByLabel('Every N days since the last time').check()
      await form.getByLabel('Every how many days').fill('7')
      await form.getByLabel('First due on').fill(day(-1))
      await form.getByRole('button', { name: 'Save task' }).click()
      await expect(form).toContainText('Choose today or a later day.')

      await form.getByLabel('First due on').fill(day(5))
      await form.getByRole('button', { name: 'Save task' }).click()
      await expect(
        page.getByRole('list', { name: 'Your tasks' }).getByRole('listitem').filter({ hasText: 'Water the plants' }),
      ).toContainText(`Due: ${formatShortDate(day(5), 'en')}`)
    })
  })
})
