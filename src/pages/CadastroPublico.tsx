import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Check, PartyPopper, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogosCabecalho } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import {
  ETAPAS_INTAKE, faltandoObrigatorios, quantasRespondidas, TODOS_CAMPOS_INTAKE,
  type CampoIntake,
} from "@/lib/formularioCadastro";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   O CLIENTE PREENCHE O PRÓPRIO CADASTRO

   Antes disso, fechar um contrato era uma sequência de mensagens soltas no
   WhatsApp: "me manda o CNPJ", "e o endereço completo?", "qual o nome de quem
   assina?". As respostas chegavam picadas entre outros assuntos e alguém
   digitava tudo de novo na ficha.

   Aqui o cliente abre um link, responde no tempo dele e pronto. Três decisões
   que importam:
   · RASCUNHO AUTOMÁTICO: sai da aba no meio e volta, nada se perde. Formulário
     longo sem isso é formulário abandonado.
   · UMA ETAPA POR VEZ: seis blocos curtos em vez de uma parede de 30 campos.
   · NADA DE PREÇO: valor, vencimento e multa não aparecem, porque quem conduz
     a negociação é a agência.
   ═══════════════════════════════════════════════════════════════════════════ */

type Dados = {
  status: "aberto" | "enviado" | "aplicado";
  answers: Record<string, string> | null;
  client_label: string | null;
  accent: string | null; logo: string | null; by: string | null;
};

const FALLBACK = "#EA4918";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function isDark(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

export default function CadastroPublico() {
  const { token } = useParams<{ token: string }>();
  useForceLightTheme();

  const [resp, setResp] = useState<Record<string, string>>({});
  const [etapa, setEtapa] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [carregou, setCarregou] = useState(false);

  const q = useQuery({
    queryKey: ["intake-pub", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_intake_by_token", { _token: token });
      if (error) throw error;
      return data as unknown as Dados | null;
    },
  });

  useEffect(() => {
    if (!q.data || carregou) return;
    setResp((q.data.answers ?? {}) as Record<string, string>);
    if (q.data.status !== "aberto") setEnviado(true);
    setCarregou(true);
  }, [q.data, carregou]);

  const salvar = useMutation({
    mutationFn: async (r: Record<string, string>) => {
      const { error } = await sbRpc("save_intake_by_token", { _token: token, _answers: r });
      if (error) throw error;
    },
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("submit_intake_by_token", { _token: token, _answers: resp });
      if (error) throw error;
    },
    onSuccess: () => setEnviado(true),
  });

  // Rascunho: grava sozinho um segundo depois de parar de digitar.
  useEffect(() => {
    if (!carregou || enviado) return;
    const t = setTimeout(() => salvar.mutate(resp), 1000);
    return () => clearTimeout(t);
    // salvar é estável o bastante; o que importa é a mudança das respostas.
  }, [resp, carregou, enviado]); // eslint-disable-line react-hooks/exhaustive-deps

  const preenchidas = useMemo(() => quantasRespondidas(resp), [resp]);

  if (q.isLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#857F9C", fontFamily: "system-ui" }}>Carregando…</div>;
  }
  const d = q.data;
  if (!d) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui", textAlign: "center", color: "#3f3f46" }}>
        <div>
          <ClipboardList style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#a1a1aa" }} />
          <p>Formulário não encontrado ou link inválido.</p>
        </div>
      </div>
    );
  }

  const accent = d.accent || FALLBACK;
  const onAccent = isDark(accent) ? "#ffffff" : "#1A1626";
  const onAccentSoft = isDark(accent) ? "rgba(255,255,255,.82)" : "rgba(26,22,38,.7)";
  const et = ETAPAS_INTAKE[etapa];
  const ultima = etapa === ETAPAS_INTAKE.length - 1;

  const campo: CSSProperties = {
    width: "100%", border: "1px solid #E5DFD3", borderRadius: 12, padding: "11px 13px",
    fontSize: 15.5, lineHeight: 1.5, fontFamily: "inherit", color: "#2A2440", background: "#FFFDF9",
    boxSizing: "border-box",
  };

  const set = (k: string, v: string) => setResp((r) => ({ ...r, [k]: v }));

  const enviar = () => {
    const faltou = faltandoObrigatorios(resp);
    if (faltou.length) {
      setErros(faltou);
      // Leva de volta pra primeira etapa que tem pendência.
      const idx = ETAPAS_INTAKE.findIndex((e) => e.campos.some((c) => c.obrigatorio && !(resp[c.chave] || "").trim()));
      if (idx >= 0) setEtapa(idx);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErros([]);
    finalizar.mutate();
  };

  const renderCampo = (c: CampoIntake) => {
    const v = resp[c.chave] ?? "";
    const faltando = erros.includes(c.label);
    const borda = faltando ? { borderColor: "#D9534F" } : {};

    if (c.tipo === "tags") {
      const marcados = v.split(",").map((x) => x.trim()).filter(Boolean);
      const tem = (o: string) => marcados.some((x) => x.toLowerCase() === o.toLowerCase());
      const alternar = (o: string) => set(c.chave,
        (tem(o) ? marcados.filter((x) => x.toLowerCase() !== o.toLowerCase()) : [...marcados, o]).join(", "));
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {(c.opcoes ?? []).map((o) => (
            <button key={o} type="button" onClick={() => alternar(o)}
              style={{
                border: `1px solid ${tem(o) ? accent : "#E5DFD3"}`,
                background: tem(o) ? accent : "#FFFDF9",
                color: tem(o) ? onAccent : "#5B5470",
                borderRadius: 999, padding: "9px 15px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              {o}
            </button>
          ))}
        </div>
      );
    }

    if (c.tipo === "aniversario") {
      // Guarda no mesmo formato da ficha ("2000-MM-DD"): só dia e mês importam.
      const [, mm = "", dd = ""] = v ? v.split("-") : [];
      const trocar = (novoDd: string, novoMm: string) =>
        set(c.chave, novoDd && novoMm ? `2000-${novoMm}-${novoDd}` : "");
      const sel: CSSProperties = { ...campo, width: "auto", flex: 1, appearance: "auto" };
      return (
        <div style={{ display: "flex", gap: 8 }}>
          <select value={dd} onChange={(e) => trocar(e.target.value, mm)} style={sel}>
            <option value="">Dia</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={mm} onChange={(e) => trocar(dd, e.target.value)} style={sel}>
            <option value="">Mês</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
        </div>
      );
    }

    if (c.tipo === "longo") {
      return (
        <textarea value={v} onChange={(e) => set(c.chave, e.target.value)}
          rows={3} style={{ ...campo, ...borda, resize: "vertical" }} />
      );
    }

    return (
      <input value={v} onChange={(e) => set(c.chave, e.target.value)}
        type={c.tipo === "email" ? "email" : c.tipo === "tel" ? "tel" : "text"}
        style={{ ...campo, ...borda }} />
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FBF7F0", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 48 }}>
      <div style={{ background: accent, padding: "26px 20px 30px", textAlign: "center" }}>
        <LogosCabecalho agencia={{ src: d.logo ?? undefined, nome: d.by ?? undefined }} fundo={accent} style={{ marginBottom: 16 }} />
        <p style={{ margin: 0, color: onAccentSoft, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Cadastro e briefing
        </p>
        <h1 style={{ margin: "6px 0 0", color: onAccent, fontSize: 25, fontWeight: 800, lineHeight: 1.25 }}>
          {d.client_label || "Vamos começar"}
        </h1>
        <p style={{ margin: "8px auto 0", color: onAccentSoft, fontSize: 14, maxWidth: 460, lineHeight: 1.5 }}>
          {enviado
            ? "Recebemos as suas respostas."
            : "Leva uns 10 minutos. Pode fechar e voltar depois: o que você escrever fica salvo."}
        </p>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 0" }}>
        {enviado ? (
          <div style={{ background: "#EAF7EE", border: "1px solid #BFE6CC", borderRadius: 18, padding: 22, display: "flex", gap: 12 }}>
            <PartyPopper style={{ width: 22, height: 22, color: "#1E7A44", flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: "#175C34", fontSize: 16 }}>Tudo certo, obrigado!</p>
              <p style={{ margin: "6px 0 0", color: "#3F6B50", fontSize: 14, lineHeight: 1.55 }}>
                {d.by ? `${d.by} já recebeu` : "Já recebemos"} as suas respostas. Qualquer coisa que faltar, a gente te chama.
                Pode fechar esta página.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Progresso: uma etapa por vez, pra não parecer uma parede de campos */}
            <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
              {ETAPAS_INTAKE.map((_, i) => (
                <span key={i} style={{
                  flex: 1, height: 5, borderRadius: 999,
                  background: i <= etapa ? accent : "#E8E1D5",
                }} />
              ))}
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#8B8272", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Etapa {etapa + 1} de {ETAPAS_INTAKE.length} · {preenchidas} de {TODOS_CAMPOS_INTAKE.length} respondidas
            </p>
            <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 800, color: "#2A2440" }}>{et.titulo}</h2>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "#7C7566", lineHeight: 1.5 }}>{et.descricao}</p>

            {erros.length > 0 && (
              <div style={{ background: "#FDECEA", border: "1px solid #F3C9C4", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: "#9B3229", lineHeight: 1.5 }}>
                  Falta responder: {erros.join(", ")}.
                </p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {et.campos.map((c) => (
                <div key={c.chave} style={{ gridColumn: c.largo ? "1 / -1" : "auto" }}>
                  <label style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#2A2440", marginBottom: 3 }}>
                    {c.label}{c.obrigatorio && <span style={{ color: accent }}> *</span>}
                  </label>
                  {c.ajuda && <p style={{ margin: "0 0 7px", fontSize: 12.5, color: "#8B8272", lineHeight: 1.45 }}>{c.ajuda}</p>}
                  {!c.ajuda && <div style={{ height: 5 }} />}
                  {renderCampo(c)}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
              {etapa > 0 && (
                <button type="button" onClick={() => { setEtapa((e) => e - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#5B5470",
                    border: "1px solid #E5DFD3", borderRadius: 999, padding: "13px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}>
                  <ArrowLeft style={{ width: 16, height: 16 }} /> Voltar
                </button>
              )}
              {!ultima ? (
                <button type="button" onClick={() => { setEtapa((e) => e + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    flex: 1, minWidth: 180, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: accent, color: onAccent, border: "none", borderRadius: 999,
                    padding: "14px 22px", fontSize: 16, fontWeight: 800, cursor: "pointer",
                  }}>
                  Continuar <ArrowRight style={{ width: 17, height: 17 }} />
                </button>
              ) : (
                <button type="button" onClick={enviar} disabled={finalizar.isPending}
                  style={{
                    flex: 1, minWidth: 180, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: accent, color: onAccent, border: "none", borderRadius: 999,
                    padding: "14px 22px", fontSize: 16, fontWeight: 800, cursor: "pointer",
                  }}>
                  {finalizar.isPending ? <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" /> : <Check style={{ width: 17, height: 17 }} />}
                  {finalizar.isPending ? "Enviando…" : "Enviar as respostas"}
                </button>
              )}
            </div>

            <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "#8B8272", textAlign: "center", lineHeight: 1.5 }}>
              Pode responder só o que souber agora. O resto a gente vê na conversa.
            </p>
          </>
        )}

        <AssinaturaCria variante="rodape" style={{ marginTop: 26, justifyContent: "center" }} />
      </div>
    </div>
  );
}
