import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { formatDayMonth } from '../../domain/dates'
import { errorCode, type ErrorCode } from '../../domain/errors'
import {
  addPart,
  emptyDraft,
  MAX_PARTS,
  nextWeekends,
  removePart,
  renamePart,
  setPartWeight,
  validateNewTask,
  weightsTotal,
  type NewTaskDraft,
} from '../../domain/new-task'
import type { Frequency, LocalDate } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { createTask } from '../../storage/tasks'

const frequencyKinds: Frequency['kind'][] = ['weekendWeekly', 'weekendBiweekly', 'interval', 'oneOff']

// US-33 · Añadir una tarea: nombre, frecuencia y, si se quiere, partes.
// US-34 · Elegir el peso de las partes: si no se cambian, cuentan lo mismo.
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
  const { language, t } = useLanguage()
  const [draft, setDraft] = useState<NewTaskDraft>(emptyDraft)
  // Una clave por parte, para que React no confunda los campos al quitar una.
  const [partKeys, setPartKeys] = useState<number[]>([])
  const nextPartKey = useRef(0)
  // Los errores de cada campo salen al intentar guardar, no mientras se escribe. Después
  // se ponen al día solos al corregir (y al cambiar de idioma): se calculan cada vez.
  const [showErrors, setShowErrors] = useState(false)
  const validation = validateNewTask(draft, language)
  const errors = showErrors && !validation.ok ? validation.errors : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const weekends = nextWeekends(today)

  // Al abrirlo, se empieza por el nombre (también con el teclado o VoiceOver).
  useEffect(() => nameRef.current?.focus(), [])

  function update(changes: Partial<NewTaskDraft>) {
    apply({ ...draft, ...changes })
  }

  function apply(next: NewTaskDraft) {
    setDraft(next)
  }

  function chooseFrequency(kind: Frequency['kind']) {
    update({
      frequencyKind: kind,
      // Sale elegido el primero de los dos próximos fines de semana.
      biweeklyStartOn:
        kind === 'weekendBiweekly' ? (draft.biweeklyStartOn ?? weekends[0]) : draft.biweeklyStartOn,
    })
  }

  function handleAddPart() {
    setPartKeys([...partKeys, nextPartKey.current++])
    apply(addPart(draft))
  }

  function handleRemovePart(index: number) {
    setPartKeys(partKeys.filter((_, i) => i !== index))
    apply(removePart(draft, index))
  }

  const total = weightsTotal(draft)

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

      <fieldset
        className="stack"
        aria-invalid={invalid(errors?.frequency)}
        aria-describedby={errors?.frequency ? 'new-task-frequency-error' : undefined}
        tabIndex={errors?.frequency ? -1 : undefined}
        disabled={saving}
      >
        <legend>{t.newTask.frequency}</legend>
        {frequencyKinds.map((kind) => (
          <label key={kind} className="choice">
            <input
              type="radio"
              name="frequency"
              checked={draft.frequencyKind === kind}
              onChange={() => chooseFrequency(kind)}
            />
            {t.newTask[kind]}
          </label>
        ))}
        <FieldError id="new-task-frequency-error" message={errors?.frequency} />
      </fieldset>

      {draft.frequencyKind === 'interval' && (
        <>
          <label htmlFor="new-task-interval-days">{t.newTask.intervalDays}</label>
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
          <legend>{t.newTask.firstWeekend}</legend>
          {weekends.map((saturday) => (
            <label key={saturday} className="choice">
              <input
                type="radio"
                name="biweekly-start"
                checked={draft.biweeklyStartOn === saturday}
                onChange={() => update({ biweeklyStartOn: saturday })}
              />
              {t.newTask.weekendOf(formatDayMonth(saturday, language))}
            </label>
          ))}
          <FieldError id="new-task-biweekly-error" message={errors?.biweeklyStartOn} />
        </fieldset>
      )}

      <fieldset className="stack" disabled={saving}>
        <legend>{t.newTask.parts}</legend>
        {draft.partNames.length > 0 && (
          <p className="muted">{t.newTask.equalWeights}</p>
        )}
        {draft.partNames.map((partName, index) => {
          const id = `new-task-part-${partKeys[index]}`
          const error = errors?.parts?.[index]
          const weightError = errors?.partWeights?.[index]
          return (
            <div key={partKeys[index]} className="stack">
              <label htmlFor={id}>{t.newTask.part(index + 1)}</label>
              <div className="part-row">
                <input
                  id={id}
                  value={partName}
                  onChange={(event) => apply(renamePart(draft, index, event.target.value))}
                  aria-invalid={invalid(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                <button
                  type="button"
                  className="button-secondary"
                  aria-label={t.newTask.removePart(index + 1)}
                  onClick={() => handleRemovePart(index)}
                >
                  {t.newTask.remove}
                </button>
              </div>
              <FieldError id={`${id}-error`} message={error} />
              <div className="weight-row">
                <label htmlFor={`${id}-weight`}>{t.newTask.weight}</label>
                <input
                  id={`${id}-weight`}
                  // Lo que lee VoiceOver: «Peso» solo no diría de qué parte es.
                  aria-label={t.newTask.weightOfPart(index + 1)}
                  inputMode="numeric"
                  value={draft.partWeights[index]}
                  onChange={(event) => apply(setPartWeight(draft, index, event.target.value))}
                  aria-invalid={invalid(weightError)}
                  aria-describedby={weightError ? `${id}-weight-error` : undefined}
                />
                <span aria-hidden="true">%</span>
              </div>
              <FieldError id={`${id}-weight-error`} message={weightError} />
            </div>
          )
        })}
        {draft.partNames.length > 0 && (
          <p
            id="new-task-weights-total"
            // VoiceOver anuncia la suma (o el aviso) al cambiar, sin salir del campo del peso.
            aria-live="polite"
            className={total === 100 ? 'muted' : 'error'}
            // No es un campo: se marca aparte para llevar el foco aquí si es lo único que falla.
            data-invalid={errors?.weightsTotal ? true : undefined}
            tabIndex={errors?.weightsTotal ? -1 : undefined}
          >
            {errors?.weightsTotal ?? t.newTask.total(total)}
          </p>
        )}
        <button
          type="button"
          className="button-secondary"
          onClick={handleAddPart}
          disabled={draft.partNames.length >= MAX_PARTS}
        >
          {t.newTask.addPart}
        </button>
      </fieldset>

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

/** El error de un campo, enlazado con él por su id (aria-describedby). */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="error">
      {message}
    </p>
  )
}
