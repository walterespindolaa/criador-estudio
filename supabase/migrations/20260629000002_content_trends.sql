-- Banco de tendências: curadoria gerada pela IA (admin atualiza), todos os usuários leem.
create table if not exists public.content_trends (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- formato | tema | gancho | data
  title text not null,
  description text,
  niche text default 'geral',
  created_by uuid,
  created_at timestamptz default now()
);

create index if not exists idx_content_trends_created on public.content_trends (created_at desc);

alter table public.content_trends enable row level security;

-- Qualquer usuário autenticado pode LER o banco.
drop policy if exists "trends_read" on public.content_trends;
create policy "trends_read" on public.content_trends
  for select to authenticated using (true);

-- Sem policies de insert/update/delete: só o service_role (edge function) escreve.
