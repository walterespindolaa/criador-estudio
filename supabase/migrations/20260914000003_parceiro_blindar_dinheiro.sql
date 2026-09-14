-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 2: BLINDAR O DINHEIRO DO PARCEIRO (14/09/2026)
--
-- Três furos que só aparecem quando alguém vai cobrar:
--
--   1. A DATA DE ENTREGA ERA `updated_at`. Toda edição da agência no post
--      reescrevia a data que o parceiro usa pra cobrar. Ele entregou dia 3, a
--      agência mexeu no título dia 20, e a tela dele passa a dizer dia 20.
--   2. O CACHÊ SUMIA EM SILÊNCIO. O gatilho tinha `exception when others ->
--      raise warning`: se o insert falhasse, a entrega passava e ninguém ficava
--      sabendo. Só o log do banco, que ninguém lê.
--   3. CORRIGIR O VALOR DEPOIS DA ENTREGA NÃO FAZIA NADA. O gatilho sai cedo se
--      já existe linha, e não havia update em lugar nenhum. A agência ajustava
--      o combinado e o Caixa continuava com o valor velho.
--
-- E uma omissão: entregar peça sem cachê definido não avisava ninguém. A peça
-- ficava entregue e invisível no financeiro dos dois lados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) A data de entrega vira coluna, gravada uma vez ─────────────────────
alter table public.posts add column if not exists entregue_em timestamptz;

comment on column public.posts.entregue_em is
  'Quando o parceiro marcou a peça como entregue. Só a mudança de status escreve aqui, nunca uma edição do post: é a data que ele usa pra cobrar.';

-- Backfill do que já existe: melhor aproximação disponível é o updated_at.
update public.posts
set entregue_em = updated_at
where producao_status = 'entregue' and entregue_em is null;

/* BEFORE update, e não AFTER: em AFTER o NEW já foi gravado, então mexer nele
   não persiste.

   Só a MUDANÇA de status escreve a data. Editar título, legenda, cliente ou
   qualquer outra coisa não encosta nela: era esse o furo.

   Se a peça volta pra ajuste e é entregue de novo, a data passa a ser a da nova
   entrega, porque é essa que vale: é a versão que está na mão da agência. */
create or replace function public.carimbar_entregue_em()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.producao_status = 'entregue'
     and old.producao_status is distinct from 'entregue' then
    new.entregue_em := now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_carimbar_entregue_em on public.posts;
create trigger trg_carimbar_entregue_em before update on public.posts
  for each row execute function public.carimbar_entregue_em();

-- ── 2) O cachê passa a falar ──────────────────────────────────────────────
/* Três caminhos numa função só:
   a) entregou com cachê e ainda não tem linha  -> cria a despesa
   b) mudou o valor e a linha existe e NÃO foi paga -> corrige a despesa
   c) entregou sem cachê -> avisa a agência, em vez de sumir

   O `exception` continua existindo (cachê não pode travar entrega), mas agora
   vira NOTIFICAÇÃO pra dona do post, não linha de log. */
create or replace function public.lancar_cache_parceiro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _papel text; _nome text; _crm uuid; _cat text; _fin record;
begin
  -- (b) Correção de valor: vale a qualquer momento, não só na entrega.
  if new.cache_parceiro is distinct from old.cache_parceiro then
    select f.* into _fin from public.fin_records f where f.post_id = new.id limit 1;
    if found and coalesce(_fin.status, 'pendente') <> 'pago' then
      if new.cache_parceiro is null or new.cache_parceiro <= 0 then
        -- Zerou o combinado: a despesa some do Caixa, senão fica fantasma.
        delete from public.fin_records where id = _fin.id;
      else
        update public.fin_records set amount = new.cache_parceiro where id = _fin.id;
      end if;
    end if;
  end if;

  -- coalesce porque producao_status pode ser NULL (post sem parceiro), e em SQL
  -- `NULL <> 'entregue'` não é verdadeiro: sem isto o fluxo escapava do guarda.
  if coalesce(new.producao_status, '') <> 'entregue'
     or coalesce(old.producao_status, '') = 'entregue' then
    return new;
  end if;
  if new.assignee_id is null then return new; end if;

  -- (c) Entregue sem cachê: a agência precisa saber, senão ninguém paga.
  if new.cache_parceiro is null or new.cache_parceiro <= 0 then
    select coalesce(nullif(m.name, ''), 'O parceiro') into _nome
    from public.manager_members m
    where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cache_aviso',
            '💸 Entrega sem cachê combinado: ' || coalesce(new.title, 'post'),
            coalesce(_nome, 'O parceiro') || ' entregou, mas esta peça não tem valor definido. '
              || 'Sem isso ela não entra no Caixa nem no "a receber" dele.',
            '/socialmidia/criapost/parceiros');
    return new;
  end if;

  if exists (select 1 from public.fin_records f where f.post_id = new.id) then return new; end if;

  -- (a) O caminho normal.
  select m.role, coalesce(nullif(m.name, ''), 'Parceiro') into _papel, _nome
  from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
  select ec.crm_client_id into _crm from public.external_clients ec where ec.id = new.external_client_id;
  _cat := case _papel
    when 'designer' then 'Design'
    when 'editor_video' then 'Edição de vídeo'
    when 'copy' then 'Copy'
    when 'trafego' then 'Tráfego pago'
    else 'Freelancer' end;
  insert into public.fin_records (manager_id, crm_client_id, context, type, category, description, amount, date, status, post_id, assignee_id)
  values (new.user_id, _crm, 'pj', 'despesa', _cat,
          'Cachê ' || _nome || ': ' || coalesce(new.title, 'post'),
          new.cache_parceiro, current_date, 'pendente', new.id, new.assignee_id);
  return new;

exception when others then
  /* Cachê não pode travar a entrega, mas também não pode sumir calado. Se nem a
     notificação entrar, aí sim cai no log: é o último recurso. */
  begin
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cache_aviso',
            '💸 Não consegui lançar o cachê: ' || coalesce(new.title, 'post'),
            'A peça foi entregue, mas a despesa não entrou no Caixa. Lance na mão pra não perder o combinado.',
            '/socialmidia/criacaixa/empresa');
  exception when others then
    raise warning 'lancar_cache_parceiro falhou e nem notificou: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_lancar_cache_parceiro on public.posts;
create trigger trg_lancar_cache_parceiro after update on public.posts
  for each row execute function public.lancar_cache_parceiro();

-- ── 3) O aviso de cachê é da categoria "avisos" ───────────────────────────
-- Não é conversa de cliente nem lembrete de agenda: é recado de operação.
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes' when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes' when 'roteiro' then 'clientes' when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes' when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'demanda_nova' then 'clientes' when 'demanda_ajuste' then 'clientes' when 'demanda_prazo' then 'clientes'
    when 'demanda_entregue' then 'clientes' when 'demanda_comentario' then 'clientes'
    when 'resumo_dia' then 'lembretes' when 'lembrete_postar' then 'lembretes' when 'posts_pendentes' then 'lembretes'
    when 'prazo_amanha' then 'lembretes' when 'resumo_semana_ig' then 'lembretes' when 'demanda_prazo_amanha' then 'lembretes'
    when 'story' then 'lembretes' when 'captacao_amanha' then 'lembretes' when 'aniversario_cliente' then 'lembretes'
    when 'meta_batida' then 'conquistas' when 'dica_dia' then 'conquistas' when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas' when 'ideia_criada' then 'conquistas'
    when 'cache_aviso' then 'avisos'
    else 'avisos' end
$$;

-- ── 4) As RPCs do parceiro passam a ler a data certa ──────────────────────
drop function if exists public.parceiro_entregues();
create function public.parceiro_entregues()
returns table (
  post_id uuid, titulo text, formato text, entregue_em timestamptz,
  publica_em date, agencia_id uuid, agencia_nome text,
  cliente_nome text, cliente_cor text, cliente_logo text,
  aprovacao text, cache numeric, external_client_id uuid, capa text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format,
    -- coalesce só pro que existia antes do backfill pegar
    coalesce(p.entregue_em, p.updated_at),
    p.scheduled_date,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    cc.color, cc.logo,
    p.approval_status, p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id
      order by m.position asc nulls last, m.created_at asc
      limit 1)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
  order by coalesce(p.entregue_em, p.updated_at) desc
  limit 200;
$$;
revoke all on function public.parceiro_entregues() from public, anon;
grant execute on function public.parceiro_entregues() to authenticated;

-- drop + create, e não "replace": o banco vivo diverge das migrations, e
-- `create or replace` quebra se as colunas de retorno não baterem exatamente.
drop function if exists public.parceiro_minhas_agencias();
create function public.parceiro_minhas_agencias()
returns table (
  agencia_id uuid,
  agencia_nome text,
  meu_papel text,
  vinculo_status text,
  -- cards na minha mão agora (não entregues)
  abertos integer,
  -- entregues nos últimos 30 dias: o número que vira conversa de cobrança
  entregues_30d integer
)
language sql stable security definer set search_path = public as $$
  select
    m.manager_id,
    coalesce(prof.name, m.email, 'Agência'),
    m.role,
    m.status,
    -- `deleted_at is null` é novo aqui: post na lixeira contava como "na mão
    -- dele" e inflava o número que ele usa pra cobrar.
    (select count(*)::int from public.posts p
      where p.user_id = m.manager_id
        and p.assignee_id = auth.uid()
        and p.deleted_at is null
        and coalesce(p.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p
      where p.user_id = m.manager_id
        and p.assignee_id = auth.uid()
        and p.deleted_at is null
        and p.producao_status = 'entregue'
        and coalesce(p.entregue_em, p.updated_at) >= now() - interval '30 days')
  from public.manager_members m
  left join public.profiles prof on prof.id = m.manager_id
  where m.member_id = auth.uid()
    and m.status = 'ativo'
    and public.eh_papel_parceiro(m.role)
  order by 5 desc, 2;
$$;
revoke all on function public.parceiro_minhas_agencias() from public, anon;
grant execute on function public.parceiro_minhas_agencias() to authenticated;

-- Conferência:
-- select id, producao_status, entregue_em, updated_at from public.posts where producao_status = 'entregue' limit 5;
-- select post_id, titulo, entregue_em from public.parceiro_entregues();
