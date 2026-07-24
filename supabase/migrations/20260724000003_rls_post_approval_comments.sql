-- B4 (varredura pré-lançamento): RLS de post_approval_comments.
--
-- Essa tabela é lida e escrita direto pelo client (useApprovals.ts / useCriaPost.ts)
-- e NÃO tinha RLS versionada. Se a policy do dashboard estivesse ausente ou como
-- using(true), qualquer usuário logado poderia ler o feedback de clientes de outra
-- agência e inserir comentários forjados. Aqui amarramos o acesso ao DONO do post
-- relacionado — nunca using(true).
--
-- O caminho PÚBLICO (portal do cliente por token) escreve/lê via RPC SECURITY
-- DEFINER, que ignora RLS, então NÃO precisa de policy pra anon nesta tabela.
--
-- Idempotente: pode rodar de novo sem quebrar.

alter table public.post_approval_comments enable row level security;

-- Quem pode ver/escrever o comentário = quem já pode enxergar o post relacionado:
-- dono do post (user_id, coberto por acts_for), colaborador ativo do time
-- (acts_for -> is_team_member) ou gestor que opera a conta (is_account_member).
drop policy if exists "post_approval_comments_owner_select" on public.post_approval_comments;
create policy "post_approval_comments_owner_select" on public.post_approval_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_approval_comments.post_id
        and (public.acts_for(p.user_id) or public.is_account_member(p.user_id))
    )
  );

drop policy if exists "post_approval_comments_owner_insert" on public.post_approval_comments;
create policy "post_approval_comments_owner_insert" on public.post_approval_comments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_approval_comments.post_id
        and (public.acts_for(p.user_id) or public.is_account_member(p.user_id))
    )
  );
