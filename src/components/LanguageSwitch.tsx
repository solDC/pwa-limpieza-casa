import { LANGUAGES } from '../domain/language'
import { useLanguage } from '../i18n/language-context'

/** Para cambiar el idioma de la app (US-52). Cada idioma, con su nombre en ese idioma. */
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div className="language-switch" role="group" aria-label={t.language.label}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          className="button-link"
          lang={option}
          aria-pressed={option === language}
          onClick={() => setLanguage(option)}
        >
          {t.language.names[option]}
        </button>
      ))}
    </div>
  )
}
