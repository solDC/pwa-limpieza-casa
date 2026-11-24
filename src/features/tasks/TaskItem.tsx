import { useEffect, useId, useRef, useState } from 'react'
import { LineIcon } from '../../components/LineIcon'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import {
  canMarkDone,
  describeDue,
  dueDate,
  isWeekend,
  moveWeekendOptions,
  type Round,
} from '../../domain/frequency'
import { dueOnError, earliestNextDueOn, nextDueOnError } from '../../domain/new-task'
import { roundProgress } from '../../domain/progress'
import type { TaskRename } from '../../domain/rename-task'
import type { PartsChange } from '../../domain/edit-parts'
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
import { MoveWeekendForm } from './MoveWeekendForm'
import { PartsForm } from './PartsForm'
import { RenameForm } from './RenameForm'

export function TaskItem({
  task,
  active,
  otherTasks,
  round,
  today,
  onCompleted,
  onPartsDone,
  onDueOnChanged,
  onMovedWeekend,
  onRenamed,
  onPartsChanged,
  onStale,
}: {
  task: Task
  active: boolean
  /** Las tareas del hogar, para no repetir un nombre al renombrarla (US-54). */
  otherTasks: Task[]
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
  /** Se ha movido una tarea de fin de semana al finde de ese sábado (ya guardado). */
  onMovedWeekend: (taskId: string, saturday: LocalDate) => void
  /** Se ha renombrado la tarea o alguna de sus partes (ya guardado). */
  onRenamed: (taskId: string, rename: TaskRename) => void
  /**
   * Se han cambiado las partes (ya guardado), con los ids de las nuevas y, si con el cambio se
   * ha completado la vuelta, el día (US-51).
   */
  onPartsChanged: (taskId: string, change: PartsChange, newPartIds: string[], completedOn: LocalDate | null) => void
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
    save('task', async () => {
      onCompleted(task.id, await completeTask(task, round))
      focusNext.current = true
    })
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

  const [editing, setEditing] = useState<'dueOn' | 'name' | 'parts' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [partsOpen, setPartsOpen] = useState(false)
  const menuArea = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const focusAfterForm = useRef(false)
  const menuId = useId()
  const partsId = useId()

  useEffect(() => {
    if (!active) setMenuOpen(false)
    if (!active || !menuOpen) return

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuArea.current?.contains(event.target)) {
        if (menuArea.current?.contains(document.activeElement)) menuButton.current?.focus()
        setMenuOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, menuOpen])

  useEffect(() => {
    if (!editing && focusAfterForm.current) {
      focusAfterForm.current = false
      menuButton.current?.focus()
    }
  }, [editing])

  function openForm(form: NonNullable<typeof editing>) {
    setMenuOpen(false)
    setEditing(form)
  }

  function closeForm() {
    focusAfterForm.current = true
    setEditing(null)
  }

  const canMark = canMarkDone(task, round, today)
  const hasParts = task.parts.length > 0
  const progress = roundProgress(task, round)

  const name = taskDisplayName(task, language)
  const { frequency } = task
  // Una puntual sin fecha: «Poner fecha». Las demás ya tienen una: «Cambiar fecha».
  const hasNoDate = frequency.kind === 'oneOff' && frequency.dueOn === null

  const weekend = isWeekend(frequency)
  const dueAction = weekend
    ? { label: t.tasks.moveWeekendLabel(name), text: t.tasks.moveWeekend }
    : hasNoDate
      ? { label: t.tasks.setDueOnLabel(name), text: t.tasks.setDueOn }
      : { label: t.tasks.changeDueOnLabel(name), text: t.tasks.changeDueOn }

  return (
    <li className="card task-card" ref={card}>
      <div className="task-heading">
        <h3 tabIndex={-1}>{name}</h3>
        <div className="task-menu-area" ref={menuArea}>
          <button
            ref={menuButton}
            type="button"
            className="icon-button"
            aria-label={t.tasks.actions(name)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            disabled={saving || editing !== null}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <LineIcon name="more" />
          </button>
          <div id={menuId} className="task-menu card" hidden={!menuOpen}>
            <button type="button" aria-label={dueAction.label} onClick={() => openForm('dueOn')}>
              <LineIcon name="calendar" />
              {dueAction.text}
            </button>
            <button type="button" aria-label={t.tasks.renameLabel(name)} onClick={() => openForm('name')}>
              <LineIcon name="pencil" />
              {t.tasks.rename}
            </button>
            <button
              type="button"
              aria-label={hasParts ? t.tasks.editPartsLabel(name) : t.tasks.addPartsLabel(name)}
              onClick={() => openForm('parts')}
            >
              <LineIcon name="list" />
              {hasParts ? t.tasks.editParts : t.tasks.addParts}
            </button>
          </div>
        </div>
      </div>
      <div className="task-summary">
        <div>
          <p className="muted task-frequency">{describeFrequency(frequency, language)}</p>
          <p className="due" aria-live="polite">{describeDue(frequency, round, today, language)}</p>
        </div>
        {!hasParts && canMark && (
          <button type="button" className="icon-button task-complete" aria-label={t.tasks.markDone}
            onClick={handleComplete} disabled={saving} aria-busy={saving}>
            <LineIcon name="circle" />
          </button>
        )}
      </div>
      {savingTarget === 'task' && <p className="muted" role="status">{t.tasks.saving}</p>}
      {hasParts && (
        <>
          <button
            type="button"
            className="progress-toggle"
            aria-expanded={partsOpen}
            aria-controls={partsId}
            aria-label={t.tasks.parts}
            aria-describedby={canMark ? `${partsId}-progress` : undefined}
            onClick={() => setPartsOpen(!partsOpen)}
          >
            <progress aria-hidden="true" max={100} value={progress.percent} />
            <span className="progress" aria-hidden="true">{progress.percent} %</span>
            <LineIcon name="chevron" />
          </button>
          <span id={`${partsId}-progress`} className="visually-hidden" aria-live="polite">
            {canMark && t.tasks.progress(progress.percent)}
          </span>
          <div id={partsId} className="task-parts-panel" hidden={!partsOpen}>
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
                      <button type="button" className="part-status" disabled>
                        <LineIcon name="check" /> {t.tasks.partDone}
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
          </div>
        </>
      )}
      {error && <ErrorMessage>{t.errors[error]}</ErrorMessage>}
      {editing === 'dueOn' && (frequency.kind === 'oneOff' || frequency.kind === 'interval') && (
        <DueOnForm
          taskId={task.id}
          taskName={name}
          dueOn={dueDate(frequency, round)}
          // US-41 · En las de cada N días, desde mañana si ya se ha hecho hoy (no se podría
          // volver a marcar hasta entonces).
          min={frequency.kind === 'oneOff' ? today : earliestNextDueOn(today, task.lastCompletedOn)}
          validate={(value) =>
            frequency.kind === 'oneOff'
              ? dueOnError(value || null, today, language)
              : nextDueOnError(value, today, task.lastCompletedOn, language)
          }
          save={(dueOn) =>
            frequency.kind === 'oneOff' ? setTaskDueOn(task.id, dueOn) : setTaskNextDueOn(task.id, dueOn)
          }
          // Solo la fecha de una puntual se puede quitar: una de cada N días siempre toca algún día.
          remove={frequency.kind === 'oneOff' ? () => setTaskDueOn(task.id, null) : undefined}
          onSaved={(dueOn) => onDueOnChanged(task.id, dueOn)}
          onClose={closeForm}
          onStale={onStale}
        />
      )}
      {editing === 'dueOn' && weekend && (
        <MoveWeekendForm
          taskId={task.id}
          taskName={name}
          options={moveWeekendOptions(task, round, today)}
          onSaved={(saturday) => onMovedWeekend(task.id, saturday)}
          onClose={closeForm}
        />
      )}
      {editing === 'name' && (
        <RenameForm
          task={task}
          otherTasks={otherTasks}
          onSaved={(rename) => onRenamed(task.id, rename)}
          onClose={closeForm}
          onStale={onStale}
        />
      )}
      {editing === 'parts' && (
        <PartsForm
          task={task}
          taskName={name}
          round={round}
          onSaved={(change, newPartIds, completedOn) => onPartsChanged(task.id, change, newPartIds, completedOn)}
          onClose={closeForm}
          onStale={onStale}
        />
      )}
    </li>
  )
}
