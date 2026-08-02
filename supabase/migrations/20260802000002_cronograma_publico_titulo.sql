-- ============================================================
-- LINK PÚBLICO DO CRONOGRAMA: devolver o TÍTULO do item.
--
-- Bug: a função montava cada item com copy, description, date, type e ref_url,
-- mas ESQUECIA o title. Como a página pública mostra `title || copy ||
-- "(sem título)"`, todo item aparecia como "(sem título)" pro cliente, mesmo
-- com o título preenchido do lado da social mídia.
--
-- Aqui só acrescenta 'title' ao objeto do item. O resto é idêntico à versão
-- anterior (cor e logo do cliente), então é seguro rodar por cima.
-- ============================================================
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
           'ref_url', i.ref_url
         ) order by i.sort_order, i.created_at), '[]'::jsonb)
    into _items from public.cronograma_items i where i.cronograma_id = _c.id;

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
    'title', _c.title, 'client_label', _c.client_label, 'client_handle', _c.client_handle,
    'status', _c.status, 'accent', _accent, 'logo', _logo, 'by', _by,
    'client_color', _client_color, 'client_logo', _client_logo,
    'items', _items, 'datas', _datas);
end; $$;
