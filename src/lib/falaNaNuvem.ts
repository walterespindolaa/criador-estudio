import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   DITADO QUE FUNCIONA EM QUALQUER APARELHO (01/11/2026)

   O ditado usava só o reconhecimento de fala do navegador. No Chrome/Edge do
   computador ele é ótimo (texto ao vivo, custo zero). No celular ele depende
   do serviço de voz do sistema (Google no Android, Ditado/Siri no iPhone) e,
   quando esse serviço está desligado ou sem idioma, não acontece nada: foi o
   que o Walter viu no Android e no iPhone. Em navegador de computador que não
   é Chrome/Edge (Brave, Arc, Safari sem Ditado) é igual.

   Regra: Chrome ou Edge de COMPUTADOR usa o do navegador. Todo o resto grava
   o áudio aqui (MediaRecorder, existe em todos) e a edge transcrever-fala
   devolve o texto. Se o do navegador der erro de serviço, a sessão passa pra
   nuvem e a próxima tentativa já vai por ela.
   ═══════════════════════════════════════════════════════════════════════════ */

let forcarNuvem = false;
/** Erros do reconhecimento do navegador que significam "aqui ele não funciona". */
export function erroDeServico(codigo?: string) {
  return codigo === "network" || codigo === "service-not-allowed" || codigo === "language-not-supported" || codigo === "audio-capture";
}
export function passarPraNuvem() { forcarNuvem = true; }

export function ditadoNativoConfiavel(): boolean {
  if (forcarNuvem || typeof window === "undefined") return false;
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  if (!(w.SpeechRecognition || w.webkitSpeechRecognition)) return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  const marcas = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands?.map((b) => b.brand) ?? [];
  return marcas.includes("Google Chrome") || marcas.includes("Microsoft Edge");
}

export function gravacaoDisponivel(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function tipoDeAudio(): string {
  const opcoes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  for (const t of opcoes) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* noop */ } }
  return "";
}

async function transcrever(audio: Blob): Promise<string> {
  const tipo = (audio.type || "audio/webm").split(";")[0];
  const { data, error } = await supabase.functions.invoke("transcrever-fala", {
    body: audio, headers: { "Content-Type": tipo },
  });
  if (error) {
    let msg = "Não consegui transcrever agora. Tenta de novo ou digita.";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.message) msg = j.message;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return String((data as { texto?: string } | null)?.texto ?? "").trim();
}

/** Grava pelo microfone e devolve o texto pela nuvem. */
export function useGravadorNuvem({ onTexto, onErro, maxSegundos = 180 }: {
  onTexto: (t: string) => void; onErro: (msg: string) => void; maxSegundos?: number;
}) {
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const relogioRef = useRef<number | null>(null);
  const cancelarRef = useRef(false);
  const cbRef = useRef({ onTexto, onErro });
  cbRef.current = { onTexto, onErro };

  const soltar = () => {
    if (relogioRef.current) window.clearInterval(relogioRef.current);
    relogioRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => { cancelarRef.current = true; try { recRef.current?.stop(); } catch { /* noop */ } soltar(); }, []);

  const parar = useCallback(() => {
    try { if (recRef.current?.state === "recording") recRef.current.stop(); } catch { /* noop */ }
  }, []);

  const iniciar = useCallback(async () => {
    if (gravando || transcrevendo) return;
    if (!gravacaoDisponivel()) { cbRef.current.onErro("Este navegador não grava áudio. Pode digitar aqui mesmo."); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nome = (e as { name?: string })?.name;
      cbRef.current.onErro(nome === "NotAllowedError"
        ? "O microfone está bloqueado. Libera nas permissões do navegador ou digita aqui mesmo."
        : "Não consegui abrir o microfone. Pode digitar aqui mesmo.");
      return;
    }
    streamRef.current = stream;
    const tipo = tipoDeAudio();
    const rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream);
    const pedacos: Blob[] = [];
    cancelarRef.current = false;
    rec.ondataavailable = (ev) => { if (ev.data?.size) pedacos.push(ev.data); };
    rec.onstop = async () => {
      soltar();
      setGravando(false);
      if (cancelarRef.current) return;
      const audio = new Blob(pedacos, { type: rec.mimeType || tipo || "audio/webm" });
      setTranscrevendo(true);
      try {
        const texto = await transcrever(audio);
        if (texto) cbRef.current.onTexto(texto);
        else cbRef.current.onErro("Não ouvi nada. Chega o celular mais perto e tenta de novo.");
      } catch (e) {
        cbRef.current.onErro((e as Error).message);
      } finally {
        setTranscrevendo(false);
      }
    };
    recRef.current = rec;
    rec.start(1000);
    setSegundos(0);
    setGravando(true);
    const t0 = Date.now();
    relogioRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSegundos(s);
      if (s >= maxSegundos) parar();
    }, 500);
  }, [gravando, transcrevendo, maxSegundos, parar]);

  return { gravando, transcrevendo, segundos, iniciar, parar };
}

export const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
