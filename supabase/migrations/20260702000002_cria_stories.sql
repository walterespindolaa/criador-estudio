-- Cria Stories — banco compartilhado de tendências de stories + plano semanal por usuário.

-- 1) Banco compartilhado (curadoria via Perplexity; só leitura p/ usuários, escrita via service_role).
create table if not exists public.story_trends (
  id uuid primary key default gen_random_uuid(),
  format text not null,               -- ex: enquete, bastidor, caixinha, tutorial, antes/depois
  title text not null,                -- nome curto da tendência
  description text,                   -- 1 frase de como usar
  why_trending text,                  -- por que está em alta
  created_at timestamptz not null default now()
);
create index if not exists idx_story_trends_created on public.story_trends (created_at desc);

alter table public.story_trends enable row level security;
drop policy if exists "story_trends_read" on public.story_trends;
create policy "story_trends_read" on public.story_trends
  for select to authenticated using (true);

-- 2) Slots do plano de stories (por usuário).
create table if not exists public.story_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_date date not null,
  slot_time time,                     -- horário sugerido
  title text not null,                -- título/ideia do story
  script text,                        -- roteiro / o que gravar
  format text,                        -- formato (enquete, bastidor…)
  status text not null default 'pendente' check (status in ('pendente','feito')),
  sort_order int not null default 0,  -- ordem dentro do dia
  source text not null default 'ia' check (source in ('ia','manual','trend')),
  trend_id uuid,                      -- origem opcional (story_trends)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_story_slots_user_date on public.story_slots (user_id, slot_date);

alter table public.story_slots enable row level security;
drop policy if exists "story_slots_select" on public.story_slots;
create policy "story_slots_select" on public.story_slots
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "story_slots_insert" on public.story_slots;
create policy "story_slots_insert" on public.story_slots
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "story_slots_update" on public.story_slots;
create policy "story_slots_update" on public.story_slots
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "story_slots_delete" on public.story_slots;
create policy "story_slots_delete" on public.story_slots
  for delete to authenticated using (user_id = auth.uid());
