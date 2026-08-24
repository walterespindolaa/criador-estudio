# Plano editorial do blog do CRIA

Documento de trabalho. Atualize quando uma pauta sair ou entrar.

## 1. O que esse blog está tentando conseguir

Duas coisas ao mesmo tempo, e elas se reforçam:

1. **Ranquear no Google** em buscas que quem vive de conteúdo faz de verdade
   ("quanto cobrar pra gerenciar redes sociais", "como aprovar post com cliente",
   "o que postar quando não tenho ideia").
2. **Ser citado por IA** (ChatGPT, Gemini, Perplexity, Claude) quando alguém
   pergunta como resolver essas mesmas situações. Modelo não cita quem escreve
   bonito, cita quem responde direto, com estrutura clara e informação
   verificável.

As duas dependem da mesma coisa: texto que responde a pergunta logo no começo,
com título que é a pergunta, subtítulos que são as etapas e um trecho curto e
completo que dá pra citar sem contexto.

## 2. A ideia central: uma situação, uma ferramenta

Cada post da série principal segue a mesma espinha:

**situação concreta → por que ela acontece → como resolver (passo a passo) →
como o CRIA faz isso → checklist.**

O CRIA entra depois da solução, nunca antes. Se o texto só faz sentido pra quem
já usa o produto, ele falhou. A pessoa precisa conseguir resolver o problema
lendo o post, e sair com a impressão de que resolver com o CRIA dá menos trabalho.

## 3. As quatro trilhas

| Trilha | Pra quem | Papel |
| --- | --- | --- |
| Uma situação, uma ferramenta | os dois públicos | série semanal principal, puxa módulo |
| Rotina de social media | gestor de clientes | conteúdo grande de busca (preço, contrato, relatório) |
| Ofício de criador | criador solo | ideia, roteiro, constância, algoritmo |
| Dados e tendências | os dois | o que mudou nas redes, formatos, comportamento |

## 4. Mapa de palavras-chave

Sem número de volume inventado. A classificação abaixo é por **intenção** e por
**distância da venda**, que é o que decide a ordem de produção.

### Alta intenção (a pessoa está com o problema agora)

| Busca | Público | Módulo que entra no texto |
| --- | --- | --- |
| quanto cobrar para gerenciar redes sociais | social media | Cria Caixa, Cria Gestão |
| como fazer aprovação de post com cliente | social media | Cria Post |
| contrato de social media modelo | social media | Cria Gestão |
| relatório de redes sociais para cliente | social media | Cria Radar, relatório white-label |
| planilha de controle financeiro para freelancer | social media | Cria Caixa |
| proposta comercial social media | social media | Cria Gestão |
| como organizar conteúdo de vários clientes | social media | Cria Post, agenda |

### Média intenção (a pessoa busca método)

| Busca | Público | Módulo |
| --- | --- | --- |
| calendário editorial como montar | os dois | agenda de criação |
| banco de ideias de conteúdo | criador | banco de ideias |
| roteiro para reels | criador | escrita guiada, Cria Prompter |
| como analisar métricas do instagram | os dois | insights |
| planejamento de stories semanal | criador | Cria Stories |
| mídia kit o que colocar | criador | mídia kit |
| como manter constância postando | criador | plano semanal |

### Topo (a pessoa ainda está entendendo o assunto)

| Busca | Público |
| --- | --- |
| o que faz um social media | social media |
| como começar como social media | social media |
| quantos posts postar por semana | os dois |
| melhor horário para postar no instagram | os dois |
| como o algoritmo do instagram funciona | os dois |

### Comparação e marca (pra depois do post 12)

`cria social club é bom`, `alternativa ao [ferramenta gringa] em português`,
`ferramenta de aprovação de post em português`, `sistema para social media brasileiro`.

Esse grupo converte muito, mas só faz sentido quando já existir volume de busca
pela marca. Deixe pra segunda leva.

## 5. Calendário das 12 primeiras semanas

Publicação toda **terça-feira**, alternando público.

**Os 12 posts abaixo já estão escritos** e estão em `blog/posts/`, cada um com a
data do calendário no front matter. O gerador segura post com data futura, então
eles entram no ar sozinhos no dia certo, sem ninguém precisar escrever nada. O
que falta em cada semana é só rodar o build e dar o push.

| # | Data | Trilha | Pauta | Palavra-chave | Módulo |
| --- | --- | --- | --- | --- | --- |
| 0 | publicado | situação | Aprovação de post com cliente: como sair do vai e volta no WhatsApp | aprovação de post com cliente | Cria Post |
| 0 | publicado | situação | Deu branco na hora de gravar: banco de ideias que não seca | banco de ideias de conteúdo | banco de ideias |
| 0 | publicado | rotina | Quanto cobrar pra gerenciar redes sociais | quanto cobrar redes sociais | Cria Caixa |
| 1 | 01/09 | situação | O cliente pediu o relatório do mês e você abriu o Canva às 23h | relatório de redes sociais para cliente | Cria Radar |
| 2 | 08/09 | ofício | Você postou 4 vezes essa semana e não lembra por quê: como montar calendário editorial | calendário editorial | agenda de criação |
| 3 | 15/09 | situação | Fechou o mês e não sabe se sobrou: separar dinheiro do cliente do seu | controle financeiro freelancer | Cria Caixa |
| 4 | 22/09 | ofício | Gravou 12 takes porque esqueceu a fala: roteiro que você lê olhando pra câmera | roteiro para reels | Cria Prompter |
| 5 | 29/09 | rotina | O cliente sumiu depois da proposta: follow-up sem parecer insistente | proposta comercial social media | Cria Gestão |
| 6 | 06/10 | dados | O que os números do Instagram realmente dizem (e quais ignorar) | métricas do instagram | insights |
| 7 | 13/10 | situação | Cliente novo entrou e você não sabe por onde começar: briefing em 1 reunião | briefing de social media | Cria Gestão |
| 8 | 20/10 | ofício | Segunda-feira e o perfil está parado: 3 semanas de conteúdo em uma tarde | como manter constância | plano semanal |
| 9 | 27/10 | rotina | Contrato de social media: as 7 cláusulas que evitam dor de cabeça | contrato social media modelo | Cria Gestão |
| 10 | 03/11 | situação | Precisa mostrar seu trabalho pra fechar cliente: mídia kit que responde antes da pergunta | mídia kit social media | mídia kit |
| 11 | 10/11 | dados | Concorrente do seu cliente cresceu e ele te perguntou por quê | análise de concorrentes instagram | Cria Radar |
| 12 | 17/11 | ofício | Você grava bem e ninguém assiste: os 3 primeiros segundos | gancho para reels | escrita guiada |

Depois da semana 12, revise o que trouxe tráfego antes de encomendar as próximas
doze. Post que rendeu se atualiza, não se abandona.

## 6. Como cada post é montado pra IA citar

- **Título é a pergunta ou a situação**, com a palavra-chave na forma que a pessoa digita.
- **Bloco "Resposta rápida" no topo**, de 50 a 80 palavras, autossuficiente. É o
  trecho que aparece em resposta de IA e em trecho destacado do Google.
- **Subtítulos como etapas**, não como enfeite. "Passo 3: estime o que aquele
  cliente consome" é citável. "Indo além" não é.
- **FAQ no fim**, com pergunta escrita do jeito que se pergunta, e resposta que
  começa respondendo. Isso vira `FAQPage` no schema automaticamente.
- **Schema em toda página**: `BlogPosting`, `BreadcrumbList` e, quando houver FAQ,
  `FAQPage`.
- **`llms.txt` na raiz**, com o resumo do que o CRIA é e a lista de textos. É o
  arquivo que alguns rastreadores de IA leem pra entender o site inteiro.
- **`robots.txt` liberando GPTBot, ClaudeBot, PerplexityBot e Google-Extended**.
  Bloquear rastreador de IA hoje é abrir mão de aparecer nas respostas.
- **Datas visíveis** e `dateModified` atualizado quando o post for revisado.
  Conteúdo com data recente é citado com mais frequência.

## 7. Rotina semanal sugerida

Duas horas por semana, divididas assim:

| Momento | O que fazer |
| --- | --- |
| Segunda, 30 min | escolher a pauta da semana seguinte e escrever a resposta rápida e o FAQ |
| Terça, 60 min | escrever o corpo, rodar `node blog/build.mjs`, revisar e publicar |
| Sexta, 30 min | olhar o Search Console: que busca trouxe clique, que post caiu |

O que não pode é acumular. Blog que publica quinzenal por dois meses e some por
três não ranqueia, porque o buscador aprende a frequência do site.

## 8. Fora do blog, mas parte do mesmo trabalho

- **Search Console e Analytics** configurados no domínio raiz, com o sitemap
  enviado (`https://criasocialclub.com.br/sitemap.xml`).
- **Cada post vira 1 carrossel e 1 reels** no perfil do CRIA. O texto já está
  escrito, é só cortar.
- **Link interno**: toda página da LP que fala de um módulo deve linkar o post da
  situação correspondente, e vice-versa. É esse cruzamento que faz o Google
  entender que o site tem autoridade sobre o assunto.
- **Página de comparação** ("CRIA ou planilha", "CRIA ou Trello pra social media")
  quando houver movimento de busca pela marca.
