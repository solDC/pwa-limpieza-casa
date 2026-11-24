import { LANGUAGES, type Language } from '../domain/language'
import { useLanguage } from '../i18n/language-context'

function Flag({ language }: { language: Language }) {
  return (
    <svg className="language-flag" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      {language === 'es' ? (
        <>
          <path fill="#ad1519" d="M0 0h24v16H0z" />
          <path fill="#fabd00" d="M0 4h24v8H0z" />
          <path fill="#ad1519" d="M7 6h4v3l-2 2-2-2z" />
        </>
      ) : (
        <>
          <path fill="#012169" d="M0 0h24v16H0z" />
          <path stroke="#fff" strokeWidth="4" d="m0 0 24 16M24 0 0 16" />
          <path stroke="#c8102e" strokeWidth="1.5" d="m0 0 24 16M24 0 0 16" />
          <path stroke="#fff" strokeWidth="6" d="M12 0v16M0 8h24" />
          <path stroke="#c8102e" strokeWidth="3.5" d="M12 0v16M0 8h24" />
        </>
      )}
    </svg>
  )
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div className="language-switch" role="group" aria-label={t.language.label}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-label={t.language.names[option]}
          aria-pressed={option === language}
          onClick={() => setLanguage(option)}
        >
          <Flag language={option} />
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
