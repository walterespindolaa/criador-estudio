# Plano de execução: Cria Parceiros e Cria Captação

**Data:** 14/09/2026
**Companheiro de:** `DOCS/analise-parceiros-producao.md`
**O que este documento é:** o método de trabalho, a régua de design, o direcionamento de produto e a ordem dos circuitos.

---

## Parte 1: como vamos trabalhar

### O ciclo de cada circuito

Cada circuito é uma unidade fechada de valor. Nada avança para o próximo sem passar pelos seis passos abaixo, na ordem.

**1. Mapear.** Ler o código que vai ser tocado e escrever, antes de mexer, o que existe hoje e por quê. Nunca supor. As migrations divergem do banco: função que vai ser alterada é inspecionada no banco antes.

**2. Decidir.** Escrever a decisão de produto em uma frase, com o porquê. Se a decisão for de negócio (preço, escopo, quem vê o quê), ela sobe para você antes de virar código.

**3. Construir.** Código com comentário em português explicando a razão, não o mecanismo. Toda mudança de comportamento carrega no comentário a data e a origem do pedido.

**4. Verificar tecnicamente.** O ritual completo, sempre o mesmo:
- `tsc -p tsconfig.app.json --noEmit` limpo
- `vite build` passando
- `eslint` nos arquivos tocados, sem erro novo
- `esbuild` nas edges alteradas
- `grep` de travessão nos arquivos tocados
- SQL conferido contra o banco, não contra as migrations

**5. Revisar o circuito inteiro.** Este é o passo que costuma ser pulado e é o que você pediu. Não é reler o diff: é percorrer o circuito **do ponto de vista de quem usa**, com quatro perguntas:
- O caminho feliz funciona de ponta a ponta?
- O caminho triste tem saída? (sem internet, sem dado, sem permissão, dado pela metade)
- Em 390px continua usável?
- Está com cara de Cria? (parte 2 deste documento)

E mais três, técnicas:
- Alguma tela nova ficou sem estado vazio ou sem loading?
- Algum erro está sendo engolido?
- Alguma permissão nova abriu porta que não devia?

**6. Entregar e fechar.** Bloco de git copiável, SQL no chat e salvo como migration, lista do que precisa de deploy de edge, e um parágrafo em português simples para você repassar à Gabriela. Só depois disso o próximo circuito começa.

### Regra de ouro

**Se a revisão do passo 5 achar qualquer coisa, o circuito não fechou.** Corrige e revisa de novo. Circuito que fecha com pendência conhecida vira dívida silenciosa, que é exatamente como nasceram os dez vídeos presos no player.

---

## Parte 2: a régua do Cria

Extraída do próprio código. Tudo que for construído passa por aqui antes de existir.

### As seis cores, e o que cada uma quer dizer

`#EA4918` laranja (conteúdo, a cor-mãe) · `#01A652` verde (stories, equipe) · `#0061EE` azul (dinheiro, sério e confiável) · `#FF77B9` rosa (relacionamento, clientes) · `#FFCF03` amarelo (tempo, agenda) · `#7C90F0` lilás (pesquisa, concorrência).

A regra está escrita no código: **"fonte da verdade, não invente tons novos"**. E a razão de existirem seis: *"o sistema só usava laranja e verde. As outras quatro nunca apareciam, por isso a plataforma parecia morta perto da landing page."*

Cria Captação é **rosa** hoje. Cria Parceiros não tem cor própria e deveria ter: proponho **lilás** ou **amarelo**, porque a área é sobre tempo e prazo.

### A forma

- Base **branca**, não creme. O creme virou tema opcional. *"Creme sobre creme não separava nada, era a origem do morto."*
- Card: `rounded-2xl border border-border bg-card p-4`. Diálogo: `rounded-3xl`, largura de trabalho, respiro de `p-7`.
- Botão é **pílula** (`rounded-full`). Aba é **pílula**, nunca sublinha de 2px, porque no celular sublinha é invisível e o alvo do dedo fica pequeno.
- Formas orgânicas (`OrganicBlobs`) atrás do conteúdo, com raio assimétrico, nunca círculo. Sticker é tempero, dose comedida.
- Cabeçalho de módulo é o `ModuleHero`, com a cor do módulo e abas que são rotas de verdade.

### A voz

O teste está escrito no `voz-cria.ts`: **leia em voz alta; se a frase não sairia num áudio de WhatsApp para uma amiga, reescreva.**

- Concreto vence abstrato. Uma ideia por frase.
- Fale com a pessoa: "você", "a gente".
- Botão tem verbo. Confirmação diz "Excluir", nunca "OK".
- Estado vazio é convite, não lamento: *"Comece pelo caos da sua cabeça"*, nunca *"Nenhuma ideia encontrada"*. Um botão só, porque duas escolhas diante do vazio é ansiedade.
- Proibido: travessão, markdown, emoji decorativo, "é sobre isso", "mergulhe", "desbloqueie", "insights valiosos".

### O que não fazer, com o motivo

| Nunca | Porque |
|---|---|
| `confirm()` nativo | Não é do Cria, mostra o endereço do site e dá cara de golpe. No iOS trava a thread dentro do PWA |
| `overflow-x: hidden` no html/body | Mata o `position: sticky` do header |
| `overflow-wrap: anywhere` | Quebra o texto letra por letra na vertical |
| `sm:`/`md:` dentro de moldura | Use os breakpoints de container (`cq-*`), que medem o pai |
| Campo menor que 16px no mobile | O iOS dá zoom sozinho |
| Card arrastável inteiro | A alça é o grip, senão o arraste morre |
| Tela vazia sem `EmptyState` | O estado vazio é o único onboarding que a pessoa lê |

---

## Parte 3: direcionamento de produto

A pesquisa anterior trouxe o retrato. Aqui está o que fazer com ele.

### 3.1 O 5.1 adaptado: o que os grandes têm e como isso vira Cria

**a) Comentário ancorado no ponto exato**
Frame.io e Ziflow deixam clicar na imagem e comentar naquela coordenada; no vídeo, naquele segundo.

*No Cria:* no card aberto do parceiro e no portal de aprovação do cliente, clicar na arte cria um alfinete numerado com o comentário. No vídeo, o comentário guarda o segundo e o player pula para lá. Visualmente: alfinete na cor da marca, numerado, e a lista de comentários ao lado com o número. Nada de camada nova de ferramenta, é o chat que já existe ganhando coordenada.

*Por que primeiro:* é o item que mais corta ida e volta. "Arruma o título do slide 3" vira um alfinete em cima do título.

**b) Versão, resolvido do jeito que você pediu**
Nada de V1, V2, V3 espalhados pela tela. **Um botão discreto de histórico** no canto da mídia. A peça mostra sempre a versão atual; quem quiser ver as anteriores abre o histórico e navega. Quem entregou fica registrado, com data.

*Ganho:* acaba o "qual arquivo é o bom", sem poluir a tela, e sem obrigar ninguém a entender versionamento.

**c) Etapas de aprovação e lembrete automático**
Filestage deixa a equipe desenhar as próprias etapas e manda lembrete de prazo.

*No Cria:* metade já existe (o eixo de produção e o de aprovação do cliente). O que falta é o **lembrete para a agência**: hoje o robô diário só avisa o parceiro que a peça vence. A agência não é avisada de atraso nenhum.

**d) Busca por conteúdo do arquivo**
Reconhecimento visual, transcrição, marcação automática, para reaproveitar o que já foi aprovado.

*No Cria:* já temos a análise de vídeo do Radar (TwelveLabs). Virar ela para dentro, em cima das peças entregues, dá busca por conteúdo sem ferramenta nova. Fase 3, não agora.

**e) O que NÃO copiar**
O preço e o formato deles. Ziflow e Filestage partem de 199 por mês e vendem por assento. O nosso parceiro é grátis e não consome assento, e é isso que faz cada agência trazer freelancers para dentro. Não mexer.

### 3.2 O que a pesquisa nova acrescenta

**Batching é o método real de quem produz volume.** Gravar um mês inteiro em 3 dias é o padrão do mercado de UGC: agrupar por setup, não por cliente. Quem faz sequencial leva de 2 a 4 semanas para o que quem faz em lote entrega em 3 a 5 dias.

*Consequência para o Cria Captação:* o módulo hoje organiza por **cliente e por mês**. Quem produz de verdade pensa em **dia de gravação e setup**. É por isso que o módulo parece fraco: ele está organizado pela lógica de quem cobra, não de quem grava.

**A lista de tomadas é a peça mais valiosa e está escondida.** No mercado de cinema, o shot list é o documento que todo mundo entende sem ninguém explicar. No Cria ele existe, tem tomada padrão por cliente, e vive dentro de um acordeão colapsado no fim da pasta.

**O que os profissionais usam quando a ferramenta não serve:** planilha. A pesquisa é honesta sobre isso: numa equipe pequena, uma planilha bem feita resolve agenda, lista de tomadas e contatos de graça, e todo mundo já sabe usar. **Nosso concorrente real é o Google Sheets**, não o StudioBinder.

**A dor que vale dinheiro:** 72% dos projetos sofrem escopo que cresce, 99% das agências não cobram o trabalho extra, e cada freelancer perde entre 7.800 e 15.600 dólares por ano nisso. Nenhuma ferramenta brasileira ataca isso.

### 3.3 O que incluir, em ordem de retorno

1. **Contador de revisões visível.** "Ajuste 3 de 2 combinados" no card, para os dois lados. Não cobra nada automaticamente, só torna visível. É a resposta direta à dor de maior valor do mercado, e é barato de construir.
2. **Comentário ancorado.** Corta ida e volta em toda peça.
3. **Histórico de versões num botão.** Acaba a dúvida do arquivo final.
4. **Folha do dia de verdade.** A Captação repensada por dia de gravação, não por cliente (parte 4).
5. **Portfólio automático do parceiro.** Peças entregues e aprovadas viram página pública. O freelancer divulga o Cria por interesse próprio.
6. **Aviso de atraso para a agência.** Fecha o par que hoje só existe de um lado.

---

## Parte 4: Cria Captação

### O diagnóstico, sem suavizar

Você está certo. Cobramos R$ 19,90 por mês por um módulo que tem **dois modelos de roteiro convivendo sem conversarem**, e isso produz erros que o usuário vê:

- A captação com 5 roteiros escritos aparece como **"sem roteiro"** no placar do mês, porque o contador olha o campo antigo.
- A **Folha do dia sai vazia** para os dias cujos roteiros estão no modelo novo. O botão nem aparece.
- **"Enviar pro cliente" quebra** quando existe um roteiro no formato antigo, com a mensagem genérica "Não consegui gerar o link agora". Basta uma captação escrita pela aba Agenda para o envio parar de funcionar.
- **Editar o card "Captação DD/MM"** abre o editor completo e **descarta** título, referências e cenas ao salvar. O trabalho da pessoa some sem aviso.
- O botão **"Sugerir cenas com IA" existe no editor e nunca aparece**, porque a página não passa a propriedade. Não há IA nenhuma no módulo, num produto cuja promessa é IA.

Além disso: o calendário é decorativo, não clica em nada. A duração da gravação é capturada e nunca exibida. A equipe também. O "sobre o vídeo" só aparece no PDF. A mesma captação mostra coisas diferentes conforme onde é aberta. O teleprompter, que é vendido no plano Studio, está liberado aqui sem gate.

**A raiz não é falta de recurso. É falta de espinha.** O módulo cresceu em três migrations (texto solto, depois biblioteca de roteiros, depois roteiros do dia) e ninguém apagou a camada anterior. O que o usuário sente como "fraco" é a incoerência.

### A tese da reforma

**O Cria Captação deveria ser organizado pelo DIA DE GRAVAÇÃO, não pelo cliente.**

Quem grava pensa assim: terça eu vou na Zona Sul, gravo 3 clientes, levo ring light e tripé, tenho 9 vídeos para fazer. O módulo hoje obriga a entrar em 3 pastas diferentes para montar um dia só.

Isso explica por que você acha o módulo fraco apesar de ele ter muita coisa: **as peças estão certas, a lente está errada.**

### O que a reforma entrega

**1. O Dia de Gravação vira a unidade central.** Uma tela por dia com: o local, o horário, quem vai gravar, a duração, todos os roteiros na ordem de gravação (de todos os clientes daquele dia), a lista de tomadas unificada e a folha do dia pronta. É o "call sheet" que o mercado de vídeo entende sem explicação.

**2. Um modelo de roteiro só.** Matar o campo de texto antigo. Migração que leva o que sobrou para `capture_scripts` e some com o editor legado da aba Agenda. Todos os contadores, a folha e o "virar post" passam a olhar um lugar só.

**3. A lista de tomadas sai do porão.** Ela é o documento mais útil do módulo e está num acordeão fechado. Vai para o topo do dia, com contador de progresso, e imprime junto na folha.

**4. IA que escreve cena, de verdade.** Ligar a prop que já existe, com uma edge nova que usa o brandbook do cliente e a `VOZ_CRIA`. Escrever roteiro em cenas com fala e direção é exatamente onde a IA ajuda quem grava, e é o que justifica o preço.

**5. Calendário que funciona.** Clicar no dia abre o dia. Arrastar move a captação.

**6. Mostrar o que já é capturado.** Duração, equipe, local e o "sobre o vídeo" aparecem onde a pessoa está olhando, não só no PDF.

**7. Consertar o envio pro cliente.** O bug do roteiro legado morre junto com o modelo legado.

**8. Mobile de gravação.** Ninguém segura notebook no set. A tela do dia precisa funcionar de pé, com uma mão: tomadas com alvo grande, roteiro em letra legível, teleprompter a um toque.

### Sobre o preço

Depois da reforma, R$ 19,90 fica barato para o que entrega. Vale discutir se Captação continua avulso ou se vira parte de um pacote de produção junto com o Prompter, que hoje já está acessível de dentro dele sem gate.

---

## Parte 5: os circuitos, em ordem

Cada um fecha 100% antes do próximo começar.

### Circuito 1: fechar o vazamento (parceiros)
Confidencialidade e permissão. Janela de tempo e vínculo ativo na ficha da marca; filtrar a conversa do cliente; esconder títulos e nomes para desligado; trocar `acts_for` por `member_can` nas sete tabelas; cadeado nas rotas da agência.
**Pronto quando:** um parceiro de teste, desligado, não consegue ver nada além do próprio dinheiro; e um parceiro ativo não vê o que o cliente escreveu no portal.

### Circuito 2: blindar o dinheiro (parceiros) · FEITO em 14/09/2026
Coluna `entregue_em` própria; cachê que falha vira aviso, não warning no log; atualizar o valor quando muda antes da baixa; avisar a agência quando entregar peça sem cachê; unificar o critério de "pago".
**Pronto quando:** mudar o cachê depois da entrega atualiza o Caixa, e editar o post não muda a data de entrega.

Entregue: migration `20260914000003_parceiro_blindar_dinheiro.sql` (coluna + gatilho BEFORE que carimba só na mudança de status, `lancar_cache_parceiro` com correção/exclusão de valor e notificação `cache_aviso`, `parceiro_entregues` e `parceiro_minhas_agencias` lendo a data certa). No app: `ehPago` comparando `= 'pago'` igual à RPC, `useDelegarPost` só reinicia a produção quando o responsável muda (antes "Atualizar" ressuscitava a peça entregue), aviso de entrega sem cachê nos dois lados (bloco na tela Cachês do parceiro e seção no painel "Com parceiros").

Um furo encontrado durante a revisão e corrigido de quebra: o único lugar que edita o cachê era o mesmo botão que delegava, então arrumar o valor custava a entrega, o prazo aceito e o histórico.

### Circuito 3: notificação que leva ao lugar certo (parceiros)
`?post=<id>` em todos os gatilhos; as duas telas lendo o parâmetro e abrindo o card; ordem invertida no pedido de ajuste; categoria "produção" separada de "clientes"; aviso de atraso para a agência.
**Pronto quando:** clicar em qualquer notificação abre a peça, e o motivo do ajuste que chega é o motivo que foi escrito.

### Circuito 4: parar de engolir erro (parceiros)
Relançar erro real; mensagens humanas; menu que não some ao ativar módulo; parceiro pausado com tela própria.
**Pronto quando:** derrubar a rede mostra erro, não tela vazia.

### Circuito 5: revisão e versão (parceiros)
Contador de revisões visível dos dois lados; botão de histórico de versões na mídia.
**Pronto quando:** dá para saber, olhando o card, quantas vezes a peça voltou e qual é o arquivo atual.

### Circuito 6: comentário ancorado (parceiros e cliente)
Alfinete na imagem, segundo no vídeo, nos dois lados.
**Pronto quando:** o cliente consegue apontar em vez de descrever.

### Circuito 7: Captação, unificar o modelo
Matar o campo antigo, migrar o que sobrou, consertar contadores, folha, envio e "virar post". É o circuito que conserta os bugs, sem tela nova.
**Pronto quando:** não existe mais nenhum lugar no código lendo `agenda_captures.roteiro`.

### Circuito 8: Captação, o Dia de Gravação
A tela nova, com tomadas no topo, roteiros na ordem, folha e teleprompter. Calendário clicável.
**Pronto quando:** dá para montar e executar um dia com 3 clientes sem entrar em nenhuma pasta.

### Circuito 9: Captação, IA de cena
Edge nova com brandbook e voz do Cria, ligada ao botão que já existe.
**Pronto quando:** a cena sugerida passa no teste do áudio e não tem marca de IA.

### Circuito 10: mobile de produção
Quadro do parceiro com breakpoint, mês em lista no celular, título nas telas, dia de gravação usável de pé.
**Pronto quando:** dá para trabalhar o dia inteiro no celular.

### Depois (fase de retenção)
Portfólio automático do parceiro, relatório dele, roteiro e guia no card do filmmaker, análise da própria entrega, ponte para o Cria Caixa.

---

## Fontes desta rodada

- [The 12 Best Call Sheet Software Tools in 2026 (Storyflow)](https://storyflow.so/blog/best-call-sheet-software-2026)
- [The 12 Best Shot List Tools in 2026 (Storyflow)](https://storyflow.so/blog/best-shot-list-tools-2026)
- [The 12 Best StudioBinder Alternatives in 2026 (Storyflow)](https://storyflow.so/blog/best-studiobinder-alternatives-2026)
- [UGC creator batching workflow: shoot a month in 3 days (Flare)](https://joinflare.app/blog/ugc-creator-batching-workflow)
- [UGC Content Batching (Conbersa)](https://www.conbersa.ai/learn/ugc-content-batching-workflow-for-creators)
- [The Creator Economy 2026 (Influee)](https://influee.co/blog/creator-economy)
- [UGC Creator Rates 2026 (Fluxnote)](https://fluxnote.io/guides/ugc-creator-rates-2026)
