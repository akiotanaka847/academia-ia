-- =====================================================================
-- ACADEMIA IA · Examen de nivelación (anti-trampas, en el servidor)
--
-- CÓMO EJECUTARLO: Supabase → SQL Editor → New query → pega esto → Run
--
-- IDEA ANTI-TRAMPAS: la columna `correcta` (la respuesta correcta) y la
-- `explicacion` NUNCA se exponen a la API pública. El navegador solo puede
-- llamar a funciones que:
--   · examen_generar / examen_diagnostico → devuelven preguntas SIN la respuesta
--   · examen_calificar → recibe las respuestas, califica EN EL SERVIDOR y
--     recién ahí devuelve qué era lo correcto (para aprender). Imposible ver
--     las respuestas antes de contestar desde el cliente.
-- =====================================================================

-- 1 · BANCO DE PREGUNTAS
create table if not exists public.examen_preguntas (
  id          uuid primary key default gen_random_uuid(),
  nivel       text not null check (nivel in ('principiante','intermedio','avanzado')),
  tema        text,
  pregunta    text not null,
  opciones    jsonb not null,            -- array de 4 strings
  correcta    int  not null check (correcta between 0 and 3),
  explicacion text not null,
  creada_en   timestamptz not null default now()
);

-- Nadie puede leer la tabla por la API (ni las preguntas ni las respuestas):
-- todo pasa por las funciones de abajo, que corren como dueño (security definer).
alter table public.examen_preguntas enable row level security;
revoke all on public.examen_preguntas from anon, authenticated;

-- 2 · RESULTADOS (uno por intento)
create table if not exists public.examen_resultados (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  tipo        text not null,             -- 'diagnostico' | 'reto'
  objetivo    text,                      -- nivel que retó (si aplica)
  colocado    text,                      -- nivel resultante
  total       int, aciertos int, pct numeric, aprobado boolean,
  creado_en   timestamptz not null default now()
);
alter table public.examen_resultados enable row level security;
drop policy if exists "resultados propios: leer" on public.examen_resultados;
create policy "resultados propios: leer" on public.examen_resultados
  for select using (auth.uid() = usuario_id);

-- 3 · GENERAR un examen de un nivel (N preguntas aleatorias, sin respuestas)
--     p_excluir: ids que la persona ya vio (para no repetir en el reintento)
create or replace function public.examen_generar(p_nivel text, p_n int default 12, p_excluir uuid[] default '{}')
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(q order by random()), '[]'::jsonb) from (
    select jsonb_build_object('id', id, 'pregunta', pregunta, 'opciones', opciones) as q
    from public.examen_preguntas
    where nivel = p_nivel and not (id = any(p_excluir))
    order by random() limit greatest(1, least(p_n, 40))
  ) t;
$$;

-- 4 · DIAGNÓSTICO: mezcla equilibrada de los 3 niveles (sin respuestas)
create or replace function public.examen_diagnostico(p_por_nivel int default 6, p_excluir uuid[] default '{}')
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(q order by random()), '[]'::jsonb) from (
    (select jsonb_build_object('id',id,'pregunta',pregunta,'opciones',opciones) q
       from public.examen_preguntas where nivel='principiante' and not (id=any(p_excluir)) order by random() limit p_por_nivel)
    union all
    (select jsonb_build_object('id',id,'pregunta',pregunta,'opciones',opciones) q
       from public.examen_preguntas where nivel='intermedio' and not (id=any(p_excluir)) order by random() limit p_por_nivel)
    union all
    (select jsonb_build_object('id',id,'pregunta',pregunta,'opciones',opciones) q
       from public.examen_preguntas where nivel='avanzado' and not (id=any(p_excluir)) order by random() limit p_por_nivel)
  ) t;
$$;

-- 5 · CALIFICAR en el servidor. p_respuestas = [{"id":uuid,"elegida":int}, ...]
create or replace function public.examen_calificar(p_respuestas jsonb, p_tipo text default 'reto', p_objetivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int; v_aciertos int; v_pct numeric;
  v_detalle jsonb; v_niveles jsonb; v_colocado text; v_aprobado boolean;
  umbral numeric := 0.8;
begin
  with r as (
    select (x->>'id')::uuid id, (x->>'elegida')::int elegida
    from jsonb_array_elements(p_respuestas) x
  ),
  j as (
    select q.id, q.nivel, q.correcta, q.explicacion, r.elegida,
           (r.elegida = q.correcta) acierto
    from r join public.examen_preguntas q on q.id = r.id
  )
  select count(*), count(*) filter (where acierto),
    jsonb_agg(jsonb_build_object('id',id,'correcta',correcta,'acierto',acierto,'explicacion',explicacion)),
    (select jsonb_object_agg(nivel, jsonb_build_object('total',t,'aciertos',a,'pct',round(a::numeric/nullif(t,0),3)))
       from (select nivel, count(*) t, count(*) filter (where acierto) a from j group by nivel) s)
  into v_total, v_aciertos, v_detalle, v_niveles
  from j;

  v_pct := round(v_aciertos::numeric / nullif(v_total,0), 3);
  v_colocado := 'principiante';
  if coalesce((v_niveles->'intermedio'->>'pct')::numeric,0) >= umbral then v_colocado := 'intermedio'; end if;
  if coalesce((v_niveles->'avanzado'->>'pct')::numeric,0) >= umbral then v_colocado := 'avanzado'; end if;

  v_aprobado := case
    when p_objetivo is not null then coalesce((v_niveles->p_objetivo->>'pct')::numeric,0) >= umbral
    else v_pct >= umbral end;

  insert into public.examen_resultados(usuario_id, tipo, objetivo, colocado, total, aciertos, pct, aprobado)
  values (auth.uid(), p_tipo, p_objetivo, v_colocado, v_total, v_aciertos, v_pct, v_aprobado);

  return jsonb_build_object('total',v_total,'aciertos',v_aciertos,'pct',v_pct,
    'niveles',coalesce(v_niveles,'{}'::jsonb),'colocado',v_colocado,
    'aprobado',v_aprobado,'umbral',umbral,'detalle',v_detalle);
end;
$$;

-- Permitir que el sitio (rol anon/authenticated) llame SOLO a estas funciones.
grant execute on function public.examen_generar(text,int,uuid[]) to anon, authenticated;
grant execute on function public.examen_diagnostico(int,uuid[]) to anon, authenticated;
grant execute on function public.examen_calificar(jsonb,text,text) to anon, authenticated;
