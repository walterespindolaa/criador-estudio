-- ============================================================
-- TUTORIAIS EM VÍDEO (Walter, 02/10/2026)
--
-- Catálogo dos vídeos tutoriais do Cria e o progresso de cada usuário.
-- Os vídeos ficam na library própria do Bunny (cria-tutoriais): não expiram,
-- não contam na cota de ninguém e não passam pela limpeza de 7 dias.
--
-- Quem escreve no catálogo é só a edge function tutorial-bunny (service role,
-- checando admin). Usuário logado lê os vídeos prontos. A trilha (social
-- mídia, criador, parceiro) é escolhida na tela pelo tipo de conta.
-- Idempotente.
-- ============================================================

-- 1) Catálogo
create table if not exists public.tutoriais (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  publico            text not null check (publico in ('social_midia', 'criador', 'parceiro')),
  modulo             text not null,
  modulo_nome        text not null,
  modulo_ordem       int  not null default 0,
  ordem              int  not null default 0,
  titulo             text not null,
  descricao          text,
  duracao_s          int,
  rota               text,
  bunny_library_id   text,
  bunny_video_id     text,
  bunny_video_pendente text,  -- troca em andamento: o novo espera aqui até ficar pronto
  status             text not null default 'rascunho'
                     check (status in ('rascunho', 'processando', 'pronto', 'oculto')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tutoriais_publico_idx on public.tutoriais (publico, modulo_ordem, ordem);

alter table public.tutoriais enable row level security;

drop policy if exists "tutoriais: logado lê os prontos" on public.tutoriais;
create policy "tutoriais: logado lê os prontos"
  on public.tutoriais for select to authenticated
  using (status = 'pronto');

-- 2) Progresso de cada usuário
create table if not exists public.tutoriais_progresso (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tutorial_id   uuid not null references public.tutoriais (id) on delete cascade,
  segundos      int  not null default 0,
  pct           int  not null default 0 check (pct between 0 and 100),
  visto         boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

alter table public.tutoriais_progresso enable row level security;

drop policy if exists "progresso: lê o seu" on public.tutoriais_progresso;
create policy "progresso: lê o seu"
  on public.tutoriais_progresso for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "progresso: grava o seu" on public.tutoriais_progresso;
create policy "progresso: grava o seu"
  on public.tutoriais_progresso for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "progresso: atualiza o seu" on public.tutoriais_progresso;
create policy "progresso: atualiza o seu"
  on public.tutoriais_progresso for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
