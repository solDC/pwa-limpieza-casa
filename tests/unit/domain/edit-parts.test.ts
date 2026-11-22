import { describe, expect, it } from 'vitest'
import {
  addEditedPart,
  editPartsDraft,
  isEmptyPartsChange,
  removeEditedPart,
  validatePartsChange,
  withPartsChanged,
} from '../../../src/domain/edit-parts'
import { setPartWeight, renamePart } from '../../../src/domain/new-task'
import { roundProgress } from '../../../src/domain/progress'
import type { Task } from '../../../src/domain/task'

// US-51 · Cambiar las partes de una tarea (#83)

const weekend = { startsOn: '2026-11-21', dueBy: '2026-11-27' }

/** Superficies, de las tareas por defecto, con Cocina hecha en la vuelta en curso. */
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
  cancelledOn: null,
  lastCompletedOn: null,
  partCompletions: [{ partId: 'kitchen', startsOn: '2026-11-21' }],
}

/** Con dos partes a partes iguales. */
const halves: Task = {
  ...surfaces,
  parts: [
    { id: 'a', name: 'Arriba', defaultKey: null, weight: 50 },
    { id: 'b', name: 'Abajo', defaultKey: null, weight: 50 },
  ],
  partCompletions: [],
}

const bathroom: Task = { ...surfaces, id: 'bathroom', name: 'Baño', parts: [], partCompletions: [] }

describe('editPartsDraft: el formulario al abrirlo', () => {
  it('con las partes como se ven y sus pesos', () => {
    expect(editPartsDraft(surfaces, 'en')).toEqual({
      partIds: ['kitchen', 'living', 'bedroom'],
      partNames: ['Kitchen', 'Living room', 'Bedroom'],
      partWeights: ['50', '25', '25'],
      weightsEdited: true,
    })
  })

  it('si están repartidos a partes iguales, al añadir o quitar se vuelven a repartir', () => {
    const draft = editPartsDraft(halves, 'es')
    expect(draft.weightsEdited).toBe(false)
    const added = addEditedPart(draft)
    expect(added).toMatchObject({ partIds: ['a', 'b', null], partNames: ['Arriba', 'Abajo', ''], partWeights: ['34', '33', '33'] })
    expect(removeEditedPart(added, 0)).toMatchObject({ partIds: ['b', null], partWeights: ['50', '50'] })
  })

  it('si no, se conservan y la nueva empieza en 0', () => {
    const added = addEditedPart(editPartsDraft(surfaces, 'es'))
    expect(added.partWeights).toEqual(['50', '25', '25', '0'])
    expect(removeEditedPart(added, 1)).toMatchObject({
      partIds: ['kitchen', 'bedroom', null],
      partWeights: ['50', '25', '0'],
    })
  })

  it('una tarea sin partes empieza sin ninguna', () => {
    expect(addEditedPart(editPartsDraft(bathroom, 'es'))).toMatchObject({
      partIds: [null],
      partWeights: ['100'],
    })
  })
})

describe('validatePartsChange: qué hay que guardar', () => {
  it('las que siguen con su peso y las nuevas, sin espacios de más', () => {
    let draft = removeEditedPart(addEditedPart(editPartsDraft(surfaces, 'es')), 1)
    draft = renamePart(draft, 2, '  Fregadero ')
    draft = setPartWeight(setPartWeight(draft, 0, '40'), 2, '35 %')
    expect(validatePartsChange(surfaces, draft, 'es')).toEqual({
      ok: true,
      change: {
        kept: [
          { id: 'kitchen', weight: 40, name: null },
          { id: 'bedroom', weight: 25, name: null },
        ],
        added: [{ name: 'Fregadero', weight: 35 }],
      },
    })
  })

  it('las mismas reglas que al crearla: nombre en las nuevas, pesos de 1 a 100 que suman 100', () => {
    const draft = addEditedPart(editPartsDraft(surfaces, 'es'))
    expect(validatePartsChange(surfaces, draft, 'es')).toEqual({
      ok: false,
      errors: {
        parts: [undefined, undefined, undefined, 'Escribe el nombre de la parte o quítala.'],
        partWeights: [undefined, undefined, undefined, 'Escribe un peso de 1 a 100.'],
      },
    })
    const named = setPartWeight(renamePart(draft, 3, 'Fregadero'), 3, '10')
    expect(validatePartsChange(surfaces, named, 'en')).toEqual({
      ok: false,
      errors: { weightsTotal: 'The weights must add up to 100 % (now they add up to 110 %).' },
    })
  })

  it('también el nombre de las que siguen, solo si se ve distinto (sin espacios de más)', () => {
    let draft = renamePart(editPartsDraft(surfaces, 'es'), 1, '  Salón comedor ')
    draft = renamePart(draft, 2, ' Dormitorio ')
    expect(validatePartsChange(surfaces, draft, 'es')).toEqual({
      ok: true,
      change: {
        kept: [
          { id: 'kitchen', weight: 50, name: null },
          { id: 'living', weight: 25, name: 'Salón comedor' },
          { id: 'bedroom', weight: 25, name: null },
        ],
        added: [],
      },
    })
  })

  it('se compara con el nombre en el idioma elegido: guardar en inglés sin cambiar no renombra', () => {
    const result = validatePartsChange(surfaces, editPartsDraft(surfaces, 'en'), 'en')
    expect(result.ok && result.change.kept.every((kept) => kept.name === null)).toBe(true)
    const renamed = validatePartsChange(surfaces, renamePart(editPartsDraft(surfaces, 'en'), 0, 'Kitchen counter'), 'en')
    expect(renamed.ok && renamed.change.kept[0]).toEqual({ id: 'kitchen', weight: 50, name: 'Kitchen counter' })
  })

  it('el nombre de las que siguen, con las mismas reglas: ni vacío ni de más de 80 caracteres', () => {
    let draft = renamePart(editPartsDraft(surfaces, 'es'), 0, '  ')
    draft = renamePart(draft, 2, 'x'.repeat(81))
    expect(validatePartsChange(surfaces, draft, 'es')).toEqual({
      ok: false,
      errors: {
        parts: [
          'Escribe el nombre de la parte o quítala.',
          undefined,
          'El nombre puede tener como mucho 80 caracteres.',
        ],
      },
    })
  })

  it('se pueden quitar todas', () => {
    const draft = removeEditedPart(removeEditedPart(editPartsDraft(halves, 'es'), 0), 0)
    expect(validatePartsChange(halves, draft, 'es')).toEqual({ ok: true, change: { kept: [], added: [] } })
  })

  it('sin cambios, no hay nada que guardar', () => {
    const result = validatePartsChange(surfaces, editPartsDraft(surfaces, 'es'), 'es')
    expect(result.ok && isEmptyPartsChange(surfaces, result.change)).toBe(true)
    const changed = validatePartsChange(surfaces, setPartWeight(editPartsDraft(surfaces, 'es'), 0, '50'), 'es')
    expect(changed.ok && isEmptyPartsChange(surfaces, changed.change)).toBe(true)
    const renamed = validatePartsChange(surfaces, renamePart(editPartsDraft(surfaces, 'es'), 0, 'Encimera'), 'es')
    expect(renamed.ok && isEmptyPartsChange(surfaces, renamed.change)).toBe(false)
    const removed = validatePartsChange(halves, removeEditedPart(editPartsDraft(halves, 'es'), 0), 'es')
    expect(removed.ok && isEmptyPartsChange(halves, removed.change)).toBe(false)
  })
})

describe('withPartsChanged: la tarea después de guardar', () => {
  it('las que siguen con su peso nuevo y las nuevas al final; las hechas siguen hechas', () => {
    const changed = withPartsChanged(
      surfaces,
      {
        kept: [
          { id: 'kitchen', weight: 40, name: null },
          { id: 'bedroom', weight: 30, name: null },
        ],
        added: [{ name: 'Fregadero', weight: 30 }],
      },
      ['sink'],
      null,
    )
    expect(changed.parts).toEqual([
      { id: 'kitchen', name: 'Cocina', defaultKey: 'kitchen', weight: 40 },
      { id: 'bedroom', name: 'Dormitorio', defaultKey: 'bedroom', weight: 30 },
      { id: 'sink', name: 'Fregadero', defaultKey: null, weight: 30 },
    ])
    const progress = roundProgress(changed, weekend)
    expect(progress.percent).toBe(40)
    expect(progress.remaining.map((part) => part.id)).toEqual(['bedroom', 'sink'])
    expect(changed.lastCompletedOn).toBeNull()
  })

  it('las renombradas, con su nombre nuevo, dejan de traducirse; el progreso no cambia', () => {
    const changed = withPartsChanged(
      surfaces,
      {
        kept: [
          { id: 'kitchen', weight: 50, name: 'Encimera' },
          { id: 'living', weight: 25, name: null },
          { id: 'bedroom', weight: 25, name: null },
        ],
        added: [],
      },
      [],
      null,
    )
    expect(changed.parts).toEqual([
      { id: 'kitchen', name: 'Encimera', defaultKey: null, weight: 50 },
      { id: 'living', name: 'Salón', defaultKey: 'living_room', weight: 25 },
      { id: 'bedroom', name: 'Dormitorio', defaultKey: 'bedroom', weight: 25 },
    ])
    expect(roundProgress(changed, weekend).percent).toBe(50)
  })

  it('si la vuelta ha quedado completada, la próxima vez se cuenta desde ese día', () => {
    const changed = withPartsChanged(surfaces, { kept: [{ id: 'kitchen', weight: 100, name: null }], added: [] }, [], '2026-11-22')
    expect(changed.parts.map((part) => part.id)).toEqual(['kitchen'])
    expect(changed.lastCompletedOn).toBe('2026-11-22')
  })

  it('sin partes, la tarea se marca entera', () => {
    const changed = withPartsChanged(surfaces, { kept: [], added: [] }, [], null)
    expect(changed.parts).toEqual([])
    expect(changed.lastCompletedOn).toBeNull()
  })
})
