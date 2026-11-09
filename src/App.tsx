import { ErrorMessage } from './components/ErrorMessage'
import { UpdateNotice } from './features/app-update/UpdateNotice'
import { Screen } from './components/Screen'
import { SignInScreen } from './features/auth/SignInScreen'
import { useSession } from './features/auth/use-session'
import { HomeScreen } from './features/home/HomeScreen'
import { isSupabaseConfigured } from './storage/supabase-client'

export default function App() {
  return (
    <>
      {isSupabaseConfigured ? <AppWithSession /> : <MissingConfiguration />}
      <UpdateNotice />
    </>
  )
}

function AppWithSession() {
  const state = useSession()

  if (state.status === 'loading') {
    return (
      <Screen>
        <p className="muted">Cargando…</p>
      </Screen>
    )
  }
  if (state.status === 'signed-out') return <SignInScreen />
  return <HomeScreen session={state.session} />
}

// Solo se ve si falta configurar Supabase (en local: .env; en Vercel: variables de entorno).
function MissingConfiguration() {
  return (
    <Screen>
      <ErrorMessage>
        Falta configurar la conexión con la base de datos (VITE_SUPABASE_URL y
        VITE_SUPABASE_ANON_KEY).
      </ErrorMessage>
    </Screen>
  )
}
