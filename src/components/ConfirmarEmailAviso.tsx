import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ═════════════════════════════════════════════════════════════════
   CONFIRMAR E-MAIL DEPOIS DE ENTRAR (Walter, 12/11/2026)

   A pessoa cadastra, entra e usa. A confirmação do e-mail fica pra depois:
     · dias 1 a 3: faixa discreta no topo (reenviar, corrigir, já confirmei);
     · do 4º dia em diante: tela cheia pedindo a confirmação pra continuar.
   Quem decide se está pendente é o banco (RPC email_confirmacao_status). Conta
   antiga, criada pelo admin ou pela agência nunca fica pendente. Se a RPC
   falhar ou ainda não existir, ninguém vê nada: o aviso nunca tranca por erro.
   ═════════════════════════════════════════════════════════════════ */

type Estado = { pendente: boolean; bloqueia: boolean; email: string | null; dias: number };
const NADA: Estado = { pendente: false, bloqueia: false, email: null, dias: 0 };

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string) => PromiseLike<{ data: unknown; error: unknown }>;

export function useEmailConfirmacao() {
  const { user } = useAuth();
  return useQuery<Estado>({
    queryKey: ["email-confirmacao", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await sbRpc("email_confirmacao_status");
        if (error || !data || typeof data !== "object") return NADA;
        const d = data as Partial<Estado>;
        return { pendente: d.pendente === true, bloqueia: d.bloqueia === true, email: d.email ?? null, dias: Number(d.dias ?? 0) };
      } catch { return NADA; }
    },
  });
}

const MOTIVO: Record<string, string> = {
  muitas: "Muitas tentativas agora. Espera um pouco e tenta de novo.",
  email_invalido: "Esse e-mail não parece certo. Confere e tenta de novo.",
  igual: "Esse já é o e-mail da conta.",
  em_uso: "Esse e-mail já tem uma conta no Cria.",
};

function useAcoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [ocupado, setOcupado] = useState<"" | "enviar" | "corrigir" | "conferir">("");

  const chamar = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("confirmar-email", { body });
    const r = (data ?? {}) as { ok?: boolean; motivo?: string; email?: string; confirmado?: boolean };
    if (error || !r.ok) { toast.error(MOTIVO[r.motivo ?? ""] ?? "Não deu certo agora. Tenta de novo."); return null; }
    return r;
  };

  const reenviar = async () => {
    setOcupado("enviar");
    const r = await chamar({ action: "enviar" });
    setOcupado("");
    if (r?.confirmado) { await qc.invalidateQueries({ queryKey: ["email-confirmacao"] }); return; }
    if (r) toast.success(`Mandamos de novo pra ${r.email ?? "o seu e-mail"}. Olha também o spam.`);
  };

  const corrigir = async (email: string) => {
    setOcupado("corrigir");
    const r = await chamar({ action: "corrigir", email });
    setOcupado("");
    if (!r) return false;
    toast.success(`E-mail trocado. Mandamos a confirmação pra ${r.email}.`);
    /* O login passou a ser o e-mail novo: renova a sessão pra o app enxergar. */
    try { await supabase.auth.refreshSession(); } catch { /* segue com a sessão atual */ }
    await qc.invalidateQueries({ queryKey: ["email-confirmacao"] });
    return true;
  };

  const conferir = async () => {
    setOcupado("conferir");
    await qc.invalidateQueries({ queryKey: ["email-confirmacao"] });
    const atual = qc.getQueryData<Estado>(["email-confirmacao", user?.id]);
    setOcupado("");
    if (atual?.pendente) toast("Ainda não chegou a confirmação. Abre o e-mail e toca no botão.");
    else toast.success("E-mail confirmado. Obrigado!");
  };

  return { ocupado, reenviar, corrigir, conferir };
}

function Corrigir({ onFechar, corrigir, ocupado }: { onFechar: () => void; corrigir: (e: string) => Promise<boolean>; ocupado: boolean }) {
  const [novo, setNovo] = useState("");
  return (
    <form className="flex w-full flex-wrap items-center gap-2"
      onSubmit={async (e) => { e.preventDefault(); if (await corrigir(novo)) onFechar(); }}>
      <input type="email" inputMode="email" autoComplete="email" required value={novo} onChange={(e) => setNovo(e.target.value)}
        placeholder="seu e-mail certo" aria-label="E-mail certo"
        className="h-10 min-w-0 flex-1 rounded-xl border-2 border-[#0A0A0A] bg-white px-3 text-[14px] font-body text-[#0A0A0A] outline-none" />
      <button type="submit" disabled={ocupado}
        className="h-10 rounded-xl border-2 border-[#0A0A0A] bg-[#0A0A0A] px-4 text-[13px] font-bold text-[#F5F3E7] disabled:opacity-60">
        {ocupado ? "Trocando..." : "Trocar e mandar"}
      </button>
      <button type="button" onClick={onFechar} className="h-10 px-2 text-[13px] font-semibold underline underline-offset-2">Cancelar</button>
    </form>
  );
}

/** Faixa dos 3 primeiros dias. Vai no topo da área de conteúdo dos dois layouts. */
export function FaixaConfirmarEmail({ semMargem = false }: { semMargem?: boolean }) {
  const { data } = useEmailConfirmacao();
  const { ocupado, reenviar, corrigir, conferir } = useAcoes();
  const [trocando, setTrocando] = useState(false);
  if (!data?.pendente || data.bloqueia) return null;
  const faltam = Math.max(1, 3 - data.dias);
  return (
    <div role="status" className={`rounded-2xl border-2 border-[#0A0A0A] bg-[#FFE27A] px-4 py-3 text-[#0A0A0A] shadow-[0_3px_0_#0A0A0A] ${semMargem ? "mb-5" : "mx-3 mt-3 md:mx-6"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-[240px] text-[14px] font-body leading-snug">
          <strong className="font-display font-extrabold">Confirme seu e-mail.</strong>{" "}
          Mandamos um link pra <strong className="break-all">{data.email}</strong>. {faltam === 1 ? "Falta 1 dia" : `Faltam ${faltam} dias`} pra confirmar sem travar o acesso.
        </p>
        {!trocando && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={reenviar} disabled={ocupado !== ""}
              className="h-9 rounded-xl border-2 border-[#0A0A0A] bg-white px-3 text-[13px] font-bold disabled:opacity-60">
              {ocupado === "enviar" ? "Mandando..." : "Reenviar"}
            </button>
            <button type="button" onClick={() => setTrocando(true)}
              className="h-9 rounded-xl border-2 border-[#0A0A0A] bg-white px-3 text-[13px] font-bold">E-mail errado?</button>
            <button type="button" onClick={conferir} disabled={ocupado !== ""}
              className="h-9 px-1 text-[13px] font-semibold underline underline-offset-2 disabled:opacity-60">Já confirmei</button>
          </div>
        )}
      </div>
      {trocando && <div className="mt-3"><Corrigir onFechar={() => setTrocando(false)} corrigir={corrigir} ocupado={ocupado === "corrigir"} /></div>}
    </div>
  );
}

/** Tela cheia do 4º dia em diante. Quem decide mostrar é o ProtectedRoute. */
export function TravaConfirmarEmail({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  const { ocupado, reenviar, corrigir, conferir } = useAcoes();
  const [trocando, setTrocando] = useState(false);
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[#F5F3E7] px-5 py-10 text-[#0A0A0A]">
      <div className="w-full max-w-[440px] rounded-[28px] border-2 border-[#0A0A0A] bg-[#FDFBF5] p-6 text-center shadow-[0_8px_0_#0A0A0A]">
        <img src="/logo-cria.png" alt="Cria" className="mx-auto mb-5 h-9 w-auto" />
        <h1 className="font-display text-[26px] font-extrabold leading-[1.05]">Confirme seu e-mail pra continuar</h1>
        <p className="mt-3 text-[15px] font-body leading-[1.5] text-[#3D3A33]">
          Mandamos um link pra <strong className="break-all text-[#0A0A0A]">{email}</strong>. É só abrir o e-mail e tocar em "Confirmar meu e-mail". Tudo o que você fez no Cria continua guardado.
        </p>
        {trocando ? (
          <div className="mt-5"><Corrigir onFechar={() => setTrocando(false)} corrigir={corrigir} ocupado={ocupado === "corrigir"} /></div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={conferir} disabled={ocupado !== ""}
              className="h-12 rounded-2xl border-2 border-[#0A0A0A] bg-[#0A0A0A] font-display text-[16px] font-bold text-[#F5F3E7] disabled:opacity-60">
              {ocupado === "conferir" ? "Conferindo..." : "Já confirmei, entrar"}
            </button>
            <button type="button" onClick={reenviar} disabled={ocupado !== ""}
              className="h-12 rounded-2xl border-2 border-[#0A0A0A] bg-white font-display text-[16px] font-bold disabled:opacity-60">
              {ocupado === "enviar" ? "Mandando..." : "Reenviar o e-mail"}
            </button>
            <button type="button" onClick={() => setTrocando(true)} className="mt-1 text-[14px] font-semibold underline underline-offset-2">Digitei o e-mail errado</button>
          </div>
        )}
        <button type="button" onClick={() => void signOut()} className="mt-6 text-[13px] text-[#5B574E] underline underline-offset-2">Sair da conta</button>
      </div>
    </div>
  );
}
