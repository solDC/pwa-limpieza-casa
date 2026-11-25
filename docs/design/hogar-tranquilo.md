# Hogar tranquilo — especificación para Codex

## Encargo y alcance
Implementar el rediseño integral mobile-first de My House Cleaning en la rama existente `feature/rediseño-ui-hogar-tranquilo`, PR #108. No fusionar ni tocar main. Revisar primero las US cerradas, código, traducciones y pruebas existentes. Los dos commits iniciales son un prototipo incompleto, no una referencia visual definitiva. Mantener React/TypeScript/Vite/Supabase y comportamiento existente. No introducir migraciones ni funcionalidades nuevas sin aprobación. Entregar todas las pantallas juntas, con compilación, pruebas y revisión visual en móvil, y actualizar la PR con resultados reales y URL Preview de Vercel.

## Sistema visual
Fondo #F7F3EC, superficie #FFFFFF, texto #2B2A27, secundario #6B6760, verde #5E7F64, borde #D9D3C7, rojo #A63D32, verde suave #E5EADF. Tipografía del sistema, jerarquía sencilla, sin degradados ni sombras fuertes. Márgenes móviles 16–24 px, tarjetas con radio 12–16 px, controles táctiles >=44 px. Verificar contraste WCAG AA; oscurecer verde para texto/botones si necesario. SVG lineales, no emojis para iconos ni banderas. Sin scroll horizontal a 320 px; respetar safe areas, teclado iOS, zoom y foco visible. No duplicar título de Screen.

## Login aprobado
Logo exacto: cuadrado verde suave 76×76, radio 22; SVG 48×48 viewBox 0 0 64 64, sin relleno, stroke #5E7F64, 2.8, extremos y uniones redondeados. Claim ES «Tu casa, a tu ritmo.» / EN «Your home, at your pace.» Nombre My House Cleaning.
Referencia visual: selector ES/EN arriba derecha, banderas SVG España y Reino Unido, selección verde suave; logo centrado, título y claim centrados; tarjeta blanca debajo con borde suave, padding 20, radio 16. En móvil, ancho útil máximo ~390–420 px; en escritorio centrar el conjunto. No repetir cabecera ni selector.
Estado inicial: «Bienvenida» / «Welcome», «Introduce tu correo para acceder a tu hogar.» / «Enter your email to access your home.», etiqueta correo, campo email, botón verde «Continuar» / «Continue» con flecha, nota con candado «Acceso sin contraseña» / «Password-free sign-in».
Estado enviado: icono lineal mail-check, «Revisa tu correo» / «Check your email», texto de envío con email destacado, campo único código, botón «Entrar» / «Sign in», explicación del enlace alternativo, separador, reenvío y cambiar correo. Conservar errores, envío, reenvío, confirmaciones, estados busy, validación 6–10 dígitos, pegado con limpieza, autocomplete one-time-code, inputmode numeric, email mágico y código (US-01, US-26). No simular autenticación en producción.

## Cabecera y ajustes
Nombre de app compacto a izquierda, engranaje SVG lineal a derecha. Ajustes desplegables: banderas SVG + ES/EN sin título Idioma, cerrar sesión en rojo con icono y separador. Traducir aria-labels, mensajes y todos los textos. Quitar email y tarjeta de hogar redundantes del cuerpo si no cumplen una función necesaria. Selector de hogar solo con >=2 hogares; soporte multi-hogar US-36 #50 no implementado, no construirlo aquí.
Pestañas subrayadas, no pills: «Qué toca» / «What's due», «Histórico» / «History». Conservar formulario, scroll y foco al volver; quitar navegación duplicada, ref al control visible, no sobrescribir scroll al pulsar pestaña activa. No introducir navegación atrás del sistema como funcionalidad nueva (US-56 #106).

## Qué toca
Tarjetas blancas compactas, título y fecha/frecuencia, menú de tres puntos arriba derecha. Sin partes: círculo hueco SVG para completar cuando permitido, sin barra. Con partes: barra fina ponderada, porcentaje, chevron, partes plegadas inicialmente; al abrir mostrar nombre, peso, estado y acción individual cuando elegible. «Marcar todo como hecho» solo si quedan >1 partes y se puede marcar. No mostrar acciones de marcar antes del inicio de una vuelta de fin de semana. Mantener errores y feedback. Sin undo nuevo.
Menú flotante alineado a derecha debajo de puntos, ~230–245 px, iconos lineales, no desplazar tarjetas. Acciones según código: Poner fecha (puntual sin fecha), Cambiar fecha (puntual con fecha o intervalo), Mover a otro finde (fin de semana), Cambiar nombre, Añadir partes/Cambiar partes. No añadir acciones no implementadas. Cerrar al elegir, fuera o Escape; devolver foco. Mantener formularios y validaciones actuales. Tarea completada pasa a histórico; recurrente muestra siguiente vuelta; puntual desaparece.
Filtro Todas/Hoy/Atrasadas/Próximas: propuesta futura, no implementar en este rediseño.

## Histórico
Pestaña con título Histórico y texto Últimas 4 semanas; tarjetas compactas de solo lectura, agrupadas por fecha descendente, estados Completada (verde), Parcial (X %) y No completada, con iconos y texto (no depender solo del color). Etiqueta de finde cuando corresponda. Ver más carga otras 4 semanas. Mantener estado vacío y errores. Sin menú de edición. No inventar estado Saltada en esta entrega: US-49 #72 abierta sí lo contempla en futuro.
Detalle histórico de partes desplegables y filtros por fechas/tarea/estado son mejoras futuras: el modelo actual no proyecta nombres de partes históricas; no usar partes actuales como si fueran históricas. No implementar sin acordar alcance y persistencia.

## Referencia esquemática (no a escala)
```text
LOGIN                    QUÉ TOCA                   HISTÓRICO
             ES EN       My House Cleaning   ⚙      My House Cleaning   ⚙
       [casa ♥]           Qué toca   Histórico      Qué toca   Histórico
   My House Cleaning      ━━━━━━━                    ━━━━━━━━━ (Histórico)
 Tu casa, a tu ritmo.     ┌──────────────────┐      Últimas 4 semanas
 ┌──────────────────┐    │ Baño          ⋯  │      Hoy
 │ Bienvenida       │    │ Toca: hoy      ○ │      ┌──────────────────┐
 │ Correo           │    └──────────────────┘      │ ✓ Baño           │
 │ [              ] │    ┌──────────────────┐      │ Completada       │
 │ [ Continuar →  ] │    │ Superficies    ⋯ │      └──────────────────┘
 │ Acceso sin clave │    │ Finde del …      │      Viernes 20 nov
 └──────────────────┘    │ ━━━━━──── 50%  ⌄ │      ┌──────────────────┐
                         └──────────────────┘      │ Superficies      │
                                                   │ Parcial (50 %)   │
                                                   │ Finde 14–15 nov  │
                                                   └──────────────────┘
```
Los datos son ejemplos. Los textos del esquema abreviados no sustituyen los textos reales localizados.

## Regresiones que comprobar
US-30 #39, US-31 #40, US-39 #57, US-51 #83, US-42 #60, US-54 y demás US cerradas. Progreso = suma de pesos, no recuento; conservar partes hechas, cambios de pesos y archivado. Histórico de fin de semana: sábado a viernes siguiente, parcial/no completada el viernes una vez pasado el plazo, completada en día real; intervalos y puntuales sin corte. Orden y paginación existentes. Probar inicio sesión por código/enlace, errores, reenvío, logout, ES/EN completos, menú y formularios, tareas elegibles/no elegibles, completar parte/tarea, histórico, scroll/foco, recarga, iPhone Safari y PWA instalada. Ejecutar scripts reales de package.json y documentar qué pasó y qué no se pudo ejecutar. No declarar tests exitosos sin ejecutarlos. Actualizar descripción PR #108 con formato de #107, pasos manuales y URL real de Vercel. 
