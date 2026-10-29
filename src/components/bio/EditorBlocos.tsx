import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Calendar, ChevronDown, Copy, GripVertical, ImagePlus, LayoutTemplate, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useBioBlocks } from "@/hooks/useBioBlocks";
import {
  blocosDoEstilo, faltaNoBloco, lista, mascaraTelefone, metaDoBloco, resumoDoBloco, txt, bool,
  type BioBloco, type DadosBloco, type EstiloBio, type TipoBloco,
} from "@/lib/bioBlocks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICONES_BLOCO, iconeLucide } from "@/lib/bioIcones";
import { CampoTextoRico } from "@/lib/textoRico";
import { aparenciaDoNicho, modelosDoEstilo, type AparenciaModelo, type BlocoDoModelo } from "@/lib/bioTemplates";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FOTO_EXEMPLO, PreviaModelo, PreviaRolando, fotoDoRamo, nomeDoRamo, previaDoNicho } from "@/components/bio/PreviaModelo";
import { EditorItens } from "@/components/bio/EditorItens";
import { EditorAssinatura } from "@/components/bio/EditorAssinatura";
import { BotaoImagem, EscolherFundo, LinhaCampo, SeletorIcone } from "@/components/bio/EditorCampos";
import {
  CampoLeva, EscolherDestino, FormBotoes, FormChamada, FormCupons, FormEtapas, FormMidiaKit, FormPerfilCriadora,
  FormPraQuem, FormServicos, FormVideos,
} from "@/components/bio/FormsSite";
import { ancorasDaPagina } from "@/lib/bioConsultoria";
import { exemploNoBloco, progressoDaPagina, statusDaSecao, type StatusSecao } from "@/lib/bioStatus";
import { DIAS, LIMITE_DO_CARDAPIO, foneWhats, lerHorarios, lerListaColada, telefoneDaPagina } from "@/lib/bioLoja";
import { uploadFileToBunnyStream } from "@/lib/bunny-upload";
import {
  NICHOS, VIDEO_MAX_MB, VIDEO_MAX_SEGUNDOS, blocosDoNicho, fonteAssinatura, guidValido, lerAssinatura, lerAtendimento,
  nichoPorId, resumoAtendimento, urlMapaEmbutido, videoDaCapa,
} from "@/lib/bioEspecialista";

/* ═══════════════════════════════════════════════════════════════════════════
   MONTAR A PÁGINA POR BLOCOS

   A regra que guia esta tela: quem monta é a social mídia entre um cliente e
   outro, muitas vezes no celular. Então nada de formulário longo com dez
   campos abertos ao mesmo tempo. Um bloco por vez, aberto só quando clicado, e
   tudo que a pessoa digita salva sozinho.
   ═══════════════════════════════════════════════════════════════════════════ */

const semSegundos = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const paraIso = (v: string) => (v ? new Date(v).toISOString() : null);


/* ── O FORMULÁRIO DE CADA TIPO ── */
/* ── O VÍDEO DA CAPA (21/10/2026) ──
   Sobe pro Bunny na biblioteca que tem MP4 (ver lib/bioEspecialista). Antes de
   subir, confere a duração: cada visita baixa o vídeo inteiro e o Bunny cobra
   por GB entregue, então vídeo longo na capa é custo sem ganho. */
function duracaoDoVideo(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(NaN); };
    v.src = url;
  });
}

function BotaoVideoCapa({ guid, aoTrocar }: { guid: string; aoTrocar: (guid: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [semMiniatura, setSemMiniatura] = useState(false);
  const video = videoDaCapa(guid);
  useEffect(() => { setSemMiniatura(false); }, [guid]);
  const escolher = async (f: File) => {
    if (!f.type.startsWith("video/")) { toast.error("Escolha um arquivo de vídeo."); return; }
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) { toast.error(`Vídeo grande demais. Até ${VIDEO_MAX_MB} MB.`); return; }
    const s = await duracaoDoVideo(f);
    // Meio segundo de folga: celular grava 8,2s quando a pessoa para no 8.
    if (Number.isFinite(s) && s > VIDEO_MAX_SEGUNDOS + 0.5) {
      toast.error(`O vídeo tem ${Math.round(s)}s. Pra capa, corte em até ${VIDEO_MAX_SEGUNDOS} segundos.`);
      return;
    }
    setSubindo(true);
    try {
      const r = await uploadFileToBunnyStream(f);
      aoTrocar(r.videoGuid);
      toast.success("Vídeo enviado. Ele leva alguns minutos pra ficar pronto; até lá a capa mostra a foto.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui enviar o vídeo.");
    } finally { setSubindo(false); }
  };
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
        {video && !semMiniatura
          ? <img src={video.poster} alt="" className="w-full h-full object-cover" onError={() => setSemMiniatura(true)} />
          : video ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" aria-label="Processando o vídeo" />
          : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={ref} type="file" accept="video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void escolher(f); }} />
        <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{subindo ? "Enviando…" : video ? "Trocar vídeo" : "Enviar vídeo"}
        </Button>
        {video && !subindo && <Button type="button" size="sm" variant="ghost" onClick={() => aoTrocar("")}>Remover</Button>}
      </div>
    </div>
  );
}

function EscolherTema({ valor, onTroca }: { valor: string; onTroca: (v: string) => void }) {
  return (
    <LinhaCampo label="Fundo">
      <div className="flex gap-1.5">
        {[{ v: "escuro", r: "Escuro" }, { v: "claro", r: "Claro" }].map((o) => (
          <button key={o.v} type="button" onClick={() => onTroca(o.v)}
            className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
              (valor || "escuro") === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {o.r}
          </button>
        ))}
      </div>
    </LinhaCampo>
  );
}

/** Lista de nichos que preenche o bloco com o ponto de partida daquele ramo. */
function SugerirPorNicho({ aoEscolher }: { aoEscolher: (id: string) => void }) {
  return (
    <LinhaCampo label="Começar pelo nicho" ajuda="Preenche com o que costuma funcionar no ramo. Troque o que está entre colchetes.">
      <select defaultValue="" aria-label="Começar pelo nicho"
        onChange={(e) => { if (e.target.value) aoEscolher(e.target.value); e.target.value = ""; }}
        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-body">
        <option value="">Escolher nicho…</option>
        {NICHOS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
      </select>
    </LinhaCampo>
  );
}

function FormApresentacao({ d, p }: { d: DadosBloco; p: (patch: DadosBloco) => void }) {
  const [assinando, setAssinando] = useState(false);
  const midia = txt(d, "midia", "video");
  const a = lerAssinatura(d.assinatura);
  const resumoAss = a.modo === "nenhuma" ? "Sem assinatura"
    : a.modo === "desenho" ? "Desenhada à mão" : `Letra cursiva, ${fonteAssinatura(a.fonte).nome.toLowerCase()}`;
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="O que aparece na capa">
        <div className="flex gap-1.5">
          {[{ v: "video", r: "Vídeo em loop" }, { v: "imagem", r: "Foto fixa" }].map((o) => (
            <button key={o.v} type="button" onClick={() => p({ midia: o.v })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
                midia === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {o.r}
            </button>
          ))}
        </div>
      </LinhaCampo>
      {midia === "video" && (
        <LinhaCampo label="Vídeo" ajuda={`Até ${VIDEO_MAX_SEGUNDOS} segundos, em pé, sem precisar de som: ele toca mudo e em loop.`}>
          <BotaoVideoCapa guid={guidValido(txt(d, "video_guid"))} aoTrocar={(g) => p({ video_guid: g })} />
        </LinhaCampo>
      )}
      <LinhaCampo label={midia === "video" ? "Foto de reserva" : "Foto"}
        ajuda={midia === "video" ? "Aparece enquanto o vídeo carrega e pra quem está com internet fraca. Sem ela, usamos um quadro do vídeo." : undefined}>
        <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto" />
      </LinhaCampo>
      <LinhaCampo label="Nome" ajuda="Vazio usa o nome da página.">
        <Input value={txt(d, "nome")} onChange={(e) => p({ nome: e.target.value })} className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Profissão ou especialidade">
        <Input value={txt(d, "profissao")} onChange={(e) => p({ profissao: e.target.value })} placeholder="Nutrição esportiva" className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Assinatura">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-sm font-body text-foreground">{resumoAss}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setAssinando(true)}>Editar assinatura</Button>
        </div>
      </LinhaCampo>
      <EscolherTema valor={txt(d, "tema")} onTroca={(v) => p({ tema: v })} />
      <EditorAssinatura aberto={assinando} aoFechar={() => setAssinando(false)} dados={d}
        nomePadrao={txt(d, "nome")} aoSalvar={(ass, nome) => p({ assinatura: ass, nome })} />
    </div>
  );
}

export function FormBloco({ bloco, salvar, slugPublico, telefonePadrao, secoes = [] }: {
  bloco: BioBloco; salvar: (d: DadosBloco) => void; slugPublico?: string | null; telefonePadrao?: string | null;
  /** Partes desta página que um botão pode alcançar (#servicos, #parceria). */
  secoes?: { id: string; nome: string }[];
}) {
  /* RASCUNHO LOCAL + DEBOUNCE (bug da Gabi, 31/08): antes cada TECLA virava um
     UPDATE no banco + reescrita do cache + re-render, e o re-render no meio da
     composição do teclado comia o acento ("ó" virava "oo") e brigava com o
     campo de horário. Agora quem manda enquanto digita é o estado local; o
     banco recebe meio segundo depois da última tecla e no desmontar. */
  const [d, setD] = useState<DadosBloco>(bloco.data ?? {});
  const dRef = useRef(d);
  const salvarRef = useRef(salvar);
  const sujoRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { dRef.current = d; }, [d]);
  useEffect(() => { salvarRef.current = salvar; }, [salvar]);
  // Trocou de bloco: o rascunho re-hidrata do novo.
  // Só no troca-de-bloco de propósito: re-hidratar a cada volta do banco
  // recriaria o bug (o dado "velho" do cache atropelando o que se digita).
  useEffect(() => {
    setD(bloco.data ?? {});
    sujoRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.id]);
  // Fechou/desmontou com mudança pendente: salva na hora, nada se perde.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (sujoRef.current) salvarRef.current(dRef.current);
  }, []);
  const p = (patch: DadosBloco) => {
    const novo = { ...dRef.current, ...patch };
    dRef.current = novo;
    setD(novo);
    sujoRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { sujoRef.current = false; salvarRef.current(novo); }, 500);
  };

  switch (bloco.kind) {
    case "titulo":
      return (
        <LinhaCampo label="Texto do título">
          <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
            placeholder="Ex.: Meus serviços" className="rounded-xl" />
        </LinhaCampo>
      );

    case "link":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="O que escrever no botão">
            <Textarea rows={2} value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Ex.: Cardápio de outono" className="rounded-xl resize-none" />
          </LinhaCampo>
          <LinhaCampo label="Para onde leva" ajuda="Cole o endereço completo, começando com https://">
            <Input value={txt(d, "url")} onChange={(e) => p({ url: e.target.value })}
              placeholder="https://" inputMode="url" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Imagem de capa"
            ajuda="Botão com imagem é clicado bem mais que botão só de texto. Vale usar nos dois ou três principais.">
            <BotaoImagem valor={txt(d, "capa")} onTroca={(u) => p({ capa: u })} rotulo="Enviar capa" />
          </LinhaCampo>
          {!txt(d, "capa") && (
            <LinhaCampo label="Ícone (opcional)" ajuda="Aparece antes do texto do botão. Toque de novo pra tirar.">
              <SeletorIcone valor={txt(d, "icone")} onTroca={(v) => p({ icone: v })} />
            </LinhaCampo>
          )}
        </div>
      );

    case "whatsapp":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="O que escrever no botão">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Vamos conversar?" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Telefone com DDD">
            <Input value={txt(d, "telefone")} onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })}
              placeholder="(00) 00000-0000" inputMode="tel" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Mensagem que já vem escrita"
            ajuda="Quando a pessoa toca, a conversa abre com este texto pronto. Ajuda a saber de onde ela veio.">
            <Textarea rows={2} value={txt(d, "mensagem")} onChange={(e) => p({ mensagem: e.target.value })}
              placeholder="Oi! Vim pelo link da bio." className="rounded-xl resize-none" />
          </LinhaCampo>
        </div>
      );

    case "texto":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título (opcional)">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Texto">
            <CampoTextoRico valor={txt(d, "texto")} onChange={(v) => p({ texto: v })} rows={6}
              placeholder="Escreva como você falaria com o cliente." />
          </LinhaCampo>
          <LinhaCampo label="Foto (opcional)" ajuda="Aparece acima do texto, no topo do card.">
            <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto"
              forma={txt(d, "imagem_forma")} onForma={(f) => p({ imagem_forma: f })} />
          </LinhaCampo>
        </div>
      );

    case "video":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título (opcional)">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Link do vídeo"
            ajuda="Cole o endereço do YouTube, do Reels, do TikTok ou do Vimeo. O vídeo toca dentro da página.">
            <Input value={txt(d, "url")} onChange={(e) => p({ url: e.target.value })}
              placeholder="https://www.instagram.com/reel/..." inputMode="url" className="rounded-xl" />
          </LinhaCampo>
        </div>
      );

    case "spotify":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título (opcional)">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Link do Spotify"
            ajuda="Cole o link da playlist, do álbum, da faixa ou do podcast. O player toca dentro da página.">
            <Input value={txt(d, "url")} onChange={(e) => p({ url: e.target.value })}
              placeholder="https://open.spotify.com/playlist/..." inputMode="url" className="rounded-xl" />
          </LinhaCampo>
        </div>
      );

    case "galeria": {
      const fotos = lista<string>(d, "imagens");
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título (opcional)">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Formato das fotos">
            <div className="inline-flex rounded-full bg-muted p-1 gap-1" role="radiogroup" aria-label="Formato das fotos">
              {([["quadrada", "Quadrada", "w-3 h-3"], ["retangular", "Retangular (em pé)", "w-[11px] h-3.5"]] as const).map(([v, rot, ico]) => {
                const on = (txt(d, "formato") || "quadrada") === v;
                return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => p({ formato: v })}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-body font-bold transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <i className={`inline-block rounded-[3px] border-2 border-current ${ico}`} />{rot}
                  </button>
                );
              })}
            </div>
          </LinhaCampo>
          <div className="space-y-2">
            <Label className="font-body text-xs">Fotos</Label>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className={`relative rounded-lg overflow-hidden border border-border ${txt(d, "formato") === "retangular" ? "aspect-[4/5]" : "aspect-square"}`}>
                  <img src={f} alt="" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remover foto"
                    onClick={() => p({ imagens: fotos.filter((_, n) => n !== i) })}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <BotaoImagem valor="" rotulo="Adicionar foto" aspecto={txt(d, "formato") === "retangular" ? 4 / 5 : 1}
              onTroca={(u) => { if (u) p({ imagens: [...fotos, u] }); }} />
          </div>
        </div>
      );
    }

    case "faq": {
      const itens = lista<{ p?: string; r?: string }>(d, "itens");
      const trocar = (i: number, patch: { p?: string; r?: string }) =>
        p({ itens: itens.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título do bloco">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          {itens.map((it, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-body font-semibold text-muted-foreground">Pergunta {i + 1}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => p({ itens: itens.filter((_, n) => n !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input value={it.p ?? ""} onChange={(e) => trocar(i, { p: e.target.value })}
                placeholder="Ex.: Atende fora da cidade?" className="rounded-xl" />
              <Textarea rows={2} value={it.r ?? ""} onChange={(e) => trocar(i, { r: e.target.value })}
                placeholder="A resposta" className="rounded-xl resize-none" />
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => p({ itens: [...itens, { p: "", r: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar pergunta
          </Button>
        </div>
      );
    }

    case "contagem":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="O que escrever em cima">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Ex.: Turma de setembro fecha em" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Acaba quando" ajuda="Quando a contagem zerar, o bloco some da página sozinho.">
            <Input type="datetime-local" value={semSegundos(txt(d, "ate") || null)}
              onChange={(e) => p({ ate: paraIso(e.target.value) ?? "" })} className="rounded-xl" />
          </LinhaCampo>
        </div>
      );

    case "mapa":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Onde estamos" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Endereço completo"
            ajuda="Rua, número, bairro e cidade. É o que vai abrir no Google Maps, no Waze e no Apple Maps.">
            <Textarea rows={2} value={txt(d, "endereco")} onChange={(e) => p({ endereco: e.target.value })}
              placeholder="Rua das Flores, 120, Centro, Joinville, SC" className="rounded-xl resize-none" />
          </LinhaCampo>
          <LinhaCampo label="Horário (opcional)">
            <Textarea rows={2} value={txt(d, "horario")} onChange={(e) => p({ horario: e.target.value })}
              placeholder={"Seg a sex, 9h às 18h\nSáb, 9h às 13h"} className="rounded-xl resize-none" />
          </LinhaCampo>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-body font-medium">Mostrar o mapa</p>
              <p className="text-[11px] font-body text-muted-foreground">Desligado, aparece só o endereço e os botões de rota.</p>
            </div>
            <Switch checked={bool(d, "mostrarMapa", true)} onCheckedChange={(v) => p({ mostrarMapa: v })} />
          </div>
        </div>
      );

    case "parceria":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Frase de apoio">
            <Input value={txt(d, "subtitulo")} onChange={(e) => p({ subtitulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <label className="flex items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary shrink-0" checked={bool(d, "pedirEmpresa")}
              onChange={(e) => p({ pedirEmpresa: e.target.checked })} />
            <span>
              <span className="block text-sm font-body font-medium">Perguntar a marca ou empresa</span>
              <span className="block text-[11px] font-body text-muted-foreground">Pra criadora: você sabe de cara quem está chamando.</span>
            </span>
          </label>
          <LinhaCampo label="Texto do botão">
            <Input value={txt(d, "botao")} onChange={(e) => p({ botao: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Aviso de consentimento" ajuda="Fica ao lado da caixinha que a pessoa marca antes de enviar.">
            <Textarea rows={2} value={txt(d, "consentimento")} onChange={(e) => p({ consentimento: e.target.value })}
              className="rounded-xl resize-none" />
          </LinhaCampo>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-2.5">
            <div>
              <p className="text-sm font-body font-medium">Mandar pro funil</p>
              <p className="text-[11px] font-body text-muted-foreground">
                Cada proposta vira um card na coluna Novo do CRM. Ligado ou não, você recebe por e-mail e no sino.
              </p>
            </div>
            <Switch checked={bool(d, "paraPipeline")} onCheckedChange={(v) => p({ paraPipeline: v })} />
          </div>
        </div>
      );

    case "captura":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Frase de apoio">
            <Input value={txt(d, "subtitulo")} onChange={(e) => p({ subtitulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <div className="space-y-1.5">
            <Label className="font-body text-xs">O que pedir</Label>
            <div className="grid grid-cols-3 gap-2">
              {([["email", "E-mail"], ["telefone", "Telefone"], ["ambos", "Os dois"]] as const).map(([v, r]) => (
                <button key={v} type="button" onClick={() => p({ campos: v })}
                  className={cn("rounded-xl border-2 py-2.5 text-sm font-body transition-all",
                    txt(d, "campos", "ambos") === v ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-primary/30")}>
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-body text-muted-foreground">O nome é sempre pedido.</p>
          </div>
          <LinhaCampo label="Texto do botão">
            <Input value={txt(d, "botao")} onChange={(e) => p({ botao: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Aviso de consentimento"
            ajuda="Fica ao lado da caixinha que o visitante marca antes de enviar.">
            <Textarea rows={2} value={txt(d, "consentimento")} onChange={(e) => p({ consentimento: e.target.value })}
              className="rounded-xl resize-none" />
          </LinhaCampo>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-2.5">
            <div>
              <p className="text-sm font-body font-medium">Mandar pro pipeline</p>
              <p className="text-[11px] font-body text-muted-foreground">
                Cada contato vira um card na coluna Novo do CRM. Deixe desligado em material gratuito, pra o quadro não encher.
              </p>
            </div>
            <Switch checked={bool(d, "paraPipeline")} onCheckedChange={(v) => p({ paraPipeline: v })} />
          </div>
        </div>
      );

    /* ── SEÇÕES DO MODO SITE ── */
    case "apresentacao":
      return <FormApresentacao d={d} p={p} />;

    case "numeros": {
      const itens = lista<{ valor?: string; rotulo?: string }>(d, "itens");
      const trocar = (i: number, patch: { valor?: string; rotulo?: string }) =>
        p({ itens: itens.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
      const nicho = nichoPorId(txt(d, "nicho"));
      return (
        <div className="space-y-3.5">
          <SugerirPorNicho aoEscolher={(id) => {
            const n = nichoPorId(id);
            if (n) p({ nicho: n.id, itens: n.numeros.map((x) => ({ ...x })), local: n.local, registro: n.registro });
          }} />
          {nicho?.aviso && (
            <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11.5px] font-body text-amber-900 leading-snug">{nicho.aviso}</p>
          )}
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[96px_1fr_auto] gap-2 items-center">
              <Input value={it.valor ?? ""} onChange={(e) => trocar(i, { valor: e.target.value })} placeholder="12" className="rounded-xl" aria-label={`Número ${i + 1}`} />
              <Input value={it.rotulo ?? ""} onChange={(e) => trocar(i, { rotulo: e.target.value })} placeholder="anos de consultório" className="rounded-xl" aria-label={`O que o número ${i + 1} quer dizer`} />
              <Button type="button" size="icon" variant="ghost" aria-label={`Tirar o número ${i + 1}`} onClick={() => p({ itens: itens.filter((_, n) => n !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {itens.length < 4 && (
            <Button type="button" size="sm" variant="outline" onClick={() => p({ itens: [...itens, { valor: "", rotulo: "" }] })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar número
            </Button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LinhaCampo label="Onde atende" ajuda="Vazio usa o resumo do bloco Onde atende.">
              <Input value={txt(d, "local")} onChange={(e) => p({ local: e.target.value })} placeholder="Itajaí e online" className="rounded-xl" />
            </LinhaCampo>
            <LinhaCampo label="Registro ou horário">
              <Input value={txt(d, "registro")} onChange={(e) => p({ registro: e.target.value })} placeholder="CRN 0000" className="rounded-xl" />
            </LinhaCampo>
          </div>
          <EscolherTema valor={txt(d, "tema")} onTroca={(v) => p({ tema: v })} />
        </div>
      );
    }

    case "atendimento": {
      const a = lerAtendimento(d);
      const formas = (d.formas && typeof d.formas === "object" ? d.formas : {}) as Record<string, boolean>;
      const marcar = (k: string, v: boolean) => {
        const patch: DadosBloco = { formas: { ...formas, [k]: v } };
        // Marcou presencial sem nenhum local: já abre o primeiro pra preencher.
        if (k === "presencial" && v && !a.locais.length) patch.locais = [{ nome: "", endereco: "", cidade: "", horario: "" }];
        p(patch);
      };
      const trocarLocal = (i: number, patch: Partial<{ nome: string; endereco: string; cidade: string; horario: string }>) =>
        p({ locais: a.locais.map((l, n) => (n === i ? { ...l, ...patch } : l)) });
      const OPCOES = [
        { k: "presencial", r: "Endereço físico", e: "Consultório, loja, salão, escritório" },
        { k: "online", r: "Online", e: "Vídeo, WhatsApp, curso" },
        { k: "domicilio", r: "Vai até o cliente", e: "Em casa, na empresa, no imóvel" },
        { k: "entrega", r: "Entrega ou retirada", e: "Comida, produto, encomenda" },
      ];
      const resumo = resumoAtendimento(a);
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título da seção">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Onde atendo" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Como atende" ajuda="Pode marcar mais de um.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPCOES.map((o) => (
                <label key={o.k} className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer",
                  formas[o.k] ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary shrink-0" checked={!!formas[o.k]}
                    onChange={(e) => marcar(o.k, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="block text-xs font-body font-semibold text-foreground">{o.r}</span>
                    <span className="block text-[11px] font-body text-muted-foreground leading-snug">{o.e}</span>
                  </span>
                </label>
              ))}
            </div>
          </LinhaCampo>

          {a.presencial && (
            <div className="space-y-2.5">
              {a.locais.map((l, i) => (
                <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-body font-semibold text-muted-foreground">Local {i + 1}</span>
                    {a.locais.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" aria-label={`Tirar o local ${i + 1}`}
                        onClick={() => p({ locais: a.locais.filter((_, n) => n !== i) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input value={l.nome} onChange={(e) => trocarLocal(i, { nome: e.target.value })} placeholder="Nome do lugar (Clínica Movimento)" className="rounded-xl" aria-label="Nome do lugar" />
                  <Input value={l.endereco} onChange={(e) => trocarLocal(i, { endereco: e.target.value })} placeholder="Rua, número, bairro" className="rounded-xl" aria-label="Endereço" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={l.cidade} onChange={(e) => trocarLocal(i, { cidade: e.target.value })} placeholder="Cidade" className="rounded-xl" aria-label="Cidade" />
                    <Input value={l.horario} onChange={(e) => trocarLocal(i, { horario: e.target.value })} placeholder="Seg a sex, 8h às 18h" className="rounded-xl" aria-label="Horário" />
                  </div>
                </div>
              ))}
              {a.locais.length < 4 && (
                <Button type="button" size="sm" variant="outline"
                  onClick={() => p({ locais: [...a.locais, { nome: "", endereco: "", cidade: "", horario: "" }] })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Outro endereço
                </Button>
              )}
            </div>
          )}

          {(a.domicilio || a.entrega) && (
            <LinhaCampo label={a.entrega && !a.domicilio ? "Onde entrega" : "Região que atende"} ajuda="Bairros ou cidades. Aparece no lugar do endereço.">
              <Input value={a.regiao} onChange={(e) => p({ regiao: e.target.value })} placeholder="Itajaí, Navegantes e Balneário Camboriú" className="rounded-xl" />
            </LinhaCampo>
          )}
          {a.entrega && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LinhaCampo label="Prazo e taxa">
                <Input value={a.entrega_texto} onChange={(e) => p({ entrega_texto: e.target.value })} placeholder="2 dias de antecedência, taxa por bairro" className="rounded-xl" />
              </LinhaCampo>
              <LinhaCampo label="Retirada (opcional)">
                <Input value={a.retirada} onChange={(e) => p({ retirada: e.target.value })} placeholder="No ateliê, Centro" className="rounded-xl" />
              </LinhaCampo>
            </div>
          )}
          {a.online && (
            <LinhaCampo label="Como é o online">
              <Textarea rows={2} value={a.online_texto} onChange={(e) => p({ online_texto: e.target.value })}
                placeholder="Consulta por vídeo, com o mesmo acompanhamento do presencial." className="rounded-xl resize-none" />
            </LinhaCampo>
          )}
          {resumo && (
            <p className="text-[11.5px] font-body text-muted-foreground">
              Embaixo dos números aparece: <span className="font-semibold text-foreground">{resumo}</span>
            </p>
          )}
          {!urlMapaEmbutido("x") && a.presencial && (
            <p className="text-[11px] font-body text-muted-foreground">O endereço abre rota no Google Maps e no Waze. O mapa dentro da página entra quando a chave do Google estiver ligada.</p>
          )}
          <EscolherTema valor={txt(d, "tema")} onTroca={(v) => p({ tema: v })} />
        </div>
      );
    }

    case "acao_fixa":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Texto do botão" ajuda="Um verbo e o que a pessoa ganha. Ele fica preso no pé da tela o tempo todo.">
            <Input value={txt(d, "texto")} onChange={(e) => p({ texto: e.target.value })} placeholder="Agendar consulta" maxLength={40} className="rounded-xl" />
          </LinhaCampo>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...NICHOS.map((n) => n.cta), "Fazer pedido", "Fechar uma parceria"])).map((c) => (
              <button key={c} type="button" onClick={() => p({ texto: c })}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-body text-muted-foreground hover:text-foreground hover:border-primary/40 min-h-[28px]">{c}</button>
            ))}
          </div>
          <LinhaCampo label="Ícone" ajuda="Vai antes do texto. Sem ícone, o botão leva uma seta no fim.">
            <SeletorIcone valor={txt(d, "icone")} onTroca={(v) => p({ icone: v })} />
          </LinhaCampo>
          <EscolherDestino d={d} p={p} telefonePadrao={telefonePadrao} secoes={secoes} />
          <p className="text-[11px] font-body text-muted-foreground">A cor do botão é a cor da marca, a mesma dos outros botões da página.</p>
        </div>
      );

    case "capa": {
      const layout = txt(d, "layout", "padrao");
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Formato da capa">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {[
                { v: "padrao", r: "Texto e foto", e: "Foto ao lado do título" },
                { v: "editorial", r: "Editorial", e: "Título grande, foto recortada e 2 números" },
                { v: "foto_cheia", r: "Foto cheia", e: "Vitrine, com \"Aberto agora\"" },
              ].map((o) => (
                <button key={o.v} type="button" onClick={() => p({ layout: o.v })}
                  className={cn("rounded-xl border px-3 py-2 text-left min-h-[44px]",
                    layout === o.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}>
                  <span className={cn("block text-xs font-body font-semibold", layout === o.v ? "text-primary" : "text-foreground")}>{o.r}</span>
                  <span className="block text-[10.5px] font-body text-muted-foreground leading-snug">{o.e}</span>
                </button>
              ))}
            </div>
          </LinhaCampo>
          {layout === "editorial" && (
            <LinhaCampo label="Linha pequena em cima" ajuda="O que você faz e pra quem, em poucas palavras.">
              <Input value={txt(d, "etiqueta")} onChange={(e) => p({ etiqueta: e.target.value })} maxLength={60}
                placeholder="Consultoria de processos · pequenas empresas" className="rounded-xl" />
            </LinhaCampo>
          )}
          <LinhaCampo label="Título grande" ajuda="A promessa em uma linha. É a primeira coisa que a pessoa lê.">
            <Textarea rows={2} value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Sua operação servindo melhor e lucrando mais" className="rounded-xl resize-none" />
          </LinhaCampo>
          {layout === "editorial" && (
            <LinhaCampo label="Palavra em destaque (opcional)" ajuda="Uma palavra do título que fica em itálico, na cor da marca.">
              <Input value={txt(d, "destaque")} onChange={(e) => p({ destaque: e.target.value })} maxLength={30} placeholder="você" className="rounded-xl" />
            </LinhaCampo>
          )}
          <LinhaCampo label="Frase de apoio">
            <Textarea rows={3} value={txt(d, "frase")} onChange={(e) => p({ frase: e.target.value })}
              placeholder="Pra quem é, o que resolve e onde atende." className="rounded-xl resize-none" />
          </LinhaCampo>
          <LinhaCampo label="Foto do topo">
            <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto" />
          </LinhaCampo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LinhaCampo label="Botão principal">
              <Input value={txt(d, "botao1")} onChange={(e) => p({ botao1: e.target.value })}
                placeholder="Quero uma conversa" className="rounded-xl" />
            </LinhaCampo>
            <LinhaCampo label="Leva para">
              <CampoLeva valor={txt(d, "url1")} onTroca={(v) => p({ url1: v })} secoes={secoes} />
            </LinhaCampo>
            <LinhaCampo label="Botão secundário (opcional)">
              <Input value={txt(d, "botao2")} onChange={(e) => p({ botao2: e.target.value })}
                placeholder="Ver serviços" className="rounded-xl" />
            </LinhaCampo>
            <LinhaCampo label="Leva para">
              <CampoLeva valor={txt(d, "url2")} onTroca={(v) => p({ url2: v })} secoes={secoes} />
            </LinhaCampo>
          </div>
          {layout === "editorial" && (() => {
            const nums = [0, 1].map((n) => lista<{ valor?: string; rotulo?: string }>(d, "numeros")[n] ?? { valor: "", rotulo: "" });
            const trocarNum = (n: number, patch: { valor?: string; rotulo?: string }) =>
              p({ numeros: nums.map((x, k) => (k === n ? { ...x, ...patch } : x)) });
            return (
              <>
                <LinhaCampo label="Dois números ao lado da foto" ajuda="Número vazio não aparece. Ele sobe de 0 até o valor quando a página abre.">
                  <div className="space-y-2">
                    {nums.map((x, n) => (
                      <div key={n} className="grid grid-cols-[96px_1fr] gap-2">
                        <Input value={x.valor ?? ""} onChange={(e) => trocarNum(n, { valor: e.target.value })} placeholder={["+120", "12 anos"][n]} maxLength={16} className="rounded-xl" aria-label={`Número ${n + 1}`} />
                        <Input value={x.rotulo ?? ""} onChange={(e) => trocarNum(n, { rotulo: e.target.value })} placeholder={["empresas organizadas", "de gestão"][n]} maxLength={40} className="rounded-xl" aria-label={`O que o número ${n + 1} quer dizer`} />
                      </div>
                    ))}
                  </div>
                </LinhaCampo>
                <LinhaCampo label="Selo (opcional)">
                  <Input value={txt(d, "selo")} onChange={(e) => p({ selo: e.target.value })} maxLength={40} placeholder="Online e em Itajaí" className="rounded-xl" />
                </LinhaCampo>
              </>
            );
          })()}
          {layout === "foto_cheia" && (
            <p className="text-[11px] font-body text-muted-foreground leading-snug">
              Na foto cheia o selo "Aberto agora" sai do bloco Horários. Use uma foto horizontal e clara: o texto fica por cima dela.
            </p>
          )}
        </div>
      );
    }

    case "cardapio":
      return <FormCardapio d={d} p={p} telefonePadrao={telefonePadrao} />;
    case "praquem": return <FormPraQuem d={d} p={p} />;
    case "servicos": return <FormServicos d={d} p={p} telefonePadrao={telefonePadrao} />;
    case "etapas": return <FormEtapas d={d} p={p} />;
    case "chamada": return <FormChamada d={d} p={p} telefonePadrao={telefonePadrao} secoes={secoes} />;
    case "perfil_criadora": return <FormPerfilCriadora d={d} p={p} />;
    case "botoes": return <FormBotoes d={d} p={p} />;
    case "videos": return <FormVideos d={d} p={p} />;
    case "cupons": return <FormCupons d={d} p={p} />;
    case "midiakit": return <FormMidiaKit d={d} p={p} />;
    case "horarios":
      return <FormHorarios d={d} p={p} />;
    case "destaque":
      return <FormDestaque d={d} p={p} telefonePadrao={telefonePadrao} />;
    case "vantagens":
      return <FormVantagens d={d} p={p} />;

    case "sobre":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Rótulo pequeno" ajuda="A palavrinha em cima do título.">
            <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })}
              placeholder="Quem sou" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Título">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="12 anos dentro de cozinha, não em teoria" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Foto">
            <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto" />
          </LinhaCampo>
          <LinhaCampo label="Texto" ajuda="A história. É daqui que sai o conteúdo que ninguém copia.">
            <CampoTextoRico valor={txt(d, "texto")} onChange={(v) => p({ texto: v })} rows={8} />
          </LinhaCampo>
          <EscolherFundo valor={txt(d, "fundo", "claro")} onTroca={(v) => p({ fundo: v })} />
        </div>
      );

    case "produtos":
    case "blog":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Rótulo pequeno">
            <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Título da seção">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          {bloco.kind === "produtos" && (
            <LinhaCampo label="Frase de apoio (opcional)">
              <Input value={txt(d, "subtitulo")} onChange={(e) => p({ subtitulo: e.target.value })} className="rounded-xl" />
            </LinhaCampo>
          )}
          {bloco.kind === "blog" && (
            <LinhaCampo label="Quantos posts mostrar" ajuda="Os mais recentes. Os outros continuam no ar pelo endereço deles.">
              <Input type="number" inputMode="numeric" min={1} max={30}
                value={typeof d.quantos === "number" ? d.quantos : 6}
                onChange={(e) => p({ quantos: Math.max(1, Math.min(30, Number(e.target.value) || 6)) })}
                className="rounded-xl w-24" />
            </LinhaCampo>
          )}
          <EscolherFundo valor={txt(d, "fundo", bloco.kind === "produtos" ? "creme" : "claro")} onTroca={(v) => p({ fundo: v })} />

          {/* O QUE A SEÇÃO MOSTRA, cadastrado aqui dentro.
              Antes isto vivia num card separado no fim da tela e este bloco só
              escrevia o cabeçalho. Quem abria "Serviços" pra pôr o link do
              WhatsApp de uma consultoria não achava: o campo do link existia,
              só que a três telas de distância, noutro card. Duas telas pra uma
              coisa só é o tipo de divisão que faz sentido pra quem escreveu o
              código e pra mais ninguém. */}
          <div className="pt-1 border-t border-border/60">
            <EditorItens tipo={bloco.kind === "blog" ? "post" : "produto"} slugPublico={slugPublico} telefonePadrao={telefonePadrao} />
          </div>
        </div>
      );

    case "depoimentos": {
      const deps = lista<{ texto?: string; autor?: string }>(d, "itens");
      const trocarDep = (i: number, patch: { texto?: string; autor?: string }) =>
        p({ itens: deps.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Rótulo pequeno">
            <Input value={txt(d, "rotulo")} onChange={(e) => p({ rotulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Título da seção">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Jeito de mostrar">
            <div className="flex gap-1.5">
              {[{ v: "grade", r: "Cartões lado a lado" }, { v: "destaque", r: "Um grande, na cor da marca" }].map((o) => (
                <button key={o.v} type="button" onClick={() => p({ layout: o.v })}
                  className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
                    txt(d, "layout", "grade") === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {o.r}
                </button>
              ))}
            </div>
          </LinhaCampo>
          {deps.map((it, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-body font-semibold text-muted-foreground">Depoimento {i + 1}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => p({ itens: deps.filter((_, n) => n !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea rows={3} value={it.texto ?? ""} onChange={(e) => trocarDep(i, { texto: e.target.value })}
                placeholder="O que o cliente falou" className="rounded-xl resize-none" />
              <Input value={it.autor ?? ""} onChange={(e) => trocarDep(i, { autor: e.target.value })}
                placeholder="Nome e negócio de quem falou" className="rounded-xl" />
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => p({ itens: [...deps, { texto: "", autor: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar depoimento
          </Button>
          <EscolherFundo valor={txt(d, "fundo", "creme")} onTroca={(v) => p({ fundo: v })} />
        </div>
      );
    }

    case "contato":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Nome do negócio" ajuda="Aparece no menu e no rodapé. Vazio usa o nome da página.">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="WhatsApp com DDD"
            ajuda="Pedido, botão fixo, serviços e chamada final usam este número quando não têm um próprio.">
            <Input value={txt(d, "telefone")} onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })}
              placeholder="(00) 00000-0000" inputMode="tel" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="E-mail">
            <Input type="email" inputMode="email" value={txt(d, "email")} onChange={(e) => p({ email: e.target.value })}
              className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Endereço (opcional)"
            ajuda="No site ele vira link: quem toca já abre a rota no mapa do celular.">
            <Textarea rows={2} value={txt(d, "endereco")} onChange={(e) => p({ endereco: e.target.value })}
              className="rounded-xl resize-none" />
          </LinhaCampo>
          {/* Endereço escrito é informação; mapa é confiança. Pra quem atende em
              consultório ou loja, ver a rua no mapa é o que faz a pessoa decidir
              que dá pra ir. Fica opcional porque quem atende online não quer. */}
          {txt(d, "endereco").trim() && (
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                checked={bool(d, "mostrarMapa", false)}
                onChange={(e) => p({ mostrarMapa: e.target.checked })} />
              <span className="min-w-0">
                <span className="block text-xs font-body font-semibold text-foreground">Mostrar o mapa no rodapé</span>
                <span className="block text-[11px] font-body text-muted-foreground leading-snug">
                  Um mapa do Google com o ponto do endereço, logo abaixo do contato.
                </span>
              </span>
            </label>
          )}
          <LinhaCampo label="@ do Instagram">
            <Input value={txt(d, "instagram")} onChange={(e) => p({ instagram: e.target.value })}
              placeholder="@perfil" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Linha de assinatura">
            <Textarea rows={2} value={txt(d, "assinatura")} onChange={(e) => p({ assinatura: e.target.value })}
              placeholder="Consultoria gastronômica · Joinville, SC" className="rounded-xl resize-none" />
          </LinhaCampo>
        </div>
      );

    default:
      return null;
  }
}

/* ═══ FORMULÁRIOS DO MODELO LOJA (22/10/2026) ═══ */

const novoId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

type ItemCru = { id?: string; nome?: string; desc?: string; detalhe?: string; preco?: string | number | null; cat?: string; foto?: string; ativo?: boolean };

function FormCardapio({ d, p, telefonePadrao }: { d: DadosBloco; p: (patch: DadosBloco) => void; telefonePadrao?: string | null }) {
  const itens = lista<ItemCru>(d, "itens");
  const cats = Array.from(new Set(lista<unknown>(d, "categorias").map((c) => String(c ?? "").trim()).filter(Boolean)));
  const [novaCat, setNovaCat] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [colando, setColando] = useState(false);
  const [colado, setColado] = useState("");
  const pedidos = bool(d, "pedidos", true);
  const semWhats = pedidos && !foneWhats(txt(d, "telefone") || telefonePadrao || "");
  const lidos = useMemo(() => lerListaColada(colado), [colado]);
  const cabe = LIMITE_DO_CARDAPIO - itens.length;

  const trocar = (i: number, patch: ItemCru) => p({ itens: itens.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= itens.length) return;
    const nova = [...itens];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    p({ itens: nova });
  };
  const adicionarCat = () => {
    const c = novaCat.trim().slice(0, 40);
    if (!c || cats.includes(c)) { setNovaCat(""); return; }
    p({ categorias: [...cats, c] });
    setNovaCat("");
  };
  // Tirar a categoria solta os itens dela (ficam em "Todos"), sem apagar nenhum.
  const tirarCat = (c: string) => p({
    categorias: cats.filter((x) => x !== c),
    itens: itens.map((x) => (x.cat === c ? { ...x, cat: "" } : x)),
  });
  const adicionarItem = () => {
    if (cabe <= 0) return;
    const id = novoId();
    p({ itens: [...itens, { id, nome: "", desc: "", detalhe: "", preco: "", cat: "", foto: "", ativo: true }] });
    setAberto(id);
  };
  const aplicarColado = () => {
    const entram = lidos.slice(0, Math.max(0, cabe));
    if (!entram.length) return;
    const catsNovas = Array.from(new Set([...cats, ...entram.map((x) => x.cat).filter(Boolean)]));
    p({
      categorias: catsNovas,
      itens: [...itens, ...entram.map((x) => ({
        id: novoId(), nome: x.nome, desc: "", detalhe: "", preco: x.preco === null ? "" : x.preco, cat: x.cat, foto: "", ativo: true,
      }))],
    });
    toast.success(`${entram.length} ${entram.length === 1 ? "item adicionado" : "itens adicionados"}. Falta só a foto.`);
    setColado(""); setColando(false);
  };

  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título da seção">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Cardápio" className="rounded-xl" />
      </LinhaCampo>

      <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
        <Switch checked={pedidos} onCheckedChange={(v) => p({ pedidos: v })} className="mt-0.5 shrink-0" aria-label="Receber pedidos pelo WhatsApp" />
        <span className="min-w-0">
          <span className="block text-xs font-body font-semibold text-foreground">Receber pedidos pelo WhatsApp</span>
          <span className="block text-[11px] font-body text-muted-foreground leading-snug">
            Ligado, cada item ganha um "+" e a pessoa monta a sacola. O pedido chega pronto no seu WhatsApp. Desligado, o cardápio vira vitrine.
          </span>
        </span>
      </label>
      {pedidos && (
        <LinhaCampo label="WhatsApp que recebe os pedidos" ajuda="Vazio usa o telefone do bloco Contato.">
          <Input value={txt(d, "telefone")} onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })}
            placeholder={telefonePadrao || "(00) 00000-0000"} inputMode="tel" className="rounded-xl" />
        </LinhaCampo>
      )}
      {semWhats && (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11.5px] font-body text-amber-900 leading-snug">
          Sem um WhatsApp válido o cardápio aparece só como vitrine, sem o "+". Coloque o número aqui ou no bloco Contato.
        </p>
      )}

      <LinhaCampo label="Categorias" ajuda="Viram os botões de filtro em cima dos itens. Opcional.">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5 text-[11.5px] font-body">
              {c}
              <button type="button" onClick={() => tirarCat(c)} aria-label={`Tirar a categoria ${c}`}
                className="grid place-items-center h-6 w-6 rounded-full hover:bg-muted text-muted-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Ex.: Pães"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarCat(); } }} className="rounded-xl" maxLength={40} />
          <Button type="button" size="sm" variant="outline" onClick={adicionarCat} className="shrink-0">Adicionar</Button>
        </div>
      </LinhaCampo>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-body font-semibold text-foreground">Itens ({itens.length}/{LIMITE_DO_CARDAPIO})</span>
          <button type="button" onClick={() => setColando((v) => !v)} className="text-[11.5px] font-body font-semibold text-primary min-h-[32px]">
            {colando ? "Fechar" : "Colar uma lista"}
          </button>
        </div>

        {colando && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-[11.5px] font-body text-muted-foreground leading-snug">
              Uma linha por item: <span className="font-semibold text-foreground">Nome - preço - categoria</span>. Preço e categoria são opcionais.
            </p>
            <Textarea rows={5} value={colado} onChange={(e) => setColado(e.target.value)}
              placeholder={"Pão de fermentação natural - 24 - Pães\nCroissant de manteiga - 12,50 - Doces\nCafé coado"} className="rounded-xl resize-none text-xs" />
            {lidos.length > 0 && (
              <Button type="button" size="sm" onClick={aplicarColado} disabled={cabe <= 0}>
                Adicionar {Math.min(lidos.length, Math.max(0, cabe))} {Math.min(lidos.length, cabe) === 1 ? "item" : "itens"}
              </Button>
            )}
            {lidos.length > cabe && <p className="text-[11px] font-body text-amber-800">Cabem mais {Math.max(0, cabe)}. O resto fica de fora.</p>}
          </div>
        )}

        {itens.map((it, i) => {
          const id = it.id || `item-${i}`;
          const abertoAqui = aberto === id;
          const ativo = it.ativo !== false;
          return (
            <div key={id} className={cn("rounded-xl border bg-muted/30", abertoAqui ? "border-primary/40" : "border-border", !ativo && "opacity-60")}>
              <div className="flex items-center gap-2 p-2">
                <button type="button" onClick={() => setAberto(abertoAqui ? null : id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left min-h-[44px]">
                  <span className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
                    {it.foto ? <img src={it.foto} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-body font-semibold text-foreground truncate">{it.nome?.trim() || "Item sem nome"}</span>
                    <span className="block text-[11px] font-body text-muted-foreground truncate">
                      {[it.preco !== "" && it.preco !== null && it.preco !== undefined ? `R$ ${String(it.preco).replace(".", ",")}` : "", it.cat].filter(Boolean).join(" · ") || "sem preço"}
                    </span>
                  </span>
                </button>
                <Switch checked={ativo} onCheckedChange={(v) => trocar(i, { ativo: v })} aria-label={ativo ? "No ar. Tocar pra esconder" : "Escondido. Tocar pra mostrar"} />
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", abertoAqui && "rotate-180")} />
              </div>
              {abertoAqui && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-border/60 pt-3">
                  <BotaoImagem valor={it.foto ?? ""} onTroca={(u) => trocar(i, { foto: u })} rotulo="Enviar foto" />
                  <Input value={it.nome ?? ""} onChange={(e) => trocar(i, { nome: e.target.value })} placeholder="Nome do item" maxLength={80} className="rounded-xl" aria-label="Nome do item" />
                  <Input value={it.desc ?? ""} onChange={(e) => trocar(i, { desc: e.target.value })} placeholder="Descrição curta (aparece no cartão)" maxLength={120} className="rounded-xl" aria-label="Descrição curta" />
                  <Textarea rows={2} value={it.detalhe ?? ""} onChange={(e) => trocar(i, { detalhe: e.target.value })}
                    placeholder="Detalhes (aparecem quando a pessoa abre a foto): ingredientes, tamanho, prazo" maxLength={600} className="rounded-xl resize-none" aria-label="Detalhes" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={it.preco === null || it.preco === undefined ? "" : String(it.preco)} onChange={(e) => trocar(i, { preco: e.target.value.replace(/[^\d,.]/g, "").slice(0, 10) })}
                      placeholder="Preço (ex.: 24,90)" inputMode="decimal" className="rounded-xl" aria-label="Preço" />
                    <select value={it.cat ?? ""} onChange={(e) => trocar(i, { cat: e.target.value })} aria-label="Categoria"
                      className="h-10 rounded-xl border border-input bg-background px-2 text-sm font-body">
                      <option value="">Sem categoria</option>
                      {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      {it.cat && !cats.includes(it.cat) && <option value={it.cat}>{it.cat}</option>}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => mover(i, -1)}>Subir</Button>
                    <Button type="button" size="sm" variant="outline" disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>Descer</Button>
                    <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive"
                      onClick={async () => {
                        if (await confirmar({ titulo: "Tirar este item?", descricao: `"${it.nome?.trim() || "Item sem nome"}" sai do cardápio.`, acao: "Tirar", destrutivo: true })) {
                          p({ itens: itens.filter((_, n) => n !== i) });
                          setAberto(null);
                        }
                      }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Tirar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {cabe > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={adicionarItem}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
          </Button>
        )}
        <p className="text-[11px] font-body text-muted-foreground leading-snug">
          Item desligado some do site sem perder o cadastro. Bom pra o que acabou hoje.
        </p>
      </div>
    </div>
  );
}

/** Segunda primeiro: é como a pessoa pensa a semana da loja. */
const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function FormHorarios({ d, p }: { d: DadosBloco; p: (patch: DadosBloco) => void }) {
  const h = lerHorarios(d);
  const trocar = (dia: number, patch: Partial<{ aberto: boolean; abre: string; fecha: string }>) =>
    p({ dias: h.dias.map((x, n) => (n === dia ? { ...x, ...patch } : x)) });
  const copiarSegunda = () => p({ dias: h.dias.map((x, n) => (n >= 2 && n <= 5 ? { ...h.dias[1] } : x)) });
  return (
    <div className="space-y-3.5">
      <LinhaCampo label="Título da seção">
        <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Horários" className="rounded-xl" />
      </LinhaCampo>
      <div className="space-y-1.5">
        {ORDEM_DA_SEMANA.map((n) => {
          const x = h.dias[n];
          const viraNoite = x.aberto && x.fecha < x.abre;
          return (
            <div key={n} className="grid grid-cols-[92px_1fr] items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5">
              <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={x.aberto} onChange={(e) => trocar(n, { aberto: e.target.checked })} />
                <span className="text-xs font-body font-semibold">{DIAS[n]}</span>
              </label>
              {x.aberto ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Input type="time" value={x.abre} onChange={(e) => e.target.value && trocar(n, { abre: e.target.value })} className="rounded-lg h-9 px-2 text-xs" aria-label={`${DIAS[n]}: abre`} />
                  <span className="text-[11px] text-muted-foreground">às</span>
                  <Input type="time" value={x.fecha} onChange={(e) => e.target.value && trocar(n, { fecha: e.target.value })} className="rounded-lg h-9 px-2 text-xs" aria-label={`${DIAS[n]}: fecha`} />
                  {viraNoite && <span className="text-[10px] text-muted-foreground shrink-0">+1 dia</span>}
                </div>
              ) : (
                <span className="text-[11.5px] font-body text-muted-foreground">Fechado</span>
              )}
            </div>
          );
        })}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={copiarSegunda}>Copiar segunda para terça a sexta</Button>
      <LinhaCampo label="Observação (opcional)" ajuda="Feriado, horário de entrega, encomenda com antecedência.">
        <Input value={h.observacao} onChange={(e) => p({ observacao: e.target.value })} placeholder="Encomendas com 2 dias de antecedência" className="rounded-xl" />
      </LinhaCampo>
      <p className="text-[11px] font-body text-muted-foreground leading-snug">
        O selo "Aberto agora" na capa usa estes horários, no fuso de Brasília. Fechar depois da meia-noite funciona: 18h às 2h conta como aberto na madrugada.
      </p>
    </div>
  );
}

function FormDestaque({ d, p, telefonePadrao }: { d: DadosBloco; p: (patch: DadosBloco) => void; telefonePadrao?: string | null }) {
  const destino = txt(d, "destino", "whatsapp");
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinhaCampo label="Etiqueta">
          <Input value={txt(d, "etiqueta")} onChange={(e) => p({ etiqueta: e.target.value })} placeholder="Só essa semana" className="rounded-xl" />
        </LinhaCampo>
        <LinhaCampo label="Título">
          <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} placeholder="Panetone artesanal" className="rounded-xl" />
        </LinhaCampo>
      </div>
      <LinhaCampo label="Texto curto">
        <Textarea rows={2} value={txt(d, "texto")} onChange={(e) => p({ texto: e.target.value })}
          placeholder="Fornada limitada, reserve até quinta." className="rounded-xl resize-none" />
      </LinhaCampo>
      <LinhaCampo label="Foto">
        <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto" />
      </LinhaCampo>
      <LinhaCampo label="Texto do botão">
        <Input value={txt(d, "botao")} onChange={(e) => p({ botao: e.target.value })} placeholder="Reservar o meu" className="rounded-xl" />
      </LinhaCampo>
      <LinhaCampo label="Leva para">
        <div className="flex gap-1.5">
          {[{ v: "whatsapp", r: "WhatsApp" }, { v: "link", r: "Outro endereço" }].map((o) => (
            <button key={o.v} type="button" onClick={() => p({ destino: o.v })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-body font-semibold min-h-[32px]",
                destino === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {o.r}
            </button>
          ))}
        </div>
      </LinhaCampo>
      {destino === "whatsapp" ? (
        <>
          <LinhaCampo label="Telefone" ajuda="Vazio usa o telefone do bloco Contato.">
            <Input value={txt(d, "telefone")} placeholder={telefonePadrao || "(00) 00000-0000"}
              onChange={(e) => p({ telefone: mascaraTelefone(e.target.value) })} inputMode="tel" className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Mensagem que já vai escrita" ajuda={`Vazio manda "Olá! Quero reservar: ${txt(d, "titulo") || "título"}".`}>
            <Textarea rows={2} value={txt(d, "mensagem")} onChange={(e) => p({ mensagem: e.target.value })} className="rounded-xl resize-none" />
          </LinhaCampo>
        </>
      ) : (
        <LinhaCampo label="Endereço">
          <Input value={txt(d, "url")} onChange={(e) => p({ url: e.target.value })} placeholder="https://" inputMode="url" className="rounded-xl" />
        </LinhaCampo>
      )}
    </div>
  );
}

function FormVantagens({ d, p }: { d: DadosBloco; p: (patch: DadosBloco) => void }) {
  const crus = lista<{ titulo?: string; sub?: string }>(d, "itens");
  const itens = [0, 1, 2].map((i) => crus[i] ?? { titulo: "", sub: "" });
  const trocar = (i: number, patch: { titulo?: string; sub?: string }) =>
    p({ itens: itens.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-2.5">
      <p className="text-[11.5px] font-body text-muted-foreground leading-snug">Três motivos curtos. Item sem título não aparece.</p>
      {itens.map((it, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
          <Input value={it.titulo ?? ""} onChange={(e) => trocar(i, { titulo: e.target.value })} maxLength={40}
            placeholder={["Entrega no bairro", "Encomendas", "Pix e cartão"][i]} className="rounded-xl" aria-label={`Vantagem ${i + 1}`} />
          <Input value={it.sub ?? ""} onChange={(e) => trocar(i, { sub: e.target.value })} maxLength={60}
            placeholder={["Até 3 km", "Com 2 dias", "Na entrega"][i]} className="rounded-xl" aria-label={`Detalhe da vantagem ${i + 1}`} />
        </div>
      ))}
    </div>
  );
}

/* ── O ESTADO DE CADA SEÇÃO, em cor ── */
const COR_STATUS: Record<StatusSecao["tipo"], { texto: string; bola: string }> = {
  pronta: { texto: "text-emerald-700", bola: "bg-emerald-600" },
  exemplo: { texto: "text-amber-700", bola: "bg-amber-500" },
  falta: { texto: "text-red-700", bola: "bg-red-600" },
  escondida: { texto: "text-muted-foreground", bola: "bg-muted-foreground/50" },
};

/** Aviso no topo do formulário quando ainda há texto do modelo. */
function AvisoExemplo({ bloco }: { bloco: BioBloco }) {
  const t = exemploNoBloco(bloco.data ?? {});
  if (!t) return null;
  return (
    <p className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11.5px] font-body text-amber-900 leading-snug">
      Ainda é o texto de exemplo do modelo: <span className="italic">"{t.length > 70 ? `${t.slice(0, 70)}…` : t}"</span>. Troque antes de divulgar.
    </p>
  );
}

/** A barra de "quanto falta" com o próximo passo clicável. */
function CartaoProgresso({ pct, proximo, aoIr }: { pct: number; proximo: { texto: string } | null; aoIr: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-2">
      <p className="font-display font-semibold text-sm">
        {pct >= 100 ? "Sua página está pronta pra divulgar" : `Sua página está ${pct}% pronta`}
      </p>
      <div className="h-2 rounded-full bg-primary/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {proximo && (
        <button type="button" onClick={aoIr} className="text-[12.5px] font-body font-semibold text-primary min-h-[32px] text-left">
          Próximo: {proximo.texto} →
        </button>
      )}
    </div>
  );
}

/* ── O FORMULÁRIO AO LADO DA LISTA (tela larga) ── */
function PainelDoBloco({ bloco, status, atualizar, excluir, duplicar, slugPublico, telefonePadrao, secoes }: {
  bloco: BioBloco | null; status?: StatusSecao;
  atualizar: (patch: Partial<Pick<BioBloco, "data" | "is_active" | "starts_at" | "ends_at">>) => void;
  excluir: () => void; duplicar: () => void;
  slugPublico?: string | null; telefonePadrao?: string | null; secoes: { id: string; nome: string }[];
}) {
  const [agendaAberta, setAgendaAberta] = useState(false);
  if (!bloco) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center sticky top-4">
        <p className="text-sm font-body font-medium">Escolha uma seção</p>
        <p className="text-xs font-body text-muted-foreground mt-1">Na lista ao lado ou tocando direto na prévia.</p>
      </div>
    );
  }
  const meta = metaDoBloco(bloco.kind);
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-body font-semibold uppercase tracking-wider text-muted-foreground">Editando</p>
          <h3 className="font-display font-semibold text-lg leading-tight truncate">{meta.nome}</h3>
          {status && (
            <span className={cn("inline-flex items-center gap-1 text-[11.5px] font-body font-semibold mt-0.5", COR_STATUS[status.tipo].texto)}>
              <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", COR_STATUS[status.tipo].bola)} />{status.texto}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-[12px] font-body text-muted-foreground shrink-0 cursor-pointer">
          Mostrar na página
          <Switch checked={bloco.is_active} onCheckedChange={(v) => atualizar({ is_active: v })} />
        </label>
      </div>
      {status?.tipo === "exemplo" && <AvisoExemplo bloco={bloco} />}
      <FormBloco key={bloco.id} bloco={bloco} salvar={(data) => atualizar({ data })} slugPublico={slugPublico} telefonePadrao={telefonePadrao} secoes={secoes} />
      <button type="button" onClick={() => setAgendaAberta((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] font-body font-semibold text-muted-foreground hover:text-foreground">
        <Calendar className="h-3.5 w-3.5" /> {agendaAberta ? "Esconder agendamento" : "Agendar entrada e saída"}
      </button>
      {agendaAberta && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
          <LinhaCampo label="Aparece a partir de">
            <Input type="datetime-local" value={semSegundos(bloco.starts_at)} onChange={(e) => atualizar({ starts_at: paraIso(e.target.value) })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Some depois de">
            <Input type="datetime-local" value={semSegundos(bloco.ends_at)} onChange={(e) => atualizar({ ends_at: paraIso(e.target.value) })} className="rounded-xl" />
          </LinhaCampo>
        </div>
      )}
      <div className="flex justify-between gap-2 pt-1 border-t border-border/60">
        <Button type="button" size="sm" variant="ghost" onClick={duplicar}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicar</Button>
        <Button type="button" size="sm" variant="ghost" onClick={excluir} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
        </Button>
      </div>
    </div>
  );
}

/* ── UM BLOCO NA LISTA ── */
function CartaoBloco({
  bloco, aberto, onAbrir, atualizar, excluir, duplicar, arrasteProps, arrasteRef, arrastando, slugPublico, telefonePadrao, secoes,
  status, soLista,
}: {
  /** Modo Site: Pronta, Texto de exemplo, Falta X ou Escondida. */
  status?: StatusSecao;
  /** Tela larga: o cartão é só a linha da lista; o formulário abre ao lado. */
  soLista?: boolean;
  slugPublico?: string | null;
  telefonePadrao?: string | null;
  secoes?: { id: string; nome: string }[];
  bloco: BioBloco;
  aberto: boolean;
  onAbrir: () => void;
  atualizar: (patch: Partial<Pick<BioBloco, "data" | "is_active" | "starts_at" | "ends_at">>) => void;
  excluir: () => void;
  duplicar: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrasteProps?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrasteRef?: any;
  arrastando?: boolean;
}) {
  const meta = metaDoBloco(bloco.kind);
  const falta = faltaNoBloco(bloco);
  const [agendaAberta, setAgendaAberta] = useState(!!(bloco.starts_at || bloco.ends_at));
  const capa = txt(bloco.data ?? {}, "capa");

  return (
    <div ref={arrasteRef} {...(arrasteProps ?? {})}
      className={cn("rounded-2xl border bg-card transition-shadow",
        aberto ? "border-primary/40 shadow-sm" : "border-border",
        arrastando && "shadow-lg ring-2 ring-primary/40")}>
      <div className="flex items-start gap-2.5 p-3">
        <span className="text-muted-foreground/50 cursor-grab pt-1.5 touch-none" aria-hidden><GripVertical className="h-4 w-4" /></span>

        <button type="button" onClick={onAbrir} className="flex items-start gap-2.5 flex-1 min-w-0 text-left">
          <span className={cn("rounded-xl bg-muted border border-border grid place-items-center shrink-0 overflow-hidden text-muted-foreground", soLista ? "w-8 h-8" : "w-11 h-11")}>
            {capa ? <img src={capa} alt="" className="w-full h-full object-cover" /> : <meta.Icone className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold text-sm truncate">
              {/* No Site o nome da seção diz mais que o título digitado: é o
                  mesmo nome que aparece na prévia e no "Próximo:". */}
              {status ? meta.nome : (txt(bloco.data ?? {}, "titulo") || meta.nome)}
            </span>
            {/* min-w-0 aqui e no resumo: sem isso o `truncate` não trunca
                nada. Um link sem espaço não tem onde quebrar, vira a largura
                mínima da linha e empurra a tela toda pra fora. */}
            <span className="flex flex-wrap items-center gap-1.5 mt-0.5 min-w-0">
              {!status && <span className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">{meta.nome}</span>}
              {status ? (
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-body font-semibold", COR_STATUS[status.tipo].texto)}>
                  <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", COR_STATUS[status.tipo].bola)} />{status.texto}
                </span>
              ) : falta ? <span className="text-[10px] font-body font-semibold text-amber-600">{falta}</span> : null}
              {!falta && !soLista && <span className="text-[11px] font-body text-muted-foreground truncate min-w-0 max-w-full">{resumoDoBloco(bloco)}</span>}
              {(bloco.starts_at || bloco.ends_at) && (
                <span className="text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">agendado</span>
              )}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {!soLista && <span className="text-[11px] font-body tabular-nums text-muted-foreground hidden sm:block">{bloco.clicks}</span>}
          <Switch checked={bloco.is_active} onCheckedChange={(v) => atualizar({ is_active: v })} aria-label="Mostrar na página" />
        </div>
      </div>

      {aberto && !soLista && (
        <div className="px-3 pb-3.5 pt-1 space-y-3.5 border-t border-border/60 mt-0.5">
          {status?.tipo === "exemplo" && <AvisoExemplo bloco={bloco} />}
          <div className="pt-3.5"><FormBloco bloco={bloco} salvar={(data) => atualizar({ data })} slugPublico={slugPublico} telefonePadrao={telefonePadrao} secoes={secoes} /></div>

          <button type="button" onClick={() => setAgendaAberta((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-body font-semibold text-muted-foreground hover:text-foreground">
            <Calendar className="h-3.5 w-3.5" /> {agendaAberta ? "Esconder agendamento" : "Agendar entrada e saída"}
          </button>
          {agendaAberta && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
              <LinhaCampo label="Aparece a partir de">
                <Input type="datetime-local" value={semSegundos(bloco.starts_at)}
                  onChange={(e) => atualizar({ starts_at: paraIso(e.target.value) })} className="rounded-xl" />
              </LinhaCampo>
              <LinhaCampo label="Some depois de">
                <Input type="datetime-local" value={semSegundos(bloco.ends_at)}
                  onChange={(e) => atualizar({ ends_at: paraIso(e.target.value) })} className="rounded-xl" />
              </LinhaCampo>
              <p className="sm:col-span-2 text-[11px] font-body text-muted-foreground">
                Deixe em branco pra ficar sempre no ar. Quem decide é o relógio do servidor, então não adianta o visitante mexer no dele.
              </p>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={duplicar}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={excluir}
              className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── A TELA ── */
export function EditorBlocos({ estilo, aoAplicarAparencia, slugPublico, numero, abertoId, aoAbrirBloco, aoIrNegocio }: {
  /** Seção aberta controlada de fora: a prévia ao lado abre a mesma seção. */
  abertoId?: string | null;
  aoAbrirBloco?: (id: string | null) => void;
  /** "Próximo passo" que mora no passo Seu negócio (o WhatsApp). */
  aoIrNegocio?: () => void;
  estilo: EstiloBio;
  /** Modelo não é só estrutura: leva cor, fonte e formato de botão junto. Quem
   *  guarda a aparência é a tela de cima, então ela recebe por aqui. */
  aoAplicarAparencia?: (a: AparenciaModelo) => void;
  /** Só pra montar o endereço de cada item cadastrado dentro do bloco. */
  slugPublico?: string | null;
  /** Numeração do caminho da aba Conteúdo ("2" no Clássico, "1" no Site). */
  numero?: string;
}) {
  const { blocos, isLoading, criar, atualizar, excluir, excluirTodos, duplicar, reordenar, aplicarModelo } = useBioBlocks(estilo);
  /* O telefone mora no bloco "Contato e rodapé" e é reaproveitado pelos itens
     pra montar o link do WhatsApp: um telefone só, num lugar só. */
  const telefoneDoContato = txt((blocos.find((b) => b.kind === "contato" && b.is_active) ?? blocos.find((b) => b.kind === "contato"))?.data ?? {}, "telefone") || null;
  const secoesDaPagina = useMemo(() => ancorasDaPagina(blocos.map((b) => b.kind)), [blocos]);
  const [abertoLocal, setAbertoLocal] = useState<string | null>(null);
  const aberto = abertoId !== undefined ? abertoId : abertoLocal;
  const setAberto = (id: string | null) => { if (aoAbrirBloco) aoAbrirBloco(id); else setAbertoLocal(id); };
  const ehSite = estilo === "site";
  // Só o que está no ar conta: a página pública não enxerga bloco desligado.
  const telefoneDaPag = useMemo(() => telefoneDaPagina(blocos.filter((b) => b.is_active)), [blocos]);
  const status = useMemo(() => {
    const m = new Map<string, StatusSecao>();
    if (ehSite) for (const b of blocos) m.set(b.id, statusDaSecao(b, telefoneDaPag));
    return m;
  }, [blocos, ehSite, telefoneDaPag]);
  const progresso = useMemo(() => (ehSite ? progressoDaPagina(blocos, telefoneDaPag) : null), [blocos, ehSite, telefoneDaPag]);
  /* Tela larga: lista de um lado, formulário do outro (mockup aprovado). Mede
     a própria caixa, não o monitor: a coluna do editor varia com a prévia. */
  const caixaRef = useRef<HTMLDivElement>(null);
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const el = caixaRef.current;
    if (!el || !ehSite || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargo(e.contentRect.width >= 720));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ehSite]);
  /* Aberto de fora (tocou na prévia): no modo sanfona, traz o cartão pra vista. */
  useEffect(() => {
    if (!aberto || largo) return;
    const t = setTimeout(() => {
      document.querySelector(`[data-cartao-bloco="${aberto}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [aberto, largo]);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [modelosAbertos, setModelosAbertos] = useState(false);
  /* Modo Site: clicar num modelo abre a prévia dele montada de verdade, e só
     de lá se aplica. O de especialista troca de ramo dentro da própria prévia. */
  const [verModelo, setVerModelo] = useState<string | null>(null);
  const [nichoVer, setNichoVer] = useState("saude");
  /* Página que já tem bloco no ar: antes de trocar, pergunta. Trocar sem
     perguntar tiraria do ar o que a pessoa já divulgou. */
  const [pendente, setPendente] = useState<{ nome: string; blocos: BlocoDoModelo[]; aparencia: AparenciaModelo } | null>(null);
  const temNoAr = blocos.some((b) => b.is_active);
  const aplicar = async (m: { blocos: BlocoDoModelo[]; aparencia: AparenciaModelo }, modo: "trocar" | "juntar") => {
    // O erro já vira aviso no próprio gancho; aqui só não segue adiante.
    try { await aplicarModelo.mutateAsync({ novos: m.blocos, modo }); } catch { return; }
    aoAplicarAparencia?.(m.aparencia);
    setPendente(null);
    setVerModelo(null);
    setModelosAbertos(false);
    setAberto(null);
  };
  const apagarTodos = async () => {
    const n = blocos.length;
    const noAr = blocos.filter((b) => b.is_active).length;
    const ok = await confirmar({
      titulo: `Apagar ${n === 1 ? "o bloco" : `os ${n} blocos`} ${estilo === "site" ? "do site" : "da página"}?`,
      descricao: `${noAr ? `${noAr} ${noAr === 1 ? "está" : "estão"} no ar e ${noAr === 1 ? "some" : "somem"} da página na hora. ` : ""}`
        + "O que foi escrito e colocado neles se perde e não dá pra desfazer. "
        + (estilo === "site" ? "A página no estilo Clássico não muda." : "A página no estilo Site não muda."),
      acao: "Apagar tudo",
      destrutivo: true,
    });
    if (!ok) return;
    setAberto(null);
    excluirTodos.mutate(blocos.map((b) => b.id));
  };
  const escolher = (m: { nome: string; blocos: BlocoDoModelo[]; aparencia: AparenciaModelo }) => {
    if (temNoAr) { setPendente(m); return; }
    void aplicar(m, "trocar");
  };
  const disponiveis = useMemo(() => blocosDoEstilo(estilo), [estilo]);
  const modelos = useMemo(() => modelosDoEstilo(estilo), [estilo]);

  const adicionar = async (tipo: TipoBloco) => {
    const novo = await criar.mutateAsync(tipo);
    setPaletaAberta(false);
    setAberto(novo.id);   // já abre pra preencher, senão a pessoa não sabe o que fazer
  };

  const aoSoltar = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const ids = blocos.map((b) => b.id);
    const [movido] = ids.splice(r.source.index, 1);
    ids.splice(r.destination.index, 0, movido);
    reordenar.mutate(ids);
  };

  const blocoAberto = blocos.find((b) => b.id === aberto) ?? null;
  /* Excluir pergunta antes. Desligar no interruptor é o jeito de tirar do ar
     sem perder; excluir apaga o que foi escrito. */
  const pedirExcluir = async (b: BioBloco) => {
    const ok = await confirmar({
      titulo: `Excluir ${metaDoBloco(b.kind).nome}?`,
      descricao: "O que foi escrito nesta seção se perde. Pra só tirar do ar, use o interruptor.",
      acao: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    if (aberto === b.id) setAberto(null);
    excluir.mutate(b.id);
  };
  const irProximo = () => {
    const p = progresso?.proximo;
    if (!p) return;
    if (p.id === "negocio") aoIrNegocio?.();
    else if (p.id === "modelos") setModelosAbertos(true);
    else setAberto(p.id);
  };

  return (
    <div ref={caixaRef} className="space-y-3">
      {ehSite && progresso && blocos.length > 0 && (
        <CartaoProgresso pct={progresso.pct} proximo={progresso.proximo} aoIr={irProximo} />
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {/* O número faz parte do caminho 1-2 desenhado na aba Conteúdo. */}
          {numero && (
            <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[12px] font-display font-bold grid place-items-center shrink-0">
              {numero}
            </span>
          )}
          <div>
            <h3 className="font-display font-semibold text-foreground">{estilo === "site" ? "As seções do site" : "Os blocos da página"}</h3>
            <p className="text-xs font-body text-muted-foreground">Arraste pra ordenar. O interruptor tira do ar sem apagar.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button size="sm" variant="outline" onClick={() => { setModelosAbertos((v) => !v); setPaletaAberta(false); }}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Modelos
          </Button>
          <Button size="sm" onClick={() => { setPaletaAberta((v) => !v); setModelosAbertos(false); }} data-tour="bio-add-bloco">
            <Plus className="h-3.5 w-3.5 mr-1" /> {ehSite ? "Adicionar seção" : "Adicionar bloco"}
          </Button>
        </div>
      </div>

      {/* ── MODELOS ──
          Página em branco é onde a montagem morre: a pessoa abre e não sabe se
          começa pelo WhatsApp, pelo cardápio ou pela foto. O modelo entrega a
          página montada na ordem que costuma funcionar, e o trabalho vira
          TROCAR, que é bem mais fácil que CRIAR. */}
      {modelosAbertos && (
        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <p className="text-xs font-body text-muted-foreground mb-2.5">
            Escolha o que mais parece com o negócio. Vem tudo junto: as seções na ordem que costuma funcionar, o
            texto de exemplo, a cor, a fonte e o formato de botão. Entra ligado, pra você ver na prévia, e o que já
            existia sai do ar sem ser apagado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modelos.map((m) => (
              <button key={m.id} type="button" disabled={aplicarModelo.isPending}
                onClick={() => {
                  if (estilo === "site") { setVerModelo(m.id); setPendente(null); return; }
                  escolher({ nome: m.nome, blocos: m.blocos, aparencia: m.aparencia });
                }}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-all disabled:opacity-60">
                <span className="flex items-start gap-2.5">
                  {estilo === "site" ? (
                    /* O site de verdade, em miniatura: com as barrinhas de antes
                       os quatro modelos pareciam o mesmo. */
                    <span className="w-[90px] h-[150px] rounded-lg shrink-0 border border-border overflow-hidden bg-white">
                      <PreviaModelo blocos={m.blocos} aparencia={m.aparencia} escala={0.3} altura={150} nome={m.nomeExemplo}
                        previa={m.id === "site-especialista" ? previaDoNicho(m.blocos) : m.previa}
                        foto={m.id === "site-especialista" ? fotoDoRamo("saude") : m.fotoExemplo} />
                    </span>
                  ) : (
                    /* Clássico: miniatura com as cores e o formato de botão. */
                    <span aria-hidden className="w-14 h-[74px] rounded-lg shrink-0 border border-border overflow-hidden p-1.5 flex flex-col gap-1"
                      style={m.aparencia.bgType === "gradient" && m.aparencia.bgGradient
                        ? { background: m.aparencia.bgGradient }
                        : { backgroundColor: m.aparencia.bgColor }}>
                      <span className="w-4 h-4 rounded-full mx-auto shrink-0" style={{ backgroundColor: m.aparencia.buttonColor, opacity: .5 }} />
                      {[0, 1, 2].map((i) => (
                        <span key={i} className={cn("block h-2.5 w-full shrink-0",
                          m.aparencia.buttonStyle === "pill" ? "rounded-full"
                            : m.aparencia.buttonStyle === "square" ? "rounded-none" : "rounded-[3px]")}
                          style={{ backgroundColor: m.aparencia.buttonColor }} />
                      ))}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <m.Icone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-display font-semibold text-sm truncate">{m.nome}</span>
                    </span>
                    <span className="block text-[11.5px] font-body text-muted-foreground leading-snug mt-0.5">{m.paraQuem}</span>
                    <span className="block text-[10px] font-body text-muted-foreground mt-1">
                      {m.blocos.length} seções · fonte {m.aparencia.fontFamily}
                    </span>
                    {estilo === "site" && (
                      <span className="inline-block mt-2 text-[11.5px] font-body font-semibold text-primary">Ver como fica →</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {pendente && (
            <div className="mt-3 rounded-xl border border-primary/40 bg-card p-3" role="group" aria-label="Como aplicar o modelo">
              <p className="text-xs font-body font-semibold text-foreground">Sua página já tem blocos no ar</p>
              <p className="text-[11.5px] font-body text-muted-foreground mb-2.5">
                {pendente.nome}: quer trocar a página inteira ou só juntar as seções no fim, desligadas, pra preencher com calma?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button type="button" disabled={aplicarModelo.isPending} onClick={() => void aplicar(pendente, "trocar")}
                  className="text-left rounded-lg border border-primary bg-primary/5 px-3 py-2.5 min-h-[44px] disabled:opacity-60">
                  <span className="block text-[13px] font-body font-semibold">Trocar a página</span>
                  <span className="block text-[11px] font-body text-muted-foreground leading-snug">O modelo entra no ar. O que existe desliga e vai pro fim, sem apagar.</span>
                </button>
                <button type="button" disabled={aplicarModelo.isPending} onClick={() => void aplicar(pendente, "juntar")}
                  className="text-left rounded-lg border border-border px-3 py-2.5 min-h-[44px] hover:border-primary/50 disabled:opacity-60">
                  <span className="block text-[13px] font-body font-semibold">Juntar no fim</span>
                  <span className="block text-[11px] font-body text-muted-foreground leading-snug">A página no ar não muda. As seções novas entram desligadas.</span>
                </button>
              </div>
              <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setPendente(null)}>Cancelar</Button>
            </div>
          )}
        </div>
      )}

      {/* ── A PRÉVIA DO MODELO ──
          Escolher sem ver era escolher no escuro. A janela mostra o site
          montado com o texto de exemplo, lista o que vem e só aplica no botão. */}
      {(() => {
        const m = modelos.find((x) => x.id === verModelo);
        if (!m) return null;
        const especialista = m.id === "site-especialista";
        const nicho = especialista ? (nichoPorId(nichoVer) ?? NICHOS[0]) : null;
        const alvo = nicho
          ? { nome: `${m.nome} (${nicho.nome})`, blocos: blocosDoNicho(nicho) as BlocoDoModelo[], aparencia: aparenciaDoNicho(nicho) }
          : { nome: m.nome, blocos: m.blocos, aparencia: m.aparencia, foto: m.fotoExemplo, previa: m.previa };
        const nomes = Array.from(new Set(alvo.blocos.map((b) => metaDoBloco(b.kind).nome)));
        const fotoDaPrevia = nicho ? fotoDoRamo(nicho.id) : ("foto" in alvo && alvo.foto) || FOTO_EXEMPLO;
        // Ramo do especialista: os marcadores ("[anos]", "CRN [número]") viram
        // exemplo de verdade só aqui. A página aplicada continua com eles, pra
        // a pessoa ver o que falta preencher, e a pública nunca mostra.
        const semMarcador = previaDoNicho(alvo.blocos);
        const doModelo = "previa" in alvo ? alvo.previa : undefined;
        const previaDoAlvo = doModelo ? { ...doModelo, blocos: { ...semMarcador.blocos, ...doModelo.blocos } } : semMarcador;
        return (
          <Dialog open onOpenChange={(v) => { if (!v) setVerModelo(null); }}>
            {/* No celular a janela ocupa a tela e a PRÉVIA é a protagonista:
                antes ela tinha 42% da altura e mostrava só o título. */}
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[880px] p-0 gap-0 overflow-hidden h-[94dvh] sm:h-auto sm:max-h-[94dvh] flex flex-col sm:flex-row">
              <div className="bg-muted/60 flex-1 min-h-0 sm:flex-none flex justify-center px-3 pt-4 pb-2 sm:p-5 sm:border-r border-border">
                <div className="h-full sm:h-[min(660px,80dvh)] w-[min(320px,100%)] sm:w-[404px] rounded-[30px] border-[7px] border-gray-800 bg-white overflow-hidden shadow-xl">
                  <PreviaRolando chave={alvo.nome} className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
                    <PreviaModelo blocos={alvo.blocos} aparencia={alvo.aparencia} foto={fotoDaPrevia} encaixar
                      previa={previaDoAlvo} nome={nicho ? nomeDoRamo(nicho.id) : m.nomeExemplo} />
                  </PreviaRolando>
                </div>
              </div>
              <div className="shrink-0 sm:flex-1 min-w-0 sm:overflow-y-auto px-4 pt-3 pb-4 sm:p-5 flex flex-col gap-2.5 sm:gap-3.5 border-t sm:border-t-0 border-border">
                <DialogHeader className="text-left space-y-0.5">
                  <DialogTitle className="font-display text-base sm:text-lg leading-tight">{m.nome}</DialogTitle>
                  <DialogDescription className="text-[12.5px] sm:text-[13px] leading-snug">{m.paraQuem}</DialogDescription>
                </DialogHeader>

                {nicho && (
                  <div>
                    <p className="hidden sm:block text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Seu ramo</p>
                    {/* Uma linha que rola de lado no celular: oito botões
                        quebrando em quatro linhas empurravam a prévia pra fora. */}
                    <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
                      {NICHOS.map((n) => (
                        <button key={n.id} type="button" onClick={() => setNichoVer(n.id)}
                          aria-pressed={n.id === nicho.id}
                          className={cn("shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 min-h-[34px] text-[12px] font-body font-semibold whitespace-nowrap",
                            n.id === nicho.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                          <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.cor }} />
                          {n.nome}
                        </button>
                      ))}
                    </div>
                    <p className="hidden sm:block text-[11.5px] font-body text-muted-foreground mt-1.5 leading-snug">
                      Muda a foto de exemplo, os números, o texto, o botão e as cores pro ramo.
                    </p>
                  </div>
                )}

                <div className="hidden sm:block">
                  <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">O que vem</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {nomes.map((n) => (
                      <li key={n} className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-body">{n}</li>
                    ))}
                  </ul>
                  <p className="text-[11.5px] font-body text-muted-foreground mt-1.5 leading-snug">
                    Fotos, nomes e números da prévia são só exemplo e não vão pra sua página. Os textos entram como exemplo pra você trocar.
                  </p>
                </div>
                <p className="sm:hidden text-[11.5px] font-body text-muted-foreground leading-snug">
                  {nomes.length} seções. Fotos e números são só exemplo e não vão pra sua página.
                </p>

                <div className="sm:mt-auto sm:pt-1 space-y-1.5 sm:space-y-2">
                  {temNoAr ? (
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5">
                      <button type="button" disabled={aplicarModelo.isPending} onClick={() => void aplicar(alvo, "trocar")}
                        className="text-left rounded-lg border border-primary bg-primary/5 px-3 py-2 min-h-[44px] disabled:opacity-60">
                        <span className="block text-[13px] font-body font-semibold">Trocar a página</span>
                        <span className="block text-[11px] font-body text-muted-foreground leading-snug">Entra no ar. O atual desliga, sem apagar.</span>
                      </button>
                      <button type="button" disabled={aplicarModelo.isPending} onClick={() => void aplicar(alvo, "juntar")}
                        className="text-left rounded-lg border border-border px-3 py-2 min-h-[44px] hover:border-primary/50 disabled:opacity-60">
                        <span className="block text-[13px] font-body font-semibold">Juntar no fim</span>
                        <span className="block text-[11px] font-body text-muted-foreground leading-snug">O que está no ar não muda.</span>
                      </button>
                    </div>
                  ) : (
                    <Button type="button" className="w-full" disabled={aplicarModelo.isPending} onClick={() => void aplicar(alvo, "trocar")}>
                      {aplicarModelo.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                      Usar este modelo
                    </Button>
                  )}
                  <Button type="button" variant="ghost" className="w-full h-9" onClick={() => setVerModelo(null)}>Ver os outros</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {paletaAberta && (
        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {disponiveis.map((b) => (
              <button key={b.tipo} type="button" disabled={criar.isPending} onClick={() => adicionar(b.tipo)}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-all disabled:opacity-60">
                <b.Icone className="h-4 w-4 text-primary" />
                <span className="block font-display font-semibold text-sm mt-1.5">{b.nome}</span>
                <span className="block text-[11px] font-body text-muted-foreground leading-snug mt-0.5">{b.explica}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm font-body text-muted-foreground py-8 text-center">Carregando...</p>}

      {!isLoading && blocos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body font-medium text-foreground">A página está vazia</p>
          <p className="text-xs font-body text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
            O jeito mais rápido é partir de um modelo pronto e trocar os textos. Se preferir, monte na ordem que
            quiser.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => setModelosAbertos(true)}>
              <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Começar com um modelo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPaletaAberta(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Montar do zero
            </Button>
          </div>
        </div>
      )}

      <div className={cn(largo && blocos.length > 0 && "grid grid-cols-[260px_minmax(0,1fr)] gap-4 items-start")}>
      <DragDropContext onDragEnd={aoSoltar}>
        <Droppable droppableId="blocos">
          {(dp) => (
            <div ref={dp.innerRef} {...dp.droppableProps} className="space-y-2">
              {blocos.map((b, i) => (
                <Draggable key={b.id} draggableId={b.id} index={i}>
                  {(dd, snap) => (
                    <div ref={dd.innerRef} {...dd.draggableProps} data-cartao-bloco={b.id} className="scroll-mt-24">
                      <CartaoBloco
                        bloco={b}
                        status={status.get(b.id)}
                        soLista={largo}
                        aberto={aberto === b.id}
                        onAbrir={() => setAberto(aberto === b.id && !largo ? null : b.id)}
                        atualizar={(patch) => atualizar.mutate({ id: b.id, patch })}
                        excluir={() => void pedirExcluir(b)}
                        duplicar={() => duplicar.mutate(b.id)}
                        slugPublico={slugPublico}
                        telefonePadrao={telefoneDoContato}
                        secoes={secoesDaPagina}
                        arrasteProps={dd.dragHandleProps}
                        arrastando={snap.isDragging}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {dp.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {largo && blocos.length > 0 && (
        <PainelDoBloco bloco={blocoAberto} status={blocoAberto ? status.get(blocoAberto.id) : undefined}
          atualizar={(patch) => blocoAberto && atualizar.mutate({ id: blocoAberto.id, patch })}
          excluir={() => { if (blocoAberto) void pedirExcluir(blocoAberto); }}
          duplicar={() => blocoAberto && duplicar.mutate(blocoAberto.id)}
          slugPublico={slugPublico} telefonePadrao={telefoneDoContato} secoes={secoesDaPagina} />
      )}
      </div>

      {/* Fica no pé da lista, longe dos botões de criar: apagar tudo é raro e
          não pode ser o clique errado de quem queria "Adicionar bloco". */}
      {blocos.length > 1 && (
        <div className="flex justify-end pt-1">
          <Button type="button" size="sm" variant="ghost" disabled={excluirTodos.isPending}
            onClick={() => void apagarTodos()}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar todos os blocos
          </Button>
        </div>
      )}
    </div>
  );
}
