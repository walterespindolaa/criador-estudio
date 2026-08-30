# Cria Parceiros Premium v2: as duas pontas do mesmo fio

Data: 30/08/2026, revisado depois de dois toques do Walter:
1. "O parceiro vai funcionar bem similar à social mídia, porém o cliente
   final dele vai ser a social mídia."
2. "O parceiro também pode cadastrar clientes (social mídia OU cliente
   final) e ter a mesma experiência. E o fluxo de produção serve os DOIS
   lados: a social mídia precisa acompanhar o que está com cada parceiro, e
   o parceiro precisa poder concordar ou sugerir outro prazo."

## 0. Por que ele larga o Trello (pesquisa de 30/08)

O que prende o designer/filmmaker no Trello: é grátis, o kanban bate com o
modelo mental (Conceito, Rascunho, Aprovação, Entrega), etiquetas e
checklists dão sensação de controle, e convidar a social mídia é um clique.

O que ele ENGOLE sem perceber:
- O plano grátis limita anexo a 10MB por arquivo (pago: 250MB). A
  "qualidade full" no Trello free é mito: ele cola link de Drive, que é o
  que já fazemos.
- O board morre no "Done": ele nunca sabe se o cliente aprovou, pediu
  ajuste ou postou.
- Feedback é texto solto ("ajusta ali no meio"). Feedback ancorado (pin na
  imagem, timestamp no vídeo) é OUTRA ferramenta, cara (Frame.io/Filestage,
  em dólar).
- Pra fatura, contrato e financeiro ele empilha 3 a 5 assinaturas
  (US$ 59-77/mês no total, Bonsai/HoneyBook e cia) que não conversam.

O nosso diferencial, em ordem de força:
1. ELE NÃO ADOTA, ELE É PUXADO: a social mídia convida, e no primeiro dia
   já tem cards com briefing, marca, legenda e material prontos. No Trello,
   alguém digita tudo isso à mão. Custo de troca invertido.
2. A ESTEIRA CONTINUA DEPOIS DO DONE: entrega entra na cadeia real
   (revisão, aprovação do cliente, postado) e ele VÊ onde parou.
3. O DINHEIRO ACONTECE SOZINHO: entrega vira a receber, mês vira fatura.
   É o que as assinaturas extras dele fazem por US$ 60.
4. FEEDBACK ANCORADO NA PEÇA (fase futura): pin na imagem, timestamp no
   vídeo, dentro do MESMO card. Mata o Frame.io pra esse público.
5. Uma frase: o Trello organiza o trabalho; o Cria CONECTA o trabalho.

## 1. A tese completa

A cadeia do Cria tem três elos, e o motor é sempre o mesmo (prestador atende
cliente): Cliente final ← Social mídia ← Parceiro. Um fluxo de produção não
é uma tela: é um FIO que atravessa duas contas. Cada estado do card precisa
ter uma leitura em cada ponta:

| Estado | O parceiro vê | A social mídia vê |
|---|---|---|
| Delegado, prazo proposto | "Novo card, prazo sugerido 04/09. Topa?" | "Enviado pro PeJota, aguardando aceite do prazo" |
| Prazo contraproposto | "Você sugeriu 06/09, aguardando a social mídia" | "PeJota sugeriu 06/09: aceitar ou conversar" |
| Prazo aceito | Card entra na fila com contagem regressiva | "Combinado 04/09 · vence em 3 dias" (semáforo) |
| Fazendo | "Estou fazendo" | "Em produção com o PeJota" |
| Entregue | "Entregue, aguardando revisão" + status de aprovação | "PRA REVISAR" em destaque, com o link da entrega |
| Ajuste | Card volta com o motivo consolidado | "Devolvido pra ajuste em 30/08" |
| Aprovado/postado | Chip verde no card entregue | Fluxo normal do Cria Post |

## 2. A carteira do parceiro: dois tipos de cliente, uma experiência

O parceiro tem a MESMA tela de clientes da social mídia (lista, ficha
cockpit, cor, brandbook), com dois tipos de linha:

- CLIENTE AUTOMÁTICO (social mídia que usa o Cria e o acoplou): nasce
  sozinho na carteira quando o vínculo é criado. Cards delegados entram
  sozinhos, entregas contam sozinhas, fatura sai da tabela de preços.
  NUNCA ocupa vaga, grátis pra sempre.
- CLIENTE MANUAL (cadastrado por ele): pode ser uma social mídia que NÃO
  usa o Cria, ou um cliente final direto (a loja que pediu artes). Aqui ele
  mesmo cria os cards, prazos e valores. Consome vaga: 2 a 3 grátis, depois
  pacote (mesma régua da carteira da social mídia).

A ficha do cliente engorda com cada módulo ativo, exatamente como no
cockpit da social mídia:
- Cria Gestão: contatos, contrato, brandbook, propostas, etiquetas.
- Cria Post: kanban das peças daquele cliente + link de aprovação.
- Cria Caixa: quanto entrou, quanto está a receber, rentabilidade.
- Cria Captação: roteiros e tomadas (o filmmaker vive aqui).
- Cria Radar: concorrência e referências do nicho DAQUELE cliente. Pro
  designer: banco de referências visuais; pro filmmaker: engenharia reversa
  de roteiro dos virais do nicho. (Radar entrou no menu e no escopo.)

## 3. O fluxo de produção visto dos dois lados

### 3a. Negociação de prazo (lado parceiro)
Regra da Gabriela mantida: o parceiro NÃO recusa card. Mas prazo é
combinado, não imposto:
- Card chega com o prazo proposto e o estado "aguardando seu aceite".
- Um toque: "Topo o prazo" (vira combinado) ou "Sugerir outra data" (data +
  motivo curto). O card fica "prazo em negociação" até a social mídia
  aceitar a sugestão ou responder no card.
- Dados: `posts.prazo_status` (proposto | aceito | negociando) +
  `prazo_sugerido` + comentário automático na conversa do card. RPCs:
  `parceiro_responder_prazo`; lado social mídia resolve no popover
  "Enviar para" (aceitar sugestão com um clique).
- Enquanto negocia, o card já pode ser produzido (não trava o trabalho).

### 3b. Painel "Produção externa" (lado social mídia)
A tela que falta pra Gabriela: dentro do Cria Post, a aba "Com parceiros"
mostrando TUDO que está fora da mão dela:
- Agrupado por parceiro: PeJota (Designer) · 3 na mão · 1 vence hoje · 1
  prazo em negociação. Filtro por cliente e formato.
- Cada linha: peça, cliente, etapa (novo/fazendo/ajuste/entregue), prazo
  combinado e CONTAGEM REGRESSIVA (vence em 2 dias / atrasou 1 dia).
- Semáforo: verde no prazo, âmbar vence em 48h, vermelho estourado.
- Topo em destaque: "Pra você revisar" (entregues aguardando ela levar pro
  cliente) e "Prazos pra responder" (contrapropostas do parceiro).
- No dashboard dela: card "Produção externa" com pendências e atrasos.
- No cockpit do cliente: a etapa do parceiro aparece na linha do post.
- Dados: RPC `producao_externa()` do lado dela (posts com assignee_id,
  join no vínculo pra nome/papel do parceiro). Sem RLS nova: ela é dona
  dos posts.

### 3c. O que já está no ar (base construída nesta semana)
Fila por prazo, quadro Trello, semana, mês; card com specs por formato,
marca, material; entrega com link carimbado; ajuste com motivo consolidado
obrigatório; status pós-entrega visível pro parceiro; entregues por
agência.

## 4. O elo financeiro (inalterado da v1, executa depois do fluxo)
- Rate card por cliente-agência (por peça e/ou pacote mensal, rush fee
  opcional pra prazo < 48h).
- Entregou, nasceu o "a receber" no Cria Caixa dele, vinculado ao post.
- Fim do mês: fatura por agência (molde do relatório white-label,
  invertido), PDF/link, com lembrete de cobrança pela fila de e-mail.
- Tempo por card (opcional na entrega) alimenta rentabilidade real por
  agência.

## 5. Monetização (consolidada)
- Trabalho vindo de agência que usa o Cria: grátis pra sempre, sem vaga.
  É o motor viral (cada social mídia traz 2-3 parceiros pra dentro).
- Clientes manuais: 2-3 grátis, depois pacote de vagas (régua da carteira).
- Módulos (Post, Gestão, Caixa, Captação, Radar): mesmos add-ons/planos,
  comprados na casca do parceiro (/parceiro/planos).
- Cria Parceiro Pro (a decidir, sugestão R$ 19,90/mês): rate card + a
  receber automático + fatura + portfólio/reputação.

## 6. Fases, na ordem que destrava a Gabriela primeiro
- F3a FLUXO DOS DOIS LADOS: negociação de prazo + painel "Com parceiros"
  no Cria Post da social mídia + card no dashboard dela. (É o que a
  operação real precisa AGORA pra rodar com o PeJota.)
- F3b CARTEIRA DO PARCEIRO: tela de clientes com os dois tipos, ficha
  cockpit, vagas grátis/pagas, cards manuais pra cliente manual.
- F3c ELO FINANCEIRO: rate card, a receber automático, fatura mensal.
- F3d PRESENÇA E PROVA: push + robô diário do parceiro, entrega com upload
  e preview no card, portfólio/reputação (pontualidade, taxa de ajuste).

## 7. Decisões do Walter
1. Preço do Parceiro Pro e o que exatamente fica grátis (sugestão acima).
2. Quantas vagas manuais grátis: 2 ou 3?
3. Fatura: PDF, link público, ou os dois?
4. Confirma a ordem F3a antes do financeiro?
