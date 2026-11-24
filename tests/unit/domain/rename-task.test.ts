import { describe, expect, it } from 'vitest'
import {
  isEmptyRename,
  renameDraft,
  validateRename,
  withRenamed,
} from '../../../src/domain/rename-task'
import type { Task } from '../../../src/domain/task'

// US-54 · Cambiar el nombre de una tarea y de sus partes (#96)

/** Superficies, de las tareas por defecto: con sus claves, se traduce. */
const surfaces: Task = {
  id: 'surfaces',
  householdId: 'home',
  name: 'Superficies',
  defaultKey: 'surfaces',
  frequency: { kind: 'weekendWeekly', startOn: null },
  parts: [
    { id: 'kitchen', name: 'Cocina', defaultKey: 'kitchen', weight: 50 },
    { id: 'living', name: 'Salón', defaultKey: 'living_room', weight: 25 },
    { id: 'bedroom', name: 'Dormitorio', defaultKey: 'bedroom', weight: 25 },
  ],
  createdOn: '2026-10-01',
  frequencySince: '2026-10-01',
  cancelledOn: null,
  lastCompletedOn: null,
  partCompletions: [{ partId: 'kitchen', startsOn: '2026-11-21' }],
}

const bathroom = { id: 'bathroom', name: 'Baño', frequency: { kind: 'interval', days: 3, nextDueOn: null }, lastCompletedOn: null } as const
const others = [surfaces, bathroom]

describe('renameDraft: el formulario al abrirlo', () => {
  it('con los nombres como se ven, en el idioma elegido', () => {
    expect(renameDraft(surfaces, 'es')).toEqual({
      name: 'Superficies',
      partNames: ['Cocina', 'Salón', 'Dormitorio'],
    })
    expect(renameDraft(surfaces, 'en')).toEqual({
      name: 'Surfaces',
      partNames: ['Kitchen', 'Living room', 'Bedroom'],
    })
  })
})

describe('validateRename: qué se ha renombrado', () => {
  it('sin cambios no hay nada que guardar, tampoco en inglés', () => {
    for (const language of ['es', 'en'] as const) {
      const result = validateRename(surfaces, renameDraft(surfaces, language), others, language)
      expect(result).toEqual({ ok: true, rename: { name: null, parts: [] } })
      expect(result.ok && isEmptyRename(result.rename)).toBe(true)
    }
  })

  it('los espacios al principio y al final no cuentan', () => {
    const draft = { name: ' Superficies  ', partNames: ['Cocina ', ' Salón', 'Dormitorio'] }
    expect(validateRename(surfaces, draft, others, 'es')).toEqual({ ok: true, rename: { name: null, parts: [] } })
  })

  it('solo lo que cambia, sin los espacios', () => {
    const draft = { name: '  Superficies de abajo ', partNames: ['Cocina', ' Salón comedor ', 'Dormitorio'] }
    expect(validateRename(surfaces, draft, others, 'es')).toEqual({
      ok: true,
      rename: { name: 'Superficies de abajo', parts: [{ id: 'living', name: 'Salón comedor' }] },
    })
  })

  it('en inglés, renombrar es escribir algo distinto de lo que se ve', () => {
    const draft = { name: 'Surfaces', partNames: ['Kitchen', 'Lounge', 'Bedroom'] }
    expect(validateRename(surfaces, draft, others, 'en')).toEqual({
      ok: true,
      rename: { name: null, parts: [{ id: 'living', name: 'Lounge' }] },
    })
  })

  it('cambiar solo las mayúsculas también es renombrar', () => {
    const draft = { name: 'SUPERFICIES', partNames: ['Cocina', 'Salón', 'Dormitorio'] }
    expect(validateRename(surfaces, draft, others, 'es')).toMatchObject({ ok: true, rename: { name: 'SUPERFICIES' } })
  })

  it('ningún nombre vacío ni de más de 80 caracteres', () => {
    const draft = { name: '  ', partNames: ['Cocina', 'a'.repeat(81), ' '] }
    expect(validateRename(surfaces, draft, others, 'es')).toEqual({
      ok: false,
      errors: {
        name: 'Escribe el nombre de la tarea.',
        parts: [
          undefined,
          'El nombre puede tener como mucho 80 caracteres.',
          'Escribe el nombre de la parte o quítala.',
        ],
      },
    })
    expect(validateRename(surfaces, { ...renameDraft(surfaces, 'es'), name: 'a'.repeat(80) }, others, 'es').ok).toBe(
      true,
    )
  })

  it('no puede llamarse como otra tarea, sin distinguir mayúsculas ni espacios', () => {
    const draft = { ...renameDraft(surfaces, 'es'), name: ' baño ' }
    expect(validateRename(surfaces, draft, others, 'es')).toEqual({
      ok: false,
      errors: { name: 'Ya tienes una tarea con ese nombre.' },
    })
    expect(validateRename(surfaces, draft, others, 'en')).toEqual({
      ok: false,
      errors: { name: 'You already have a task with that name.' },
    })
  })

  it('se compara con el nombre guardado, no con el traducido', () => {
    // En inglés, Superficies se ve «Surfaces»; otra tarea puede llamarse así.
    const own = { ...surfaces, id: 'own', name: 'Polvo', defaultKey: null, parts: [] }
    const draft = { name: 'Surfaces', partNames: [] }
    expect(validateRename(own, draft, [...others, own], 'en')).toMatchObject({ ok: true })
  })

  it('las partes sí pueden repetirse', () => {
    const draft = { name: 'Superficies', partNames: ['Cocina', 'Cocina', 'Dormitorio'] }
    expect(validateRename(surfaces, draft, others, 'es')).toEqual({
      ok: true,
      rename: { name: null, parts: [{ id: 'living', name: 'Cocina' }] },
    })
  })
})

describe('withRenamed: la tarea después de guardar', () => {
  it('lo renombrado pierde su clave y se ve como se escribió; lo demás se sigue traduciendo', () => {
    const renamed = withRenamed(surfaces, {
      name: 'Superficies de abajo',
      parts: [{ id: 'living', name: 'Salón comedor' }],
    })
    expect(renamed).toMatchObject({ name: 'Superficies de abajo', defaultKey: null })
    expect(renamed.parts).toEqual([
      { id: 'kitchen', name: 'Cocina', defaultKey: 'kitchen', weight: 50 },
      { id: 'living', name: 'Salón comedor', defaultKey: null, weight: 25 },
      { id: 'bedroom', name: 'Dormitorio', defaultKey: 'bedroom', weight: 25 },
    ])
    expect(renameDraft(renamed, 'en')).toEqual({
      name: 'Superficies de abajo',
      partNames: ['Kitchen', 'Salón comedor', 'Bedroom'],
    })
  })

  it('sin nombre nuevo, la tarea conserva el suyo y su clave; el progreso no cambia', () => {
    const renamed = withRenamed(surfaces, { name: null, parts: [{ id: 'kitchen', name: 'Cocina y despensa' }] })
    expect(renamed).toMatchObject({ name: 'Superficies', defaultKey: 'surfaces' })
    expect(renamed.partCompletions).toEqual(surfaces.partCompletions)
  })
})
