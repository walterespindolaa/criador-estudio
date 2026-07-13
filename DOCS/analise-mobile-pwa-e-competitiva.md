# CRIA · Análise de PWA/mobile + posicionamento competitivo
Julho/2026

---

# PARTE 1 · O que Trello, Notion e afins fazem no mobile que o CRIA ainda não faz

## 1.1 O buraco grande: seu Service Worker não guarda nada

O `public/sw.js` tem `install`, `activate`, `push` e `notificationclick`. **Não tem `fetch`.**

Consequência prática: toda vez que a pessoa abre o CRIA, o navegador vai à rede buscar o HTML, o JS, o CSS, as fontes e os dados. No 4G ruim de um Uber, isso é 3–6 segundos de tela branca. O Trello abre em ~300ms porque o app-shell está no cache do SW e a tela pinta **antes** da rede responder.

**O que fazer:** trocar o `sw.js` artesanal por `vite-plugin-pwa` (Workbox), mantendo os handlers de push que você já tem (`injectManifest`, não `generateSW`, senão você perde o push).

- Precache do build (JS/CSS/fontes) → abre offline.
- `StaleWhileRevalidate` pras imagens do Supabase Storage e do CDN do Instagram.
- `NetworkFirst` com timeout de 3s pras chamadas do Supabase → se a rede demorar, serve o cache e revalida.

Ganho: abertura instantânea, e o app **abre mesmo sem internet**.

## 1.2 O cache do react-query morre no refresh

Você já configurou `gcTime: 1000*60*60*24` e `refetchOnMount: false`. Isso vale só enquanto a aba está viva. Fechou o PWA, perdeu tudo.

**O que fazer:** `@tanstack/query-persist-client-core` + `idb-keyval` (IndexedDB). O app volta com os dados da última sessão pintados na tela e revalida por baixo. É exatamente a sensação "o Trello já está lá quando eu abro".

## 1.3 Offline de verdade: a fila de mutações

Este é o truque do Trello que ninguém copia. Você arrasta um card no metrô, sem sinal, e ele **fica movido**. Quando o sinal volta, ele sincroniza sozinho.

Você já tem metade do caminho: os `onMutate` otimistas. Falta:

- `onlineManager` do react-query (já vem, só precisa ligar).
- `persistQueryClient` com `persistMutations` + `defaultMutationOptions` com `mutationKey` nomeada, pra que a mutação possa ser **retomada** depois do restart.
- Um badge discreto "3 alterações pendentes de sincronizar".

Sem isso, hoje: sem sinal, o card volta pro lugar e a pessoa perde a alteração. Com isso, o CRIA passa a ser usável na rua — que é onde o social media vive.

## 1.4 O manifest está desatualizado e incompleto

O que está lá hoje:

```json
"theme_color": "#8B5CF6",       // roxo — não existe mais na identidade
"background_color": "#FAF8F4",  // creme — você acabou de migrar pra base branca
"start_url": "/app"             // quebra pro social mídia, que vive em /socialmidia
```

Falta:

| Campo | Pra que serve | O que você perde sem ele |
|---|---|---|
| `id` | identidade estável do app | atualizar o manifest pode "criar outro app" no Android |
| `scope` | limita o que abre dentro do app | links saem pro navegador sem querer |
| `shortcuts` | atalhos no long-press do ícone | Trello tem "Adicionar card". Você poderia ter "Nova ideia", "Novo post", "Aprovações" |
| `screenshots` | prints no diálogo de instalação | o Android mostra uma caixa feia e genérica; com screenshots vira uma mini-página de loja |
| `display_override` | `["window-controls-overlay","standalone"]` | visual mais nativo no desktop |
| `categories`, `lang`, `dir` | metadados | descoberta |

E o `start_url` deveria ser `/?source=pwa` — deixa o router decidir o destino (criador vs social mídia) **e** te dá o dado de quantos abrem instalado.

## 1.5 O `share_target` não aceita imagem — e devia

Hoje:

```json
"share_target": { "method": "GET", "params": { "title":"title", "text":"text", "url":"url" } }
```

Isso captura link e texto. Não captura **print, foto nem vídeo**.

Trocando pra `method: "POST"`, `enctype: "multipart/form-data"` e um campo `files`, você habilita o gesto mais natural do mundo pra esse público: a pessoa vê um Reels que quer copiar, aperta *Compartilhar → CRIA*, e **a referência cai no banco de ideias com a imagem junto**. É a feature que faz o app ser aberto todo dia sem você pedir. Nenhum concorrente brasileiro faz isso bem.

## 1.6 Ninguém instala o que não pede pra ser instalado

Não existe nenhum handler de `beforeinstallprompt` no código, nem instrução pro iOS (que não tem esse evento e exige "Compartilhar → Adicionar à Tela de Início").

Sem prompt de instalação, o seu PWA é só um site. E um site não recebe push no iOS — **no iOS o push só funciona se o app estiver instalado na tela de início**. Ou seja: todo o trabalho de notificação que você já fez está desligado pra metade dos usuários por falta de um banner.

**O que fazer:** um banner discreto na 2ª ou 3ª sessão ("Instale o CRIA e receba avisos quando o cliente aprovar"), com fluxo separado pro iOS.

## 1.7 Detalhes que somam

- **Viewport:** `maximum-scale=1, user-scalable=no` bloqueia o zoom. Como você já corrigiu os inputs pra 16px, isso virou só uma barreira de acessibilidade. Remover.
- **Badge no ícone:** `navigator.setAppBadge(n)` põe a bolinha com número no ícone do app. Perfeito pros "posts esperando aprovação". É uma linha de código e traz a pessoa de volta.
- **Splash iOS:** sem `apple-touch-startup-image`, o iOS abre com tela branca. Gera desconfiança de "app quebrado".
- **Haptics no kanban:** `navigator.vibrate(10)` ao pegar e ao soltar o card. É o que faz o drag "parecer nativo".
- **Prefetch de rota:** você usa `lazy()` em tudo. Prefetch no hover/intersection do item do menu elimina o flash de loading.
- **Scroll restoration:** voltar do post pro board deveria devolver a pessoa na mesma altura do scroll.
- **Auto-scroll no drag:** conferir se o `@hello-pangea/dnd` está com autoscroll ligado no touch — sem isso, arrastar pra uma coluna fora da tela é impossível no celular.

## 1.8 Prioridade sugerida

| # | O que | Esforço | Impacto |
|---|---|---|---|
| 1 | Workbox (precache + runtime cache) | médio | abertura instantânea, offline |
| 2 | Persistir react-query em IndexedDB | baixo | app "já está lá" ao abrir |
| 3 | Banner de instalação (+ fluxo iOS) | baixo | destrava o push no iOS |
| 4 | `share_target` POST com imagem | médio | hábito diário, diferencial real |
| 5 | Manifest: cores novas, `id`, `scope`, `shortcuts`, `screenshots` | baixo | instalação profissional |
| 6 | Fila de mutações offline | alto | vira "app de verdade" |
| 7 | Badge, haptics, splash iOS, viewport | baixo | acabamento |

---

# PARTE 2 · Comparativo competitivo, preço e posicionamento

## 2.1 Quem é o concorrente de verdade

Ninguém compete com o CRIA inteiro. Cada pedaço seu compete com uma ferramenta diferente — e é isso que muda a conversa de preço.

| Categoria | Quem | Preço (jul/2026) |
|---|---|---|
| Agendador BR (o líder) | **mLabs** | R$ 29,90/mês **por perfil**, usuários ilimitados de graça |
| Agendador BR barato | **Etus / KingHost** | R$ 9,90 a R$ 18,90/mês por perfil |
| Agendador + analytics | **Metricool** | US$ 18/mês (5 marcas) a US$ 45 (15 marcas) |
| Agendador global | **Buffer** | US$ 6/canal/mês |
| Enterprise | **Hootsuite** | US$ 99/mês (10 contas) |
| Organização | **Trello / Notion** | grátis a ~US$ 10/usuário |
| Financeiro | **ContaAzul / Granatum** | R$ 50+/mês |
| CRM | **Pipedrive / RD** | R$ 60+/usuário |

## 2.2 O que eles têm que você não tem

**Publicação multi-rede madura.** O mLabs e o Metricool publicam de verdade em Instagram, Facebook, LinkedIn, X, TikTok, Pinterest, Google Meu Negócio, YouTube — com fila, primeiro comentário automático, repost. Você cobre IG/TikTok/YouTube. Esse é o item que mais vai aparecer numa comparação lado a lado.

**Inbox unificada.** Comentários e DMs de todos os clientes num lugar. Você marcou como "planejamento". É a segunda coisa que uma agência pergunta.

**Analytics/benchmark automático.** O Metricool é forte nisso: relatório bonito, comparação com concorrente, exportável. Você tem relatório white-label (bom), mas o dado é mais raso.

**App nativo na loja.** mLabs e Later têm app publicado. Você é PWA. Isso é resolvível com os itens da Parte 1, mas na venda "tem app?" é uma pergunta que você responde com asterisco.

**Marca e confiança.** O mLabs tem anos, reviews, comunidade, suporte. Você está começando. Isso não se compra com feature.

**Integrações.** Canva, Meta Business Suite, Bitly, Drive.

## 2.3 O que você tem que NENHUM deles tem

1. **A resposta pra "esse cliente dá lucro?"** — O Cria Caixa liga receita, custo (design, copy, tráfego) e imposto por regime a **cada cliente**, e devolve margem. Nenhuma ferramenta de social media do mercado faz isso. O mLabs não sabe se o seu cliente é deficitário. Essa é, disparado, a sua feature mais defensável.
2. **Aprovação por link sem cadastro, com portal white-label.** O cliente abre no celular, vê a arte e a legenda com a logo e a cor da agência, aprova ou pede ajuste, e fica registrado. Isso mata o áudio de 4 minutos e o print riscado no WhatsApp — que é a dor #1 real do social media.
3. **Do lead ao lucro no mesmo lugar.** Pipeline comercial → contrato → produção → aprovação → relatório → recebimento → margem. É um ciclo fechado. Os concorrentes cobrem só o miolo (produção/publicação).
4. **HUB CRIA + Cria Estúdio + Cria Plano/Stories.** Análise de concorrente, geração de imagem, plano de conteúdo com IA. O Metricool tem IA, mas rasa.
5. **Duas caras no mesmo produto.** Criador PF e agência. A agência entrega ao cliente uma conta Studio completa. Isso é um canal de aquisição embutido que nenhum concorrente tem: cada cliente da agência é um usuário exposto ao CRIA.

## 2.4 Onde o preço está certo e onde está errado

### Criador PF: R$ 32,90 (Pro) / R$ 49,90 (Studio) — **arriscado**

O problema não é o valor absoluto, é a **âncora**. R$ 32,90 fica a três reais do mLabs (R$ 29,90). Quem não entendeu que o CRIA não é um agendador vai comparar de graça — e vai concluir que você é "um mLabs mais caro que publica em menos redes".

Duas saídas, e você escolhe uma:

- **Plano de entrada de R$ 19,90** (ideias, kanban, calendário, media kit; sem IA e sem agendamento). Vira hábito, e o upgrade acontece quando ela precisa da IA. Isso te tira da faixa de comparação com o mLabs.
- **Ou subir o preço e afastar a comparação:** Studio a R$ 59,90 e comunicar como "estúdio", não como ferramenta. Preço baixo demais perto do líder é o pior lugar: caro pra ser barato, barato pra ser premium.

### Agência: R$ 36,90/assento — **certo, mas mal comunicado**

Você está 24% acima do mLabs por cliente. Tudo bem — você entrega infinitamente mais. Mas se a LP diz "R$ 36,90 por cliente", a cabeça dela compara com "R$ 29,90 por perfil" e você perde.

**A âncora tem que ser a soma, não a unidade:**

> "R$ 36,90 por cliente substitui: mLabs (R$ 29,90) + Trello + planilha de cobrança + ContaAzul (R$ 50+). E o seu cliente ainda ganha uma conta Studio completa, de graça."

Preço não se defende sozinho. Ele se defende com a conta que ele elimina.

### Colaborador: R$ 29,90/assento — **o ponto mais frágil da tabela**

**O mLabs dá usuários ilimitados de graça.** Cobrar R$ 29,90 por colaborador é a linha que a pessoa vai apontar na comparação. Uma agência de 4 pessoas com 10 clientes olha assim:

- CRIA: 10 × 36,90 + 3 × 29,90 = **R$ 458,60/mês**
- mLabs: 10 × 29,90 + equipe grátis = **R$ 299,00/mês**

53% mais caro. Você *pode* justificar (CRM + financeiro + margem), mas não com essa estrutura de cobrança, que **penaliza exatamente a agência que cresce** — o cliente que você mais quer.

**Recomendação forte:** incluir 3 colaboradores no plano de agência e cobrar só a partir do 4º (ou baixar o assento pra ~R$ 14,90). Cobrar por cadeira quando o líder dá de graça é atrito puro, e o ganho de receita é pequeno perto do custo de conversão.

### Módulos vendidos separados — **simplificar**

Cria Post, Cria Gestão, Cria Caixa vendidos avulsos deixam a pessoa fazendo conta na hora da decisão. Crie um **"Cria Agência"** com os três inclusos por um preço único e mantenha o avulso só como downsell. Menos escolha, mais conversão.

## 2.5 O maior risco não é preço. É entendimento.

Hoje você tem: Cria Post, Cria Gestão, Cria Caixa, Cria IA, Cria Plano, Cria Stories, Cria Estúdio, HUB CRIA. **Oito marcas com a mesma palavra.**

Pra você, que construiu, é óbvio. Pra quem chega da Meta Ads em 4 segundos de atenção, isso é ruído — e ruído não converte. O público (social media freelancer, agência de 1–5 pessoas, criador) não compra "módulos". Compra **saída de dor**.

**Uma promessa na LP, módulos como capítulos:**

> **"Pare de gerir cliente no WhatsApp e planilha."**
> O CRIA junta a produção, a aprovação do cliente e o dinheiro num lugar só — e te diz, no fim do mês, quais clientes dão lucro.

Os oito nomes viram seções da página, não portas de entrada.

## 2.6 Por que ela escolheria o CRIA (as três razões que sobrevivem a uma objeção)

1. **É o único que responde se o cliente dá lucro.** Todo mundo te ajuda a postar. Ninguém te ajuda a saber se valeu a pena.
2. **O cliente aprova sem criar conta, num portal com a cara da sua agência.** Acaba o print riscado no WhatsApp, e você parece uma agência maior do que é.
3. **Uma assinatura no lugar de quatro.** Agendador + Trello + planilha + financeiro viram um login só.

## 2.7 Onde você perde — e vale saber antes do cliente falar

Publicação multi-rede mais estreita; sem inbox; sem app na loja; sem marca consolidada; suporte de time pequeno. Nenhum desses é fatal **se você não competir como agendador**. Todos são fatais **se você competir**.

---

# PARTE 3 · As duas respostas pedidas

## 3.1 Proposta de preço

Duas opções. A **A** é a mudança mínima que corrige o erro estrutural. A **B** é a reestruturação que eu faria.

### Opção A — mínima (mexe em uma linha)

Mantém tudo como está e **inclui 3 colaboradores no plano de agência**. Do 4º em diante, R$ 14,90.

Corrige o único ponto onde você fica objetivamente pior que o mLabs (que dá usuários ilimitados de graça) e para de punir a agência que cresce — que é exatamente o cliente que você quer reter. É o mínimo aceitável pra ir pro tráfego pago.

### Opção B — reestruturada (o que eu faria)

**Criador (PF):**

| Plano | Preço | O que entra |
|---|---|---|
| **Essencial** | R$ 19,90/mês | Banco de ideias, kanban, calendário, brandbook, link na bio, media kit. Sem IA, sem agendamento. |
| **Pro** | R$ 39,90/mês | Tudo do Essencial + IA (150 gerações), agendamento, insights do Instagram, relatórios. |
| **Studio** | R$ 69,90/mês | Tudo do Pro + Collabs, financeiro pessoal, Estúdio (geração de imagem), IA 500, cursos. |

Por que mexer:

- O **Essencial a R$ 19,90** te tira da faixa de comparação com o mLabs (R$ 29,90). Ninguém compara um caderno de ideias de R$ 19,90 com um agendador. Ele existe pra criar hábito e virar upgrade.
- O **Pro a R$ 39,90** (era 32,90) sai de cima do preço do mLabs. Três reais de diferença convida à comparação; dez reais dizem "é outra coisa".
- O **Studio a R$ 69,90** (era 49,90) porque R$ 49,90 é barato demais pro que ele entrega. Quem *vive* de conteúdo e fecha uma publi de R$ 800 não decide por R$ 20. Preço baixo em produto premium não gera volume — gera dúvida.

Anual com 2 meses grátis (-17%) em todos.

**Agência:**

| Item | Preço | Observação |
|---|---|---|
| **Plano Agência** | R$ 149/mês | Já inclui **3 clientes + 3 colaboradores + os 3 módulos** (Post, Gestão, Caixa) |
| Cliente extra | R$ 34,90/mês | Abaixo dos R$ 36,90 de hoje |
| Colaborador extra (4º+) | R$ 14,90/mês | Metade do que é hoje |

A âncora da venda deixa de ser a unidade e passa a ser a soma:

> "R$ 149 por mês pra 3 clientes com CRM, financeiro e aprovação por link. Só o agendador (mLabs) já custaria R$ 89,70 — e não te diz se o cliente dá lucro, não guarda contrato e não faz o cliente aprovar sem criar conta."

E pare de vender módulo avulso na porta de entrada. Módulo avulso é **downsell**, não vitrine: quem faz conta na hora de decidir, não decide.

## 3.2 Como resolver os oito "Crias"

O problema não é o nome. É que **oito coisas estão competindo pela mesma atenção**. A regra é simples:

> **Uma marca vende. O resto descreve.**

**Fora do produto (LP, anúncio, checkout): a palavra CRIA aparece uma vez.** Nada de "Cria Post", "Cria Caixa", "HUB CRIA" na landing. Três palavras estruturam a página, e são as três coisas que a pessoa faz:

**Conteúdo · Clientes · Dinheiro.**

Uma promessa no topo:

> **Pare de gerir cliente no WhatsApp e planilha.**
> O CRIA junta a produção, a aprovação do cliente e o dinheiro num lugar só. E te diz, no fim do mês, quais clientes dão lucro.

**Dentro do produto: o menu descreve a função, não a marca.**

| Hoje | Vira |
|---|---|
| Cria Post | **Aprovações** |
| Cria Gestão | **Clientes** |
| Cria Caixa | **Financeiro** |
| HUB CRIA | **Concorrentes** |
| Cria Stories | aba **Stories** dentro de Conteúdo |
| Cria Estúdio | botão **Gerar imagem** |
| Cria Plano | botão **Planejar o mês** |
| Cria IA | não é lugar, é verbo: **"Escrever com IA"**, onde a pessoa escreve |

O faturamento (Stripe) pode continuar com os SKUs que já existem — isso é assunto seu, não do usuário. O que precisa mudar é o que ela **lê**.

**O teste:** tire a palavra "Cria" do nome. Se a pessoa ainda entende o que aquilo faz, o "Cria" era ruído. "Post" não diz nada. "Aprovações" diz tudo.

---

## Resumo executivo

**Mobile/PWA:** o SW não faz cache (só push) e o react-query não persiste. Corrigir esses dois já te dá 80% da sensação "app nativo". Depois: banner de instalação (destrava o push no iOS), share_target com imagem (hábito diário) e fila offline.

**Competitivo:** você não é um mLabs melhor e não deve tentar ser. Você é o sistema operacional do negócio de social media — do lead ao lucro. É o único que responde "esse cliente dá lucro?".

**Preço:** o assento de agência está bem posicionado mas mal ancorado. O plano PF está perigosamente colado no líder. O **assento de colaborador é o erro** — o concorrente dá de graça e você penaliza a agência que cresce.

**Comunicação:** oito "Crias" são sete a mais na hora de vender. Uma promessa, um plano, uma dor.
