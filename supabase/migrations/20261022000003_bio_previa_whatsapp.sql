-- ═══════════════════════════════════════════════════════════════════════════
-- PRÉVIA DA BIO NO WHATSAPP (22/10/2026)
--
-- Uma chamada só com tudo que a arte do link precisa: quem é o dono (pra
-- conferir de quem é cada foto), nome, bio, foto, cores, as seções NO AR do
-- Site e, se a capa de criadora pede, o número de seguidores.
--
-- Só sai o que já é público: a página pública mostra os mesmos blocos e as
-- mesmas cores. Seções desligadas, agendadas pra depois ou vencidas ficam de
-- fora. O dono sai do slug; nada que chega do visitante escolhe de quem é.
-- ═══════════════════════════════════════════════════════════════════════════

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
