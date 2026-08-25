import { lazy, Suspense } from "react";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BioAlvoProvider } from "@/contexts/BioAlvoContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useBioPage, useCreateBioPage } from "@/hooks/useBioPages";

// O editor é grande (preview ao vivo, dois layouts, upload). Carrega só quando
// a aba abre, pra não pesar a ficha do cliente inteira.
const LinkInBio = lazy(() => import("@/pages/app/LinkInBio"));

/* ═══════════════════════════════════════════════════════════════════════════
   LINK NA BIO DO CLIENTE (dentro do Cria Gestão)

   Duas situações, uma tela só:

   · Cliente COM conta Cria: a gestora edita a página que o cliente já tem. É a
     mesma que ele vê quando entra no Cria dele. Manter duas bios do mesmo
     negócio seria pedir pra elas divergirem na primeira semana.

   · Cliente SEM conta Cria: a página é criada aqui, pendurada na ficha do CRM,
     e continua sendo dela mesmo que o cliente vire assinante depois.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LinkNaBioCliente({
  crmClientId, criaOwnerId, nomeCliente,
}: {
  crmClientId: string;
  criaOwnerId: string | null;
  nomeCliente: string;
}) {
  const { agencyOwnerId } = useActiveAccount();
  // Procura a página da ficha SEMPRE, mesmo quando o cliente tem conta Cria.
  // Um cliente pode ter ganhado a conta depois de a página já estar no ar: se a
  // gente ignorasse ela nesse caso, a página continuaria pública, ocupando o
  // endereço, e sumiria da tela sem jeito de editar ou tirar do ar.
  const { data: page, isLoading } = useBioPage(crmClientId);
  const criar = useCreateBioPage();

  const carregando = (
    <div className="grid place-items-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (isLoading) return carregando;

  // Cliente com conta Cria e SEM página própria da agência: edita a bio dele.
  if (criaOwnerId && !page) {
    return (
      <BioAlvoProvider alvo={{ tipo: "conta", ownerId: criaOwnerId, rotulo: nomeCliente }}>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2.5 mb-4 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs font-body text-foreground/80">
            Você está editando a página que <strong>{nomeCliente}</strong> tem na conta dele. O que você mudar aqui
            é o que ele vê quando entra no Cria.
          </p>
        </div>
        <Suspense fallback={carregando}><LinkInBio /></Suspense>
      </BioAlvoProvider>
    );
  }

  if (!page) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-body font-medium text-foreground">Monte o link na bio de {nomeCliente}</p>
        <p className="text-xs text-muted-foreground font-body mt-1 mb-4 max-w-md mx-auto">
          Uma página só dele, com os botões que você escolher, pra colocar na bio do Instagram.
          Funciona mesmo sem conta no Cria, e os leads capturados caem aqui pra você.
        </p>
        <Button onClick={() => criar.mutate(crmClientId)} disabled={criar.isPending || !agencyOwnerId}>
          {criar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Criar a página
        </Button>
      </div>
    );
  }

  return (
    <BioAlvoProvider
      alvo={{ tipo: "ficha", pageId: page.id, crmClientId, managerId: page.manager_id, rotulo: nomeCliente }}>
      {criaOwnerId && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 mb-4">
          <p className="text-xs font-body text-foreground/85">
            Esta é a página que <strong>você</strong> montou pra {nomeCliente}. Ele também tem uma bio própria
            na conta dele do Cria, editada por ele. As duas ficam no ar, então use endereços diferentes
            e combine com ele qual vai no Instagram.
          </p>
        </div>
      )}
      <Suspense fallback={carregando}><LinkInBio /></Suspense>
    </BioAlvoProvider>
  );
}
