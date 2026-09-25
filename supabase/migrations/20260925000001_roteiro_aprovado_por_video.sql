-- ═══════════════════════════════════════════════════════════════════════════
-- 25/09/2026 · O cliente aprova roteiro por roteiro
--
-- A página pública só deixava editar, comentar, tirar da lista e finalizar
-- tudo junto. Não tinha onde dizer "este aqui está aprovado". Pra social mídia,
-- um vídeo aprovado e um vídeo que o cliente nem abriu apareciam iguais.
--
-- approved_at: quando o cliente tocou em "Aprovado, pode gravar". Tirar o
-- vídeo da lista desfaz a aprovação (e aprovar devolve o vídeo pra lista).
-- As assinaturas das funções existentes NÃO mudam (Postgres não deixa
-- renomear/trocar parâmetro com create or replace).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.script_approval_items add column if not exists approved_at timestamptz;

-- Leitura pelo link: mesma função de 20260823000005, com 'approved'.
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
           'approved', i.approved_at is not null,
           'tocado', (i.client_content is not null or i.client_scenes is not null or i.client_title is not null)
         ) order by coalesce(i.client_position, i.position), i.created_at), '[]'::jsonb)
    into _items from public.script_approval_items i where i.approval_id = _a.id;

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

-- Salvar um roteiro: igual ao original, e tirar da lista desfaz a aprovação.
create or replace function public.save_script_approval_item_by_token(
  _token text, _item_id uuid, _title text, _content text, _scenes jsonb,
  _comment text, _removed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then raise exception 'link inválido'; end if;
  if _a.status = 'aplicado' then raise exception 'esta revisão já foi encerrada'; end if;

  update public.script_approval_items
     set client_title = _title,
         client_content = _content,
         client_scenes = _scenes,
         client_comment = nullif(btrim(coalesce(_comment, '')), ''),
         removed = coalesce(_removed, false),
         approved_at = case when coalesce(_removed, false) then null else approved_at end
   where id = _item_id and approval_id = _a.id;
end; $$;
grant execute on function public.save_script_approval_item_by_token(text, uuid, text, text, jsonb, text, boolean) to anon, authenticated;

-- Novo: aprovar (ou desfazer) UM roteiro pelo link.
create or replace function public.approve_script_approval_item_by_token(_token text, _item_id uuid, _aprovado boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then raise exception 'link inválido'; end if;
  if _a.status = 'aplicado' then raise exception 'esta revisão já foi encerrada'; end if;

  update public.script_approval_items
     set approved_at = case when coalesce(_aprovado, false) then now() else null end,
         removed = case when coalesce(_aprovado, false) then false else removed end
   where id = _item_id and approval_id = _a.id;
end; $$;
revoke all on function public.approve_script_approval_item_by_token(text, uuid, boolean) from public;
grant execute on function public.approve_script_approval_item_by_token(text, uuid, boolean) to anon, authenticated;

-- Finalizar: o aviso agora diz quantos foram aprovados.
create or replace function public.submit_script_approval_by_token(_token text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals; _cname text; _mudou integer; _aprovou integer; _total integer; _desc text;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then raise exception 'link inválido'; end if;

  update public.script_approvals
     set status = 'enviado', submitted_at = now(),
         client_note = nullif(btrim(coalesce(_note, '')), '')
   where id = _a.id;

  select count(*) filter (where client_content is not null or client_title is not null or client_position is not null or removed),
         count(*) filter (where approved_at is not null and not removed),
         count(*)
    into _mudou, _aprovou, _total
    from public.script_approval_items where approval_id = _a.id;

  select coalesce(c.name, _a.client_name) into _cname
    from public.crm_clients c where c.id = _a.crm_client_id;

  _desc := coalesce(_cname, 'O cliente');
  if _aprovou > 0 and _mudou > 0 then
    _desc := _desc || ' aprovou ' || _aprovou || ' de ' || _total || ' e ajustou ' || _mudou || ' roteiro(s).';
  elsif _aprovou > 0 then
    _desc := _desc || ' aprovou ' || _aprovou || ' de ' || _total || ' roteiro(s).';
  elsif _mudou > 0 then
    _desc := _desc || ' ajustou ' || _mudou || ' roteiro(s).';
  else
    _desc := _desc || ' revisou e não mudou nada.';
  end if;

  insert into public.notifications (user_id, type, title, description, link)
  values (_a.manager_id, 'roteiro', 'Cliente revisou os roteiros', _desc, '/socialmidia/captacao');
end; $$;
grant execute on function public.submit_script_approval_by_token(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
