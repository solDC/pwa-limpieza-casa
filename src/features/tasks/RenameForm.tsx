import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import {
  isEmptyRename,
  renameDraft,
  validateRename,
  type RenameDraft,
  type TaskRename,
} from '../../domain/rename-task'
import type { Task } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { renameTask } from '../../storage/tasks'
import { FieldError } from './FieldError'

// US-54 · Cambiar el nombre de una tarea y de sus partes, dentro de su tarjeta. Sale con los
// nombres como se ven; lo que se cambia deja de traducirse.
export function RenameForm({
  task,
  otherTasks,
  onSaved,
  onClose,
}: {
  task: Task
  /** Las tareas del hogar, para no repetir un nombre. */
  otherTasks: Task[]
  /** Se ha guardado (solo lo renombrado). */
  onSaved: (rename: TaskRename) => void
  onClose: () => void
}) {
  const { language, t } = useLanguage()
  // Los nombres como se ven al abrirlo. Si se cambia de idioma con el formulario abierto, se
  // vuelven a poner como se ven en el nuevo: renombrar es escribir algo distinto de lo que se
  // ve, y con los del idioma anterior se renombraría sin querer.
  const [draft, setDraft] = useState<RenameDraft>(() => renameDraft(task, language))
  const [draftLanguage, setDraftLanguage] = useState(language)
  if (draftLanguage !== language) {
    setDraftLanguage(language)
    setDraft(renameDraft(task, language))
  }
  // Los avisos salen al intentar guardar, y después se ponen al día solos al corregir.
  const [showErrors, setShowErrors] = useState(false)
  const validation = validateRename(task, draft, otherTasks, language)
  const errors = showErrors && !validation.ok ? validation.errors : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const fieldId = `rename-${task.id}`
  // El nombre de la tarea como se ve ahora, para saber de cuál es el formulario.
  const shownName = renameDraft(task, language).name

  // Al abrirlo, se empieza por el nombre (también con el teclado o VoiceOver).
  useEffect(() => nameInput.current?.focus(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    if (!validation.ok) {
      setShowErrors(true)
      // Lleva al primer campo que falla, para que se vea qué pasa también en el móvil.
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const { rename } = validation
    // Sin cambios, no hay nada que guardar.
    if (isEmptyRename(rename)) return onClose()
    setSaving(true)
    try {
      await renameTask(task.id, rename)
      onSaved(rename)
      onClose()
    } catch (renameError) {
      setSaveError(errorCode(renameError, 'saveFailed'))
      setSaving(false)
    }
  }

  return (
    <form
      ref={form}
      className="stack due-on-form"
      aria-label={t.tasks.renameForm(shownName)}
      onSubmit={handleSubmit}
      noValidate
    >
      <label htmlFor={fieldId}>{t.tasks.taskName}</label>
      <input
        id={fieldId}
        ref={nameInput}
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        aria-invalid={errors?.name ? true : undefined}
        aria-describedby={errors?.name ? `${fieldId}-error` : undefined}
        disabled={saving}
      />
      <FieldError id={`${fieldId}-error`} message={errors?.name} />
      {task.parts.map((part, index) => {
        const partId = `${fieldId}-part-${part.id}`
        const partError = errors?.parts?.[index]
        return (
          <div key={part.id} className="stack">
            <label htmlFor={partId}>{t.tasks.part(index + 1)}</label>
            <input
              id={partId}
              value={draft.partNames[index] ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  partNames: draft.partNames.map((name, i) => (i === index ? event.target.value : name)),
                })
              }
              aria-invalid={partError ? true : undefined}
              aria-describedby={partError ? `${partId}-error` : undefined}
              disabled={saving}
            />
            <FieldError id={`${partId}-error`} message={partError} />
          </div>
        )
      })}
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
