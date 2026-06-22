-- Collabs: ao recusar a proposta, capturar o MOTIVO (preço/quantidade/prazo/etc) + nota opcional.

alter table public.collabs
  add column if not exists proposal_decline_reason text,
  add column if not exists proposal_decline_note   text;

-- Recusar agora aceita motivo + nota. Dropa a versão antiga (1 arg) p/ evitar ambiguidade.
drop function if exists public.reject_proposal_by_token(text);
create or replace function public.reject_proposal_by_token(_token text, _reason text default null, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.collabs
     set proposal_status = 'recusada',
         proposal_responded_at = now(),
         proposal_decline_reason = _reason,
         proposal_decline_note = _note,
         updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista','ajuste');
end; $$;

grant execute on function public.reject_proposal_by_token(text, text, text) to anon, authenticated;
