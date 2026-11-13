import { expect, test, type Page } from '@playwright/test'
import { signIn, task } from './helpers/app'
import {
  accountLanguage,
  removeAccountLanguage,
  setAllTasksCreatedOn,
  setTaskCreatedOn,
} from './helpers/database'
import { uniqueEmail, waitBeforeNextEmail, waitForSignInEmail } from './helpers/mailbox'

// US-52 · La app en inglés y en castellano (#85)
//
// Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
// El resto de pruebas e2e usan el navegador en castellano (playwright.config.ts); aquí se
// cambia el idioma del navegador con test.use({ locale }).
// Los textos de las fechas y de cada tarea se prueban también en
// tests/unit/domain/language.test.ts.

function languageButton(page: Page, name: 'Español' | 'English') {
  return page.getByRole('button', { name, exact: true })
}

/** Entra con el enlace del email, con la app en inglés. */
async function signInInEnglish(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send me the code' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  const signInEmail = await waitForSignInEmail(email)
  await page.goto(signInEmail.link)
  await expect(page.getByText(`You are signed in as ${email}.`)).toBeVisible()
  return signInEmail
}

test.describe('US-52 · La primera vez, la app sale en el idioma del dispositivo', () => {
  test.describe('con el dispositivo en castellano', () => {
    test.use({ locale: 'es-AR' })

    test('sale en castellano', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'Limpieza de casa' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
      await expect(page).toHaveTitle('Limpieza de casa')
      await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    })
  })

  test.describe('con el dispositivo en inglés', () => {
    test.use({ locale: 'en-GB' })

    test('sale en inglés', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'House Cleaning' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
      await expect(page).toHaveTitle('House Cleaning')
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })
  })

  test.describe('con el dispositivo en otro idioma', () => {
    test.use({ locale: 'fr-FR' })

    test('sale en inglés', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    })
  })
})

test.describe('US-52 · Puedo cambiar el idioma, y se mantiene', () => {
  test('en la pantalla de entrar, y sigue al volver a abrir la app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(languageButton(page, 'Español')).toHaveAttribute('aria-pressed', 'true')

    await languageButton(page, 'English').click()

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(languageButton(page, 'English')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('group', { name: 'Language' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page).toHaveTitle('House Cleaning')
  })

  test('dentro de la app, junto a «Cerrar sesión», y vuelta al castellano', async ({ page }) => {
    await signIn(page, uniqueEmail())
    await expect(task(page, 'Superficies')).toBeVisible()

    await languageButton(page, 'English').click()

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await languageButton(page, 'Español').click()
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
    await expect(task(page, 'Superficies')).toBeVisible()
  })
})

test.describe('US-52 · En inglés, todos los textos salen en inglés', () => {
  test.use({ locale: 'en-US' })

  function englishTask(page: Page, name: string) {
    return page
      .getByRole('list', { name: 'Your tasks' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
  }

  test('entrar: las pantallas, el email y los errores', async ({ page }) => {
    const email = uniqueEmail()
    await page.goto('/')
    await expect(
      page.getByText('Enter your email and we will send you a code to sign in. No passwords.'),
    ).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send me the code' }).click()

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText('with a code. Enter it here to sign in.')).toBeVisible()
    await expect(page.getByText('You can also tap the link in the email.')).toBeVisible()

    // El email de una cuenta nueva sale en el idioma de la app.
    const signInEmail = await waitForSignInEmail(email)
    expect(signInEmail.subject).toBe(`Your House Cleaning code: ${signInEmail.code}`)

    const wrongCode = signInEmail.code === '000000' ? '111111' : '000000'
    await page.getByLabel('Code from the email').fill(wrongCode)
    await page.getByRole('button', { name: 'Sign in with the code' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'The code is not correct or has expired. Check it or ask for another email.',
    )

    await page.getByLabel('Code from the email').fill(signInEmail.code)
    await page.getByRole('button', { name: 'Sign in with the code' }).click()
    await expect(page.getByText(`You are signed in as ${email}.`)).toBeVisible()
  })

  test('la lista: el hogar, las tareas por defecto y sus partes, y marcar una', async ({ page }) => {
    await signInInEnglish(page, uniqueEmail())

    await expect(page.getByRole('heading', { level: 2, name: 'My home' })).toBeVisible()
    await expect(
      page
        .getByRole('list', { name: 'Your tasks' })
        .getByRole('listitem')
        .getByRole('heading', { level: 3 }),
    ).toHaveText(
      [
        'Bathroom',
        'Windows and mirrors',
        'Scrub the floor',
        'Clean the grout',
        'Surfaces',
        'Vacuum Cati’s things',
      ],
      { ignoreCase: false, useInnerText: true },
    )
    await expect(englishTask(page, 'Surfaces')).toContainText('Weekly, at the weekend')
    await expect(englishTask(page, 'Surfaces')).toContainText(
      'Kitchen 50 % · Living room 25 % · Bedroom 25 %',
    )
    await expect(englishTask(page, 'Bathroom')).toContainText('Every 3 days since the last time')
    await expect(englishTask(page, 'Bathroom')).toContainText('Due: today')
    await expect(englishTask(page, 'Scrub the floor')).toContainText('One-off')
    await expect(englishTask(page, 'Scrub the floor')).toContainText('No date')
    await expect(englishTask(page, 'Vacuum Cati’s things')).toContainText('Every other weekend')

    await englishTask(page, 'Scrub the floor').getByRole('button', { name: 'Mark as done' }).click()
    await expect(englishTask(page, 'Scrub the floor')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('añadir una tarea: el formulario, sus avisos y la tarea, que se ve como la escribo', async ({
    page,
  }) => {
    await signInInEnglish(page, uniqueEmail())
    await page.getByRole('button', { name: 'Add task' }).click()
    const form = page.getByRole('form', { name: 'New task' })

    await form.getByRole('button', { name: 'Save task' }).click()
    await expect(form).toContainText('Enter the name of the task.')
    await expect(form).toContainText('Choose how often it is due.')

    await form.getByLabel('Name').fill('Deep-clean the kitchen')
    await form.getByLabel('Every N days since the last time').check()
    await form.getByLabel('Every how many days').fill('7')
    await form.getByRole('button', { name: 'Add part' }).click()
    await form.getByLabel('Part 1', { exact: true }).fill('Oven')
    await form.getByRole('button', { name: 'Add part' }).click()
    await form.getByLabel('Part 2', { exact: true }).fill('Fridge')
    await expect(form).toContainText('If you don’t change the weights, all parts count the same.')
    await form.getByLabel('Weight of part 1', { exact: true }).fill('60')
    // Los avisos ya se ven (se ha intentado guardar): el de la suma sale al momento.
    await expect(form).toContainText('The weights must add up to 100 % (now they add up to 110 %).')
    await form.getByLabel('Weight of part 2', { exact: true }).fill('40')
    await expect(form).toContainText('Total: 100 %')
    await form.getByRole('button', { name: 'Save task' }).click()

    await expect(page.getByRole('status')).toHaveText('Task added: Deep-clean the kitchen.')
    const added = englishTask(page, 'Deep-clean the kitchen')
    await expect(added).toContainText('Every 7 days since the last time')
    await expect(added).toContainText('Oven 60 % · Fridge 40 %')

    // En castellano, la tarea que he escrito yo sigue igual; las de por defecto cambian.
    await languageButton(page, 'Español').click()
    await expect(task(page, 'Deep-clean the kitchen')).toContainText('Oven 60 % · Fridge 40 %')
    await expect(task(page, 'Baño')).toBeVisible()
  })

  test('las fechas también salen en inglés', async ({ page }) => {
    const email = uniqueEmail()
    await page.clock.setFixedTime(new Date('2026-10-28T12:00:00+01:00')) // un miércoles
    await signInInEnglish(page, email)
    await setAllTasksCreatedOn(email, '2026-10-01')
    await setTaskCreatedOn(email, 'Baño', '2026-10-26')
    await setTaskCreatedOn(email, 'Cristales y espejos', '2026-10-30')
    await page.reload()

    await expect(englishTask(page, 'Surfaces')).toContainText(
      'Overdue 3 days (was due the weekend of 24 Oct)',
    )
    await expect(englishTask(page, 'Bathroom')).toContainText('Overdue 2 days (was due Mon 26 Oct)')
    await expect(englishTask(page, 'Windows and mirrors')).toContainText('Due: Fri 30 Oct')
    await expect(englishTask(page, 'Vacuum Cati’s things')).toContainText('Due: weekend of 5 Dec')

    await page.getByRole('button', { name: 'Add task' }).click()
    const form = page.getByRole('form', { name: 'New task' })
    await form.getByLabel('Every other weekend').check()
    await expect(form.getByLabel('Weekend of 31 Oct')).toBeChecked()
    await expect(form.getByLabel('Weekend of 7 Nov')).toBeVisible()
  })
})

test.describe('US-52 · El email para entrar, en el idioma de la cuenta', () => {
  test('una cuenta en castellano que pasa la app a inglés recibe el siguiente email en inglés', async ({
    page,
  }) => {
    const email = uniqueEmail()
    const first = await signIn(page, email)
    expect(first.subject).toBe(`Tu acceso a Limpieza de casa: ${first.code}`)
    expect(await accountLanguage(email)).toBe('es')

    await languageButton(page, 'English').click()
    // La app guarda el idioma en la cuenta.
    await expect.poll(() => accountLanguage(email)).toBe('en')

    await page.getByRole('button', { name: 'Sign out' }).click()
    await waitBeforeNextEmail(page)
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send me the code' }).click()
    const second = await waitForSignInEmail(email, { after: first })

    expect(second.subject).toBe(`Your House Cleaning code: ${second.code}`)
  })

  // Las cuentas creadas antes de esta historia (como la de Sol) no tienen idioma guardado.
  test('una cuenta sin idioma guardado recibe el email en castellano, y la app lo guarda al entrar', async ({
    page,
  }) => {
    const email = uniqueEmail()
    const first = await signIn(page, email)
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await removeAccountLanguage(email)
    expect(await accountLanguage(email)).toBeNull()

    await waitBeforeNextEmail(page)
    const second = await signIn(page, email, first)

    expect(second.subject).toBe(`Tu acceso a Limpieza de casa: ${second.code}`)
    await expect.poll(() => accountLanguage(email)).toBe('es')
  })
})
