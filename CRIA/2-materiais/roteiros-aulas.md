# Roteiros das videoaulas: Trilha Essencial

Documento de gravação. Todo caminho de clique aqui foi verificado no código do produto (rotas em `src/App.tsx`, menus em `AppSidebar.tsx` / `BottomBar.tsx` / `ManagerLayout.tsx`, telas em `src/pages/**`, travas de plano em `src/lib/plans.ts`).

Quando a estrutura planejada da aula não bateu com o produto real, o roteiro segue o produto e a divergência está marcada com **[DIVERGÊNCIA]**.

---

## Regras de honestidade, válidas para as 13 aulas

Estas frases NUNCA podem aparecer numa aula:

1. **O CRIA não publica em rede nenhuma.** Não existe publicação automática. O botão do editor se chama "Publicar pelo celular" no desktop e "Publicar" no celular, e o que ele faz é copiar a legenda e abrir o compartilhamento do sistema com a mídia anexada. Você posta no app do Instagram. Se a mídia está no Google Drive, aparece o aviso "Mídia no Google Drive" dizendo que não dá para publicar direto.
2. **"Agendado" é só uma coluna do quadro.** É o post com data e hora preenchidas. Não dispara nada.
   **[DIVERGÊNCIA]** O briefing dizia "Agendado é etapa do quadro + evento no Google Calendar". Isso não vale mais: a sincronia com o Google Calendar está **desligada no código** (`src/hooks/useGoogleCalendar.ts` linha 92 lança "Google Calendar sync is currently disabled."). **Não cite Google Calendar em nenhuma aula.**
3. **O Cria Estúdio (aba Arte do post) entrega o PROMPT, não a imagem.** Sai em português para conferir e o botão "Copiar em inglês" copia a versão para colar no Midjourney, Canva ou ChatGPT.
4. **Insights exigem conta Profissional do Instagram (Comercial ou Criador)** e o acesso é somente leitura. Escopos pedidos: `instagram_business_basic` e `instagram_business_manage_insights`. Não existe escopo de publicação em lugar nenhum do sistema.
5. **Tendências e Cria Stories dependem de curadoria** e podem chegar vazios. Não prometa volume.
6. **Não cite a área Aprender.** Ela tem três cards ("Roteirizar para Viralizar", "Crescimento Orgânico", "IA para Criadores") e os três estão com o selo "Em breve · Exclusivo". Não existe conteúdo.
7. **Nunca repita a frase do FAQ antigo do site** (`src/lib/locales/pt.ts` linha 194) que diz "você conecta suas contas e o sistema publica". É falso e contradiz o produto.

### Tom
Brasileiro, direto, sem hype. Fala de dor, não de recurso. Nada de "revolucionário", "poderoso", "game changer". Frases curtas. Pode usar "olha", "repara", "presta atenção nisso aqui".

### Conta de demonstração: preencher ANTES de gravar tudo
- Brandbook com pelo menos Identidade e Tom de Voz preenchidos (sem isso toda IA sai genérica e a aula fica ruim).
- 8 a 12 ideias no banco, algumas com nota.
- 10 a 15 posts espalhados nas 6 colunas do Criando, com títulos reais e datas.
- 3 a 5 posts com status Publicado e resultados preenchidos.
- Instagram conectado numa conta Profissional (para as aulas 7 do criador).
- 3 clientes cadastrados no lado social mídia, um deles com Cria Post ativado e posts em várias colunas.

---

# TRILHA ESSENCIAL DO CRIADOR

---

## Aula 1: O que o CRIA é (e o que ele não é)

**Duração alvo:** 4 a 5 minutos

### O gancho (primeiros 10 segundos)
"Você já teve ideia boa morrendo em print. Já esqueceu de postar o que tinha combinado com você mesmo. E já abriu o Instagram sem saber o que ia falar. O CRIA existe pra isso, e só pra isso. Nesses 4 minutos eu vou te mostrar o que ele faz e, principalmente, o que ele NÃO faz, pra você não esperar a coisa errada."

### Pré-requisito de gravação
Conta com Dashboard cheio: Captura Rápida visível, faixa do Instagram conectada com números, tiles com valores diferentes de zero, pelo menos 2 posts em "Próximos posts". Se o checklist "Primeiros passos no Cria" ainda estiver na tela, decida antes: ou mostra ele completo, ou dispensa antes de gravar (o botão X, canto direito do painel).

### Passo a passo com o caminho exato

1. **Abra `/app`.** É a tela que abre sozinha quando você entra. No menu lateral esquerdo ela se chama **Dashboard**, primeiro item do grupo **Criar**. No celular é o **Início**, primeiro ícone da barra de baixo.

2. **Aponte a barra lateral inteira e leia os grupos em voz alta.** Eles são, de cima para baixo: **Criar** (Dashboard, Ideias, Criando, Cria Stories), **Planejar** (Meu Feed, Aprovações, Metas, Tarefas, Arquivos), **Resultados** (Relatórios, Histórico), **Minha marca** (Brandbook, Link in Bio, Media Kit, Biblioteca), **Mundo CRIA** (Tendências, Cria Prompter), **Aprender**, **Mais** (Collabs, Configurações). Diga que o celular tem os mesmos grupos dentro do botão de menu, o último da barra de baixo.

3. **Explique os selos de plano.** Alguns itens do menu têm um selinho "Pro" ou "Studio" à direita do nome. Diga: item com selo é recurso que você ainda não tem no seu plano. Clicar nele não dá porta na cara, abre a tela mostrando o que ele resolve.

4. **Volte para o Dashboard e mostre, na ordem em que aparecem:**
   - **Captura Rápida**, com o campo "O que você está pensando?" e o botão **Capturar** à direita. Digite uma ideia ali e capture ao vivo. Toast: "Ideia capturada!".
   - A faixa **Seu conteúdo no Instagram** logo abaixo, com Seguidores, Alcance 30d, Engajamento e Visitas ao perfil.
   - O bloco **Meu conteúdo**, com os seis tiles: Ideias, Em criação, Publicados, Agendados, Tarefas abertas, Hábitos hoje. Clique num tile para provar que ele leva para a tela correspondente e volte.

5. **Agora a parte honesta.** Vá em **Criando** (menu lateral, grupo Criar) e abra um post qualquer clicando no card. Mostre o botão **Publicar pelo celular**, no topo do editor.

### O que dizer enquanto mostra
- "O CRIA é o lugar onde o seu conteúdo mora antes de existir. Ideia, roteiro, legenda, arte, data. Tudo junto."
- "Agora o que ele NÃO faz: ele não posta por você. Repara no nome do botão. É 'Publicar pelo celular'. Ele copia a legenda e abre o compartilhamento com a mídia. Quem aperta 'compartilhar' no Instagram é você."
- "E a coluna 'Agendado' aqui do quadro é só isso: post com data marcada, pra você saber o que vem. Não é agendador."
- "Se você veio procurando um robô que publica sozinho, não é aqui. Se você veio porque tá cansado de perder ideia e de postar por impulso, é exatamente aqui."

### O momento uau
Segundo 40, quando você digita uma ideia na Captura Rápida, aperta Capturar e ela some da tela. Aí você clica em **Ideias** no menu e ela já está lá. É o gesto mais barato do produto inteiro e resolve a dor mais comum.

### Erros comuns a mencionar
- Achar que existe agendamento automático. Não existe.
- Procurar o Cria Estúdio como uma tela no menu. Ele não é mais tela, virou a aba **Arte** dentro do post.
- Clicar num item com selo Pro/Studio e achar que quebrou. Não quebrou, é a vitrine do recurso.

### Diferenças no mobile
No celular a barra de baixo tem 5 coisas: **Início**, **Ideias**, o botão redondo colorido da **cria** (a IA), **Criando** e o botão de **menu**. Todo o resto do sistema mora dentro desse menu, organizado nos mesmos grupos do desktop. Vale gravar 20 segundos abrindo esse menu e rolando ele até o fim.

---

## Aula 2: Por que o Brandbook decide a qualidade da sua IA

**Duração alvo:** 5 a 6 minutos

### O gancho
"Você já pediu texto pra uma IA e recebeu aquilo que parece post de banco? 'Descubra agora o poder da transformação'. O problema quase nunca é a IA. É que ela não sabe quem é você. Nesta aula eu vou te mostrar onde você conta isso pro CRIA, uma vez só, e por que isso muda tudo que ele gera depois."

### Pré-requisito de gravação
Tenha DUAS contas ou dois momentos: um com Brandbook vazio e um com Brandbook preenchido. O contraste é a aula inteira. Se não der, grave primeiro a geração com o brandbook vazio, preencha ao vivo e gere de novo.

### Passo a passo com o caminho exato

1. **Prove a dor primeiro.** Vá em **Criando** (menu lateral, grupo Criar), abra um post e, no painel da esquerda, no bloco **Content Assistant** (tem o selo "IA" ao lado do título), clique em **Gerar legenda**. Leia o resultado genérico em voz alta. Feche o post.

2. **Menu lateral, grupo Minha marca, clique em Brandbook.** A rota é `/app/brandbook`.

3. **Mostre a barra de completude.** No canto superior direito da tela ficam, nesta ordem da esquerda para a direita: o botão **Importar de PDF** (botão preenchido, com ícone de faísca), o botão **Exportar PDF** (contorno, com ícone de download) e o indicador **Completude geral** com a barra e o percentual. Aponte o percentual e diga que ele é o placar.

4. **Logo abaixo do cabeçalho estão os seis cards do hub.** Os rótulos são exatamente: **Identidade**, **Visual**, **Comunicação**, **Público-alvo**, **Valores**, **Tom de Voz**. Cada card mostra quantos itens já estão preenchidos ou, quando está zerado, mostra **Configurar →**.
   **[DIVERGÊNCIA]** Esses seis cards NÃO são as abas. São atalhos. Se você falar "as seis abas Identidade, Visual, Comunicação..." a pessoa vai procurar e não vai achar. Diga "seis cards" e depois mostre as abas separadamente.

5. **Agora as abas de verdade.** Logo abaixo dos cards está a tira de abas, com estes nomes literais: **Visão Geral**, **Moodboard**, **Linha Editorial**, **Persona**, **Tom de Voz**, **Identidade**.

6. **Abra a aba Tom de Voz e preencha ao vivo.** Cada bloco tem o botão **Salvar** no fim. Toast: "Salvo com sucesso!".

7. **Abra a aba Identidade** e adicione uma cor e uma fonte. Explique que é dessas duas coisas que o prompt de arte vai nascer.

8. **Abra a aba Persona.** Botão **Nova Persona** com ícone de mais. Se estiver zerado, o estado vazio diz "Nenhuma persona ainda" e traz o botão **Criar persona**.

9. **Volte pro post e gere a legenda de novo.** Mesmo botão **Gerar legenda**, no Content Assistant. Leia o resultado do lado do primeiro.

### O que dizer enquanto mostra
- "Essa primeira legenda é o que sai quando a IA não sabe nada de você. Não é culpa dela."
- "O Brandbook é uma conversa de 15 minutos que você tem uma vez e o CRIA lembra pra sempre. Tom, público, cores, fontes, o que você evita falar."
- "Repara: eu não mudei o prompt. Mudei o que a IA sabe sobre mim. E o texto virou outro."
- "Brandbook vazio não deixa a IA ruim. Deixa a IA genérica. E genérico é pior, porque parece que funcionou."

### O momento uau
O corte lado a lado das duas legendas, com o mesmo botão e o mesmo post. Uns 20 segundos antes do fim.

### Erros comuns a mencionar
- Preencher só o nome e o nicho e achar que acabou. Tom de Voz e Persona são os que mais mexem no resultado.
- Escrever tom de voz genérico ("descontraído e profissional"). Diga para escrever como fala, com exemplo de frase.
- Achar que arte feia é culpa do gerador de imagem. Quase sempre é Identidade vazia: sem cor e sem fonte, o prompt sai sem marca.

### Diferenças no mobile
No celular o Brandbook fica dentro do **menu** da barra de baixo, seção **Minha marca**, item **Brandbook**. O botão "Importar de PDF" aparece só com o ícone de faísca, sem texto, porque a tela é estreita. As abas rolam para o lado, arrastando.

---

## Aula 3: O atalho, suba o PDF do seu manual de marca

**Duração alvo:** 4 minutos

### O gancho
"Vinte campos pra preencher. É por isso que o brandbook da maioria das pessoas fica vazio pra sempre. Se você já tem manual de marca, moodboard, ou até um print da sua paleta no celular, você não precisa digitar nada. Sobe o arquivo e o CRIA distribui sozinho."

### Pré-requisito de gravação
Um PDF de manual de marca de verdade (com página de paleta e de tipografia) ou um print colorido da paleta. **O arquivo não pode passar de 10 MB** e o sistema lê **só as 8 primeiras páginas**. Deixe a conta com o Brandbook parcialmente preenchido, porque a tela de revisão fica muito mais interessante quando ela mostra "vai mudar" e o valor antigo riscado.

### Passo a passo com o caminho exato

1. **Menu lateral, grupo Minha marca, clique em Brandbook.**

2. **No canto superior direito, clique em Importar de PDF** (botão preenchido, ícone de faísca, à esquerda do botão Exportar PDF).
   **[DIVERGÊNCIA]** Esse botão **não abre modal**. Ele leva você para a aba **Visão Geral** e desce a página suavemente até o bloco de importação. Diga isso na aula, senão a pessoa acha que travou.

3. **O bloco que aparece se chama "Importar de PDF: o Cria preenche o brandbook todo".** Abaixo do título vem a linha: "Sobe seu manual de marca, moodboard ou um print da paleta (até 2 arquivos). A gente lê e distribui nas seções certas: cores, fontes, tom de voz, visual, valores, temas e público. Você só confere."

4. **A área de upload é o retângulo de borda tracejada, com ícone de documento.** Dentro dele fica o botão **Escolher os arquivos**. Você também pode arrastar o arquivo de cima. Leia em voz alta o rodapé, que está escrito na tela: "PDF ou imagem · até 2 arquivos · até 10 MB cada · consome 1 geração da cota de IA".

5. **Escolha o arquivo.** O botão vira **Lendo…** e a tela mostra dois passos: "Abrindo as páginas (X de Y)" e depois "Lendo a paleta, as fontes e a direção de arte". Mostre também a linha "O arquivo é lido aqui no seu navegador, ele não sobe inteiro pro servidor."

6. **Abre a janela de revisão, com o título "Confere o que eu entendi".** Explique os selos de cada campo, que são exatamente estes quatro: **novo**, **vai mudar**, **igual ao que já estava** e **não encontrei**. Onde diz "vai mudar", o valor antigo aparece riscado depois da palavra "Antes:".

7. **Role a janela e mostre os campos que ele preenche**, na ordem em que aparecem: Cores da marca, Fontes, Direção visual, Tom de voz, Palavras e coisas que você evita, Personalidade e palavras-chave, Diferencial e propósito, Temas de conteúdo, Público-alvo, Dores do público, Desejos do público, Objeções do público, Interesses do público, Canais do público.

8. **No rodapé da janela há dois botões: Descartar (à esquerda, sem preenchimento) e Salvar no brandbook (à direita, preenchido, com ícone de faísca).** Clique em **Salvar no brandbook**.

9. **Toast de confirmação:** "Brandbook atualizado: N campos preenchidos nas seções certas." Volte às abas e mostre o conteúdo que apareceu.

### O que dizer enquanto mostra
- "Isso aqui não é upload de arquivo. É o CRIA lendo o seu manual e espalhando cada pedaço na gaveta certa."
- "Repara: nada é salvo antes de você olhar. Onde já tinha texto seu, ele mostra o antes riscado. É pra você não apagar sem querer o que ajustou na mão."
- "Custa uma geração da sua cota de IA do mês. Uma. Pra preencher catorze campos."

### O momento uau
A janela "Confere o que eu entendi" abrindo com quatorze campos preenchidos de uma vez. É segundo 90, mais ou menos.

### Erros comuns a mencionar
- **Mandar arquivo do Word.** O sistema recusa com a mensagem "Word não dá pra ler direito (o layout se perde). Exporte como PDF, fica bem melhor."
- **Arquivo acima de 10 MB.** Mensagem: "O arquivo tem X MB. O limite é 10 MB."
- **PDF de 40 páginas.** Ele lê só as 8 primeiras. Diga para exportar só as páginas de paleta, tipografia e tom.
- **Mandar um PDF que não é de marca.** Mensagem: "Li o arquivo mas não achei identidade de marca nele. Tem certeza que é o brandbook?"
- **Cota de IA zerada.** Mensagem: "Você usou todas as gerações de IA deste mês."
- Duas regras que valem citar: ele **só acrescenta** cores, fontes e tom, nunca duplica; e nas perguntas guiadas ele **só preenche campo vazio**, nunca sobrescreve o que você escreveu.

### Diferenças no mobile
No celular o botão do topo aparece só com o ícone de faísca. O texto do bloco é mais curto, mas o fluxo é idêntico: escolher arquivo, ler, revisar, "Salvar no brandbook". Funciona bem com print da paleta tirado do próprio celular.

---

## Aula 4: Nunca mais perca uma ideia

**Duração alvo:** 5 minutos

### O gancho
"Você viu um post bom no Instagram, pensou 'isso dá pauta', salvou. E nunca mais achou. Ou anotou no bloco de notas junto com a lista do mercado. Ideia boa não morre de burrice, morre de bagunça. Vou te mostrar os três lugares onde ela para de morrer."

### Pré-requisito de gravação
Banco com 8 a 12 ideias já cadastradas (senão a Galeria fica feia). Pelo menos 6 itens na aba **Salvos**, com capa carregada. Um link do Instagram na área de transferência pronto para colar ao vivo.

### Passo a passo com o caminho exato

1. **Lugar 1: a Captura Rápida do Dashboard.** Menu lateral, **Dashboard**. O card **Captura Rápida** fica no topo da página, com uma faísca grande de marca d'água no canto. Campo com o texto "O que você está pensando?" e o botão **Capturar** à direita. Digite e capture. À direita do título do card tem o link **Ver minhas ideias (N)**. Clique nele.

2. **Lugar 2: o Banco de Ideias.** Você caiu em `/app/ideias`. No menu lateral é **Ideias**, segundo item do grupo **Criar**.
   - No topo à esquerda tem o alternador com dois botões: **Ideias** e **Salvos**.
   - No topo à direita, na ordem: o contador de sugestões restantes, o alternador **Lista** / **Galeria**, e o botão **Nova Ideia** (no celular ele encolhe para **Nova**).

3. **Clique em Nova Ideia.** Abre a janela "Nova Ideia" com o campo **Título** (placeholder "Sua ideia...") e o campo **Notas** (placeholder "Mais detalhes..."). Botões **Salvar** e **Cancelar**. Título aceita até 100 caracteres, notas até 500.

4. **Mostre a visão Lista.** Cada linha traz quatro ações com texto: **IA**, **Virar post**, **Editar** e **Excluir**.

5. **Clique em IA numa ideia.** Abre o painel **Sugestões de IA** dentro do card. Tem os chips de plataforma: **Instagram**, **Reels**, **Carrossel**, **Story**, **YouTube**. Escolha um e clique em **Gerar sugestões**. Cada sugestão vem com título e três chips (formato, ângulo, objetivo) e o link **Criar post →**.

6. **Clique em Virar post numa ideia.** Toast: "Ideia virou post! Agora é só criar. 🎬" e o editor do post abre na hora. Feche. A ideia ganha o selo **✓ Post** na lista.

7. **Troque para a visão Galeria** (botão Galeria, canto superior direito). Explique que aqui os botões viram ícones no canto superior direito do card: a **faísca** é o mesmo painel de IA e o ícone de **claquete** é o "Virar post" (passe o mouse e apareça o texto "Virar post").

8. **Lugar 3: a aba Salvos.** Clique em **Salvos**, ao lado de **Ideias**.
   - No topo aparece o bloco **Salvar um link**, com o campo "Cole o link do Instagram ou TikTok…" e o botão **Salvar**.
   - Cole um link ao vivo. O CRIA puxa capa, legenda e @ sozinho.
   - Ao lado, o seletor **Pasta:** com as opções "Sem pasta", suas pastas e **+ Nova pasta…**. Se você ainda não tem nenhuma pasta, aparece um campo com o placeholder "Pasta (ex.: Ganchos)".
   - Abaixo, a busca com o placeholder "Buscar por @ ou palavra…" e os chips de pasta, começando por **Todas**.
   - Se algum salvo estiver sem capa, aparece o botão **Recuperar capas faltantes (N)** ao lado da busca.

9. **No card de um salvo, clique em Criar post.** Ele cria o post e te leva direto para `/app/criando`. Toast: "Post criado no Criando a partir do salvo."

### O que dizer enquanto mostra
- "A regra é uma só: nunca deixe a ideia fora do sistema. Nem por dez minutos."
- "Aqui não precisa ser bom. Joga tudo. A gente separa depois."
- "Esse link que eu colei, o CRIA já foi lá e puxou a capa e a legenda. Isso é a sua pasta de referência, e ela pesquisa por @ e por palavra."
- "E quando a ideia amadurecer, esse botão aqui manda ela direto pro quadro, virando post."

### O momento uau
Colar o link do Instagram na aba Salvos e ver a capa aparecer sozinha, uns 3 segundos depois. É o segundo 150 aproximadamente.

### Erros comuns a mencionar
- Link privado ou conta fechada: a capa não vem. Aparece "sem capa" no card e o botão "Recuperar capas faltantes" também não resolve, porque o post não é público.
- Confundir as duas abas: **Ideias** é o que você pensou, **Salvos** é o que você viu de outra pessoa. Pastas existem só em Salvos.
- Acumular 300 ideias e nunca promover nenhuma. Diga para promover na hora em que a ideia amadurece.
- O contador de sugestões da IA nesta tela tem limite próprio de 10 no mês. Mencione, senão a pessoa acha que quebrou.

### Diferenças no mobile
- **Ideias** é o segundo ícone da barra de baixo, ao lado do Início. Acesso direto, sem menu.
- Os botões **Lista** e **Galeria** aparecem só como ícones, sem o texto.
- O botão de criar mostra só a palavra **Nova**.
- Detalhe bom de mostrar: no Android, compartilhar um post do Instagram para o CRIA abre o app já na aba **Salvos**, com o link preenchido no campo.
- Mover de pasta, no card do salvo, usa o pop-up nativo do navegador perguntando "Mover para qual pasta?". É feio, mas funciona. Avise.

---

## Aula 5: Cria Plano, seu mês montado pela IA

**Duração alvo:** 5 a 6 minutos

### O gancho
"Domingo à noite, calendário vazio, e a pergunta: o que eu posto essa semana? Se essa cena é sua, presta atenção nos próximos cinco minutos. O Cria Plano monta a semana ou o mês inteiro de uma vez, com os seus pilares, no seu tom. E você edita tudo antes de aceitar."

### Pré-requisito de gravação
- **Plano Studio ativo** na conta de demonstração. Esse recurso é travado no Studio (`FEATURES["cria-plano"].minimo = "studio"`). Sem Studio a tela vira a vitrine de upgrade e a aula não acontece.
- Brandbook preenchido, senão o resultado sai fraco e a aula perde força.
- Pilares de conteúdo cadastrados (Configurações, aba **Pilares & Hábitos**).
- Pelo menos 4 posts publicados com horário preenchido, para o botão "Da minha conta" ficar habilitado. Sem isso ele fica apagado.

### Passo a passo com o caminho exato

1. **Menu lateral, grupo Criar.**
   **[DIVERGÊNCIA IMPORTANTE]** No **menu lateral do desktop o Cria Plano não aparece**. Os itens do grupo Criar são Dashboard, Ideias, Criando e Cria Stories. O Cria Plano só está listado no **menu do celular** (botão de menu, seção **Criar**, item **Cria Plano**, com a descrição "Cronograma do mês com IA"). No desktop, o caminho é digitar a URL `/app/autopilot` ou chegar por um atalho de outra tela. Grave a aula usando o caminho do celular ou avise que no desktop é pela URL. Vale reportar isso como bug de menu.

2. **A tela abre com o título Cria Plano e o selo Studio ao lado**, e a linha "A IA monta seu mês (ou semana) de conteúdo usando seu brandbook, histórico e o que performou."

3. **Coluna da esquerda: a configuração.** De cima para baixo, os campos literais são:
   - **Período**: dois botões, **Semana** e **Mês**.
   - **Quantos posts**: três botões, **5**, **8**, **12**.
   - **Plataforma**: **Instagram**, **TikTok**, **YouTube**.
   - **Horários**: dois botões, **Da minha conta** e **Recomendado**. Abaixo aparece a linha explicando qual está valendo e quais são os horários.
   - **Foco (opcional)**: quatro chips, **Crescer alcance**, **Engajar**, **Vender**, **Lançamento**.
   - **Tema/contexto (opcional)**: campo de texto com o exemplo "Ex.: lançamento do curso, semana de Black Friday…".
   - **Público (opcional)**: campo com o exemplo "Ex.: mães empreendedoras 25-40".

4. **Botão Gerar cronograma**, no fim dessa coluna, largura total, com ícone de faísca. Clique. Ele vira **Gerando…**.

5. **A coluna da direita enche de cards.** Cada card traz: uma caixinha de seleção no canto superior esquerdo, os chips de formato e pilar no canto direito, o **título editável ali mesmo**, os campos de **data** e **hora**, a **legenda** (clique nela para editar, o texto de apoio diz "Sem legenda, clique pra escrever") e, no rodapé, a explicação da IA com uma faísca na frente, dizendo por que aquele post existe.

6. **Acima dos cards fica a barra de ações.** À esquerda o link **Selecionar todos (N/N)**. À direita três botões, nesta ordem: **Regenerar**, **Revisão** e **Enviar**.

7. **Desmarque um ou dois cards** clicando neles (o card fica opaco). Edite um título e uma data ao vivo.

8. **Clique em Enviar.** Toast: "N post(s) enviados pro Criando! 🎬".

9. **Vá em Criando** (menu lateral, grupo Criar) e mostre os posts chegando.
   **[DIVERGÊNCIA]** Eles chegam na coluna **Ideia**, não em "Agendado", mesmo já tendo data e hora preenchidas. Diga isso na aula: "eles caem na primeira coluna, com a data já marcada, prontos pra você produzir". Se você disser "já entram agendados", a pessoa não vai achar.

10. **Mencione o botão Revisão.** Ele faz a mesma coisa que Enviar, só que marca cada post com a nota "⚠️ Revisar, gerado pelo Autopilot". É bom quando você gerou muita coisa de uma vez.

11. **Mostre o bloco Histórico**, abaixo da configuração. Ele lista os cronogramas que você já gerou, no formato "Mês · 12 · Vender · 12/05/2026". Clicar reabre aquele cronograma para editar e reenviar.

### O que dizer enquanto mostra
- "Repara que ele não me perguntou 'sobre o que você quer postar'. Ele já sabe: leu meu brandbook e meus pilares."
- "Isso aqui é ponto de partida, não camisa de força. Cada campo desse card é editável antes de entrar no meu quadro."
- "E o que eu não gostei, eu desmarco. Só vai o que eu escolhi."

### O momento uau
Os 12 cards aparecendo de uma vez depois do "Gerar cronograma", cada um com título, data, hora e legenda. Uns 30 segundos depois do clique.

### Erros comuns a mencionar
- **Gerar com o Brandbook vazio.** A própria tela avisa: "Dica: preencha o Brandbook pra IA acertar mais o seu tom." O resultado sai genérico e a pessoa culpa a IA.
- **O botão "Da minha conta" apagado.** É porque a conta ainda não tem histórico suficiente de horários. A tela explica: "Sem dados suficientes ainda, usando o recomendado. Publique mais pra liberar 'da minha conta'."
- **Esquecer que gasta cota de IA.** Cada geração consome da mesma cota mensal usada pela cria IA, pelos prompts de arte e pela leitura do brandbook em PDF.
- **Achar que os posts entram prontos.** Eles entram como ponto de partida, com título e legenda para você lapidar.

### Diferenças no mobile
No celular a coluna de configuração aparece em cima e os cards embaixo, empilhados. O caminho de menu é o único caminho oficial: barra de baixo, botão de **menu**, seção **Criar**, item **Cria Plano**.

---

## Aula 6: Legenda sem tela em branco

**Duração alvo:** 6 minutos

### O gancho
"O vídeo você grava. A arte você resolve. Aí chega a hora da legenda e você fica vinte minutos olhando pro cursor piscando. Essa aula é sobre nunca mais começar do zero."

### Pré-requisito de gravação
Um post no Criando com título de verdade e formato Reels ou Carrossel (para a aba Roteiro ficar completa). Brandbook preenchido. Deixe a legenda vazia no começo da gravação.

### Passo a passo com o caminho exato

1. **Menu lateral, grupo Criar, clique em Criando.** No celular é o quarto ícone da barra de baixo.

2. **Clique em qualquer card do quadro.** O editor abre como uma janela grande, quase em tela cheia. Clique fora não fecha, é de propósito. A tecla Esc fecha.

3. **Explique o layout em 15 segundos.** À esquerda, o painel de configuração. À direita, as abas de conteúdo. As abas são, nesta ordem exata: **Legenda**, **Roteiro**, **Arte**, **Tarefas**, **Notas**, **Refs**.

4. **Vá primeiro no painel da esquerda, no bloco Content Assistant** (título com selo "IA" ao lado). Ele fica abaixo do bloco **Agendamento**.
   - Linha **Tom**, com cinco chips: **Descontraído**, **Profissional**, **Inspirador**, **Educativo**, **Provocativo**.
   - Linha **Tamanho**, com três chips: **Curto**, **Médio**, **Longo**.
   - Botão preenchido **Gerar legenda** e, abaixo, o botão de contorno **Sugerir hashtags**.

5. **Escolha um tom, escolha um tamanho e clique em Gerar legenda.** Ele vira "Gerando legenda…". O resultado aparece num card logo abaixo, com dois botões: **Usar esta legenda** e **Gerar outra**.

6. **Clique em Usar esta legenda.** Toast: "Legenda adicionada ao post!". O texto aparece na aba **Legenda**, à direita.

7. **Vá para a aba Legenda.** O campo grande tem o texto de apoio "Escreva sua legenda aqui ou gere com IA…". No canto inferior direito fica o contador de caracteres, no formato "N/2200". No canto superior direito, o seletor de emoji.

8. **Assim que a legenda passa de 10 caracteres, aparece uma barra de botões.** Os textos são exatamente: **Reescrever**, **Encurtar**, **Expandir**, **Mais casual**, **Mais formal** e, destacado com borda colorida, **Avaliar legenda**.
   **[DIVERGÊNCIA]** Não existe botão "Avaliar gancho". O botão é **Avaliar legenda**. O que se chama gancho é o rótulo do resultado.

9. **Clique em Encurtar.** Abre o card **Sugestão da IA** mostrando o texto antigo riscado em vermelho e o novo em verde, com os botões **Substituir** e **Descartar**. Substitua.

10. **Clique em Avaliar legenda.** Aparece a nota, de 0 a 10, com o rótulo **Nota de gancho** acima. Abaixo vêm duas seções: **Como melhorar** (uma lista) e **Variações prontas**, e cada variação tem o link **Usar esta**. Clique numa. Toast: "Legenda atualizada!".

11. **Volte ao painel esquerdo e clique em Sugerir hashtags.** O bloco **Hashtags sugeridas** aparece na aba Legenda, separado em três grupos: **Alta relevância**, **Média relevância** e **Nicho específico**. O botão de copiar diz **Copiar N**. Toast: "Hashtags copiadas!".

12. **Se o post for carrossel ou reels, abra a aba Roteiro** e mostre que a IA também escreve as páginas ou as cenas ali, no mesmo tom.

13. **Feche mostrando o indicador de salvamento no topo do editor**, que alterna entre "Salvando…" e "Salvo ✓". Explique que não precisa apertar salvar toda hora, mas o botão **Salvar** existe no canto superior direito.

### O que dizer enquanto mostra
- "Eu nunca começo do zero. Eu começo do rascunho da IA e eu reescrevo por cima. É muito mais rápido criticar do que criar."
- "Repara que ele não trocou o texto na marra. Ele mostrou o antes e o depois e me deixou decidir."
- "E essa nota aqui não é enfeite: ela te diz se o seu gancho segura o dedo da pessoa nos primeiros três segundos."

### O momento uau
O "Avaliar legenda" devolvendo a nota e as variações prontas. Uns dois terços da aula.

### Erros comuns a mencionar
- **Procurar o Content Assistant dentro da aba Legenda.** Ele não está lá, está no painel da esquerda. No celular ele fica na aba **⚙ Configurar**.
- **Gerar sem título.** O botão "Gerar legenda" fica desabilitado enquanto o post não tem título.
- **Aceitar a primeira legenda.** Diga para sempre passar o "Reescrever" ou o "Mais casual" por cima.
- **Não existe botão "Copiar legenda" na aba Legenda.** A legenda é copiada quando você usa o botão de publicar pelo celular. Se alguém procurar, não vai achar.
- Cada geração e cada refinamento consome da cota mensal de IA.

### Diferenças no mobile
No celular o editor tem duas abas grandes no topo: **⚙ Configurar** e **✦ Criar conteúdo**.
- **⚙ Configurar** guarda Plataforma, Formato, Pilar, Status, Semana, Agendamento e o **Content Assistant**.
- **✦ Criar conteúdo** guarda as abas Legenda, Roteiro, Arte, Tarefas, Notas e Refs.
Ou seja: no celular você gera a legenda numa aba e lê o resultado na outra. Mostre esse pulo, é a dúvida número um.
Os botões do topo do editor viram só ícones no celular.

---

## Aula 7: Conecte seu Instagram

**Duração alvo:** 5 minutos

### O gancho
"Você posta e o número some dentro do app do Instagram. Uma semana depois você não lembra mais o que funcionou. Conectar a conta resolve isso em dois minutos. E antes que você pergunte: não, o CRIA não vai postar nada por você. É só leitura."

### Pré-requisito de gravação
Uma conta de Instagram **Profissional** (Comercial ou Criador) para conectar ao vivo, e outra conta já conectada com pelo menos 30 dias de dados para mostrar a tela cheia. Se possível, grave a conexão ao vivo e depois corte para a conta rica.

### Passo a passo com o caminho exato

1. **Menu lateral, grupo Mais, clique em Configurações.** No celular: botão de **menu** da barra de baixo, seção **Mais**, item **Configurações**.

2. **A tira de pílulas do topo tem oito seções, nesta ordem:** **Perfil**, **Pilares & Hábitos**, **Marca & Visual**, **Assinatura**, **Conexões**, **Notificações**, **Equipe**, **Conta**. Clique em **Conexões**.

3. **Leia em voz alta o que está escrito na tela**, porque é a promessa da aula inteira: "Serviços externos ligados à sua conta. Só leitura, você desconecta quando quiser." E no card do Instagram: "Conecte sua conta Business ou Creator pra ver seus insights (alcance, seguidores, desempenho) na página de Insights. Só leitura, o CRIA não publica por você."

4. **Clique no botão Conectar Instagram** (botão preenchido, ícone do Instagram, largura total no celular). A página inteira sai do CRIA e vai para a tela de autorização **do Instagram**.
   Diga com todas as letras: **não pede login do Facebook**. É login do Instagram direto.

5. **Autorize.** Você volta para `/app/insights` com o toast "Instagram conectado! Puxando seus dados..." e o sistema já dispara a primeira sincronização sozinho.

6. **Mostre a barra da conta conectada**, no topo do Insights: avatar, @usuario, bolinha verde com **Conectado**, o texto "Atualizado {data}", e à direita os botões **Atualizar** e **Desconectar**.

7. **Os quatro números.** Os rótulos literais são: **Seguidores**, **Alcance (30d)**, **Interações (30d)** e **Visitas ao perfil**.

8. **Role a tela e mostre**, na ordem: os gráficos "Alcance · 30 dias" e "Seguidores · 30 dias", o bloco **O que mais gerou crescimento** (com os cards Mais alcance, Mais salvos e Melhor formato), **O que postar mais**, **Reels · retenção**, **Quem te acompanha** e **Stories**.

9. **Chegue na seção "Posts · vincule ao conteúdo do CRIA".** Em cada post aparece o botão pontilhado **Vincular ao conteúdo do CRIA**. Clique nele. Abre a janela "Vincular ao conteúdo do CRIA", com busca ("Buscar por título...") e os posts agrupados por status, com os publicados primeiro. Escolha um. Toast: "Vínculo atualizado."

10. **Volte para Configurações, aba Conexões**, e mostre como fica depois de conectado: o bloco com o @, a linha "Conectado · BUSINESS" e o botão **Desconectar**.

11. **Feche mostrando onde os números reaparecem:** volte ao **Dashboard** e aponte a faixa **Seu conteúdo no Instagram**, que agora tem número no lugar do convite, e a tarja verde dizendo qual formato rende mais e qual o melhor dia.

### O que dizer enquanto mostra
- "Duas permissões, só. Ler o seu perfil e ler as suas métricas. Não existe permissão de publicar. Não dá nem se eu quisesse."
- "E esse vínculo aqui é o pulo do gato: ele liga o post que você planejou aqui dentro com o número que ele deu lá fora. É assim que você aprende o que funciona."
- "Se você quiser sair, é um clique em Desconectar. E dá pra revogar direto no Instagram também."

### O momento uau
Vincular uma publicação real do Instagram ao post que você planejou no CRIA, e ver alcance e salvos colados ao roteiro que você escreveu. Uns 3 minutos e meio.

### Erros comuns a mencionar
Esse é o ponto mais frágil do produto, então dedique 60 segundos só a isso:

- **Conta pessoal.** É o erro número um. O Instagram só libera métricas para conta Profissional. Se a pessoa tentar, a mensagem que aparece é: "Não consegui concluir a conexão. Isso costuma acontece quando a conta do Instagram não é Profissional. No Instagram: Configurações, Tipo de conta e ferramentas, Mudar para conta profissional (Comercial ou Criador). Depois tente de novo." Mostre o caminho no app do Instagram na tela, se der.
- **Já conectou e a conta é pessoal:** aparece o banner âmbar "Sua conta do Instagram é pessoal." explicando o mesmo caminho e pedindo para voltar e tocar em **Atualizar**.
- **Cancelou no meio:** "A autorização foi cancelada no Instagram. Clique em Conectar Instagram e conclua os passos até o fim."
- **Demorou demais na tela de autorização:** "A tentativa de conexão expirou. Volte aqui e clique em Conectar Instagram de novo."
- **Conexão expirada depois de um tempo:** ao clicar em Atualizar aparece "Sua conexao com o Instagram expirou. Reconecte a conta pra atualizar os insights." O token vale 60 dias e o sistema tenta renovar sozinho todo dia, mas se você trocar a senha ou revogar, precisa reconectar.
- **Não existe botão "Atualizar" dentro de Configurações.** Ele só existe na tela de Insights. Se a pessoa procurar em Conexões, não vai achar.
- **Insights é do plano Pro pra cima.** Quem está no Essencial vê a vitrine, não a tela.

**Aviso interno para o Walter, não vai pra aula:** o checklist "Primeiros passos no Cria", no Dashboard, tem o item "Conectar meu Instagram" que leva para Configurações, mas ele marca como concluído baseado no campo de texto do @ na aba **Perfil**, não na conexão de verdade. Ou seja, dá para ele aparecer riscado sem a conta estar conectada. Vale corrigir antes de gravar a aula 1, senão gera pergunta.

### Diferenças no mobile
Tanto **Configurações** quanto **Insights** ficam dentro do botão de **menu** da barra de baixo: Configurações na seção **Mais**, Insights na seção **Resultados**. Vale gravar essa navegação, porque é a dúvida mais comum de quem usa só o celular.
A tira de oito pílulas de Configurações rola para o lado, arrastando com o dedo.
Na tela de Insights, o texto "Atualizado {data}" some no celular, ficam só os botões Atualizar e Desconectar. Os quatro números aparecem dois por linha.

---

# TRILHA ESSENCIAL DA SOCIAL MÍDIA

---

## Aula 1: O que a sua conta já inclui

**[DIVERGÊNCIA GRAVE, LEIA ANTES DE GRAVAR]**
A aula estava planejada como "A conta é grátis: o que já vem incluso". **No produto atual isso não é verdade.** Quem se cadastra escolhendo "Social mídia / agência" cai na tela `/comecar-agencia`, que diz "Comece sua agência no Cria" e exige escolher quantos assentos (3, 5, 10 ou 20) e passar pelo checkout do plano de agência. Sem isso, o painel `/socialmidia` não abre: o guard do `ManagerLayout` devolve a pessoa para `/app`.

O que é verdade e dá uma aula boa:
- **Depois que o plano de agência está ativo**, várias telas não custam nada a mais: **Início**, **Clientes**, **Agenda**, **Aprovações**, **Equipe** (com o 1º colaborador grátis), **Parceria**, **Comissões**, **Suas contas** e **Lixeira**. Nenhuma delas tem trava de módulo.
- **Os módulos são assinaturas separadas, uma a uma:** Cria Post, Cria Gestão, Cria Caixa e Cria Radar. Você contrata só o que usar e cancela quando quiser.

**Recomendação:** renomeie a aula para **"O que a sua conta já inclui (e o que é módulo separado)"**. O roteiro abaixo é para esse título.

**Duração alvo:** 4 minutos

### O gancho
"Você acabou de entrar e viu um monte de coisa com cadeado. Antes de você achar que comprou pouco: metade do que você precisa pra hoje já está liberado. Nesses 4 minutos eu separo o que já é seu do que é módulo à parte, pra você não pagar por nada que não vai usar."

### Pré-requisito de gravação
Conta de gestor com o plano de agência ativo, **pelo menos um módulo NÃO contratado** (para mostrar o cadeado e a vitrine), 3 clientes cadastrados e algumas aprovações pendentes, para o dashboard não estar vazio.

### Passo a passo com o caminho exato

1. **Abra `/socialmidia/dashboard`.** É a tela que abre sozinha quando o gestor entra.

2. **Mostre a barra lateral flutuante do desktop**, que fica no meio da lateral esquerda e **se expande com os nomes quando você passa o mouse por cima**. Grave passando o mouse, senão a pessoa só vê ícones. Os grupos são três:
   - **Dia a dia**: **Início**, **Clientes**, **Agenda**, **Aprovações**.
   - **Módulos**: os módulos que você tem. Módulo ativo tem uma bolinha verde no canto do ícone e o selo **Ativo**; módulo não contratado tem um **cadeado** e mostra o preço no lugar do selo.
   - **Negócio**: **Equipe**, **Parceria**, **Comissões**, **Suas contas**. E, mais embaixo, **Lixeira**, **Configurações** e **Sair**.

3. **Diga a regra em uma frase:** tudo do grupo "Dia a dia" e tudo do grupo "Negócio" já vem com a sua conta. Os módulos são separados.

4. **No dashboard, mostre os quatro números do topo.** Os rótulos são: **clientes ativos**, **previsto neste mês**, **posts esperando o cliente** e **a sua semana**. Cada um leva para o lugar correspondente. Acima deles tem o botão **Ocultar** / **Mostrar**, que troca todos os valores por bolinhas, para você abrir o painel do lado do cliente ou gravar a tela sem mostrar seu faturamento. Use ele ao vivo, é um detalhe que vende sozinho.

5. **Role até Seus módulos.** Cada card mostra o nome do módulo, o selo **Ativo** e a linha "Toque para abrir". Módulos que você ainda não tem aparecem numa linha logo abaixo, começando com **Amplie seu plano:**.

6. **Clique num módulo que você NÃO tem.** Abre a vitrine explicando o que ele resolve e quanto custa. Diga: "Repara que ele não me dá porta na cara. Ele me mostra o que eu ganharia."

7. **Mostre as quatro telas gratuitas rapidamente**, uma de cada vez, pelo menu lateral:
   - **Clientes**: a carteira.
   - **Agenda**: o calendário de produção de todos os clientes juntos.
   - **Aprovações**: a fila do que está parado na mão dos clientes.
   - **Equipe**: os assentos de colaborador. Aponte a linha que diz que o **primeiro colaborador é grátis** e que a partir do segundo cada assento custa R$ 29,90 por mês.

8. **Feche em Parceria** (grupo Negócio). Explique em 20 segundos: você ganha um cupom, quem assina por ele te dá comissão **todo mês** enquanto continuar assinante, e a comissão libera quando o cliente paga a segunda fatura.

### O que dizer enquanto mostra
- "Cliente, agenda e aprovação são o osso da operação. Isso não é upsell, isso já é seu."
- "Módulo é assinatura separada de propósito. Se você não cobra financeiro dos seus clientes, você não precisa do Cria Caixa. Não paga."
- "E esse olhinho aqui vai salvar a sua vida na reunião com cliente."

### O momento uau
O botão **Ocultar** apagando todos os valores de dinheiro da tela de uma vez, no segundo 60. Todo social mídia já passou pelo constrangimento de abrir o painel do lado do cliente.

### Erros comuns a mencionar
- Achar que o cadeado é bug. É módulo não contratado.
- Procurar o **Cria Radar** duas vezes no menu do celular. Ele aparece uma vez só, no fim da seção Módulos.
- Confundir **Suas contas** com **Clientes**. "Suas contas" é onde você paga assentos para dar uma conta CRIA de presente pro cliente. "Clientes" é a sua carteira de fichas.

### Diferenças no mobile
No celular a barra de baixo tem quatro atalhos fixos: **Início**, **Clientes**, **Agenda** e **Aprov.**, mais o botão de **menu**. Dentro do menu ficam as seções **Módulos**, **Negócio** e **Sistema**.

**Aviso interno para o Walter, não vai pra aula:** os cards de módulo do dashboard estão todos saindo na cor laranja, porque o mapa de cor (`MODULE_COLOR` em `src/lib/moduleTheme.ts`) é indexado por segmento de rota e o dashboard consulta por código de módulo. Se você disser "cada módulo com a sua cor" a aula não bate com a tela. No menu lateral a cor está certa.

---

## Aula 2: Cadastre seu primeiro cliente em 3 minutos

**Duração alvo:** 4 minutos

### O gancho
"Cliente novo hoje é: um grupo no WhatsApp, uma pasta no Drive, uma planilha com o valor e a data, e um bloco de notas com o tom de voz dele. Quatro lugares. Vou te mostrar como isso vira um lugar só, em três minutos."

### Pré-requisito de gravação
Tenha em mãos: nome de uma marca fictícia, o @ dela, uma imagem de logo no computador e um link de pasta do Drive. Deixe a lista de clientes com 3 ou 4 cards já cadastrados, para a tela não abrir vazia.

### Passo a passo com o caminho exato

1. **Menu lateral, grupo Dia a dia, clique em Clientes.** No celular é o segundo ícone da barra de baixo. A rota é `/socialmidia/clientes`.

2. **No canto superior direito ficam dois botões**: **Importar do Cria** e, à direita dele, **Novo cliente** (no celular ele encolhe para **Novo**). Clique em **Novo cliente**.

3. **Abre a janela "Novo cliente"**, com a linha de apoio "Cria a ficha do cliente. Você adiciona posts, cronograma e o resto dentro dele." Os campos, na ordem em que aparecem:
   - Um avatar clicável no topo, com o texto **Enviar foto ou logo**.
   - **Nome**, com o texto de apoio "Nome da marca/cliente". **É o único campo obrigatório.** Sem ele o botão Criar fica desabilitado.
   - **Instagram (opcional)**, com o exemplo "@cliente".
   - **Foto ou logo (opcional)**, com o botão **Enviar** e o campo "ou cole uma URL de imagem".
   - **Link do Drive (opcional)**, com o exemplo "https://drive.google.com/…" e a explicação "Entra nos links úteis do cliente e já ativa a aba Drive."
   - **Cor do cliente (opcional)**, com a paleta e o link **Remover cor**.

4. **Preencha só o Nome e clique em Criar.** Toast: "Cliente criado!" e o sistema te leva direto para a ficha dele, em `/socialmidia/clientes/{id}/visao-geral`.

5. **Agora a parte que importa: o cockpit.** Mostre a fila de abas do topo, que são: **Visão geral**, **Cria Post**, **Cria Gestão**, **Cria Caixa**, **Cria Radar**, **Instagram** e **Links úteis**. Explique que a cor de cada aba é a cor do módulo: laranja é Cria Post, rosa é Cria Gestão, azul é Cria Caixa e lilás é Cria Radar. Aba com cadeado é módulo que você ainda não tem.

6. **Na Visão geral, mostre os campos editáveis no lugar.** Toca, digita, salva sozinho. Chame atenção para o **dia de pagamento**, porque é ele que faz a mensalidade nascer lá no Cria Caixa.

7. **Mostre o seletor de status**, no cabeçalho do cliente. As opções são **Ativo**, **Pausado** e **Inativo**. Escolha Inativo ao vivo: o sistema pede a **data do encerramento**. Explique por quê: a mensalidade conta até o mês dessa data e para de contar dali pra frente. Volte para Ativo.

8. **Mostre o botão Links úteis**, também no cabeçalho, com o ícone de pasta. Ele abre a lista de links salvos de qualquer aba. Explique que a pasta do Drive precisa estar compartilhada como "qualquer pessoa com o link pode ver" para o conteúdo dela aparecer listado.

9. **Volte para a lista de clientes** e mostre o card criado: barra de cor no topo, avatar, nome, @, a linha de status ("Aprovações em dia" ou "N posts aguardando") e os selos **Usa o Cria** ou **Aprova por link**.

10. **Explique os filtros**, logo abaixo da busca "Buscar cliente ou @…": os chips **Todos**, **Usam o Cria**, **Aprovam por link**, **Com pendências**, e depois **Ativos** e **Inativos**.

### O que dizer enquanto mostra
- "Nome. Só. O resto você vai pendurando conforme a relação anda."
- "Essa data de encerramento não é burocracia. É o que impede cliente que já saiu de continuar inflando o seu faturamento na tela de dinheiro."
- "E repara: a cor da aba é a cor do módulo. Bateu o olho, você sabe quais Cria estão trabalhando por esse cliente."

### O momento uau
Digitar só o nome, clicar em Criar e cair direto no cockpit completo do cliente, com brandbook, posts, cronograma, financeiro e radar já esperando. Uns 90 segundos.

### Erros comuns a mencionar
- **Tentar criar cliente sem nome.** O botão fica desabilitado. Não é bug.
- **Colar link de imagem sem http.** O sistema recusa.
- **Colar a pasta do Drive privada.** Ela entra nos links, mas o conteúdo não lista. Precisa ser pública por link.
- **Confundir "Usa o Cria" com "Aprova por link".** O primeiro é cliente com conta própria no CRIA. O segundo só recebe um link, sem cadastro. Os filtros na tela estão no plural ("Usam o Cria") e os selos no card estão no singular ("Usa o Cria"). Não é erro seu.

### Diferenças no mobile
O botão do topo mostra só **Novo**. A tira de abas do cockpit rola para o lado, arrastando. O botão **Links úteis** aparece só com o ícone de pasta.

---

## Aula 3: Do print no WhatsApp ao link de aprovação

**Duração alvo:** 5 minutos

### O gancho
"Áudio de quatro minutos. Print riscado com o dedo. 'Aprovado' que ninguém sabe se foi do post de terça ou de quinta. Você já sabe do que eu tô falando. Nesta aula o cliente vira um link, e o link vira histórico."

### Pré-requisito de gravação
Um cliente com o **Cria Post ativado** e pelo menos 4 posts espalhados nas colunas, sendo um deles com pedido de ajuste do cliente (para mostrar o bloco laranja). Módulo **Cria Post** contratado na conta de demonstração, senão a aba abre com cadeado.

### Passo a passo com o caminho exato

1. **Menu lateral, Clientes.** Clique no card de um cliente. Você cai na **Visão geral** dele.

2. **Clique na aba Cria Post**, a laranja, segunda da fila. Abre uma tela com cards das sub-páginas. Os rótulos são: **Produção**, **Cronograma**, **Kanban do cliente** (esse só aparece se o cliente tiver conta CRIA), **Relatório**, **Materiais** e **Portal**.
   **[DIVERGÊNCIA]** A URL diz `/posts`, mas na tela a sub-página se chama **Produção**. Fale sempre "Produção".

3. **Se o cliente ainda não tem o Cria Post ativado**, a tela mostra "Ative o Cria Post pra este cliente" com o botão **Ativar agora**. Grave esse passo, é a primeira coisa que todo mundo vê.

4. **Entre em Produção.** Leia a linha de explicação que aparece no topo, porque ela é a aula inteira: "De onde vem: as ideias que você aprovou (ou posts criados na mão). Aqui você monta cada post e manda o cliente aprovar por link: Aguardando cliente → Ajuste solicitado → Aprovado."

5. **Mostre as cinco colunas do quadro**, nesta ordem exata: **Em produção**, **Aguardando cliente**, **Ajuste solicitado**, **Aprovado**, **Postado**.

6. **No canto superior direito ficam os botões da barra**: o alternador **Kanban** / **Calendário**, o botão **Link de aprovação** (ícone de corrente), **Importar do kanban** e **Novo post**.

7. **Clique em Link de aprovação.** Abre uma janela com duas opções:
   - **Todos os posts**, com a linha "O cliente vê tudo que está na fila de aprovação." e o botão **Copiar link completo**.
   - **Só um período**, com a linha "Gera um link que mostra apenas os posts agendados nesse intervalo.", os campos **Início** e **Fim**, e o botão **Copiar link do período**.
   Clique em **Copiar link completo**. Toast: "Link de aprovação copiado!".
   **Diga com todas as letras: o link é por CLIENTE, não por post.** Você manda uma vez e ele serve para sempre.

8. **Cole o link numa aba anônima do navegador** e mostre a página que o cliente vê. Ela abre em `/aprovar/{token}`. Sem senha, sem cadastro.
   - No topo: a logo e a cor da marca do cliente, a linha "conteúdo por {seu nome}" e o contador "N de N aprovados".
   - O título "Aprove seus posts" e a linha "Revise o conteúdo e aprove ou peça ajustes."
   - Em cada post, os selos **Aguardando você**, **Ajuste solicitado** ou **Aprovado**.
   - Os botões **Aprovar** e **Ajuste**. Clicando em Ajuste abre o campo "O que você quer ajustar?" e o botão **Enviar ajuste**.

9. **Aprove um post ali, como cliente.** Toast do lado dele: "Aprovado!". Volte para o seu painel e mostre o card andando para a coluna **Aprovado**.

10. **Peça um ajuste, como cliente.** Volte e mostre o card na coluna **Ajuste solicitado**, com o texto "Cliente pediu um ajuste", a prévia do comentário e o link "Abrir pra ver o ajuste completo". Abra e mostre o bloco laranja "O cliente pediu um ajuste" e o **Histórico de aprovação (N)**, que guarda tudo.

11. **Mostre a notificação.** No topo da tela do gestor, o sino. Quando o cliente aprova ou pede ajuste, cai uma notificação com o título "Cliente aprovou um post" ou "Cliente pediu ajuste num post".

12. **Feche mostrando outro atalho do mesmo link:** volte em **Clientes**, e no card do cliente tem um botão quadrado com ícone de corrente. Passe o mouse: o rótulo é **Copiar link de aprovação**. É o mesmo link, para quando você está com pressa.

### O que dizer enquanto mostra
- "O cliente não precisa criar conta, não precisa baixar nada e não precisa de senha. Ele abre no celular e resolve."
- "E o pedido de ajuste dele fica escrito, com data, colado no post. Nunca mais 'eu falei isso no áudio'."
- "Repara nos cards: quando o cliente já viu, aparece 'Visto pelo cliente'. E quando ele tá enrolando, aparece há quantos dias tá parado."

### O momento uau
Aprovar como cliente numa aba, voltar para o painel e ver o card já na coluna Aprovado. Uns 3 minutos.

### Erros comuns a mencionar
- **Procurar um botão "enviar pro cliente".** Ele não existe. **O post nasce em "Em produção" e você arrasta o card para "Aguardando cliente"** quando estiver pronto. O toast ao criar já avisa: "Post criado! Está em produção. Libere pro cliente quando quiser."
- **Arrastar direto para "Aprovado" sem o cliente.** O sistema pergunta: "Avançar sem o cliente aprovar? O cliente ainda não aprovou este post pelo link. Você está movendo manualmente para Aprovado e assume essa decisão." Diga que existe, mas que o registro fica.
- **Mandar link de período e o cliente reclamar que sumiu post.** O link de período só mostra o que está agendado naquele intervalo.
- **Achar que o link é por post.** É por cliente.

### Diferenças no mobile
O botão **Link de aprovação** aparece só com o ícone de corrente, sem texto. O quadro de cinco colunas rola para o lado. Vale gravar 30 segundos abrindo o link no celular, do lado do cliente, porque é assim que ele vai usar.

---

## Aula 4: Monte um post e mande pro cliente

**Duração alvo:** 6 minutos

### O gancho
"Toda semana a mesma novela: você monta o post no Canva, salva o print, escreve a legenda no bloco de notas, manda tudo picado no WhatsApp e reza. Vou te mostrar como isso vira uma tela só e um link só."

### Pré-requisito de gravação
Cliente com Cria Post ativado. Uma arte pronta no computador para subir. Um link de pasta do Drive. Legenda escrita previamente num arquivo, para colar sem gaguejar.

### Passo a passo com o caminho exato

1. **Menu lateral, Clientes**, clique no cliente, aba **Cria Post**, sub-página **Produção**.

2. **Canto superior direito, clique em Novo post.** Abre a janela "Novo post".
   Detalhe importante para você saber ao gravar: assim que você clica, o sistema já cria um rascunho no banco, para liberar o upload de mídia antes de você salvar. Se você fechar com algo preenchido, ele pergunta "Seu post não foi salvo" e oferece **Sair sem salvar** ou **Continuar editando**.

3. **Preencha a coluna da esquerda, na ordem em que os campos aparecem:**
   - **Título ***. É o único obrigatório.
   - **Plataforma**: Instagram, Tiktok ou Youtube.
   - **Formato**: reels, carrossel, foto, story ou vídeo.
   - **Tipo de aprovação**: **Simplificada**, **Detalhada** ou **Ambas**. Leia a linha de apoio, que está escrita na tela: "Simplificada = 1 clique · Detalhada = 4 etapas · Ambas = o cliente escolhe."
   - **Cronograma**, com **Data de publicação** e **Horário**.
   - **Ideia / Referência (link)**, com o apoio "Cole um link de inspiração (Drive, post, Pinterest...)".
   - **Pasta do Drive (link)**, com o apoio "Cole o link da pasta do Drive com os materiais".
   - **Legenda**, com o botão **Copiar legenda** ao lado do rótulo.
   - **Roteiro / copy (carrossel, reels...)**.

4. **Na coluna da direita, suba a arte** no bloco **Mídia**. Ao lado tem o botão **Briefing de arte**.

5. **Clique em Criar post**, no topo da janela. Toast: "Post criado! Está em produção. Libere pro cliente quando quiser."

6. **O card aparece na coluna "Em produção".** Agora o gesto que fecha a aula: **arraste o card de "Em produção" para "Aguardando cliente"**. É esse arrasto que coloca o post na mão do cliente. Grave devagar.

7. **Clique em Link de aprovação** (barra do topo), depois em **Copiar link completo**, e cole numa aba anônima para mostrar como o post ficou do lado do cliente: a arte, a legenda, e os botões **Aprovar** e **Ajuste**.

8. **Volte e mostre o modo Detalhada.** Se você escolheu "Detalhada" ou "Ambas", o cliente aprova em 4 etapas em vez de um clique. Explique em 20 segundos quando usar cada um: cliente pequeno, Simplificada; cliente grande que revisa por partes, Detalhada.

9. **Mostre o alternador Kanban / Calendário**, no topo da Produção. No Calendário, cada dia tem um **+** para criar post naquele dia direto.

10. **Feche mostrando a sub-página Portal** (aba Cria Post, card Portal). É onde você personaliza o que o cliente vê: a linha "É esta página que o cliente abre. Sem senha, sem cadastro." e os botões **Copiar link** e **Abrir**. Ali você também liga as abas extras que o cliente enxerga: **Aprovações**, **Calendário** e **Relatório**.

### O que dizer enquanto mostra
- "Título é o único campo obrigatório. Todo o resto você preenche na medida do que aquele cliente exige."
- "Repara nesse arrasto. É ele que muda a bola de campo: saiu de você, foi pro cliente."
- "E se o cliente é dos que revisa cada vírgula, você liga a aprovação detalhada e ele te devolve etapa por etapa, em vez de um 'não gostei' seco."

### O momento uau
O arrasto do card de "Em produção" para "Aguardando cliente", seguido do corte para a tela do cliente já mostrando o post. Uns 4 minutos.

### Erros comuns a mencionar
- **Esperar um botão de enviar.** Não tem. É o arrasto.
- **Criar o post e fechar a janela antes de salvar.** Sai o aviso "Seu post não foi salvo".
- **Achar que o CRIA posta.** Não posta. O post aprovado você publica no app do Instagram, como sempre.
- **Deixar a mídia só no Drive e mandar pro cliente.** Se o link do Drive não for público, o cliente abre e não vê a arte.
- **Módulo Cria Post não contratado.** A aba fica com cadeado e o botão "Ativar agora" abre a vitrine em vez de ativar.

### Diferenças no mobile
A janela do post empilha as duas colunas: campos primeiro, mídia depois. O quadro de cinco colunas rola para o lado. O arrasto entre colunas no celular é mais chato que no desktop, então mostre também que dá para abrir o post e mudar o status por dentro.

---

## Aula 5: O relatório do mês em 1 clique

**Duração alvo:** 4 a 5 minutos

### O gancho
"Fim do mês. O cliente pergunta 'e aí, funcionou?'. E você abre o Instagram, tira print de seis telas, monta um slide no Canva e perde a tarde. Isso aqui resolve em um clique e sai em PDF com a cara do seu cliente."

### Pré-requisito de gravação
Esse é o roteiro mais sensível da trilha, porque a tela vem vazia com facilidade. Antes de gravar, garanta as quatro coisas:
1. **Posts criados dentro do período** que você vai escolher. O filtro é pela data de criação do post. Sem posts no período, aparece "Nenhum post nesse período."
2. **O cliente vinculado ao cadastro central** (o campo do CRM). Sem esse vínculo, a seção de desempenho do Instagram nem carrega.
3. **O Instagram do cliente conectado e sincronizado.** As métricas vêm da conta dele, não da sua.
4. Telefone e e-mail preenchidos na ficha, para os botões de WhatsApp e e-mail funcionarem.

### Passo a passo com o caminho exato

1. **Menu lateral, Clientes**, clique no cliente, aba **Cria Post**.

2. **Na tela de cards, clique em Relatório.** A descrição do card é "O resultado white-label do mês pra enviar pro cliente."

3. **A tela mostra o card "Relatório mensal do cliente"**, com a linha "Produção, desempenho do Instagram e análise da IA, pronto pra enviar em PDF." e o botão **Abrir relatório**. Clique.

4. **Abre a janela "Relatório do cliente".** No topo fica **Período:** com os chips: **Últimos 7 dias**, **Últimos 30 dias**, o mês passado, **Este mês** e os cinco meses anteriores. Escolha um mês fechado.

5. **Repare no aviso que aparece logo abaixo.** Se o cliente está vinculado ao cadastro central, ele diz: "✨ A análise da IA vai usar a persona e o segmento do cadastro central deste cliente." Se não está, ele diz: "Dica: vincule este cliente ao cadastro central (no cadastro do Cria Post) pra uma análise mais rica." Mostre os dois estados, se der.

6. **Role o relatório e mostre as seções**: a produção do mês (quantos posts, por formato, por plataforma), o bloco **Desempenho no Instagram**, o ranking, a audiência, os stories e, no fim, o campo de **análise do mês**.

7. **O campo de análise vem vazio.** O texto de apoio dele é: "Escreva a análise ou clique em 'Gerar análise (IA)'. Você pode formatar com a barra acima." Acima do campo tem a barra **Formatar análise:** com negrito, itálico e listas.

8. **No rodapé da janela, clique em Gerar análise (IA).** Ele vira **Analisando…**. Espere e leia o resultado em voz alta. Edite uma frase ao vivo, para provar que dá.

9. **Clique em Baixar PDF** (rodapé, à direita). Ele vira **Gerando…** e o arquivo sai com o nome no formato `relatorio-{cliente}-{periodo}`. Abra o PDF na tela.

10. **Mostre as três formas de mandar**, também no rodapé: copiar link (o PDF vai para um armazenamento privado e o link assinado vale 30 dias), WhatsApp e e-mail.

11. **Feche lembrando do Portal.** Se você ligou a aba **Relatório** na sub-página **Portal**, o cliente vê o relatório dentro do próprio link de aprovação, sem você mandar nada.

### O que dizer enquanto mostra
- "Isso aqui é white-label. Sai com a cara do cliente, não com a minha."
- "A análise da IA não é pra você mandar crua. É pra você não olhar pra folha em branco. Lê, corta o que não bate e assina embaixo."
- "E o link do PDF vale 30 dias. Depois disso ele expira sozinho, o que é bom: relatório de cliente não fica solto na internet pra sempre."

### O momento uau
O PDF pronto abrindo na tela, com produção, gráficos do Instagram e análise escrita, uns 3 minutos e meio.

### Erros comuns a mencionar
- **Relatório vazio.** Quase sempre é uma destas três: nenhum post criado naquele período, cliente não vinculado ao cadastro central, ou Instagram do cliente não conectado. Diga as três, nessa ordem, é o suporte que você economiza.
- **Clicar em Baixar PDF sem escrever a análise.** Ela sai em branco no PDF. Sempre gere ou escreva antes.
- **Confundir o Instagram do cliente com o seu.** As métricas vêm da conta dele.
- **Mandar o link do PDF e esquecer que ele expira.** Se o cliente reclamar meses depois, é só gerar de novo.

### Diferenças no mobile
A janela do relatório rola bastante no celular. O botão **Baixar PDF** funciona, mas o arquivo cai na pasta de downloads do telefone. Se o objetivo é mandar por WhatsApp, use o botão de WhatsApp direto, é menos passo.

---

## Aula 6: Sua segunda-feira no CRIA

**Duração alvo:** 5 minutos

### O gancho
"Segunda de manhã. Cinco clientes, três grupos de WhatsApp piscando e você sem saber por onde começar. Essa aula não é sobre um recurso. É sobre uma rotina de vinte minutos que faz a semana inteira andar."

### Pré-requisito de gravação
O estado da conta importa mais que em qualquer outra aula. Prepare:
- Pelo menos 3 aprovações pendentes, uma delas parada há vários dias.
- Um post na coluna **Ajuste solicitado**.
- Posts na agenda espalhados pela semana, de clientes diferentes, com cores diferentes.
- Um post em produção **sem data**, para a faixa de cima da agenda aparecer.
- Pelo menos um cliente com a bolinha de saúde amarela ou vermelha.

### Passo a passo com o caminho exato

**A rotina tem quatro paradas, nesta ordem. Grave nesta ordem.**

1. **Parada 1: o Início.** Menu lateral, **Início**. Ou o primeiro ícone da barra de baixo, no celular.
   - Olhe o alarme da faixa do topo, que diz "N posts aguardando o cliente" ou "Nada travado por aqui".
   - Olhe os quatro números: **clientes ativos**, **previsto neste mês**, **posts esperando o cliente**, **a sua semana**.
   - Role até **Seus clientes** e mostre a bolinha de saúde ao lado de cada nome: verde é tudo em dia, amarelo pede atenção, vermelho é urgente. O motivo vem escrito logo abaixo.
   - Se existir, use o botão **Continuar de onde parou**, no topo à direita, que te devolve pro último cliente que você abriu.
   - Role até o fim e mostre o bloco **Sua operação hoje**, com as etiquetas **Urgente**, **Atenção** e **No radar**.

2. **Parada 2: Aprovações.** Menu lateral, grupo Dia a dia, **Aprovações**. No celular é o quarto ícone, escrito **Aprov.**
   - No topo, os quatro cards de pendência. Explique cada um: **Cria Post** é o que o cliente aprova pelo link; **Cronogramas** são os planejamentos que você mandou e ele não respondeu; **Conteúdo de clientes** é post que quem tem conta CRIA montou e espera a sua revisão; **Materiais** são pedidos que o cliente te fez.
   - Clique num card. Ele filtra a lista de baixo só naquele tipo. As pílulas logo abaixo fazem o mesmo filtro.
   - Explique a leitura da lista: ela vem do mais novo para o mais velho, então **o fim da lista é o que está parado há mais tempo**. É ali que mora a cobrança de hoje. Role até o fim e mostre.
   - Aponte a etiqueta laranja **Ajuste**: quando ela aparece, a bola está com **você**, não com o cliente.
   - Clique numa linha e mostre que ela te leva direto pra tela onde se resolve.

3. **Parada 3: Agenda.** Menu lateral, **Agenda**. No celular é o terceiro ícone.
   - Cada coluna é um dia. Os posts de todos os clientes aparecem juntos, cada um com a cor do seu cliente.
   - Mostre os filtros por tipo. A agenda junta cinco coisas: **Criações**, **Tarefas**, **Captações**, **Posts** e **Cria do cliente**. Desligue duas e mostre o quadro limpando.
   - Mostre o alternador **Semana** / **Mês** e o botão **Hoje**. Diga: semana é para executar, mês é para planejar.
   - **Mostre o arrasto certo.** Para mover um card você tem que pegar pelo punho, o ícone de seis pontinhos no canto esquerdo do card. Clicar no card abre o post, arrastar é só pelo punho. Esse detalhe economiza muito suporte.
   - Se houver post em produção sem data, ele aparece numa faixa no topo. Arraste um dali para um dia da semana e mostre a data sendo marcada de verdade.
   - Mostre também as **Captações**, que é o dia de gravação com hora, local, equipe e cliente.

4. **Parada 4: os clientes que a saúde apontou.** Volte no Início, clique num cliente com bolinha amarela ou vermelha e resolva o que ela apontou.

5. **Feche amarrando a rotina em uma frase**, e repita ela devagar: "Início pra saber o tamanho do problema. Aprovações pra cobrar quem tá te travando. Agenda pra montar o dia. Cliente pra resolver o que tá vermelho."

### O que dizer enquanto mostra
- "Vinte minutos. Não é gestão de tempo, é ordem de leitura. O erro é abrir o WhatsApp primeiro."
- "Repara nessa etiqueta laranja: quando ela aparece, não adianta cobrar o cliente. A bola tá comigo."
- "E o fim dessa lista é o mais importante da sua segunda-feira. É o cliente que tá sentado num post há cinco dias e vai reclamar na sexta."

### O momento uau
Descer a lista de Aprovações até o fim e encontrar o post parado há mais tempo. É um gesto simples que muda o comportamento de quem assiste. Uns 2 minutos e meio.

### Erros comuns a mencionar
- **Tentar arrastar o card da agenda pelo meio.** Não funciona. Tem que ser pelo punho de seis pontinhos.
- **Achar que o card verde da agenda ("Cria do cliente") é editável.** Ele é só leitura. Clicar leva para o quadro do cliente.
- **Começar a segunda pelo WhatsApp.** Diga isso com todas as letras, é o hábito que a aula quer quebrar.
- **Confundir "Aprovações" com a coluna "Aguardando cliente".** A central junta quatro filas diferentes, não só o Cria Post.

### Diferenças no mobile
As quatro paradas dessa rotina são exatamente os quatro ícones fixos da barra de baixo: **Início**, **Clientes**, **Agenda** e **Aprov.** Diga isso na aula, é o melhor argumento de que a rotina foi desenhada para o celular. Na agenda, os dias rolam para o lado. O arrasto pelo punho funciona no celular, mas exige segurar um instante antes.

---

# Anexo: divergências e riscos de gravação

Resumo do que não bate entre a estrutura planejada e o produto real, para o Walter decidir antes de gravar.

### Bloqueiam ou mudam uma aula

| # | Onde | O que está diferente | O que fazer |
|---|---|---|---|
| 1 | Todas | Google Calendar está **desligado** no código (`useGoogleCalendar.ts:92`). | Não citar Google Calendar em aula nenhuma. "Agendado" é só coluna com data. |
| 2 | Social mídia, aula 1 | A conta de social mídia **não é grátis**: o cadastro cai em `/comecar-agencia` e exige checkout do plano de agência com assentos. | Renomear a aula para "O que a sua conta já inclui (e o que é módulo separado)". Roteiro já ajustado. |
| 3 | Criador, aula 5 | **Cria Plano não existe no menu lateral do desktop.** Só no menu do celular, ou pela URL `/app/autopilot`. | Gravar pelo celular, ou avisar do caminho pela URL. Vale corrigir o menu antes. |
| 4 | Criador, aula 5 | Os posts gerados chegam na coluna **Ideia**, não em "Agendado", mesmo com data e hora. | Dizer "caem na primeira coluna, já com data". |
| 5 | Social mídia, aulas 3 e 4 | **Não existe botão "enviar pro cliente".** O post nasce em "Em produção" e você **arrasta** para "Aguardando cliente". | O arrasto é o gesto central das duas aulas. |
| 6 | Social mídia, aula 3 | O **link de aprovação é por cliente**, não por post. | Falar isso explicitamente, é a confusão mais comum. |

### Nomes de tela que não batem com o esperado

| Onde | Esperado | Real |
|---|---|---|
| Brandbook | seis abas Identidade / Visual / Comunicação / Público-alvo / Valores / Tom de Voz | esses seis são **cards do hub**. As **abas** são Visão Geral, Moodboard, Linha Editorial, Persona, Tom de Voz, Identidade |
| Brandbook | "Importar de PDF" abre modal | ele **rola a página** até o bloco na aba Visão Geral |
| Brandbook, revisão | botão "Aplicar" ou "Salvar" | os botões são **Descartar** e **Salvar no brandbook** |
| Editor de post | "Avaliar gancho" | o botão é **Avaliar legenda**; "Nota de gancho" é o rótulo do resultado |
| Editor de post | botão "Copiar legenda" na aba Legenda | **não existe** |
| Criando, desktop | botão "Filtros" | no desktop os filtros ficam **todos expostos** na barra; o botão "Filtros" só existe no celular |
| Criando, celular | alternador Board / Tabela / Calendário | **não existe no celular**, só o Board |
| Dashboard | "Primeiros passos" | o título é **"Primeiros passos no Cria"**, e o painel **some** quando você conclui os 6 ou dispensa |
| Cockpit do cliente | sub-página "Posts" | na tela ela se chama **Produção** (a URL é que é `/posts`) |
| Clientes, filtros | "Usa o Cria" / "Aprova por link" | os **filtros** estão no plural ("Usam o Cria"), os **selos do card** no singular |

### Telas que podem aparecer vazias e estragar a gravação

- **Tendências** e **Cria Stories**: dependem de curadoria. Confira o conteúdo no dia da gravação.
- **Aprender**: os três cards estão com selo "Em breve · Exclusivo", sem conteúdo. Não gravar.
- **Relatório do cliente**: vem vazio se faltar posts no período, vínculo com o cadastro central ou Instagram do cliente conectado. Checklist está no roteiro da aula 5 de social mídia.
- **Insights**: o gráfico de seguidores só preenche com o tempo. Antes de 30 dias de conta conectada, ele mostra a mensagem explicando que ainda está acumulando.
- **Cria Plano, botão "Da minha conta"**: fica desabilitado até a conta ter pelo menos 4 posts com horário preenchido.

### Bugs pequenos que vale corrigir antes de gravar

1. **Checklist "Primeiros passos no Cria"**: o item "Conectar meu Instagram" marca como concluído com base no campo de texto do @ na aba Perfil, não na conexão real (`FirstStepsPanel.tsx:49`). Dá para aparecer riscado sem a conta estar conectada.
2. **Cards de módulo do dashboard do gestor**: saem todos laranja, porque o mapa de cor é indexado por segmento de rota e a home consulta por código de módulo (`ManagerHome.tsx:249` contra `moduleTheme.ts:31`). No menu lateral a cor está certa.
3. **FAQ antigo do site** (`src/lib/locales/pt.ts:194`) diz que o sistema publica automaticamente. É falso e contradiz todo o resto do produto. Vale corrigir o texto, além de nunca citar em aula.
4. **Nenhum agendamento automático de sincronização de métricas do Instagram** foi encontrado no repositório (só o de renovação de token, diário). Na dúvida, ensine "toque em Atualizar quando quiser os números mais recentes".
5. **Mover salvo de pasta** (aba Salvos) usa o pop-up nativo do navegador. Funciona, mas destoa do resto do produto.
