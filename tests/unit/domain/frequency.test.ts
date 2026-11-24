import { describe, expect, it } from 'vitest'
import {
  canMarkDone,
  currentRound,
  describeDue,
  describeWeekend,
  dueDate,
  dueStatus,
  isWeekend,
  moveWeekendOptions,
  pastWeekendRounds,
  thisOrNextWeekend,
} from '../../../src/domain/frequency'
import type { Frequency } from '../../../src/domain/task'

// US-28 · Frecuencias (#37). Las reglas están en «Conceptos» de docs/user-stories.md.

const createdOn = '2026-11-08'
const round = (frequency: Frequency, lastCompletedOn: string | null, today: string) =>
  currentRound({ frequency, frequencySince: createdOn, lastCompletedOn }, today)

describe('semanal, en fin de semana: toca el finde y se puede hacer hasta el viernes', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }

  it('el sábado y el domingo toca la vuelta de ese finde, con plazo hasta el viernes', () => {
    expect(round(weekly, null, '2026-11-14')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
    expect(round(weekly, null, '2026-11-15')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
  })

  it('entre semana sigue siendo la vuelta del finde anterior, hasta el viernes', () => {
    expect(round(weekly, null, '2026-11-18')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
    expect(round(weekly, null, '2026-11-20')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
  })

  it('el sábado siguiente empieza una vuelta nueva', () => {
    expect(round(weekly, null, '2026-11-21')).toEqual({ startsOn: '2026-11-21', dueBy: '2026-11-27' })
  })

  it('si ya se hizo en esta vuelta, toca el finde siguiente', () => {
    expect(round(weekly, '2026-11-15', '2026-11-18')).toEqual({
      startsOn: '2026-11-21',
      dueBy: '2026-11-27',
    })
    expect(round(weekly, '2026-11-20', '2026-11-20')).toEqual({
      startsOn: '2026-11-21',
      dueBy: '2026-11-27',
    })
  })

  it('si se hizo en una vuelta anterior, toca la de ahora', () => {
    expect(round(weekly, '2026-11-08', '2026-11-18')).toEqual({
      startsOn: '2026-11-14',
      dueBy: '2026-11-20',
    })
  })

  it('cruza el cambio de año', () => {
    expect(round(weekly, null, '2026-12-30')).toEqual({ startsOn: '2026-12-26', dueBy: '2027-01-01' })
    expect(round(weekly, '2026-12-27', '2026-12-30')).toEqual({
      startsOn: '2027-01-02',
      dueBy: '2027-01-08',
    })
  })

  it('cruza el 29 de febrero y el cambio de hora', () => {
    expect(round(weekly, null, '2028-02-29')).toEqual({ startsOn: '2028-02-26', dueBy: '2028-03-03' })
    // Una tarea creada antes de ese cambio de hora (con fecha anterior al resto de pruebas).
    expect(
      currentRound({ frequency: weekly, frequencySince: '2026-01-01', lastCompletedOn: null }, '2026-03-29'),
    ).toEqual({ startsOn: '2026-03-28', dueBy: '2026-04-03' })
  })
})

describe('US-42 · una semanal movida a otro finde', () => {
  // Creada el domingo 8 nov: su primer finde es el del 7-8 nov.
  const movedTo = (startOn: string): Frequency => ({ kind: 'weekendWeekly', startOn })

  it('hasta el finde elegido, toca ese finde, sin retraso, y no se puede marcar', () => {
    // Miércoles 18: sin mover, la vuelta del 14 va con retraso.
    expect(round(movedTo('2026-11-28'), null, '2026-11-18')).toEqual({
      startsOn: '2026-11-28',
      dueBy: '2026-12-04',
    })
    const moved = round(movedTo('2026-11-28'), null, '2026-11-18')!
    expect(dueStatus(movedTo('2026-11-28'), moved, '2026-11-18')).toEqual({ status: 'upcoming' })
    expect(describeDue(movedTo('2026-11-28'), moved, '2026-11-18', 'es')).toBe('Toca: finde del 28 nov')
    expect(canMarkDone({ frequency: movedTo('2026-11-28'), lastCompletedOn: null }, moved, '2026-11-18')).toBe(false)
  })

  it('ese finde toca, y si no se hace, va con retraso como siempre', () => {
    expect(round(movedTo('2026-11-28'), null, '2026-11-28')).toEqual({ startsOn: '2026-11-28', dueBy: '2026-12-04' })
    expect(round(movedTo('2026-11-28'), null, '2026-12-01')).toEqual({ startsOn: '2026-11-28', dueBy: '2026-12-04' })
  })

  it('después de hacerla, vuelve a tocar cada finde', () => {
    expect(round(movedTo('2026-11-28'), '2026-11-29', '2026-11-30')).toEqual({
      startsOn: '2026-12-05',
      dueBy: '2026-12-11',
    })
    expect(round(movedTo('2026-11-28'), '2026-11-29', '2026-12-12')).toEqual({
      startsOn: '2026-12-12',
      dueBy: '2026-12-18',
    })
  })

  it('un finde anterior al primero de la tarea no la adelanta (US-48)', () => {
    const createdThursday = currentRound(
      { frequency: movedTo('2026-11-07'), frequencySince: '2026-11-12', lastCompletedOn: null },
      '2026-11-12',
    )
    expect(createdThursday).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
  })
})

describe('US-42 · una de cada 15 días movida a otro finde', () => {
  it('todo el calendario empieza en el finde nuevo: las siguientes, cada 15 días desde él', () => {
    // Empezaba el 5 dic; se mueve al 12 dic.
    const moved: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-12' }
    expect(round(moved, null, '2026-11-25')).toEqual({ startsOn: '2026-12-12', dueBy: '2026-12-18' })
    expect(round(moved, '2026-12-13', '2026-12-14')).toEqual({ startsOn: '2026-12-26', dueBy: '2027-01-01' })
    expect(round(moved, '2026-12-27', '2027-01-04')).toEqual({ startsOn: '2027-01-09', dueBy: '2027-01-15' })
  })
})

describe('US-42 · los findes a los que se puede mover una tarea', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
  const options = (today: string, lastCompletedOn: string | null = null) => {
    const task = { frequency: weekly, frequencySince: createdOn, lastCompletedOn }
    return moveWeekendOptions(task, currentRound(task, today)!, today)
  }

  it('los 8 próximos, desde el siguiente entre semana', () => {
    // Miércoles 18 nov: la vuelta del 14 va con retraso; se puede mover del 21 en adelante.
    expect(options('2026-11-18')).toEqual([
      '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12',
      '2026-12-19', '2026-12-26', '2027-01-02', '2027-01-09',
    ])
  })

  it('en sábado o domingo, desde el actual, sin el que ya se muestra', () => {
    // Domingo 15: se muestra la vuelta del 14, así que empieza en el 21.
    expect(options('2026-11-15')[0]).toBe('2026-11-21')
    expect(options('2026-11-15')).toHaveLength(8)
  })

  it('sin los findes que ya están hechos', () => {
    // Hecha el sábado 21: se muestra el finde del 28; el del 21 tampoco sale.
    const done = options('2026-11-21', '2026-11-21')
    expect(done[0]).toBe('2026-12-05')
    expect(done).not.toContain('2026-11-21')
    expect(done).not.toContain('2026-11-28')
  })

  it('una movida más adelante se puede traer de vuelta a un finde anterior', () => {
    const task = { frequency: { kind: 'weekendWeekly', startOn: '2026-12-19' } as Frequency, frequencySince: createdOn, lastCompletedOn: null }
    const shown = currentRound(task, '2026-11-18')!
    expect(shown.startsOn).toBe('2026-12-19')
    expect(moveWeekendOptions(task, shown, '2026-11-18').slice(0, 2)).toEqual(['2026-11-21', '2026-11-28'])
  })

  it('cruza el fin de mes y el cambio de hora', () => {
    // Una tarea creada a principios de año, para que la vuelta que se muestra sea la de antes.
    const firstOptions = (today: string) => {
      const task = { frequency: weekly, frequencySince: '2026-01-01', lastCompletedOn: null }
      return moveWeekendOptions(task, currentRound(task, today)!, today).slice(0, 3)
    }
    // Miércoles 24 mar 2027: el domingo 28 cambia la hora.
    expect(firstOptions('2027-03-24')).toEqual(['2027-03-27', '2027-04-03', '2027-04-10'])
    // Miércoles 28 oct 2026: la hora cambió el domingo 25, y el mes acaba el sábado 31.
    expect(firstOptions('2026-10-28')).toEqual(['2026-10-31', '2026-11-07', '2026-11-14'])
  })

  it('el nombre de cada finde', () => {
    expect(describeWeekend('2026-11-28', 'es')).toBe('finde del 28 nov')
    expect(describeWeekend('2026-11-28', 'en')).toBe('weekend of 28 Nov')
  })
})

describe('fin de semana cada 15 días: un finde sí y otro no, con plazo hasta el viernes', () => {
  const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }

  it('antes del primer finde, toca el primero', () => {
    expect(round(biweekly, null, '2026-11-08')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
  })

  it('del sábado al viernes es la vuelta de ese finde', () => {
    expect(round(biweekly, null, '2026-12-05')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
    expect(round(biweekly, null, '2026-12-11')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
  })

  it('en la semana que no toca, ya se ve el finde siguiente', () => {
    expect(round(biweekly, null, '2026-12-12')).toEqual({ startsOn: '2026-12-19', dueBy: '2026-12-25' })
    expect(round(biweekly, null, '2026-12-16')).toEqual({ startsOn: '2026-12-19', dueBy: '2026-12-25' })
  })

  it('si ya se hizo en esta vuelta, toca dentro de 15 días', () => {
    expect(round(biweekly, '2026-12-06', '2026-12-08')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('si se hizo en la vuelta anterior, toca la de ahora', () => {
    expect(round(biweekly, '2026-12-06', '2026-12-20')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('cruza el cambio de año', () => {
    expect(round(biweekly, '2026-12-19', '2026-12-30')).toEqual({
      startsOn: '2027-01-02',
      dueBy: '2027-01-08',
    })
  })
})

describe('cada N días desde la última vez', () => {
  const bathroom: Frequency = { kind: 'interval', days: 3, nextDueOn: null }

  it('la primera vez toca desde el día en que se creó', () => {
    expect(round(bathroom, null, '2026-11-08')).toEqual({ startsOn: '2026-11-08', dueBy: null })
    expect(round(bathroom, null, '2026-11-20')).toEqual({ startsOn: '2026-11-08', dueBy: null })
  })

  it('después, N días desde el día en que se terminó', () => {
    expect(round(bathroom, '2026-11-10', '2026-11-10')).toEqual({ startsOn: '2026-11-13', dueBy: null })
  })

  it('si se hace antes de tiempo, cuenta desde ese día, no desde la fecha prevista', () => {
    expect(round(bathroom, '2026-11-11', '2026-11-11')).toEqual({ startsOn: '2026-11-14', dueBy: null })
  })

  it('si se hace con retraso, cuenta desde ese día, no desde la fecha prevista', () => {
    expect(round(bathroom, '2026-11-20', '2026-11-20')).toEqual({ startsOn: '2026-11-23', dueBy: null })
  })

  it('30 días cruzando meses cortos y años bisiestos', () => {
    const windows: Frequency = { kind: 'interval', days: 30, nextDueOn: null }
    // Creada antes de hacerse (la de las demás pruebas es de noviembre de 2026).
    const since = (frequencySince: string, lastCompletedOn: string) =>
      currentRound({ frequency: windows, frequencySince, lastCompletedOn }, lastCompletedOn)
    expect(since('2026-01-01', '2026-01-30')).toEqual({ startsOn: '2026-03-01', dueBy: null })
    expect(since('2028-01-01', '2028-02-15')).toEqual({ startsOn: '2028-03-16', dueBy: null })
  })
})

describe('cada N días con otro día elegido para la próxima vez (US-41)', () => {
  // Baño, cada 3 días, hecho por última vez el 10 nov: tocaba el 13.
  const moved = (nextDueOn: string): Frequency => ({ kind: 'interval', days: 3, nextDueOn })

  it('la vuelta no cambia: sigue empezando el día que le tocaba (así no se pierden sus partes)', () => {
    expect(round(moved('2026-11-20'), '2026-11-10', '2026-11-15')).toEqual({
      startsOn: '2026-11-13',
      dueBy: null,
    })
    expect(round(moved('2026-11-20'), null, '2026-11-15')).toEqual({ startsOn: createdOn, dueBy: null })
  })

  it('toca el día elegido, antes o después del que le tocaba', () => {
    const natural = round(moved('2026-11-20'), '2026-11-10', '2026-11-15')!
    expect(dueDate(moved('2026-11-20'), natural)).toBe('2026-11-20')
    expect(dueDate(moved('2026-11-11'), natural)).toBe('2026-11-11')
    expect(dueDate({ kind: 'interval', days: 3, nextDueOn: null }, natural)).toBe('2026-11-13')
  })

  it('una tarea retrasada pasada a hoy o a un día futuro deja de ir con retraso', () => {
    const natural = { startsOn: '2026-11-13', dueBy: null }
    expect(dueStatus({ kind: 'interval', days: 3, nextDueOn: null }, natural, '2026-11-15')).toEqual({
      status: 'overdue',
      days: 2,
    })
    expect(dueStatus(moved('2026-11-15'), natural, '2026-11-15')).toEqual({ status: 'today' })
    expect(dueStatus(moved('2026-11-17'), natural, '2026-11-15')).toEqual({ status: 'upcoming' })
  })

  it('si llega el día elegido sin hacerla, va con retraso desde el día siguiente', () => {
    const natural = { startsOn: '2026-11-13', dueBy: null }
    expect(dueStatus(moved('2026-11-17'), natural, '2026-11-19')).toEqual({ status: 'overdue', days: 2 })
    expect(describeDue(moved('2026-11-17'), natural, '2026-11-19', 'es')).toBe(
      'Retrasada 2 días (tocaba el mar 17 nov)',
    )
  })

  it('dice el día elegido en «Toca:»', () => {
    const natural = { startsOn: '2026-11-13', dueBy: null }
    expect(describeDue(moved('2026-11-15'), natural, '2026-11-15', 'es')).toBe('Toca: hoy')
    expect(describeDue(moved('2026-11-16'), natural, '2026-11-15', 'es')).toBe('Toca: mañana')
    expect(describeDue(moved('2026-11-18'), natural, '2026-11-15', 'en')).toBe('Due: Wed 18 Nov')
  })
})

describe('puntual', () => {
  const oneOff: Frequency = { kind: 'oneOff', dueOn: null }

  it('va sin fecha: está pendiente hasta que se hace y nunca tiene retraso', () => {
    expect(round(oneOff, null, '2026-11-08')).toEqual({ startsOn: null, dueBy: null })
    expect(round(oneOff, null, '2027-05-20')).toEqual({ startsOn: null, dueBy: null })
  })

  it('una vez hecha, ya no vuelve a tocar', () => {
    expect(round(oneOff, '2026-11-10', '2026-11-20')).toBeNull()
  })
})

// US-38 · Poner fecha a una tarea puntual (#54)
describe('puntual con fecha', () => {
  const oven: Frequency = { kind: 'oneOff', dueOn: '2026-11-18' }

  it('la vuelta sigue sin fecha: cambiar la fecha no cambia la vuelta (ni sus partes hechas)', () => {
    expect(round(oven, null, '2026-11-08')).toEqual({ startsOn: null, dueBy: null })
    expect(round(oven, null, '2026-11-30')).toEqual({ startsOn: null, dueBy: null })
  })

  it('una vez hecha, ya no vuelve a tocar, aunque fuera antes de su fecha', () => {
    expect(round(oven, '2026-11-10', '2026-11-12')).toBeNull()
  })

  it('se puede marcar antes de su fecha, como las de cada N días', () => {
    expect(canMarkDone({ frequency: oven, lastCompletedOn: null }, { startsOn: null, dueBy: null }, '2026-11-08')).toBe(true)
  })

  it('dice cuándo toca, como las de cada N días', () => {
    const noRound = { startsOn: null, dueBy: null }
    const text = (dueOn: string, today: string, language: 'es' | 'en' = 'es') =>
      describeDue({ kind: 'oneOff', dueOn }, noRound, today, language)
    expect(text('2026-11-08', '2026-11-08')).toBe('Toca: hoy')
    expect(text('2026-11-09', '2026-11-08')).toBe('Toca: mañana')
    expect(text('2026-11-18', '2026-11-08')).toBe('Toca: mié 18 nov')
    expect(text('2026-11-09', '2026-11-12')).toBe('Retrasada 3 días (tocaba el lun 9 nov)')
    expect(text('2026-11-09', '2026-11-10')).toBe('Retrasada 1 día (tocaba el lun 9 nov)')
    expect(text('2026-11-18', '2026-11-08', 'en')).toBe('Due: Wed 18 Nov')
    expect(text('2026-11-09', '2026-11-12', 'en')).toBe('Overdue 3 days (was due Mon 9 Nov)')
  })
})

describe('describeDue: el texto de «Toca:»', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
  const bathroom: Frequency = { kind: 'interval', days: 3, nextDueOn: null }

  it('las de fin de semana dicen de qué finde son', () => {
    const round = { startsOn: '2026-11-14', dueBy: '2026-11-20' }
    expect(describeDue(weekly, round, '2026-11-12', 'es')).toBe('Toca: finde del 14 nov')
    expect(describeDue(weekly, round, '2026-11-14', 'es')).toBe('Toca: finde del 14 nov')
    expect(describeDue(weekly, round, '2026-11-15', 'es')).toBe('Toca: finde del 14 nov')
  })

  it('hoy y mañana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-08', dueBy: null }, '2026-11-08', 'es')).toBe('Toca: hoy')
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-08', 'es')).toBe('Toca: mañana')
  })

  it('otro día futuro, con el día de la semana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-18', dueBy: null }, '2026-11-08', 'es')).toBe(
      'Toca: mié 18 nov',
    )
  })

  it('sin fecha', () => {
    expect(describeDue({ kind: 'oneOff', dueOn: null }, { startsOn: null, dueBy: null }, '2026-11-08', 'es')).toBe(
      'Sin fecha',
    )
  })

  // US-29 · Qué toca (#38)
  it('si va con retraso, cuántos días y cuándo tocaba', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-12', 'es')).toBe(
      'Retrasada 3 días (tocaba el lun 9 nov)',
    )
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-10', 'es')).toBe(
      'Retrasada 1 día (tocaba el lun 9 nov)',
    )
  })

  it('las de fin de semana, entre semana, con retraso desde el lunes', () => {
    const round = { startsOn: '2026-11-14', dueBy: '2026-11-20' }
    expect(describeDue(weekly, round, '2026-11-16', 'es')).toBe(
      'Retrasada 1 día (tocaba el finde del 14 nov)',
    )
    expect(describeDue(weekly, round, '2026-11-20', 'es')).toBe(
      'Retrasada 5 días (tocaba el finde del 14 nov)',
    )
  })
})

// US-30 · Marcar una tarea como hecha (#39)
describe('canMarkDone: si se puede marcar como hecha la vuelta que se muestra', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
  const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
  const interval: Frequency = { kind: 'interval', days: 3, nextDueOn: null }
  const oneOff: Frequency = { kind: 'oneOff', dueOn: null }
  const can = (frequency: Frequency, lastCompletedOn: string | null, today: string) => {
    const shown = round(frequency, lastCompletedOn, today)
    return shown !== null && canMarkDone({ frequency, lastCompletedOn }, shown, today)
  }

  it('de fin de semana: sí durante la vuelta, del sábado al viernes', () => {
    expect(can(weekly, null, '2026-11-14')).toBe(true)
    expect(can(weekly, null, '2026-11-18')).toBe(true)
    expect(can(weekly, null, '2026-11-20')).toBe(true)
  })

  it('de fin de semana: no si ya se hizo y se muestra el finde siguiente', () => {
    expect(can(weekly, '2026-11-15', '2026-11-18')).toBe(false)
    expect(can(weekly, '2026-11-20', '2026-11-20')).toBe(false)
  })

  it('cada 15 días: no antes del primer finde ni en la semana que no toca', () => {
    expect(can(biweekly, null, '2026-11-18')).toBe(false)
    expect(can(biweekly, null, '2026-12-05')).toBe(true)
    expect(can(biweekly, null, '2026-12-11')).toBe(true)
    expect(can(biweekly, null, '2026-12-12')).toBe(false)
    expect(can(biweekly, null, '2026-12-19')).toBe(true)
  })

  it('cada N días: también antes de que toque (cuenta desde el día en que se hace)', () => {
    expect(can(interval, null, '2026-11-08')).toBe(true)
    expect(can(interval, '2026-11-08', '2026-11-09')).toBe(true)
    expect(can(interval, '2026-11-01', '2026-11-20')).toBe(true)
  })

  // Regresión: marcarla dos veces el mismo día guardaba la vuelta siguiente sin cambiar
  // el día de la última, y la tarea ya no se podía volver a marcar.
  it('cada N días: no otra vez el mismo día en que ya se hizo', () => {
    expect(can(interval, '2026-11-08', '2026-11-08')).toBe(false)
  })

  it('puntual: sí mientras está pendiente', () => {
    expect(can(oneOff, null, '2026-11-08')).toBe(true)
    expect(can(oneOff, '2026-11-08', '2026-11-08')).toBe(false)
  })
})

describe('isWeekend: si una frecuencia es de fin de semana', () => {
  it('lo son la semanal y la de cada 15 días', () => {
    expect(isWeekend({ kind: 'weekendWeekly', startOn: null })).toBe(true)
    expect(isWeekend({ kind: 'weekendBiweekly', startOn: '2026-12-05' })).toBe(true)
  })

  it('no lo son la de cada N días ni la puntual', () => {
    expect(isWeekend({ kind: 'interval', days: 3, nextDueOn: null })).toBe(false)
    expect(isWeekend({ kind: 'oneOff', dueOn: null })).toBe(false)
  })
})

// US-48 · Las tareas nuevas no empiezan con retraso (#71)
describe('una tarea nueva no empieza con una vuelta anterior a crearla', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
  const cati: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
  const roundOf = (frequency: Frequency, created: string, today: string) =>
    currentRound({ frequency, frequencySince: created, lastCompletedOn: null }, today)!

  it('de fin de semana, creada de lunes a viernes: empieza el sábado siguiente, sin retraso', () => {
    // Lunes, miércoles y viernes.
    for (const day of ['2026-11-16', '2026-11-18', '2026-11-20']) {
      const first = roundOf(weekly, day, day)
      expect(first).toEqual({ startsOn: '2026-11-21', dueBy: '2026-11-27' })
      expect(dueStatus(weekly, first, day)).toEqual({ status: 'upcoming' })
      expect(describeDue(weekly, first, day, 'es')).toBe('Toca: finde del 21 nov')
    }
  })

  it('de fin de semana, creada en sábado o domingo: toca ese mismo fin de semana', () => {
    expect(roundOf(weekly, '2026-11-14', '2026-11-14')).toEqual({
      startsOn: '2026-11-14',
      dueBy: '2026-11-20',
    })
    expect(roundOf(weekly, '2026-11-15', '2026-11-15')).toEqual({
      startsOn: '2026-11-14',
      dueBy: '2026-11-20',
    })
    // Y si no se hace, el lunes va con retraso, como cualquier otra.
    const first = roundOf(weekly, '2026-11-15', '2026-11-16')
    expect(dueStatus(weekly, first, '2026-11-16')).toEqual({ status: 'overdue', days: 1 })
  })

  it('cuando llega su primer finde, es una vuelta normal', () => {
    expect(roundOf(weekly, '2026-11-18', '2026-11-21')).toEqual({
      startsOn: '2026-11-21',
      dueBy: '2026-11-27',
    })
    expect(roundOf(weekly, '2026-11-18', '2026-11-30')).toEqual({
      startsOn: '2026-11-28',
      dueBy: '2026-12-04',
    })
  })

  it('cruza el cambio de año', () => {
    expect(roundOf(weekly, '2026-12-30', '2026-12-30')).toEqual({
      startsOn: '2027-01-02',
      dueBy: '2027-01-08',
    })
  })

  it('cada 15 días: la primera vuelta es la primera de su calendario desde el día en que se crea', () => {
    // Creada el miércoles después de un finde que tocaba: espera al siguiente de su calendario.
    expect(roundOf(cati, '2026-12-09', '2026-12-09')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
    // Creada en la semana que no toca: también el siguiente de su calendario.
    expect(roundOf(cati, '2026-12-16', '2026-12-16')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
    // Creada en el sábado o el domingo de un finde que toca: ese mismo finde.
    expect(roundOf(cati, '2026-12-19', '2026-12-19')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
    expect(roundOf(cati, '2026-12-20', '2026-12-20')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('cada 15 días, creada el domingo de un finde que no toca: el siguiente de su calendario', () => {
    // El 12-13 de diciembre no toca (sí el 5 y el 19).
    expect(roundOf(cati, '2026-12-13', '2026-12-13')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('cada 15 días, creada antes de su primer finde: toca el primero', () => {
    expect(roundOf(cati, '2026-11-18', '2026-11-18')).toEqual({
      startsOn: '2026-12-05',
      dueBy: '2026-12-11',
    })
    expect(roundOf(cati, '2026-11-18', '2026-12-01')).toEqual({
      startsOn: '2026-12-05',
      dueBy: '2026-12-11',
    })
  })

  it('las de cada N días y las puntuales no cambian: tocan desde el día en que se crean', () => {
    expect(roundOf({ kind: 'interval', days: 3, nextDueOn: null }, '2026-11-18', '2026-11-18')).toEqual({
      startsOn: '2026-11-18',
      dueBy: null,
    })
    expect(roundOf({ kind: 'oneOff', dueOn: null }, '2026-11-18', '2026-11-18')).toEqual({
      startsOn: null,
      dueBy: null,
    })
  })
})

describe('thisOrNextWeekend: el primer finde que se puede elegir', () => {
  it('en sábado o domingo, ese finde; entre semana, el siguiente', () => {
    expect(thisOrNextWeekend('2026-11-21')).toBe('2026-11-21') // sábado
    expect(thisOrNextWeekend('2026-11-22')).toBe('2026-11-21') // domingo
    expect(thisOrNextWeekend('2026-11-23')).toBe('2026-11-28') // lunes
    expect(thisOrNextWeekend('2026-11-27')).toBe('2026-11-28') // viernes
  })

  it('a fin de mes y de año', () => {
    expect(thisOrNextWeekend('2026-12-30')).toBe('2027-01-02') // miércoles
    expect(thisOrNextWeekend('2027-01-03')).toBe('2027-01-02') // domingo
  })
})

describe('US-31 · las vueltas de fin de semana cuyo plazo ya ha pasado', () => {
  const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
  const task = { frequency: weekly, frequencySince: '2026-10-31' }

  it('las que acaban entre los dos días y antes de hoy, desde la primera de la tarea', () => {
    expect(pastWeekendRounds(task, '2026-11-01', '2026-11-30', '2026-11-21')).toEqual([
      { startsOn: '2026-10-31', dueBy: '2026-11-06' },
      { startsOn: '2026-11-07', dueBy: '2026-11-13' },
      { startsOn: '2026-11-14', dueBy: '2026-11-20' },
    ])
  })

  it('el viernes, la vuelta de esa semana aún no ha pasado', () => {
    expect(pastWeekendRounds(task, '2026-11-01', '2026-11-30', '2026-11-20')).toHaveLength(2)
  })

  it('solo las que acaban desde el primer día que se pide', () => {
    expect(pastWeekendRounds(task, '2026-11-13', '2026-11-30', '2026-11-21')).toEqual([
      { startsOn: '2026-11-07', dueBy: '2026-11-13' },
      { startsOn: '2026-11-14', dueBy: '2026-11-20' },
    ])
  })

  it('las de cada 15 días, cada 14 días desde su primer finde, también a fin de año', () => {
    const biweekly = { frequency: { kind: 'weekendBiweekly', startOn: '2026-12-19' } as Frequency, frequencySince: '2026-12-01' }
    expect(pastWeekendRounds(biweekly, '2026-12-01', '2027-01-31', '2027-01-20')).toEqual([
      { startsOn: '2026-12-19', dueBy: '2026-12-25' },
      { startsOn: '2027-01-02', dueBy: '2027-01-08' },
    ])
  })

  it('cada 7 días también al cambiar la hora (el último domingo de octubre y de marzo)', () => {
    // El cambio de hora de octubre es el domingo 25.
    const autumn = { frequency: weekly, frequencySince: '2026-10-17' }
    expect(pastWeekendRounds(autumn, '2026-10-20', '2026-11-03', '2026-11-03')).toEqual([
      { startsOn: '2026-10-17', dueBy: '2026-10-23' },
      { startsOn: '2026-10-24', dueBy: '2026-10-30' },
    ])
    // El de marzo, el domingo 28.
    const spring = { frequency: weekly, frequencySince: '2027-03-20' }
    expect(pastWeekendRounds(spring, '2027-03-20', '2027-04-10', '2027-04-10')).toEqual([
      { startsOn: '2027-03-20', dueBy: '2027-03-26' },
      { startsOn: '2027-03-27', dueBy: '2027-04-02' },
      { startsOn: '2027-04-03', dueBy: '2027-04-09' },
    ])
  })

  it('las de cada N días y las puntuales no tienen plazo: ninguna', () => {
    const interval = { frequency: { kind: 'interval', days: 3, nextDueOn: null } as Frequency, frequencySince: '2026-10-31' }
    expect(pastWeekendRounds(interval, '2026-11-01', '2026-11-30', '2026-11-21')).toEqual([])
  })
})
