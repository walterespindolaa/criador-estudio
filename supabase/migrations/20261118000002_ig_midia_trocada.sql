-- Troca de mídia no meio do caminho (18/11/2026, pedido do Walter).
-- Com o preparo antecipado, a mídia pode ficar pronta horas antes. Se a pessoa
-- trocar, reordenar ou tirar uma mídia depois disso, nada do que foi preparado
-- com a versão antiga pode ir pro Instagram.
--
-- Como a troca acontece hoje: mídia nova é linha nova (preparo zerado), mídia
-- tirada é apagada ou marcada substituida. A publicação sempre relê as mídias
-- atuais. O buraco era o contêiner do Instagram guardado no post de uma
-- tentativa anterior: ele seria reaproveitado com a mídia velha. Agora:
--  1. qualquer mudança nas mídias de um post (entrar, sair, substituir,
--     reordenar, trocar o arquivo) apaga o contêiner guardado;
--  2. se o arquivo de uma linha muda, o preparo dela é zerado.

create or replace function public.ig_midia_zera_preparo()
returns trigger language plpgsql as $$
begin
  if (new.external_file_id, new.view_url, new.bunny_video_id)
     is distinct from (old.external_file_id, old.view_url, old.bunny_video_id) then
    new.ig_url := null;
    new.ig_tipo := null;
    new.ig_largura := null;
    new.ig_altura := null;
    new.ig_duracao := null;
    new.ig_preparado_em := null;
    new.ig_erro := null;
    new.ig_preparo_pedido_em := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_ig_midia_zera_preparo on public.external_media_refs;
create trigger trg_ig_midia_zera_preparo
  before update on public.external_media_refs
  for each row execute function public.ig_midia_zera_preparo();

create or replace function public.ig_midia_zera_container()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_posts uuid[];
begin
  if tg_op = 'INSERT' then
    v_posts := array[new.post_id];
  elsif tg_op = 'DELETE' then
    v_posts := array[old.post_id];
  else
    if (new.post_id, new.substituida, new.position, new.external_file_id, new.view_url, new.bunny_video_id)
       is not distinct from (old.post_id, old.substituida, old.position, old.external_file_id, old.view_url, old.bunny_video_id) then
      return null;
    end if;
    v_posts := array[old.post_id, new.post_id];
  end if;

  update public.posts
     set ig_container_id = null
   where id = any(v_posts)
     and ig_container_id is not null
     and ig_media_id is null;
  return null;
end $$;

drop trigger if exists trg_ig_midia_zera_container on public.external_media_refs;
create trigger trg_ig_midia_zera_container
  after insert or update or delete on public.external_media_refs
  for each row execute function public.ig_midia_zera_container();

-- Preparo antecipado: não pega post a menos de 3 min da hora (a publicação já
-- vai preparar) nem vídeo do Drive que ainda está subindo pro Bunny em segundo
-- plano (evita copiar o mesmo vídeo duas vezes).
create or replace function public.ig_preparar_antes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segredo text;
  v_n integer := 0;
  r record;
begin
  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'internal_push_secret' limit 1;
  if v_segredo is null then return 0; end if;

  for r in
    select p.id, coalesce(p.publish_by, p.user_id) as actor
      from public.posts p
     where p.auto_publish
       and p.publish_status = 'na_fila'
       and p.deleted_at is null
       and p.publicar_em > now() + interval '3 minutes'
       and p.publicar_em < now() + interval '7 days'
       and exists (
         select 1 from public.external_media_refs m
          where m.post_id = p.id
            and coalesce(m.substituida, false) = false
            and m.ig_preparado_em is null
            and m.ig_erro is null
            and coalesce(m.ingest_status, '') in ('', 'pronto', 'erro')
            and (m.ig_preparo_pedido_em is null
                 or m.ig_preparo_pedido_em < now() - interval '15 minutes'))
     order by p.publicar_em
     limit 5
  loop
    update public.external_media_refs
       set ig_preparo_pedido_em = now()
     where post_id = r.id
       and coalesce(substituida, false) = false
       and ig_preparado_em is null
       and ig_erro is null;

    perform net.http_post(
      url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/instagram-preparar-midia',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_segredo),
      body := jsonb_build_object('post_id', r.id, 'actor_id', r.actor),
      timeout_milliseconds := 150000);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.ig_preparar_antes() from public, anon, authenticated;
