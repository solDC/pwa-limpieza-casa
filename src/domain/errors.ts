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
  // US-33 y US-54: el hogar ya tiene otra tarea con ese nombre (guardada en otro dispositivo).
  | 'duplicateTaskName'
  // US-51: las partes de la tarea han cambiado en otro dispositivo.
  | 'staleParts'
  // US-31: el histórico.
  | 'historyLoad'

/** Un fallo con su código, para que la pantalla lo explique en el idioma elegido. */
export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode) {
    super(code)
    this.name = 'AppError'
    this.code = code
  }
}

/**
 * El código de un fallo cualquiera. Si no es de los conocidos (algo inesperado), el de
 * `fallback`: el fallo general de lo que se estaba haciendo.
 */
export function errorCode(error: unknown, fallback: ErrorCode): ErrorCode {
  return error instanceof AppError ? error.code : fallback
}
