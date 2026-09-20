import { useState } from "react";
import { Clapperboard, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnaliseProfunda } from "@/components/hubcria/AnaliseProfunda";

/* ═══════════════════════════════════════════════════════════════════════════
   ANALISAR UM VÍDEO POR LINK (circuito 14, 20/09/2026) · pedido do Walter

   A análise profunda só existia dentro do card de um post que veio de uma
   pesquisa de concorrente, que por sua vez nasce amarrada a um cliente. Ou
   seja: pra ler UM vídeo que você viu no explorar, tinha que cadastrar um
   concorrente, rodar a pesquisa, esperar, e caçar o post no resultado.

   Aqui é o caminho curto: cola o link, analisa. Sem cliente, sem pesquisa.
   A adaptação pro cliente continua existindo, mas do outro lado do botão,
   dentro do resultado.

   O componente não guarda estado nenhum além do link digitado: a análise mora
   no banco (uma linha por agência e por link) e a tela dela é a mesma do card
   do Radar, de propósito. Duas telas diferentes pro mesmo dado é como as
   versões começam a divergir.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Aceita o link como a pessoa copia: com query, com barra no fim, com m. */
function limparLink(bruto: string): string | null {
  const t = bruto.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (!/instagram\.com|tiktok\.com|youtube\.com|youtu\.be/i.test(u.hostname)) return null;
    // A query do Instagram carrega quem compartilhou; ela suja a chave da
    // análise (mesmo vídeo viraria duas linhas) e não serve pra nada aqui.
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function AnalisarPorLink() {
  const [campo, setCampo] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const analisar = () => {
    const limpo = limparLink(campo);
    if (!limpo) {
      toast.error("Cole o link de um reel do Instagram, TikTok ou YouTube.");
      return;
    }
    setLink(limpo);
  };

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Clapperboard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-display font-extrabold text-foreground">Analisar um vídeo por link</p>
          <p className="text-[12.5px] font-body text-muted-foreground">
            Viu um reel que funcionou? Cola o link e o Cria lê o vídeo inteiro: gancho, arquitetura,
            ritmo, o que copiar e o que evitar. Não precisa ser de cliente nenhum.
          </p>
        </div>
      </div>

      <div className="px-5 pb-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") analisar(); }}
            placeholder="https://www.instagram.com/reel/..."
            inputMode="url"
            className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm font-body min-w-0"
          />
          <button type="button" onClick={analisar} disabled={!campo.trim()}
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-body font-bold disabled:opacity-50 shrink-0">
            Analisar
          </button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground">
          A leitura do vídeo leva um ou dois minutos e tem teto diário, porque consome crédito.
          Analisar o mesmo link de novo reaproveita a análise que já existe.
        </p>
      </div>

      {link && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="text-[11.5px] font-body text-primary hover:underline truncate">
              {link}
            </a>
            <button type="button" onClick={() => { setLink(null); setCampo(""); }}
              aria-label="Fechar esta análise"
              className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* A MESMA tela do card do Radar. Um dado, uma leitura. */}
          <AnaliseProfunda postUrl={link} />
        </div>
      )}
    </div>
  );
}
