-- Pente fino das notificações (04/09/2026). Quatro correções:
--
-- 1) claim_push_endpoint: o app tentava apagar a inscrição push de OUTRA conta
--    no mesmo aparelho com delete direto, mas o RLS só deixa apagar a própria
--    (0 linhas, em silêncio) e o insert seguinte estourava no UNIQUE do
--    endpoint. Quem trocava de conta no mesmo celular nunca conseguia ligar
--    os avisos. Agora a posse é tomada por RPC security definer.
--
-- 2) notify_post_approval: (a) a gestora se auto-avisava ao mudar o status do
--    próprio post no board; (b) o push dizia só o título, sem o comentário do
--    cliente, apesar de a tela prometer "com o comentário dele junto".
--
-- 3) notify_client_comment: comentário do cliente SEM mudar status era silêncio.
--
-- 4) Índice (user_id, read) pro contador do sino.

-- 1) Posse do endpoint push ---------------------------------------------------
create or replace function public.claim_push_endpoint(
  _endpoint text, _p256dh text, _auth text, _user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if _endpoint is null or length(_endpoint) < 20 then
    raise exception 'endpoint inválido';
  end if;
  -- O aparelho passa a pertencer a quem acabou de ligar, seja de quem for.
  delete from public.push_subscriptions where endpoint = _endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), _endpoint, _p256dh, _auth, _user_agent);
end; $$;

revoke all on function public.claim_push_endpoint(text, text, text, text) from public;
grant execute on function public.claim_push_endpoint(text, text, text, text) to authenticated;

-- 2) Aprovação do cliente: sem auto-aviso e com o comentário junto -------------
create or replace function public.notify_post_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _comentario text;
begin
  if new.external_client_id is not null
     and new.approval_status is distinct from old.approval_status
     and new.approval_status in ('aprovado', 'ajuste_solicitado')
     -- Foi a própria dona mexendo no board (auth.uid() = dona)? Não avisa.
     -- Pelo link público do cliente auth.uid() é nulo, e aí avisa.
     and (auth.uid() is null or auth.uid() <> new.user_id) then
    select c.content into _comentario
    from public.post_approval_comments c
    where c.post_id = new.id and c.author_role = 'cliente'
    order by c.created_at desc limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'cria_post',
            case new.approval_status
              when 'aprovado' then 'Cliente aprovou: ' || coalesce(new.title, 'post')
              else 'Cliente pediu ajuste: ' || coalesce(new.title, 'post') end,
            case
              when new.approval_status = 'ajuste_solicitado' and _comentario is not null
                then '"' || left(_comentario, 180) || '"'
              when new.approval_status = 'aprovado' then 'Pode seguir pra produção final.'
              else 'Abra o post pra ver o pedido.' end,
            '/socialmidia/criapost');
  end if;
  return new;
end; $$;

drop trigger if exists trg_post_approval on public.posts;
create trigger trg_post_approval after update on public.posts
  for each row execute function public.notify_post_approval();

-- 3) Comentário do cliente sem mudar status -----------------------------------
create or replace function public.notify_client_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _dono uuid; _titulo text; _status text;
begin
  if new.author_role <> 'cliente' then return new; end if;
  select p.user_id, p.title, p.approval_status into _dono, _titulo, _status
  from public.posts p where p.id = new.post_id;
  if _dono is null then return new; end if;
  -- Se o status mudou nos últimos 60s, o notify_post_approval já avisou com
  -- este mesmo comentário: não duplica.
  if exists (
    select 1 from public.notifications n
    where n.user_id = _dono and n.type = 'cria_post'
      and n.created_at > now() - interval '60 seconds'
      and n.title like '%' || coalesce(_titulo, '') || '%'
  ) then return new; end if;
  insert into public.notifications (user_id, type, title, description, link)
  values (_dono, 'comentario_cliente',
          'Cliente comentou: ' || coalesce(_titulo, 'post'),
          '"' || left(new.content, 180) || '"',
          '/socialmidia/criapost');
  return new;
end; $$;

drop trigger if exists trg_client_comment on public.post_approval_comments;
create trigger trg_client_comment after insert on public.post_approval_comments
  for each row execute function public.notify_client_comment();

-- 4) Índice do contador de não lidas ------------------------------------------
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id) where read = false;
