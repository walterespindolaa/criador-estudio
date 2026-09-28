-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO INSTAGRAM · CICLO 3 · PREPARAR A MÍDIA (28/09/2026)
-- Plano: CRIA/publicar-instagram-plano.md
--
-- 1. Cada mídia do post ganha o "endereço pro Instagram": a URL pública, já no
--    formato que a API aceita (JPEG ou MP4), preparada pela função
--    instagram-preparar-midia. Fica guardada pra não refazer o trabalho a
--    cada tentativa (e pra o robô do ciclo 6 só publicar, sem converter na
--    hora H). Se a mídia for trocada, o front apaga a linha e cria outra, então
--    o que está guardado nunca fica velho.
-- 2. Reordenar e renovar a validade das mídias passam a aceitar a EQUIPE
--    (antes só o dono: colaborador reordenava e nada acontecia).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.external_media_refs
  add column if not exists ig_url text,            -- URL pública pronta (JPEG/MP4)
  add column if not exists ig_tipo text,           -- 'IMAGE' | 'VIDEO'
  add column if not exists ig_largura integer,
  add column if not exists ig_altura integer,
  add column if not exists ig_duracao numeric,     -- segundos (vídeo)
  add column if not exists ig_bunny_guid text,     -- vídeo do Drive copiado pro Bunny só pra publicar
  add column if not exists ig_preparado_em timestamptz,
  add column if not exists ig_erro text;           -- motivo em português quando não deu

comment on column public.external_media_refs.ig_url is
  'Ciclo 3 do publicar: URL pública no formato da API do Instagram (JPEG/MP4). Preenchida pela função instagram-preparar-midia.';

-- ── Reordenar: dono OU equipe (acts_for) ──────────────────────────────────
create or replace function public.criapost_reorder_media(p_post_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = p_post_id;
  -- Antes: v_owner <> auth.uid(). Colaborador da agência reordenava a tira e
  -- nada mudava (e o carrossel publicaria na ordem errada).
  if v_owner is null or not public.acts_for(v_owner) then
    raise exception 'not allowed';
  end if;
  update public.external_media_refs m
     set position = t.ord - 1
    from unnest(p_ids) with ordinality as t(id, ord)
   where m.id = t.id and m.post_id = p_post_id;
end; $$;

-- ── Renovar validade: dono OU equipe, e pra post de criador também ─────────
create or replace function public.criapost_touch_media(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = p_post_id and deleted_at is null;
  if v_owner is null or not public.acts_for(v_owner) then return; end if;
  update public.external_media_refs
     set expires_at = greatest(coalesce(expires_at, now()), now() + interval '7 days')
   where post_id = p_post_id and expires_at is not null;
end $$;

notify pgrst, 'reload schema';
