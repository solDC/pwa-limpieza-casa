// Aplica las migraciones de supabase/migrations/ en un proyecto de Supabase de la nube:
// `npm run db:push:pruebas` o `npm run db:push:produccion` (ver README, «Puesta en producción»).
//
// Primero enlaza la CLI con ese proyecto y después aplica, para no hacerlo nunca en el
// proyecto equivocado. Los ids de los proyectos están en supabase/projects.json: no son
// secretos (son la parte de la URL de Supabase, que ya es pública). La contraseña de la
// base de datos la pide la CLI y no se guarda en ningún sitio.
//
// Protecciones:
// - Solo admite una opción extra, `--dry-run` (solo lista las migraciones, sin aplicarlas):
//     npm run db:push:pruebas -- --dry-run
//   Otras, como `--yes` (no pide confirmación) o `--include-seed` (datos de ejemplo), no.
// - Si los dos ids son iguales, no sigue: «pruebas» acabaría aplicando en producción.
// - En producción, antes de nada pide escribir «produccion».
//
// SUPABASE_PROJECTS_FILE cambia el archivo de ids: solo para probar este script sin
// tocar los proyectos de verdad.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

// Siempre desde la carpeta del proyecto, para usar la CLI de Supabase fijada en package.json
// y no otra versión que descargue npx.
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const names = { pruebas: 'PRUEBAS', produccion: 'PRODUCCIÓN' }
const allowedOptions = ['--dry-run']
const [target, ...pushOptions] = process.argv.slice(2)

if (!(target in names)) {
  fail('Indica el proyecto: pruebas o produccion (npm run db:push:pruebas).')
}

const notAllowed = pushOptions.filter((option) => !allowedOptions.includes(option))
if (notAllowed.length > 0) {
  fail(`Opción no admitida: ${notAllowed.join(' ')}. Solo se admite --dry-run.`)
}

const projectsFile =
  process.env.SUPABASE_PROJECTS_FILE ?? new URL('../supabase/projects.json', import.meta.url)
const projects = JSON.parse(readFileSync(projectsFile))
const ref = projects[target]
// El id de un proyecto de Supabase son 20 letras minúsculas.
if (!/^[a-z]{20}$/.test(ref ?? '')) {
  fail(
    `Falta el id del proyecto de ${target} en supabase/projects.json.\n` +
      'Es la parte de la URL de Supabase: https://<id-del-proyecto>.supabase.co',
  )
}
if (projects.pruebas === projects.produccion) {
  fail('En supabase/projects.json, pruebas y produccion tienen el mismo id. Corrígelo antes de seguir.')
}

console.log(`\n=== Migraciones en ${names[target]} (${ref}) ===\n`)

if (target === 'produccion') {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(
    'Vas a cambiar la base de datos de PRODUCCIÓN, la de tu hogar de verdad.\n' +
      'Escribe «produccion» para seguir: ',
  )
  prompt.close()
  if (answer.trim() !== 'produccion') fail('Cancelado: no se ha aplicado nada.')
}

run(['link', '--project-ref', ref])
run(['db', 'push', '--linked', ...pushOptions])

function run(args) {
  const result = spawnSync('npx', ['supabase', ...args], { stdio: 'inherit', cwd: projectRoot })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
