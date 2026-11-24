import type { ReactNode } from 'react'
import { useLanguage } from '../i18n/language-context'

export function Screen({ children, variant }: { children: ReactNode; variant?: 'login' | 'home' }) {
  const { t } = useLanguage()
  return (
    <main className={variant ? `app app-${variant}` : 'app'}>
      {!variant && <h1>{t.appName}</h1>}
      {children}
    </main>
  )
}
