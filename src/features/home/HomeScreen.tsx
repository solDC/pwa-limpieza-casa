import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { LineIcon } from '../../components/LineIcon'
import { Screen } from '../../components/Screen'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { useLanguage } from '../../i18n/language-context'
import { signOut } from '../../storage/auth'
import { getMyHousehold, type Household } from '../../storage/households'
import { HistoryScreen } from '../history/HistoryScreen'
import { TaskList } from '../tasks/TaskList'

type HouseholdState =
  | { status: 'loading' }
  | { status: 'loaded'; household: Household | null }
  | { status: 'error'; error: ErrorCode }

export function HomeScreen() {
  const { t } = useLanguage()
  const [state, setState] = useState<HouseholdState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<ErrorCode | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const dueTab = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const scrollBeforeHistory = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (showHistory) {
      window.scrollTo(0, 0)
    } else if (scrollBeforeHistory.current !== null) {
      const control = previousFocus.current
      if (control?.getClientRects().length && !control.matches(':disabled')) {
        control.focus({ preventScroll: true })
      } else {
        dueTab.current?.focus({ preventScroll: true })
      }
      window.scrollTo(0, scrollBeforeHistory.current)
      scrollBeforeHistory.current = null
    }
  }, [showHistory])

  function changeView(history: boolean) {
    if (showHistory === history) return
    setShowSettings(false)
    if (history) scrollBeforeHistory.current = window.scrollY
    setShowHistory(history)
  }

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
    <Screen variant="home">
      <div className="home-navigation">
        <header className="home-topbar">
          <h1 className="home-brand">{t.appName}</h1>
          <button
            type="button"
            className="icon-button home-settings-toggle"
            aria-label={t.home.settings}
            aria-expanded={showSettings}
            aria-controls="home-settings"
            onClick={() => setShowSettings((value) => !value)}
          >
            <LineIcon name="settings" />
          </button>
        </header>
        <section id="home-settings" className="home-settings card" aria-label={t.home.settings} hidden={!showSettings}>
          <LanguageSwitch />
          <button type="button" className="home-signout" onClick={handleSignOut} disabled={signingOut}>
            <LineIcon name="logout" />
            {signingOut ? t.home.signingOut : t.home.signOut}
          </button>
          {signOutError && <ErrorMessage>{t.errors[signOutError]}</ErrorMessage>}
        </section>
        <nav className="home-tabs" aria-label={t.home.sections}>
          <button ref={dueTab} type="button" aria-current={!showHistory ? 'page' : undefined} onClick={() => changeView(false)}>
            {t.home.due}
          </button>
          <button type="button" aria-current={showHistory ? 'page' : undefined} onClick={() => changeView(true)}>
            {t.history.title}
          </button>
        </nav>
      </div>
      {showHistory && <HistoryScreen />}
      <div hidden={showHistory} onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement) previousFocus.current = event.target
      }}>
        {state.status === 'loading' && <p className="muted">{t.home.loadingHousehold}</p>}
        {state.status === 'error' && <ErrorMessage>{t.errors[state.error]}</ErrorMessage>}
        <TaskList householdId={state.status === 'loaded' ? state.household?.id : undefined} active={!showHistory} />
      </div>
    </Screen>
  )
}
