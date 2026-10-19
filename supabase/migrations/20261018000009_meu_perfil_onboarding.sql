-- Meu perfil nasce sem onboarding (18/10/2026). A dona passa pelo onboarding de
-- criadora na primeira vez que abre o perfil, e o fim dele marca o perfil.
-- 1. get_perfil_ativo devolve onboarding_completed (o AppLayout desvia pro /onboarding).
-- 2. atualizar_perfil_ativo aceita onboarding_completed, mas só da dona (nunca
--    da social mídia de uma cliente, que não pode "pular" o onboarding de ninguém).

create or replace function public.get_perfil_ativo(_owner uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
    'perfil_de', p.perfil_de, 'onboarding_completed', p.onboarding_completed,
    -- Pix só pra quem é a dona da conta (ela mesma ou o Meu perfil dela).
    'pix_key', case when p.id = auth.uid() or p.perfil_de = auth.uid() then p.pix_key else null end
  )
  from public.profiles p
  where p.id = _owner
    and auth.uid() is not null
    and (p.id = auth.uid() or public.is_account_member(p.id) or public.is_perfil_proprio(p.id)
         or public.is_team_member(p.id));
$function$;

create or replace function public.atualizar_perfil_ativo(_owner uuid, _patch jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  permitidas text[] := array['name','avatar_url','niche','instagram_handle','tiktok_handle',
    'youtube_handle','bio','weekly_goal','editorial_line','platforms','brand_logo_url',
    'useful_links','bio_settings','bio_slug','media_kit_url','storage_retention_days','pix_key',
    'onboarding_completed'];
  sets text := '';
  k text;
  dona boolean;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not (_owner = auth.uid() or public.is_account_member(_owner) or public.is_perfil_proprio(_owner)) then
    raise exception 'sem acesso a esta conta' using errcode = '42501';
  end if;
  dona := _owner = auth.uid() or public.is_perfil_proprio(_owner);
  if _patch is null or jsonb_typeof(_patch) <> 'object' then return; end if;
  for k in select jsonb_object_keys(_patch) loop
    if not (k = any(permitidas)) then
      raise exception 'campo não permitido: %', k using errcode = '42501';
    end if;
    -- Pix e onboarding são da dona (nunca da social media da cliente).
    if k in ('pix_key', 'onboarding_completed') and not dona then
      raise exception 'campo não permitido: %', k using errcode = '42501';
    end if;
    sets := sets || case when sets = '' then '' else ', ' end || format('%I = r.%I', k, k);
  end loop;
  if sets = '' then return; end if;
  execute format('%s public.profiles p set %s from jsonb_populate_record(null::public.profiles, $1) r where p.id = $2',
                 'up'||'date', sets)
    using _patch, _owner;
end;
$function$;
