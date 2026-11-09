import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail, waitBeforeNextEmail, waitForSignInEmail } from './helpers/mailbox'

// US-26 · Entrar con código desde la app instalada (#29)
//
// El email trae un código, que sirve en cualquier dispositivo, y un enlace como atajo.
// En el iPhone, la app instalada no recibe la sesión del enlace (iOS lo abre en Safari):
// allí solo sirve el código.
// Casi todas necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// Las que simulan respuestas de Supabase con page.route no lo necesitan.

const wrongCodeError = 'El código no es correcto o ha caducado. Revísalo o pide otro email.'

async function requestEmail(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel('Código del email').fill(code)
  await page.getByRole('button', { name: 'Entrar con el código' }).click()
}

function wrongCodeFor(code: string): string {
  return code === '000000' ? '111111' : '000000'
}

// Simula que Supabase ha enviado el email, sin enviarlo: para las pruebas que no lo leen.
async function requestEmailWithoutSending(page: Page, email = uniqueEmail()) {
  await page.route('**/auth/v1/otp*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await requestEmail(page, email)
}

test.describe('US-26 · Entrar con código desde la app instalada', () => {
  test('el email trae un código de 6 dígitos, también en el asunto, y el enlace', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)

    const signInEmail = await waitForSignInEmail(email)
    expect(signInEmail.code).toMatch(/^\d{6}$/)
    expect(signInEmail.subject).toBe(`Tu acceso a Limpieza de casa: ${signInEmail.code}`)
    expect(signInEmail.link).toContain('/auth/v1/verify')
  })

  test('«Revisa tu correo» propone escribir el código, y el enlace como alternativa', async ({
    page,
  }) => {
    await requestEmailWithoutSending(page)

    await expect(page.getByText('con un código. Escríbelo aquí para entrar.')).toBeVisible()
    await expect(page.getByText('También puedes pulsar el enlace del email.')).toBeVisible()
    await expect(page.getByText('iPhone')).toHaveCount(0)
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

    await enterCode(page, wrongCodeFor(code))

    await expect(page.getByRole('alert')).toHaveText(wrongCodeError)
    await expect(page.getByLabel('Código del email')).toBeVisible()

    await enterCode(page, code)
    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  })

  test('si el código ya se ha usado o ha caducado, la app lo dice', async ({
    browser,
    baseURL,
    page,
  }) => {
    // Un código caducado tarda una hora en caducar; uno ya usado da el mismo error en Supabase.
    const email = uniqueEmail()
    await requestEmail(page, email)
    const first = await waitForSignInEmail(email)
    await enterCode(page, first.code)
    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()

    // Otro dispositivo, sin sesión, intenta entrar con el mismo código. No pide un email
    // de verdad: uno nuevo sustituiría al código y no se probaría que ya está usado.
    const otherDevice = await browser.newContext({ baseURL })
    const otherPage = await otherDevice.newPage()
    await requestEmailWithoutSending(otherPage, email)
    await enterCode(otherPage, first.code)

    await expect(otherPage.getByRole('alert')).toHaveText(wrongCodeError)
    await otherDevice.close()
  })

  test('si el código no sirve, puedo pedir otro email a la misma dirección y entrar con su código', async ({
    page,
  }) => {
    const email = uniqueEmail()
    await requestEmail(page, email)
    const first = await waitForSignInEmail(email)
    await enterCode(page, wrongCodeFor(first.code))
    await expect(page.getByRole('alert')).toHaveText(wrongCodeError)

    await waitBeforeNextEmail(page)
    await page.getByRole('button', { name: 'Reenviar email' }).click()

    await expect(page.getByRole('status')).toHaveText(`Te hemos enviado otro email a ${email}.`)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByLabel('Código del email')).toHaveValue('')

    const second = await waitForSignInEmail(email, { after: first })
    await enterCode(page, second.code)
    await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  })

  test('desde «Revisa tu correo» puedo cambiar de email', async ({ page }) => {
    await requestEmailWithoutSending(page)

    await page.getByRole('button', { name: 'Volver', exact: true }).click()

    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('si Supabase falla al comprobar el código, la app no dice que el código es incorrecto', async ({
    page,
  }) => {
    await requestEmailWithoutSending(page)
    await page.route('**/auth/v1/verify*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, error_code: 'unexpected_failure', msg: 'Error' }),
      }),
    )

    await enterCode(page, '123456')

    await expect(page.getByRole('alert')).toHaveText(
      'Algo ha fallado al comprobar el código. Inténtalo de nuevo en un momento.',
    )
  })

  test('si pego el código con texto alrededor, se queda solo el código', async ({ page }) => {
    await requestEmailWithoutSending(page)

    await page.getByLabel('Código del email').fill('Tu código: 123456')

    await expect(page.getByLabel('Código del email')).toHaveValue('123456')
  })

  test('mientras se comprueba el código, no se puede cambiar de email ni pedir otro', async ({
    page,
  }) => {
    await requestEmailWithoutSending(page)
    // La comprobación no responde hasta que la prueba lo decide.
    let answerVerify!: () => void
    const verifyAnswered = new Promise<void>((resolve) => (answerVerify = resolve))
    await page.route('**/auth/v1/verify*', async (route) => {
      await verifyAnswered
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{"code":403,"error_code":"otp_expired","msg":"Token has expired or is invalid"}',
      })
    })

    await enterCode(page, '123456')

    await expect(page.getByRole('button', { name: 'Comprobando…' })).toBeDisabled()
    await expect(page.getByLabel('Código del email')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Volver', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reenviar email' })).toBeDisabled()

    answerVerify()
    await expect(page.getByRole('alert')).toHaveText(wrongCodeError)
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
    // Tras la respuesta, todo vuelve a estar disponible.
    await expect(page.getByRole('button', { name: 'Entrar con el código' })).toBeEnabled()
    await expect(page.getByLabel('Código del email')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Volver', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Reenviar email' })).toBeEnabled()
  })
})
