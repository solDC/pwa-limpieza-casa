import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-28 · Frecuencias (#37)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
//
// Las reglas de cada frecuencia (plazos, años bisiestos, cambio de hora, terminar antes o
// después de tiempo) se prueban en tests/unit/domain/frequency.test.ts. Aquí se comprueba
// lo que se ve. «Cada N días cuenta desde que se terminó» solo se puede ver cuando se pueda
// marcar una tarea como hecha (US-30).

async function signIn(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
  await page.goto((await waitForSignInEmail(email)).link)
  await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
}

function task(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
}

test.describe('US-28 · Frecuencias', () => {
  test('la primera vez, las tareas de cada N días tocan desde hoy', async ({ page }) => {
    await signIn(page, uniqueEmail())

    await expect(task(page, 'Baño')).toContainText('Toca: hoy')
    await expect(task(page, 'Cristales y espejos')).toContainText('Toca: hoy')
  })

  test('las puntuales tocan desde hoy', async ({ page }) => {
    await signIn(page, uniqueEmail())

    await expect(task(page, 'Cepillar suelo')).toContainText('Toca: hoy')
    await expect(task(page, 'Limpiar juntas')).toContainText('Toca: hoy')
  })

  test('las de fin de semana dicen de qué finde son', async ({ page }) => {
    await signIn(page, uniqueEmail())

    const weekend = /Toca: finde del \d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/
    await expect(task(page, 'Superficies')).toContainText(weekend)
    await expect(task(page, 'Aspirar cosas de Cati')).toContainText(weekend)
  })
})
