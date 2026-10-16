-- ═══════════════════════════════════════════════════════════════════════════
-- CRONOGRAMA: DATAS PRO RESUMO (Gabriela/Walter, 16/10/2026) · JÁ APLICADA (registro)
-- Antes o sistema não guardava quando o cronograma foi enviado, quando o
-- cliente abriu o link nem quando respondeu cada item. Agora guarda:
--   cronogramas.primeiro_envio_em / enviado_em / envios
--   cronogramas.visto_em / ultimo_visto_em / visualizacoes
--   cronograma_items.respondido_em
-- Não mexe em RLS nem em posts.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.cronogramas
  add column if not exists primeiro_envio_em timestamptz,
  add column if not exists enviado_em timestamptz,
  add column if not exists envios integer not null default 0,
  add column if not exists visto_em timestamptz,
  add column if not exists ultimo_visto_em timestamptz,
  add column if not exists visualizacoes integer not null default 0;
alter table public.cronograma_items add column if not exists respondido_em timestamptz;

-- Envio: o app manda enviado_em e o banco carimba a hora do servidor e conta o reenvio.
create or replace function public.cronograma_marca_envio() returns trigger
language plpgsql set search_path to 'public' as $f$
begin
  if new.enviado_em is distinct from old.enviado_em and new.enviado_em is not null then
    new.enviado_em := now();
    new.envios := coalesce(old.envios, 0) + 1;
    new.primeiro_envio_em := coalesce(old.primeiro_envio_em, now());
  end if;
  return new;
end $f$;
drop trigger if exists trg_cronograma_marca_envio on public.cronogramas;
create trigger trg_cronograma_marca_envio before update on public.cronogramas
  for each row execute function public.cronograma_marca_envio();
revoke all on function public.cronograma_marca_envio() from public, anon;

-- Resposta do cliente: set_cronograma_item_by_token passa a gravar respondido_em.
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.set_cronograma_item_by_token(text,uuid,text,text)'::regprocedure);
  if position('respondido_em' in _def) = 0 then
    execute replace(_def, 'updated_at = now()',
      'updated_at = now(), respondido_em = case when _status = ''pendente'' then null else now() end');
  end if;
end $d$;

-- Visita do cliente: get_cronograma_by_token conta 1 visita a cada 30 min e
-- ignora a própria agência (dona ou colaboradora abrindo o link pra conferir).
do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.get_cronograma_by_token(text)'::regprocedure);
  if position('visualizacoes' in _def) = 0 then
    execute replace(_def, $x$if not found then return null; end if;$x$, $x$if not found then return null; end if;
  if auth.uid() is null or not (auth.uid() = _c.manager_id or public.acts_for(_c.manager_id)) then
    if _c.ultimo_visto_em is null or _c.ultimo_visto_em < now() - interval '30 minutes' then
      update public.cronogramas set visto_em = coalesce(visto_em, now()), ultimo_visto_em = now(),
             visualizacoes = visualizacoes + 1 where id = _c.id;
    end if;
  end if;$x$);
  end if;
end $d$;
