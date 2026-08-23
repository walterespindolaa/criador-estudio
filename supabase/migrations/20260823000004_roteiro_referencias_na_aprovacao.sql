-- ============================================================
-- REFERÊNCIA DO ROTEIRO NO LINK DE APROVAÇÃO
--
-- A referência é o "grava tipo aquele reel". Ela já existia no roteiro e no
-- guia em PDF, mas o link que vai pro cliente não mandava nada: ele lia o texto
-- sem ver o vídeo que inspirou, e respondia no escuro.
--
-- O campo guarda VÁRIOS links (um por linha, mesmo formato do Cria Post), então
-- aqui é só texto: quem exibe é que separa por linha e monta a prévia.
-- ============================================================

alter table public.script_approval_items
  add column if not exists orig_reference text;

-- Preenche o que já foi enviado antes desta coluna existir.
update public.script_approval_items i
   set orig_reference = s.reference_url
  from public.capture_scripts s
 where s.id = i.script_id and i.orig_reference is null;

create or replace function public.get_script_approval_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _a public.script_approvals; _items jsonb;
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

  select name, theme_accent, brand_logo_url into _by, _accent, _logo
    from public.profiles where id = _a.manager_id;

  select c.name, c.color, c.logo into _cname, _client_color, _client_logo
    from public.crm_clients c where c.id = _a.crm_client_id;

  return jsonb_build_object(
    'title', _a.title, 'month', _a.month, 'status', _a.status,
    'client_label', coalesce(_cname, _a.client_name), 'client_note', _a.client_note,
    'accent', _accent, 'logo', _logo, 'by', _by,
    'client_color', _client_color, 'client_logo', _client_logo,
    'items', _items);
end; $$;
grant execute on function public.get_script_approval_by_token(text) to anon, authenticated;
