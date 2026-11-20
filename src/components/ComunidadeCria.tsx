import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmailConfirmacao } from "@/components/ConfirmarEmailAviso";

/* ═════════════════════════════════════════════════════════════════
   COMUNIDADE DO CRIA NO WHATSAPP (Walter, 19-20/11/2026, mockups aprovados)

   · Faixa no topo pra TODO MUNDO até a pessoa clicar em "Entrar na
     comunidade" ou em "Agora não". Qualquer um dos dois esconde de vez.
   · Item fixo "Comunidade" no menu, sempre, pra quem quiser entrar depois.
   · O link mora em wa_config.comunidade_url: trocou lá, muda pra todo mundo.
   · Se a faixa de confirmar e-mail estiver aparecendo, esta espera ela sair.
   Se a RPC falhar, ninguém vê nada (aviso nunca atrapalha).
   ═════════════════════════════════════════════════════════════════ */

type Info = { url: string | null; mostrarFaixa: boolean };
const NADA: Info = { url: null, mostrarFaixa: false };
const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export function useComunidade() {
  const { user } = useAuth();
  return useQuery<Info>({
    queryKey: ["comunidade-cria", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await sbRpc("comunidade_banner");
        if (error || !data || typeof data !== "object") return NADA;
        const d = data as { url?: string | null; mostrar?: boolean };
        return { url: d.url ?? null, mostrarFaixa: d.mostrar === true };
      } catch { return NADA; }
    },
  });
}

/** Abre o convite e marca que a pessoa entrou (a faixa some de vez). */
export function useAbrirComunidade() {
  const qc = useQueryClient();
  const { data } = useComunidade();
  const marcar = async (acao: "entrou" | "adiou") => {
    try { await sbRpc("comunidade_marcar", { _acao: acao }); } catch { /* segue */ }
    qc.setQueriesData<Info>({ queryKey: ["comunidade-cria"] }, (v) => (v ? { ...v, mostrarFaixa: false } : v));
  };
  return {
    url: data?.url ?? null,
    abrir: () => {
      if (!data?.url) return;
      window.open(data.url, "_blank", "noopener,noreferrer");
      void marcar("entrou");
    },
    adiar: () => void marcar("adiou"),
  };
}

const Balao = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
  </svg>
);
export { Balao as IconeComunidade };

export function FaixaComunidade({ semMargem = false }: { semMargem?: boolean }) {
  const { data } = useComunidade();
  const { data: email } = useEmailConfirmacao();
  const { abrir, adiar } = useAbrirComunidade();
  if (!data?.mostrarFaixa || !data.url) return null;
  if (email?.pendente) return null; // um aviso por vez
  return (
    <div role="status" className={`rounded-2xl border-2 border-[#0A0A0A] bg-[#D9F2E0] px-4 py-3 text-[#0A0A0A] shadow-[0_3px_0_#0A0A0A] ${semMargem ? "mb-5" : "mx-3 mt-3 md:mx-6"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-[#01A652] text-white" style={{ borderRadius: "38% 62% 55% 45% / 48% 42% 58% 52%" }}>
          <Balao />
        </span>
        <p className="min-w-0 flex-1 basis-[220px] text-[14px] font-body leading-snug">
          <strong className="font-display font-extrabold">Sua vaga na comunidade do Cria está separada.</strong>{" "}
          <span className="hidden sm:inline">Dicas de conteúdo, novidades do app e cupons que só saem lá no WhatsApp.</span>
          <span className="sm:hidden">Dicas, novidades e cupons que só saem lá.</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={abrir}
            className="h-9 rounded-xl border-2 border-[#0A0A0A] bg-[#01A652] px-3.5 font-display text-[14px] font-extrabold text-white">
            Entrar na comunidade
          </button>
          <button type="button" onClick={adiar}
            className="h-9 px-1 text-[13px] font-semibold underline underline-offset-2">Agora não</button>
        </div>
      </div>
    </div>
  );
}

