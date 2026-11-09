import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { formatDayMonth } from '../../domain/dates'
import {
  emptyDraft,
  MAX_PARTS,
  nextWeekends,
  validateNewTask,
  type NewTaskDraft,
  type NewTaskErrors,
} from '../../domain/new-task'
import type { Frequency, LocalDate } from '../../domain/task'
import { createTask } from '../../storage/tasks'

const frequencyOptions: { kind: Frequency['kind']; label: string }[] = [
  { kind: 'weekendWeekly', label: 'Semanal, en fin de semana' },
  { kind: 'weekendBiweekly', label: 'Fin de semana cada 15 días' },
  { kind: 'interval', label: 'Cada N días desde la última vez' },
  { kind: 'oneOff', label: 'Puntual' },
]

// US-33 · Añadir una tarea: nombre, frecuencia y, si se quiere, partes que cuentan lo mismo.
export function NewTaskForm({
  householdId,
  today,
  onSaved,
  onCancel,
}: {
  householdId: string
  today: LocalDate
  /** Se ha guardado: recibe el nombre de la tarea. */
  onSaved: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<NewTaskDraft>(emptyDraft)
  // Una clave por parte, para que React no confunda los campos al quitar una.
  const [partKeys, setPartKeys] = useState<number[]>([])
  const nextPartKey = useRef(0)
  // Los errores de cada campo salen al intentar guardar, no mientras se escribe.
  const [errors, setErrors] = useState<NewTaskErrors | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const weekends = nextWeekends(today)

  // Al abrirlo, se empieza por el nombre (también con el teclado o VoiceOver).
  useEffect(() => nameRef.current?.focus(), [])

  function update(changes: Partial<NewTaskDraft>) {
    const next = { ...draft, ...changes }
    setDraft(next)
    // Si ya se ven los errores, se ponen al día al corregir.
    if (errors) {
      const result = validateNewTask(next)
      setErrors(result.ok ? null : result.errors)
    }
  }

  function chooseFrequency(kind: Frequency['kind']) {
    update({
      frequencyKind: kind,
      // Sale elegido el primero de los dos próximos fines de semana.
      biweeklyStartOn:
        kind === 'weekendBiweekly' ? (draft.biweeklyStartOn ?? weekends[0]) : draft.biweeklyStartOn,
    })
  }

  function addPart() {
    setPartKeys([...partKeys, nextPartKey.current++])
    update({ partNames: [...draft.partNames, ''] })
  }

  function removePart(index: number) {
    setPartKeys(partKeys.filter((_, i) => i !== index))
    update({ partNames: draft.partNames.filter((_, i) => i !== index) })
  }

  function renamePart(index: number, name: string) {
    update({ partNames: draft.partNames.map((partName, i) => (i === index ? name : partName)) })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    const result = validateNewTask(draft)
    if (!result.ok) {
      setErrors(result.errors)
      // Lleva al primer campo que falta, para que se vea qué pasa también en el móvil.
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    setErrors(null)
    setSaving(true)
    try {
      await createTask(householdId, result.task)
      onSaved(result.task.name)
    } catch (error) {
      setSaveError((error as Error).message)
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
      <h3 id="new-task-heading">Nueva tarea</h3>

      <label htmlFor="new-task-name">Nombre</label>
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

      <fieldset
        className="stack"
        aria-invalid={invalid(errors?.frequency)}
        aria-describedby={errors?.frequency ? 'new-task-frequency-error' : undefined}
        tabIndex={errors?.frequency ? -1 : undefined}
        disabled={saving}
      >
        <legend>Cada cuánto toca</legend>
        {frequencyOptions.map(({ kind, label }) => (
          <label key={kind} className="choice">
            <input
              type="radio"
              name="frequency"
              checked={draft.frequencyKind === kind}
              onChange={() => chooseFrequency(kind)}
            />
            {label}
          </label>
        ))}
        <FieldError id="new-task-frequency-error" message={errors?.frequency} />
      </fieldset>

      {draft.frequencyKind === 'interval' && (
        <>
          <label htmlFor="new-task-interval-days">Cada cuántos días</label>
          <input
            id="new-task-interval-days"
            inputMode="numeric"
            value={draft.intervalDays}
            onChange={(event) => update({ intervalDays: event.target.value })}
            aria-invalid={invalid(errors?.intervalDays)}
            aria-describedby={errors?.intervalDays ? 'new-task-interval-days-error' : undefined}
            disabled={saving}
          />
          <FieldError id="new-task-interval-days-error" message={errors?.intervalDays} />
        </>
      )}

      {draft.frequencyKind === 'weekendBiweekly' && (
        <fieldset
          className="stack"
          aria-invalid={invalid(errors?.biweeklyStartOn)}
          aria-describedby={errors?.biweeklyStartOn ? 'new-task-biweekly-error' : undefined}
          disabled={saving}
        >
          <legend>Primer fin de semana</legend>
          {weekends.map((saturday) => (
            <label key={saturday} className="choice">
              <input
                type="radio"
                name="biweekly-start"
                checked={draft.biweeklyStartOn === saturday}
                onChange={() => update({ biweeklyStartOn: saturday })}
              />
              Finde del {formatDayMonth(saturday)}
            </label>
          ))}
          <FieldError id="new-task-biweekly-error" message={errors?.biweeklyStartOn} />
        </fieldset>
      )}

      <fieldset className="stack" disabled={saving}>
        <legend>Partes (opcional)</legend>
        {draft.partNames.length > 0 && (
          <p className="muted">Todas las partes cuentan lo mismo.</p>
        )}
        {draft.partNames.map((partName, index) => {
          const id = `new-task-part-${partKeys[index]}`
          const error = errors?.parts?.[index]
          return (
            <div key={partKeys[index]} className="stack">
              <label htmlFor={id}>Parte {index + 1}</label>
              <div className="part-row">
                <input
                  id={id}
                  value={partName}
                  onChange={(event) => renamePart(index, event.target.value)}
                  aria-invalid={invalid(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                <button
                  type="button"
                  className="button-secondary"
                  aria-label={`Quitar parte ${index + 1}`}
                  onClick={() => removePart(index)}
                >
                  Quitar
                </button>
              </div>
              <FieldError id={`${id}-error`} message={error} />
            </div>
          )
        })}
        <button
          type="button"
          className="button-secondary"
          onClick={addPart}
          disabled={draft.partNames.length >= MAX_PARTS}
        >
          Añadir parte
        </button>
      </fieldset>

      {saveError && <ErrorMessage>{saveError}</ErrorMessage>}

      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar tarea'}
        </button>
      </div>
    </form>
  )
}

/** El error de un campo, enlazado con él por su id (aria-describedby). */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="error">
      {message}
    </p>
  )
}
