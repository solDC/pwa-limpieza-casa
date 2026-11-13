import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { detectLanguage, LANGUAGES, type Language } from '../domain/language'
import { LanguageContext } from './language-context'
import { messages } from './messages'

const STORAGE_KEY = 'language'

/** El idioma guardado en este dispositivo o, la primera vez, el del dispositivo. */
function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (LANGUAGES.includes(saved as Language)) return saved as Language
  } catch {
    // Sin acceso al almacenamiento (navegación privada estricta): el del dispositivo.
  }
  return detectLanguage(navigator.language)
}

// US-52 · El idioma de la app: se elige una vez y se mantiene en este dispositivo.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const t = messages[language]

  // Para los lectores de pantalla (leen con la voz de ese idioma) y el título de la pestaña.
  useEffect(() => {
    document.documentElement.lang = language
    document.title = t.appName
  }, [language, t])

  const state = useMemo(
    () => ({
      language,
      t,
      setLanguage(next: Language) {
        setLanguageState(next)
        try {
          window.localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Si no se puede guardar, vale para esta vez.
        }
      },
    }),
    [language, t],
  )

  return <LanguageContext.Provider value={state}>{children}</LanguageContext.Provider>
}
