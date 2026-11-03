import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail, waitForMagicLink } from './helpers/mailbox'

// US-01 · Entrar con enlace mágico (#2)
// US-02 · Hogar creado automáticamente (#3)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.

async function signIn(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.goto(await waitForMagicLink(email))
}

test.describe('US-01 · Entrar con enlace mágico', () => {
  test('escribo mi email, recibo un enlace y al abrirlo entro en la app', async ({ page }) => {
    const email = uniqueEmail()
    await signIn(page, email)

    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  })

  test('la sesión se mantiene al cerrar y volver a abrir la app', async ({ context, page }) => {
    const email = uniqueEmail()
    await signIn(page, email)
    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()

    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/')

    await expect(reopened.getByText(`Has entrado como ${email}.`)).toBeVisible()
    await expect(reopened.getByLabel('Email')).toHaveCount(0)
  })

  // Regresión: Supabase solo deja volver a direcciones de su lista (Redirect URLs), que
  // tienen la forma «https://dominio/**». Una dirección sin barra final («https://dominio»)
  // no encaja, y Supabase manda al usuario a la Site URL (producción) sin avisar.
  // En local no se nota porque localhost siempre se acepta: por eso se comprueba el enlace.
  test('el enlace vuelve a la misma dirección de la app, con la barra final', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail()
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click()

    const link = new URL(await waitForMagicLink(email))
    expect(link.searchParams.get('redirect_to')).toBe(new URL('/', baseURL).href)
  })

  test('sin sesión, la app pide el email', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('un enlace caducado avisa y deja pedir otro', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=otp_expired&error_description=expired')

    await expect(page.getByRole('alert')).toHaveText(
      'El enlace ha caducado o ya se ha usado. Pide uno nuevo.',
    )
    await expect(page.getByLabel('Email')).toBeVisible()
    expect(page.url()).not.toContain('error')
  })

  // Regresión: supabase-js marca los errores 5xx del servidor igual que un fallo de red,
  // y la app pedía revisar la conexión cuando el problema era de Supabase.
  test('si Supabase falla al enviar el enlace, la app no culpa a la conexión', async ({ page }) => {
    await page.route('**/auth/v1/otp*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, error_code: 'unexpected_failure', msg: 'Error' }),
      }),
    )
    await page.goto('/')
    await page.getByLabel('Email').fill(uniqueEmail())
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'No se ha podido enviar el enlace. Inténtalo de nuevo.',
    )
  })
})

test.describe('US-02 · Hogar creado automáticamente', () => {
  test('al entrar por primera vez ya tengo mi hogar', async ({ page }) => {
    await signIn(page, uniqueEmail())

    await expect(page.getByRole('heading', { name: 'Mi casa' })).toBeVisible()
  })
})
