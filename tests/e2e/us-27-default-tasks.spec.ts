import { expect, test, type Page } from '@playwright/test'
import { signIn, task } from './helpers/app'
import { uniqueEmail } from './helpers/mailbox'

// US-27 · Mis tareas por defecto (#36)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// Dos criterios se prueban en tests/integration/tasks.test.ts y no aquí, porque no se
// pueden provocar desde el navegador:
// - «Mi hogar, que ya existe, también las recibe»: ocurre al aplicar la migración.
// - «Si cancelo una, no vuelve a aparecer»: cancelar llega con la US-32. Aquí se comprueba
//   la parte visible, que al volver a abrir la app no hay duplicados.

const defaultTasks = [
  { name: 'Superficies', frequency: 'Semanal, en fin de semana' },
  { name: 'Baño', frequency: 'Cada 3 días desde la última vez' },
  { name: 'Aspirar cosas de Cati', frequency: 'Fin de semana cada 15 días' },
  { name: 'Cristales y espejos', frequency: 'Cada 30 días desde la última vez' },
  { name: 'Cepillar suelo', frequency: 'Puntual' },
  { name: 'Limpiar juntas', frequency: 'Puntual' },
]

function taskList(page: Page) {
  return page.getByRole('list', { name: 'Tus tareas' }).getByRole('listitem').filter({
    has: page.getByRole('heading', { level: 3 }),
  })
}

test.describe('US-27 · Mis tareas por defecto', () => {
  test('al entrar por primera vez ya tengo mis 6 tareas, con su frecuencia', async ({ page }) => {
    await signIn(page, uniqueEmail())

    // Por su nombre, no por su posición: el orden depende del día (US-29).
    const items = taskList(page)
    await expect(items).toHaveCount(6)
    for (const { name, frequency } of defaultTasks) {
      await expect(task(page, name)).toContainText(frequency)
    }
  })

  test('Superficies muestra sus partes con su peso', async ({ page }) => {
    await signIn(page, uniqueEmail())

    const surfaces = taskList(page).filter({ hasText: 'Superficies' })
    await expect(surfaces).toContainText('Cocina 50 %')
    await expect(surfaces).toContainText('Salón 25 %')
    await expect(surfaces).toContainText('Dormitorio 25 %')
  })

  test('al volver a abrir la app siguen siendo las mismas 6, sin duplicados', async ({
    context,
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await expect(taskList(page)).toHaveCount(6)

    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/')

    await expect(taskList(reopened)).toHaveCount(6)
  })
})
