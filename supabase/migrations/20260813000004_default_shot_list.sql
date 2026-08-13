-- ── Cria Captação: lista de TOMADAS PADRÃO da social mídia ────────────────────
--
-- O botão "Usar tomadas padrão" (no card da captação) injetava uma lista fixa no
-- código (1 Reels, 3 Fotos, 1 Story, Bastidores) que a pessoa não conseguia
-- configurar. Agora a social mídia define a lista dela nas Configurações da
-- captação, e o botão passa a usar essa lista.
--
-- Guardada como array de texto no PERFIL DO GESTOR (config dele, poucos itens, a
-- ordem importa: é a ordem em que as tomadas entram na captação). Mesma escolha do
-- capture_cities: configuração simples de uma pessoa (o dono do tenant), sem
-- relacionamento nem histórico, então uma tabela própria seria peso morto.
-- `default '{}'` pra nunca vir null (leitura sem tratamento de null); vazio =
-- o app cai na lista fixa de fallback.
--
-- RLS: nada de política nova. profiles já tem RLS por linha (auth.uid() = id) e a
-- coluna herda a mesma proteção. Não afrouxamos nada.
alter table public.profiles
  add column if not exists default_shot_list text[] not null default '{}';
