import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers/app'
import { uniqueEmail, waitBeforeNextEmail } from './helpers/mailbox'

// US-03 · Cerrar sesión (#4)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.

async function expectSignedOut(page: Page) {
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  // Lo que pide la historia: que nadie vea el hogar.
  await expect(page.getByRole('heading', { name: 'Mi casa' })).toHaveCount(0)
}

test.describe('US-03 · Cerrar sesión', () => {
  test('al cerrar sesión vuelvo a la pantalla de entrar y ya no se ve mi hogar', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail())

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()

    await expectSignedOut(page)
  })

  test('después de cerrar sesión, al volver a abrir la app sigo fuera', async ({
    context,
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expectSignedOut(page)

    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/')

    await expectSignedOut(reopened)
  })

  test('después de cerrar sesión puedo volver a entrar y veo mi mismo hogar', async ({
    page,
  }) => {
    const email = uniqueEmail()
    const first = await signIn(page, email)
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expectSignedOut(page)

    await waitBeforeNextEmail(page)
    await signIn(page, email, first)

    await expect(page.getByRole('heading', { name: 'Mi casa' })).toBeVisible()
  })

  // Sin conexión, Supabase no puede anular la sesión en el servidor, pero la borra igualmente
  // de este dispositivo: lo que importa para un dispositivo compartido es que nadie vea el hogar.
  test('sin conexión, la sesión se cierra igualmente en este dispositivo', async ({
    context,
    page,
  }) => {
    await signIn(page, uniqueEmail())
    await page.route('**/auth/v1/logout*', (route) => route.abort('internetdisconnected'))

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()

    await expectSignedOut(page)
    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/')
    await expectSignedOut(reopened)
  })
})
