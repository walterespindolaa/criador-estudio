# Revisão completa pré-lançamento: CRIA (go-live em 30 dias)

Data: 2026-07-19. Metodologia: 4 revisões independentes sobre o código real do repo (src, 93 migrations, 47 edge functions), nas lentes de backend-architect, security-engineer, ui-designer/mobile e performance. O build de produção foi executado e medido (`npx vite build`). Cada achado cita arquivo e linha.

---

## 1. Resumo executivo

**Veredito: dá pra lançar em 30 dias.** Não existe bloqueador arquitetural. O produto está funcionalmente pronto (todos os blocos do backlog concluídos, cadastro de gestor construído). O que falta é de duas naturezas:

1. Um punhado de correções pontuais (1 bug de tenancy no financeiro, 3 ajustes de segurança no banco, 1 correção de config do Vite que corta o bundle inicial quase pela metade).
2. Rede de proteção: QA dos fluxos críticos, Stripe em produção, monitoramento, CI. Isso é exatamente o que o seu GO-LIVE-CRIA.md já previa.

**Notas por área (0 a 10):**

| Área | Nota | Leitura |
|---|---|---|
| Arquitetura backend | 6,5 | Decisões boas (webhook idempotente, fila de e-mail com DLQ, rate-limit central), mas sem rede de proteção (types desligados, zero CI) |
| Segurança | 7,0 | Isolamento entre agências sólido, dinheiro bem fechado, vários P0 antigos corrigidos; sobram 3 ajustes de banco e a Fase 2 do colaborador |
| Mobile-first | 8,0 | PWA acima da média (safe-area, dock, offline, HEIC). Perde ponto no portal público em dark mode e em ações hover-only |
| Consistência visual | 6,5 | Tokens bons, mas 407 hex hardcoded e 344 fontes de 9-10px fora da escala |
| Performance | 6,0 | Bundle inicial de 680 kB gzip por erro de config (deveria ser ~390); listas do gestor sem paginação |

---

## 2. Os 10 achados que importam (dos ~40 encontrados)

### A. Bloqueadores (fazer antes do go-live)

**A1. [CRÍTICO] Tenancy rachada no Cria Caixa.** `src/hooks/useFinance.ts` usa `user.id` em `fin_records`/`fin_recurring` (linhas 24, 37, 91, 123, 141) mas `agencyOwnerId` em `fin_monthly` (linha 189+). No banco, a mesma racha: `fin_monthly` tem policy de time, `fin_records` é owner-only. Colaborador que abrir o Cria Caixa vê mensalidades do gestor misturadas com lançamentos próprios, e o que ele criar cai no tenant errado. É o único bug que corrompe dado financeiro. Correção: padronizar `agencyOwnerId` + policy `acts_for` nas duas tabelas, ou bloquear o módulo pra colaborador. Esforço: 1 dia.

**A2. [CRÍTICO] Bundle inicial 74% maior do que deveria.** `vite.config.ts:27-37`: o `manualChunks` em formato objeto força os chunks de PDF (177 kB gzip) e Recharts (111 kB gzip) pro carregamento inicial via modulepreload, anulando os dynamic imports que o código já faz certo. Medido: 680 kB gzip no boot; sem o erro, ~390 kB. Isso é custo em TODO primeiro acesso mobile, desde o usuário nº 1. Correção: tirar `pdf`, `charts`, `motion`, `icons` do manualChunks e deixar Login/Signup/Onboarding lazy. Esforço: meio dia. Maior ROI de todo o relatório.

**A3. [ALTO] `rl_buckets` sem RLS e sem revoke.** `20260630000000_rate_limiter.sql:3-8`. Qualquer anônimo pode zerar os contadores de rate-limit via PostgREST (anula o throttle de `meta-capi` e `bio-track`) e ler IPs de visitantes (LGPD). Correção: 2 linhas de SQL. Esforço: trivial.

**A4. [ALTO] Bucket `relatorios` público com leitura irrestrita.** `20260712110000_manager_client_cria_rpcs.sql:157-163`. Anônimo pode listar e baixar relatórios (métricas e PII de clientes) de qualquer gestor. Correção: bucket privado + signed URL, ou SELECT restrito à pasta do dono. Esforço: baixo.

**A5. [ALTO] RLS não verificável em tabelas criadas fora das migrations.** `approval_tokens`, `collabs`, `collab_deliverables`, `modules`, `moodboard_entries` nasceram no painel; o repo não prova que RLS está ligada nelas em produção. Se `approval_tokens` estiver aberta, tokens de portal de todas as agências vazam. Correção: rodar a query de verificação (seção 4) e versionar o DDL real. Esforço: 1 hora de verificação.

**A6. [ALTO] Portal público de aprovação quebra com dark mode do sistema.** `AprovarPortal.tsx:71` usa `bg-white` com `text-foreground` dentro, e o `ThemeProvider` (default "system") aplica `.dark` no html. Cliente externo que abre o link à noite com o celular em dark vê texto creme sobre card branco: ilegível na página mais crítica do produto. Bônus no mesmo arquivo: erro de rede renderiza "Tudo em dia!" (falso positivo, linha 296) e aprovar 1 post trava os botões de todos (linha 271). Correção: forçar tema claro nas páginas públicas + estado de erro com retry + busy por post. Esforço: 2 dias com teste em tela de 360px.

### B. Alto impacto (dentro dos 30 dias)

**A7. [ALTO] Colaborador: escopo por cliente só existe na UI.** `20260708160000_collab_access.sql`: a policy `acts_for` nunca consulta `manager_member_permissions`. Colaborador com acesso a 1 cliente consegue, via API direta, ler/editar/APAGAR todos os clientes, leads, contratos e financeiro da agência. Vocês já decidiram que a Fase 2 é pós-launch, e é defensável, mas com duas condições: aviso claro no popup de convite ("colaborador tem acesso técnico a toda a agência") e prioridade P1 pós-launch. Se alguma agência entrar no v1 com colaborador de escopo parcial em dado sensível, isso vira pré-requisito.

**A8. [ALTO] Listas do gestor sem paginação.** `useCriaPost.ts:159-168, 293-305` e `useCrm.ts`: `select('*')` de todos os posts/clientes da agência, sem limite (68 `select('*')` no repo, só 2 `.range()`). Agência com 30 clientes acumula 3.000+ linhas em meses: a tela mais usada fica lenta e o egress do Supabase escala linear. Correção: colunas explícitas + janela de 60-90 dias + índice `posts(user_id, scheduled_date)`. Esforço: 1-2 dias.

**A9. [ALTO] `instagram-refresh` renova tokens 1 a 1, sequencial, sem limite.** `instagram-refresh/index.ts:40-66`. Com ~150-300 conexões a edge estoura timeout e tokens não renovados morrem em 60 dias: contas desconectando sozinhas, silenciosamente. Correção: chunks paralelos de 10-20 + `.limit(200)` ordenado por expiração. Esforço: meio dia.

**A10. [ALTO] Zero CI e types desligados na camada de dados.** Não existe `.github/`; 35 arquivos usam `sbFrom` untyped e 91 `as never`, sendo que o `types.ts` está atualizado (o bypass virou hábito, não necessidade). Deploy de código com Stripe live sem nenhum gate. Correção: GitHub Actions com `tsc -p tsconfig.app.json --noEmit` + eslint + vitest + build; retypar primeiro useFinance/useCrm/useCriaPost. Esforço: 2-3 dias.

### C. Selecionados de médio impacto (agendar)

- Crons `story-notifications` e `trash-purge` não existem em migration (agendados à mão, sem heartbeat; se pararem ninguém percebe). Segredo interno de push hardcoded em `push_trigger.sql:16` (está no git: rotacionar).
- Trigger de push: 1 insert em lote de notificações = N invocações de edge. Com 1.000 usuários é rajada diária às 9h. Batelar.
- `claim-purchase` não confere e-mail do pagador no claim e o `peek` devolve e-mail sem auth.
- Sem observabilidade: nenhum Sentry, erro de edge só em `console.error`. O primeiro sinal de webhook quebrado seria "paguei e não ativou" no suporte.
- Mobile: 16 ações hover-only invisíveis no touch (excluir tarefa/arquivo/etiqueta), touch targets de 24-28px nos boards, `user-scalable=no` bloqueando zoom (acessibilidade), popover de notificações de 380px estourando em telas de 360px, 9 stylesheets de Google Fonts no boot (só 2 são necessárias fora do LinkInBio), login sem `autoComplete` (sem autofill de senha no PWA).
- Retenção: `notifications`, `email_send_log`, `app_logs` crescem sem purga (bomba de 12-18 meses).
- `broadcasts` legível por anon; `logo-icon.png` de 788 kB.

### O que está acima da média (não mexer)

Webhook Stripe com assinatura + idempotência atômica + rollback; checkouts com price sempre do servidor; funções admin checando role corretamente; fila de e-mail com DLQ e retry; rotas 100% lazy com prefetch em idle; react-query com staleTime e cache IndexedDB isolado por usuário; PWA completo (share_target, offline banner, safe-area, HEIC); kanban touch com haptics; 72 índices bem colocados; isolamento entre agências consistente.

---

## 3. Plano de ação: 30 dias, semana a semana

### Semana 1 (20-26/07): estancar (correções de código)
| # | Ação | Esforço | Ref |
|---|---|---|---|
| 1 | SQL de segurança: rl_buckets + broadcasts + relatorios + índices + verificação de RLS | 0,5 d | A3, A4, A5 |
| 2 | Corrigir tenancy do Cria Caixa (hooks + policies) | 1 d | A1 |
| 3 | Corrigir `manualChunks` + Login/Signup/Onboarding lazy + dieta de fontes | 1 d | A2 |
| 4 | Blindar portal de aprovação (tema claro forçado, erro com retry, busy por post) | 2 d | A6 |

### Semana 2 (27/07-02/08): rede de proteção
| # | Ação | Esforço | Ref |
|---|---|---|---|
| 5 | CI mínimo (tsc + eslint + vitest + build no push) + retypar useFinance/useCrm/useCriaPost | 2-3 d | A10 |
| 6 | Crons versionados em migration + heartbeat (tabela cron_runs visível no admin) + rotacionar segredo do push | 0,5 d | C |
| 7 | Sentry no front + alerta de billing_events sem ativação | 1 d | C |
| 8 | `instagram-refresh` em lotes paralelos + retenção 90d (notifications, email_send_log, app_logs) | 1 d | A9, C |

### Semana 3 (03-09/08): mobile + escala + QA
| # | Ação | Esforço | Ref |
|---|---|---|---|
| 9 | Passe de touch: hover-only (padrão `opacity-100 md:opacity-0 md:group-hover:opacity-100`), targets h-9 no mobile, popover responsivo, remover `user-scalable=no`, autoComplete no auth | 2 d | C |
| 10 | Paginação/janela de 90d no kanban e CRM + índices de approval_tokens e post_approval_comments | 1,5 d | A8 |
| 11 | Disclaimer de acesso do colaborador no convite + must() nos caminhos de seats do webhook + claim-purchase conferir e-mail | 1 d | A7, C |
| 12 | QA Fase C do runbook (fluxos com conta de teste, incluindo os 3 principais no celular) | 2 d | GO-LIVE |

### Semana 4 (10-17/08): dinheiro e go-live
| # | Ação | Esforço | Ref |
|---|---|---|---|
| 13 | Fase D: Stripe live de ponta a ponta (price IDs, webhook live, compra real + reembolso) | 1 d | GO-LIVE |
| 14 | Fase E: domínio/SSL, termos, 404, estados vazios, monitoramento validado | 1 d | GO-LIVE |
| 15 | Buffer pra regressões do QA + decisão final de abrir cadastro | 2 d | |

Total estimado: ~20 dias úteis de trabalho, cabe em 30 dias corridos com folga de buffer.

### Pós-lançamento (P1, já ordenado)
1. Colaborador Fase 2: RLS por cliente/módulo no banco (2-3 dias). Vira pré-requisito se entrar agência com colaborador de escopo parcial.
2. Batelar o trigger de push (1 chamada com lista em vez de 1 por linha).
3. Rate-limit + expiração obrigatória nas RPCs por token; limitar `log_app_error`.
4. Remover `sbFrom`/`as never` do restante dos hooks + lint proibindo o padrão.
5. Piso tipográfico de 11px + migrar hex hardcoded das telas de auth pra tokens.
6. React.memo nos cards de kanban; virtualização só se passar de ~500 itens.
7. Meta app review (Insights) e verificação Google OAuth (religar Calendar), como já planejado.

---

## 4. Como executar (seu fluxo de sempre)

Ordem dentro de cada item: SQL primeiro (você cola no SQL Editor), depois código (chunk focado), depois `git push`, depois teste do checklist.

**SQL da Semana 1, item 1 (colar no Supabase SQL Editor):**

```sql
-- 1) rl_buckets: fechar acesso via PostgREST (anon podia zerar rate-limit e ler IPs)
alter table public.rl_buckets enable row level security;
revoke all on public.rl_buckets from anon, authenticated;

-- 2) broadcasts: avisos internos não devem ser públicos
drop policy if exists "broadcasts_read" on public.broadcasts;
create policy "broadcasts_read" on public.broadcasts
  for select to authenticated
  using (active = true or public.is_admin());

-- 3) Índices que o polling do portal precisa (rodar com o app no ar, são pequenos)
create index if not exists idx_approval_tokens_client_active
  on public.approval_tokens (external_client_id, active);
create index if not exists idx_post_comments_post_created
  on public.post_approval_comments (post_id, created_at desc);
create index if not exists idx_posts_user_scheduled
  on public.posts (user_id, scheduled_date);

-- 4) VERIFICAÇÃO: RLS ligada nas tabelas criadas fora das migrations?
-- Qualquer linha com rowsecurity = false é CRÍTICO: me avise com o resultado.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('approval_tokens','collabs','collab_deliverables','modules',
                    'moodboard_entries','account_members','external_clients','crm_clients');
```

Observação sobre o item 2 do SQL: se a sua função de admin tiver outro nome que não `is_admin()`, mantenha a expressão original da policy de admin e só acrescente o `to authenticated`.

O bucket `relatorios` (A4) eu prefiro entregar junto com o código que troca o link público por signed URL, senão os links já enviados a clientes quebram. Me peça esse chunk quando for atacar o item.

**Gates antes de cada push (no terminal do VS Code):**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx vite build
```

**Critério de pronto de cada semana:** Semana 1 = SQL rodado + verificação de RLS sem false + bundle inicial < 400 kB gzip no build. Semana 2 = CI verde no GitHub + Sentry recebendo erro de teste + painel de crons mostrando última execução. Semana 3 = checklist QA Fase C 100% PASSOU (com os 3 fluxos no celular). Semana 4 = compra real ativou acesso sozinha + reembolso refletiu.

---

## 5. Onde estamos: % da entrega final

| Dimensão | % | Base |
|---|---|---|
| Funcionalidade do v1 (escopo do GO-LIVE) | ~95% | Todos os blocos do backlog concluídos; cadastro de gestor construído; falta só o secret `STRIPE_PRICE_AGENCY_SEAT` e ajustes finos |
| Segurança | ~80% | Fundação sólida e P0 antigos fechados; faltam os 3 ajustes de banco + verificação de RLS + disclaimer do colaborador |
| Performance/escala | ~70% | Arquitetura de dados boa, mas bundle 74% acima do necessário e listas sem janela |
| Mobile/UX | ~85% | PWA excelente; falta blindar o portal público e o passe de touch |
| Prontidão de produção (QA, Stripe live, CI, monitoramento) | ~40% | Fases C, D e E do runbook inteiras pela frente; zero CI e zero observabilidade hoje |

**Consolidado: ~80% da entrega final.** Em termos de rota: o produto está construído; os 20% restantes são 1 semana de correções pontuais e 2-3 semanas de validação e infraestrutura de confiança (QA, Stripe live, monitoramento). É exatamente o perfil de reta final que o seu runbook desenhou, e os 30 dias são suficientes se a ordem acima for respeitada.

---

## Anexo: relatórios brutos das 4 revisões

Os relatórios completos por área (com todos os ~40 achados, arquivo:linha, cenário de exploração e esforço) estão condensados na seção 2. Achados de severidade BAIXO omitidos aqui por brevidade: código morto (`PostDrawerLegacy.tsx`, 904 linhas sem consumidor), god files (`PostEditor.tsx` 2.571 linhas), `prefers-reduced-motion` ausente (1 linha de `MotionConfig` resolve), open redirect fraco em `Ativar.tsx`, `bunny-video-status` sem checar posse, fallback de price ID hardcoded em `collab-seats-checkout`.
