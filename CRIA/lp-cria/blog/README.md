# Blog do CRIA

Blog estático dentro da LP, em `criasocialclub.com.br/blog`. Sem framework e sem
dependência: um script Node lê os markdowns e gera as páginas.

## Publicar um post novo

1. Copie `posts/_MODELO.md.txt` pra `posts/nome-do-post.md`.
2. Escreva. O front matter no topo controla título, descrição, trilha e CTA.
3. Rode o gerador:

```bash
cd lp-cria
node blog/build.mjs
```

4. Confira abrindo `blog/index.html` no navegador (ou `npx serve .` na raiz do lp-cria).
5. Publique:

```bash
cd lp-cria
npx vercel --prod
```

## Fila: post com data futura

O gerador só publica post cuja `date` já chegou (fuso de Brasília). Post com data
no futuro fica na fila e entra sozinho no dia certo, na primeira vez que o build
rodar depois daquela data. O terminal mostra o que está na fila.

Pra ver um agendado antes da hora, sem publicar:

```bash
node blog/build.mjs --tudo
```

Isso gera o HTML de todos, inclusive os da fila. Depois de revisar, apague os
HTML dos agendados e rode `node blog/build.mjs` normal, senão eles vão pro ar
antes da data.

## O que o build gera

| Arquivo | O que é |
| --- | --- |
| `blog/index.html` | listagem com destaque, filtro por trilha e explicação das trilhas |
| `blog/<slug>.html` | página do post, com sumário, FAQ e schema |
| `blog/rss.xml` | feed pra quem quiser acompanhar e pra agregadores |
| `sitemap.xml` | raiz do site, com as páginas da LP e todos os posts |
| `robots.txt` | libera Google e os rastreadores de IA de propósito |
| `llms.txt` | resumo do CRIA em texto pra modelos de linguagem lerem |

Os arquivos gerados podem ser commitados: como a Vercel serve estático direto,
não existe passo de build no deploy.

## Front matter

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| `title` | sim | título que aparece na página |
| `title_seo` | não | título da aba e do Google, até 60 caracteres |
| `slug` | não | se faltar, é gerado a partir do título |
| `description` | sim | até 155 caracteres, vai pro Google e pro OG |
| `date` | sim | formato `AAAA-MM-DD`, ordena a listagem |
| `updated` | não | data da última revisão, entra no schema |
| `trilha` | sim | `situacao-ferramenta`, `rotina-social-media`, `oficio-criador` ou `dados-tendencias` |
| `publico` | não | aparece na linha de meta do post |
| `keyword` | não | entra no schema como palavras-chave |
| `destaque` | não | `true` coloca o post no cartão grande da listagem (só um por vez) |
| `faq` | não | lista de `pergunta||resposta`, vira acordeão e schema FAQPage |
| `cta_titulo`, `cta_texto`, `cta_botao`, `cta_link` | não | bloco laranja no fim do post |
| `leitura` | não | minutos; se faltar, é calculado pelo número de palavras |

## Blocos especiais no texto

```
:::resposta Resposta rápida
Bloco amarelo do topo. É o que a IA cita.
:::

:::cria Como isso funciona no CRIA
Bloco azul de produto.
:::

:::checklist Checklist
- item
:::

:::destaque
Frase forte, cartão rosa.
:::

:::nota
Observação lateral, cartão creme.
:::
```

## Regras de publicação

- Sem travessão em nenhum texto.
- Preço sempre conferido no banco antes de publicar. Os valores citados nos posts
  são: Cria Post R$ 19,90, Cria Captação R$ 19,90, Cria Caixa R$ 24,90,
  Cria Gestão R$ 29,90, Cria Radar R$ 49,90, planos do criador a partir de R$ 19,90.
- Nada de estatística sem fonte. Se não dá pra checar, não entra.
- Um post por semana, alternando público (uma semana social media, uma semana criador).
