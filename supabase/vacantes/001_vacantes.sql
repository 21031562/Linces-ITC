-- =============================================================================
-- Linces ITC · Supabase B ("vacantes") — usado SOLO por vacantes-service
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (proyecto VACANTES)
--
-- Funcionalidad adicional: Bolsa de Servicio Social, Residencias y Proyectos.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── Organizaciones (empresas, dependencias, áreas internas) ─────────────────
create table if not exists public.organizaciones (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  tipo             text not null default 'empresa'
                   check (tipo in ('empresa','dependencia_gobierno','interna_itc','ong')),
  descripcion      text,
  contacto_nombre  text,
  contacto_email   text,
  sitio_web        text,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

-- ── Vacantes ────────────────────────────────────────────────────────────────
create table if not exists public.vacantes (
  id                      uuid primary key default gen_random_uuid(),
  organizacion_id         uuid not null references public.organizaciones(id) on delete restrict,
  titulo                  text not null,
  tipo                    text not null check (tipo in ('servicio_social','residencia','proyecto')),
  descripcion             text not null,
  area                    text,
  modalidad               text not null default 'presencial'
                          check (modalidad in ('presencial','remota','hibrida')),
  ubicacion               text,
  cupo                    integer not null default 1 check (cupo > 0),
  horas_semana            integer check (horas_semana is null or horas_semana between 1 and 48),
  remunerada              boolean not null default false,
  apoyo_economico         text,
  requisito_avance_min    numeric(5,2) not null default 0 check (requisito_avance_min between 0 and 100),
  requisito_promedio_min  numeric(5,2) not null default 0 check (requisito_promedio_min between 0 and 100),
  requisito_semestre_min  integer      not null default 1 check (requisito_semestre_min between 1 and 14),
  habilidades             text[] not null default '{}',
  fecha_limite            date,
  estado                  text not null default 'borrador'
                          check (estado in ('borrador','publicada','cerrada')),
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now()
);

create index if not exists idx_vacantes_estado on public.vacantes (estado, tipo);

-- ── Postulaciones ───────────────────────────────────────────────────────────
-- snapshot: indicadores del SII al momento de postular (evidencia de elegibilidad).
create table if not exists public.postulaciones (
  id                uuid primary key default gen_random_uuid(),
  vacante_id        uuid not null references public.vacantes(id) on delete cascade,
  numero_control    text not null,
  nombre            text not null,
  email             text not null,
  mensaje           text,
  snapshot          jsonb not null default '{}'::jsonb,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente','en_revision','aceptada','rechazada','cancelada')),
  comentario_admin  text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (vacante_id, numero_control)
);

create index if not exists idx_postulaciones_nc on public.postulaciones (numero_control);

-- ── Administradores (auth propia del backend de administración) ─────────────
create table if not exists public.admins (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  nombre         text not null,
  password_hash  text not null,             -- bcrypt
  rol            text not null default 'admin' check (rol in ('admin','revisor')),
  activo         boolean not null default true,
  ultimo_login   timestamptz,
  creado_en      timestamptz not null default now()
);

create table if not exists public.admin_sesiones (
  id_hash    text primary key,              -- SHA-256 del ID de la cookie
  admin_id   uuid not null references public.admins(id) on delete cascade,
  expira_en  timestamptz not null,
  creada_en  timestamptz not null default now()
);

create table if not exists public.bitacora_admin (
  id          bigint generated always as identity primary key,
  admin_id    uuid references public.admins(id) on delete set null,
  accion      text not null,
  entidad     text not null,
  entidad_id  text,
  detalle     jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);

-- ── actualizado_en automático ───────────────────────────────────────────────
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists trg_vacantes_upd on public.vacantes;
create trigger trg_vacantes_upd before update on public.vacantes
  for each row execute function public.tocar_actualizado_en();

drop trigger if exists trg_postulaciones_upd on public.postulaciones;
create trigger trg_postulaciones_upd before update on public.postulaciones
  for each row execute function public.tocar_actualizado_en();

-- ── Vista con conteos (cupo ocupado) ────────────────────────────────────────
create or replace view public.vacantes_resumen
with (security_invoker = true) as
select
  v.*,
  o.nombre as organizacion_nombre,
  o.tipo   as organizacion_tipo,
  count(p.id) filter (where p.estado <> 'cancelada')                as postulaciones_total,
  count(p.id) filter (where p.estado = 'aceptada')                  as aceptadas,
  greatest(v.cupo - count(p.id) filter (where p.estado = 'aceptada'), 0) as lugares_disponibles
from public.vacantes v
join public.organizaciones o on o.id = v.organizacion_id
left join public.postulaciones p on p.vacante_id = v.id
group by v.id, o.id;

-- ── Seguridad ───────────────────────────────────────────────────────────────
-- RLS sin políticas = nadie con anon/publishable key puede tocar nada.
-- Solo vacantes-service (secret key / service_role) accede.
alter table public.organizaciones  enable row level security;
alter table public.vacantes        enable row level security;
alter table public.postulaciones   enable row level security;
alter table public.admins          enable row level security;
alter table public.admin_sesiones  enable row level security;
alter table public.bitacora_admin  enable row level security;

revoke all on public.organizaciones, public.vacantes, public.postulaciones,
              public.admins, public.admin_sesiones, public.bitacora_admin,
              public.vacantes_resumen
  from anon, authenticated;

grant all on public.organizaciones, public.vacantes, public.postulaciones,
             public.admins, public.admin_sesiones, public.bitacora_admin,
             public.vacantes_resumen
  to service_role;
grant usage, select on all sequences in schema public to service_role;
