# Checklist pra ligar tráfego pago no CRIA

Última atualização: 18/08/2026

Ordem importa. Os blocos 1 a 4 são pré-requisito pra subir verba. O 5 e o 6
podem correr em paralelo.

Dados que você vai usar o tempo todo:

| | |
|---|---|
| Pixel da Meta | `1760482638731506` |
| Pixel do ChatGPT | `4TCiBRJhEggrMkWpvG3KhE` |
| Projeto Supabase | `exuxlwdnkgmhtnwoyvwo` |
| Domínio do site | `criasocialclub.com.br` |
| Domínio do app | `app.criasocialclub.com.br` |

---

## 1. Publicar o que já está pronto

Sem isso, nada abaixo funciona: o pixel só existe no código, não no ar.

- [ ] **Subir o código**

  ```
  cd ~/Desktop/criador-estudio && git add -A && git commit -m "pixel + LP" && git pull --rebase && git push
  ```

- [ ] **Publicar a LP** (é um projeto Vercel separado, não sobe por git push)

  ```
  cd ~/Desktop/criador-estudio/CRIA/lp-cria && npx vercel --prod
  ```

- [ ] **Publicar o app**: abrir o Lovable e clicar em **Publish**.
      Este é o deploy que finalmente coloca o pixel da Meta dentro do app,
      porque agora o `.env` está versionado e o build enxerga o ID.

---

## 2. Verificar o domínio na Meta

Sem domínio verificado a Meta limita você a 8 eventos e a otimização por
conversão fica prejudicada no iOS, que é onde está boa parte do público.
É o item mais barato de fazer e o mais esquecido.

- [ ] Abrir https://business.facebook.com/settings/owned-domains
- [ ] **Adicionar** → `criasocialclub.com.br`
- [ ] Escolher **verificação por DNS**. A Meta mostra um registro `TXT`.
- [ ] Colar esse TXT no painel de DNS de onde o domínio está registrado
      (Registro.br, GoDaddy, Cloudflare, onde você comprou).
- [ ] Voltar na Meta e clicar em **Verificar**. Pode levar de minutos a horas
      pro DNS propagar; se falhar na hora, tente de novo depois.
- [ ] Depois de verificado: **Gerenciador de Eventos → Configurar Eventos Web
      Agregados** e colocar `CompleteRegistration` como prioridade 1.

---

## 3. Confirmar que a medição está viva

A edge do CAPI foi escrita pra falhar em silêncio, pra rastreamento nunca
derrubar um cadastro. Isso é bom em produção, mas significa que **"não deu
erro" não é prova de que funciona**. A prova é ver o evento chegando.

- [ ] **Conferir os dois secrets no Supabase**
      https://supabase.com/dashboard/project/exuxlwdnkgmhtnwoyvwo/settings/functions

      Precisa ter os dois, não só o token:
      ```
      META_PIXEL_ID    = 1760482638731506
      META_CAPI_TOKEN  = (o token que você gerou)
      ```

- [ ] **Instalar o Meta Pixel Helper** no Chrome
      https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc

- [ ] **Abrir a aba Testar Eventos** (mostra em tempo real, diferente da Visão
      Geral que demora até 30 min)
      https://business.facebook.com/events_manager2/list/pixel/1760482638731506/test_events

- [ ] Com a aba aberta, faça o percurso completo em outra janela:

      | ação | evento esperado |
      |---|---|
      | abrir `criasocialclub.com.br` | `PageView` |
      | rolar até o preço | `ViewContent` |
      | clicar em "Testar grátis" | `Lead` |
      | completar um cadastro de teste no app | `CompleteRegistration` |

- [ ] **O teste que importa**: o `CompleteRegistration` tem que aparecer
      marcado como recebido por **Navegador E Servidor**. Se aparecer só
      Navegador, o CAPI não está espelhando e você perde de 20% a 30% das
      conversões no iOS.

- [ ] **Do lado da OpenAI**: https://ads.openai.com → Tools → Conversions →
      o data source deve mostrar eventos chegando (`page_viewed`,
      `contents_viewed`, `lead_created`).

---

## 4. Tirar os depoimentos inventados

Tem 4 depoimentos no `index.html` marcados como ilustrativos no próprio código.
Anúncio com depoimento fabricado é motivo de reprovação na Meta e problema com
o CONAR. Isso pode derrubar a conta, não só o anúncio.

Escolha um:

- [ ] **Trocar por real**: pedir pra Gabriela um depoimento de cliente com nome
      e @ verdadeiros. Um real vale mais que os quatro inventados.
- [ ] **Ou remover**: me avisa e eu tiro a seção. Melhor não ter prova social
      do que ter prova social falsa.

---

## 5. Rodar o SQL pendente

Três migrations estão no repositório mas talvez não no banco. A terceira é a
que conserta o erro "Apenas o dono da conta pode aprovar" que o cliente vê no
portal de aprovação.

- [ ] Abrir https://supabase.com/dashboard/project/exuxlwdnkgmhtnwoyvwo/sql/new
- [ ] Rodar, nesta ordem, o conteúdo de cada arquivo:

      1. `supabase/migrations/20260817000001_captacao_roteiros.sql`
      2. `supabase/migrations/20260817000002_captacao_stripe_price.sql`
      3. `supabase/migrations/20260818000001_portal_aprovacao_por_token.sql`

      As três são idempotentes (`create ... if not exists`, `create or replace`):
      se já tiver rodado, rodar de novo não quebra nada.

- [ ] Testar o portal: abrir um link de aprovação de cliente e aprovar um post.

---

## 6. Ainda falta (não bloqueia a campanha)

- [ ] **Pixel da OpenAI dentro do app.** Hoje a OpenAI só vê o clique no botão,
      não o cadastro. Pra campanha otimizada por conversão funcionar direito,
      ela precisa do `registration_completed`, que acontece no app. Me pede que
      eu faço: são 3 eventos e 2 domínios no CSP.

- [ ] **Prints de Meu Feed e Estúdio.** Três blocos em Funcionalidades ainda
      mostram texto no lugar da tela.

- [ ] **Conferir o monitoramento antes de gastar.** Tráfego pago traz gente na
      madrugada, no celular ruim, com internet ruim. Vale abrir o Sentry e ver
      se está recebendo, e conferir o heartbeat. Erro que você não vê é venda
      que você não sabe que perdeu.

---

## Quando criar a campanha

**Meta**: objetivo Vendas ou Cadastros, evento `CompleteRegistration`.

**ChatGPT**: https://ads.openai.com. Atenção, porque não dá pra corrigir depois:
a documentação deles diz que você **não pode** mudar o objetivo nem o evento de
conversão de uma campanha já criada. Os objetivos são:

| Objetivo | Paga por | Otimiza pra |
|---|---|---|
| Alcance (CPM) | mil impressões | mostrar pra muita gente |
| Cliques (CPC) | clique válido | quem tende a clicar |
| **Conversões (oCPC)** | clique válido | **quem tende a se cadastrar** |

Pra lead frio que você quer que se cadastre, é **Conversões**. Repare no detalhe
bom: ele otimiza por conversão mas cobra por clique, você não paga a mais.

Só que ele exige um evento padrão ativo **com volume**. Se o
`registration_completed` ainda estiver zerado, comece em **Cliques** pra gerar
dados e crie a campanha de Conversões depois.

**Sobre a verba**: combinamos até R$1.500/mês no total, para Meta e ChatGPT
juntos, com sprints alternados de duas semanas por público, porque o algoritmo
não aprende bem com duas campanhas dividindo pouca verba. Os R$40/dia que
apareceram na tela do ChatGPT são R$1.200/mês só ali, o que deixaria R$300 pra
Meta. É aritmética de alocação, não recomendação financeira: você conhece o
caixa melhor que eu.
