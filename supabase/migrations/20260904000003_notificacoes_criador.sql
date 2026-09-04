-- Notificações do CRIADOR (04/09/2026).
-- No fluxo do criador (post SEM external_client_id), quem produz é a social
-- mídia e quem aprova é o criador. Nenhum dos dois lados era avisado:
--   a) social mídia deixa o post em "Pronto" -> criador precisa saber que tem
--      algo esperando o ok dele (aba Aprovações);
--   b) criador aprova ou pede ajuste -> a social mídia (membro ativo da conta)
--      precisa saber, com o comentário junto.
-- Mantém o comportamento do Cria Post (cliente externo) intacto.

create or replace function public.notify_post_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _comentario text;
  _ator uuid := auth.uid();
  _membro record;
begin
  -- ===== Cria Post (cliente externo): reação do cliente avisa a gestora =====
  if new.external_client_id is not null then
    if new.approval_status is distinct from old.approval_status
       and new.approval_status in ('aprovado', 'ajuste_solicitado')
       and (_ator is null or _ator <> new.user_id) then
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
  end if;

  -- ===== Fluxo do criador (sem cliente externo) =====
  -- a) Alguém que NÃO é o dono (a social mídia) deixou o post em Pronto.
  if new.status = 'editando' and old.status is distinct from 'editando'
     and _ator is not null and _ator <> new.user_id then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'aprovacao_pendente',
            'Post pronto pra sua aprovação',
            coalesce(new.title, 'Post') || '. Dê o ok ou peça ajuste.',
            '/app/aprovacao');
  end if;

  -- b) O dono aprovou ou pediu ajuste: avisa cada membro ativo da conta.
  if new.approval_status is distinct from old.approval_status
     and new.approval_status in ('aprovado', 'ajuste_solicitado')
     and _ator is not null and _ator = new.user_id then
    select c.content into _comentario
    from public.post_approval_comments c
    where c.post_id = new.id and c.author_id = new.user_id
    order by c.created_at desc limit 1;
    for _membro in
      select m.member_id from public.account_members m
      where m.owner_id = new.user_id and m.status = 'active' and m.member_id is not null
    loop
      insert into public.notifications (user_id, type, title, description, link)
      values (_membro.member_id, 'cria_post',
              case new.approval_status
                when 'aprovado' then 'Criador aprovou: ' || coalesce(new.title, 'post')
                else 'Criador pediu ajuste: ' || coalesce(new.title, 'post') end,
              case
                when new.approval_status = 'ajuste_solicitado' and _comentario is not null
                  then '"' || left(_comentario, 180) || '"'
                when new.approval_status = 'aprovado' then 'Pode agendar e publicar.'
                else 'Abra o post pra ver o pedido.' end,
              '/socialmidia/aprovacoes');
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists trg_post_approval on public.posts;
create trigger trg_post_approval after update on public.posts
  for each row execute function public.notify_post_approval();

-- Tipos novos entram na categoria certa das preferências.
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes' when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes' when 'roteiro' then 'clientes' when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes' when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'resumo_dia' then 'lembretes' when 'lembrete_postar' then 'lembretes' when 'posts_pendentes' then 'lembretes'
    when 'prazo_amanha' then 'lembretes' when 'resumo_semana_ig' then 'lembretes'
    when 'story' then 'lembretes' when 'captacao_amanha' then 'lembretes' when 'aniversario_cliente' then 'lembretes'
    when 'meta_batida' then 'conquistas' when 'dica_dia' then 'conquistas' when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas' when 'ideia_criada' then 'conquistas'
    else 'avisos' end
$$;
