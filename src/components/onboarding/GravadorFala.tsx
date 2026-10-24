import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { COR } from "./Pecas";

/* ═══════════════════════════════════════════════════════════════════════════
   GRAVADOR DA FALA LIVRE (onboarding, 24/10/2026)

   A pessoa aperta UMA vez e fala à vontade sobre ela. O navegador transcreve
   ao vivo (Web Speech API: custo zero, nada de áudio sai do aparelho) e o texto
   vai aparecendo no campo, que continua editável. Quem não pode ou não quer
   falar, digita no mesmo campo.

   O reconhecimento do navegador desliga sozinho depois de uns segundos de
   silêncio. Enquanto a pessoa não apertar "parar", ele religa e continua
   emendando, pra ser de fato uma gravação só.
   ═══════════════════════════════════════════════════════════════════════════ */

type Resultado = { isFinal: boolean; 0: { transcript: string } };
type Reconhecedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Resultado> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
type JanelaComVoz = Window & {
  SpeechRecognition?: new () => Reconhecedor;
  webkitSpeechRecognition?: new () => Reconhecedor;
};

export const MAX_FALA = 3000;

export function GravadorFala({ valor, onChange, cor }: { valor: string; onChange: (v: string) => void; cor: string }) {
  const [suportado, setSuportado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<Reconhecedor | null>(null);
  const querGravarRef = useRef(false);
  const valorRef = useRef(valor);
  valorRef.current = valor;

  useEffect(() => {
    const w = window as JanelaComVoz;
    setSuportado(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      querGravarRef.current = false;
      try { recRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  const emendar = (trecho: string) => {
    const t = trecho.trim();
    if (!t) return;
    const atual = valorRef.current.trim();
    const novo = `${atual ? `${atual} ` : ""}${t}`.slice(0, MAX_FALA);
    valorRef.current = novo; // vários trechos finais podem chegar no mesmo evento
    onChange(novo);
  };

  const ligar = () => {
    const w = window as JanelaComVoz;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    // No Chrome do Android o modo contínuo repete trechos já entregues. Lá
    // vai frase a frase e o onend religa; no resto, contínuo.
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.onresult = (e) => {
      let provisorio = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) emendar(r[0].transcript);
        else provisorio += r[0].transcript;
      }
      setParcial(provisorio);
    };
    rec.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        querGravarRef.current = false;
        setErro("O microfone está bloqueado. Libera nas permissões do navegador ou digita aqui mesmo.");
      }
    };
    rec.onend = () => {
      setParcial("");
      // Silêncio desliga o reconhecimento; se ela não mandou parar, religa.
      if (querGravarRef.current && valorRef.current.length < MAX_FALA) {
        try { rec.start(); return; } catch { /* cai pro parar */ }
      }
      querGravarRef.current = false;
      setGravando(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      querGravarRef.current = true;
      setErro(null);
      setGravando(true);
    } catch {
      setErro("Não consegui abrir o microfone. Pode digitar aqui mesmo.");
    }
  };

  const parar = () => {
    querGravarRef.current = false;
    try { recRef.current?.stop(); } catch { /* noop */ }
    setGravando(false);
  };

  const mostrado = parcial ? `${valor}${valor ? " " : ""}${parcial}` : valor;

  return (
    <div className="flex flex-col items-center">
      {suportado && (
        <>
          <button type="button" onClick={gravando ? parar : ligar} aria-pressed={gravando}
            aria-label={gravando ? "Parar de gravar" : "Gravar minha fala"}
            className="relative grid h-[92px] w-[92px] place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: gravando ? COR.laranja : COR.tinta }}>
            {gravando && (
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: COR.laranja }} />
            )}
            {gravando
              ? <Square className="relative h-8 w-8" style={{ color: COR.papel }} fill={COR.papel} />
              : <Mic className="relative h-9 w-9" style={{ color: COR.papel }} strokeWidth={2.2} />}
          </button>
          <p className="m-0 mt-2 font-display text-sm font-bold" aria-live="polite">
            {gravando ? "Gravando... aperta pra parar" : valor ? "Toca pra continuar falando" : "Toca e fala"}
          </p>
        </>
      )}
      {erro && <p className="m-0 mt-2 text-center text-[13px]" style={{ color: COR.laranja }}>{erro}</p>}

      <div className="mt-4 w-full rounded-[20px] border-2 px-3.5 py-3" style={{ background: COR.papel, borderColor: gravando ? cor : COR.borda }}>
        <label htmlFor="onb-fala" className="mb-1 block text-[11px] font-bold tracking-[1.4px]" style={{ color: "#4A463D" }}>
          {suportado ? "O QUE VOCÊ FALOU (DÁ PRA EDITAR)" : "ESCREVE AQUI"}
        </label>
        <textarea id="onb-fala" rows={6} maxLength={MAX_FALA} value={mostrado} readOnly={gravando}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_FALA))}
          placeholder="Ex.: Sou a Ju, tenho uma confeitaria em Itajaí faz 4 anos. Falo com mulheres que querem empreender na cozinha de casa..."
          className="w-full resize-none border-0 bg-transparent text-[15px] font-medium leading-snug outline-none placeholder:text-[#8A8577]" />
        <p className="m-0 text-right text-xs" style={{ color: COR.apagado }}>{valor.length} / {MAX_FALA}</p>
      </div>
    </div>
  );
}
