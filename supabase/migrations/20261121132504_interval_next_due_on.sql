-- US-41 · Cambiar cuándo toca la próxima vez
--
-- En una tarea de cada N días se puede elegir otro día para la próxima vez (hoy o un día
-- futuro): por ejemplo, para pasarla a mañana o para quitarle el retraso. Se guarda en
-- tasks.next_due_on y se pone con la función set_task_next_due_on.
--
-- Vale solo para la vuelta en curso: al terminarla (la tarea entera o todas sus partes), la
-- base de datos vacía la columna, y la siguiente se cuenta otra vez desde el día en que se
-- hizo, como siempre.
--
-- El día elegido no cambia la vuelta: sigue empezando el día que le tocaba (la última vez
-- más N días, o el día en que se creó), así que al cambiarlo no se pierden las partes ya
-- hechas.
--
-- Compatible con la versión anterior de la app: la columna admite vacío y nadie la usa.

-- ---------------------------------------------------------------------------
-- Columna
-- ---------------------------------------------------------------------------

alter table public.tasks
  -- Solo en las de cada N días: el día elegido para la próxima vez (vacío, el de siempre).
  add column next_due_on date,
  add constraint tasks_next_due_on_check
    check (frequency = 'interval' or next_due_on is null);

-- Que el día sea hoy o futuro no es un check de la tabla (un día elegido que ya ha pasado
-- es el de una tarea retrasada): lo comprueba la función al guardarlo, con
-- check_due_on_not_past (US-38).

-- ---------------------------------------------------------------------------
-- Cambiar cuándo toca la próxima vez
-- ---------------------------------------------------------------------------

-- Pone el día en que toca la próxima vez una tarea de cada N días del hogar del usuario.
-- Es security definer porque la app no puede cambiar tasks directamente: así solo puede
-- tocar esta columna, en una tarea de cada N días que no está cancelada.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar (no se distingue, para no dar pistas).
-- - 22023: no es de cada N días, está cancelada o falta el día.
-- - 23505: ya se ha hecho hoy y se elige hoy (no se puede volver a marcar hasta mañana).
--   Desde la app, solo si se ha hecho en otro móvil: la app vuelve a cargar la lista.
-- - 23514: el día ya ha pasado.
create function public.set_task_next_due_on(target_task_id uuid, new_next_due_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
begin
  -- Solo bloquea la fila (para que no se termine la vuelta a la vez) si es del hogar del
  -- usuario: una tarea de otro hogar ni se bloquea.
  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.frequency <> 'interval' or target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'Solo se puede cambiar el día de una tarea de cada N días.';
  end if;

  if new_next_due_on is null then
    raise exception using errcode = '22023', message = 'Falta el día.';
  end if;

  perform public.check_due_on_not_past(new_next_due_on);

  if exists (
    select 1 from public.task_rounds r
    where r.task_id = target_task_id and r.completed_on >= new_next_due_on
  ) then
    raise exception using errcode = '23505', message = 'Ya está hecha hoy: elige mañana o un día futuro.';
  end if;

  update public.tasks set next_due_on = new_next_due_on where id = target_task_id;
end;
$$;

revoke execute on function public.set_task_next_due_on(uuid, date) from public, anon;
grant execute on function public.set_task_next_due_on(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Al terminar la vuelta, se olvida el día elegido
-- ---------------------------------------------------------------------------

-- Cada vuelta terminada (la tarea marcada entera o, con complete_round_when_all_parts_done,
-- todas sus partes) vacía next_due_on: la siguiente vez se cuenta desde ese día.
-- Es security definer porque quien marca la tarea no puede cambiar tasks; la vuelta ya ha
-- pasado las reglas RLS de task_rounds, así que es de su hogar.
create function public.clear_next_due_on_when_round_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks
  set next_due_on = null
  where id = new.task_id and next_due_on is not null;
  return null;
end;
$$;

revoke execute on function public.clear_next_due_on_when_round_done() from public, anon, authenticated;

create trigger clear_next_due_on_when_round_done
  after insert on public.task_rounds
  for each row execute function public.clear_next_due_on_when_round_done();
