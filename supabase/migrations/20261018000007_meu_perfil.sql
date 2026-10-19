-- JÁ APLICADA no projeto ecbzfjzoqidowrsfsfih em 18/10/2026 (registro).
-- MEU PERFIL (opção A): a dona (profiles.perfil_de = sessão) age no perfil
-- como a gestora age na conta de uma cliente, SEM linha em account_members:
-- o perfil não vira cliente da carteira, não conta assento, e o time da
-- agência não enxerga. O perfil nasce pela edge criar-meu-perfil.

create or replace function public.is_account_member(_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (select 1 from public.account_members am
    where am.owner_id = _owner and am.member_id = auth.uid() and am.status = 'active')
  or exists (select 1 from public.profiles p
    where p.id = _owner and p.perfil_de = auth.uid() and auth.uid() is not null);
$f$;

create or replace function public.is_account_manager(_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (select 1 from public.account_members
    where owner_id = _owner and member_id = auth.uid() and status = 'active')
  or exists (select 1 from public.profiles p
    where p.id = _owner and p.perfil_de = auth.uid() and auth.uid() is not null);
$f$;

create or replace function public.meu_perfil()
returns table(owner_id uuid, name text, avatar_url text, niche text, instagram_handle text,
              plan text, subscription_status text, trial_ends_at timestamptz)
language sql stable security definer set search_path to 'public' as $f$
  select p.id, p.name, p.avatar_url, p.niche, p.instagram_handle, p.plan, p.subscription_status, p.trial_ends_at
  from public.profiles p
  where auth.uid() is not null and p.perfil_de = auth.uid()
  limit 1;
$f$;
revoke all on function public.meu_perfil() from public, anon;
grant execute on function public.meu_perfil() to authenticated;

-- Arquivos do perfil (buckets que a gestora já usa na pasta da cliente).
create policy "Perfil proprio gerencia arquivos" on storage.objects for all to authenticated
  using (bucket_id in ('files','bio-media','media')
         and (storage.foldername(name))[1] in (select p.id::text from public.profiles p where p.perfil_de = auth.uid()))
  with check (bucket_id in ('files','bio-media','media')
         and (storage.foldername(name))[1] in (select p.id::text from public.profiles p where p.perfil_de = auth.uid()));

-- Conta ativa: Pix aparece e é gravável SÓ pra dona (ela mesma ou o Meu perfil).
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
    'perfil_de', p.perfil_de,
    'pix_key', case when p.id = auth.uid() or p.perfil_de = auth.uid() then p.pix_key else null end
  )
  from public.profiles p
  where p.id = _owner
    and auth.uid() is not null
    and (p.id = auth.uid() or public.is_account_member(p.id) or public.is_perfil_proprio(p.id)
         or public.is_team_member(p.id));
$f$;

create or replace function public.atualizar_perfil_ativo(_owner uuid, _patch jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare
  permitidas text[] := array['name','avatar_url','niche','instagram_handle','tiktok_handle',
    'youtube_handle','bio','weekly_goal','editorial_line','platforms','brand_logo_url',
    'useful_links','bio_settings','bio_slug','media_kit_url','storage_retention_days','pix_key'];
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
    if k = 'pix_key' and not dona then
      raise exception 'campo não permitido: %', k using errcode = '42501';
    end if;
    sets := sets || case when sets = '' then '' else ', ' end || format('%I = r.%I', k, k);
  end loop;
  if sets = '' then return; end if;
  execute format('%s public.profiles p set %s from jsonb_populate_record(null::public.profiles, $1) r where p.id = $2',
                 'up'||'date', sets)
    using _patch, _owner;
end;
$f$;
