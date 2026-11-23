import { useEffect, useRef } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { describeHistoryDay, describeOutcome, describeWeekendDays } from '../../domain/history'
import { taskDisplayName } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { useToday } from '../tasks/use-today'
import { useHistory } from './use-history'

// US-31 · «Histórico»: cómo acabó cada vuelta de las tareas, agrupado por día, de lo más
// reciente a lo más antiguo, de 4 en 4 semanas («Ver más»). Se abre desde «Tus tareas» y
// vuelve con «Volver».
export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { language, t } = useLanguage()
  const today = useToday()
  const { state, openedOn, loadMore } = useHistory(today)

  // Al abrirla, el foco va al título, para que los lectores de pantalla sepan dónde están.
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus()
  }, [])

  return (
    <section className="stack history" aria-labelledby="history-heading">
      <button type="button" className="button-link" onClick={onBack}>
        {t.history.back}
      </button>
      <h2 id="history-heading" ref={headingRef} tabIndex={-1}>
        {t.history.title}
      </h2>

      {state.status === 'loading' && <p className="muted">{t.history.loading}</p>}
      {state.status === 'error' && <ErrorMessage>{t.errors[state.error]}</ErrorMessage>}
      {state.status === 'loaded' && (
        <>
          {state.days.length === 0 && (
            <p className="muted">{state.hasMore ? t.history.emptyPage : t.history.empty}</p>
          )}
          {state.days.map(({ day, entries }) => (
            <section key={day} className="history-day" aria-labelledby={`history-${day}`}>
              <h3 id={`history-${day}`}>{describeHistoryDay(day, openedOn, language)}</h3>
              <ul role="list" className="history-list">
                {entries.map(({ task, outcome }) => (
                  <li key={`${task.id}-${outcome.status}`} className="card history-entry">
                    <span className="history-task">{taskDisplayName(task, language)}</span>
                    <span className={`history-status history-${outcome.status}`}>
                      {describeOutcome(outcome, language)}
                    </span>
                    {outcome.status !== 'completed' && (
                      <span className="muted">{describeWeekendDays(outcome.weekend, language)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {state.moreError && <ErrorMessage>{t.errors[state.moreError]}</ErrorMessage>}
          {state.hasMore && (
            <button
              type="button"
              className="button-secondary"
              onClick={loadMore}
              disabled={state.loadingMore}
            >
              {state.loadingMore ? t.history.loadingMore : t.history.more}
            </button>
          )}
        </>
      )}
    </section>
  )
}
