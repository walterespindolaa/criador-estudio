# CreatorsFlow

SaaS de criação de conteúdo para redes sociais — um hub operacional completo para criadores individuais. Da ideia ao publicado: ideação, planejamento, roteirização com IA, produção, agendamento e análise.

**Produção:** https://criador-estudio.lovable.app

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **State/Data:** @tanstack/react-query, react-hook-form + zod
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **IA:** Lovable AI Gateway (Gemini) via Edge Function `ai-context-builder`
- **Deploy:** Lovable (frontend + edge functions), sync via GitHub

---

## Setup local

### Pré-requisitos
- Node.js 18+ (ou Bun)
- Conta Supabase (ou acesso ao projeto via Lovable Cloud)

### Instalação

```bash
# Clonar
git clone https://github.com/walterespindolaa/criador-estudio.git
cd criador-estudio

# Instalar dependências
npm install   # ou: bun install

# Configurar variáveis de ambiente
cp .env.example .env
# Preencher .env com os valores do projeto (ver seção abaixo)

# Rodar em dev
npm run dev   # ou: bun run dev
```

App sobe em `http://localhost:8080`.

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave anon (pública) do Supabase |

> Apenas a chave **anon** vai no `.env`. Ela é pública por design (vai pro bundle do cliente). Chaves secretas (service_role, API keys) ficam nos **Secrets do Supabase/Lovable**, nunca no repo.

---

## Fluxo de deploy

1. Editar código (Claude Code / VS Code)
2. `git commit` + `git push origin main`
3. Lovable sincroniza automaticamente do GitHub
4. Clicar **Publish** no dashboard do Lovable

Edge Functions são deployadas junto pelo Lovable. Migrations SQL são aplicadas manualmente via SQL Editor do Lovable Cloud.

---

## Estrutura

```
src/
├── components/      # UI (kanban, shared, ui/ shadcn)
├── contexts/        # AuthContext, ThemeContext
├── hooks/           # useProfile, useSubscription, useAdmin, etc
├── integrations/    # supabase client + types
├── lib/             # helpers (ai, themes, upload-validation, etc)
├── pages/           # Landing, Login, Signup, Onboarding + app/
└── ...

supabase/
├── functions/       # Edge Functions (Deno)
└── migrations/      # SQL migrations
```

---

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run test` | Testes (Vitest) |
| `npm run lint` | Lint (ESLint) |

---

## Notas

- **Auth:** email/senha + Google OAuth (Supabase Auth)
- **Trial/Subscription:** gate server-side via `has_access()` (RLS + Edge Functions)
- **Multi-tenancy:** RLS por `user_id` em todas as tabelas
- **Admin:** painel em `/app/cf-admin-panel` (gate via `is_admin()`)
