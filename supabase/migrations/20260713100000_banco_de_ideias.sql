-- ============================================================
-- BANCO DE IDEIAS DO CLIENTE
--
-- A agência precisa de um lugar só com TUDO que inspira aquele cliente:
--   1. as ideias que o CLIENTE criou na conta CRIA dele        (tabela ideas)
--   2. os posts que o CLIENTE salvou como referência           (tabela saved_refs)
--   3. as ideias que o HUB gerou pra ele                       (creative_ideas — já existe)
--   4. os links que a SOCIAL MÍDIA salva pra ele               (crm_saved_refs — nasce aqui)
--
-- 1 e 2 vivem na conta do cliente: o gestor não tem RLS lá. Vai por RPC.
-- ============================================================


-- ── Salvos da social mídia (privados dela, por cliente) ────────────────
create table if not exists public.crm_saved_refs (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  url           text not null,
  title         text,
  note          text,
  thumbnail_url text,
  author        text,
  created_at    timestamptz not null default now()
);

create index if not exists crm_saved_refs_client_idx on public.crm_saved_refs (crm_client_id, created_at desc);

alter table public.crm_saved_refs enable row level security;

drop policy if exists crm_saved_refs_owner on public.crm_saved_refs;
create policy crm_saved_refs_owner on public.crm_saved_refs
  for all to authenticated
  using (public.acts_for(manager_id))
  with check (public.acts_for(manager_id));

comment on table public.crm_saved_refs is
  'Referências (links do Instagram) que a social mídia salva dentro de um cliente. Só ela vê.';


-- ── Ideias e salvos do cliente CRIA (leitura pelo gestor) ──────────────
drop function if exists public.manager_client_ideas(uuid);
create function public.manager_client_ideas(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _ideas jsonb; _refs jsonb;
begin
  -- Mesma trava das outras: só quem gerencia aquele cliente enxerga.
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('ideas', '[]'::jsonb, 'saved', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'title', i.title, 'notes', i.notes,
           'platform', i.platform, 'objective', i.objective,
           'status', i.idea_status, 'origin', i.origin,
           'created_at', i.created_at)
           order by i.created_at desc), '[]'::jsonb)
    into _ideas
  from public.ideas i
  where i.user_id = client_owner_id
  limit 100;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'url', s.url, 'caption', s.caption,
           'author', s.author, 'media_type', s.media_type,
           'thumbnail_url', s.thumbnail_url, 'note', s.note,
           'folder', s.folder, 'created_at', s.created_at)
           order by s.created_at desc), '[]'::jsonb)
    into _refs
  from public.saved_refs s
  where s.user_id = client_owner_id
  limit 100;

  return jsonb_build_object('ideas', _ideas, 'saved', _refs);
end; $$;
grant execute on function public.manager_client_ideas(uuid) to authenticated;
