/* DESTAQUE DO CRIAKUT NO PIX (Walter, 30/10/2026): 3 meses por R$ 39,90, à
   vista. A conta Stripe brasileira não faz Pix recorrente, então o Pix é um
   pagamento avulso que soma 90 dias em `pix_ate`. O cartão continua sendo a
   assinatura mensal (`status`). Destaque vale se QUALQUER um dos dois vale.
   3 dias antes de acabar o Pix, o robô avisa; no dia, o selo some sozinho. */

alter table public.criakut_destaques add column if not exists pix_ate timestamptz;
-- Sessão do Stripe que já somou os 90 dias: o webhook pode chegar repetido.
alter table public.criakut_destaques add column if not exists pix_ultima_sessao text;

create or replace function public.criakut_eh_destaque(_u uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from criakut_destaques d where d.user_id = _u
    and (d.status in ('active','trialing') or d.pix_ate > now()));
$$;

create or replace function public.criakut_destaques_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select d.user_id from criakut_destaques d join criakut_perfis p on p.user_id = d.user_id and p.publicado
  where (d.status in ('active','trialing') or d.pix_ate > now()) and public.criakut_tem_acesso();
$$;

create or replace function public.criakut_meu_destaque()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare _eu uuid := auth.uid(); _d criakut_destaques; _p criakut_perfis; _ligado boolean; _cartao boolean; _pix boolean;
begin
  if _eu is null then return null; end if;
  select * into _p from criakut_perfis where user_id = _eu;
  select * into _d from criakut_destaques where user_id = _eu;
  _ligado := coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'destaque_ativo'), false);
  _cartao := coalesce(_d.status in ('active','trialing'), false);
  _pix := coalesce(_d.pix_ate > now(), false);
  return jsonb_build_object(
    'ativo', _cartao or _pix,
    'via', case when _cartao then 'cartao' when _pix then 'pix' end,
    'status', _d.status,
    'ate', case when _cartao then _d.ate else _d.pix_ate end,
    'pix_ate', _d.pix_ate,
    'desde', _d.criado_em,
    'a_venda', _ligado,
    'pode_comprar', _ligado and _p.user_id is not null and _p.publicado and _p.funcao <> 'criadora',
    'motivo', case when not _ligado then 'desligado' when _p.user_id is null then 'sem_pagina'
                   when not _p.publicado then 'escondida' when _p.funcao = 'criadora' then 'criadora' else null end,
    'visitas_30d', (select count(distinct visitante_id) from criakut_visitas where visitado_id = _eu and dia > current_date - 30),
    'pedidos_30d', (select count(*) from criakut_propostas where contratado_id = _eu and criado_em > now() - interval '30 days'));
end $$;

/* Aviso do Pix vencendo (3 dias antes) e vencido (no dia). Roda 1x por dia. */
create or replace function public.criakut_avisar_pix_destaque()
returns int language plpgsql security definer set search_path to 'public' as $$
declare _n int := 0; _r record;
begin
  for _r in select d.user_id, d.pix_ate from criakut_destaques d
            where d.pix_ate is not null and coalesce(d.status, '') not in ('active','trialing')
              and (d.pix_ate::date = current_date + 3 or d.pix_ate::date = current_date) loop
    insert into notifications (user_id, type, title, description, link)
    values (_r.user_id, 'criakut_destaque_pix',
      case when _r.pix_ate::date = current_date then 'Seu Destaque no Criakut acaba hoje' else 'Seu Destaque no Criakut acaba em 3 dias' end,
      'Renove mais 3 meses no Pix por R$ 39,90 ou passe pro cartão (R$ 14,90 por mês, renova sozinho).',
      public.criakut_base(_r.user_id));
    _n := _n + 1;
  end loop;
  return _n;
end $$;
revoke execute on function public.criakut_avisar_pix_destaque() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('criakut-destaque-pix-aviso');
exception when others then null; end $$;
select cron.schedule('criakut-destaque-pix-aviso', '17 12 * * *', $$select public.criakut_avisar_pix_destaque()$$);
