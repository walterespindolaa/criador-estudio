-- IDEIAS EM BLOCO DE NOTAS (Walter, 06/11/2026; mockup aprovado)
-- O que a Cria IA tirou de cada folha fica guardado na própria folha.
create table if not exists public.idea_geracoes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null,
  formato text not null,
  sugestao jsonb not null,
  -- Texto da folha no momento da geração: serve pra avisar "a folha mudou".
  base_texto text,
  status text not null default 'nova' check (status in ('nova', 'virou_post', 'guardada', 'descartada')),
  post_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idea_geracoes_idea_idx on public.idea_geracoes (idea_id, created_at desc);
alter table public.idea_geracoes enable row level security;
drop policy if exists "idea_geracoes_dono_e_equipe" on public.idea_geracoes;
create policy "idea_geracoes_dono_e_equipe" on public.idea_geracoes for all
  using (auth.uid() = user_id or public.is_account_member(user_id) or public.is_account_manager(user_id))
  with check (auth.uid() = user_id or public.is_account_member(user_id) or public.is_account_manager(user_id));
