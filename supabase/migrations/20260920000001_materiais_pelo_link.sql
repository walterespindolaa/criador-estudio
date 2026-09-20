-- ============================================================
-- PEDIDO DE MATERIAL PELO LINK, COM DATA (Walter, 20/09/2026)
--
-- O cliente pedia um material pelo link de aprovacao e o pedido caia no
-- kanban em "Solicitado" e no sininho. E so. Nao tinha data, entao nunca
-- entrava na Agenda (que le client_materials.due_date), e ninguem via como
-- tarefa pendente: a notificacao era lida e o pedido morria no quadro.
--
-- Agora:
--   1. request_material_by_token aceita a data em que o cliente PRECISA do
--      material (_due_date). Sem data, usa o dia do pedido: o combinado com o
--      Walter e que o pedido apareca na agenda de qualquer jeito.
--   2. list_materials_by_token devolve tambem due_date e updated_at, pro
--      cliente acompanhar o prazo e ver quando mudou de etapa.
--
-- Postgres nao muda o tipo de retorno nem a assinatura com create or replace:
-- por isso os drops antes. Idempotente.
-- ============================================================

-- 1) Pedido com data ---------------------------------------------------------
drop function if exists public.request_material_by_token(text, text, text, text);
drop function if exists public.request_material_by_token(text, text, text, text, date);

create function public.request_material_by_token(
  _token text, _title text, _description text, _kind text default 'arte_avulsa', _due_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _mgr uuid; _crm uuid; _ec uuid; _cname text; _id uuid; _k text; _prazo date;
begin
  select ec.manager_id, ec.crm_client_id, ec.id, coalesce(ec.name, 'O cliente')
    into _mgr, _crm, _ec, _cname
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if _mgr is null then
    raise exception 'Link invalido ou expirado';
  end if;
  if _title is null or btrim(_title) = '' then
    raise exception 'Titulo obrigatorio';
  end if;

  _k := lower(coalesce(_kind, 'arte_avulsa'));
  if _k not in ('apresentacao','flyer','arte_avulsa','logo','outro') then
    _k := 'outro';
  end if;

  -- Sem data, o prazo e o proprio dia do pedido (hora de Brasilia): assim o
  -- pedido SEMPRE aparece na Agenda, e a social midia decide se empurra.
  -- Data no passado tambem vira hoje: nao faz sentido nascer atrasado.
  _prazo := greatest(coalesce(_due_date, (now() at time zone 'America/Sao_Paulo')::date),
                     (now() at time zone 'America/Sao_Paulo')::date);

  insert into public.client_materials
    (manager_id, crm_client_id, external_client_id, title, description, kind, status, requested_by, due_date)
  values
    (_mgr, _crm, _ec, btrim(_title), nullif(btrim(coalesce(_description,'')), ''), _k, 'solicitado', 'cliente', _prazo)
  returning id into _id;

  insert into public.notifications (user_id, type, title, description, link)
  values (_mgr, 'material', 'Novo pedido de material',
          _cname || ' pediu: ' || btrim(_title) || ' (pra ' || to_char(_prazo, 'DD/MM') || ')',
          case when _crm is not null
               then '/socialmidia/clientes/' || _crm::text || '/materiais'
               else '/socialmidia/clientes' end);

  return _id;
end; $$;
grant execute on function public.request_material_by_token(text, text, text, text, date) to anon, authenticated;

-- 2) Leitura com prazo -------------------------------------------------------
drop function if exists public.list_materials_by_token(text);

create function public.list_materials_by_token(_token text)
returns table (
  id uuid, title text, description text, kind text, status text,
  created_at timestamptz, due_date date, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, m.description, m.kind, m.status, m.created_at, m.due_date, m.updated_at
  from public.approval_tokens t
  join public.external_clients ec on ec.id = t.external_client_id
  join public.client_materials m on m.external_client_id = ec.id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and m.requested_by = 'cliente'
  order by (m.status = 'finalizado'), m.due_date nulls last, m.created_at desc;
$$;
grant execute on function public.list_materials_by_token(text) to anon, authenticated;
