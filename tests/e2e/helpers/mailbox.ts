import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'

// Buzón de pruebas de Supabase local (Mailpit): ahí llegan los emails que envía
// Supabase Auth en desarrollo, en lugar de salir a internet.
const mailpitUrl = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

/** Email único para cada prueba, para que no se mezclen los usuarios ni los correos. */
export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.test`
}

type MailpitSearch = { messages: { ID: string }[] }
type MailpitMessage = { Subject: string; Text: string; HTML: string }

export type SignInEmail = {
  /** Identificador del mensaje en el buzón, para poder esperar al siguiente. */
  id: string
  subject: string
  /** Enlace para entrar (US-01). */
  link: string
  /** Código para escribir en la app (US-26). */
  code: string
}

type WaitOptions = {
  timeoutMs?: number
  /** Espera a un email distinto de este (el siguiente, si se ha pedido otro). */
  after?: SignInEmail
}

/** Espera a que llegue el email para entrar y devuelve su enlace y su código. */
export async function waitForSignInEmail(
  email: string,
  { timeoutMs = 15_000, after }: WaitOptions = {},
): Promise<SignInEmail> {
  const deadline = Date.now() + timeoutMs
  const query = encodeURIComponent(`to:"${email}"`)

  while (Date.now() < deadline) {
    const search = (await (
      await fetch(`${mailpitUrl}/api/v1/search?query=${query}`)
    ).json()) as MailpitSearch

    // Mailpit devuelve primero el más reciente.
    const latest = search.messages[0]
    if (latest && latest.ID !== after?.id) {
      const message = (await (
        await fetch(`${mailpitUrl}/api/v1/message/${latest.ID}`)
      ).json()) as MailpitMessage
      const link = findVerifyLink(message.Text) ?? findVerifyLink(message.HTML)
      const code = message.Text.match(/código:\s*(\d{6,10})/i)?.[1]
      if (!link) throw new Error(`El email a ${email} no contiene un enlace de acceso`)
      if (!code) throw new Error(`El email a ${email} no contiene un código de acceso`)
      return { id: latest.ID, subject: message.Subject, link, code }
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No ha llegado ningún email a ${email} en ${timeoutMs / 1000} s`)
}

/** Espera a que llegue el email para entrar y devuelve su enlace. */
export async function waitForMagicLink(email: string, timeoutMs = 15_000): Promise<string> {
  return (await waitForSignInEmail(email, { timeoutMs })).link
}

function findVerifyLink(content: string | undefined): string | null {
  const match = content?.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/)
  return match ? match[0].replaceAll('&amp;', '&') : null
}

/**
 * Supabase no envía dos emails a la misma dirección con menos de `max_frequency` entre ellos
 * (1 s en local, ver supabase/config.toml; 60 s en la nube). Las pruebas van mucho más rápido
 * que una persona, así que esperan ese mínimo antes de pedir el segundo email.
 */
export async function waitBeforeNextEmail(page: Page): Promise<void> {
  await page.waitForTimeout(1_100)
}
