# Datos para las pruebas a mano

Consultas SQL para preparar los datos de una prueba en el **proyecto de pruebas** de Supabase (ver README, «Puesta en producción»): dejar las tareas sin hacer, tener tareas retrasadas o empezar de cero.

> ⚠️ **Solo en el proyecto de pruebas.** Antes de pegar nada, comprueba arriba a la izquierda del panel de Supabase que estás en el proyecto de pruebas, no en el de producción.

## Cómo usarlas

1. Entra en la app del despliegue de prueba con una **cuenta de prueba**: tu email con `+prueba` y un número delante de la arroba, por ejemplo `mariasol.dc+prueba1@gmail.com`. Gmail la entrega en tu buzón de siempre, y para la app es un usuario nuevo, con su propio hogar y las 6 tareas sin hacer.
2. En Supabase, abre **SQL Editor** en el proyecto de pruebas, pega la consulta y cambia el email (y, si la consulta lo pide, el nombre de la tarea o los días).
3. Pulsa **Run** y vuelve a cargar la app.

Todas las consultas solo cambian los datos de **esa cuenta**, y solo si el email lleva `+prueba`. Así, aunque una se pegara por error en producción, no tocaría tu hogar de verdad.

Para empezar de cero, lo más fácil es entrar con otra cuenta (`+prueba2`, `+prueba3`…).

## Ver las tareas de una cuenta

Qué tareas tiene, cuándo se crearon y cuándo se hicieron por última vez.

```sql
select t.name, t.frequency, t.created_on,
  (select max(r.completed_on) from public.task_rounds r where r.task_id = t.id) as last_completed_on
from public.tasks t
join public.household_members m on m.household_id = t.household_id
join auth.users u on u.id = m.user_id
where u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
order by t.position;
```

## Dejar todas las tareas sin hacer

Borra lo que se ha marcado como hecho. Las puntuales vuelven a aparecer.

```sql
delete from public.task_rounds r
using public.household_members m, auth.users u
where r.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%';
```

## Que una tarea se creara hace unos días

Para tener una tarea de cada N días retrasada sin esperar: una que nunca se ha hecho toca desde el día en que se creó. Con `- 5`, Baño (cada 3 días) tocaba hace 5 días y sale «Retrasada 5 días».

```sql
update public.tasks t
set created_on = (now() at time zone 'Europe/Madrid')::date - 5
from public.household_members m, auth.users u
where t.household_id = m.household_id and m.user_id = u.id
  and u.email = 'mariasol.dc+prueba1@gmail.com' and u.email like '%+prueba%'
  and t.name = 'Baño';
```

## Que una tarea de cada N días se hiciera hace unos días

Apunta que se hizo por última vez hace 10 días. Con Baño (cada 3 días), tocaba hace 7 y sale «Retrasada 7 días». Solo para las de **cada N días**; si la tarea ya se ha marcado después, primero deja las tareas sin hacer (arriba).

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

Las de las tareas retrasadas de fin de semana no necesitan consulta: dependen solo del día. Una tarea de fin de semana sin hacer sale retrasada de lunes a viernes.
