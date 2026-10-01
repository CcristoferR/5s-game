-- ===========================================================================
-- Curso de guardias en la plataforma, y el avance que no se estaba guardando
-- ===========================================================================
--
-- Se corre UNA vez: Supabase → SQL Editor → New query → pegar todo → Run.
-- Volver a correrlo no hace daño: cada paso deja lo mismo si ya estaba hecho.
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
--
-- Qué hace:
--
--   1. El curso de guardias pasa a tener 3 fases: condominio, supermercado y
--      banco. Con 1, el certificado se habría emitido al aprobar el primero.
--
--   2. Arregla registrar_fase, la función que guarda el avance (tabla
--      progreso). Recibía el curso como uuid, pero los cursos se identifican
--      con texto ('curso-5s-operaciones'), así que cada llamada fallaba antes
--      de empezar. Desde que el juego la usa (7 de septiembre), el avance no
--      se guardaba: ni el catálogo, ni la reanudación de niveles, ni el
--      certificado lo veían. El ranking sí, porque usa otra función
--      (guardar_resultado_fase), que estaba bien.
--
--   3. Recupera ese avance desde resultados_fase, que sí guardó cada fase
--      aprobada: lo que la gente ya hizo vuelve a aparecer.
--
--   4. Los certificados de guardias llevan su propio prefijo, GS-, en vez de
--      5S-. Los ya emitidos no cambian.
--
-- Al final muestra una tabla para comprobar que quedó bien.

begin;

-- 1 · Tres fases para guardias ─────────────────────────────────────────────

update public.cursos set total_fases = 3 where id = 'curso-guardias-os10';


-- 2 · registrar_fase con el curso como texto ───────────────────────────────
--
-- El tipo de un parámetro no se cambia con "create or replace": eso crearía
-- una segunda función al lado. Por eso se borra la vieja primero. El cuerpo es
-- el mismo de antes; solo cambia p_curso_id, de uuid a text.

drop function if exists public.registrar_fase(uuid, uuid, integer, integer);

create or replace function public.registrar_fase(
  p_perfil_id uuid,
  p_curso_id text,
  p_fase integer,
  p_puntaje integer
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  total_fases integer;
  lista       integer[];
  reales      integer;
  suma        integer;
begin
  -- Solo sobre el propio avance. Sin esto, cualquiera con la sesión abierta
  -- podría marcar fases completadas en el perfil de otra persona.
  if auth.uid() is distinct from p_perfil_id then
    return jsonb_build_object('ok', false, 'motivo', 'no_es_tu_progreso');
  end if;

  if p_fase < 0 or p_fase > 20 then
    return jsonb_build_object('ok', false, 'motivo', 'fase_invalida');
  end if;

  select coalesce(cursos.total_fases, 5) into total_fases
    from public.cursos where id = p_curso_id;

  if total_fases is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_curso');
  end if;

  -- La fila se crea si no existe. Se hace primero y aparte para que el UPDATE
  -- de abajo siempre tenga algo que bloquear.
  insert into public.progreso (perfil_id, curso_id, fases_completadas, puntaje)
  values (p_perfil_id, p_curso_id, '{}', 0)
  on conflict (perfil_id, curso_id) do nothing;

  -- La operación atómica: leer el array, agregarle la fase si falta,
  -- ordenarlo y guardarlo, todo en un UPDATE. Dos llamadas a la vez se
  -- ejecutan una detrás de otra sobre el valor ya actualizado.
  --
  -- El puntaje se suma desde resultados_fase, que tiene una fila por fase y
  -- es la única fuente correcta. Se recalcula entero en cada guardado.
  update public.progreso p
     set fases_completadas =
           (select array_agg(f order by f)
              from (
                select distinct unnest(p.fases_completadas || array[p_fase]) as f
              ) t),

         puntaje = coalesce((
           select sum(rf.puntaje)::integer
             from public.resultados_fase rf
            where rf.perfil_id = p_perfil_id
              and rf.curso_id  = p_curso_id
         ), 0),

         actualizado_en = now()
   where p.perfil_id = p_perfil_id
     and p.curso_id  = p_curso_id
  returning p.fases_completadas, p.puntaje into lista, suma;

  -- El tutorial es la fase 0: enseña los controles, no es contenido del
  -- curso, así que no cuenta para darlo por completado.
  select count(*) into reales from unnest(lista) f where f >= 1;

  -- La marca de completado se pone UNA vez y no se toca más.
  if reales >= total_fases then
    update public.progreso
       set completado_en = coalesce(completado_en, now())
     where perfil_id = p_perfil_id and curso_id = p_curso_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'fases', lista,
    'puntaje', suma,
    'completado', reales >= total_fases
  );
end;
$function$;

-- Como la anterior: la llama quien tiene sesión, nadie más.
revoke execute on function public.registrar_fase(uuid, text, integer, integer) from public, anon;
grant execute on function public.registrar_fase(uuid, text, integer, integer) to authenticated;


-- 3 · Recuperar el avance desde resultados_fase ────────────────────────────
--
-- Cada fila de resultados_fase es una fase aprobada: el juego solo la guarda
-- al completar un nivel. Lo que ya había en progreso se conserva; se le suman
-- las fases que faltaban.

insert into public.progreso as p
  (perfil_id, curso_id, fases_completadas, puntaje, actualizado_en)
select rf.perfil_id,
       rf.curso_id,
       array_agg(distinct rf.fase order by rf.fase),
       coalesce(sum(rf.puntaje), 0)::integer,
       max(rf.actualizado_en)
  from public.resultados_fase rf
  join public.cursos c on c.id = rf.curso_id
 group by rf.perfil_id, rf.curso_id
on conflict (perfil_id, curso_id) do update
   set fases_completadas = (
         select array_agg(distinct f order by f)
           from unnest(p.fases_completadas || excluded.fases_completadas) as f
       ),
       puntaje = excluded.puntaje,
       actualizado_en = greatest(p.actualizado_en, excluded.actualizado_en);

-- Y la marca de completado a quien ya tiene todas las fases del curso.
update public.progreso p
   set completado_en = coalesce(p.actualizado_en, now())
  from public.cursos c
 where c.id = p.curso_id
   and p.completado_en is null
   and (select count(*) from unnest(p.fases_completadas) f where f >= 1) >= c.total_fases;


-- 4 · Certificados con el prefijo de su curso ──────────────────────────────
--
-- El mismo cuerpo de antes; solo cambia el comienzo del código.

create or replace function public.emitir_certificado(curso text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  quien        uuid := auth.uid();
  ya           public.certificados%rowtype;
  p            public.perfiles%rowtype;
  avance       public.progreso%rowtype;
  c            public.cursos%rowtype;
  fases_reales integer;
  puntaje_total integer;
  nuevo_codigo text;
  -- El código dice de qué curso es: GS- guardias, 5S- el resto.
  prefijo      text := case curso when 'curso-guardias-os10' then 'GS-' else '5S-' end;
  -- Sin caracteres que se confundan al dictarlo: nada de O/0 ni I/L/1.
  alfabeto     text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  intentos     integer := 0;
  i            integer;
begin
  if quien is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
  end if;

  -- Si ya se emitió, se devuelve el mismo. El código impreso en el
  -- certificado que la persona descargó tiene que seguir siendo válido.
  select * into ya from public.certificados
  where perfil_id = quien and curso_id = curso;

  if found then
    return jsonb_build_object(
      'ok', true, 'codigo', ya.codigo, 'nombre', ya.nombre_completo,
      'empresa', ya.empresa, 'area', ya.area,
      'puntaje', ya.puntaje, 'emitido_en', ya.emitido_en
    );
  end if;

  select * into p from public.perfiles where id = quien;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sin_perfil');
  end if;

  select * into c from public.cursos where id = curso;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sin_curso');
  end if;

  select * into avance from public.progreso
  where perfil_id = quien and curso_id = curso;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sin_avance');
  end if;

  -- La fase 0 es el tutorial: enseña los controles, no es contenido del curso.
  select count(*) into fases_reales
  from unnest(avance.fases_completadas) as f
  where f >= 1;

  if fases_reales < c.total_fases then
    return jsonb_build_object(
      'ok', false, 'motivo', 'curso_incompleto',
      'hechas', fases_reales, 'requeridas', c.total_fases
    );
  end if;

  -- El puntaje del certificado es la suma de las fases (la misma tabla que
  -- usa el ranking, resultados_fase).
  select coalesce(sum(puntaje), 0) into puntaje_total
  from public.resultados_fase
  where perfil_id = quien and curso_id = curso and fase >= 1;

  loop
    nuevo_codigo := prefijo;
    for i in 1..4 loop
      nuevo_codigo := nuevo_codigo ||
        substr(alfabeto, floor(random() * length(alfabeto))::int + 1, 1);
    end loop;
    nuevo_codigo := nuevo_codigo || '-';
    for i in 1..4 loop
      nuevo_codigo := nuevo_codigo ||
        substr(alfabeto, floor(random() * length(alfabeto))::int + 1, 1);
    end loop;

    exit when not exists (select 1 from public.certificados where codigo = nuevo_codigo);
    intentos := intentos + 1;
    exit when intentos > 20;
  end loop;

  insert into public.certificados
    (codigo, perfil_id, curso_id, nombre_completo, empresa, area, puntaje)
  values
    (nuevo_codigo, quien, curso, p.nombre_completo, p.empresa, p.area, puntaje_total)
  returning * into ya;

  return jsonb_build_object(
    'ok', true, 'codigo', ya.codigo, 'nombre', ya.nombre_completo,
    'empresa', ya.empresa, 'area', ya.area,
    'puntaje', ya.puntaje, 'emitido_en', ya.emitido_en
  );
end;
$function$;

commit;

-- Que la API vea la función nueva al tiro, sin esperar.
notify pgrst, 'reload schema';


-- Comprobación ───────────────────────────────────────────────────────────
--
-- Tiene que decir: guardias con 3 fases, registrar_fase con "p_curso_id
-- text", y cuántas personas tienen avance en cada curso.

select 'curso' as que, id as nombre, 'fases: ' || total_fases as detalle
  from public.cursos
union all
select 'funcion', 'registrar_fase', pg_get_function_identity_arguments('public.registrar_fase'::regproc)
union all
select 'avance', curso_id, count(*) || ' personas · ' || count(completado_en) || ' completaron'
  from public.progreso
 group by curso_id
union all
select 'vista', 'ranking_base', pg_get_viewdef('public.ranking_base'::regclass, true)
order by 1, 2;
