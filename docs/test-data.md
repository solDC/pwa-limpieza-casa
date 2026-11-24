# Datos para las pruebas a mano

Consultas SQL para preparar los datos de una prueba en el **proyecto de pruebas** de Supabase (ver README, «Puesta en producción»): dejar las tareas sin hacer, tener tareas retrasadas o empezar de cero.

> ⚠️ **Solo en el proyecto de pruebas.** Antes de pegar nada, comprueba arriba a la izquierda del panel de Supabase que estás en el proyecto de pruebas, no en el de producción.

> En las consultas, las tareas por defecto van siempre con su nombre en castellano (`'Baño'`), aunque la app esté en inglés: así se guardan en la base de datos. Si has renombrado la tarea o sus partes desde la app (con «Cambiar nombre», US-54, o «Cambiar partes», US-51), pon el nombre nuevo, tal como lo escribiste. Los textos de ejemplo («Retrasada 5 días») son los de la app en castellano; en inglés se ve «Bathroom» y «Overdue 5 days».

## Cómo usarlas

1. Entra en la app del despliegue de prueba con una **cuenta de prueba**: tu email con `+prueba` y un número delante de la arroba, por ejemplo `mariasol.dc+prueba1@gmail.com`. Gmail la entrega en tu buzón de siempre, y para la app es un usuario nuevo, con su propio hogar y las 6 tareas sin hacer.
2. En Supabase, abre **SQL Editor** en el proyecto de pruebas, pega la consulta y cambia el email (y, si la consulta lo pide, el nombre de la tarea o los días).
3. Pulsa **Run** y vuelve a cargar la app.

Todas las consultas solo cambian los datos de **esa cuenta**, y solo si el email lleva `+prueba`. Así, aunque una se pegara por error en producción, no tocaría tu hogar de verdad.

Para empezar de cero, lo más fácil es entrar con otra cuenta (`+prueba2`, `+prueba3`…).

## Ver las tareas de una cuenta

Qué tareas tiene, cuándo se crearon, el primer finde de las de cada 15 días y el de las semanales movidas (US-42), la fecha de las puntuales (US-38), el día elegido para la próxima vez en las de cada N días (US-41 y US-50), cada cuántos días, desde cuándo cuenta la frecuencia si se ha cambiado (US-53) y cuándo se hicieron por última vez.

```sql
select t.name, t.frequency, t.interval_days, t.created_on, t.frequency_changed_on, t.biweekly_start_on, t.weekly_start_on, t.due_on, t.next_due_on,
  (select max(r.completed_on) from public.task_rounds r where r.task_id = t.id) as last_completed_on
from public.tasks t
join public.household_members m on m.household_id = t.household_id
join auth.users u on u.id = m.user_id
where u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
order by t.position;
```

## Ver las partes de una tarea

Las partes de una tarea con su peso y su orden, también las quitadas desde la app (US-51), que no se borran: se archivan (`archived_on`, el día en que se quitaron). Cambia el nombre de la tarea (`'Superficies'`) por la que quieras ver.

```sql
select p.name, p.weight, p.position, p.archived_on
from public.task_parts p
join public.tasks t on t.id = p.task_id
join public.household_members m on m.household_id = t.household_id
join auth.users u on u.id = m.user_id
where u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.name = 'Superficies'
order by p.position;
```

## Dejar todas las tareas sin hacer

Borra lo que se ha marcado como hecho. Las puntuales vuelven a aparecer. También olvida el día elegido para la próxima vez en las de cada N días (US-41). No devuelve las partes quitadas (US-51), que siguen archivadas, ni deshace el cambio de finde de una tarea movida (US-42) ni el cambio de frecuencia (US-53), que sigue contando desde el día del cambio: para tener las tareas como al principio, entra con otra cuenta. También vacía el histórico (US-31): solo quedan las vueltas de fin de semana pasadas, como «No completada».

```sql
delete from public.task_rounds r
using public.household_members m, auth.users u
where r.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%';

-- Y las partes marcadas (US-39).
delete from public.task_part_completions c
using public.household_members m, auth.users u
where c.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%';

-- Y el día elegido para la próxima vez (US-41).
update public.tasks t
set next_due_on = null
from public.household_members m, auth.users u
where t.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.next_due_on is not null;
```

## Que una tarea se creara hace unos días

Para tener una tarea de cada N días retrasada sin esperar: una que nunca se ha hecho toca desde el día en que se creó. Con `- 5`, Baño (cada 3 días) tocaba hace 5 días y sale «Retrasada 5 días».

**Solo funciona si la tarea nunca se ha marcado como hecha** en esa cuenta, ni se le ha elegido o cambiado el día desde la app (US-41 y US-50), ni se le ha cambiado la frecuencia (US-53, que cuenta desde el día del cambio, `frequency_changed_on`): cuando ya se ha hecho, la próxima vez se cuenta desde el día en que se hizo, y con un día elegido, toca ese día; en los dos casos, el día de creación no cuenta. Si es así, ejecuta antes «Dejar todas las tareas sin hacer».

```sql
update public.tasks t
set created_on = (now() at time zone 'Europe/Madrid')::date - 5
from public.household_members m, auth.users u
where t.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.name = 'Baño';
```

## Que la cuenta se creara hace unas semanas

Para tener tareas de **fin de semana** retrasadas. Una tarea nueva no empieza con retraso: si se crea entre semana, su primera vuelta es el finde siguiente (US-48). Así que, con una cuenta recién creada, de lunes a viernes Superficies dice «Toca: finde del…» y no se puede marcar. Con esta consulta, todas sus tareas se crearon hace 4 semanas, y de lunes a viernes Superficies sale «Retrasada». En el histórico (US-31) salen sus findes pasados como «No completada».

Como la de arriba, solo cambia algo en las tareas que nunca se han marcado como hechas, ni, si son semanales, se han movido a otro finde desde la app (US-42), ni se les ha cambiado la frecuencia (US-53). Para eso, entra con otra cuenta.

```sql
update public.tasks t
set created_on = (now() at time zone 'Europe/Madrid')::date - 28
from public.household_members m, auth.users u
where t.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%';
```

## Que una tarea de cada N días se hiciera hace unos días

Apunta que se hizo por última vez hace 10 días. Con Baño (cada 3 días), tocaba hace 7 y sale «Retrasada 7 días». Solo para las de **cada N días**; si la tarea ya se ha marcado después, primero deja las tareas sin hacer (arriba). En el histórico (US-31) sale como «Completada» hace 10 días.

```sql
insert into public.task_rounds (household_id, task_id, starts_on, completed_on)
select t.household_id, t.id,
  (now() at time zone 'Europe/Madrid')::date - 10,
  (now() at time zone 'Europe/Madrid')::date - 10
from public.tasks t
join public.household_members m on m.household_id = t.household_id
join auth.users u on u.id = m.user_id
where u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.name = 'Baño' and t.frequency = 'interval';
```

## Que una puntual tuviera fecha hace unos días

Para tener una puntual retrasada sin esperar (US-38): la app solo deja elegir hoy o un día futuro. Con `- 2`, Limpiar juntas sale «Retrasada 2 días (tocaba el …)». Desde la app se le puede poner después otra fecha, hoy o futura.

```sql
update public.tasks t
set due_on = (now() at time zone 'Europe/Madrid')::date - 2
from public.household_members m, auth.users u
where t.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.name = 'Limpiar juntas' and t.frequency = 'one_off';
```

## Borrar una cuenta de prueba

Borra la cuenta y su hogar, con sus tareas. No toca ningún otro hogar.

```sql
with account as (
  select id from auth.users
  where email = 'mariasol.dc+prueba1@gmail.com' and email like '%+prueba%'
),
deleted_households as (
  -- Su hogar, si no tiene más miembros.
  delete from public.households h
  where h.id in (
      select m.household_id from public.household_members m
      where m.user_id in (select id from account)
    )
    and not exists (
      select 1 from public.household_members other
      where other.household_id = h.id and other.user_id not in (select id from account)
    )
  returning h.id
),
deleted_accounts as (
  delete from auth.users where id in (select id from account) returning id
)
select (select count(*) from deleted_accounts) as deleted_accounts,
  (select count(*) from deleted_households) as deleted_households;
```

