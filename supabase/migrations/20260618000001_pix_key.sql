alter table public.profiles add column if not exists pix_key text;

-- get_proposal_by_token: + pix_key no creator (resto idêntico)
create or replace function public.get_proposal_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c public.collabs; _delivs jsonb; _creator jsonb;
begin
  select * into _c from public.collabs
   where proposal_token = _token and proposal_status <> 'none';
  if not found then return null; end if;

  if _c.proposal_status = 'enviada' then
    update public.collabs set proposal_status = 'vista', proposal_viewed_at = now()
     where id = _c.id;
    _c.proposal_status := 'vista';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', d.label, 'format', d.format)
           order by d.sort_order), '[]'::jsonb)
    into _delivs from public.collab_deliverables d where d.collab_id = _c.id;

  select jsonb_build_object(
           'name', p.name, 'handle', p.instagram_handle, 'avatar', p.avatar_url,
           'theme_accent', p.theme_accent, 'media_kit', p.media_kit_url, 'pix_key', p.pix_key)
    into _creator from public.profiles p where p.id = _c.user_id;

  return jsonb_build_object(
    'brand', _c.brand, 'objective', _c.objective, 'value', _c.value,
    'terms', _c.proposal_terms, 'valid_until', _c.proposal_valid_until,
    'status', _c.proposal_status, 'client_comment', _c.proposal_client_comment,
    'deliverables', _delivs, 'creator', _creator);
end; $$;
