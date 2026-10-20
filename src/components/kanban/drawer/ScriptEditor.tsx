import { useState } from "react";
import { ChevronDown, Cloud, Image as ImageIcon, Minus, PenLine, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface Section {
  text: string;
  captacao: string;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveThumbnail?: string | null;
  /** id da row em external_media_refs (quando a mídia foi registrada lá) */
  mediaRefId?: string | null;
}

export const emptySection = (): Section => ({
  text: "",
  captacao: "",
  driveFileId: null,
  driveFileName: null,
  driveThumbnail: null,
  mediaRefId: null,
});

type Props = {
  sections: Section[];
  onChange: (next: Section[] | ((prev: Section[]) => Section[])) => void;
  sectionLabel: string;
  picking: boolean;
  onPickDriveForSection: (index: number) => Promise<void>;
  uploadingLocal?: boolean;
  onUploadLocalForSection?: (index: number) => void;
  onRemoveSectionMedia?: (index: number) => void | Promise<void>;
};

export function ScriptEditor({
  sections,
  onChange,
  sectionLabel,
  picking,
  onPickDriveForSection,
  uploadingLocal = false,
  onUploadLocalForSection,
  onRemoveSectionMedia,
}: Props) {
  /* Walter (20/10/2026): "deixar só a cena 1 e 2 e um botão de adicionar cena
     mais visível". O post continua guardando as cenas como sempre (posts antigos
     têm 5 vazias); aqui só mostra até a última que tem algo, no mínimo 2. As
     vazias escondidas são reaproveitadas pelo "Adicionar" antes de criar outra. */
  const [minimo, setMinimo] = useState(2);
  const usada = (s: Section) => !!(s.text?.trim() || s.captacao?.trim() || s.driveFileId);
  let ultimaUsada = -1;
  sections.forEach((s, i) => { if (usada(s)) ultimaUsada = i; });
  const visiveis = Math.min(sections.length, Math.max(minimo, ultimaUsada + 1));
  const rotulo = sectionLabel.toLowerCase();
  /* Recolhida por padrão, igual a legenda (Walter, 20/10/2026: "essa parte das
     cenas ser retrátil igual é a parte das legendas"). Fechada, mostra quantas
     cenas têm texto e o começo da primeira. */
  const [aberto, setAberto] = useState(false);
  const comTexto = sections.filter((s) => s.text?.trim()).length;
  const primeira = sections.find((s) => s.text?.trim())?.text.trim() ?? "";
  const resumo = comTexto === 0
    ? `Nenhuma ${rotulo} escrita ainda. Toque pra abrir.`
    : `${comTexto} ${comTexto === 1 ? rotulo : `${rotulo}s`} · ${primeira.slice(0, 70)}${primeira.length > 70 ? "…" : ""}`;

  const adicionar = () => {
    if (visiveis >= sections.length) onChange(prev => [...prev, emptySection()]);
    setMinimo(visiveis + 1);
  };
  const removerUltima = () => {
    const alvo = visiveis - 1;
    onChange(prev => prev.slice(0, alvo));
    setMinimo(Math.max(1, alvo));
  };

  const updateAt = (index: number, patch: Partial<Section>) => {
    onChange(prev => prev.map((s, j) => (j === index ? { ...s, ...patch } : s)));
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="w-full flex items-start gap-2 text-left">
        <PenLine className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <Label className="font-body text-sm cursor-pointer">{sectionLabel}s</Label>
          {!aberto && <span className="block text-xs font-body text-muted-foreground truncate mt-0.5">{resumo}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (<>
      {sections.slice(0, visiveis).map((sec, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/60 overflow-hidden bg-card/50 hover:border-border transition-colors"
        >
          <div className="flex">
            {/* Coluna esquerda: conteúdo */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span className="text-[9px] font-body uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold">
                  {sectionLabel} {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              <Textarea
                placeholder={`O que acontece na ${sectionLabel.toLowerCase()} ${i + 1}...`}
                value={sec.text}
                onChange={(e) => updateAt(i, { text: e.target.value })}
                className="border-0 bg-transparent px-3 pb-1 pt-0 text-sm font-body resize-none focus-visible:ring-0 min-h-[48px]"
                rows={2}
              />

              <div className="mx-3 border-t border-dashed border-border/40" />

              <Textarea
                placeholder="Como gravar: enquadramento, tom, ação..."
                value={sec.captacao || ""}
                onChange={(e) => updateAt(i, { captacao: e.target.value })}
                className="border-0 bg-muted/40 flex-1 px-3 pt-2 pb-2 text-xs font-body text-foreground placeholder:text-muted-foreground/70 resize-none focus-visible:ring-0 min-h-[36px] w-full"
                rows={1}
              />

              {!sec.driveFileId && (
                <div className="px-3 pb-2.5 pt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={picking}
                    onClick={() => onPickDriveForSection(i)}
                    className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/40 rounded-lg px-2 py-1 transition-all"
                  >
                    <Cloud className="h-3 w-3" />
                    {picking ? "Abrindo..." : "Drive"}
                  </button>
                  {onUploadLocalForSection && (
                    <button
                      type="button"
                      disabled={uploadingLocal}
                      onClick={() => onUploadLocalForSection(i)}
                      className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/40 rounded-lg px-2 py-1 transition-all"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {uploadingLocal ? "Enviando..." : "Galeria / PC"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Coluna direita: mídia */}
            {sec.driveFileId && (
              <div className="relative w-32 sm:w-40 shrink-0 bg-muted/40 border-l border-border/40">
                <img
                  src={
                    sec.driveThumbnail
                      ?? `https://lh3.googleusercontent.com/d/${encodeURIComponent(sec.driveFileId!)}=w400`
                  }
                  alt={sec.driveFileName || ""}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    if (sec.driveThumbnail && el.src === sec.driveThumbnail && sec.driveFileId) {
                      el.src = `https://lh3.googleusercontent.com/d/${encodeURIComponent(sec.driveFileId)}=w400`;
                      return;
                    }
                    el.style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (onRemoveSectionMedia) {
                      onRemoveSectionMedia(i);
                    } else {
                      updateAt(i, { driveFileId: null, driveFileName: null, driveThumbnail: null, mediaRefId: null });
                    }
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white p-1 transition-colors backdrop-blur-sm"
                  aria-label="Remover mídia"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={adicionar}
          className="flex-1 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 text-primary font-body text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" /> Adicionar {rotulo} {visiveis + 1}
        </button>
        {visiveis > 1 && (
          <button
            type="button"
            onClick={removerUltima}
            className="text-xs font-body text-muted-foreground/60 hover:text-destructive flex items-center gap-1 transition-colors shrink-0"
          >
            <Minus className="h-3 w-3" /> Remover {rotulo} {visiveis}
          </button>
        )}
      </div>
      </>)}
    </div>
  );
}
