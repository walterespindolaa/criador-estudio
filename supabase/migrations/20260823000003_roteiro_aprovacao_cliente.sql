-- ============================================================
-- APROVAÇÃO DE ROTEIRO PELO CLIENTE (link público)
--
-- Hoje o roteiro nasce e morre dentro do Cria: a social mídia escreve, manda o
-- PDF por WhatsApp, o cliente responde em áudio "muda essa parte aqui", e ela
-- volta pro sistema e reescreve na mão. O que o cliente pediu não fica em lugar
-- nenhum, e a versão final vira uma discussão de "não foi isso que eu falei".
--
-- Aqui o roteiro ganha o mesmo caminho que o cronograma e o Cria Post já têm:
--   1. a social mídia gera um LINK e manda pro cliente;
--   2. o cliente abre, lê os roteiros, EDITA o texto de cada cena e muda a
--      ORDEM em que quer gravar, e finaliza;
--   3. o gestor recebe no sininho, ABRE e vê lado a lado o que mudou;
--   4. ao confirmar, o texto do cliente vira o texto oficial do roteiro.
--
-- Duas decisões que importam:
-- · o cliente NUNCA escreve direto em capture_scripts. Ele escreve numa cópia
--   (a "sugestão"), e só a confirmação da social mídia aplica. Ninguém perde
--   trabalho por causa de um cliente que mexeu sem querer.
-- · o envio guarda um SNAPSHOT do texto original, então dá pra mostrar o antes
--   e o depois mesmo que o roteiro tenha sido editado no meio do caminho.
-- ============================================================

-- ── O envio (o link) ──
create table if not exists public.script_approvals (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  client_name text,
  month text not null,
  title text not null default 'Roteiros de gravação',
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- aberto -> cliente ainda está mexendo | enviado -> cliente finalizou
  -- aplicado -> a social mídia confirmou e o texto virou oficial
  status text not null default 'aberto',
  client_note text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  applied_at timestamptz
);
alter table public.script_approvals enable row level security;
drop policy if exists "script_approvals tenant" on public.script_approvals;
create policy "script_approvals tenant" on public.script_approvals
  for all to authenticated
  using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));
create index if not exists idx_script_approvals on public.script_approvals(manager_id, month, created_at desc);

-- ── Cada roteiro dentro do envio ──
create table if not exists public.script_approval_items (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.script_approvals(id) on delete cascade,
  script_id uuid references public.capture_scripts(id) on delete cascade,
  position integer not null default 0,
  -- snapshot do que foi enviado (o "antes")
  orig_title text not null default '',
  orig_content text not null default '',
  orig_scenes jsonb not null default '[]'::jsonb,
  -- o que o cliente devolveu (o "depois"); null = não mexeu
  client_title text,
  client_content text,
  client_scenes jsonb,
  client_position integer,
  client_comment text,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.script_approval_items enable row level security;
drop policy if exists "script_approval_items tenant" on public.script_approval_items;
create policy "script_approval_items tenant" on public.script_approval_items
  for all to authenticated
  using (exists (select 1 from public.script_approvals a
                 where a.id = approval_id and public.acts_for(a.manager_id)))
  with check (exists (select 1 from public.script_approvals a
                      where a.id = approval_id and public.acts_for(a.manager_id)));
create index if not exists idx_script_approval_items on public.script_approval_items(approval_id, position);

-- ════════════════════════════════════════════════════════════
-- LADO DO CLIENTE (anon, só pelo token)
-- ════════════════════════════════════════════════════════════

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

-- Cliente salva a edição de UM roteiro (texto, cenas, comentário, remover).
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
         removed = coalesce(_removed, false)
   where id = _item_id and approval_id = _a.id;
end; $$;
grant execute on function public.save_script_approval_item_by_token(text, uuid, text, text, jsonb, text, boolean) to anon, authenticated;

-- Cliente reordena os roteiros (a ordem em que ele quer gravar).
create or replace function public.reorder_script_approval_by_token(_token text, _ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals; _i integer;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then raise exception 'link inválido'; end if;
  if _a.status = 'aplicado' then raise exception 'esta revisão já foi encerrada'; end if;

  for _i in 1 .. coalesce(array_length(_ids, 1), 0) loop
    update public.script_approval_items
       set client_position = _i - 1
     where id = _ids[_i] and approval_id = _a.id;
  end loop;
end; $$;
grant execute on function public.reorder_script_approval_by_token(text, uuid[]) to anon, authenticated;

-- Cliente finaliza: avisa a social mídia no sininho.
create or replace function public.submit_script_approval_by_token(_token text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals; _cname text; _mudou integer;
begin
  select * into _a from public.script_approvals where token = _token;
  if not found then raise exception 'link inválido'; end if;

  update public.script_approvals
     set status = 'enviado', submitted_at = now(),
         client_note = nullif(btrim(coalesce(_note, '')), '')
   where id = _a.id;

  select count(*) into _mudou from public.script_approval_items
   where approval_id = _a.id
     and (client_content is not null or client_title is not null or client_position is not null or removed);

  select coalesce(c.name, _a.client_name) into _cname
    from public.crm_clients c where c.id = _a.crm_client_id;

  insert into public.notifications (user_id, type, title, description, link)
  values (_a.manager_id, 'roteiro', 'Cliente revisou os roteiros',
          coalesce(_cname, 'O cliente') ||
            case when _mudou > 0 then ' ajustou ' || _mudou || ' roteiro(s).' else ' revisou e não mudou nada.' end,
          '/socialmidia/captacao');
end; $$;
grant execute on function public.submit_script_approval_by_token(text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- LADO DA SOCIAL MÍDIA: aplicar o que o cliente escreveu
-- ════════════════════════════════════════════════════════════
create or replace function public.apply_script_approval(_approval_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare _a public.script_approvals; _it record; _n integer := 0;
begin
  select * into _a from public.script_approvals where id = _approval_id;
  if not found then raise exception 'revisão não encontrada'; end if;
  if not public.acts_for(_a.manager_id) then raise exception 'sem permissão'; end if;

  for _it in
    select * from public.script_approval_items where approval_id = _a.id
  loop
    if _it.script_id is null then continue; end if;

    if _it.removed then
      -- O cliente tirou este vídeo da lista: some do dia, não é apagado do banco
      -- às cegas; vira roteiro solto marcado no título pra ela decidir.
      update public.capture_scripts
         set capture_id = null,
             title = case when title ilike '[removido pelo cliente]%' then title
                          else '[removido pelo cliente] ' || title end,
             updated_at = now()
       where id = _it.script_id;
      _n := _n + 1;
      continue;
    end if;

    update public.capture_scripts
       set title    = coalesce(nullif(btrim(coalesce(_it.client_title, '')), ''), title),
           content  = coalesce(_it.client_content, content),
           scenes   = coalesce(_it.client_scenes, scenes),
           position = coalesce(_it.client_position, position),
           updated_at = now()
     where id = _it.script_id;
    _n := _n + 1;
  end loop;

  update public.script_approvals set status = 'aplicado', applied_at = now() where id = _a.id;
  return _n;
end; $$;
grant execute on function public.apply_script_approval(uuid) to authenticated;
