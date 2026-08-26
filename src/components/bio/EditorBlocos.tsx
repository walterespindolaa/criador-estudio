import { useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Calendar, Copy, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
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
import { CampoTextoRico } from "@/lib/textoRico";
import { cn } from "@/lib/utils";

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
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
        {valor ? <img src={valor} alt="" className="w-full h-full object-cover" />
          : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const url = await enviar(f, "bloco");
            if (url) onTroca(url);
          }} />
        <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{valor ? "Trocar" : rotulo}
        </Button>
        {valor && <Button type="button" size="sm" variant="ghost" onClick={() => onTroca("")}>Remover</Button>}
      </div>
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

/* ── O FORMULÁRIO DE CADA TIPO ── */
function FormBloco({ bloco, salvar }: { bloco: BioBloco; salvar: (d: DadosBloco) => void }) {
  const d = bloco.data ?? {};
  const p = (patch: DadosBloco) => salvar({ ...d, ...patch });

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
            <LinhaCampo label="Emoji (opcional)" ajuda="Aparece antes do texto quando não tem capa.">
              <Input value={txt(d, "icone")} onChange={(e) => p({ icone: e.target.value.slice(0, 4) })}
                placeholder="🍝" className="rounded-xl w-24 text-center text-lg" />
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
          <div className="rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-2.5">
            <p className="text-xs font-body text-foreground/80">
              Esta seção mostra sozinha o que você cadastrar em
              <strong>{bloco.kind === "blog" ? " Blog" : " Produtos e serviços"}</strong>, logo abaixo nesta mesma tela.
              Aqui você só escreve o cabeçalho dela.
            </p>
          </div>
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
          <LinhaCampo label="Endereço (opcional)">
            <Textarea rows={2} value={txt(d, "endereco")} onChange={(e) => p({ endereco: e.target.value })}
              className="rounded-xl resize-none" />
          </LinhaCampo>
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
  bloco, aberto, onAbrir, atualizar, excluir, duplicar, arrasteProps, arrasteRef, arrastando,
}: {
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
          <span className="w-11 h-11 rounded-xl bg-muted border border-border grid place-items-center text-lg shrink-0 overflow-hidden">
            {capa ? <img src={capa} alt="" className="w-full h-full object-cover" /> : meta.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold text-sm truncate">
              {txt(bloco.data ?? {}, "titulo") || meta.nome}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-body font-semibold uppercase tracking-wider text-muted-foreground">{meta.nome}</span>
              {falta && <span className="text-[10px] font-body font-semibold text-amber-600">{falta}</span>}
              {!falta && <span className="text-[11px] font-body text-muted-foreground truncate">{resumoDoBloco(bloco)}</span>}
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
          <div className="pt-3.5"><FormBloco bloco={bloco} salvar={(data) => atualizar({ data })} /></div>

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
export function EditorBlocos({ estilo }: { estilo: EstiloBio }) {
  const { blocos, isLoading, criar, atualizar, excluir, duplicar, reordenar } = useBioBlocks(estilo);
  const [aberto, setAberto] = useState<string | null>(null);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const disponiveis = useMemo(() => blocosDoEstilo(estilo), [estilo]);

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
        <div>
          <h3 className="font-display font-semibold text-foreground">Os blocos da página</h3>
          <p className="text-xs font-body text-muted-foreground">Arraste pra ordenar. O interruptor tira do ar sem apagar.</p>
        </div>
        <Button size="sm" onClick={() => setPaletaAberta((v) => !v)} data-tour="bio-add-bloco">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar bloco
        </Button>
      </div>

      {paletaAberta && (
        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {disponiveis.map((b) => (
              <button key={b.tipo} type="button" disabled={criar.isPending} onClick={() => adicionar(b.tipo)}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-all disabled:opacity-60">
                <span className="text-lg leading-none">{b.emoji}</span>
                <span className="block font-display font-semibold text-sm mt-1">{b.nome}</span>
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
            Comece pelo que o cliente mais quer que aconteça: o botão do WhatsApp, o cardápio, o agendamento.
          </p>
          <Button size="sm" onClick={() => setPaletaAberta(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar o primeiro bloco
          </Button>
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
