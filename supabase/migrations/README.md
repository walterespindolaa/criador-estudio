# Migrations — leia antes de mexer

## O problema (e ele é sério)

Esta pasta **não recria o banco**. Existem 90 arquivos aqui, mas o banco de
produção foi editado várias vezes pelo SQL Editor do Supabase/Lovable, direto,
sem gerar migration. Resultado: pelo menos **18 RPCs usadas pelo frontend
existem SÓ em produção** e não estão em nenhum arquivo deste diretório.

Na prática isso quer dizer:

- Rodar essas migrations num banco vazio **não** te dá o CRIA funcionando.
- Se o projeto Supabase for perdido, corrompido ou apagado, **não há de onde
  reconstruir**. O código do frontend estaria intacto e inútil.
- A fonte de verdade do schema é `src/integrations/supabase/types.ts`, que é
  **gerado** a partir do banco real. Ou seja: o banco é a verdade, e o banco não
  tem backup versionado.

Isso não é dívida técnica de estilo. É risco de perder o produto.

## A correção: gerar um baseline

Um único dump do schema de produção, versionado, a partir do qual tudo mais é
incremental. É rodado **uma vez**.

### 1. Instale e conecte a CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref exuxlwdnkgmhtnwoyvwo
```

### 2. Gere o baseline (só o schema, sem dados)

```bash
supabase db dump --linked -f supabase/migrations/00000000000000_baseline.sql
```

Isso escreve o schema COMPLETO de produção — tabelas, RLS, funções, triggers,
RPCs, tipos, tudo — num arquivo só. É o retrato fiel do que existe hoje.

### 3. Aposente as migrations antigas

Depois que o baseline existir, os 90 arquivos anteriores viram história, não
receita. Mova-os pra fora do caminho do runner:

```bash
mkdir -p supabase/migrations/_arquivo
git mv supabase/migrations/2026*.sql supabase/migrations/_arquivo/
```

(Não delete: o histórico deles ajuda a entender POR QUE algo é do jeito que é.
Só não devem mais ser executados, porque o baseline já contém o resultado deles.)

### 4. Marque o baseline como já aplicado em produção

Produção já tem esse schema — ela não deve tentar rodar o baseline de novo:

```bash
supabase migration repair --status applied 00000000000000
```

### 5. Guarde um dump de DADOS também

Schema versionado protege a estrutura. Não protege o conteúdo.

```bash
supabase db dump --linked --data-only -f backup-dados-$(date +%F).sql
```

**Este arquivo NÃO vai pro git** (tem dado de cliente). Guarde em local seguro,
e repita periodicamente. O Supabase tem backup automático no plano pago —
confirme que o seu plano tem, e qual é a janela de retenção.

## A regra, daqui pra frente

**Nenhum SQL entra em produção sem virar arquivo aqui.**

Fluxo certo:

```bash
supabase migration new nome_do_que_voce_esta_fazendo
# edite o arquivo gerado em supabase/migrations/
supabase db push          # aplica em produção
```

Se você rodar algo pelo SQL Editor (acontece, e às vezes é o certo — hotfix),
**crie o arquivo correspondente na mesma hora** e marque como aplicado:

```bash
supabase migration new o_que_eu_rodei_no_editor
# cole exatamente o SQL que você rodou
supabase migration repair --status applied <timestamp>
```

O trabalho de 30 segundos aqui é o que impede o buraco de 18 RPCs de voltar.

## Regenerar os tipos depois de qualquer mudança

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Sem isso, o TypeScript não enxerga a coluna nova e você descobre no runtime.
