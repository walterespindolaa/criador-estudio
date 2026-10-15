# Pente-fino de Segurança & Qualidade — CRIA

Auditoria técnica focada em colocar o sistema à venda com segurança. Cobre abuso de IA, segurança de endpoints, proteção de dados dos clientes, performance/escala, validação de formulários, sanitização e usabilidade (web + mobile). Metodologia: varredura de código (frontend `src/`, edge functions e migrations) por três auditorias paralelas.

## Notas por área

| Área | Nota | Resumo |
|---|---|---|
| Resistência a abuso de IA (uso grátis) | 6,5/10 | Gate de acesso sólido, mas cota e rate-limit são "fail-open" |
| Segurança de endpoints / API | 7,5/10 | Auth consistente; `meta-capi` aberto e CORS frouxo |
| Segurança de dados / RLS | 8,0/10 | Isolamento por tenant forte; 3 pontas a fechar |
| Performance / escalabilidade | 5,0/10 | Front saudável; índices faltando e `instagram-sync` sequencial |
| Validação de formulários | 7,0/10 | Caminhos de dinheiro/auth ok; e-mail validado fraco |
| Sanitização / XSS | 7,0/10 | Superfícies públicas protegidas; 1 sink de HTML cru |
| Usabilidade (web + mobile) | 7,5/10 | Boa base (paridade mobile, lazy routes); sem walkthrough novo de device |
| **Prontidão geral p/ venda** | **7,0/10** | **Vendável com correções P0 antes de escalar tráfego pago** |

---

## 1. Resistência a abuso de IA — 6,5/10

**O que está bom:** o gate roda no servidor e exige `role='admin'` OU `subscription_status='active'` OU trial válido antes de qualquer geração (`ai-context-builder/index.ts:116-141`). O `userId` vem do JWT verificado, nunca do body. As ops de admin (`trend-bank-refresh`, insights) checam `_isAdmin` e retornam 403. Não dá pra um usuário sem conta usar a IA.

**Riscos (o que melhorar):**
- **[ALTO] Cota mensal "fail-open".** Se a RPC `bump_ai_quota` retorna um erro inesperado (qualquer coisa fora de `quota_exceeded`/`no_access`), o código só dá `console.warn` e **segue chamando a IA paga** (`:273-274`). Um atacante autenticado que consiga induzir erro na RPC ganha gerações ilimitadas. → Fechar: em erro desconhecido, bloquear (429/500).
- **[MÉDIO] Rate-limit "fail-open".** `checkRateLimit` retorna "permitido" em qualquer erro (`:29-37`). Uma janela de erro de banco remove o teto de 25/min. → Fechar em erro (ou cair pra um teto rígido em memória).
- **[MÉDIO/INFO] Atomicidade não verificável.** As RPCs `bump_ai_quota` e `check_and_increment_rate_limit` não estão no repositório (foram criadas no painel). Se fizerem read-then-write sem lock, requisições concorrentes furam o limite. → Versionar e garantir que são `UPDATE ... RETURNING`/`INSERT ON CONFLICT` atômicos.

## 2. Segurança de endpoints / API — 7,5/10

**O que está bom:** `stripe-webhook` valida assinatura e tem idempotência; toda função admin/manager faz `getUser()` → checa `role`/`account_type` → 403; as funções de agência checam posse (`manager-client-actions` valida `client.agency_owner_id === user.id` antes de cada ação — sem IDOR); token do Instagram nunca vai pro client; nenhum segredo hardcoded.

**Riscos:**
- **[MÉDIO] `meta-capi` aberto e sem throttle.** Sem auth, sem rate-limit, CORS `*` (`meta-capi/index.ts`). Qualquer um pode forjar conversões (event_name/value/email) e poluir a otimização de anúncio / queimar cota da CAPI. O token NÃO vaza (fica no servidor). → Rate-limit por IP + CORS restrito (+ opcional HMAC do front).
- **[BAIXO] CORS `*` em endpoints autenticados.** Maioria das funções usa `*`. Não é diretamente explorável (validam JWT no servidor), mas é mais frouxo que o necessário. → Padronizar no allow-list que `ai-context-builder` já usa.
- **[BAIXO] `bunny-video-status` sem checagem de posse** (só revela status de encoding de um GUID adivinhado). → Validar posse.
- **[BAIXO/INFO] Endpoints internos com segredo estático** (cron). Aceitável, mas rotacionar periodicamente.

## 3. Segurança de dados dos clientes / RLS — 8,0/10

**O que está bom:** todas as tabelas sensíveis têm RLS com políticas por dono (`manager_id = auth.uid()` / `user_id = auth.uid()`); `access_token` do IG e ids do Stripe nunca são enviados ao client; o histórico perigoso de "perfil público por slug" (que vazaria todas as colunas) **já foi removido** e trocado por RPC de colunas limitadas; funções SECURITY DEFINER têm `set search_path`; `sbFrom` é só um cast TS do client anon (RLS continua valendo, não é bypass).

**Riscos:**
- **[ALTO] `increment_bio_view` / `increment_bio_link_click` — escrita anônima sem limite.** Concedidas a `anon` sem throttle: dá pra inflar visitas/cliques de qualquer usuário com um script (e o bump de visitas escreve na tabela `profiles`). → Rate-limit por IP/slug.
- **[MÉDIO] `reconcile_agency_seats(_manager)` confia no id passado.** Pausa (e arma o relógio de exclusão de 60 dias) dos clientes do `_manager` recebido, sem checar que o chamador é esse manager. Hoje só é `service_role` (ok), mas se a edge algum dia repassar um id vindo do cliente, uma agência pausa clientes de outra. → Usar `auth.uid()` dentro da função ou assertar `_manager = auth.uid()`.
- **[MÉDIO] Tabelas multi-tenant fora das migrations.** `account_members`, `external_clients` e o `crm_clients` base foram criados no painel — a RLS deles não é verificável/reproduzível em código. → Capturar o DDL real (tabela + policies) em migration e confirmar RLS habilitado.
- **[BAIXO] RPCs por token (cronograma público) sem expiração.** Token de 32 hex protege, mas não há expiry/rate-limit contra adivinhação. → Rotação/expiração.

## 4. Performance / escalabilidade — 5,0/10

**O que está bom:** rotas em `lazy()`, React Query com `staleTime` 5min e sem refetch em foco, renders memoizados, libs pesadas só na rota delas.

**Riscos:**
- **[ALTO] `instagram-sync` faz 3-4 chamadas Graph sequenciais por mídia (×25) + upsert serial** (`instagram-sync/index.ts:81-109`) — ~80-100 round-trips numa invocação. Estoura o tempo da função em contas ativas; é a lentidão do botão "Atualizar". → Batch das chamadas (ou `Promise.all` com pool) + bulk-upsert.
- **[ALTO] Índices faltando em `user_id`.** Quase toda query filtra `user_id`, mas `ideas`, `tasks`, `habits`, `notifications`, `crm_clients`, `finance_entries` não têm índice de `user_id`; `posts` só tem índice parcial que a query principal não usa. → `CREATE INDEX ON <tabela>(user_id, created_at DESC)`.
- **[MÉDIO] `usePosts()` sem `.limit()` em várias páginas** (Feed, Histórico, Relatórios, Tarefas, Metas, Autopilot, etc.) — puxa o histórico inteiro (todas as colunas) toda visita. → Cap padrão + paginação + selecionar só colunas usadas.

## 5. Validação de formulários — 7,0/10

**Bom:** signup/login com zod (e-mail, senha 8-128, confirmação); quantidade de assentos travada 3-50 no client **e** no servidor (não dá pra burlar pelo body).

**Riscos:**
- **[MÉDIO] E-mail validado fraco.** Add-client (client + edge) só faz `email.includes("@")`; edit-client não valida formato. E-mails quebrados (`a@b`) passam e criam usuários/convites inválidos. → regex real / zod `.email()` nos dois lados.
- **[MÉDIO] URL do link na bio sem validação ao salvar.** Campo aceita texto livre; só o render público sanitiza. → validar com `sanitizeUrl()` (já existe) no salvar.

## 6. Sanitização / XSS — 7,0/10

**Bom:** as superfícies de maior exposição estão protegidas — links públicos da bio passam por `sanitizeUrl` (bloqueia `javascript:`) com `rel="noopener"`; markdown da IA usa `DOMPurify` + escape; relatório do cliente escapa todo valor interpolado.

**Risco:**
- **[MÉDIO] `ClientNotesDrawer` grava/relê `innerHTML` cru** sem DOMPurify (sink de HTML persistido). Mitigado por ser single-author/self-view (self-XSS), mas deve ser fechado. → DOMPurify ao salvar e ao injetar.

## 7. Usabilidade (web + mobile) — 7,5/10

Base boa: paridade de menu mobile/desktop, correções de overflow lateral, lazy loading, estados de loading/skeleton, fluxos de erro com toast. Esta nota é baseada no estado do código + auditoria de usabilidade anterior (não houve walkthrough novo em device físico nesta rodada). Pendências menores conhecidas: aria-labels em telas secundárias (acessibilidade) e revisão fina de toque em telas densas no mobile.

---

## Plano de ação priorizado

### P0 — antes de escalar tráfego pago / vender em volume
1. **Fail-closed na cota e no rate-limit da IA** (`ai-context-builder`) — fecha o buraco de IA grátis. *(rápido)*
2. **Rate-limit + CORS restrito no `meta-capi`** — evita forja de conversão / queima de cota. *(rápido)*
3. **Throttle em `increment_bio_view` / `increment_bio_link_click`** — corta inflação anônima de métricas. *(migration)*
4. **Índices de `user_id`** nas tabelas quentes — evita o paredão de performance conforme entram clientes. *(migration)*

### P1 — logo em seguida
5. Batch do `instagram-sync` (timeouts).
6. Validação real de e-mail (add/edit cliente) e URL do link na bio.
7. `reconcile_agency_seats` usar `auth.uid()` / assertar o dono.
8. Versionar tabelas fora das migrations (`account_members`, `external_clients`, `crm_clients`) e confirmar RLS.
9. DOMPurify no `ClientNotesDrawer`.

### P2 — higiene contínua
10. `usePosts` com limite/paginação + seleção de colunas.
11. Padronizar CORS allow-list nas demais functions.
12. Posse no `bunny-video-status`; rotação dos segredos internos.
13. Aria-labels nas telas secundárias.

---

*As RPCs `bump_ai_quota` e `check_and_increment_rate_limit` precisam ser revisadas no painel do Supabase para confirmar atomicidade — não estavam versionadas no repositório no momento da auditoria.*
