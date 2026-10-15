# Relatório — Rodada CRM / Cria Gestão

Data: 2026-07-11

---

## 1. Entregue nesta rodada

### Bugs de dado (críticos — corrigiam corrupção)

**Campo de dinheiro estava corrompendo valor.** O input era `type="number"`; digitar `1.197` virava o número **1.197** e salvava **R$ 1,20**. Criado um `MoneyInput` pt-BR (`src/lib/money.ts` + `src/components/shared/MoneyInput.tsx`): aceita `1197`, `1.197`, `1.197,50`, `1197,5`; campo vazio fica vazio (acabou o **zero preso**); normaliza pra `1.197,00` ao sair. Aplicado em: ficha do cliente, novo cliente, lead (pipeline) e contrato.
→ **Atenção:** valores já salvos errados (o `R$ 1,2`) continuam errados no banco. Precisa reeditar cliente a cliente.

**ClienteHub dividia o valor por 100.** Mostrava R$ 11,97 para 1197 (tratava reais como centavos). Corrigido — o financeiro (`crm_records`) continua em centavos, o cliente em reais.

**"Coloco a informação, saio e volta zerado".** Não era lentidão: um `useEffect` resetava o formulário a **cada refetch**, e o auto-sync dispara um refetch ao abrir a ficha — apagava o que você tinha digitado. Agora o form só aceita dado do servidor quando **não há edição pendente**.

**Foto/dados "não salvam".** O `useUpdateCrmClient` invalidava só a lista, nunca o cache do cliente → ao voltar, você via dado velho. Agora o update é **otimista** (reflete na hora) e corrige os dois caches.

**Personas sendo apagadas.** O `save()` enviava só a persona ativa em vez do array — sobrescrevia as outras. Corrigido.

**Parágrafos sumiam na aprovação do cliente.** A descrição do cronograma público renderizava sem `white-space: pre-wrap`. Corrigido — quebras de linha preservadas.

### Performance

**Autosave na ficha do cliente.** Salva sozinho ~0,8s após a última tecla, com indicador "Salvando… / Salvo ✓". Botão Salvar virou secundário.

**Kanban do pipeline fluido.** Faltava update otimista no `useUpdateCrmLead` — por isso o card voltava pra coluna original e só pulava ~2s depois. Agora move na hora.

### Funcionalidades

**Novos campos do cliente** — Informações gerais (razão social, CNPJ, responsável, WhatsApp, endereço, aniversário) e Contrato (plano contratado, dia de pagamento, início, renovação, valor).

**Status fixo** (Ativo / Pausado / Inativo) + **etiquetas personalizadas** multi-seleção, com cores, criadas pela agência. Aparecem na ficha **e na lista de clientes**.

**Contratos:** disclaimer jurídico (modelo de apoio, recomenda revisão de advogado).

**Botões duplicados:** o "Copiar link" do cronograma era redundante (o "Enviar pra aprovação" já copia). Removido. O do topo virou "Link dos posts" pra não confundir com o do cronograma.

---

## 2. Ação necessária

**Rodar o SQL** (`20260711000001_crm_client_fields_tags.sql`) — colado no chat.
**Push do frontend.** Sem redeploy de edge nesta rodada.

---

## 3. Backlog restante (priorizado)

### A. Cria Caixa / Financeiro — o maior bloco, ainda não iniciado
- Desfazer "marcar recebido" + botão de **pular mensalidade**
- Mudar status do lançamento: **pendente / pago / atrasado**
- Card em destaque: **previsão total do mês** (bruto e líquido após custos)
- **Data de vencimento por cliente** → calendário de recebimentos e pagamentos (recebo dia 15 de Fulano, 10 de Ciclano) — o campo `payment_day` já existe no banco após este SQL
- Categoria **projetos avulsos**
- **Relatório com extração por período** (mês/ano/intervalo) — evolução, recebimentos e gastos
- Absorver a parte financeira/relatório do **Atlas** (aguardando você mandar o GitHub)

### B. Agenda
- Modal "adicionar à criação" muito limitado: permitir **tarefa (com cliente) e captação**, com mais campos
- Visão **mês/semana** (padrão semana), arrastável
- Card mostrando **nome do cliente**, com cor diferenciando cliente/lead
- **Notas** na captação + editar/visualizar/excluir

### C. Cria Post / Cronograma
- **Anexar mídia já na criação** do post (hoje só depois de salvar) + campo de **data/hora**
- **Visão de calendário** dos posts + definir data no card "Aguardando cliente"
- **Reordenar itens** do cronograma (#4 virar #1)
- Layout do card do cronograma em caixinhas separadas

### D. Cliente
- **Aniversário** → notificação pro social mídia + aparecer no calendário (campo já criado)
- **Datas comemorativas por segmento** (gastronomia, fitness, finanças…) + feriados nacionais
- Tarefas do lead visíveis já no cadastro (hoje só depois de salvar) + cor de lead no calendário
- Foto trocada no Cria não reflete no Cria Gestão (sync de avatar)

---

## 4. Leitura honesta

O bloco **A (financeiro)** sozinho é uma reformulação de módulo — não dá pra fazer no meio de outras dez coisas sem quebrar. Sugiro tratá-lo como uma sprint dedicada, **depois** que você mandar o Atlas (evita eu construir algo que você vai querer substituir).

Ordem que eu recomendo: **B + C + D** (ajustes contidos, alto impacto no uso diário) → depois **A** com o Atlas em mãos.
