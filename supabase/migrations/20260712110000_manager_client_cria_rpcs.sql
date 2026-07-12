-- ============================================================
-- PACOTE ÚNICO — tudo que o código já usa e o banco ainda não tem.
-- Idempotente: pode rodar mesmo que parte já exista.
--
-- Auditado contra src/integrations/supabase/types.ts (que é gerado do banco real).
-- O que JÁ existe e NÃO é tocado aqui: get_external_client_by_token,
-- get_external_handle_by_token, portal_mark_viewed, acts_for, get_token_period,
-- manager_client_posts, external_clients.brand_color, approval_tokens.last_viewed_at.
-- ============================================================


-- ── 1. Forma de pagamento padronizada ──────────────────────────────────
-- Existia só em fin_records. Sem isso não dá pra mostrar "como o cliente paga"
-- na ficha, nem herdar a forma nos lançamentos recorrentes.
alter table public.crm_clients   add column if not exists payment_method text;
alter table public.fin_recurring add column if not exists payment_method text;


-- ── 2. Gestor → dados da conta CRIA do cliente ─────────────────────────
-- O front (useManagerClientCria) já chama estas três. Elas nunca foram criadas
-- → foto, Instagram e Brandbook do cliente não carregavam.
-- SECURITY DEFINER de propósito (fura o RLS), com a trava abaixo.

create or replace function public.manager_owns_cria_client(_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_clients c
    where c.cria_owner_id = _owner
      and public.acts_for(c.manager_id)     -- dono OU colaborador ativo do time
  );
$$;
grant execute on function public.manager_owns_cria_client(uuid) to authenticated;

drop function if exists public.manager_clients_cria_profiles();
create function public.manager_clients_cria_profiles()
returns table (cria_owner_id uuid, name text, avatar_url text, niche text)
language sql stable security definer set search_path = public as $$
  select distinct on (c.cria_owner_id) c.cria_owner_id, p.name, p.avatar_url, p.niche
  from public.crm_clients c
  join public.profiles p on p.id = c.cria_owner_id
  where c.cria_owner_id is not null and public.acts_for(c.manager_id)
  order by c.cria_owner_id;
$$;
grant execute on function public.manager_clients_cria_profiles() to authenticated;

drop function if exists public.manager_client_instagram(uuid);
create function public.manager_client_instagram(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _conn record; _daily jsonb; _media jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('connected', false);
  end if;

  select sc.username, sc.profile_picture_url, sc.updated_at into _conn
  from public.social_connections sc
  where sc.user_id = client_owner_id
    and sc.provider = 'instagram'
    and sc.crm_client_id is null        -- a conta pessoal dele, não a de um cliente dele
  limit 1;

  if not found then return jsonb_build_object('connected', false); end if;

  select coalesce(jsonb_agg(d order by d.date), '[]'::jsonb) into _daily
  from (
    select m.date, m.followers, m.reach, m.profile_views, m.total_interactions
    from public.social_metrics_daily m
    where m.user_id = client_owner_id and m.provider = 'instagram'
      and m.date >= (current_date - interval '90 days')
    order by m.date
  ) d;

  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media
  from (
    select i.id, i.media_type, i.caption, i.permalink, i.thumbnail_url, i.posted_at, i.metrics
    from public.social_insights i
    where i.user_id = client_owner_id and i.provider = 'instagram' and i.object_type = 'media'
    order by i.posted_at desc nulls last
    limit 24
  ) x;

  return jsonb_build_object(
    'connected', true, 'username', _conn.username,
    'profile_picture_url', _conn.profile_picture_url, 'last_sync', _conn.updated_at,
    'daily', _daily, 'media', _media);
end; $$;
grant execute on function public.manager_client_instagram(uuid) to authenticated;

drop function if exists public.manager_client_brandbook(uuid);
create function public.manager_client_brandbook(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _profile jsonb; _pillars jsonb; _items jsonb; _pers jsonb; _mood jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('profile', null, 'pillars', '[]'::jsonb,
      'brand_items', '[]'::jsonb, 'personas', '[]'::jsonb, 'moodboard', '[]'::jsonb);
  end if;

  select jsonb_build_object('name', p.name, 'niche', p.niche, 'avatar_url', p.avatar_url)
    into _profile from public.profiles p where p.id = client_owner_id;

  select coalesce(jsonb_agg(x.name order by x.position nulls last), '[]'::jsonb) into _pillars
  from (select pi.name, pi.position from public.pillars pi where pi.user_id = client_owner_id) x;

  select coalesce(jsonb_agg(jsonb_build_object('type', b.type, 'name', b.name, 'value', b.value)
                            order by b.type, b.position nulls last), '[]'::jsonb) into _items
  from public.brand_items b where b.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', pe.name, 'age_range', pe.age_range, 'gender', pe.gender,
           'location', pe.location, 'pain_points', pe.pain_points,
           'desires', pe.desires, 'interests', pe.interests,
           'how_you_help', pe.how_you_help)), '[]'::jsonb) into _pers
  from public.personas pe where pe.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'section', me.section, 'question_key', me.question_key, 'answer', me.answer)
           order by me.section, me.question_key), '[]'::jsonb) into _mood
  from public.moodboard_entries me
  where me.user_id = client_owner_id and me.answer is not null and btrim(me.answer) <> '';

  return jsonb_build_object('profile', _profile, 'pillars', _pillars,
    'brand_items', _items, 'personas', _pers, 'moodboard', _mood);
end; $$;
grant execute on function public.manager_client_brandbook(uuid) to authenticated;


-- ── 3. Área do Cliente: abas extras do portal ──────────────────────────
-- O portal (AprovarPortal.tsx) JÁ tem as abas Calendário e Relatório prontas,
-- escondidas atrás de get_portal_settings — que nunca existiu. Ficavam apagadas.
-- A config mora no CLIENTE (vale pra todos os links dele), não no token.
alter table public.external_clients
  add column if not exists portal_settings jsonb not null default '{}'::jsonb;

drop function if exists public.get_portal_settings(text);
create function public.get_portal_settings(_token text)
returns table (settings jsonb)
language sql stable security definer set search_path = public as $$
  select coalesce(ec.portal_settings, '{}'::jsonb)
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;
$$;
grant execute on function public.get_portal_settings(text) to anon, authenticated;

comment on column public.external_clients.portal_settings is
  'Abas extras do portal do cliente: {"show_calendar": true, "show_report": true}';


-- ── 4. Bucket público dos relatórios ───────────────────────────────────
-- Necessário pro "Copiar link" do relatório. Idempotente.
insert into storage.buckets (id, name, public)
values ('relatorios', 'relatorios', true)
on conflict (id) do update set public = true;

drop policy if exists "relatorios_public_read" on storage.objects;
create policy "relatorios_public_read" on storage.objects
  for select using (bucket_id = 'relatorios');

drop policy if exists "relatorios_owner_insert" on storage.objects;
create policy "relatorios_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "relatorios_owner_update" on storage.objects;
create policy "relatorios_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "relatorios_owner_delete" on storage.objects;
create policy "relatorios_owner_delete" on storage.objects
  for delete using (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);
