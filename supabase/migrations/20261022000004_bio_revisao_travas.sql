-- ═══════════════════════════════════════════════════════════════════════════
-- REVISÃO DE PONTA A PONTA DA BIO (22/10/2026)
--
-- 1) ENDEREÇO RESERVADO. Nada impedia alguém de escolher "login", "app" ou
--    "signup" como endereço da bio. As rotas do app vêm antes da rota da bio,
--    então criaclub.bio/login abriria o login, nunca a página da pessoa, e a
--    prévia do WhatsApp também não sairia. Agora o banco recusa esses nomes.
--    A mesma lista mora em src/lib/previa-bio.ts (RESERVADOS).
--
-- 2) DE QUEM PODE SER A FOTO NA ARTE DO WHATSAPP. A regra "só da pasta do
--    dono" barrava foto legítima: quando a gestora monta a página do cliente,
--    a foto sobe na pasta DELA (3 casos assim no banco hoje). A prévia passa a
--    receber a lista de pastas de quem pode editar aquela página, a mesma
--    turma que a RLS de bio_blocks deixa escrever:
--    · conta: o dono, quem é membro ativo da conta dele (account_members), o
--      perfil-pai (perfil_de) e o time do dono (manager_members ativo);
--    · página da agência: a gestora e o time dela.
--    Foto de qualquer outra pasta continua fora.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bio_slug_reservado(_slug text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select lower(btrim(coalesce(_slug, ''))) = any (array[
    'app','api','auth','login','signup','cadastrar','entrar','onboarding','obrigado','termos',
    'privacidade','excluir-dados','reset-password','socialmidia','parceiro','parceiros','admin',
    'aprovar','materiais','roteiros','cronograma','proposta','agendar','cadastro','acessos',
    'conectar','p','assets','fonts','icons','bio','ativar','comecar-agencia'
  ]);
$$;

create or replace function public.bio_slug_available(_slug text, _exclude uuid default null::uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(btrim(_slug), '') <> ''
    and not public.bio_slug_reservado(_slug)
    and not exists (
      select 1 from public.profiles p
      where lower(p.bio_slug) = lower(btrim(_slug))
        and coalesce(p.bio_slug, '') <> ''
        and (_exclude is null or p.id <> _exclude)
    ) and not exists (
      select 1 from public.bio_pages bp
      where lower(bp.slug) = lower(btrim(_slug))
        and coalesce(bp.slug, '') <> ''
        and (_exclude is null or bp.id <> _exclude)
    );
$function$;

create or replace function public.bio_pastas_da_pagina(_dono uuid, _pagina uuid)
returns uuid[]
language sql
stable security definer
set search_path to 'public'
as $$
  select array(
    select distinct x from (
      select _dono as x
      union all
      select mm.member_id from public.manager_members mm
       where mm.manager_id = _dono and mm.status = 'ativo' and not public.eh_papel_parceiro(mm.role)
      union all
      select am.member_id from public.account_members am
       where _pagina is null and am.owner_id = _dono and am.status = 'active'
      union all
      select p.perfil_de from public.profiles p
       where _pagina is null and p.id = _dono and p.perfil_de is not null
    ) t where x is not null
  );
$$;
revoke all on function public.bio_pastas_da_pagina(uuid, uuid) from public, anon, authenticated;

create or replace function public.bio_pastas_visiveis(_dono uuid, _pagina uuid, _texto text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  -- Só as pastas que JÁ aparecem nos endereços de foto da própria página e
  -- que pertencem a quem pode editá-la. Nenhum id novo sai daqui.
  select coalesce(jsonb_agg(distinct m[1]), '[]'::jsonb)
  from regexp_matches(coalesce(_texto, ''), '/object/public/(?:bio-media|avatars)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/', 'g') m
  where m[1]::uuid = any (public.bio_pastas_da_pagina(_dono, _pagina));
$$;
revoke all on function public.bio_pastas_visiveis(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.get_bio_previa(_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _s text := lower(btrim(coalesce(_slug, '')));
  _dono uuid;
  _pagina uuid;
  _origem text;
  _nome text;
  _bio text;
  _avatar text;
  _slug_ok text;
  _cfg jsonb;
  _blocos jsonb := '[]'::jsonb;
  _seg integer;
begin
  if length(_s) = 0 or length(_s) > 120 then return null; end if;

  select p.id, 'perfil', p.name, p.bio, p.avatar_url, p.bio_settings, p.bio_slug
    into _dono, _origem, _nome, _bio, _avatar, _cfg, _slug_ok
  from public.profiles p
  where lower(btrim(p.bio_slug)) = _s
  limit 1;

  if _dono is null then
    select bp.manager_id, bp.id, 'pagina', c.name::text, null::text, c.logo::text, bp.settings, bp.slug::text
      into _dono, _pagina, _origem, _nome, _bio, _avatar, _cfg, _slug_ok
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
    where lower(bp.slug) = _s
    limit 1;
  end if;
  if _dono is null then return null; end if;

  _cfg := coalesce(_cfg, '{}'::jsonb);

  if _cfg->>'layout' = 'vitrine' then
    select coalesce(jsonb_agg(jsonb_build_object('kind', b.kind, 'data', b.data) order by b.position), '[]'::jsonb)
      into _blocos
    from (
      select b.kind, b.data, b.position
      from public.bio_blocks b
      where b.estilo = 'site' and b.is_active
        and ((_pagina is null and b.page_id is null and b.user_id = _dono) or (_pagina is not null and b.page_id = _pagina))
        and (b.starts_at is null or b.starts_at <= now())
        and (b.ends_at is null or b.ends_at > now())
      order by b.position
      limit 40
    ) b;

    if exists (
      select 1 from jsonb_array_elements(_blocos) x
      where x->>'kind' = 'perfil_criadora'
        and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(x->'data'->'redes') = 'array' then x->'data'->'redes' else '[]'::jsonb end) r
                    where r->>'rede' = 'instagram' and r->'auto' = 'true'::jsonb)
    ) then
      _seg := nullif(public.get_public_bio_social(_s)->>'seguidores', '')::integer;
    end if;
  end if;

  return jsonb_build_object(
    'slug', lower(_slug_ok),
    'origem', _origem,
    'dono', _dono,
    'pastas', public.bio_pastas_visiveis(_dono, _pagina, coalesce(_blocos::text, '') || ' ' || coalesce(_avatar, '') || ' ' || coalesce((_cfg->'header')::text, '') || ' ' || coalesce(_cfg->>'bannerImage', '')),
    'nome', _nome,
    'bio', _bio,
    'avatar', _avatar,
    'ajustes', jsonb_build_object(
      'layout', _cfg->'layout',
      'buttonColor', _cfg->'buttonColor',
      'buttonTextColor', _cfg->'buttonTextColor',
      'bannerImage', _cfg->'bannerImage',
      'header', jsonb_build_object('name', _cfg->'header'->'name', 'bio', _cfg->'header'->'bio', 'avatar', _cfg->'header'->'avatar')
    ),
    'blocos', _blocos,
    'seguidores', _seg
  );
end;
$$;

revoke all on function public.get_bio_previa(text) from public;
grant execute on function public.get_bio_previa(text) to anon, authenticated, service_role;
