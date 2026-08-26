-- ============================================================
-- ENDEREÇO DA BIO NÃO PODE SE IMPORTAR COM MAIÚSCULA
--
-- As funções novas (get_public_bio_blocks, get_public_bio_items,
-- get_public_bio_page_by_slug, get_public_bio_page_links_by_slug) já comparam
-- com lower(btrim(...)). As duas ANTIGAS, que respondem pela conta do criador,
-- comparam exato.
--
-- Resultado: /bio/AnnaSpanholi devolve "esse link não existe" numa página que
-- existe. E isso acontece o tempo todo no mundo real:
--   · o teclado do iPhone capitaliza a primeira letra sozinho
--   · QR code impresso que alguém digita à mão
--   · o link escrito no story com a inicial maiúscula
--   · link copiado de PDF vindo com espaço colado no fim
--
-- Comparar sem diferenciar maiúscula é o que Linktree e Instagram fazem.
--
-- Só a LEITURA muda: a assinatura das funções fica IDÊNTICA (mesma ordem e
-- mesmos tipos de coluna), senão o `create or replace` falha com "cannot change
-- return type of existing function". A gravação continua guardando o slug como
-- a pessoa escreveu, e a unicidade já é garantida pelo trigger
-- guard_bio_slug_unico, que também compara em minúscula.
-- ============================================================

create or replace function public.get_public_profile_by_slug(_slug text)
returns table (
  id uuid,
  name text,
  bio text,
  avatar_url text,
  niche text,
  instagram_handle text,
  bio_settings jsonb,
  bio_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.bio, p.avatar_url, p.niche, p.instagram_handle, p.bio_settings, p.bio_slug
  from public.profiles p
  where lower(btrim(p.bio_slug)) = lower(btrim(_slug))
  limit 1;
$$;

-- A página do CRIADOR não pode listar os botões das páginas de cliente que a
-- gestora criou (eles compartilham user_id). Daí o page_id is null.
create or replace function public.get_public_bio_links_by_slug(_slug text)
returns table (
  id uuid, title text, url text, icon text,
  "position" integer, link_type text, thumbnail_url text
)
language sql stable security definer set search_path = public
as $$
  select bl.id, bl.title, bl.url, bl.icon, bl."position", bl.link_type, bl.thumbnail_url
  from public.bio_links bl
  join public.profiles p on p.id = bl.user_id
  where lower(btrim(p.bio_slug)) = lower(btrim(_slug))
    and bl.is_active = true
    and bl.page_id is null
  order by bl."position" asc;
$$;

-- CREATE FUNCTION concede EXECUTE pra PUBLIC por padrão. Fechar e reabrir só
-- pra quem precisa é o mesmo cuidado das outras funções públicas daqui.
revoke all on function public.get_public_profile_by_slug(text) from public, anon, authenticated;
revoke all on function public.get_public_bio_links_by_slug(text) from public, anon, authenticated;
grant execute on function public.get_public_profile_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_bio_links_by_slug(text) to anon, authenticated;

-- Índice pra busca em minúscula não virar varredura de tabela quando a base
-- crescer. Sem ele, cada visita a uma bio lê profiles inteira.
create index if not exists idx_profiles_bio_slug_lower
  on public.profiles (lower(btrim(bio_slug)))
  where bio_slug is not null;

-- ============================================================
-- Conferência (rode depois, é só leitura). As duas linhas têm que voltar
-- a MESMA página. Troque 'seu-slug' por um endereço que existe:
-- ============================================================
-- select 'exato' as forma, id, bio_slug from public.get_public_profile_by_slug('seu-slug')
-- union all
-- select 'maiuscula', id, bio_slug from public.get_public_profile_by_slug('SEU-SLUG');
