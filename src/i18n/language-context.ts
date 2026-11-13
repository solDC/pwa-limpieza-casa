import { createContext, useContext } from 'react'
import type { Language } from '../domain/language'
import { messages, type Messages } from './messages'

export type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
  /** Los textos de las pantallas en el idioma elegido. */
  t: Messages
}

// Sin proveedor (no debería pasar), castellano.
export const LanguageContext = createContext<LanguageState>({
  language: 'es',
  setLanguage: () => {},
  t: messages.es,
})

/** El idioma elegido, sus textos y cómo cambiarlo (US-52). */
export function useLanguage(): LanguageState {
  return useContext(LanguageContext)
}
