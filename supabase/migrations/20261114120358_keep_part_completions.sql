-- US-39 · Las partes hechas no se pierden
--
-- Las vueltas pasadas conservan sus partes hechas y su porcentaje. Por eso, una parte que
-- se ha hecho alguna vez no se puede borrar: cuando se puedan quitar partes de una tarea,
-- quitar una será archivarla (como se cancelan las tareas), no borrarla. Ver «Conceptos»
-- en docs/user-stories.md.
--
-- Antes, borrar una parte borraba también sus partes hechas (on delete cascade). Ahora la
-- base de datos lo rechaza. Borrar el hogar entero (al borrar la cuenta) sigue borrándolo
-- todo: las partes hechas se borran por su hogar en la misma operación.
--
-- La app no puede borrar partes (solo leerlas), así que no cambia nada de lo que hace hoy.

alter table public.task_part_completions
  drop constraint task_part_completions_part_fkey;

-- «no action» se comprueba al final de cada operación: si en ella se borran también las
-- partes hechas (al borrar el hogar o la tarea), no hay nada que rechazar.
alter table public.task_part_completions
  add constraint task_part_completions_part_fkey
    foreign key (part_id, task_id) references public.task_parts (id, task_id) on delete no action;
