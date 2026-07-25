import { Kanban } from "lucide-react";
import { ScopedAccountProvider } from "@/contexts/AccountContext";
import { UploadProgressProvider } from "@/contexts/UploadProgressContext";
import Criando from "@/pages/app/Criando";

// ── KANBAN DO CLIENTE (dentro do cockpit da social mídia) ──
// Mostra o quadro REAL do Cria do cliente: as mesmas colunas (Ideia → Planejamento →
// Produzindo → Pronto → Agendado → Publicado), o mesmo editor (PostEditor "formato
// dele") e o mesmo arrastar da tela "Estou Criando". Nada de post de aprovação por
// link aqui: é a base `posts` do próprio cliente.
//
// Como funciona o acesso: a gente reaproveita EXATAMENTE o componente Criando (e o
// PostEditor), só que dentro de um ScopedAccountProvider que aponta o activeAccountId
// pra conta Cria do cliente. Assim os hooks internos (usePosts, usePillars, useTasks)
// leem e gravam os posts DELE. O gestor tem permissão pra isso pelo RLS
// (is_account_member): ele é membro ativo da conta do cliente. Editar/arrastar aqui
// reflete na hora no Cria do cliente (mesma tabela, sincronizado de verdade).
export function ClienteKanbanCria({ criaOwnerId, clientName }: { criaOwnerId: string; clientName?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl border border-orange-500/30 bg-orange-500/[0.05] px-4 py-3">
        <Kanban className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
        <p className="text-[12.5px] font-body text-muted-foreground leading-relaxed">
          Este é o quadro real {clientName ? <strong className="text-foreground">de {clientName}</strong> : "do cliente"}, o mesmo Cria dele.
          Criar, editar ou arrastar um card aqui muda direto os posts dele, ao vivo.
        </p>
      </div>
      {/* Reaproveita a tela "Estou Criando" inteira (kanban + calendário + tabela +
          PostEditor), escopada pra conta Cria do cliente.
          O PostEditor consome useUploadProgress, provider que no criador vem do
          AppLayout mas NÃO existe no cockpit do gestor (ManagerLayout). Sem ele a
          aba quebrava com "useUploadProgress must be used inside
          UploadProgressProvider" (e o React #310 caía junto). Então provemos aqui.
          O TourProvider (useTour, também usado pelo Criando/PostEditor) já vem do
          ManagerLayout, então não precisa ser reprovido. AuthContext, AccountContext
          e QueryClient são globais no App.tsx. */}
      <ScopedAccountProvider ownerId={criaOwnerId}>
        <UploadProgressProvider>
          <Criando />
        </UploadProgressProvider>
      </ScopedAccountProvider>
    </div>
  );
}
