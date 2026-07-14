import { useState } from "react";
import { Palette, Copy, Check, Loader2, Sparkles, Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useCrmClient } from "@/hooks/useCrm";

/* ═══════════════════════════════════════════════════════════════════════════
   BRIEFING DE ARTE — dentro do post do cliente

   Aqui a social mídia NÃO quer um prompt de IA. Ela quer o que MANDAR PRO
   DESIGNER: a paleta com os hex, a fonte, o que pode e o que não pode, e o
   texto que vai na peça. Ela escreve isso no WhatsApp, na mão, dez vezes por
   semana — e digita a paleta do cliente de cabeça toda vez.

   O prompt de IA é só UMA DAS SAÍDAS do mesmo briefing (pra quem for gerar
   por IA em vez de mandar pro designer).

   E ele só funciona se o brandbook do cliente existir. Quando não existe, esta
   tela NÃO gera um briefing genérico fingindo que está tudo bem: ela manda a
   pessoa preencher (ou subir o PDF). Briefing inventado é pior que briefing
   nenhum — o designer entrega errado e a culpa cai no CRIA.
   ═══════════════════════════════════════════════════════════════════════════ */

type Brief = {
  direcao: string[];
  evitar: string[];
  textoPeca: { n: number; texto: string }[];
  promptEn: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  crmClientId: string | null;
  clienteNome: string;
  titulo: string;
  formato: string;
  legenda?: string;
  roteiro?: string;
};

const HEXES = /#[0-9a-f]{3,8}/gi;

export function ArtBriefDialog({
  open, onOpenChange, crmClientId, clienteNome, titulo, formato, legenda, roteiro,
}: Props) {
  const { data: cliente } = useCrmClient(crmClientId ?? undefined);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const bc = (cliente?.brand_core ?? {}) as Record<string, string>;
  const cores = (bc.colorPalette ?? "").match(HEXES) ?? [];
  const temMarca = !!(bc.colorPalette || bc.typography || bc.toneOfVoice || bc.visualExpression);

  const gerar = async () => {
    setGerando(true);
    try {
      const r = (await callAIContextBuilder({
        operation: "art-brief",
        data: {
          cliente: clienteNome,
          segmento: cliente?.segment ?? "",
          titulo, formato, legenda,
          paginas: roteiro,
          cores: bc.colorPalette, fontes: bc.typography, tom: bc.toneOfVoice,
          visual: bc.visualExpression, evitar: bc.avoid, publico: bc.audience,
        },
      })) as Brief;
      setBrief({
        direcao: r.direcao ?? [],
        evitar: r.evitar ?? [],
        textoPeca: r.textoPeca ?? [],
        promptEn: r.promptEn ?? "",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(/quota_exceeded/i.test(msg) ? "Cota de IA esgotada este mês." : "Não consegui gerar o briefing agora.");
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (texto: string, marca: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(marca);
      setTimeout(() => setCopiado(null), 1800);
      toast.success("Copiado.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  };

  // O briefing inteiro, do jeito que vai colado no WhatsApp do designer.
  const briefingTexto = brief && [
    `BRIEFING DE ARTE — ${clienteNome}`,
    `Post: ${titulo} (${formato})`,
    "",
    cores.length ? `PALETA: ${cores.join("  ")}` : "",
    bc.typography ? `TIPOGRAFIA: ${bc.typography}` : "",
    "",
    "FAZER:",
    ...brief.direcao.map((d) => `· ${d}`),
    "",
    "NÃO FAZER:",
    ...brief.evitar.map((d) => `· ${d}`),
    "",
    "TEXTO QUE VAI NA PEÇA:",
    ...brief.textoPeca.map((t) => `${t.n}. ${t.texto}`),
  ].filter((l) => l !== undefined).join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-3xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 pr-12">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Palette className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold text-foreground">Briefing de arte</h3>
            <p className="text-[12.5px] font-body text-muted-foreground mt-0.5 truncate">
              {clienteNome} · {titulo || "sem título"}
            </p>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-4 space-y-4">

          {/* Sem brandbook do cliente, isto não funciona — e a gente diz isso,
              em vez de gerar um briefing genérico que faria o designer errar. */}
          {!temMarca ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-4 text-center">
              <p className="font-display text-[14px] font-bold text-foreground">
                Este cliente ainda não tem brandbook
              </p>
              <p className="text-[13px] font-body text-muted-foreground mt-1 leading-relaxed max-w-sm mx-auto">
                Sem paleta e sem fonte, o briefing sairia genérico — e o designer entregaria
                a peça errada. Preencha a marca do cliente (ou suba o PDF do moodboard) e volte aqui.
              </p>
            </div>
          ) : (
            <>
              {/* A marca do cliente, sempre visível: é o que ela mais copia. */}
              <div className="grid gap-3 sm:grid-cols-2">
                {cores.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3.5">
                    <p className="font-display text-[12px] font-bold text-foreground mb-2">Paleta</p>
                    <div className="flex flex-wrap gap-2">
                      {cores.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => copiar(h, h)}
                          className="text-center"
                          title="Copiar o hex"
                        >
                          <i className="block h-11 w-11 rounded-xl border border-black/5" style={{ background: h }} />
                          <span className="mt-1 block font-display text-[10px] font-bold uppercase text-muted-foreground">
                            {copiado === h ? "copiado" : h}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {bc.typography && (
                  <div className="rounded-2xl border border-border bg-card p-3.5">
                    <p className="font-display text-[12px] font-bold text-foreground mb-2">Tipografia</p>
                    <p className="text-[13px] font-body text-foreground leading-relaxed">{bc.typography}</p>
                  </div>
                )}
              </div>

              {!brief ? (
                <Button className="w-full" onClick={gerar} disabled={gerando}>
                  {gerando
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escrevendo o briefing…</>
                    : <><Sparkles className="h-4 w-4 mr-2" /> Gerar o briefing deste post</>}
                </Button>
              ) : (
                <>
                  <Bloco titulo="Fazer" itens={brief.direcao} tom="ok" />
                  <Bloco titulo="Não fazer" itens={brief.evitar} tom="no" />

                  {brief.textoPeca.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-3.5">
                      <p className="font-display text-[12px] font-bold text-foreground mb-2">Texto que vai na peça</p>
                      <div className="space-y-1.5">
                        {brief.textoPeca.map((t) => (
                          <div key={t.n} className="flex gap-2 text-[13px] font-body">
                            <span className="font-display font-bold text-muted-foreground shrink-0">{t.n}</span>
                            <span className="text-foreground">{t.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-600/20 bg-emerald-600/[0.06] px-3.5 py-3">
                    <Info className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <p className="text-[12.5px] font-body leading-relaxed">
                      <b className="font-display">Saiu do brandbook deste cliente</b> — as cores, a fonte, o tom e o
                      que ele não faz. Se estiver errado, o conserto é na ficha do cliente, não aqui.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {brief && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-5 py-3.5">
            <Button className="flex-1 min-w-[180px]" onClick={() => copiar(briefingTexto ?? "", "brief")}>
              {copiado === "brief" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar pro designer
            </Button>
            <Button
              variant="outline"
              className="flex-1 min-w-[180px]"
              onClick={() => copiar(brief.promptEn, "prompt")}
              disabled={!brief.promptEn}
            >
              {copiado === "prompt" ? <Check className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Copiar como prompt de IA
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Bloco({ titulo, itens, tom }: { titulo: string; itens: string[]; tom: "ok" | "no" }) {
  if (itens.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="font-display text-[12px] font-bold text-foreground mb-2">{titulo}</p>
      <div className="space-y-1">
        {itens.map((i) => (
          <div key={i} className="flex gap-2 text-[13px] font-body">
            <span className={cn("font-bold shrink-0", tom === "ok" ? "text-emerald-600" : "text-red-600")}>
              {tom === "ok" ? "✓" : "✗"}
            </span>
            <span className="text-foreground leading-snug">{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ArtBriefDialog;
