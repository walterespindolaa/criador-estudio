import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Copy, ExternalLink, Link2, Pencil, Plus, RotateCcw, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCollabs, COLLAB_STATUSES, COLLAB_STATUS_LABEL, PROPOSAL_LABEL,
  type CollabStatus, type CollabWithDeliverables,
} from "@/hooks/useCollabs";
import { usePosts } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useCreateFinRecord } from "@/hooks/useFinance";
import { useModules } from "@/hooks/useModules";
import { useIsMobile } from "@/hooks/use-mobile";
import { STATUS_OPTIONS } from "@/lib/constants";
import { hojeBR } from "@/lib/date-br";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { PreviaWhatsApp } from "@/components/shared/PreviaWhatsApp";
import { Carimbo, Clipe, MAO, STATUS_PILULA, brl, dataCurta, diasAte, linhaDaProposta } from "./collabsVisual";

/* O CONTRATO DA COLLAB (Walter, 06/11/2026, mockup aprovado). Tocar na pasta
   abre isto ao lado (no celular, a folha sobe) no lugar da janela de
   formulário: entregáveis em checklist, cada um podendo apontar pra um post do
   Criando; o orçamento como ingresso; o cachê como recibo com carimbo. Os dados
   da collab (marca, valor, prazo, briefing) continuam no formulário de antes,
   aberto pelo lápis. */

const COLUNA_DO_POST: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s.label]));
const COR_COLUNA: Record<string, string> = {
  ideia: "#FFF1A8", roteiro: "#E3ECFF", gravando: "#FFD3E8", editando: "#D8F2E0", agendado: "#FFE0D6", publicado: "#EDE7DB",
};

export function CollabPainel({ collab, onClose, onEditar, onArquivar }: {
  collab: CollabWithDeliverables | null;
  onClose: () => void;
  onEditar: (c: CollabWithDeliverables) => void;
  onArquivar: (c: CollabWithDeliverables) => void;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={!!collab} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side={isMobile ? "bottom" : "right"}
        className={cn("p-0 gap-0 bg-[#FFFCF5] dark:bg-card overflow-y-auto",
          isMobile ? "max-h-[88dvh] rounded-t-[26px] border-t-2 border-foreground" : "w-full sm:max-w-[440px] border-l-2 border-foreground")}>
        {collab && <Conteudo c={collab} onEditar={onEditar} onArquivar={onArquivar} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Conteudo({ c, onEditar, onArquivar, onClose }: {
  c: CollabWithDeliverables;
  onEditar: (c: CollabWithDeliverables) => void;
  onArquivar: (c: CollabWithDeliverables) => void;
  onClose: () => void;
}) {
  const { createDeliverable, togglePublished, deleteDeliverable, updateDeliverable, updateCollab, generateProposal } = useCollabs();
  const { posts } = usePosts();
  const { profile } = useProfile();
  const { modules } = useModules();
  const createFin = useCreateFinRecord();
  const { isOutraConta } = useActiveProfile();
  const hasCaixa = modules.some((m) => m.code === "financeiro" && m.status === "active");
  const pixKey = isOutraConta ? null : ((profile as { pix_key?: string | null } | null)?.pix_key ?? null);
  const [novo, setNovo] = useState("");
  const [verNotas, setVerNotas] = useState(false);

  const postPorId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const atrasado = !!c.deadline && c.status !== "pago" && c.done < c.total && diasAte(c.deadline) < 0;
  const proposalUrl = c.proposal_token ? `${window.location.origin}/proposta/${c.proposal_token}` : "";

  const adicionar = () => {
    if (!novo.trim()) return;
    createDeliverable.mutate({ collab_id: c.id, label: novo.trim(), sort_order: c.deliverables.length });
    setNovo("");
  };
  const copiar = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => toast.success("Link copiado.")).catch(() => toast.message(url));
  };
  const gerar = () => generateProposal.mutate(
    { collabId: c.id, brand: c.brand, validUntil: c.proposal_valid_until, terms: c.proposal_terms },
    { onSuccess: (token) => { navigator.clipboard?.writeText(`${window.location.origin}/proposta/${token}`).catch(() => {}); } },
  );
  const recebido = async () => {
    updateCollab.mutate({ id: c.id, status: "pago" });
    if (hasCaixa && (c.value ?? 0) > 0) {
      try {
        await createFin.mutateAsync({
          type: "entrada", context: "pf", category: "Collabs",
          description: `Publi · ${c.brand}`, amount: c.value ?? 0,
          status: "pago", payment_method: "Pix", date: hojeBR(),
        });
        toast.success("Recebido. Lançado no Cria Caixa.");
      } catch { /* o lançamento falhou, mas o status já foi marcado */ }
    }
  };

  return (
    <div className="relative px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] sm:pt-8">
      <Clipe className="right-14 -top-1 sm:top-1" />
      <SheetTitle className="sr-only">{c.brand}</SheetTitle>

      {/* Cabeçalho do contrato */}
      <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground">
        {COLLAB_STATUS_LABEL[c.status]}{c.contact ? ` · ${c.contact}` : ""}
      </p>
      <div className="flex items-start gap-2 mt-0.5 pr-8">
        <h2 className="font-display font-extrabold text-[24px] leading-tight text-foreground min-w-0 break-words">{c.brand}</h2>
        <button type="button" onClick={() => onEditar(c)} className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Editar dados da collab">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <p className="text-[11px] font-body text-muted-foreground">Cachê</p>
          <p className="text-[14px] font-body font-bold text-foreground tabular-nums">{brl(c.value)}</p>
        </div>
        <div>
          <p className="text-[11px] font-body text-muted-foreground">Prazo</p>
          <p className={cn("text-[14px] font-body font-bold tabular-nums", atrasado ? "text-[#D93A12]" : "text-foreground")}>
            {c.deadline ? `${dataCurta(c.deadline)}${atrasado ? " · atrasado" : ""}` : "sem prazo"}
          </p>
        </div>
      </div>
      {c.objective && <p className="mt-2 text-[12.5px] font-body text-muted-foreground"><span className="font-semibold text-foreground">Objetivo:</span> {c.objective}</p>}

      {/* Mover de coluna (no celular não tem arrastar) */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COLLAB_STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => s !== c.status && updateCollab.mutate({ id: c.id, status: s as CollabStatus })}
            className={cn("rounded-md px-2 py-0.5 text-[11px] font-body font-bold border-[1.5px] transition-colors",
              s === c.status ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            style={{ background: STATUS_PILULA[s] }} aria-pressed={s === c.status}>
            {COLLAB_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Entregáveis em checklist */}
      <div className="mt-5">
        <p className="font-display font-extrabold text-[15px] text-foreground">
          Entregáveis <span className="text-[12px] font-body font-semibold text-muted-foreground">{c.done} de {c.total}</span>
        </p>
        <ul className="mt-1.5 divide-y divide-dashed divide-border">
          {c.deliverables.map((d) => {
            const post = d.post_id ? postPorId.get(d.post_id) : null;
            const coluna = post ? COLUNA_DO_POST[post.status] ?? post.status : null;
            return (
              <li key={d.id} className="flex items-center gap-2.5 py-2">
                <button type="button" onClick={() => togglePublished.mutate({ id: d.id, published: !d.published })}
                  aria-label={d.published ? "Desmarcar publicado" : "Marcar como publicado"}
                  className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border-2 border-foreground transition-colors",
                    d.published && "bg-[#00A652] border-[#00A652] text-white")}>
                  {d.published && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-body", d.published && "line-through text-muted-foreground")}>{d.label}</span>
                <LigarPost
                  atual={post ? { titulo: post.title, coluna: coluna ?? "", cor: COR_COLUNA[post.status] ?? "#eee" } : null}
                  posts={posts.map((p) => ({ id: p.id, titulo: p.title, coluna: COLUNA_DO_POST[p.status] ?? p.status, cor: COR_COLUNA[p.status] ?? "#eee" }))}
                  onEscolher={(postId) => updateDeliverable.mutate({ id: d.id, post_id: postId })}
                />
                <button type="button" onClick={() => deleteDeliverable.mutate(d.id)} className="shrink-0 text-muted-foreground/60 hover:text-[#D93A12]" aria-label="Tirar entregável">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <form className="mt-1 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <Plus className="h-4 w-4 text-muted-foreground" />
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="entregável (ex.: Reel 1) e Enter"
            className="flex-1 min-w-0 bg-transparent py-1.5 text-[14px] outline-none placeholder:text-muted-foreground/70" style={MAO} />
        </form>
      </div>

      {/* Orçamento como ingresso */}
      <div className="mt-5 flex overflow-hidden rounded-2xl border-2 border-foreground shadow-[3px_4px_0_hsl(var(--foreground))]">
        <div className="flex-1 min-w-0 bg-[#FFCF03] p-3.5">
          <p className="text-[10px] font-body font-bold uppercase tracking-wider text-[#3d3000]">Orçamento</p>
          <p className="font-display font-extrabold text-[16px] leading-tight text-[#141210]">
            {c.proposal_status === "none" ? "ainda não enviado" : linhaDaProposta(c).replace("orçamento ", "") || PROPOSAL_LABEL[c.proposal_status].toLowerCase()}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {c.proposal_token ? (
              <>
                <button type="button" onClick={() => copiar(proposalUrl)} className="inline-flex items-center gap-1 rounded-full bg-[#141210] px-3 py-1.5 text-[11.5px] font-body font-bold text-white"><Copy className="h-3 w-3" /> Copiar link</button>
                <button type="button" onClick={gerar} disabled={generateProposal.isPending} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#141210] bg-white px-3 py-1.5 text-[11.5px] font-body font-bold text-[#141210]"><RotateCcw className="h-3 w-3" /> Gerar novo</button>
              </>
            ) : (
              <button type="button" onClick={gerar} disabled={generateProposal.isPending} className="inline-flex items-center gap-1 rounded-full bg-[#141210] px-3 py-1.5 text-[11.5px] font-body font-bold text-white"><Link2 className="h-3 w-3" /> Gerar e copiar link</button>
            )}
          </div>
        </div>
        <div className="w-[104px] shrink-0 border-l-2 border-dashed border-[#141210] bg-[#FFF6C9] p-3 text-center flex flex-col items-center justify-center">
          <p className="text-[10px] font-body font-bold uppercase tracking-wider text-[#3d3000]">Valor</p>
          <p className="font-display font-extrabold text-[15px] leading-tight text-[#141210] tabular-nums">{c.value != null ? brl(c.value).replace(",00", "") : "a definir"}</p>
        </div>
      </div>
      {c.proposal_token && <div className="mt-2"><PreviaWhatsApp url={proposalUrl} /></div>}
      {c.proposal_status === "ajuste" && c.proposal_client_comment && (
        <p className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-body text-orange-800">A marca pediu: "{c.proposal_client_comment}"</p>
      )}
      {c.proposal_status === "recusada" && (c.proposal_decline_reason || c.proposal_decline_note) && (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-body text-red-800">
          Recusada{c.proposal_decline_reason ? ` · ${c.proposal_decline_reason}` : ""}{c.proposal_decline_note ? `: "${c.proposal_decline_note}"` : ""}
        </p>
      )}

      {/* Cachê como recibo */}
      <div className="mt-4 rounded-xl border border-border bg-white dark:bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-body font-bold text-foreground">Cachê</span>
          <span className="flex-1 text-center">
            {c.status === "pago"
              ? <Carimbo cor="#00A652">pago {dataCurta(c.updated_at.slice(0, 10))}</Carimbo>
              : <Carimbo>a receber</Carimbo>}
          </span>
          <span className="text-[13.5px] font-body font-bold tabular-nums text-foreground">{brl(c.value)}</span>
        </div>
        {c.status !== "pago" && (
          <>
            <button type="button" onClick={() => void recebido()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00A652] px-4 py-2 text-[13px] font-body font-bold text-white">
              <Wallet className="h-4 w-4" /> Marcar como recebido
            </button>
            <p className="mt-1.5 text-center text-[11px] font-body text-muted-foreground">
              {hasCaixa ? "Lança uma entrada no Cria Caixa." : "Marca a collab como paga."}
              {pixKey ? ` A marca vê a chave Pix ${pixKey}.` : ""}
            </p>
          </>
        )}
      </div>

      {verNotas && c.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#FFF3A8] px-3.5 py-2.5 text-[13px] font-body text-[#3b3520]">{c.notes}</p>
      )}

      {/* Rodapé */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {c.briefing_url && (
          <a href={c.briefing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border-2 border-foreground px-3.5 py-1.5 text-[12px] font-body font-bold">
            Briefing <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button type="button" onClick={() => (c.notes ? setVerNotas((v) => !v) : onEditar(c))} className="rounded-full border-2 border-foreground px-3.5 py-1.5 text-[12px] font-body font-bold">
          {c.notes ? (verNotas ? "Esconder notas" : "Notas") : "Escrever notas"}
        </button>
        <button type="button" onClick={() => { onArquivar(c); onClose(); }} className="ml-auto inline-flex items-center gap-1 rounded-full border-2 border-foreground px-3.5 py-1.5 text-[12px] font-body font-bold">
          {c.archived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Restaurar</> : <><Archive className="h-3.5 w-3.5" /> Arquivar</>}
        </button>
      </div>
    </div>
  );
}

/* Ligar o entregável a um post do Criando (campo post_id que já existia). */
function LigarPost({ atual, posts, onEscolher }: {
  atual: { titulo: string; coluna: string; cor: string } | null;
  posts: { id: string; titulo: string; coluna: string; cor: string }[];
  onEscolher: (postId: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = posts.filter((p) => !busca.trim() || p.titulo.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 30);
  return (
    <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setBusca(""); }}>
      <PopoverTrigger asChild>
        {atual ? (
          <button type="button" className="max-w-[46%] shrink-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-body font-bold text-[#141210]" style={{ background: atual.cor }} title={atual.titulo}>
            Criando: {atual.coluna}
          </button>
        ) : (
          <button type="button" className="shrink-0 rounded-full border border-border bg-white dark:bg-background px-2.5 py-0.5 text-[11px] font-body font-semibold text-muted-foreground hover:text-foreground">
            ligar a um post
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2 rounded-2xl">
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar post do Criando" className="h-9" />
        <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain">
          {atual && (
            <button type="button" onClick={() => { onEscolher(null); setAberto(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-body text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Desligar do post
            </button>
          )}
          {lista.length === 0 && <p className="px-2 py-3 text-[12px] font-body text-muted-foreground">Nenhum post com esse nome.</p>}
          {lista.map((p) => (
            <button key={p.id} type="button" onClick={() => { onEscolher(p.id); setAberto(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-body text-foreground">{p.titulo || "Sem título"}</span>
              <span className="shrink-0 rounded px-1.5 text-[10px] font-body font-bold text-[#141210]" style={{ background: p.cor }}>{p.coluna}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
