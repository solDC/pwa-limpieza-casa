import { describe, expect, it } from 'vitest'
import {
  describeHistoryDay,
  describeOutcome,
  describeWeekendDays,
  hasOlderHistory,
  historyDays,
  historyPage,
  type HistoryTask,
} from '../../../src/domain/history'

// US-31 · Histórico de cada vuelta (#40).
// Noviembre de 2026: el sábado 14, el viernes 20, el sábado 21, el lunes 23.

const weekly: HistoryTask = {
  id: 'weekly',
  name: 'Superficies',
  defaultKey: 'surfaces',
  frequency: { kind: 'weekendWeekly', startOn: null },
  createdOn: '2026-11-01',
  frequencySince: '2026-11-01',
}
const interval: HistoryTask = {
  id: 'interval',
  name: 'Cristales',
  defaultKey: null,
  frequency: { kind: 'interval', days: 3, nextDueOn: null },
  createdOn: '2026-11-01',
  frequencySince: '2026-11-01',
}
const oneOff: HistoryTask = {
  id: 'one-off',
  name: 'Horno',
  defaultKey: null,
  frequency: { kind: 'oneOff', dueOn: null },
  createdOn: '2026-11-01',
  frequencySince: '2026-11-01',
}
const today = '2026-11-23'
const days = (tasks: HistoryTask[], rounds = [] as Parameters<typeof historyDays>[1], parts = [] as Parameters<typeof historyDays>[2]) =>
  historyDays(tasks, rounds, parts, '2026-10-27', today, today)

describe('qué sale en el histórico', () => {
  it('una vuelta completada, el día en que se hizo (también las de cada N días y las puntuales)', () => {
    const result = days(
      [weekly, interval, oneOff],
      [
        { taskId: 'weekly', startsOn: '2026-11-21', completedOn: '2026-11-22' },
        { taskId: 'interval', startsOn: '2026-11-20', completedOn: '2026-11-22' },
        { taskId: 'one-off', startsOn: null, completedOn: '2026-11-23' },
      ],
    )
    expect(result.slice(0, 2)).toEqual([
      { day: '2026-11-23', entries: [{ task: oneOff, outcome: { status: 'completed' } }] },
      {
        day: '2026-11-22',
        entries: [
          { task: weekly, outcome: { status: 'completed' } },
          { task: interval, outcome: { status: 'completed' } },
        ],
      },
    ])
  })

  it('una vuelta de fin de semana a medias, el viernes de su plazo, con la suma de los pesos guardados', () => {
    const result = days(
      [weekly],
      [
        { taskId: 'weekly', startsOn: '2026-11-07', completedOn: '2026-11-07' },
        { taskId: 'weekly', startsOn: '2026-11-21', completedOn: '2026-11-21' },
      ],
      [
        { taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 40, removedOn: null },
        { taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 25, removedOn: null },
      ],
    )
    expect(result.find((day) => day.day === '2026-11-20')).toEqual({
      day: '2026-11-20',
      entries: [{ task: weekly, outcome: { status: 'partial', percent: 65, weekend: '2026-11-14' } }],
    })
  })

  it('una parte hecha y quitada en esa misma vuelta ya no cuenta, como en la lista', () => {
    const result = days(
      [weekly],
      [],
      [
        { taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 40, removedOn: '2026-11-15' },
        { taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 30, removedOn: null },
        // Quitada después de la vuelta: en esa vuelta sí cuenta.
        { taskId: 'weekly', startsOn: '2026-11-07', dueBy: '2026-11-13', weight: 20, removedOn: '2026-11-15' },
      ],
    )
    expect(result.find((day) => day.day === '2026-11-20')?.entries[0].outcome).toEqual({
      status: 'partial',
      percent: 30,
      weekend: '2026-11-14',
    })
    expect(result.find((day) => day.day === '2026-11-13')?.entries[0].outcome).toEqual({
      status: 'partial',
      percent: 20,
      weekend: '2026-11-07',
    })
  })

  it('si se quitaron todas las partes hechas de la vuelta, sale como no completada', () => {
    const parts = [{ taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 40, removedOn: '2026-11-15' }]
    expect(days([weekly], [], parts)[0]).toEqual({
      day: '2026-11-20',
      entries: [{ task: weekly, outcome: { status: 'notCompleted', weekend: '2026-11-14' } }],
    })
  })

  it('una vuelta de fin de semana sin nada hecho sale como no completada, el viernes de su plazo', () => {
    const result = days([weekly])
    // Desde la primera vuelta de la tarea (creada el domingo 1: la del sábado 31 de octubre).
    expect(result).toEqual([
      { day: '2026-11-20', entries: [{ task: weekly, outcome: { status: 'notCompleted', weekend: '2026-11-14' } }] },
      { day: '2026-11-13', entries: [{ task: weekly, outcome: { status: 'notCompleted', weekend: '2026-11-07' } }] },
      { day: '2026-11-06', entries: [{ task: weekly, outcome: { status: 'notCompleted', weekend: '2026-10-31' } }] },
    ])
  })

  it('la vuelta en curso no sale, aunque vaya con retraso: sigue en la lista hasta el viernes', () => {
    const friday = historyDays([weekly], [], [], '2026-10-27', '2026-11-20', '2026-11-20')
    expect(friday.map((day) => day.day)).toEqual(['2026-11-13', '2026-11-06'])
    const parts = [{ taskId: 'weekly', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 50, removedOn: null }]
    expect(historyDays([weekly], [], parts, '2026-10-27', '2026-11-20', '2026-11-20')[0].day).toBe('2026-11-13')
  })

  it('las de cada N días y las puntuales a medias no salen: no tienen plazo, siguen en la lista', () => {
    const result = days(
      [interval, oneOff],
      [],
      [
        { taskId: 'interval', startsOn: '2026-11-01', dueBy: null, weight: 50, removedOn: null },
        { taskId: 'one-off', startsOn: null, dueBy: null, weight: 50, removedOn: null },
      ],
    )
    expect(result).toEqual([])
  })

  it('no hay vueltas anteriores a la tarea (US-48)', () => {
    // Creada en domingo: su primera vuelta es la de ese finde; en lunes, la del siguiente.
    const created = { ...weekly, createdOn: '2026-11-15', frequencySince: '2026-11-15' }
    expect(days([created])).toEqual([
      { day: '2026-11-20', entries: [{ task: created, outcome: { status: 'notCompleted', weekend: '2026-11-14' } }] },
    ])
    expect(days([{ ...weekly, createdOn: '2026-11-16', frequencySince: '2026-11-16' }])).toEqual([])
  })

  it('las de cada 15 días, solo los findes que tocan', () => {
    const biweekly: HistoryTask = {
      ...weekly,
      id: 'biweekly',
      frequency: { kind: 'weekendBiweekly', startOn: '2026-10-31' },
    }
    expect(days([biweekly]).map((day) => day.day)).toEqual(['2026-11-20', '2026-11-06'])
  })

  it('una semanal movida a otro finde (US-42): las no completadas, solo desde ese finde', () => {
    const moved: HistoryTask = { ...weekly, frequency: { kind: 'weekendWeekly', startOn: '2026-11-14' } }
    expect(days([moved]).map((day) => day.day)).toEqual(['2026-11-20'])
  })

  it('las vueltas a medias salen siempre, también las de antes de mover la tarea', () => {
    const moved: HistoryTask = { ...weekly, frequency: { kind: 'weekendWeekly', startOn: '2026-11-14' } }
    const parts = [{ taskId: 'weekly', startsOn: '2026-11-07', dueBy: '2026-11-13', weight: 30, removedOn: null }]
    expect(days([moved], [], parts).map((day) => day.day)).toEqual(['2026-11-20', '2026-11-13'])
  })

  it('solo lo de los días que se piden: del primero al último, los dos incluidos', () => {
    const rounds = [
      { taskId: 'interval', startsOn: null, completedOn: '2026-11-10' },
      { taskId: 'interval', startsOn: null, completedOn: '2026-11-09' },
    ]
    const result = historyDays([interval], rounds, [], '2026-11-10', '2026-11-16', today)
    expect(result.map((day) => day.day)).toEqual(['2026-11-10'])
  })

  it('las tareas que no están (canceladas) no salen', () => {
    const rounds = [{ taskId: 'cancelled', startsOn: null, completedOn: '2026-11-22' }]
    expect(days([interval], rounds)).toEqual([])
  })

  it('en un mismo día: primero las completadas, luego las parciales y luego las no completadas', () => {
    const other: HistoryTask = { ...weekly, id: 'other', name: 'Baño' }
    const third: HistoryTask = { ...interval, id: 'third', name: 'Juntas' }
    const result = days(
      [weekly, other, third],
      [{ taskId: 'third', startsOn: '2026-11-17', completedOn: '2026-11-20' }],
      [{ taskId: 'other', startsOn: '2026-11-14', dueBy: '2026-11-20', weight: 50, removedOn: null }],
    )
    expect(result[0].entries.map((entry) => [entry.task.id, entry.outcome.status])).toEqual([
      ['third', 'completed'],
      ['other', 'partial'],
      ['weekly', 'notCompleted'],
    ])
  })
})

describe('US-53 · con la frecuencia cambiada', () => {
  it('las vueltas de antes del cambio salen con la frecuencia de antes; las de después, con la nueva', () => {
    // Semanal hasta el lunes 16, cuando pasó a cada 3 días.
    const changed: HistoryTask = { ...interval, id: 'weekly', frequencySince: '2026-11-16' }
    const periods = [
      {
        taskId: 'weekly',
        frequency: { kind: 'weekendWeekly', startOn: null } as const,
        startsOn: '2026-11-01',
        endsOn: '2026-11-16',
      },
    ]
    const result = historyDays([changed], [], [], '2026-10-27', today, today, periods)
    // El finde del 14-15 ya había empezado al cambiarla: también sale.
    expect(result.map((day) => [day.day, day.entries[0].outcome.status])).toEqual([
      ['2026-11-20', 'notCompleted'],
      ['2026-11-13', 'notCompleted'],
      ['2026-11-06', 'notCompleted'],
    ])
  })

  it('un finde de la frecuencia de antes que también es de la nueva sale una sola vez', () => {
    // Semanal hasta el domingo 15, cuando pasó a cada 15 días desde ese mismo finde.
    const changed: HistoryTask = {
      ...weekly,
      frequency: { kind: 'weekendBiweekly', startOn: '2026-11-14' },
      frequencySince: '2026-11-15',
    }
    const periods = [
      { taskId: 'weekly', frequency: weekly.frequency, startsOn: '2026-11-01', endsOn: '2026-11-15' },
    ]
    const result = historyDays([changed], [], [], '2026-10-27', today, today, periods)
    expect(result.map((day) => day.day)).toEqual(['2026-11-20', '2026-11-13', '2026-11-06'])
  })

  it('una vuelta que se hizo con la frecuencia de antes dentro de ese finde cuenta como hecha', () => {
    // Cada 3 días, hecha el sábado 14; el lunes 16 pasó a semanal desde ese día.
    const changed: HistoryTask = { ...weekly, frequencySince: '2026-11-14' }
    const rounds = [{ taskId: 'weekly', startsOn: '2026-11-11', completedOn: '2026-11-14' }]
    const result = historyDays([changed], rounds, [], '2026-11-10', today, today)
    expect(result.map((day) => [day.day, day.entries[0].outcome.status])).toEqual([['2026-11-14', 'completed']])
  })
})

describe('páginas de 4 semanas', () => {
  it('la primera, las últimas 4 semanas hasta hoy; «Ver más», las 4 anteriores', () => {
    expect(historyPage('2026-11-23', 0)).toEqual({ from: '2026-10-27', to: '2026-11-23' })
    expect(historyPage('2026-11-23', 1)).toEqual({ from: '2026-09-29', to: '2026-10-26' })
  })

  it('en un año bisiesto, el 29 de febrero cuenta', () => {
    expect(historyPage('2028-03-10', 0)).toEqual({ from: '2028-02-12', to: '2028-03-10' })
  })

  it('hay más si alguna tarea se creó antes de la página', () => {
    expect(hasOlderHistory([{ createdOn: '2026-10-26' }], '2026-10-27')).toBe(true)
    expect(hasOlderHistory([{ createdOn: '2026-10-27' }], '2026-10-27')).toBe(false)
  })
})

describe('textos', () => {
  it('el día: «Hoy», «Ayer» o la fecha larga', () => {
    expect(describeHistoryDay('2026-11-23', today, 'es')).toBe('Hoy')
    expect(describeHistoryDay('2026-11-22', today, 'es')).toBe('Ayer')
    expect(describeHistoryDay('2026-11-21', today, 'es')).toBe('Sábado 21 de noviembre')
    expect(describeHistoryDay('2026-11-23', today, 'en')).toBe('Today')
    expect(describeHistoryDay('2026-11-22', today, 'en')).toBe('Yesterday')
    expect(describeHistoryDay('2026-11-21', today, 'en')).toBe('Saturday 21 November')
  })

  it('ayer, también a fin de mes y de año', () => {
    expect(describeHistoryDay('2026-11-30', '2026-12-01', 'es')).toBe('Ayer')
    expect(describeHistoryDay('2026-12-31', '2027-01-01', 'es')).toBe('Ayer')
  })

  it('el estado', () => {
    expect(describeOutcome({ status: 'completed' }, 'es')).toBe('Completada')
    expect(describeOutcome({ status: 'partial', percent: 60, weekend: '2026-11-14' }, 'es')).toBe('Parcial (60 %)')
    expect(describeOutcome({ status: 'notCompleted', weekend: '2026-11-14' }, 'es')).toBe('No completada')
    expect(describeOutcome({ status: 'completed' }, 'en')).toBe('Completed')
    expect(describeOutcome({ status: 'partial', percent: 60, weekend: '2026-11-14' }, 'en')).toBe('Partial (60%)')
    expect(describeOutcome({ status: 'notCompleted', weekend: '2026-11-14' }, 'en')).toBe('Not completed')
  })

  it('el finde, también entre dos meses', () => {
    expect(describeWeekendDays('2026-11-14', 'es')).toBe('Finde del 14-15 nov')
    expect(describeWeekendDays('2026-10-31', 'es')).toBe('Finde del 31 oct-1 nov')
    expect(describeWeekendDays('2026-11-14', 'en')).toBe('Weekend of 14-15 Nov')
    expect(describeWeekendDays('2027-01-30', 'en')).toBe('Weekend of 30-31 Jan')
  })
})
