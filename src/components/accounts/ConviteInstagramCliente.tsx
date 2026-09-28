import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Instagram, Link2, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { connectInstagram } from "@/hooks/useSocialInsights";

/* ═══════════════════════════════════════════════════════════════════════════
   CONECTAR O INSTAGRAM DA CLIENTE (28/09/2026)

   Caminho principal: gerar um link e mandar no WhatsApp. A cliente abre no
   celular dela, aceita no Instagram dela e a conexão cai nesta ficha. Sem
   senha passando de mão em mão. O link vale 7 dias e só uma vez; gerar outro
   cancela o anterior.
   Caminho secundário (discreto): conectar aqui mesmo, pra quem tem o acesso
   da conta da cliente no próprio aparelho.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;
const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

type Convite = {
  id: string; token: string; criado_em: string; expira_em: string;
  usado_em: string | null; username_conectado: string | null;
  situacao: "pendente" | "usado" | "cancelado" | "vencido";
};

const APP = typeof window !== "undefined" ? window.location.origin : "https://app.criasocialclub.com.br";
const linkDo = (token: string) => `${APP}/conectar/${token}`;
const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

// Número do WhatsApp só com dígitos e DDI 55 (cadastro costuma vir "(11) 9...").
function zap(numero: string | null | undefined): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

export function ConviteInstagramCliente({ crmClientId, nomeCliente }: { crmClientId: string; nomeCliente?: string | null }) {
  const qc = useQueryClient();
  const chave = ["ig-convites", crmClientId];
  const [copiado, setCopiado] = useState(false);

  const { data: convites = [] } = useQuery<Convite[]>({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await sbRpc("ig_convites_do_cliente", { _crm_client_id: crmClientId });
      if (error) return [];
      return (data as Convite[]) ?? [];
    },
    // Enquanto tem link pendente, confere de tempos em tempos se a cliente já aceitou.
    refetchInterval: (q) => ((q.state.data as Convite[] | undefined)?.some((c) => c.situacao === "pendente") ? 15_000 : false),
  });
  const { data: cliente } = useQuery<{ name: string | null; whatsapp: string | null; phone: string | null } | null>({
    queryKey: ["crm-client-contato", crmClientId],
    queryFn: async () => {
      const { data } = await sbFrom("crm_clients").select("name, whatsapp, phone").eq("id", crmClientId).maybeSingle();
      return (data as { name: string | null; whatsapp: string | null; phone: string | null } | null) ?? null;
    },
  });

  const pendente = convites.find((c) => c.situacao === "pendente") ?? null;
  const ultimoUsado = convites.find((c) => c.situacao === "usado") ?? null;
  const nome = (nomeCliente ?? cliente?.name ?? "").split(" ")[0];

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await sbRpc("ig_criar_convite", { _crm_client_id: crmClientId });
      if (error) throw new Error(error.message);
      return ((data as Array<{ token: string }>) ?? [])[0];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
    onError: (e: Error) => toast.error(e.message || "Não deu pra gerar o link."),
  });
  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbRpc("ig_cancelar_convite", { _id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Link cancelado."); qc.invalidateQueries({ queryKey: chave }); },
  });

  const mensagem = (token: string) =>
    `Oi${nome ? `, ${nome}` : ""}! Pra eu acompanhar os resultados do seu Instagram e montar os relatórios, toca neste link e aceita no Instagram (leva 1 minuto, sua senha fica com você): ${linkDo(token)}`;

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(mensagem(token));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Mensagem com o link copiada.");
    } catch { toast.error("Não deu pra copiar. Segure no link pra copiar."); }
  };
  const abrirZap = (token: string) => {
    const numero = zap(cliente?.whatsapp ?? cliente?.phone);
    const texto = encodeURIComponent(mensagem(token));
    window.open(numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`, "_blank", "noopener");
  };

  return (
    <div className="w-full max-w-sm mx-auto text-left space-y-3">
      {!pendente ? (
        <Button type="button" onClick={() => gerar.mutate()} disabled={gerar.isPending}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90 text-[15px] font-display font-bold">
          {gerar.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Link2 className="h-4 w-4 mr-2" /> Enviar link pra {nome || "cliente"}</>}
        </Button>
      ) : (
        <div className="rounded-2xl border border-pink-200 bg-pink-50/60 p-3 space-y-2.5">
          <p className="text-[13px] font-body text-foreground">
            <b>Link pronto.</b> Mande pra {nome || "cliente"}: ela abre no celular e aceita no Instagram dela. Vale até {dataBr(pendente.expira_em)}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => abrirZap(pendente.token)} className="h-11 rounded-xl bg-[#25D366] hover:bg-[#1fb857] text-white">
              <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
            </Button>
            <Button type="button" variant="outline" onClick={() => void copiar(pendente.token)} className="h-11 rounded-xl bg-white">
              {copiado ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><Copy className="h-4 w-4 mr-1.5" /> Copiar</>}
            </Button>
          </div>
          <p className="text-xs font-body text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Esperando {nome || "a cliente"} aceitar. Você recebe um aviso no sino.
          </p>
          <div className="flex gap-3 text-xs font-body">
            <button type="button" className="text-muted-foreground underline inline-flex items-center gap-1" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              <RefreshCw className="h-3 w-3" /> Gerar outro
            </button>
            <button type="button" className="text-muted-foreground underline inline-flex items-center gap-1" onClick={() => cancelar.mutate(pendente.id)} disabled={cancelar.isPending}>
              <X className="h-3 w-3" /> Cancelar link
            </button>
          </div>
        </div>
      )}

      {ultimoUsado && !pendente && (
        <p className="text-xs font-body text-muted-foreground text-center">
          Último link aceito em {dataBr(ultimoUsado.usado_em ?? ultimoUsado.criado_em)}{ultimoUsado.username_conectado ? ` por @${ultimoUsado.username_conectado}` : ""}.
        </p>
      )}

      <button type="button" onClick={() => void connectInstagram(crmClientId)}
        className="w-full text-center text-xs font-body text-muted-foreground underline inline-flex items-center justify-center gap-1">
        <Instagram className="h-3 w-3" /> Tenho o acesso da conta: conectar aqui mesmo
      </button>
    </div>
  );
}
