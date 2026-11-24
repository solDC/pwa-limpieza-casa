import { expect, type Locator, type Page } from '@playwright/test'
import { localDateIn } from '../../../src/domain/dates'
import { waitForSignInEmail, type SignInEmail } from './mailbox'

// Pasos comunes de las pruebas e2e. Necesitan Supabase en local: usan su buzón de pruebas.

/** Escribe el email en la pantalla de entrar y pide el código. */
export async function requestSignInEmail(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Continuar' }).click()
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
  await expect(page.getByRole('button', { name: 'Qué toca' })).toBeVisible()
  return signInEmail
}

/** La tarjeta de una tarea de «Tus tareas», por su nombre. */
export function task(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) })
}

/** Las partes de la tarjeta de una tarea (US-39), en su orden. */
export function taskParts(card: Locator) {
  return card.getByRole('list', { name: /^(Partes|Parts)$/ }).getByRole('listitem')
}

/** Los nombres de las tareas de «Tus tareas», en el orden en que salen. */
export function taskNames(page: Page) {
  return page
    .getByRole('list', { name: 'Tus tareas' })
    .getByRole('listitem')
    .getByRole('heading', { level: 3 })
}

/** El formulario «Nueva tarea» (US-33). */
export function newTaskForm(page: Page) {
  return page.getByRole('form', { name: 'Nueva tarea' })
}

/** Hoy en Madrid, con el reloj de verdad: el día que apunta la base de datos. */
export function todayInMadrid(): string {
  return localDateIn('Europe/Madrid', new Date())
}

export async function openSettings(page: Page) {
  const toggle = page.getByRole('button', { name: /^(Ajustes|Settings)$/ })
  // El selector de la pantalla de acceso no está dentro de Ajustes.
  const login = page.getByRole('heading', { name: /^(Bienvenida|Welcome)$/ })
  await expect(toggle.or(login)).toBeVisible()
  if (await toggle.isVisible() && (await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click()
  }
}

export function taskActions(card: Locator) {
  return card.getByRole('button', { name: /^(Acciones de |Actions for )/ })
}

export async function openTaskActions(card: Locator) {
  const toggle = taskActions(card)
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}

export async function openTaskParts(card: Locator) {
  const toggle = card.getByRole('button', { name: /^(Partes|Parts)$/ })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}
