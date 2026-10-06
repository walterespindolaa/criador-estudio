-- ============================================================
-- "É esse / Não é" do Insights dava "sem permissão" (Walter, 06/10/2026).
--
-- ig_sugestoes_vinculo (via ig_posts_candidatos) sugere também os posts que
-- uma AGÊNCIA fez pro criador que tem Cria próprio (post de cliente externo
-- cujo crm_clients.cria_owner_id = dono da publicação). Mas ig_decidir_vinculo
-- exigia acts_for(dono do post), que é a agência: o criador via a sugestão e
-- não podia responder. Provado no banco: publicação de walterjoose, posts da
-- conta da agência.
--
-- Agora a decisão aceita o mesmo caso que a lista mostra: quem opera a
-- PUBLICAÇÃO (acts_for do dono do insight, sem crm_client_id, ou seja, a
-- conexão é do próprio criador) pode ligar a um post de cliente externo
-- cuja ficha aponta pra ele. Ninguém passa a ver post de outra conta: a
-- lista já mostrava, e o que muda é só a ligação da publicação dele.
-- Base: definição lida do banco em 06/10/2026 (igual à do repo).
-- ============================================================
create or replace function public.ig_decidir_vinculo(_insight_id uuid, _post_id uuid, _aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _i record; _p record;
begin
  select id, user_id, crm_client_id, post_id into _i from public.social_insights where id = _insight_id;
  select id, user_id, external_client_id into _p from public.posts where id = _post_id and deleted_at is null;
  if _i.id is null or _p.id is null then raise exception 'não encontrado'; end if;
  -- Pode quem opera o post E enxerga a publicação: dono/equipe da conta, a
  -- agência do cliente (mesmo quando foi um membro que conectou o Instagram)
  -- ou a agência de um cliente com Cria próprio.
  if not (
       (public.acts_for(_p.user_id) and (
          public.acts_for(_i.user_id)
          or public.manager_owns_cria_client(_i.user_id)
          or (_i.crm_client_id is not null and exists (
                select 1 from public.crm_clients cc where cc.id = _i.crm_client_id and public.acts_for(cc.manager_id)))))
       -- O criador com Cria próprio responde pela publicação dele, também
       -- quando o post foi feito pela agência que o atende (06/10/2026).
       or (public.acts_for(_i.user_id) and _i.crm_client_id is null and _p.external_client_id is not null
           and exists (select 1 from public.external_clients ec
                         join public.crm_clients cc on cc.id = ec.crm_client_id
                        where ec.id = _p.external_client_id and cc.cria_owner_id = _i.user_id))
     ) then
    raise exception 'sem permissão';
  end if;
  if _aceitar then
    -- Um post liga a uma publicação só: solta o vínculo antigo, se houver.
    update public.social_insights set post_id = null where post_id = _post_id and id <> _insight_id;
    update public.social_insights set post_id = _post_id where id = _insight_id;
  else
    insert into public.ig_vinculo_recusado (insight_id, post_id) values (_insight_id, _post_id) on conflict do nothing;
  end if;
end $$;
revoke all on function public.ig_decidir_vinculo(uuid, uuid, boolean) from public, anon;
grant execute on function public.ig_decidir_vinculo(uuid, uuid, boolean) to authenticated;
