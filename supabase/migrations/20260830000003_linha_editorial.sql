-- ============================================================
-- LINHA EDITORIAL DO CLIENTE
--
-- Pedido do Walter (30/08): a linha editorial deixa de ser texto solto na
-- estratégia e vira coisa cadastrada, que etiqueta cada post do cliente do
-- cronograma até a publicação. A social mídia cadastra as linhas na
-- estratégia do cliente (ex.: Autoridade, Bastidores, Venda, Educativo),
-- escolhe uma por post, e o cliente VÊ a linha no link do cronograma.
-- ============================================================

-- ── 1. O catálogo de linhas, por cliente do Cria Post ───────
create table if not exists public.editorial_lines (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  external_client_id uuid not null references public.external_clients(id) on delete cascade,
  name text not null,
  color text not null default '#EA4918',
  descricao text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table public.editorial_lines enable row level security;
drop policy if exists "editorial_lines_owner" on public.editorial_lines;
create policy "editorial_lines_owner" on public.editorial_lines
  for all to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());
-- Colaborador com o módulo Cria Post liberado enxerga e mexe (padrão
-- member_can, semântica do projeto: permissão ausente = negar).
drop policy if exists "editorial_lines_team" on public.editorial_lines;
create policy "editorial_lines_team" on public.editorial_lines
  for all to authenticated
  using (public.member_can(manager_id, 'cria_post'))
  with check (public.member_can(manager_id, 'cria_post'));
create index if not exists idx_editorial_lines_client on public.editorial_lines(external_client_id, sort_order);

-- ── 2. A etiqueta no post e no item do cronograma ───────────
alter table public.posts
  add column if not exists editorial_line_id uuid references public.editorial_lines(id) on delete set null;
alter table public.cronograma_items
  add column if not exists editorial_line_id uuid references public.editorial_lines(id) on delete set null;

-- ── 3. O link público do cronograma mostra a linha ──────────
-- Função copiada INTEIRA da versão vigente (20260827000002) + o objeto
-- editorial_line por item: create or replace substitui o corpo, então omitir
-- qualquer pedaço apagaria marca, cor do cliente ou datas do link.
create or replace function public.get_cronograma_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _c public.cronogramas; _items jsonb; _datas jsonb;
  _accent text; _logo text; _by text;
  _client_color text; _client_logo text;
begin
  select * into _c from public.cronogramas where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'title', i.title, 'copy', i.copy, 'description', i.description, 'date', i.date,
           'type', i.type, 'approval_status', i.approval_status, 'client_comment', i.client_comment,
           'ref_url', i.ref_url,
           'editorial_line', case when el.id is null then null
             else jsonb_build_object('name', el.name, 'color', el.color) end
         ) order by i.sort_order, i.created_at), '[]'::jsonb)
    into _items
    from public.cronograma_items i
    left join public.editorial_lines el on el.id = i.editorial_line_id
    where i.cronograma_id = _c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'label', d.label, 'day_label', d.day_label, 'selected', d.selected
         ) order by d.sort_order, d.created_at), '[]'::jsonb)
    into _datas from public.cronograma_datas d where d.cronograma_id = _c.id;

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _c.manager_id;

  select cc.color, cc.logo into _client_color, _client_logo
    from public.external_clients ec
    join public.crm_clients cc on cc.id = ec.crm_client_id
    where ec.id = _c.external_client_id;

  return jsonb_build_object(
    'title', _c.title, 'mes_ref', _c.mes_ref,
    'client_label', _c.client_label, 'client_handle', _c.client_handle,
    'status', _c.status, 'accent', _accent, 'logo', _logo, 'by', _by,
    'client_color', _client_color, 'client_logo', _client_logo,
    'items', _items, 'datas', _datas);
end; $$;

grant execute on function public.get_cronograma_by_token(text) to anon, authenticated;
