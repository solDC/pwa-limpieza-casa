import { expect, test, type Page } from '@playwright/test'
import { newTaskForm, signIn, task } from './helpers/app'
import { uniqueEmail } from './helpers/mailbox'

// US-34 · Elegir el peso de las partes (#43)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// Las reglas de los pesos (repartir, sumar, qué vale) se prueban también en
// tests/unit/domain/new-task.test.ts, y que la base de datos exige que sumen 100, en
// tests/integration/create-task.test.ts.

function weight(page: Page, part: number) {
  return newTaskForm(page).getByLabel(`Peso de la parte ${part}`, { exact: true })
}

/** Abre «Nueva tarea» con una tarea puntual y esas partes, sin tocar los pesos. */
async function newTaskWithParts(page: Page, name: string, parts: string[]) {
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  await newTaskForm(page).getByLabel('Nombre').fill(name)
  await newTaskForm(page).getByLabel('Puntual').check()
  for (const [index, part] of parts.entries()) {
    await newTaskForm(page).getByRole('button', { name: 'Añadir parte' }).click()
    await newTaskForm(page).getByLabel(`Parte ${index + 1}`, { exact: true }).fill(part)
  }
}

test.describe('US-34 · Elegir el peso de las partes', () => {
  test('al crear una tarea con partes, puedo poner el peso de cada una', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await newTaskWithParts(page, 'Cocina a fondo', ['Horno', 'Nevera', 'Campana'])

    await weight(page, 1).fill('50')
    await weight(page, 2).fill('30')
    await weight(page, 3).fill('20')
    await expect(newTaskForm(page)).toContainText('Suman: 100 %')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 50 % · Nevera 30 % · Campana 20 %')
    await page.reload()
    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 50 % · Nevera 30 % · Campana 20 %')
  })

  test('si no cambio los pesos, se reparten a partes iguales, también al añadir y quitar partes', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await newTaskWithParts(page, 'Cocina a fondo', ['Horno', 'Nevera', 'Campana'])
    await expect(weight(page, 1)).toHaveValue('34')
    await expect(weight(page, 2)).toHaveValue('33')
    await expect(weight(page, 3)).toHaveValue('33')

    await newTaskForm(page).getByRole('button', { name: 'Quitar parte 3' }).click()
    await expect(weight(page, 1)).toHaveValue('50')
    await expect(weight(page, 2)).toHaveValue('50')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 50 % · Nevera 50 %')
  })

  test('desde que cambio un peso, una parte nueva entra con 0 % y los demás se quedan como los dejé', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await newTaskWithParts(page, 'Cocina a fondo', ['Horno', 'Nevera'])
    await weight(page, 1).fill('70')
    await weight(page, 2).fill('30')

    await newTaskForm(page).getByRole('button', { name: 'Añadir parte' }).click()

    await expect(weight(page, 1)).toHaveValue('70')
    await expect(weight(page, 2)).toHaveValue('30')
    await expect(weight(page, 3)).toHaveValue('0')
  })

  test('no se puede guardar la tarea si los pesos no suman 100 %', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await newTaskWithParts(page, 'Cocina a fondo', ['Horno', 'Nevera', 'Campana'])
    await weight(page, 1).fill('50')
    await weight(page, 2).fill('30')
    await weight(page, 3).fill('10')
    await expect(newTaskForm(page)).toContainText('Suman: 90 %')

    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    const totalError = newTaskForm(page).getByText('Los pesos tienen que sumar 100 % (ahora suman 90 %).')
    await expect(totalError).toBeVisible()
    // Es lo único que falla: el cursor va al aviso, para que se lea (también con VoiceOver).
    await expect(totalError).toBeFocused()
    await expect(task(page, 'Cocina a fondo')).toHaveCount(0)

    // Al corregirlo, ya se puede guardar.
    await weight(page, 3).fill('20')
    await expect(newTaskForm(page)).toContainText('Suman: 100 %')
    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()
    await expect(task(page, 'Cocina a fondo')).toContainText('Horno 50 % · Nevera 30 % · Campana 20 %')
  })

  test('cada parte tiene que contar de 1 a 100 %', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await newTaskWithParts(page, 'Cocina a fondo', ['Horno', 'Nevera'])
    await weight(page, 1).fill('100')
    await weight(page, 2).fill('0')

    await newTaskForm(page).getByRole('button', { name: 'Guardar tarea' }).click()

    await expect(newTaskForm(page)).toContainText('Escribe un peso de 1 a 100.')
    await expect(weight(page, 2)).toBeFocused()
    await expect(task(page, 'Cocina a fondo')).toHaveCount(0)
  })
})
