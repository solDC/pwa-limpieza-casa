import { SignInScreen } from './features/auth/SignInScreen'
import { useSession } from './features/auth/use-session'
import { HomeScreen } from './features/home/HomeScreen'
import { isSupabaseConfigured } from './storage/supabase-client'

export default function App() {
  return isSupabaseConfigured ? <AppWithSession /> : <MissingConfiguration />
}

function AppWithSession() {
  const state = useSession()

  if (state.status === 'loading') {
    return (
      <main className="app">
        <h1>Limpieza casa</h1>
        <p className="muted">Cargando…</p>
      </main>
    )
  }
  if (state.status === 'signed-out') return <SignInScreen />
  return <HomeScreen session={state.session} />
}

// Solo se ve si falta configurar Supabase (en local: .env; en Vercel: variables de entorno).
function MissingConfiguration() {
  return (
    <main className="app">
      <h1>Limpieza casa</h1>
      <p className="error" role="alert">
        Falta configurar la conexión con la base de datos (VITE_SUPABASE_URL y
        VITE_SUPABASE_ANON_KEY).
      </p>
    </main>
  )
}
