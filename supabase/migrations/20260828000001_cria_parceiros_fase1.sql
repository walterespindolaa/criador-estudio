-- ============================================================
-- CRIA PARCEIROS, FASE 1
--
-- O terceiro tipo de acesso: designer, editor de vídeo, copy. A social mídia
-- acopla a pessoa, manda um card pra ela, e ela entrega ali dentro.
--
-- POR QUE TUDO AQUI É RPC E NÃO POLICY NOVA
-- A tabela `posts` tem uma policy RESTRICTIVE (`colab_escopo`) que depende de
-- `can_client_ext()`, e essa função NÃO existe em nenhuma migration deste
-- repositório: ela foi criada direto no banco em algum momento. Policy
-- restritiva age em E lógico, então qualquer policy permissiva que eu criasse
-- pro parceiro continuaria barrada por ela, e pra consertar isso eu teria que
-- reescrever uma regra cujo texto verdadeiro eu não consigo ler daqui.
--
-- Reescrever no escuro uma policy que protege o conteúdo de todos os clientes
-- de todas as agências é o tipo de risco que não se justifica por conveniência.
-- Então o parceiro não enxerga a tabela: ele fala com funções `security
-- definer` que checam o vínculo na unha e devolvem só o que é dele. Menos
-- elegante, muito mais fácil de auditar, e não move nenhuma pedra existente.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. O PAPEL NO VÍNCULO
--
-- Colaborador hoje é genérico: ganha módulos e pronto. O papel decide a tela
-- inicial da pessoa, o que o botão "Enviar para" oferece, e se o vínculo
-- consome assento pago (parceiro não consome).
-- ────────────────────────────────────────────────────────────
alter table public.manager_members
  add column if not exists role text not null default 'social_media';

comment on column public.manager_members.role is
  'social_media (colaborador pleno, consome assento) | designer | editor_video | copy | trafego (parceiros: entram de graça e só veem o card atribuído)';

create index if not exists idx_manager_members_role
  on public.manager_members(member_id, status) where status = 'ativo';

/** É parceiro (e não colaborador pleno)? Papel fora da lista = colaborador. */
create or replace function public.eh_papel_parceiro(_role text)
returns boolean language sql immutable as $$
  select coalesce(_role, 'social_media') in ('designer', 'editor_video', 'copy', 'trafego');
$$;

-- ────────────────────────────────────────────────────────────
-- 2. O RESPONSÁVEL NO CARD
--
-- Hoje a permissão é por CLIENTE. O que a Gabriela descreveu é delegação por
-- CARD, que é outra coisa: ela manda um post específico, com prazo, e a pessoa
-- devolve ali.
-- ────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists producao_status text,
  add column if not exists assigned_at timestamptz,
  add column if not exists prazo_producao date;

comment on column public.posts.assignee_id is
  'O parceiro responsável por produzir esta peça. UM só: reels que precisa de editor E de capa vira dois cards, decisão da Gabriela em 28/08.';
comment on column public.posts.producao_status is
  'aguardando | em_producao | entregue | ajuste. Eixo SEPARADO do approval_status: um é a produção interna, o outro é o cliente decidindo. Não existe "recusado": o parceiro não recusa card.';
comment on column public.posts.prazo_producao is
  'Data de entrega combinada entre a social mídia e o parceiro. Sem regra automática: o sistema não opina sobre o prazo, só avisa quando chega perto.';

-- A fila do parceiro é lida por aqui: dele, do mais urgente pro menos.
create index if not exists idx_posts_assignee
  on public.posts(assignee_id, prazo_producao) where assignee_id is not null;

-- ────────────────────────────────────────────────────────────
-- 3. QUEM PODE O QUÊ
-- ────────────────────────────────────────────────────────────

/** O card é meu (sou o parceiro atribuído) e meu vínculo com a agência está
 *  ativo? Vínculo pausado corta o acesso na hora, inclusive ao que já estava
 *  na mão da pessoa. */
create or replace function public.parceiro_tem_o_card(_post_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.posts p
    join public.manager_members m
      on m.manager_id = p.user_id
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    where p.id = _post_id
      and p.assignee_id = auth.uid()
  );
$$;
revoke all on function public.parceiro_tem_o_card(uuid) from public, anon;
grant execute on function public.parceiro_tem_o_card(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. A FILA DO PARCEIRO, ATRAVESSANDO AGÊNCIAS
--
-- Esta é a razão de existir do recurso. Hoje o colaborador troca de conta pra
-- ver cada agência; quem atende cinco social mídias não vai trocar cinco vezes
-- por dia. Aqui vem tudo junto, de todas, ordenado por prazo.
-- ────────────────────────────────────────────────────────────
create or replace function public.parceiro_minha_fila()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  plataforma text,
  producao_status text,
  prazo_producao date,
  publica_em date,
  assigned_at timestamptz,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_handle text,
  cliente_cor text,
  cliente_logo text,
  etiquetas uuid[]
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.platform,
    coalesce(p.producao_status, 'aguardando'),
    p.prazo_producao, p.scheduled_date, p.assigned_at,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    ec.instagram_handle,
    cc.color, cc.logo,
    p.internal_tags
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    -- Entregue e aprovado some da fila sozinho: fila que só cresce ninguém usa.
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by p.prazo_producao asc nulls last, p.assigned_at asc;
$$;
revoke all on function public.parceiro_minha_fila() from public, anon;
grant execute on function public.parceiro_minha_fila() to authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. ABRIR O CARD
--
-- Devolve o que o parceiro precisa pra produzir e NADA além disso. Sem
-- financeiro, sem contrato, sem os outros posts do cliente, sem a carteira.
-- A identidade visual vai junto porque é justamente o que ele precisa e é o
-- que ele hoje pede por WhatsApp toda vez.
-- ────────────────────────────────────────────────────────────
create or replace function public.parceiro_abrir_card(_post_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _p public.posts;
  _cc public.crm_clients;
  _ec record;
  _coments jsonb;
  _agencia text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
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
           'id', c.id, 'texto', c.content, 'papel', c.author_role, 'em', c.created_at
         ) order by c.created_at), '[]'::jsonb)
    into _coments
    from public.post_approval_comments c where c.post_id = _post_id;

  return jsonb_build_object(
    'id', _p.id,
    'titulo', _p.title,
    'formato', _p.format,
    'plataforma', _p.platform,
    'gancho', _p.hook,
    'roteiro', _p.script,
    'legenda', _p.caption,
    -- `art` guarda a mídia do post (as RPCs criapost_*_media mexem nela) e
    -- `content_blocks` os slides do carrossel. Os dois são o que o designer
    -- precisa ver pra saber quantas peças fazer.
    'arte', _p.art,
    'blocos', _p.content_blocks,
    'notas', _p.notes,
    'pasta_drive', _p.drive_folder_url,
    'referencia', _p.reference_url,
    'etiquetas', _p.internal_tags,
    'producao_status', coalesce(_p.producao_status, 'aguardando'),
    'prazo_producao', _p.prazo_producao,
    'publica_em', _p.scheduled_date,
    'agencia', coalesce(_agencia, 'Agência'),
    -- A marca, que é o que ele pede por WhatsApp toda santa vez.
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

-- ────────────────────────────────────────────────────────────
-- 6. MEXER NO CARD
--
-- O parceiro só muda o eixo de PRODUÇÃO. Ele não encosta no approval_status,
-- não reatribui o card e não mexe no conteúdo: quem fala com o cliente é
-- sempre a social mídia.
-- ────────────────────────────────────────────────────────────
create or replace function public.parceiro_marcar(_post_id uuid, _status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  -- Lista fechada de propósito: sem 'recusado' (o parceiro não recusa) e sem
  -- nada do eixo de aprovação do cliente.
  if _status not in ('em_producao', 'entregue') then
    raise exception 'status de produção inválido: %', _status;
  end if;
  update public.posts set producao_status = _status where id = _post_id;
end; $$;
revoke all on function public.parceiro_marcar(uuid, text) from public, anon;
grant execute on function public.parceiro_marcar(uuid, text) to authenticated;

/** Comentar no card. Reaproveita a thread que já existe, com papel próprio pra
 *  a social mídia distinguir a voz do parceiro da do cliente. */
create or replace function public.parceiro_comentar(_post_id uuid, _texto text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid; _limpo text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  _limpo := btrim(coalesce(_texto, ''));
  if _limpo = '' then raise exception 'comentário vazio'; end if;

  insert into public.post_approval_comments (post_id, content, author_role)
  values (_post_id, left(_limpo, 4000), 'parceiro')
  returning id into _id;
  return _id;
end; $$;
revoke all on function public.parceiro_comentar(uuid, text) from public, anon;
grant execute on function public.parceiro_comentar(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. O LADO DA SOCIAL MÍDIA: quem posso acionar
--
-- Lista os parceiros ativos da agência pra alimentar o "Enviar para".
-- ────────────────────────────────────────────────────────────
create or replace function public.meus_parceiros()
returns table (member_id uuid, nome text, email text, role text)
language sql stable security definer set search_path = public as $$
  select m.member_id, coalesce(m.name, m.email, 'Parceiro'), m.email, m.role
    from public.manager_members m
   where m.manager_id = auth.uid()
     and m.status = 'ativo'
     and public.eh_papel_parceiro(m.role)
   order by coalesce(m.name, m.email);
$$;
revoke all on function public.meus_parceiros() from public, anon;
grant execute on function public.meus_parceiros() to authenticated;

-- ============================================================
-- Conferência (só leitura)
-- ============================================================
-- select role, count(*) from public.manager_members group by role;
-- select count(*) as cards_atribuidos from public.posts where assignee_id is not null;
