import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   /email/pronto · O CLIQUE DOS E-MAILS (01/11/2026, mockup aprovado)

   Os links "Ficou caro", "Outro motivo" e "Descadastre aqui" dos e-mails caem
   aqui. Antivírus de e-mail abrem link sozinhos, então nada é gravado no
   clique: a página mostra o que vai acontecer e só o botão grava (POST no
   edge email-link). Funciona sem login.
     ?a=m&t=..&m=caro   motivo de saída
     ?a=s&t=..          parar os e-mails de dica e lembrete
     ?r=obrigado|saiu|invalido   resultado (também usado pelo próprio edge)
   ═══════════════════════════════════════════════════════════════════════════ */

const MOTIVOS: Record<string, string> = {
  caro: "Ficou caro",
  sem_tempo: "Não tive tempo de usar",
  faltou_funcao: "Faltou uma função",
  outra_ferramenta: "Fui pra outra ferramenta",
  outro: "Outro motivo",
};
const FIM: Record<string, { titulo: string; texto: string }> = {
  obrigado: { titulo: "Obrigado!", texto: "Recebemos. Se quiser contar mais, responde o e-mail: a gente lê tudo." },
  saiu: { titulo: "Pronto", texto: "Você não recebe mais os e-mails de dicas e lembretes. Avisos da sua conta continuam." },
  invalido: { titulo: "Este link não vale mais", texto: "Ele pode ter vencido. Se quiser falar com a gente, é só responder o e-mail." },
};

export default function EmailPronto() {
  const [params] = useSearchParams();
  const acao = params.get("a");
  const token = params.get("t") ?? "";
  const motivo = params.get("m") ?? "";
  const [resultado, setResultado] = useState<string | null>(params.get("r"));
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://ecbzfjzoqidowrsfsfih.supabase.co"}/functions/v1/email-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, ...(acao === "m" ? { m: motivo } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      setResultado(typeof j?.r === "string" && FIM[j.r] ? j.r : "invalido");
    } catch {
      setResultado("invalido");
    } finally {
      setEnviando(false);
    }
  };

  const pergunta = !resultado && acao === "m" && MOTIVOS[motivo]
    ? { titulo: MOTIVOS[motivo], texto: "É isso que pesou na sua saída?", botao: "Sim, mandar" }
    : !resultado && acao === "s"
      ? { titulo: "Parar estes e-mails?", texto: "Você deixa de receber os e-mails de dicas e lembretes. Avisos da sua conta continuam.", botao: "Sim, parar" }
      : null;
  const fim = FIM[resultado ?? ""] ?? (pergunta ? null : FIM.invalido);

  return (
    <div className="min-h-screen grid place-items-center bg-[#F4EFE3] px-4 py-10">
      <div className="w-full max-w-[420px] text-center">
        <img src="/logo-cria.png" alt="Cria" className="mx-auto mb-6 h-10 w-auto" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className={`rounded-[24px] border px-6 py-8 ${fim && resultado !== "invalido" ? "bg-[#E6F0E8] border-[#CFE2D3]" : "bg-white border-[#E8E0D6]"}`}>
          {pergunta ? (
            <>
              <h1 className="font-display text-2xl font-extrabold text-[#1E1A17]">{pergunta.titulo}</h1>
              <p className="mt-2 font-body text-sm text-[#7A7067]">{pergunta.texto}</p>
              <button type="button" onClick={confirmar} disabled={enviando}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2E5A3A] px-6 py-3 font-display text-[15px] font-bold text-white disabled:opacity-60">
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}{pergunta.botao}
              </button>
            </>
          ) : fim && (
            <>
              <h1 className={`font-display text-2xl font-extrabold ${resultado === "invalido" ? "text-[#1E1A17]" : "text-[#2E5A3A]"}`}>{fim.titulo}</h1>
              <p className="mt-2 font-body text-sm text-[#5d554e]">{fim.texto}</p>
            </>
          )}
        </div>
        <a href="https://criasocialclub.com.br" className="mt-6 inline-block font-body text-xs text-[#8A7F76] underline">criasocialclub.com.br</a>
      </div>
    </div>
  );
}
