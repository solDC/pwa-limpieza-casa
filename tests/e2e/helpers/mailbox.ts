import { randomUUID } from 'node:crypto'

// Buzón de pruebas de Supabase local (Mailpit): ahí llegan los emails que envía
// Supabase Auth en desarrollo, en lugar de salir a internet.
const mailpitUrl = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

/** Email único para cada prueba, para que no se mezclen los usuarios ni los correos. */
export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.test`
}

type MailpitSearch = { messages: { ID: string }[] }
type MailpitMessage = { Text: string; HTML: string }

/** Espera a que llegue el enlace mágico a ese email y lo devuelve. */
export async function waitForMagicLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const query = encodeURIComponent(`to:"${email}"`)

  while (Date.now() < deadline) {
    const search = (await (
      await fetch(`${mailpitUrl}/api/v1/search?query=${query}`)
    ).json()) as MailpitSearch

    const latest = search.messages[0]
    if (latest) {
      const message = (await (
        await fetch(`${mailpitUrl}/api/v1/message/${latest.ID}`)
      ).json()) as MailpitMessage
      const link = findVerifyLink(message.Text) ?? findVerifyLink(message.HTML)
      if (link) return link
      throw new Error(`El email a ${email} no contiene un enlace de acceso`)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No ha llegado ningún email a ${email} en ${timeoutMs / 1000} s`)
}

function findVerifyLink(content: string | undefined): string | null {
  const match = content?.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/)
  return match ? match[0].replaceAll('&amp;', '&') : null
}
