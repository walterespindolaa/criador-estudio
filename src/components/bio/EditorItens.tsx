import { useEffect, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ExternalLink, GripVertical, ImagePlus, Loader2, PenLine, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { validateUpload } from "@/lib/upload-validation";
import { useBioItems, type BioItem, type TipoItem } from "@/hooks/useBioItems";
import { enderecoDoTitulo, precoVisivel } from "@/lib/bioBlocks";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   OS SERVIÇOS E OS POSTS DO MODO SITE

   Cada item vira uma página com endereço próprio. Duas coisas guiaram a tela:

   · O endereço se escreve sozinho a partir do título, porque ninguém quer
     pensar em "slug". Dá pra ajustar, mas ele nunca fica vazio nem repetido.
   · O item nasce DESPUBLICADO. Ninguém quer um serviço pela metade no ar
     enquanto ainda está escrevendo a descrição.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROTULO: Record<TipoItem, { um: string; varios: string; novo: string; vazio: string; rota: string }> = {
  produto: {
    um: "serviço", varios: "Produtos e serviços", novo: "Novo serviço",
    vazio: "Cadastre o que o cliente vende. Cada um vira uma página com foto, preço e descrição, pra mandar no WhatsApp.",
    rota: "p",
  },
  post: {
    um: "post", varios: "Blog", novo: "Novo post",
    vazio: "Escreva o primeiro texto. É o que faz o Google achar o site do cliente por assunto, e não só pelo nome.",
    rota: "blog",
  },
};

function useUpload() {
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

function Imagem({ valor, onTroca, rotulo }: { valor: string; onTroca: (u: string) => void; rotulo: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { enviar, subindo } = useUpload();
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center border border-border">
        {valor ? <img src={valor} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const u = await enviar(f, "item");
            if (u) onTroca(u);
          }} />
        <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => ref.current?.click()}>
          {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{valor ? "Trocar" : rotulo}
        </Button>
        {valor && <Button type="button" size="sm" variant="ghost" onClick={() => onTroca("")}>Remover</Button>}
      </div>
    </div>
  );
}

/* ── ESCREVER SEM MANDAR UM UPDATE POR TECLA ──
   O campo de conteúdo tem nove linhas: escrever um post ali dispararia
   milhares de gravações com RLS. Aqui o valor fica local enquanto a pessoa
   digita e sobe 600ms depois da última tecla. */
function useTextoAdiado(valor: string, salvar: (v: string) => void) {
  const [local, setLocal] = useState(valor);
  const ultimo = useRef(valor);
  useEffect(() => {
    // Só aceita valor de fora quando não foi a gente que mudou (ex.: recarregou).
    if (valor !== ultimo.current) { ultimo.current = valor; setLocal(valor); }
  }, [valor]);
  useEffect(() => {
    if (local === ultimo.current) return;
    const t = setTimeout(() => { ultimo.current = local; salvar(local); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return [local, setLocal] as const;
}

function CampoTexto({
  valor, salvar, rows, placeholder, className,
}: { valor: string; salvar: (v: string) => void; rows?: number; placeholder?: string; className?: string }) {
  const [local, setLocal] = useTextoAdiado(valor, salvar);
  return rows
    ? <Textarea rows={rows} value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className={className} />
    : <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className={className} />;
}

function Campo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-xs">{label}</Label>
      {children}
      {ajuda && <p className="text-[11px] font-body text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

function CartaoItem({
  item, tipo, aberto, onAbrir, salvar, excluir, enderecoPublico, arrasteProps, arrastando,
}: {
  item: BioItem;
  tipo: TipoItem;
  aberto: boolean;
  onAbrir: () => void;
  salvar: (p: Partial<BioItem>) => void;
  excluir: () => void;
  enderecoPublico: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrasteProps?: any;
  arrastando?: boolean;
}) {
  const ehPost = tipo === "post";
  const preco = precoVisivel(item.preco, item.preco_texto);
  const galeria = Array.isArray(item.galeria) ? item.galeria : [];
  const { enviar, subindo } = useUpload();
  const refGaleria = useRef<HTMLInputElement>(null);

  return (
    <div {...(arrasteProps ?? {})}
      className={cn("rounded-2xl border bg-card transition-shadow",
        aberto ? "border-primary/40 shadow-sm" : "border-border",
        arrastando && "shadow-lg ring-2 ring-primary/40")}>
      <div className="flex items-start gap-2.5 p-3">
        {!ehPost && <span className="text-muted-foreground/50 cursor-grab pt-1.5 touch-none"><GripVertical className="h-4 w-4" /></span>}
        <button type="button" onClick={onAbrir} className="flex items-start gap-2.5 flex-1 min-w-0 text-left">
          <span className="w-11 h-11 rounded-xl bg-muted border border-border grid place-items-center shrink-0 overflow-hidden">
            {item.capa
              ? <img src={item.capa} alt="" className="w-full h-full object-cover" />
              : (ehPost ? <PenLine className="h-4 w-4 text-muted-foreground" /> : <ShoppingBag className="h-4 w-4 text-muted-foreground" />)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold text-sm truncate">{item.titulo || "Sem título"}</span>
            <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
              {!item.publicado && <span className="text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">rascunho</span>}
              {!ehPost && preco && <span className="text-[11px] font-body font-semibold text-foreground">{preco}</span>}
              <span className="text-[11px] font-body text-muted-foreground truncate">/{ROTULO[tipo].rota}/{item.slug}</span>
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.publicado && enderecoPublico && (
            <Button size="sm" variant="ghost" asChild aria-label="Abrir página">
              <a href={enderecoPublico} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
            </Button>
          )}
          <Switch checked={item.publicado} onCheckedChange={(v) => salvar({ publicado: v })} aria-label="Publicado" />
        </div>
      </div>

      {aberto && (
        <div className="px-3 pb-3.5 pt-3.5 space-y-3.5 border-t border-border/60">
          <Campo label="Título">
            <CampoTexto valor={item.titulo} className="rounded-xl"
              salvar={(v) => {
                // Enquanto o item é rascunho, o endereço acompanha o título.
                // Depois de publicado ele congela: mudar endereço de página que
                // já está no ar quebra o link que o cliente mandou no WhatsApp.
                const patch: Partial<BioItem> = { titulo: v };
                if (!item.publicado) patch.slug = enderecoDoTitulo(v) || item.slug;
                salvar(patch);
              }} />
          </Campo>

          <Campo label="Endereço da página"
            ajuda="Escreve sozinho a partir do título. Só mexa se quiser um endereço mais curto.">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-body text-muted-foreground shrink-0">/{ROTULO[tipo].rota}/</span>
              {/* Normaliza no BLUR, não a cada tecla: digitando "meu-servico",
                  o hífen sumia no instante em que era digitado. */}
              <Input defaultValue={item.slug} key={item.id}
                onBlur={(e) => {
                  const limpo = enderecoDoTitulo(e.target.value) || enderecoDoTitulo(item.titulo) || item.slug;
                  e.target.value = limpo;
                  if (limpo !== item.slug) salvar({ slug: limpo });
                }}
                className="rounded-xl font-mono text-xs" />
            </div>
          </Campo>

          <Campo label="Capa"><Imagem valor={item.capa ?? ""} onTroca={(u) => salvar({ capa: u })} rotulo="Enviar capa" /></Campo>

          <Campo label="Resumo" ajuda="Uma linha. É o que aparece no card da home e no resultado do Google.">
            <CampoTexto rows={2} valor={item.resumo ?? ""} salvar={(v) => salvar({ resumo: v })}
              className="rounded-xl resize-none" />
          </Campo>

          {!ehPost && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Preço" ajuda="Deixe zerado pra aparecer o texto do lado.">
                <MoneyInput value={item.preco ?? null} onChange={(v) => salvar({ preco: v })} />
              </Campo>
              <Campo label="Ou escreva" ajuda="Ex.: sob consulta, a partir de R$ 500.">
                <CampoTexto valor={item.preco_texto ?? ""} salvar={(v) => salvar({ preco_texto: v })}
                  placeholder="Sob consulta" className="rounded-xl" />
              </Campo>
            </div>
          )}

          <Campo label={ehPost ? "O texto" : "Descrição completa"}
            ajuda="Escreva à vontade. As quebras de linha aparecem iguais na página.">
            <CampoTexto rows={9} valor={item.conteudo ?? ""} salvar={(v) => salvar({ conteudo: v })}
              className="rounded-xl" />
          </Campo>

          <div className="space-y-2">
            <Label className="font-body text-xs">Fotos extras</Label>
            {galeria.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {galeria.map((g, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={g} alt="" className="w-full h-full object-cover" />
                    <button type="button" aria-label="Remover foto"
                      onClick={() => salvar({ galeria: galeria.filter((_, n) => n !== i) })}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={refGaleria} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const u = await enviar(f, "galeria");
                if (u) salvar({ galeria: [...galeria, u] });
              }} />
            <Button type="button" size="sm" variant="outline" disabled={subindo} onClick={() => refGaleria.current?.click()}>
              {subindo && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}<Plus className="h-3.5 w-3.5 mr-1" /> Adicionar foto
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Texto do botão"
              ajuda="Vazio usa o padrão e abre o WhatsApp do rodapé citando este item.">
              <CampoTexto valor={item.cta_texto ?? ""} salvar={(v) => salvar({ cta_texto: v })}
                placeholder="Quero saber mais" className="rounded-xl" />
            </Campo>
            <Campo label="Para onde o botão leva">
              <CampoTexto valor={item.cta_url ?? ""} salvar={(v) => salvar({ cta_url: v })}
                placeholder="https://" className="rounded-xl" />
            </Campo>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={excluir} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditorItens({ tipo, slugPublico }: { tipo: TipoItem; slugPublico?: string | null }) {
  const { itens, isLoading, criar, atualizar, excluir, reordenar } = useBioItems(tipo);
  const [aberto, setAberto] = useState<string | null>(null);
  const r = ROTULO[tipo];

  const adicionar = async () => {
    const novo = await criar.mutateAsync(tipo === "post" ? "Novo post" : "Novo serviço");
    setAberto(novo.id);
  };

  const aoSoltar = (d: DropResult) => {
    if (!d.destination || d.destination.index === d.source.index) return;
    const ids = itens.map((i) => i.id);
    const [m] = ids.splice(d.source.index, 1);
    ids.splice(d.destination.index, 0, m);
    reordenar.mutate(ids);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-foreground">{r.varios}</h3>
          <p className="text-xs font-body text-muted-foreground">
            {tipo === "post"
              ? "Aparecem do mais novo pro mais antigo."
              : "Arraste pra ordenar. Cada um vira uma página com endereço próprio."}
          </p>
        </div>
        <Button size="sm" onClick={adicionar} disabled={criar.isPending}>
          {criar.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          <Plus className="h-3.5 w-3.5 mr-1" /> {r.novo}
        </Button>
      </div>

      {isLoading && <p className="text-sm font-body text-muted-foreground py-8 text-center">Carregando...</p>}

      {!isLoading && itens.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-body font-medium text-foreground">Nenhum {r.um} ainda</p>
          <p className="text-xs font-body text-muted-foreground mt-1 mb-3.5 max-w-sm mx-auto">{r.vazio}</p>
          <Button size="sm" onClick={adicionar}><Plus className="h-3.5 w-3.5 mr-1" /> {r.novo}</Button>
        </div>
      )}

      {/* Post não arrasta: a ordem dele é a data, e deixar arrastar seria
          prometer um controle que a página pública não respeita. */}
      {tipo === "post" ? (
        <div className="space-y-2">
          {itens.map((item) => (
            <CartaoItem
              key={item.id} item={item} tipo={tipo}
              aberto={aberto === item.id}
              onAbrir={() => setAberto(aberto === item.id ? null : item.id)}
              salvar={(patch) => atualizar.mutate({ id: item.id, patch })}
              excluir={() => excluir.mutate(item.id)}
              enderecoPublico={slugPublico ? `/bio/${slugPublico}/${r.rota}/${item.slug}` : null}
            />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={aoSoltar}>
          <Droppable droppableId={`itens-${tipo}`}>
            {(dp) => (
              <div ref={dp.innerRef} {...dp.droppableProps} className="space-y-2">
                {itens.map((item, i) => (
                  <Draggable key={item.id} draggableId={item.id} index={i}>
                    {(dd, snap) => (
                      <div ref={dd.innerRef} {...dd.draggableProps}>
                        <CartaoItem
                          item={item} tipo={tipo}
                          aberto={aberto === item.id}
                          onAbrir={() => setAberto(aberto === item.id ? null : item.id)}
                          salvar={(patch) => atualizar.mutate({ id: item.id, patch })}
                          excluir={() => excluir.mutate(item.id)}
                          enderecoPublico={slugPublico ? `/bio/${slugPublico}/${r.rota}/${item.slug}` : null}
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
      )}
    </div>
  );
}
