import { useEffect, useRef, useState, type RefObject } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { agenda } from '../../domain/agenda'
import { useLanguage } from '../../i18n/language-context'
import { NewTaskForm } from './NewTaskForm'
import { TaskItem } from './TaskItem'
import { useTasks } from './use-tasks'
import { useToday } from './use-today'

// «Tus tareas»: las tareas del hogar (US-27), primero las retrasadas, luego las de hoy, las
// puntuales y las de más adelante (US-29, src/domain/agenda.ts), y «Añadir tarea» (US-33),
// que abre el formulario encima de la lista.
// `householdId` es el hogar donde se añaden (hasta que se carga, no se puede añadir).
// «Histórico» (US-31) abre el histórico con `onOpenHistory`.
export function TaskList({
  householdId,
  historyButtonRef,
  onOpenHistory,
}: {
  householdId?: string
  historyButtonRef: RefObject<HTMLButtonElement | null>
  onOpenHistory: () => void
}) {
  const { t } = useLanguage()
  const {
    state,
    markCompleted,
    markPartsDone,
    changeDueOn,
    moveWeekend,
    rename,
    changeParts,
    changeFrequency,
    refresh,
    reloadAfterAdding,
  } = useTasks()
  // Las tareas del hogar, para no repetir un nombre (US-54). Hasta que se cargan, ninguna:
  // la base de datos lo comprueba igual.
  const tasks = state.status === 'loaded' ? state.tasks : []
  const today = useToday()
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

  return (
    <section className="stack tasks" aria-labelledby="tasks-heading">
      <div className="tasks-header">
        <h2 id="tasks-heading">{t.tasks.title}</h2>
        <button ref={historyButtonRef} type="button" className="button-link" onClick={onOpenHistory}>
          {t.history.open}
        </button>
      </div>

      {householdId &&
        (adding ? (
          <NewTaskForm
            householdId={householdId}
            today={today}
            otherTasks={tasks}
            onSaved={(name) => {
              closeForm()
              setAddedName(name)
              setReloadFailed(false)
              // La tarea nueva sale en la lista, en su sitio según lo que toca. Si no se
              // puede poner al día, se dice, para que no se añada otra vez.
              reloadAfterAdding(() => setReloadFailed(true))
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
        <ul role="list" className="task-list" aria-label={t.tasks.title}>
          {agenda(state.tasks, today).map(({ task, round }) => (
            <TaskItem
              key={task.id}
              task={task}
              otherTasks={tasks}
              round={round}
              today={today}
              onCompleted={markCompleted}
              onPartsDone={markPartsDone}
              onDueOnChanged={changeDueOn}
              onMovedWeekend={moveWeekend}
              onRenamed={rename}
              onPartsChanged={changeParts}
              onFrequencyChanged={changeFrequency}
              onStale={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
