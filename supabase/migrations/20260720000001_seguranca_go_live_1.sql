-- Segurança go-live (bloco 1): rl_buckets, broadcasts e índices do portal
-- Idempotente. Aplicado manualmente no SQL Editor; versionado aqui.

-- 1) rl_buckets: sem RLS ficava acessível via PostgREST (anon podia zerar o
--    rate-limit de meta-capi/bio-track e ler IPs de visitantes). Só service_role
--    precisa, e sempre via rate_touch(). Fechamos a tabela.
alter table public.rl_buckets enable row level security;
revoke all on public.rl_buckets from anon, authenticated;

-- 2) broadcasts: a policy de leitura não tinha TO, então valia pra anon.
--    Recados são internos do app: restringir a usuários logados.
drop policy if exists "Read active broadcasts" on public.broadcasts;
create policy "Read active broadcasts" on public.broadcasts
  for select to authenticated
  using (
    active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 3) Índices que o portal de aprovação precisa (polling de 60s + comentários + kanban).
create index if not exists idx_approval_tokens_client_active
  on public.approval_tokens (external_client_id, active);
create index if not exists idx_post_comments_post_created
  on public.post_approval_comments (post_id, created_at desc);
create index if not exists idx_posts_user_scheduled
  on public.posts (user_id, scheduled_date);
