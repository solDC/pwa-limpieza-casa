import { useEffect, useState } from 'react'
import type { Session } from '../../storage/auth'
import { getMyHousehold, type Household } from '../../storage/households'

type HouseholdState =
  | { status: 'loading' }
  | { status: 'loaded'; household: Household | null }
  | { status: 'error'; message: string }

// Pantalla provisional de Inicio: confirma que has entrado (US-01) y muestra tu hogar (US-02).
// Se sustituirá por «Qué toca hoy» (US-16) y las demás.
export function HomeScreen({ session }: { session: Session }) {
  const [state, setState] = useState<HouseholdState>({ status: 'loading' })

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
    <main className="app">
      <h1>Limpieza casa</h1>
      <p>Has entrado como {session.email}.</p>

      {state.status === 'loading' && <p className="muted">Cargando tu hogar…</p>}
      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'loaded' && state.household && (
        <section className="card">
          <h2>{state.household.name}</h2>
          <p className="muted">Aquí irán las tareas de tu hogar.</p>
        </section>
      )}
    </main>
  )
}
