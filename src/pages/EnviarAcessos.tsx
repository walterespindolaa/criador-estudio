import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { LogosCabecalho } from "@/components/publico/CabecalhoPublico";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { cofreLinkInfo, cofreEnviarPorLink, cofreErro } from "@/hooks/useCofre";

/* ═══════════════════════════════════════════════════════════════════════════
   /acessos/:token, O CLIENTE MANDA OS ACESSOS (Walter, 14/10/2026)

   A social mídia gera o link na ficha (aba Acessos). O cliente abre no
   celular, escolhe a conta, digita login e senha e envia. A senha vai direto
   pro banco, onde é cifrada; esta página não guarda nada no aparelho.
   Link vale 7 dias. Mesmo visual do cadastro público (cor da agência).
   ═══════════════════════════════════════════════════════════════════════════ */

const FALLBACK = "#0061EE";
const PLATAFORMAS = ["Instagram", "Facebook / Meta", "Google", "TikTok", "YouTube", "Site", "Outro"];
const CODIGOS = ["SMS", "WhatsApp", "E-mail", "App autenticador", "Não pede"];

function isDark(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

export default function EnviarAcessos() {
  const { token } = useParams<{ token: string }>();
  useForceLightTheme();

  const info = useQuery({
    queryKey: ["cofre-link", token],
    enabled: !!token,
    retry: false,
    queryFn: () => cofreLinkInfo(token!),
  });

  const [plataforma, setPlataforma] = useState("Instagram");
  const [outra, setOutra] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<string[]>([]);
  const [acabou, setAcabou] = useState(false);

  const d = info.data;
  const accent = d?.cor || FALLBACK;
  const onAccent = isDark(accent) ? "#ffffff" : "#1A1626";
  const nomePlataforma = plataforma === "Outro" ? outra.trim() : plataforma;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!nomePlataforma) { setErro("Diga de qual conta é esse acesso."); return; }
    if (!login.trim() && !senha) { setErro("Preencha pelo menos o login ou a senha."); return; }
    setErro(null); setEnviando(true);
    try {
      await cofreEnviarPorLink(token, { plataforma: nomePlataforma, login, senha, codigoVia: codigo, observacao: obs });
      setEnviados((v) => [...v, nomePlataforma]);
      // Limpa tudo: a senha não fica na tela nem na memória do formulário.
      setLogin(""); setSenha(""); setObs(""); setCodigo(""); setVerSenha(false); setOutra("");
      setAcabou(true);
    } catch (err) {
      setErro(cofreErro(err, "Enviar"));
    } finally {
      setEnviando(false);
    }
  };

  const chip = (ativo: boolean) => ({
    minHeight: 40, padding: "0 14px", borderRadius: 999, cursor: "pointer",
    border: ativo ? `1.5px solid ${accent}` : "1px solid #D6CFC2",
    background: ativo ? accent : "#FFFDF9", color: ativo ? onAccent : "#1B1A18",
    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
  });
  const campo = { minHeight: 46, borderRadius: 12, border: "1px solid #D6CFC2", background: "#fff", padding: "0 14px", fontSize: 15, width: "100%", boxSizing: "border-box" as const, fontFamily: "inherit" };
  const rotulo = { fontSize: 13, fontWeight: 700, color: "#2A2440", display: "block", marginBottom: 6 };

  if (info.isLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F5F2EC" }}><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (info.isError || !d) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F5F2EC", padding: 24, textAlign: "center", fontFamily: "'Figtree', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 360 }}>
          <Lock className="h-8 w-8 mx-auto mb-3" style={{ color: "#6E675A" }} />
          <p style={{ fontWeight: 800, fontSize: 18, margin: 0, color: "#1B1A18" }}>Este link não está mais valendo</p>
          <p style={{ fontSize: 14, color: "#5A564E", marginTop: 8 }}>
            {info.isError ? cofreErro(info.error, "Abrir o link") : "Ele venceu ou foi desativado. Peça um novo pra sua social mídia."}
          </p>
          <AssinaturaCria variante="rodape" style={{ marginTop: 26, justifyContent: "center" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F2EC", fontFamily: "'Figtree', system-ui, sans-serif", color: "#1B1A18" }}>
      <div style={{ background: accent, padding: "30px 20px 30px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <span aria-hidden style={{ position: "absolute", top: -52, right: -40, width: 168, height: 168, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
          <LogosCabecalho agencia={{ src: d.agencia_logo ?? undefined, nome: d.agencia_nome ?? undefined }} fundo={accent} style={{ marginBottom: 16 }} />
          <h1 style={{ margin: 0, color: onAccent, fontSize: "clamp(1.3rem, 5vw, 1.6rem)", lineHeight: 1.2, fontFamily: "'Baloo 2', system-ui, sans-serif", fontWeight: 800 }}>
            Mande os acessos de {d.cliente_nome}
          </h1>
          <p style={{ margin: "8px 0 0", color: onAccent, opacity: .88, fontSize: 14, lineHeight: 1.5 }}>
            Eles vão criptografados direto pra conta de {d.agencia_nome || "sua social mídia"}. Ninguém mais vê.
          </p>
        </div>
      </div>

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "20px 20px 32px" }}>
        {acabou ? (
          <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#1E7A3C", color: "#fff", display: "grid", placeItems: "center" }}><Check className="h-7 w-7" strokeWidth={3} /></div>
            <p style={{ fontFamily: "'Baloo 2', system-ui, sans-serif", fontWeight: 800, fontSize: 22, margin: 0 }}>{enviados[enviados.length - 1]} enviado</p>
            <p style={{ fontSize: 14, color: "#3D3A34", margin: 0, lineHeight: 1.5 }}>Sua social mídia já recebeu. A senha não fica salva neste aparelho.</p>
            {enviados.length > 1 && <p style={{ fontSize: 13, color: "#5A564E", margin: 0 }}>Já enviados: {enviados.join(", ")}</p>}
            <button type="button" onClick={() => setAcabou(false)} style={{ ...chip(false), minHeight: 48, padding: "0 20px", borderRadius: 14 }}>Mandar outro acesso</button>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ ...rotulo, padding: 0 }}>Qual conta?</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATAFORMAS.map((p) => (
                  <button key={p} type="button" aria-pressed={plataforma === p} onClick={() => setPlataforma(p)} style={chip(plataforma === p)}>{p}</button>
                ))}
              </div>
              {plataforma === "Outro" && (
                <input aria-label="Nome da conta" value={outra} onChange={(e) => setOutra(e.target.value)} maxLength={60} placeholder="Ex.: Pinterest, Hotmart, site da loja" style={{ ...campo, marginTop: 10 }} />
              )}
            </fieldset>

            <div>
              <label htmlFor="ac-login" style={rotulo}>Login (e-mail, usuário ou @)</label>
              <input id="ac-login" value={login} onChange={(e) => setLogin(e.target.value)} maxLength={200} autoComplete="off" autoCapitalize="none" style={campo} />
            </div>

            <div>
              <label htmlFor="ac-senha" style={rotulo}>Senha</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="ac-senha" type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={500} autoComplete="new-password" style={{ ...campo, flex: 1, minWidth: 0 }} />
                <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Esconder senha" : "Ver senha"}
                  style={{ width: 46, minHeight: 46, borderRadius: 12, border: "1px solid #D6CFC2", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ ...rotulo, padding: 0 }}>Quando pede código de verificação, ele chega por onde?</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CODIGOS.map((c) => (
                  <button key={c} type="button" aria-pressed={codigo === c} onClick={() => setCodigo(codigo === c ? "" : c)} style={chip(codigo === c)}>{c}</button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="ac-obs" style={rotulo}>Algum recado? (opcional)</label>
              <textarea id="ac-obs" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} rows={2}
                placeholder="Ex.: o código chega no meu celular, me chama no WhatsApp quando precisar."
                style={{ ...campo, minHeight: 70, padding: "10px 14px", resize: "vertical" }} />
            </div>

            {erro && <p role="alert" style={{ margin: 0, fontSize: 13.5, color: "#A12C1F", fontWeight: 600 }}>{erro}</p>}

            <button type="submit" disabled={enviando}
              style={{ minHeight: 52, borderRadius: 16, border: 0, background: accent, color: onAccent, fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", opacity: enviando ? .7 : 1 }}>
              {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />} Enviar com segurança
            </button>
            <p style={{ margin: 0, fontSize: 12, color: "#6E675A", textAlign: "center", lineHeight: 1.5 }}>
              Dá pra mandar quantos acessos quiser, um de cada vez. Este link vence em {new Date(d.expira_em).toLocaleDateString("pt-BR")}.
            </p>
          </form>
        )}
        <AssinaturaCria variante="rodape" style={{ marginTop: 26, justifyContent: "center" }} />
      </main>
    </div>
  );
}
