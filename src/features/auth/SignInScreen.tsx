import { useState, type FormEvent } from 'react'
import { sendMagicLink, takeSignInErrorFromUrl } from '../../storage/auth'

type Step =
  | { name: 'form'; error: string | null }
  | { name: 'sending' }
  | { name: 'sent'; email: string }

// US-01 · Entrar con enlace mágico.
export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>(() => ({ name: 'form', error: takeSignInErrorFromUrl() }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim()
    setStep({ name: 'sending' })
    try {
      await sendMagicLink(cleanEmail)
      setStep({ name: 'sent', email: cleanEmail })
    } catch (error) {
      setStep({ name: 'form', error: (error as Error).message })
    }
  }

  return (
    <main className="app">
      <h1>Limpieza casa</h1>

      {step.name === 'sent' ? (
        <section className="card" aria-live="polite">
          <h2>Revisa tu correo</h2>
          <p>
            Te hemos enviado un enlace a <strong>{step.email}</strong>. Ábrelo en este dispositivo
            para entrar.
          </p>
          <p className="muted">Si no lo ves en unos minutos, mira en la carpeta de spam.</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setStep({ name: 'form', error: null })}
          >
            Usar otro email
          </button>
        </section>
      ) : (
        <form className="card" onSubmit={handleSubmit}>
          <h2>Entrar</h2>
          <p>Escribe tu email y te enviaremos un enlace para entrar. Sin contraseñas.</p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={step.name === 'sending'}
          />

          <button type="submit" disabled={step.name === 'sending'}>
            {step.name === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
          </button>

          {step.name === 'form' && step.error && (
            <p className="error" role="alert">
              {step.error}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
