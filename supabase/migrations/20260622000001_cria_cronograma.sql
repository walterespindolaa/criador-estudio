-- CRIA Cronograma: aprovação de calendário de conteúdos (vertente do Cria Post).
-- Social media monta o cronograma -> envia link -> cliente aprova/recusa/pede ajuste por item.

-- 1) Cronograma (1 por cliente/mês)
create table if not exists public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,  -- social media (dono)
  title text not null,                                  -- ex.: "Julho 2026"
  client_label text,                                    -- nome do cliente (exibição)
  crm_client_id uuid,                                   -- cliente do CRM (Cria Gestão), se houver
  cria_owner_id uuid,                                   -- conta CRIA do cliente (alvo da conversão p/ kanban), se for cliente do CRIA
  status text not null default 'rascunho',              -- rascunho | enviado | aprovado | arquivado
  token text unique default replace(gen_random_uuid()::text, '-', ''),  -- link público
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cronogramas enable row level security;
drop policy if exists "Managers manage own cronogramas" on public.cronogramas;
create policy "Managers manage own cronogramas" on public.cronogramas
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);
create index if not exists idx_cronogramas_manager on public.cronogramas (manager_id);

-- 2) Itens do cronograma
create table if not exists public.cronograma_items (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronogramas(id) on delete cascade,
  sort_order int not null default 0,
  copy text,                                            -- título/copy
  description text,
  date date,
  type text,                                            -- Reels | Carrossel | Feed | Stories | Carrossel/Stories | Feed/Stories
  approval_status text not null default 'pendente',     -- pendente | aprovado | recusado | ajuste
  client_comment text,                                  -- motivo do ajuste/recusa
  converted_post_id uuid references public.posts(id) on delete set null,  -- evita converter duas vezes
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cronograma_items enable row level security;
drop policy if exists "Managers manage own cronograma items" on public.cronograma_items;
create policy "Managers manage own cronograma items" on public.cronograma_items
  for all using (exists (select 1 from public.cronogramas c where c.id = cronograma_id and c.manager_id = auth.uid()))
  with check (exists (select 1 from public.cronogramas c where c.id = cronograma_id and c.manager_id = auth.uid()));
create index if not exists idx_cronograma_items_cron on public.cronograma_items (cronograma_id, sort_order);

-- 3) RPC pública: cliente vê o cronograma pelo token (sem login)
create or replace function public.get_cronograma_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c public.cronogramas; _items jsonb;
begin
  select * into _c from public.cronogramas where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'copy', i.copy, 'description', i.description, 'date', i.date,
           'type', i.type, 'approval_status', i.approval_status, 'client_comment', i.client_comment
         ) order by i.sort_order, i.created_at), '[]'::jsonb)
    into _items from public.cronograma_items i where i.cronograma_id = _c.id;

  return jsonb_build_object(
    'title', _c.title, 'client_label', _c.client_label, 'status', _c.status, 'items', _items);
end; $$;

-- 4) RPC pública: cliente aprova/recusa/pede ajuste num item
create or replace function public.set_cronograma_item_by_token(_token text, _item_id uuid, _status text, _comment text)
returns boolean language plpgsql security definer set search_path = public as $$
declare _cid uuid;
begin
  select c.id into _cid from public.cronogramas c
    join public.cronograma_items i on i.cronograma_id = c.id
   where c.token = _token and i.id = _item_id;
  if _cid is null then return false; end if;
  if _status not in ('aprovado','recusado','ajuste','pendente') then return false; end if;

  update public.cronograma_items
     set approval_status = _status,
         client_comment = case when _status in ('recusado','ajuste') then _comment else null end,
         updated_at = now()
   where id = _item_id;
  return true;
end; $$;

grant execute on function public.get_cronograma_by_token(text) to anon, authenticated;
grant execute on function public.set_cronograma_item_by_token(text, uuid, text, text) to anon, authenticated;
