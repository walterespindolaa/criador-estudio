# Roteiro de teste: circuitos 1 a 12

Escrito em 15/09/2026, depois de fechar o circuito 10. Ampliado em 16/09/2026 com os circuitos 11 e 12.

Para testar de verdade você precisa de **duas contas**: a sua (social mídia) e uma conta de
parceiro de teste, com um vínculo entre as duas. Vários testes só falham com a segunda conta,
porque o que eles verificam é justamente o que uma conta NÃO pode ver.

Legenda: **P** = fazer logado como parceiro. **S** = como social mídia. **C** = abrir o link
público de aprovação, como se fosse o cliente.

---

## Circuito 1: fechar o vazamento

O único circuito de segurança. Se algum destes falhar, é vazamento de dado de cliente, não bug de tela.

1. **S** Pause o vínculo de um parceiro numa marca. **P** Abra "Minhas marcas": a marca pausada
   não pode mostrar brandbook, nem títulos de peça, nem nome de cliente. O que continua visível
   é o dinheiro dele.
2. **P** Abra um card que você delegou. Role a conversa inteira. **Nada** do que o cliente
   escreveu no portal de aprovação pode aparecer ali, exceto comentário com alfinete (isso é de
   propósito, veja o circuito 6).
3. **P** Tente abrir na unha uma rota da agência (`/socialmidia/clientes`, por exemplo). Tem que
   barrar.
4. **S** Com um colaborador seu de verdade (não parceiro), confira que ele continua enxergando
   tudo o que enxergava antes. Esse é o teste de regressão que importa: a correção não podia
   apertar quem já usa.

---

## Circuito 2: blindar o dinheiro

1. **S** Delegue uma peça com cachê. **P** Entregue. **S** Agora mude o valor do cachê.
   O lançamento no Cria Caixa tem que **atualizar**, não duplicar e não sumir.
2. **S** Com a peça já entregue, clique "Atualizar" no delegar **sem trocar o responsável**.
   A entrega e a data de entrega têm que continuar de pé. (Antes isso ressuscitava a peça.)
3. **S** Troque o responsável de uma peça entregue. Aí sim a produção reinicia. É o único caso
   em que deve reiniciar.
4. **S** Delegue uma peça **sem cachê** e peça a entrega. Tem que aparecer aviso nos dois lados:
   bloco na tela "Cachês" do parceiro e seção no painel "Com parceiros".
5. **P** Confira que a data de entrega no histórico não muda quando a social mídia edita o post.

---

## Circuito 3: notificação que leva ao lugar certo

1. **P e S** Clique em **qualquer** notificação do sino, de qualquer tipo, não só de parceiro.
   Tem que navegar. Esse era o bug maior: o sino nunca levava a lugar nenhum, em todo o produto.
2. **S** Peça um ajuste escrevendo um motivo específico. **P** O motivo que chega tem que ser
   exatamente o que foi escrito, não o anterior.
3. **S** No painel "Com parceiros", clique num cliente. Tem que abrir a ficha certa, não uma
   página vazia.
4. **P e S** Em preferências de push, o interruptor "Produção com parceiros" liga e desliga
   separado de "Clientes".
5. Deixe uma peça passar do prazo e espere o robô diário: tem que chegar aviso de atraso.

---

## Circuito 4: parar de engolir erro

1. **P** Ligue o modo avião no meio da tela de fila. Tem que aparecer **erro**, com botão de
   tentar de novo, não tela vazia de "nada por aqui".
2. **P** Se a lista já estava carregada e a atualização falha, a lista **fica** e o erro vira
   uma faixa em cima. Não pode trocar lista boa por tela de erro.
3. **S** Pause o vínculo do parceiro em **todas** as marcas. **P** Ele continua sendo parceiro:
   menu de parceiro, histórico e a tela de cachês continuam lá, com a tela de "pausado".
   (Antes ele perdia a conta inteira com dinheiro a receber.)
4. **P** "Meus cachês" precisa estar no menu **mesmo** se o parceiro assinar algum módulo Cria.

---

## Circuito 5: revisão e versão

1. **S** Peça ajuste numa peça duas, três vezes. O chip "Nª revisão" tem que subir, e ficar
   vermelho a partir da terceira.
2. **P** Reentregue a peça. **C** Abra o link do cliente: o carrossel tem que mostrar **só a
   versão nova**. O bug antigo era a versão velha e a nova aparecerem como dois slides.
3. **P** Botão de histórico de versões na mídia: abre e lista as rodadas anteriores.
4. **Limite conhecido:** peças que já estavam com versões empilhadas antes desta migration
   continuam como estão. O mecanismo vale da próxima entrega em diante.

---

## Circuito 6: comentário ancorado

1. **C** No portal, entre no modo apontar e clique em cima da arte. A bolinha aparece com número,
   e a lista ao lado usa o mesmo número.
2. **C** Aponte no **celular**, **P** abra no monitor. O ponto tem que cair no mesmo lugar da
   arte (a posição é gravada em fração, não em pixel).
3. **C** Aponte em slides diferentes de um carrossel: cada alfinete fica no seu slide.
4. **C** Marcar o ponto **não** pode mudar o status da peça. Só o botão de enviar fecha a rodada.
5. **P** No card, o bloco "Apontaram na arte" mostra os pontos do cliente. E só eles: o resto da
   conversa do cliente continua invisível pro parceiro.
6. **Limite conhecido:** Story usa preview próprio e ainda não aceita alfinete. No vídeo, o
   segundo é digitado por quem escreve, ainda não dá pra clicar na linha do tempo.

---

## Circuito 7: Captação, um modelo de roteiro só

Este é o que mais mexeu em dado existente. Vale testar com uma captação **antiga**, de agosto.

1. **S** Abra uma captação antiga, daquelas escritas pela aba Agenda. O texto tem que estar lá,
   como roteiro, sem duplicar.
2. **S** No placar do mês, uma captação com roteiro escrito **não** pode aparecer como "sem roteiro".
3. **S** "Folha do dia": o botão tem que aparecer e o PDF sair preenchido, inclusive nos dias
   cujos roteiros são do modelo novo.
4. **S** "Enviar pro cliente" tem que gerar link em qualquer captação, inclusive nas antigas.
   (Era o "Não consegui gerar o link agora".)
5. **S** Editar o card "Captação DD/MM" e salvar: título, referências e cenas têm que sobreviver.
6. **S** Escreva roteiro pela aba Agenda e abra a mesma captação pela pasta do cliente. Tem que
   ser o mesmo conteúdo, nos dois sentidos.

---

## Circuito 8: o Dia de Gravação

O teste de verdade é montar um dia real com 3 clientes e ver se dá pra executar sem abrir pasta.

1. **S** No calendário do mês, clique num dia que tem captação: abre o Dia de Gravação.
2. Confira o placar, a lista de tomadas no topo e os roteiros na ordem, de todos os clientes
   daquele dia.
3. Marque tomada, marque roteiro gravado e abra o teleprompter: **um toque cada**, sem acordeão
   e sem diálogo de confirmação.
4. "Copiar o dia" põe o dia inteiro em texto na área de transferência.
5. Faça isso **em pé, com uma mão só**, no celular. É o critério real do circuito.

---

## Circuito 9: IA de cena

1. **S** Num roteiro, o botão "Sugerir cenas com IA" tem que **existir na tela**, nos dois
   lugares: aba Agenda e pasta do cliente. (Ele estava no código desde agosto e nunca aparecia.)
2. Gere cenas para um cliente **com** brandbook preenchido e leia em voz alta. Tem que soar como
   o dono do negócio fala, não como nós falamos.
3. Gere para um cliente **sem** brandbook: tem que funcionar e avisar que falta o brandbook.
4. Confira que a direção é do mundo real: nada de drone, grua, travelling ou "iluminação
   cinematográfica". É celular e luz de janela.
5. Com cenas já escritas, mandar gerar tem que **perguntar antes** de substituir.
6. Estoure a cota de IA de propósito e veja a mensagem: tem que dizer que a cota acabou, não dar
   erro genérico.

---

## Circuito 10: mobile de produção

Tudo aqui é em **390px** (iPhone padrão). Se puder, teste no aparelho, não só no simulador.

**Parceiro**

1. Quadro "Fazendo": as etapas rolam pro lado, uma por vez, com a próxima espiando na borda.
   Nada de quatro colunas espremidas.
2. Visão Mês: vira lista dos dias que têm entrega, com título, cliente e alvo grande. Dia vazio
   não ocupa linha.

**Criador**

3. Calendário do mês: o dia mostra pontinhos e o total. Tocar abre a lista do dia, com
   "Novo post neste dia" no fim.
4. Calendário da semana: os sete dias empilham, com o dia escrito por extenso.
5. Visão Lista: a coluna **Data** tem que estar visível e clicável pra ordenar. (Antes ficava
   cortada e sem rolagem pra alcançar.)

**Social mídia**

6. Agenda do mês da Captação: cada dia com captação mostra ponto na cor do cliente e o total,
   e tocar abre o Dia de Gravação.
7. Aba Agenda do cliente (CRM): mesma coisa, e a lista do dia aparece logo abaixo do calendário.

**As três**

8. **Toda** tela tem que mostrar o nome dela no topo, no celular. Passe por umas dez telas
   diferentes conferindo isso.
9. Ícones: nada desproporcional. Foram 6 lugares com uma classe de tamanho que não existia e
   por isso não gerava CSS nenhum.

---

## Circuito 11: a agenda do parceiro

1. **P** Abra "Minha agenda". As entregas com prazo têm que aparecer sozinhas, no dia certo,
   e tocar numa delas abre a peça.
2. **P** Crie uma **tarefa** sem prazo. Ela vai pro bloco "Quando der", no fim, e não some.
3. **P** Crie um **compromisso** sem dia: tem que recusar com explicação, não com erro técnico.
4. **P** Marque uma tarefa como feita e desmarque. Some e volta na hora, sem esperar o banco.
5. **S** Numa captação, escolha o parceiro em "Quem vai gravar" e salve.
   **P** O dia tem que aparecer na agenda dele com cliente, horário, local e quantos roteiros existem.
6. **S** Agora **pause** o vínculo desse parceiro. **P** A gravação para de mostrar o nome do
   cliente na hora, mesmo já estando marcada. Idem pra tarefa antiga amarrada numa peça daquela agência.
7. **P** No celular, confira que a agenda é lista de dias (o calendário de 7 colunas só existe
   de tablet pra cima) e que "Agenda" está no dock de baixo.

## Circuito 12: o extrato do mês

1. **P** Abra "Extrato do mês". As peças entregues no mês aparecem agrupadas por contratante e,
   dentro dele, por cliente.
2. **P** Confira a **data de corte**: uma peça entregue no fim da noite do último dia do mês tem
   que ficar NESTE mês, não no seguinte. Era o erro que o fuso causaria.
3. **P** Toque em "Esconder valores": os cachês somem da tela **e do PDF**. Baixe o PDF nos dois
   modos pra confirmar.
4. **P** Confira que o `✓` de pago bate com o que a agência lançou no Caixa dela, e que
   "A receber" é a diferença.
5. **P** Marque uma tarefa como feita hoje e volte ao extrato: ela entra na lista do mês, marcada
   como tarefa, sem valor.
6. **P** Mês sem nada: tem que dizer que está vazio, e o botão de PDF fica desligado.

---

## O que NÃO foi feito, e é honesto dizer

Estas coisas estavam no mapa e continuam abertas. Nenhuma delas é bug: são escopo que ficou
fora dos dez circuitos.

- **Arrastar a captação no calendário** para mudar de dia. O calendário ficou clicável (circuito 8),
  mas mover por arrasto não entrou.
- **Duração e equipe da gravação** ainda não aparecem no Dia de Gravação. Local e "sobre o vídeo"
  aparecem. O dado está gravado nos dois casos.
- **Teleprompter sem gate.** Ele é vendido no plano Studio e está acessível de dentro da Captação
  sem cobrar. É decisão de produto, não conserto de código, e por isso não mexi.
- **Arrastar card no celular.** Os quadros usam arrasto do HTML5, que não existe em tela de toque.
  No celular a peça se move abrindo o card, não arrastando. Trocar a biblioteca de arrasto é um
  trabalho próprio.
- **Preço da Captação.** A conversa sobre manter avulso ou juntar com o Prompter num pacote de
  produção continua em aberto.
- **Fase de retenção inteira:** portfólio automático do parceiro, relatório dele, roteiro e guia
  dentro do card do filmmaker, análise da própria entrega e ponte para o Cria Caixa.

E uma ressalva de método: eu não consigo abrir o app rodando na sua máquina. Tudo que eu afirmo
sobre as telas vem de leitura de código, compilação e build. Este roteiro existe justamente
porque o olho tem que ser o seu.
