-- ═══════════════════════════════════════════════════════════════════════════
-- APELIDO DO CLIENTE: o nome que só o GESTOR vê
--
-- O PROBLEMA
-- No cockpit do cliente, quando o cliente usa o Cria, o nome exibido era SEMPRE
-- o nome ao vivo da conta Cria dele (o profile). O gestor não conseguia dar um
-- apelido próprio (ex.: "Gabriela Kawikioni" ou "Gabi @gabrielakwk") sem mexer na
-- conta do cliente. crm_clients.name é só uma cópia estagnada do nome do Cria
-- (atualizada no sync manual da ficha), então também não servia como apelido.
--
-- A DECISÃO
-- Coluna nova crm_clients.display_name (apelido do gestor, opcional).
--   display_name preenchido -> é o nome que aparece no painel do gestor
--   display_name NULL        -> cai no nome ao vivo do Cria (comportamento atual)
-- É SÓ do gestor: não vai pro portal do cliente nem muda a conta Cria dele. O
-- sync do nome ao vivo continua mexendo só em crm_clients.name, nunca em
-- display_name (são campos separados).
-- RLS NÃO muda: a linha de crm_clients já é do gestor (manager_id).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.crm_clients
  add column if not exists display_name text;

comment on column public.crm_clients.display_name is
  'Apelido do cliente definido pelo GESTOR (só ele vê). Tem prioridade sobre o nome ao vivo do Cria e sobre crm_clients.name no painel do gestor. NULL = usa o nome ao vivo do Cria. Não vai pro portal do cliente nem muda a conta Cria dele.';
