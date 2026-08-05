# Checklist de lançamento da LP (criasocialclub.com.br)

Atualizado em 05/08/2026. Tudo aqui vem dos slots reais que estão no código.
Regra geral dos prints: tirar no desktop, janela em 1600x900 (ou tela retina, que sai em 2x), zoom do navegador em 100 por cento, com um perfil ou cliente exemplo bem preenchido (dados bonitos, sem dado pessoal real de cliente). Salvar em PNG. Criar a pasta `lp-cria/prints/` e usar exatamente os nomes de arquivo abaixo, porque os comentários no HTML já apontam pra eles.

Enquanto os prints não chegam, a LP não mostra nada quebrado: cada slot tem uma ilustração de interface desenhada em CSS com legenda de verdade. Ou seja, dá pra lançar sem print. Mas com print real converte melhor.

---

## 1. Prints pra tirar

### index.html

- [ ] **prints/painel.png** (o mais importante da LP inteira)
  - Tela: painel principal do CRIA com o quadro da semana visível (colunas tipo Ideia / Produzindo / Pronto / Publicado), sidebar aberta, 5 ou 6 posts distribuídos, nenhum atrasado.
  - Tamanho: **1600x900** (16:9 exato, o slot tem aspect-ratio 16/9).
  - Onde entra: `index.html`, seção `#hero`, dentro de `.hero-mock`. O comentário no código (procure por "Print real do painel") diz exatamente o que substituir: o bloco `.hero-ui` inteiro vira uma `<img>`.

- [ ] **prints/cria-plano.png**
  - Tela: Cria Plano com um mês gerado, mostrando as semanas com os posts propostos (formato + gancho visíveis).
  - Tamanho: **1200x900** (4:3). Esse mesmo print serve pros dois lugares abaixo.
  - Onde entra: `index.html`, seção `#criaplano`, dentro de `.cp-frame` (comentário "Print real do Cria Plano entra aqui"). Também entra em `funcionalidades.html` no card do Cria Plano.

- [ ] **(Opcional, fase 2) prints do Ciclo CRIA**: `prints/ciclo-ideia.png`, `ciclo-planejar.png`, `ciclo-produzir.png`, `ciclo-publicar.png`, `ciclo-analisar.png`, `ciclo-evoluir.png`
  - Telas: banco de ideias, kanban/calendário, editor de legenda, checklist do dia/Meu Feed, insights de um post, histórico/reciclagem.
  - Tamanho: **1280x860** (aprox. 3:2, entram com max-width 86 por cento dentro do painel azul).
  - Onde entram: `index.html`, seção `#ciclo`, um por `.ciclo-frame` (comentário "Prints reais de cada fase entram aqui"). NÃO mexer nas classes `.ciclo-frame` nem no `data-frame`, o GSAP usa.

### funcionalidades.html (14 cards, todos com o mesmo formato)

Cada card tem uma janelinha de app (`.mock`) com um comentário "Print real entra aqui" apontando o arquivo. O print entra com width 100 por cento dentro de um cartão de ~340px, então um recorte da tela funciona melhor que a tela inteira.
- Tamanho pra todos: **900x675** (4:3), recorte da área mais reconhecível da tela.

- [ ] prints/cria-plano.png (o mesmo do index)
- [ ] prints/cria-stories.png (plano semanal de stories, dia a dia)
- [ ] prints/escrita-guiada.png (editor de legenda com nota de gancho)
- [ ] prints/brandbook.png (cores, fontes, tom de voz preenchidos)
- [ ] prints/banco-ideias.png (lista de ideias + referências)
- [ ] prints/kanban.png (kanban com cards nas 4 colunas)
- [ ] prints/tendencias.png (tendências do nicho com gancho)
- [ ] prints/insights.png (insights de um post: alcance, salvamentos)
- [ ] prints/meu-feed.png (prévia da grade com agendados)
- [ ] prints/cria-prompter.png (teleprompter com roteiro na tela)
- [ ] prints/estudio.png (prompts de arte gerados)
- [ ] prints/media-kit.png (media kit com números)
- [ ] prints/collabs.png (parceria com proposta/cachê)
- [ ] prints/link-in-bio.png (página de links publicada)

### social-media.html (9 cards)

Mesmo formato dos de cima: **900x675** (4:3), exceto o portal do cliente.

- [ ] **prints/portal-cliente.png**: portal de aprovação aberto NO CELULAR, com a marca de um cliente exemplo. Tamanho **750x1400** (retrato, ~9:17), porque entra dentro de uma moldura de celular. Tirar no DevTools em modo mobile (390px de largura) ou print real do celular.
- [ ] prints/cria-gestao.png (pipeline prospect > proposta > fechado)
- [ ] prints/cria-caixa.png (painel com MRR, vencimentos, margem)
- [ ] prints/aprovacao.png (post visto pelo cliente, com o "visto às...")
- [ ] prints/cria-radar.png (concorrentes acompanhados + ideias)
- [ ] prints/relatorio.png (relatório com identidade do cliente)
- [ ] prints/modo-agencia.png (troca de cliente / visão geral)
- [ ] prints/propostas.png (proposta comercial montada)
- [ ] prints/cupons.png (cupom criado com regra e validade)

Prioridade se o tempo apertar: painel.png > cria-plano.png > portal-cliente.png > aprovacao.png. O resto pode subir depois, os cards CSS seguram a página.

---

## 2. Pendências que não são print

- [ ] **Depoimento real.** A seção de depoimentos foi REMOVIDA do index (tinha nomes e fotos ilustrativas; rodar tráfego da Meta pra página com prova social falsa é reprovação de anúncio e risco CDC). Há um comentário no `index.html` marcando o lugar (procure "Seção de depoimentos removida"). Pedir pra **Gabriela** (usuária real): 2 ou 3 frases sobre o antes/depois, com autorização por escrito pra usar nome, foto e texto no site. Com isso em mãos, a seção volta.
- [ ] **Razão social + CNPJ + endereço no rodapé.** As 3 páginas têm um bloco `.footer-empresa` comentado esperando preenchimento (`index.html`, `funcionalidades.html`, `social-media.html`, procure "PREENCHER: razao social"). Preencher e descomentar ANTES de submeter anúncio na Meta.
- [ ] **Confirmar que contato@criasocialclub.com.br recebe e-mail.** O endereço está no rodapé das 3 páginas com um comentário pedindo essa confirmação. Se não recebe, trocar ou remover.
- [ ] **Meta Pixel.** Está comentado só no `<head>` do `index.html` (procure "META PIXEL"). Antes de rodar tráfego: colocar o ID, descomentar, e replicar o snippet em `funcionalidades.html` e `social-media.html` (hoje elas não têm).
- [ ] **Testar o checkout de verdade.** Os 3 Payment Links do Stripe já estão preenchidos em `comprar/essencial.html`, `comprar/pro.html` e `comprar/studio.html`. Fazer 1 compra teste em cada link e conferir se o preço no Stripe bate com o da página (19,90 / 32,90 / 49,90).
- [ ] **Confirmar o Cria Radar.** Ele aparece só em `social-media.html` por R$49,90/mês e não aparece na coluna "Pro gestor" do index. Confirmar preço e se deve entrar no index também.
- [ ] **Cupons: definir o preço/plano.** É o único módulo do lado gestor sem preço na página. Confirmar se vem grátis na conta de gestor, se faz parte do Cria Gestão, ou se tem preço próprio, e escrever isso no card.
- [ ] **Conferir as páginas legais do app.** Os links de Termos, Privacidade e Excluir meus dados apontam pra `app.criasocialclub.com.br/termos`, `/privacidade` e `/excluir-dados`. Abrir os 3 e garantir que estão no ar (a Meta clica neles).
- [x] **og.png**: existe, 1200x630, on-brand, com a headline certa. Nada a fazer. (Nice-to-have futuro: uma og específica pra `social-media.html`.)
- [x] **Favicon**: completo (ico 48, png 16/32, apple-touch-icon 180). Nada a fazer.
