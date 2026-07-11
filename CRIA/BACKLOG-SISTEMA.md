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

## 🔨 PRÓXIMO — Bloco 2: Cria Post

- [ ] Anexar **mídia já na criação** do post (hoje só depois de salvar)
- [ ] Campo de **data/hora** no formulário de novo post
- [ ] **Visão de calendário** dos posts (além do kanban)
- [ ] Definir **data no card** "Aguardando cliente"

## Bloco 3: Cronograma

- [ ] **Reordenar itens** (#4 virar #1)
- [ ] Layout do card em **caixinhas separadas** (capa / post)

## Bloco 4: Cliente (resto)

- [ ] **Aniversário** → notificação pro social mídia + aparecer no calendário (campo `birthday` já existe)
- [ ] **Datas comemorativas por segmento** (gastronomia, fitness, finanças…) + feriados nacionais
- [ ] Tarefas do lead visíveis **já no cadastro** (hoje só após salvar); remover "próxima ação/próximos passos" soltos
- [ ] Tarefa de lead com **cor de lead** no calendário/agenda (hoje sai como tarefa comum)
- [ ] Foto trocada no Cria **não reflete** no Cria Gestão (sync de avatar)

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
