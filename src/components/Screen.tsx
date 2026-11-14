import type { ReactNode } from 'react'
import { useLanguage } from '../i18n/language-context'

/** Una pantalla de la app, con su título: «Limpieza de casa» o «My House Cleaning». */
export function Screen({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  return (
    <main className="app">
      <h1>{t.appName}</h1>
      {children}
    </main>
  )
}
