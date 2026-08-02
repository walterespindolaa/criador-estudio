-- ============================================================
-- BANCO DE HASHTAGS DO CLIENTE
--
-- Pedido real: "da Laura eu tenho #hof #balneariocamboriu #harmonizacaofacial
-- #esteticaregenerativa #skincare, pra usar nos posts que ela pediu". A social
-- mídia quer guardar esse bloco por cliente, ir somando e tirando ao longo do
-- tempo e COPIAR TUDO DE UMA VEZ pra colar na legenda do Instagram.
--
-- ── COLUNA text[] EM crm_clients, NÃO TABELA PRÓPRIA ──
-- Avaliei as duas. Coluna ganha, por quatro motivos concretos:
--
-- 1) A ORDEM IMPORTA e sai de graça. A pessoa monta um bloco na ordem em que
--    quer colar. Em array, a ordem É o índice: reordenar é UM update com o
--    array já na ordem nova. Em tabela própria eu precisaria de uma coluna
--    "position", e arrastar uma hashtag do fim pro começo viraria N updates
--    (ou um upsert do conjunto inteiro) só pra renumerar.
--
-- 2) O VOLUME É PEQUENO e o acesso é sempre o conjunto inteiro. São algumas
--    dezenas por cliente, sempre lidas todas juntas e sempre gravadas todas
--    juntas (o bloco é a unidade de uso, não a hashtag solta). Linha por
--    hashtag só criaria trabalho de junção pra devolver exatamente o mesmo
--    array. Não existe metadado por hashtag aqui: nada de cor, nota, autor,
--    contador de uso. Só o texto e a posição.
--
-- 3) RLS SEM POLICY NOVA, e por isso mesmo coerente com o resto por
--    construção. crm_clients já tem as duas policies do padrão do CRM:
--      crm_clients_owner → manager_id = auth.uid()
--      crm_clients_team  → public.acts_for(manager_id)  (colaborador do time)
--    Coluna nova herda as duas na hora. Tabela nova precisaria repetir esse
--    par de policies e correr o risco de sair um fio de fora.
--
-- 4) JÁ É O PADRÃO DA CASA pra lista curta de texto do cliente:
--    crm_clients.tags text[] (etiquetas) e crm_clients.services text[] usam
--    exatamente esta forma.
--
-- Por que text[] e não jsonb: o conteúdo é uma lista plana de strings. jsonb
-- traria peso e ambiguidade (objeto? array? null?) sem nada em troca. text[]
-- é tipado, ordenado e indexável com GIN se um dia precisar.
--
-- NORMALIZAÇÃO fica no aplicativo (src/hooks/useClientHashtags.ts): tudo entra
-- minúsculo, sem acento, sem espaço e com "#" na frente. O banco só guarda o
-- que chegou; a garantia de formato é feita num lugar só, no ponto de entrada.
--
-- PRIVACIDADE: nenhuma. Hashtag existe pra ir pública na legenda. Ainda assim
-- a coluna não entra em RPC pública nenhuma, porque as RPCs do cliente têm
-- lista de colunas explícita e crm_clients não é servida por token.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

alter table public.crm_clients
  add column if not exists hashtags text[] not null default '{}';

comment on column public.crm_clients.hashtags is
  'Banco de hashtags do cliente, na ordem em que a pessoa montou o bloco pra colar na legenda. Já vem normalizado do app: minúsculo, sem acento, sem espaço, com "#" na frente e sem repetido. O Instagram aceita 30 por post, mas aqui o banco pode ser maior: a tela avisa e não bloqueia.';

-- Teto de sanidade contra colagem acidental de uma legenda inteira virando
-- centenas de linhas. 300 é MUITO acima do uso real (dezenas) e MUITO acima do
-- limite do Instagram (30 por post), então não atrapalha ninguém de verdade.
alter table public.crm_clients
  drop constraint if exists crm_clients_hashtags_max;
alter table public.crm_clients
  add constraint crm_clients_hashtags_max
  check (coalesce(array_length(hashtags, 1), 0) <= 300);

-- SEM ÍNDICE de propósito. A leitura é sempre "as hashtags DESTE cliente",
-- ou seja, busca pela primary key. Um GIN aqui só custaria escrita. Se um dia
-- aparecer "quais clientes usam #skincare", a linha é esta:
--   create index if not exists idx_crm_clients_hashtags
--     on public.crm_clients using gin (hashtags);
