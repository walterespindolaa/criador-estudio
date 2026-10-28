-- ═══════════════════════════════════════════════════════════════════════════
-- STORIES EM PARTES + USO DE TENDÊNCIAS (28/10/2026, mockup aprovado)
--
-- 1. O Novo story grava o formato "falado" pro story que vai pro Prompter.
--    A regra do banco (post nasce em "gravando") passa a reconhecer.
-- 2. Registro de uso de tendência (sem dado pessoal pra fora): alimenta o
--    destaque "Mais usada no Cria esta semana" da página Tendências.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.story_falado(_formato text)
returns boolean language sql immutable as $$
  select not public.story_tem_figurinha(_formato)
     and coalesce(lower(_formato), '') ~ '(falad|talking|bastidor|tutorial|pov|video|sequencia|depoimento|vlog|rotina)';
$$;

create table if not exists public.trend_usos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fonte text not null check (fonte in ('conteudo', 'story')),
  trend_id uuid not null,
  onde text,
  created_at timestamptz not null default now()
);
create index if not exists trend_usos_recente_idx on public.trend_usos (created_at desc, fonte, trend_id);

alter table public.trend_usos enable row level security;

drop policy if exists "trend_usos_insere_proprio" on public.trend_usos;
create policy "trend_usos_insere_proprio" on public.trend_usos
  for insert to authenticated with check (user_id = auth.uid());

-- Ninguém lê linha a linha: o ranking sai só agregado pela função abaixo.

create or replace function public.trend_mais_usadas(_dias integer default 7)
returns table (fonte text, trend_id uuid, usos bigint)
language sql stable security definer set search_path = public as $$
  select u.fonte, u.trend_id, count(distinct u.user_id) as usos
    from public.trend_usos u
   where u.created_at >= now() - make_interval(days => greatest(1, least(coalesce(_dias, 7), 60)))
   group by u.fonte, u.trend_id
   order by usos desc
   limit 20;
$$;

revoke all on function public.trend_mais_usadas(integer) from public, anon;
grant execute on function public.trend_mais_usadas(integer) to authenticated;
