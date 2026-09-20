import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogoMarca } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { SolicitarMaterial } from "@/components/aprovar/SolicitarMaterial";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type ClientHeader = { client_name: string; client_logo: string | null; manager_name: string | null; brand_color?: string | null };

/* ═══════════════════════════════════════════════════════════════════════════
   O LINK SO DE PEDIDOS (Walter, 20/09/2026)

   "Toda segunda eu passo no WhatsApp do cliente: se tiverem alguma solicitacao
   pra semana, coloquem aqui." O link de aprovacao serve pra isso, mas chega
   com posts, calendario e relatorio na frente, e a pessoa que so quer pedir um
   flyer se perde. Este aqui e a mesma pagina, sem nada na frente: o cliente
   pede, ve o que ja pediu e em que etapa esta.

   Mesmo token do link de aprovacao (approval_tokens): nenhuma credencial nova,
   nenhuma tabela nova. So uma rota.
   ═══════════════════════════════════════════════════════════════════════════ */
export default function MateriaisPortal() {
  const { token } = useParams<{ token: string }>();
  useForceLightTheme();

  const clientQ = useQuery({
    queryKey: ["portal-client", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_external_client_by_token", { _token: token });
      if (error) throw error;
      return ((data as ClientHeader[]) ?? [])[0] ?? null;
    },
  });

  if (clientQ.isLoading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  const c = clientQ.data;
  if (!c) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6 text-center">
        <div>
          <p className="font-display font-extrabold text-lg text-foreground">Este link não está mais ativo</p>
          <p className="text-sm text-muted-foreground font-body mt-1">Peça um link novo pra quem cuida do seu conteúdo.</p>
        </div>
      </div>
    );
  }
  const brand = c.brand_color ?? "#CE4A1D";

  return (
    <div className="min-h-screen bg-background">
      <AssinaturaCria variante="topo" tom="claro" />
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <LogoMarca src={c.client_logo} nome={c.client_name} tamanho="sm" comFallback formato="avatar" cor={brand} fundo="#ffffff" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-foreground truncate leading-tight">{c.client_name}</p>
            <p className="text-[11px] text-muted-foreground font-body truncate">
              Pedidos de material{c.manager_name ? ` · conteúdo por ${c.manager_name}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-10">
        <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.05)]">
          <SolicitarMaterial token={token} abertoPorPadrao semMoldura />
        </div>
        <p className="text-[12px] text-muted-foreground font-body text-center mt-5 leading-relaxed">
          Cada pedido entra na agenda de quem cuida do seu conteúdo na data que você marcar.
          Volte aqui pra ver em que etapa está.
        </p>
      </main>
      <AssinaturaCria variante="rodape" tom="claro" style={{ paddingTop: 16, paddingBottom: 40 }} />
    </div>
  );
}
