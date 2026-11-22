import { expect, test, type Page } from '@playwright/test'
import { addDays } from '../../src/domain/dates'
import { newTaskForm, signIn, task, taskNames, taskParts, todayInMadrid } from './helpers/app'
import { archivePart, movePartWeight, setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail } from './helpers/mailbox'

// US-54 · Cambiar el nombre de una tarea y de sus partes (#96)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// Lo que no se puede guardar se prueba también en tests/unit/domain/rename-task.test.ts (el
// formulario) y tests/integration/rename-task.test.ts (la base de datos). Al añadir una tarea,
// el nombre repetido se prueba en tests/e2e/us-33-add-task.spec.ts.

function renameButton(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', { name: `Cambiar nombre de ${taskName}` })
}

function renameForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Nombre de ${taskName}` })
}

function languageButton(page: Page, name: 'Español' | 'English') {
  return page.getByRole('button', { name, exact: true })
}

/** La tarjeta de una tarea en inglés. */
function taskInEnglish(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Your tasks' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
}

test.describe('US-54 · Cambiar el nombre de una tarea y de sus partes', () => {
  test('«Cambiar nombre» muestra el nombre de la tarea y el de cada parte', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(renameButton(page, 'Superficies')).toHaveText('Cambiar nombre')
    await renameButton(page, 'Superficies').click()

    const form = renameForm(page, 'Superficies')
    await expect(form.getByLabel('Nombre de la tarea')).toHaveValue('Superficies')
    await expect(form.getByLabel('Nombre de la tarea')).toBeFocused()
    await expect(form.getByLabel('Parte 1')).toHaveValue('Cocina')
    await expect(form.getByLabel('Parte 2')).toHaveValue('Salón')
    await expect(form.getByLabel('Parte 3')).toHaveValue('Dormitorio')

    // Las tareas sin partes, solo el nombre.
    await form.getByRole('button', { name: 'Cancelar' }).click()
    await renameButton(page, 'Baño').click()
    await expect(renameForm(page, 'Baño').getByLabel('Nombre de la tarea')).toHaveValue('Baño')
    await expect(renameForm(page, 'Baño').getByLabel(/^Parte/)).toHaveCount(0)
  })

  test('al guardar, la tarea y sus partes muestran los nombres nuevos, también al volver a cargar', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Nombre de la tarea').fill('Superficies de abajo')
    await form.getByLabel('Parte 2').fill('Salón comedor')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form).toHaveCount(0)
    const card = task(page, 'Superficies de abajo')
    await expect(taskParts(card)).toHaveText([/^Cocina 50 %/, /^Salón comedor 25 %/, /^Dormitorio 25 %/])
    await expect(renameButton(page, 'Superficies de abajo')).toBeFocused()

    await page.reload()
    await expect(taskParts(task(page, 'Superficies de abajo'))).toHaveText([
      /^Cocina 50 %/,
      /^Salón comedor 25 %/,
      /^Dormitorio 25 %/,
    ])
  })

  test('con «Cancelar», se queda como estaba', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Baño').click()
    await renameForm(page, 'Baño').getByLabel('Nombre de la tarea').fill('Baño de arriba')
    await renameForm(page, 'Baño').getByRole('button', { name: 'Cancelar' }).click()

    await expect(renameForm(page, 'Baño')).toHaveCount(0)
    await expect(task(page, 'Baño')).toBeVisible()
    await expect(renameButton(page, 'Baño')).toBeFocused()
  })

  test('ningún nombre vacío ni de más de 80 caracteres', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Nombre de la tarea').fill('   ')
    await form.getByLabel('Parte 1').fill('a'.repeat(81))
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form).toContainText('Escribe el nombre de la tarea.')
    await expect(form).toContainText('El nombre puede tener como mucho 80 caracteres.')
    await expect(form.getByLabel('Nombre de la tarea')).toBeFocused()

    // La parte vacía, tampoco.
    await form.getByLabel('Nombre de la tarea').fill('Superficies')
    await form.getByLabel('Parte 1').fill('')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Escribe el nombre de la parte')
    await expect(form).not.toContainText('Escribe el nombre de la tarea.')

    // No se ha guardado nada.
    await page.reload()
    await expect(taskParts(task(page, 'Superficies')).first()).toHaveText(/^Cocina 50 %/)
  })

  test('no puede llamarse como otra tarea, aunque cambien las mayúsculas o los espacios', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Nombre de la tarea').fill('  baño ')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form).toContainText('Ya tienes una tarea con ese nombre.')
    await page.reload()
    await expect(task(page, 'Superficies')).toBeVisible()
    await expect(taskNames(page).filter({ hasText: /^baño$/i })).toHaveCount(1)
  })

  test('las partes sí pueden llamarse igual', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Superficies').click()
    await renameForm(page, 'Superficies').getByLabel('Parte 2').fill('Cocina')
    await renameForm(page, 'Superficies').getByRole('button', { name: 'Guardar' }).click()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Cocina 25 %/, /^Dormitorio 25 %/])
  })

  test('lo que renombro de las tareas por defecto deja de traducirse; lo demás, no', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Nombre de la tarea').fill('Polvo')
    await form.getByLabel('Parte 2').fill('Salón comedor')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(task(page, 'Polvo')).toBeVisible()

    await languageButton(page, 'English').click()
    const card = taskInEnglish(page, 'Polvo')
    await expect(taskParts(card)).toHaveText([/^Kitchen 50 %/, /^Salón comedor 25 %/, /^Bedroom 25 %/])
    // Las que no he renombrado se siguen traduciendo.
    await expect(taskInEnglish(page, 'Bathroom')).toBeVisible()
  })

  test('en inglés, guardar sin cambiar nada no le quita la traducción', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await languageButton(page, 'English').click()
    const card = taskInEnglish(page, 'Surfaces')
    await card.getByRole('button', { name: 'Rename Surfaces' }).click()
    const form = page.getByRole('form', { name: 'Name of Surfaces' })
    await expect(form.getByLabel('Task name')).toHaveValue('Surfaces')
    await expect(form.getByLabel('Part 1')).toHaveValue('Kitchen')
    await form.getByLabel('Part 3').fill('Main bedroom')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(taskParts(card)).toHaveText([/^Kitchen 50 %/, /^Living room 25 %/, /^Main bedroom 25 %/])

    // En castellano: la tarea y las otras partes se siguen traduciendo; la renombrada, no.
    await languageButton(page, 'Español').click()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([
      /^Cocina 50 %/,
      /^Salón 25 %/,
      /^Main bedroom 25 %/,
    ])
  })

  test('el progreso de la vuelta en curso no cambia', async ({ page }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    // Con la vuelta en curso empezada, para poder marcar partes cualquier día.
    await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -28))
    await page.reload()
    const card = task(page, 'Superficies')
    await card.getByRole('button', { name: 'Marcar Cocina como hecha' }).click()
    await expect(card).toContainText('Llevas 50 %')

    await renameButton(page, 'Superficies').click()
    await renameForm(page, 'Superficies').getByLabel('Parte 1').fill('Cocina y despensa')
    await renameForm(page, 'Superficies').getByRole('button', { name: 'Guardar' }).click()

    await expect(card).toContainText('Llevas 50 %')
    await expect(taskParts(card).first()).toHaveText(/^Cocina y despensa 50 %\s*Hecha/)
    await page.reload()
    await expect(card).toContainText('Llevas 50 %')
    await expect(taskParts(card).first()).toHaveText(/^Cocina y despensa 50 %\s*Hecha/)
  })

  test('si falla el guardado, la app lo dice y no cambia', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/rename_task*', (route) => route.abort('internetdisconnected'))
    await renameButton(page, 'Baño').click()
    const form = renameForm(page, 'Baño')
    await form.getByLabel('Nombre de la tarea').fill('Baño de arriba')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(task(page, 'Baño')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})

test.describe('US-54 · No hay dos tareas con el mismo nombre', () => {
  test('si otra tarea ya tiene ese nombre (cambiado en otro dispositivo), la app lo dice al guardar', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/rename_task*', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: '23505', message: 'Ya tienes una tarea con ese nombre.' }),
      }),
    )
    await renameButton(page, 'Baño').click()
    const form = renameForm(page, 'Baño')
    await form.getByLabel('Nombre de la tarea').fill('Baño de arriba')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form.getByRole('alert')).toHaveText('Ya tienes una tarea con ese nombre.')
  })
})

test.describe('US-54 · Partes cambiadas en otro dispositivo', () => {
  test('si la parte que renombro se ha quitado en otro dispositivo, la app lo dice y el formulario se pone al día', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Parte 2').fill('Salón comedor')

    // Mientras, en otro dispositivo, se quita Salón (y Dormitorio pasa a 50).
    await archivePart(email, 'Superficies', 'Salón', 'Dormitorio')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form.getByRole('alert')).toHaveText(
      'Las partes de esta tarea han cambiado en otro dispositivo. Revísalas y vuelve a intentarlo.',
    )
    // El formulario muestra las partes de ahora, y ya se puede guardar.
    await expect(form.getByLabel(/^Parte/)).toHaveCount(2)
    await expect(form.getByLabel('Parte 2')).toHaveValue('Dormitorio')
    await form.getByLabel('Parte 2').fill('Dormitorio grande')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toHaveCount(0)
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Dormitorio grande 50 %/])
  })

  test('si la lista se vuelve a cargar con el formulario abierto, no renombra otra parte', async ({ page }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')

    // En otro dispositivo se quita Salón; aquí se añade una tarea, y la lista se vuelve a cargar.
    await archivePart(email, 'Superficies', 'Salón', 'Dormitorio')
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    await newTaskForm(page).getByLabel('Nombre').fill('Terraza')
    await newTaskForm(page).getByLabel('Puntual').check()
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Terraza')).toBeVisible()

    // El formulario se pone al día: cada parte con su nombre.
    await expect(form.getByLabel(/^Parte/)).toHaveCount(2)
    await expect(form.getByLabel('Parte 2')).toHaveValue('Dormitorio')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toHaveCount(0)
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Dormitorio 50 %/])
  })

  test('si en otro dispositivo solo cambian los pesos, no se pierde lo que estoy escribiendo', async ({ page }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await renameButton(page, 'Superficies').click()
    const form = renameForm(page, 'Superficies')
    await form.getByLabel('Parte 2').fill('Salón comedor')

    // En otro dispositivo se pasan 5 puntos de Cocina a Salón; aquí se añade una tarea, y la
    // lista se vuelve a cargar.
    await movePartWeight(email, 'Superficies', 'Cocina', 'Salón', 5)
    await page.getByRole('button', { name: 'Añadir tarea' }).click()
    await newTaskForm(page).getByLabel('Nombre').fill('Terraza')
    await newTaskForm(page).getByLabel('Puntual').check()
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 45 %/, /^Salón 30 %/, /^Dormitorio 25 %/])

    await expect(form.getByLabel('Parte 2')).toHaveValue('Salón comedor')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toHaveCount(0)
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([
      /^Cocina 45 %/,
      /^Salón comedor 30 %/,
      /^Dormitorio 25 %/,
    ])
  })
})
