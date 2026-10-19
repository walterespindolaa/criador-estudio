-- RELATÓRIO GERENCIAL: REGISTRO DE AJUSTES (Walter, 19/10/2026; mockup aprovado)
--
-- O post só guarda o estado ATUAL de cada etapa: um ajuste de legenda que
-- depois foi aprovado vira só "aprovado". Pra contar o que os clientes mais
-- pedem pra ajustar, cada pedido passa a virar uma linha em post_ajustes.
--   · registro: trigger AFTER UPDATE em posts (não mexe em RLS de posts).
--   · backfill de outubro/2026: etapas hoje em ajuste_solicitado e comentários
--     do cliente pelo link (sem inventar etapa: mídia se o comentário foi em
--     cima da imagem, senão "geral").
-- relatorio_operacao(_owner,_de,_ate) entrega tudo que a página nova mostra.

create table if not exists public.post_ajustes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null, -- sem FK: a lixeira apaga post de vez e não pode travar
  owner_id uuid not null,
  external_client_id uuid,
  etapa text not null check (etapa in ('tema','conteudo','midia','legenda','geral')),
  origem text not null default 'registro' check (origem in ('registro','backfill_etapa','backfill_comentario')),
  comentario_id uuid,
  criado_em timestamptz not null default now()
);
create index if not exists post_ajustes_owner_em on public.post_ajustes (owner_id, criado_em);
create index if not exists post_ajustes_post on public.post_ajustes (post_id);
create unique index if not exists post_ajustes_comentario_uniq on public.post_ajustes (comentario_id) where comentario_id is not null;

alter table public.post_ajustes enable row level security;
create policy "post_ajustes leitura da conta"
  on public.post_ajustes for select to authenticated
  using (owner_id = auth.uid() or public.is_team_member(owner_id));
-- Escrita só pelo trigger (security definer); nenhuma policy de insert/update.

create or replace function public.registrar_ajuste_post()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _owner uuid := coalesce(new.agencia_id, new.user_id);
  _k text;
  _n int := 0;
begin
  if new.external_client_id is null and new.agencia_id is null then
    return new;
  end if;
  if jsonb_typeof(new.approval_stages) = 'object' then
    for _k in select jsonb_object_keys(new.approval_stages) loop
      if new.approval_stages->>_k = 'ajuste_solicitado'
         and (old.approval_stages is null or jsonb_typeof(old.approval_stages) <> 'object'
              or (old.approval_stages->>_k) is distinct from 'ajuste_solicitado')
         and _k in ('tema','conteudo','midia','legenda') then
        insert into public.post_ajustes (post_id, owner_id, external_client_id, etapa)
        values (new.id, _owner, new.external_client_id, _k);
        _n := _n + 1;
      end if;
    end loop;
  end if;
  -- Modo rápido (sem etapas): o pedido vale pro post inteiro.
  -- Se alguma etapa já está em ajuste, o pedido foi registrado por etapa
  -- (pode chegar num UPDATE separado do status): não duplica como "geral".
  if _n = 0 and new.approval_status = 'ajuste_solicitado'
     and old.approval_status is distinct from 'ajuste_solicitado'
     and not (jsonb_typeof(new.approval_stages) = 'object'
              and exists (select 1 from jsonb_each_text(new.approval_stages) s where s.value = 'ajuste_solicitado')) then
    insert into public.post_ajustes (post_id, owner_id, external_client_id, etapa)
    values (new.id, _owner, new.external_client_id, 'geral');
  end if;
  return new;
end; $function$;

create or replace trigger trg_registrar_ajuste_post
  after update of approval_stages, approval_status on public.posts
  for each row execute function public.registrar_ajuste_post();

-- Backfill outubro/2026 (roda uma vez; o índice único evita repetir comentário).
insert into public.post_ajustes (post_id, owner_id, external_client_id, etapa, origem, criado_em)
select p.id, coalesce(p.agencia_id, p.user_id), p.external_client_id, e.key, 'backfill_etapa',
       coalesce(p.approval_updated_at, p.updated_at)
  from public.posts p
  cross join lateral jsonb_each_text(case when jsonb_typeof(p.approval_stages) = 'object' then p.approval_stages else '{}'::jsonb end) e
 where (p.external_client_id is not null or p.agencia_id is not null)
   and p.deleted_at is null
   and e.value = 'ajuste_solicitado'
   and e.key in ('tema','conteudo','midia','legenda')
   and coalesce(p.approval_updated_at, p.updated_at) >= '2026-10-01'
   and not exists (select 1 from public.post_ajustes a where a.post_id = p.id and a.origem = 'backfill_etapa' and a.etapa = e.key);

insert into public.post_ajustes (post_id, owner_id, external_client_id, etapa, origem, comentario_id, criado_em)
select p.id, coalesce(p.agencia_id, p.user_id), p.external_client_id,
       case when c.midia_indice is not null then 'midia' else 'geral' end,
       'backfill_comentario', c.id, c.created_at
  from public.post_approval_comments c
  join public.posts p on p.id = c.post_id
 where c.author_role = 'cliente_externo'
   and c.created_at >= '2026-10-01'
   and p.deleted_at is null
   and (p.external_client_id is not null or p.agencia_id is not null)
   and not exists (select 1 from public.post_ajustes a where a.post_id = p.id and a.origem = 'backfill_etapa')
on conflict do nothing;

create or replace function public.relatorio_operacao(_owner uuid, _de date, _ate date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  _r jsonb;
begin
  if auth.uid() is null or not (_owner = auth.uid() or public.is_team_member(_owner)) then
    raise exception 'sem acesso a esta conta' using errcode = '42501';
  end if;

  with
  posts_p as (
    select p.id, p.external_client_id, p.approval_status, p.approval_updated_at
      from public.posts p
     where p.user_id = _owner and p.external_client_id is not null
       and p.deleted_at is null and coalesce(p.is_draft, false) = false
       and p.scheduled_date between _de and _ate
  ),
  aj as (
    select a.* from public.post_ajustes a
     where a.owner_id = _owner
       and (a.criado_em at time zone 'America/Sao_Paulo')::date between _de and _ate
       and exists (select 1 from public.posts p where p.id = a.post_id and p.deleted_at is null)
  ),
  cli as (select id, name, color from public.external_clients where manager_id = _owner),
  parc as (
    select p.id, p.title, p.assignee_id, p.external_client_id, p.prazo_producao, p.entregue_em,
           p.producao_status, coalesce(p.revisoes, 0) revisoes, p.assigned_at
      from public.posts p
     where coalesce(p.agencia_id, p.user_id) = _owner and p.assignee_id is not null and p.deleted_at is null
       and (
         (p.assigned_at at time zone 'America/Sao_Paulo')::date between _de and _ate
         or (p.entregue_em at time zone 'America/Sao_Paulo')::date between _de and _ate
       )
  ),
  enviados as (
    select * from posts_p where approval_status in ('pendente','aprovado','ajuste_solicitado','postado')
  )
  select jsonb_build_object(
    'posts_total', (select count(*) from posts_p),
    'posts_publicados', (select count(*) from posts_p where approval_status = 'postado'),
    'posts_por_cliente', coalesce((
      select jsonb_agg(jsonb_build_object('cliente_id', x.external_client_id, 'nome', c.name, 'cor', c.color, 'total', x.n) order by x.n desc)
        from (select external_client_id, count(*) n from posts_p group by 1) x
        left join cli c on c.id = x.external_client_id), '[]'::jsonb),
    'ajustes_total', (select count(*) from aj),
    'ajustes_por_etapa', coalesce((
      select jsonb_object_agg(etapa, n) from (select etapa, count(*) n from aj group by 1) x), '{}'::jsonb),
    'ajustes_por_cliente', coalesce((
      select jsonb_agg(jsonb_build_object('cliente_id', x.external_client_id, 'nome', c.name, 'cor', c.color,
               'total', x.n, 'etapas', x.etapas) order by x.n desc)
        from (select external_client_id, sum(k) n, jsonb_object_agg(etapa, k) etapas
                from (select external_client_id, etapa, count(*) k from aj group by 1, 2) y
               group by 1) x
        left join cli c on c.id = x.external_client_id), '[]'::jsonb),
    -- Rodada = um pedido do cliente (várias etapas no mesmo minuto contam uma vez).
    'rodadas', (select count(distinct (post_id, date_trunc('minute', criado_em))) from aj),
    'posts_enviados', (select count(*) from enviados),
    -- "De primeira" só vale pra decisão tomada depois que o registro existe
    -- (outubro/2026 em diante); antes disso todo post pareceria de primeira.
    'aprovados_total', (select count(*) from enviados
        where approval_status in ('aprovado','postado') and approval_updated_at >= '2026-10-01'),
    'aprovados_de_primeira', (select count(*) from enviados e
        where e.approval_status in ('aprovado','postado') and e.approval_updated_at >= '2026-10-01'
          and not exists (select 1 from public.post_ajustes a where a.post_id = e.id)),
    'ultimos_pedidos', coalesce((
      select jsonb_agg(q.z order by q.z->>'em' desc) from (
        select jsonb_build_object('texto', left(c.content, 220), 'em', c.created_at,
                 'cliente', ec.name,
                 'etapa', coalesce(
                    case when c.midia_indice is not null then 'midia' end,
                    (select a.etapa from public.post_ajustes a
                      where a.post_id = c.post_id and a.etapa <> 'geral'
                        and a.criado_em between c.created_at - interval '10 minutes' and c.created_at + interval '10 minutes'
                      order by abs(extract(epoch from a.criado_em - c.created_at)) limit 1),
                    'geral')) z
          from public.post_approval_comments c
          join public.posts p on p.id = c.post_id
          left join cli ec on ec.id = p.external_client_id
         where c.author_role = 'cliente_externo'
           and coalesce(p.agencia_id, p.user_id) = _owner and p.deleted_at is null
           and (c.created_at at time zone 'America/Sao_Paulo')::date between _de and _ate
         order by c.created_at desc
         limit 3) q), '[]'::jsonb),
    'parceiros', coalesce((
      select jsonb_agg(jsonb_build_object(
               'parceiro_id', g.assignee_id,
               'nome', coalesce(mm.name, pr.name, 'Parceiro'),
               'papel', mm.role,
               'pecas', g.pecas, 'entregues', g.entregues, 'no_prazo', g.no_prazo,
               'com_prazo', g.com_prazo, 'refacoes', g.refacoes, 'itens', g.itens) order by g.pecas desc)
        from (
          select assignee_id, count(*) pecas,
                 count(*) filter (where entregue_em is not null) entregues,
                 count(*) filter (where entregue_em is not null and prazo_producao is not null
                                    and (entregue_em at time zone 'America/Sao_Paulo')::date <= prazo_producao) no_prazo,
                 count(*) filter (where entregue_em is not null and prazo_producao is not null) com_prazo,
                 sum(revisoes) refacoes,
                 jsonb_agg(jsonb_build_object('post_id', pa.id, 'titulo', pa.title, 'cliente', c2.name,
                   'prazo', pa.prazo_producao, 'entregue_em', pa.entregue_em, 'status', pa.producao_status,
                   'revisoes', pa.revisoes) order by pa.assigned_at desc) itens
            from parc pa left join cli c2 on c2.id = pa.external_client_id
           group by assignee_id) g
        left join public.manager_members mm on mm.manager_id = _owner and mm.member_id = g.assignee_id
        left join public.profiles pr on pr.id = g.assignee_id), '[]'::jsonb),
    'ajustes_desde', (select min(criado_em) from public.post_ajustes where owner_id = _owner)
  ) into _r;
  return _r;
end; $function$;

grant execute on function public.relatorio_operacao(uuid, date, date) to authenticated;
