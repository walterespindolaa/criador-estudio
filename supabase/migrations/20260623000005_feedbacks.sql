-- Feedback dos usuários: bug / ideia / outro → cai no admin.

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text not null default 'ideia',     -- bug | ideia | outro
  message text not null,
  status text not null default 'novo',     -- novo | visto | resolvido
  url text,
  created_at timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

-- Usuário logado cria o próprio feedback.
drop policy if exists "Users create feedback" on public.feedbacks;
create policy "Users create feedback" on public.feedbacks
  for insert with check (auth.uid() = user_id);

-- Admin lê e atualiza (mudar status).
drop policy if exists "Admins read feedback" on public.feedbacks;
create policy "Admins read feedback" on public.feedbacks
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins update feedback" on public.feedbacks;
create policy "Admins update feedback" on public.feedbacks
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists idx_feedbacks_created on public.feedbacks (created_at desc);
