-- Parceiro apaga o próprio anexo errado (Walter, 30/09/2026).
-- A designer subiu a arte no post errado e não tinha como tirar: não existia
-- função pro parceiro remover anexo de POST (só de Material). Regra igual à do
-- Material: só o que ele entregou NESTA rodada, e só enquanto a peça ainda não
-- foi marcada como entregue. Depois de entregue, quem mexe é a social mídia.
-- Funções novas: nenhuma função existente é alterada.

-- 1) Quais anexos desta peça o parceiro ainda pode tirar.
create or replace function public.parceiro_entregas_da_rodada(_post_id uuid)
returns table (id uuid, url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem_acesso';
  end if;
  return query
    select m.id, m.view_url
      from public.external_media_refs m
      join public.posts p on p.id = m.post_id
     where m.post_id = _post_id
       and m.entrega
       and not m.substituida
       and m.rodada = coalesce(p.revisoes, 0)
       and coalesce(p.producao_status, '') <> 'entregue';
end; $$;
revoke all on function public.parceiro_entregas_da_rodada(uuid) from public, anon;
grant execute on function public.parceiro_entregas_da_rodada(uuid) to authenticated;

-- 2) Tirar um anexo. Devolve o nome do arquivo e deixa carimbado na conversa
--    do card, pra social mídia saber que aquele arquivo saiu.
create or replace function public.parceiro_remover_entrega(_post_id uuid, _url text)
returns text
language plpgsql security definer set search_path = public as $$
declare _id uuid; _nome text; _status text; _rodada int;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem_acesso';
  end if;
  select coalesce(p.producao_status, ''), coalesce(p.revisoes, 0) into _status, _rodada
    from public.posts p where p.id = _post_id;
  if _status = 'entregue' then
    raise exception 'ja_entregue';
  end if;

  -- Pega um só (pelo id): DELETE ... RETURNING INTO quebra se voltarem duas linhas.
  select m.id, m.file_name into _id, _nome
    from public.external_media_refs m
   where m.post_id = _post_id
     and m.entrega
     and not m.substituida
     and m.rodada = _rodada
     and m.view_url = _url
   order by m.created_at desc
   limit 1;
  if _id is null then
    raise exception 'nao_removivel';
  end if;
  delete from public.external_media_refs where id = _id;

  insert into public.post_approval_comments (post_id, author_id, author_role, content)
  values (_post_id, auth.uid(), 'parceiro', 'Arquivo removido: ' || coalesce(_nome, 'arquivo'));
  return _nome;
end; $$;
revoke all on function public.parceiro_remover_entrega(uuid, text) from public, anon;
grant execute on function public.parceiro_remover_entrega(uuid, text) to authenticated;
