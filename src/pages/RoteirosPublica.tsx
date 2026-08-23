import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clapperboard, ChevronUp, ChevronDown, Check, Trash2, Undo2, PartyPopper, Plus, Minus } from "lucide-react";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogosCabecalho } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   O CLIENTE REVISA OS ROTEIROS

   Fora do sistema, isso vira áudio de WhatsApp: "no segundo vídeo, em vez de
   falar X, fala Y". Aqui o cliente escreve direto no texto, muda a ordem de
   gravação e finaliza. O que ele escreve NÃO sobrescreve o roteiro: fica como
   sugestão até a social mídia confirmar.

   Sem login, sem app, tudo grande o bastante pra editar no celular.
   ═══════════════════════════════════════════════════════════════════════════ */

type Cena = { fala: string; direcao: string };
type Item = {
  id: string; position: number; title: string; content: string;
  scenes: Cena[]; comment: string | null; removed: boolean; tocado: boolean;
};
type Dados = {
  title: string; month: string; status: "aberto" | "enviado" | "aplicado";
  client_label: string | null; client_note: string | null;
  accent: string | null; logo: string | null; by: string | null;
  client_color: string | null; client_logo: string | null;
  items: Item[];
};

const FALLBACK = "#EA4918";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function isDark(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}
function mesLabel(month: string): string {
  const [a, m] = (month || "").split("-");
  return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} de ${a}` : month;
}

export default function RoteirosPublica() {
  const { token } = useParams<{ token: string }>();
  useForceLightTheme();
  const qc = useQueryClient();

  const [rascunho, setRascunho] = useState<Record<string, Item>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(false);

  const q = useQuery({
    queryKey: ["roteiros-pub", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await sbRpc("get_script_approval_by_token", { _token: token });
      if (error) throw error;
      return data as unknown as Dados | null;
    },
  });

  // O rascunho local existe pra digitar sem travar: o banco só recebe no blur.
  useEffect(() => {
    if (!q.data) return;
    const mapa: Record<string, Item> = {};
    for (const i of q.data.items) mapa[i.id] = { ...i, scenes: Array.isArray(i.scenes) ? i.scenes : [] };
    setRascunho(mapa);
    setNota(q.data.client_note ?? "");
    if (q.data.status !== "aberto") setEnviado(true);
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await sbRpc("save_script_approval_item_by_token", {
        _token: token, _item_id: it.id, _title: it.title, _content: it.content,
        _scenes: it.scenes, _comment: it.comment, _removed: it.removed,
      });
      if (error) throw error;
    },
  });

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sbRpc("reorder_script_approval_by_token", { _token: token, _ids: ids });
      if (error) throw error;
    },
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      const { error } = await sbRpc("submit_script_approval_by_token", { _token: token, _note: nota });
      if (error) throw error;
    },
    onSuccess: () => { setEnviado(true); void qc.invalidateQueries({ queryKey: ["roteiros-pub", token] }); },
  });

  const ordem = useMemo(
    () => Object.values(rascunho).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)),
    [rascunho],
  );

  if (q.isLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#857F9C", fontFamily: "system-ui" }}>Carregando…</div>;
  }
  const d = q.data;
  if (!d) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui", textAlign: "center", color: "#3f3f46" }}>
        <div>
          <Clapperboard style={{ width: 40, height: 40, margin: "0 auto 12px", color: "#a1a1aa" }} />
          <p>Roteiros não encontrados ou link inválido.</p>
        </div>
      </div>
    );
  }

  const accent = d.client_color || d.accent || FALLBACK;
  const onAccent = isDark(accent) ? "#ffffff" : "#1A1626";
  const onAccentSoft = isDark(accent) ? "rgba(255,255,255,.82)" : "rgba(26,22,38,.7)";
  const travado = enviado || d.status !== "aberto";

  const mexer = (id: string, patch: Partial<Item>) =>
    setRascunho((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const guardar = (id: string) => { const it = rascunho[id]; if (it) salvar.mutate(it); };

  const mover = (id: string, delta: number) => {
    const ids = ordem.map((i) => i.id);
    const de = ids.indexOf(id);
    const para = de + delta;
    if (de < 0 || para < 0 || para >= ids.length) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    setRascunho((r) => {
      const novo = { ...r };
      ids.forEach((x, i) => { novo[x] = { ...novo[x], position: i }; });
      return novo;
    });
    reordenar.mutate(ids);
  };

  const card: CSSProperties = {
    background: "#fff", border: "1px solid #EDE7DC", borderRadius: 18, padding: 16, marginBottom: 14,
  };
  const campo: CSSProperties = {
    width: "100%", border: "1px solid #E5DFD3", borderRadius: 12, padding: "10px 12px",
    fontSize: 15, lineHeight: 1.55, fontFamily: "inherit", color: "#2A2440", background: "#FFFDF9",
    resize: "vertical", boxSizing: "border-box",
  };
  const rotulo: CSSProperties = {
    fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8B8272", marginBottom: 5,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FBF7F0", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 40 }}>
      {/* Cabeçalho com a marca de quem mandou */}
      <div style={{ background: accent, padding: "26px 20px 30px", textAlign: "center" }}>
        <LogosCabecalho
          agencia={{ src: d.logo ?? undefined, nome: d.by ?? undefined }}
          cliente={{ src: d.client_logo ?? undefined, nome: d.client_label ?? undefined }}
          fundo={accent}
          style={{ marginBottom: 16 }}
        />
        <p style={{ margin: 0, color: onAccentSoft, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Roteiros de gravação
        </p>
        <h1 style={{ margin: "6px 0 0", color: onAccent, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
          {d.client_label || d.title}
        </h1>
        <p style={{ margin: "6px 0 0", color: onAccentSoft, fontSize: 14 }}>{mesLabel(d.month)}</p>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 0" }}>
        {travado ? (
          <div style={{ background: "#EAF7EE", border: "1px solid #BFE6CC", borderRadius: 16, padding: 16, marginBottom: 16, display: "flex", gap: 10 }}>
            <PartyPopper style={{ width: 20, height: 20, color: "#1E7A44", flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "#175C34", fontSize: 15 }}>Revisão enviada.</p>
              <p style={{ margin: "4px 0 0", color: "#3F6B50", fontSize: 13.5, lineHeight: 1.5 }}>
                {d.by ? `${d.by} já recebeu` : "A social mídia já recebeu"} os seus ajustes. Você pode fechar esta página.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #EDE7DC", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: 0, color: "#2A2440", fontSize: 14.5, lineHeight: 1.6 }}>
              Leia os roteiros abaixo e mude o que quiser: o texto de cada cena, a ordem de gravação, ou tire um vídeo da lista.
              Quando terminar, toque em <strong>Finalizar revisão</strong> no fim da página.
            </p>
          </div>
        )}

        {ordem.length === 0 && (
          <p style={{ color: "#857F9C", fontSize: 14, textAlign: "center", padding: "30px 0" }}>Nenhum roteiro neste envio.</p>
        )}

        {ordem.map((it, idx) => {
          const aberto = abertos[it.id] ?? true;
          return (
            <div key={it.id} style={{ ...card, opacity: it.removed ? 0.55 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{
                  display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                  background: accent, color: onAccent, fontSize: 13, fontWeight: 800,
                }}>{idx + 1}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    value={it.title}
                    disabled={travado || it.removed}
                    onChange={(e) => mexer(it.id, { title: e.target.value })}
                    onBlur={() => guardar(it.id)}
                    placeholder={`Vídeo ${idx + 1}`}
                    style={{ ...campo, fontWeight: 700, fontSize: 16, padding: "8px 10px" }}
                  />
                </div>

                {!travado && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => mover(it.id, -1)} disabled={idx === 0}
                      aria-label="Gravar antes" title="Gravar antes"
                      style={{ background: "#fff", border: "1px solid #E5DFD3", borderRadius: 8, width: 28, height: 24, cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                      <ChevronUp style={{ width: 14, height: 14, color: "#8B8272" }} />
                    </button>
                    <button type="button" onClick={() => mover(it.id, 1)} disabled={idx === ordem.length - 1}
                      aria-label="Gravar depois" title="Gravar depois"
                      style={{ background: "#fff", border: "1px solid #E5DFD3", borderRadius: 8, width: 28, height: 24, cursor: idx === ordem.length - 1 ? "default" : "pointer", opacity: idx === ordem.length - 1 ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                      <ChevronDown style={{ width: 14, height: 14, color: "#8B8272" }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Cenas: é aqui que a edição realmente acontece */}
              {aberto && !it.removed && (
                <div style={{ marginTop: 12 }}>
                  {it.scenes.length > 0 ? it.scenes.map((c, ci) => (
                    <div key={ci} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `3px solid ${accent}33` }}>
                      <p style={{ ...rotulo, color: accent }}>Cena {ci + 1} · o que falar</p>
                      <textarea
                        value={c.fala}
                        disabled={travado}
                        rows={Math.max(2, Math.ceil((c.fala.length || 1) / 60))}
                        onChange={(e) => {
                          const cenas = it.scenes.map((x, i) => (i === ci ? { ...x, fala: e.target.value } : x));
                          mexer(it.id, { scenes: cenas });
                        }}
                        onBlur={() => guardar(it.id)}
                        style={campo}
                      />
                      {c.direcao?.trim() && (
                        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8B8272", fontStyle: "italic", lineHeight: 1.5 }}>
                          Direção: {c.direcao}
                        </p>
                      )}
                    </div>
                  )) : (
                    <>
                      <p style={rotulo}>Roteiro</p>
                      <textarea
                        value={it.content}
                        disabled={travado}
                        rows={Math.max(4, Math.ceil((it.content.length || 1) / 60))}
                        onChange={(e) => mexer(it.id, { content: e.target.value })}
                        onBlur={() => guardar(it.id)}
                        style={campo}
                      />
                    </>
                  )}

                  <p style={{ ...rotulo, marginTop: 12 }}>Quer comentar alguma coisa neste vídeo?</p>
                  <textarea
                    value={it.comment ?? ""}
                    disabled={travado}
                    rows={2}
                    placeholder="Opcional. Ex.: gravar na loja, não citar preço."
                    onChange={(e) => mexer(it.id, { comment: e.target.value })}
                    onBlur={() => guardar(it.id)}
                    style={campo}
                  />
                </div>
              )}

              {!travado && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button"
                    onClick={() => { const novo = !it.removed; mexer(it.id, { removed: novo }); salvar.mutate({ ...it, removed: novo }); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, background: it.removed ? accent : "#fff",
                      color: it.removed ? onAccent : "#B4453A", border: `1px solid ${it.removed ? accent : "#F0CFC9"}`,
                      borderRadius: 999, padding: "7px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                    }}>
                    {it.removed ? <><Undo2 style={{ width: 14, height: 14 }} /> Devolver pra lista</> : <><Trash2 style={{ width: 14, height: 14 }} /> Não quero este vídeo</>}
                  </button>
                  {!it.removed && (
                    <button type="button" onClick={() => setAbertos((a) => ({ ...a, [it.id]: !aberto }))}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#5B5470", border: "1px solid #E5DFD3", borderRadius: 999, padding: "7px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                      {aberto ? <><Minus style={{ width: 14, height: 14 }} /> Recolher</> : <><Plus style={{ width: 14, height: 14 }} /> Ver o roteiro</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!travado && ordem.length > 0 && (
          <div style={{ ...card, marginTop: 4 }}>
            <p style={rotulo}>Recado pra social mídia</p>
            <textarea
              value={nota}
              rows={3}
              placeholder="Opcional. Ex.: consigo gravar só na quinta de manhã."
              onChange={(e) => setNota(e.target.value)}
              style={campo}
            />
            <button type="button"
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending}
              style={{
                marginTop: 14, width: "100%", background: accent, color: onAccent, border: "none",
                borderRadius: 999, padding: "14px 20px", fontSize: 16, fontWeight: 800, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              <Check style={{ width: 18, height: 18 }} />
              {finalizar.isPending ? "Enviando…" : "Finalizar revisão"}
            </button>
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#8B8272", textAlign: "center", lineHeight: 1.5 }}>
              Depois de finalizar, a social mídia recebe um aviso e confere os seus ajustes.
            </p>
          </div>
        )}

        <AssinaturaCria variante="rodape" style={{ marginTop: 22, justifyContent: "center" }} />
      </div>
    </div>
  );
}
