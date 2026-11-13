import type { ErrorCode } from '../domain/errors'
import type { Language } from '../domain/language'

// US-52 · Los textos de las pantallas, en castellano y en inglés.
// Los textos que dependen de la lógica (cuándo toca, frecuencias, fechas, avisos del
// formulario y nombres de las tareas por defecto) están en src/domain/, que recibe el idioma.

const es = {
  appName: 'Limpieza de casa',
  loading: 'Cargando…',
  missingConfiguration:
    'Falta configurar la conexión con la base de datos (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',

  language: {
    label: 'Idioma',
    names: { es: 'Español', en: 'English' } satisfies Record<Language, string>,
  },

  signIn: {
    title: 'Entrar',
    intro: 'Escribe tu email y te enviaremos un código para entrar. Sin contraseñas.',
    email: 'Email',
    emailPlaceholder: 'tu@email.com',
    send: 'Enviarme el código',
    sending: 'Enviando…',
    checkEmail: 'Revisa tu correo',
    sentBefore: 'Te hemos enviado un email a ',
    sentAfter: ' con un código. Escríbelo aquí para entrar.',
    code: 'Código del email',
    enter: 'Entrar con el código',
    checking: 'Comprobando…',
    linkToo: 'También puedes pulsar el enlace del email.',
    notArrived: 'Si no ves el email en unos minutos, mira en la carpeta de spam o pide otro.',
    resend: 'Reenviar email',
    resent: (email: string) => `Te hemos enviado otro email a ${email}.`,
    back: 'Volver',
  },

  home: {
    signedInAs: (email: string) => `Has entrado como ${email}.`,
    loadingHousehold: 'Cargando tu hogar…',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
  },

  tasks: {
    title: 'Tus tareas',
    loading: 'Cargando tus tareas…',
    add: 'Añadir tarea',
    added: (name: string) => `Tarea añadida: ${name}.`,
    savedButNotReloaded:
      'La tarea se ha guardado, pero no se ha podido poner al día la lista. Vuelve a cargar la página para verla.',
    markDone: 'Marcar como hecha',
    saving: 'Guardando…',
  },

  newTask: {
    title: 'Nueva tarea',
    name: 'Nombre',
    frequency: 'Cada cuánto toca',
    weekendWeekly: 'Semanal, en fin de semana',
    weekendBiweekly: 'Fin de semana cada 15 días',
    interval: 'Cada N días desde la última vez',
    oneOff: 'Puntual',
    intervalDays: 'Cada cuántos días',
    firstWeekend: 'Primer fin de semana',
    weekendOf: (date: string) => `Finde del ${date}`,
    parts: 'Partes (opcional)',
    equalWeights: 'Si no cambias los pesos, todas cuentan lo mismo.',
    part: (number: number) => `Parte ${number}`,
    removePart: (number: number) => `Quitar parte ${number}`,
    remove: 'Quitar',
    weight: 'Peso',
    weightOfPart: (number: number) => `Peso de la parte ${number}`,
    total: (total: number) => `Suman: ${total} %`,
    addPart: 'Añadir parte',
    cancel: 'Cancelar',
    save: 'Guardar tarea',
    saving: 'Guardando…',
  },

  update: {
    available: 'Hay una versión nueva de la app.',
    later: 'Más tarde',
    update: 'Actualizar',
    updating: 'Actualizando…',
  },

  errors: {
    emailRateLimit: 'Has pedido demasiados emails seguidos. Espera un poco y vuelve a intentarlo.',
    emailNetwork: 'No se ha podido enviar el email. Comprueba tu conexión a internet.',
    emailFailed: 'No se ha podido enviar el email. Inténtalo de nuevo.',
    codeServer: 'Algo ha fallado al comprobar el código. Inténtalo de nuevo en un momento.',
    codeNetwork: 'No se ha podido comprobar el código. Comprueba tu conexión a internet.',
    codeRateLimit: 'Demasiados intentos seguidos. Espera un poco y vuelve a intentarlo.',
    codeWrong: 'El código no es correcto o ha caducado. Revísalo o pide otro email.',
    linkExpired: 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.',
    linkFailed: 'No se ha podido entrar con ese enlace. Pide uno nuevo.',
    signOutNetwork: 'No se ha podido cerrar la sesión. Comprueba tu conexión a internet.',
    signOutFailed: 'No se ha podido cerrar la sesión. Inténtalo de nuevo.',
    householdLoad: 'No se ha podido cargar tu hogar.',
    tasksLoad: 'No se han podido cargar tus tareas.',
    alreadyDone: 'Ya estaba marcada como hecha.',
    deviceDate:
      'No se ha podido guardar: la fecha de este dispositivo no es la de hoy. Revisa la fecha y la hora.',
    saveFailed: 'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.',
    taskSaveFailed: 'No se ha podido guardar la tarea. Revisa la conexión e inténtalo de nuevo.',
  } satisfies Record<ErrorCode, string>,
}

export type Messages = typeof es

const en: Messages = {
  appName: 'My House Cleaning',
  loading: 'Loading…',
  missingConfiguration:
    'The database connection is not set up (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).',

  language: {
    label: 'Language',
    names: { es: 'Español', en: 'English' },
  },

  signIn: {
    title: 'Sign in',
    intro: 'Enter your email and we will send you a code to sign in. No passwords.',
    email: 'Email',
    emailPlaceholder: 'you@email.com',
    send: 'Send me the code',
    sending: 'Sending…',
    checkEmail: 'Check your email',
    sentBefore: 'We have sent an email to ',
    sentAfter: ' with a code. Enter it here to sign in.',
    code: 'Code from the email',
    enter: 'Sign in with the code',
    checking: 'Checking…',
    linkToo: 'You can also tap the link in the email.',
    notArrived:
      'If you don’t see the email in a few minutes, check your spam folder or ask for another one.',
    resend: 'Resend email',
    resent: (email: string) => `We have sent another email to ${email}.`,
    back: 'Back',
  },

  home: {
    signedInAs: (email: string) => `You are signed in as ${email}.`,
    loadingHousehold: 'Loading your home…',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
  },

  tasks: {
    title: 'Your tasks',
    loading: 'Loading your tasks…',
    add: 'Add task',
    added: (name: string) => `Task added: ${name}.`,
    savedButNotReloaded:
      'The task has been saved, but the list could not be updated. Reload the page to see it.',
    markDone: 'Mark as done',
    saving: 'Saving…',
  },

  newTask: {
    title: 'New task',
    name: 'Name',
    frequency: 'How often it is due',
    weekendWeekly: 'Weekly, at the weekend',
    weekendBiweekly: 'Every other weekend',
    interval: 'Every N days since the last time',
    oneOff: 'One-off',
    intervalDays: 'Every how many days',
    firstWeekend: 'First weekend',
    weekendOf: (date: string) => `Weekend of ${date}`,
    parts: 'Parts (optional)',
    equalWeights: 'If you don’t change the weights, all parts count the same.',
    part: (number: number) => `Part ${number}`,
    removePart: (number: number) => `Remove part ${number}`,
    remove: 'Remove',
    weight: 'Weight',
    weightOfPart: (number: number) => `Weight of part ${number}`,
    total: (total: number) => `Total: ${total} %`,
    addPart: 'Add part',
    cancel: 'Cancel',
    save: 'Save task',
    saving: 'Saving…',
  },

  update: {
    available: 'There is a new version of the app.',
    later: 'Later',
    update: 'Update',
    updating: 'Updating…',
  },

  errors: {
    emailRateLimit: 'You have asked for too many emails in a row. Wait a moment and try again.',
    emailNetwork: 'The email could not be sent. Check your internet connection.',
    emailFailed: 'The email could not be sent. Try again.',
    codeServer: 'Something went wrong while checking the code. Try again in a moment.',
    codeNetwork: 'The code could not be checked. Check your internet connection.',
    codeRateLimit: 'Too many attempts in a row. Wait a moment and try again.',
    codeWrong: 'The code is not correct or has expired. Check it or ask for another email.',
    linkExpired: 'The link has expired or has already been used. Ask for a new one.',
    linkFailed: 'You could not be signed in with that link. Ask for a new one.',
    signOutNetwork: 'You could not be signed out. Check your internet connection.',
    signOutFailed: 'You could not be signed out. Try again.',
    householdLoad: 'Your home could not be loaded.',
    tasksLoad: 'Your tasks could not be loaded.',
    alreadyDone: 'It was already marked as done.',
    deviceDate:
      'It could not be saved: the date on this device is not today’s date. Check the date and time.',
    saveFailed: 'It could not be saved. Check your connection and try again.',
    taskSaveFailed: 'The task could not be saved. Check your connection and try again.',
  },
}

export const messages: Record<Language, Messages> = { es, en }
