import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail, waitForSignInEmail } from './helpers/mailbox'

// US-26 · Entrar con código desde la app instalada (#29)
//
// En el iPhone, la app instalada no recibe la sesión del enlace del email (iOS lo abre
// en Safari). Por eso el email trae también un código que se escribe en la app.
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.

async function requestEmail(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
}

test.describe('US-26 · Entrar con código desde la app instalada', () => {
  test('el email trae el enlace y también un código de 6 dígitos', async ({ page }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)

    const signInEmail = await waitForSignInEmail(email)
    expect(signInEmail.subject).toBe('Tu acceso a Limpieza de casa')
    expect(signInEmail.link).toContain('/auth/v1/verify')
    expect(signInEmail.code).toMatch(/^\d{6}$/)
  })

  test('escribo el código en «Revisa tu correo» y entro sin salir de la app', async ({ page }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)
    const { code } = await waitForSignInEmail(email)

    await page.getByLabel('Código del email').fill(code)
    await page.getByRole('button', { name: 'Entrar con el código' }).click()

    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mi casa' })).toBeVisible()
  })

  test('el enlace sigue funcionando igual: no hace falta escribir el código', async ({ page }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)
    const { link } = await waitForSignInEmail(email)

    await page.goto(link)

    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  })

  test('si el código es incorrecto, la app lo dice y deja intentarlo de nuevo', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)
    const { code } = await waitForSignInEmail(email)
    const wrongCode = code === '000000' ? '111111' : '000000'

    await page.getByLabel('Código del email').fill(wrongCode)
    await page.getByRole('button', { name: 'Entrar con el código' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'El código no es correcto o ha caducado. Revísalo o pide otro email.',
    )
    await expect(page.getByLabel('Código del email')).toBeVisible()

    await page.getByLabel('Código del email').fill(code)
    await page.getByRole('button', { name: 'Entrar con el código' }).click()
    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  })

  test('desde «Revisa tu correo» puedo volver a pedir otro email', async ({ page }) => {
    await requestEmail(page, uniqueEmail())

    await page.getByRole('button', { name: 'Usar otro email' }).click()

    await expect(page.getByLabel('Email')).toBeVisible()
  })
})
