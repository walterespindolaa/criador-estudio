-- Notificações automáticas (no sininho) quando o CLIENTE reage:
-- Collabs (aceita/recusa/ajuste) -> avisa a criadora; Cronograma (recusa/ajuste) -> avisa a gestora.
-- As funções são SECURITY DEFINER, então inserem em notifications mesmo sendo chamadas por anon.

-- ===== Collabs =====
create or replace function public.accept_proposal_by_token(_token text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid; _brand text;
begin
  update public.collabs
     set proposal_status = 'aceita', proposal_responded_at = now(),
         status = case when status in ('lead','negociando') then 'fechado' else status end,
         updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista','ajuste')
   returning user_id, brand into _uid, _brand;
  if _uid is not null then
    insert into public.notifications (user_id, type, title, description, link)
    values (_uid, 'collab', 'Proposta aceita', coalesce(_brand, 'A marca') || ' aceitou sua proposta.', '/app/collabs');
  end if;
end; $$;

create or replace function public.reject_proposal_by_token(_token text, _reason text default null, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid; _brand text;
begin
  update public.collabs
     set proposal_status = 'recusada', proposal_responded_at = now(),
         proposal_decline_reason = _reason, proposal_decline_note = _note, updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista','ajuste')
   returning user_id, brand into _uid, _brand;
  if _uid is not null then
    insert into public.notifications (user_id, type, title, description, link)
    values (_uid, 'collab', 'Proposta recusada',
            coalesce(_brand, 'A marca') || ' recusou a proposta' || coalesce(' — ' || _reason, '') || '.', '/app/collabs');
  end if;
end; $$;

create or replace function public.request_proposal_change_by_token(_token text, _comment text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid; _brand text;
begin
  update public.collabs
     set proposal_status = 'ajuste', proposal_client_comment = _comment, updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista')
   returning user_id, brand into _uid, _brand;
  if _uid is not null then
    insert into public.notifications (user_id, type, title, description, link)
    values (_uid, 'collab', 'Pedido de ajuste na proposta', coalesce(_brand, 'A marca') || ' pediu ajustes na proposta.', '/app/collabs');
  end if;
end; $$;

-- ===== Cronograma =====
create or replace function public.set_cronograma_item_by_token(_token text, _item_id uuid, _status text, _comment text)
returns boolean language plpgsql security definer set search_path = public as $$
declare _cid uuid; _mgr uuid; _title text;
begin
  select c.id, c.manager_id, c.title into _cid, _mgr, _title
    from public.cronogramas c
    join public.cronograma_items i on i.cronograma_id = c.id
   where c.token = _token and i.id = _item_id;
  if _cid is null then return false; end if;
  if _status not in ('aprovado','recusado','ajuste','pendente') then return false; end if;

  update public.cronograma_items
     set approval_status = _status,
         client_comment = case when _status in ('recusado','ajuste') then _comment else null end,
         updated_at = now()
   where id = _item_id;

  if _status in ('recusado','ajuste') and _mgr is not null then
    insert into public.notifications (user_id, type, title, description, link)
    values (_mgr, 'cronograma',
            case _status when 'recusado' then 'Cliente recusou um item do cronograma' else 'Cliente pediu ajuste no cronograma' end,
            coalesce(_title, 'Cronograma'), '/socialmidia/criapost');
  end if;
  return true;
end; $$;

grant execute on function public.accept_proposal_by_token(text) to anon, authenticated;
grant execute on function public.reject_proposal_by_token(text, text, text) to anon, authenticated;
grant execute on function public.request_proposal_change_by_token(text, text) to anon, authenticated;
grant execute on function public.set_cronograma_item_by_token(text, uuid, text, text) to anon, authenticated;
