-- Walter, 26/11/2026: medir se os e-mails trazem gente de volta. Antes só
-- havia o token de descadastro, e não dava pra saber se algum e-mail funcionava.
-- O botão do e-mail leva ?de=email_<etiqueta>; o app, já com a pessoa logada,
-- grava aqui. Robô de antivírus que abre o link não está logado, então não conta.
create table if not exists public.email_voltas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  etiqueta text not null check (length(etiqueta) between 1 and 80),
  em timestamptz not null default now()
);
create index if not exists email_voltas_etiqueta_em on public.email_voltas (etiqueta, em);
alter table public.email_voltas enable row level security;
-- Sem policy: só o service role lê. Quem grava é a função abaixo.

create or replace function public.registrar_volta_email(_etiqueta text)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or _etiqueta !~ '^[a-z0-9_]{1,80}$' then return; end if;
  -- Uma por pessoa, etiqueta e dia (recarregar a página não conta de novo).
  if exists (select 1 from public.email_voltas
              where user_id = auth.uid() and etiqueta = _etiqueta and em > now() - interval '1 day') then
    return;
  end if;
  insert into public.email_voltas (user_id, etiqueta) values (auth.uid(), _etiqueta);
end;
$$;
revoke all on function public.registrar_volta_email(text) from public, anon;
grant execute on function public.registrar_volta_email(text) to authenticated;
