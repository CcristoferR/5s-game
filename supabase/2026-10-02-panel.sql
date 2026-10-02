-- ===========================================================================
-- Panel de administración: puntajes por fase
-- ===========================================================================
--
-- Se corre UNA vez: Supabase → SQL Editor → New query → pegar todo → Run.
-- Volver a correrlo no hace daño: deja lo mismo si ya estaba hecho.
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
--
-- Qué hace:
--
--   Agrega panel_resultados, una función de SOLO LECTURA que le entrega al
--   panel el mejor intento de cada persona en cada fase (puntaje, tiempo y
--   fecha). Con eso el panel calcula el puntaje medio por fase, la fase donde
--   más gente se queda y la ficha de cada persona.
--
-- Por qué hace falta:
--
--   La tabla resultados_fase solo deja leer las filas propias, también al
--   administrador. Está bien así: la política no se toca. La función corre con
--   permisos de servidor, pero antes de responder comprueba que quien llama
--   sea administrador; a cualquier otra persona le devuelve un error.
--
-- No escribe nada, no cambia tablas ni políticas. Hasta que se corra, el panel
-- funciona igual y solo muestra un aviso donde irían los puntajes por fase.

begin;

create or replace function public.panel_resultados(p_curso_id text default null)
 returns table(
   perfil_id      uuid,
   curso_id       text,
   fase           integer,
   puntaje        integer,
   segundos       integer,
   actualizado_en timestamptz
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración puede leer los resultados por fase';
  end if;

  -- Columnas calificadas con rf.: los nombres de la tabla de salida son
  -- variables dentro de la función y sin el prefijo serían ambiguos.
  return query
  select rf.perfil_id::uuid,
         rf.curso_id::text,
         rf.fase::integer,
         rf.puntaje::integer,
         rf.segundos::integer,
         rf.actualizado_en::timestamptz
    from public.resultados_fase rf
   where p_curso_id is null
      or rf.curso_id = p_curso_id
   order by rf.curso_id, rf.perfil_id, rf.fase;
end;
$function$;

-- La llama quien tiene sesión; la comprobación de rol está adentro.
revoke execute on function public.panel_resultados(text) from public, anon;
grant execute on function public.panel_resultados(text) to authenticated;

commit;

-- Que la API vea la función nueva al tiro, sin esperar.
notify pgrst, 'reload schema';


-- Comprobación ───────────────────────────────────────────────────────────
--
-- Tiene que mostrar la función con "p_curso_id text" y cuántos resultados
-- hay guardados en cada curso.

select 'funcion' as que,
       'panel_resultados' as nombre,
       pg_get_function_identity_arguments('public.panel_resultados'::regproc) as detalle
union all
select 'resultados',
       curso_id,
       count(*) || ' fases aprobadas · ' || count(distinct perfil_id) || ' personas'
  from public.resultados_fase
 group by curso_id
order by 1, 2;
