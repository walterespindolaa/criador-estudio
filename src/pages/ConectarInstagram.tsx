import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, Instagram, Loader2, Lock, ShieldCheck, AlertTriangle, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";

/* ═══════════════════════════════════════════════════════════════════════════
   CONVITE PRA CONECTAR O INSTAGRAM (página pública, 28/09/2026)

   Quem abre é a CLIENTE, no celular, vindo do WhatsApp. Ela não tem conta no
   Cria e não precisa ter. A página diz quem convidou, o que vai ser acessado
   (só números, nunca senha nem publicação), e o botão leva pro Instagram
   dela. Depois do "aceitar", o Instagram devolve pra cá com o resultado.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Convite = {
  situacao: "pendente" | "usado" | "cancelado" | "vencido" | "invalido";
  cliente?: string;
  quem_convidou?: string;
  username_conectado?: string | null;
};

// O que deu errado, em português, sem jargão.
const MOTIVO: Record<string, string> = {
  cancelado: "Você cancelou na tela do Instagram. Sem problema: é só tocar no botão de novo.",
  token_exchange: "O Instagram não confirmou o acesso. Tente de novo.",
  account_fetch: "Não conseguimos ler a sua conta. Confira se ela é profissional (Comercial ou Criador de conteúdo).",
  save_failed: "Deu um erro do nosso lado ao salvar. Tente de novo em alguns minutos.",
};

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#FDFBF5] flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-md flex-1">{children}</div>
      <div className="mt-10"><AssinaturaCria /></div>
    </main>
  );
}

function IconeIg({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`${grande ? "w-16 h-16 rounded-2xl" : "w-12 h-12 rounded-xl"} bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center mx-auto shadow-sm`}>
      <Instagram className={grande ? "h-8 w-8 text-white" : "h-6 w-6 text-white"} />
    </span>
  );
}

export default function ConectarInstagram() {
  useForceLightTheme();
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const resultado = params.get("r");
  const motivo = params.get("m") ?? "";
  const usuario = params.get("u");
  const [indo, setIndo] = useState(false);
  const [erroInicio, setErroInicio] = useState<string | null>(null);

  const { data: convite, isLoading } = useQuery<Convite>({
    queryKey: ["ig-convite", token],
    queryFn: async () => {
      const { data, error } = await sbRpc("ig_convite_publico", { _token: token });
      if (error) return { situacao: "invalido" };
      return (data as Convite) ?? { situacao: "invalido" };
    },
    retry: 1,
  });

  const conectar = async () => {
    setIndo(true);
    setErroInicio(null);
    try {
      const { data, error } = await supabase.functions.invoke("ig-convite-iniciar", { body: { token } });
      const url = (data as { url?: string } | null)?.url;
      if (error || !url) throw new Error((data as { error?: string } | null)?.error ?? "falhou");
      window.location.href = url;
    } catch (e) {
      const cod = e instanceof Error ? e.message : "";
      setErroInicio(
        cod === "convite_vencido" ? "Este link venceu. Peça um novo pra sua social mídia."
        : cod === "convite_usado" ? "Este link já foi usado."
        : cod === "convite_cancelado" ? "Este link foi cancelado. Peça um novo pra sua social mídia."
        : "Não conseguimos abrir o Instagram agora. Tente de novo em instantes.",
      );
      setIndo(false);
    }
  };

  if (isLoading) {
    return <Casca><div className="pt-24 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Casca>;
  }

  // ── Deu certo (voltou do Instagram) ou já estava usado ──
  if (resultado === "ok" || convite?.situacao === "usado") {
    const conta = usuario ?? convite?.username_conectado;
    return (
      <Casca>
        <div className="pt-12 text-center">
          <span className="w-16 h-16 rounded-full bg-green-100 grid place-items-center mx-auto"><CheckCircle2 className="h-9 w-9 text-green-600" /></span>
          <h1 className="mt-5 text-2xl font-display font-extrabold text-foreground">Pronto, está conectado!</h1>
          {conta && <p className="mt-2 text-base font-body text-foreground">Conta liberada: <b>@{conta}</b></p>}
          <p className="mt-3 text-[15px] font-body text-muted-foreground leading-relaxed">
            {convite?.quem_convidou ?? "Sua social mídia"} já recebeu o aviso e passa a acompanhar os resultados do seu Instagram pelo Cria.
            Você pode fechar esta página.
          </p>
        </div>
      </Casca>
    );
  }

  // ── Link que não serve mais ──
  if (!convite || convite.situacao !== "pendente") {
    const texto = convite?.situacao === "vencido" ? "Este link venceu (ele vale 7 dias)."
      : convite?.situacao === "cancelado" ? "Este link foi cancelado."
      : "Este link não é válido.";
    return (
      <Casca>
        <div className="pt-16 text-center">
          <IconeIg grande />
          <h1 className="mt-5 text-xl font-display font-extrabold text-foreground">{texto}</h1>
          <p className="mt-2 text-[15px] font-body text-muted-foreground">Peça um link novo pra sua social mídia. É rapidinho.</p>
        </div>
      </Casca>
    );
  }

  // ── Convite válido ──
  const quem = convite.quem_convidou ?? "Sua social mídia";
  return (
    <Casca>
      <div className="pt-6 text-center">
        <IconeIg grande />
        <h1 className="mt-5 text-[26px] leading-tight font-display font-extrabold text-foreground">
          Libere o seu Instagram pra {quem.split(" ")[0]}
        </h1>
        <p className="mt-3 text-[15px] font-body text-muted-foreground leading-relaxed">
          {quem} quer acompanhar os resultados {convite.cliente ? <>de <b className="text-foreground">{convite.cliente}</b> </> : ""}pelo Cria, pra planejar
          e mostrar nos relatórios o que está funcionando.
        </p>
      </div>

      <ul className="mt-6 space-y-2.5">
        <li className="flex items-start gap-3 rounded-2xl bg-white border border-border p-3.5">
          <BarChart3 className="h-5 w-5 text-[#DD2A7B] shrink-0 mt-0.5" />
          <span className="text-[14px] font-body text-foreground"><b>O que é acessado:</b> números dos posts e da conta (alcance, curtidas, salvamentos, seguidores, público).</span>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-white border border-border p-3.5">
          <Lock className="h-5 w-5 text-[#DD2A7B] shrink-0 mt-0.5" />
          <span className="text-[14px] font-body text-foreground"><b>Sua senha fica com você.</b> O login é feito direto no Instagram.</span>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-white border border-border p-3.5">
          <Eye className="h-5 w-5 text-[#DD2A7B] shrink-0 mt-0.5" />
          <span className="text-[14px] font-body text-foreground"><b>Nada é publicado</b> sem você e ninguém lê suas mensagens. Dá pra tirar o acesso quando quiser, no próprio Instagram.</span>
        </li>
      </ul>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[13px] font-body text-amber-900 leading-relaxed">
          Funciona com conta <b>profissional</b> (Comercial ou Criador de conteúdo). Se a sua for pessoal, mude antes no app do Instagram:
          Configurações, Tipo de conta e ferramentas, Mudar para conta profissional. É grátis e leva 1 minuto.
        </p>
      </div>

      {resultado === "erro" && (
        <p className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-[14px] font-body text-red-800" role="alert">
          {MOTIVO[motivo.split(":")[0]] ?? "Não deu certo desta vez. Tente de novo."}
        </p>
      )}
      {erroInicio && (
        <p className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-[14px] font-body text-red-800" role="alert">{erroInicio}</p>
      )}

      <button
        type="button"
        onClick={() => void conectar()}
        disabled={indo}
        className="mt-6 w-full h-14 rounded-2xl bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white text-[17px] font-display font-bold inline-flex items-center justify-center gap-2 shadow-md disabled:opacity-70"
      >
        {indo ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Instagram className="h-5 w-5" /> Conectar meu Instagram</>}
      </button>
      <p className="mt-3 text-center text-[12px] font-body text-muted-foreground inline-flex w-full items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" /> Conexão oficial pela Meta (Instagram)
      </p>
    </Casca>
  );
}
