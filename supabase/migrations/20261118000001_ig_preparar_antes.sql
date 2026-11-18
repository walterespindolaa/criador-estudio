-- Prepara a mídia dos posts agendados ANTES da hora de publicar (18/11/2026).
-- Antes, a mídia só era preparada no minuto da publicação: vídeo do Drive
-- precisava ser copiado e processado ali, e o post atrasava (caso da Gabi).
-- Agora, a cada 5 min, os posts agendados nos próximos 7 dias com mídia ainda
-- não preparada são mandados pra instagram-preparar-midia (já publicada).

alter table public.external_media_refs
  add column if not exists ig_preparo_pedido_em timestamptz;

comment on column public.external_media_refs.ig_preparo_pedido_em is
  'Último pedido de preparo antecipado (ig_preparar_antes). Evita pedir de novo antes de 15 min.';

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
       and p.publicar_em > now()
       and p.publicar_em < now() + interval '7 days'
       and exists (
         select 1 from public.external_media_refs m
          where m.post_id = p.id
            and coalesce(m.substituida, false) = false
            and m.ig_preparado_em is null
            and m.ig_erro is null
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

select cron.schedule('cria-ig-preparar-antes', '*/5 * * * *', $cron$ select public.ig_preparar_antes(); $cron$);
