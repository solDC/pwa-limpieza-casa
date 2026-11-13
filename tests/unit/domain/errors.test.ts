import { describe, expect, it } from 'vitest'
import { AppError, errorCode } from '../../../src/domain/errors'

// Los fallos al leer o guardar, como códigos (US-52).

describe('errorCode: qué fallo se muestra', () => {
  it('un fallo conocido, el suyo; uno inesperado, el general de lo que se estaba haciendo', () => {
    expect(errorCode(new AppError('alreadyDone'), 'saveFailed')).toBe('alreadyDone')
    expect(errorCode(new Error('algo raro'), 'householdLoad')).toBe('householdLoad')
    expect(errorCode(undefined, 'emailFailed')).toBe('emailFailed')
  })
})
