# Cria Social Club · Pente fino pré-lançamento

**Data:** 23 de setembro de 2026
**Método:** cinco varreduras independentes sobre o código (segurança, onboarding, UX/mobile, performance/robustez, negócio/billing/LGPD), cruzadas com o que foi corrigido nesta e nas sessões anteriores. Nada foi executado contra o banco de produção. Onde um achado depende de conferir o banco, está marcado como "verificar".
**Escala:** CRÍTICO (bloqueia o lançamento), ALTO (corrigir na primeira semana), MÉDIO (primeiro mês), BAIXO (quando der).

---

## 0. Resumo executivo

O produto está funcionalmente rico e a maior parte da base é sólida: as 94 tabelas versionadas têm RLS, as 138 funções definer fixam `search_path`, o webhook do Stripe verifica assinatura e é idempotente, os tokens públicos são UUID de 122 bits, os erros de rede têm toast global, o portal de aprovação é referência de qualidade. Nada aqui é "recomeçar".

O que impede o lançamento hoje são **onze pontos**, e todos têm correção conhecida e pequena:

| # | Ponto | Por quê | Correção | Esforço |
|---|---|---|---|---|
| 1 | Link de redefinição de senha pode ser envenenado pelo cabeçalho Origin | Sequestro de conta se o segredo `APP_URL` não estiver definido | Definir `APP_URL` e remover o curinga `*.lovable.app` | 30 min |
| 2 | ~30 tabelas criadas pelo dashboard sem prova de RLS (inclui `pending_purchases` com e-mails e `partners`) | Chave anon pode ler tudo se RLS estiver desligado | Rodar a query de checagem e `enable row level security` no que faltar | 1 h + verificação |
| 3 | `claim-purchase` deixa qualquer um com um `session_id` tomar a assinatura de outro | Roubo de assinatura paga | Exigir que o e-mail do comprador seja o do usuário logado e confirmado | 30 min |
| 4 | Trocar de plano cria uma segunda assinatura no Stripe | Cliente cobrado em dobro | Checar assinatura existente e usar `subscriptions.update` | 2 h |
| 5 | Recomprar um módulo cancelado quebra o webhook | Cliente paga e não recebe; Stripe reenvia o evento para sempre | Trocar `onConflict` do upsert para `(manager_id, module_code)` | 30 min |
| 6 | Webhook libera acesso sem conferir `payment_status` | Boleto não pago vira acesso liberado | `if (s.payment_status !== "paid") break` e tratar `async_payment_succeeded` | 30 min |
| 7 | Social mídia perde a IA após 7 dias mesmo pagando módulo | O produto pago para de funcionar | Na cota de IA, aceitar módulo pago como assinatura válida | 1 h |
| 8 | Parceiro de produção (freelancer) passa em `acts_for` e lê comentários, bio e insights dos clientes | Vazamento de dados de terceiros | `is_team_member` excluir papel parceiro | 1 h |
| 9 | Duas telas de pagamento de comissão e backfill que paga em dobro | Pagar parceira duas vezes | Desligar a tela antiga; não dar 20% recorrente a indicação legada que já recebeu o pagamento único | 2 h |
| 10 | Nenhum aceite de termos no cadastro, sem banner de consentimento, política de privacidade com metade dos suboperadores | Exposição legal com Pixel e CAPI rodando | Checkbox no signup chamando `accept-terms`, banner, lista completa | 3 h |
| 11 | Sem `ErrorBoundary` na raiz nem nos portais públicos | Um erro no sino deixa o app inteiro e o portal do cliente em branco | Boundary na raiz e nas rotas públicas | 1 h |

Somando: **cerca de dois dias de trabalho** para o bloqueio sair. Depois disso, a primeira semana é onboarding e mobile; o primeiro mês é performance, consistência e operação.

---

## 1. Segurança

### 1.1 Críticos

**S1 · Envenenamento do link de senha pelo Origin.** `supabase/functions/password-reset/index.ts:27-36` e `manager-add-client/index.ts:58-63` (mesma função `resolveAppUrl` em `account-invite`, `manager-member-invite`, `admin-create-user`, `admin-create-manager`, `admin-user-actions`, `manager-self-subscribe`). A função aceita qualquer `https://*.lovable.app` vindo do cabeçalho `Origin`. Um atacante chama `password-reset` (pública) com `Origin: https://evil.lovable.app` e o e-mail da vítima; o e-mail legítimo sai com o link apontando pro domínio dele.
*Correção:* segredo `APP_URL=https://app.criasocialclub.com.br` e `return Deno.env.get("APP_URL") ?? CANONICAL_APP_URL;` sem regex de lovable em produção.

**S2 · RLS nas tabelas do dashboard (verificar).** 34 tabelas usadas no código não estão em nenhuma migration: `account_members`, `admin_actions`, `approval_tokens`, `autopilot_runs`, `bio_leads`, `collab_deliverables`, `collabs`, `crm_client_refs`, `crm_clients`, `crm_contracts`, `crm_leads`, `crm_tasks`, `external_clients`, `fin_records`, `fin_records_backup_100x`, `fin_recurring`, `hub_competitors`, `hub_credits`, `manager_profiles`, `milestones`, `module_entitlements`, `modules`, `monthly_reflections`, `moodboard_entries`, `partner_program_config`, `partner_referrals`, `partners`, `pending_purchases`, `post_approval_comments`, `rate_limit_v2`, `status_covers`, `structured_goals`, `terms_acceptances`, `user_tour_progress`. Só 8 delas têm RLS ligado por migration.
*Correção:* rodar em produção

```sql
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where nspname = 'public' and relkind = 'r' and not relrowsecurity;
```

e `alter table public.X enable row level security;` em cada uma listada (com policy de dono). Apagar `fin_records_backup_100x`. Depois, `supabase db pull` pra versionar o schema real.

**S3 · `claim-purchase`.** `supabase/functions/claim-purchase/index.ts:66,85-112`. A ação `peek` é pública e devolve o e-mail do comprador; `claim` aceita qualquer `session_id` (inclusive buscado no Stripe na hora) e ativa pra quem chamar primeiro, sem conferir e-mail nem `email_confirmed_at`. O `sid` ainda vaza pelo Pixel (`src/lib/trackingUrl.ts:10-16` não inclui `/app/obrigado`).
*Correção:* `if (p.email !== user.email?.toLowerCase() || !user.email_confirmed_at) return 403`; `peek` devolve só `{found, plan}` com e-mail mascarado; adicionar `/roteiros`, `/cadastro`, `/materiais` e `/app/obrigado` em `TOKEN_ROUTES`.

### 1.2 Altos

**S4 · Funções chamáveis por `anon` sem revoke.** `reconcile_agency_seats` (`20260629000006:3`) estaciona contas de clientes de qualquer agência; `bio_lead_para_pipeline` (`20260825000004:179`) injeta leads no CRM de qualquer gestora sem checar posse do bloco.
*Correção:* `revoke all on function ... from public, anon, authenticated;` e, na segunda, `and _b.user_id = _manager`.

**S5 · Parceiro de produção dentro de `acts_for`.** `is_team_member` (`20260708160000:11-27`) não olha o papel. Policies que ainda usam `acts_for`: `post_approval_comments` (`20260724000003:20`), `bio_pages/bio_links/bio_blocks/bio_items`, `bio_stats_daily`, `video_script_adaptations` (`20260921000001:46`); e as RPCs `apply_script_approval`, `apply_intake`, `criapost_promover_para_bunny`, `manager_reschedule_client_post`, `get_client_ig_report`, `get_client_ig_media`, `manager_client_brandbook`, `manager_client_ideas`, `manager_save_client_bio`. Um freelancer lê comentários, insights e brandbook dos clientes e pode trocar o slug da bio.
*Correção de raiz:* `create or replace function is_team_member(target uuid) ... and not eh_papel_parceiro(m.role)`. Assim `acts_for` vira igual a `acts_for_equipe` e as funções de parceiro continuam com `parceiro_tem_o_card`.

**S6 · Webhook sem `payment_status`.** `stripe-webhook/index.ts:113-253`. Ativa plano, módulo, assentos e pacotes em `checkout.session.completed` sem conferir se foi pago (boleto). `async_payment_failed` não é tratado.

**S7 · Funções do dashboard com grants desconhecidos (verificar).** 34 funções não versionadas; a mais sensível é `get_user_id_by_email` (enumeração de usuários se `anon` puder executar). Query de checagem:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
```

### 1.3 Médios

- **S8** `profiles` UPDATE não trava `storage_used_bytes` (usuário zera a cota), `must_change_password`, `parceiro_role` (`20260820000002:64-94`). Trocar por `revoke update on profiles; grant update (colunas seguras)`.
- **S9** RPCs públicas de escrita por token sem rate limit nem teto de tamanho: `save_script_approval_item_by_token`, `save_intake_by_token`, `request_material_by_token`, `set_cronograma_item_by_token`, `submit_*` repetível (spam de notificação). Tokens de `script_approvals`, `client_intakes` e `cronogramas` sem `expires_at`. Adicionar `rate_touch('tok:'||_token, 30)`, `pg_column_size < 65536`, e `expires_at`.
- **S10** `log_app_error` usa o primeiro IP de `x-forwarded-for` (controlado pelo cliente) no rate limit. Usar o último.
- **S11** `increment_bio_view`, `increment_bio_link_click`, `submit_bio_lead` com grant pra `anon` pulam o rate limit por IP da edge `bio-track`. Revogar de anon; acesso só via edge.
- **S12** `material-anexo` pública, 8 MB por chamada, sem rate limit, devolve `upErr.message`. `get-instagram-config` aceita `crm_client_id` arbitrário. `manager-add-client` devolve `inviteLink` à gestora (ela controla uma identidade com e-mail de outra pessoa).
- **S13** `charge.refunded` só cancela comissão; reembolso total não revoga acesso. `subscription.updated` usa `metadata.plan` em vez do price (troca pelo Customer Portal fica com plano velho).
- **S14** `crm_clients.cria_owner_id` gravado antes do trigger de consentimento (10/08) ainda vale em `manager_reschedule_client_post`. Auditar e zerar.
- **S15** CORS `*` em ~35 funções autenticadas (risco baixo por ser Bearer), `create-checkout` monta `success_url` do Origin cru (open redirect).

### 1.4 O que está bem
Sem segredos no front. `dangerouslySetInnerHTML` sempre com DOMPurify. `localStorage` só com preferências e um uuid revalidado. Colaborador não consegue entrar em outra agência. Idempotência do webhook atômica via `billing_events` unique.

---

## 2. Negócio, billing e entrega

### 2.1 Críticos e altos

**B1 · Troca de plano gera duas assinaturas.** `src/pages/app/Assinar.tsx:127-150` sempre chama `create-checkout`, que não confere assinatura existente (`create-checkout:153-169`). O webhook sobrescreve `stripe_subscription_id` e a antiga segue cobrando. A LP promete "upgrade direto nas configurações".
*Correção:* se `stripe_subscription_id` existe, `stripe.subscriptions.update` com `proration_behavior` ou abrir o Customer Portal. E derivar plano do `price.id`, não de `metadata.plan`.

**B2 · Recompra de módulo trava o webhook.** Unicidade por `(manager_id, module_code)` (`20260720000004`) vs upsert com `onConflict: "stripe_subscription_id"` (`stripe-webhook:143-151,296-306`). Módulo cancelado e recomprado, ou liberado pelo admin e comprado: INSERT bate na unicidade, `must()` lança, evento é desfeito, Stripe reenvia. `hub_extra` (que se compra várias vezes) quebra na segunda.
*Correção:* `onConflict: "manager_id,module_code"`.

**B3 · IA para pra social mídia pagante.** `ai-context-builder/index.ts:310-319` exige `subscription_status === "active"` pessoal. A gestora grátis (`20260802000001`) recebe trial de 7 dias e depois 402, mesmo com Cria Post pago. ArtBrief, ClientContentWriter e ClientReport param.
*Correção:* na checagem de cota, `or exists (select 1 from module_entitlements where manager_id = uid and status = 'active')`. E `past_due` (`useTier.ts:24` aceita, a edge não) precisa da mesma regra nos dois lados.

**B4 · Comissão paga em dobro.** Duas telas de pagamento em `Admin.tsx:597-598` (AdminParceiras novo + AdminReferrals antigo com `partner-referral-payout`). Backfill em `20260922000002:164-181` transforma o pagamento único legado em lançamento **e** a mesma indicação volta a gerar 20% a partir da fatura 3.
*Correção:* remover a ação de pagar da tela antiga (deixar só histórico); no backfill, marcar indicações legadas com `commission_months = 0` ou `start_invoice = 999` no override do parceiro.

**B5 · Admin excluir usuário não cancela Stripe** (`admin-user-actions:160-167`). E `delete-account` cancela só a assinatura principal; módulos, assentos e pacotes continuam cobrando (`delete-account:100-115`).
*Correção:* listar `stripe.subscriptions.list({customer})` e cancelar todas.

**B6 · Sem `invoice.payment_failed`.** Nenhum e-mail de pagamento falhou, nenhum dunning. Cliente inadimplente descobre quando a IA some.

**B7 · Admin sem trilha nem confirmação.** `admin_actions` existe e nada grava nela. Role e plano mudam com um clique no select (`Admin.tsx:1027-1049`); "suspender" grava um status que `deriveSubStatus` não reconhece e o próximo webhook sobrescreve.

### 2.2 Médios

- **B8** Preço do Cria Radar: LP diz R$49,90, banco tem 0. Cria Captação (R$19,90) não está na LP. Admin não conhece o plano Essencial (`Admin.tsx:98-102`, `admin-user-actions:190`).
- **B9** Trial: 14 dias no inglês vs 7 no rodapé (`locales/en.ts:178-179`); FAQ sugere cartão; `/comprar/*.html` (Payment Link) pula o trial e tem atribuição diferente.
- **B10** CRM, Caixa e Captação travados só na interface; sem RLS por módulo. Quem chama a API tem os dados sem pagar.
- **B11** `ModuleGate` retorna `null` se módulo não está no catálogo: tela branca em rota direta.
- **B12** Contagem de fatura da comissão não atômica (`paid_invoices_count + 1`), fatura de proration gera número repetido, chargeback ignorado.
- **B13** Comissão cortada quando a parceira gerencia o cliente indicado (`stripe-webhook:437-446`), que é exatamente o caso que a página promete. E módulo/agência/pacote não geram comissão.
- **B14** Três eixos de capacidade (assento de agência, pacote de clientes, assento de colaborador), todos assinaturas separadas. Matar `plan=agency` em `Contas.tsx:60`.
- **B15** Um módulo, três nomes no código: `crm`/`cria_gestao`/"CRM"; `hub_cria`/"HUB CRIA"/"Radar"; `aprovapost_externo`/`cria_post`. Causa bugs de gate.

### 2.3 LGPD e termos (ALTO)

- Nenhum aceite no cadastro (`Signup.tsx`); a edge `accept-terms` existe e ninguém chama.
- Sem banner de consentimento com Meta Pixel + CAPI rodando (`lib/metaPixel.ts`).
- Política de privacidade lista Supabase, Stripe, Resend, Gemini, Cloudflare; faltam Perplexity, TwelveLabs, Apify, Bunny, Higgsfield, Meta, Sentry, Instagram (`Privacidade.tsx:110-140`). Termos sem CNPJ.
- Cron apaga de vez `auth.users` de clientes pausados após 60 dias sem avisar o titular (`20260629000005:40-47`).
- Sem exportação de dados (a política promete portabilidade, `Privacidade.tsx:225`).
- Dados de terceiros (clientes das agências, com CPF em `formularioCadastro.ts:72`; concorrentes raspados) sem cláusula de operador.

### 2.4 E-mails que faltam
Boas-vindas por persona; trial acabando (D-2) e encerrado; pagamento falhou; confirmação de cancelamento; parceira aprovada/recusada; comissão paga; lembrete de aprovação pendente há X dias ao cliente; compra de módulo. Remetente inconsistente ("criasocialclub" vs "cria").

### 2.5 Observabilidade
Sentry só no front, sem tracing. Nenhuma edge grava em `app_logs`. `billing_events` é apagado no erro e ninguém fica sabendo que o webhook falhou. Sem custo de IA por conta (só contagem de chamadas), sem funil de ativação, sem erro por edge, sem taxa de entrega de e-mail no admin.

---

## 3. Onboarding (as três personas)

### 3.1 Diagnóstico

**Criador.** 6 passos em `Onboarding.tsx`, ~10 cliques até as 5 ideias geradas (único "aha"). Problemas: objetivo, público e tom são perguntados e **descartados** (`:272-285`; o Brandbook pergunta de novo); nome pedido de novo vazio (`:110`) apesar de existir em `user_metadata`; Voltar/Próximo não são fixos e o passo 2 (16 nichos) empurra o botão pra fora da tela; sem "pular"; Instagram só como @ digitado (`:445`), e o próprio código admite que confunde (`FirstStepsPanel.tsx:33-35`). Depois: checklist inflado (`markOnClick` conta clique como feito), tour + nudge de notificação empilhados na primeira sessão, Linha Editorial vazia ("-" nos 7 dias) porque o onboarding cria pilares mas não preenche `editorial_line`.

**Social mídia.** Não existe onboarding. `/comecar-agencia` é pulada (trigger já cria como manager). Cai no `ManagerHome` com "Bora colocar a sua operação de pé." **sem botão** (`ManagerHome.tsx:222`) e grade "Seus clientes" vazia (`:350`). Tour de 5 passos aponta pra áreas zeradas e não tem "crie seu 1º cliente". O "aha" (1º post pra aprovação) está atrás de paywall: "Ativar agora" abre upsell (`ClienteHub.tsx:365-367`).

**Parceiro de produção.** Por convite: e-mail diz "definir sua senha" mas ele **nunca define senha** (`manager-member-invite:190` não marca `must_change_password`); quando a sessão expira, não entra mais. Por cadastro próprio: cai em `MinhasDemandas` vazio com 4 cartões e **nenhum botão**; não tem como chamar a agência. "Filmmaker" não existe como papel (só design, edição, copy, tráfego, `Signup.tsx:219`). Vê "Parceria" (afiliados) no menu e confunde com o próprio papel.

**Persona errada não tem volta.** Toggle pequeno com criador pré-marcado (`Signup.tsx:24,197-213`); `tornar_conta_manager` existe mas nenhum link leva até ela. Parceiro por convite vira `account_type='manager'`, por cadastro vira `'parceiro'`: dois caminhos pra mesma pessoa.

**Instagram** aparece em 5 lugares depois do onboarding e em nenhum dentro dele. O retorno do OAuth é fixo em `/app/insights` (`instagram-oauth/index.ts:11-16`): pra conectar dentro de um wizard, precisa gravar `return_to` em `oauth_states`.

### 3.2 Proposta: 5 passos por persona, mobile-first

Princípios: um passo por tela; botão principal fixo embaixo com `safe-area`; "pular" sempre visível; progresso em `profiles.onboarding_step` pra retomar; cada fluxo termina num **artefato real**, não num dashboard; sem tour na mesma sessão do onboarding.

**Criador** (reescrever `Onboarding.tsx`)
1. **Quem é você.** Nome já preenchido, foto, e o link "não é você? sou social mídia / designer" (chama a RPC de troca de persona).
2. **Conecte seu Instagram.** OAuth com `return_to=/onboarding?step=3`. Conectou: bio, nicho e números preenchem o resto. Secundário: "agora não, digito o @".
3. **Brandbook mínimo, uma tela.** Nicho em chips, tom em chips, público em uma frase, 3 cores (do IG ou escolhidas). **Salva** em `brand_items` e preenche `editorial_line` com os pilares.
4. **Meta semanal.** Um toque.
5. **Aha.** A IA gera a semana; toca numa ideia, abre o editor já com legenda no tom dela, o post nasce no Criando. Termina no editor.

Arquivos: `Onboarding.tsx`, `useSocialInsights.ts:319` (`connectInstagram(returnTo)`), `instagram-oauth/index.ts` + coluna `oauth_states.return_to`, `FirstStepsPanel.tsx` (tirar `markOnClick` e itens já cobertos), `tours/criador.ts` (não abrir logo após).

**Social mídia** (novo `OnboardingAgencia.tsx` no lugar de `ComecarAgencia.tsx`)
1. **Sua agência.** Nome, logo, cor (o white-label que o tour só aponta).
2. **Seu 1º cliente.** Nome e @, resto opcional (reaproveitar o diálogo de `Clientes.tsx:283-331`).
3. **Instagram do cliente.** `connectInstagram(crmClientId)` já existe; retorno pro wizard. Opção "o cliente conecta depois" gera o link.
4. **Brandbook mínimo do cliente.** 3 cores, tom, "o que evitar".
5. **Aha.** 1º post do cliente vai pra aprovação por link; a tela mostra o link pronto pro WhatsApp e a prévia do portal. **Decisão de produto:** liberar Cria Post em trial para 1 cliente (ou 1º post). Sem isso o aha é um paywall.

Arquivos: `App.tsx:321`, `AuthContext.tsx:50`, `ManagerHome.tsx:222,350` (CTA "Criar primeiro cliente" e retomar onboarding sem cliente), `tours/gestor.ts`.

**Parceiro de produção** (dentro de `MinhasDemandas.tsx`, no `ComeceAqui`)
1. **Seu papel.** Confirmar e **incluir "Captação / filmmaker"** (`Signup.tsx:219` + migration de `parceiro_role`).
2. **Senha** obrigatória pra quem veio por convite (`must_change_password` em `manager-member-invite:190`).
3. **Portfólio mínimo.** 3 trabalhos ou 1 link, e cachê-base.
4. **Chame sua agência.** Código pessoal "me adicione no Cria" pro WhatsApp; a agência cola e vincula (`manager_members`). Hoje é o beco sem saída.
5. **Aha.** Enquanto a 1ª demanda não chega, um card de exemplo navegável ensina Aceitar, Fazendo, Entregar em 3 toques.

Arquivos: `MinhasDemandas.tsx:480-521`, `ParceiroHome.tsx:89,179-200`, `manager-member-invite`, nova RPC de vínculo por código, tour `parceiro-demandas`, `ManagerLayout.tsx:545-548` (esconder "Parceria" do parceiro puro).

### 3.3 Textos
Inglês vazado: "Handle do Instagram", "Business/Creator", "Copiar hook" ao lado de "Gancho do dia", "Link in Bio", "Insights", "Media Kit". Jargão: "acoplar", "QG", "cockpit", "Kanban do cliente", "white-label", "MRR", "churn". A mesma persona com quatro nomes (social mídia / gestora / gestor da agência / área do gestor). "Parceiro" com três sentidos. Marca escrita "cria", "CRIA" e "Cria". "Bem-vinda" vs "Bem-vindo". Padronizar: **social mídia** pra pessoa, **agência** pra conta, **Cria** pra marca, afiliação vira **"Indique e ganhe"**.

---

## 4. UX e mobile, tela por tela

Notas de 1 a 5 (design · usabilidade · clareza · mobile), a partir do JSX.

| Tela | D | U | C | M | Principal problema |
|---|---|---|---|---|---|
| Dashboard (criador) | 3 | 3 | 2 | 3 | 12 blocos empilhados sem hierarquia; linha editorial em 9px; excluir hábito sem confirmar |
| Ideias | 4 | 3 | 3 | 4 | "Criar post com essa ideia" com 28px; seletor lista/galeria sem rótulo |
| Criando | 4 | 3 | 3 | 3 | Reagendar só por arraste HTML5 (não funciona no toque); "‹ ›" sem aria-label |
| PostEditor | 4 | 3 | 3 | 3 | Salvar no topo, longe do polegar; Excluir/PDF/Prévia viram só ícone sem rótulo; autosave + botão Salvar confundem |
| Calendário & Metas | 4 | 4 | 3 | 4 | Três nomes (Metas, Cria Plano, /app/plano) |
| Brandbook | 4 | 3 | 3 | 4 | Nome é jargão |
| Insights | 4 | 4 | 4 | 4 | Hex fixo nos gráficos |
| Link na bio | 3 | 3 | 3 | 2 | Prévia no fim de um editor de 2.800 linhas; excluir lead sem confirmar |
| Media Kit | 3 | 3 | 4 | 3 | Remover kit sem confirmar e sem rótulo |
| Stories | 3 | 3 | 3 | 2 | 17 hex fora da paleta; reagendar só por arraste |
| Radar (criador) | 3 | 4 | 3 | 4 | Selo "EM ALTA" na navegação |
| ManagerHome | 4 | 4 | 4 | 4 | Sem CTA no vazio |
| Clientes | 4 | 3 | 3 | 3 | Card clicável + botão redundante; filtro diferente do CRM |
| ClienteHub | 3 | 3 | 2 | 3 | A mesma aba com três nomes (Posts / Posts prontos / Produção); 6 botões-ícone no cabeçalho mobile |
| CriaPost (kanban) | 3 | 3 | 3 | 2 | Mês no mobile sem dia da semana; texto manda arrastar |
| AgendaCriacao | 3 | 2 | 2 | 2 | 121 textos abaixo de 12px; "+" de 14px; inputs de largura fixa em dialog |
| CriaCaixa | 3 | 3 | 3 | 2 | R$ 12.345,67 quebra em 3 linhas no `grid-cols-3` a 375px; "MRR" sem explicar |
| CriaCaptacao | 3 | 3 | 3 | 3 | `window.confirm` nativo; (v4 desta sessão melhorou a home e o modo dia) |
| HubCria / Radar | 3 | 3 | 3 | 3 | Três nomes (HubCria, Cria Radar, Pesquisa) |
| Equipe | 4 | 2 | 3 | 4 | **"Adicionar assento" cobra com um clique, sem confirmação** |
| Relatório gerencial | 3 | 4 | 3 | 4 | "churn" sem explicar |
| Aprovações | 4 | 4 | 4 | 4 | "Aprov." no dock vs "Aprovações" |
| Parceria | 3 | 4 | 3 | 4 | Paleta redefinida localmente; colide com "Parcerias" (collabs) |
| MinhasDemandas (parceiro) | 3 | 3 | 3 | 2 | 103 textos < 12px; "Marcar como entregue" no fim da rolagem |
| /aprovar/:token | 5 | 5 | 4 | 4 | Referência. Hero com `text-white` fixo falha em marca clara |
| /cronograma/:token | 3 | 2 | 3 | 3 | Aprovar/Ajuste/Recusar sem `disabled` nem loading (duplo toque envia 2x) |
| /roteiros/:token | 3 | 3 | 4 | 3 | Salva no blur sem indicador |
| /materiais/:token | 4 | 4 | 4 | 4 | Cor da marca como texto em 11px |
| /cadastro/:token | 3 | 4 | 4 | 4 | Autosave sem indicador |
| Bio pública | 4 | 4 | 4 | 4 | ok |
| LP | 4 | 4 | 4 | 4 | ok |

### Top 10 de UX pra corrigir antes do lançamento
1. **Cobrança com um clique** em "Adicionar assento" (`Equipe.tsx:93`, `useTeam.ts:153`): `confirmar()` com valor, pró-rata e novo total.
2. **Exclusões sem confirmação:** arquivo (`Arquivos.tsx:680`), lead (`LinkInBio.tsx:2137`), referência (`SavedRefs.tsx:189`), biblioteca (`Biblioteca.tsx:306,362,431`), hábito (`Dashboard.tsx:522`), media kit (`MediaKit.tsx:396`). Tudo por `confirmar()` ou Lixeira com "Desfazer".
3. **Arraste HTML5 que não funciona no toque** e texto que manda arrastar (`CriaPostBoard.tsx:1361`, `CalendarMonthView.tsx:119`, `CalendarWeekView.tsx:105`, `StoryWeekView.tsx:112`, `TasksTab.tsx:362`, `ManagerCalendar.tsx:315`). Migrar pra `@hello-pangea/dnd` (já usado em 6 lugares) ou "Mover para…" em cada card.
4. **Calendário mensal mobile sem dia da semana** (`CriaPostBoard.tsx:1311-1315`, `AgendaCriacao.tsx:1143-1148`): lista agrupada por dia com "Qua, 14".
5. **Mesmo conceito, nomes diferentes:** status (`em_producao` = "Em produção"/"Produção"; `pendente` = três rótulos; "Postado" vs "Publicado"), abas do ClienteHub, Criando/Em produção, Parceria/Parcerias, "assento" com dois preços. Criar `lib/labels.ts` com um rótulo por chave.
6. **`/cronograma` sem trava** (`CronogramaPublica.tsx:307-322`): `disabled={isPending}`, motivo obrigatório em Ajuste/Recusar, botões 44px.
7. **Ação principal longe do polegar:** Salvar do PostEditor (`:1416`), "Marcar como entregue" (`MinhasDemandas.tsx:1752`). Rodapé fixo no mobile. `aria-label` em todo botão que perde o texto com `hidden sm:inline`.
8. **Texto de 8 a 10px em selos e ações** (Agenda 121, MinhasDemandas 103, CriaCaixa 61, BottomBar). Mínimo 11px em selo, 12px em ação. Lint: regex `text-\[(8|9|10)`.
9. **Alvos < 40px:** "+" da Agenda (14px), fechar do editor (28px), "Criar post com essa ideia" (28px), navegação de mês (32px). Padronizar `size="icon"` 40px.
10. **Contraste com cor da marca nas páginas públicas** (`AprovarPortal.tsx:806-812`, `MateriaisPortal.tsx:78`): `readableFg(brand)` no hero; escurecer com `shadeHex` quando a luminância passar de 0,5.

Consistência: três cards de cliente diferentes, sete kanbans (seis com pangea, um HTML5), confirmação em três formatos, "Cursos" e "Tutoriais" na mesma rota. Código morto duplicando visual: `components/accounts/ManagerHome.tsx` (595 linhas), `PostDrawerLegacy.tsx` (904), `pages/app/Plano.tsx`, `pages/Landing.tsx` (754), `pages/Index.tsx`, `TopBar.tsx`, 17 componentes shadcn sem uso.

---

## 5. Performance e robustez

### 5.1 Bundle (chunk de entrada: 874 KB, 269 KB gzip)
- **ALTO** `src/App.tsx:100` importa `SoOperacao` direto, que importa `useManagerOutlet` de `ManagerLayout`: **anula o lazy do ManagerLayout** e põe o layout da agência inteiro no boot de todo mundo. Mesmo em `ModuleGate.tsx:4`, `ModuleUpsell.tsx:8`, `ManagerHome.tsx:21`, `ParceiroHome.tsx:7`. *Correção:* mover `useManagerOutlet` e `MODULE_ICON` pra `managerOutlet.ts` pequeno.
- **ALTO** `AppLayout` estático (`App.tsx:15`) puxa `CriaAIPanel` (dompurify 71 KB), `TourProvider` (93 KB de tours), `GlobalSearch`, `NotificationsBell`, `applyThemeFont` de `SettingsVisual` (react-easy-crop 56 KB). Tudo carregado até na bio pública e no portal `/aprovar`.
- **ALTO** `RoutePrefetch` (`App.tsx:48`) roda fora do router e baixa **1 MB+** de telas (Ideias+PostEditor+dnd, Criando, Dashboard, ManagerHome+recharts, Clientes, ClienteHub) pra quem só abriu a bio pelo navegador do Instagram. *Correção:* montar dentro do layout, só com as telas do papel, e respeitar `navigator.connection.saveData`.
- **MÉDIO** Sentry síncrono (208 KB) em `main.tsx:13`; 7 folhas do Google Fonts bloqueando render em `index.html`; recharts (350 KB) na home da agência só pra uma pizza; jsPDF (416 KB) estático em `CriaCaptacao.tsx:40` (usar `import()` no clique); framer-motion (125 KB) na `BioPage`.

### 5.2 Queries
- **ALTO** `useBioStats.ts:74` soma **todas** as linhas de `bio_stats_daily` no navegador; o limite de 1000 do PostgREST corta sem avisar e **os totais "desde o começo" ficam errados**. *Correção:* RPC com `sum()`.
- **ALTO** `CriaAIPanel` e `GlobalSearch` chamam `usePosts()` (1000 linhas, `select("*")`), `useIdeas()` e `useCrmClients()` **em toda tela, mesmo fechados** (`AppLayout.tsx:265/297/360`, `ManagerLayout.tsx:415/435`). No Dashboard, `usePosts` com limit 20, 30 e 50 são chaves diferentes: **4 requisições de posts na home**.
- **MÉDIO** sem limite/janela: `agenda_captures` (`useAgenda.ts:293`), `capture_scripts` (`useCaptureScripts.ts:95`, índice `(manager_id, month)` existe e não é usado), `useIdeas`, `useExternalPosts`, `useBioLeads`, `useFiles`, `lib/notifications.ts:62`.
- **MÉDIO** `external-pending` com `staleTime: 0 + refetchOnMount: "always"` usado em 21 arquivos. `useFinance.ts:313-316`: um UPDATE por cliente em sequência **toda vez que abre o Caixa** (50 clientes = 51 idas). `ClientReportDialog.tsx:770`: um `createSignedUrl` por imagem (existe `createSignedUrls`).
- **MÉDIO (bug)** `GlobalSearch` e `NotificationsBell` montados duas vezes por layout (mobile + desktop): **Cmd+K abre dois diálogos empilhados**.

### 5.3 Renderização
Arquivos > 1500 linhas: AgendaCriacao 3094, PostEditor 3017, LinkInBio 2843, ClientReportDialog 2782, CriaCaptacao 2567, MinhasDemandas 2152, ClienteHub 2122, CriaCaixa 1976, Criando 1587. `CriaPostBoard` sem nenhum `useMemo`/`memo` (cada arrasto re-renderiza o board). `Criando.tsx:1042,1183` filtra posts em cada célula do calendário (42 × 1000). `AuthContext.tsx:77` sem `useMemo`: cada `TOKEN_REFRESHED` re-renderiza 85+ consumidores e dispara `generateNotifications`. `PostEditor` consome `uploads` do contexto de progresso e re-renderiza 3000 linhas a cada tick.

### 5.4 Service worker e cache
- **ALTO** `public/sw.js:23` `VERSION = "v4"` fixo: `updatefound` nunca dispara em deploy comum, PWA aberto roda JS velho por dias, cache `cria-assets-v4` nunca é podado. *Correção:* injetar hash do build no `sw.js` (plugin Vite) e podar pelo manifest.
- **ALTO** `networkFirstNav` (`sw.js:94-106`): timeout de 3,5 s serve `index.html` velho em rede lenta e a resposta tardia é descartada. `queryPersist.ts:25` `SCHEMA = 1` fixo reidrata dados com formato antigo por 3 dias.
- **MÉDIO** `cacheFirst` sem checar `content-type` (pode gravar HTML como JS pra sempre; hoje mitigado pelo ErrorBoundary desta sessão). Opacas de CDN contam ~7 MB cada na cota.
- **BAIXO** preload de `logo-cria.png`/`logo-cria-white.png` nunca usados (`index.html:68-69`); CSP `frame-src` sem facebook.com (só recursos auxiliares do Pixel quebram).

### 5.5 Edge functions
- **ALTO (custo)** `apify-scrape` poll (`:617-790`): só termina se alguém chamar; a pessoa sai da tela e o job fica "running" pra sempre com crédito cobrado. Sem trava: duas abas disparam **duas transcrições e duas rodadas de IA**. *Correção:* claim atômico `update ... set status='processing' where status='running'` e cron pra órfãos.
- **MÉDIO** `useLinkPreviews.ts:64-79` dispara scrape pago no Apify pra qualquer link de IG/TikTok sem capa; se falhar, **tenta de novo toda vez que a tela abre**. Gravar falha com `fetched_at` e teto diário.
- **MÉDIO** `video-analyze`: timeouts somados (60+170+90 s) podem passar do limite; job travado não é detectado; limite diário em UTC (reseta às 21h).

### 5.6 Robustez
- **ALTO** Sem `ErrorBoundary` na raiz (`main.tsx`), em `AppLayout`, `ManagerLayout`, `ProtectedRoute`, `/login`, nem nos portais públicos (`App.tsx:301-306`). Um erro no sino deixa tudo em branco.
- **MÉDIO** 12 hooks fazem `if (error) return []` pra qualquer erro (`useCaptureScripts.ts:99,222`, `useAgenda.ts:117,246`, ...): queda de rede vira "nenhum roteiro" e é **persistida no IndexedDB como sucesso**. `AprovarPortal.tsx:706` mostra "Link inválido" pra qualquer erro de rede.
- **MÉDIO** Fuso: `ClientTasks.tsx:34`, `CrmCalendarTab.tsx:85` ("hoje" em UTC: tarefa atrasada depois das 21h), `Collabs.tsx:48` (mês vira errado no último dia), `Autopilot.tsx:90`, `Historico.tsx:40,63,77`.

### 5.7 Código morto e duplicado
~17 funções `brl` locais, umas em **centavos** (`ManagerLayout.tsx:40`, `ModulePopup.tsx:10`) outras em **reais** (`CriaCaixa.tsx:37`); já existe `lib/money.ts`. 15 helpers de data locais em vez de `lib/date-br.ts`. 61 cópias de `sbFrom = (supabase as any).from` porque `types.ts` está desatualizado (regenerar com `supabase gen types`). Três pares de migrations com a mesma versão (`20260703000001_*`, `20260720000004_*`, `20260728000001_*`: `db push` rejeita). `bump_ai_quota`, `check_and_increment_rate_limit`, `bump_hub_credits` só existem no banco. Três lockfiles e dois `vite.config.ts.timestamp-*` na raiz.

---

## 6. Eixos de produto que estão tortos

1. **"Parceiro" quer dizer três coisas** (afiliada com cupom; freelancer de produção; collab de marca do criador). "Extrato" existe nos dois primeiros. Renomear afiliação pra **"Indique e ganhe"**, freelancer pra **"Equipe de produção"**, collab fica "Parcerias de marca".
2. **"Social mídia grátis" é grátis demais e pago demais.** Ganha o app de criador de graça pra sempre e perde a IA depois de 7 dias mesmo pagando. Modelo mental certo: conta grátis, IA incluída nos módulos, área de criador à parte.
3. **Dois modelos de comissão ativos** (tela antiga + nova, backfill + recorrente). Escolher um e apagar o outro.
4. **Três eixos de capacidade.** Matar `plan=agency`; ficar com pacote de clientes + assento de colaborador.
5. **Um módulo, três nomes no código.** Tabela única de códigos.
6. **Trial Studio e paywall duro sem e-mail.** Ou D-2/D0 por e-mail, ou churn silencioso.
7. **Dois funis de compra** (Payment Link sem trial vs cadastro com trial) com atribuição diferente.
8. **Preços em cinco lugares** (código, banco, env, LP, apresentação). Fonte única.
9. **Cria Post é o "aha" da social mídia e está atrás do paywall.** Trial de módulo pra 1 cliente.

---

## 7. Plano de correção (ordem de execução)

### Semana 0 · Bloqueio do lançamento (~2 dias)
1. `APP_URL` + remover curinga lovable (S1).
2. Query de RLS em produção; ligar o que faltar; apagar `fin_records_backup_100x`; `db pull` (S2, S7).
3. `claim-purchase` com e-mail confirmado; `TOKEN_ROUTES` (S3).
4. Revogar `reconcile_agency_seats` e `bio_lead_para_pipeline` (S4).
5. `is_team_member` sem parceiro (S5).
6. Webhook: `payment_status`, `onConflict (manager_id, module_code)`, plano pelo price, `invoice.payment_failed` com e-mail (S6, B2, B6).
7. Troca de plano via `subscriptions.update` (B1).
8. IA aceita módulo pago (B3).
9. Comissão: desligar pagamento na tela antiga; legado sem recorrência (B4).
10. Excluir conta/usuário cancela todas as assinaturas (B5).
11. Termos no signup, banner de consentimento, política completa, CNPJ (LGPD).
12. `ErrorBoundary` na raiz e nos portais (5.6).
13. "Adicionar assento" e exclusões com `confirmar()` (UX 1 e 2).

### Semana 1 · Ativação
14. Onboarding das três personas (seção 3.2), com `return_to` no OAuth do Instagram.
15. `ManagerHome` vazio com CTA; tour não abre com carteira vazia; trial de Cria Post pra 1 cliente.
16. Parceiro por convite define senha; papel "filmmaker"; código "me adicione".
17. Troca de persona no app (link pra `tornar_conta_manager`).
18. `lib/labels.ts` e renomear (Indique e ganhe, social mídia/agência, status únicos).
19. `/cronograma` com trava e loading; contraste `readableFg` nas públicas.

### Semana 2 a 4 · Mobile e performance
20. Arraste HTML5 → pangea ou "Mover para…"; calendário mobile em lista com dia da semana.
21. Rodapé fixo no PostEditor e MinhasDemandas; `aria-label` nos só-ícone; mínimo 11/12px; alvos 40px.
22. `managerOutlet.ts`; `AppLayout` lazy; `RoutePrefetch` dentro do layout e por papel; jsPDF/recharts sob demanda; Sentry assíncrono; fontes por tema.
23. `useBioTotais` por RPC; `CriaAIPanel`/`GlobalSearch` só buscam ao abrir; `usePosts` com chave única; `useFinance` recálculo em RPC; `createSignedUrls`.
24. SW com hash do build e poda; `networkFirstNav` grava resposta tardia; `SCHEMA` = hash.
25. `apify-scrape` com claim atômico e cron de órfãos; `useLinkPreviews` grava falha.
26. `AuthContext` memoizado e efeitos por `user.id`; `GlobalSearch`/`Bell` montados uma vez.
27. Erros de query como erro (não `[]`); fuso com `hojeBR` nos 6 arquivos.

### Mês 2 · Operação e higiene
28. Admin: trilha em `admin_actions`, confirmação em role/plano/suspender, suspender de verdade, reembolso, cancelar/trocar no Stripe, impersonar com log, `billing_events` com falha visível.
29. E-mails: boas-vindas por persona, trial D-2/D0, cancelamento, parceira aprovada, comissão paga, lembrete de aprovação, compra de módulo.
30. Push: teto diário, horário de silêncio, categorias completas.
31. Observabilidade: edges gravando em `app_logs`, custo de IA por conta, funil de ativação, alerta de webhook.
32. Exportação de dados; aviso antes do cron de 60 dias; DPA nos termos.
33. Código morto (9 arquivos + 17 shadcn + 3 deps), `brl`/data únicos, `types.ts` regenerado, migrations com versão duplicada, lockfiles.
34. Quebrar PostEditor, ClientReportDialog (lazy) e AgendaCriacao.

---

## 8. O que esta sessão já corrigiu (contexto)
Painel de parceiras com regra/link/extrato e admin com fechamento mensal; janela de editar item do cronograma em duas colunas com copy em tela cheia; ErrorBoundary que recarrega uma vez em erro de chunk limpando o shell do SW; item sem nome não despeja a copy; copy dobrada no cronograma público; aba Cria Captação na ficha com deep-link; envio de roteiro por gravação com escolha de data e recorte na página do cliente; Captação v4 completa (prontidão em 5 degraus, painel de voo, modo dia com rota/Waze/WhatsApp, resumo único ficha + pasta).

---

## 9. Execução do plano (madrugada de 23 para 24/09/2026)

Rodado do início ao fim, com tsc, eslint, build, checagem das edges e do SQL a cada etapa.

**Semana 0 (11 bloqueios):** feito. Migration `20260923000001`.

**Semana 1 (onboarding e ativação):** feito. Onboarding do criador (respostas viram brandbook/persona/linha editorial, Instagram dentro do fluxo, troca de persona), onboarding da agência (`OnboardingAgencia.tsx`, 4 passos), home da gestora vazia com CTA, tour adiado em tela vazia, parceiro com papel filmmaker, senha obrigatória no convite, código "me adicione no Cria", "Parceria" virou "Indique e ganhe", `lib/labels.ts` em 11 telas, `/cronograma` com trava e motivo obrigatório, contraste da cor da marca nas páginas públicas. Migration `20260923000002` (seções 1 a 3).

**Semanas 2 a 4 (mobile e performance):** feito. `managerOutlet.ts`, AppLayout lazy, prefetch por papel, Sentry e jsPDF adiados, service worker versionado por build, busca global e Cria IA só buscam ao abrir, `bio_totais` e `fin_monthly_sincronizar` por RPC, `createSignedUrls`, calendário do Criando indexado por dia, AuthContext memoizado, claim atômico no `apify-scrape` + cron de órfãos, `useLinkPreviews` grava falha, erros de rede deixam de virar lista vazia (`lib/erro-esquema.ts`), fuso em 5 arquivos, mover por toque no calendário do Cria Post, rodapés fixos (editor de post, card do parceiro), aria-labels e alvos de 36px. Migration `20260923000002` (seções 4 a 6).

**Mês 2 (operação e higiene):** feito o que dava pra fazer sem o banco na mão.
- Conta suspensa fecha o app de verdade (`ProtectedRoute`), confirmação em suspender e trocar plano, trilha `admin_actions` gravada por todas as ações do `admin-user-actions`.
- E-mails (`_shared/enviar-email.ts` + edge `lifecycle-emails` + cron diário): boas-vindas por persona, trial D-2, trial D0, aprovação parada há 3+ dias, inventário da agência vencendo em 7 dias; no webhook: módulo comprado e assinatura cancelada. Ficam pra depois: parceira aprovada e comissão paga (dependem de onde o admin aprova; o painel de parceiras é o lugar).
- Push: categorias completas, silêncio das 22h às 7h (lead e comentário de cliente passam), teto de 8 por dia.
- Observabilidade: `_shared/log.ts` grava erro das edges em `app_logs` (webhook, apify, admin, convite, e-mails); o `daily-health-report` já lê essa tabela, então erro de webhook aparece no relatório diário.
- Exportar meus dados (LGPD): edge `export-my-data` + botão em Configurações > Conta. Cláusula de operador (DPA) nos Termos v1.1.
- Higiene: 7 arquivos mortos apagados, `brlReais`/`brlCentavos` únicos em `lib/money.ts` (9 telas), 3 pares de migrations com versão duplicada renomeados (000000), `vite.config.ts.timestamp-*` apagados e ignorados.
- Não feito (precisa de decisão ou de acesso): regenerar `types.ts` (`supabase gen types`, precisa do CLI logado), quebrar PostEditor/ClientReportDialog/AgendaCriacao (risco alto sem teste manual), remover `bun.lock`/`bun.lockb` (o Lovable pode usar bun no build; confirmar antes).
