import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lightbulb, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { GANCHOS, CATEGORIAS_GANCHO, type CategoriaGancho } from "@/lib/ganchos";

/* ─────────────────────────────────────────────────────────────
   SELETOR DE GANCHOS ("Ideias de gancho")

   Botão discreto que abre um dialog com os 60 ganchos prontos
   (src/lib/ganchos.ts), filtráveis por busca e por categoria.
   Clicar num gancho chama onPick(texto) e fecha; quem monta o
   componente decide o que fazer (normalmente: preencher o campo
   de gancho do post). Os "___" ficam pra pessoa completar.

   Cuidado principal: NUNCA atropelar o que a pessoa já escreveu.
   Se valorAtual tem texto, a escolha vira uma confirmação inline
   dentro do próprio dialog antes de substituir.

   modo="copiar": em vez de preencher um campo, copia o gancho pro
   clipboard (pra contextos onde não existe campo de gancho, tipo
   a avaliação de legenda). Sem confirmação, porque não sobrescreve
   nada de ninguém.
   ───────────────────────────────────────────────────────────── */

type Props = {
  /** Recebe o texto do gancho escolhido (ignorado no modo copiar). */
  onPick?: (texto: string) => void;
  /** Texto que já está no campo alvo; com algo escrito, confirma antes de substituir. */
  valorAtual?: string;
  /** Rótulo do botão gatilho. */
  label?: string;
  /** "preencher" (padrão) chama onPick; "copiar" só copia pro clipboard. */
  modo?: "preencher" | "copiar";
  className?: string;
};

// Busca sem frescura: minúsculas e sem acento, dos dois lados.
const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function SeletorDeGanchos({ onPick, valorAtual, label = "Ideias de gancho", modo = "preencher", className }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGancho | "todas">("todas");
  // Gancho aguardando confirmação (só quando o campo alvo já tem texto).
  const [pendente, setPendente] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return GANCHOS.filter((g) => {
      if (categoria !== "todas" && g.categoria !== categoria) return false;
      if (q && !normalizar(g.texto).includes(q)) return false;
      return true;
    });
  }, [busca, categoria]);

  const abrir = (o: boolean) => {
    setOpen(o);
    if (!o) { setBusca(""); setCategoria("todas"); setPendente(null); }
  };

  const aplicar = (texto: string) => {
    onPick?.(texto);
    abrir(false);
    toast.success(texto.includes("___")
      ? "Gancho aplicado. Complete os ___ com o seu tema."
      : "Gancho aplicado.");
  };

  const escolher = async (texto: string) => {
    if (modo === "copiar") {
      try {
        await navigator.clipboard.writeText(texto);
        toast.success("Gancho copiado. Cole onde quiser.");
      } catch {
        toast.error("Não deu pra copiar. Selecione o texto manualmente.");
      }
      return;
    }
    // Campo já preenchido com outra coisa: confirma antes de substituir.
    if ((valorAtual ?? "").trim() && (valorAtual ?? "").trim() !== texto) {
      setPendente(texto);
      return;
    }
    aplicar(texto);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => abrir(true)}
        title="60 ganchos prontos pra abrir seu post"
        className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-body font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] transition-colors ${className ?? ""}`}
      >
        <Lightbulb className="h-3.5 w-3.5" /> {label}
      </button>

      <Dialog open={open} onOpenChange={abrir}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" /> Ideias de gancho
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs font-body text-muted-foreground -mt-1">
            60 aberturas prontas pra prender nos primeiros segundos. Escolha uma e complete os ___ com o seu tema.
          </p>

          {/* Confirmação inline: só aparece quando o campo já tinha texto. */}
          {pendente && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3 space-y-2">
              <p className="text-xs font-body text-foreground">
                Substituir o gancho atual por <span className="font-semibold">"{pendente}"</span>?
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="h-8" onClick={() => aplicar(pendente)}>Substituir</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setPendente(null)}>Manter o que escrevi</Button>
              </div>
            </div>
          )}

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar gancho..."
              className="rounded-xl pl-9"
            />
          </div>

          {/* Chips de categoria */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoria("todas")}
              className={`rounded-full border text-xs font-body px-3 py-1.5 transition-colors ${categoria === "todas" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              Todas
            </button>
            {CATEGORIAS_GANCHO.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoria(categoria === c.key ? "todas" : c.key)}
                className={`rounded-full border text-xs font-body px-3 py-1.5 transition-colors ${categoria === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-1 overflow-y-auto max-h-[45vh] sm:max-h-[50vh] -mx-1 px-1">
            {filtrados.length === 0 && (
              <p className="text-sm font-body text-muted-foreground text-center py-6">
                Nenhum gancho com essa busca. Tente outra palavra.
              </p>
            )}
            {filtrados.map((g) => (
              <button
                key={g.texto}
                type="button"
                onClick={() => void escolher(g.texto)}
                className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] transition-all px-3 py-2.5 group"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-body text-foreground">{g.texto}</span>
                  {modo === "copiar" && (
                    <Copy className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  )}
                </span>
                <span className="block text-[10px] font-body text-muted-foreground/70 mt-0.5">
                  {CATEGORIAS_GANCHO.find((c) => c.key === g.categoria)?.label}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
