import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Screen } from '../../components/Screen'
import { signOut, type Session } from '../../storage/auth'
import { getMyHousehold, type Household } from '../../storage/households'
import { TaskList } from './TaskList'

type HouseholdState =
  | { status: 'loading' }
  | { status: 'loaded'; household: Household | null }
  | { status: 'error'; message: string }

// Pantalla provisional de Inicio: confirma que has entrado (US-01), muestra tu hogar (US-02)
// y sus tareas (US-27), y deja cerrar la sesión (US-03).
// Se sustituirá por «Qué toca» (US-29) y las demás.
export function HomeScreen({ session }: { session: Session }) {
  const [state, setState] = useState<HouseholdState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      // Si va bien, la sesión cambia y la app pasa sola a la pantalla de entrar.
      await signOut()
    } catch (error) {
      setSignOutError((error as Error).message)
      setSigningOut(false)
    }
  }

  useEffect(() => {
    let active = true
    getMyHousehold()
      .then((household) => active && setState({ status: 'loaded', household }))
      .catch((error: Error) => active && setState({ status: 'error', message: error.message }))
    return () => {
      active = false
    }
  }, [])

  return (
    <Screen>
      <p>Has entrado como {session.email}.</p>

      {state.status === 'loading' && <p className="muted">Cargando tu hogar…</p>}
      {state.status === 'error' && (
        <ErrorMessage>{state.message}</ErrorMessage>
      )}
      {state.status === 'loaded' && state.household && (
        <section className="card">
          <h2>{state.household.name}</h2>
        </section>
      )}

      <TaskList />

      <div className="stack account">
        <button
          type="button"
          className="button-secondary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        {signOutError && (
          <ErrorMessage>{signOutError}</ErrorMessage>
        )}
      </div>
    </Screen>
  )
}
