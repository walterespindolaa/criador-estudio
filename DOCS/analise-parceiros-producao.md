# Cria Parceiros: análise completa da experiência de quem produz

**Data:** 14/09/2026
**Escopo:** designer, filmmaker, editor de vídeo, copywriter e gestor de tráfego que recebem demanda de agências dentro do CRIA.
**Método:** leitura do código (telas, hooks, RPCs, migrations, edges), pesquisa de mercado e comparação com concorrentes.

---

## 1. Veredito em uma página

O Cria Parceiros **já é um produto**, não um rascunho. Ele resolve a parte que ninguém resolve bem: **a relação agência e freelancer**, com prazo negociado, conversa presa à peça, entrega versionada e cachê rastreado. Isso é raro. As ferramentas grandes do mundo (Frame.io, Ziflow, Filestage) resolvem **aprovação de arquivo**, não **relação de trabalho**. As plataformas brasileiras (Workana, 99Freelas, GetNinjas) resolvem **encontrar trabalho**, não **executá-lo**. O CRIA está num espaço vazio no meio.

Mas ele **não está 100% operacional**, e os furos não são de acabamento. São três, em ordem de gravidade:

1. **Confidencialidade.** Um parceiro que recebe uma única peça de teste passa a ler o brandbook completo daquele cliente, as notas internas da agência e a conversa inteira do portal de aprovação, para sempre, mesmo depois de desligado.
2. **Dinheiro que evapora em silêncio.** O cachê nasce de um gatilho que, se falhar, só avisa o log do banco. Mudança de valor depois da entrega não atualiza nada. A data de entrega que ele usa para cobrar é sobrescrita por qualquer edição da agência.
3. **Nenhuma notificação abre a peça.** Oito gatilhos, oito links para telas de lista. E o aviso de "ajuste pedido" cita o motivo errado, por uma inversão de ordem no código.

Se eu tivesse que resumir o produto numa frase: **a experiência está boa, a fundação tem rachaduras que ainda não apareceram porque só a Gabriela e a Ágatha estão usando.**

---

## 2. O que está bom

Vale registrar, porque é o que sustenta o resto.

### 2.1 O prazo é combinado, não imposto

`parceiro_responder_prazo` deixa o parceiro topar ou contrapor com data e motivo, e a peça **segue produzível** enquanto negocia. Isso é desenho de produto maduro: quem já trabalhou com freela sabe que prazo imposto vira silêncio, não entrega. Nenhum concorrente pesquisado tem isso.

### 2.2 A conversa mora na peça

Comentário carimbado com papel (você, cliente, social mídia), imagem no chat, link virando link clicável. É o antídoto do áudio de WhatsApp perdido, que é a real ferramenta de gestão do mercado hoje.

### 2.3 A camada pessoal é invisível para a agência

`parceiro_etapas` e `parceiro_card_meta` dão ao parceiro um quadro dele, com etapas próprias por papel (Referências, Rascunho, Arte final para designer; Decupagem, Corte, Finalização para editor) e checklist privado. A agência continua vendo só "Fazendo". Isso respeita o profissional em vez de vigiá-lo, e é um argumento de venda inteiro.

### 2.4 O parceiro não paga nada e não consome assento

`manager-member-invite` exclui explicitamente os papéis de produção da contagem de assentos. A agência pode acoplar quantos quiser. Isso é crescimento viral embutido: cada agência traz freelancers para dentro do CRIA de graça, e cada freelancer vê a vitrine de módulos.

### 2.5 A ficha da marca acabou com a repetição

Cor, fontes, tom de voz, o que evitar e os links do cliente moram num lugar só, não em cada card. É a tradução do card fixo "Infos Clientes" que a Gabriela mantinha no Trello, e foi validada por ela.

### 2.6 O cachê é rastreável dos dois lados

A entrega vira despesa no Caixa da agência automaticamente, e o parceiro vê peça a peça de onde vem o valor. Some a isso o caderninho manual (`parceiro_lancamentos`) para o trabalho que vem de fora do CRIA, e a tela responde a vida financeira inteira dele, não metade.

---

## 3. O que precisa melhorar

Organizado por gravidade, com a causa técnica ao lado.

### 3.1 GRAVE: o parceiro lê demais, e para sempre

**Brandbook e notas internas.** `parceiro_minhas_marcas()` monta a lista a partir de `select distinct external_client_id from posts where assignee_id = auth.uid()`, sem janela de tempo e sem checar se o vínculo ainda está ativo. Devolve o `brand_core` inteiro, `cc.notes` (campo livre de anotação interna da agência) e `useful_links`. Tradução: mandou uma peça de teste para um freelancer em março, ele lê o brandbook daquele cliente em dezembro, já desligado.

**A conversa inteira do cliente.** `parceiro_abrir_card` devolve **todos** os comentários do post, sem filtrar `author_role`. Inclui o que o cliente escreveu no portal de aprovação. Se o cliente escreveu "esse valor está caro" ou "não gostei do trabalho da agência", o freelancer lê.

**Financeiro sem vínculo.** `parceiro_meus_caches_detalhe()` filtra só por `assignee_id`, sem checar vínculo. Parceiro desligado continua lendo títulos de peça e nomes de cliente da agência. O dinheiro dele é legítimo, os títulos e nomes não são.

**RLS por tabela nova.** `acts_for()` não olha o papel: qualquer vínculo ativo conta como time. As tabelas sensíveis foram reescritas para `member_can` na migration F22, mas tudo que nasceu **depois** voltou a usar `acts_for`: `capture_scripts`, `client_intakes`, `agenda_datas`, `script_approvals`, `client_report_notes`, `video_analyses`, `module_entitlements`. O parceiro passa em todas.

**Rotas sem cadeado.** `/socialmidia/clientes`, `/aprovacoes`, `/agenda`, `/relatorio`, `/equipe`, `/contas` não têm `ModuleGate`. O menu esconde, a URL não. Em `Equipe` ele pode até convidar gente.

### 3.2 GRAVE: dinheiro que some sem barulho

- `lancar_cache_parceiro()` tem `exception when others → raise warning`. Se o insert falhar, a entrega passa e **ninguém sabe** que o cachê não nasceu.
- Índice único por `post_id` + guarda de existência: se a agência **corrigir** o valor depois da entrega, ou se a peça voltar para ajuste e for reentregue por outro valor, a despesa fica com o valor velho. Não há update em lugar nenhum.
- Peça sem `cache_parceiro` preenchido (campo opcional na delegação) nunca vira linha. Entregue e invisível no financeiro dos dois lados.
- `entregue_em` é `posts.updated_at`. Qualquer edição posterior da agência reescreve a data que o parceiro usa para cobrar.
- Dois critérios diferentes para "está pago": a RPC usa `status in ('pendente','atrasado')`, a tela usa regex `/pago|recebid|quitad/i`. Vão divergir.

### 3.3 GRAVE: as notificações não levam a lugar nenhum

Os oito gatilhos apontam para listas. `MinhasDemandas` guarda o card aberto em estado local e **não lê `useParams` nem `useSearchParams`**: não existe nem a possibilidade de deep-link hoje.

Pior, o texto do "ajuste pedido" está errado: `usePedirAjuste` faz o UPDATE do post **antes** do INSERT do comentário, e o trigger `AFTER UPDATE` lê o último comentário existente, que é o **anterior**. O parceiro recebe um pedido de ajuste com o motivo de outra conversa colado. E como `notify_parceiro_comentario` ignora texto começando com `Ajuste:`, o motivo verdadeiro nunca gera aviso próprio.

Some a isso: a agência **não recebe nada** quando uma peça atrasa. O robô diário só avisa o parceiro.

### 3.4 MÉDIO: buracos de experiência

- **Menu some ao ativar módulo.** "Meus cachês" e "Parceria" só existem sob `parceiroPuro`. No instante em que o parceiro ativa qualquer módulo do CRIA (que é exatamente o que queremos que ele faça), o link para os próprios cachês desaparece do menu. A rota continua viva, sem porta.
- **Parceiro pausado cai no vazio.** Vínculo pausado derruba `souParceiro`, mas o guard deixa passar por ser `manager`: ele aterrissa no dashboard da social mídia cheio de zeros, o cenário que a ParceiroHome foi criada para eliminar.
- **Etiquetas viram UUID.** `internal_tags` chega como array de uuid e a tela renderiza o uuid como texto do chip. O catálogo com nome e cor está atrás de um gate que o parceiro não passa.
- **Linha editorial nunca chega.** O campo existe no post, nenhuma RPC de parceiro o devolve. Para quem produz, saber que a peça é do pilar "Bastidores" ou "Prova social" muda a execução.
- **Sem hora de publicação.** `scheduled_time` não é devolvido. Ele vê o dia, nunca a hora.
- **Sem "há quantos dias está comigo".** `assigned_at` vem na fila mas não no card aberto.
- **Card na lixeira continua abrindo.** `parceiro_abrir_card` e `parceiro_tem_o_card` não filtram `deleted_at`.
- **Erros engolidos.** `useMeusCaches`, `useCachesDosParceiros` e `useConversaDoCard` fazem `if (error) return []` para qualquer erro. Falha de rede vira tela vazia sem aviso. Pior: `useSouParceiro` retorna `false` em erro, e o redirect manda o parceiro para a área de criador.
- **Mensagem de erro de desenvolvedor no rosto do usuário:** "Não consegui salvar. Rode o SQL da tabela parceiro_lancamentos."

### 3.5 MÉDIO: mobile

O freelancer trabalha no computador, mas **confere no celular**. Hoje:

- **Nenhuma tela do parceiro tem título no celular.** O título mora na faixa do topo, que é `hidden md:block`. Demandas, Entregues, Marcas e Cachês abrem sem nada escrito.
- **Quadro inutilizável.** As etapas pessoais dentro do "Fazendo" usam colunas iguais sem breakpoint: com 3 etapas em 390px cada uma fica com 110px, e dentro tem um cartão com capa 4:5. Com 4 etapas, acabou.
- **Mês ilegível.** Grade de 7 colunas fixa, 50px por dia, texto de 8,5px.
- **Card aberto com altura fixa** `h-[92vh]`, não `max-h`. No celular vira uma rolagem longa com o chat no fim.
- **Parceiro não-puro perde a área no celular:** o dock mostra Clientes/Agenda/Aprovações e a gaveta "Mais" não tem seção de parceiro.

### 3.6 LEVE, mas vale citar

- Duas coisas diferentes chamadas "parceiro" no mesmo menu: o programa de afiliados e o profissional de produção. Confunde.
- `Entregues.tsx` duplica a query de `useEntreguesDoParceiro` com tipo local divergente.
- `parceiro_marcar` tem duas sobrecargas possivelmente coexistindo no banco (a de 2 argumentos nunca foi derrubada).
- Nenhuma tabela ou RPC de parceiro está no `types.ts`: tudo passa por `as any`, sem checagem contra o schema.
- Semeadura de etapas sem índice único: duas abas abertas podem duplicar as etapas padrão.

---

## 4. O sistema está 100% operacional?

**Não. Está em torno de 80%.** O caminho feliz funciona de ponta a ponta: convite, demanda, prazo, produção, conversa, entrega, cachê. O que falha é o caminho real, onde as coisas dão errado.

### Gargalos, em ordem de risco

| # | Gargalo | Consequência real | Correção |
|---|---|---|---|
| 1 | Brandbook e conversa do cliente abertos, sem prazo de validade | Vazamento de dado de cliente para terceiro desligado | Janela de tempo + checar vínculo ativo na `parceiro_minhas_marcas`; filtrar `author_role` no `parceiro_abrir_card` |
| 2 | Cachê que falha em silêncio | Freelancer não cobra o que tem direito; agência não sabe que deve | Trocar `raise warning` por notificação; criar update quando o valor muda |
| 3 | `entregue_em` = `updated_at` | Data de entrega muda sozinha; discussão de cobrança | Coluna `entregue_em` própria, gravada uma vez |
| 4 | Notificação sem deep-link | Toda notificação custa uma caçada | Link com `?post=<id>` e `MinhasDemandas` lendo `useSearchParams` |
| 5 | Motivo errado no aviso de ajuste | O parceiro refaz a coisa errada | Inverter a ordem (comentário antes do update) ou passar o motivo no próprio update |
| 6 | Rotas da agência sem gate | Parceiro navega onde não deve por URL | `ModuleGate` ou guard de papel nas rotas listadas |
| 7 | Tabelas novas com `acts_for` | RLS mais larga do que o desenho declarado | Trocar por `member_can` nas 7 tabelas listadas |
| 8 | Menu perde "Meus cachês" ao ativar módulo | O parceiro que vira cliente perde a própria área | Condição por `souParceiro`, não por `parceiroPuro` |
| 9 | Erros engolidos | Tela vazia sem explicação, suporte às cegas | Relançar erro real; só engolir "schema cache" |
| 10 | Mobile do quadro e do mês | Duas das cinco visões não servem no celular | Breakpoint nas etapas; mês vira lista no celular |

---

## 5. O que o mercado está fazendo

### 5.1 O que os concorrentes fazem melhor

**Frame.io, Ziflow, Filestage** dominam a aprovação criativa. O que eles têm e nós não:

- **Comentário ancorado no ponto exato.** Clique na imagem e o comentário fica naquela coordenada; no vídeo, naquele segundo. Hoje no CRIA o feedback é texto solto: "arruma o título do slide 3". Essa é a diferença entre uma ida e volta e três.
- **Versão como conceito de primeira classe.** V1, V2, V3 lado a lado, com o aprovado sempre óbvio. Hoje o CRIA empilha mídias sem dizer qual é a final.
- **Etapas de aprovação configuráveis** com lembrete automático de prazo.
- **Busca por conteúdo do arquivo** (reconhecimento visual, transcrição, OCR) para reaproveitar o que já existe em vez de refazer.

Preço deles: Ziflow e Filestage partem de cerca de 199 dólares ou euros por mês, Frame.io cobra por assento. **Nenhum é acessível para a social mídia brasileira que atende cinco clientes**, e é aí que mora nossa vantagem.

### 5.2 O que o mercado brasileiro NÃO resolve

Workana, 99Freelas, GetNinjas e afins resolvem **achar trabalho**, cobrando caro por isso: Workana leva 20% do primeiro contrato, GetNinjas vende moedas a R$ 0,15 para o freelancer comprar o direito de falar com o cliente. Nenhuma delas acompanha a **execução**: briefing, prazo, versão, aprovação, pagamento. Terminou de fechar o contrato, a plataforma sai de cena e o trabalho volta para WhatsApp e Drive.

**O CRIA entra exatamente onde elas saem.** Isso é posicionamento, não funcionalidade.

### 5.3 A dor documentada do freelancer

Os números de 2026 são brutais e todos apontam para a mesma coisa:

- **72% dos projetos freelancer sofrem scope creep**, e cada profissional perde entre 7.800 e 15.600 dólares por ano com trabalho fora do combinado.
- **57% das agências perdem de 1 a 5 mil dólares por mês** em escopo não cobrado, e **99% não faturam todo o trabalho extra**.
- Horas não pagas somam 20 a 40 por projeto, derrubando a taxa efetiva de 50 para 20 por hora.

Ou seja: **a dor número um do nosso usuário não é organizar arquivo, é revisão infinita que ninguém cobra.** E o CRIA hoje não tem nenhuma defesa contra isso. O "pedir ajuste" é ilimitado e gratuito.

### 5.4 Tendências que valem adaptar

- IA em operações criativas está sendo adotada de forma **evolucionária**, focada em automação de fluxo e validação, não em gerar a peça. Combina com o que já fazemos.
- Marcação automática e transcrição para achar material já aprovado e reaproveitar.
- Orquestração num lugar só: briefing, arquivo, feedback e versão amarrados ao mesmo ativo.

---

## 6. O que já existe no CRIA e dá para adaptar

Esta é a parte mais barata do plano: **não precisa construir, precisa liberar**.

| Já existe para | Adaptar para o parceiro | Por que faz sentido |
|---|---|---|
| **Cria Captação** (roteiro estruturado, teleprompter, guia de gravação em PDF, lista de tomadas) | O filmmaker que recebe uma demanda de vídeo deveria abrir o roteiro em cenas e o guia do dia no próprio card | É a ferramenta certa na mão certa. Hoje o roteiro chega como texto corrido em "Copy" |
| **Cria Radar / análise de vídeo (TwelveLabs)** | Analisar a peça que ele acabou de entregar: ritmo, corte, gancho | Vira ferramenta de melhoria do profissional, não só de espionagem de concorrente |
| **Brandbook em PDF** | Botão "baixar a marca" na ficha, para levar offline ao editar | Ele trabalha em Premiere e Illustrator, não no navegador |
| **Media Kit** | Portfólio automático do parceiro com as peças entregues e aprovadas | Freelancer vive de portfólio. Isso sozinho segura ele no produto |
| **Relatório gerencial** | Relatório do parceiro: quantas peças, para quem, quanto recebeu, tempo médio | Ele precisa disso para declarar imposto e para negociar reajuste |
| **Cria Caixa** | Já está no banner. Falta o caminho curto: "virar meus cachês em lançamentos" | Conversão natural de grátis para pago |
| **Etiquetas internas e linha editorial** | Mandar nas RPCs com nome e cor | O dado existe, só não atravessa |
| **Lixeira** | Hoje é a lixeira do criador, sempre vazia para ele | Ou some do menu, ou vira a lixeira das peças dele |
| **Notificações e push** | Categoria própria "produção", separada de "clientes" | Hoje ele desliga "clientes" e perde todo aviso de trabalho |

---

## 7. Plano de ação

Três ondas. A primeira é obrigação, a segunda é produto, a terceira é diferencial.

### Onda 1: fechar as rachaduras (1 a 2 semanas)

Nada aqui é opcional. É o que evita processo, perda de dinheiro e quebra de confiança.

1. **Fechar o vazamento de dados**
   - `parceiro_minhas_marcas`: exigir vínculo ativo e limitar a clientes com peça nos últimos 180 dias.
   - `parceiro_abrir_card`: filtrar comentários para `parceiro` e `social_media`. O que o cliente escreve no portal não é do freelancer.
   - `parceiro_meus_caches_detalhe`: manter o valor, tirar título de peça e nome de cliente quando o vínculo estiver pausado.
   - Trocar `acts_for` por `member_can` nas 7 tabelas pós-F22.
   - `ModuleGate` ou guard de papel nas rotas da agência.

2. **Blindar o dinheiro**
   - Coluna `entregue_em` própria em `posts`, gravada uma vez.
   - `lancar_cache_parceiro`: notificar em vez de `raise warning`; atualizar o valor quando `cache_parceiro` mudar antes da baixa.
   - Avisar a agência quando entregar peça sem cachê definido.
   - Unificar o critério de "pago" entre RPC e tela.

3. **Consertar as notificações**
   - Link com `?post=<id>` em todos os gatilhos.
   - `MinhasDemandas` e `PainelComParceiros` lendo o parâmetro e abrindo o card.
   - Inverter a ordem em `usePedirAjuste` para o motivo certo chegar.
   - Categoria "produção" separada de "clientes" nas preferências de push.
   - Avisar a agência quando uma peça do parceiro atrasar.

4. **Parar de engolir erro**
   - Relançar o erro real nos três hooks; só engolir "schema cache".
   - Trocar a mensagem sobre rodar SQL por algo humano.

### Onda 2: o produto que ele indica para outro freelancer (3 a 5 semanas)

5. **Versão como conceito.** V1, V2, V3 na peça, com a final marcada. Resolve "qual arquivo é o bom" e prepara o terreno para cobrar revisão.

6. **Comentário ancorado.** Clique na imagem cria comentário naquele ponto; no vídeo, naquele segundo. É o item de maior impacto por hora de trabalho: corta ida e volta em todos os cards.

7. **Contador de revisões.** Mostrar "ajuste 3 de 2 combinados" no card. Não precisa cobrar automaticamente, basta **tornar visível**. É a resposta direta ao dado de que 72% dos projetos sofrem scope creep e 99% não são cobrados. Nenhuma ferramenta brasileira faz isso.

8. **Mobile de verdade.** Título nas telas, quadro com breakpoint, mês virando lista no celular, card aberto com `max-h`.

9. **Menu que não some.** "Meus cachês" por `souParceiro`, e seção de parceiro na gaveta mobile.

10. **Completar o briefing.** Linha editorial, etiquetas com nome e cor, hora de publicação, "há quantos dias está comigo".

### Onda 3: o que faz ele ficar (5 semanas em diante)

11. **Portfólio automático.** Media Kit alimentado pelas peças entregues e aprovadas, com link público. O freelancer passa a divulgar o CRIA por interesse próprio.

12. **Relatório do parceiro.** Peças, clientes, valores, tempo médio de entrega, no mês e no ano. Serve para imposto e para negociar preço.

13. **Roteiro e guia de gravação no card do filmmaker.** Reuso direto do Cria Captação.

14. **Análise da própria entrega.** Reuso do Radar de vídeo, virado para dentro.

15. **Ponte para o Cria Caixa.** Botão que transforma os cachês recebidos em lançamentos, com o primeiro mês aberto.

### Sequência recomendada

Onda 1 inteira antes de qualquer coisa da Onda 2. Dentro da Onda 2, o **comentário ancorado** e o **contador de revisões** primeiro: são os dois que mudam a conversa de "ferramenta de organização" para "ferramenta que protege minha margem", que é a dor que o mercado mede em dólares.

---

## Fontes

- [Best Creative Approval Software 2026 (Ziflow)](https://www.ziflow.com/blog/best-review-and-approval-software)
- [Top Ziflow Alternatives 2026 (Filestage)](https://filestage.io/blog/ziflow-alternatives/)
- [Best Frame.io Alternatives for Video Teams 2026 (KROCK.IO)](https://krock.io/blog/frame-io-alternatives/)
- [Creative Operations Trends Reshaping 2026 (Screendragon)](https://www.screendragon.com/blog/creative-operations-trends/)
- [Best Creative Operations Software (Air)](https://air.inc/resources/best-creative-operations-software)
- [Freelancers Lose Up to $15,600/Year to Scope Creep (MicroGaps)](https://www.microgaps.com/gaps/2026-02-18-ai-scope-creep-detector-freelancers)
- [Scope Creep in Freelancing, correção 2026 (EarnSpot)](https://earnspot.blog/scope-creep/)
- [Freelance Pricing Data Study 2026 (Memvers)](https://memvers.com/blog/freelance-pricing-data-study-2026)
- [Melhores Plataformas de Freelancer no Brasil, comparativo 2026](https://www.freelanceronline.com.br/blog/plataformas-de-freelancer-no-brasil/)
- [Workana, 99Freelas ou Upwork (FreelaSemCrise)](https://www.freelasemcrise.com.br/blog/workana-99freelas-upwork-comparativo)
