import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pencil, CheckCircle2, CalendarRange, PartyPopper } from "lucide-react";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type Item = { id: string; copy: string | null; description: string | null; date: string | null; type: string | null; approval_status: string; client_comment: string | null };
type Data = { id: string; label: string; day_label: string | null; selected: boolean };
type Cron = {
  title: string; client_label: string | null; client_handle: string | null; status: string;
  accent: string | null; logo: string | null; by: string | null; items: Item[]; datas: Data[];
};

const TYPE_COLOR: Record<string, string> = {
  "Reels": "#DC2626", "Carrossel": "#15803D", "Feed": "#1D4ED8",
  "Stories": "#6B7280", "Carrossel/Stories": "#15803D", "Feed/Stories": "#1D4ED8",
};

const FALLBACK_ACCENT = "#534AB7";

// luminância simples -> decide texto claro/escuro sobre o accent
function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

function ddmm(date: string): string {
  return date.split("-").reverse().slice(0, 2).join("/");
}

function periodLabel(items: Item[]): string | null {
  const dates = items.map((i) => i.date).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  const a = ddmm(sorted[0]); const b = ddmm(sorted[sorted.length - 1]);
  return a === b ? a : `${a} a ${b}`;
}

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

  const toggleData = useMutation({
    mutationFn: async ({ id, selected }: { id: string; selected: boolean }) => {
      const { error } = await sbRpc("set_cronograma_data_by_token", { _token: token, _data_id: id, _selected: selected });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronograma-pub", token] }),
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

  const accent = cron.accent || FALLBACK_ACCENT;
  const onAccent = isDark(accent) ? "#ffffff" : "#1A1626";
  const onAccentSoft = isDark(accent) ? "rgba(255,255,255,.82)" : "rgba(26,22,38,.7)";
  const approved = cron.items.filter((i) => i.approval_status === "aprovado").length;
  const datas = cron.datas ?? [];
  const selectedCount = datas.filter((d) => d.selected).length;
  const period = periodLabel(cron.items);
  const handle = cron.client_handle
    ? `@${cron.client_handle.replace(/^@/, "")}`
    : (cron.client_label || cron.title);

  return (
    <div style={{ minHeight: "100vh", background: "#F6F4FC", padding: "28px 16px", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: "#fff", border: "1px solid #ECE7F7", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 50px -30px rgba(35,25,70,.4)" }}>

        <div style={{ background: accent, padding: "24px 20px", textAlign: "center", color: onAccent }}>
          {cron.logo && (
            <img src={cron.logo} alt="" style={{ height: 44, width: "auto", maxWidth: 160, objectFit: "contain", margin: "0 auto 12px", display: "block" }} />
          )}
          <p style={{ fontSize: 11.5, letterSpacing: ".09em", color: onAccentSoft, margin: 0, textTransform: "uppercase" }}>Cronograma de conteúdo</p>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "4px 0 0", fontFamily: "'Bricolage Grotesque', system-ui" }}>{handle}</h1>
          <p style={{ fontSize: 13, color: onAccentSoft, marginTop: 6 }}>
            {period ? `${period}` : cron.title}{cron.by ? ` · por ${cron.by}` : ""}
          </p>
        </div>

        {datas.length > 0 && (
          <div style={{ padding: "16px 18px", background: "#F6F4FC", borderBottom: "1px solid #ECE7F7" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#2A2440", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <PartyPopper style={{ width: 15, height: 15, color: accent }} /> Datas comemorativas do mês
              </p>
              <span style={{ fontSize: 11, fontWeight: 800, color: onAccent, background: accent, padding: "3px 10px", borderRadius: 999 }}>{selectedCount} marcadas</span>
            </div>
            <p style={{ fontSize: 12, color: "#857F9C", margin: "0 0 12px" }}>Marque as que você quer trabalhar — eu monto o conteúdo em cima delas.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {datas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleData.mutate({ id: d.id, selected: !d.selected })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
                    background: d.selected ? "#fff" : "#fff",
                    border: `1.5px solid ${d.selected ? accent : "#ECE7F7"}`,
                    borderRadius: 10, padding: "9px 12px", width: "100%",
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: d.selected ? accent : "transparent",
                    border: d.selected ? "none" : "1.5px solid #C9C2E0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {d.selected && <Check style={{ width: 12, height: 12, color: onAccent }} strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: 13, color: d.selected ? "#2A2440" : "#5b5470", fontWeight: d.selected ? 700 : 500 }}>{d.label}</span>
                  {d.day_label && <span style={{ marginLeft: "auto", fontSize: 12, color: "#857F9C" }}>{d.day_label}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: "14px 18px 2px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#15803D", background: "#DCFCE7", padding: "5px 12px", borderRadius: 999 }}>
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
                {it.date && <span style={{ fontSize: 11.5, color: "#857F9C" }}>· {ddmm(it.date)}</span>}
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
