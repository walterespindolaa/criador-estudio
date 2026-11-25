-- Post de YouTube com cara de YouTube (Walter, 25/11/2026: "o sistema de
-- publicacao de video de youtube ta diferente tambem do de post do instagram?
-- ja adaptado para o youtube com tags, hashtags, etc?"; mockup aprovado).
--
-- 1. posts.youtube: o que só existe no YouTube, numa coluna só (jsonb), pra não
--    espalhar colunas que as outras redes não usam:
--    { titulo, tags[], categoria, idioma, miniatura_url, miniatura_path }.
--    A descrição continua em posts.caption e os capítulos saem do roteiro
--    (posts.sections, cada bloco com "minuto").
-- 2. redes_processando passa a olhar o YouTube: depois do envio, o vídeo fica
--    "processando" enquanto o Cria espera o YouTube terminar pra pôr a miniatura.
-- Idempotente.

alter table public.posts add column if not exists youtube jsonb;
comment on column public.posts.youtube is
  'Campos do YouTube: titulo, tags, categoria, idioma, miniatura_url, miniatura_path (25/11/2026).';

create or replace function public.redes_processando(_limite int default 10)
returns table (id uuid) language sql security definer set search_path = public as $$
  select pp.id from public.post_publicacoes pp
   where pp.rede in ('tiktok', 'linkedin', 'youtube') and pp.status = 'processando' and pp.updated_at < now() - interval '1 minute'
   order by pp.updated_at limit greatest(_limite, 1);
$$;
revoke all on function public.redes_processando(int) from public, anon, authenticated;
grant execute on function public.redes_processando(int) to service_role;

notify pgrst, 'reload schema';
