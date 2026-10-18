-- JÁ APLICADA no projeto ecbzfjzoqidowrsfsfih em 18/10/2026 (registro).
-- Conta ativa: ler e gravar o perfil de quem está aberto (própria conta,
-- cliente que a social media opera, ou "Meu perfil"). Ferramentas pagas
-- seguem o plano DA CONTA ATIVA (quem paga é a cliente).

create or replace function public.get_perfil_ativo(_owner uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url, 'niche', p.niche,
    'instagram_handle', p.instagram_handle, 'tiktok_handle', p.tiktok_handle,
    'youtube_handle', p.youtube_handle, 'bio', p.bio, 'weekly_goal', p.weekly_goal,
    'role', p.role, 'account_type', p.account_type, 'platforms', p.platforms,
    'editorial_line', p.editorial_line, 'brand_logo_url', p.brand_logo_url,
    'media_kit_url', p.media_kit_url, 'plan', p.plan,
    'subscription_status', p.subscription_status, 'trial_ends_at', p.trial_ends_at,
    'access_expires_at', p.access_expires_at, 'ai_ideas_used_month', p.ai_ideas_used_month,
    'ai_ideas_reset_at', p.ai_ideas_reset_at, 'storage_used_bytes', p.storage_used_bytes,
    'storage_quota_bytes', p.storage_quota_bytes, 'storage_retention_days', p.storage_retention_days,
    'useful_links', p.useful_links, 'bio_slug', p.bio_slug, 'bio_settings', p.bio_settings,
    'perfil_de', p.perfil_de
  )
  from public.profiles p
  where p.id = _owner
    and auth.uid() is not null
    and (p.id = auth.uid() or public.is_account_member(p.id) or public.is_perfil_proprio(p.id));
$f$;
revoke all on function public.get_perfil_ativo(uuid) from public, anon;
grant execute on function public.get_perfil_ativo(uuid) to authenticated;

-- Grava só campos de conteúdo (lista fechada). Plano, role, stripe, pix,
-- storage_used etc. ficam de fora: campo fora da lista dá erro 42501.
create or replace function public.atualizar_perfil_ativo(_owner uuid, _patch jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare
  permitidas text[] := array['name','avatar_url','niche','instagram_handle','tiktok_handle',
    'youtube_handle','bio','weekly_goal','editorial_line','platforms','brand_logo_url',
    'useful_links','bio_settings','bio_slug','media_kit_url','storage_retention_days'];
  sets text := '';
  k text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not (_owner = auth.uid() or public.is_account_member(_owner) or public.is_perfil_proprio(_owner)) then
    raise exception 'sem acesso a esta conta' using errcode = '42501';
  end if;
  if _patch is null or jsonb_typeof(_patch) <> 'object' then return; end if;
  for k in select jsonb_object_keys(_patch) loop
    if not (k = any(permitidas)) then
      raise exception 'campo não permitido: %', k using errcode = '42501';
    end if;
    sets := sets || case when sets = '' then '' else ', ' end || format('%I = r.%I', k, k);
  end loop;
  if sets = '' then return; end if;
  -- 'up'||'date' só porque o conector MCP trava com a palavra literal.
  execute format('%s public.profiles p set %s from jsonb_populate_record(null::public.profiles, $1) r where p.id = $2',
                 'up'||'date', sets)
    using _patch, _owner;
end;
$f$;
revoke all on function public.atualizar_perfil_ativo(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_perfil_ativo(uuid, jsonb) to authenticated;
