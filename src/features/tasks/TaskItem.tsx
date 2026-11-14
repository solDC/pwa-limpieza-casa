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
// para marcarla como hecha (US-30). Con partes, cada una con su peso y su botón («Marcar» o,
// si ya está hecha, «Hecha», desactivado: será el de deshacer, US-44), lo que se lleva de la
// vuelta y «Marcar todo como hecho» (US-39).
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
  // Qué se está guardando: la tarea entera, todas las partes que faltan o una parte (su id).
  // El «Guardando…» sale en el botón pulsado; mientras, los demás no se pueden pulsar.
  const [savingTarget, setSavingTarget] = useState<string | null>(null)
  const saving = savingTarget !== null
  const [error, setError] = useState<ErrorCode | null>(null)
  // El día en que se ha terminado la vuelta desde esta tarjeta marcando partes: ese día lo dice.
  const [roundDoneOn, setRoundDoneOn] = useState<LocalDate | null>(null)

  // Solo se muestra como hecho lo que la base de datos ha guardado.
  async function save(target: string, action: () => Promise<void>) {
    setSavingTarget(target)
    setError(null)
    try {
      await action()
    } catch (saveError) {
      setError(errorCode(saveError, 'saveFailed'))
      if (saveError instanceof AlreadyDoneError) onStale()
    } finally {
      setSavingTarget(null)
    }
  }

  const handleComplete = () =>
    save('task', async () => onCompleted(task.id, await completeTask(task, round)))
  const handlePartsDone = (target: string, partIds: string[]) =>
    save(target, async () => {
      const wereTheLast = partIds.length === progress.remaining.length
      onPartsDone(task.id, round, partIds, await completeParts(task, round, partIds))
      if (wereTheLast) setRoundDoneOn(today)
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
    const next = card.current?.querySelector<HTMLElement>('.parts button:not(:disabled)') ?? card.current?.querySelector('h3')
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
          {/* Con `aria-live`, los lectores de pantalla dicen el progreso nuevo al marcar una
              parte y, al marcar la última, que la tarea ha quedado hecha. */}
          <p aria-live="polite" className="progress">
            {canMark ? t.tasks.progress(progress.percent) : roundDoneOn === today && t.tasks.roundDone}
          </p>
          {/* `role="list"`: sin viñetas, VoiceOver deja de tratarla como una lista. */}
          <ul role="list" className="parts" aria-label={t.tasks.parts}>
            {progress.parts.map(({ part, done }) => {
              const name = partDisplayName(part, language)
              return (
                <li key={part.id} className={done ? 'part-done' : undefined}>
                  <span>
                    {name} {part.weight} %
                  </span>
                  {done && (
                    <button type="button" className="button-secondary" disabled>
                      {t.tasks.partDone}
                    </button>
                  )}
                  {canMark && !done && (
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={t.tasks.markPartLabel(name)}
                      onClick={() => handlePartsDone(part.id, [part.id])}
                      disabled={saving}
                    >
                      {savingTarget === part.id ? t.tasks.saving : t.tasks.markPart}
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
              onClick={() => handlePartsDone('all', progress.remaining.map((part) => part.id))}
              disabled={saving}
            >
              {savingTarget === 'all' ? t.tasks.saving : t.tasks.markAll}
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
