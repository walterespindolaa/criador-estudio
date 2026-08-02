-- ============================================================
-- ETIQUETAS INTERNAS DO POST (Cria Post)
--
-- Pedido: marcar o post com etiqueta que SÓ a agência vê ("Prioridade",
-- "Gravar externa", "Aguardando material do cliente", "Patrocinado"...).
-- O cliente NÃO pode ver isso em lugar nenhum.
--
-- ESCOPO PRÓPRIO, separado do crm_tags:
-- crm_tags é o catálogo de etiquetas de CLIENTE ("VIP", "Inadimplente",
-- "Renovação próxima"). Misturar os dois conjuntos num seletor só polui os
-- dois lados. Aqui criamos post_tags, com a MESMA mecânica (catálogo por
-- agência, nome + cor da mesma paleta, RLS igual) e etiquetas padrão que
-- fazem sentido pra produção de post.
--
-- POR QUE GUARDAR IDs (uuid[]) E NÃO NOMES:
-- crm_clients.tags guarda o NOME da etiqueta, então renomear no catálogo
-- deixa o nome antigo preso nos clientes já marcados. Como aqui é feature
-- nova (sem dado legado), guardamos o ID: renomear ou trocar a cor reflete
-- em todos os posts na hora. Id que não existe mais no catálogo é ignorado
-- na leitura (o front pula id desconhecido).
--
-- PRIVACIDADE (o requisito crítico):
-- A coluna nova NÃO é adicionada a nenhuma função pública. As RPCs que
-- servem o cliente (list_posts_by_token, get_cronograma_by_token, e as de
-- aprovação) têm lista de colunas EXPLÍCITA, nunca "select p.*", então
-- coluna nova em posts não entra sozinha no que o cliente recebe. Nenhuma
-- policy de anon é criada em post_tags: o catálogo é só de quem está logado
-- e pertence ao tenant.
-- ============================================================

-- ── Catálogo de etiquetas de POST da agência (nome + cor) ──
create table if not exists public.post_tags (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'slate',   -- slate|emerald|amber|rose|violet|sky|orange|green
  created_at timestamptz default now(),
  unique (manager_id, name)
);

alter table public.post_tags enable row level security;

-- Dono do tenant.
drop policy if exists "post_tags_owner" on public.post_tags;
create policy "post_tags_owner" on public.post_tags
  for all to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());

-- Colaborador ativo do time (mesmo helper das outras tabelas da agência).
drop policy if exists "post_tags_team" on public.post_tags;
create policy "post_tags_team" on public.post_tags
  for all to authenticated using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));

create index if not exists idx_post_tags_manager on public.post_tags(manager_id);

-- ── Etiquetas escolhidas em cada post ──
-- Fica na própria linha do post (array de ids), igual crm_clients.tags.
-- Sem RLS nova: posts já é protegida pelas policies existentes (user_id +
-- acts_for), e o cliente externo nunca lê posts direto, só via RPC.
alter table public.posts
  add column if not exists internal_tags uuid[] not null default '{}';

comment on column public.posts.internal_tags is
  'Etiquetas INTERNAS do post (ids de public.post_tags). Uso exclusivo da agência: nunca expor em RPC pública, portal de aprovação, cronograma público ou relatório do cliente.';

-- Filtrar o board por etiqueta sem varrer a tabela inteira.
create index if not exists idx_posts_internal_tags on public.posts using gin (internal_tags);
