import { useState, type FormEvent } from 'react'
import { sendMagicLink, takeSignInErrorFromUrl, verifyEmailCode } from '../../storage/auth'

type Step =
  | { name: 'form'; error: string | null }
  | { name: 'sending' }
  | { name: 'sent'; email: string; codeError: string | null; checkingCode: boolean }

// US-01 · Entrar con enlace mágico.
// US-26 · Entrar con el código del email, para la app instalada en el iPhone.
export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>(() => ({ name: 'form', error: takeSignInErrorFromUrl() }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim()
    setStep({ name: 'sending' })
    try {
      await sendMagicLink(cleanEmail)
      setCode('')
      setStep({ name: 'sent', email: cleanEmail, codeError: null, checkingCode: false })
    } catch (error) {
      setStep({ name: 'form', error: (error as Error).message })
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step.name !== 'sent') return
    setStep({ ...step, codeError: null, checkingCode: true })
    try {
      // Si es correcto, la sesión cambia y la app pasa sola a la pantalla de Inicio.
      await verifyEmailCode(step.email, code.trim())
    } catch (error) {
      setStep({ ...step, codeError: (error as Error).message, checkingCode: false })
    }
  }

  return (
    <main className="app">
      <h1>Limpieza de casa</h1>

      {step.name === 'sent' ? (
        <section className="card" aria-live="polite">
          <h2>Revisa tu correo</h2>
          <p>
            Te hemos enviado un email a <strong>{step.email}</strong>. Pulsa el enlace para entrar.
          </p>

          <form className="stack" onSubmit={handleCodeSubmit}>
            <p className="muted">
              ¿Usas la app instalada en el iPhone? Escribe aquí el código que viene en el email.
            </p>
            <label htmlFor="code">Código del email</label>
            <input
              id="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              disabled={step.checkingCode}
            />
            <button type="submit" disabled={step.checkingCode}>
              {step.checkingCode ? 'Comprobando…' : 'Entrar con el código'}
            </button>
            {step.codeError && (
              <p className="error" role="alert">
                {step.codeError}
              </p>
            )}
          </form>

          <p className="muted">Si no ves el email en unos minutos, mira en la carpeta de spam.</p>
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
