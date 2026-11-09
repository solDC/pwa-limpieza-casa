import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { agenda } from '../../domain/agenda'
import { canMarkDone, describeDue, type Round } from '../../domain/frequency'
import { describeFrequency, type LocalDate, type Task } from '../../domain/task'
import { AlreadyDoneError, completeTask, listTasks } from '../../storage/tasks'
import { NewTaskForm } from '../tasks/NewTaskForm'
import { useToday } from './use-today'

type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; message: string }

// US-27 · Mis tareas por defecto: las tareas del hogar, con su frecuencia y sus partes.
// US-28 · Frecuencias: cuándo toca cada una («Toca: …»).
// US-29 · Qué toca: primero las retrasadas, luego las de hoy, las puntuales y las de más
// adelante (src/domain/agenda.ts).
// US-30 · Marcar una tarea como hecha: la tarea pasa a mostrar cuándo vuelve a tocar,
// y las puntuales hechas desaparecen.
// US-33 · Añadir una tarea: «Añadir tarea» abre el formulario encima de la lista.
// `householdId` es el hogar donde se añaden (hasta que se carga, no se puede añadir).
export function TaskList({ householdId }: { householdId?: string }) {
  const [state, setState] = useState<TasksState>({ status: 'loading' })
  const [adding, setAdding] = useState(false)
  // Si una tarea nueva se ha guardado pero la lista no se ha podido poner al día.
  const [reloadError, setReloadError] = useState<string | null>(null)
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
      .catch((error: Error) => {
        if (!isCurrent()) return
        if (!keepOnError) setState({ status: 'error', message: error.message })
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
      <h2 id="tasks-heading">Tus tareas</h2>

      {householdId &&
        (adding ? (
          <NewTaskForm
            householdId={householdId}
            today={today}
            onSaved={() => {
              setAdding(false)
              setReloadError(null)
              // La tarea nueva sale en la lista, en su sitio según lo que toca. Si no se
              // puede poner al día, se dice, para que no se añada otra vez.
              localChanges.current++
              load({
                keepOnError: true,
                onKeptError: () =>
                  setReloadError(
                    'La tarea se ha guardado, pero no se ha podido poner al día la lista. Vuelve a cargar la página para verla.',
                  ),
              })
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="button-secondary" onClick={() => setAdding(true)}>
            Añadir tarea
          </button>
        ))}

      {reloadError && <ErrorMessage>{reloadError}</ErrorMessage>}
      {state.status === 'loading' && <p className="muted">Cargando tus tareas…</p>}
      {state.status === 'error' && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.status === 'loaded' && (
        <ul className="task-list" aria-label="Tus tareas">
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleComplete() {
    setSaving(true)
    setError(null)
    try {
      // Solo se muestra como hecha cuando la base de datos lo ha guardado.
      onCompleted(task.id, await completeTask(task, round))
    } catch (saveError) {
      setError((saveError as Error).message)
      if (saveError instanceof AlreadyDoneError) onStale()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="card">
      <h3>{task.name}</h3>
      <p className="muted">{describeFrequency(task.frequency)}</p>
      <p className="due">{describeDue(task.frequency, round, today)}</p>
      {task.parts.length > 0 && (
        <p>{task.parts.map((part) => `${part.name} ${part.weight} %`).join(' · ')}</p>
      )}
      {canMarkDone(task, round, today) && (
        <button type="button" onClick={handleComplete} disabled={saving}>
          {saving ? 'Guardando…' : 'Marcar como hecha'}
        </button>
      )}
      {error && (
        <ErrorMessage>{error}</ErrorMessage>
      )}
    </li>
  )
}
