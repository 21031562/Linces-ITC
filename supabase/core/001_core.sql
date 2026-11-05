-- =============================================================================
-- Linces ITC · Supabase A ("core") — usado SOLO por el BFF
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (proyecto CORE)
--
-- Aquí NO se guardan datos académicos (el SII es la única fuente de verdad).
-- Solo sesiones (con el JWT del SII cifrado) y una bitácora de auditoría.
-- =============================================================================

-- ── Sesiones ────────────────────────────────────────────────────────────────
-- id_hash  : SHA-256 del ID de sesión que viaja en la cookie HttpOnly.
--            Si alguien lee esta tabla, no puede reconstruir la cookie.
-- token_cifrado : JWT del SII cifrado con AES-256-GCM (llave solo en el BFF).
create table if not exists public.sesiones (
  id_hash         text primary key,
  numero_control  text        not null,
  token_cifrado   text        not null,
  expira_en       timestamptz not null,
  ultimo_uso      timestamptz not null default now(),
  creada_en       timestamptz not null default now(),
  user_agent      text
);

create index if not exists idx_sesiones_nc      on public.sesiones (numero_control);
create index if not exists idx_sesiones_expira  on public.sesiones (expira_en);

-- ── Auditoría ───────────────────────────────────────────────────────────────
create table if not exists public.auditoria (
  id              bigint generated always as identity primary key,
  evento          text        not null
                  check (evento in ('login_ok','login_fallido','logout','sesion_expirada',
                                    'sesion_inactiva','token_rechazado','postulacion','cancelacion')),
  numero_control  text,
  detalle         jsonb       not null default '{}'::jsonb,
  ip_hash         text,
  creado_en       timestamptz not null default now()
);

create index if not exists idx_auditoria_fecha on public.auditoria (creado_en desc);

-- ── Limpieza de sesiones vencidas ───────────────────────────────────────────
create or replace function public.limpiar_sesiones_vencidas()
returns integer
language sql
security invoker
set search_path = public
as $$
  with borradas as (
    delete from public.sesiones where expira_en < now() returning 1
  )
  select count(*)::int from borradas;
$$;

-- ── Seguridad ───────────────────────────────────────────────────────────────
-- RLS activado y SIN políticas: anon/authenticated no pueden leer ni escribir.
-- Solo la secret key / service_role (que vive en el BFF) tiene acceso.
alter table public.sesiones  enable row level security;
alter table public.auditoria enable row level security;

revoke all on public.sesiones  from anon, authenticated;
revoke all on public.auditoria from anon, authenticated;
revoke execute on function public.limpiar_sesiones_vencidas() from public, anon, authenticated;

grant all on public.sesiones  to service_role;
grant all on public.auditoria to service_role;
grant execute on function public.limpiar_sesiones_vencidas() to service_role;
