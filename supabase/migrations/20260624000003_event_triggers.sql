-- Notificações por gatilho (mais seguro que editar os RPCs públicos):
-- 1) Novo lead no link in bio -> avisa o dono.
-- 2) Cliente reage a um post do Cria Post (aprovou / pediu ajuste) -> avisa a gestora.
-- Ambos inserem em notifications, que já dispara o push automático.

-- ===== Novo lead =====
create or replace function public.notify_new_bio_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, description, link)
  values (new.user_id, 'lead', 'Novo lead no seu link in bio',
          coalesce(new.name, new.email, 'Alguém') || ' deixou o contato.', '/app/linkinbio');
  return new;
end; $$;

drop trigger if exists trg_new_bio_lead on public.bio_leads;
create trigger trg_new_bio_lead after insert on public.bio_leads
  for each row execute function public.notify_new_bio_lead();

-- ===== Reação do cliente num post do Cria Post =====
create or replace function public.notify_post_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.external_client_id is not null
     and new.approval_status is distinct from old.approval_status
     and new.approval_status in ('aprovado', 'ajuste_solicitado') then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cria_post',
            case new.approval_status
              when 'aprovado' then 'Cliente aprovou um post'
              else 'Cliente pediu ajuste num post' end,
            coalesce(new.title, 'Post'), '/socialmidia/criapost');
  end if;
  return new;
end; $$;

drop trigger if exists trg_post_approval on public.posts;
create trigger trg_post_approval after update on public.posts
  for each row execute function public.notify_post_approval();
