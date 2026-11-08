import { useEffect, useState } from 'react'
import { localDateIn } from '../../domain/dates'
import { currentRound, describeDue } from '../../domain/frequency'
import { describeFrequency, type LocalDate, type Task } from '../../domain/task'
import { listTasks } from '../../storage/tasks'

type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; message: string }

// US-27 · Mis tareas por defecto: las tareas del hogar, con su frecuencia y sus partes.
// US-28 · Frecuencias: cuándo toca cada una («Toca: …»).
// No separa lo que toca hoy de lo retrasado: eso es la US-29.

/** «Hoy» es siempre el día de Madrid, como en la base de datos. */
const TIME_ZONE = 'Europe/Madrid'
export function TaskList() {
  const [state, setState] = useState<TasksState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    listTasks()
      .then((tasks) => active && setState({ status: 'loaded', tasks }))
      .catch((error: Error) => active && setState({ status: 'error', message: error.message }))
    return () => {
      active = false
    }
  }, [])

  const today = localDateIn(TIME_ZONE, new Date())

  return (
    <section className="stack" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading">Tus tareas</h2>

      {state.status === 'loading' && <p className="muted">Cargando tus tareas…</p>}
      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'loaded' && (
        <ul className="task-list" aria-label="Tus tareas">
          {state.tasks.map((task) => (
            <TaskItem key={task.id} task={task} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskItem({ task, today }: { task: Task; today: LocalDate }) {
  // Hasta la US-30 no se puede marcar nada como hecho: nunca se ha terminado ninguna.
  const round = currentRound(task, null, today)
  return (
    <li className="card">
      <h3>{task.name}</h3>
      <p className="muted">{describeFrequency(task.frequency)}</p>
      {round && <p className="due">Toca: {describeDue(task.frequency, round, today)}</p>}
      {task.parts.length > 0 && (
        <p>{task.parts.map((part) => `${part.name} ${part.weight} %`).join(' · ')}</p>
      )}
    </li>
  )
}
