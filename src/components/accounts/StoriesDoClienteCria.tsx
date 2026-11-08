import { useState } from "react";
import { toast } from "sonner";
import { ScopedAccountProvider, useActiveAccount } from "@/contexts/AccountContext";
import { UploadProgressProvider } from "@/contexts/UploadProgressContext";
import { usePosts, type Post } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { PostEditor } from "@/components/kanban/PostEditor";
import { StoriesDoCliente } from "@/components/accounts/StoriesDoCliente";
import type { ExternalPost } from "@/hooks/useCriaPost";

/* ═══════════════════════════════════════════════════════════════════════════
   STORIES DO CLIENTE QUE TEM O CRIA (Walter, 08/11/2026: "aqui tem stories,
   mas aqui não puxa"). A aba Stories lia os posts de aprovação por link da
   social mídia; pra quem tem o Cria, os stories moram no Cria dele (a mesma
   base do Kanban do cliente). Aqui a mesma grade da semana lê e grava direto no
   Cria do cliente, com o mesmo editor do Kanban do cliente, escopado pela conta
   dele (ScopedAccountProvider, acesso pelo RLS is_account_member).
   ═══════════════════════════════════════════════════════════════════════════ */
export function StoriesDoClienteCria({ criaOwnerId, podeEditar }: { criaOwnerId: string; podeEditar: boolean }) {
  return (
    <ScopedAccountProvider ownerId={criaOwnerId}>
      <UploadProgressProvider>
        <Grade podeEditar={podeEditar} />
      </UploadProgressProvider>
    </ScopedAccountProvider>
  );
}

function Grade({ podeEditar }: { podeEditar: boolean }) {
  const { activeAccountId } = useActiveAccount();
  const { posts, updatePost } = usePosts();
  const { pillars } = usePillars();
  const [aberto, setAberto] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [dataNova, setDataNova] = useState<string | undefined>(undefined);

  return (
    <>
      <StoriesDoCliente
        modo="cria"
        posts={posts as unknown as ExternalPost[]}
        podeEditar={podeEditar}
        onNovo={(dia) => { setPost(null); setDataNova(dia); setAberto(true); }}
        onAbrir={(p) => { setPost(posts.find((x) => x.id === p.id) ?? null); setDataNova(undefined); setAberto(true); }}
        onEnviarSemana={async (ids) => {
          try {
            for (const id of ids) await updatePost.mutateAsync({ id, updates: { status: "editando" } });
            toast.success(`${ids.length} ${ids.length === 1 ? "story foi" : "stories foram"} pra coluna Pronto, na fila de aprovação do cliente.`);
          } catch { toast.error("Não consegui mover todos. Tente de novo."); }
        }}
      />
      <PostEditor
        open={aberto}
        onOpenChange={setAberto}
        post={post}
        pillars={pillars}
        userId={activeAccountId ?? ""}
        onSaved={() => { /* o usePosts já invalida */ }}
        initialFormat={post ? undefined : "story"}
        initialDate={post ? undefined : dataNova}
      />
    </>
  );
}
