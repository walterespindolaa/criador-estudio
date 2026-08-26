import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X, Check, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { lerPaginas, validarArquivo } from "@/lib/pdfPages";

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORTAR O RELATÓRIO MESTRE (briefing completo do cliente)

   A social mídia já faz um briefing rico com o cliente (história, diferenciais,
   personas, diagnóstico do perfil, concorrentes) e esse documento morria num
   PDF fora do Cria. Aqui ela sobe o PDF e a leitura preenche AS QUATRO ABAS
   da ficha de uma vez: Brandbook, Persona, Diagnóstico e Concorrência.

   Mesmas regras do import de brandbook:
   1. NADA é salvo sem a pessoa conferir (a leitura vira rascunho editável).
   2. Campo que o documento não trouxe fica de fora (nunca chute).
   3. O que já existia na ficha não é apagado: o import COMPLETA.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RelatorioSalvar = {
  brand: Record<string, string>;
  personas: Record<string, string>[];
  diagnostico: Record<string, string>;
  concorrentes: { name: string; instagram?: string; kind?: string; note?: string }[];
};

type Lido = {
  brand?: Record<string, string | null>;
  personas?: Record<string, string | null>[];
  diagnostico?: Record<string, string | null>;
  concorrentes?: { name?: string | null; instagram?: string | null; kind?: string | null; note?: string | null }[];
  resumo?: string;
};

const BRAND_LABELS: [string, string][] = [
  ["history", "Como a empresa nasceu"], ["brandValues", "Valores"], ["impact", "Impacto/transformação"],
  ["vision", "Onde quer chegar"], ["specialty", "Especialidade"], ["valueProp", "Diferencial"],
  ["offer", "O que vende"], ["products", "Produtos/serviços"], ["audience", "Público-alvo"],
  ["toneOfVoice", "Tom de voz"], ["personality", "Personalidade"], ["avoid", "O que evitar"],
  ["contentThemes", "Temas de conteúdo"], ["coreMessage", "Mensagem central"], ["admiredBrands", "Marcas que admira"],
];
const PERSONA_LABELS: [string, string][] = [
  ["name", "Nome"], ["ageRange", "Faixa etária"], ["gender", "Gênero"], ["region", "Cidade/região"],
  ["spend", "Gasto médio"], ["lifestyle", "Quem é"], ["valuesWhat", "O que valoriza"],
  ["habits", "Interesses/hábitos"], ["buying", "Como compra"], ["seeks", "O que busca"],
  ["loyalty", "O que fideliza"], ["pains", "Dores"], ["desires", "Desejos"],
  ["doubts", "Dúvidas frequentes"], ["howWeServe", "Como a empresa atende"],
];
const DIAG_CHECKS: [string, string][] = [
  ["chkBio", "Bio comunica o que faz"], ["chkFeed", "Feed mostra autoridade"],
  ["chkPinned", "Fixados conectam"], ["chkHighlights", "Destaques eliminam objeções"],
  ["chkVisual", "Identidade com clareza"], ["chkSite", "Direcionamento pro site"],
  ["chkContact", "Canal claro de contato"],
];
const DIAG_TEXTS: [string, string][] = [
  ["bioSuggestion", "Bio sugerida"], ["nameSuggestion", "Nome de perfil sugerido"],
  ["highlightsPlan", "Destaques sugeridos"], ["pinnedPlan", "Fixados sugeridos"], ["notes", "Observações"],
];

type Etapa = "parado" | "lendo" | "pensando" | "pronto";

export function RelatorioImport({ onSalvar }: { onSalvar: (r: RelatorioSalvar) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("parado");
  const [progresso, setProgresso] = useState<{ lidas: number; total: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Rascunho editável (a leitura da IA é sugestão, não decisão).
  const [brand, setBrand] = useState<Record<string, string>>({});
  const [personas, setPersonas] = useState<Record<string, string>[]>([]);
  const [diag, setDiag] = useState<Record<string, string>>({});
  const [comps, setComps] = useState<{ name: string; instagram: string; kind: string; note: string }[]>([]);
  const [resumo, setResumo] = useState("");

  const importar = async (file: File) => {
    const invalido = validarArquivo(file);
    if (invalido) { toast.error(invalido.erro); return; }
    setEtapa("lendo");
    setProgresso(null);
    try {
      // Relatório completo tem 12-14 páginas: teto maior que o do brandbook.
      const paginas = await lerPaginas(file, (lidas, total) => setProgresso({ lidas, total }), 14);
      if (paginas.length === 0) throw new Error("Não consegui abrir esse arquivo.");
      setEtapa("pensando");
      const r = (await callAIContextBuilder({
        operation: "relatorio-read",
        data: { imagens: paginas.map((p) => p.dataUrl) },
      })) as Lido;

      const limpa = (o?: Record<string, string | null>) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(o ?? {})) if (typeof v === "string" && v.trim()) out[k] = v.trim();
        return out;
      };
      const b = limpa(r.brand);
      const ps = (r.personas ?? []).map(limpa).filter((p) => Object.keys(p).length > 0).slice(0, 3);
      const d = limpa(r.diagnostico);
      const cs = (r.concorrentes ?? [])
        .filter((c) => (c.name ?? "").trim())
        .map((c) => ({ name: (c.name ?? "").trim(), instagram: (c.instagram ?? "").trim(), kind: (c.kind ?? "").trim(), note: (c.note ?? "").trim() }));
      if (Object.keys(b).length === 0 && ps.length === 0 && Object.keys(d).length === 0 && cs.length === 0) {
        setEtapa("parado");
        toast.error("Li o arquivo mas não achei conteúdo de briefing nele. Tem certeza que é o relatório do cliente?");
        return;
      }
      setBrand(b); setPersonas(ps); setDiag(d); setComps(cs); setResumo(r.resumo ?? "");
      setEtapa("pronto");
    } catch (e) {
      setEtapa("parado");
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(/quota_exceeded/i.test(msg)
        ? "Você usou todas as gerações de IA deste mês."
        : msg && !/non-2xx/i.test(msg) ? msg : "Não consegui ler o relatório. Tente de novo.");
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar({
        brand,
        personas,
        diagnostico: diag,
        concorrentes: comps.filter((c) => c.name.trim()),
      });
      setEtapa("parado");
    } finally {
      setSalvando(false);
    }
  };

  const fechar = () => { setEtapa("parado"); setProgresso(null); };
  const setP = (i: number, k: string, v: string) =>
    setPersonas((arr) => arr.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <>
      {/* Convite */}
      {/* Barra fina, e não bloco em destaque: esta aba já tem outros dois
          caminhos de subir arquivo (o brandbook em PDF e o anexo do briefing),
          e três convites grandes seguidos pareciam a mesma coisa repetida. */}
      <div className="rounded-2xl border border-border bg-card px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-semibold text-foreground">Relatório completo do cliente em PDF</p>
          <p className="text-[11.5px] font-body text-muted-foreground">
            Preenche Brandbook, Persona, Diagnóstico e Concorrência de uma vez. Você confere antes de salvar.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="shrink-0">
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Escolher arquivo
        </Button>
        <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
      </div>

      {/* Progresso + revisão */}
      {etapa !== "parado" && (
        <Dialog open onOpenChange={(o) => { if (!o) fechar(); }}>
          <DialogContent className="sm:max-w-2xl sm:max-h-[88vh] overflow-y-auto">
            {etapa !== "pronto" ? (
              <div className="py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-display font-bold text-foreground mt-3">
                  {etapa === "lendo"
                    ? `Lendo o relatório${progresso ? ` (página ${progresso.lidas}/${progresso.total})` : ""}...`
                    : "Separando o conteúdo nas abas do cliente..."}
                </p>
                <p className="text-[11.5px] font-body text-muted-foreground mt-1">Nada é salvo sem você conferir.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-display font-extrabold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Confere o que eu entendi
                  </h2>
                  <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                    {resumo || "O conteúdo do relatório, já separado por aba."} Edite o que quiser; o que já existia na ficha não é apagado, o import completa.
                  </p>
                </div>

                {/* BRANDBOOK */}
                {Object.keys(brand).length > 0 && (
                  <div className="rounded-2xl border border-border p-3.5">
                    <p className="text-xs font-display font-extrabold text-primary uppercase tracking-wide mb-2">Aba Brandbook</p>
                    <div className="space-y-2.5">
                      {BRAND_LABELS.filter(([k]) => brand[k] !== undefined).map(([k, l]) => (
                        <div key={k}>
                          <p className="text-[11px] font-body font-semibold text-muted-foreground">{l}</p>
                          <Textarea rows={2} value={brand[k]} onChange={(e) => setBrand({ ...brand, [k]: e.target.value })}
                            className="rounded-xl text-sm mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PERSONAS */}
                {personas.map((p, i) => (
                  <div key={i} className="rounded-2xl border border-border p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-display font-extrabold text-primary uppercase tracking-wide flex-1">
                        Aba Persona · {p.name || `Persona ${i + 1}`}
                      </p>
                      <button type="button" onClick={() => setPersonas((arr) => arr.filter((_, j) => j !== i))}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                        aria-label="Descartar esta persona">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PERSONA_LABELS.filter(([k]) => p[k] !== undefined).map(([k, l]) => (
                        <div key={k}>
                          <p className="text-[11px] font-body font-semibold text-muted-foreground">{l}</p>
                          <Textarea rows={2} value={p[k]} onChange={(e) => setP(i, k, e.target.value)} className="rounded-xl text-sm mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* DIAGNÓSTICO */}
                {Object.keys(diag).length > 0 && (
                  <div className="rounded-2xl border border-border p-3.5">
                    <p className="text-xs font-display font-extrabold text-primary uppercase tracking-wide mb-2">Aba Diagnóstico</p>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {DIAG_CHECKS.filter(([k]) => diag[k] !== undefined).map(([k, l]) => (
                        <button key={k} type="button"
                          onClick={() => setDiag({ ...diag, [k]: diag[k] === "sim" ? "nao" : "sim" })}
                          className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-body font-bold transition-colors",
                            diag[k] === "sim"
                              ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))] border-[hsl(var(--cria-verde)/0.35)]"
                              : "bg-destructive/10 text-destructive border-destructive/30")}>
                          {diag[k] === "sim" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {l}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      {DIAG_TEXTS.filter(([k]) => diag[k] !== undefined).map(([k, l]) => (
                        <div key={k}>
                          <p className="text-[11px] font-body font-semibold text-muted-foreground">{l}</p>
                          <Textarea rows={2} value={diag[k]} onChange={(e) => setDiag({ ...diag, [k]: e.target.value })} className="rounded-xl text-sm mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CONCORRÊNCIA */}
                {comps.length > 0 && (
                  <div className="rounded-2xl border border-border p-3.5">
                    <p className="text-xs font-display font-extrabold text-primary uppercase tracking-wide mb-2">Aba Concorrência</p>
                    <div className="space-y-2">
                      {comps.map((c, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_1fr_auto] gap-2 items-center">
                          <Input value={c.name} onChange={(e) => setComps((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                            placeholder="Nome" className="rounded-xl h-9 text-sm" />
                          <select value={c.kind}
                            onChange={(e) => setComps((arr) => arr.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}
                            className="h-9 rounded-xl border border-input bg-card px-2 text-sm">
                            <option value="">tipo</option>
                            <option value="direto">Direto</option>
                            <option value="indireto">Indireto</option>
                          </select>
                          <Input value={c.note} onChange={(e) => setComps((arr) => arr.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                            placeholder="O que observar" className="rounded-xl h-9 text-sm" />
                          <button type="button" onClick={() => setComps((arr) => arr.filter((_, j) => j !== i))}
                            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                            aria-label="Descartar concorrente">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={fechar} className="rounded-xl">Descartar</Button>
                  <Button onClick={salvar} disabled={salvando} className="rounded-xl">
                    {salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Salvar nas 4 abas
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
