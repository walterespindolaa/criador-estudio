-- F15/F23: log_app_error estava aberto ao anon SEM freio: qualquer um chamando a
-- RPC podia despejar linhas ilimitadas (com nível/URL/context arbitrários) na
-- tabela que é do admin. Endurecemos a função MANTENDO a mesma assinatura (os
-- grants continuam válidos):
--   1. whitelist de _level (só error/warn/info; qualquer outro cai em 'error');
--   2. left(_url, 500) pra não guardar URL gigante;
--   3. guarda de tamanho no _context (pg_column_size): payload grande vira null;
--   4. rate limit por IP/uid reusando a RPC rate_touch (mesmo freio da bio-track).
--
-- A rate_touch é SECURITY DEFINER e só é chamável por service_role; como
-- log_app_error também é SECURITY DEFINER (roda como o dono), a chamada interna
-- funciona sem precisar dar execute de rate_touch pro anon.

create or replace function public.log_app_error(
  _message text,
  _context jsonb default null,
  _url text default null,
  _level text default 'error'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _hdrs   json;
  _ip     text;
  _key    text;
  _lvl    text;
  _ok     boolean;
begin
  -- 1) nível só pode ser um dos três; qualquer outro é normalizado pra 'error'.
  _lvl := lower(coalesce(_level, 'error'));
  if _lvl not in ('error', 'warn', 'info') then
    _lvl := 'error';
  end if;

  -- 4) chave do rate limit: uid quando logado; senão o IP do cabeçalho que o
  -- PostgREST expõe (x-forwarded-for); senão 'anon'.
  begin
    _hdrs := current_setting('request.headers', true)::json;
  exception when others then
    _hdrs := null;
  end;
  _ip := nullif(split_part(coalesce(_hdrs ->> 'x-forwarded-for', ''), ',', 1), '');
  _key := 'log_app_error:' || coalesce(auth.uid()::text, _ip, 'anon');

  -- 60 chamadas/minuto por origem. Estourou: ignora em silêncio (não insere).
  _ok := public.rate_touch(_key, 60);
  if not _ok then
    return;
  end if;

  -- 3) context muito grande é abuso de payload: descarta o context (mantém a linha).
  if _context is not null and pg_column_size(_context) > 8000 then
    _context := null;
  end if;

  -- 2) url limitada a 500 chars; mensagem segue limitada a 2000.
  insert into public.app_logs (user_id, level, message, context, url)
  values (
    auth.uid(),
    _lvl,
    left(coalesce(_message, ''), 2000),
    _context,
    left(_url, 500)
  );
end;
$$;

-- Reforça o grant (assinatura idêntica à original).
grant execute on function public.log_app_error(text, jsonb, text, text) to anon, authenticated;
