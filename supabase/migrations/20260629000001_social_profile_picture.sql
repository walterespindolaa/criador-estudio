-- Guarda a foto de perfil do Instagram (puxada no instagram-sync) p/ usar no Media Kit.
alter table public.social_connections
  add column if not exists profile_picture_url text;
