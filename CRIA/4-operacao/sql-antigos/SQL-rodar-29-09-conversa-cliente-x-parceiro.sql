-- ============================================================
-- DUAS CONVERSAS NUM POST SÓ, SEM MISTURA (Walter, 29/09/2026)
--
-- "Aqui fica o histórico de aprovações, o que é bom. Mas se o post for pra
-- aprovação do cliente, era pra ficar no mesmo campo: tem que ver se uma
-- coisa não vai prejudicar a outra."
--
-- Prejudicava, e mais do que parecia. A conversa com o designer e o vai e
-- volta com o cliente moram na MESMA tabela (post_approval_comments), e o que
-- separava as duas era só o papel de quem escreveu. Só que a social mídia
-- escreve com o mesmo papel ("social_media") nas duas. Resultado:
--   * o "Prazo combinado" e o papo com o designer apareciam no Histórico de
--     aprovação do post, como se fossem conversa com o cliente;
--   * PIOR: o link de aprovação mostrava ao CLIENTE a conversa com o designer
--     (list_post_comments_by_token devolvia tudo), e o "último comentário"
--     do portal podia ser uma fala da produção;
--   * e o recado da agência pro cliente caía na conversa do card do designer.
--
-- Agora cada comentário diz a que conversa pertence: canal = 'cliente' ou
-- 'parceiro'. Fala do parceiro é sempre 'parceiro' (gatilho). O app marca
-- 'parceiro' no que a social mídia escreve pelo card/conversas, prazo e
-- pedido de ajuste. Tudo que já existe é classificado uma vez (abaixo).
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

alter table public.post_approval_comments
  add column if not exists canal text not null default 'cliente';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'post_approval_comments_canal_ck') then
    alter table public.post_approval_comments add constraint post_approval_comments_canal_ck
      check (canal in ('cliente', 'parceiro'));
  end if;
end $$;

create index if not exists idx_pac_post_canal on public.post_approval_comments (post_id, canal, created_at desc);

-- Fala do parceiro é sempre da conversa de produção, venha de onde vier.
create or replace function public.canal_do_comentario()
returns trigger language plpgsql as $$
begin
  if new.author_role = 'parceiro' then new.canal := 'parceiro'; end if;
  return new;
end; $$;
drop trigger if exists trg_canal_do_comentario on public.post_approval_comments;
create trigger trg_canal_do_comentario before insert on public.post_approval_comments
  for each row execute function public.canal_do_comentario();

-- ── Classificar o que já existe (uma vez) ─────────────────────────────────
update public.post_approval_comments set canal = 'parceiro'
 where author_role = 'parceiro' and canal <> 'parceiro';

/* Falas da social mídia em post delegado: prazo e pedido de ajuste ao
   designer têm texto fixo; o resto conta como produção se foi escrito depois
   da delegação. O único recado automático pro cliente ("Ajustado e
   reenviado") fica no canal do cliente. */
update public.post_approval_comments c set canal = 'parceiro'
  from public.posts p
 where c.post_id = p.id
   and c.canal = 'cliente'
   and c.author_role = 'social_media'
   and p.assignee_id is not null
   and c.content <> 'Ajustado e reenviado pro cliente.'
   and (
     c.content like 'Prazo%' or c.content like 'Ajuste:%'
     or (p.assigned_at is not null and c.created_at >= p.assigned_at)
   );

-- ── 1) O portal do cliente só enxerga a conversa dele ─────────────────────
create or replace function public.list_post_comments_by_token(_token text)
returns table(
  post_id uuid, author_kind text, content text, created_at timestamptz,
  comment_id uuid, midia_indice integer, ancora_x numeric, ancora_y numeric, ancora_seg numeric)
language sql stable security definer set search_path to 'public'
as $$
  with tok as (
    select t.manager_id, t.external_client_id
    from public.approval_tokens t
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select
    p.id,
    case when c.author_role in ('cliente_externo', 'cliente', 'cliente_externo_aprovacao')
         then 'cliente' else 'equipe' end,
    c.content,
    c.created_at,
    -- id do comentário: é o que permite ao cliente tirar o alfinete que ele
    -- mesmo pôs, antes de fechar a rodada.
    c.id,
    c.midia_indice, c.ancora_x, c.ancora_y, c.ancora_seg
  from tok
  join public.posts p
    on p.external_client_id = tok.external_client_id
   and p.user_id = tok.manager_id
  join public.post_approval_comments c on c.post_id = p.id
  where p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
    -- O cliente só vê a conversa DELE (revisão 29/09: a do designer vazava).
    and c.canal = 'cliente'
  order by p.id, c.created_at asc;
$$;
grant execute on function public.list_post_comments_by_token(text) to anon, authenticated;

-- ── 2) O "último comentário" do portal também ─────────────────────────────
create or replace function public.list_posts_by_token(_token text)
 returns table(post_id uuid, title text, platform text, format text, caption text, hook text, script text, content_blocks jsonb, approval_mode text, approval_stages jsonb, approval_status text, scheduled_date date, media jsonb, last_comment text, last_comment_role text, drive_folder_url text)
 language sql stable security definer set search_path to 'public'
as $function$
  with tok as (
    select t.manager_id, t.external_client_id, t.period_start, t.period_end
    from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.id, p.title, p.platform, p.format,
         p.caption, p.hook, p.script, p.content_blocks,
         coalesce(p.approval_mode,'fast'), p.approval_stages,
         coalesce(p.approval_status,'pendente'),
         p.scheduled_date,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'provider', m.provider, 'thumbnail_url', m.thumbnail_url,
             'view_url', m.view_url, 'download_url', m.download_url,
             'bunny_video_id', m.bunny_video_id, 'file_type', m.file_type,
             'file_name', m.file_name, 'position', m.position
           ) order by m.position asc nulls last, m.created_at asc)
           from public.external_media_refs m
           where m.post_id = p.id and not m.substituida
         ), '[]'::jsonb),
         c.content, c.author_role,
         p.drive_folder_url
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  left join lateral (
    select content, author_role from public.post_approval_comments
    where post_id = p.id and canal = 'cliente' order by created_at desc limit 1
  ) c on true
  where p.approval_status in ('pendente','ajuste_solicitado','aprovado')
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date is not null
          and p.scheduled_date >= tok.period_start
          and p.scheduled_date <= tok.period_end)
    )
  order by (coalesce(p.approval_status,'pendente') = 'ajuste_solicitado') desc,
           (coalesce(p.approval_status,'pendente') = 'pendente') desc,
           p.scheduled_date asc nulls last, p.created_at asc;
$function$;


-- ── 3) A caixa de conversas com parceiros ─────────────────────────────────
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
           where c.post_id = p.id and c.canal = 'parceiro'),
         /* Não lida = fala do parceiro depois do que ela já viu. "Já viu"
            conta a leitura carimbada OU a última resposta dela: quem
            respondeu pelo editor do post leu, mesmo sem abrir a caixa. */
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro' and c.canal = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media' and s.canal = 'parceiro'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.canal = 'parceiro'
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

-- ── 4) O card do parceiro ─────────────────────────────────────────────────
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
  _conf jsonb;
  _links_uteis jsonb := '[]'::jsonb;
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
  _conf := coalesce(_cc.compartilhar_parceiros, '{}'::jsonb);

  -- Links úteis liberados, só http(s). A pasta geral vai à parte (canal_pasta).
  if _cc.id is not null and public.parceiro_ve(_conf, 'links') and jsonb_typeof(_cc.useful_links) = 'array' then
    select coalesce(jsonb_agg(l), '[]'::jsonb) into _links_uteis
      from jsonb_array_elements(_cc.useful_links) l
     where coalesce(l ->> 'url', '') ~* '^https?://';
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
       c.canal = 'parceiro'
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
    'canal_pasta', case when _cc.id is not null and public.parceiro_ve(_conf, 'pasta') then public.pasta_geral_do_cliente(_cc) end,
    'canal_links', _links_uteis,
    'marca_liberada', case when _cc.id is not null then public.marca_para_parceiro(_cc) else '{}'::jsonb end,
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', _ec.instagram_handle,
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', case when public.parceiro_ve(_conf, 'hashtags') then _cc.hashtags end
    ),
    'comentarios', _coments);
end; $$;
revoke all on function public.parceiro_abrir_card(uuid) from public, anon;
grant execute on function public.parceiro_abrir_card(uuid) to authenticated;


-- ── 5) Avisos ─────────────────────────────────────────────────────────────
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
    where c.post_id = new.id and c.author_role = 'social_media' and c.canal = 'parceiro' order by c.created_at desc limit 1;
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
  -- Só a conversa de produção avisa o parceiro. Recado da agência pro CLIENTE
  -- (mesmo papel social_media) não é assunto dele (revisão 29/09).
  if new.author_role not in ('parceiro', 'social_media') or coalesce(new.canal, 'cliente') <> 'parceiro' then return new; end if;
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
