import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Calendar, ChevronDown, Copy, GripVertical, ImagePlus, LayoutTemplate, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { validateUpload } from "@/lib/upload-validation";
import { useBioBlocks } from "@/hooks/useBioBlocks";
import {
  blocosDoEstilo, faltaNoBloco, lista, mascaraTelefone, metaDoBloco, resumoDoBloco, txt, bool,
  type BioBloco, type DadosBloco, type EstiloBio, type TipoBloco,
} from "@/lib/bioBlocks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICONES_BLOCO, iconeLucide } from "@/lib/bioIcones";
import { CampoTextoRico } from "@/lib/textoRico";
import { modelosDoEstilo, type AparenciaModelo } from "@/lib/bioTemplates";
import { cn } from "@/lib/utils";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { EditorItens } from "@/components/bio/EditorItens";

/* ═══════════════════════════════════════════════════════════════════════════
   MONTAR A PÁGINA POR BLOCOS

   A regra que guia esta tela: quem monta é a social mídia entre um cliente e
   outro, muitas vezes no celular. Então nada de formulário longo com dez
   campos abertos ao mesmo tempo. Um bloco por vez, aberto só quando clicado, e
   tudo que a pessoa digita salva sozinho.
   ═══════════════════════════════════════════════════════════════════════════ */

const semSegundos = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const paraIso = (v: string) => (v ? new Date(v).toISOString() : null);

function LinhaCampo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-xs">{label}</Label>
      {children}
      {ajuda && <p className="text-[11px] font-body text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Sobe imagem pro bucket público. A pasta é a de quem está logado porque a
 *  policy do bucket compara com auth.uid(). */
function useUploadBio() {
  const { user } = useAuth();
  const [subindo, setSubindo] = useState(false);
  const enviar = async (file: File, prefixo: string): Promise<string | null> => {
    const v = validateUpload(file, "bioMedia");
    if (!v.ok) { toast.error(v.reason); return null; }
    setSubindo(true);
    try {
      const caminho = `${user?.id}/${prefixo}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("bio-media")
        .upload(caminho, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) { toast.error("Não consegui enviar a imagem."); return null; }
      return supabase.storage.from("bio-media").getPublicUrl(caminho).data.publicUrl;
    } finally { setSubindo(false); }
  };
  return { enviar, subindo };
}

function BotaoImagem({ valor, onTroca, rotulo }: { valor: string; onTroca: (url: string) => void; rotulo: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { enviar, subindo } = useUploadBio();
  /* ENQUADRAR ANTES DE SUBIR. A foto sai do celular em qualquer proporção e o
     `object-cover` cortava por conta própria, quase sempre pela cabeça. Aqui a
     pessoa escolhe o pedaço que importa, com zoom, e o que sobe já é o
     recorte: a página nunca mais decide isso sozinha. */
  const [paraCortar, setParaCortar] = useState<string | null>(null);

  const subirRecorte = async (blob: Blob) => {
    const arquivo = new File([blob], "imagem.jpg", { type: blob.type || "image/jpeg" });
    const url = await enviar(arquivo, "bloco");
    if (url) onTroca(url);
    setParaCortar(null);
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
        {valor ? <img src={valor} alt="" className="w-full h-full object-cover" />
          : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            setParaCortar(URL.createObjectURL(f));
          }} />
        <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{valor ? "Trocar" : rotulo}
        </Button>
        {valor && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setParaCortar(valor)}>Enquadrar</Button>
        )}
        {valor && <Button type="button" size="sm" variant="ghost" onClick={() => onTroca("")}>Remover</Button>}
      </div>

      {paraCortar && (
        <ImageCropModal
          open
          onOpenChange={(v) => { if (!v) setParaCortar(null); }}
          imageSrc={paraCortar}
          cropShape="rect"
          aspectRatio={3 / 4}
          onCropComplete={(blob) => void subirRecorte(blob)} />
      )}
    </div>
  );
}

/** Fundo da seção. Página inteira branca cansa e some: a alternância é o que
 *  dá ritmo à rolagem. */
function EscolherFundo({ valor, onTroca }: { valor: string; onTroca: (v: string) => void }) {
  const opcoes: { v: string; r: string; amostra: string }[] = [
    { v: "claro", r: "Branco", amostra: "#FFFFFF" },
    { v: "creme", r: "Creme", amostra: "#F7F5EF" },
    { v: "escuro", r: "Escuro", amostra: "#101014" },
    { v: "marca", r: "Cor da marca", amostra: "" },
  ];
  return (
    <LinhaCampo label="Fundo da seção" ajuda="Alterne entre as seções pra a página não virar uma parede só.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {opcoes.map((o) => (
          <button key={o.v} type="button" onClick={() => onTroca(o.v)}
            className={cn("rounded-xl border-2 px-2.5 py-2 flex items-center gap-2 text-left transition-all",
              valor === o.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
            <span className="w-5 h-5 rounded-md border border-border shrink-0"
              style={o.amostra ? { backgroundColor: o.amostra } : { background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/.6))" }} />
            <span className="text-[12px] font-body font-medium truncate">{o.r}</span>
          </button>
        ))}
      </div>
    </LinhaCampo>
  );
}

/* ── ESCOLHA DO ÍCONE DO BOTÃO ──
   Grade fechada de ícones (pedido do Walter, 01/09): o campo de emoji livre
   deixava cada botão de um jeito. Tocar escolhe, tocar de novo tira, e o
   "Sem ícone" também tira. Emoji antigo continua valendo até a pessoa trocar. */
function SeletorIcone({ valor, onTroca }: { valor: string; onTroca: (v: string) => void }) {
  /* Fechado por padrão (pedido do Walter, 01/09): 26 ícones abertos ocupavam
     duas linhas do formulário por uma escolha que se faz uma vez. Agora é um
     campo só que mostra o escolhido; a grade abre por cima quando quer trocar. */
  const [aberto, setAberto] = useState(false);
  const IconeAtual = iconeLucide(valor);
  const nomeAtual = valor.startsWith("lucide:")
    ? ICONES_BLOCO.find((i) => `lucide:${i.id}` === valor)?.nome ?? "Ícone"
    : "";
  const ehEmojiAntigo = !!valor && !valor.startsWith("lucide:");
  const escolher = (v: string) => { onTroca(v); setAberto(false); };
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button"
          className="w-full sm:w-64 h-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm hover:border-primary/40 transition-colors">
          <span className="flex items-center gap-2 min-w-0 text-foreground">
            {IconeAtual && <IconeAtual className="h-4 w-4 shrink-0 text-primary" />}
            {ehEmojiAntigo && <span aria-hidden className="text-base leading-none">{valor}</span>}
            <span className={cn("truncate", !valor && "text-muted-foreground")}>
              {IconeAtual ? nomeAtual : ehEmojiAntigo ? "Emoji atual" : "Sem ícone"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-2 rounded-2xl">
        <button type="button" onClick={() => escolher("")}
          className={cn(
            "w-full h-9 mb-1.5 rounded-lg border text-[12px] font-body font-semibold transition-colors",
            !valor ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}>
          Sem ícone
        </button>
        <div className="grid grid-cols-7 gap-1.5">
          {ICONES_BLOCO.map((i) => {
            const ativo = valor === `lucide:${i.id}`;
            return (
              <button key={i.id} type="button" title={i.nome} aria-label={i.nome}
                onClick={() => escolher(ativo ? "" : `lucide:${i.id}`)}
                className={cn(
                  "w-9 h-9 grid place-items-center rounded-lg border transition-colors",
                  ativo ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                )}>
                <i.Icone className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── O FORMULÁRIO DE CADA TIPO ── */
function FormBloco({ bloco, salvar, slugPublico, telefonePadrao }: { bloco: BioBloco; salvar: (d: DadosBloco) => void; slugPublico?: string | null; telefonePadrao?: string | null }) {
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
            <BotaoImagem valor={txt(d, "imagem")} onTroca={(u) => p({ imagem: u })} rotulo="Enviar foto" />
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
          <div className="space-y-2">
            <Label className="font-body text-xs">Fotos</Label>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={f} alt="" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remover foto"
                    onClick={() => p({ imagens: fotos.filter((_, n) => n !== i) })}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <BotaoImagem valor="" rotulo="Adicionar foto" onTroca={(u) => { if (u) p({ imagens: [...fotos, u] }); }} />
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
    case "capa":
      return (
        <div className="space-y-3.5">
          <LinhaCampo label="Título grande" ajuda="A promessa em uma linha. É a primeira coisa que a pessoa lê.">
            <Textarea rows={2} value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })}
              placeholder="Sua operação servindo melhor e lucrando mais" className="rounded-xl resize-none" />
          </LinhaCampo>
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
              <Input value={txt(d, "url1")} onChange={(e) => p({ url1: e.target.value })}
                placeholder="https://" inputMode="url" className="rounded-xl" />
            </LinhaCampo>
            <LinhaCampo label="Botão secundário (opcional)">
              <Input value={txt(d, "botao2")} onChange={(e) => p({ botao2: e.target.value })}
                placeholder="Ver serviços" className="rounded-xl" />
            </LinhaCampo>
            <LinhaCampo label="Leva para">
              <Input value={txt(d, "url2")} onChange={(e) => p({ url2: e.target.value })}
                placeholder="#servicos" className="rounded-xl" />
            </LinhaCampo>
          </div>
        </div>
      );

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
              <Input type="number" min={1} max={30}
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
          <LinhaCampo label="Nome no rodapé" ajuda="Vazio usa o nome da página.">
            <Input value={txt(d, "titulo")} onChange={(e) => p({ titulo: e.target.value })} className="rounded-xl" />
          </LinhaCampo>
          <LinhaCampo label="Telefone"
            ajuda="Também é o que abre a conversa nos botões das páginas de serviço.">
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

/* ── UM BLOCO NA LISTA ── */
function CartaoBloco({
  bloco, aberto, onAbrir, atualizar, excluir, duplicar, arrasteProps, arrasteRef, arrastando, slugPublico, telefonePadrao,
}: {
  slugPublico?: string | null;
  telefonePadrao?: string | null;
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
          <span className="w-11 h-11 rounded-xl bg-muted border border-border grid place-items-center shrink-0 overflow-hidden text-muted-foreground">
            {capa ? <img src={capa} alt="" className="w-full h-full object-cover" /> : <meta.Icone className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold text-sm truncate">
              {txt(bloco.data ?? {}, "titulo") || meta.nome}
            </span>
            {/* min-w-0 aqui e no resumo: sem isso o `truncate` não trunca
                nada. Um link sem espaço não tem onde quebrar, vira a largura
                mínima da linha e empurra a tela toda pra fora. */}
            <span className="flex flex-wrap items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">{meta.nome}</span>
              {falta && <span className="text-[10px] font-body font-semibold text-amber-600">{falta}</span>}
              {!falta && <span className="text-[11px] font-body text-muted-foreground truncate min-w-0 max-w-full">{resumoDoBloco(bloco)}</span>}
              {(bloco.starts_at || bloco.ends_at) && (
                <span className="text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">agendado</span>
              )}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-body tabular-nums text-muted-foreground hidden sm:block">{bloco.clicks}</span>
          <Switch checked={bloco.is_active} onCheckedChange={(v) => atualizar({ is_active: v })} aria-label="Mostrar na página" />
        </div>
      </div>

      {aberto && (
        <div className="px-3 pb-3.5 pt-1 space-y-3.5 border-t border-border/60 mt-0.5">
          <div className="pt-3.5"><FormBloco bloco={bloco} salvar={(data) => atualizar({ data })} slugPublico={slugPublico} telefonePadrao={telefonePadrao} /></div>

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
export function EditorBlocos({ estilo, aoAplicarAparencia, slugPublico, numero }: {
  estilo: EstiloBio;
  /** Modelo não é só estrutura: leva cor, fonte e formato de botão junto. Quem
   *  guarda a aparência é a tela de cima, então ela recebe por aqui. */
  aoAplicarAparencia?: (a: AparenciaModelo) => void;
  /** Só pra montar o endereço de cada item cadastrado dentro do bloco. */
  slugPublico?: string | null;
  /** Numeração do caminho da aba Conteúdo ("2" no Clássico, "1" no Site). */
  numero?: string;
}) {
  const { blocos, isLoading, criar, atualizar, excluir, duplicar, reordenar, aplicarModelo } = useBioBlocks(estilo);
  /* O telefone mora no bloco "Contato e rodapé" e é reaproveitado pelos itens
     pra montar o link do WhatsApp: um telefone só, num lugar só. */
  const telefoneDoContato = txt(blocos.find((b) => b.kind === "contato")?.data ?? {}, "telefone") || null;
  const [aberto, setAberto] = useState<string | null>(null);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [modelosAbertos, setModelosAbertos] = useState(false);
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

  return (
    <div className="space-y-3">
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setModelosAbertos((v) => !v); setPaletaAberta(false); }}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Modelos
          </Button>
          <Button size="sm" onClick={() => { setPaletaAberta((v) => !v); setModelosAbertos(false); }} data-tour="bio-add-bloco">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar bloco
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
            texto de exemplo, e a cor, a fonte e o formato de botão. Os blocos entram desligados e nada do que já
            existe é apagado. A aparência, essa sim, é substituída.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modelos.map((m) => (
              <button key={m.id} type="button" disabled={aplicarModelo.isPending}
                onClick={async () => {
                  await aplicarModelo.mutateAsync(m.blocos);
                  aoAplicarAparencia?.(m.aparencia);
                  setModelosAbertos(false);
                }}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-all disabled:opacity-60">
                <span className="flex items-start gap-2.5">
                  {/* Miniatura com as cores e o formato de botão do modelo.
                      Ver como fica é o que faz escolher; nome e ícone sozinhos
                      não dizem se a página vai ficar escura ou clara. */}
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
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <m.Icone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-display font-semibold text-sm truncate">{m.nome}</span>
                    </span>
                    <span className="block text-[11.5px] font-body text-muted-foreground leading-snug mt-0.5">{m.paraQuem}</span>
                    <span className="block text-[10px] font-body text-muted-foreground mt-1">
                      {m.blocos.length} blocos · fonte {m.aparencia.fontFamily}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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

      <DragDropContext onDragEnd={aoSoltar}>
        <Droppable droppableId="blocos">
          {(dp) => (
            <div ref={dp.innerRef} {...dp.droppableProps} className="space-y-2">
              {blocos.map((b, i) => (
                <Draggable key={b.id} draggableId={b.id} index={i}>
                  {(dd, snap) => (
                    <div ref={dd.innerRef} {...dd.draggableProps}>
                      <CartaoBloco
                        bloco={b}
                        aberto={aberto === b.id}
                        onAbrir={() => setAberto(aberto === b.id ? null : b.id)}
                        atualizar={(patch) => atualizar.mutate({ id: b.id, patch })}
                        excluir={() => excluir.mutate(b.id)}
                        duplicar={() => duplicar.mutate(b.id)}
                        slugPublico={slugPublico}
                        telefonePadrao={telefoneDoContato}
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
    </div>
  );
}
