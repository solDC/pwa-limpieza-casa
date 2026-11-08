import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { canMarkDone, currentRound, describeDue } from '../../domain/frequency'
import { describeFrequency, type LocalDate, type Task } from '../../domain/task'
import { AlreadyDoneError, completeTask, listTasks } from '../../storage/tasks'
import { useToday } from './use-today'

type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; message: string }

// US-27 · Mis tareas por defecto: las tareas del hogar, con su frecuencia y sus partes.
// US-28 · Frecuencias: cuándo toca cada una («Toca: …»).
// US-30 · Marcar una tarea como hecha: la tarea pasa a mostrar cuándo vuelve a tocar,
// y las puntuales hechas desaparecen.
// No separa lo que toca hoy de lo retrasado: eso es la US-29.
export function TaskList() {
  const [state, setState] = useState<TasksState>({ status: 'loading' })

  // Para no tocar la pantalla si la lista llega cuando ya no está abierta.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    listTasks()
      .then((tasks) => mounted.current && setState({ status: 'loaded', tasks }))
      .catch(
        (error: Error) => mounted.current && setState({ status: 'error', message: error.message }),
      )
    return () => {
      mounted.current = false
    }
  }, [])

  // Vuelve a cargar una lista que ya se ve. Si falla, la lista se queda como estaba
  // (con el aviso de la tarjeta) en lugar de cambiarse entera por el error.
  function reload() {
    listTasks()
      .then((tasks) => mounted.current && setState({ status: 'loaded', tasks }))
      .catch(() => {})
  }

  const today = useToday()

  function handleCompleted(taskId: string, completedOn: LocalDate) {
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

      {state.status === 'loading' && <p className="muted">Cargando tus tareas…</p>}
      {state.status === 'error' && (
        <ErrorMessage>{state.message}</ErrorMessage>
      )}
      {state.status === 'loaded' && (
        <ul className="task-list" aria-label="Tus tareas">
          {state.tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              today={today}
              onCompleted={handleCompleted}
              onStale={reload}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskItem({
  task,
  today,
  onCompleted,
  onStale,
}: {
  task: Task
  today: LocalDate
  onCompleted: (taskId: string, completedOn: LocalDate) => void
  /** La lista no está al día (se marcó en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const round = currentRound(task, today)
  // Una puntual ya hecha no vuelve a tocar: desaparece.
  if (!round) return null

  async function handleComplete() {
    if (!round) return
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
