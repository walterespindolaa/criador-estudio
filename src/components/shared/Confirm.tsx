import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ═══════════════════════════════════════════════════════════════════════════
   O CONFIRM DO CRIA

   O sistema usava o `confirm()` NATIVO do navegador em mais de 20 lugares. Ele
   abre aquela caixinha cinza com "app.criasocialclub.com.br diz" — que não é do
   CRIA, não tem a fonte do CRIA, não tem a cor do CRIA, e ainda por cima diz o
   ENDEREÇO do site em cima do aviso, o que dá cara de golpe. Num produto onde a
   gente cuidou de cada borda arredondada, ele era a pior coisa na tela.

   Pior: no iOS, o confirm nativo BLOQUEIA a thread — dentro de um PWA ele às
   vezes nem aparece direito.

   Aqui a confirmação é um componente de verdade, com a nossa cara. E o uso é
   imperativo (`await confirmar(...)`), então trocar cada `confirm()` foi uma
   linha, sem precisar carregar estado em cada tela.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ConfirmOpts = {
  titulo: string;
  descricao?: string;
  /** Texto do botão que confirma. Diga o VERBO ("Excluir"), não "OK". */
  acao?: string;
  cancelar?: string;
  /** Ação destrutiva → botão vermelho. É o caso de quase todo confirm. */
  destrutivo?: boolean;
};

type Pedido = ConfirmOpts & { resolve: (ok: boolean) => void };

const EVENTO = "cria:confirm";

/**
 * Abre a confirmação e espera a resposta.
 *
 *   if (!(await confirmar({ titulo: "Excluir esta análise?" }))) return;
 */
export function confirmar(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }
    window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { ...opts, resolve } }));
  });
}

/** Fica montado uma vez, na raiz do app. */
export function ConfirmHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    const ouvir = (e: Event) => setPedido((e as CustomEvent<Pedido>).detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);

  const responder = (ok: boolean) => {
    pedido?.resolve(ok);
    setPedido(null);
  };

  if (!pedido) return null;

  const destrutivo = pedido.destrutivo ?? true;

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) responder(false); }}>
      <AlertDialogContent className="rounded-3xl border-2 border-[#151412] max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {destrutivo && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 text-left">
              <AlertDialogTitle className="font-display text-lg font-extrabold">
                {pedido.titulo}
              </AlertDialogTitle>
              {pedido.descricao && (
                <AlertDialogDescription className="font-body text-sm mt-1 leading-relaxed">
                  {pedido.descricao}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel onClick={() => responder(false)} className="rounded-xl">
            {pedido.cancelar ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => responder(true)}
            className={destrutivo ? "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" : "rounded-xl"}
          >
            {/* O botão diz o VERBO. "OK" não avisa ninguém do que vai acontecer. */}
            {pedido.acao ?? "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
