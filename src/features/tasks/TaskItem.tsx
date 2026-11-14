import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { canMarkDone, describeDue, type Round } from '../../domain/frequency'
import { roundProgress } from '../../domain/progress'
import {
  describeFrequency,
  partDisplayName,
  taskDisplayName,
  type LocalDate,
  type Task,
} from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError, completeParts, completeTask } from '../../storage/tasks'

// La tarjeta de una tarea: su frecuencia y cuándo toca (US-28 y US-29). Sin partes, el botón
// para marcarla como hecha (US-30). Con partes, cada una con su peso y su botón, lo que se
// lleva de la vuelta y «Marcar todo como hecho» (US-39).
export function TaskItem({
  task,
  round,
  today,
  onCompleted,
  onPartsDone,
  onStale,
}: {
  task: Task
  /** La vuelta que se muestra (las puntuales ya hechas no llegan aquí). */
  round: Round
  today: LocalDate
  onCompleted: (taskId: string, completedOn: LocalDate) => void
  /** Se han marcado esas partes en la vuelta (ya guardadas). */
  onPartsDone: (taskId: string, round: Round, partIds: string[], completedOn: LocalDate) => void
  /** La lista no está al día (se marcó en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  // Solo se muestra como hecho lo que la base de datos ha guardado.
  async function save(action: () => Promise<void>) {
    setSaving(true)
    setError(null)
    try {
      await action()
    } catch (saveError) {
      setError(errorCode(saveError, 'saveFailed'))
      if (saveError instanceof AlreadyDoneError) onStale()
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = () =>
    save(async () => onCompleted(task.id, await completeTask(task, round)))
  const handlePartsDone = (partIds: string[]) =>
    save(async () => {
      onPartsDone(task.id, round, partIds, await completeParts(task, round, partIds))
      focusNext.current = true
    })

  // Al marcar una parte, su botón desaparece. Para que el foco no se pierda (teclado y
  // lectores de pantalla), pasa a la primera parte por hacer o, si ya no queda ninguna, al
  // nombre de la tarea.
  const card = useRef<HTMLLIElement>(null)
  const focusNext = useRef(false)
  useEffect(() => {
    if (!focusNext.current || saving) return
    focusNext.current = false
    const next = card.current?.querySelector<HTMLElement>('.parts button') ?? card.current?.querySelector('h3')
    next?.focus()
  }, [saving, task.partCompletions])

  const canMark = canMarkDone(task, round, today)
  const hasParts = task.parts.length > 0
  const progress = roundProgress(task, round)

  return (
    <li className="card" ref={card}>
      <h3 tabIndex={-1}>{taskDisplayName(task, language)}</h3>
      <p className="muted">{describeFrequency(task.frequency, language)}</p>
      <p className="due">{describeDue(task.frequency, round, today, language)}</p>
      {hasParts && (
        <>
          {/* Con `aria-live`, los lectores de pantalla dicen el progreso nuevo al marcar una parte. */}
          <p aria-live="polite" className="progress">
            {canMark && t.tasks.progress(progress.percent)}
          </p>
          <ul className="parts" aria-label={t.tasks.parts}>
            {progress.parts.map(({ part, done }) => {
              const name = partDisplayName(part, language)
              return (
                <li key={part.id} className={done ? 'part-done' : undefined}>
                  <span>
                    {done && <span aria-hidden="true">✓ </span>}
                    {name} {part.weight} %{done && ` · ${t.tasks.partDone}`}
                  </span>
                  {canMark && !done && (
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={t.tasks.markPartLabel(name)}
                      onClick={() => handlePartsDone([part.id])}
                      disabled={saving}
                    >
                      {t.tasks.markPart}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {/* Con una sola parte por hacer, su botón ya lo marca todo. */}
          {canMark && progress.remaining.length > 1 && (
            <button
              type="button"
              onClick={() => handlePartsDone(progress.remaining.map((part) => part.id))}
              disabled={saving}
            >
              {saving ? t.tasks.saving : t.tasks.markAll}
            </button>
          )}
        </>
      )}
      {!hasParts && canMark && (
        <button type="button" onClick={handleComplete} disabled={saving}>
          {saving ? t.tasks.saving : t.tasks.markDone}
        </button>
      )}
      {error && <ErrorMessage>{t.errors[error]}</ErrorMessage>}
    </li>
  )
}
