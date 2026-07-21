import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pencil, CheckCircle2, CalendarRange, PartyPopper, Link2 } from "lucide-react";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

// Transforma URLs em texto num link clicável (sem HTML cru, seguro).
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#0061EE", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
      : <span key={i}>{p}</span>,
  );
}

type Item = { id: string; copy: string | null; description: string | null; date: string | null; type: string | null; approval_status: string; client_comment: string | null; ref_url: string | null };
type Data = { id: string; label: string; day_label: string | null; selected: boolean };
type Cron = {
  title: string; client_label: string | null; client_handle: string | null; status: string;
  accent: string | null; logo: string | null; by: string | null; items: Item[]; datas: Data[];
  client_color?: string | null; client_logo?: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  "Reels": "#EA4918", "Carrossel": "#01A652", "Feed": "#0061EE",
  "Stories": "#7C90F0", "Carrossel/Stories": "#01A652", "Feed/Stories": "#0061EE",
};

const FALLBACK_ACCENT = "#EA4918";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
  return sorted[0] === sorted[sorted.length - 1] ? ddmm(sorted[0]) : `${ddmm(sorted[0])} a ${ddmm(sorted[sorted.length - 1])}`;
}

export default function CronogramaPublica() {
  const { token } = useParams<{ token: string }>();
  useForceLightTheme();
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<{ id: string; status: "recusado" | "ajuste" } | null>(null);
  const [reason, setReason] = useState("");
  const [period, setPeriod] = useState<string>("all"); // "all" | "YYYY-MM"

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

  if (q.isLoading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#857F9C", fontFamily: "system-ui" }}>Carregando…</div>;

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

  // Cor por CLIENTE tem prioridade (ex.: cliente homem não recebe rosa da agência).
  const accent = cron.client_color || cron.accent || FALLBACK_ACCENT;
  const onAccent = isDark(accent) ? "#ffffff" : "#1A1626";
  const onAccentSoft = isDark(accent) ? "rgba(255,255,255,.82)" : "rgba(26,22,38,.7)";
  const datas = cron.datas ?? [];
  const selectedCount = datas.filter((d) => d.selected).length;
  const handle = cron.client_handle ? `@${cron.client_handle.replace(/^@/, "")}` : (cron.client_label || cron.title);

  // Meses disponíveis (a partir das datas dos posts) para o filtro de período.
  const monthKeys = Array.from(new Set(cron.items.map((i) => i.date?.slice(0, 7)).filter(Boolean) as string[])).sort();
  const months = monthKeys.map((k) => ({ key: k, label: MESES[Number(k.slice(5, 7)) - 1] }));
  const visible = period === "all" ? cron.items : cron.items.filter((i) => (i.date ?? "").slice(0, 7) === period);
  const approved = visible.filter((i) => i.approval_status === "aprovado").length;
  const period_ = periodLabel(cron.items);

  const chip = (active: boolean): CSSProperties => ({
    background: active ? "#0A0A0A" : "#fff", color: active ? "#fff" : "#5b5470",
    border: active ? "1px solid #0A0A0A" : "1px solid #E7E1D2", fontSize: 12, fontWeight: 500,
    padding: "7px 14px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F5F3E7", padding: "24px 14px", fontFamily: "'Roboto', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -50, right: -40, width: 190, height: 190, background: "#FF77B9", opacity: .16, borderRadius: "50% 50% 42% 58% / 58% 42% 58% 42%" }} />
      <div style={{ position: "absolute", top: 260, left: -60, width: 170, height: 170, background: "#FFCF03", opacity: .2, borderRadius: "52% 48% 40% 60% / 45% 55% 45% 55%" }} />
      <div style={{ position: "absolute", bottom: -50, right: -30, width: 180, height: 180, background: "#7C90F0", opacity: .14, borderRadius: "48% 52% 55% 45% / 52% 48% 52% 48%" }} />

      <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>

        <div style={{ background: accent, borderRadius: 22, padding: "24px 20px 20px", textAlign: "center", color: onAccent, boxShadow: "0 16px 36px -18px rgba(234,73,24,.55)" }}>
          {(cron.logo || cron.client_logo) && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {cron.logo && <img src={cron.logo} alt="" style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", background: "#fff", padding: 3, boxSizing: "border-box" }} />}
              {cron.client_logo && <img src={cron.client_logo} alt="" style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", background: "#fff", padding: 3, boxSizing: "border-box" }} />}
            </div>
          )}
          <p style={{ fontSize: 11.5, letterSpacing: ".14em", color: onAccentSoft, margin: 0, textTransform: "uppercase" }}>Cronograma de conteúdo</p>
          <h1 style={{ fontFamily: "'Grand Hotel', cursive", fontSize: 38, fontWeight: 400, lineHeight: 1.05, margin: "2px 0 0" }}>{handle}</h1>
          <p style={{ fontSize: 13, color: onAccentSoft, marginTop: 4 }}>{period_ ? period_ : cron.title}{cron.by ? ` · por ${cron.by}` : ""}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, background: "rgba(255,255,255,.2)", padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, color: onAccent }}>
            <CheckCircle2 style={{ width: 14, height: 14 }} /> {approved} de {visible.length} aprovados
          </div>
        </div>

        {months.length > 1 && (
          <div style={{ display: "flex", gap: 7, margin: "14px 2px 2px", overflowX: "auto", paddingBottom: 2 }}>
            <button onClick={() => setPeriod("all")} style={chip(period === "all")}>Tudo</button>
            {months.map((m) => <button key={m.key} onClick={() => setPeriod(m.key)} style={chip(period === m.key)}><CalendarRange style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} />{m.label}</button>)}
          </div>
        )}

        {datas.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #EFE9DA", borderRadius: 16, padding: "14px 16px", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#2A2440", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <PartyPopper style={{ width: 15, height: 15, color: accent }} /> Datas comemorativas
              </p>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#993556", background: "#FBEAF0", padding: "3px 10px", borderRadius: 999 }}>{selectedCount} marcadas</span>
            </div>
            <p style={{ fontSize: 12, color: "#857F9C", margin: "0 0 11px" }}>Marque as que você quer trabalhar, eu monto o conteúdo em cima delas.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {datas.map((d) => (
                <button key={d.id} onClick={() => toggleData.mutate({ id: d.id, selected: !d.selected })}
                  style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", background: "#fff", border: `1.5px solid ${d.selected ? accent : "#EFE9DA"}`, borderRadius: 11, padding: "9px 12px", width: "100%" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, background: d.selected ? accent : "transparent", border: d.selected ? "none" : "1.5px solid #D8D2C2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {d.selected && <Check style={{ width: 12, height: 12, color: onAccent }} strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: 13, color: d.selected ? "#2A2440" : "#5b5470", fontWeight: d.selected ? 700 : 500 }}>{d.label}</span>
                  {d.day_label && <span style={{ marginLeft: "auto", fontSize: 12, color: "#A79F8C" }}>{d.day_label}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: "#A79F8C", margin: "16px 4px 9px", textTransform: "uppercase", letterSpacing: ".1em" }}>
          {period === "all" ? "Posts para aprovar" : `Posts de ${months.find((m) => m.key === period)?.label ?? ""}`}
        </div>

        {visible.map((it, i) => {
          const isApproved = it.approval_status === "aprovado";
          const isReason = reasonFor?.id === it.id;
          return (
            <div key={it.id} style={{ background: "#fff", border: "1px solid #EFE9DA", borderRadius: 16, padding: 15, marginBottom: 11, boxShadow: "0 6px 18px -14px rgba(35,25,70,.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: "#C7BFA9", fontSize: 13 }}>#{i + 1}</span>
                {it.type && <span style={{ fontSize: 11, fontWeight: 500, color: "#fff", background: TYPE_COLOR[it.type] ?? "#6B7280", padding: "3px 10px", borderRadius: 7 }}>{it.type}</span>}
                {it.date && <span style={{ fontSize: 12, color: "#A79F8C" }}>· {ddmm(it.date)}</span>}
                {isApproved && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#0F6E56", background: "#E1F5EE", padding: "3px 10px", borderRadius: 7 }}>Aprovado ✓</span>}
                {it.approval_status === "recusado" && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#A32D2D", background: "#FCEBEB", padding: "3px 10px", borderRadius: 7 }}>Recusado</span>}
                {it.approval_status === "ajuste" && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#854F0B", background: "#FAEEDA", padding: "3px 10px", borderRadius: 7 }}>Ajuste pedido</span>}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: "#2A2440", lineHeight: 1.3 }}>{it.copy || "(sem título)"}</div>
              {it.description && <div style={{ fontSize: 13, color: "#6b647e", marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{linkify(it.description)}</div>}
              {it.ref_url && <a href={it.ref_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#0061EE", marginTop: 9, textDecoration: "none", fontWeight: 500 }}><Link2 style={{ width: 13, height: 13 }} /> Ver referência</a>}
              {it.client_comment && <div style={{ fontSize: 12, color: "#854F0B", background: "#FFFBEB", border: "1px solid #FAC775", borderRadius: 9, padding: "8px 10px", marginTop: 9 }}>"{it.client_comment}"</div>}

              {!isApproved && !isReason && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setStatus.mutate({ id: it.id, status: "aprovado" })} style={{ ...btn("#01A652", "#fff"), flex: 1, justifyContent: "center" }}><Check style={ic} /> Aprovar</button>
                  <button onClick={() => { setReasonFor({ id: it.id, status: "ajuste" }); setReason(it.client_comment ?? ""); }} style={btn("#fff", "#854F0B", "#FAC775")}><Pencil style={ic} /> Ajuste</button>
                  <button onClick={() => { setReasonFor({ id: it.id, status: "recusado" }); setReason(it.client_comment ?? ""); }} style={btn("#fff", "#A32D2D", "#F09595")}><X style={ic} /> Recusar</button>
                </div>
              )}

              {isReason && (
                <div style={{ marginTop: 10, background: "#FFFBEB", border: "1px dashed #FAC775", borderRadius: 11, padding: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#854F0B", marginBottom: 6 }}>
                    {reasonFor.status === "recusado" ? "POR QUE A RECUSA?" : "POR QUE O AJUSTE?"}
                  </p>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique pro social media…"
                    style={{ width: "100%", border: "1px solid #EFE9DA", borderRadius: 9, padding: 8, fontSize: 12.5, fontFamily: "inherit", resize: "none", height: 54, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => setStatus.mutate({ id: it.id, status: reasonFor.status, comment: reason })}
                      style={{ fontSize: 12, fontWeight: 700, background: "#854F0B", color: "#fff", border: "none", borderRadius: 9, padding: "7px 13px", cursor: "pointer" }}>Enviar</button>
                    <button onClick={() => { setReasonFor(null); setReason(""); }} style={{ fontSize: 12, fontWeight: 700, background: "#fff", color: "#857F9C", border: "1px solid #EFE9DA", borderRadius: 9, padding: "7px 13px", cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && <div style={{ textAlign: "center", color: "#A79F8C", fontSize: 13, padding: "20px 0" }}>Nenhum post neste período.</div>}

        <div style={{ textAlign: "center", fontFamily: "'Grand Hotel', cursive", fontSize: 24, color: accent, marginTop: 18 }}>cria</div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#A79F8C", marginTop: -2, marginBottom: 4 }}>criasocialclub.com.br</div>
      </div>
    </div>
  );
}

const ic = { width: 14, height: 14 } as const;
function btn(bg: string, color: string, border?: string): CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, background: bg, color, border: `1px solid ${border ?? "#EFE9DA"}`, borderRadius: 11, padding: "9px 14px", cursor: "pointer" };
}
