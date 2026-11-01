import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ditadoNativoConfiavel, erroDeServico, gravacaoDisponivel, passarPraNuvem, relogio, useGravadorNuvem,
} from "@/lib/falaNaNuvem";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

type SRWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/**
 * Botão de ditar por voz. No Chrome/Edge de computador usa o reconhecimento
 * do navegador; no celular e nos outros navegadores grava o áudio e transcreve
 * pela nuvem (src/lib/falaNaNuvem.ts). Erro agora aparece em vez de sumir.
 */
export function VoiceInput({
  onTranscript,
  lang = "pt-BR",
  className,
  title = "Falar e transcrever",
}: {
  onTranscript: (text: string) => void;
  lang?: string;
  className?: string;
  title?: string;
}) {
  const [listening, setListening] = useState(false);
  const [nativo, setNativo] = useState(false);
  const [disponivel, setDisponivel] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const nuvem = useGravadorNuvem({ onTexto: onTranscript, onErro: (m) => toast.error(m) });

  useEffect(() => {
    setNativo(ditadoNativoConfiavel());
    setDisponivel(ditadoNativoConfiavel() || gravacaoDisponivel());
    return () => { try { recRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const toggleNativo = () => {
    const w = window as SRWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recRef.current?.stop(); setListening(false); return; }

    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e?.error === "not-allowed") toast.error("O microfone está bloqueado. Libera nas permissões do navegador.");
      else if (erroDeServico(e?.error)) {
        passarPraNuvem(); setNativo(false);
        toast("O ditado deste navegador falhou. Toca de novo: agora vai gravar e transcrever pela nuvem.");
      }
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  if (!disponivel) return null;

  const ativo = nativo ? listening : nuvem.gravando;
  const rotulo = nuvem.transcrevendo ? "Transcrevendo..." : ativo ? `Parar (${relogio(nuvem.segundos)})` : title;

  return (
    <button
      type="button"
      onClick={nativo ? toggleNativo : nuvem.gravando ? nuvem.parar : nuvem.iniciar}
      disabled={nuvem.transcrevendo}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
        ativo
          ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
          : "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40",
        className,
      )}
    >
      {nuvem.transcrevendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" strokeWidth={1.75} />}
    </button>
  );
}
