-- =====================================================================
-- ACADEMIA IA · Configuración de la base de datos (Supabase)
--
-- CÓMO EJECUTARLO (una sola vez):
--   Supabase → tu proyecto → SQL Editor → New query → pega esto → Run
--
-- Qué crea:
--   · perfiles  : una fila por persona inscrita, con el campo "aprobado"
--   · progreso  : el avance de cada persona en cada módulo
--   · políticas : reglas que impiden que nadie vea ni toque datos ajenos
--
-- IDEA CLAVE DE SEGURIDAD
--   Los usuarios NO tienen permiso para modificar su propio perfil. Si lo
--   tuvieran, cualquiera podría ponerse "aprobado = true" desde la consola
--   del navegador y saltarse tu autorización. Aprobar solo se puede desde
--   el panel de Supabase (que usa la clave secreta), es decir: solo tú.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · PERFILES
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nombre     text,
  aprobado   boolean not null default false,
  es_admin   boolean not null default false,
  creado_en  timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada persona puede LEER únicamente su propio perfil (para saber si ya
-- fue aprobada). No hay política de UPDATE: nadie puede auto-aprobarse.
drop policy if exists "perfil propio: leer" on public.perfiles;
create policy "perfil propio: leer"
  on public.perfiles for select
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2 · Crear el perfil automáticamente al registrarse
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------
-- 3 · Función de ayuda: ¿la persona conectada está aprobada?
--     (security definer para poder leer perfiles sin chocar con RLS)
-- ---------------------------------------------------------------------
create or replace function public.esta_aprobado()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select aprobado from public.perfiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 4 · PROGRESO del curso (sustituye al localStorage, ahora por usuario)
-- ---------------------------------------------------------------------
create table if not exists public.progreso (
  usuario_id      uuid not null references auth.users(id) on delete cascade,
  modulo          text not null,
  secciones       jsonb not null default '[]'::jsonb,
  quiz            boolean not null default false,
  total           int not null default 0,
  pct             int not null default 0,
  actualizado_en  timestamptz not null default now(),
  primary key (usuario_id, modulo)
);

alter table public.progreso enable row level security;

-- Solo tus propias filas Y solo si estás aprobado: así una persona sin
-- autorizar no puede ni leer ni guardar avance del curso.
drop policy if exists "progreso propio: leer" on public.progreso;
create policy "progreso propio: leer"
  on public.progreso for select
  using (auth.uid() = usuario_id and public.esta_aprobado());

drop policy if exists "progreso propio: insertar" on public.progreso;
create policy "progreso propio: insertar"
  on public.progreso for insert
  with check (auth.uid() = usuario_id and public.esta_aprobado());

drop policy if exists "progreso propio: actualizar" on public.progreso;
create policy "progreso propio: actualizar"
  on public.progreso for update
  using (auth.uid() = usuario_id and public.esta_aprobado())
  with check (auth.uid() = usuario_id and public.esta_aprobado());

-- =====================================================================
-- CÓMO APROBAR A ALGUIEN (tú, el administrador)
--   Supabase → Table Editor → tabla "perfiles" → busca el correo
--   → marca la casilla "aprobado" → guarda.
--   A partir de ese momento esa persona ya puede entrar.
--
-- PARA VER QUIÉN ESTÁ ESPERANDO APROBACIÓN, ejecuta:
--   select email, nombre, creado_en from public.perfiles
--   where aprobado = false order by creado_en desc;
-- =====================================================================
