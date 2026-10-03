/* ═══════════════════════════════════════════════════════════════════════════
   BOTÃO "SALVAR NO CELULAR" do post (Walter, 03/10/2026 · mockup aprovado
   "Mídias: celular e Drive", tela 1).

   1º toque: abre a gaveta e já começa a baixar todas as mídias (3 por vez).
   Dá pra desmarcar alguma enquanto isso. 2º toque: abre o menu do celular com
   tudo junto ("Salvar N itens" no iPhone). Detalhes do porquê em
   lib/salvarNoCelular.ts. Só aparece em celular/tablet; no computador fica o .zip.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Loader2, Play, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { downloadMediaFile, getThumbnailUrl, isVideoMedia, mediaDownloadName, type MediaLike } from "@/lib/driveMedia";
import { ehVideoDoBunny, emLotes, podeSalvarNoCelular, prepararMidia } from "@/lib/salvarNoCelular";

type Midia = MediaLike & { id: string; file_name: string };
type Estado = { status: "baixando" | "pronto" | "erro"; file?: File };

export function SalvarNoCelular({ midias, titulo }: { midias: Midia[]; titulo?: string }) {
  const [suporta] = useState(podeSalvarNoCelular);
  const [aberto, setAberto] = useState(false);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const rodada = useRef(0);

  const salvaveis = useMemo(() => midias.filter((m) => !ehVideoDoBunny(m)), [midias]);
  const aParte = useMemo(() => midias.filter((m) => ehVideoDoBunny(m)), [midias]);
  const indiceDe = useMemo(() => new Map(midias.map((m, i) => [m.id, i])), [midias]);

  const baixar = (lista: Midia[]) => {
    const minha = rodada.current;
    setEstados((e) => ({ ...e, ...Object.fromEntries(lista.map((m) => [m.id, { status: "baixando" } as Estado])) }));
    void emLotes(lista, 3, async (m) => {
      try {
        const file = await prepararMidia(m, titulo, indiceDe.get(m.id) ?? 0);
        if (rodada.current === minha) setEstados((e) => ({ ...e, [m.id]: { status: "pronto", file } }));
      } catch {
        if (rodada.current === minha) setEstados((e) => ({ ...e, [m.id]: { status: "erro" } }));
      }
    });
  };

  const abrir = () => {
    rodada.current += 1;
    setEstados({});
    setDesmarcadas(new Set());
    setAberto(true);
    baixar(salvaveis);
  };

  // Fechou a gaveta: solta os arquivos da memória e ignora downloads atrasados.
  const fechar = (v: boolean) => {
    if (v) return;
    rodada.current += 1;
    setAberto(false);
    setEstados({});
  };
  useEffect(() => () => { rodada.current += 1; }, []);

  if (!suporta || midias.length === 0) return null;

  const prontos = salvaveis.filter((m) => estados[m.id]?.status === "pronto");
  const baixando = salvaveis.filter((m) => estados[m.id]?.status === "baixando").length;
  const escolhidos = prontos.filter((m) => !desmarcadas.has(m.id));
  const arquivos = escolhidos.map((m) => estados[m.id]!.file!);

  const alternar = (id: string) =>
    setDesmarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const salvar = async () => {
    if (!arquivos.length) return;
    if (!navigator.canShare({ files: arquivos })) {
      toast.error("O celular não aceitou tantos arquivos de uma vez. Desmarque alguns e salve em duas vezes.");
      return;
    }
    setSalvando(true);
    try {
      await navigator.share({ files: arquivos, title: titulo || "Mídias do post" });
      toast.success(arquivos.length === 1 ? "Mídia enviada pro seu celular." : `${arquivos.length} mídias enviadas pro seu celular.`);
      fechar(false);
    } catch (err) {
      // Fechou o menu sem escolher nada: não é erro.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Não consegui abrir o menu do celular. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const rotuloBotao = salvaveis.length === 0
    ? "Nada pra salvar junto"
    : baixando > 0
    ? `Preparando ${prontos.length} de ${salvaveis.length}...`
    : escolhidos.length === 0
      ? "Escolha pelo menos uma"
      : escolhidos.length === 1 ? "Salvar 1 na Galeria" : `Salvar ${escolhidos.length} na Galeria`;

  return (
    <>
      <Button type="button" onClick={abrir} className="w-full h-12 rounded-full text-[15px] font-bold gap-2 bg-[#EA4918] hover:bg-[#D23F12] text-white">
        <Smartphone className="h-5 w-5" />
        {midias.length === 1 ? "Salvar no celular" : `Salvar todas no celular (${midias.length})`}
      </Button>

      <Drawer open={aberto} onOpenChange={fechar}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-display text-lg">Salvar no celular</DrawerTitle>
            <DrawerDescription className="font-body text-[13px]">
              {baixando > 0
                ? "Baixando na qualidade original. Toque numa mídia pra deixar ela de fora."
                : "Tudo pronto. Toque em salvar e escolha \"Salvar itens\" no menu do celular."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-2">
            <div className="grid grid-cols-4 gap-1.5">
              {salvaveis.map((m) => {
                const st = estados[m.id]?.status ?? "baixando";
                const marcada = st === "pronto" && !desmarcadas.has(m.id);
                const thumb = getThumbnailUrl(m, 300);
                const n = (indiceDe.get(m.id) ?? 0) + 1;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={st !== "pronto" && st !== "erro"}
                    aria-pressed={marcada}
                    aria-label={st === "erro" ? `Mídia ${n}: não baixou, tocar pra tentar de novo` : `Mídia ${n}${marcada ? ", vai junto" : ", fica de fora"}`}
                    onClick={() => (st === "erro" ? baixar([m]) : alternar(m.id))}
                    className={`relative aspect-[4/5] overflow-hidden rounded-lg bg-muted border-[3px] transition-colors ${marcada ? "border-[#EA4918]" : "border-transparent"}`}
                  >
                    {thumb && <img src={thumb} alt="" loading="lazy" className={`h-full w-full object-cover ${marcada || st === "baixando" ? "" : "opacity-45"}`} />}
                    <span className="absolute left-1 bottom-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">{n}</span>
                    {isVideoMedia(m) && <Play className="absolute inset-0 m-auto h-5 w-5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" />}
                    {st === "baixando" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>
                    )}
                    {st === "erro" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-[10px] font-bold text-white">
                        <RotateCcw className="h-4 w-4" /> Tentar de novo
                      </span>
                    )}
                    {st === "pronto" && (
                      <span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${marcada ? "bg-[#EA4918]" : "bg-black/30"}`}>
                        {marcada && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {aParte.length > 0 && (
              <div className="mt-3 rounded-xl bg-muted/60 p-3 space-y-2">
                <p className="text-[12.5px] font-body text-muted-foreground leading-snug">
                  {aParte.length === 1 ? "Este vídeo ainda não vai junto. Abra e salve de lá:" : "Estes vídeos ainda não vão junto. Abra cada um e salve de lá:"}
                </p>
                {aParte.map((m) => {
                  const i = indiceDe.get(m.id) ?? 0;
                  return (
                    <Button key={m.id} type="button" variant="outline" size="sm" className="w-full justify-start gap-2"
                      onClick={() => { void downloadMediaFile(m, mediaDownloadName(titulo, i, m)).catch(() => toast.error("Vídeo indisponível.")); }}>
                      <Download className="h-4 w-4" /> Abrir vídeo {i + 1}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" onClick={salvar} disabled={baixando > 0 || escolhidos.length === 0 || salvando}
              className="w-full h-12 rounded-full text-[15px] font-bold gap-2 bg-[#EA4918] hover:bg-[#D23F12] text-white">
              {baixando > 0 || salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {rotuloBotao}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
