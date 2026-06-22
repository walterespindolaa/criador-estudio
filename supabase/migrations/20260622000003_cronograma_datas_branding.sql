-- Cronograma: (1) datas comemorativas que o cliente marca, (2) branding do cabeçalho
-- público (cor do tema da social media + logo + @ do cliente).

-- 1) @ do cliente exibido no cabeçalho
alter table public.cronogramas add column if not exists client_handle text;

-- 2) logo da social media (aparece no cabeçalho público; opcional)
alter table public.profiles add column if not exists brand_logo_url text;

-- 3) datas comemorativas do cronograma
create table if not exists public.cronograma_datas (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronogramas(id) on delete cascade,
  label text not null,                 -- "Dia dos Namorados"
  day_label text,                      -- "12/06" | "mês inteiro" | "data móvel"
  sort_order int not null default 0,
  selected boolean not null default false,  -- cliente marcou que quer trabalhar
  created_at timestamptz default now()
);
alter table public.cronograma_datas enable row level security;
drop policy if exists "Managers manage own cronograma datas" on public.cronograma_datas;
create policy "Managers manage own cronograma datas" on public.cronograma_datas
  for all using (exists (select 1 from public.cronogramas c where c.id = cronograma_id and c.manager_id = auth.uid()))
  with check (exists (select 1 from public.cronogramas c where c.id = cronograma_id and c.manager_id = auth.uid()));
create index if not exists idx_cronograma_datas_cron on public.cronograma_datas (cronograma_id, sort_order);

-- 4) RPC pública: get_cronograma_by_token agora traz accent (cor), logo, handle e datas
create or replace function public.get_cronograma_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c public.cronogramas; _items jsonb; _datas jsonb; _accent text; _logo text; _by text;
begin
  select * into _c from public.cronogramas where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'copy', i.copy, 'description', i.description, 'date', i.date,
           'type', i.type, 'approval_status', i.approval_status, 'client_comment', i.client_comment
         ) order by i.sort_order, i.created_at), '[]'::jsonb)
    into _items from public.cronograma_items i where i.cronograma_id = _c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'label', d.label, 'day_label', d.day_label, 'selected', d.selected
         ) order by d.sort_order, d.created_at), '[]'::jsonb)
    into _datas from public.cronograma_datas d where d.cronograma_id = _c.id;

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _c.manager_id;

  return jsonb_build_object(
    'title', _c.title, 'client_label', _c.client_label, 'client_handle', _c.client_handle,
    'status', _c.status, 'accent', _accent, 'logo', _logo, 'by', _by,
    'items', _items, 'datas', _datas);
end; $$;

-- 5) RPC pública: cliente marca/desmarca uma data
create or replace function public.set_cronograma_data_by_token(_token text, _data_id uuid, _selected boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare _cid uuid;
begin
  select c.id into _cid from public.cronogramas c
    join public.cronograma_datas d on d.cronograma_id = c.id
   where c.token = _token and d.id = _data_id;
  if _cid is null then return false; end if;
  update public.cronograma_datas set selected = _selected where id = _data_id;
  return true;
end; $$;

grant execute on function public.get_cronograma_by_token(text) to anon, authenticated;
grant execute on function public.set_cronograma_data_by_token(text, uuid, boolean) to anon, authenticated;
