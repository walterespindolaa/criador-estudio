import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LogoRede } from "@/components/shared/LogoRede";
import { useProfile } from "@/hooks/useProfile";

/* ═══════════════════════════════════════════════════════════════════════════
   COMEÇAR UM POST EM DOIS PASSOS (protótipo aprovado pelo Walter em 25/11/2026:
   "aprovado o mockup"). Antes era uma lista só com os 7 formatos misturados.
   Agora: passo 1 "Onde vai sair?" (a rede), passo 2 "Qual formato?" (só os
   formatos daquela rede, cada um com um desenho pequeno do formato). Escolher
   o formato abre o editor com rede e formato já marcados.
   Quem vê o quê: LinkedIn só o master enquanto a publicação está em teste;
   Instagram, TikTok e YouTube pra todo mundo, porque já são redes de planejar.
   Mobile first: pensado em 390px, pop up centralizado também no celular.
   ═══════════════════════════════════════════════════════════════════════════ */

type Rede = "instagram" | "tiktok" | "youtube" | "linkedin";
type Desenho = "vertical" | "quadrado" | "pilha" | "texto" | "pdf" | "horizontal" | "live";

const REDES: { k: Rede; nome: string; cor: string; resumo: string; master?: boolean }[] = [
  { k: "instagram", nome: "Instagram", cor: "#DD2A7B", resumo: "Reels, carrossel, estático, story" },
  { k: "tiktok", nome: "TikTok", cor: "#FE2C55", resumo: "Vídeo, foto, story" },
  { k: "youtube", nome: "YouTube", cor: "#FF0000", resumo: "Vídeo e Shorts" },
  { k: "linkedin", nome: "LinkedIn", cor: "#0A66C2", resumo: "Texto, documento, fotos, vídeo", master: true },
];

// [código gravado no banco, nome, resumo da estrutura, desenho]. Instagram
// "Estático" grava o code "foto" (ver FORMAT_LABELS).
const FORMATOS: Record<Rede, [string, string, string, Desenho][]> = {
  instagram: [
    ["reels", "Reels", "Gancho · 5 cenas · legenda", "vertical"],
    ["carrossel", "Carrossel", "Capa · lâminas · legenda", "pilha"],
    ["foto", "Estático", "Chamada · legenda", "quadrado"],
    ["story", "Story", "Texto · CTA · notas", "vertical"],
    ["live", "Live", "Tema · pauta · CTA final", "live"],
  ],
  tiktok: [
    ["video", "Vídeo", "Gancho · cenas · legenda", "vertical"],
    ["foto", "Foto", "Fotos em sequência · legenda", "pilha"],
    ["story", "Story", "Vídeo curto · 24 horas", "vertical"],
  ],
  youtube: [
    ["video", "Vídeo", "Título · capítulos · descrição · tags", "horizontal"],
    ["shorts", "Shorts", "Gancho · 1 minuto · título", "vertical"],
  ],
  linkedin: [
    ["texto", "Texto", "Gancho antes do \"ver mais\" · fechamento", "texto"],
    ["documento", "Documento", "PDF em páginas, o carrossel do LinkedIn", "pdf"],
    ["carrossel", "Carrossel de fotos", "2 a 20 fotos · texto do post", "pilha"],
    ["foto", "Foto", "1 imagem · texto do post", "quadrado"],
    ["video", "Vídeo", "Gancho · cenas · texto do post", "vertical"],
  ],
};

const DICA: Record<Rede, string> = {
  instagram: "No Instagram, o vídeo vertical e a capa mandam.",
  tiktok: "No TikTok, os 2 primeiros segundos decidem.",
  youtube: "No YouTube, título e miniatura decidem o clique.",
  linkedin: "No LinkedIn o texto manda: o gancho vem nas 2 primeiras linhas.",
};

// Fundo da pílula da rede no passo 2 (cor da marca, como no protótipo).
const PILULA: Record<Rede, string> = {
  instagram: "linear-gradient(135deg, #F58529, #DD2A7B 55%, #515BD4)", tiktok: "#111", youtube: "#FF0000", linkedin: "#0A66C2",
};

// Formato que o "em branco" de cada rede usa (o editor precisa de um).
const PADRAO: Record<Rede, string> = { instagram: "reels", tiktok: "video", youtube: "video", linkedin: "texto" };

function DesenhoFormato({ d, cor }: { d: Desenho; cor: string }) {
  if (d === "vertical") return <span className="block h-[38px] w-[22px] rounded-md opacity-90" style={{ background: cor }} />;
  if (d === "quadrado") return <span className="block h-8 w-8 rounded-[7px] opacity-90" style={{ background: cor }} />;
  if (d === "horizontal") return <span className="block h-[22px] w-[38px] rounded-md opacity-90" style={{ background: cor }} />;
  if (d === "pilha") return (
    <span className="relative block h-[34px] w-[30px]">
      <i className="absolute left-1.5 top-0 h-[30px] w-6 rounded-md opacity-35" style={{ background: cor }} />
      <i className="absolute left-0 top-1 h-[30px] w-6 rounded-md" style={{ background: cor }} />
    </span>
  );
  if (d === "texto") return (
    <span className="flex w-[30px] flex-col gap-1">
      <i className="h-1 rounded-full" style={{ background: cor }} />
      <i className="h-1 rounded-full opacity-60" style={{ background: cor }} />
      <i className="h-1 w-[70%] rounded-full opacity-40" style={{ background: cor }} />
    </span>
  );
  if (d === "pdf") return (
    <span className="grid h-[34px] w-7 place-items-center rounded-[5px] border-2 bg-white text-[8px] font-extrabold" style={{ borderColor: cor, color: cor }}>PDF</span>
  );
  return (
    <span className="grid h-[30px] w-[30px] place-items-center rounded-full border-[3px]" style={{ borderColor: cor }}>
      <i className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
    </span>
  );
}

const SCRIPT = { fontFamily: "'Grand Hotel', cursive" } as const;

export function FormatPicker({ open, onPick, onBlank, onOpenChange }: {
  open: boolean;
  /** Formato e rede escolhidos: abre o editor com os dois marcados. */
  onPick: (fmt: string, rede: string) => void;
  /** Sem rede: em branco no Instagram, como era antes. Com rede, vem o formato padrão dela. */
  onBlank: (rede?: string, formato?: string) => void;
  onOpenChange: (o: boolean) => void;
}) {
  const { profile } = useProfile();
  const master = profile?.role === "admin";
  const redes = REDES.filter((r) => !r.master || master);
  const [rede, setRede] = useState<Rede | null>(null);
  // Toda vez que abre, volta pro passo 1.
  useEffect(() => { if (open) setRede(null); }, [open]);
  const r = rede ? REDES.find((x) => x.k === rede)! : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-background p-5 pt-5 sm:p-6 gap-0 overflow-x-hidden top-[50%] translate-y-[-50%] max-h-[calc(100dvh-2rem)]">
        {/* Mancha amarela do canto, como no protótipo. */}
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-44 bg-[#FFCF03] opacity-50" style={{ borderRadius: "58% 42% 61% 39% / 45% 55% 45% 55%" }} />

        {!r ? (
          <div className="relative">
            <DialogTitle className="font-display text-[25px] font-extrabold leading-tight pr-10">
              Onde vai <span className="text-primary font-normal text-[28px]" style={SCRIPT}>sair?</span>
            </DialogTitle>
            <DialogDescription className="mt-1.5 mb-3.5 text-[13.5px] leading-snug">
              Escolha a rede. Depois aparecem só os formatos dela, com a estrutura pronta.
            </DialogDescription>
            <div className="grid grid-cols-2 gap-2.5">
              {redes.map((x) => (
                <button key={x.k} type="button" onClick={() => setRede(x.k)}
                  className="relative min-h-[132px] overflow-hidden rounded-[22px] border border-border bg-card px-3 pb-3 pt-3.5 text-left transition-transform active:scale-95 hover:-translate-y-0.5">
                  <span aria-hidden className="absolute -bottom-8 -right-7 h-[100px] w-[110px] opacity-[0.16]" style={{ background: x.cor, borderRadius: "61% 39% 52% 48% / 47% 58% 42% 53%" }} />
                  {x.master && <span className="absolute right-2.5 top-2.5 rounded-full bg-[#FFF1C2] px-[7px] py-[3px] text-[9.5px] font-body font-extrabold text-[#7a5b00]">só master</span>}
                  <LogoRede marca={x.k} tamanho={40} className="relative" />
                  <b className="relative mt-2.5 block font-display text-lg font-extrabold">{x.nome}</b>
                  <small className="relative block text-xs leading-snug text-muted-foreground">{x.resumo}</small>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onBlank()}
              className="mt-3 w-full rounded-[18px] border-[1.5px] border-dashed border-border py-3 text-sm font-body font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              Começar em branco →
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2.5 pr-10">
              <button type="button" onClick={() => setRede(null)} aria-label="Voltar pras redes"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-body font-extrabold text-white" style={{ background: PILULA[r.k] }}>
                <LogoRede marca={r.k} tamanho={20} />{r.nome}
              </span>
            </div>
            <DialogTitle className="mt-3 font-display text-[25px] font-extrabold leading-tight">
              Qual <span className="text-primary font-normal text-[28px]" style={SCRIPT}>formato?</span>
            </DialogTitle>
            <DialogDescription className="mt-1.5 mb-3 text-[13.5px] leading-snug">A estrutura já vem montada pra você preencher.</DialogDescription>
            <div className="mb-3 flex items-center gap-2 rounded-[14px] border border-border bg-card px-2.5 py-2 text-[12.5px] font-body text-muted-foreground">
              <LogoRede marca={r.k} tamanho={22} />{DICA[r.k]}
            </div>
            <div className="flex flex-col gap-2">
              {FORMATOS[r.k].map(([k, nome, resumo, d]) => (
                <button key={k} type="button" onClick={() => onPick(k, r.k)}
                  className="group flex w-full items-center gap-3 rounded-[20px] border border-border bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.97]">
                  <span className="grid h-[52px] w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${r.cor}14` }}>
                    <DesenhoFormato d={d} cor={r.cor} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block font-display text-base font-extrabold leading-tight">{nome}</b>
                    <small className="block text-[12.5px] text-muted-foreground">{resumo}</small>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onBlank(r.k, PADRAO[r.k])}
              className="mt-3 w-full rounded-[18px] border-[1.5px] border-dashed border-border py-3 text-sm font-body font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              Começar em branco no {r.nome} →
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

