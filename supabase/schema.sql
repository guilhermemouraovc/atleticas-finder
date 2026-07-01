-- ============================================================================
-- Schema Supabase para o projeto "Atléticas de Medicina"
-- Rode este SQL no SQL Editor do seu projeto Supabase (Project > SQL Editor).
-- ============================================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabela principal
-- ----------------------------------------------------------------------------
create table if not exists public.atleticas (
  id                uuid primary key default gen_random_uuid(),
  username          text not null unique,
  url               text,
  estado            text,
  nordeste          text,
  universidade      text,
  categoria         text,
  score             integer,
  motivos_match     text[] default '{}',
  motivos_exclusao  text[] default '{}',
  bio               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.atleticas is 'Perfis de atléticas de medicina encontrados pelo scraper no Instagram.';
comment on column public.atleticas.username is 'Username do Instagram (ex: @atletica_medicina), chave de upsert.';

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_atleticas_estado on public.atleticas (estado);
create index if not exists idx_atleticas_categoria on public.atleticas (categoria);

-- ----------------------------------------------------------------------------
-- Trigger para manter updated_at sempre atualizado em cada UPDATE/UPSERT
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_atleticas_updated_at on public.atleticas;
create trigger trg_atleticas_updated_at
  before update on public.atleticas
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.atleticas enable row level security;

-- Leitura pública (frontend usa a anon key)
drop policy if exists "atleticas_public_read" on public.atleticas;
create policy "atleticas_public_read"
  on public.atleticas
  for select
  to anon, authenticated
  using (true);

-- Escrita (insert/update/delete) somente via service role (usado pelo GitHub Actions)
-- A service role já passa por cima do RLS por padrão, mas deixamos as policies
-- explícitas para documentar a intenção e cobrir o caso de RLS ser forçado.
drop policy if exists "atleticas_service_insert" on public.atleticas;
create policy "atleticas_service_insert"
  on public.atleticas
  for insert
  to service_role
  with check (true);

drop policy if exists "atleticas_service_update" on public.atleticas;
create policy "atleticas_service_update"
  on public.atleticas
  for update
  to service_role
  using (true)
  with check (true);

drop policy if exists "atleticas_service_delete" on public.atleticas;
create policy "atleticas_service_delete"
  on public.atleticas
  for delete
  to service_role
  using (true);
