import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { canMarkDone, describeDue, dueDate, type Round } from '../../domain/frequency'
import { roundProgress } from '../../domain/progress'
import {
  describeFrequency,
  partDisplayName,
  taskDisplayName,
  type LocalDate,
  type Task,
} from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import {
  AlreadyDoneError,
  completeParts,
  completeTask,
  setTaskDueOn,
  setTaskNextDueOn,
} from '../../storage/tasks'
import { DueOnForm } from './DueOnForm'

// La tarjeta de una tarea: su frecuencia y cuándo toca (US-28 y US-29). Sin partes, el botón
// para marcarla como hecha (US-30). Con partes, cada una con su peso y su botón («Marcar» o,
// si ya está hecha, «Hecha», desactivado: será el de deshacer, US-44), lo que se lleva de la
// vuelta y «Marcar todo como hecho» (US-39). Las puntuales, «Poner fecha» o «Cambiar fecha»
// (US-38), y las de cada N días, «Cambiar fecha» (cuándo toca la próxima vez, US-41).
export function TaskItem({
  task,
  round,
  today,
  onCompleted,
  onPartsDone,
  onDueOnChanged,
  onStale,
}: {
  task: Task
  /** La vuelta que se muestra (las puntuales ya hechas no llegan aquí). */
  round: Round
  today: LocalDate
  onCompleted: (taskId: string, completedOn: LocalDate) => void
  /** Se han marcado esas partes en la vuelta (ya guardadas). */
  onPartsDone: (taskId: string, round: Round, partIds: string[], completedOn: LocalDate) => void
  /**
   * Se ha puesto, cambiado o quitado la fecha de una puntual, o se ha cambiado cuándo toca la
   * próxima vez una de cada N días (ya guardada).
   */
  onDueOnChanged: (taskId: string, dueOn: LocalDate | null) => void
  /** La lista no está al día (se marcó en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  // Qué se está guardando: la tarea entera, todas las partes que faltan o una parte (su id).
  // El «Guardando…» sale en el botón pulsado; mientras, los demás no se pueden pulsar.
  const [savingTarget, setSavingTarget] = useState<string | null>(null)
  const saving = savingTarget !== null
  const [error, setError] = useState<ErrorCode | null>(null)

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
    const next = card.current?.querySelector<HTMLElement>('.parts button:not(:disabled)') ?? card.current?.querySelector('h3')
    next?.focus()
  }, [saving, task.partCompletions])

  // US-38 y US-41 · El formulario de la fecha. Al cerrarlo, el foco vuelve a su botón.
  const [editingDueOn, setEditingDueOn] = useState(false)
  const dueOnButton = useRef<HTMLButtonElement>(null)
  const focusDueOnButton = useRef(false)
  useEffect(() => {
    if (!editingDueOn && focusDueOnButton.current) {
      focusDueOnButton.current = false
      dueOnButton.current?.focus()
    }
  }, [editingDueOn])

  const canMark = canMarkDone(task, round, today)
  const hasParts = task.parts.length > 0
  const progress = roundProgress(task, round)

  const name = taskDisplayName(task, language)
  const { frequency } = task
  // Una puntual sin fecha: «Poner fecha». Las demás ya tienen una: «Cambiar fecha».
  const hasNoDate = frequency.kind === 'oneOff' && frequency.dueOn === null

  return (
    <li className="card" ref={card}>
      <h3 tabIndex={-1}>{name}</h3>
      <p className="muted">{describeFrequency(task.frequency, language)}</p>
      {/* Con `aria-live`, al marcar la última parte los lectores de pantalla dicen cuándo
          vuelve a tocar la tarea: la tarjeta ya es la de la vuelta siguiente. */}
      <p className="due" aria-live={hasParts ? 'polite' : undefined}>
        {describeDue(task.frequency, round, today, language)}
      </p>
      {hasParts && (
        <>
          {/* Con `aria-live`, los lectores de pantalla dicen el progreso nuevo al marcar una
              parte. Cuando la vuelta no se puede marcar (ya está hecha o aún no ha empezado),
              no sale: las partes que se ven son las de la vuelta siguiente, sin hacer. */}
          <p aria-live="polite" className="progress">
            {canMark && t.tasks.progress(progress.percent)}
          </p>
          {/* `role="list"`: sin viñetas, VoiceOver deja de tratarla como una lista. */}
          <ul role="list" className="parts" aria-label={t.tasks.parts}>
            {progress.parts.map(({ part, done }) => {
              const partName = partDisplayName(part, language)
              return (
                <li key={part.id} className={done ? 'part-done' : undefined}>
                  <span>
                    {partName} {part.weight} %
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
                      aria-label={t.tasks.markPartLabel(partName)}
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
      {(frequency.kind === 'oneOff' || frequency.kind === 'interval') &&
        (editingDueOn ? (
          <DueOnForm
            taskId={task.id}
            taskName={name}
            dueOn={dueDate(frequency, round)}
            today={today}
            save={(dueOn) =>
              frequency.kind === 'oneOff' ? setTaskDueOn(task.id, dueOn) : setTaskNextDueOn(task.id, dueOn)
            }
            // Solo la fecha de una puntual se puede quitar: una de cada N días siempre toca algún día.
            remove={frequency.kind === 'oneOff' ? () => setTaskDueOn(task.id, null) : undefined}
            onSaved={(dueOn) => onDueOnChanged(task.id, dueOn)}
            onClose={() => {
              focusDueOnButton.current = true
              setEditingDueOn(false)
            }}
            onStale={onStale}
          />
        ) : (
          <button
            ref={dueOnButton}
            type="button"
            className="button-secondary"
            aria-label={hasNoDate ? t.tasks.setDueOnLabel(name) : t.tasks.changeDueOnLabel(name)}
            onClick={() => setEditingDueOn(true)}
            disabled={saving}
          >
            {hasNoDate ? t.tasks.setDueOn : t.tasks.changeDueOn}
          </button>
        ))}
    </li>
  )
}
