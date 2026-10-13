-- REVISÃO NÃO APAGA O CARROSSEL (Gabriela, 13/10/2026: "teve revisão, ela
-- subiu a nova imagem e sumiu aqui as demais" / "se ela exclui alguma, tem
-- que excluir do meu também").
--
-- Antes: o primeiro arquivo subido numa rodada de ajuste aposentava TODAS as
-- entregas das rodadas anteriores. A designer trocava só o slide 5 e o card
-- (e o link do cliente) ficavam com 1 arquivo.
--
-- Agora a versão atual da peça é acumulada:
--   * arquivo com o MESMO NOME de um já entregue em rodada anterior substitui
--     aquele e assume a posição dele (o antigo vai pro histórico);
--   * nome novo entra no fim, os outros continuam;
--   * o parceiro pode tirar qualquer arquivo atual da entrega dele enquanto a
--     peça não está entregue. Se era de rodada anterior, vai pro histórico
--     (substituida); se era desta rodada, é apagado como antes. Como os dois
--     lados leem a mesma tabela, some da social mídia e do cliente também.

create or replace function public.parceiro_anexar_entrega(
  _post_id uuid, _view_url text, _file_name text,
  _file_type text default null, _file_size bigint default null, _thumbnail_url text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _dono uuid; _pos int; _id uuid; _rodada int; _velho uuid; _velha_pos int;
begin
  if not public.parceiro_tem_o_card(_post_id) then raise exception 'sem_acesso'; end if;
  if _view_url is null or _view_url !~ '^https?://' then raise exception 'url_invalida'; end if;
  select p.user_id, coalesce(p.revisoes, 0) into _dono, _rodada
    from public.posts p where p.id = _post_id;

  /* SUBSTITUI SÓ O QUE TEM O MESMO NOME. "Slice 5.jpg" na revisão troca o
     "Slice 5.jpg" da rodada anterior; os outros slides ficam onde estão. */
  select m.id, m.position into _velho, _velha_pos
    from public.external_media_refs m
   where m.post_id = _post_id and m.entrega and not m.substituida
     and m.rodada < _rodada
     and lower(btrim(m.file_name)) = lower(btrim(coalesce(_file_name, '')))
   order by m.created_at desc
   limit 1;

  if _velho is not null then
    update public.external_media_refs set substituida = true where id = _velho;
    _pos := _velha_pos;
  end if;

  if _pos is null then
    select coalesce(max(m.position), -1) + 1 into _pos
      from public.external_media_refs m where m.post_id = _post_id and not m.substituida;
  end if;

  insert into public.external_media_refs (
    user_id, post_id, provider, external_file_id, file_name, file_type, file_size,
    thumbnail_url, view_url, download_url, position, entrega, rodada)
  values (
    _dono, _post_id, 'storage', _view_url, coalesce(_file_name, 'entrega'), _file_type, _file_size,
    coalesce(_thumbnail_url, _view_url), _view_url, _view_url, _pos, true, _rodada)
  returning id into _id;

  insert into public.post_approval_comments (post_id, author_id, author_role, content)
  values (_post_id, auth.uid(), 'parceiro',
          'Entrega' || (case when _rodada > 0 then ' (revisão ' || _rodada || ')' else '' end)
            || ' (arquivo): ' || coalesce(_file_name, _view_url)
            || (case when _velho is not null then ' (substitui o anterior)' else '' end));
  return _id;
end; $function$;

-- O que o parceiro pode tirar: toda a entrega atual dele, de qualquer rodada,
-- enquanto a peça não foi marcada entregue.
create or replace function public.parceiro_entregas_da_rodada(_post_id uuid)
returns table(id uuid, url text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
       and coalesce(p.producao_status, '') <> 'entregue';
end; $function$;

create or replace function public.parceiro_remover_entrega(_post_id uuid, _url text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _id uuid; _nome text; _status text; _rodada int; _da_rodada int;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem_acesso';
  end if;
  select coalesce(p.producao_status, ''), coalesce(p.revisoes, 0) into _status, _rodada
    from public.posts p where p.id = _post_id;
  if _status = 'entregue' then
    raise exception 'ja_entregue';
  end if;
  select m.id, m.file_name, m.rodada into _id, _nome, _da_rodada
    from public.external_media_refs m
   where m.post_id = _post_id
     and m.entrega
     and not m.substituida
     and m.view_url = _url
   order by m.created_at desc
   limit 1;
  if _id is null then
    raise exception 'nao_removivel';
  end if;
  if _da_rodada < _rodada then
    -- Versão já vista pelo cliente: sai da peça, mas fica no histórico.
    update public.external_media_refs set substituida = true where id = _id;
  else
    delete from public.external_media_refs where id = _id;
  end if;
  insert into public.post_approval_comments (post_id, author_id, author_role, content)
  values (_post_id, auth.uid(), 'parceiro', 'Arquivo removido: ' || coalesce(_nome, 'arquivo'));
  return _nome;
end; $function$;
