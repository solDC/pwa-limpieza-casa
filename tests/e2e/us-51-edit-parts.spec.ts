import { expect, test, type Page } from '@playwright/test'
import { addDays } from '../../src/domain/dates'
import { signIn, task, taskParts, todayInMadrid } from './helpers/app'
import { archivePart, setAllTasksCreatedOn } from './helpers/database'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-51 · Cambiar las partes de una tarea (#83)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// Las reglas del formulario se prueban también en tests/unit/domain/edit-parts.test.ts, y las
// de la base de datos (archivar, la suma, completar la vuelta), en
// tests/integration/edit-task-parts.test.ts.

function partsButton(page: Page, taskName: string) {
  return task(page, taskName).getByRole('button', { name: `Cambiar partes de ${taskName}` })
}

function partsForm(page: Page, taskName: string) {
  return page.getByRole('form', { name: `Partes de ${taskName}` })
}

function markPart(page: Page, taskName: string, part: string) {
  return task(page, taskName).getByRole('button', { name: `Marcar ${part} como hecha` })
}

/** Entra con las tareas creadas hace un mes, para poder marcar las partes de Superficies cualquier día. */
async function signInWithSurfaces(page: Page) {
  const email = uniqueEmail()
  await signIn(page, email)
  await setAllTasksCreatedOn(email, addDays(todayInMadrid(), -30))
  await page.reload()
  await expect(markPart(page, 'Superficies', 'Cocina')).toBeVisible()
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

async function save(page: Page, taskName: string) {
  await partsForm(page, taskName).getByRole('button', { name: 'Guardar' }).click()
  await expect(partsForm(page, taskName)).toHaveCount(0)
}

test.describe('US-51 · Cambiar las partes de una tarea', () => {
  test('«Cambiar partes» muestra cada parte con su peso y lo que suman', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(partsButton(page, 'Superficies')).toHaveText('Cambiar partes')
    await partsButton(page, 'Superficies').click()

    const form = partsForm(page, 'Superficies')
    await expect(form.getByLabel('Parte 1', { exact: true })).toHaveValue('Cocina')
    await expect(form.getByLabel('Parte 1', { exact: true })).toBeEditable()
    await expect(form.getByLabel('Peso de la parte 1')).toHaveValue('50')
    await expect(form.getByLabel('Peso de la parte 2')).toHaveValue('25')
    await expect(form.getByLabel('Peso de la parte 3')).toHaveValue('25')
    await expect(form).toContainText('Suman: 100 %')
  })

  test('cambio los pesos y añado una parte: al guardar, la tarea muestra sus partes nuevas', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Añadir parte' }).click()
    // Los pesos de Superficies no son iguales: se conservan, y la nueva empieza en 0.
    await expect(form.getByLabel('Peso de la parte 4')).toHaveValue('0')
    await form.getByLabel('Parte 4', { exact: true }).fill('Baño de invitados')
    await form.getByLabel('Peso de la parte 1').fill('40')
    await form.getByLabel('Peso de la parte 4').fill('10')
    await expect(form).toContainText('Suman: 100 %')
    await save(page, 'Superficies')

    const card = task(page, 'Superficies')
    await expect(taskParts(card)).toHaveText([/^Cocina 40 %/, /^Salón 25 %/, /^Dormitorio 25 %/, /^Baño de invitados 10 %/])
    await expect(partsButton(page, 'Superficies')).toBeFocused()
    await page.reload()
    await expect(taskParts(card)).toHaveText([/^Cocina 40 %/, /^Salón 25 %/, /^Dormitorio 25 %/, /^Baño de invitados 10 %/])
  })

  test('cambio el nombre de una parte y su peso: lo renombrado deja de traducirse', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByLabel('Parte 2', { exact: true }).fill(' Salón comedor ')
    await form.getByLabel('Peso de la parte 1').fill('40')
    await form.getByLabel('Peso de la parte 2').fill('35')
    await save(page, 'Superficies')

    const card = task(page, 'Superficies')
    await expect(taskParts(card)).toHaveText([/^Cocina 40 %/, /^Salón comedor 35 %/, /^Dormitorio 25 %/])
    await page.reload()
    await expect(taskParts(card)).toHaveText([/^Cocina 40 %/, /^Salón comedor 35 %/, /^Dormitorio 25 %/])

    // En inglés: la renombrada se ve como la escribí; las demás se siguen traduciendo.
    await languageButton(page, 'English').click()
    await expect(taskParts(taskInEnglish(page, 'Surfaces'))).toHaveText([
      /^Kitchen 40 %/,
      /^Salón comedor 35 %/,
      /^Bedroom 25 %/,
    ])
  })

  test('el nombre de una parte, ni vacío ni de más de 80 caracteres', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByLabel('Parte 1', { exact: true }).fill('  ')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Escribe el nombre de la parte o quítala.')
    await expect(form.getByLabel('Parte 1', { exact: true })).toBeFocused()
    await form.getByLabel('Parte 1', { exact: true }).fill('x'.repeat(81))
    await expect(form).toContainText('El nombre puede tener como mucho 80 caracteres.')

    // No se ha guardado nada.
    await page.reload()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Salón 25 %/, /^Dormitorio 25 %/])
  })

  test('puedo añadir partes a una tarea que no tiene', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Baño').click()
    const form = partsForm(page, 'Baño')
    for (const [index, name] of ['Ducha', 'Lavabo'].entries()) {
      await form.getByRole('button', { name: 'Añadir parte' }).click()
      await form.getByLabel(`Parte ${index + 1}`, { exact: true }).fill(name)
    }
    // Sin cambiar los pesos, cuentan lo mismo.
    await expect(form.getByLabel('Peso de la parte 1')).toHaveValue('50')
    await save(page, 'Baño')
    await expect(taskParts(task(page, 'Baño'))).toHaveText([/^Ducha 50 %/, /^Lavabo 50 %/])
  })

  test('puedo quitarlas todas: la tarea se marca entera', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    for (let i = 0; i < 3; i++) await form.getByRole('button', { name: 'Quitar parte 1' }).click()
    await expect(form).toContainText('Sin partes, la tarea se marca entera.')
    await save(page, 'Superficies')

    const card = task(page, 'Superficies')
    await expect(taskParts(card)).toHaveCount(0)
    await page.reload()
    await expect(taskParts(card)).toHaveCount(0)
  })

  test('no se puede guardar si los pesos no suman 100 %, ni con un peso o un nombre que no valen', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByLabel('Peso de la parte 1').fill('60')
    await expect(form).toContainText('Suman: 110 %')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Los pesos tienen que sumar 100 % (ahora suman 110 %).')

    await form.getByLabel('Peso de la parte 1').fill('0')
    await form.getByRole('button', { name: 'Añadir parte' }).click()
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form).toContainText('Escribe un peso de 1 a 100.')
    await expect(form).toContainText('Escribe el nombre de la parte o quítala.')

    // No se ha guardado nada.
    await page.reload()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Salón 25 %/, /^Dormitorio 25 %/])
  })

  test('como mucho 20 partes', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    for (let i = 0; i < 17; i++) await form.getByRole('button', { name: 'Añadir parte' }).click()
    await expect(form.getByLabel(/^Peso de la parte/)).toHaveCount(20)
    await expect(form.getByRole('button', { name: 'Añadir parte' })).toBeDisabled()
  })

  test('con «Cancelar», se quedan como estaban', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 2' }).click()
    await form.getByLabel('Peso de la parte 1').fill('75')
    await form.getByRole('button', { name: 'Cancelar' }).click()

    await expect(form).toHaveCount(0)
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Salón 25 %/, /^Dormitorio 25 %/])
    await expect(partsButton(page, 'Superficies')).toBeFocused()
  })

  test('los cambios cuentan desde la vuelta en curso: sus partes hechas siguen hechas', async ({ page }) => {
    await signInWithSurfaces(page)
    const card = task(page, 'Superficies')
    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(card).toContainText('Llevas 50 %')

    // Cocina pasa a pesar 60 y se quita Salón (sin hacer).
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 2' }).click()
    await form.getByLabel('Peso de la parte 1').fill('60')
    await form.getByLabel('Peso de la parte 2').fill('40')
    await save(page, 'Superficies')

    await expect(card).toContainText('Llevas 60 %')
    await expect(taskParts(card)).toHaveText([/^Cocina 60 %\s*Hecha/, /^Dormitorio 40 %\s*Marcar/])
    await page.reload()
    await expect(card).toContainText('Llevas 60 %')
  })

  test('quitar una parte ya hecha: deja de salir y de contar', async ({ page }) => {
    await signInWithSurfaces(page)
    const card = task(page, 'Superficies')
    await markPart(page, 'Superficies', 'Cocina').click()
    await expect(card).toContainText('Llevas 50 %')

    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 1' }).click()
    await form.getByLabel('Peso de la parte 1').fill('50')
    await form.getByLabel('Peso de la parte 2').fill('50')
    await save(page, 'Superficies')

    await expect(taskParts(card)).toHaveText([/^Salón 50 %/, /^Dormitorio 50 %/])
    await expect(card).toContainText('Llevas 0 %')
    await page.reload()
    await expect(taskParts(card)).toHaveText([/^Salón 50 %/, /^Dormitorio 50 %/])
  })

  test('si al quitar partes ya están hechas todas las que quedan, la vuelta queda completada', async ({ page }) => {
    await signInWithSurfaces(page)
    const card = task(page, 'Superficies')
    await markPart(page, 'Superficies', 'Cocina').click()
    await markPart(page, 'Superficies', 'Salón').click()
    await expect(card).toContainText('Llevas 75 %')

    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 3' }).click()
    await form.getByLabel('Peso de la parte 1').fill('60')
    await form.getByLabel('Peso de la parte 2').fill('40')
    await save(page, 'Superficies')

    // Ya no se puede marcar nada: la tarjeta es la de la vuelta siguiente.
    await expect(card.getByRole('button', { name: /^Marcar/ })).toHaveCount(0)
    await expect(card).not.toContainText('Llevas')
    await page.reload()
    await expect(card.getByRole('button', { name: /^Marcar/ })).toHaveCount(0)
  })

  test('si falla el guardado, la app lo dice y no cambia nada', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/set_task_parts*', (route) => route.abort('internetdisconnected'))
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 3' }).click()
    await form.getByLabel('Peso de la parte 2').fill('50')
    await form.getByRole('button', { name: 'Guardar' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    )
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 50 %/, /^Salón 25 %/, /^Dormitorio 25 %/])
    await expect(form.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  test('si las partes han cambiado en otro dispositivo, la app lo dice y el formulario se pone al día', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByLabel('Peso de la parte 1').fill('40')
    await form.getByLabel('Peso de la parte 2').fill('35')

    // Mientras, en otro dispositivo, se quita Dormitorio (y Salón pasa a 50).
    await archivePart(email, 'Superficies', 'Dormitorio', 'Salón')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form.getByRole('alert')).toHaveText(
      'Las partes de esta tarea han cambiado en otro dispositivo. Revísalas y vuelve a intentarlo.',
    )
    // El formulario muestra las partes de ahora, y ya se puede guardar.
    await expect(form.getByLabel(/^Peso de la parte/)).toHaveCount(2)
    await expect(form.getByLabel('Peso de la parte 2')).toHaveValue('50')
    await form.getByLabel('Peso de la parte 1').fill('60')
    await form.getByLabel('Peso de la parte 2').fill('40')
    await save(page, 'Superficies')
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 60 %/, /^Salón 40 %/])
  })

  test('si la fecha del dispositivo va mal, la app lo dice', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/rest/v1/rpc/set_task_parts*', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: '23514', message: 'task_rounds_completed_on_check' }),
      }),
    )
    await partsButton(page, 'Superficies').click()
    const form = partsForm(page, 'Superficies')
    await form.getByRole('button', { name: 'Quitar parte 3' }).click()
    await form.getByLabel('Peso de la parte 2').fill('50')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(form.getByRole('alert')).toHaveText(
      'No se ha podido guardar: la fecha de este dispositivo no es la de hoy. Revisa la fecha y la hora.',
    )
  })

  test('guardar en inglés sin cambiar los nombres no les quita la traducción', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await languageButton(page, 'English').click()
    const card = taskInEnglish(page, 'Surfaces')
    await card.getByRole('button', { name: 'Change parts of Surfaces' }).click()
    const form = page.getByRole('form', { name: 'Parts of Surfaces' })
    await form.getByLabel('Weight of part 1').fill('40')
    await form.getByLabel('Weight of part 2').fill('35')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form).toHaveCount(0)
    await expect(taskParts(card)).toHaveText([/^Kitchen 40 %/, /^Living room 35 %/, /^Bedroom 25 %/])

    await languageButton(page, 'Español').click()
    await expect(taskParts(task(page, 'Superficies'))).toHaveText([/^Cocina 40 %/, /^Salón 35 %/, /^Dormitorio 25 %/])
  })

  test('si cambio de idioma con el formulario abierto, las partes salen en el nuevo', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await partsButton(page, 'Superficies').click()
    await languageButton(page, 'English').click()
    const form = page.getByRole('form', { name: 'Parts of Surfaces' })
    await expect(form.getByLabel('Part 1', { exact: true })).toHaveValue('Kitchen')
  })

  test.describe('en inglés', () => {
    test.use({ locale: 'en-US' })

    test('el botón, el formulario y las partes salen en inglés', async ({ page }) => {
      const email = uniqueEmail()
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: 'Send me the code' }).click()
      await page.goto((await waitForSignInEmail(email)).link)
      const card = page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: 'Surfaces', exact: true }) })

      await card.getByRole('button', { name: 'Change parts of Surfaces' }).click()
      const form = page.getByRole('form', { name: 'Parts of Surfaces' })
      await expect(form.getByLabel('Part 1', { exact: true })).toHaveValue('Kitchen')
      await expect(form).toContainText('Total: 100 %')
    })
  })
})
