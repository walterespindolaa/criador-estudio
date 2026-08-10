-- ============================================================
-- Histórico de ajustes no PORTAL do cliente (/aprovar/:token).
--
-- Problema: quando o cliente pedia ajuste e a social mídia reenviava o post,
-- o card voltava "limpo" pro cliente: ele não tinha como comparar o que pediu
-- com a versão nova. O histórico completo (post_approval_comments) só aparecia
-- do lado do gestor, no modal "Histórico de aprovação".
--
-- Solução: RPC nova list_post_comments_by_token, que devolve TODOS os
-- comentários dos posts visíveis daquele token, pro portal montar o bloco
-- "Ver o que você pediu (N)" em cada post que já teve ajuste.
--
-- O que a RPC expõe (e SÓ isso):
--   post_id     -> pra agrupar por post (o portal já recebe esse id no
--                  list_posts_by_token, não é dado novo)
--   author_kind -> 'cliente' (o próprio cliente: roles cliente_externo/cliente)
--                  ou 'equipe' (qualquer papel interno). NUNCA o author_id nem
--                  o nome de usuário interno.
--   content     -> o texto do comentário
--   created_at  -> a data, pro cliente se situar na conversa
--
-- O que NÃO sai daqui: id do comentário, author_id, etiquetas internas,
-- posts de outros clientes (o token delimita o cliente) e posts em produção
-- ou postados (mesmo filtro de status do list_posts_by_token).
--
-- Segurança: mesmo padrão das outras RPCs do portal: SECURITY DEFINER,
-- token ativo e não expirado, módulo aprovapost_externo ligado no gestor.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ============================================================

create or replace function public.list_post_comments_by_token(_token text)
returns table(post_id uuid, author_kind text, content text, created_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  -- Valida o token exatamente como o list_posts_by_token.
  with tok as (
    select t.manager_id, t.external_client_id
    from public.approval_tokens t
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select
    p.id,
    -- Rótulo neutro: o portal traduz 'cliente' pra "Você" e 'equipe' pro nome
    -- da social mídia (que o header público já mostra) ou "Equipe".
    case when c.author_role in ('cliente_externo', 'cliente') then 'cliente' else 'equipe' end,
    c.content,
    c.created_at
  from tok
  join public.posts p
    on p.external_client_id = tok.external_client_id
   and p.user_id = tok.manager_id
  join public.post_approval_comments c on c.post_id = p.id
  -- Só os posts que o portal mostra (nada de em produção / postado).
  where p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
  order by p.id, c.created_at asc;
$$;

-- O portal é público (sem login): anon precisa executar.
grant execute on function public.list_post_comments_by_token(text) to anon, authenticated;
