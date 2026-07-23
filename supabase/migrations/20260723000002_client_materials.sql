-- ============================================================
-- QUADRO DE MATERIAIS (demandas de material que fogem do fluxo de posts)
--
-- Duas pontas:
--   (1) GESTOR: kanban na ficha do cliente (Solicitado / A fazer / Em aprovação /
--       Ajuste / Finalizado). CRUD via RLS de time (acts_for), igual crm_clients.
--   (2) CLIENTE: solicita material pelo portal público (mesmo token de aprovação),
--       sem login, via RPC SECURITY DEFINER. A solicitação cai como
--       requested_by='cliente', status='solicitado', e avisa o gestor no sininho.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- ============================================================

create table if not exists public.client_materials (
  id                 uuid primary key default gen_random_uuid(),
  manager_id         uuid not null references auth.users(id) on delete cascade,
  crm_client_id      uuid references public.crm_clients(id) on delete cascade,
  external_client_id uuid references public.external_clients(id) on delete set null,
  title              text not null,
  description        text,
  -- apresentacao | flyer | arte_avulsa | logo | outro
  kind               text not null default 'arte_avulsa',
  -- solicitado | a_fazer | em_aprovacao | ajuste | finalizado
  status             text not null default 'a_fazer',
  -- gestor | cliente  (de onde veio a demanda)
  requested_by       text not null default 'gestor',
  due_date           date,
  attachments        jsonb not null default '[]'::jsonb,
  position           int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

grant select, insert, update, delete on public.client_materials to authenticated;
grant all on public.client_materials to service_role;

alter table public.client_materials enable row level security;

-- RLS ADITIVA de time: dono do tenant OU colaborador ativo dele (mesmo padrão
-- das outras tabelas da agência). O escopo por cliente (can_client) segue sendo
-- controlado na UI nesta fase, como nas demais tabelas manager_id-keyed.
drop policy if exists "client_materials_team" on public.client_materials;
create policy "client_materials_team" on public.client_materials
  for all to authenticated
  using (public.acts_for(manager_id))
  with check (public.acts_for(manager_id));

create index if not exists idx_client_materials_client
  on public.client_materials (crm_client_id, status);
create index if not exists idx_client_materials_manager
  on public.client_materials (manager_id, created_at desc);

-- keep updated_at fresh
create or replace function public.touch_client_materials()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_client_materials on public.client_materials;
create trigger trg_touch_client_materials
  before update on public.client_materials
  for each row execute function public.touch_client_materials();

-- ── CLIENTE solicita material pelo portal (por token, sem login) ──────────
-- Deriva manager_id / crm_client_id / external_client_id do próprio token.
-- Marca origem = cliente e coluna inicial = 'solicitado'. Avisa o gestor.
create or replace function public.request_material_by_token(
  _token text, _title text, _description text, _kind text default 'arte_avulsa'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _mgr uuid; _crm uuid; _ec uuid; _cname text; _id uuid; _k text;
begin
  select ec.manager_id, ec.crm_client_id, ec.id, coalesce(ec.name, 'O cliente')
    into _mgr, _crm, _ec, _cname
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if _mgr is null then
    raise exception 'Link inválido ou expirado';
  end if;
  if _title is null or btrim(_title) = '' then
    raise exception 'Título obrigatório';
  end if;

  _k := lower(coalesce(_kind, 'arte_avulsa'));
  if _k not in ('apresentacao','flyer','arte_avulsa','logo','outro') then
    _k := 'outro';
  end if;

  insert into public.client_materials
    (manager_id, crm_client_id, external_client_id, title, description, kind, status, requested_by)
  values
    (_mgr, _crm, _ec, btrim(_title), nullif(btrim(coalesce(_description,'')), ''), _k, 'solicitado', 'cliente')
  returning id into _id;

  -- avisa o gestor no sininho (mesmo padrão do event_notifications)
  insert into public.notifications (user_id, type, title, description, link)
  values (_mgr, 'material', 'Novo pedido de material',
          _cname || ' solicitou: ' || btrim(_title),
          case when _crm is not null
               then '/socialmidia/clientes/' || _crm::text || '/materiais'
               else '/socialmidia/clientes' end);

  return _id;
end; $$;
grant execute on function public.request_material_by_token(text, text, text, text) to anon, authenticated;

-- ── CLIENTE lê o status só do que ELE mesmo pediu (não vê o trabalho interno) ──
create or replace function public.list_materials_by_token(_token text)
returns table (id uuid, title text, description text, kind text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, m.description, m.kind, m.status, m.created_at
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  join public.client_materials m on m.external_client_id = ec.id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and m.requested_by = 'cliente'
  order by m.created_at desc;
$$;
grant execute on function public.list_materials_by_token(text) to anon, authenticated;

comment on table public.client_materials is
  'Demandas de material fora do fluxo de posts. Origem gestor ou cliente (via portal por token).';
