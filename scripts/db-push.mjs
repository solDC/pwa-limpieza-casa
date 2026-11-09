// Aplica las migraciones de supabase/migrations/ en un proyecto de Supabase de la nube:
// `npm run db:push:pruebas` o `npm run db:push:produccion` (ver README, «Puesta en producción»).
//
// Primero enlaza la CLI con ese proyecto y después aplica, para no hacerlo nunca en el
// proyecto equivocado. Los ids de los proyectos están en supabase/projects.json: no son
// secretos (son la parte de la URL de Supabase, que ya es pública). La contraseña de la
// base de datos la pide la CLI y no se guarda en ningún sitio.
//
// Lo que vaya después de `--` se pasa a `supabase db push`, por ejemplo:
//   npm run db:push:pruebas -- --dry-run   (solo lista las migraciones, sin aplicarlas)

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const names = { pruebas: 'PRUEBAS', produccion: 'PRODUCCIÓN' }
const [target, ...pushOptions] = process.argv.slice(2)

if (!(target in names)) {
  fail('Indica el proyecto: pruebas o produccion (npm run db:push:pruebas).')
}

const projects = JSON.parse(readFileSync(new URL('../supabase/projects.json', import.meta.url)))
const ref = projects[target]
// El id de un proyecto de Supabase son 20 letras minúsculas.
if (!/^[a-z]{20}$/.test(ref ?? '')) {
  fail(
    `Falta el id del proyecto de ${target} en supabase/projects.json.\n` +
      'Es la parte de la URL de Supabase: https://<id-del-proyecto>.supabase.co',
  )
}

console.log(`\n=== Migraciones en ${names[target]} (${ref}) ===\n`)
run(['link', '--project-ref', ref])
run(['db', 'push', '--linked', ...pushOptions])

function run(args) {
  const result = spawnSync('npx', ['supabase', ...args], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
