import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Bold, Italic, List, Loader2, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hojeBR, parseDateOnly, toISODateBR } from "@/lib/date-br";
import { confirmar } from "@/components/shared/Confirm";
import { ModuleUpsell } from "@/components/accounts/ModuleUpsell";
import { useHasModule } from "@/hooks/useModules";
import {
  useClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
  useCrmClientIdByCriaOwner,
  type CrmClientNote,
} from "@/hooks/useCrm";

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO DE NOTAS DO CLIENTE (modelo Notas do iPhone)

   Antes era UMA nota por cliente: um campo de texto corrido onde tudo o que foi
   conversado em seis meses ia empilhando, sem título, sem data e sem busca.
   Achar "o que ficou combinado sobre a paleta" virava rolagem no escuro.

   Agora: VÁRIAS notas. Lista agrupada por período (Hoje / Últimos 30 dias /
   mês), cada item com título em negrito e a data + o começo do texto embaixo,
   busca no rodapé, botão de nova nota e o editor abrindo por cima da lista.

   Segurança: o corpo é HTML simples e continua passando pelo DOMPurify na
   leitura E na gravação (correção anterior, não pode regredir).
   ═══════════════════════════════════════════════════════════════════════════ */

// Sanitiza HTML das notas (só formatação básica), protege contra HTML/JS injetado.
const NOTE_SANITIZE = { ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "br", "p", "div", "span", "ul", "ol", "li"], ALLOWED_ATTR: [] };
const cleanNote = (html: string) => DOMPurify.sanitize(html, NOTE_SANITIZE);
/** Texto puro da nota (pro preview de uma linha e pra busca). */
const plainText = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Trecho de uma linha do corpo da nota (usado também fora daqui, na ficha). */
export const notePreview = (html: string | null | undefined) => plainText(html ?? "");

/** Busca sem acento e sem caixa (procurar "captacao" acha "Captação"). */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Rótulo do grupo de uma nota, no fuso do Brasil. */
function grupoDaNota(updatedAt: string): string {
  const hoje = hojeBR();
  const dia = toISODateBR(new Date(updatedAt));
  if (dia === hoje) return "Hoje";
  const dif = Math.round((parseDateOnly(hoje).getTime() - parseDateOnly(dia).getTime()) / 86400000);
  if (dif <= 30) return "Últimos 30 dias";
  const d = parseDateOnly(dia);
  const mesmoAno = d.getFullYear() === parseDateOnly(hoje).getFullYear();
  return cap(d.toLocaleDateString("pt-BR", mesmoAno ? { month: "long" } : { month: "long", year: "numeric" }));
}

/** Data curta do item: hora quando é de hoje, data nos outros dias. */
function dataDoItem(updatedAt: string): string {
  const d = new Date(updatedAt);
  if (toISODateBR(d) === hojeBR()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conta CRIA gerenciada (lista de contas do gestor). */
  ownerId?: string | null;
  /** Cliente do CRM (ficha do Cria Gestão). */
  crmClientId?: string | null;
  clientName?: string | null;
};

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
      className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

export function ClientNotesDrawer({ open, onOpenChange, ownerId, crmClientId, clientName }: Props) {
  // GATE DE PLANO: o bloco de notas é do Cria Gestão. Sem o módulo, a pessoa vê a
  // vitrine (mesmo padrão do resto do app), nunca uma porta na cara.
  const { allowed: hasCrm, isLoading: modLoading } = useHasModule("crm");

  // Quando o drawer é aberto por uma CONTA CRIA (lista de contas), descobre o
  // cliente do CRM correspondente pra que as notas sejam as MESMAS dos dois lados.
  const { data: resolvedCrmId, isLoading: resolvendo } = useCrmClientIdByCriaOwner(!crmClientId && open ? ownerId : null);
  const scope = useMemo(
    () => ({ crmClientId: crmClientId ?? resolvedCrmId ?? null, accountOwnerId: ownerId ?? null }),
    [crmClientId, resolvedCrmId, ownerId],
  );

  const { data: notes = [], isLoading } = useClientNotes(scope, open && hasCrm && !resolvendo);
  const criar = useCreateClientNote(scope);
  const salvar = useUpdateClientNote(scope);
  const excluir = useDeleteClientNote(scope);

  const [busca, setBusca] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Placeholder do corpo: contentEditable não tem placeholder nativo.
  const [corpoVazio, setCorpoVazio] = useState(true);

  const editorRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espelhos pro fechamento (evita closure velha ao sair do editor).
  const tituloAtualRef = useRef("");
  const salvoRef = useRef<{ title: string; body: string }>({ title: "", body: "" });
  const abertaIdRef = useRef<string | null>(null);

  useEffect(() => { tituloAtualRef.current = titulo; }, [titulo]);
  useEffect(() => { abertaIdRef.current = abertaId; }, [abertaId]);

  const notaAberta = useMemo(() => notes.find((n) => n.id === abertaId) ?? null, [notes, abertaId]);

  // Carrega a nota escolhida no editor (uma vez por nota, pra não atropelar quem digita).
  useEffect(() => {
    if (!abertaId) return;
    const n = notes.find((x) => x.id === abertaId);
    if (!n) return;
    const body = cleanNote(n.body ?? "");
    setTitulo(n.title ?? "");
    tituloAtualRef.current = n.title ?? "";
    salvoRef.current = { title: n.title ?? "", body };
    if (editorRef.current) editorRef.current.innerHTML = body;
    setCorpoVazio(!plainText(body));
    // Só quando MUDA a nota aberta: recarregar a cada refetch apagaria o que está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertaId]);

  const gravar = useCallback(async (id: string, title: string, body: string) => {
    if (title === salvoRef.current.title && body === salvoRef.current.body) return;
    setSalvando(true);
    try {
      await salvar.mutateAsync({ id, title, body });
      salvoRef.current = { title, body };
    } catch {
      /* o hook já avisa */
    } finally {
      setSalvando(false);
    }
  }, [salvar]);

  // Autosave: ~0,8s depois da última tecla (mesmo ritmo do bloco antigo).
  const agendarSave = useCallback(() => {
    const id = abertaIdRef.current;
    if (!id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void gravar(id, tituloAtualRef.current, cleanNote(editorRef.current?.innerHTML ?? ""));
    }, 800);
  }, [gravar]);

  const onEditorInput = useCallback(() => {
    setCorpoVazio(!(editorRef.current?.textContent ?? "").trim());
    agendarSave();
  }, [agendarSave]);

  // Sai do editor: grava o que faltou e joga fora a nota que ficou vazia
  // (igual ao Notas do iPhone, ninguém quer "Nova nota" em branco na lista).
  const fecharEditor = useCallback(() => {
    const id = abertaIdRef.current;
    if (!id) return;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const title = tituloAtualRef.current.trim();
    const body = cleanNote(editorRef.current?.innerHTML ?? "");
    setAbertaId(null);
    abertaIdRef.current = null;
    if (!title && !plainText(body)) { void excluir.mutateAsync(id); return; }
    void gravar(id, tituloAtualRef.current, body);
  }, [excluir, gravar]);

  // Fechou o modal no meio da edição: não pode perder o que foi digitado.
  const trocarAberto = (o: boolean) => {
    if (!o) {
      fecharEditor();
      setBusca("");
    }
    onOpenChange(o);
  };

  const novaNota = async () => {
    if (criar.isPending) return;
    try {
      const nova = await criar.mutateAsync({});
      salvoRef.current = { title: "", body: "" };
      setTitulo("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setCorpoVazio(true);
      setAbertaId(nova.id);
      abertaIdRef.current = nova.id;
      setTimeout(() => tituloRef.current?.focus(), 80);
    } catch {
      /* o hook já avisa */
    }
  };

  const alternarFixar = async (n: CrmClientNote) => {
    await salvar.mutateAsync({ id: n.id, pinned: !n.pinned });
  };

  const apagarNota = async (n: CrmClientNote) => {
    const ok = await confirmar({
      titulo: "Excluir esta nota?",
      descricao: n.title ? `"${n.title}" será apagada. Não dá pra desfazer.` : "A nota será apagada. Não dá pra desfazer.",
      acao: "Excluir",
      destrutivo: true,
    });
    if (!ok) return;
    if (abertaIdRef.current === n.id) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      setAbertaId(null);
      abertaIdRef.current = null;
    }
    await excluir.mutateAsync(n.id);
    toast.success("Nota excluída.");
  };

  const cmd = (comando: string) => {
    document.execCommand(comando, false);
    editorRef.current?.focus();
    onEditorInput();
  };

  // Lista filtrada pela busca (título + corpo, sem acento).
  const filtradas = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return notes;
    return notes.filter((n) => norm(`${n.title} ${plainText(n.body ?? "")}`).includes(q));
  }, [notes, busca]);

  // Agrupa por período mantendo a ordem que veio do banco (fixadas → mais recentes).
  const grupos = useMemo(() => {
    const out: { label: string; itens: CrmClientNote[] }[] = [];
    const push = (label: string, n: CrmClientNote) => {
      const g = out.find((x) => x.label === label);
      if (g) g.itens.push(n); else out.push({ label, itens: [n] });
    };
    filtradas.forEach((n) => push(n.pinned ? "Fixadas" : grupoDaNota(n.updated_at), n));
    return out;
  }, [filtradas]);

  const total = notes.length;
  const contador = `${total} ${total === 1 ? "Nota" : "Notas"}`;

  return (
    <Dialog open={open} onOpenChange={trocarAberto}>
      <DialogContent
        className="max-w-lg p-0 gap-0 overflow-hidden h-[82dvh] sm:h-[78vh]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* CABEÇALHO: nome do cliente + contador de notas (padrão do Notas do iPhone). */}
        <DialogHeader className="shrink-0 px-4 sm:px-5 pt-4 pb-3 pr-14 border-b border-border text-left space-y-0">
          <DialogTitle className="font-display text-base sm:text-lg flex items-center gap-2 truncate">
            {notaAberta ? (
              <button
                type="button"
                onClick={fecharEditor}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors min-w-0"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">{clientName || "Notas"}</span>
              </button>
            ) : (
              <span className="truncate">{clientName || "Notas do cliente"}</span>
            )}
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
          </DialogTitle>
          <DialogDescription className="font-body text-xs text-muted-foreground">
            {notaAberta ? "Salva sozinho enquanto você escreve" : hasCrm ? contador : "Bloco de notas do cliente"}
          </DialogDescription>
        </DialogHeader>

        {/* SEM O MÓDULO: vitrine do Cria Gestão, igual às outras telas. */}
        {!hasCrm ? (
          <div className="flex-1 overflow-y-auto p-4">
            {modLoading
              ? <div className="h-40 rounded-2xl bg-muted animate-pulse" />
              : <ModuleUpsell code="crm" clientName={clientName ?? undefined} />}
          </div>
        ) : notaAberta ? (
          /* ── EDITOR DA NOTA ── */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 border-b border-border shrink-0">
              <ToolbarButton onClick={() => cmd("bold")} label="Negrito"><Bold className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton onClick={() => cmd("italic")} label="Itálico"><Italic className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton onClick={() => cmd("insertUnorderedList")} label="Lista"><List className="h-4 w-4" /></ToolbarButton>
              <div className="ml-auto flex items-center gap-1">
                <ToolbarButton onClick={() => void alternarFixar(notaAberta)} label={notaAberta.pinned ? "Desafixar nota" : "Fixar no topo"}>
                  {notaAberta.pinned ? <PinOff className="h-4 w-4 text-primary" /> : <Pin className="h-4 w-4" />}
                </ToolbarButton>
                <ToolbarButton onClick={() => void apagarNota(notaAberta)} label="Excluir nota"><Trash2 className="h-4 w-4" /></ToolbarButton>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
              <input
                ref={tituloRef}
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); tituloAtualRef.current = e.target.value; agendarSave(); }}
                placeholder="Título"
                aria-label="Título da nota"
                maxLength={120}
                className="w-full bg-transparent outline-none text-lg font-display font-bold text-foreground placeholder:text-muted-foreground/60 mb-1"
              />
              <p className="text-[11px] text-muted-foreground font-body mb-3">
                {new Date(notaAberta.updated_at).toLocaleDateString("pt-BR")} · {new Date(notaAberta.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="relative">
                {corpoVazio && (
                  <p className="absolute top-0 left-0 text-sm text-muted-foreground font-body pointer-events-none">
                    O que foi conversado e alinhado com o cliente…
                  </p>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={onEditorInput}
                  className="cria-notes-editor outline-none text-sm font-body text-foreground leading-relaxed min-h-[38vh] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  style={{ wordBreak: "break-word" }}
                  suppressContentEditableWarning
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── LISTA DE NOTAS ── */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2">
              {isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filtradas.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3">
                    <StickyNote className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-body font-medium text-foreground">
                    {busca ? "Nenhuma nota encontrada" : "Nenhuma nota ainda"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">
                    {busca
                      ? "Tente outra palavra."
                      : "Anote o que foi conversado e alinhado com o cliente. Cada conversa vira uma nota, com data."}
                  </p>
                </div>
              ) : (
                grupos.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="px-2 pt-2 pb-1 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </p>
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                      {g.itens.map((n, i) => {
                        const preview = plainText(n.body ?? "");
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-center gap-1 pr-1 transition-colors hover:bg-accent/50",
                              i > 0 && "border-t border-border",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setAbertaId(n.id)}
                              className="flex-1 min-w-0 text-left px-3 py-3"
                            >
                              <p className="text-sm font-body font-bold text-foreground truncate">
                                {n.title?.trim() || "Sem título"}
                              </p>
                              <p className="text-xs text-muted-foreground font-body truncate mt-0.5">
                                <span className="text-foreground/70">{dataDoItem(n.updated_at)}</span>
                                {preview ? ` ${preview}` : " Sem texto"}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => void alternarFixar(n)}
                              aria-label={n.pinned ? "Desafixar nota" : "Fixar no topo"}
                              title={n.pinned ? "Desafixar nota" : "Fixar no topo"}
                              className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
                            >
                              <Pin className={cn("h-3.5 w-3.5", n.pinned && "text-primary fill-primary")} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* RODAPÉ: busca + nova nota (mão no polegar, como no celular). */}
            <div className="shrink-0 border-t border-border bg-background px-3 py-2.5 flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nas notas"
                  aria-label="Buscar nas notas"
                  className="w-full h-10 rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => void novaNota()}
                disabled={criar.isPending}
                aria-label="Nova nota"
                title="Nova nota"
                className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
