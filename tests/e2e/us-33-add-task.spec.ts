import { expect, test, type Page } from '@playwright/test'
import { formatDayMonth, localDateIn } from '../../src/domain/dates'
import { nextWeekends } from '../../src/domain/new-task'
import { signIn, task } from './helpers/app'
import { uniqueEmail } from './helpers/mailbox'

// US-33 · Añadir una tarea (#42)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// Usan el reloj de verdad: el día en que se crea la tarea lo pone la base de datos.
// Lo que no se puede guardar se prueba también en tests/unit/domain/new-task.test.ts
// (el formulario) y tests/integration/create-task.test.ts (la base de datos).

const today = () => localDateIn('Europe/Madrid', new Date())

function form(page: Page) {
  return page.getByRole('form', { name: 'Nueva tarea' })
}

function taskNames(page: Page) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .getByRole('heading', { level: 3 })
}

async function openForm(page: Page) {
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  await expect(form(page)).toBeVisible()
}

async function addParts(page: Page, names: string[]) {
  for (const [index, name] of names.entries()) {
    await form(page).getByRole('button', { name: 'Añadir parte' }).click()
    await form(page).getByLabel(`Parte ${index + 1}`, { exact: true }).fill(name)
  }
}

test.describe('US-33 · Añadir una tarea', () => {
  test('no se puede guardar una tarea sin nombre o sin frecuencia', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(taskNames(page)).toHaveCount(6)
    await openForm(page)

    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(form(page)).toContainText('Escribe el nombre de la tarea.')
    await expect(form(page)).toContainText('Elige cada cuánto toca.')

    // Con nombre pero sin frecuencia, tampoco.
    await form(page).getByLabel('Nombre').fill('Regar las plantas')
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(form(page)).not.toContainText('Escribe el nombre de la tarea.')
    await expect(form(page)).toContainText('Elige cada cuánto toca.')

    // No se ha guardado nada.
    await form(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(taskNames(page)).toHaveCount(6)
    await page.reload()
    await expect(taskNames(page)).toHaveCount(6)
  })

  test('las partes son opcionales: añado una tarea sin partes y sale en la lista', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)

    await form(page).getByLabel('Nombre').fill('Regar las plantas')
    await form(page).getByLabel('Cada N días desde la última vez').check()
    await form(page).getByLabel('Cada cuántos días').fill('7')
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(form(page)).toHaveCount(0)
    const added = task(page, 'Regar las plantas')
    await expect(added).toContainText('Cada 7 días desde la última vez')
    await expect(added).toContainText('Toca: hoy')
    await expect(added).not.toContainText('%')

    // Está guardada: sigue al volver a entrar.
    await page.reload()
    await expect(task(page, 'Regar las plantas')).toContainText('Cada 7 días desde la última vez')
  })

  test('si tiene partes, todas cuentan lo mismo', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)

    await form(page).getByLabel('Nombre').fill('Cocina a fondo')
    await form(page).getByLabel('Puntual').check()
    await addParts(page, ['Horno', 'Nevera', 'Campana'])
    await expect(form(page)).toContainText('Si no cambias los pesos, todas cuentan lo mismo.')
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 34 % · Nevera 33 % · Campana 33 %')
    await page.reload()
    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 34 % · Nevera 33 % · Campana 33 %')
  })

  test('puedo quitar una parte antes de guardar, y una parte sin nombre no deja guardar', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)
    await form(page).getByLabel('Nombre').fill('Terraza')
    await form(page).getByLabel('Semanal, en fin de semana').check()
    await addParts(page, ['Suelo', 'Macetas'])
    await form(page).getByRole('button', { name: 'Añadir parte' }).click()

    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(form(page)).toContainText('Escribe el nombre de la parte o quítala.')

    await form(page).getByRole('button', { name: 'Quitar parte 3' }).click()
    await form(page).getByRole('button', { name: 'Quitar parte 1' }).click()
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(task(page, 'Terraza')).toContainText('Macetas 100 %')
    await expect(task(page, 'Terraza')).toContainText('Semanal, en fin de semana')
  })

  test('las de cada 15 días empiezan el fin de semana que elijo, de los dos próximos', async ({
    page,
  }) => {
    const [first, second] = nextWeekends(today())
    await signIn(page, uniqueEmail())
    await openForm(page)
    await form(page).getByLabel('Nombre').fill('Limpiar el horno')
    await form(page).getByLabel('Fin de semana cada 15 días').check()

    // Sale elegido el primero.
    await expect(form(page).getByLabel(`Finde del ${formatDayMonth(first)}`)).toBeChecked()
    await form(page).getByLabel(`Finde del ${formatDayMonth(second)}`).check()
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(task(page, 'Limpiar el horno')).toContainText(
      `Toca: finde del ${formatDayMonth(second)}`,
    )
  })

  test('«Cancelar» vuelve a la lista sin guardar nada', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)
    await form(page).getByLabel('Nombre').fill('No la quiero')
    await form(page).getByLabel('Puntual').check()

    await form(page).getByRole('button', { name: 'Cancelar' }).click()

    await expect(form(page)).toHaveCount(0)
    await expect(task(page, 'No la quiero')).toHaveCount(0)
    await expect(taskNames(page)).toHaveCount(6)
  })

  // Para usarlo con el teclado o con un lector de pantalla (VoiceOver).
  test('el foco va al nombre al abrir, vuelve a «Añadir tarea» al cerrar, y al guardar lo anuncia', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)
    await expect(form(page).getByLabel('Nombre')).toBeFocused()

    await form(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: 'Añadir tarea' })).toBeFocused()

    await openForm(page)
    await form(page).getByLabel('Nombre').fill('Regar las plantas')
    await form(page).getByLabel('Puntual').check()
    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Tarea añadida' })).toHaveText(
      'Tarea añadida: Regar las plantas.',
    )
    await expect(page.getByRole('button', { name: 'Añadir tarea' })).toBeFocused()
  })

  test('si no se puede guardar, lo dice y no se pierde lo escrito', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/create_task', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Error"}' }),
    )
    await openForm(page)
    await form(page).getByLabel('Nombre').fill('Regar las plantas')
    await form(page).getByLabel('Puntual').check()

    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(form(page).getByRole('alert')).toHaveText(
      'No se ha podido guardar la tarea. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(form(page).getByLabel('Nombre')).toHaveValue('Regar las plantas')
    await expect(form(page).getByLabel('Puntual')).toBeChecked()
  })

  // Para no añadirla dos veces: si se guarda pero la lista no se puede poner al día
  // (por ejemplo, se corta la conexión justo después), lo dice.
  test('si se guarda pero no se puede poner al día la lista, lo dice', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await openForm(page)
    await form(page).getByLabel('Nombre').fill('Regar las plantas')
    await form(page).getByLabel('Puntual').check()
    await page.route('**/rest/v1/tasks?*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Error"}' }),
    )

    await form(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(form(page)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveText(
      'La tarea se ha guardado, pero no se ha podido poner al día la lista. Vuelve a cargar la página para verla.',
    )
    await page.unroute('**/rest/v1/tasks?*')
    await page.reload()
    await expect(task(page, 'Regar las plantas')).toBeVisible()
  })
})
