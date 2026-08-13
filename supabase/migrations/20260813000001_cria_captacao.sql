-- ── Cria Captação: painel de gerência das captações (gravações) da social mídia ──
--
-- O módulo NÃO cria uma tabela nova de captação: ele LÊ das captações que já
-- existem na Agenda (public.agenda_captures). Aqui só acrescentamos três campos,
-- todos com "add column if not exists" (idempotente, seguro de rodar de novo).
--
-- RLS: nada de política nova. As três tabelas tocadas (agenda_captures, profiles,
-- crm_clients) já têm RLS coerente do projeto:
--   • agenda_captures  -> dono via acts_for(manager_id) (20260708160000_collab_access)
--                         + gate de módulo member_can(manager_id,'agenda') (f22).
--   • crm_clients      -> member_can_client(manager_id, id, 'cria_gestao') (f22).
--   • profiles         -> a própria linha (auth.uid() = id).
-- Como as políticas são por LINHA (não por coluna), as colunas novas herdam a
-- mesma proteção automaticamente. Não afrouxamos nada.

-- 1) ROTEIRO DA CAPTAÇÃO ──────────────────────────────────────────────────────
-- Texto do roteiro daquela gravação (o que o gestor copia cru no painel). É
-- SEPARADO de `note`: `note` continua a nota livre ("levar tripé"), `roteiro` é o
-- roteiro em si. Nullable, sem default: captação antiga fica com roteiro vazio.
alter table public.agenda_captures
  add column if not exists roteiro text;

-- 2) CIDADES ATENDIDAS PELA SOCIAL MÍDIA ──────────────────────────────────────
-- Guardadas como array de texto no PERFIL DO GESTOR (config dele, poucos itens, a
-- ordem quase não importa). Escolhido em vez de tabela própria porque é
-- configuração simples de uma pessoa (o gestor/dono do tenant), sem relacionamento
-- nem histórico: uma tabela só pra três strings seria peso morto e mais uma RLS pra
-- manter. `default '{}'` pra nunca vir null (leitura sem tratamento de null).
alter table public.profiles
  add column if not exists capture_cities text[] not null default '{}';

-- 3) CIDADE DO CLIENTE ────────────────────────────────────────────────────────
-- Cidade daquele cliente/empresa, pra o gráfico "quantas captações por cidade".
-- Idealmente uma das cidades cadastradas em profiles.capture_cities, mas texto
-- livre pra não travar (cliente pode ser de fora da lista). Nullable.
alter table public.crm_clients
  add column if not exists city text;
