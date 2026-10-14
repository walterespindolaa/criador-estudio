-- ═══════════════════════════════════════════════════════════════════════════
-- CRIAKUT · FASE 0 (Walter, 14/10/2026)
-- Doc: "Criakut: ecossistema, fluxo e plano" (Claude Docs)
--
-- 1. TRAVA: parceiro de produção (designer, editor, copy, tráfego, filmmaker)
--    nunca recebe permissão de módulo. Hoje ele não vê CRM nem Caixa só porque
--    não tem permissão cadastrada; com gente de fora entrando pelo Criakut, isso
--    vira regra do banco, não detalhe do dado.
-- 2. Tabelas próprias do Criakut. A página pública lê SÓ daqui, nunca de
--    posts, crm_* ou fin_*.
-- 3. Funções de leitura: busca e perfil por endereço.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. TRAVA ───────────────────────────────────────────────────────────────
create or replace function public.trava_permissao_de_parceiro()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'manager_member_permissions' then
    if exists (select 1 from public.manager_members m
               where m.id = new.member_row_id and public.eh_papel_parceiro(m.role)) then
      raise exception 'Parceiro de produção não recebe permissão de módulo (Criakut, trava de segurança).'
        using errcode = 'check_violation';
    end if;
  else -- manager_members: virar parceiro com permissão já dada
    if public.eh_papel_parceiro(new.role)
       and exists (select 1 from public.manager_member_permissions p where p.member_row_id = new.id) then
      raise exception 'Tire as permissões de módulo antes de mudar este membro para parceiro de produção.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trava_permissao_parceiro on public.manager_member_permissions;
create trigger trava_permissao_parceiro
  before insert or update on public.manager_member_permissions
  for each row execute function public.trava_permissao_de_parceiro();

drop trigger if exists trava_papel_parceiro on public.manager_members;
create trigger trava_papel_parceiro
  before insert or update of role on public.manager_members
  for each row execute function public.trava_permissao_de_parceiro();

-- ── 2. TABELAS ─────────────────────────────────────────────────────────────
create table if not exists public.criakut_perfis (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  nome             text not null check (char_length(nome) between 2 and 80),
  funcao           text not null check (funcao in ('social_media','criadora','designer','editor_video','filmmaker','copy')),
  cidade           text check (char_length(cidade) <= 80),
  atende_remoto    boolean not null default true,
  sobre            text check (char_length(sobre) <= 600),
  status_texto     text check (char_length(status_texto) <= 120),
  recado_do_dia    text check (char_length(recado_do_dia) <= 160),
  foto_url         text,
  capa_tipo        text not null default 'cria-1' check (capa_tipo in ('cria-1','cria-2','cria-3','cria-4','cria-5','propria')),
  capa_url         text,
  capa_original_url text,
  capa_ajuste      jsonb,            -- zoom, giro e posição do editor, pra "ajustar de novo"
  estilos          text[] not null default '{}',
  nichos           text[] not null default '{}',
  instagram        text check (char_length(instagram) <= 40),
  publicado        boolean not null default false,  -- nasce escondido (LGPD): a pessoa publica quando quiser
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists criakut_perfis_busca on public.criakut_perfis (funcao) where publicado;
create index if not exists criakut_perfis_estilos on public.criakut_perfis using gin (estilos);
create index if not exists criakut_perfis_nichos on public.criakut_perfis using gin (nichos);

create table if not exists public.criakut_servicos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.criakut_perfis(user_id) on delete cascade,
  titulo         text not null check (char_length(titulo) between 2 and 80),
  detalhe        text check (char_length(detalhe) <= 160),
  preco_centavos integer check (preco_centavos >= 0),
  unidade        text not null default 'peca' check (unidade in ('peca','mes','pacote','diaria','hora')),
  ordem          integer not null default 0
);
create index if not exists criakut_servicos_user on public.criakut_servicos (user_id, ordem);

create table if not exists public.criakut_portfolio (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.criakut_perfis(user_id) on delete cascade,
  media_url text not null,
  legenda   text check (char_length(legenda) <= 120),
  ordem     integer not null default 0
);
create index if not exists criakut_portfolio_user on public.criakut_portfolio (user_id, ordem);

create table if not exists public.criakut_seguir (
  seguidor  uuid not null references auth.users(id) on delete cascade,
  seguido   uuid not null references public.criakut_perfis(user_id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (seguidor, seguido),
  check (seguidor <> seguido)
);
create index if not exists criakut_seguir_seguido on public.criakut_seguir (seguido);

create or replace function public.criakut_tocar_atualizado()
returns trigger language plpgsql as $$ begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists criakut_perfis_atualizado on public.criakut_perfis;
create trigger criakut_perfis_atualizado before update on public.criakut_perfis
  for each row execute function public.criakut_tocar_atualizado();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.criakut_perfis    enable row level security;
alter table public.criakut_servicos  enable row level security;
alter table public.criakut_portfolio enable row level security;
alter table public.criakut_seguir    enable row level security;
revoke all on public.criakut_perfis, public.criakut_servicos, public.criakut_portfolio, public.criakut_seguir from anon;

drop policy if exists criakut_perfis_ler on public.criakut_perfis;
create policy criakut_perfis_ler on public.criakut_perfis for select to authenticated
  using (publicado or user_id = auth.uid());
drop policy if exists criakut_perfis_dono on public.criakut_perfis;
create policy criakut_perfis_dono on public.criakut_perfis for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists criakut_servicos_ler on public.criakut_servicos;
create policy criakut_servicos_ler on public.criakut_servicos for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.criakut_perfis p where p.user_id = criakut_servicos.user_id and p.publicado));
drop policy if exists criakut_servicos_dono on public.criakut_servicos;
create policy criakut_servicos_dono on public.criakut_servicos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists criakut_portfolio_ler on public.criakut_portfolio;
create policy criakut_portfolio_ler on public.criakut_portfolio for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.criakut_perfis p where p.user_id = criakut_portfolio.user_id and p.publicado));
drop policy if exists criakut_portfolio_dono on public.criakut_portfolio;
create policy criakut_portfolio_dono on public.criakut_portfolio for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Quem segue quem: cada um vê só as próprias linhas; os números saem pelas funções.
drop policy if exists criakut_seguir_meu on public.criakut_seguir;
create policy criakut_seguir_meu on public.criakut_seguir for select to authenticated
  using (seguidor = auth.uid() or seguido = auth.uid());
drop policy if exists criakut_seguir_criar on public.criakut_seguir;
create policy criakut_seguir_criar on public.criakut_seguir for insert to authenticated
  with check (seguidor = auth.uid()
              and exists (select 1 from public.criakut_perfis p where p.user_id = seguido and p.publicado));
drop policy if exists criakut_seguir_apagar on public.criakut_seguir;
create policy criakut_seguir_apagar on public.criakut_seguir for delete to authenticated
  using (seguidor = auth.uid());

-- ── 3. FUNÇÕES ─────────────────────────────────────────────────────────────
-- Busca: só perfis publicados. Filtro vazio = não filtra.
create or replace function public.criakut_buscar(
  _funcao text default null, _estilos text[] default null, _nichos text[] default null,
  _preco_max_centavos integer default null, _cidade text default null, _texto text default null,
  _limite integer default 30, _pular integer default 0)
returns table (user_id uuid, slug text, nome text, funcao text, cidade text, atende_remoto boolean,
               foto_url text, status_texto text, estilos text[], nichos text[],
               preco_minimo_centavos integer, seguidores integer)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.slug, p.nome, p.funcao, p.cidade, p.atende_remoto, p.foto_url, p.status_texto,
         p.estilos, p.nichos,
         (select min(s.preco_centavos) from criakut_servicos s where s.user_id = p.user_id)::int,
         (select count(*) from criakut_seguir f where f.seguido = p.user_id)::int
  from criakut_perfis p
  where p.publicado
    and auth.uid() is not null
    and (_funcao is null or p.funcao = _funcao)
    and (_estilos is null or cardinality(_estilos) = 0 or p.estilos && _estilos)
    and (_nichos  is null or cardinality(_nichos)  = 0 or p.nichos  && _nichos)
    and (_cidade  is null or p.cidade ilike _cidade || '%')
    and (_texto   is null or p.nome ilike '%' || _texto || '%' or p.sobre ilike '%' || _texto || '%')
    and (_preco_max_centavos is null or exists (
          select 1 from criakut_servicos s where s.user_id = p.user_id and s.preco_centavos <= _preco_max_centavos))
  order by p.atualizado_em desc
  limit least(greatest(_limite, 1), 60) offset greatest(_pular, 0);
$$;

-- Perfil por endereço (/criakut/luana): o perfil, serviços, portfólio e números.
create or replace function public.criakut_perfil(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _p criakut_perfis; _eu uuid := auth.uid();
begin
  if _eu is null then return null; end if;
  select * into _p from criakut_perfis where slug = lower(_slug);
  if not found or (not _p.publicado and _p.user_id <> _eu) then return null; end if;
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
                                     where f.seguido = _p.user_id order by f.criado_em desc limit 6) q), '[]'::jsonb)
    );
end $$;

revoke all on function public.criakut_buscar(text, text[], text[], integer, text, text, integer, integer) from public, anon;
revoke all on function public.criakut_perfil(text) from public, anon;
grant execute on function public.criakut_buscar(text, text[], text[], integer, text, text, integer, integer) to authenticated;
grant execute on function public.criakut_perfil(text) to authenticated;
