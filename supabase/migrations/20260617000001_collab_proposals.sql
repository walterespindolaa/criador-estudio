-- ===== ORÇAMENTOS (Collabs / Studio): campos de proposta em collabs =====
-- Aplicado em produção via SQL Editor em 2026-06-17. Versionado para histórico.
alter table public.collabs
  add column if not exists proposal_token          text,
  add column if not exists proposal_status         text not null default 'none',
  add column if not exists proposal_terms          text,
  add column if not exists proposal_valid_until     date,
  add column if not exists proposal_sent_at         timestamptz,
  add column if not exists proposal_viewed_at       timestamptz,
  add column if not exists proposal_responded_at    timestamptz,
  add column if not exists proposal_client_comment  text;

alter table public.collabs drop constraint if exists collabs_proposal_status_chk;
alter table public.collabs add constraint collabs_proposal_status_chk
  check (proposal_status in ('none','enviada','vista','aceita','recusada','ajuste'));

create unique index if not exists idx_collabs_proposal_token
  on public.collabs(proposal_token) where proposal_token is not null;

-- ===== RPCs públicas por token (anon) — espelham o padrão do Cria Post =====

-- Lê a proposta pelo token e marca como "vista" no 1º acesso
create or replace function public.get_proposal_by_token(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c public.collabs; _delivs jsonb; _creator jsonb;
begin
  select * into _c from public.collabs
   where proposal_token = _token and proposal_status <> 'none';
  if not found then return null; end if;

  if _c.proposal_status = 'enviada' then
    update public.collabs set proposal_status = 'vista', proposal_viewed_at = now()
     where id = _c.id;
    _c.proposal_status := 'vista';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', d.label, 'format', d.format)
           order by d.sort_order), '[]'::jsonb)
    into _delivs from public.collab_deliverables d where d.collab_id = _c.id;

  select jsonb_build_object('name', p.name, 'handle', p.instagram_handle, 'avatar', p.avatar_url)
    into _creator from public.profiles p where p.id = _c.user_id;

  return jsonb_build_object(
    'brand', _c.brand, 'objective', _c.objective, 'value', _c.value,
    'terms', _c.proposal_terms, 'valid_until', _c.proposal_valid_until,
    'status', _c.proposal_status, 'client_comment', _c.proposal_client_comment,
    'deliverables', _delivs, 'creator', _creator);
end; $$;

-- Aceitar: marca aceita + avança o pipeline pra "fechado" se ainda estiver no início
create or replace function public.accept_proposal_by_token(_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.collabs
     set proposal_status = 'aceita', proposal_responded_at = now(),
         status = case when status in ('lead','negociando') then 'fechado' else status end,
         updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista','ajuste');
end; $$;

create or replace function public.reject_proposal_by_token(_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.collabs
     set proposal_status = 'recusada', proposal_responded_at = now(), updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista','ajuste');
end; $$;

create or replace function public.request_proposal_change_by_token(_token text, _comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.collabs
     set proposal_status = 'ajuste', proposal_client_comment = _comment, updated_at = now()
   where proposal_token = _token and proposal_status in ('enviada','vista');
end; $$;

grant execute on function public.get_proposal_by_token(text)            to anon, authenticated;
grant execute on function public.accept_proposal_by_token(text)         to anon, authenticated;
grant execute on function public.reject_proposal_by_token(text)         to anon, authenticated;
grant execute on function public.request_proposal_change_by_token(text, text) to anon, authenticated;
