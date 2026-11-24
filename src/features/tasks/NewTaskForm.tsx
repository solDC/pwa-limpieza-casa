import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import {
  addPart,
  emptyDraft,
  nextWeekends,
  removePart,
  renamePart,
  setPartWeight,
  validateNewTask,
  type NewTaskDraft,
} from '../../domain/new-task'
import type { LocalDate, Task } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { createTask } from '../../storage/tasks'
import { FieldError } from './FieldError'
import { FrequencyFields } from './FrequencyFields'
import { PartsFields } from './PartsFields'

// US-33 · Añadir una tarea: nombre, frecuencia y, si se quiere, partes.
// US-34 · Elegir el peso de las partes: si no se cambian, cuentan lo mismo.
// US-38 · Las puntuales, con fecha si se quiere.
// US-54 · Sin repetir el nombre de otra tarea.
export function NewTaskForm({
  householdId,
  today,
  otherTasks,
  onSaved,
  onCancel,
}: {
  householdId: string
  today: LocalDate
  /** Las tareas del hogar, para no repetir un nombre (US-54). */
  otherTasks: Task[]
  /** Se ha guardado: recibe el nombre de la tarea. */
  onSaved: (name: string) => void
  onCancel: () => void
}) {
  const { language, t } = useLanguage()
  const [draft, setDraft] = useState<NewTaskDraft>(emptyDraft)
  // Una clave por parte, para que React no confunda los campos al quitar una.
  const [partKeys, setPartKeys] = useState<number[]>([])
  const nextPartKey = useRef(0)
  // Los errores de cada campo salen al intentar guardar, no mientras se escribe. Después
  // se ponen al día solos al corregir (y al cambiar de idioma): se calculan cada vez.
  const [showErrors, setShowErrors] = useState(false)
  const validation = validateNewTask(draft, language, today, otherTasks)
  const errors = showErrors && !validation.ok ? validation.errors : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const weekends = nextWeekends(today)

  // Al abrirlo, se empieza por el nombre (también con el teclado o VoiceOver).
  useEffect(() => nameRef.current?.focus(), [])

  function update(changes: Partial<NewTaskDraft>) {
    setDraft({ ...draft, ...changes })
  }

  function handleAddPart() {
    setPartKeys([...partKeys, nextPartKey.current++])
    setDraft(addPart(draft))
  }

  function handleRemovePart(index: number) {
    setPartKeys(partKeys.filter((_, i) => i !== index))
    setDraft(removePart(draft, index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    const result = validation
    if (!result.ok) {
      setShowErrors(true)
      // Lleva al primer campo que falta, para que se vea qué pasa también en el móvil.
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')
          ?.focus(),
      )
      return
    }
    setShowErrors(false)
    setSaving(true)
    try {
      await createTask(householdId, result.task)
      onSaved(result.task.name)
    } catch (error) {
      setSaveError(errorCode(error, 'taskSaveFailed'))
      setSaving(false)
    }
  }

  // Si el formulario ya no vale (para enlazar cada error con su campo).
  const invalid = (message: string | undefined) => (message ? true : undefined)

  return (
    <form
      ref={formRef}
      className="card stack new-task"
      aria-labelledby="new-task-heading"
      onSubmit={handleSubmit}
      noValidate
    >
      <h3 id="new-task-heading">{t.newTask.title}</h3>

      <label htmlFor="new-task-name">{t.newTask.name}</label>
      <input
        id="new-task-name"
        ref={nameRef}
        value={draft.name}
        onChange={(event) => update({ name: event.target.value })}
        aria-invalid={invalid(errors?.name)}
        aria-describedby={errors?.name ? 'new-task-name-error' : undefined}
        disabled={saving}
      />
      <FieldError id="new-task-name-error" message={errors?.name} />

      <FrequencyFields
        idPrefix="new-task"
        draft={draft}
        errors={errors}
        weekends={weekends}
        today={today}
        showFirstDueOn
        showDueOn
        disabled={saving}
        onChange={update}
      />

      <PartsFields
        idPrefix="new-task"
        legend={t.newTask.parts}
        hint={t.newTask.equalWeights}
        draft={draft}
        partKeys={partKeys}
        errors={errors}
        disabled={saving}
        onAdd={handleAddPart}
        onRemove={handleRemovePart}
        onRename={(index, name) => setDraft(renamePart(draft, index, name))}
        onWeight={(index, weight) => setDraft(setPartWeight(draft, index, weight))}
      />

      {saveError && <ErrorMessage>{t.errors[saveError]}</ErrorMessage>}

      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>
          {t.newTask.cancel}
        </button>
        <button type="submit" disabled={saving}>
          {saving ? t.newTask.saving : t.newTask.save}
        </button>
      </div>
    </form>
  )
}
