import { useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Screen } from '../../components/Screen'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { useLanguage } from '../../i18n/language-context'
import { sendMagicLink, takeSignInErrorFromUrl, verifyEmailCode } from '../../storage/auth'

type Step =
  | { name: 'form'; error: ErrorCode | null }
  | { name: 'sending' }
  | {
      name: 'sent'
      email: string
      error: ErrorCode | null
      /** Si se ha reenviado el email. */
      resent: boolean
      // Mientras se comprueba el código o se reenvía el email, los botones se desactivan.
      busy: 'checking' | 'resending' | null
    }

type SentStep = Extract<Step, { name: 'sent' }>

// Longitud máxima del código: Supabase lo genera de 6 dígitos, pero admite hasta 10.
const maxCodeLength = 10

// US-01 · Entrar con enlace mágico.
// US-26 · Entrar con el código del email: sirve en cualquier dispositivo, también en la app
// instalada del iPhone, donde el enlace no funciona.
export function SignInScreen() {
  const { language, t } = useLanguage()
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
      await sendMagicLink(cleanEmail, language)
      setCode('')
      setStep({ name: 'sent', email: cleanEmail, error: null, resent: false, busy: null })
    } catch (error) {
      setStep({ name: 'form', error: errorCode(error, 'emailFailed') })
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step.name !== 'sent') return
    const sentTo = step.email
    updateSent(sentTo, { error: null, resent: false, busy: 'checking' })
    try {
      // Si es correcto, la sesión cambia y la app pasa sola a la pantalla de Inicio.
      await verifyEmailCode(sentTo, code)
    } catch (error) {
      updateSent(sentTo, { error: errorCode(error, 'codeServer'), busy: null })
    }
  }

  async function handleResend() {
    if (step.name !== 'sent') return
    const sentTo = step.email
    updateSent(sentTo, { error: null, resent: false, busy: 'resending' })
    try {
      await sendMagicLink(sentTo, language)
      setCode('')
      updateSent(sentTo, { resent: true, busy: null })
    } catch (error) {
      updateSent(sentTo, { error: errorCode(error, 'emailFailed'), busy: null })
    }
  }

  return (
    <Screen>
      {step.name === 'sent' ? (
        <section className="card" aria-live="polite">
          <h2>{t.signIn.checkEmail}</h2>
          <p>
            {t.signIn.sentBefore}
            <strong>{step.email}</strong>
            {t.signIn.sentAfter}
          </p>

          <form className="stack" onSubmit={handleCodeSubmit}>
            <label htmlFor="code">{t.signIn.code}</label>
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
              {step.busy === 'checking' ? t.signIn.checking : t.signIn.enter}
            </button>
            {step.error && <ErrorMessage>{t.errors[step.error]}</ErrorMessage>}
            {step.resent && (
              <p className="notice" role="status">
                {t.signIn.resent(step.email)}
              </p>
            )}
          </form>

          <p className="muted">{t.signIn.linkToo}</p>
          <p className="muted">{t.signIn.notArrived}</p>
          <div className="stack">
            <button
              type="button"
              className="button-secondary"
              onClick={handleResend}
              disabled={step.busy !== null}
            >
              {step.busy === 'resending' ? t.signIn.sending : t.signIn.resend}
            </button>
            <button
              type="button"
              className="button-link"
              onClick={() => setStep({ name: 'form', error: null })}
              disabled={step.busy !== null}
            >
              <span aria-hidden="true">← </span>
              {t.signIn.back}
            </button>
          </div>
        </section>
      ) : (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{t.signIn.title}</h2>
          <p>{t.signIn.intro}</p>

          <label htmlFor="email">{t.signIn.email}</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={t.signIn.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={step.name === 'sending'}
          />

          <button type="submit" disabled={step.name === 'sending'}>
            {step.name === 'sending' ? t.signIn.sending : t.signIn.send}
          </button>

          {step.name === 'form' && step.error && (
            <ErrorMessage>{t.errors[step.error]}</ErrorMessage>
          )}
        </form>
      )}
      <LanguageSwitch />
    </Screen>
  )
}
