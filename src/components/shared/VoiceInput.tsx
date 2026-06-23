import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SRWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/**
 * Botão de ditar por voz (transcrição local do navegador, custo zero).
 * Usa a Web Speech API. Se o navegador não suportar, o botão não aparece.
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
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as SRWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => { try { recRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const toggle = () => {
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
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      aria-pressed={listening}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
        listening
          ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
          : "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40",
        className,
      )}
    >
      <Mic className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
