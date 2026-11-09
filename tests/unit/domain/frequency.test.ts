import { describe, expect, it } from 'vitest'
import {
  canMarkDone,
  currentRound,
  describeDue,
  dueStatus,
  isWeekend,
} from '../../../src/domain/frequency'
import type { Frequency } from '../../../src/domain/task'

// US-28 · Frecuencias (#37). Las reglas están en «Conceptos» de docs/user-stories.md.

const createdOn = '2026-11-08'
const round = (frequency: Frequency, lastCompletedOn: string | null, today: string) =>
  currentRound({ frequency, createdOn, lastCompletedOn }, today)

describe('semanal, en fin de semana: toca el finde y se puede hacer hasta el viernes', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }

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
      currentRound({ frequency: weekly, createdOn: '2026-01-01', lastCompletedOn: null }, '2026-03-29'),
    ).toEqual({ startsOn: '2026-03-28', dueBy: '2026-04-03' })
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
  const bathroom: Frequency = { kind: 'interval', days: 3 }

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
    const windows: Frequency = { kind: 'interval', days: 30 }
    expect(round(windows, '2026-01-30', '2026-01-30')).toEqual({ startsOn: '2026-03-01', dueBy: null })
    expect(round(windows, '2028-02-15', '2028-02-15')).toEqual({ startsOn: '2028-03-16', dueBy: null })
  })
})

describe('puntual', () => {
  const oneOff: Frequency = { kind: 'oneOff' }

  it('va sin fecha: está pendiente hasta que se hace y nunca tiene retraso', () => {
    expect(round(oneOff, null, '2026-11-08')).toEqual({ startsOn: null, dueBy: null })
    expect(round(oneOff, null, '2027-05-20')).toEqual({ startsOn: null, dueBy: null })
  })

  it('una vez hecha, ya no vuelve a tocar', () => {
    expect(round(oneOff, '2026-11-10', '2026-11-20')).toBeNull()
  })
})

describe('describeDue: el texto de «Toca:»', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }
  const bathroom: Frequency = { kind: 'interval', days: 3 }

  it('las de fin de semana dicen de qué finde son', () => {
    const round = { startsOn: '2026-11-14', dueBy: '2026-11-20' }
    expect(describeDue(weekly, round, '2026-11-12')).toBe('Toca: finde del 14 nov')
    expect(describeDue(weekly, round, '2026-11-14')).toBe('Toca: finde del 14 nov')
    expect(describeDue(weekly, round, '2026-11-15')).toBe('Toca: finde del 14 nov')
  })

  it('hoy y mañana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-08', dueBy: null }, '2026-11-08')).toBe('Toca: hoy')
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-08')).toBe('Toca: mañana')
  })

  it('otro día futuro, con el día de la semana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-18', dueBy: null }, '2026-11-08')).toBe(
      'Toca: mié 18 nov',
    )
  })

  it('sin fecha', () => {
    expect(describeDue({ kind: 'oneOff' }, { startsOn: null, dueBy: null }, '2026-11-08')).toBe(
      'Sin fecha',
    )
  })

  // US-29 · Qué toca (#38)
  it('si va con retraso, cuántos días y cuándo tocaba', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-12')).toBe(
      'Retrasada 3 días (tocaba el lun 9 nov)',
    )
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-10')).toBe(
      'Retrasada 1 día (tocaba el lun 9 nov)',
    )
  })

  it('las de fin de semana, entre semana, con retraso desde el lunes', () => {
    const round = { startsOn: '2026-11-14', dueBy: '2026-11-20' }
    expect(describeDue(weekly, round, '2026-11-16')).toBe(
      'Retrasada 1 día (tocaba el finde del 14 nov)',
    )
    expect(describeDue(weekly, round, '2026-11-20')).toBe(
      'Retrasada 5 días (tocaba el finde del 14 nov)',
    )
  })
})

// US-30 · Marcar una tarea como hecha (#39)
describe('canMarkDone: si se puede marcar como hecha la vuelta que se muestra', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }
  const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
  const interval: Frequency = { kind: 'interval', days: 3 }
  const oneOff: Frequency = { kind: 'oneOff' }
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
    expect(isWeekend({ kind: 'weekendWeekly' })).toBe(true)
    expect(isWeekend({ kind: 'weekendBiweekly', startOn: '2026-12-05' })).toBe(true)
  })

  it('no lo son la de cada N días ni la puntual', () => {
    expect(isWeekend({ kind: 'interval', days: 3 })).toBe(false)
    expect(isWeekend({ kind: 'oneOff' })).toBe(false)
  })
})

// US-48 · Las tareas nuevas no empiezan con retraso (#71)
describe('una tarea nueva no empieza con una vuelta anterior a crearla', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }
  const cati: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
  const roundOf = (frequency: Frequency, created: string, today: string) =>
    currentRound({ frequency, createdOn: created, lastCompletedOn: null }, today)!

  it('de fin de semana, creada de lunes a viernes: empieza el sábado siguiente, sin retraso', () => {
    // Lunes, miércoles y viernes.
    for (const day of ['2026-11-16', '2026-11-18', '2026-11-20']) {
      const first = roundOf(weekly, day, day)
      expect(first).toEqual({ startsOn: '2026-11-21', dueBy: '2026-11-27' })
      expect(dueStatus(weekly, first, day)).toEqual({ status: 'upcoming' })
      expect(describeDue(weekly, first, day)).toBe('Toca: finde del 21 nov')
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
    expect(roundOf({ kind: 'interval', days: 3 }, '2026-11-18', '2026-11-18')).toEqual({
      startsOn: '2026-11-18',
      dueBy: null,
    })
    expect(roundOf({ kind: 'oneOff' }, '2026-11-18', '2026-11-18')).toEqual({
      startsOn: null,
      dueBy: null,
    })
  })
})
