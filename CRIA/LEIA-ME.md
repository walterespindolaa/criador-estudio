# Pasta CRIA: o que tem em cada lugar

Organizada em 15/10/2026. O **sistema** (o app em si) não fica aqui: ele mora na raiz do
`criador-estudio` (`src/` é o app, `supabase/` é o banco e as funções). Esta pasta guarda
tudo que é **em volta** do sistema: site, anúncios, materiais, marca e documentação.

| Pasta | O que é | Exemplos |
|---|---|---|
| `lp-cria/` | **O site** criasocialclub.com.br (sobe com `npx vercel --prod` de dentro dela) | index, social-media, funcionalidades, blog, prints |
| `criativos/` | **Animações e anúncios** | `ads-motion/` (vídeos em código, roteiros, prints do app), `ads-seguidores/`, estáticos |
| `manual-social-midia/` | Manual da social mídia (fonte e PDFs por módulo) | fica na raiz porque os scripts de geração apontam pra cá |
| `manual-criador/` | Imagens e fontes do manual da criadora | usada pelos scripts do manual da social mídia |
| `1-marca/` | **Identidade e registro** | logos e stickers, ícone do app, moldura do YouTube, INPI |
| `2-materiais/` | **Materiais prontos pra usar e mandar** | manuais em PDF, manual do parceiro, tutoriais em vídeo, apresentações, media kit de exemplo |
| `3-produto/` | **Como o sistema foi desenhado** | `mockups/` (telas aprovadas), `planos/` de módulos, backlog, QA, mapa dos tours, e-mails |
| `4-operacao/` | **Rodar e lançar** | go-live, checklists, Meta App Review, `auditorias/`, `sql-antigos/` (já rodados) |
| `5-negocio/` | **Negócio e marketing** | análise de mercado, captação, calendário editorial, referências, contratos |
| `_arquivo/` | **Coisa velha**, fora do git | backups, pacotes .tgz, `_to_delete` (pode apagar quando quiser) |

## Regras pra manter organizado
- Mockup novo de tela vai em `3-produto/mockups/`.
- Vídeo, motion ou anúncio novo vai em `criativos/`.
- SQL depois de rodado vai em `4-operacao/sql-antigos/` (o registro oficial fica em `supabase/migrations/`).
- Nada de dado de cliente identificado nem chave/token aqui.
- `1-marca/registro-inpi/` tem o código-fonte do registro: está no `.gitignore` e nunca sobe pro git.

## O que mudou de lugar (15/10/2026)
Os comentários antigos no código ainda citam caminhos como `CRIA/mockup-caixa-terceiros.html`:
hoje esses arquivos estão em `CRIA/3-produto/mockups/`. O script dos tutoriais virou
`node CRIA/2-materiais/tutoriais/subir-bunny.mjs`.
