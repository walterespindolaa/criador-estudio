-- ═══════════════════════════════════════════════════════════════════════════
-- SOCIAL MÍDIA DESCONECTA O INSTAGRAM DO CLIENTE (28/10/2026)
--
-- Antes: na aba Instagram do cliente não havia como desconectar. O delete pelo
-- client não serve: a conexão fica em nome de quem clicou no link (dono da
-- agência ou membro da equipe) e a RLS só deixa apagar a própria linha.
--
-- Agora: quem age pelo gestor do cliente (acts_for) apaga a conexão daquele
-- cliente, seja quem for que conectou. Só a conexão gerenciada (crm_client_id);
-- o Instagram do Cria próprio do cliente só ele desconecta.
-- Os números já puxados (social_insights, social_metrics_daily) ficam salvos e
-- voltam a aparecer quando o cliente conectar de novo.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ig_desconectar_cliente(_crm_client_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _cli record;
  _n integer;
begin
  select id, manager_id into _cli from public.crm_clients where id = _crm_client_id;
  if _cli.id is null or not public.acts_for(_cli.manager_id) then
    raise exception 'Sem acesso a este cliente.' using errcode = '42501';
  end if;

  delete from public.social_connections
   where provider = 'instagram' and crm_client_id = _crm_client_id;
  get diagnostics _n = row_count;
  return _n;
end $$;

revoke all on function public.ig_desconectar_cliente(uuid) from public, anon;
grant execute on function public.ig_desconectar_cliente(uuid) to authenticated;
