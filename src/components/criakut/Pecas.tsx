import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDenunciar } from "@/hooks/useCriakut";
import { iniciais } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* Peças pequenas reaproveitadas no Criakut (Fase 3): selo do Destaque,
   avatar redondo e o diálogo de denúncia. */

export function SeloDestaque({ curto = false, className }: { curto?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide text-primary-foreground", className)}
      title="Destaque no Criakut">
      <Star className="h-2.5 w-2.5 fill-current" />{!curto && " DESTAQUE"}
    </span>
  );
}

export function Avatar({ nome, foto, className }: { nome: string; foto: string | null | undefined; className?: string }) {
  return foto
    ? <img src={foto} alt="" loading="lazy" className={cn("shrink-0 rounded-full object-cover", className)} />
    : <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-extrabold text-primary-foreground", className)}>{iniciais(nome || "?")}</span>;
}

type Alvo = { tipo: "recado" | "topico" | "resposta" | "perfil"; id: string } | null;

export function DenunciarDialog({ alvo, onClose }: { alvo: Alvo; onClose: () => void }) {
  const denunciar = useDenunciar();
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (alvo) setMotivo(""); }, [alvo]);
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Denunciar</DialogTitle>
          <DialogDescription>Com 3 denúncias de pessoas diferentes, some até o Cria olhar. Quem escreveu não fica sabendo quem denunciou.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} maxLength={300} value={motivo} placeholder="O que tem de errado? (opcional)" onChange={(e) => setMotivo(e.target.value)} />
        <Button className="rounded-xl" variant="destructive" disabled={denunciar.isPending}
          onClick={() => alvo && denunciar.mutate({ tipo: alvo.tipo, alvo: alvo.id, motivo: motivo.trim() }, { onSuccess: onClose })}>
          {denunciar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar denúncia
        </Button>
      </DialogContent>
    </Dialog>
  );
}
