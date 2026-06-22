import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pencil, CheckCircle2, CalendarRange } from "lucide-react";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Item = { id: string; copy: string | null; description: string | null; date: string | null; type: string | null; approval_status: string; client_comment: string | null };
type Cron = { title: string; client_label: string | null; status: string; items: Item[] };

const TYPE_COLOR: Record<string, string> = {
  "Reels": "#DC2626", "Carrossel": "#15803D", "Feed": "#1D4ED8",
  "Stories": "#6B7280", "Carrossel/Stories": "#15803D", "Feed/Stories": "#1D4ED8",
};

export default function CronogramaPublica() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<{ id: string; status: "recusado" | "ajuste" } | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["cronograma-pub", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_cronograma_by_token", { _token: token });
      if (error) throw error;
      return data as unknown as Cron | null;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: string; comment?: string }) => {
      const { error } = await sbRpc("set_cronograma_item_by_token", { _token: token, _item_id: id, _status: status, _comment: comment ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cronograma-pub", token] }); setReasonFor(null); setReason(""); },
  });

  if (q.isLoading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#6B7280", fontFamily: "system-ui" }}>Carregando…</div>;

  const cron = q.data;
  if (!cron) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui", textAlign: "center", color: "#3f3f46" }}>
        <div>
          <CalendarRange style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#a1a1aa" }} />
          <p>Cronograma não encontrado ou link inválido.</p>
        </div>
      </div>
    );
  }

  const approved = cron.items.filter((i) => i.approval_status === "aprovado").length;

  return (
    <div style={{ minHeight: "100vh", background: "#F6F4FC", padding: "28px 16px", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: "#fff", border: "1px solid #ECE7F7", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 50px -30px rgba(35,25,70,.4)" }}>
        <div style={{ padding: 20, textAlign: "center", borderBottom: "1px solid #ECE7F7" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#2A2440", fontFamily: "'Bricolage Grotesque', system-ui" }}>{cron.title}{cron.client_label ? ` · ${cron.client_label}` : ""}</h1>
          <p style={{ fontSize: 13, color: "#857F9C", marginTop: 4 }}>Revise cada conteúdo e aprove, recuse ou peça ajuste.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "#15803D", background: "#DCFCE7", padding: "5px 12px", borderRadius: 999 }}>
            <CheckCircle2 style={{ width: 14, height: 14 }} /> {approved} de {cron.items.length} aprovados
          </div>
        </div>

        {cron.items.map((it, i) => {
          const isApproved = it.approval_status === "aprovado";
          const isReason = reasonFor?.id === it.id;
          return (
            <div key={it.id} style={{ padding: "16px 18px", borderBottom: "1px solid #F1ECF8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: "#857F9C", fontSize: 13 }}>#{i + 1}</span>
                {it.type && <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: TYPE_COLOR[it.type] ?? "#6B7280", padding: "3px 10px", borderRadius: 999 }}>{it.type}</span>}
                {it.date && <span style={{ fontSize: 11.5, color: "#857F9C" }}>· {it.date.split("-").reverse().slice(0, 2).join("/")}</span>}
                {isApproved && <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: "#15803D", background: "#DCFCE7", padding: "2px 8px", borderRadius: 999 }}>Aprovado ✓</span>}
                {it.approval_status === "recusado" && <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", padding: "2px 8px", borderRadius: 999 }}>Recusado</span>}
                {it.approval_status === "ajuste" && <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 8px", borderRadius: 999 }}>Ajuste pedido</span>}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: "#2A2440" }}>{it.copy || "(sem título)"}</div>
              {it.description && <div style={{ fontSize: 13, color: "#5b5470", marginTop: 2, lineHeight: 1.45 }}>{it.description}</div>}
              {it.client_comment && <div style={{ fontSize: 12, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 9px", marginTop: 8 }}>"{it.client_comment}"</div>}

              {!isApproved && !isReason && (
                <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                  <button onClick={() => setStatus.mutate({ id: it.id, status: "aprovado" })} style={btn("#15803D", "#fff")}><Check style={ic} /> Aprovar</button>
                  <button onClick={() => { setReasonFor({ id: it.id, status: "ajuste" }); setReason(it.client_comment ?? ""); }} style={btn("#fff", "#B45309", "#FDE68A")}><Pencil style={ic} /> Pedir ajuste</button>
                  <button onClick={() => { setReasonFor({ id: it.id, status: "recusado" }); setReason(it.client_comment ?? ""); }} style={btn("#fff", "#DC2626", "#FCA5A5")}><X style={ic} /> Recusar</button>
                </div>
              )}

              {isReason && (
                <div style={{ marginTop: 10, background: "#FFFBEB", border: "1px dashed #FDE68A", borderRadius: 10, padding: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginBottom: 6 }}>
                    {reasonFor.status === "recusado" ? "POR QUE A RECUSA?" : "POR QUE O AJUSTE?"}
                  </p>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique pro social media…"
                    style={{ width: "100%", border: "1px solid #ECE7F7", borderRadius: 8, padding: 8, fontSize: 12.5, fontFamily: "inherit", resize: "none", height: 54 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => setStatus.mutate({ id: it.id, status: reasonFor.status, comment: reason })}
                      style={{ fontSize: 12, fontWeight: 700, background: "#B45309", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
                      Enviar
                    </button>
                    <button onClick={() => { setReasonFor(null); setReason(""); }} style={{ fontSize: 12, fontWeight: 700, background: "#fff", color: "#6B7280", border: "1px solid #ECE7F7", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#857F9C" }}>cria · criasocialclub.com.br</div>
      </div>
    </div>
  );
}

const ic = { width: 14, height: 14 } as const;
function btn(bg: string, color: string, border?: string): CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, background: bg, color, border: `1px solid ${border ?? "#ECE7F7"}`, borderRadius: 10, padding: "8px 13px", cursor: "pointer" };
}
