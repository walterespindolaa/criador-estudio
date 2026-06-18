import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, RotateCcw, X, Loader2, Lock, Download } from "lucide-react";
import { applyAccent } from "@/lib/applyTheme";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Deliverable = { label: string; format: string | null };
type Proposal = {
  brand: string; objective: string | null; value: number | null;
  terms: string | null; valid_until: string | null;
  status: "enviada" | "vista" | "aceita" | "recusada" | "ajuste";
  client_comment: string | null; deliverables: Deliverable[];
  creator: { name: string | null; handle: string | null; avatar: string | null; theme_accent: string | null; media_kit: string | null; pix_key: string | null } | null;
};

const brl = (v: number | null) =>
  v == null ? "a combinar" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : null);

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["proposal", token] });
  const [adjOpen, setAdjOpen] = useState(false);
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["proposal", token], enabled: !!token,
    queryFn: async (): Promise<Proposal | null> => {
      const { data, error } = await sbRpc("get_proposal_by_token", { _token: token });
      if (error) throw error;
      return (data as Proposal) ?? null;
    },
  });

  const accept = useMutation({
    mutationFn: async () => { const { error } = await sbRpc("accept_proposal_by_token", { _token: token }); if (error) throw error; },
    onSuccess: () => { toast.success("Proposta aprovada!"); inv(); },
    onError: () => toast.error("Não foi possível aprovar."),
  });
  const reject = useMutation({
    mutationFn: async () => { const { error } = await sbRpc("reject_proposal_by_token", { _token: token }); if (error) throw error; },
    onSuccess: () => { inv(); },
    onError: () => toast.error("Não foi possível recusar."),
  });
  const change = useMutation({
    mutationFn: async () => { const { error } = await sbRpc("request_proposal_change_by_token", { _token: token, _comment: comment.trim() }); if (error) throw error; },
    onSuccess: () => { toast.success("Pedido enviado ao criador."); setAdjOpen(false); setComment(""); inv(); },
    onError: () => toast.error("Não foi possível enviar."),
  });

  const accent = q.data?.creator?.theme_accent;
  // aplica a cor escolhida pela criadora (rota pública não carrega o tema dela sozinha)
  useEffect(() => { applyAccent(accent || "#8B5CF6"); }, [accent]);

  if (q.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>;
  const p = q.data;
  if (!p) return <Center><p className="text-muted-foreground">Proposta não encontrada ou expirada.</p></Center>;

  const busy = accept.isPending || reject.isPending || change.isPending;
  const decided = p.status === "aceita" || p.status === "recusada";
  const creatorName = p.creator?.name ?? "Criador";
  const initials = creatorName.charAt(0).toUpperCase();
  const copyPix = () => { if (p?.creator?.pix_key) navigator.clipboard?.writeText(p.creator.pix_key).then(() => toast.success("Chave Pix copiada.")).catch(() => {}); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F4FC] to-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.08)]">
        <div className="bg-gradient-to-br from-primary to-primary/70 text-white px-6 pt-6 pb-5 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-white/20 grid place-items-center overflow-hidden">
            {p.creator?.avatar ? <img src={p.creator.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-extrabold">{initials}</span>}
          </div>
          <p className="text-[11px] uppercase tracking-wider opacity-85 font-semibold">Você recebeu uma proposta</p>
          <h1 className="text-xl font-display font-extrabold mt-1">{creatorName}</h1>
          {p.creator?.handle && <p className="text-sm opacity-90">@{p.creator.handle}</p>}
        </div>

        {p.status === "aceita" && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-3"><Check className="h-5 w-5" /> Proposta aceita. Obrigada!</div>
        )}
        {p.status === "aceita" && p.creator?.pix_key && (
          <div className="mx-6 mt-3 border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 bg-primary/5 border-b border-border px-4 py-2.5">
              <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-extrabold">⚡</span>
              <span className="text-sm font-bold">Pague via Pix</span>
              <span className="ml-auto font-display font-extrabold">{brl(p.value)}</span>
            </div>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Chave Pix de {p.creator?.name ?? "quem te enviou"}</p>
              <div className="flex items-center gap-2.5 bg-background border border-border rounded-xl px-3 py-2.5">
                <span className="text-sm font-semibold flex-1 break-all">{p.creator.pix_key}</span>
                <button type="button" onClick={copyPix} className="text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-lg px-3 py-2 flex-shrink-0">Copiar</button>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5">Depois de pagar, avise {p.creator?.name ?? "o criador"} — ele confirma o recebimento.</p>
            </div>
          </div>
        )}
        {p.status === "recusada" && (
          <div className="mx-6 mt-4 text-sm font-semibold text-muted-foreground bg-muted rounded-2xl px-4 py-3">Proposta recusada.</div>
        )}

        <div className="px-6 py-5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Proposta para {p.brand}</p>
          <div className="space-y-0">
            {p.deliverables.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border text-sm">
                <span className="text-foreground">{d.label}{d.format ? <span className="text-muted-foreground"> · {d.format}</span> : null}</span>
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              </div>
            ))}
          </div>
          {p.terms && <p className="text-xs text-muted-foreground mt-3">{p.terms}</p>}
          <div className="flex items-center justify-between mt-4 bg-primary/5 rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-primary">Investimento total</span>
            <span className="text-2xl font-display font-extrabold text-primary">{brl(p.value)}</span>
          </div>
          {fmtDate(p.valid_until) && <p className="text-xs text-muted-foreground text-center mt-3">Válida até {fmtDate(p.valid_until)}</p>}
          {p.creator?.media_kit && (
            <a href={p.creator.media_kit} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-3 w-full mt-4 px-3.5 py-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
              <span className="w-9 h-9 rounded-xl bg-card border border-primary/20 grid place-items-center text-primary flex-shrink-0">📄</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-primary leading-tight">Baixar mídia kit</span>
                <span className="block text-xs text-muted-foreground">Conheça os trabalhos de {p.creator?.name ?? "quem te enviou"} (PDF)</span>
              </span>
              <Download className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
            </a>
          )}
          {p.status === "ajuste" && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3 text-center">Alteração solicitada — aguardando o criador.</p>}
        </div>

        {!decided && p.status !== "ajuste" && (
          <div className="px-6 pb-6">
            {!adjOpen ? (
              <div className="space-y-2.5">
                <Button className="w-full h-13 rounded-2xl text-base font-bold gap-2 shadow-lg shadow-primary/25" style={{ height: 52 }} onClick={() => accept.mutate()} disabled={busy}>
                  {accept.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Aprovar proposta</>}
                </Button>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="outline" className="rounded-2xl h-11 gap-1.5" onClick={() => { setAdjOpen(true); setComment(""); }} disabled={busy}><RotateCcw className="h-4 w-4" /> Pedir alteração</Button>
                  <Button variant="outline" className="rounded-2xl h-11 gap-1.5 text-red-600 hover:text-red-700" onClick={() => reject.mutate()} disabled={busy}><X className="h-4 w-4" /> Recusar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="O que você gostaria de ajustar?" className="rounded-2xl" />
                <div className="flex gap-2.5">
                  <Button className="flex-1 h-11 rounded-2xl" disabled={busy || !comment.trim()} onClick={() => change.mutate()}>{change.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}</Button>
                  <Button variant="ghost" className="h-11 rounded-2xl" onClick={() => setAdjOpen(false)} disabled={busy}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-5 flex items-center gap-1.5"><Lock className="h-3 w-3" /> Sua decisão fica registrada com data e hora.</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1.5">Feito com CRIA</p>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center bg-background px-4 text-center">{children}</div>;
}
