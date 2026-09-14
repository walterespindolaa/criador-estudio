-- ═══════════════════════════════════════════════════════════════════════════
-- VÍDEO: DRIVE NA HORA, BUNNY EM SEGUNDO PLANO (14/09/2026)
--
-- Hoje o vídeo anexado pelo Drive faz um caminho caro: Drive -> NAVEGADOR da
-- social mídia -> Bunny. Um arquivo de 300 MB gasta 300 MB de download e mais
-- 300 MB de upload na internet dela, com a aba presa, e só DEPOIS começa a
-- transcodificação. Enquanto isso o cliente que abre o link de aprovação via
-- quadrado preto (Walter, 14/09/2026: "compensa ficar subindo no Bunny? não
-- seria retrabalho?").
--
-- A decisão: o Bunny FICA (o player /preview do Drive é bloqueado em conta
-- corporativa e exige deixar o arquivo público), mas deixa de ser bloqueante.
-- A peça nasce como mídia do Drive, utilizável no mesmo segundo, e a ingestão
-- acontece por trás. Quando o Bunny fica pronto, a MESMA linha é promovida.
--
-- Duas funções:
--   1. criapost_promover_para_bunny: troca a mídia do Drive pela do Bunny sem
--      criar linha nova (a posição no carrossel é preservada).
--   2. bunny_limpaveis: lista o que o robô de limpeza pode apagar do Bunny.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Promover uma mídia já existente pro Bunny ──────────────────────────
-- Security definer com o MESMO critério de dono do resto do Cria Post
-- (acts_for: dono do tenant ou colaborador ativo dele). `download_url` é
-- preservado de propósito: é o link do arquivo no Drive, a saída de emergência
-- enquanto o encoding não termina e depois da limpeza.
create or replace function public.criapost_promover_para_bunny(
  p_media_id uuid,
  p_view_url text,
  p_thumbnail_url text,
  p_bunny_video_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _dono uuid;
begin
  select p.user_id into _dono
  from public.external_media_refs m
  join public.posts p on p.id = m.post_id
  where m.id = p_media_id;

  if _dono is null then
    raise exception 'mídia não encontrada ou sem post';
  end if;
  if not public.acts_for(_dono) then
    raise exception 'sem acesso a esta mídia';
  end if;

  update public.external_media_refs
  set provider = 'bunny_stream',
      external_file_id = p_bunny_video_id,
      view_url = p_view_url,
      thumbnail_url = p_thumbnail_url,
      bunny_video_id = p_bunny_video_id
  where id = p_media_id;
end;
$$;

revoke all on function public.criapost_promover_para_bunny(uuid, text, text, text) from public, anon;
grant execute on function public.criapost_promover_para_bunny(uuid, text, text, text) to authenticated;

-- ── 2) O que o robô pode apagar do Bunny ──────────────────────────────────
-- REGRA DE OURO: só entra na lista quem TEM origem no Drive (`download_url`
-- apontando pro arquivo). Vídeo que veio do aparelho não tem cópia em lugar
-- nenhum, e apagar do Bunny seria perder a peça. Também exige post publicado
-- há mais de 30 dias: antes disso o cliente ainda pode estar revendo.
create or replace function public.bunny_limpaveis(_dias integer default 30)
returns table (
  media_id uuid,
  bunny_video_id text,
  post_id uuid,
  publicado_em timestamptz,
  origem_drive text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.bunny_video_id, p.id, p.published_at, m.download_url
  from public.external_media_refs m
  join public.posts p on p.id = m.post_id
  where m.bunny_video_id is not null
    and m.download_url ilike '%drive.google.com%'
    and p.published_at is not null
    and p.published_at < now() - make_interval(days => greatest(_dias, 1))
    and p.deleted_at is null
  order by p.published_at asc
  limit 200;
$$;

revoke all on function public.bunny_limpaveis(integer) from public, anon, authenticated;
-- Só o robô (service_role) enxerga: é varredura de manutenção, não tela.

-- ── 3) Desfazer a promoção quando o vídeo sai do Bunny ────────────────────
-- A mídia volta a ser do Drive, que continua tendo o arquivo. Sem isso o card
-- ficaria apontando pra um vídeo que não existe mais.
create or replace function public.bunny_soltar_midia(_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _origem text;
  _id text;
begin
  select download_url into _origem from public.external_media_refs where id = _media_id;
  if _origem is null or _origem not ilike '%drive.google.com%' then
    raise exception 'sem origem no Drive: não solto esta mídia';
  end if;

  _id := coalesce(
    substring(_origem from '/(?:file/)?d/([-_A-Za-z0-9]{25,})'),
    substring(_origem from '[?&]id=([-_A-Za-z0-9]{25,})')
  );
  if _id is null then
    raise exception 'não consegui ler o id do Drive';
  end if;

  update public.external_media_refs
  set provider = 'gdrive',
      external_file_id = _id,
      view_url = 'https://drive.google.com/file/d/' || _id || '/preview',
      thumbnail_url = 'https://drive.google.com/thumbnail?id=' || _id || '&sz=w1000',
      bunny_video_id = null
  where id = _media_id;
end;
$$;

revoke all on function public.bunny_soltar_midia(uuid) from public, anon, authenticated;

-- Conferência:
-- select * from public.bunny_limpaveis(30);
