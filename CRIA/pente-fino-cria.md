# Pente fino — CRIA (Cria Social Club)

Auditoria minuciosa de **segurança, escala/performance, prontidão pra tráfego pago e usabilidade/estrutura**. Base: `criador-estudio` (React + Vite + Supabase/Lovable Cloud). Nenhum arquivo foi alterado nesta auditoria — é diagnóstico.

> **Veredito em uma frase:** a base é **sólida e bem cuidada** (RLS com hardening real, rotas lazy, error boundary por rota, 0 console.log, push/IA funcionando). Mas **não está pronta pra tráfego pago por dois motivos que bloqueiam o lançamento: (1) zero tracking/medição de conversão e (2) índices faltando no banco** que viram gargalo no pico. Tudo corrigível — e o Atlas já tem o tracking pronto pra portar.

---

## 🔴 P0 — Bloqueadores (resolver ANTES de subir 1 real em ads)

### 1. Zero tracking de conversão (não dá pra medir nada)
Não existe **GA4, GTM, Meta Pixel, TikTok Pixel** nem nenhum evento de conversão em todo o `index.html`/`src`. Se subir anúncio hoje, você paga por clique e o Meta/Google ficam **cegos** — não otimizam pra compra.
- **Bom:** o **Atlas já resolveu isso** — `src/lib/metaPixel.ts` (pixel + `event_id` pra dedup com CAPI), `MetaPixelTracker.tsx`, e os eventos no funil (`Comece`, `Comprar`, `ComprarSucesso`). É portar pro CRIA.
- **A fazer:** instalar o pixel/GA, disparar **PageView por rota** (SPA não recarrega), e os eventos do funil: `signup` (Signup.tsx, sucesso do cadastro + callback Google), `trial_start` (fim do onboarding, `enterApp()`), e **`Purchase`/`subscribe`** com `value` (R$ 32,90 / 49,90) e `currency: BRL`.
- **CSP:** liberar no `index.html` os domínios dos pixels em `script-src`/`connect-src`/`img-src` — senão a CSP bloqueia o pixel.

### 2. Conversão de assinatura é invisível (Stripe sem página de sucesso)
`create-checkout` manda pra `/app?checkout=success`, mas **nenhum componente lê esse parâmetro** — quem paga cai no dashboard em silêncio, **sem evento de conversão**. O evento mais importante pro anúncio (a compra) nunca é disparado.
- **A fazer:** criar rota **`/app/obrigado`** (lê `?checkout=success`, confirma a assinatura, dispara `Purchase`) e apontar o `success_url` do Stripe pra ela. Reforçar com **conversão server-side no `stripe-webhook`** (Meta CAPI + GA4) deduplicada por `event_id` — fonte de verdade do pagamento, à prova de ad-blocker/iOS. O Atlas já faz esse padrão.

### 3. Índices faltando no banco (gargalo no pico)
Várias tabelas foram criadas pelo dashboard (sem migration) e **provavelmente só têm o índice da PK** → *seq scan* que piora linearmente com o crescimento. RLS por `user_id` **não substitui índice**.
- `notifications` — sem índice em `user_id`/`created_at`, e roda no boot de TODO usuário. **Pior caso.**
- `crm_clients`, `crm_leads`, `crm_contracts` — sem índice em `manager_id`/`crm_client_id`.
- `fin_records`, `fin_recurring` — sem índice em `manager_id`, `date`, `status`.
- `bio_leads` — sem índice em `user_id` (leads de tráfego pago crescem rápido).
- `posts` — falta `(user_id, created_at)` e `(user_id, status)`.

SQL sugerido:
```sql
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_crm_clients_manager on public.crm_clients(manager_id);
create index if not exists idx_crm_leads_manager on public.crm_leads(manager_id);
create index if not exists idx_crm_contracts_manager on public.crm_contracts(manager_id);
create index if not exists idx_fin_records_manager_date on public.fin_records(manager_id, date desc);
create index if not exists idx_fin_recurring_manager on public.fin_recurring(manager_id);
create index if not exists idx_bio_leads_user on public.bio_leads(user_id, created_at desc);
create index if not exists idx_posts_user_created on public.posts(user_id, created_at desc);
create index if not exists idx_posts_user_status on public.posts(user_id, status);
```

### 4. Segredo interno hardcoded no git
`supabase/migrations/20260624000002_push_trigger.sql:15` e `20260624000004_daily_cron.sql:24` gravam o `x-internal-secret` em texto puro. Quem vê o repo/histórico pode forjar push/notificações.
- **A fazer:** rotacionar o segredo e ler de `current_setting('app.internal_secret')` / Vault em vez do literal.

### 5. "Virar post" gera posts duplicados
`Ideias.tsx:343` — o botão "Virar post" desabilita por `promoted_to_post_id`, mas `handlePromoteToPost` **nunca grava** esse campo. Dá pra clicar de novo e criar posts duplicados; o badge "Já é post" não funciona.
- **A fazer:** persistir `promoted_to_post_id` na mutation + invalidar a query de ideias.

---

## 🟠 P1 — Alto (resolver na sequência, semanas 1–2)

**Segurança**
- `storage-cleanup/index.ts:12` falha **aberto**: se `CRON_SECRET` não estiver setada, qualquer um chama a função (service_role) que apaga arquivos. Trocar pra falhar fechado: `if (!cronSecret || authHeader !== ...) return 401`.
- **RLS de `crm_clients` e `fin_records` não está versionada** (criada via dashboard). Confirmar no Supabase que têm policy `manager_id = auth.uid()` (USING + WITH CHECK) e commitar como migration. Dados financeiros e de CRM dependem disso.
- Colunas `access_expires_at` e `ai_*_used_month` são **graváveis pelo client** (usuário pode resetar a própria cota de IA). Incluir no `WITH CHECK` de `profiles` ou mover pra tabela service-role.

**Escala**
- `useNotifications.ts:21` — `select("*")` sem `.limit()` no boot. Adicionar `.limit(50)` + paginação.
- `send-push/index.ts:55` — carrega todas as inscrições e envia **sequencial**; vai dar timeout em base grande. Processar em lotes com `Promise.allSettled` + backoff em 429.
- `daily-notifications/index.ts:30` — `insert` um-a-um por usuário, **sem dedup**. Trocar por batch insert + checar duplicata na janela.
- `useFinance`, `useCrm`, `useBioLeads` — `select("*")` da tabela inteira sem limite. Filtrar por período + paginar.

**Funil / tráfego pago**
- Signup por e-mail **exige confirmação antes de entrar** → maior ponto de abandono pra tráfego frio. Priorizar **Google OAuth** como CTA primário e/ou permitir entrar antes de confirmar.
- `og:url`/`canonical` no `index.html` apontam pro domínio errado (`criador-estudio.lovable.app` em vez de `app.criasocialclub.com.br`).
- Bundle pesado no first paint (entry ~625KB + `social-share` 1,4MB com html2canvas/jspdf). Garantir lazy-load dessas libs fora da landing — afeta LCP/bounce e **Quality Score** (encarece o CPC).

**Usabilidade / erros**
- Erros de React Query são **engolidos** em ~9 páginas (Dashboard, Ideias, Tarefas, Criando, Metas, etc.): numa falha de fetch a tela fica em skeleton infinito ou "vazia". Superficiar `error` com toast/retry.
- `navigator.clipboard.writeText` sem try/catch (Dashboard, Biblioteca, LinkInBio, PostEditor) → no Safari/contexto inseguro falha mas mostra "Copiado!" mesmo assim.
- `CriaCrmClient` sem estado de erro/not-found → skeleton permanente se o id for inválido.
- `Plano.tsx` (~418 linhas) está **órfão** (App.tsx redireciona `/app/plano`→`/app/metas`): as abas Semana/Mês ficaram inacessíveis. Decidir: apagar ou religar.

---

## 🟡 P2 — Médio (qualidade, dívida técnica)

- **Tipos burlados:** padrão `sbFrom` + `as never` (50 ocorrências em 19 arquivos) nas tabelas novas (crm_*, cronograma, finance, collabs) — toda escrita nelas **pula a checagem de tipo** (um typo de coluna passa batido). Regenerar `types.ts` incluindo as tabelas e remover os casts. *(Hoje o `types.ts` está "travado" por escolha de workflow — vale reavaliar.)*
- **`PostEditor.tsx` (2453 linhas)** é um god component (upload, HEIC, IA, PDF, publish). Extrair `useMediaUpload`, `useCaptionAI`, `useAutoSave`.
- Chave **PIX exposta a anon** via `get_proposal_by_token` — confirmar se é intencional (cliente paga pelo link); senão remover do retorno.
- Tokens **Google OAuth aceitos via request body** nas functions de Calendar/Drive — mover obtenção/refresh pro server-side.
- Estados de **loading/empty inconsistentes** (PageSkeleton vs "Carregando…" vs spinner) e **ausentes** em Tarefas e Metas. Padronizar com `PageSkeleton`/`EmptyState` que já existem.
- `confirm()` nativo pra deletes em 5 telas (vs `AlertDialog` em outras) — padronizar.
- **Acessibilidade:** `index.html` desabilita pinch-zoom (`user-scalable=no`, viola WCAG 1.4.4 — reintroduzido pra "feel de app nativo"; avaliar trade-off); ~10 botões só-ícone sem `aria-label`; alguns `alt=""` em avatares.
- `instagram-sync`: 2–3 fetches sequenciais por mídia sem backoff — paralelizar com limite + tratar 429 (satura a cota do app no IG se muitos clicarem "Atualizar").
- CORS `*` em quase todas as edge functions (impacto baixo, sem cookies) — padronizar com `ALLOWED_ORIGIN` como já fazem algumas.
- `log_app_error` é anon-callable sem rate limit (risco de flood de logs).

---

## ✅ O que já está bem (não mexer)

- **Segurança de base:** sem secret/service_role no client (só a anon key pública); `access_token` do Instagram **não** é lido no client; escalonamento de privilégio via `profiles` **bloqueado** (role/plan/subscription protegidos no WITH CHECK); functions `admin-*` checam `role==='admin'`; `stripe-webhook` valida assinatura; RPCs de IG por cliente verificam `manager_id` (sem IDOR).
- **Arquitetura front:** rotas lazy + chunks separados; **ErrorBoundary por rota** + `logError` global com throttle; 0 `console.log`; 0 TODO/FIXME; react-query com `staleTime` e sem realtime aberto pesando.
- **PWA/SW** corretos; CSP presente e bem escopada.

---

## 🎁 Reaproveitar do Atlas (você já fez)

O Atlas já tem pronto, é só portar:
- `src/lib/metaPixel.ts` — pixel + `event_id` pra deduplicar com a CAPI.
- `src/components/MetaPixelTracker.tsx` — dispara PageView a cada rota.
- `src/pages/ComprarSucesso.tsx` — página de sucesso disparando `Purchase`.
- Eventos de funil em `Comece.tsx` / `Comprar.tsx`.

Portar isso pro CRIA resolve os P0 #1 e #2 quase de graça.

---

## Roadmap sugerido

**Semana 1 (destravar ads):** índices no banco (P0 #3) · portar Meta Pixel do Atlas + eventos signup/trial (P0 #1) · rota `/app/obrigado` + Purchase + CAPI no webhook (P0 #2) · CSP dos pixels · rotacionar segredo (P0 #4) · fix do "Virar post" (P0 #5).

**Semana 2 (robustez sob carga):** `.limit()` em notifications/finance/crm/bio_leads · send-push em lote · daily-notifications batch+dedup · storage-cleanup fail-closed · confirmar RLS de crm_clients/fin_records · reduzir atrito do signup (Google primeiro).

**Depois (qualidade):** superficiar erros de query · regenerar types.ts · quebrar PostEditor · padronizar loading/empty/AlertDialog · acessibilidade.

> Quer que eu já comece pela **Semana 1**? Posso portar o tracking do Atlas e criar os índices num passo só (você roda o SQL + git push).
</content>
