# Cria Parceiros Premium: o parceiro é uma social mídia cujo cliente é a social mídia

Data: 30/08/2026. Escrito depois do toque do Walter: "ele vai funcionar bem
similar à social mídia, porém o cliente final dele vai ser a social mídia.
Temos tudo pronto e você não tá sabendo conectar."

## A tese (o que eu não tinha enxergado)

O Cria inteiro é uma máquina de UMA relação: prestador atende cliente.
A social mídia usa essa máquina com empresas como clientes. O parceiro
(designer, editor, copy, filmmaker) usa A MESMA máquina, um degrau abaixo:
os clientes dele são as social mídias que o acoplam.

Ou seja: não se constrói um financeiro novo, um CRM novo, um relatório novo.
Semeiam-se as agências como CLIENTES do parceiro e ligam-se quatro fios que
hoje estão soltos. O Bonsai cobra US$ 15/mês e o HoneyBook US$ 29/mês pra
entregar exatamente esses fios (proposta, contrato, fatura, retainer,
lembrete de cobrança). O Cria já tem 80% disso construído.

## O elo central que falta: entrega vira dinheiro sozinha

Hoje o card morre no "entregue". A cadeia completa:

1. ACOPLOU, VIROU CLIENTE. Quando a social mídia acopla o parceiro
   (manager_members), nasce automaticamente uma ficha de cliente no CRM DELE
   com o nome da agência. É a MESMA mecânica do auto-sync "cliente Cria vira
   cliente do CRM da agência" que já existe, só que no sentido inverso.

2. TABELA DE PREÇOS POR AGÊNCIA (rate card). Na ficha dessa agência-cliente,
   o parceiro cadastra o combinado: reels R$ X, carrossel R$ Y, story R$ Z.
   Ou pacote mensal (retainer): N peças por R$ M. Cada agência tem a sua
   tabela, porque cada relação tem o seu preço.

3. ENTREGOU, LANÇOU. Ao marcar entregue, o sistema cria o "a receber" no
   Cria Caixa do parceiro com o valor da tabela daquela agência + formato,
   vinculado ao post. Zero digitação. O Caixa já tem a receber, previsão,
   calendário PJ/PF, impostos por regime e rentabilidade por cliente: tudo
   passa a funcionar pro parceiro no dia em que o lançamento nasce sozinho.

4. FIM DO MÊS, FATURA PRONTA. Relatório de cobrança por agência: as N
   entregas do mês, peça a peça, valor a valor, total. Mesmo molde do
   relatório white-label que a social mídia manda pro cliente dela, invertido:
   quem emite é o parceiro pra social mídia. Um clique, PDF ou link público,
   manda no WhatsApp. A cobrança sai com prova, não com memória.

## Módulo a módulo: o que já existe e como aponta pro parceiro

| Módulo existente | Versão parceiro | O que falta |
|---|---|---|
| Cria Gestão (CRM) | "Marcas que atendo" vira CRM de verdade: ficha da agência com contatos, contrato, combinados | Semeadura automática + campos de rate card |
| Cria Caixa | O financeiro dele, idêntico: a receber por agência, recebido, impostos MEI, PF/PJ, rentabilidade | Só o lançamento automático da entrega |
| Relatório white-label | Fatura mensal de cobrança pra cada agência | Query (parceiro_entregues × rate card) + layout |
| Contratos (disclaimer) | Contrato parceiro ↔ agência com aceite | Reaproveitar aprovação pública como aceite |
| Media Kit | Portfólio do parceiro: entregas + pontualidade + taxa de ajuste, compartilhável pra fechar novas agências | Adaptar fonte de dados |
| Captação | Já serve pro filmmaker como está | Nada |
| Notificações + robô diário | Card chegou, ajuste pediu, cliente aprovou, "bom dia: 3 vencem hoje" | Só os gatilhos |

## Da pesquisa: o que as ferramentas de freelancer vendem e cabe aqui

- Retainer/pacote mensal (N peças/mês) além do preço por peça: os dois modos
  no rate card.
- Lembrete de cobrança automático (fatura não paga em X dias): a fila de
  e-mail já existe.
- Rush fee: peça com prazo menor que 48h pode ter acréscimo combinado
  (campo opcional no rate card).
- Tempo por card (opcional, ao entregar: "quanto tempo levou?"): alimenta a
  rentabilidade real por agência. O parceiro descobre quem paga bem e quem
  suga.
- Proposta com aceite pra agência nova (fase posterior).

## Monetização (proposta, Walter decide)

- Fila, quadro, entrega, conversa: grátis pra sempre (é o que faz cada
  social mídia trazer 2 ou 3 parceiros pra dentro; aquisição viral).
- Cria Parceiro Pro (sugestão R$ 19,90/mês): rate card + lançamento
  automático no Caixa + fatura mensal + portfólio/reputação. É onde o valor
  é sentido no bolso (é o que Bonsai/HoneyBook cobram em dólar).
- Clientes finais próprios: caminho já definido (conta de gestão, 2-3
  grátis, carteira paga). Não muda.

## Fases de execução

- F2a O ELO (maior valor, menor esforço): semeadura agência vira cliente do
  CRM + rate card na ficha + entrega gera "a receber" no Caixa + tela "Fechar
  o mês" com a fatura por agência.
- F2b PRESENÇA: gatilhos de push do parceiro + linha dele no robô diário.
- F2c ENTREGA NO CARD: upload do arquivo final com preview (storage já
  existe), matando o link externo.
- F2d REPUTAÇÃO: portfólio compartilhável + pontualidade + taxa de ajuste.

## Decisões em aberto pro Walter

1. Preço do Parceiro Pro (R$ 19,90?) e o que exatamente fica grátis.
2. Fatura: PDF, link público, ou os dois?
3. Tempo por card: pergunta opcional na entrega ou fica pra depois?
