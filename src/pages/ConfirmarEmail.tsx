import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/* /email/confirmar · O BOTÃO DO E-MAIL DE CONFIRMAÇÃO (12/11/2026)
   Antivírus de e-mail abre link sozinho, então abrir a página não confirma
   nada: só o botão confirma (POST no edge confirmar-email). Funciona sem
   login e em outro aparelho. */
export default function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [estado, setEstado] = useState<"pergunta" | "ok" | "invalido" | "muitas">(token ? "pergunta" : "invalido");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://ecbzfjzoqidowrsfsfih.supabase.co"}/functions/v1/confirmar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmar", token }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; motivo?: string };
      setEstado(j.ok ? "ok" : j.motivo === "muitas" ? "muitas" : "invalido");
    } catch {
      setEstado("invalido");
    } finally {
      setEnviando(false);
    }
  };

  const TEXTO = {
    pergunta: { titulo: "Confirmar seu e-mail?", texto: "É por este e-mail que você recupera a senha e recebe os avisos da sua conta no Cria." },
    ok: { titulo: "E-mail confirmado!", texto: "Pronto, era só isso. Pode voltar pro Cria." },
    invalido: { titulo: "Este link não vale mais", texto: "Ele pode ser de um e-mail antigo. Entre no Cria e toque em \"Reenviar\" pra receber um novo." },
    muitas: { titulo: "Muitas tentativas", texto: "Espera um pouco e tenta de novo." },
  }[estado];

  return (
    <div className="min-h-screen grid place-items-center bg-[#F4EFE3] px-4 py-10">
      <div className="w-full max-w-[420px] text-center">
        <img src="/logo-cria.png" alt="Cria" className="mx-auto mb-6 h-10 w-auto" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className={`rounded-[24px] border px-6 py-8 ${estado === "ok" ? "bg-[#E6F0E8] border-[#CFE2D3]" : "bg-white border-[#E8E0D6]"}`}>
          <h1 className={`font-display text-2xl font-extrabold ${estado === "ok" ? "text-[#2E5A3A]" : "text-[#1E1A17]"}`}>{TEXTO.titulo}</h1>
          <p className="mt-2 font-body text-sm text-[#5d554e]">{TEXTO.texto}</p>
          {estado === "pergunta" && (
            <button type="button" onClick={confirmar} disabled={enviando}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2E5A3A] px-6 py-3 font-display text-[15px] font-bold text-white disabled:opacity-60">
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar meu e-mail
            </button>
          )}
          {estado !== "pergunta" && (
            <a href="/app" className="mt-6 inline-flex rounded-full bg-[#1E1A17] px-6 py-3 font-display text-[15px] font-bold text-white">Abrir o Cria</a>
          )}
        </div>
        <a href="https://criasocialclub.com.br" className="mt-6 inline-block font-body text-xs text-[#8A7F76] underline">criasocialclub.com.br</a>
      </div>
    </div>
  );
}
