import { useEffect, useRef, useState } from 'react'
import { errorCode, type ErrorCode } from '../../domain/errors'
import type { Round } from '../../domain/frequency'
import { withPartsDone } from '../../domain/progress'
import type { LocalDate, Task } from '../../domain/task'
import { listTasks } from '../../storage/tasks'

export type TasksState =
  | { status: 'loading' }
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; error: ErrorCode }

/**
 * Las tareas del hogar, y cómo ponerlas al día:
 * - `markCompleted`: una tarea se ha marcado como hecha (ya guardada).
 * - `markPartsDone`: se han marcado partes de una tarea (ya guardadas); si eran las que
 *   faltaban, la vuelta queda terminada.
 * - `refresh`: la lista no está al día (se marcó en otro dispositivo).
 * - `reloadAfterAdding`: se ha añadido una tarea; si la lista no se puede poner al día,
 *   llama a `onFailed`.
 */
export function useTasks() {
  const [state, setState] = useState<TasksState>({ status: 'loading' })

  // Para no tocar la pantalla si la lista llega cuando ya no está abierta.
  const mounted = useRef(true)
  // Cuál es la última carga pedida: si llegan desordenadas, solo cuenta la última.
  const lastRequest = useRef(0)
  // Cuántos cambios se han hecho en la pantalla. Si cambia mientras se carga la lista, la
  // lista que llega puede ser de antes y no incluirlos: se vuelve a pedir.
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
        if (!keepOnError) setState({ status: 'error', error: errorCode(error, 'tasksLoad') })
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

  function changeTask(taskId: string, change: (task: Task) => Task) {
    localChanges.current++
    setState((current) =>
      current.status === 'loaded'
        ? {
            status: 'loaded',
            tasks: current.tasks.map((task) => (task.id === taskId ? change(task) : task)),
          }
        : current,
    )
  }

  function markCompleted(taskId: string, completedOn: LocalDate) {
    changeTask(taskId, (task) => ({ ...task, lastCompletedOn: completedOn }))
  }

  function markPartsDone(taskId: string, round: Round, partIds: string[], completedOn: LocalDate) {
    changeTask(taskId, (task) => withPartsDone(task, round, partIds, completedOn))
  }

  return {
    state,
    markCompleted,
    markPartsDone,
    refresh: () => load({ keepOnError: true }),
    reloadAfterAdding(onFailed: () => void) {
      localChanges.current++
      load({ keepOnError: true, onKeptError: onFailed })
    },
  }
}
