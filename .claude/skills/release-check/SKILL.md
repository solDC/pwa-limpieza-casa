---
name: release-check
description: Dice a Sol qué hay que hacer fuera del código (Supabase de la nube, Vercel, plantillas del email, la app instalada) antes de fusionar una rama de este proyecto, mirando qué cambia la rama frente a main. Úsala antes de fusionar un pull request, al preparar la descripción con open-pr, o cuando pregunten «¿qué hay que configurar?», «¿qué falta para producción?» o «¿tengo que hacer algo en Supabase o Vercel?».
---

# release-check

Parte de lo que hace funcionar la app no está en el repositorio: la base de datos de la nube, las variables de Vercel, las plantillas del email o las direcciones permitidas. Esta skill mira la rama y da a Sol la lista de lo que le toca hacer, con los pasos exactos.

**No ejecutes nada en Supabase ni en Vercel**, ni comandos que cambien la nube (`npm run db:push:pruebas`, `npm run db:push:produccion`): solo explica qué hacer. Lo hace Sol.

Los pasos de cada panel están en el README, «Puesta en producción». Si un panel ha cambiado de nombre o de sitio, díselo a Sol y actualiza el README (con su ok).

## 1. Qué cambia la rama

```bash
git fetch origin main
```

```bash
git diff --name-only origin/main...HEAD
```

## 2. Lista de comprobación

Para cada archivo cambiado, mira si implica algo fuera del código:

| Si cambia… | Qué tiene que hacer Sol | Cuándo |
|---|---|---|
| `supabase/migrations/` | Aplicar la migración **desde esta rama**: `git switch <rama>`, `npm install`, `npx supabase login` (si reconstruyó el dev container) y `npm run db:push:pruebas`. Comprobar en Table Editor (esquema `public`) del proyecto de pruebas | Al abrir el PR, para que el despliegue de prueba funcione |
| `supabase/migrations/` (2.º paso) | Cuando ya está probado: `npm run db:push:produccion`, desde la misma rama. Si la migración no es compatible con `main`, explicar en qué orden hacerlo | Justo antes de fusionar |
| `supabase/templates/` o el asunto en `supabase/config.toml` | Pegar el archivo (y el asunto) en Supabase → Authentication → Emails → Templates, en **Confirm signup** y **Magic Link**, en **los dos proyectos** (necesita el SMTP propio configurado) | En pruebas, antes de probar el email; en producción, antes de fusionar |
| `supabase/config.toml` | Solo afecta al Supabase **local**. Si el cambio también debe valer en la nube (Redirect URLs, límites, duración del código), hay que hacerlo a mano en el panel. Decir cuál | Antes de fusionar |
| `.env.example` con una variable nueva | Añadirla en Vercel → Settings → Environment Variables, en **Production** y **Preview** (cada una con el valor de su proyecto de Supabase), y hacer *Redeploy*. Solo variables públicas (`VITE_`), nunca la *secret* ni la *service_role* | Antes de fusionar |
| Una dirección o dominio nuevo | Añadirlo a Supabase → Authentication → URL Configuration → Redirect URLs, con `/**` al final, en el proyecto que le toque (producción o pruebas) | Antes de probar el inicio de sesión |
| `vite.config.ts` (manifiesto de la PWA) o los iconos | Borrar la app instalada en el móvil y volver a instalarla, para ver el nombre o el icono nuevos | Después de fusionar |
| Envío de emails (código de `storage/auth.ts` que envía más emails, o pruebas a mano que piden varios) | Revisar Authentication → Rate Limits («Rate limit for sending emails») | Antes de probar |

Si no cambia nada de esto, dilo: «Esta rama no necesita nada fuera del código».

## 3. Informe para Sol

Una lista numerada, en el orden en que tiene que hacerlo, con:

- Qué hacer y dónde (panel → sección), con los comandos exactos en bloques de código separados.
- Cómo comprobar que ha funcionado.
- Qué pasa si no lo hace (por ejemplo, «el despliegue de prueba mostrará "Falta configurar la conexión"»).

Si se usa dentro de `open-pr`, este informe va en la descripción del pull request, en «⚠️ Antes de fusionar».

## Antes de terminar

- [ ] Se ha mirado cada archivo cambiado de la tabla.
- [ ] Cada paso dice dónde, qué y cómo comprobarlo.
- [ ] No se ha ejecutado nada en Supabase ni en Vercel.
