-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · FASE 2 (Walter, 14/10/2026) · JÁ APLICADA NO BANCO (registro)
-- Doc: "Criakut: ecossistema, fluxo e plano"
--
-- Liga os três lados: criadora de conteúdo, social mídia e prestador
-- (designer, editor, filmmaker, copy). Pedido de orçamento ou mural viram uma
-- PROPOSTA com conversa; aceitar fecha e cria a ponte:
--   · conta de gestão contrata prestador → vínculo no Cria Parceiros (o mesmo
--     do código de parceiro), e a produção roda lá;
--   · criadora contrata social mídia → a criadora entra como cliente na
--     carteira da social mídia (sem acesso à conta da criadora: isso continua
--     sendo o convite que já existe);
--   · qualquer outro par → o trabalho roda na própria conversa (entrega com
--     arquivo marcada como entrega).
-- Nota e depoimento só depois de concluído com entrega registrada, às cegas.
--
-- SEGURANÇA: propostas, mensagens, pedidos e avaliações NÃO aceitam escrita
-- direta; tudo passa por funções que conferem quem é quem, com limite por
-- minuto e por dia. Leitura só por quem está na proposta. Anexo só do storage
-- do Cria, na pasta da própria pessoa. URLs de foto/capa/portfólio só de
-- hosts conhecidos. Acesso ao Criakut fechado pra convidados até abrir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ACESSO (só convidados até abrir) ───────────────────────────────────────
create table if not exists public.criakut_config (chave text primary key, valor jsonb not null);
insert into public.criakut_config (chave, valor) values ('aberto', 'false'::jsonb) on conflict (chave) do nothing;
alter table public.criakut_config enable row level security;
revoke all on public.criakut_config from anon, authenticated;

create table if not exists public.criakut_convidados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.criakut_convidados enable row level security;
revoke all on public.criakut_convidados from anon, authenticated;
-- Convidar: insert into public.criakut_convidados (user_id) select id from auth.users where email = '...';
-- Abrir pra todo mundo: update public.criakut_config set valor = 'true' where chave = 'aberto';

-- ── MURAL ──────────────────────────────────────────────────────────────────
create table if not exists public.criakut_pedidos (
  id                 uuid primary key default gen_random_uuid(),
  autor_id           uuid not null references auth.users(id) on delete cascade,
  funcao             text not null check (funcao in ('social_media','designer','editor_video','filmmaker','copy')),
  titulo             text not null check (char_length(titulo) between 4 and 120),
  descricao          text check (char_length(descricao) <= 1000),
  nicho              text check (char_length(nicho) <= 60),
  estilos            text[] not null default '{}',
  valor_min_centavos integer check (valor_min_centavos >= 0),
  valor_max_centavos integer check (valor_max_centavos >= 0),
  unidade            text not null default 'peca' check (unidade in ('peca','mes','pacote','diaria','hora')),
  prazo_texto        text check (char_length(prazo_texto) <= 60),
  tipo               text not null default 'avulso' check (tipo in ('recorrente','avulso')),
  presencial         boolean not null default false,
  cidade             text check (char_length(cidade) <= 80),
  status             text not null default 'aberto' check (status in ('aberto','fechado','cancelado')),
  criado_em          timestamptz not null default now()
);
create index if not exists criakut_pedidos_abertos on public.criakut_pedidos (funcao, criado_em desc) where status = 'aberto';

-- ── PROPOSTAS, CONVERSA, AVALIAÇÃO ─────────────────────────────────────────
create table if not exists public.criakut_propostas (
  id                    uuid primary key default gen_random_uuid(),
  contratante_id        uuid not null references auth.users(id) on delete cascade,
  contratado_id         uuid not null references auth.users(id) on delete cascade,
  pedido_id             uuid references public.criakut_pedidos(id) on delete set null,
  origem                text not null check (origem in ('pedido','mural')),
  titulo                text not null check (char_length(titulo) between 2 and 120),
  escopo                text check (char_length(escopo) <= 2000),
  valor_centavos        integer check (valor_centavos >= 0),
  unidade               text not null default 'peca' check (unidade in ('peca','mes','pacote','diaria','hora')),
  prazo                 date,
  recorrente            boolean not null default false,
  status                text not null default 'aberta' check (status in ('aberta','fechada','recusada','cancelada','concluida')),
  ultima_acao_por       uuid not null,
  ponte                 text,          -- 'parceiros' | 'carteira' | 'conversa'
  fechado_em            timestamptz,
  contratado_entregou_em timestamptz,
  concluido_em          timestamptz,
  pago_em               timestamptz,
  recebido_em           timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (contratante_id <> contratado_id)
);
create index if not exists criakut_propostas_contratante on public.criakut_propostas (contratante_id, atualizado_em desc);
create index if not exists criakut_propostas_contratado on public.criakut_propostas (contratado_id, atualizado_em desc);
create unique index if not exists criakut_proposta_unica_no_pedido on public.criakut_propostas (pedido_id, contratado_id) where status = 'aberta' and pedido_id is not null;

create table if not exists public.criakut_mensagens (
  id          uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.criakut_propostas(id) on delete cascade,
  autor_id    uuid references auth.users(id) on delete set null,
  texto       text check (char_length(texto) <= 2000),
  anexo_url   text,
  anexo_nome  text check (char_length(anexo_nome) <= 160),
  eh_entrega  boolean not null default false,
  sistema     boolean not null default false,
  tem_contato boolean not null default false,
  criado_em   timestamptz not null default now()
);
create index if not exists criakut_mensagens_proposta on public.criakut_mensagens (proposta_id, criado_em);

create table if not exists public.criakut_avaliacoes (
  id             uuid primary key default gen_random_uuid(),
  proposta_id    uuid not null references public.criakut_propostas(id) on delete cascade,
  autor_id       uuid not null references auth.users(id) on delete cascade,
  avaliado_id    uuid not null references auth.users(id) on delete cascade,
  papel_avaliado text not null check (papel_avaliado in ('contratado','contratante')),
  nota           smallint not null check (nota between 1 and 5),
  no_prazo       smallint check (no_prazo between 1 and 3),
  criatividade   smallint check (criatividade between 1 and 3),
  comunicacao    smallint check (comunicacao between 1 and 3),
  depoimento     text check (char_length(depoimento) <= 600),
  criado_em      timestamptz not null default now(),
  unique (proposta_id, autor_id)
);
create index if not exists criakut_avaliacoes_avaliado on public.criakut_avaliacoes (avaliado_id);

-- Só leitura direta; escrita só pelas funções abaixo.
alter table public.criakut_pedidos    enable row level security;
alter table public.criakut_propostas  enable row level security;
alter table public.criakut_mensagens  enable row level security;
alter table public.criakut_avaliacoes enable row level security;
revoke all on public.criakut_pedidos, public.criakut_propostas, public.criakut_mensagens, public.criakut_avaliacoes from anon, authenticated;
grant select on public.criakut_pedidos, public.criakut_propostas, public.criakut_mensagens, public.criakut_avaliacoes to authenticated;

-- ── ACESSO E URLs CONFIÁVEIS ───────────────────────────────────────────────
create or replace function public.criakut_tem_acesso()
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (select 1 from criakut_convidados where user_id = auth.uid())
    or coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'aberto'), false)
  );
$function$;

-- Foto, capa e portfólio só de hosts conhecidos (storage do Cria, o antigo, a
-- CDN antiga de avatar e o Google). Evita imagem-espiã de fora na página.
create or replace function public.criakut_url_ok(_u text)
 returns boolean language sql immutable set search_path to 'public'
as $function$
  select _u is null or _u ~ '^https://((ecbzfjzoqidowrsfsfih|exuxlwdnkgmhtnwoyvwo)\.supabase\.co/storage/v1/object/public/|d8j0ntlcm91z4\.cloudfront\.net/|[a-z0-9-]+\.googleusercontent\.com/)';
$function$;
alter table public.criakut_perfis add constraint criakut_perfis_urls_ok check (public.criakut_url_ok(foto_url) and public.criakut_url_ok(capa_url) and public.criakut_url_ok(capa_original_url));
alter table public.criakut_perfis add constraint criakut_perfis_instagram_ok check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.criakut_portfolio add constraint criakut_portfolio_url_ok check (public.criakut_url_ok(media_url));

-- ── POLÍTICAS DE LEITURA ───────────────────────────────────────────────────
create policy criakut_pedidos_ler on public.criakut_pedidos for select to authenticated
  using (autor_id = auth.uid() or (status = 'aberto' and public.criakut_tem_acesso()));
create policy criakut_propostas_ler on public.criakut_propostas for select to authenticated
  using (auth.uid() in (contratante_id, contratado_id));
create policy criakut_mensagens_ler on public.criakut_mensagens for select to authenticated
  using (exists (select 1 from public.criakut_propostas p where p.id = proposta_id and auth.uid() in (p.contratante_id, p.contratado_id)));
-- Avaliação: cada um lê só a que escreveu. A que recebeu aparece pelo perfil, às cegas.
create policy criakut_avaliacoes_ler on public.criakut_avaliacoes for select to authenticated
  using (autor_id = auth.uid());
-- Ver perfil passa a exigir acesso (dono sempre vê o próprio).
alter policy criakut_perfis_ler on public.criakut_perfis
  using (user_id = auth.uid() or (publicado and public.criakut_tem_acesso()));

-- ── AJUDANTES (internos, sem acesso direto) ────────────────────────────────
-- Link da notificação: conta de gestão ou parceiro abre na área /socialmidia; o resto no /app.
create or replace function public.criakut_link(_user uuid, _proposta uuid)
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select case when (select account_type from profiles where id = _user) in ('manager','parceiro')
                or exists (select 1 from manager_members m where m.member_id = _user and public.eh_papel_parceiro(m.role))
              then '/socialmidia/criakut?aba=propostas&p=' else '/app/criakut?aba=propostas&p=' end || _proposta::text;
$function$;

create or replace function public.criakut_avisar(_user uuid, _titulo text, _texto text, _proposta uuid)
 returns void language sql security definer set search_path to 'public'
as $function$
  insert into notifications (user_id, type, title, description, link)
  values (_user, 'criakut', left(_titulo, 120), left(_texto, 240), public.criakut_link(_user, _proposta));
$function$;

create or replace function public.criakut_msg_sistema(_proposta uuid, _texto text)
 returns void language sql security definer set search_path to 'public'
as $function$
  insert into criakut_mensagens (proposta_id, autor_id, texto, sistema) values (_proposta, null, left(_texto, 2000), true);
$function$;

create or replace function public.criakut_preco(_c integer, _u text)
 returns text language sql immutable
as $function$
  select case when _c is null then 'a combinar'
    else 'R$ ' || replace(to_char(_c / 100.0, 'FM999G999G990D00'), '.', ',') ||
      case _u when 'peca' then '/peça' when 'mes' then '/mês' when 'pacote' then ' o pacote' when 'diaria' then '/diária' else '/hora' end
  end;
$function$;

-- Trava comum: sessão, acesso e limite por minuto.
create or replace function public.criakut_porta(_chave text, _limite integer)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid();
begin
  if _eu is null then raise exception 'Entre de novo.'; end if;
  if not public.criakut_tem_acesso() then raise exception 'O Criakut ainda está fechado pra convidados.'; end if;
  if not public.rate_touch('criakut-' || _chave || ':' || _eu::text, _limite) then
    raise exception 'Muitas ações seguidas. Espere um minuto.';
  end if;
  return _eu;
end $function$;

-- Entrega registrada = arquivo marcado como entrega na conversa OU peça entregue no Cria Parceiros depois de fechar.
create or replace function public.criakut_tem_entrega(_p criakut_propostas)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from criakut_mensagens m where m.proposta_id = _p.id and m.eh_entrega)
      or (_p.fechado_em is not null and exists (
            select 1 from posts x where x.user_id = _p.contratante_id and x.assignee_id = _p.contratado_id
              and x.producao_status = 'entregue' and x.updated_at >= _p.fechado_em));
$function$;

-- ── PEDIR ORÇAMENTO (direto na página da pessoa) ───────────────────────────
create or replace function public.criakut_pedir_orcamento(_contratado uuid, _titulo text, _escopo text, _valor_centavos integer, _unidade text, _prazo date, _recorrente boolean)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('proposta', 10); _id uuid; _nome text;
begin
  if _contratado = _eu then raise exception 'Não dá pra pedir orçamento pra você mesma.'; end if;
  if not exists (select 1 from criakut_perfis where user_id = _contratado and publicado) then raise exception 'Essa página não está disponível.'; end if;
  if (select count(*) from criakut_propostas where contratante_id = _eu and criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Limite de 20 pedidos de orçamento por dia. Tente amanhã.';
  end if;
  select nome into _nome from criakut_perfis where user_id = _eu;
  if _nome is null then raise exception 'Crie sua página no Criakut antes de pedir orçamento.'; end if;
  if char_length(coalesce(trim(_titulo), '')) < 2 then raise exception 'Diga o que você precisa.'; end if;
  insert into criakut_propostas (contratante_id, contratado_id, origem, titulo, escopo, valor_centavos, unidade, prazo, recorrente, ultima_acao_por)
  values (_eu, _contratado, 'pedido', left(trim(_titulo), 120), left(_escopo, 2000), _valor_centavos, coalesce(_unidade, 'peca'), _prazo, coalesce(_recorrente, false), _eu)
  returning id into _id;
  perform public.criakut_msg_sistema(_id, 'Pedido de orçamento: ' || left(trim(_titulo), 120) || ' · ' || public.criakut_preco(_valor_centavos, coalesce(_unidade, 'peca'))
    || coalesce(' · prazo ' || to_char(_prazo, 'DD/MM'), ''));
  if coalesce(trim(_escopo), '') <> '' then
    insert into criakut_mensagens (proposta_id, autor_id, texto) values (_id, _eu, left(trim(_escopo), 2000));
  end if;
  perform public.criakut_avisar(_contratado, 'Novo pedido de orçamento', _nome || ': ' || left(trim(_titulo), 120), _id);
  return _id;
end $function$;

-- ── MURAL ──────────────────────────────────────────────────────────────────
create or replace function public.criakut_publicar_pedido(_funcao text, _titulo text, _descricao text, _nicho text, _estilos text[], _valor_min integer, _valor_max integer, _unidade text, _prazo_texto text, _tipo text, _presencial boolean, _cidade text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('pedido', 5); _id uuid;
begin
  if not exists (select 1 from criakut_perfis where user_id = _eu) then raise exception 'Crie sua página no Criakut antes de pendurar um trabalho.'; end if;
  if (select count(*) from criakut_pedidos where autor_id = _eu and status = 'aberto') >= 10 then
    raise exception 'Você já tem 10 trabalhos abertos no mural. Feche ou cancele algum.';
  end if;
  insert into criakut_pedidos (autor_id, funcao, titulo, descricao, nicho, estilos, valor_min_centavos, valor_max_centavos, unidade, prazo_texto, tipo, presencial, cidade)
  values (_eu, _funcao, left(trim(_titulo), 120), left(_descricao, 1000), left(_nicho, 60), coalesce(_estilos, '{}'), _valor_min, _valor_max,
          coalesce(_unidade, 'peca'), left(_prazo_texto, 60), coalesce(_tipo, 'avulso'), coalesce(_presencial, false), left(_cidade, 80))
  returning id into _id;
  return _id;
end $function$;

create or replace function public.criakut_cancelar_pedido(_pedido uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('pedido', 10); _p record;
begin
  update criakut_pedidos set status = 'cancelado' where id = _pedido and autor_id = _eu and status = 'aberto';
  if not found then raise exception 'Pedido não encontrado.'; end if;
  for _p in select id, contratado_id from criakut_propostas where pedido_id = _pedido and status = 'aberta' loop
    update criakut_propostas set status = 'cancelada', ultima_acao_por = _eu, atualizado_em = now() where id = _p.id;
    perform public.criakut_msg_sistema(_p.id, 'O trabalho foi retirado do mural.');
  end loop;
end $function$;

create or replace function public.criakut_mural(_funcao text default null, _tipo text default null, _texto text default null, _limite integer default 30, _pular integer default 0)
 returns table(id uuid, funcao text, titulo text, descricao text, nicho text, estilos text[], valor_min_centavos integer, valor_max_centavos integer, unidade text, prazo_texto text, tipo text, presencial boolean, cidade text, criado_em timestamptz, autor_id uuid, autor_nome text, autor_slug text, autor_foto text, autor_funcao text, propostas integer, ja_propus boolean, eh_meu boolean, status text)
 language sql stable security definer set search_path to 'public'
as $function$
  select d.id, d.funcao, d.titulo, d.descricao, d.nicho, d.estilos, d.valor_min_centavos, d.valor_max_centavos, d.unidade,
         d.prazo_texto, d.tipo, d.presencial, d.cidade, d.criado_em,
         d.autor_id, a.nome, a.slug, a.foto_url, a.funcao,
         (select count(*) from criakut_propostas p where p.pedido_id = d.id and p.status <> 'cancelada')::int,
         exists (select 1 from criakut_propostas p where p.pedido_id = d.id and p.contratado_id = auth.uid()),
         d.autor_id = auth.uid(), d.status
  from criakut_pedidos d
  join criakut_perfis a on a.user_id = d.autor_id
  where public.criakut_tem_acesso()
    and (d.status = 'aberto' or (d.autor_id = auth.uid() and d.status = 'fechado'))
    and (_funcao is null or d.funcao = _funcao)
    and (_tipo is null or d.tipo = _tipo)
    and (_texto is null or d.titulo ilike '%' || _texto || '%' or d.descricao ilike '%' || _texto || '%' or d.nicho ilike '%' || _texto || '%')
  order by (d.autor_id = auth.uid()) desc, d.criado_em desc
  limit least(greatest(_limite, 1), 60) offset greatest(_pular, 0);
$function$;

create or replace function public.criakut_propor(_pedido uuid, _escopo text, _valor_centavos integer, _unidade text, _prazo date)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('proposta', 10); _d criakut_pedidos; _id uuid; _nome text;
begin
  select * into _d from criakut_pedidos where id = _pedido and status = 'aberto';
  if not found then raise exception 'Esse trabalho não está mais aberto.'; end if;
  if _d.autor_id = _eu then raise exception 'Esse trabalho é seu.'; end if;
  if (select count(*) from criakut_propostas where contratado_id = _eu and origem = 'mural' and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Limite de 30 propostas por dia. Tente amanhã.';
  end if;
  select nome into _nome from criakut_perfis where user_id = _eu and publicado;
  if _nome is null then raise exception 'Deixe sua página visível na busca antes de mandar proposta.'; end if;
  insert into criakut_propostas (contratante_id, contratado_id, pedido_id, origem, titulo, escopo, valor_centavos, unidade, prazo, recorrente, ultima_acao_por)
  values (_d.autor_id, _eu, _d.id, 'mural', _d.titulo, left(_escopo, 2000), _valor_centavos, coalesce(_unidade, _d.unidade), _prazo, _d.tipo = 'recorrente', _eu)
  returning id into _id;
  perform public.criakut_msg_sistema(_id, 'Proposta: ' || public.criakut_preco(_valor_centavos, coalesce(_unidade, _d.unidade)) || coalesce(' · prazo ' || to_char(_prazo, 'DD/MM'), ''));
  if coalesce(trim(_escopo), '') <> '' then
    insert into criakut_mensagens (proposta_id, autor_id, texto) values (_id, _eu, left(trim(_escopo), 2000));
  end if;
  perform public.criakut_avisar(_d.autor_id, 'Nova proposta no seu trabalho', _nome || ' mandou uma proposta pra "' || left(_d.titulo, 80) || '"', _id);
  return _id;
exception when unique_violation then
  raise exception 'Você já mandou proposta pra esse trabalho.';
end $function$;

-- ── NEGOCIAR, ACEITAR, RECUSAR ─────────────────────────────────────────────
create or replace function public.criakut_contrapropor(_proposta uuid, _valor_centavos integer, _unidade text, _prazo date, _escopo text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 20); _p criakut_propostas; _outro uuid;
begin
  select * into _p from criakut_propostas where id = _proposta for update;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Proposta não encontrada.'; end if;
  if _p.status <> 'aberta' then raise exception 'Essa proposta não está mais em negociação.'; end if;
  if _p.ultima_acao_por = _eu then raise exception 'Agora é a vez da outra pessoa responder.'; end if;
  update criakut_propostas set valor_centavos = _valor_centavos, unidade = coalesce(_unidade, unidade), prazo = _prazo,
    escopo = coalesce(left(_escopo, 2000), escopo), ultima_acao_por = _eu, atualizado_em = now() where id = _proposta;
  perform public.criakut_msg_sistema(_proposta, 'Contraproposta: ' || public.criakut_preco(_valor_centavos, coalesce(_unidade, _p.unidade)) || coalesce(' · prazo ' || to_char(_prazo, 'DD/MM'), ''));
  _outro := case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  perform public.criakut_avisar(_outro, 'Contraproposta no Criakut', left(_p.titulo, 120), _proposta);
end $function$;

create or replace function public.criakut_aceitar(_proposta uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  _eu uuid := public.criakut_porta('acao', 20);
  _p criakut_propostas; _ct criakut_perfis; _cd criakut_perfis;
  _tipo_conta text; _email text; _ponte text := 'conversa'; _outro uuid; _o record;
begin
  select * into _p from criakut_propostas where id = _proposta for update;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Proposta não encontrada.'; end if;
  if _p.status <> 'aberta' then raise exception 'Essa proposta não está mais em negociação.'; end if;
  if _p.ultima_acao_por = _eu then raise exception 'Quem aceita é a outra pessoa.'; end if;
  select * into _ct from criakut_perfis where user_id = _p.contratante_id;
  select * into _cd from criakut_perfis where user_id = _p.contratado_id;
  select account_type into _tipo_conta from profiles where id = _p.contratante_id;
  update criakut_propostas set status = 'fechada', fechado_em = now(), ultima_acao_por = _eu, atualizado_em = now() where id = _proposta;
  -- PONTE 1: conta de gestão contrata prestador = vínculo no Cria Parceiros (vínculo existente fica como está).
  if _cd.funcao in ('designer','editor_video','filmmaker','copy') and _tipo_conta = 'manager' then
    select email into _email from auth.users where id = _p.contratado_id;
    insert into manager_members (manager_id, member_id, name, email, status, role)
    values (_p.contratante_id, _p.contratado_id, _cd.nome, _email, 'ativo', _cd.funcao)
    on conflict (manager_id, member_id) do nothing;
    _ponte := 'parceiros';
  -- PONTE 2: criadora contrata social mídia = entra como cliente na carteira dela (sem acesso à conta da criadora).
  elsif _cd.funcao = 'social_media' and _ct.funcao = 'criadora' then
    select email into _email from auth.users where id = _p.contratante_id;
    if not exists (select 1 from crm_clients where manager_id = _p.contratado_id and (lower(email) = lower(_email) or notes ilike '%criakut/' || _ct.slug || '%')) then
      insert into crm_clients (manager_id, name, email, instagram, notes)
      values (_p.contratado_id, _ct.nome, _email, _ct.instagram,
              'Chegou pelo Criakut em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ' (página criakut/' || _ct.slug || '). Combinado: '
              || public.criakut_preco(_p.valor_centavos, _p.unidade) || '.');
    end if;
    _ponte := 'carteira';
  end if;
  update criakut_propostas set ponte = _ponte where id = _proposta;
  if _p.pedido_id is not null then
    update criakut_pedidos set status = 'fechado' where id = _p.pedido_id;
    for _o in select id, contratado_id from criakut_propostas where pedido_id = _p.pedido_id and status = 'aberta' and id <> _proposta loop
      update criakut_propostas set status = 'recusada', atualizado_em = now() where id = _o.id;
      perform public.criakut_msg_sistema(_o.id, 'Esse trabalho foi fechado com outra pessoa. Obrigado pela proposta!');
      perform public.criakut_avisar(_o.contratado_id, 'Trabalho fechado com outra pessoa', left(_p.titulo, 120), _o.id);
    end loop;
  end if;
  perform public.criakut_msg_sistema(_proposta, case _ponte
    when 'parceiros' then 'Fechado! Vocês agora estão ligados no Cria Parceiros: as peças vão por "Enviar para" no Cria Post, com prazo, entrega e cachê no Caixa. Esta conversa continua aberta pros combinados.'
    when 'carteira' then 'Fechado! ' || _ct.nome || ' entrou como cliente na carteira de ' || _cd.nome || '. Os combinados e as entregas podem seguir por aqui.'
    else 'Fechado! O trabalho segue por esta conversa: as entregas vão com arquivo, marcadas como entrega.' end);
  _outro := case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  perform public.criakut_avisar(_outro, 'Proposta aceita!', left(_p.titulo, 120), _proposta);
  return jsonb_build_object('ponte', _ponte);
end $function$;

create or replace function public.criakut_recusar(_proposta uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 20); _p criakut_propostas; _outro uuid; _novo text;
begin
  select * into _p from criakut_propostas where id = _proposta for update;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Proposta não encontrada.'; end if;
  if _p.status <> 'aberta' then raise exception 'Essa proposta não está mais em negociação.'; end if;
  _novo := case when _p.ultima_acao_por = _eu then 'cancelada' else 'recusada' end;
  update criakut_propostas set status = _novo, ultima_acao_por = _eu, atualizado_em = now() where id = _proposta;
  perform public.criakut_msg_sistema(_proposta, case _novo when 'cancelada' then 'Proposta retirada.' else 'Proposta recusada.' end);
  _outro := case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  perform public.criakut_avisar(_outro, case _novo when 'cancelada' then 'Proposta retirada' else 'Proposta recusada' end, left(_p.titulo, 120), _proposta);
end $function$;

-- ── CONVERSA, ENTREGA, CONCLUSÃO, AVALIAÇÃO ────────────────────────────────
create or replace function public.criakut_mensagem(_proposta uuid, _texto text, _anexo_url text default null, _anexo_nome text default null, _eh_entrega boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  _eu uuid := public.criakut_porta('msg', 30); _p criakut_propostas; _outro uuid; _nome text;
  _t text := left(trim(coalesce(_texto, '')), 2000); _contato boolean := false;
begin
  select * into _p from criakut_propostas where id = _proposta;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Conversa não encontrada.'; end if;
  if _p.status in ('recusada','cancelada') then raise exception 'Essa conversa foi encerrada.'; end if;
  if _t = '' and _anexo_url is null then raise exception 'Mensagem vazia.'; end if;
  -- Anexo só do storage do Cria, na pasta criakut da própria pessoa.
  if _anexo_url is not null and (_anexo_url not like 'https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/public/media/' || _eu::text || '/criakut/%' or _anexo_url like '%..%' or _anexo_url ~ '[\s<>"'']') then
    raise exception 'Anexo inválido.';
  end if;
  if coalesce(_eh_entrega, false) and (_eu <> _p.contratado_id or _p.status not in ('fechada','concluida') or _anexo_url is null) then
    raise exception 'Entrega é de quem foi contratado, com arquivo, depois de fechar.';
  end if;
  -- Aviso (não bloqueio) de contato fora enquanto negocia.
  if _p.status = 'aberta' and (
       _t ~ '\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}' or _t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or _t ~* '(wa\.me|whats ?app|zap\y)' or _t ~* '(^|\s)@[a-z0-9_.]{3,}') then
    _contato := true;
  end if;
  insert into criakut_mensagens (proposta_id, autor_id, texto, anexo_url, anexo_nome, eh_entrega, tem_contato)
  values (_proposta, _eu, nullif(_t, ''), _anexo_url, left(_anexo_nome, 160), coalesce(_eh_entrega, false), _contato);
  update criakut_propostas set atualizado_em = now(),
    contratado_entregou_em = case when coalesce(_eh_entrega, false) then now() else contratado_entregou_em end
  where id = _proposta;
  _outro := case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  select nome into _nome from criakut_perfis where user_id = _eu;
  perform public.criakut_avisar(_outro, case when coalesce(_eh_entrega, false) then 'Entrega nova no Criakut' else 'Mensagem no Criakut' end,
    coalesce(_nome, 'Alguém') || ': ' || coalesce(left(nullif(_t, ''), 120), _anexo_nome, 'arquivo'), _proposta);
  return jsonb_build_object('aviso_contato', _contato);
end $function$;

create or replace function public.criakut_marcar(_proposta uuid, _acao text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 20); _p criakut_propostas; _outro uuid;
begin
  select * into _p from criakut_propostas where id = _proposta for update;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Proposta não encontrada.'; end if;
  if _p.status not in ('fechada','concluida') then raise exception 'Essa proposta não está fechada.'; end if;
  _outro := case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  if _acao = 'concluir' then
    if _eu <> _p.contratante_id then raise exception 'Quem conclui é quem contratou.'; end if;
    if _p.status = 'concluida' then return; end if;
    if not public.criakut_tem_entrega(_p) then raise exception 'Ainda não tem entrega registrada no Cria.'; end if;
    update criakut_propostas set status = 'concluida', concluido_em = now(), atualizado_em = now() where id = _proposta;
    perform public.criakut_msg_sistema(_proposta, 'Trabalho concluído. Agora os dois podem avaliar (a nota de cada um só aparece depois que os dois avaliarem, ou em 14 dias).');
    perform public.criakut_avisar(_outro, 'Trabalho concluído: avalie', left(_p.titulo, 120), _proposta);
  elsif _acao = 'paguei' then
    if _eu <> _p.contratante_id then raise exception 'Quem marca "paguei" é quem contratou.'; end if;
    update criakut_propostas set pago_em = coalesce(pago_em, now()), atualizado_em = now() where id = _proposta;
    perform public.criakut_msg_sistema(_proposta, 'Pagamento marcado como feito por quem contratou.');
    perform public.criakut_avisar(_outro, 'Pagamento marcado', 'Confirme quando o valor cair: ' || left(_p.titulo, 100), _proposta);
  elsif _acao = 'recebi' then
    if _eu <> _p.contratado_id then raise exception 'Quem marca "recebi" é quem foi contratado.'; end if;
    update criakut_propostas set recebido_em = coalesce(recebido_em, now()), atualizado_em = now() where id = _proposta;
    perform public.criakut_msg_sistema(_proposta, 'Recebimento confirmado.');
  else
    raise exception 'Ação desconhecida.';
  end if;
end $function$;

create or replace function public.criakut_avaliar(_proposta uuid, _nota integer, _no_prazo integer, _criatividade integer, _comunicacao integer, _depoimento text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _eu uuid := public.criakut_porta('acao', 20); _p criakut_propostas;
begin
  select * into _p from criakut_propostas where id = _proposta;
  if not found or _eu not in (_p.contratante_id, _p.contratado_id) then raise exception 'Proposta não encontrada.'; end if;
  if _p.status <> 'concluida' then raise exception 'Só dá pra avaliar trabalho concluído.'; end if;
  insert into criakut_avaliacoes (proposta_id, autor_id, avaliado_id, papel_avaliado, nota, no_prazo, criatividade, comunicacao, depoimento)
  values (_proposta, _eu,
          case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end,
          case when _eu = _p.contratante_id then 'contratado' else 'contratante' end,
          _nota, _no_prazo, _criatividade, _comunicacao, nullif(left(trim(coalesce(_depoimento, '')), 600), ''));
exception when unique_violation then
  raise exception 'Você já avaliou esse trabalho.';
end $function$;

-- ── LEITURAS ───────────────────────────────────────────────────────────────
create or replace function public.criakut_minhas_propostas()
 returns table(id uuid, papel text, outro_nome text, outro_slug text, outro_foto text, titulo text, valor_centavos integer, unidade text, prazo date, status text, minha_vez boolean, ponte text, atualizado_em timestamptz, ultima_msg text, parada boolean, ja_avaliei boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select p.id,
         case when p.contratante_id = auth.uid() then 'contratante' else 'contratado' end,
         o.nome, o.slug, o.foto_url, p.titulo, p.valor_centavos, p.unidade, p.prazo, p.status,
         (p.status = 'aberta' and p.ultima_acao_por <> auth.uid()),
         p.ponte, p.atualizado_em,
         (select coalesce(m.texto, m.anexo_nome) from criakut_mensagens m where m.proposta_id = p.id order by m.criado_em desc limit 1),
         (p.status = 'fechada' and p.fechado_em < now() - interval '15 days' and not public.criakut_tem_entrega(p)),
         exists (select 1 from criakut_avaliacoes a where a.proposta_id = p.id and a.autor_id = auth.uid())
  from criakut_propostas p
  join criakut_perfis o on o.user_id = case when p.contratante_id = auth.uid() then p.contratado_id else p.contratante_id end
  where auth.uid() in (p.contratante_id, p.contratado_id)
  order by p.atualizado_em desc
  limit 200;
$function$;

-- A conversa nunca devolve os ids de usuário.
create or replace function public.criakut_conversa(_proposta uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _eu uuid := auth.uid(); _p criakut_propostas; _o criakut_perfis;
begin
  select * into _p from criakut_propostas where id = _proposta;
  if not found or _eu is null or _eu not in (_p.contratante_id, _p.contratado_id) then return null; end if;
  select * into _o from criakut_perfis where user_id = case when _eu = _p.contratante_id then _p.contratado_id else _p.contratante_id end;
  return jsonb_build_object(
    'proposta', to_jsonb(_p) - 'contratante_id' - 'contratado_id' - 'ultima_acao_por',
    'papel', case when _eu = _p.contratante_id then 'contratante' else 'contratado' end,
    'outro', jsonb_build_object('nome', _o.nome, 'slug', _o.slug, 'foto_url', _o.foto_url, 'funcao', _o.funcao),
    'minha_vez', _p.status = 'aberta' and _p.ultima_acao_por <> _eu,
    'tem_entrega', public.criakut_tem_entrega(_p),
    'ja_avaliei', exists (select 1 from criakut_avaliacoes a where a.proposta_id = _p.id and a.autor_id = _eu),
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'meu', m.autor_id = _eu, 'texto', m.texto, 'anexo_url', m.anexo_url,
                  'anexo_nome', m.anexo_nome, 'eh_entrega', m.eh_entrega, 'sistema', m.sistema, 'tem_contato', m.tem_contato, 'criado_em', m.criado_em)
                  order by m.criado_em) from criakut_mensagens m where m.proposta_id = _p.id), '[]'::jsonb));
end $function$;

-- Perfil com reputação: nota (média por contratante, pra amigo não inflar),
-- entregas no Cria e depoimentos às cegas (visível quando os dois avaliaram ou após 14 dias).
create or replace function public.criakut_perfil(_slug text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare _p criakut_perfis; _eu uuid := auth.uid();
begin
  if _eu is null then return null; end if;
  select * into _p from criakut_perfis where slug = lower(_slug);
  if not found then return null; end if;
  if _p.user_id <> _eu and (not _p.publicado or not public.criakut_tem_acesso()) then return null; end if;
  return to_jsonb(_p) - 'capa_original_url' - 'capa_ajuste'
    || jsonb_build_object(
      'eh_meu', _p.user_id = _eu,
      'eu_sigo', exists (select 1 from criakut_seguir where seguidor = _eu and seguido = _p.user_id),
      'seguidores', (select count(*) from criakut_seguir where seguido = _p.user_id),
      'servicos', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.ordem) from criakut_servicos s where s.user_id = _p.user_id), '[]'::jsonb),
      'portfolio', coalesce((select jsonb_agg(to_jsonb(f) - 'user_id' order by f.ordem) from criakut_portfolio f where f.user_id = _p.user_id), '[]'::jsonb),
      'quem_segue', coalesce((select jsonb_agg(jsonb_build_object('slug', q.slug, 'nome', q.nome, 'foto_url', q.foto_url))
                               from (select q.slug, q.nome, q.foto_url from criakut_seguir f
                                     join criakut_perfis q on q.user_id = f.seguidor and q.publicado
                                     where f.seguido = _p.user_id order by f.criado_em desc limit 6) q), '[]'::jsonb),
      'entregas_no_cria', (select count(*) from posts x where x.assignee_id = _p.user_id and x.producao_status = 'entregue')
                          + (select count(*) from criakut_propostas c where c.contratado_id = _p.user_id and c.status = 'concluida'),
      'trabalhos_concluidos', (select count(*) from criakut_propostas c where _p.user_id in (c.contratante_id, c.contratado_id) and c.status = 'concluida'),
      'reputacao', (
        with vis as (
          select a.* from criakut_avaliacoes a
          where a.avaliado_id = _p.user_id
            and (a.criado_em < now() - interval '14 days'
                 or exists (select 1 from criakut_avaliacoes b where b.proposta_id = a.proposta_id and b.autor_id = a.avaliado_id))
        ), por_autor as (
          select autor_id, papel_avaliado, avg(nota) n, avg(no_prazo) p, avg(criatividade) c, avg(comunicacao) m from vis group by 1, 2
        )
        select jsonb_build_object(
          'nota', (select round(avg(n)::numeric, 1) from por_autor where papel_avaliado = 'contratado'),
          'avaliacoes', (select count(*) from vis where papel_avaliado = 'contratado'),
          'nota_contratante', (select round(avg(n)::numeric, 1) from por_autor where papel_avaliado = 'contratante'),
          'no_prazo', (select round(avg(p)::numeric, 1) from por_autor where papel_avaliado = 'contratado'),
          'criatividade', (select round(avg(c)::numeric, 1) from por_autor where papel_avaliado = 'contratado'),
          'comunicacao', (select round(avg(m)::numeric, 1) from por_autor where papel_avaliado = 'contratado'),
          'depoimentos', coalesce((select jsonb_agg(jsonb_build_object('nota', v.nota, 'depoimento', v.depoimento, 'criado_em', v.criado_em,
                              'papel', v.papel_avaliado, 'autor_nome', au.nome, 'autor_slug', au.slug, 'autor_foto', au.foto_url,
                              'trabalho', pr.titulo) order by v.criado_em desc)
                            from (select * from vis where depoimento is not null order by criado_em desc limit 12) v
                            join criakut_propostas pr on pr.id = v.proposta_id
                            left join criakut_perfis au on au.user_id = v.autor_id), '[]'::jsonb)
        ))
    );
end $function$;

-- Busca nova (com nota e entregas). A criakut_buscar da fase 0 vira só um
-- atalho pra ela, com o mesmo formato de antes (sem precisar apagar nada).
create or replace function public.criakut_procurar(_funcao text default null, _estilos text[] default null, _nichos text[] default null, _preco_max_centavos integer default null, _cidade text default null, _texto text default null, _limite integer default 30, _pular integer default 0)
 returns table(user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean, foto_url text, status_texto text, estilos text[], nichos text[], preco_minimo_centavos integer, seguidores integer, nota numeric, entregas integer)
 language sql stable security definer set search_path to 'public'
as $function$
  select p.user_id, p.slug, p.nome, p.funcao, p.cidade, p.atende_remoto, p.foto_url, p.status_texto,
         p.estilos, p.nichos,
         (select min(s.preco_centavos) from criakut_servicos s where s.user_id = p.user_id)::int,
         (select count(*) from criakut_seguir f where f.seguido = p.user_id)::int,
         (select round(avg(n)::numeric, 1) from (select avg(a.nota) n from criakut_avaliacoes a
            where a.avaliado_id = p.user_id and a.papel_avaliado = 'contratado'
              and (a.criado_em < now() - interval '14 days' or exists (select 1 from criakut_avaliacoes b where b.proposta_id = a.proposta_id and b.autor_id = a.avaliado_id))
            group by a.autor_id) x),
         ((select count(*) from posts x where x.assignee_id = p.user_id and x.producao_status = 'entregue')
          + (select count(*) from criakut_propostas c where c.contratado_id = p.user_id and c.status = 'concluida'))::int
  from criakut_perfis p
  where p.publicado
    and public.criakut_tem_acesso()
    and (_funcao is null or p.funcao = _funcao)
    and (_estilos is null or cardinality(_estilos) = 0 or p.estilos && _estilos)
    and (_nichos  is null or cardinality(_nichos)  = 0 or p.nichos  && _nichos)
    and (_cidade  is null or p.cidade ilike _cidade || '%')
    and (_texto   is null or p.nome ilike '%' || _texto || '%' or p.sobre ilike '%' || _texto || '%')
    and (_preco_max_centavos is null or exists (
          select 1 from criakut_servicos s where s.user_id = p.user_id and s.preco_centavos <= _preco_max_centavos))
  order by p.atualizado_em desc
  limit least(greatest(_limite, 1), 60) offset greatest(_pular, 0);
$function$;

create or replace function public.criakut_buscar(_funcao text default null, _estilos text[] default null, _nichos text[] default null, _preco_max_centavos integer default null, _cidade text default null, _texto text default null, _limite integer default 30, _pular integer default 0)
 returns table(user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean, foto_url text, status_texto text, estilos text[], nichos text[], preco_minimo_centavos integer, seguidores integer)
 language sql stable security definer set search_path to 'public'
as $function$
  select r.user_id, r.slug, r.nome, r.funcao, r.cidade, r.atende_remoto, r.foto_url, r.status_texto, r.estilos, r.nichos, r.preco_minimo_centavos, r.seguidores
  from public.criakut_procurar(_funcao, _estilos, _nichos, _preco_max_centavos, _cidade, _texto, _limite, _pular) r;
$function$;

-- Funil do Criakut pro admin (quem conversa e nunca entrega aparece aqui).
create or replace function public.criakut_funil_admin()
 returns table(nome text, slug text, propostas integer, fechadas integer, concluidas integer, pagas integer, avaliadas integer, paradas integer, avisos_contato integer)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Só admin.'; end if;
  return query
  select f.nome, f.slug,
    count(p.id)::int,
    count(p.id) filter (where p.status in ('fechada','concluida'))::int,
    count(p.id) filter (where p.status = 'concluida')::int,
    count(p.id) filter (where p.recebido_em is not null)::int,
    count(p.id) filter (where exists (select 1 from criakut_avaliacoes a where a.proposta_id = p.id))::int,
    count(p.id) filter (where p.status = 'fechada' and p.fechado_em < now() - interval '15 days' and not public.criakut_tem_entrega(p))::int,
    (select count(*) from criakut_mensagens m where m.tem_contato and m.autor_id = f.user_id)::int
  from criakut_perfis f
  left join criakut_propostas p on f.user_id in (p.contratante_id, p.contratado_id)
  group by f.user_id, f.nome, f.slug
  order by count(p.id) desc;
end $function$;

-- ── PERMISSÕES DAS FUNÇÕES ─────────────────────────────────────────────────
do $g$ declare f text; begin
  foreach f in array array[
    'criakut_link(uuid, uuid)', 'criakut_avisar(uuid, text, text, uuid)', 'criakut_msg_sistema(uuid, text)',
    'criakut_porta(text, integer)', 'criakut_tem_entrega(criakut_propostas)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'criakut_tem_acesso()', 'criakut_preco(integer, text)',
    'criakut_pedir_orcamento(uuid, text, text, integer, text, date, boolean)',
    'criakut_publicar_pedido(text, text, text, text, text[], integer, integer, text, text, text, boolean, text)',
    'criakut_cancelar_pedido(uuid)', 'criakut_mural(text, text, text, integer, integer)',
    'criakut_propor(uuid, text, integer, text, date)', 'criakut_contrapropor(uuid, integer, text, date, text)',
    'criakut_aceitar(uuid)', 'criakut_recusar(uuid)', 'criakut_mensagem(uuid, text, text, text, boolean)',
    'criakut_marcar(uuid, text)', 'criakut_avaliar(uuid, integer, integer, integer, integer, text)',
    'criakut_minhas_propostas()', 'criakut_conversa(uuid)', 'criakut_perfil(text)',
    'criakut_procurar(text, text[], text[], integer, text, text, integer, integer)',
    'criakut_buscar(text, text[], text[], integer, text, text, integer, integer)', 'criakut_funil_admin()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $g$;
