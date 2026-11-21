import { describe, expect, it } from 'vitest'
import type { Round } from '../../../src/domain/frequency'
import { roundProgress, withPartsDone } from '../../../src/domain/progress'
import type { Task } from '../../../src/domain/task'

// US-39 · Marcar una parte como hecha (#57)

const weekend: Round = { startsOn: '2026-11-14', dueBy: '2026-11-20' }

const surfaces = (partCompletions: Task['partCompletions'] = []): Task => ({
  id: 'task',
  householdId: 'home',
  name: 'Superficies',
  defaultKey: null,
  frequency: { kind: 'weekendWeekly' },
  parts: [
    { id: 'kitchen', name: 'Cocina', defaultKey: null, weight: 50 },
    { id: 'living', name: 'Salón', defaultKey: null, weight: 25 },
    { id: 'bedroom', name: 'Dormitorio', defaultKey: null, weight: 25 },
  ],
  createdOn: '2026-10-01',
  cancelledOn: null,
  lastCompletedOn: null,
  partCompletions,
})

const names = (parts: { name: string }[]) => parts.map((part) => part.name)

describe('roundProgress: cuánto llevo de la vuelta', () => {
  it('sin partes hechas, 0 % y faltan todas', () => {
    const progress = roundProgress(surfaces(), weekend)
    expect(progress.percent).toBe(0)
    expect(progress.parts.map((item) => item.done)).toEqual([false, false, false])
    expect(names(progress.remaining)).toEqual(['Cocina', 'Salón', 'Dormitorio'])
  })

  it('suma los pesos de las partes hechas en esta vuelta', () => {
    const progress = roundProgress(
      surfaces([
        { partId: 'kitchen', startsOn: '2026-11-14' },
        { partId: 'bedroom', startsOn: '2026-11-14' },
      ]),
      weekend,
    )
    expect(progress.percent).toBe(75)
    expect(progress.parts.map((item) => item.done)).toEqual([true, false, true])
    expect(names(progress.remaining)).toEqual(['Salón'])
  })

  it('las partes hechas en otra vuelta no cuentan', () => {
    const progress = roundProgress(surfaces([{ partId: 'kitchen', startsOn: '2026-11-07' }]), weekend)
    expect(progress.percent).toBe(0)
    expect(progress.remaining).toHaveLength(3)
  })

  it('en una puntual, la vuelta no tiene fecha', () => {
    const noDate: Round = { startsOn: null, dueBy: null }
    const task = surfaces([
      { partId: 'living', startsOn: null },
      { partId: 'kitchen', startsOn: '2026-11-14' },
    ])
    expect(roundProgress(task, noDate).percent).toBe(25)
  })

  it('cuenta con los pesos de ahora, y cada parte una sola vez', () => {
    const task = surfaces([
      { partId: 'kitchen', startsOn: '2026-11-14' },
      { partId: 'kitchen', startsOn: '2026-11-14' },
      { partId: 'ya-no-existe', startsOn: '2026-11-14' },
    ])
    expect(roundProgress(task, weekend).percent).toBe(50)
  })

  it('una tarea sin partes no tiene progreso', () => {
    const progress = roundProgress({ parts: [], partCompletions: [] }, weekend)
    expect(progress).toEqual({ percent: 0, parts: [], remaining: [] })
  })
})

describe('withPartsDone: la tarea después de marcar partes', () => {
  it('apunta las partes en la vuelta; si faltan otras, la vuelta sigue en curso', () => {
    const task = withPartsDone(surfaces(), weekend, ['kitchen'], '2026-11-14')
    expect(roundProgress(task, weekend).percent).toBe(50)
    expect(task.lastCompletedOn).toBeNull()
  })

  it('al marcar la última, la vuelta queda terminada ese día', () => {
    let task = withPartsDone(surfaces(), weekend, ['kitchen'], '2026-11-14')
    task = withPartsDone(task, weekend, ['living', 'bedroom'], '2026-11-15')
    expect(task.lastCompletedOn).toBe('2026-11-15')
  })

  it('no cambia la tarea que recibe', () => {
    const task = surfaces()
    withPartsDone(task, weekend, ['kitchen', 'living', 'bedroom'], '2026-11-14')
    expect(task).toEqual(surfaces())
  })
})
