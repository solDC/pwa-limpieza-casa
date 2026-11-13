import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Screen } from '../../components/Screen'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { householdDisplayName } from '../../domain/language'
import { useLanguage } from '../../i18n/language-context'
import { signOut, type Session } from '../../storage/auth'
import { getMyHousehold, type Household } from '../../storage/households'
import { TaskList } from '../tasks/TaskList'

type HouseholdState =
  | { status: 'loading' }
  | { status: 'loaded'; household: Household | null }
  | { status: 'error'; error: ErrorCode }

// Pantalla de Inicio: dice con qué email has entrado (US-01), muestra tu hogar (US-02) y
// sus tareas (src/features/tasks/), y deja cerrar la sesión (US-03) y cambiar el idioma (US-52).
export function HomeScreen({ session }: { session: Session }) {
  const { language, t } = useLanguage()
  const [state, setState] = useState<HouseholdState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<ErrorCode | null>(null)

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
    </Screen>
  )
}
