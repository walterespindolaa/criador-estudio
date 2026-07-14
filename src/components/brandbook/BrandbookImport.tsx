import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, Check, Sparkles, X, CircleDot,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBrandbookImport, type LeituraBrandbook } from "@/hooks/useBrandbookImport";

/* ═══════════════════════════════════════════════════════════════════════════
   SUBIR O BRANDBOOK EM PDF

   Por que isto existe: o brandbook é o dado do qual TODA a IA do CRIA depende
   (legenda, roteiro, prompt de arte, briefing). E ele é um formulário de vinte
   campos, que ninguém preenche. Então o campo mais importante do produto vive
   vazio, tudo sai genérico, e a pessoa conclui que "a IA do Cria é fraca".

   O dado já existe: a social mídia tem o moodboard do cliente em PDF. A gente
   para de pedir pra digitar e passa a pedir o arquivo.
   "Digite vinte campos" vira "confere o que eu entendi", e confirmar é
   infinitamente mais fácil que criar.

   TRÊS REGRAS QUE NÃO SE NEGOCIAM NESTA TELA:
   1. Nada é salvo sem a pessoa ver. Nunca.
   2. Onde já havia conteúdo, mostra ANTES → DEPOIS. Senão ela salva feliz e
      apaga sem perceber algo que ela mesma tinha ajustado na mão.
   3. Campo que o PDF não trouxe aparece VAZIO e assumido ("não encontrei"),
      nunca preenchido no chute. Chutar é o jeito mais rápido de destruir a
      confiança nesta tela, e o erro sairia invisível em 50 posts.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CampoDef = { chave: string; rotulo: string; ajuda?: string; multi?: boolean };

/** Os campos do cliente são exatamente as chaves de crm_clients.brand_core. */
export const CAMPOS_CLIENTE: CampoDef[] = [
  { chave: "colorPalette", rotulo: "Paleta", ajuda: "os hex da marca", multi: false },
  { chave: "typography", rotulo: "Tipografia", ajuda: "as fontes e pra que serve cada uma" },
  { chave: "toneOfVoice", rotulo: "Tom de voz", multi: true },
  { chave: "visualExpression", rotulo: "Direção visual", ajuda: "tipo de imagem, luz, composição", multi: true },
  { chave: "avoid", rotulo: "O que nunca fazer", multi: true },
  { chave: "personality", rotulo: "Personalidade", multi: true },
  { chave: "audience", rotulo: "Público", multi: true },
  { chave: "valueProp", rotulo: "Promessa da marca", multi: true },
  { chave: "contentThemes", rotulo: "Temas de conteúdo", multi: true },
  { chave: "archetype", rotulo: "Arquétipo" },
];

const HEXES = /#[0-9a-f]{3,8}/gi;

type Props = {
  alvo: "cliente" | "criador";
  campos?: CampoDef[];
  /** O que já existe hoje (pra mostrar o antes → depois). */
  atual: Record<string, string | undefined>;
  /** Só é chamado quando a pessoa confirma. */
  onSalvar: (valores: Record<string, string>) => Promise<void> | void;
  /** Texto do bloco de convite (muda entre criador e cliente). */
  titulo?: string;
  descricao?: string;
};

export function BrandbookImport({ alvo, campos = CAMPOS_CLIENTE, atual, onSalvar, titulo, descricao }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const { etapa, progresso, leitura, arquivo, importar, cancelar } = useBrandbookImport(alvo);

  // Quando a leitura chega, ela vira um RASCUNHO editável. A pessoa mexe à
  // vontade antes de salvar — o que a IA devolveu é sugestão, não decisão.
  useEffect(() => {
    if (etapa !== "pronto" || !leitura) return;
    const r: Record<string, string> = {};
    for (const c of campos) {
      const lido = (leitura.campos as Record<string, { valor?: string } | null>)[c.chave];
      if (lido?.valor) r[c.chave] = lido.valor;
    }
    setRascunho(r);
  }, [etapa, leitura, campos]);

  const pick = (file?: File | null) => { if (file) void importar(file); };

  const salvar = async () => {
    setSalvando(true);
    try {
      // Só vai o que tem conteúdo. Campo vazio não sobrescreve o que existe.
      const limpo: Record<string, string> = {};
      for (const [k, v] of Object.entries(rascunho)) if (v.trim()) limpo[k] = v.trim();
      await onSalvar(limpo);
      cancelar();
    } finally {
      setSalvando(false);
    }
  };

  const lendo = etapa === "lendo" || etapa === "pensando";

  return (
    <>
      {/* ── O CONVITE ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); pick(e.dataTransfer.files?.[0]); }}
        className={cn(
          "rounded-3xl border-2 border-dashed px-5 py-7 text-center transition-colors",
          arrastando ? "border-primary bg-primary/[0.04]" : "border-border bg-muted/20",
        )}
      >
        <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary mb-2.5">
          <FileText className="h-5 w-5" />
        </span>
        <h3 className="font-display text-base font-extrabold text-foreground">
          {titulo ?? "Sobe o moodboard. O Cria preenche."}
        </h3>
        <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
          {descricao ??
            "Você já tem o brandbook em PDF. Não faz sentido digitar tudo de novo num formulário de vinte campos, a gente lê as cores, as fontes, o tom de voz e o que pode e o que não pode."}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={lendo}>
          {lendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {lendo ? "Lendo…" : "Escolher o arquivo"}
        </Button>

        <p className="text-[11.5px] font-body text-muted-foreground mt-3">
          PDF ou imagem · até 10 MB · consome 1 geração da cota de IA
        </p>
      </div>

      {/* ── LENDO (o progresso é honesto: mostra o que está acontecendo) ── */}
      {lendo && (
        <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <p className="font-display text-[13.5px] font-bold text-foreground truncate">
            Lendo “{arquivo?.name}”
          </p>
          <div className="mt-2.5 space-y-1.5">
            <Passo
              feito={etapa === "pensando"}
              indo={etapa === "lendo"}
              texto={
                progresso
                  ? `Abrindo as páginas (${progresso.lidas} de ${progresso.total})`
                  : "Abrindo o arquivo"
              }
            />
            <Passo
              feito={false}
              indo={etapa === "pensando"}
              texto="Lendo a paleta, as fontes e a direção de arte"
            />
          </div>
          <p className="text-[11.5px] font-body text-muted-foreground mt-2.5">
            O arquivo é lido aqui no seu navegador, ele não sobe inteiro pro servidor.
          </p>
        </div>
      )}

      {/* ── A REVISÃO ── */}
      <Dialog open={etapa === "pronto"} onOpenChange={(o) => { if (!o) cancelar(); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-3xl">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4 pr-12">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600/12 text-emerald-700">
              <Check className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-extrabold text-foreground">Confere o que eu entendi</h3>
              <p className="text-[12.5px] font-body text-muted-foreground mt-0.5 leading-snug">
                Nada é salvo antes de você olhar. Onde já havia informação, eu mostro o que vai mudar,
                pra você não apagar sem querer algo que ajustou na mão.
              </p>
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto px-5">
            {campos.map((c) => (
              <CampoRevisao
                key={c.chave}
                def={c}
                atual={atual[c.chave]}
                lido={(leitura?.campos as Record<string, { valor?: string; origem?: string } | null> | undefined)?.[c.chave] ?? null}
                valor={rascunho[c.chave] ?? ""}
                onChange={(v) => setRascunho((r) => ({ ...r, [c.chave]: v }))}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-5 py-3.5">
            <p className="flex-1 min-w-[200px] text-[11.5px] font-body text-muted-foreground leading-snug">
              O arquivo fica guardado nos Arquivos, você consulta quando quiser, e eu posso reler
              se a leitura tiver saído torta.
            </p>
            <Button variant="ghost" onClick={cancelar} disabled={salvando}>
              <X className="h-4 w-4 mr-1.5" /> Descartar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Salvar no brandbook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Passo({ feito, indo, texto }: { feito: boolean; indo: boolean; texto: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-body">
      <span className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full",
        feito ? "bg-emerald-600/15 text-emerald-700" : indo ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
      )}>
        {feito ? <Check className="h-3 w-3" strokeWidth={3} />
          : indo ? <Loader2 className="h-3 w-3 animate-spin" />
          : <CircleDot className="h-3 w-3" />}
      </span>
      <span className={cn(feito || indo ? "text-foreground" : "text-muted-foreground")}>{texto}</span>
    </div>
  );
}

function CampoRevisao({
  def, atual, lido, valor, onChange,
}: {
  def: CampoDef;
  atual?: string;
  lido: { valor?: string; origem?: string } | null;
  valor: string;
  onChange: (v: string) => void;
}) {
  const achou = !!lido?.valor;
  const tinha = !!atual?.trim();
  const muda = achou && tinha && atual!.trim() !== (lido!.valor ?? "").trim();

  const estado = !achou ? "nao" : muda ? "muda" : tinha ? "igual" : "novo";
  const hexes = useMemo(
    () => (def.chave === "colorPalette" ? (valor.match(HEXES) ?? []).slice(0, 8) : []),
    [def.chave, valor],
  );

  return (
    <div className="border-b border-border/60 py-3.5 last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-display text-[13.5px] font-bold text-foreground">{def.rotulo}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[9.5px] font-display font-bold uppercase tracking-wide",
          estado === "novo" && "bg-emerald-600/12 text-emerald-700",
          estado === "muda" && "bg-amber-500/18 text-amber-700",
          estado === "igual" && "bg-muted text-muted-foreground",
          estado === "nao" && "bg-muted text-muted-foreground",
        )}>
          {estado === "novo" ? "novo" : estado === "muda" ? "vai mudar" : estado === "igual" ? "igual ao que já estava" : "não encontrei"}
        </span>
      </div>

      {/* ANTES → DEPOIS. Sem isto, a pessoa salva feliz e apaga o que ela mesma
          tinha escrito. É o item que impede o arrependimento. */}
      {muda && (
        <p className="mb-1.5 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-[11.5px] font-body text-muted-foreground">
          Antes: <s className="opacity-75">{atual}</s>
        </p>
      )}

      {def.multi ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={achou ? "" : "O PDF não trazia isso. Escreva agora ou deixe pra depois."}
          className="w-full rounded-xl border-[1.5px] border-border bg-card px-3 py-2 text-[13.5px] font-body text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y"
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={achou ? "" : "O PDF não trazia isso. Escreva agora ou deixe pra depois."}
          className="w-full rounded-xl border-[1.5px] border-border bg-card px-3 py-2 text-[13.5px] font-body text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      )}

      {hexes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hexes.map((h) => (
            <span key={h} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-body font-semibold">
              <i className="h-3 w-3 rounded-sm border border-black/10" style={{ background: h }} />
              {h}
            </span>
          ))}
        </div>
      )}

      {/* A origem é o que permite conferir de verdade. Sem ela, "confia em mim". */}
      {lido?.origem && (
        <p className="mt-1.5 text-[11px] font-body text-muted-foreground">encontrado na {lido.origem}</p>
      )}
    </div>
  );
}

export default BrandbookImport;
