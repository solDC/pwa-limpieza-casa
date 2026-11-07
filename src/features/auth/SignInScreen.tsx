import { useState, type FormEvent } from 'react'
import { sendMagicLink, takeSignInErrorFromUrl, verifyEmailCode } from '../../storage/auth'

type Step =
  | { name: 'form'; error: string | null }
  | { name: 'sending' }
  | {
      name: 'sent'
      email: string
      error: string | null
      notice: string | null
      // Mientras se comprueba el código o se reenvía el email, los botones se desactivan.
      busy: 'checking' | 'resending' | null
    }

type SentStep = Extract<Step, { name: 'sent' }>

// Longitud máxima del código: Supabase lo genera de 6 dígitos, pero admite hasta 10.
const maxCodeLength = 10

// US-01 · Entrar con enlace mágico.
// US-26 · Entrar con el código del email, para la app instalada en el iPhone.
export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>(() => ({ name: 'form', error: takeSignInErrorFromUrl() }))

  // Actualiza «Revisa tu correo» solo si sigue en pantalla para el mismo email: si mientras
  // tanto se ha cambiado de email, una respuesta que llega tarde no lo deshace.
  function updateSent(sentTo: string, changes: Partial<SentStep>) {
    setStep((current) =>
      current.name === 'sent' && current.email === sentTo ? { ...current, ...changes } : current,
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim()
    setStep({ name: 'sending' })
    try {
      await sendMagicLink(cleanEmail)
      setCode('')
      setStep({ name: 'sent', email: cleanEmail, error: null, notice: null, busy: null })
    } catch (error) {
      setStep({ name: 'form', error: (error as Error).message })
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step.name !== 'sent') return
    const sentTo = step.email
    updateSent(sentTo, { error: null, notice: null, busy: 'checking' })
    try {
      // Si es correcto, la sesión cambia y la app pasa sola a la pantalla de Inicio.
      await verifyEmailCode(sentTo, code)
    } catch (error) {
      updateSent(sentTo, { error: (error as Error).message, busy: null })
    }
  }

  async function handleResend() {
    if (step.name !== 'sent') return
    const sentTo = step.email
    updateSent(sentTo, { error: null, notice: null, busy: 'resending' })
    try {
      await sendMagicLink(sentTo)
      setCode('')
      updateSent(sentTo, { notice: `Te hemos enviado otro email a ${sentTo}.`, busy: null })
    } catch (error) {
      updateSent(sentTo, { error: (error as Error).message, busy: null })
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
              placeholder="123456"
              value={code}
              // Sin maxLength: el navegador recortaría lo pegado («Tu código: 123456») antes
              // de quitar el texto. Primero se quitan las letras y después se recorta.
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, maxCodeLength))
              }
              disabled={step.busy !== null}
            />
            <button type="submit" disabled={step.busy !== null}>
              {step.busy === 'checking' ? 'Comprobando…' : 'Entrar con el código'}
            </button>
            {step.error && (
              <p className="error" role="alert">
                {step.error}
              </p>
            )}
            {step.notice && (
              <p className="notice" role="status">
                {step.notice}
              </p>
            )}
          </form>

          <p className="muted">
            Si no ves el email en unos minutos, mira en la carpeta de spam o pide otro.
          </p>
          <div className="stack">
            <button
              type="button"
              className="button-secondary"
              onClick={handleResend}
              disabled={step.busy !== null}
            >
              {step.busy === 'resending' ? 'Enviando…' : 'Enviarme otro email'}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setStep({ name: 'form', error: null })}
              disabled={step.busy !== null}
            >
              Usar otro email
            </button>
          </div>
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
