-- Push automático: a cada notificação criada, dispara o push pro aparelho do usuário.
-- Usa pg_net pra chamar a edge function send-push. Protegido por EXCEPTION pra nunca
-- quebrar a criação da notificação se o push falhar.

create extension if not exists pg_net;

create or replace function public.notify_push_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform net.http_post(
      url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '__INTERNAL_PUSH_SECRET__'  -- SEGREDO ROTACIONADO: preencher antes de rodar (Vault / SQL manual). NAO commitar valor real.
      ),
      body := jsonb_build_object(
        'user_id', new.user_id,
        'title', coalesce(new.title, 'Cria'),
        'message', coalesce(new.description, new.title, ''),
        'url', coalesce(new.link, '/app')
      )
    );
  exception when others then
    null;  -- push é "best effort": nunca derruba o insert da notificação
  end;
  return new;
end; $$;

drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push after insert on public.notifications
  for each row execute function public.notify_push_on_insert();
