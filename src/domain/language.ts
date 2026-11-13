// US-52 · La app en inglés y en castellano. TypeScript puro: el idioma llega como un dato.

export type Language = 'es' | 'en'

export const LANGUAGES: readonly Language[] = ['es', 'en']

/**
 * El idioma de la primera vez, según el del dispositivo (por ejemplo, 'es-ES'):
 * castellano si es castellano, e inglés en cualquier otro caso.
 */
export function detectLanguage(deviceLanguage: string | undefined): Language {
  return deviceLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** El nombre que la base de datos pone a un hogar nuevo. */
const DEFAULT_HOUSEHOLD_NAME = 'Mi casa'

/** El nombre del hogar: el de por defecto se ve en el idioma elegido; otro, tal cual. */
export function householdDisplayName(name: string, language: Language): string {
  if (name === DEFAULT_HOUSEHOLD_NAME && language === 'en') return 'My home'
  return name
}
