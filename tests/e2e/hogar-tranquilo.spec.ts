import { expect, test } from '@playwright/test'
import { newTaskForm, openTaskActions, signIn, task, taskActions } from './helpers/app'
import { uniqueEmail } from './helpers/mailbox'

test('acceso y ajustes en ambos idiomas, sin desbordamiento a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bienvenida' })).toBeVisible()
  await expect(page.getByText('Tu casa, a tu ritmo.')).toBeVisible()
  await expect(page.getByText('Acceso sin contraseña')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await expect(page.getByText('Your home, at your pace.')).toBeVisible()
  await expect(page.getByText('Password-free sign-in')).toBeVisible()
  await page.getByRole('button', { name: 'Español' }).click()

  await signIn(page, uniqueEmail())
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByText('Last 4 weeks')).toBeVisible()
  await expect(page.getByRole('button', { name: 'What’s due' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
})

test('el menú de tarea flota, se cierra fuera y devuelve el foco con Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await signIn(page, uniqueEmail())
  const card = task(page, 'Superficies')
  const actions = taskActions(card)
  const move = card.getByRole('button', { name: 'Mover Superficies a otro finde' })
  const parts = card.getByRole('button', { name: 'Partes' })
  await expect(parts).toHaveAttribute('aria-expanded', 'false')
  await expect(card.getByRole('list', { name: 'Partes' })).toBeHidden()

  const height = (await card.boundingBox())!.height
  await openTaskActions(card)
  await expect(move).toBeVisible()
  expect((await card.boundingBox())!.height).toBe(height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)

  await move.focus()
  await page.keyboard.press('Escape')
  await expect(move).toBeHidden()
  await expect(actions).toBeFocused()
  await openTaskActions(card)
  await card.getByRole('heading', { name: 'Superficies' }).click()
  await expect(move).toBeHidden()

  await parts.click()
  await expect(card.getByRole('list', { name: 'Partes' })).toBeVisible()
})

test('al alternar pestañas se recuperan el borrador, el foco y el desplazamiento', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 645 })
  await signIn(page, uniqueEmail())
  const history = page.getByRole('button', { name: 'Histórico' })
  const due = page.getByRole('button', { name: 'Qué toca' })
  await page.getByRole('button', { name: 'Añadir tarea' }).click()
  const form = newTaskForm(page)
  await form.getByLabel('Puntual').check()
  const name = form.getByLabel('Nombre', { exact: true })
  await name.fill('Limpiar el horno')
  await page.evaluate(() => window.scrollTo(0, 180))
  const previous = await page.evaluate(() => window.scrollY)
  expect(previous).toBeGreaterThan(0)

  await history.click()
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeFocused()
  await history.click()
  await due.click()

  await expect(name).toHaveValue('Limpiar el horno')
  await expect(name).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(previous)
})
