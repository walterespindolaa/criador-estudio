import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   PEDIR MATERIAL PELO LINK (lado do CLIENTE, sem login)

   Morava dentro do AprovarPortal. Saiu de la porque agora existe um segundo
   lugar que usa a mesma coisa: o link SO de pedidos (/materiais/:token), que
   a social midia manda toda segunda no WhatsApp. Um componente, dois links.

   O que mudou em 20/09/2026, pedido do Walter: o cliente diz PRA QUANDO
   precisa. Sem essa data o pedido caia no kanban e no sininho e mais nada;
   com ela, entra na Agenda da social midia no dia certo. Sem data, o banco
   usa o dia do pedido (ver request_material_by_token).
   ═══════════════════════════════════════════════════════════════════════════ */
const MAT_KINDS: { key: string; label: string }[] = [
  { key: "apresentacao", label: "Apresentação" },
  { key: "flyer", label: "Flyer" },
  { key: "arte_avulsa", label: "Arte avulsa" },
  { key: "logo", label: "Logo" },
  { key: "outro", label: "Outro" },
];
const MAT_STATUS: Record<string, { label: string; cls: string }> = {
  solicitado: { label: "Recebido", cls: "bg-amber-100 text-amber-700" },
  a_fazer: { label: "Na fila", cls: "bg-slate-100 text-slate-600" },
  em_aprovacao: { label: "Em aprovação", cls: "bg-blue-100 text-blue-700" },
  ajuste: { label: "Em ajuste", cls: "bg-orange-100 text-orange-700" },
  finalizado: { label: "Pronto", cls: "bg-green-100 text-green-700" },
};
export type MaterialRow = {
  id: string; title: string; description: string | null; kind: string; status: string;
  created_at: string; due_date: string | null; updated_at: string | null;
};

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}` : null;
};
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function SolicitarMaterial({ token, abertoPorPadrao = false, semMoldura = false }: {
  token: string | undefined;
  /** No link so de pedidos o formulario ja vem aberto: e o unico motivo da pagina. */
  abertoPorPadrao?: boolean;
  /** Sem o card branco em volta (quando a pagina em volta ja e o card). */
  semMoldura?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(abertoPorPadrao);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("arte_avulsa");
  const [desc, setDesc] = useState("");
  const [prazo, setPrazo] = useState("");

  const listQ = useQuery({
    queryKey: ["portal-materials", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("list_materials_by_token", { _token: token });
      if (error) throw error;
      return (data as MaterialRow[]) ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("request_material_by_token", {
        _token: token, _title: title.trim(), _description: desc.trim(), _kind: kind,
        _due_date: prazo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado! Já avisamos quem cuida do seu conteúdo.");
      setTitle(""); setDesc(""); setKind("arte_avulsa"); setPrazo("");
      if (!abertoPorPadrao) setOpen(false);
      qc.invalidateQueries({ queryKey: ["portal-materials", token] });
    },
    onError: () => toast.error("Não foi possível enviar. Tente de novo."),
  });

  const pedidos = listQ.data ?? [];
  const abertos = pedidos.filter((p) => p.status !== "finalizado");
  const prontos = pedidos.filter((p) => p.status === "finalizado");

  const linha = (p: MaterialRow) => {
    const st = MAT_STATUS[p.status] ?? MAT_STATUS.solicitado;
    return (
      <div key={p.id} className="flex items-start gap-3 rounded-2xl bg-muted/40 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-body font-semibold text-foreground">{p.title}</p>
          <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1.5 flex-wrap">
            <span>{MAT_KINDS.find((k) => k.key === p.kind)?.label ?? "Material"}</span>
            {p.due_date && (
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> pra {dataBR(p.due_date)}</span>
            )}
            <span>· pedido em {dataBR(p.created_at)}</span>
          </p>
          {p.description && <p className="text-[12px] text-foreground/80 font-body mt-1 whitespace-pre-wrap">{p.description}</p>}
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
      </div>
    );
  };

  const miolo = (
    <>
      <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-display font-extrabold text-foreground leading-tight">Precisa de um material?</h3>
          <p className="text-[13px] text-muted-foreground font-body">Apresentação, flyer, arte avulsa, logo… peça aqui e acompanhe.</p>
        </div>
        {!open && (
          <Button onClick={() => setOpen(true)} className="shrink-0 rounded-2xl h-11">
            <Plus className="h-4 w-4 mr-1.5" /> Solicitar
          </Button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-5 sm:px-6 space-y-3.5 border-t border-border pt-4">
          <div>
            <label className="text-xs font-body font-bold text-foreground">O que você precisa?</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Flyer de promoção de fim de ano"
              className="mt-1.5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-body font-bold text-foreground">Tipo</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MAT_KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)}
                  className={`text-[13px] font-body font-semibold rounded-xl px-3 py-2 border transition-colors ${kind === k.key ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border"}`}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-body font-bold text-foreground">Pra quando?</label>
            <p className="text-[11px] text-muted-foreground font-body">Se deixar em branco, entra pra hoje e a gente combina o prazo.</p>
            <input type="date" value={prazo} min={hojeISO()} onChange={(e) => setPrazo(e.target.value)}
              className="mt-1.5 w-full sm:w-56 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-body font-bold text-foreground">Detalhes (opcional)</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Cores, texto, referências, medidas…" className="mt-1.5 rounded-2xl" />
          </div>
          <div className="flex gap-2.5">
            <Button className="flex-1 h-12 rounded-2xl" disabled={send.isPending || !title.trim()} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
            </Button>
            {!abertoPorPadrao && (
              <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => setOpen(false)} disabled={send.isPending}>Cancelar</Button>
            )}
          </div>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="px-4 pb-5 sm:px-6 border-t border-border pt-4 space-y-4">
          {abertos.length > 0 && (
            <div>
              <p className="text-[12px] font-body font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Em andamento ({abertos.length})</p>
              <div className="space-y-2">{abertos.map(linha)}</div>
            </div>
          )}
          {prontos.length > 0 && (
            <div>
              <p className="text-[12px] font-body font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Prontos ({prontos.length})</p>
              <div className="space-y-2 opacity-80">{prontos.map(linha)}</div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (semMoldura) return <section>{miolo}</section>;
  return (
    <section className="mt-8 lg:mt-10">
      <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(27,26,24,0.05)]">
        {miolo}
      </div>
    </section>
  );
}
