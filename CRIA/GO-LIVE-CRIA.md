# Runbook de Go-Live — Cria Social Club

_Roteiro único para colocar o Cria no ar. Execute em ordem. Cada item tem critério de **PASSOU/FALHOU**. Não avance de fase com item crítico em FALHOU._

Atualizado: 2026-07-08

---

## Escopo do v1 (decisão de lançamento)

**Entra no lançamento:**
- Cadastro/login de criador (PF) + assinatura (Pro/Studio)
- Cadastro/login de social mídia (gestor) + assinatura de agência ⚠️ _(a construir — ver Fase B)_
- Cria Post (aprovação de cliente externo)
- Cria Gestão (CRM: clientes, leads, contratos, tarefas)
- Cria Caixa (financeiro)
- Cria Plano / Cria Stories / Tendências / Media Kit / HUB Criativo / Agenda
- Acesso de colaborador (Fase 1: módulo + isolamento entre agências)
- Notificações + push

**Fica "em breve" (liga depois do lançamento):**
- Insights do Instagram (depende de Meta app review)
- Login com Google / Google Calendar (depende de verificação OAuth)
- Colaborador Fase 2 (bloqueio por cliente no banco)

> Se algum item de "em breve" precisar entrar no v1, decidir ANTES de começar a Fase C (QA).

---

## Fase A — Deploy e configuração _(marcado como feito — só verificar)_

- [x] Migrations aplicadas no banco (incl. `20260708160000_collab_access.sql`)
- [x] Edges redeployadas: `manager-member-invite`, `collab-seats-checkout`, `stripe-webhook`, `apify-scrape`, `crm-sync-from-cria`, `story-notifications`, `saved-fetch`, `trash-purge`
- [ ] Crons agendados e rodando: `story-notifications` (~15min), `trash-purge` (diário), `daily-notifications`, `instagram-refresh`
  - **PASSOU:** cada cron aparece com última execução recente e sem erro no log.
- [ ] Secrets conferidos: `STRIPE_COLLAB_SEAT_PRICE_ID`, `INTERNAL_PUSH_SECRET`, `APIFY_TOKEN`, chaves Perplexity/IA, `META_PIXEL_ID`/`META_CAPI_TOKEN`
  - **PASSOU:** nenhum secret faltando; edges não retornam erro de config.

---

## Fase B — Construir o que falta pro v1

### B1. Cadastro/login de social mídia (gestor) ⚠️ crítico
Hoje só existe o fluxo de usuário normal (criador). Gestor só nasce via admin. Precisa de um caminho self-serve.
- [ ] Tela de cadastro "Sou social mídia / agência" (define `account_type = manager`)
- [ ] Onboarding mínimo do gestor (cadastro da agência → `manager_profiles`)
- [ ] Direcionar pro checkout de agência (assentos) ou plano
- [ ] Login já cai em `/socialmidia/dashboard`
- **PASSOU:** um estranho consegue criar conta de agência, assinar e entrar no hub sem intervenção do admin.

### B2. Ajustes finais de UX pendentes
- [ ] (se houver) filtragem da lista de clientes pro colaborador ver só os permitidos

---

## Fase C — QA dos fluxos críticos (em produção, contas de teste)

> Rodar cada fluxo do zero, com e-mail real. Critério PASSOU = fluxo completo sem erro no console nem na edge.

- [ ] **Criador (PF):** cadastro → confirma e-mail → assina (Pro) → webhook ativa → acesso liberado → cria post/ideia
- [ ] **Gestor:** cadastro social mídia (B1) → assina agência → entra no hub → cria cliente → Cria Post
- [ ] **Aprovação pública:** gera link → abre em aba anônima → @ e legenda corretos → aprova/pede ajuste → volta pro gestor
- [ ] **Colaborador:** gestor convida (popup módulos+clientes) → e-mail chega → define senha → cai na conta do gestor → vê só o liberado → cria algo → aparece na conta do gestor
- [ ] **Assento pago:** gestor tenta 2º colaborador → trava → compra assento → webhook sobe `paid_collab_seats` → libera
- [ ] **Notificações/push:** dispara um gatilho → notificação aparece → push chega
- [ ] **Lixeira:** exclui cliente/post → vai pra lixeira → restaura → confirma volta
- [ ] **Mobile:** repetir os 3 fluxos principais no celular (sem overflow, menus completos)

---

## Fase D — Stripe em produção (LEMBRAR NO FINAL) 💳

- [ ] Conta Stripe em modo **live** (não test)
- [ ] Price IDs de produção (planos + assento `price_1TqxUfRDE8ybSi6VJCU01dGn`)
- [ ] Endpoint de webhook live criado + `STRIPE_WEBHOOK_SECRET` do endpoint live nos secrets
- [ ] Eventos assinados: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid`, `charge.refunded`
- [ ] **Compra real de ponta-a-ponta** (cartão real, valor baixo) → acesso liberado → reembolso de teste
- **PASSOU:** dinheiro entra, acesso ativa automático, cancelamento/reembolso reflete no acesso.

---

## Fase E — Go-live

- [ ] Domínio + SSL ok (`app.criasocialclub.com.br`)
- [ ] Política de privacidade e termos publicados e linkados
- [ ] Página de erro/404 e estados vazios revisados
- [ ] Monitoramento: onde ver erro de edge/webhook em produção
- [ ] Abrir cadastro / anunciar

---

## Pós-lançamento (liga quando aprovar)

- [ ] Meta app review → ligar Insights do Instagram
- [ ] Verificação Google/OAuth → religar login Google + Calendar
- [ ] Colaborador Fase 2 → RLS por cliente no banco

---

### Ordem sugerida
**B1 (cadastro gestor) → C (QA) → D (Stripe live) → E (go-live).**
A Fase B1 é o único bloco de _construção_ que falta pro v1. Depois dela, é validar e abrir.
