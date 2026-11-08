import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIdeas } from "@/hooks/useIdeas";
import { usePillars } from "@/hooks/usePillars";
import { useIdeaFolders } from "@/hooks/useIdeaFolders";
import { NovaIdeiaFolha } from "@/components/ideas/NovaIdeiaFolha";

/* CAPTURA RÁPIDA NO BOTÃO "NOVA IDEIA" (Walter, 19/10/2026). O cartão Captura
   Rápida da página inicial repetia o botão do topo. Agora o botão abre esta
   janela, com a mesma gravação (useIdeas.createIdea) e o mesmo aviso.
   07/11/2026: a janela virou a folha do caderno (NovaIdeiaFolha), a mesma da
   aba Ideias. "Abrir a folha completa" guarda e abre a folha lá. */
export function CapturaRapidaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { ideas, createIdea } = useIdeas({ limit: 20, enabled: open });
  const { pillars } = usePillars();
  const { folders, moverIdeia } = useIdeaFolders();

  return (
    <NovaIdeiaFolha
      open={open}
      onOpenChange={onOpenChange}
      pilares={pillars.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
      pastas={folders.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
      // A busca daqui traz no máximo 20: com 20 ou mais, não mostra um número errado.
      totalIdeias={ideas.length >= 20 ? undefined : ideas.length}
      onVerTodas={() => { onOpenChange(false); navigate("/app/ideias"); }}
      salvando={createIdea.isPending}
      onGuardar={async (d, { abrir }) => {
        if (!user) return false;
        try {
          const nova = await createIdea.mutateAsync({ title: d.titulo, notes: d.notas, pillar_id: d.pilarId });
          if (d.pastaId) await moverIdeia.mutateAsync({ ideaId: nova.id, folderId: d.pastaId });
          toast.success("Ideia capturada!");
          onOpenChange(false);
          if (abrir) navigate(`/app/ideias?folha=${nova.id}`);
          return true;
        } catch {
          toast.error("Erro ao salvar ideia.");
          return false;
        }
      }}
    />
  );
}
