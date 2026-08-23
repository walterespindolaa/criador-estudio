-- ============================================================
-- CAPA DA REFERÊNCIA (o print do reel)
--
-- O link do Instagram não entrega capa por URL pública: o endpoint antigo
-- (/p/CODIGO/media/) morreu e o CDN bloqueia hotlink. Resultado: o cartão de
-- referência mostrava só o ícone, e a social mídia (e o cliente) continuavam
-- sem ver de qual vídeo se está falando.
--
-- O CRIA já resolve isso no módulo "Salvos": a edge `saved-fetch` puxa capa,
-- legenda e @autor via Apify e GUARDA a imagem num bucket nosso (a URL do CDN
-- expira em dias). Aqui só falta um lugar pra guardar o resultado por LINK,
-- pra não pagar scrape de novo a cada vez que alguém abre a tela.
--
-- É um cache de conteúdo PÚBLICO (post aberto na internet), sem dado de
-- cliente, por isso vale pra conta inteira: dois roteiros com o mesmo reel
-- fazem uma busca só.
-- ============================================================

create table if not exists public.link_previews (
  url text primary key,
  platform text,
  thumb_url text,
  caption text,
  author text,
  fetched_at timestamptz not null default now()
);
alter table public.link_previews enable row level security;

-- Quem está logado lê e escreve o cache. Não há nada privado aqui: é o que
-- qualquer pessoa veria abrindo o link no navegador.
drop policy if exists "link_previews leitura" on public.link_previews;
create policy "link_previews leitura" on public.link_previews
  for select to authenticated using (true);
drop policy if exists "link_previews escrita" on public.link_previews;
create policy "link_previews escrita" on public.link_previews
  for insert to authenticated with check (true);
drop policy if exists "link_previews atualiza" on public.link_previews;
create policy "link_previews atualiza" on public.link_previews
  for update to authenticated using (true) with check (true);

-- ── O link do cliente também mostra a capa ──
-- O cliente é anônimo, então a página não pode consultar o cache direto:
-- a RPC entrega as capas junto com os roteiros.
create or replace function public.get_script_approval_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _a public.script_approvals; _items jsonb; _capas jsonb;
  _accent text; _logo text; _by text; _client_color text; _client_logo text; _cname text;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'position', coalesce(i.client_position, i.position),
           'title', coalesce(i.client_title, i.orig_title),
           'content', coalesce(i.client_content, i.orig_content),
           'scenes', coalesce(i.client_scenes, i.orig_scenes),
           'reference', i.orig_reference,
           'comment', i.client_comment,
           'removed', i.removed,
           'tocado', (i.client_content is not null or i.client_scenes is not null or i.client_title is not null)
         ) order by coalesce(i.client_position, i.position), i.created_at), '[]'::jsonb)
    into _items from public.script_approval_items i where i.approval_id = _a.id;

  -- Mapa { link -> capa } só dos links citados neste envio.
  select coalesce(jsonb_object_agg(p.url, p.thumb_url), '{}'::jsonb)
    into _capas
    from public.link_previews p
   where p.thumb_url is not null
     and exists (
       select 1 from public.script_approval_items i
        where i.approval_id = _a.id
          and coalesce(i.orig_reference, '') like '%' || p.url || '%'
     );

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _a.manager_id;

  select c.name, c.color, c.logo into _cname, _client_color, _client_logo
    from public.crm_clients c where c.id = _a.crm_client_id;

  return jsonb_build_object(
    'title', _a.title, 'month', _a.month, 'status', _a.status,
    'client_label', coalesce(_cname, _a.client_name), 'client_note', _a.client_note,
    'accent', _accent, 'logo', _logo, 'by', _by,
    'client_color', _client_color, 'client_logo', _client_logo,
    'capas', _capas,
    'items', _items);
end; $$;
grant execute on function public.get_script_approval_by_token(text) to anon, authenticated;
