import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogoMarca } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { SolicitarMaterial } from "@/components/aprovar/SolicitarMaterial";
import { corSeguraEmFundoClaro, readableFgHex } from "@/lib/cor-legivel";

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
  // Como TEXTO na folha clara, a marca precisa de contraste; como FUNDO do
  // número, o texto em cima precisa ser branco ou escuro conforme a marca.
  const brandTexto = corSeguraEmFundoClaro(brand);
  const brandFg = readableFgHex(brand);

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

      {/* A PÁGINA GANHOU CARA (Gabriela, 21/09/2026: "vamos melhorar o layout
          dessa página, tá muito sem graça"). Era um card branco solto numa
          folha bege. Agora tem uma faixa de abertura na cor do cliente, que diz
          em uma frase pra que serve o link, e três passos curtos embaixo, que
          é a dúvida real de quem chega aqui pela primeira vez: "pedi, e agora?" */}
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <div className="text-center mb-5">
          <p className="text-[11px] font-body font-bold uppercase tracking-[0.14em]" style={{ color: brandTexto }}>
            Canal de pedidos
          </p>
          <h1 className="text-[22px] sm:text-[26px] font-display font-extrabold text-foreground leading-tight mt-1">
            Precisou de uma arte? Peça por aqui.
          </h1>
          <p className="text-[13.5px] font-body text-muted-foreground mt-1.5 leading-relaxed">
            Sem WhatsApp perdido, sem e-mail sem resposta. Você pede, marca a data e acompanha nesta mesma página.
          </p>
        </div>

        <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_10px_34px_rgba(27,26,24,0.07)]">
          <SolicitarMaterial token={token} abertoPorPadrao semMoldura />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
          {[
            { n: "1", t: "Você pede", d: "Diz o que precisa e pra quando." },
            { n: "2", t: "Entra na agenda", d: "Cai direto no dia que você marcou." },
            { n: "3", t: "Você acompanha", d: "O selo muda conforme anda." },
          ].map((p) => (
            <div key={p.n} className="rounded-2xl border border-border bg-card/70 px-3.5 py-3">
              <span className="inline-grid place-items-center w-6 h-6 rounded-full text-[11px] font-display font-extrabold"
                style={{ backgroundColor: brand, color: brandFg }}>{p.n}</span>
              <p className="text-[13px] font-display font-bold text-foreground mt-1.5">{p.t}</p>
              <p className="text-[11.5px] font-body text-muted-foreground leading-snug">{p.d}</p>
            </div>
          ))}
        </div>
      </main>
      <AssinaturaCria variante="rodape" tom="claro" style={{ paddingTop: 16, paddingBottom: 40 }} />
    </div>
  );
}
