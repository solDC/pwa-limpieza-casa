import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Screen } from '../../components/Screen'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { householdDisplayName } from '../../domain/language'
import { useLanguage } from '../../i18n/language-context'
import { signOut, type Session } from '../../storage/auth'
import { getMyHousehold, type Household } from '../../storage/households'
import { HistoryScreen } from '../history/HistoryScreen'
import { TaskList } from '../tasks/TaskList'

type HouseholdState =
  | { status: 'loading' }
  | { status: 'loaded'; household: Household | null }
  | { status: 'error'; error: ErrorCode }

// Pantalla de Inicio: dice con qué email has entrado (US-01), muestra tu hogar (US-02) y
// sus tareas (src/features/tasks/), y deja cerrar la sesión (US-03) y cambiar el idioma (US-52).
// Desde «Tus tareas» se abre el histórico (US-31), en lugar del Inicio, hasta «Volver». El
// Inicio no se desmonta, solo se oculta: así, al volver, sigue lo que se estaba escribiendo
// en un formulario, la lista no se vuelve a cargar y la página vuelve a donde estaba.
export function HomeScreen({ session }: { session: Session }) {
  const { language, t } = useLanguage()
  const [state, setState] = useState<HouseholdState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<ErrorCode | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  // Al volver del histórico, el foco vuelve a «Histórico» en lugar de perderse, y la página,
  // a donde estaba (`scrollBeforeHistory`, `null` si no se viene del histórico).
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const scrollBeforeHistory = useRef<number | null>(null)
  useEffect(() => {
    if (!showHistory && scrollBeforeHistory.current !== null) {
      historyButtonRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, scrollBeforeHistory.current)
      scrollBeforeHistory.current = null
    }
  }, [showHistory])

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      // Si va bien, la sesión cambia y la app pasa sola a la pantalla de entrar.
      await signOut()
    } catch (error) {
      setSignOutError(errorCode(error, 'signOutFailed'))
      setSigningOut(false)
    }
  }

  useEffect(() => {
    let active = true
    getMyHousehold()
      .then((household) => active && setState({ status: 'loaded', household }))
      .catch((error: unknown) => active && setState({ status: 'error', error: errorCode(error, 'householdLoad') }))
    return () => {
      active = false
    }
  }, [])

  return (
    <Screen>
      {showHistory && <HistoryScreen onBack={() => setShowHistory(false)} />}
      <div hidden={showHistory}>
        <p>{t.home.signedInAs(session.email)}</p>

        {state.status === 'loading' && <p className="muted">{t.home.loadingHousehold}</p>}
        {state.status === 'error' && <ErrorMessage>{t.errors[state.error]}</ErrorMessage>}
        {state.status === 'loaded' && state.household && (
          <section className="card">
            <h2>{householdDisplayName(state.household.name, language)}</h2>
          </section>
        )}

        <TaskList
          householdId={state.status === 'loaded' ? state.household?.id : undefined}
          historyButtonRef={historyButtonRef}
          onOpenHistory={() => {
            scrollBeforeHistory.current = window.scrollY
            setShowHistory(true)
          }}
        />

        <div className="stack account">
          <button
            type="button"
            className="button-secondary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? t.home.signingOut : t.home.signOut}
          </button>
          {signOutError && <ErrorMessage>{t.errors[signOutError]}</ErrorMessage>}
          <LanguageSwitch />
        </div>
      </div>
    </Screen>
  )
}
