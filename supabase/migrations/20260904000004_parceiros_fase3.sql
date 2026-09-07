-- Cria Parceiros, fase 3 (04/09/2026): fecha o fluxo ponta a ponta.
--
-- 1) ENTREGA COM ARQUIVO. O parceiro não enxerga posts nem external_media_refs
--    (RLS restritiva do dono), então entregava só por link. Agora ele sobe o
--    arquivo no bucket media (na pasta dele, que a policy permite) e registra
--    o anexo NO POST DO DONO via RPC security definer, que valida o card.
-- 2) AVISOS. A UI prometia "o parceiro é avisado na hora" e nada existia.
--    Trigger em posts: nova demanda, ajuste pedido, prazo confirmado -> parceiro;
--    entregue, prazo sugerido -> social mídia. Comentário -> o outro lado.
-- 3) CACHÊ. posts.cache_parceiro (valor combinado). Ao marcar ENTREGUE, nasce
--    uma despesa no Caixa da agência (fin_records) ligada ao post, ao parceiro
--    e ao cliente, categoria pelo papel. Uma por post (não duplica).
-- 4) RPC parceiro_meus_caches(): quanto cada agência deve/pagou ao parceiro.

-- ── Colunas ────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists cache_parceiro numeric(12,2);

alter table public.fin_records
  add column if not exists post_id uuid references public.posts(id) on delete set null,
  add column if not exists assignee_id uuid references auth.users(id) on delete set null;
create index if not exists idx_fin_records_assignee on public.fin_records (assignee_id) where assignee_id is not null;
create unique index if not exists idx_fin_records_cache_por_post on public.fin_records (post_id) where post_id is not null;

-- ── 1) Anexo de entrega pelo parceiro ──────────────────────────────────────
create or replace function public.parceiro_anexar_entrega(
  _post_id uuid, _view_url text, _file_name text, _file_type text default null,
  _file_size bigint default null, _thumbnail_url text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _dono uuid; _pos int; _id uuid;
begin
  if not public.parceiro_tem_o_card(_post_id) then raise exception 'sem_acesso'; end if;
  if _view_url is null or _view_url !~ '^https?://' then raise exception 'url_invalida'; end if;
  select p.user_id into _dono from public.posts p where p.id = _post_id;
  select coalesce(max(m.position), -1) + 1 into _pos from public.external_media_refs m where m.post_id = _post_id;
  insert into public.external_media_refs (user_id, post_id, provider, external_file_id, file_name, file_type, file_size, thumbnail_url, view_url, download_url, position)
  values (_dono, _post_id, 'storage', _view_url, coalesce(_file_name, 'entrega'), _file_type, _file_size, coalesce(_thumbnail_url, _view_url), _view_url, _view_url, _pos)
  returning id into _id;
  -- Fica registrado na conversa também (o histórico do card é a thread).
  insert into public.post_approval_comments (post_id, author_id, author_role, content)
  values (_post_id, auth.uid(), 'parceiro', 'Entrega (arquivo): ' || coalesce(_file_name, _view_url));
  return _id;
end; $$;
revoke all on function public.parceiro_anexar_entrega(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.parceiro_anexar_entrega(uuid, text, text, text, bigint, text) to authenticated;

-- ── 2) Avisos do fluxo (posts) ──────────────────────────────────────────────
create or replace function public.notify_parceiro_fluxo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _ator uuid := auth.uid();
  _agencia text; _parceiro text; _titulo text; _prazo text; _motivo text;
begin
  if new.assignee_id is null and old.assignee_id is null then return new; end if;
  _titulo := coalesce(new.title, 'post');
  _prazo := case when new.prazo_producao is not null then to_char(new.prazo_producao, 'DD/MM') else null end;

  -- a) Nova demanda (ou trocou de parceiro) -> parceiro
  if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
    select coalesce(nullif(pr.name, ''), 'Uma agência') into _agencia
    from public.profiles pr where pr.id = new.user_id;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_nova',
            '🎬 Nova demanda: ' || _titulo,
            _agencia || (case when _prazo is not null then ' pediu pra ' || _prazo else ' ainda vai combinar o prazo' end)
              || (case when new.cache_parceiro is not null then ' · R$ ' || replace(to_char(new.cache_parceiro, 'FM999999990.00'), '.', ',') else '' end) || '.',
            '/socialmidia/demandas');
  end if;

  -- b) Ajuste pedido -> parceiro (com o motivo, que é o último comentário da social mídia)
  if new.producao_status = 'ajuste' and old.producao_status is distinct from 'ajuste' and new.assignee_id is not null then
    select c.content into _motivo from public.post_approval_comments c
    where c.post_id = new.id and c.author_role = 'social_media' order by c.created_at desc limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_ajuste', '🔁 Ajuste pedido: ' || _titulo,
            coalesce('"' || left(regexp_replace(_motivo, '^Ajuste:\s*', ''), 180) || '"', 'Abra o card pra ver o que mudar.'),
            '/socialmidia/demandas');
  end if;

  -- c) Prazo confirmado pela social mídia -> parceiro
  if new.prazo_status = 'aceito' and old.prazo_status is distinct from 'aceito'
     and new.assignee_id is not null and (_ator is null or _ator <> new.assignee_id) then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_prazo', '📅 Prazo confirmado: ' || _titulo,
            coalesce('Entrega combinada pra ' || _prazo || '.', 'Prazo fechado.'), '/socialmidia/demandas');
  end if;

  -- d) Parceiro entregou -> social mídia (dona do post)
  if new.producao_status = 'entregue' and old.producao_status is distinct from 'entregue' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_entregue', '✅ ' || coalesce(_parceiro, 'Parceiro') || ' entregou: ' || _titulo,
            'Revise e aprove, ou peça ajuste.', '/socialmidia/criapost/parceiros');
  end if;

  -- e) Parceiro sugeriu outro prazo -> social mídia
  if new.prazo_status = 'negociando' and old.prazo_status is distinct from 'negociando' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_prazo', '📅 ' || coalesce(_parceiro, 'Parceiro') || ' sugeriu outro prazo: ' || _titulo,
            coalesce('Propôs ' || to_char(new.prazo_sugerido, 'DD/MM') || '. Aceite ou responda.', 'Veja a proposta no painel Com parceiros.'),
            '/socialmidia/criapost/parceiros');
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_fluxo on public.posts;
create trigger trg_parceiro_fluxo after update on public.posts
  for each row execute function public.notify_parceiro_fluxo();

-- ── 2b) Comentários entre social mídia e parceiro ──────────────────────────
create or replace function public.notify_parceiro_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare _dono uuid; _assignee uuid; _titulo text; _parceiro text;
begin
  if new.author_role not in ('parceiro', 'social_media') then return new; end if;
  -- Entregas e ajustes já geram aviso próprio pelo trigger de posts.
  if new.content like 'Entrega%' or new.content like 'Ajuste:%' or new.content like 'Prazo%' then return new; end if;
  select p.user_id, p.assignee_id, p.title into _dono, _assignee, _titulo from public.posts p where p.id = new.post_id;
  if _assignee is null then return new; end if;
  if new.author_role = 'parceiro' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = _assignee and m.manager_id = _dono limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_dono, 'demanda_comentario', '💬 ' || coalesce(_parceiro, 'Parceiro') || ' comentou: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', '/socialmidia/criapost/parceiros');
  else
    insert into public.notifications (user_id, type, title, description, link)
    values (_assignee, 'demanda_comentario', '💬 Comentário no card: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', '/socialmidia/demandas');
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_comentario on public.post_approval_comments;
create trigger trg_parceiro_comentario after insert on public.post_approval_comments
  for each row execute function public.notify_parceiro_comentario();

-- ── 3) Cachê vira despesa no Caixa ao entregar ─────────────────────────────
create or replace function public.lancar_cache_parceiro()
returns trigger language plpgsql security definer set search_path = public as $$
declare _papel text; _nome text; _crm uuid; _cat text;
begin
  if new.producao_status <> 'entregue' or old.producao_status is not distinct from 'entregue' then return new; end if;
  if new.assignee_id is null or new.cache_parceiro is null or new.cache_parceiro <= 0 then return new; end if;
  if exists (select 1 from public.fin_records f where f.post_id = new.id) then return new; end if;
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
  -- Cachê não pode travar a entrega. Fica no log do banco.
  raise warning 'lancar_cache_parceiro falhou: %', sqlerrm;
  return new;
end; $$;

drop trigger if exists trg_lancar_cache_parceiro on public.posts;
create trigger trg_lancar_cache_parceiro after update on public.posts
  for each row execute function public.lancar_cache_parceiro();

-- ── 4) O parceiro vê o que cada agência deve/pagou ─────────────────────────
create or replace function public.parceiro_meus_caches()
returns table (manager_id uuid, agencia text, pendente numeric, pago numeric, pendente_qtd int, ultimo_pago date)
language sql stable security definer set search_path = public as $$
  select f.manager_id,
         coalesce(nullif(pr.name, ''), 'Agência') as agencia,
         coalesce(sum(f.amount) filter (where f.status in ('pendente', 'atrasado')), 0) as pendente,
         coalesce(sum(f.amount) filter (where f.status = 'pago'), 0) as pago,
         count(*) filter (where f.status in ('pendente', 'atrasado'))::int as pendente_qtd,
         max(f.date) filter (where f.status = 'pago') as ultimo_pago
  from public.fin_records f
  join public.profiles pr on pr.id = f.manager_id
  where f.assignee_id = auth.uid()
  group by f.manager_id, pr.name
  order by pendente desc, agencia;
$$;
revoke all on function public.parceiro_meus_caches() from public, anon;
grant execute on function public.parceiro_meus_caches() to authenticated;

-- ── Preferências: tipos novos na categoria "clientes" ──────────────────────
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
    else 'avisos' end
$$;
