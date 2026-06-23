-- Logs do app: captura automática de erros pro admin acompanhar (sem depender do usuário reportar).

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  level text not null default 'error',     -- error | warn | info
  message text not null,
  context jsonb,
  url text,
  created_at timestamptz not null default now()
);

alter table public.app_logs enable row level security;

-- Só admin lê os logs.
drop policy if exists "Admins read app_logs" on public.app_logs;
create policy "Admins read app_logs" on public.app_logs
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists idx_app_logs_created on public.app_logs (created_at desc);

-- Registro via RPC (funciona logado ou anônimo). Limita tamanho da mensagem.
create or replace function public.log_app_error(_message text, _context jsonb default null, _url text default null, _level text default 'error')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_logs (user_id, level, message, context, url)
  values (auth.uid(), coalesce(_level, 'error'), left(coalesce(_message, ''), 2000), _context, _url);
end; $$;

grant execute on function public.log_app_error(text, jsonb, text, text) to anon, authenticated;
