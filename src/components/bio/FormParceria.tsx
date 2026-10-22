import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/sanitize";
import { mascaraTelefone, txt, bool, type DadosBloco } from "@/lib/bioBlocks";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PROPOSTA DE PARCERIA (22/10/2026)

   Formulário público do bloco "parceria". Vai pela edge bio-track (que enxerga
   o IP e freia robô) e de lá pra RPC submit_bio_contato, que confere que o
   bloco é desta página antes de gravar. O dono recebe no sino, no push, por
   e-mail e, com a chave ligada, como card no funil.
   ═══════════════════════════════════════════════════════════════════════════ */

export const LIMITE_MENSAGEM = 1200;

export type EnvioParceria = {
  nome: string; empresa: string; email: string; telefone: string; mensagem: string;
};

/** Confere o preenchimento. Devolve a frase de erro ou null. Exportada pro teste. */
export function erroDaParceria(v: EnvioParceria, consentiu: boolean): string | null {
  const tel = v.telefone.replace(/\D/g, "");
  const mail = v.email.trim();
  if (!v.nome.trim()) return "Coloque seu nome.";
  if (!mail && !tel) return "Informe um e-mail ou um WhatsApp pra resposta.";
  if (mail && !isValidEmail(mail)) return "Esse e-mail parece incompleto. Confira.";
  if (tel && (tel.length < 10 || tel.length > 13)) return "WhatsApp incompleto. Inclua o DDD.";
  if (!v.mensagem.trim()) return "Conte em poucas linhas o que você precisa.";
  if (v.mensagem.length > LIMITE_MENSAGEM) return `A mensagem passou de ${LIMITE_MENSAGEM} caracteres.`;
  if (!consentiu) return "Marque o aviso de consentimento pra continuar.";
  return null;
}

export function FormParceria({ slug, daAgencia, blocoId, d, buttonColor, buttonTextColor, radius, cardColor, cardTextColor }: {
  slug: string; daAgencia?: boolean; blocoId: string; d: DadosBloco;
  buttonColor: string; buttonTextColor: string; radius: string; cardColor?: string; cardTextColor?: string;
}) {
  const [v, setV] = useState<EnvioParceria>({ nome: "", empresa: "", email: "", telefone: "", mensagem: "" });
  const [consentiu, setConsentiu] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  // Trava síncrona contra toque duplo (o disabled só vale depois do render).
  const travado = useRef(false);
  const pedirEmpresa = bool(d, "pedirEmpresa");
  const mudar = (k: keyof EnvioParceria, valor: string) => { setV((x) => ({ ...x, [k]: valor })); setErr(null); };

  const enviar = async () => {
    const e = erroDaParceria(v, consentiu);
    if (e) { setErr(e); return; }
    if (travado.current) return;
    travado.current = true;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("bio-track", {
        body: {
          type: "contato", tipo: "parceria", slug, daAgencia: !!daAgencia, blockId: blocoId,
          name: v.nome.trim(), empresa: pedirEmpresa ? v.empresa.trim() : "",
          email: v.email.trim(), phone: v.telefone.trim(), mensagem: v.mensagem.trim(),
        },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; erro?: string } | null;
      if (!r?.ok) {
        setErr(r?.erro === "muitas_tentativas"
          ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
          : "Não foi possível enviar. Tente novamente.");
        return;
      }
      setFeito(true);
    } catch {
      setErr("Não foi possível enviar. Tente novamente.");
    } finally {
      travado.current = false;
      setEnviando(false);
    }
  };

  const cartao = cn("w-full rounded-2xl shadow-md p-6", cardColor ? "" : "bg-white/95");
  const estiloCartao = cardColor ? { backgroundColor: cardColor, color: cardTextColor || undefined } : undefined;
  const campo = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white text-gray-900";

  if (feito) {
    return (
      <div className={cn(cartao, "text-center")} style={estiloCartao} role="status">
        <p className="font-display font-bold">Proposta enviada!</p>
        <p className="text-sm mt-1 opacity-80">Recebi aqui e respondo pelo contato que você deixou.</p>
      </div>
    );
  }

  return (
    <div className={cartao} style={estiloCartao}>
      <h2 className="font-display font-bold text-center">{txt(d, "titulo", "Vamos trabalhar juntos?")}</h2>
      {txt(d, "subtitulo") && <p className="text-sm text-center mt-1 mb-4 opacity-80">{txt(d, "subtitulo")}</p>}
      <div className="space-y-3">
        <input aria-label="Seu nome" value={v.nome} onChange={(e) => mudar("nome", e.target.value)} placeholder="Seu nome" maxLength={120} className={campo} />
        {pedirEmpresa && (
          <input aria-label="Marca ou empresa" value={v.empresa} onChange={(e) => mudar("empresa", e.target.value)} placeholder="Marca ou empresa" maxLength={120} className={campo} />
        )}
        <input aria-label="Seu e-mail" type="email" value={v.email} onChange={(e) => mudar("email", e.target.value)} placeholder="E-mail" maxLength={160} className={campo} />
        <input aria-label="Seu WhatsApp" type="tel" inputMode="tel" value={v.telefone}
          onChange={(e) => mudar("telefone", mascaraTelefone(e.target.value))} placeholder="WhatsApp com DDD" className={campo} />
        <textarea aria-label="O que você precisa" rows={4} value={v.mensagem} maxLength={LIMITE_MENSAGEM}
          onChange={(e) => mudar("mensagem", e.target.value)} placeholder="O que você tem em mente? Prazo, formato, valor..." className={cn(campo, "resize-none")} />
        <label className="flex items-start gap-2.5 py-1.5 cursor-pointer text-[11.5px] leading-snug opacity-80">
          <input type="checkbox" checked={consentiu} onChange={(e) => { setConsentiu(e.target.checked); setErr(null); }}
            className="mt-[1px] h-4 w-4 shrink-0 accent-current" />
          <span>{txt(d, "consentimento")}</span>
        </label>
        <button type="button" onClick={enviar} disabled={enviando}
          className={cn("w-full min-h-[48px] font-body font-semibold py-3 shadow-md disabled:opacity-50 transition", radius)}
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
          {enviando ? "Enviando..." : txt(d, "botao", "Enviar proposta")}
        </button>
        {err && <p role="alert" aria-live="polite" className="text-xs text-red-600 text-center">{err}</p>}
      </div>
    </div>
  );
}

/** Desenho do formulário pra prévia do editor: parece o de verdade, mas não
 *  envia nada. Usar o formulário real ali gravaria proposta de teste no funil. */
export function FormularioDePrevia({ kind, d, buttonColor, buttonTextColor, radius }: {
  kind: string; d: DadosBloco; buttonColor: string; buttonTextColor: string; radius: string;
}) {
  const parceria = kind === "parceria";
  const campos = parceria
    ? ["Seu nome", ...(bool(d, "pedirEmpresa") ? ["Marca ou empresa"] : []), "E-mail", "WhatsApp com DDD"]
    : ["Seu nome", ...(txt(d, "campos", "ambos") !== "telefone" ? ["Seu email"] : []), ...(txt(d, "campos", "ambos") !== "email" ? ["(00) 00000-0000"] : [])];
  return (
    <div aria-hidden className="w-full rounded-2xl shadow-md p-5 bg-white text-gray-900">
      <p className="font-display font-bold text-center text-sm">{txt(d, "titulo", parceria ? "Vamos trabalhar juntos?" : "Deixe seu contato")}</p>
      {txt(d, "subtitulo") && <p className="text-xs text-center mt-1 mb-3 text-gray-600">{txt(d, "subtitulo")}</p>}
      <div className="space-y-2">
        {campos.map((c) => <div key={c} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-400">{c}</div>)}
        {parceria && <div className="rounded-lg border border-gray-200 px-3 py-2 h-14 text-xs text-gray-400">O que você tem em mente?</div>}
        <div className={cn("py-2.5 text-center text-xs font-semibold", radius)} style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
          {txt(d, "botao", parceria ? "Enviar proposta" : "Enviar")}
        </div>
      </div>
    </div>
  );
}
