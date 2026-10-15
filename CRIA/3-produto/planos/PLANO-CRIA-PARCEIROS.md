# Cria Parceiros: designer, editor e video maker dentro da operação

Plano de arquitetura e produto para o terceiro tipo de acesso do CRIA.
Escrito em 28/08/2026, antes de qualquer linha de código.

---

## 1. O problema, na voz de quem vive ele

A Gabriela descreveu assim:

> Criar uma visão para designers, video makers ou outras pessoas envolvidas na
> operação com terceirização, onde dentro do post eu aperto um botão e mando
> para o designer. Em paralelo ela recebe um kanban por cliente. A social media
> disponibiliza o acesso àquele post para a pessoa produzir e subir a entrega no
> próprio card. A pessoa tem acesso às informações principais do cliente
> (identidade visual, cores) e ao post específico que foi delegado, até a
> conclusão.

Hoje isso acontece no Trello: uma lista por cliente, card com capa, etiqueta de
etapa ("Fazer Design", "Aprovado"), e a conversa dentro do card com link pra
pasta de fotos no Drive.

O que o Trello dá e o CRIA não dá é exatamente duas coisas: **atribuir um card a
uma pessoa** e **essa pessoa ver o que é dela sem entrar em cinco quadros**.

---

## 2. A fundação que já existe

Isto não é um sistema novo. Levantamento do que já está construído:

| Peça | Onde está | Serve pra quê aqui |
|---|---|---|
| `manager_members` com `unique (manager_id, member_id)` | `20260707000001_collaborators.sql` | **A mesma pessoa já pode ser colaboradora de várias social medias.** É o alicerce do freelancer multi-agência. |
| `manager_member_permissions` (módulo + `all_clients` ou lista) | mesma migration | Escopo por cliente já resolvido |
| `acts_for(uuid)` | `20260708160000_collab_access.sql` | RLS de time, usado no CRM inteiro |
| `AccountContext` com troca de conta e `queryClient.clear()` | `src/contexts/AccountContext.tsx` | O colaborador já alterna entre contas sem vazar cache |
| `post_approval_comments` com `author_role` | migrations 2026-07 | A thread do card já existe, só falta um papel novo |
| Anexos, pasta do Drive, formato, gancho, roteiro, legenda | `posts` | O card já é mais rico que o do Trello |
| Push + robô diário | ver `cria-notificacoes` | A infraestrutura de aviso já roda |
| Assentos pagos via Stripe | `20260629000004_agency_seats.sql` | O modelo de cobrança de colaborador já existe |

**Conclusão:** cerca de 80% da fundação está pronta e apontada pro lado errado.

---

## 3. Decisões tomadas

1. **A agência acopla o parceiro. Ele entra de graça** e vê apenas as demandas
   das agências que o acoplaram.
2. **Escopo padrão: só o card + a identidade visual do cliente.** Sem financeiro,
   sem contrato, sem carteira, sem os outros posts.
3. **Monetização é upgrade, não pedágio.** O parceiro paga quando quiser trazer a
   *própria* operação: clientes dele, links de aprovação dele, aprovações
   sincronizadas com cada agência e com o cliente final.
4. **As três visões existem** e são um seletor: fila por prazo, kanban por
   cliente, kanban por etapa.

Depois de conversar com a Gabriela (28/08), mais cinco:

5. **O parceiro não recusa card.** O Trello dela não tem isso e ela não sentiu
   falta. Some o estado "recusado" e some a tela de aviso que ele exigiria.
6. **O card precisa de comentário, igual ao Trello.** É lá que a conversa
   acontece hoje, com link de pasta e direcionamento de ajuste.
7. **Etiquetas no card**, também no estilo Trello ("Fazer Design", "Carrossel").
8. **A data de entrega é livre**, combinada entre as duas. Nada de "3 dias antes
   de publicar" automático: a social media põe a data que combinou.
9. **Um parceiro por card.** Se um reels precisa de editor e de capa, viram dois
   cards, não dois responsáveis no mesmo.

**Descoberta boa:** os itens 6 e 7 **já existem e já estão ligados** no Cria Post.
`post_approval_comments` já é a thread cronológica do card (ver
`CriaPostBoard.tsx`), e `post_tags` + `posts.internal_tags` já são as etiquetas
internas, com editor e tudo. Não é construir, é **deixar o parceiro enxergar**.

---

## 4. O que falta construir

### 4.1 Papel no vínculo

Hoje colaborador é genérico: ganha módulos e pronto. Falta:

```sql
alter table public.manager_members
  add column if not exists role text not null default 'social_media';
  -- social_media | designer | editor_video | copy | trafego
```

O papel não é enfeite. Ele decide três coisas: a tela inicial, o que o botão
"Enviar para" oferece, e o conjunto de permissões padrão do convite.

### 4.2 Responsável no post

**Esta é a peça central e não existe.** Hoje a permissão é por cliente; o que a
Gabriela descreveu é delegação **por card**.

```sql
alter table public.posts
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists producao_status text,   -- aguardando | em_producao | entregue | ajuste
  add column if not exists assigned_at timestamptz,
  add column if not exists prazo_producao date;
```

`assignee_id` é uma coluna só, não tabela de vínculo: **um parceiro por card**,
decisão da Gabriela. Reels que precisa de editor e de capa vira dois cards.

`prazo_producao` **não tem regra automática**. Nada de sugerir "3 dias antes de
publicar": a data é a que as duas combinaram, e o sistema não tem opinião sobre
isso. Ele só avisa quando chega perto.

Sem `producao_status = 'recusado'`: o parceiro não recusa.

**Por que `producao_status` separado de `approval_status`:** são dois eixos
diferentes. Um é a produção interna (a Ágatha está fazendo a arte), o outro é o
cliente decidindo. Misturar os dois numa coluna só é o erro clássico: quando a
arte volta pra ajuste, ninguém sabe se o ajuste é do cliente ou da social media.

### 4.3 Caixa de entrada que cruza agências

Hoje o colaborador troca de conta pra ver cada uma. Quem atende cinco social
medias não vai trocar cinco vezes por dia.

Uma consulta nova (não tabela nova) que ignora o `agencyOwnerId` ativo e busca
tudo onde `assignee_id = auth.uid()`, em todas as agências onde ele tem vínculo
ativo. Agrupada por cliente, ordenada por prazo.

### 4.4 Gatilho de notificação

Evento novo: "card foi pra você", disparando push, sino e e-mail. Mais o resumo
no robô diário: "3 peças suas vencem amanhã".

---

## 5. O fluxo ponta a ponta

```
SOCIAL MEDIA                    PARCEIRO                      CLIENTE
     |                              |                             |
 abre o post                        |                             |
     |                              |                             |
 "Enviar para" > Ágatha (design)    |                             |
 define prazo                       |                             |
     |------------ push/email ----->|                             |
     |                         card aparece na fila               |
     |                         vê brandbook resumido              |
     |                         vê gancho, roteiro, legenda        |
     |                         vê a pasta do Drive                |
     |                              |                             |
     |                         sobe a arte no card                |
     |                         comenta se precisar                |
     |<----------- push ------- marca "entregue"                  |
     |                              |                             |
 revisa, aprova ou devolve          |                             |
     |------------ push ----------->| (se devolver, vira ajuste)  |
     |                              |                             |
 manda pro cliente ----------------------------- link de aprovação|
     |<---------------------------------------- aprova ou comenta |
     |                              |                             |
 SEMPRE volta pra ela primeiro      |                             |
     |                              |                             |
 aprovado: ela publica              |                             |
 ajuste de arte: ela reenvia ------>| com o comentário do cliente |
                                      junto no card               |
```

**A social media é sempre o filtro.** O card nunca pula direto do cliente pro
parceiro, e o parceiro nunca fala com o cliente. Foi o que a Gabriela pediu, e
faz sentido: é ela quem sabe se o pedido do cliente é ajuste de arte, de
legenda, ou se é conversa pra ter antes de mandar alguém refazer.

E o card **não volta pro início do fluxo** quando o cliente responde. Aprovado
vai pra publicação; ajuste volta pro ponto onde estava, não pro roteiro.

O que continua resolvido: o comentário do cliente chega no parceiro **dentro do
card**, sem ninguém copiar e colar no WhatsApp.

---

## 6. As três visões do parceiro

Um seletor no topo, igual ao Semana/Mês da produtividade.

**Fila por prazo (padrão).** Tudo dele, de todas as agências, o que vence
primeiro em cima. Cada linha mostra: capa, cliente, agência, formato, prazo,
etapa. É a tela que ele abre de manhã pra saber o que fazer hoje.

**Kanban por cliente.** Uma coluna por cliente, como o quadro do Trello que ele
já usa. Familiar, e boa quando ele senta pra "fazer o dia da Nutri Anna inteiro".

**Kanban por etapa.** A fazer, fazendo, entregue, em ajuste. Cards de todos os
clientes misturados. É a visão de fluxo pessoal, boa pra ver gargalo próprio.

---

## 6b. O que o mercado diz (pesquisa 28/08)

Pesquisa sobre as dores de designers, editores de vídeo e copies freelancers,
pra saber onde o Cria Parceiros gera valor de verdade e não só conveniência.

### As dores que apareceram em todas as fontes

1. **Retrabalho infinito por escopo vago.** Pacote mal definido vira revisão
   sem fim. É a dor número 1 do social media freelancer e do copy. No Cria, o
   card chega com roteiro, formato, quantidade de slides e prazo: o escopo É o
   card.
2. **Feedback bagunçado e "27 versões do mesmo arquivo".** Editores de vídeo
   perdem mais tempo consolidando feedback do que editando. A conversa no card,
   com as três vozes etiquetadas, ataca exatamente isso.
3. **Briefing incompleto.** Sem público, tom, referência e processo de
   aprovação, o editor "gasta tempo adivinhando". O card do Cria traz o
   brandbook resumido (cor, fonte, tom, @) colado na demanda.
4. **Cobrança e calote.** Nota fiscal errada ou inexistente atrasa pagamento;
   freelancer controla entregas em caderno e print de WhatsApp. O relatório de
   entregas por agência (fase 3) nasce disso.
5. **Precificação no escuro.** Iniciante cobra R$800 a 1.500/cliente/mês,
   intermediário 1.500 a 3.500, sênior 4.000+. Ninguém tem visibilidade da
   própria capacidade: a visão de Mês responde "cabe mais um cliente?".

### O que a concorrência gringa cobra (e o buraco que sobra)

HoneyBook, Bonsai, Moxie e afins vendem "client portal + contrato + fatura"
por US$ 20 a 40/mês, tudo em dólar e em inglês, e NENHUM deles conecta o
freelancer à operação da agência: são ilhas do freelancer com o cliente final.
Frame.io resolve só o review de vídeo, caro e isolado.

**O buraco:** não existe ferramenta em português onde a agência delega, o
freelancer produz, o cliente final aprova e a cobrança nasce sozinha do que
foi entregue. É esse fio inteiro que o Cria já tem do lado da agência.

### Tamanho do lado brasileiro

Creator economy no Brasil: US$ 5,47 bi em 2025, projeção de US$ 33,5 bi até
2034 (~22% a.a.). Só o ecossistema do YouTube apoiou 150 mil empregos
equivalentes em 2025, boa parte editores, designers e redatores. A profissão
foi formalizada em lei em 2026, o que empurra justamente pra frente de
"previsibilidade de receita e compliance" onde o relatório de entregas mora.

Fontes: falabondioli.substack.com, gigxomi.com, reviseflow.io, cutsio.com,
blog.cubosuite.com.br, jamilefernandes.com.br, blog.soupejota.com.br,
agencyhandy.com, launchthedamnthing.com, storyflow.so,
blog.privacy.com.br, mundodomarketing.com.br, brazileconomy.com.br.

---

## 7. Monetização: o laço

O parceiro grátis **gera exatamente o dado que torna o pago óbvio**.

**Regra de slots (decisão do Walter, 28/08):**

> Cliente que veio de agência NUNCA consome slot. Cliente próprio do parceiro
> tem 2 ou 3 grátis, e do quarto em diante é pago.

É o mesmo desenho da carteira da social media (3 grátis + pacotes pagos), o
que mantém o produto coerente: quem manda cliente pra dentro do Cria não paga
por ele; quem usa o Cria pra tocar a própria operação paga quando ela cresce.
E protege o efeito de rede: acoplar parceiro continua custando zero pra todo
mundo, então a agência convida sem pensar.

**Grátis, para sempre:**
- Receber e entregar cards das agências que o acoplaram (SEM limite: cliente
  de agência não é slot)
- 2 ou 3 clientes PRÓPRIOS, com kanban, aprovação por link e agenda
- Brandbook resumido do cliente da agência (cores, fontes, logo, tom)
- Comentar no card, subir arquivo, marcar entregue
- As quatro visões (quadro, semana, mês, prazo) e as notificações

**Cria Parceiro (pago), quando a operação própria dele cresce:**

1. **Clientes próprios além dos grátis.** Pacotes de slots, no molde da
   carteira da social media.
2. **Link de aprovação próprio.** Ele manda a arte direto pro cliente final dele,
   com a marca dele, sem depender de uma agência no meio.
3. **Cobrança por entrega.** É o argumento mais forte e o menos óbvio: no fim do
   mês ele já entregou 34 cards para 5 agências, e **o CRIA sabe disso**. Virar
   isso em "quanto cada agência me deve" é um relatório em cima de dado que já
   existe. Freelancer não controla isso em lugar nenhum hoje, controla no
   caderno e no print do WhatsApp.
4. **Portfólio automático.** As peças entregues viram um media kit dele.
5. **Cria Estúdio + biblioteca de arquivos.**

O item 3 é o gancho. Os outros são a razão de ficar.

---

## 8. Integridade do modelo (o que impedir)

**Risco:** a agência convida dez "designers" pra fugir do assento de colaborador.

**Trava:** o papel `designer` não é um colaborador capado, é outra coisa. Ele
**não** enxerga CRM, financeiro, carteira de clientes, agenda da agência, nem os
posts que não foram atribuídos a ele. Quem precisa disso continua sendo
colaborador e continua custando assento. São públicos diferentes, não são dois
preços pro mesmo acesso.

**Risco:** o parceiro atende agências concorrentes e vê dado demais.

**Trava:** escopo padrão é card + identidade visual. E toda atribuição fica
registrada com data e autor, então existe rastro de quem viu o quê.

**Risco:** o parceiro sai da agência e leva o histórico.

**Trava:** desacoplar corta o acesso na hora. As entregas ficam com a agência
(são do cliente dela); a contagem de "quantas peças fiz" fica com ele, sem o
conteúdo.

---

## 9. Fases

**Fase 1, o mínimo que já resolve a dor da Gabriela**
- `role` no vínculo + `assignee_id` e `producao_status` no post
- Botão "Enviar para" dentro do post
- Fila por prazo do parceiro (só a visão de lista)
- Push e e-mail na atribuição
- Convite de parceiro na tela de Equipe, sem consumir assento

**Fase 2, o que faz ele ficar**
- As outras duas visões (kanban por cliente e por etapa)
- Brandbook resumido dentro do card
- Painel da social media: quem está com o quê, e o que está atrasado
- Card de produção avulso, ligado ao post (a "demanda de capa" da Gabriela)

**Fase 3, a monetização**
- Clientes próprios do parceiro
- Link de aprovação com a marca dele
- Relatório de entregas por agência (a base da cobrança)
- Portfólio automático

---

## 10. O que ainda está aberto

As três perguntas anteriores foram respondidas pela Gabriela e viraram as
decisões 5 a 9. Sobraram duas, menores.

1. **A "demanda de capa" é um post irmão ou um card de produção próprio?**
   Ela resolveu o caso de duas pessoas num reels criando um segundo card. Se
   esse card for um post normal, ele entra no cronograma e no calendário do
   cliente, que é errado: capa não é peça publicada. Provavelmente precisa ser
   um card de produção ligado ao post, que existe pro parceiro e some do que o
   cliente vê. Fica pra Fase 2.

2. **Quem escreve a etiqueta?** As etiquetas internas já existem por conta da
   social media. Vale decidir se o parceiro pode criar etiqueta nova ou só usar
   as que já existem. Deixar ele criar polui rápido quando são cinco agências
   com vocabulários diferentes.
