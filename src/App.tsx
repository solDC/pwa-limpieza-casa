import { useEffect } from 'react'
import { ErrorMessage } from './components/ErrorMessage'
import { UpdateNotice } from './features/app-update/UpdateNotice'
import { Screen } from './components/Screen'
import { SignInScreen } from './features/auth/SignInScreen'
import { useSession } from './features/auth/use-session'
import { HomeScreen } from './features/home/HomeScreen'
import { LanguageProvider } from './i18n/LanguageProvider'
import { useLanguage } from './i18n/language-context'
import { saveAccountLanguage } from './storage/auth'
import { isSupabaseConfigured } from './storage/supabase-client'

export default function App() {
  return (
    <LanguageProvider>
      {isSupabaseConfigured ? <AppWithSession /> : <MissingConfiguration />}
      <UpdateNotice />
    </LanguageProvider>
  )
}

function AppWithSession() {
  const state = useSession()
  const { language, t } = useLanguage()

  // US-52 · El idioma elegido se guarda también en la cuenta, para que el próximo email
  // para entrar salga en ese idioma.
  const accountLanguage = state.status === 'signed-in' ? state.session.language : undefined
  useEffect(() => {
    if (accountLanguage !== undefined && accountLanguage !== language) {
      saveAccountLanguage(language).catch(() => {})
    }
  }, [accountLanguage, language])

  if (state.status === 'loading') {
    return (
      <Screen>
        <p className="muted">{t.loading}</p>
      </Screen>
    )
  }
  if (state.status === 'signed-out') return <SignInScreen />
  return <HomeScreen session={state.session} />
}

// Solo se ve si falta configurar Supabase (en local: .env; en Vercel: variables de entorno).
function MissingConfiguration() {
  const { t } = useLanguage()
  return (
    <Screen>
      <ErrorMessage>{t.missingConfiguration}</ErrorMessage>
    </Screen>
  )
}
