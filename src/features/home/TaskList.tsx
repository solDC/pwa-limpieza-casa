import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { agenda } from '../../domain/agenda'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { canMarkDone, describeDue, type Round } from '../../domain/frequency'
import {
  describeFrequency,
  partDisplayName,
  taskDisplayName,
  type LocalDate,
  type Task,
} from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError, completeTask, listTasks } from '../../storage/tasks'
import { NewTaskForm } from '../tasks/NewTaskForm'
import { useToday } from './use-today'

type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; error: ErrorCode }

// US-27 · Mis tareas por defecto: las tareas del hogar, con su frecuencia y sus partes.
// US-28 · Frecuencias: cuándo toca cada una («Toca: …»).
// US-29 · Qué toca: primero las retrasadas, luego las de hoy, las puntuales y las de más
// adelante (src/domain/agenda.ts).
// US-30 · Marcar una tarea como hecha: la tarea pasa a mostrar cuándo vuelve a tocar,
// y las puntuales hechas desaparecen.
// US-33 · Añadir una tarea: «Añadir tarea» abre el formulario encima de la lista.
// `householdId` es el hogar donde se añaden (hasta que se carga, no se puede añadir).
export function TaskList({ householdId }: { householdId?: string }) {
  const { t } = useLanguage()
  const [state, setState] = useState<TasksState>({ status: 'loading' })
  const [adding, setAdding] = useState(false)
  // Si una tarea nueva se ha guardado pero la lista no se ha podido poner al día.
  const [reloadFailed, setReloadFailed] = useState(false)
  // El nombre de la tarea recién añadida: lo anuncian los lectores de pantalla (región `status`).
  const [addedName, setAddedName] = useState<string | null>(null)
  // Al cerrar el formulario, el foco vuelve a «Añadir tarea» en lugar de perderse.
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const focusAddButton = useRef(false)
  useEffect(() => {
    if (!adding && focusAddButton.current) {
      focusAddButton.current = false
      addButtonRef.current?.focus()
    }
  }, [adding])

  function closeForm() {
    focusAddButton.current = true
    setAdding(false)
  }
  const today = useToday()

  // Para no tocar la pantalla si la lista llega cuando ya no está abierta.
  const mounted = useRef(true)
  // Cuál es la última carga pedida: si llegan desordenadas, solo cuenta la última.
  const lastRequest = useRef(0)
  // Cuántas tareas se han marcado en la pantalla. Si cambia mientras se carga la lista, la
  // lista que llega puede ser de antes y no incluirlas: se vuelve a pedir.
  const localChanges = useRef(0)

  /**
   * Carga la lista. Si es una recarga (`keepOnError`) y falla, la lista se queda como estaba
   * (con el aviso de la tarjeta, o `onKeptError`) en lugar de cambiarse entera por el error.
   */
  function load({ keepOnError, onKeptError }: { keepOnError: boolean; onKeptError?: () => void }) {
    const request = ++lastRequest.current
    const changesAtStart = localChanges.current
    const isCurrent = () => mounted.current && request === lastRequest.current
    listTasks()
      .then((tasks) => {
        if (!isCurrent()) return
        if (localChanges.current !== changesAtStart) return load({ keepOnError: true, onKeptError })
        setState({ status: 'loaded', tasks })
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        if (!keepOnError) setState({ status: 'error', error: errorCode(error) })
        else onKeptError?.()
      })
  }

  useEffect(() => {
    mounted.current = true
    load({ keepOnError: false })
    return () => {
      mounted.current = false
    }
    // Solo al abrir la lista. `load` solo usa refs y setState, que no cambian.
  }, [])

  function handleCompleted(taskId: string, completedOn: LocalDate) {
    localChanges.current++
    setState((current) =>
      current.status === 'loaded'
        ? {
            status: 'loaded',
            tasks: current.tasks.map((task) =>
              task.id === taskId ? { ...task, lastCompletedOn: completedOn } : task,
            ),
          }
        : current,
    )
  }

  return (
    <section className="stack" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading">{t.tasks.title}</h2>

      {householdId &&
        (adding ? (
          <NewTaskForm
            householdId={householdId}
            today={today}
            onSaved={(name) => {
              closeForm()
              setAddedName(name)
              setReloadFailed(false)
              // La tarea nueva sale en la lista, en su sitio según lo que toca. Si no se
              // puede poner al día, se dice, para que no se añada otra vez.
              localChanges.current++
              load({ keepOnError: true, onKeptError: () => setReloadFailed(true) })
            }}
            onCancel={closeForm}
          />
        ) : (
          <button
            ref={addButtonRef}
            type="button"
            className="button-secondary"
            onClick={() => {
              setAddedName(null)
              setAdding(true)
            }}
          >
            {t.tasks.add}
          </button>
        ))}
      {/* Siempre en la página: los lectores de pantalla solo leen lo que cambia dentro. */}
      <p role="status" className="muted">
        {addedName !== null && t.tasks.added(addedName)}
      </p>

      {reloadFailed && <ErrorMessage>{t.tasks.savedButNotReloaded}</ErrorMessage>}
      {state.status === 'loading' && <p className="muted">{t.tasks.loading}</p>}
      {state.status === 'error' && <ErrorMessage>{t.errors[state.error]}</ErrorMessage>}
      {state.status === 'loaded' && (
        <ul className="task-list" aria-label={t.tasks.title}>
          {agenda(state.tasks, today).map(({ task, round }) => (
            <TaskItem
              key={task.id}
              task={task}
              round={round}
              today={today}
              onCompleted={handleCompleted}
              onStale={() => load({ keepOnError: true })}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskItem({
  task,
  round,
  today,
  onCompleted,
  onStale,
}: {
  task: Task
  /** La vuelta que se muestra (las puntuales ya hechas no llegan aquí). */
  round: Round
  today: LocalDate
  onCompleted: (taskId: string, completedOn: LocalDate) => void
  /** La lista no está al día (se marcó en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  async function handleComplete() {
    setSaving(true)
    setError(null)
    try {
      // Solo se muestra como hecha cuando la base de datos lo ha guardado.
      onCompleted(task.id, await completeTask(task, round))
    } catch (saveError) {
      setError(errorCode(saveError))
      if (saveError instanceof AlreadyDoneError) onStale()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="card">
      <h3>{taskDisplayName(task, language)}</h3>
      <p className="muted">{describeFrequency(task.frequency, language)}</p>
      <p className="due">{describeDue(task.frequency, round, today, language)}</p>
      {task.parts.length > 0 && (
        <p>
          {task.parts
            .map((part) => `${partDisplayName(part, language)} ${part.weight} %`)
            .join(' · ')}
        </p>
      )}
      {canMarkDone(task, round, today) && (
        <button type="button" onClick={handleComplete} disabled={saving}>
          {saving ? t.tasks.saving : t.tasks.markDone}
        </button>
      )}
      {error && <ErrorMessage>{t.errors[error]}</ErrorMessage>}
    </li>
  )
}
