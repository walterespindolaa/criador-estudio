-- ═══════════════════════════════════════════════════════════════════════════
-- MEDIA KIT (31/08) · pedidos do Walter:
--  · nome do kit editável (não fica preso ao nome do perfil)
--  · foto própria do kit (a do Instagram expira no CDN e sumia)
--  · melhores conteúdos opcionais e ESCOLHÍVEIS (a pessoa mostra os posts
--    que têm mais a ver com a marca que vai contratá-la)
-- A cor de destaque (accent) já existia na tabela.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.media_kit_profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists show_top_posts boolean not null default true,
  add column if not exists featured_post_ids jsonb;
