import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useExternalClients, useExternalPosts, usePortalActivity, type ExternalClient, type ExternalPost, type ExternalPostInput } from "@/hooks/useCriaPost";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import { EnviarParaParceiro } from "@/components/accounts/EnviarParaParceiro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArtBriefDialog } from "./ArtBriefDialog";
import { ClientContentWriter } from "./ClientContentWriter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CronogramaBoard } from "@/components/accounts/CronogramaBoard";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useEditorialLines } from "@/hooks/useEditorialLines";
import { Plus, Link2, Pencil, Loader2, ArrowLeft, Trash2, RotateCcw, FileText, Instagram, KanbanSquare, Eye, Clock, Settings2, Palette, Copy, CalendarDays, X, ChevronDown, History, Hash, Check } from "lucide-react";
import { usePostApprovalComments } from "@/hooks/useApprovals";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { Calendar } from "@/components/ui/calendar";
import { CriaPostMedia } from "@/components/accounts/CriaPostMedia";
import { ImportKanbanDialog } from "@/components/accounts/ImportKanbanDialog";
import { ClientReportDialog } from "@/components/accounts/ClientReportDialog";
import { NotasRelatorioSalvas } from "@/components/accounts/NotasRelatorioSalvas";
import { ExternalClientDialog } from "@/components/accounts/ExternalClientDialog";
import { useProfile } from "@/hooks/useProfile";
import { useCrmClients } from "@/hooks/useCrm";
import { useClientSocialConnection, connectInstagram } from "@/hooks/useSocialInsights";
import { ClienteInstagramCria } from "@/components/accounts/ClienteInstagramCria";
import { FORMATS_BY_PLATFORM, FORMAT_LABELS, normalizarFormato } from "@/lib/constants";
// Cor por formato (fonte única): a pessoa bate o olho e sabe o que é.
import { formatColorVars, FORMAT_TEXT_CLASS, FORMAT_BORDER_CLASS, FORMAT_DOT_CLASS } from "@/lib/format-colors";
// Toggle Kanban/Calendário compartilhado com as outras telas de board.
import { ViewToggle } from "@/components/shared/ViewToggle";
// Ordem manual (arrastada) x ordem por data. Só exibição, nada vai pro banco.
import { OrdemDataToggle } from "@/components/shared/OrdemDataToggle";
import { useOrdemPorData } from "@/hooks/useOrdemPorData";
import { ordenarPorData } from "@/lib/ordenar-por-data";
// Ideia / Referência aceita VÁRIOS links (um por linha na mesma coluna).
import { MultiLinkInput } from "@/components/shared/MultiLinkInput";
import { parseRefLinks, serializeRefLinks, refLinkHref, refLinkLabel, isRefLink } from "@/lib/refLinks";
// Etiquetas INTERNAS do post: só a agência vê, o cliente nunca recebe.
import { InternalTagPicker } from "@/components/shared/InternalTagPicker";
import { useClientHashtags, blocoParaColar, LIMITE_HASHTAGS_POST } from "@/hooks/useClientHashtags";
import { usePostTags, usePostInternalTags, useSetPostInternalTags, POST_TAG_DOT_CLS, type PostTag } from "@/hooks/usePostTags";
import { TAG_COLOR_CLS } from "@/hooks/useCrm";

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const FORMATS = ["reels", "carrossel", "foto", "story", "video"];
// CLIENT_COLORS mudou de casa (ExternalClientDialog), re-export mantém imports antigos.
export { CLIENT_COLORS } from "@/components/accounts/ExternalClientDialog";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Copia a legenda inteira preservando a formatação (quebras/parágrafos). Clipboard API
// com fallback (textarea + execCommand) pra quando o navegador não expõe o clipboard.
async function copiarLegenda(texto: string) {
  const valor = texto ?? "";
  if (!valor.trim()) { toast.error("Não há legenda pra copiar."); return; }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
    } else {
      const ta = document.createElement("textarea");
      ta.value = valor; ta.style.position = "fixed"; ta.style.top = "-9999px"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy"); ta.remove();
      if (!ok) throw new Error("clipboard indisponível");
    }
    toast.success("Legenda copiada");
  } catch {
    toast.error("Não consegui copiar a legenda. Copie manualmente.");
  }
}
function relTimeBR(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
function daysWaiting(p: ExternalPost): number {
  const base = p.approval_updated_at ?? p.created_at;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
}
// Data + hora do histórico no fuso BR (só exibição; o instante já vem em UTC do banco).
const DT_FMT_BR = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
function fmtDateTimeBR(iso: string): string {
  try { return DT_FMT_BR.format(new Date(iso)); } catch { return ""; }
}

// Histórico de aprovação do post: TODO o vai e volta com o cliente, em ordem
// cronológica. Reaproveita post_approval_comments (todos os comentários, não só o
// último): cada pedido de ajuste do cliente ("cliente_externo") e cada reenvio
// nosso ("social_media"). Fica recolhido por padrão pra não poluir o editor.
function ApprovalHistory({ postId }: { postId: string }) {
  const { comments, isLoading } = usePostApprovalComments(postId);
  const [open, setOpen] = useState(false);
  if (isLoading || comments.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors">
        <span className="flex items-center gap-1.5 text-xs font-body font-bold text-foreground">
          <History className="h-3.5 w-3.5 text-muted-foreground" /> Histórico de aprovação ({comments.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
          {comments.map((c) => {
            // "cliente_externo" (portal por link) e "cliente" (aprovação interna) = o cliente.
            const isClient = c.author_role === "cliente_externo" || c.author_role === "cliente" || c.author_role === "cliente_externo_aprovacao";
            // Elogio na aprovação: verde, pra não parecer mais um pedido de mudança.
            const isPraise = c.author_role === "cliente_externo_aprovacao";
            return (
              <div key={c.id} className={`rounded-lg border px-2.5 py-2 ${isPraise ? "border-emerald-100 bg-emerald-50" : isClient ? "border-orange-100 bg-orange-50" : "border-primary/15 bg-primary/[0.04]"}`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-[11px] font-body font-bold ${isPraise ? "text-emerald-700" : isClient ? "text-orange-700" : "text-primary"}`}>{isPraise ? "Cliente aprovou" : isClient ? "Cliente" : "Você"}</span>
                  <span className="text-[10px] font-body text-muted-foreground shrink-0">{fmtDateTimeBR(c.created_at)}</span>
                </div>
                <p className="text-[12.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed">{c.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
const STATUS: Record<string, { label: string; cls: string }> = {
  em_producao: { label: "Em produção", cls: "bg-violet-100 text-violet-700" },
  pendente: { label: "Aguardando cliente", cls: "bg-amber-100 text-amber-700" },
  ajuste_solicitado: { label: "Ajuste solicitado", cls: "bg-orange-100 text-orange-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  postado: { label: "Postado", cls: "bg-slate-200 text-slate-600" },
};
// 5 status: post nasce em produção; a social mídia libera pro cliente (aguardando);
// cliente aprova ou pede ajuste; depois de publicado, vai pra Postado.
const APPROVAL_COLS = ["em_producao", "pendente", "ajuste_solicitado", "aprovado", "postado"] as const;
type ApprovalKey = (typeof APPROVAL_COLS)[number];

// ── Filtro de data + formato do board (Produção). Persiste por dispositivo pra
// voltar do jeito que a pessoa deixou, até ela limpar.
const FILTER_KEY = "criapost_filter_v1";
const PRESET_DAYS: Record<string, number> = { "7": 7, "15": 15, "30": 30, "60": 60 };
type PostFilter = {
  preset: "all" | "7" | "15" | "30" | "60" | "custom"; // atalho de período
  from: string; // YYYY-MM-DD (só quando preset = custom)
  to: string;   // YYYY-MM-DD (só quando preset = custom)
  fmt: string;  // "all" | formato
  tag: string;  // "all" | id da etiqueta interna
};
const FILTER_DEFAULT: PostFilter = { preset: "all", from: "", to: "", fmt: "all", tag: "all" };

// Carrega o filtro salvo. Se um dia existir o esquema antigo (mês/formato solto),
// migramos: o mês YYYY-MM vira um intervalo custom daquele mês.
function loadPostFilter(): PostFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PostFilter>;
      const presets = ["all", "7", "15", "30", "60", "custom"];
      return {
        preset: (presets.includes(p.preset as string) ? p.preset : "all") as PostFilter["preset"],
        from: typeof p.from === "string" ? p.from : "",
        to: typeof p.to === "string" ? p.to : "",
        fmt: typeof p.fmt === "string" ? p.fmt : "all",
        // Filtro por etiqueta é novo: quem tem filtro salvo de antes cai em "all".
        tag: typeof p.tag === "string" ? p.tag : "all",
      };
    }
    // Migração best-effort do esquema antigo (nunca chegou a persistir, mas fica o gancho).
    const oldMes = localStorage.getItem("criapost_mes"); // "YYYY-MM"
    const oldFmt = localStorage.getItem("criapost_fmt");
    if (oldMes || oldFmt) {
      const migrated = { ...FILTER_DEFAULT };
      if (oldMes && /^\d{4}-\d{2}$/.test(oldMes)) {
        const [y, m] = oldMes.split("-").map(Number);
        const last = new Date(y, m, 0).getDate(); // último dia do mês
        migrated.preset = "custom";
        migrated.from = `${oldMes}-01`;
        migrated.to = `${oldMes}-${String(last).padStart(2, "0")}`;
      }
      if (oldFmt) migrated.fmt = oldFmt;
      try { localStorage.removeItem("criapost_mes"); localStorage.removeItem("criapost_fmt"); } catch { /* segue */ }
      return migrated;
    }
  } catch { /* segue */ }
  return { ...FILTER_DEFAULT };
}

// Intervalo efetivo (YYYY-MM-DD) do filtro. Preset "últimos N dias" = janela
// inclusiva terminando hoje (fuso BR). null = sem limite naquela ponta.
function filterRange(f: PostFilter): { from: string | null; to: string | null } {
  if (f.preset === "all") return { from: null, to: null };
  if (f.preset === "custom") return { from: f.from || null, to: f.to || null };
  const n = PRESET_DAYS[f.preset] ?? 0;
  const to = hojeBR();
  const d = parseDateOnly(to);
  d.setDate(d.getDate() - (n - 1));
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from, to };
}

// DD/MM só pra rótulo do chip. A string já é YYYY-MM-DD (date, sem fuso), então
// dá pra fatiar direto sem passar por Date (evita off-by-one).
function ddmm(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// DD/MM/AAAA pro gatilho do campo de data.
function ddmmyyyy(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// Date -> YYYY-MM-DD pelos componentes locais (dia de calendário, sem UTC).
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Campo de data visual: clica -> abre o calendário shadcn num popover; seleciona
// o dia -> fecha e guarda como string YYYY-MM-DD (fuso BR). Mesmo padrao do TasksTab.
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateOnly(value) : undefined;
  return (
    <div className="flex-1 min-w-0">
      <Label className="text-[11px] font-body text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="mt-1 flex w-full items-center gap-1.5 h-10 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? ddmmyyyy(value) : "dd/mm/aaaa"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selected} defaultMonth={selected}
            onSelect={(dt) => { if (dt) { onChange(isoFromDate(dt)); setOpen(false); } }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Exibição das etiquetas INTERNAS (nunca vai pro cliente) ──
// Resolve id -> etiqueta do catálogo. Id que não existe mais (etiqueta
// excluída) some da tela em vez de virar chip quebrado.
function resolveTags(ids: string[] | undefined, catalog: PostTag[]): PostTag[] {
  if (!ids?.length || !catalog.length) return [];
  return ids.map((id) => catalog.find((t) => t.id === id)).filter(Boolean) as PostTag[];
}

// Card do KANBAN: chip pequeno com o nome. Mostra até 2 e resume o resto em "+N"
// (o card já carrega formato, título, data, referência e avisos).
function TagChips({ ids, catalog, topo }: { ids: string[] | undefined; catalog: PostTag[]; topo?: boolean }) {
  const tags = resolveTags(ids, catalog);
  if (!tags.length) return null;
  const visiveis = tags.slice(0, 2);
  const resto = tags.length - visiveis.length;
  return (
    // `topo`: usado dentro da faixa de pílulas no ALTO do card (sem a margem
    // que fazia sentido quando isto morava no rodapé).
    <div className={`flex flex-wrap items-center gap-1 ${topo ? "" : "mt-1.5"}`} title={`Etiquetas internas: ${tags.map((t) => t.name).join(", ")}`}>
      {visiveis.map((t) => (
        <span key={t.id} className={`text-[9.5px] font-body font-bold px-1.5 py-0.5 rounded-full border max-w-[110px] truncate ${TAG_COLOR_CLS[t.color] ?? TAG_COLOR_CLS.slate}`}>{t.name}</span>
      ))}
      {resto > 0 && <span className="text-[9.5px] font-body font-bold px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">+{resto}</span>}
    </div>
  );
}

// Célula do CALENDÁRIO: é apertada e já tem tarja de status, título, formato e a
// barra lateral colorida do formato. Aqui NÃO cabe mais um bloco: viram bolinhas
// na cor da etiqueta, com os nomes no title (tooltip) e "+N" a partir da quarta.
function TagDots({ ids, catalog }: { ids: string[] | undefined; catalog: PostTag[] }) {
  const tags = resolveTags(ids, catalog);
  if (!tags.length) return null;
  const visiveis = tags.slice(0, 3);
  const resto = tags.length - visiveis.length;
  const nomes = tags.map((t) => t.name).join(", ");
  return (
    <span className="flex items-center gap-0.5 mt-0.5" title={`Etiquetas internas: ${nomes}`} aria-label={`Etiquetas internas: ${nomes}`}>
      {visiveis.map((t) => (
        <span key={t.id} aria-hidden className={`h-1.5 w-1.5 rounded-full shrink-0 ${POST_TAG_DOT_CLS[t.color] ?? POST_TAG_DOT_CLS.slate}`} />
      ))}
      {resto > 0 && <span className="text-[8px] font-body font-bold text-muted-foreground leading-none">+{resto}</span>}
    </span>
  );
}

export function ClientDetail({ client, onBack, embedded, activeTab, onTabChange }: { client: ExternalClient; onBack?: () => void; embedded?: boolean; activeTab?: string; onTabChange?: (t: string) => void }) {
  const { posts, isLoading, create, createDraft, update, remove, moveStatus, setDate, reorderExternalPosts } = useExternalPosts(client.id);
  const qc = useQueryClient();
  // Etiquetas INTERNAS: catálogo da agência + o que cada post tem marcado.
  // Query própria (não entra no select do board) pra que, sem a migration, o
  // board continue abrindo normalmente e só as etiquetas fiquem vazias.
  const { data: tagCatalog = [] } = usePostTags();
  const { data: tagsByPost = {} } = usePostInternalTags(client.id);
  const setPostTags = useSetPostInternalTags(client.id);
  // Linhas editoriais do cliente (cadastradas na estratégia): alimentam o
  // seletor do editor e o chip do card. Query própria, mesmo racional das tags.
  const { data: editorialLines = [] } = useEditorialLines(client.id);
  const linhaDoPost = (id: string | null | undefined) =>
    id ? editorialLines.find((el) => el.id === id) ?? null : null;
  // Clicar no vazio e arrastar pro lado rola o board (só mouse; no toque nada muda).
  const boardRef = useDragScroll<HTMLDivElement>();
  // Filtro de data/formato pra revisar/enviar só o que interessa. Persistido em
  // localStorage (criapost_filter_v1) e reaplicado no F5 até a pessoa limpar.
  const [filter, setFilter] = useState<PostFilter>(() => loadPostFilter());
  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filter)); } catch { /* segue */ }
  }, [filter]);
  const range = filterRange(filter);
  const filterActive = filter.preset !== "all" || filter.fmt !== "all" || filter.tag !== "all";
  // Lista de formatos do filtro: canoniza cada post antes do Set pra "Reels" e
  // "reels" (ou qualquer variação gravada) virarem UM chip só, não dois.
  const formatosPost = Array.from(new Set(posts.map((p) => normalizarFormato(p.format)).filter(Boolean)));
  // Só as etiquetas que estão REALMENTE em uso viram filtro (o catálogo inteiro
  // encheria a tela de chip que não filtra nada).
  const tagsEmUso = tagCatalog.filter((t) => posts.some((p) => (tagsByPost[p.id] ?? []).includes(t.id)));
  const viewPosts = posts.filter((p) => {
    if (filter.fmt !== "all" && normalizarFormato(p.format) !== filter.fmt) return false;
    if (filter.tag !== "all" && !(tagsByPost[p.id] ?? []).includes(filter.tag)) return false;
    // Post sem data (tipicamente "Em produção") SEMPRE aparece: só o formato o filtra.
    if (!p.scheduled_date) return true;
    if (range.from && p.scheduled_date < range.from) return false;
    if (range.to && p.scheduled_date > range.to) return false;
    return true;
  });
  // Ordem das colunas: manual (arrastada, board_order) ou por data de publicação.
  // Preferência de EXIBIÇÃO, salva por dispositivo. Desligar devolve a ordem manual
  // inteira, porque nada foi regravado no banco enquanto estava ligada.
  const [porData, setPorData, ordemDir, alternarOrdem] = useOrdemPorData("criapost_ordem_data_v1");
  // Data do card neste board = data de PUBLICAÇÃO (scheduled_date), desempatada
  // pelo horário. Post sem data agendada cai no fim da coluna. A direção (asc/desc)
  // vem do toggle "Por data" e mantém o "sem data no fim" nos dois sentidos.
  const ordenarColuna = (lista: ExternalPost[]) =>
    porData
      ? ordenarPorData(lista, (p) => p.scheduled_date, (p) => (p as { scheduled_time?: string | null }).scheduled_time, ordemDir)
      : lista;
  // Guarda o id do rascunho aberto: se o usuário cancelar, apagamos (não vira lixo).
  const [draftId, setDraftId] = useState<string | null>(null);
  // Kanban (padrão) ou Calendário. Preferência salva por dispositivo.
  const [view, setView] = useState<"kanban" | "calendario">(() => {
    try { return (localStorage.getItem("criapost_view") as "kanban" | "calendario") || "kanban"; } catch { return "kanban"; }
  });
  const setViewPersist = (v: "kanban" | "calendario") => {
    setView(v);
    try { localStorage.setItem("criapost_view", v); } catch { /* segue */ }
  };
  const { copyLink } = useExternalClients();
  const { profile } = useProfile();
  const { data: portalViewedAt } = usePortalActivity(client.id);
  const [confirmMove, setConfirmMove] = useState<{ id: string; status: ApprovalKey } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleApprovalDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const dest = r.destination.droppableId as ApprovalKey;
    const post = posts.find((p) => p.id === r.draggableId);
    if (!post) return;
    const from = (post.approval_status ?? "pendente");
    // Avançar manualmente pra "Aprovado" sem o cliente: pede confirmação (só na mudança de coluna).
    if (from !== dest && dest === "aprovado") { setConfirmMove({ id: r.draggableId, status: dest }); return; }
    // Com "Por data" ligado, a posição dentro da coluna é calculada pela data.
    // Gravar board_order aqui não teria efeito nenhum (o card voltaria pro lugar),
    // então avisamos e oferecemos a volta pra ordem manual. Arrastar ENTRE colunas
    // continua valendo normalmente: isso muda o STATUS, não a ordem.
    if (porData) {
      if (from === dest) {
        toast.info("Esta coluna está ordenada por data.", {
          description: "Volte pra Ordem manual pra reposicionar os cards arrastando.",
          action: { label: "Ordem manual", onClick: () => setPorData(false) },
        });
        return;
      }
      moveStatus.mutate({ id: r.draggableId, approval_status: dest });
      return;
    }
    // Reordena a coluna de destino (mesma coluna OU mudança de status), gravando board_order.
    const col = viewPosts.filter((p) => (p.approval_status ?? "pendente") === dest && p.id !== r.draggableId);
    col.splice(r.destination.index, 0, post);
    const changes: { id: string; board_order: number; approval_status?: string; approval_updated_at?: string }[] = [];
    col.forEach((p, idx) => {
      const isMoved = p.id === r.draggableId;
      const cur = (p as { board_order?: number }).board_order ?? -1;
      if (!isMoved && cur === idx) return;
      const ch: { id: string; board_order: number; approval_status?: string; approval_updated_at?: string } = { id: p.id, board_order: idx };
      if (isMoved && from !== dest) { ch.approval_status = dest; ch.approval_updated_at = new Date().toISOString(); }
      changes.push(ch);
    });
    reorderExternalPosts(changes);
  };
  const { data: crmClients = [] } = useCrmClients();
  // Hashtags do cliente (banco montado na Visão geral dele): entram na legenda
  // com um clique. Cliente sem vínculo no CRM não dispara query nenhuma.
  const { data: hashtagsCliente = [] } = useClientHashtags(client.crm_client_id);
  const criaOwnerId = crmClients.find((c) => c.id === client.crm_client_id)?.cria_owner_id ?? null;
  const hasCriaAccount = !!criaOwnerId;
  const { data: igConn } = useClientSocialConnection(client.crm_client_id);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Período vindo do Histórico de relatórios: reabre o relatório daquele mês.
  const [reportPeriodo, setReportPeriodo] = useState<{ since: string; until: string } | null>(null);
  // Personalização do cliente (logo, cores, vínculo central): antes vivia na lista do
  // Cria Post, agora acompanha o cliente aqui dentro (embutido no ClienteHub).
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalPost | null>(null);
  const [f, setF] = useState<ExternalPostInput>({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "", scheduled_date: null, scheduled_time: null, reference_url: null, drive_folder_url: null, editorial_line_id: null });
  // Ideia / Referência aceita VÁRIOS links. Na coluna continua um texto só, com
  // um link por linha (parseRefLinks/serializeRefLinks cuidam da conversão).
  const [refLinks, setRefLinks] = useState<string[]>([]);
  // Etiquetas internas do post aberto no editor (ids de post_tags).
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  // Novo post: cria um RASCUNHO na hora. Assim o post.id já existe e a mídia pode ser
  // anexada de cara (o storage precisa do id). O rascunho não aparece pro cliente.
  const openNew = async (day?: string) => {
    setF({ title: "", platform: "instagram", format: "reels", caption: "", hook: "", approval_mode: "fast", script: "", scheduled_date: day ?? null, scheduled_time: null, reference_url: null, drive_folder_url: null, editorial_line_id: null });
    setRefLinks([]);
    setInternalTags([]);
    setFormOpen(true);
    try {
      const draft = await createDraft.mutateAsync({ scheduled_date: day ?? null });
      setDraftId(draft.id);
      setEditing(draft);
    } catch { setFormOpen(false); }
  };
  const openEdit = (p: ExternalPost) => { setDraftId(null); setEditing(p); setRefLinks(parseRefLinks(p.reference_url)); setInternalTags(tagsByPost[p.id] ?? []); setF({ title: p.title, platform: p.platform, format: p.format, caption: p.caption ?? "", hook: p.hook ?? "", approval_mode: (p.approval_mode as "fast"|"flow"|"both") ?? "fast", script: p.script ?? "", scheduled_date: p.scheduled_date ?? null, scheduled_time: (p as { scheduled_time?: string | null }).scheduled_time ?? null, reference_url: p.reference_url ?? null, drive_folder_url: (p as { drive_folder_url?: string | null }).drive_folder_url ?? null, editorial_line_id: p.editorial_line_id ?? null }); setFormOpen(true); };

  // Cancelar um post novo apaga o rascunho (com a mídia que já subiu).
  const closeForm = async () => {
    setFormOpen(false);
    if (draftId) { await remove.mutateAsync(draftId).catch(() => { /* silencioso */ }); setDraftId(null); }
    setEditing(null);
  };

  // Novo post: só tem sentido perguntar quando é um RASCUNHO (draftId), porque é
  // ele que some ao fechar. Se qualquer campo foi preenchido (ou já subiu mídia),
  // confirma antes de descartar. Sem nada preenchido, fecha direto.
  const draftHasContent = () => {
    if ((f.title ?? "").trim() || (f.caption ?? "").trim() || (f.hook ?? "").trim() || (f.script ?? "").trim()) return true;
    if (refLinks.some((l) => l.trim())) return true;
    if (internalTags.length > 0) return true;
    if (f.scheduled_date || f.scheduled_time) return true;
    if (f.platform !== "instagram" || f.format !== "reels") return true;
    const media = draftId ? qc.getQueryData(["criapost-media", draftId]) : null;
    if (Array.isArray(media) && media.length > 0) return true;
    return false;
  };
  const requestCloseForm = async () => {
    if (draftId && draftHasContent()) {
      const ok = await confirmar({
        titulo: "Seu post não foi salvo",
        descricao: "Deseja sair mesmo assim? As informações preenchidas serão perdidas.",
        acao: "Sair sem salvar",
        cancelar: "Continuar editando",
      });
      if (!ok) return;
    }
    await closeForm();
  };

  const submit = async () => {
    if (!f.title.trim()) return;
    // Ideia / Referência: agora são VÁRIOS links, então a validação vale LINK A
    // LINK. Não exigimos mais "http" no começo porque refLinkHref normaliza quem
    // colou "site.com/x"; isRefLink só barra o que claramente não é endereço.
    const linkRuim = refLinks.map((l) => l.trim()).filter(Boolean).find((l) => !isRefLink(l));
    if (linkRuim) {
      toast.error(`"${refLinkLabel(linkRuim, 30)}" não parece um link. Confira a Ideia / Referência.`);
      return;
    }
    // Pasta do Drive: mesma validação simples (link http). Vazio = ok.
    if ((f.drive_folder_url ?? "").trim() && !/^https?:\/\//i.test((f.drive_folder_url ?? "").trim())) {
      toast.error("A pasta do Drive precisa ser um link começando com http.");
      return;
    }
    // A coluna reference_url continua a mesma: um link por linha.
    const payload: ExternalPostInput = { ...f, reference_url: serializeRefLinks(refLinks) };
    let postId: string | null = null;
    if (draftId) {
      // Rascunho → cria o post em PRODUÇÃO (ainda não vai pro cliente).
      await update.mutateAsync({ id: draftId, publish: true, ...payload });
      toast.success("Post criado! Está em produção. Libere pro cliente quando quiser.");
      postId = draftId;
      setDraftId(null);
    } else if (editing) {
      await update.mutateAsync({ id: editing.id, resend: editing.approval_status === "ajuste_solicitado", ...payload });
      postId = editing.id;
    } else {
      const criado = await create.mutateAsync(payload);
      postId = criado?.id ?? null;
      toast.success("Post criado! Está em produção.");
    }
    // Etiquetas internas gravam SEPARADO do post (ver usePostTags): assim, se a
    // migration ainda não rodou, o post salva normalmente e só a etiqueta avisa.
    // Só chama quando mudou de verdade, pra não avisar nada em save comum.
    if (postId) {
      const antes = [...(tagsByPost[postId] ?? [])].sort().join("|");
      const agora = [...internalTags].sort().join("|");
      if (antes !== agora) setPostTags.mutate({ id: postId, tags: internalTags });
    }
    setFormOpen(false);
    setEditing(null);
  };
  const doCopy = async () => { setCopying(true); await copyLink(client.id); setCopying(false); };
  // Envio por PERÍODO: gera um link que só mostra os posts daquele intervalo.
  const [linkOpen, setLinkOpen] = useState(false);
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const doCopyPeriod = async () => {
    if (!pStart || !pEnd) { toast.error("Escolha o início e o fim do período."); return; }
    if (pEnd < pStart) { toast.error("O fim tem que ser depois do início."); return; }
    setCopying(true);
    await copyLink(client.id, { start: pStart, end: pEnd });
    setCopying(false); setLinkOpen(false);
  };
  const onChangePlatform = (pl: string) => {
    setF((prev) => {
      const allowed = FORMATS_BY_PLATFORM[pl] ?? [];
      const format = allowed.length && !allowed.includes(prev.format) ? allowed[0] : prev.format;
      return { ...prev, platform: pl, format };
    });
  };

  return (
    <div>
      {!embedded && (
        <>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"><ArrowLeft className="h-4 w-4" /> Clientes</button>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight truncate">{client.name}</h1>
              {client.instagram_handle && <p className="text-sm text-muted-foreground font-body">@{client.instagram_handle.replace(/^@/, "")}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              {/* Link de aprovação dos POSTS (diferente do link do cronograma), nome explícito pra não confundir. */}
              <Button variant="outline" onClick={() => setLinkOpen(true)} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Link dos posts</span></>}</Button>
            </div>
          </div>
        </>
      )}

      <ClientReportDialog
        open={reportOpen}
        onOpenChange={(v) => { setReportOpen(v); if (!v) setReportPeriodo(null); }}
        client={client}
        posts={posts}
        managerName={profile?.name ?? undefined}
        initialPeriodKey={reportPeriodo ? "custom" : undefined}
        customSince={reportPeriodo?.since}
        customUntil={reportPeriodo?.until}
      />
      <ExternalClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <ImportKanbanDialog open={importOpen} onOpenChange={setImportOpen} externalClientId={client.id} criaOwnerId={criaOwnerId} existingTitles={new Set(posts.map((p) => p.title))} />

      <Tabs value={embedded ? activeTab : undefined} defaultValue={embedded ? undefined : "posts"} onValueChange={embedded ? onTabChange : undefined} className="w-full">
        {!embedded && (
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="posts" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Posts</TabsTrigger>
          <TabsTrigger value="cronograma" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Cronograma</TabsTrigger>
          <TabsTrigger value="relatorio" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Relatório</TabsTrigger>
          <TabsTrigger value="instagram" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Instagram</TabsTrigger>
        </TabsList>
        )}

        <TabsContent value="posts">
          {/* data-tour="prod-ferramentas": alvo do passo do tour do cockpit que
              explica as visões (Kanban/Calendário) e as ferramentas da Produção. */}
          <div data-tour="prod-ferramentas" className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            {/* Kanban (padrão) / Calendário, as duas visões conversam: mudar a data reflete no card. */}
            <ViewToggle value={view} onChange={setViewPersist} />
            <div className="flex gap-2 flex-wrap">
              {embedded && (
                <>
                  <Button variant="outline" onClick={() => setLinkOpen(true)} disabled={copying}>{copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Link de aprovação</span></>}</Button>
                  {/* Só na visão SOLTA do Cria Post. Dentro da ficha do cliente
                      existe a aba Portal, que faz o mesmo com mais espaço. */}
                  {!embedded && <Button variant="outline" onClick={() => setEditOpen(true)}><Settings2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Personalizar</span></Button>}
                </>
              )}
              <Button variant="outline" onClick={() => setImportOpen(true)}><KanbanSquare className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Importar do kanban</span></Button>
              <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1.5" /> Novo post</Button>
            </div>
          </div>
      {/* Filtro de data: só Tudo (ver todos / limpar) + período específico (popover).
          Mobile-first: o "Tudo" e o período ficam lado a lado; período num popover discreto. */}
      <div className="flex gap-1.5 flex-wrap items-center mb-3">
        {([["all", "Tudo"]] as [PostFilter["preset"], string][]).map(([v, label]) => (
          <button key={v} onClick={() => setFilter((prev) => ({ ...prev, preset: v }))}
            className={`text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter.preset === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter.preset === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <CalendarDays className="h-3.5 w-3.5" />
              {filter.preset === "custom" && (filter.from || filter.to) ? `${ddmm(filter.from) || "…"} – ${ddmm(filter.to) || "…"}` : "Período"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <p className="text-xs font-body font-semibold text-foreground mb-2">Período específico</p>
            <div className="flex gap-2">
              <DateField label="De" value={filter.from} onChange={(iso) => setFilter((prev) => ({ ...prev, from: iso, preset: "custom" }))} />
              <DateField label="Até" value={filter.to} onChange={(iso) => setFilter((prev) => ({ ...prev, to: iso, preset: "custom" }))} />
            </div>
          </PopoverContent>
        </Popover>
        {filterActive && (
          <button onClick={() => setFilter({ ...FILTER_DEFAULT })}
            className="inline-flex items-center gap-1 text-xs font-body font-semibold px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
        {/* Ordem das colunas. Só no kanban: no calendário quem manda é o dia. */}
        {view === "kanban" && (
          <>
            <span aria-hidden className="h-4 w-px bg-border mx-0.5 hidden sm:block" />
            <OrdemDataToggle valor={porData} direcao={ordemDir} onChange={setPorData} onToggle={alternarOrdem} />
          </>
        )}
      </div>
      {porData && view === "kanban" && (
        <p className="text-[11px] font-body text-muted-foreground -mt-1.5 mb-3">
          {ordemDir === "asc"
            ? "Cada coluna está da data mais próxima pra mais distante, e post sem data fica no fim."
            : "Cada coluna está da data mais distante pra mais próxima, e post sem data fica no fim."}
          {" "}Toque de novo em "Por data" pra inverter; pra reposicionar arrastando, volte pra Ordem manual.
        </p>
      )}
      {/* Filtro por formato: aparece quando há mais de um formato na fila. */}
      {formatosPost.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setFilter((prev) => ({ ...prev, fmt: "all" }))} className={`text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter.fmt === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>Todos os formatos</button>
          {/* Cada formato carrega a própria cor (bolinha + rótulo) pra o filtro
              falar a mesma língua do card do kanban e do calendário. */}
          {formatosPost.map((fmt) => {
            const ativo = filter.fmt === fmt;
            return (
              <button key={fmt} onClick={() => setFilter((prev) => ({ ...prev, fmt }))} style={formatColorVars(fmt)}
                className={`inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${ativo ? "bg-primary text-primary-foreground border-primary" : `border-border hover:bg-muted/40 ${FORMAT_TEXT_CLASS}`}`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full shrink-0 ${ativo ? "bg-primary-foreground" : FORMAT_DOT_CLASS}`} />
                {FORMAT_LABELS[fmt] ?? fmt}
              </button>
            );
          })}
        </div>
      )}
      {/* Filtro por ETIQUETA INTERNA: só aparece quando alguma está em uso, pra
          não poluir quem ainda não usa. Filtra kanban e calendário juntos. */}
      {tagsEmUso.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setFilter((prev) => ({ ...prev, tag: "all" }))}
            className={`text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter.tag === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>Todas as etiquetas</button>
          {tagsEmUso.map((t) => {
            const ativo = filter.tag === t.id;
            return (
              <button key={t.id} onClick={() => setFilter((prev) => ({ ...prev, tag: ativo ? "all" : t.id }))}
                className={`inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors ${ativo ? "bg-primary text-primary-foreground border-primary" : `${TAG_COLOR_CLS[t.color] ?? TAG_COLOR_CLS.slate} hover:opacity-80`}`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full shrink-0 ${ativo ? "bg-primary-foreground" : (POST_TAG_DOT_CLS[t.color] ?? POST_TAG_DOT_CLS.slate)}`} />
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      {view === "calendario" ? (
        <PostsCalendar posts={viewPosts} onOpen={openEdit} onNewAt={(d) => openNew(d)}
          onMove={(id, d) => setDate.mutate({ id, scheduled_date: d })}
          tagsByPost={tagsByPost} tagCatalog={tagCatalog} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : viewPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">{filterActive ? "Nenhum post com esse filtro" : "Nenhum post ainda"}</p>
          <p className="text-xs text-muted-foreground font-body mt-1">{filterActive ? "Ajuste o período/formato ou toque em Limpar." : "Crie um post: ele nasce em Produção. Quando estiver pronto, libere pro cliente (Aguardando)."}</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleApprovalDragEnd}>
          {/* data-tour="prod-quadro": alvo do passo "Da produção à publicação". */}
          <div ref={boardRef} data-tour="prod-quadro" className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 kanban-scroll">
            {APPROVAL_COLS.map((colKey) => {
              const st = STATUS[colKey];
              const colPosts = ordenarColuna(viewPosts.filter((p) => (p.approval_status ?? "pendente") === colKey));
              /* Coluna com CORPO próprio (pedido do Walter, 31/08): cabeçalho
                 sólido estilo Criando + fundo tingido segurando os cards, pra
                 dar a sensação de "estarem juntos" em vez de flutuarem sobre
                 o fundo da página. */
              const TOM: Record<ApprovalKey, { head: string; area: string }> = {
                em_producao: { head: "bg-gradient-to-br from-violet-500 to-violet-700", area: "bg-violet-100/50 dark:bg-violet-500/10" },
                pendente: { head: "bg-gradient-to-br from-amber-500 to-amber-600", area: "bg-amber-100/50 dark:bg-amber-500/10" },
                ajuste_solicitado: { head: "bg-gradient-to-br from-orange-500 to-orange-700", area: "bg-orange-100/50 dark:bg-orange-500/10" },
                aprovado: { head: "bg-gradient-to-br from-emerald-500 to-emerald-700", area: "bg-emerald-100/50 dark:bg-emerald-500/10" },
                postado: { head: "bg-gradient-to-br from-slate-500 to-slate-700", area: "bg-slate-200/50 dark:bg-slate-500/10" },
              };
              const tom = TOM[colKey];
              return (
                <div key={colKey} className={`w-[80vw] max-w-[300px] sm:w-72 shrink-0 rounded-2xl p-1.5 ${tom.area}`}>
                  <div className={`flex items-end justify-between rounded-xl px-3 py-2 mb-1.5 text-white shadow-sm ${tom.head}`}>
                    <span className="min-w-0">
                      <span className="block text-[8.5px] font-bold uppercase tracking-[0.12em] opacity-80">Status</span>
                      <span className="block font-display font-extrabold text-[14px] leading-tight truncate">{st.label}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold min-w-[20px] h-5 px-1.5 rounded-full bg-white/25 grid place-items-center">{colPosts.length}</span>
                  </div>
                  <Droppable droppableId={colKey}>
                  {(dropP, dropS) => (
                  <div ref={dropP.innerRef} {...dropP.droppableProps}
                    className={`min-h-[260px] rounded-xl p-1.5 space-y-2 transition-colors ${dropS.isDraggingOver ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}>
                    {colPosts.map((p, idx) => (
                      <Draggable key={p.id} draggableId={p.id} index={idx}>
                      {(dragP, dragS) => (
                      <div ref={dragP.innerRef} {...dragP.draggableProps} {...dragP.dragHandleProps} style={dragP.draggableProps.style}
                        // O card INTEIRO abre o post (era só o lápis, e a pessoa
                        // clicava no card esperando abrir). defaultPrevented é como
                        // o dnd marca o clique que na verdade foi um arraste; data/
                        // links/botões internos já dão stopPropagation.
                        onClick={(e) => { if (!e.defaultPrevented) openEdit(p); }}
                        className={`bg-card border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragS.isDragging ? "shadow-warm-lg ring-2 ring-primary/40" : ""}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {/* TOPO do card (pedido do Walter, 31/08): linha editorial e
                               etiquetas internas em pílulas ANTES do título, estilo
                               Trello. Só a equipe vê: nada disto vai pro cliente. */}
                            {(() => {
                              const el = linhaDoPost(p.editorial_line_id);
                              const temTags = (tagsByPost[p.id] ?? []).length > 0;
                              if (!el && !temTags) return null;
                              return (
                                <div className="flex flex-wrap items-center gap-1 mb-1.5">
                                  {el && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background: `${el.color}1f`, color: el.color }}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: el.color }} />{el.name}
                                    </span>
                                  )}
                                  <TagChips ids={tagsByPost[p.id]} catalog={tagCatalog} topo />
                                </div>
                              );
                            })()}
                            <span className="text-[10px] font-body font-bold uppercase tracking-wide"><span style={formatColorVars(p.format)} className={FORMAT_TEXT_CLASS}>{FORMAT_LABELS[normalizarFormato(p.format)] ?? cap(p.format)}</span> <span className="text-muted-foreground">· {cap(p.platform)}</span></span>
                            <p className="font-display font-bold text-sm text-foreground truncate mt-1">{p.title}</p>
                            {/* Data direto no card, sem abrir o post. Reflete no calendário na hora. */}
                            <input type="date" value={p.scheduled_date ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); setDate.mutate({ id: p.id, scheduled_date: e.target.value || null }); }}
                              className="mt-1 h-9 md:h-6 w-full rounded-md border border-border bg-card px-1.5 text-[11px] font-body text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            {/* Ideia / Referência: pode ter VÁRIOS links (backlog #142).
                                Um link só mantém o rótulo antigo; vários viram lista
                                numerada com o endereço curto, cada um clicável. */}
                            {(() => {
                              const links = parseRefLinks(p.reference_url);
                              if (!links.length) return null;
                              return (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {links.map((l, i) => (
                                    <a key={`${l}-${i}`} href={refLinkHref(l)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                      title={l}
                                      className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary hover:underline min-w-0">
                                      <Link2 className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{links.length === 1 ? "Ideia / Referência" : `${i + 1}. ${refLinkLabel(l, 28)}`}</span>
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                            {p.approval_status === "ajuste_solicitado" && p.last_comment && p.last_comment_role === "cliente_externo" && (
                              <div className="mt-2 text-xs font-body text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5" title={p.last_comment}>
                                <span className="font-bold">Cliente pediu um ajuste</span>
                                <p className="line-clamp-2 opacity-90 mt-0.5">{p.last_comment}</p>
                                <span className="text-[10.5px] font-bold underline">Abrir pra ver o ajuste completo</span>
                              </div>
                            )}
                            {p.approval_status === "aprovado" && p.last_comment && p.last_comment_role === "cliente_externo_aprovacao" && (
                              <div className="mt-2 text-xs font-body text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5" title={p.last_comment}>
                                <span className="font-bold">Cliente aprovou e comentou</span>
                                <p className="line-clamp-2 opacity-90 mt-0.5">{p.last_comment}</p>
                              </div>
                            )}
                            {colKey === "pendente" && (() => {
                              const sentAt = p.approval_updated_at ?? p.created_at;
                              const seen = !!portalViewedAt && new Date(portalViewedAt) >= new Date(sentAt);
                              const wait = daysWaiting(p);
                              if (!seen && wait <= 3) return null;
                              return (
                                <div className="mt-2 space-y-1">
                                  {seen && (
                                    <p className="flex items-center gap-1 text-[10px] font-body font-semibold text-sky-700"><Eye className="h-3 w-3 shrink-0" /> Visto pelo cliente {relTimeBR(portalViewedAt!)}</p>
                                  )}
                                  {wait > 3 && (
                                    <p className="flex items-center gap-1 text-[10px] font-body font-bold text-amber-600"><Clock className="h-3 w-3 shrink-0" /> Esperando há {wait} dias</p>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Linha editorial e etiquetas subiram pro TOPO do card. */}
                          </div>
                          <div className="flex flex-col gap-1.5 md:gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-9 w-9 md:h-7 md:w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(p); }} aria-label="Editar"><Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 md:h-7 md:w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }} aria-label="Excluir"><Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                      )}
                      </Draggable>
                    ))}
                    {colPosts.length === 0 && <div className="text-center py-10 text-muted-foreground/40 text-[10px]">vazio</div>}
                    {dropP.placeholder}
                  </div>
                  )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
        </TabsContent>

        <TabsContent value="cronograma">
          <CronogramaBoard fixedClientId={client.id} />
        </TabsContent>

        <TabsContent value="relatorio">
          {/* data-tour="rel-card": alvo do passo do relatório no tour do cockpit. */}
          <div data-tour="rel-card" className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-body text-foreground font-medium mb-1">Relatório mensal do cliente</p>
            <p className="text-xs text-muted-foreground font-body mb-4">Produção, desempenho do Instagram e análise da IA, pronto pra enviar em PDF.</p>
            <Button onClick={() => setReportOpen(true)}><FileText className="h-4 w-4 mr-1.5" /> Abrir relatório</Button>
          </div>
          {/* As notas que a social mídia escreveu em cada período, acessíveis sem gerar o PDF. */}
          <NotasRelatorioSalvas
            crmClientId={client.crm_client_id ?? null}
            onAbrirPeriodo={(since, until) => { setReportPeriodo({ since, until }); setReportOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="instagram">
          {client.crm_client_id && hasCriaAccount && criaOwnerId ? (
            // Cliente usa o CRIA: mostra os insights reais que ele mesmo sincronizou.
            <ClienteInstagramCria criaOwnerId={criaOwnerId} clientName={client.name} />
          ) : (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            {client.crm_client_id ? (
              igConn ? (
                <div className="flex items-center gap-2 text-green-700"><Instagram className="h-5 w-5" /> <span className="font-body text-sm font-medium">Conectado: @{igConn.username ?? "conta"}</span></div>
              ) : (
                <>
                  <p className="text-sm font-body text-foreground">Este cliente não usa o CRIA. Você pode conectar o Instagram dele aqui pra puxar os insights.</p>
                  <Button onClick={() => connectInstagram(client.crm_client_id)} className="gap-1.5"><Instagram className="h-4 w-4" /> Conectar Instagram</Button>
                </>
              )
            ) : (
              <p className="text-sm font-body text-muted-foreground">Vincule este cliente ao cadastro central (no botão "Editar" do cliente, na lista) pra habilitar os insights do Instagram.</p>
            )}
          </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmMove} onOpenChange={(o) => { if (!o) setConfirmMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avançar sem o cliente aprovar?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente ainda não aprovou este post pelo link. Você está movendo manualmente para <b>Aprovado</b> e assume essa decisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmMove) moveStatus.mutate({ id: confirmMove.id, approval_status: confirmMove.status }); setConfirmMove(null); }}>
              Sim, avançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e apaga o post do cliente. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) remove.mutate(confirmDelete); setConfirmDelete(null); }}>
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link de aprovação: tudo OU um período específico */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Link de aprovação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-body font-semibold text-foreground">Todos os posts</p>
              <p className="text-[12px] font-body text-muted-foreground mb-2">O cliente vê tudo que está na fila de aprovação.</p>
              <Button variant="outline" size="sm" onClick={async () => { await doCopy(); setLinkOpen(false); }} disabled={copying}>
                <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copiar link completo
              </Button>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
              <p className="text-sm font-body font-semibold text-foreground">Só um período</p>
              <p className="text-[12px] font-body text-muted-foreground mb-2">Gera um link que mostra apenas os posts agendados nesse intervalo.</p>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Label className="text-[11px] font-body text-muted-foreground">Início</Label>
                  <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="rounded-xl" />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px] font-body text-muted-foreground">Fim</Label>
                  <Input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <Button size="sm" onClick={doCopyPeriod} disabled={copying}>
                {copying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />} Copiar link do período
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) void requestCloseForm(); }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-md md:max-w-5xl bg-white rounded-2xl">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            {/* Etiquetas INTERNAS logo abaixo do título: entrada rápida, sem
                rótulo nem texto de apoio ocupando o formulário. A explicação de
                que o cliente não vê fica dentro do popover, na hora de usar. */}
            <div className="min-w-0 space-y-2">
              <DialogTitle className="font-display">{draftId || !editing ? "Novo post" : "Editar post"}</DialogTitle>
              <InternalTagPicker selected={internalTags} onChange={setInternalTags} />
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Cria Parceiros: delegar a produção sem sair do post. Só em post
                  já criado (rascunho ainda não tem id estável pro parceiro). */}
              {editing && !draftId && (
                <EnviarParaParceiro postId={editing.id} assigneeId={editing.assignee_id}
                  producaoStatus={editing.producao_status} prazo={editing.prazo_producao} />
              )}
              <Button variant="outline" size="sm" onClick={() => void requestCloseForm()}>Cancelar</Button>
              <Button size="sm" onClick={submit} disabled={create.isPending || update.isPending || !f.title.trim()}>{(create.isPending || update.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : draftId ? "Criar post" : editing ? (editing.approval_status === "ajuste_solicitado" ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Salvar e reenviar</> : "Salvar") : "Criar post"}</Button>
            </div>
          </DialogHeader>
          {/* Duas colunas INDEPENDENTES (flex): a mídia não estica mais os campos
              da esquerda. items-start = cada coluna com a própria altura. */}
          <div className="flex flex-col md:flex-row md:gap-5 gap-4 md:items-start">

            {/* Coluna esquerda: os campos */}
            <div className="md:w-[54%] space-y-4">
              {/* Ajuste do cliente: fica AQUI, no editor, com espaço pra ler tudo
                  (no card do kanban aparece só a prévia). */}
              {editing?.approval_status === "ajuste_solicitado" && editing?.last_comment && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <RotateCcw className="h-3.5 w-3.5 text-orange-700" />
                    <p className="text-xs font-body font-bold text-orange-800">O cliente pediu um ajuste</p>
                  </div>
                  <p className="text-[13px] font-body text-orange-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{editing.last_comment}</p>
                </div>
              )}
              {/* O RECADO DE QUEM APROVOU. Elogio enterrado num histórico fechado
                  é elogio que ninguém lê: aqui ele tem o mesmo peso visual do
                  pedido de ajuste, só que verde. Vale mais que parece: é o que a
                  social mídia leva pra reunião de renovação. */}
              {editing?.approval_status === "aprovado" && editing?.last_comment && editing?.last_comment_role === "cliente_externo_aprovacao" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    <p className="text-xs font-body font-bold text-emerald-800">O cliente aprovou e deixou um recado</p>
                  </div>
                  <p className="text-[13px] font-body text-emerald-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{editing.last_comment}</p>
                </div>
              )}
              {/* Histórico completo da aprovação (só ao editar um post já existente, não
                  no rascunho/novo). Guarda TODO o vai e volta pra a gestora não perder o
                  que o cliente pediu, mesmo depois de "Salvar e reenviar". */}
              {editing?.id && !draftId && <ApprovalHistory postId={editing.id} />}
              {/* Título */}
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Título *</Label>
                <Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
              </div>

              {/* Plataforma + Formato */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Plataforma</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLATFORMS.map((pl) => (
                      <button key={pl} type="button" onClick={() => onChangePlatform(pl)}
                        className={`rounded-full border text-sm py-2 transition-colors ${f.platform === pl ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{cap(pl)}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Formato</label>
                  <div className="flex flex-wrap gap-2">
                    {(FORMATS_BY_PLATFORM[f.platform] ?? FORMATS).map((ft) => (
                      <button key={ft} type="button" onClick={() => setF((p) => ({ ...p, format: ft }))}
                        className={`rounded-full border text-xs px-3 py-1.5 transition-colors ${f.format === ft ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{FORMAT_LABELS[ft] ?? cap(ft)}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LINHA EDITORIAL: cadastrada na estratégia do cliente, vira
                  etiqueta do post do cronograma até publicar. Só aparece se o
                  cliente TEM linhas (seletor vazio é ruído, não recurso). */}
              {editorialLines.length > 0 && (
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">Linha editorial</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setF((p) => ({ ...p, editorial_line_id: null }))}
                      className={`rounded-full border text-xs px-3 py-1.5 transition-colors ${!f.editorial_line_id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
                      Nenhuma
                    </button>
                    {editorialLines.map((el) => (
                      <button key={el.id} type="button" onClick={() => setF((p) => ({ ...p, editorial_line_id: el.id }))}
                        className="rounded-full border text-xs px-3 py-1.5 transition-colors inline-flex items-center gap-1.5"
                        style={f.editorial_line_id === el.id
                          ? { background: el.color, borderColor: el.color, color: "#fff" }
                          : { borderColor: `${el.color}66`, color: el.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.editorial_line_id === el.id ? "#fff" : el.color }} />
                        {el.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tipo de aprovação */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Tipo de aprovação</label>
                <div className="grid grid-cols-3 gap-2">
                  {([["fast","Simplificada"],["flow","Detalhada"],["both","Ambas"]] as [string,string][]).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setF((p) => ({ ...p, approval_mode: v as "fast"|"flow"|"both" }))}
                      className={`rounded-full border text-xs px-2 py-2 text-center transition-colors ${f.approval_mode === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Simplificada = 1 clique · Detalhada = 4 etapas · Ambas = o cliente escolhe.</p>
              </div>

              {/* Cronograma: data + hora */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Cronograma</label>
                {/* Data/Horário: lado a lado; abaixo de ~390px empilham pra o valor nunca espremer. */}
                <div className="grid grid-cols-2 gap-2 max-[390px]:grid-cols-1">
                  <div className="min-w-0">
                    <Label className="text-[11px] font-body text-muted-foreground">Data de publicação</Label>
                    <Input type="date" value={f.scheduled_date ?? ""} onChange={(e) => setF((p) => ({ ...p, scheduled_date: e.target.value || null }))} className="w-full h-10 rounded-xl" />
                  </div>
                  <div className="min-w-0">
                    <Label className="text-[11px] font-body text-muted-foreground">Horário</Label>
                    <Input type="time" value={f.scheduled_time ?? ""} onChange={(e) => setF((p) => ({ ...p, scheduled_time: e.target.value || null }))} className="w-full h-10 rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Ideia / Referência: cola um ou VÁRIOS links (Drive, post, Pinterest...)
                  que ficam clicáveis no card. O "+" abre mais uma linha; a coluna
                  continua sendo um texto só, com um link por linha. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Ideia / Referência (links)</Label>
                <MultiLinkInput value={refLinks} onChange={setRefLinks}
                  placeholder="Cole um link de inspiração (Drive, post, Pinterest...)" />
              </div>

              {/* Pasta do Drive: link da PASTA com os materiais deste post (distinto da
                  ideia/referência acima, que é só inspiração). Aparece como atalho
                  "Abrir pasta no Drive" na página de aprovação do cliente. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Pasta do Drive (link)</Label>
                <Input value={f.drive_folder_url ?? ""} onChange={(e) => setF((p) => ({ ...p, drive_folder_url: e.target.value || null }))}
                  placeholder="Cole o link da pasta do Drive com os materiais" className="rounded-xl" />
              </div>

              {/* Legenda (maior) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-body">Legenda</Label>
                  <div className="flex items-center gap-1">
                    {/* Só aparece pra cliente que já montou o banco de hashtags dele.
                        Acrescenta no fim da legenda, nunca sobrescreve o que foi escrito,
                        e não repete o bloco se já estiver lá. */}
                    {hashtagsCliente.length > 0 && (
                      <button type="button" onClick={() => {
                        const bloco = blocoParaColar(hashtagsCliente);
                        setF((p) => {
                          const atual = (p.caption ?? "").trimEnd();
                          if (atual.includes(bloco)) { toast.info("As hashtags já estão nesta legenda."); return p; }
                          return { ...p, caption: atual ? `${atual}\n\n${bloco}` : bloco };
                        });
                        toast.success(hashtagsCliente.length > LIMITE_HASHTAGS_POST
                          ? `${hashtagsCliente.length} hashtags coladas. O Instagram só considera as ${LIMITE_HASHTAGS_POST} primeiras.`
                          : `${hashtagsCliente.length} hashtag(s) colada(s) na legenda.`);
                      }}
                        title="Colar o bloco de hashtags deste cliente no fim da legenda"
                        className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[11px] font-body font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] transition-colors">
                        <Hash className="h-3.5 w-3.5" /> Colar hashtags
                      </button>
                    )}
                    <button type="button" onClick={() => copiarLegenda(f.caption ?? "")} disabled={!(f.caption ?? "").trim()}
                      className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[11px] font-body font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors">
                      <Copy className="h-3.5 w-3.5" /> Copiar legenda
                    </button>
                  </div>
                </div>
                <Textarea value={f.caption ?? ""} onChange={(e) => setF((p) => ({ ...p, caption: e.target.value }))} rows={8} className="rounded-xl min-h-[180px]" />
                {f.format === "story" && (f.caption ?? "").trim() !== "" && (
                  <p className="text-[11px] text-muted-foreground font-body">Story não exibe legenda. Esse texto não aparece no preview.</p>
                )}
              </div>

              {/* Roteiro / copy sempre disponível (também no Simplificada). */}
              <div className="space-y-1.5">
                <Label className="text-xs font-body">{f.approval_mode !== "fast" ? "Roteiro / conteúdo (etapa \"Conteúdo\")" : "Roteiro / copy (carrossel, reels...)"}</Label>
                {f.approval_mode !== "fast" && (
                  <ClientContentWriter
                    crmClientId={client.crm_client_id ?? null}
                    clienteNome={client.name}
                    titulo={f.title}
                    formato={f.format}
                    valor={f.script ?? ""}
                    onChange={(texto) => setF((p) => ({ ...p, script: texto }))}
                  />
                )}
                <Textarea value={f.script ?? ""} onChange={(e) => setF((p) => ({ ...p, script: e.target.value }))} rows={6} placeholder="Copy do carrossel slide a slide, ou o roteiro do reels..." className="rounded-xl" />
              </div>
            </div>

            {/* Coluna direita: Mídia (própria altura, sem esticar a esquerda).
               order-first: em tela ESTREITA (uma coluna) a Mídia vai pro TOPO,
               não pro fim da rolagem (pedido do Walter, 31/08); no md+ volta
               pra direita como sempre. */}
            <div className="md:w-[46%] md:sticky md:top-0 order-first md:order-none">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold">Mídia</label>
                <button type="button" onClick={() => setBriefOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-body font-bold text-primary hover:bg-primary/10 transition-colors">
                  <Palette className="h-3 w-3" /> Briefing de arte
                </button>
              </div>
              {editing?.id ? (
                <CriaPostMedia postId={editing.id} platform={f.platform} format={f.format}
                  caption={f.caption ?? undefined} handle={client.instagram_handle || undefined}
                  approved={editing.approval_status === "aprovado"}
                  title={f.title || undefined} referenceUrl={serializeRefLinks(refLinks)} />
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando o post pra você anexar a mídia…</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* O briefing de arte deste post, com a marca DESTE cliente. */}
      <ArtBriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        crmClientId={client.crm_client_id ?? null}
        clienteNome={client.name}
        titulo={f.title}
        formato={f.format}
        legenda={f.caption ?? undefined}
        roteiro={f.script ?? undefined}
      />
    </div>
  );
}

// ── Visão CALENDÁRIO dos posts (mês). Arrastar entre dias muda scheduled_date na hora.
// Conversa com o kanban: a mesma data aparece no card e aqui.
const CAL_WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function calYmd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
// Semana começa no DOMINGO (padrão do iPhone/calendários BR).
function calWeekStart(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }

function PostsCalendar({ posts, onOpen, onNewAt, onMove, tagsByPost, tagCatalog }: {
  posts: ExternalPost[];
  onOpen: (p: ExternalPost) => void;
  onNewAt: (day: string) => void;
  onMove: (id: string, day: string) => void;
  // Etiquetas internas: entram como bolinha compacta, nunca como bloco novo.
  tagsByPost: Record<string, string[]>;
  tagCatalog: PostTag[];
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  // Drag nativo (HTML5): o @hello-pangea/dnd não funciona em grid de calendário.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const days = (() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = calWeekStart(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const end = calWeekStart(last); end.setDate(end.getDate() + 6);
    const n = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  })();

  const byDay = new Map<string, ExternalPost[]>();
  const semData: ExternalPost[] = [];
  for (const p of posts) {
    if (!p.scheduled_date) { semData.push(p); continue; }
    const arr = byDay.get(p.scheduled_date) ?? [];
    arr.push(p); byDay.set(p.scheduled_date, arr);
  }

  const today = calYmd(new Date());
  const dropOn = (day: string) => { if (dragId) onMove(dragId, day); setDragId(null); setOverDay(null); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() - 1); return n; })}>‹</Button>
          <span className="text-sm font-display font-bold text-foreground px-2 capitalize">{anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() + 1); return n; })}>›</Button>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs ml-1" onClick={() => setAnchor(new Date())}>Hoje</Button>
        </div>
      </div>

      <div className="hidden lg:grid lg:grid-cols-7 gap-2 mb-1">
        {CAL_WD.map((w) => <p key={w} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{w}</p>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = calYmd(d);
          const list = byDay.get(iso) ?? [];
          const isToday = iso === today;
          const outMonth = d.getMonth() !== anchor.getMonth();
          return (
            <div key={iso}
              onDragOver={(e) => { e.preventDefault(); if (overDay !== iso) setOverDay(iso); }}
              onDragLeave={() => setOverDay((o) => (o === iso ? null : o))}
              onDrop={() => dropOn(iso)}
              className={`min-h-[104px] rounded-xl border p-2 flex flex-col gap-1.5 transition-colors
                ${isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background"}
                ${outMonth ? "opacity-45" : ""}
                ${overDay === iso ? "ring-2 ring-primary/40 border-primary/60 bg-primary/5" : ""}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-display font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
                <button onClick={() => onNewAt(iso)} className="text-muted-foreground hover:text-primary" aria-label="Novo post neste dia"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              {list.map((p) => {
                const st = STATUS[(p.approval_status ?? "pendente") as ApprovalKey];
                return (
                  <button key={p.id} draggable
                    onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOverDay(null); }}
                    type="button" onClick={() => onOpen(p)}
                    style={{ ...formatColorVars(p.format), borderLeftWidth: 3 }}
                    className={`rounded-lg border border-border ${FORMAT_BORDER_CLASS} bg-card px-1.5 py-1 text-left hover:bg-muted/40 transition-shadow cursor-grab active:cursor-grabbing ${dragId === p.id ? "opacity-50 shadow-lg" : ""}`}>
                    <span className={`text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full ${st?.cls ?? ""}`}>{st?.label ?? "Pendente"}</span>
                    <p className="text-[11px] font-body font-semibold text-foreground leading-tight truncate mt-0.5">{p.title}</p>
                    {/* Formato e etiquetas na MESMA linha: a célula é apertada, então
                        a etiqueta entra como bolinha colorida (nome no tooltip). */}
                    <span className="flex items-center gap-1 min-w-0">
                      <span className={`text-[9px] font-body font-bold uppercase truncate ${FORMAT_TEXT_CLASS}`}>{FORMAT_LABELS[normalizarFormato(p.format)] ?? cap(p.format)}</span>
                      <TagDots ids={tagsByPost[p.id]} catalog={tagCatalog} />
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Posts ainda sem data: arraste pra um dia do calendário. */}
      {semData.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sem data ({semData.length}), arraste pra um dia</p>
          <div className="flex gap-2 flex-wrap">
            {semData.map((p) => (
              <button key={p.id} draggable
                onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOverDay(null); }}
                type="button" onClick={() => onOpen(p)}
                style={{ ...formatColorVars(p.format), borderLeftWidth: 3 }}
                className={`rounded-lg border border-border ${FORMAT_BORDER_CLASS} bg-card px-2 py-1.5 text-left hover:bg-muted/40 transition-shadow cursor-grab active:cursor-grabbing ${dragId === p.id ? "opacity-50 shadow-lg" : ""}`}>
                <p className="text-[11px] font-body font-semibold text-foreground truncate max-w-[160px]">{p.title}</p>
                <span className="flex items-center gap-1 min-w-0">
                  <span className={`text-[9px] font-body font-bold uppercase ${FORMAT_TEXT_CLASS}`}>{FORMAT_LABELS[normalizarFormato(p.format)] ?? cap(p.format)}</span>
                  <TagDots ids={tagsByPost[p.id]} catalog={tagCatalog} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
