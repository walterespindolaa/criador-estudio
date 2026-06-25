-- Relatório da social mídia lê os insights que o PRÓPRIO CLIENTE conectou.
-- Caminho: crm_clients.cria_owner_id = conta CRIA do cliente (que conectou o IG dele).
-- SECURITY DEFINER + checagem de que quem chama é o gestor daquele cliente (RLS by-pass controlado).

create or replace function public.get_client_ig_media(
  _crm_client_id uuid,
  _since timestamptz,
  _until timestamptz
)
returns table (caption text, media_type text, posted_at timestamptz, metrics jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _mgr uuid;
begin
  select cria_owner_id, manager_id into _owner, _mgr
  from public.crm_clients where id = _crm_client_id;

  -- só o gestor dono do cliente pode ler
  if _mgr is null or _mgr <> auth.uid() then
    return;
  end if;
  -- cliente sem conta CRIA conectada: nada a retornar
  if _owner is null then
    return;
  end if;

  return query
    select si.caption, si.media_type, si.posted_at, si.metrics
    from public.social_insights si
    where si.user_id = _owner
      and si.provider = 'instagram'
      and si.object_type = 'media'
      and si.posted_at >= _since
      and si.posted_at < _until;
end;
$$;

grant execute on function public.get_client_ig_media(uuid, timestamptz, timestamptz) to authenticated;
