import { useEffect, useState } from 'react'
import { describeFrequency, type Task } from '../../domain/task'
import { listTasks } from '../../storage/tasks'

type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; message: string }

// US-27 · Mis tareas por defecto: las tareas del hogar, con su frecuencia y sus partes.
// No calcula qué toca: eso es la US-29.
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
            <li key={task.id} className="card">
              <h3>{task.name}</h3>
              <p className="muted">{describeFrequency(task.frequency)}</p>
              {task.parts.length > 0 && (
                <p>{task.parts.map((part) => `${part.name} ${part.weight} %`).join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
