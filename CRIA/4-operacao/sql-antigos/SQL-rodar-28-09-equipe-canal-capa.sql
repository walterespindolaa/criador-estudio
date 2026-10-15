-- ============================================================
-- EQUIPE VIRA A CENTRAL DE PRODUÇÃO · CICLO 1 (Walter, 28/09/2026)
--
-- "Tem que ter um campo único de visualização da conversa entre a social
-- media e os prestadores de serviço." Até aqui cada conversa morava dentro
-- do próprio card: pra saber se o designer respondeu, a social mídia abria
-- peça por peça. Agora existe uma caixa de entrada só, na Equipe, com a
-- última fala de cada card e o que ainda não foi lido.
--
-- O que este arquivo faz:
-- 1) conversa_lida: até quando cada pessoa leu cada conversa. É o que separa
--    "tem mensagem" de "tem mensagem NOVA".
-- 2) conversas_com_parceiros(): a lista de conversas da agência, da mais
--    recente pra mais antiga, com o número de não lidas.
-- 3) marcar_conversa_lida(post): carimba a leitura.
-- 4) Os avisos passam a apontar pra Equipe (o painel saiu do Cria Post):
--    comentário do parceiro abre a conversa certa; prazo sugerido abre a
--    Produção. O link antigo continua funcionando (o app redireciona).
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

-- ── 1) Até onde eu li ─────────────────────────────────────────────────────
create table if not exists public.conversa_lida (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (user_id, post_id)
);

comment on table public.conversa_lida is
  'Quando cada pessoa leu por último a conversa de um card. Serve só pra contar mensagens novas.';

alter table public.conversa_lida enable row level security;

-- Cada um só LÊ a própria leitura. Gravar é só pela RPC marcar_conversa_lida,
-- que confere se o card é mesmo da pessoa (revisão 28/09: com insert direto
-- liberado, dava pra encher a tabela de ids alheios e sondar se um post existe).
drop policy if exists "conversa_lida_propria" on public.conversa_lida;
create policy "conversa_lida_propria" on public.conversa_lida
  for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.conversa_lida from authenticated, anon;

-- ── 2) A caixa de entrada da agência ──────────────────────────────────────
/* Só posts da PRÓPRIA conta (p.user_id = auth.uid()): a Equipe não aparece pra
   colaborador agindo por outra agência, e filtrar pelo dono deixa a consulta
   no índice de user_id em vez de varrer todos os posts delegados do banco.
   Entra só card com pelo menos uma fala entre social mídia e parceiro: card
   sem conversa não é conversa. */
create or replace function public.conversas_com_parceiros()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  external_client_id uuid,
  assignee_id uuid,
  producao_status text,
  ultima_texto text,
  ultima_papel text,
  ultima_em timestamptz,
  total int,
  nao_lidas int
)
language sql stable security definer set search_path = public as $$
  select p.id,
         p.title,
         p.format,
         p.external_client_id,
         p.assignee_id,
         coalesce(p.producao_status, 'aguardando'),
         u.content,
         u.author_role,
         u.created_at,
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role in ('parceiro', 'social_media')),
         /* Não lida = fala do parceiro depois do que ela já viu. "Já viu"
            conta a leitura carimbada OU a última resposta dela: quem
            respondeu pelo editor do post leu, mesmo sem abrir a caixa. */
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.author_role in ('parceiro', 'social_media')
       order by c.created_at desc
       limit 1
    ) u on true
    left join public.conversa_lida l on l.user_id = auth.uid() and l.post_id = p.id
   where p.user_id = auth.uid()
     and p.assignee_id is not null
     and p.deleted_at is null
   order by u.created_at desc
   limit 200
$$;
revoke all on function public.conversas_com_parceiros() from public, anon;
grant execute on function public.conversas_com_parceiros() to authenticated;

-- ── 3) Carimbar a leitura ─────────────────────────────────────────────────
/* Security definer pra conferir que o card é mesmo da pessoa (dona ou
   parceiro dele) antes de gravar: sem isso daria pra encher a tabela com ids
   de posts alheios. */
create or replace function public.marcar_conversa_lida(_post_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (
    select 1 from public.posts p
     where p.id = _post_id
       and (public.acts_for(p.user_id) or p.assignee_id = auth.uid())
  ) then
    return;
  end if;
  insert into public.conversa_lida (user_id, post_id, lido_em)
  values (auth.uid(), _post_id, now())
  on conflict (user_id, post_id) do update set lido_em = excluded.lido_em;
end; $$;
revoke all on function public.marcar_conversa_lida(uuid) from public, anon;
grant execute on function public.marcar_conversa_lida(uuid) to authenticated;

-- ── 4) Os avisos apontam pra Equipe ───────────────────────────────────────
-- Mesmo corpo de 20260914000004, só com o destino novo quando a peça não tem
-- cockpit de cliente.
create or replace function public.link_da_peca(_post_id uuid, _external_client_id uuid, _para_parceiro boolean)
returns text language sql stable set search_path = public as $$
  select case
    when _para_parceiro then '/socialmidia/demandas?post=' || _post_id::text
    else coalesce(
      (select '/socialmidia/clientes/' || ec.crm_client_id::text || '/posts?post=' || _post_id::text
         from public.external_clients ec
        where ec.id = _external_client_id and ec.crm_client_id is not null),
      '/socialmidia/equipe/producao?post=' || _post_id::text)
  end
$$;

-- Mesmo corpo de 20260914000004; muda só o link do aviso (e).
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

  -- e) Parceiro sugeriu outro prazo -> social mídia. Aceitar se faz na
  --    Produção da Equipe (o painel saiu do Cria Post em 28/09/2026).
  if new.prazo_status = 'negociando' and old.prazo_status is distinct from 'negociando' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = new.user_id limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'demanda_prazo', '📅 ' || coalesce(_parceiro, 'Parceiro') || ' sugeriu outro prazo: ' || _titulo,
            coalesce('Propôs ' || to_char(new.prazo_sugerido, 'DD/MM') || '. Aceite ou responda.', 'Veja a proposta na Produção da Equipe.'),
            '/socialmidia/equipe/producao?post=' || new.id::text);
  end if;
  return new;
end; $$;

drop trigger if exists trg_parceiro_fluxo on public.posts;
create trigger trg_parceiro_fluxo after update on public.posts
  for each row execute function public.notify_parceiro_fluxo();

-- Mesmo corpo de 20260914000004; a fala do parceiro abre a CONVERSA na Equipe,
-- que é onde a social mídia responde sem caçar o card.
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
            '"' || left(new.content, 180) || '"', '/socialmidia/equipe/conversas?post=' || new.post_id::text);
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
-- ============================================================
-- CANAL DA MARCA · CICLO 2 (Walter, 28/09/2026)
--
-- "Um canal direto entre as informações que a social media quer deixar
-- sempre disponível pro designer: links úteis, link do drive, informações de
-- dentro do cliente. Hoje deve ter, mas procurei um monte e não achei."
--
-- Existia metade: os Links úteis do cliente (crm_clients.useful_links) já
-- chegavam no card, escondidos numa coluna do meio. Faltavam duas coisas que
-- a social mídia repete peça por peça no WhatsApp:
--   * a PASTA GERAL do cliente (fotos, logos, vídeos brutos), que vale pra
--     toda peça, diferente da "pasta desta peça" do post;
--   * um RECADO FIXO pro parceiro ("logo branca em fundo escuro", "nunca usar
--     vermelho", "fotos novas na pasta Junho").
--
-- Os dois moram no cliente (crm_clients), são editados na Equipe > Canal da
-- marca e chegam em TODO card daquele cliente e na ficha da marca.
--
-- Por que colunas novas e não `notes`: notes é a anotação interna da agência
-- sobre o cliente e foi tirada do parceiro de propósito em 14/09 (vazamento).
-- O recado é escrito JÁ sabendo que o parceiro vai ler.
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

alter table public.crm_clients
  add column if not exists pasta_parceiros text,
  add column if not exists recado_parceiros text;

-- Só link http(s): o parceiro abre isso com um clique (revisão 28/09).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_clients_pasta_parceiros_http') then
    alter table public.crm_clients add constraint crm_clients_pasta_parceiros_http
      check (pasta_parceiros is null or pasta_parceiros ~* '^https?://');
  end if;
end $$;

comment on column public.crm_clients.pasta_parceiros is
  'Pasta geral do cliente pros parceiros (Drive/Dropbox). Aparece em todo card do cliente.';
comment on column public.crm_clients.recado_parceiros is
  'Recado fixo da social mídia pros parceiros deste cliente. Escrito pra ser lido por terceiros.';

-- ── 1) A ficha da marca do parceiro passa a trazer pasta e recado ────────
/* Mesma assinatura de 20260914000002, então create or replace basta.
   `observacoes` estava sempre nula desde o fechamento do vazamento: volta a
   ter conteúdo, agora com o RECADO (escrito pro parceiro), nunca com notes.
   A pasta geral entra como o primeiro link da lista, com rótulo fixo. */
create or replace function public.parceiro_minhas_marcas()
returns table (
  external_client_id uuid,
  nome text,
  handle text,
  logo text,
  cor text,
  hashtags text[],
  agencia_id uuid,
  agencia_nome text,
  abertos integer,
  entregues_30d integer,
  paleta text,
  fontes text,
  expressao_visual text,
  tom_de_voz text,
  personalidade text,
  estilo_comunicacao text,
  arquetipo text,
  temas text,
  ideia_central text,
  promessa text,
  publico text,
  oferta text,
  evitar text,
  observacoes text,
  segmento text,
  links jsonb,
  referencias jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with minhas as (
    select distinct p.external_client_id, p.user_id as manager_id
    from public.posts p
    join public.manager_members m
      on m.manager_id = p.user_id
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    where p.assignee_id = auth.uid()
      and p.external_client_id is not null
      and p.deleted_at is null
      and (
        coalesce(p.producao_status, 'aguardando') <> 'entregue'
        or coalesce(p.assigned_at, p.created_at) >= now() - interval '180 days'
      )
  )
  select
    ec.id,
    coalesce(nullif(btrim(cc.name), ''), ec.name, 'Cliente'),
    coalesce(ec.instagram_handle, cc.instagram),
    coalesce(cc.logo, ec.logo_url),
    coalesce(cc.color, ec.brand_color),
    cc.hashtags,
    m.manager_id,
    coalesce(prof.name, 'Agência'),
    (select count(*)::int from public.posts p2
      where p2.external_client_id = ec.id and p2.assignee_id = auth.uid()
        and p2.deleted_at is null
        and coalesce(p2.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p3
      where p3.external_client_id = ec.id and p3.assignee_id = auth.uid()
        and p3.deleted_at is null and p3.producao_status = 'entregue'
        and p3.updated_at >= now() - interval '30 days'),
    nullif(btrim(cc.brand_core->>'colorPalette'), ''),
    nullif(btrim(cc.brand_core->>'typography'), ''),
    nullif(btrim(cc.brand_core->>'visualExpression'), ''),
    nullif(btrim(cc.brand_core->>'toneOfVoice'), ''),
    nullif(btrim(cc.brand_core->>'personality'), ''),
    nullif(btrim(cc.brand_core->>'communicationStyle'), ''),
    nullif(btrim(cc.brand_core->>'archetype'), ''),
    nullif(btrim(cc.brand_core->>'contentThemes'), ''),
    nullif(btrim(cc.brand_core->>'coreMessage'), ''),
    nullif(btrim(cc.brand_core->>'promise'), ''),
    nullif(btrim(cc.brand_core->>'audience'), ''),
    coalesce(nullif(btrim(cc.brand_core->>'offer'), ''), nullif(btrim(cc.brand_core->>'products'), '')),
    nullif(btrim(cc.brand_core->>'avoid'), ''),
    -- O recado escrito PRO parceiro. `cc.notes` continua fora (é interno).
    nullif(btrim(cc.recado_parceiros), ''),
    nullif(btrim(cc.segment), ''),
    (case when nullif(btrim(cc.pasta_parceiros), '') is not null
          then jsonb_build_array(jsonb_build_object('label', 'Pasta geral do cliente', 'url', btrim(cc.pasta_parceiros)))
          else '[]'::jsonb end)
      || coalesce(cc.useful_links, '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('url', r.image_url, 'nota', r.note) order by r.sort_order)
      from public.crm_client_refs r where r.crm_client_id = cc.id
    ), '[]'::jsonb)
  from minhas m
  join public.external_clients ec on ec.id = m.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join public.profiles prof on prof.id = m.manager_id
  order by 9 desc, 2;
$$;

revoke all on function public.parceiro_minhas_marcas() from public, anon;
grant execute on function public.parceiro_minhas_marcas() to authenticated;

-- ── 2) O card traz o canal da marca, nos dois lados ───────────────────────
/* Corpo copiado de 20260920000003 (a versão no banco). Entram três chaves:
   canal_recado, canal_pasta e canal_links. Com elas o card mostra o mesmo
   material pro parceiro e pra social mídia, sem cada lado buscar de um jeito
   (antes a agência lia do CRM e o parceiro da ficha, e um podia ver o que o
   outro não via). */
create or replace function public.parceiro_abrir_card(_post_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _p public.posts;
  _cc public.crm_clients;
  _ec record;
  _coments jsonb;
  _midias jsonb;
  _agencia text;
  _versoes int;
begin
  if not (
    public.parceiro_tem_o_card(_post_id)
    or exists (select 1 from public.posts p where p.id = _post_id and public.acts_for(p.user_id))
  ) then
    raise exception 'sem acesso a este card';
  end if;

  select * into _p from public.posts where id = _post_id;
  select name into _agencia from public.profiles where id = _p.user_id;
  select ec.name, ec.instagram_handle, ec.crm_client_id into _ec
    from public.external_clients ec where ec.id = _p.external_client_id;
  if _ec.crm_client_id is not null then
    select * into _cc from public.crm_clients where id = _ec.crm_client_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'texto', c.content, 'papel', c.author_role, 'em', c.created_at,
           'midia_indice', c.midia_indice, 'ancora_x', c.ancora_x,
           'ancora_y', c.ancora_y, 'ancora_seg', c.ancora_seg
         ) order by c.created_at), '[]'::jsonb)
    into _coments
    from public.post_approval_comments c
   where c.post_id = _post_id
     and (
       coalesce(c.author_role, '') in ('parceiro', 'social_media')
       or (c.ancora_x is not null
           and coalesce(c.author_role, '') in ('cliente_externo', 'cliente'))
     );

  select coalesce(jsonb_agg(jsonb_build_object(
           'url', coalesce(nullif(btrim(m.view_url), ''), m.thumbnail_url),
           'thumb', coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url),
           'nome', m.file_name,
           'tipo', m.file_type
         ) order by m.position asc nulls last, m.created_at asc), '[]'::jsonb)
    into _midias
    from public.external_media_refs m
   where m.post_id = _post_id and not m.substituida;

  select count(*)::int into _versoes
    from public.external_media_refs m where m.post_id = _post_id and m.entrega and m.substituida;

  return jsonb_build_object(
    'id', _p.id,
    'titulo', _p.title,
    'formato', _p.format,
    'plataforma', _p.platform,
    'gancho', _p.hook,
    'roteiro', _p.script,
    'legenda', _p.caption,
    'arte', _p.art,
    'blocos', _p.content_blocks,
    'notas', _p.notes,
    'pasta_drive', _p.drive_folder_url,
    'referencia', _p.reference_url,
    'etiquetas', _p.internal_tags,
    'producao_status', coalesce(_p.producao_status, 'aguardando'),
    'prazo_producao', _p.prazo_producao,
    'prazo_status', _p.prazo_status,
    'prazo_sugerido', _p.prazo_sugerido,
    'publica_em', _p.scheduled_date,
    'aprovacao', _p.approval_status,
    'cache', _p.cache_parceiro,
    'agencia', coalesce(_agencia, 'Agência'),
    'agencia_id', _p.user_id,
    'midias', _midias,
    'revisoes', coalesce(_p.revisoes, 0),
    'versoes_antigas', _versoes,
    'external_client_id', _p.external_client_id,
    'crm_client_id', _ec.crm_client_id,
    'canal_recado', nullif(btrim(_cc.recado_parceiros), ''),
    'canal_pasta', nullif(btrim(_cc.pasta_parceiros), ''),
    'canal_links', coalesce(_cc.useful_links, '[]'::jsonb),
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', _ec.instagram_handle,
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', _cc.hashtags
    ),
    'comentarios', _coments);
end; $$;
revoke all on function public.parceiro_abrir_card(uuid) from public, anon;
grant execute on function public.parceiro_abrir_card(uuid) to authenticated;
-- ============================================================
-- CAPA DO REELS (Walter, 28/09/2026)
--
-- "Quando for um Reels, eu ter opção de inserir capa, e se a capa for
-- inserida, a pré-visualização no Cria Post já aparece com ela."
--
-- A capa é a imagem que aparece no grid do perfil e no feed antes do play.
-- Até aqui o Reels mostrava o primeiro frame do vídeo (quase sempre um rosto
-- piscando ou um frame preto), e o cliente aprovava sem ver a capa de verdade.
--
-- 1) posts.cover_url: a imagem escolhida (fica no bucket `media`).
-- 2) capas_by_token: o portal do cliente busca as capas pelo mesmo token do
--    link de aprovação. Função à parte, de propósito: list_posts_by_token
--    tem retorno fixo e trocar o retorno exige derrubar a função que o portal
--    inteiro usa. Esta só acrescenta.
--
-- Não mexe na RLS de posts (a dona grava a capa pelo update que já tem).
-- Idempotente.
-- ============================================================

alter table public.posts
  add column if not exists cover_url text;

comment on column public.posts.cover_url is
  'Capa do Reels/vídeo escolhida pela social mídia. Aparece na prévia, no portal do cliente e vai junto na publicação.';

create or replace function public.capas_by_token(_token text)
returns table (post_id uuid, cover_url text)
language sql stable security definer set search_path = public as $$
  -- Mesmas regras de acesso do list_posts_by_token (20260914000005): token
  -- ativo, não vencido, módulo ligado, e só posts daquele cliente.
  with tok as (
    select t.manager_id, t.external_client_id, t.period_start, t.period_end
    from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.id, p.cover_url
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  where nullif(btrim(p.cover_url), '') is not null
    and p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
    -- Link de um período só enxerga as capas daquele período (revisão 28/09).
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date is not null
          and p.scheduled_date >= tok.period_start
          and p.scheduled_date <= tok.period_end)
    );
$$;
revoke all on function public.capas_by_token(text) from public;
grant execute on function public.capas_by_token(text) to anon, authenticated;
