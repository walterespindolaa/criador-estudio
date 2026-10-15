# Checklist de Deploy — CRIA

Rodar tudo abaixo pra o sistema funcionar 100%. Os `alter ... add column if not exists` são idempotentes: se você já rodou, não faz nada (seguro rodar de novo). O risco de NÃO rodar está na coluna "sintoma".

## 1) SQLs de coluna/tabela (ALTO — se faltar, quebra salvar)

```sql
-- persona (senao salvar persona quebra inteiro)
alter table public.personas   add column if not exists objections text[];

-- link do conteudo no post (interno e externo)
alter table public.posts      add column if not exists drive_folder_url text;

-- CRM cliente (senao criar/editar cliente quebra)
alter table public.crm_clients add column if not exists logo text;
alter table public.crm_clients add column if not exists contract_end_date date;
alter table public.crm_clients add column if not exists useful_links jsonb not null default '[]'::jsonb;
alter table public.crm_clients add column if not exists color text;

-- perfil (senao a RPC get_managed_profile quebra -> telas de perfil gerenciado)
alter table public.profiles   add column if not exists useful_links jsonb not null default '[]'::jsonb;

-- feedback com anexo
alter table public.feedbacks  add column if not exists origin text;
alter table public.feedbacks  add column if not exists attachment_url text;
alter table public.feedbacks  add column if not exists attachment_type text;
```

## 2) Buckets de storage (MÉDIO)

```sql
insert into storage.buckets (id, name, public) values ('feedback','feedback', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('saved-covers','saved-covers', true)
  on conflict (id) do update set public = true;
```
(As policies de leitura pública / upload por pasta desses dois buckets já foram passadas antes; se não rodou, avisa que eu reenvio.)

## 3) RPCs / funções

- `get_cronograma_by_token` com o fallback de cor/logo do cliente (SQL enviado antes) — pro link do cronograma pegar a cor/logo certos.
- `agenda_day_order` (tabela + RLS) — pra reordenar dentro do dia na agenda persistir (SQL enviado antes).
- Confirmar que existe `check_and_increment_rate_limit(...)` (usada por 5 edges de rate-limit). Existe em produção; num ambiente novo/restore precisa recriar.

## 4) Edge functions a (re)implantar

Deploy junto ao push do Lovable. Se o código local for mais novo que o publicado, reimplantar:
`drive-list`, `drive-file-meta` (NOVA), `criapost-download-file`, `criapost-download-zip`, `saved-fetch`, `ai-context-builder`, `get-instagram-config`, `bio-track`, `instagram-sync`, `daily-notifications`.

## 5) Segredos (secrets do projeto)

- `GOOGLE_API_KEY` (aba Drive + `drive-file-meta`; sem ele `drive-list` responde 500 e a lista de pasta não carrega, e o link do Drive colado no Cria Post fica sem saber se é imagem ou vídeo).
- Confirmar que já existem: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, token do Apify (saved-fetch/hub), credenciais do Bunny (download de midia).

## 6) Config de auth (reset de senha)

- Authentication → URL Configuration → Redirect URLs deve conter `https://app.criasocialclub.com.br/reset-password` (ou `.../*`). Provavelmente já está (o link já leva pra pagina); a correção principal foi no código.

## 7) Higiene (não urgente)

Várias colunas/RPCs acima foram criadas direto no dashboard e NÃO estão versionadas como migration no repo. Um dia vale versionar tudo isso, pra o repositório voltar a reproduzir o banco de produção (importante se for restaurar/clonar o ambiente).
