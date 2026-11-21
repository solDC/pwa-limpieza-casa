/** El error de un campo, enlazado con él por su id (aria-describedby). */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="error">
      {message}
    </p>
  )
}
