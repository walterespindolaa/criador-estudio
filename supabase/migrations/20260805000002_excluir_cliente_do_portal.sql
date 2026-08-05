-- ── EXCLUIR CLIENTE DO CRIA POST (mantém a ficha no Cria Gestão) ──
-- A gestora quer parar de usar o portal/link de aprovação de um cliente sem
-- perder o cadastro central (crm_clients: financeiro, tarefas, contratos,
-- notas). Até aqui existia criar o vínculo (external_clients), mas não desfazer.
--
-- O que APAGA (tudo do portal):
--   • posts do portal (com comentários de aprovação e referências de mídia)
--   • links de aprovação (approval_tokens) — o link público morre na hora
--   • cronogramas do portal (com itens e datas)
--   • a linha em external_clients
-- O que FICA:
--   • a ficha no CRM (crm_clients) e tudo que pendura nela
--   • os materiais (client_materials): só perdem o vínculo com o portal
--
-- Função com ordem explícita de deletes (filhas -> pais) pra não depender do
-- ON DELETE de cada FK, numa transação só. Devolve a contagem do que saiu.
-- Sem lixeira aqui de propósito: a lixeira de 30 dias cobre posts do criador
-- e clientes do CRM, mas as queries e RPCs públicas do portal não filtram
-- deleted_at — um soft delete deixaria o portal "meio vivo" pro cliente.
create or replace function public.excluir_cliente_do_portal(_external_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  n_posts bigint := 0;
  n_tokens bigint := 0;
  n_cronogramas bigint := 0;
  n_materiais bigint := 0;
begin
  -- Ação destrutiva: só o dono da agência (colaborador não).
  if not exists (
    select 1 from external_clients
     where id = _external_client_id and manager_id = auth.uid()
  ) then
    raise exception 'cliente_do_portal_nao_encontrado';
  end if;

  -- Filhas dos posts do portal primeiro.
  delete from post_approval_comments
   where post_id in (select id from posts where external_client_id = _external_client_id);
  delete from external_media_refs
   where post_id in (select id from posts where external_client_id = _external_client_id);
  -- Quem referencia posts com ON DELETE SET NULL (social_insights.post_id,
  -- cronograma_items.converted_post_id, higgsfield_jobs.post_id) se desliga sozinho.
  delete from posts where external_client_id = _external_client_id;
  get diagnostics n_posts = row_count;

  -- Links de aprovação: o portal público deixa de abrir imediatamente.
  delete from approval_tokens where external_client_id = _external_client_id;
  get diagnostics n_tokens = row_count;

  -- Cronogramas do portal (itens e datas primeiro).
  delete from cronograma_items
   where cronograma_id in (select id from cronogramas where external_client_id = _external_client_id);
  delete from cronograma_datas
   where cronograma_id in (select id from cronogramas where external_client_id = _external_client_id);
  delete from cronogramas where external_client_id = _external_client_id;
  get diagnostics n_cronogramas = row_count;

  -- Materiais FICAM (pertencem ao cliente do CRM); só desvinculamos do portal.
  update client_materials set external_client_id = null
   where external_client_id = _external_client_id;
  get diagnostics n_materiais = row_count;

  delete from external_clients where id = _external_client_id;

  return jsonb_build_object(
    'posts', n_posts,
    'links_de_aprovacao', n_tokens,
    'cronogramas', n_cronogramas,
    'materiais_desvinculados', n_materiais
  );
end;
$func$;

revoke all on function public.excluir_cliente_do_portal(uuid) from public, anon;
grant execute on function public.excluir_cliente_do_portal(uuid) to authenticated;
