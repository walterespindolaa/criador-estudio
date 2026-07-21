-- Expõe o ref_url dos itens na página pública do cronograma (link de referência).
create or replace function public.get_cronograma_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c public.cronogramas; _items jsonb; _datas jsonb; _accent text; _logo text; _by text;
begin
  select * into _c from public.cronogramas where token = _token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'copy', i.copy, 'description', i.description, 'date', i.date,
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

  return jsonb_build_object(
    'title', _c.title, 'client_label', _c.client_label, 'client_handle', _c.client_handle,
    'status', _c.status, 'accent', _accent, 'logo', _logo, 'by', _by,
    'items', _items, 'datas', _datas);
end; $$;
