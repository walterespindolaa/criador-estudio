-- ═══════════════════════════════════════════════════════════════════════════
-- REAGENDAR O POST DO CLIENTE PELA AGENDA DO GESTOR (09/09/2026)
--
-- Na Agenda, post de cliente COM conta Cria era só leitura: dava pra marcar
-- como publicado (manager_publish_client_post) e nada mais. Como o card não é
-- arrastável (fica fora do índice do dnd pra não quebrar o arrastar dos
-- outros), a social mídia não tinha NENHUMA forma de remarcar a data de um
-- post do cliente sem entrar no Cria dele.
--
-- Mesma filosofia da função de publicar: o post pertence à conta do CLIENTE,
-- então a escrita do gestor passa por função security definer que valida o
-- vínculo no servidor. Nada de mexer na RLS de `posts`.
--
-- Vínculo aceito: existe ficha no CRM apontando pra conta Cria do cliente
-- (crm_clients.cria_owner_id = posts.user_id) e quem chamou atua pelo dono
-- dessa ficha (acts_for cobre o gestor e o colaborador do time dele).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.manager_reschedule_client_post(
  _post_id uuid,
  _data date,
  _hora time default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _dono uuid;
begin
  select p.user_id into _dono from public.posts p where p.id = _post_id and p.deleted_at is null;
  if _dono is null then raise exception 'post não encontrado'; end if;

  if not exists (
    select 1 from public.crm_clients c
    where c.cria_owner_id = _dono
      and c.deleted_at is null
      and public.acts_for(c.manager_id)
  ) then
    raise exception 'sem permissão para este cliente';
  end if;

  -- Só data e hora. Legenda, mídia e status continuam sendo do cliente: a
  -- social mídia remarca quando publica, não reescreve o post dele.
  update public.posts
  set scheduled_date = _data,
      scheduled_time = _hora,
      updated_at = now()
  where id = _post_id;
end;
$$;

grant execute on function public.manager_reschedule_client_post(uuid, date, time) to authenticated;
