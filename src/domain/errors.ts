// Los fallos al leer o guardar, como códigos: la pantalla pone el texto en el idioma
// elegido (US-52). TypeScript puro.

export type ErrorCode =
  // Entrar
  | 'emailRateLimit'
  | 'emailNetwork'
  | 'emailFailed'
  | 'codeServer'
  | 'codeNetwork'
  | 'codeRateLimit'
  | 'codeWrong'
  | 'linkExpired'
  | 'linkFailed'
  // Cerrar sesión
  | 'signOutNetwork'
  | 'signOutFailed'
  // Hogar y tareas
  | 'householdLoad'
  | 'tasksLoad'
  | 'alreadyDone'
  | 'deviceDate'
  | 'saveFailed'
  | 'taskSaveFailed'

/** Un fallo con su código, para que la pantalla lo explique en el idioma elegido. */
export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode) {
    super(code)
    this.name = 'AppError'
    this.code = code
  }
}

/** El código de un fallo cualquiera: si no es de los conocidos, «no se ha podido guardar». */
export function errorCode(error: unknown): ErrorCode {
  return error instanceof AppError ? error.code : 'saveFailed'
}
