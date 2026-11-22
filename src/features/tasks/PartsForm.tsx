import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import {
  addEditedPart,
  editPartsDraft,
  isEmptyPartsChange,
  removeEditedPart,
  validatePartsChange,
  type EditPartsDraft,
  type PartsChange,
} from '../../domain/edit-parts'
import { errorCode, type ErrorCode } from '../../domain/errors'
import type { Round } from '../../domain/frequency'
import { renamePart, setPartWeight } from '../../domain/new-task'
import type { LocalDate, Task } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError, setTaskParts, StalePartsError } from '../../storage/tasks'
import { PartsFields } from './PartsFields'

// US-51 · Cambiar las partes de una tarea, dentro de su tarjeta: el nombre y el peso de cada
// una, añadir partes y quitarlas, con las mismas reglas que al crearla (US-34).
export function PartsForm({
  task,
  taskName,
  round,
  onSaved,
  onClose,
  onStale,
}: {
  task: Task
  /** El nombre de la tarea, en el idioma elegido: para que se sepa de cuál es el formulario. */
  taskName: string
  /** La vuelta que se muestra: si con el cambio se completa, la base de datos la apunta. */
  round: Round
  /** Se han guardado los cambios (con los ids de las partes nuevas y, si se ha completado la vuelta, el día). */
  onSaved: (change: PartsChange, newPartIds: string[], completedOn: LocalDate | null) => void
  onClose: () => void
  /** La lista no está al día (se cambió en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  const [draft, setDraft] = useState<EditPartsDraft>(() => editPartsDraft(task, language))
  // Una clave por parte: la de las que ya existen es su id; las nuevas, un número.
  const nextPartKey = useRef(0)
  const keysOf = (shown: EditPartsDraft) => shown.partIds.map((id) => id ?? `new-${nextPartKey.current++}`)
  const [partKeys, setPartKeys] = useState<string[]>(() => keysOf(draft))
  // Los avisos salen al intentar guardar, y después se ponen al día solos al corregir.
  const [showErrors, setShowErrors] = useState(false)
  const validation = validatePartsChange(task, draft, language)
  const errors = showErrors && !validation.ok ? validation.errors : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const form = useRef<HTMLFormElement>(null)
  // Si las partes de la tarea cambian con el formulario abierto (se han cambiado en otro
  // dispositivo y la lista se ha vuelto a cargar), el formulario se pone al día con ellas: con
  // las de antes, guardar volvería a fallar. El aviso de por qué se queda. También si cambia
  // el idioma, como en «Cambiar nombre»: los nombres se ven en el idioma elegido, y con los
  // del otro, guardar renombraría las partes que no se han tocado.
  const partsNow = JSON.stringify([language, task.parts])
  const [partsShown, setPartsShown] = useState(partsNow)
  if (partsShown !== partsNow) {
    setPartsShown(partsNow)
    const reset = editPartsDraft(task, language)
    setDraft(reset)
    setPartKeys(keysOf(reset))
    setShowErrors(false)
  }
  const idPrefix = `parts-${task.id}`

  // Al abrirlo, se empieza por el primer campo (también con el teclado o VoiceOver).
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('input, button')?.focus()
  }, [])

  function handleAdd() {
    setPartKeys([...partKeys, `new-${nextPartKey.current++}`])
    setDraft(addEditedPart(draft))
  }

  function handleRemove(index: number) {
    setPartKeys(partKeys.filter((_, i) => i !== index))
    setDraft(removeEditedPart(draft, index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    if (!validation.ok) {
      setShowErrors(true)
      // Lleva al primer campo que falla, para que se vea qué pasa también en el móvil.
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus(),
      )
      return
    }
    const { change } = validation
    // Sin cambios, no hay nada que guardar.
    if (isEmptyPartsChange(task, change)) return onClose()
    setSaving(true)
    try {
      const { newPartIds, completedOn } = await setTaskParts(
        task.id,
        task.parts.map((part) => part.id),
        round,
        change,
      )
      onSaved(change, newPartIds, completedOn)
      onClose()
    } catch (saveFailure) {
      setSaveError(errorCode(saveFailure, 'saveFailed'))
      setSaving(false)
      if (saveFailure instanceof AlreadyDoneError || saveFailure instanceof StalePartsError) onStale()
    }
  }

  return (
    <form
      ref={form}
      className="stack due-on-form"
      aria-label={t.tasks.partsForm(taskName)}
      onSubmit={handleSubmit}
      noValidate
    >
      <PartsFields
        idPrefix={idPrefix}
        legend={t.tasks.parts}
        draft={draft}
        partKeys={partKeys}
        errors={errors}
        disabled={saving}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onRename={(index, name) => setDraft(renamePart(draft, index, name))}
        onWeight={(index, weight) => setDraft(setPartWeight(draft, index, weight))}
      />
      {/* Sin partes, la tarea se marca entera. */}
      {draft.partNames.length === 0 && task.parts.length > 0 && <p className="muted">{t.tasks.noParts}</p>}
      {saveError && <ErrorMessage>{t.errors[saveError]}</ErrorMessage>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>
          {t.tasks.cancel}
        </button>
        <button type="submit" disabled={saving}>
          {saving ? t.tasks.saving : t.tasks.save}
        </button>
      </div>
    </form>
  )
}
