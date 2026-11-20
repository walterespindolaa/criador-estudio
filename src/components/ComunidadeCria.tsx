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

type Info = { url: string | null; mostrarFaixa: boolean; entrou: boolean };
const NADA: Info = { url: null, mostrarFaixa: false, entrou: false };
const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export function useComunidade() {
  const { user } = useAuth();
  return useQuery<Info>({
    queryKey: ["comunidade-cria", user?.id],
    enabled: !!user,
    /* Sempre confere de novo ao abrir a tela: a resposta é minúscula, e com 10
       min de cache a faixa ficava com o estado velho depois de entrar/adiar
       (o cache ainda é salvo no aparelho e volta ao recarregar). */
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await sbRpc("comunidade_banner");
        if (error || !data || typeof data !== "object") return NADA;
        const d = data as { url?: string | null; mostrar?: boolean; entrou?: boolean };
        return { url: d.url ?? null, mostrarFaixa: d.mostrar === true, entrou: d.entrou === true };
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
    qc.setQueriesData<Info>({ queryKey: ["comunidade-cria"] }, (v) => (v ? { ...v, mostrarFaixa: false, entrou: v.entrou || acao === "entrou" } : v));
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

/* TOPO OU RODAPÉ (Walter, 20/11/2026): a faixa abre no topo do Início. Quem
   toca em "Agora não" não perde o convite: ele desce pro fim do Início e fica
   lá, sem botão de fechar, até a pessoa entrar. Quem entrou não vê mais. */
export function FaixaComunidade({ semMargem = false, lugar = "topo" }: { semMargem?: boolean; lugar?: "topo" | "rodape" }) {
  const { data } = useComunidade();
  const { data: email } = useEmailConfirmacao();
  const { abrir, adiar } = useAbrirComunidade();
  if (!data?.url || data.entrou) return null;
  if (lugar === "topo" && (!data.mostrarFaixa || email?.pendente)) return null; // um aviso por vez no topo
  if (lugar === "rodape" && data.mostrarFaixa) return null; // nunca as duas ao mesmo tempo
  const rodape = lugar === "rodape";
  /* OPÇÃO B (Walter, 20/11/2026): verde forte, mascote em adesivo, selo
     "cupons só lá". Celular empilha e o botão ocupa a largura; do iPad pra
     cima fica numa linha com o botão à direita. */
  return (
    <div role="status" className={`relative overflow-hidden rounded-[22px] border-2 border-[#0A0A0A] bg-[#01A652] text-white shadow-[0_4px_0_#0A0A0A] ${rodape ? "mt-8" : semMargem ? "mb-5" : "mx-3 mt-3 md:mx-6"}`}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#2BC46F]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-28 hidden h-24 w-24 rounded-full bg-[#FF77B9] opacity-90 md:block" />
      <div className="relative flex flex-col items-stretch gap-4 px-4 py-4 md:flex-row md:items-center md:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3 md:flex-1 lg:gap-4">
          <img src="/comunidade-cria.webp" alt="" width={72} height={72}
            className="h-14 w-14 shrink-0 -rotate-6 rounded-full border-2 border-[#0A0A0A] bg-[#F4EFE3] md:h-16 md:w-16 lg:h-[72px] lg:w-[72px]" />
          <div className="min-w-0">
            <span className="inline-block -rotate-2 rounded-full border-2 border-[#0A0A0A] bg-[#FFCF03] px-2.5 py-0.5 font-display text-[12px] font-extrabold text-[#0A0A0A]">cupons só lá</span>
            <p className="mt-1 font-display text-[19px] font-extrabold leading-[1.05] [text-wrap:balance] md:text-[21px] lg:text-[23px]">Entra pra comunidade do Cria no WhatsApp</p>
            <p className="mt-1 max-w-[62ch] text-[13.5px] font-body leading-snug text-white/90">Dicas de conteúdo toda semana, novidades antes de todo mundo e cupons que não saem em outro lugar.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={abrir}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[#0A0A0A] bg-[#F4EFE3] px-5 font-display text-[15px] font-extrabold text-[#0A0A0A] shadow-[0_3px_0_#0A0A0A] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#0A0A0A] md:flex-none">
            <Balao className="h-5 w-5 text-[#01A652]" />Quero entrar
          </button>
          {!rodape && (
            <button type="button" onClick={adiar}
              className="h-11 px-1 text-[13px] font-semibold text-white/90 underline underline-offset-2">Agora não</button>
          )}
        </div>
      </div>
    </div>
  );
}
