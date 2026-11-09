import { expect, type Page } from '@playwright/test'
import { waitForSignInEmail, type SignInEmail } from './mailbox'

// Pasos comunes de las pruebas e2e. Necesitan Supabase en local: usan su buzón de pruebas.

/** Escribe el email en la pantalla de entrar y pide el código. */
export async function requestSignInEmail(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme el código' }).click()
}

/**
 * Entra con el enlace del email y espera a la pantalla de Inicio.
 * Con `after`, espera a un email más nuevo que ese (para entrar por segunda vez).
 */
export async function signIn(page: Page, email: string, after?: SignInEmail): Promise<SignInEmail> {
  await requestSignInEmail(page, email)
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
  const signInEmail = await waitForSignInEmail(email, { after })
  await page.goto(signInEmail.link)
  await expect(page.getByText(`Has entrado como ${email}.`)).toBeVisible()
  return signInEmail
}

/** La tarjeta de una tarea de «Tus tareas», por su nombre. */
export function task(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
}
