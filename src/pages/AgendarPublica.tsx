import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { isDarkColor } from "@/lib/sidebarTheme";
import { LogosCabecalho } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   O CLIENTE ESCOLHE O DIA DA CAPTAÇÃO (Gabriela e Walter, 19/10/2026)

   Link próprio de cada cliente: já abre com o nome dele. Calendário do mês
   com os dias que têm horário livre, toca no dia, escolhe o horário, escreve
   (se quiser) ideias e um recado, e pede. O horário fica reservado na hora;
   a social mídia confirma depois. Sem login.
   ═══════════════════════════════════════════════════════════════════════════ */

type Slot = { id: string; dia: string; hora: string; duracao: number; local: string | null };
type Meu = { id: string; dia: string; hora: string; duracao: number; status: "pendente" | "confirmado" };
type Dados = {
  agencia: string | null; accent: string | null; logo: string | null;
  cliente: string | null; client_color: string | null; client_logo: string | null;
  por: string | null; hoje: string; slots: Slot[]; meus: Meu[];
};

const AZUL = "#3B82F6";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WD_LONGO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const addMes = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const dow = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
const dataLonga = (iso: string) => `${WD_LONGO[dow(iso)]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hora = (h: string) => (h.endsWith(":00") ? `${h.slice(0, 2)}h` : h.replace(":", "h"));

const ERROS: Record<string, string> = {
  horario_ocupado: "Alguém acabou de pedir esse horário. Escolhe outro, por favor.",
  horario_indisponivel: "Esse horário não está mais disponível. Escolhe outro.",
  muitos_pedidos: "Você já tem 3 pedidos esperando confirmação. Aguarda a resposta antes de pedir outro.",
  link_invalido: "Este link não está mais ativo. Pede um novo pra quem te mandou.",
};

export default function AgendarPublica() {
  useForceLightTheme();
  const { token = "" } = useParams();
  const qc = useQueryClient();
  const { data: d, isLoading } = useQuery<Dados | null>({
    queryKey: ["agenda-publica", token],
    queryFn: async () => {
      const { data, error } = await sbRpc("agenda_publica", { _token: token });
      if (error) throw new Error(error.message);
      return (data as Dados | null) ?? null;
    },
  });

  const [ym, setYm] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [ideias, setIdeias] = useState("");
  const [recado, setRecado] = useState("");
  const [feito, setFeito] = useState<Slot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of d?.slots ?? []) m.set(s.dia, [...(m.get(s.dia) ?? []), s]);
    return m;
  }, [d]);
  const mesesComHorario = useMemo(() => [...new Set((d?.slots ?? []).map((s) => s.dia.slice(0, 7)))].sort(), [d]);
  const mes = ym ?? mesesComHorario[0] ?? (d?.hoje ?? "").slice(0, 7);

  const pedir = useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("pedir_horario", { _token: token, _slot: slotId, _ideias: ideias, _recado: recado });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setFeito((d?.slots ?? []).find((s) => s.id === slotId) ?? null);
      setErro(null);
      void qc.invalidateQueries({ queryKey: ["agenda-publica", token] });
    },
    onError: (e: Error) => {
      const chave = Object.keys(ERROS).find((k) => e.message.includes(k));
      setErro(chave ? ERROS[chave] : "Não consegui enviar agora. Tenta de novo em um minuto.");
      setSlotId(null);
      void qc.invalidateQueries({ queryKey: ["agenda-publica", token] });
    },
  });

  if (isLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FBF7F0" }}><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!d) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FBF7F0", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div><p style={{ fontWeight: 800, fontSize: 18 }}>Link não encontrado</p><p style={{ color: "#6E675A" }}>Pede um link novo pra quem te mandou.</p></div>
      </div>
    );
  }

  const accent = d.accent || AZUL;
  const onAccent = isDarkColor(accent) ? "#ffffff" : "#1A1626";
  const onAccentSoft = isDarkColor(accent) ? "rgba(255,255,255,.85)" : "rgba(26,22,38,.7)";
  const [y, m] = mes.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  const vazio = dow(`${mes}-01`);
  const celulas: (number | null)[] = [...Array(vazio).fill(null), ...[...Array(total)].map((_, i) => i + 1)];
  const idxMes = mesesComHorario.indexOf(mes);
  const slotsDoDia = dia ? porDia.get(dia) ?? [] : [];
  const escolhido = (d.slots ?? []).find((s) => s.id === slotId) ?? null;
  const card: React.CSSProperties = { background: "#fff", borderRadius: 20, border: "1px solid #ECE4D6", padding: 16, marginTop: 14 };
  const rotulo: React.CSSProperties = { margin: "0 0 6px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#7A7266" };
  const campo: React.CSSProperties = { width: "100%", border: "1px solid #E5DCCB", borderRadius: 14, padding: "11px 13px", fontSize: 15, fontFamily: "inherit", resize: "vertical", background: "#fff", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#FBF7F0", paddingBottom: 40, color: "#1A1626" }}>
      <div style={{ background: accent, padding: "28px 20px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <span aria-hidden style={{ position: "absolute", top: -46, right: -34, width: 156, height: 156, borderRadius: "50%", background: "rgba(255,255,255,.12)" }} />
        <span aria-hidden style={{ position: "absolute", bottom: -60, left: -30, width: 132, height: 132, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative" }}>
          <LogosCabecalho agencia={{ src: d.logo ?? undefined, nome: d.agencia ?? undefined }}
            cliente={{ src: d.client_logo ?? undefined, nome: d.cliente ?? undefined }} fundo={accent} style={{ marginBottom: 14 }} />
          <p style={{ margin: 0, color: onAccentSoft, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>{d.agencia ?? "Captação"}</p>
          <h1 style={{ margin: "6px 0 0", color: onAccent, fontSize: 25, fontWeight: 800, lineHeight: 1.2 }}>Olá, {d.cliente}</h1>
          <p style={{ margin: "8px 0 0", color: onAccent, fontSize: 16, fontWeight: 600 }}>Escolha a melhor data pra sua captação</p>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: "-22px auto 0", padding: "0 14px", position: "relative" }}>
        {/* O que ele já pediu: não precisa adivinhar se deu certo. */}
        {(d.meus ?? []).length > 0 && !feito && (
          <div style={{ ...card, marginTop: 0 }}>
            <p style={rotulo}>Seus pedidos</p>
            {d.meus.map((p) => (
              <p key={p.id} style={{ margin: "4px 0", fontSize: 14.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span><b>{dataLonga(p.dia)}</b> às {hora(p.hora)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "3px 9px", background: p.status === "confirmado" ? "#DCFCE7" : "#FEF3C7", color: p.status === "confirmado" ? "#166534" : "#92400E" }}>
                  {p.status === "confirmado" ? "confirmada" : "esperando confirmação"}
                </span>
              </p>
            ))}
          </div>
        )}

        {feito ? (
          <div style={{ ...card, marginTop: (d.meus ?? []).length ? 14 : 0, textAlign: "center", padding: "28px 18px" }}>
            <span style={{ width: 58, height: 58, borderRadius: "50%", background: "#DCFCE7", display: "inline-grid", placeItems: "center" }}>
              <CalendarCheck2 style={{ width: 28, height: 28, color: "#16A34A" }} />
            </span>
            <p style={{ margin: "12px 0 4px", fontSize: 19, fontWeight: 800 }}>Pedido enviado</p>
            <p style={{ margin: 0, fontSize: 15, color: "#4B4740" }}>{dataLonga(feito.dia)} às {hora(feito.hora)} ficou reservado pra você.</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6E675A" }}>{d.por ? `${d.por} vai` : "A gente vai"} confirmar e te avisar.</p>
          </div>
        ) : (d.slots ?? []).length === 0 ? (
          <div style={{ ...card, marginTop: (d.meus ?? []).length ? 14 : 0, textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 800 }}>Nenhum horário livre agora</p>
            <p style={{ margin: "6px 0 0", color: "#6E675A", fontSize: 14 }}>Quando novos horários forem liberados, é só abrir este link de novo.</p>
          </div>
        ) : (
          <>
            <div style={{ ...card, marginTop: (d.meus ?? []).length ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <button type="button" aria-label="Mês anterior" disabled={idxMes <= 0} onClick={() => { setYm(mesesComHorario[idxMes - 1]); setDia(null); setSlotId(null); }}
                  style={{ border: 0, background: "transparent", padding: 8, opacity: idxMes <= 0 ? .25 : 1 }}><ChevronLeft style={{ width: 20, height: 20 }} /></button>
                <b style={{ fontSize: 16, textTransform: "capitalize" }}>{MESES[m - 1]} {y}</b>
                <button type="button" aria-label="Próximo mês" disabled={idxMes < 0 || idxMes >= mesesComHorario.length - 1} onClick={() => { setYm(mesesComHorario[idxMes + 1] ?? addMes(mes, 1)); setDia(null); setSlotId(null); }}
                  style={{ border: 0, background: "transparent", padding: 8, opacity: idxMes < 0 || idxMes >= mesesComHorario.length - 1 ? .25 : 1 }}><ChevronRight style={{ width: 20, height: 20 }} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
                {WD.map((w, i) => <span key={i} style={{ fontSize: 11, fontWeight: 800, color: "#9A9285", padding: "2px 0" }}>{w}</span>)}
                {celulas.map((n, i) => {
                  if (n == null) return <span key={`v${i}`} />;
                  const iso = `${mes}-${String(n).padStart(2, "0")}`;
                  const tem = porDia.has(iso);
                  const sel = dia === iso;
                  return (
                    <button key={iso} type="button" disabled={!tem} onClick={() => { setDia(iso); setSlotId(null); }}
                      style={{
                        border: 0, borderRadius: 12, padding: "10px 0", fontSize: 15, fontFamily: "inherit",
                        fontWeight: tem ? 800 : 500, cursor: tem ? "pointer" : "default",
                        background: sel ? AZUL : tem ? "#EAF2FF" : "transparent",
                        color: sel ? "#fff" : tem ? "#1D4ED8" : "#C3BCAF",
                      }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#7A7266" }}>Os dias em azul têm horário livre. Toca no dia pra ver os horários.</p>
            </div>

            {dia && (
              <div style={card}>
                <p style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>{dataLonga(dia)}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {slotsDoDia.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSlotId(s.id)}
                      style={{
                        border: `2px solid ${slotId === s.id ? AZUL : "#E5DCCB"}`, background: slotId === s.id ? "#EAF2FF" : "#fff",
                        color: slotId === s.id ? "#1D4ED8" : "#1A1626", borderRadius: 14, padding: "10px 16px",
                        fontSize: 16, fontWeight: 800, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                      <Clock style={{ width: 15, height: 15 }} /> {hora(s.hora)}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#7A7266" }}>{s.duracao}h</span>
                    </button>
                  ))}
                </div>
                {escolhido?.local && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#4B4740" }}>Local: {escolhido.local}</p>}
              </div>
            )}

            {escolhido && (
              <div style={card}>
                <p style={rotulo}>Ideias pra essa captação (opcional)</p>
                <textarea value={ideias} onChange={(e) => setIdeias(e.target.value)} maxLength={1000} rows={3} style={campo}
                  placeholder="Ex.: gravar o prato novo, mostrar a equipe na cozinha" />
                <p style={{ ...rotulo, marginTop: 14 }}>Recado pra {d.por || "nós"} (opcional)</p>
                <textarea value={recado} onChange={(e) => setRecado(e.target.value)} maxLength={1000} rows={2} style={campo}
                  placeholder="Ex.: chegar pela porta dos fundos" />
                {erro && <p style={{ margin: "10px 0 0", color: "#B91C1C", fontSize: 14 }}>{erro}</p>}
                <button type="button" onClick={() => pedir.mutate()} disabled={pedir.isPending}
                  style={{ marginTop: 14, width: "100%", border: 0, borderRadius: 16, padding: "15px 16px", background: AZUL, color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "inherit" }}>
                  {pedir.isPending ? "Enviando..." : `Pedir ${dataLonga(escolhido.dia).toLowerCase()} às ${hora(escolhido.hora)}`}
                </button>
              </div>
            )}
            {erro && !escolhido && <p style={{ margin: "12px 4px 0", color: "#B91C1C", fontSize: 14 }}>{erro}</p>}
          </>
        )}
        <AssinaturaCria variante="rodape" style={{ marginTop: 22, justifyContent: "center" }} />
      </div>
    </div>
  );
}
