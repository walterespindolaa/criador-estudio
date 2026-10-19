import { useState } from "react";
import { Link } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIdeas } from "@/hooks/useIdeas";
import { sanitizeText } from "@/lib/sanitize";

/* CAPTURA RÁPIDA NO BOTÃO "NOVA IDEIA" (Walter, 19/10/2026). O cartão Captura
   Rápida da página inicial repetia o botão do topo. Agora o botão abre esta
   janela, com a mesma gravação (useIdeas.createIdea) e o mesmo aviso. */
export function CapturaRapidaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {open && <Conteudo onFechar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ onFechar }: { onFechar: () => void }) {
  const { user } = useAuth();
  const { ideas, createIdea } = useIdeas({ limit: 20 });
  const [texto, setTexto] = useState("");

  const capturar = async () => {
    const limpo = sanitizeText(texto);
    if (!limpo || !user || createIdea.isPending) return;
    try {
      await createIdea.mutateAsync({ title: limpo });
      toast.success("Ideia capturada!");
      setTexto("");
      onFechar();
    } catch {
      toast.error("Erro ao salvar ideia.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" /> Nova ideia
        </DialogTitle>
        <DialogDescription className="font-body">
          Anota agora, organiza depois. Vai direto pro seu banco de ideias.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Input
          autoFocus
          placeholder="O que você está pensando?"
          className="rounded-xl h-11"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void capturar(); } }}
        />
        <div className="flex items-center justify-between gap-3">
          <Link to="/app/ideias" onClick={onFechar} className="text-xs font-body font-bold text-primary hover:underline">
            Ver minhas ideias ({ideas.length})
          </Link>
          <Button onClick={() => void capturar()} disabled={!texto.trim() || createIdea.isPending} variant="hero">
            Capturar
          </Button>
        </div>
      </div>
    </>
  );
}
