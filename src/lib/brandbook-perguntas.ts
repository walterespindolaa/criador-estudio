/* ═══════════════════════════════════════════════════════════════════════════
   AS PERGUNTAS GUIADAS DO BRANDBOOK

   Este catálogo morava dentro de pages/app/Brandbook.tsx, que é a tela onde o
   CRIADOR responde. Só que quem lê as respostas não é só ele: a social mídia lê
   o brandbook do cliente dela na ficha do CRM, e lá as respostas apareciam como
   frases soltas, sem a pergunta que as gerou. "Sim, principalmente à noite" não
   quer dizer nada sozinho.

   Então o catálogo saiu da tela e virou biblioteca: uma fonte só, lida pelos
   dois lados. Editar a pergunta aqui muda o formulário do criador E a leitura
   da social mídia, que é o que evita as duas versões divergirem com o tempo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const QUESTION_SECTIONS = {
  "moodboard-identidade": {
    title: "Identidade e Sensações",
    questions: [
      { key: "sensacoes", label: "Que sensação sua marca transmite?", placeholder: "Ex: Acolhimento, leveza, sofisticação acessível..." },
      { key: "palavras-chave", label: "Palavras-chave que definem sua essência?", placeholder: "Ex: Autenticidade, liberdade, conexão..." },
      { key: "se-fosse", label: "Se sua marca fosse uma pessoa, como seria?", placeholder: "Ex: Uma amiga próxima que entende de moda e te acolhe..." },
    ],
  },
  "moodboard-visual": {
    title: "Visual e Estilo",
    questions: [
      { key: "cores", label: "Que cores representam sua marca?", placeholder: "Ex: Tons terrosos, nude, laranja queimado..." },
      { key: "estetica", label: "Qual é a estética visual?", placeholder: "Ex: Clean, minimalista com toques orgânicos..." },
      { key: "referencias-visuais", label: "Referências visuais que te inspiram?", placeholder: "Ex: Pinterest boards, marcas, artistas..." },
    ],
  },
  "moodboard-contexto": {
    title: "Contexto e Propósito",
    questions: [
      { key: "por-que", label: "Por que você cria conteúdo?", placeholder: "Ex: Para ajudar mulheres a se sentirem bonitas..." },
      { key: "diferencial", label: "O que te diferencia de outros criadores?", placeholder: "Ex: Minha abordagem é real e acessível..." },
      { key: "legado", label: "Que impacto você quer causar?", placeholder: "Ex: Que as pessoas se aceitem como são..." },
    ],
  },
  "moodboard-inspiracoes": {
    title: "Inspirações Pessoais",
    questions: [
      { key: "criadores", label: "Criadores que te inspiram?", placeholder: "Ex: Nath Finanças, Boca Rosa, Whindersson..." },
      { key: "marcas", label: "Marcas que admira?", placeholder: "Ex: Pantys, Farm, Glossier..." },
      { key: "conteudos", label: "Conteúdos que te marcaram?", placeholder: "Ex: Um vídeo, uma frase, um podcast..." },
    ],
  },
  "visao-de-mundo": {
    title: "Visão de Mundo",
    questions: [
      { key: "verdade-pouco-dita", label: "Que verdade você acredita que poucas pessoas do seu nicho falam?", placeholder: "Ex: Que estilo não tem a ver com dinheiro, é repertório e intenção..." },
      { key: "crenca-a-quebrar", label: "Que crença você quer quebrar no seu público?", placeholder: "Ex: A ideia de que 'corpo bonito é só um tipo de corpo'..." },
      { key: "incomodo-mercado", label: "Que comportamento do mercado mais te incomoda?", placeholder: "Ex: Vender insegurança disfarçada de solução, copy genérico, promessa milagrosa..." },
    ],
  },
  "sobre-voce": {
    title: "Sobre Você",
    questions: [
      { key: "comeco", label: "O que fez você querer começar a criar conteúdo?", placeholder: "Ex: Cansei de não me ver representada e percebi que outras mulheres sentiam o mesmo..." },
      { key: "conflito", label: "Que conflito você viveu que hoje quer ajudar outras pessoas?", placeholder: "Ex: Passei anos achando que era 'sem estilo' porque não cabia no padrão..." },
      { key: "meta", label: "Onde você quer chegar? Qual é sua meta com a criação de conteúdo?", placeholder: "Ex: Construir uma comunidade de 100 mil mulheres se sentindo bem com elas mesmas..." },
    ],
  },
  "linha-editorial": {
    title: "Linha Editorial",
    questions: [
      { key: "ideia-central", label: "Qual é a ideia central do seu conteúdo?", placeholder: "Ex: Ajudar mulheres a se reconectarem com sua autoestima através de moda acessível." },
      { key: "temas", label: "Quais temas você aborda?", placeholder: "Ex: Moda consciente, autoestima, estilo pessoal, compras inteligentes..." },
      { key: "transformacao", label: "Que transformação você promove?", placeholder: "Ex: De insegura com o visual → confiante e autêntica no dia a dia." },
      { key: "tipos-conteudo", label: "Que tipos de conteúdo você cria?", placeholder: "Ex: Dicas rápidas, bastidores, tutoriais, storytelling pessoal..." },
      { key: "lema", label: "Qual é o seu lema ou frase-guia?", placeholder: "Ex: 'Vista quem você é, não quem esperam que você seja.'" },
    ],
    chatPrompt: `Você é um estrategista de conteúdo digital. Com base nas respostas abaixo sobre a linha editorial de um criador de conteúdo, gere um guia editorial completo e prático.

Inclua:
1. Resumo da linha editorial (2-3 frases)
2. Pilares temáticos sugeridos (3-5)
3. Tipos de conteúdo recomendados para cada pilar
4. Tom de comunicação ideal
5. Frequência sugerida
6. Dica de diferenciação

RESPOSTAS DO CRIADOR:
`,
  },
  "persona-brand": {
    title: "Persona, Perguntas Guiadas",
    questions: [
      { key: "quem-e", label: "Quem é a pessoa que te segue?", placeholder: "Ex: Mulher, 25-35 anos, mora em cidade grande, trabalha com CLT mas sonha em empreender." },
      { key: "dores", label: "Quais são as dores dela?", placeholder: "Ex: Sente que não tem estilo próprio, gasta mal com roupas, não se sente bonita no dia a dia." },
      { key: "desejos", label: "O que ela deseja conquistar?", placeholder: "Ex: Se sentir confiante, montar looks sem esforço, ser elogiada pelo estilo." },
      { key: "crencas", label: "Quais crenças ela carrega?", placeholder: "Ex: 'Moda é pra quem tem dinheiro', 'Eu não tenho corpo pra isso', 'Estilo é dom'." },
      { key: "comportamento", label: "Como ela se comporta online?", placeholder: "Ex: Salva muito conteúdo, comenta pouco, assiste stories até o final, compra por impulso." },
    ],
    chatPrompt: `Você é especialista em marketing de conteúdo e criação de personas. Com base nas respostas abaixo, crie uma persona completa e detalhada.

Inclua:
1. Nome fictício e mini bio
2. Demografia (idade, localização, profissão)
3. Dores principais (com exemplos reais)
4. Desejos profundos
5. Crenças limitantes
6. Comportamento digital
7. Gatilhos de compra
8. Tipo de conteúdo que mais engaja essa persona
9. Linguagem que conecta com ela

RESPOSTAS DO CRIADOR:
`,
  },
  "tom-de-voz": {
    title: "Tom de Voz",
    questions: [
      { key: "estilo", label: "Qual é o seu estilo de comunicação?", placeholder: "Ex: Leve e acolhedora, como uma conversa com amiga. Direto mas sem ser frio." },
      { key: "palavras", label: "Que palavras/expressões você usa muito?", placeholder: "Ex: 'Bora?', 'Olha que incrível', 'Vem comigo', 'Isso é real'..." },
      { key: "evitar", label: "O que você evita na comunicação?", placeholder: "Ex: Gírias muito jovens, tom de vendedor, linguagem técnica demais, negatividade." },
      { key: "referencias", label: "Quais criadores inspiram seu tom?", placeholder: "Ex: Nath Finanças (didática), Boca Rosa (autêntica), Whindersson (humor leve)." },
      { key: "emocao", label: "Que emoção você quer despertar?", placeholder: "Ex: Pertencimento, confiança, leveza, motivação gentil." },
    ],
    chatPrompt: `Você é um copywriter e estrategista de marca pessoal. Com base nas respostas abaixo, crie um guia completo de tom de voz para um criador de conteúdo.

Inclua:
1. Resumo do tom (2-3 frases)
2. Adjetivos que definem a comunicação (5-7)
3. Expressões e vocabulário recomendado
4. O que evitar (linguagem, tom, palavras)
5. Exemplos práticos de legendas no tom certo (3 exemplos)
6. Como adaptar o tom para diferentes formatos (stories, reels, legendas)
7. Referências de inspiração

RESPOSTAS DO CRIADOR:
`,
  },
} as const;

export type QuestionSectionKey = keyof typeof QUESTION_SECTIONS;

/** question_key -> rótulo da pergunta. É o que devolve o contexto a uma
 *  resposta guardada, em qualquer tela que só tenha a resposta na mão. */
export const LABEL_DA_PERGUNTA: Record<string, string> = Object.fromEntries(
  Object.values(QUESTION_SECTIONS).flatMap((sec) =>
    sec.questions.map((q) => [q.key, q.label] as const),
  ),
);
