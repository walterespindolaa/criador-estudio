/* ═══════════════════════════════════════════════════════════════════════════
   MATERIAIS DELEGADOS PRO PARCEIRO (Gabriela, 29/09/2026: "preciso conseguir
   delegar materiais também pra designer: apresentação, cartão de visita,
   flyer e etc")

   Até aqui a área do parceiro inteira (fila, card, conversa, entrega, cachê
   no Caixa) só conhecia POSTS. Material é outra tabela (client_materials),
   com outro quadro. Em vez de fingir que material é post (ele iria parar no
   calendário de postagem, no link de aprovação e no Instagram), o material
   ganha o MESMO circuito, do lado dele:

     1. colunas de produção em client_materials (parceiro, etapa, prazo,
        cachê, entregas, rodadas de ajuste);
     2. conversa própria (material_comments), só por RPC;
     3. RPCs pro parceiro: listar, abrir, anexar entrega, marcar etapa;
     4. gatilho: avisos (novo, ajuste, entregue) e cachê no Caixa, igual ao
        dos posts;
     5. o extrato de cachês do parceiro passa a dar nome ao material.

   A RLS de client_materials NÃO muda: o parceiro nunca lê a tabela direto,
   só pelas RPCs, que conferem vínculo ativo + ser o responsável.
   Idempotente: pode rodar de novo sem quebrar.
   ═══════════════════════════════════════════════════════════════════════════ */

-- ── 1) Colunas de produção ────────────────────────────────────────────────
alter table public.client_materials
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists producao_status text,
  add column if not exists prazo_producao date,
  add column if not exists cache_parceiro numeric(12,2),
  add column if not exists assigned_at timestamptz,
  add column if not exists entregue_em timestamptz,
  add column if not exists revisoes integer not null default 0,
  -- Arquivos e links que o parceiro entregou, com a rodada de cada um.
  add column if not exists entregas jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.client_materials
    add constraint client_materials_producao_status_chk
    check (producao_status is null or producao_status in ('aguardando', 'em_producao', 'ajuste', 'entregue'));
exception when duplicate_object then null; end $$;

create index if not exists idx_client_materials_assignee
  on public.client_materials (assignee_id) where assignee_id is not null;

-- O cachê do material vira despesa no Caixa, como o do post. Uma por material.
alter table public.fin_records
  add column if not exists material_id uuid references public.client_materials(id) on delete set null;
create unique index if not exists idx_fin_records_cache_por_material
  on public.fin_records (material_id) where material_id is not null;

-- ── 2) Conversa do material ───────────────────────────────────────────────
-- Sem policy nenhuma de propósito: ninguém lê nem escreve direto, só pelas
-- RPCs abaixo, que decidem se quem chama é a agência ou o parceiro.
create table if not exists public.material_comments (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.client_materials(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  author_role  text not null check (author_role in ('social_media', 'parceiro')),
  content      text not null check (char_length(content) between 1 and 4000),
  created_at   timestamptz not null default now()
);
alter table public.material_comments enable row level security;
revoke all on public.material_comments from anon, authenticated;
grant all on public.material_comments to service_role;
create index if not exists idx_material_comments_material
  on public.material_comments (material_id, created_at);

-- ── 3) Quem pode o quê ────────────────────────────────────────────────────
create or replace function public.parceiro_tem_o_material(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.client_materials m
      join public.manager_members mm
        on mm.manager_id = m.manager_id
       and mm.member_id = auth.uid()
       and mm.status = 'ativo'
     where m.id = _id and m.assignee_id = auth.uid()
  )
$$;
revoke all on function public.parceiro_tem_o_material(uuid) from public, anon;
grant execute on function public.parceiro_tem_o_material(uuid) to authenticated;

-- ── 4) A fila de materiais do parceiro ────────────────────────────────────
-- Abertos + entregues nos últimos 30 dias (pra ele ver o que saiu da mão).
drop function if exists public.parceiro_meus_materiais();
create function public.parceiro_meus_materiais()
returns table (
  material_id uuid,
  titulo text,
  tipo text,
  producao_status text,
  prazo_producao date,
  assigned_at timestamptz,
  entregue_em timestamptz,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_cor text,
  cliente_logo text,
  cache numeric,
  revisoes integer
)
language sql stable security definer set search_path = public as $$
  select
    m.id, m.title, m.kind,
    coalesce(m.producao_status, 'aguardando'),
    m.prazo_producao, m.assigned_at, m.entregue_em,
    m.manager_id, coalesce(prof.name, 'Agência'),
    coalesce(nullif(btrim(cc.name), ''), ec.name, 'Cliente'),
    coalesce(cc.color, ec.brand_color),
    coalesce(cc.logo, ec.logo_url),
    m.cache_parceiro,
    coalesce(m.revisoes, 0)
  from public.client_materials m
  join public.manager_members mm
    on mm.manager_id = m.manager_id
   and mm.member_id = auth.uid()
   and mm.status = 'ativo'
  left join public.profiles prof on prof.id = m.manager_id
  left join public.crm_clients cc on cc.id = m.crm_client_id
  left join public.external_clients ec on ec.id = m.external_client_id
  where m.assignee_id = auth.uid()
    and (coalesce(m.producao_status, 'aguardando') <> 'entregue'
         or m.entregue_em > now() - interval '30 days')
  order by m.prazo_producao asc nulls last, m.assigned_at asc;
$$;
revoke all on function public.parceiro_meus_materiais() from public, anon;
grant execute on function public.parceiro_meus_materiais() to authenticated;

-- ── 5) Abrir o material (serve pros DOIS lados) ───────────────────────────
-- Um formato só pra agência e parceiro: a tela é a mesma, muda o `papel`.
create or replace function public.material_abrir(_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _m public.client_materials%rowtype;
  _papel text;
begin
  select * into _m from public.client_materials where id = _id;
  if not found then raise exception 'sem_acesso'; end if;
  if public.acts_for(_m.manager_id) then _papel := 'agencia';
  elsif public.parceiro_tem_o_material(_id) then _papel := 'parceiro';
  else raise exception 'sem_acesso'; end if;

  return jsonb_build_object(
    'id', _m.id,
    'papel', _papel,
    'titulo', _m.title,
    'briefing', _m.description,
    'tipo', _m.kind,
    'status', _m.status,
    'producao_status', coalesce(_m.producao_status, 'aguardando'),
    'prazo_producao', _m.prazo_producao,
    'data_cliente', _m.due_date,
    'cache', _m.cache_parceiro,
    'revisoes', coalesce(_m.revisoes, 0),
    'entregue_em', _m.entregue_em,
    'anexos', coalesce(_m.attachments, '[]'::jsonb),
    'entregas', coalesce(_m.entregas, '[]'::jsonb),
    'assignee_id', _m.assignee_id,
    'parceiro_nome', (select coalesce(nullif(mm.name, ''), 'Parceiro') from public.manager_members mm
                       where mm.manager_id = _m.manager_id and mm.member_id = _m.assignee_id limit 1),
    'agencia_nome', (select coalesce(p.name, 'Agência') from public.profiles p where p.id = _m.manager_id),
    'cliente_nome', coalesce(
        (select nullif(btrim(cc.name), '') from public.crm_clients cc where cc.id = _m.crm_client_id),
        (select ec.name from public.external_clients ec where ec.id = _m.external_client_id),
        'Cliente'),
    'cliente_cor', coalesce(
        (select cc.color from public.crm_clients cc where cc.id = _m.crm_client_id),
        (select ec.brand_color from public.external_clients ec where ec.id = _m.external_client_id)),
    'cliente_logo', coalesce(
        (select cc.logo from public.crm_clients cc where cc.id = _m.crm_client_id),
        (select ec.logo_url from public.external_clients ec where ec.id = _m.external_client_id)),
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'papel', c.author_role, 'texto', c.content, 'em', c.created_at)
             order by c.created_at)
        from public.material_comments c where c.material_id = _id), '[]'::jsonb)
  );
end; $$;
revoke all on function public.material_abrir(uuid) from public, anon;
grant execute on function public.material_abrir(uuid) to authenticated;

-- ── 6) Conversar no material (os dois lados) ──────────────────────────────
create or replace function public.material_comentar(_id uuid, _texto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _m public.client_materials%rowtype;
  _papel text; _t text := btrim(coalesce(_texto, ''));
begin
  if _t = '' then raise exception 'mensagem_vazia'; end if;
  select * into _m from public.client_materials where id = _id;
  if not found then raise exception 'sem_acesso'; end if;
  if public.acts_for(_m.manager_id) then _papel := 'social_media';
  elsif public.parceiro_tem_o_material(_id) then _papel := 'parceiro';
  else raise exception 'sem_acesso'; end if;

  insert into public.material_comments (material_id, author_id, author_role, content)
  values (_id, auth.uid(), _papel, left(_t, 4000));

  -- Avisa o outro lado. Sem parceiro, ninguém do outro lado pra avisar.
  if _papel = 'social_media' and _m.assignee_id is not null then
    insert into public.notifications (user_id, type, title, description, link)
    values (_m.assignee_id, 'demanda_comentario', '💬 Mensagem no material: ' || _m.title,
            left(_t, 140), '/socialmidia/demandas?material=' || _id::text);
  elsif _papel = 'parceiro' then
    insert into public.notifications (user_id, type, title, description, link)
    values (_m.manager_id, 'demanda_comentario', '💬 Mensagem no material: ' || _m.title,
            left(_t, 140),
            case when _m.crm_client_id is not null
                 then '/socialmidia/clientes/' || _m.crm_client_id::text || '/materiais?material=' || _id::text
                 else '/socialmidia/clientes' end);
  end if;
end; $$;
revoke all on function public.material_comentar(uuid, text) from public, anon;
grant execute on function public.material_comentar(uuid, text) to authenticated;

-- ── 7) Parceiro anexa entrega (arquivo que ele subiu, ou link) ────────────
create or replace function public.parceiro_anexar_material(
  _id uuid, _url text, _nome text default null, _tipo text default null, _tamanho bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare _k text;
begin
  if not public.parceiro_tem_o_material(_id) then raise exception 'sem_acesso'; end if;
  if _url is null or btrim(_url) !~* '^https?://' then raise exception 'url_invalida'; end if;
  _k := case when _tipo is null then 'link' else 'file' end;
  update public.client_materials
     set entregas = coalesce(entregas, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'kind', _k,
           'name', coalesce(nullif(btrim(_nome), ''), case when _k = 'link' then 'Link da entrega' else 'arquivo' end),
           'url', btrim(_url),
           'type', _tipo,
           'size', _tamanho,
           'rodada', coalesce(revisoes, 0),
           'em', now()))
   where id = _id;
end; $$;
revoke all on function public.parceiro_anexar_material(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.parceiro_anexar_material(uuid, text, text, text, bigint) to authenticated;

-- Parceiro remove um anexo da rodada ATUAL (subiu errado). Rodadas antigas
-- ficam: são o histórico do que foi entregue e revisado.
create or replace function public.parceiro_remover_anexo_material(_id uuid, _url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.parceiro_tem_o_material(_id) then raise exception 'sem_acesso'; end if;
  update public.client_materials m
     set entregas = coalesce((
           select jsonb_agg(e order by ord)
             from jsonb_array_elements(m.entregas) with ordinality as x(e, ord)
            where not (e->>'url' = _url and coalesce((e->>'rodada')::int, 0) = coalesce(m.revisoes, 0))
         ), '[]'::jsonb)
   where m.id = _id and coalesce(m.producao_status, '') <> 'entregue';
end; $$;
revoke all on function public.parceiro_remover_anexo_material(uuid, text) from public, anon;
grant execute on function public.parceiro_remover_anexo_material(uuid, text) to authenticated;

-- ── 8) Parceiro marca a etapa ─────────────────────────────────────────────
create or replace function public.parceiro_marcar_material(_id uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare _tem_entrega boolean;
begin
  if not public.parceiro_tem_o_material(_id) then raise exception 'sem_acesso'; end if;
  if _status not in ('em_producao', 'entregue') then raise exception 'status_invalido'; end if;
  if _status = 'entregue' then
    -- Entregar sem nada anexado nesta rodada é o "entreguei" que ninguém acha.
    select exists (
      select 1 from public.client_materials m, jsonb_array_elements(m.entregas) e
       where m.id = _id and coalesce((e->>'rodada')::int, 0) = coalesce(m.revisoes, 0)
    ) into _tem_entrega;
    if not _tem_entrega then raise exception 'anexe_a_entrega'; end if;
  end if;
  update public.client_materials set producao_status = _status where id = _id;
end; $$;
revoke all on function public.parceiro_marcar_material(uuid, text) from public, anon;
grant execute on function public.parceiro_marcar_material(uuid, text) to authenticated;

-- ── 9) Gatilhos: carimbos, avisos e cachê ─────────────────────────────────
-- ANTES: carimba datas e conta a rodada, pra ninguém depender da tela.
create or replace function public.material_fluxo_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.assignee_id is distinct from old.assignee_id then
    if new.assignee_id is null then
      new.producao_status := null; new.prazo_producao := null; new.assigned_at := null;
      new.entregue_em := null; new.cache_parceiro := null;
    else
      new.producao_status := 'aguardando';
      new.assigned_at := now();
      new.entregue_em := null;
      -- Delegou o que o cliente pediu: saiu da fila de "Solicitado".
      if new.status = 'solicitado' then new.status := 'a_fazer'; end if;
    end if;
  end if;
  if coalesce(new.producao_status, '') = 'entregue' and coalesce(old.producao_status, '') <> 'entregue' then
    new.entregue_em := now();
  end if;
  if coalesce(new.producao_status, '') = 'ajuste' and coalesce(old.producao_status, '') <> 'ajuste' then
    new.revisoes := coalesce(old.revisoes, 0) + 1;
  end if;
  return new;
end; $$;
drop trigger if exists trg_material_fluxo_antes on public.client_materials;
create trigger trg_material_fluxo_antes
  before update on public.client_materials
  for each row execute function public.material_fluxo_antes();

-- DEPOIS: avisos e cachê. Nunca trava o update: erro vira aviso pra agência.
create or replace function public.material_fluxo_depois()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _link_agencia text; _link_parceiro text; _nome text; _papel text; _cat text; _fin record;
begin
  _link_parceiro := '/socialmidia/demandas?material=' || new.id::text;
  _link_agencia := case when new.crm_client_id is not null
                        then '/socialmidia/clientes/' || new.crm_client_id::text || '/materiais?material=' || new.id::text
                        else '/socialmidia/clientes' end;

  -- a) Novo material pro parceiro (ou trocou de parceiro)
  if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_nova', '📎 Novo material: ' || new.title,
            case when new.prazo_producao is not null
                 then 'Prazo ' || to_char(new.prazo_producao, 'DD/MM') || '. Abra pra ver o briefing.'
                 else 'Abra pra ver o briefing e combinar o prazo.' end,
            _link_parceiro);
  end if;

  -- b) Voltou pra ajuste -> parceiro
  if new.assignee_id is not null and coalesce(new.producao_status, '') = 'ajuste'
     and coalesce(old.producao_status, '') <> 'ajuste' then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_ajuste', '🔁 Ajuste no material: ' || new.title,
            'A social mídia pediu ajuste. O motivo está na conversa.', _link_parceiro);
  end if;

  -- c) Entregue -> agência
  if new.assignee_id is not null and coalesce(new.producao_status, '') = 'entregue'
     and coalesce(old.producao_status, '') <> 'entregue' then
    select coalesce(nullif(m.name, ''), 'O parceiro'), m.role into _nome, _papel
      from public.manager_members m
     where m.member_id = new.assignee_id and m.manager_id = new.manager_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.manager_id, 'demanda_entregue', '✅ Material entregue: ' || new.title,
            coalesce(_nome, 'O parceiro') || ' entregou. Revise e dê o ok ou peça ajuste.', _link_agencia);
  end if;

  -- d) Cachê. Mesmas regras do post (lancar_cache_parceiro):
  --    valor mudou -> corrige a despesa que existe (se não foi paga);
  --    entregou (agora ou antes) com valor e sem despesa -> lança.
  select f.* into _fin from public.fin_records f where f.material_id = new.id limit 1;
  if found then
    if new.cache_parceiro is distinct from old.cache_parceiro and coalesce(_fin.status, 'pendente') <> 'pago' then
      if coalesce(new.cache_parceiro, 0) <= 0 then
        delete from public.fin_records where id = _fin.id;
      else
        update public.fin_records set amount = new.cache_parceiro where id = _fin.id;
      end if;
    end if;
  elsif new.assignee_id is not null
        and coalesce(new.producao_status, '') = 'entregue'
        and coalesce(new.cache_parceiro, 0) > 0
        and (coalesce(old.producao_status, '') <> 'entregue'
             or new.cache_parceiro is distinct from old.cache_parceiro) then
    if _nome is null then
      select coalesce(nullif(m.name, ''), 'Parceiro'), m.role into _nome, _papel
        from public.manager_members m
       where m.member_id = new.assignee_id and m.manager_id = new.manager_id limit 1;
    end if;
    _cat := case _papel
      when 'designer' then 'Design'
      when 'editor_video' then 'Edição de vídeo'
      when 'copy' then 'Copy'
      when 'trafego' then 'Tráfego pago'
      else 'Freelancer' end;
    insert into public.fin_records (manager_id, crm_client_id, context, type, category, description, amount, date, status, material_id, assignee_id)
    values (new.manager_id, new.crm_client_id, 'pj', 'despesa', _cat,
            'Cachê ' || coalesce(_nome, 'Parceiro') || ': ' || new.title,
            new.cache_parceiro, current_date, 'pendente', new.id, new.assignee_id);
  elsif new.assignee_id is not null and coalesce(new.producao_status, '') = 'entregue'
        and coalesce(old.producao_status, '') <> 'entregue' and coalesce(new.cache_parceiro, 0) <= 0 then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.manager_id, 'cache_aviso', '💸 Material entregue sem cachê: ' || new.title,
            'Sem valor definido, ele não entra no Caixa nem no "a receber" do parceiro.', _link_agencia);
  end if;
  return new;

exception when others then
  begin
    insert into public.notifications (user_id, type, title, description, link)
    values (new.manager_id, 'cache_aviso', '⚠️ Material: aviso ou cachê não lançado',
            'O material foi salvo, mas o aviso ou a despesa do cachê falhou. Confira o Caixa.',
            '/socialmidia/criacaixa/empresa');
  exception when others then
    raise warning 'material_fluxo_depois falhou: %', sqlerrm;
  end;
  return new;
end; $$;
drop trigger if exists trg_material_fluxo_depois on public.client_materials;
create trigger trg_material_fluxo_depois
  after update on public.client_materials
  for each row execute function public.material_fluxo_depois();

-- ── 10) Extrato do parceiro dá nome ao cachê de material ──────────────────
-- Corpo de 20260914000002 + o material como alternativa ao post. Mesma
-- assinatura e retorno, então replace basta.
create or replace function public.parceiro_meus_caches_detalhe()
returns table (
  id uuid,
  valor numeric,
  status text,
  data date,
  descricao text,
  post_id uuid,
  post_titulo text,
  cliente_nome text,
  cliente_logo text,
  cliente_cor text,
  agencia_id uuid,
  agencia_nome text
)
language sql
stable
security definer
set search_path = public
as $$
  with vinculo as (
    select m.manager_id
    from public.manager_members m
    where m.member_id = auth.uid() and m.status = 'ativo'
  )
  select
    f.id,
    f.amount,
    coalesce(f.status, 'pendente'),
    f.date,
    case when v.manager_id is null then null else f.description end,
    case when v.manager_id is null then null else f.post_id end,
    case when v.manager_id is null then 'Entrega' else coalesce(p.title, mat.title) end,
    case when v.manager_id is null then 'Cliente'
         else coalesce(nullif(btrim(cc.name), ''), ec.name, nullif(btrim(cc2.name), ''), ec2.name) end,
    case when v.manager_id is null then null else coalesce(cc.logo, ec.logo_url, cc2.logo, ec2.logo_url) end,
    case when v.manager_id is null then null else coalesce(cc.color, ec.brand_color, cc2.color, ec2.brand_color) end,
    f.manager_id,
    coalesce(prof.name, 'Agência')
  from public.fin_records f
  left join vinculo v on v.manager_id = f.manager_id
  left join public.posts p on p.id = f.post_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join public.client_materials mat on mat.id = f.material_id
  left join public.crm_clients cc2 on cc2.id = mat.crm_client_id
  left join public.external_clients ec2 on ec2.id = mat.external_client_id
  left join public.profiles prof on prof.id = f.manager_id
  where f.assignee_id = auth.uid()
  order by f.date desc
  limit 300;
$$;
revoke all on function public.parceiro_meus_caches_detalhe() from public, anon;
grant execute on function public.parceiro_meus_caches_detalhe() to authenticated;

-- Conferência:
-- select * from public.parceiro_meus_materiais();          -- logado como parceiro
-- select public.material_abrir('<id do material>');         -- agência ou parceiro
