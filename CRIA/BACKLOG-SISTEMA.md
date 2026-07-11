# Backlog do Sistema — Cria

Documento vivo. Marcar `[x]` conforme entrega. Ordem de ataque definida: **Agenda → Cria Post → Cliente (resto) → Cria Caixa**.
Última atualização: 2026-07-11

---

## ✅ Concluído (rodada CRM — 2026-07-11)

- [x] Campo de dinheiro BRL correto (aceita vírgula/milhar, sem zero preso) — `lib/money.ts` + `MoneyInput`
- [x] ClienteHub dividia valor por 100 (mostrava R$ 11,97 pra 1197)
- [x] Ficha do cliente "volta zerado" (form resetado a cada refetch)
- [x] Foto/dados "não salvam" (cache do cliente nunca invalidado) → update otimista
- [x] Personas sendo apagadas no save (mandava só a ativa, não o array)
- [x] Autosave na ficha do cliente (~0,8s) com indicador Salvando/Salvo
- [x] Kanban do pipeline fluido (update otimista no lead)
- [x] Parágrafos sumindo na aprovação pública do cronograma (`pre-wrap`)
- [x] Botões duplicados de "Copiar link" (cronograma)
- [x] Disclaimer jurídico nos contratos
- [x] Campos do cliente: razão social, CNPJ, responsável, WhatsApp, endereço, aniversário, plano, dia de pagamento
- [x] Status fixo (ativo/pausado/inativo) + etiquetas personalizadas (ficha + lista)

---

## ✅ Bloco 1: Agenda — CONCLUÍDO

- [x] "+" do dia agora escolhe o **tipo**: Criação / Tarefa / Captação (com cliente, hora, local, prioridade)
- [x] Visão **Semana** (padrão) e **Mês**, ambas arrastáveis; preferência salva no dispositivo
- [x] Card com nome do cliente; **tarefa de LEAD sai azul** ("Lead · nome"), tarefa de cliente âmbar, captação teal
- [x] **Notas** na captação e na criação + editar/excluir (clicar no card abre a edição)

---

## ✅ Bloco 2: Cria Post — CONCLUÍDO

- [x] Campo de **data/hora** (Cronograma) no formulário de post
- [x] **Visão de calendário** (mês) arrastável, alternando com o Kanban; preferência salva
- [x] Arrastar post entre dias muda a data na hora (otimista); área "Sem data" pra jogar no calendário
- [x] **Data direto no card** do kanban (input de data, sem abrir o post)
- [x] "+" no dia do calendário já abre o Novo post com a data preenchida
- [x] **Mídia já na criação** — "Novo post" cria um rascunho (`is_draft`, sem `external_client_id`), então o `post.id` já existe e o upload funciona de cara. Rascunho não aparece no kanban/calendário/portal; cancelar apaga.
- [x] **Enviar pro cliente por período** — dialog no "Link dos posts": link completo OU link de um intervalo (`approval_tokens.period_start/end`); o portal filtra.

## ✅ Bloco 3: Cronograma — CONCLUÍDO

- [x] **Reordenar itens** arrastando (#4 vira #1); o número acompanha a ordem (usa `sort_order`, update otimista)
- [x] Tabela virou **caixinhas separadas**: cabeçalho (tipo · data · status), copy em destaque, descrição em bloco próprio com parágrafos preservados

## 🔨 Bloco 4: Cliente — PARCIAL

- [x] **Aniversário** no calendário do CRM (cor rosa, repete todo ano) + **notificação** no dia e 3 dias antes (robô diário)
- [x] Tarefas do lead **já no cadastro** (lead novo guarda as tarefas e cria junto); removidos "próxima ação" e "próximos passos" soltos
- [x] Tarefa de lead com **cor de lead** (azul) na Agenda
- [x] Foto do Cria agora **sincroniza** pro Cria Gestão (`crm-sync-from-cria` passou a trazer o `avatar_url`)
- [ ] **Datas comemorativas por segmento** (gastronomia, fitness, finanças…) + feriados nacionais — não iniciado

## Bloco 5: Cria Caixa / Financeiro — aguardar o Atlas

- [ ] **Desfazer** "marcar recebido" + botão **pular mensalidade**
- [ ] Status do lançamento: **pendente / pago / atrasado**
- [ ] Card destaque: **previsão total do mês** (bruto e líquido após custos)
- [ ] **Calendário de recebimentos/pagamentos** por dia de vencimento (`payment_day` já existe)
- [ ] Categoria **projetos avulsos**
- [ ] **Relatório com extração por período** (mês/ano/intervalo) — evolução, recebimentos, gastos
- [ ] Absorver financeiro + relatórios do **Atlas** (Walter vai mandar o GitHub)

---

## Pendências de lançamento (fora do CRM)

- [ ] Stripe em produção (modo live, price IDs, webhook secret, compra real de ponta-a-ponta)
- [ ] QA dos fluxos críticos em produção
- [ ] Colaborador Fase 2 (RLS por cliente no banco)
- [ ] Meta app review (Insights do Instagram) — pós-lançamento
- [ ] Verificação Google/OAuth — pós-lançamento

---

## Notas de arquitetura (pra não repetir erro)

- **Dinheiro:** SEMPRE usar `MoneyInput` + `formatBRL` (`src/lib/money.ts`). Nunca `type="number"` pra valor. `crm_clients.monthly_value` é em **REAIS**; `crm_records.amount` é em **CENTAVOS**.
- **Mutations:** toda mutation que o usuário vê refletida na tela precisa de **update otimista** (`onMutate` + `setQueryData`), senão vira delay percebido.
- **Forms:** nunca resetar estado do form a partir de refetch sem checar se há edição pendente.
- **Tenancy:** hooks da agência usam `agencyOwnerId` (não `user.id`) — colaborador atua no tenant do gestor.
