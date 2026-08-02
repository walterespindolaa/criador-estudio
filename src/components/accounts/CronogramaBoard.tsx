import { useRef, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Link2, CalendarRange, Building2, PartyPopper, Check, AtSign, LayoutGrid, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useCronogramas, useCronogramaItems, useCronogramaDatas, CRONOGRAMA_TYPES,
  type Cronograma, type CronogramaItem, type ItemStatus,
} from "@/hooks/useCronograma";
import { useExternalClients, invalidatePostsEverywhere } from "@/hooks/useCriaPost";
import { SEGMENTOS, datasPara, segmentoDoTexto, type SegmentKey } from "@/lib/datasComemorativas";
import { useCrmClients } from "@/hooks/useCrm";
import { confirmar } from "@/components/shared/Confirm";
import { MultiLinkInput } from "@/components/shared/MultiLinkInput";
import { parseRefLinks, serializeRefLinks, refLinkHref, refLinkLabel, isRefLink } from "@/lib/refLinks";

const TYPE_COLOR: Record<string, string> = {
  "Reels": "bg-red-600", "Carrossel": "bg-green-700", "Feed": "bg-blue-700",
  "Stories": "bg-gray-500", "Carrossel/Stories": "bg-green-700", "Feed/Stories": "bg-blue-700",
};
const ST_LABEL: Record<ItemStatus, string> = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", ajuste: "Ajuste pedido" };
const ST_CLASS: Record<ItemStatus, string> = {
  pendente: "bg-muted text-muted-foreground", aprovado: "bg-green-100 text-green-700",
  recusado: "bg-red-100 text-red-700", ajuste: "bg-amber-100 text-amber-700",
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Converte o tipo do cronograma ("Reels", "Feed", "Carrossel/Stories"...) no formato
// que o Cria Post entende (minusculo: reels/carrossel/foto/story/video). Sem isto o post
// convertido nascia com format "Feed"/"Reels" (fora do padrao do board) e o filtro de
// formato / a cor do card nao reconheciam. Pega a primeira parte de tipos compostos.
const CRONOGRAMA_TO_POST_FORMAT: Record<string, string> = {
  reels: "reels", carrossel: "carrossel", feed: "foto", stories: "story", story: "story",
};
const tipoParaFormato = (tipo: string | null | undefined): string => {
  const base = (tipo ?? "").split("/")[0].trim().toLowerCase();
  return CRONOGRAMA_TO_POST_FORMAT[base] ?? "reels";
};

// máscara DD/MM enquanto digita (ex.: "1505" -> "15/05")
const maskDay = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

// posts (Cria Post) ainda via cast, padrão do projeto.
const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

export function CronogramaBoard({ fixedClientId }: { fixedClientId?: string }) {
  const { clients } = useExternalClients();
  const { cronogramas, create, update, remove } = useCronogramas();
  const [clientId, setClientId] = useState<string | null>(fixedClientId ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = selectedId ? cronogramas.find((c) => c.id === selectedId) ?? null : null;
  const selectedClient = clientId ? clients.find((c) => c.id === clientId) ?? null : null;
  const clientCronos = cronogramas.filter((c) => c.external_client_id === clientId);
  const countFor = (cid: string) => cronogramas.filter((c) => c.external_client_id === cid).length;

  // Nível 3, detalhe do cronograma
  if (selected) {
    return <CronogramaDetail c={selected} onBack={() => setSelectedId(null)} onUpdate={update.mutate} onDelete={async (id) => { await remove.mutateAsync(id); setSelectedId(null); }} />;
  }

  const createCronograma = async () => {
    if (!newTitle.trim() || !selectedClient) return;
    const c = await create.mutateAsync({ title: newTitle.trim(), external_client_id: selectedClient.id, client_label: selectedClient.name, client_handle: selectedClient.instagram_handle ?? null });
    setNewOpen(false); setNewTitle("");
    setSelectedId(c.id);
  };

  // Nível 2, cronogramas do cliente (histórico)
  if (clientId && selectedClient) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {!fixedClientId && <Button variant="ghost" size="sm" onClick={() => setClientId(null)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Clientes</Button>}
          <div className="min-w-0">
            <h3 className="font-display font-bold text-foreground leading-tight">{selectedClient.name}</h3>
            {selectedClient.instagram_handle && <p className="text-xs text-muted-foreground">@{selectedClient.instagram_handle.replace(/^@/, "")}</p>}
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="ml-auto gap-1.5"><Plus className="h-4 w-4" /> Novo cronograma</Button>
        </div>

        {clientCronos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><CalendarRange className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground">Nenhum cronograma pra este cliente</p>
            <p className="text-xs text-muted-foreground mt-1">Crie o primeiro cronograma de conteúdos.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientCronos.map((c) => (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1"><CalendarRange className="h-4 w-4 text-primary" /><span className="font-display font-bold text-foreground">{c.title}</span></div>
                <span className={cn("inline-block mt-3 text-[10px] font-bold px-2 py-0.5 rounded-full",
                  c.status === "aprovado" ? "bg-green-100 text-green-700" : c.status === "enviado" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>
                  {c.status === "aprovado" ? "Aprovado" : c.status === "enviado" ? "Enviado" : "Rascunho"}
                </span>
              </button>
            ))}
          </div>
        )}

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-display">Novo cronograma · {selectedClient.name}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-xs">Título</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Julho 2026" className="rounded-xl" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={createCronograma} disabled={!newTitle.trim()} className="rounded-xl">Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Nível 1, lista de clientes
  const activeClients = clients.filter((c) => c.active);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Escolha um cliente pra ver o histórico e montar cronogramas.</p>
      {activeClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Building2 className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre um cliente na aba "Posts" pra começar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClients.map((cl) => (
            <button key={cl.id} onClick={() => setClientId(cl.id)} className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
                <div className="w-full h-full rounded-full bg-card grid place-items-center font-display font-extrabold text-primary">{cl.name.charAt(0).toUpperCase()}</div>
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-foreground truncate">{cl.name}</p>
                <p className="text-xs text-muted-foreground">{countFor(cl.id)} cronograma{countFor(cl.id) === 1 ? "" : "s"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CronogramaDetail({ c, onBack, onUpdate, onDelete }: {
  c: Cronograma; onBack: () => void;
  onUpdate: (p: { id: string } & Partial<Cronograma>) => void;
  onDelete: (id: string) => void;
}) {
  const { items, addItem, updateItem, deleteItem, reorder } = useCronogramaItems(c.id);
  const [mes, setMes] = useState("all"); // "all" | "YYYY-MM" — filtra por período antes de enviar
  const mesesDisp = Array.from(new Set(items.map((it) => it.date?.slice(0, 7)).filter(Boolean) as string[])).sort();
  const visible = mes === "all" ? items : items.filter((it) => (it.date ?? "").slice(0, 7) === mes);

  // Segmento do cliente (do CRM), usado pra sugerir as datas comemorativas do nicho.
  const { clients: extClients } = useExternalClients();
  const { data: crmClientsList = [] } = useCrmClients();
  const extOfCrono = extClients.find((e) => e.id === c.external_client_id);
  const clientSegment = crmClientsList.find((cc) => cc.id === extOfCrono?.crm_client_id)?.segment ?? null;

  // Reordenar: arrastar a caixinha muda o número (#4 vira #1) e salva a ordem.
  const onReorder = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const next = Array.from(items);
    const [moved] = next.splice(r.source.index, 1);
    next.splice(r.destination.index, 0, moved);
    reorder.mutate(next);
  };
  // Dono do tenant (mesmo que o resto do Cria Post usa). ANTES a conversao usava
  // useAuth().user.id: quando o operador nao e o dono da agencia (colaborador ou conta
  // trocada no switcher), o post nascia com user_id "errado" e o RLS/kanban do cliente
  // nao o mostravam, mesmo com o selo "no Cria Post" ligado. Agora nasce igualzinho a
  // um post criado pelo botao "Novo post" (mesmo dono).
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CronogramaItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState<Partial<CronogramaItem>>({});
  const [handle, setHandle] = useState(c.client_handle ?? "");
  const [converting, setConverting] = useState(false);
  // Trava SINCRONA de reentrancia (mesma tecnica do saveItem): o duplo clique/tap
  // dispara dois convertApproved antes do React re-renderizar o botao "converting".
  // Sem isto, os dois passavam pelo insert e criavam posts DUPLICADOS.
  const convertingRef = useRef(false);

  const approvedToConvert = items.filter((it) => it.approval_status === "aprovado" && !it.converted_post_id);

  const convertApproved = async () => {
    if (convertingRef.current) return;
    if (!c.external_client_id) { toast.error("Esse cronograma não está vinculado a um cliente."); return; }
    if (!agencyOwnerId || approvedToConvert.length === 0) return;
    convertingRef.current = true;
    setConverting(true);
    try {
      for (const it of approvedToConvert) {
        // O item pode ter VÁRIOS links de referência, mas o post só tem um campo.
        // O primeiro vai pro reference_url e os demais entram no roteiro pra não sumirem.
        const refs = parseRefLinks(it.ref_url);
        const extrasRef = refs.slice(1);
        const roteiro = [it.description || "", extrasRef.length ? `Referências extras:\n${extrasRef.join("\n")}` : ""]
          .filter(Boolean).join("\n\n") || null;
        // Nasce EM PRODUCAO (mesma coluna/estado de um post novo do board). "pendente"
        // mandaria pro cliente um post ainda sem midia; a social midia libera pro cliente
        // quando estiver pronto. So marcamos o selo "no Cria Post" DEPOIS do insert dar certo.
        const { data, error } = await sbFrom("posts").insert({
          user_id: agencyOwnerId,
          external_client_id: c.external_client_id,
          // Nome do post = titulo do item (cai pra copy se nao tiver nome). "||" trata
          // string vazia como ausente, igual ao card do cronograma.
          title: it.title || it.copy || "(sem título)",
          platform: "instagram",
          format: tipoParaFormato(it.type),
          // No cronograma "copy" e a LEGENDA e "description" e o ROTEIRO/ideia. Cada um vai
          // pro campo certo do post (antes a legenda ia pro caption errado e a copy sumia).
          caption: it.copy || null,
          script: roteiro,
          reference_url: refs[0] ?? null,
          status: "editando",
          approval_status: "em_producao",
          approval_mode: "fast",
          // Rascunho explicitamente falso: kanban e agenda filtram is_draft, entao o post
          // convertido tem que nascer publicado (nao rascunho) pra aparecer nos dois.
          is_draft: false,
          // Data do item vira a data agendada: assim o post cai no dia certo da Agenda.
          scheduled_date: it.date || null,
        } as never).select("id").single();
        if (error) throw error;
        const newPostId = (data as { id: string }).id;
        // O insert deu certo. Agora TEMOS que gravar converted_post_id no item, senao
        // ele continua elegivel e uma proxima conversao recria o post (duplicata). Se o
        // update falhar logo depois do insert, tenta uma vez mais com um respiro curto
        // ANTES de seguir; so aborta o loop se ainda assim falhar (o item ja tem post,
        // entao nao da pra ignorar o erro e deixar o item elegivel calado).
        try {
          await updateItem.mutateAsync({ id: it.id, converted_post_id: newPostId });
        } catch {
          await new Promise((r) => setTimeout(r, 400));
          await updateItem.mutateAsync({ id: it.id, converted_post_id: newPostId });
        }
      }
      // Avisa o kanban do cliente, a agenda, o contador de pendentes, a home copiloto e
      // o calendario do gestor que nasceram posts novos, senao essas telas ficam
      // desatualizadas e o post convertido so aparece depois de um reload manual.
      invalidatePostsEverywhere(qc, agencyOwnerId, c.external_client_id);
      toast.success(`${approvedToConvert.length} post(s) criado(s) no Cria Post do cliente!`);
    } catch {
      toast.error("Erro ao converter pro Cria Post. Tente de novo.");
    } finally {
      convertingRef.current = false;
      setConverting(false);
    }
  };

  // Links de referência do item ficam em estado próprio (lista), porque o campo
  // aceita vários. Só na hora de salvar viram o texto da coluna ref_url.
  const [refLinks, setRefLinks] = useState<string[]>([]);
  const openNew = () => { setEditing(null); setF({ type: "Reels" }); setRefLinks([]); setFormOpen(true); };
  const openEdit = (it: CronogramaItem) => { setEditing(it); setF(it); setRefLinks(parseRefLinks(it.ref_url)); setFormOpen(true); };
  // Trava de reentrada: duplo clique/tap disparava dois inserts idênticos (o item duplicava).
  // O ref é síncrono, então bloqueia o 2º clique antes do React re-renderizar o botão.
  const savingRef = useRef(false);
  const saveItem = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const ref = serializeRefLinks(refLinks);
      if (editing) await updateItem.mutateAsync({ id: editing.id, title: f.title ?? null, copy: f.copy ?? null, description: f.description ?? null, date: f.date ?? null, type: f.type ?? null, ref_url: ref });
      else await addItem.mutateAsync({ title: f.title ?? null, copy: f.copy ?? null, description: f.description ?? null, date: f.date ?? null, type: f.type ?? null, ref_url: ref });
      setFormOpen(false);
    } finally {
      savingRef.current = false;
    }
  };

  const link = `${window.location.origin}/cronograma/${c.token}`;
  const sendForApproval = () => {
    onUpdate({ id: c.id, status: "enviado" });
    navigator.clipboard?.writeText(link).then(() => toast.success("Link de aprovação copiado!")).catch(() => toast.success("Enviado pra aprovação."));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-foreground leading-tight">{c.title}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {c.client_label && <span className="text-xs text-muted-foreground">{c.client_label} ·</span>}
            <div className="relative">
              <AtSign className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={handle.replace(/^@/, "")}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                onBlur={() => onUpdate({ id: c.id, client_handle: handle.replace(/^@/, "") || null })}
                placeholder="cliente"
                className="h-6 w-32 pl-5 pr-1.5 text-xs rounded-md border border-border bg-card text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {approvedToConvert.length > 0 && (
            <Button variant="secondary" size="sm" onClick={convertApproved} disabled={converting} className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" /> {converting ? "Convertendo…" : `Converter ${approvedToConvert.length} aprovado(s) → Cria Post`}
            </Button>
          )}
          {/* Botão único: "Enviar pra aprovação" já marca como enviado E copia o link. */}
          <Button size="sm" onClick={sendForApproval} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Enviar pra aprovação</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if (await confirmar({ titulo: "Excluir este cronograma?", descricao: "O link público dele para de funcionar na hora." })) onDelete(c.id); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <DatasComemorativasSection cronogramaId={c.id} clientSegment={clientSegment} />

      {/* Itens em CAIXINHAS separadas e arrastáveis, arrastar muda o número (#4 vira #1). */}
      <div className="space-y-2">
        {mesesDisp.length > 1 && (
          <div className="flex gap-1.5 flex-wrap mb-1">
            <button onClick={() => setMes("all")} className={cn("text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors", mes === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>Tudo</button>
            {mesesDisp.map((k) => (
              <button key={k} onClick={() => setMes(k)} className={cn("text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors", mes === k ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{MESES[Number(k.slice(5, 7)) - 1]}</button>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <p className="text-[11px] font-body text-muted-foreground">{mes === "all" ? <>Arraste pelo <GripVertical className="inline h-3 w-3 -mt-0.5" /> pra reordenar. O número acompanha a ordem.</> : "Filtrando por mês. Volte pra “Tudo” pra reordenar."}</p>
        )}
        <DragDropContext onDragEnd={onReorder}>
          <Droppable droppableId="cronograma-itens">
            {(dropP) => (
              <div ref={dropP.innerRef} {...dropP.droppableProps} className="space-y-2.5">
                {visible.map((it, i) => (
                  <Draggable key={it.id} draggableId={it.id} index={i} isDragDisabled={mes !== "all"}>
                    {(dragP, dragS) => (
                      <div ref={dragP.innerRef} {...dragP.draggableProps}
                        className={cn("group bg-card border border-border rounded-2xl p-3.5 transition-shadow",
                          dragS.isDragging && "shadow-warm-lg ring-2 ring-primary/40")}>
                        <div className="flex items-start gap-2.5">
                          {/* Alça de arrasto + número */}
                          <div {...dragP.dragHandleProps} className="flex items-center gap-1 shrink-0 pt-0.5 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                            <span className="text-sm font-display font-extrabold text-muted-foreground">#{i + 1}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Cabeçalho: tipo · data · status */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {it.type && <span className={cn("text-[10px] font-bold text-white px-2 py-0.5 rounded-full", TYPE_COLOR[it.type] ?? "bg-gray-500")}>{it.type}</span>}
                              {/* Data editável no próprio card: antes só dava pra
                                  mudar abrindo o editor do item, o que é lento quando
                                  você está distribuindo o mês inteiro. */}
                              <input
                                type="date"
                                value={it.date ?? ""}
                                onChange={(e) => updateItem.mutate({ id: it.id, date: e.target.value || null })}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Data do post"
                                className={cn(
                                  "h-6 rounded-md border border-transparent bg-transparent px-1 text-[11px] font-body",
                                  "hover:border-border hover:bg-muted/50 focus:border-primary/50 focus:bg-card focus:outline-none transition-colors",
                                  it.date ? "text-foreground" : "text-muted-foreground",
                                )}
                              />
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto", ST_CLASS[it.approval_status])}>{ST_LABEL[it.approval_status]}</span>
                              {it.converted_post_id && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><Check className="h-2.5 w-2.5" /> no Cria Post</span>}
                            </div>

                            {/* Nome (título) do post */}
                            <p className="text-sm font-display font-bold text-foreground leading-snug">{it.title || it.copy || "(sem nome)"}</p>

                            {/* Copy em caixinha própria (separada do nome) */}
                            {it.copy && (
                              <div className="mt-1.5 rounded-xl bg-primary/[0.04] border border-primary/15 px-3 py-2">
                                <p className="text-[10px] font-body font-bold uppercase tracking-wide text-primary/70 mb-0.5">Copy</p>
                                <p className="text-[12.5px] font-body text-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{it.copy}</p>
                              </div>
                            )}

                            {/* Descrição em caixinha própria, preservando os parágrafos */}
                            {it.description && (
                              <div className="mt-1.5 rounded-xl bg-muted/40 border border-border/60 px-3 py-2">
                                <p className="text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground/70 mb-0.5">Descrição</p>
                                <p className="text-[12px] font-body text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{it.description}</p>
                              </div>
                            )}

                            {/* Referências: um link clicável por linha (o item pode ter vários) */}
                            {parseRefLinks(it.ref_url).length > 0 && (
                              <div className="mt-2 flex flex-col gap-1 items-start">
                                {parseRefLinks(it.ref_url).map((url, n) => (
                                  isRefLink(url) ? (
                                    <a key={n} href={refLinkHref(url)} target="_blank" rel="noopener noreferrer" title={url}
                                      className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-body font-semibold text-primary hover:underline">
                                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{n === 0 ? "Ver referência" : refLinkLabel(url)}</span>
                                    </a>
                                  ) : (
                                    // Não parece link: mostra como texto pra não virar um <a> quebrado.
                                    <span key={n} className="text-[12px] font-body text-muted-foreground break-all">{url}</span>
                                  )
                                ))}
                              </div>
                            )}

                            {it.client_comment && (
                              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">"{it.client_comment}"</div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(it)} className="w-7 h-7 rounded-lg border border-border grid place-items-center hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={async () => { if (await confirmar({ titulo: "Excluir este item do cronograma?" })) deleteItem.mutate(it.id); }} className="w-7 h-7 rounded-lg border border-border grid place-items-center hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropP.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-body text-foreground font-medium">Nenhum item ainda</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Adicione o primeiro conteúdo do cronograma.</p>
          </div>
        )}

        <div className="pt-1 text-center">
          <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Adicionar item</Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Nome (título do post)</Label><Input value={f.title ?? ""} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Reels de bastidores" className="rounded-xl" /></div>
            <div><Label className="text-xs">Copy</Label><Textarea value={f.copy ?? ""} onChange={(e) => setF((p) => ({ ...p, copy: e.target.value }))} rows={3} placeholder="A legenda/copy do post" className="rounded-xl" /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea value={f.description ?? ""} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Roteiro, ideia, o que gravar…" className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data</Label><Input type="date" value={f.date ?? ""} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} className="rounded-xl" /></div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={f.type ?? "Reels"} onValueChange={(v) => setF((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{CRONOGRAMA_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* Referência: aceita mais de um link. O "+" ao lado abre outra linha. */}
            <div>
              <Label className="text-xs">Referência (link de inspiração)</Label>
              <MultiLinkInput value={refLinks} onChange={setRefLinks} className="mt-1"
                placeholder="Cole um link de referência (Drive, post, Pinterest...)" />
              <p className="text-[11px] font-body text-muted-foreground mt-1">Toque no + pra adicionar mais de uma referência.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveItem} disabled={addItem.isPending || updateItem.isPending} className="rounded-xl">{editing ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatasComemorativasSection({ cronogramaId, clientSegment }: { cronogramaId: string; clientSegment?: string | null }) {
  const { datas, addData, addManyDatas, deleteData, reorder } = useCronogramaDatas(cronogramaId);
  const [label, setLabel] = useState("");
  const [day, setDay] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  // Mesma trava do saveItem: evita que duplo clique/tap adicione a data duplicada.
  const addingRef = useRef(false);
  const addCustom = async () => {
    if (!label.trim() || addingRef.current) return;
    addingRef.current = true;
    try {
      await addData.mutateAsync({ label: label.trim(), day_label: day.trim() || null });
      setLabel(""); setDay("");
    } finally {
      addingRef.current = false;
    }
  };

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const next = Array.from(datas);
    const [moved] = next.splice(r.source.index, 1);
    next.splice(r.destination.index, 0, moved);
    reorder.mutate(next);
  };

  const existingLabels = new Set(datas.map((d) => d.label.toLowerCase()));
  const selectedCount = datas.filter((d) => d.selected).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h4 className="font-display font-bold text-foreground flex items-center gap-2 text-sm">
          <PartyPopper className="h-4 w-4 text-primary" /> Datas comemorativas
          {datas.length > 0 && <span className="text-xs font-body font-normal text-muted-foreground">· {selectedCount} marcadas pelo cliente</span>}
        </h4>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Lista anual</Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">Adicione datas pro cliente marcar quais quer trabalhar. Ele dá check no link. Arraste pela alça pra reordenar.</p>

      {datas.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="datas-comemorativas">
            {(dp) => (
              <div ref={dp.innerRef} {...dp.droppableProps} className="flex flex-col gap-1.5 mb-3">
                {datas.map((d, idx) => (
                  <Draggable key={d.id} draggableId={d.id} index={idx}>
                    {(dr, snap) => (
                      <div ref={dr.innerRef} {...dr.draggableProps}
                        className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 group bg-card", d.selected ? "border-primary/40 bg-primary/[0.04]" : "border-border", snap.isDragging && "shadow-lg")}>
                        <button {...dr.dragHandleProps} className="text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" aria-label="Arrastar"><GripVertical className="h-4 w-4" /></button>
                        {d.selected
                          ? <span className="w-4 h-4 rounded bg-primary grid place-items-center shrink-0"><Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} /></span>
                          : <span className="w-4 h-4 rounded border border-border shrink-0" />}
                        <span className="text-sm text-foreground">{d.label}</span>
                        {d.day_label && <span className="text-xs text-muted-foreground">{d.day_label}</span>}
                        <button onClick={() => deleteData.mutate(d.id)} className="ml-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 text-destructive transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
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

      <div className="flex gap-2 flex-wrap">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Ex.: Dia do Café" className="rounded-xl flex-1 min-w-[160px] h-9" />
        <div className="flex items-center gap-1">
          <Input value={day} onChange={(e) => setDay(maskDay(e.target.value))} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="14/04" inputMode="numeric" className="rounded-xl w-20 h-9" />
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" aria-label="Escolher no calendário"><CalendarRange className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" onSelect={(dt) => { if (dt) { setDay(`${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`); setCalOpen(false); } }} />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={addCustom} disabled={!label.trim() || addData.isPending} className="rounded-xl h-9 gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>

      <AnnualDatesDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingLabels={existingLabels}
        clientSegment={clientSegment}
        onConfirm={async (rows) => { if (rows.length) await addManyDatas.mutateAsync(rows); setPickerOpen(false); }}
      />
    </div>
  );
}

function AnnualDatesDialog({ open, onOpenChange, existingLabels, clientSegment, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingLabels: Set<string>;
  clientSegment?: string | null;
  onConfirm: (rows: { label: string; day_label: string | null }[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setPicked((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Segmentos: "geral" (feriados) sempre; o do cliente vem sugerido pelo campo Segmento.
  const sugerido = segmentoDoTexto(clientSegment);
  const [segs, setSegs] = useState<Set<SegmentKey>>(() => {
    const s = new Set<SegmentKey>(["geral"]);
    if (sugerido) s.add(sugerido);
    return s;
  });
  const toggleSeg = (k: SegmentKey) => setSegs((prev) => {
    const n = new Set(prev);
    n.has(k) ? n.delete(k) : n.add(k);
    if (n.size === 0) n.add("geral");   // nunca fica vazio
    return n;
  });

  const lista = datasPara([...segs]);
  const rows = lista.flatMap((g) => g.items.map((it) => ({ key: `${g.month}-${it.label}`, label: it.label, day_label: it.day })));
  const confirm = () => onConfirm(rows.filter((r) => picked.has(r.key)).map(({ label, day_label }) => ({ label, day_label })));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Lista anual de datas</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Escolha o segmento do cliente e marque as datas pra adicionar ao cronograma.</p>

        {/* Segmento do cliente, filtra as datas */}
        <div className="flex flex-wrap gap-1.5 pb-1 border-b border-border">
          {SEGMENTOS.map((s) => {
            const on = segs.has(s.key);
            return (
              <button key={s.key} type="button" onClick={() => toggleSeg(s.key)}
                className={cn("text-[12px] font-body px-2.5 py-1 rounded-full border transition-colors",
                  on ? "border-primary bg-primary/[0.06] text-primary font-semibold" : "border-border text-muted-foreground hover:border-primary/40")}>
                {s.emoji} {s.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 py-2">
          {lista.map((g) => (
            <div key={g.month}>
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">{g.month}</p>
              <div className="grid gap-1">
                {g.items.map((it) => {
                  const key = `${g.month}-${it.label}`;
                  const already = existingLabels.has(it.label.toLowerCase());
                  const checked = picked.has(key);
                  return (
                    <button key={key} disabled={already} onClick={() => toggle(key)}
                      className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-colors",
                        already ? "opacity-40 cursor-not-allowed border-border" : checked ? "border-primary bg-primary/[0.05]" : "border-border hover:border-primary/40")}>
                      <span className={cn("w-4 h-4 rounded grid place-items-center shrink-0", checked ? "bg-primary" : "border border-border")}>
                        {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                      </span>
                      <span className="text-sm text-foreground flex-1">{it.label}</span>
                      <span className="text-xs text-muted-foreground">{already ? "já incluída" : it.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={confirm} disabled={picked.size === 0} className="rounded-xl">Adicionar {picked.size > 0 ? `(${picked.size})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
