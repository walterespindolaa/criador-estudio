-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 3: A NOTIFICAÇÃO LEVA AO LUGAR CERTO (14/09/2026)
--
-- O aviso dizia "a Ágatha entregou: carrossel de setembro" e jogava a pessoa
-- num quadro com dezenas de cards, pra ela caçar na mão o título que acabou de
-- ler. Aviso que não leva a lugar nenhum é ruído, não é aviso.
--
-- Agora todo gatilho de produção grava o link COM a peça:
--   parceiro      -> /socialmidia/demandas?post=<id>
--   social mídia  -> /socialmidia/clientes/<cliente>/posts?post=<id>
--                    (sem cliente, cai no painel "Com parceiros", como antes)
--
-- E "produção" vira categoria própria. Tudo que envolvia parceiro caía em
-- "clientes", junto com aprovação e comentário de cliente: pro designer o
-- painel inteiro era uma categoria só, e pra social mídia o recado do freela se
-- misturava com o recado de quem paga. São duas conversas diferentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Categoria "produção" ───────────────────────────────────────────────
-- Usada pela preferência de push (profiles.notification_prefs). Categoria nova
-- e ausente nas preferências = ligada, então ninguém perde aviso na virada.
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes' when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes' when 'roteiro' then 'clientes' when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes' when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'demanda_nova' then 'producao' when 'demanda_ajuste' then 'producao'
    when 'demanda_prazo' then 'producao' when 'demanda_entregue' then 'producao'
    when 'demanda_comentario' then 'producao' when 'demanda_prazo_amanha' then 'producao'
    when 'demanda_atrasada' then 'producao' when 'cache_aviso' then 'producao'
    when 'resumo_dia' then 'lembretes' when 'lembrete_postar' then 'lembretes' when 'posts_pendentes' then 'lembretes'
    when 'prazo_amanha' then 'lembretes' when 'resumo_semana_ig' then 'lembretes'
    when 'story' then 'lembretes' when 'captacao_amanha' then 'lembretes' when 'aniversario_cliente' then 'lembretes'
    when 'meta_batida' then 'conquistas' when 'dica_dia' then 'conquistas' when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas' when 'ideia_criada' then 'conquistas'
    else 'avisos' end
$$;

-- ── 2) Um lugar só decide o link da peça ──────────────────────────────────
/* Função em vez de concatenar em cinco lugares: quando a rota mudar, muda aqui.
   Lê tabela, então stable (immutable não serve).

   ATENÇÃO AO ID: a rota do cockpit é /socialmidia/clientes/<id do CRM>, e NÃO o
   id do external_clients. Os dois são uuid, então trocar um pelo outro compila,
   passa no build e só falha na cara do usuário: a tela procura um cliente do CRM
   com aquele id, não acha, e ele cai numa página vazia. Era exatamente o que o
   botão do painel "Com parceiros" fazia (achado na revisão de 14/09/2026). */
create or replace function public.link_da_peca(_post_id uuid, _external_client_id uuid, _para_parceiro boolean)
returns text language sql stable set search_path = public as $$
  select case
    when _para_parceiro then '/socialmidia/demandas?post=' || _post_id::text
    else coalesce(
      (select '/socialmidia/clientes/' || ec.crm_client_id::text || '/posts?post=' || _post_id::text
         from public.external_clients ec
        where ec.id = _external_client_id and ec.crm_client_id is not null),
      -- Peça sem cliente (ou cliente sem ficha no CRM) não tem cockpit pra abrir:
      -- o painel geral é o destino honesto, e lá ela aparece na lista.
      '/socialmidia/criapost/parceiros')
  end
$$;

-- ── 3) Os cinco avisos do fluxo, agora com a peça no link ─────────────────
create or replace function public.notify_parceiro_fluxo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _agencia text; _parceiro text; _titulo text; _prazo text; _motivo text;
  _ator uuid := auth.uid();
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
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- b) Ajuste pedido -> parceiro (com o motivo, que é o último comentário dela)
  if new.producao_status = 'ajuste' and old.producao_status is distinct from 'ajuste' and new.assignee_id is not null then
    select c.content into _motivo from public.post_approval_comments c
    where c.post_id = new.id and c.author_role = 'social_media' order by c.created_at desc limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_ajuste', '🔁 Ajuste pedido: ' || _titulo,
            coalesce('"' || left(regexp_replace(_motivo, '^Ajuste:\s*', ''), 180) || '"', 'Abra o card pra ver o que mudar.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- c) Prazo confirmado pela social mídia -> parceiro
  if new.prazo_status = 'aceito' and old.prazo_status is distinct from 'aceito'
     and new.assignee_id is not null and (_ator is null or _ator <> new.assignee_id) then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_prazo', '📅 Prazo confirmado: ' || _titulo,
            coalesce('Entrega combinada pra ' || _prazo || '.', 'Prazo fechado.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- d) Parceiro entregou -> social mídia (dona do post)
  if new.producao_status = 'entregue' and old.producao_status is distinct from 'entregue' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_entregue', '✅ ' || coalesce(_parceiro, 'Parceiro') || ' entregou: ' || _titulo,
            'Revise e aprove, ou peça ajuste.',
            public.link_da_peca(new.id, new.external_client_id, false));
  end if;

  -- e) Parceiro sugeriu outro prazo -> social mídia
  if new.prazo_status = 'negociando' and old.prazo_status is distinct from 'negociando' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_prazo', '📅 ' || coalesce(_parceiro, 'Parceiro') || ' sugeriu outro prazo: ' || _titulo,
            coalesce('Propôs ' || to_char(new.prazo_sugerido, 'DD/MM') || '. Aceite ou responda.', 'Veja a proposta no painel Com parceiros.'),
            -- Aceitar/recusar prazo se faz no painel, não no editor do post.
            '/socialmidia/criapost/parceiros');
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_fluxo on public.posts;
create trigger trg_parceiro_fluxo after update on public.posts
  for each row execute function public.notify_parceiro_fluxo();

-- ── 4) A conversa do card também abre o card ──────────────────────────────
create or replace function public.notify_parceiro_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare _dono uuid; _assignee uuid; _titulo text; _parceiro text; _ec uuid;
begin
  if new.author_role not in ('parceiro', 'social_media') then return new; end if;
  -- Entregas e ajustes já geram aviso próprio pelo trigger de posts.
  if new.content like 'Entrega%' or new.content like 'Ajuste:%' or new.content like 'Prazo%' then return new; end if;
  select p.user_id, p.assignee_id, p.title, p.external_client_id
    into _dono, _assignee, _titulo, _ec
  from public.posts p where p.id = new.post_id;
  if _assignee is null then return new; end if;
  if new.author_role = 'parceiro' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = _assignee and m.manager_id = _dono limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_dono, 'demanda_comentario', '💬 ' || coalesce(_parceiro, 'Parceiro') || ' comentou: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', public.link_da_peca(new.post_id, _ec, false));
  else
    insert into public.notifications (user_id, type, title, description, link)
    values (_assignee, 'demanda_comentario', '💬 Comentário no card: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', public.link_da_peca(new.post_id, _ec, true));
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_comentario on public.post_approval_comments;
create trigger trg_parceiro_comentario after insert on public.post_approval_comments
  for each row execute function public.notify_parceiro_comentario();

-- ── 5) O aviso de cachê sem valor também abre a peça ──────────────────────
-- Mesmo corpo do circuito 2, só trocando o link fixo pela função.
create or replace function public.lancar_cache_parceiro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _papel text; _nome text; _crm uuid; _cat text; _fin record;
begin
  if new.cache_parceiro is distinct from old.cache_parceiro then
    select f.* into _fin from public.fin_records f where f.post_id = new.id limit 1;
    if found and coalesce(_fin.status, 'pendente') <> 'pago' then
      if new.cache_parceiro is null or new.cache_parceiro <= 0 then
        delete from public.fin_records where id = _fin.id;
      else
        update public.fin_records set amount = new.cache_parceiro where id = _fin.id;
      end if;
    end if;
  end if;

  if coalesce(new.producao_status, '') <> 'entregue'
     or coalesce(old.producao_status, '') = 'entregue' then
    return new;
  end if;
  if new.assignee_id is null then return new; end if;

  if new.cache_parceiro is null or new.cache_parceiro <= 0 then
    select coalesce(nullif(m.name, ''), 'O parceiro') into _nome
    from public.manager_members m
    where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cache_aviso',
            '💸 Entrega sem cachê combinado: ' || coalesce(new.title, 'post'),
            coalesce(_nome, 'O parceiro') || ' entregou, mas esta peça não tem valor definido. '
              || 'Sem isso ela não entra no Caixa nem no "a receber" dele.',
            public.link_da_peca(new.id, new.external_client_id, false));
    return new;
  end if;

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

-- Conferência:
-- select type, link from public.notifications where type like 'demanda%' order by created_at desc limit 10;
-- select public.notif_categoria('demanda_entregue'); -- producao
