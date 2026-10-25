/* ═══════════════════════════════════════════════════════════════════════════
   PROMPTER QUE SEGUE A FALA, PELA NUVEM (25/10/2026)

   O reconhecimento de fala do navegador toma o microfone no iPhone e o vídeo
   sai mudo. Aqui o caminho é outro: o player já tem o microfone aberto (o
   mesmo que vai pro gravador) e um AudioContext (o do medidor de volume).
   Deste AudioContext a gente tira o áudio em PCM 16 kHz e manda por WebSocket
   pro Deepgram, que devolve as palavras em ~300 ms. O player casa as palavras
   com o roteiro (matchAdvance) e o texto vai até onde a pessoa está.

   A gravação NÃO passa por aqui: o MediaRecorder continua com a trilha crua.
   Isto é um ramo paralelo do mesmo microfone, igual ao medidor.

   Token: vem da edge function prompter-voz (vale 60 s para ABRIR a conexão).
   Pausou, fecha a conexão (não paga silêncio); voltou, abre de novo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const TAXA_ALVO = 16000;

/** Float32 na taxa do AudioContext (44,1k/48k) → Int16 a 16 kHz, por média. */
export function paraPcm16(entrada: Float32Array, taxaEntrada: number): Int16Array {
  const razao = taxaEntrada / TAXA_ALVO;
  const n = Math.floor(entrada.length / razao);
  const saida = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const ini = Math.floor(i * razao), fim = Math.min(entrada.length, Math.floor((i + 1) * razao));
    let soma = 0;
    for (let j = ini; j < fim; j++) soma += entrada[j];
    const v = Math.max(-1, Math.min(1, soma / Math.max(1, fim - ini)));
    saida[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return saida;
}

export function urlDeepgram(): string {
  const q = new URLSearchParams({
    model: "nova-3",
    language: "pt-BR",
    encoding: "linear16",
    sample_rate: String(TAXA_ALVO),
    channels: "1",
    interim_results: "true",
    punctuate: "false",
    smart_format: "false",
    endpointing: "300",
  });
  return "wss://api.deepgram.com/v1/listen?" + q.toString();
}

/** Palavras de uma mensagem "Results" do Deepgram (vazio se não for). */
export function palavrasDaMensagem(msg: any): { palavras: string[]; final: boolean } | null {
  if (!msg || msg.type !== "Results") return null;
  const alt = msg.channel?.alternatives?.[0];
  if (!alt) return null;
  const lista: string[] = Array.isArray(alt.words) && alt.words.length
    ? alt.words.map((w: any) => String(w.punctuated_word || w.word || ""))
    : String(alt.transcript || "").split(/\s+/);
  return { palavras: lista.filter(Boolean), final: msg.is_final === true };
}

type Opcoes = {
  ctx: AudioContext;
  fonte: AudioNode;
  token: string;
  /** cauda das últimas palavras ouvidas (finais + provisórias), já na ordem */
  aoOuvir: (cauda: string[]) => void;
  /** a conexão caiu ou não abriu: o player volta pro modo por volume */
  aoFalhar: (motivo: string) => void;
  /** só pra teste: servidor falso no lugar do Deepgram */
  url?: string;
};

/* Worklet inline (Blob URL): junta ~100 ms de áudio e manda pro thread principal. */
const WORKLET = `
class CriaTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      this.buf.push(new Float32Array(ch)); this.n += ch.length;
      if (this.n >= sampleRate / 10) {
        const out = new Float32Array(this.n); let o = 0;
        for (const b of this.buf) { out.set(b, o); o += b.length; }
        this.port.postMessage(out, [out.buffer]); this.buf = []; this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("cria-tap", CriaTap);`;

export class SeguidorNuvem {
  private ws: WebSocket | null = null;
  private no: AudioNode | null = null;
  private mudo: GainNode | null = null;
  private finais: string[] = [];
  private parado = false;
  private abriu = false;
  private vigia: ReturnType<typeof setTimeout> | null = null;
  private keep: ReturnType<typeof setInterval> | null = null;

  constructor(private o: Opcoes) {}

  async iniciar() {
    const { ctx, fonte, token } = this.o;
    /* protocolo "bearer" = token temporário (JWT) do /auth/grant */
    this.ws = new WebSocket(this.o.url ?? urlDeepgram(), ["bearer", token]);
    this.ws.binaryType = "arraybuffer";
    this.vigia = setTimeout(() => { if (!this.abriu) this.falhar("nao_abriu"); }, 5000);
    this.ws.onopen = () => {
      this.abriu = true;
      if (this.vigia) clearTimeout(this.vigia);
      /* sem áudio por 10 s o Deepgram fecha; o KeepAlive segura nas pausas curtas */
      this.keep = setInterval(() => { try { this.ws?.send(JSON.stringify({ type: "KeepAlive" })); } catch { /* ok */ } }, 8000);
    };
    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
      const r = palavrasDaMensagem(msg);
      if (!r || !r.palavras.length) return;
      if (r.final) { this.finais.push(...r.palavras); if (this.finais.length > 40) this.finais = this.finais.slice(-40); }
      const cauda = (r.final ? this.finais : [...this.finais, ...r.palavras]).slice(-8);
      this.o.aoOuvir(cauda);
    };
    this.ws.onerror = () => { if (!this.parado) this.falhar("erro"); };
    this.ws.onclose = (ev) => { if (!this.parado) this.falhar("fechou_" + ev.code); };

    const enviar = (f: Float32Array) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const pcm = paraPcm16(f, ctx.sampleRate);
      try { this.ws.send(pcm.buffer); } catch { /* ok */ }
    };
    /* saída muda: o nó precisa estar ligado ao destino pra processar, mas sem
       som no alto-falante */
    this.mudo = ctx.createGain(); this.mudo.gain.value = 0; this.mudo.connect(ctx.destination);
    try {
      if (!(ctx as any).audioWorklet) throw new Error("sem worklet");
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const no = new AudioWorkletNode(ctx, "cria-tap");
      no.port.onmessage = (e) => enviar(e.data as Float32Array);
      fonte.connect(no); no.connect(this.mudo); this.no = no;
    } catch {
      /* Safari antigo: ScriptProcessor (obsoleto, mas presente em todo lugar) */
      const sp = ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => enviar(new Float32Array(e.inputBuffer.getChannelData(0)));
      fonte.connect(sp); sp.connect(this.mudo); this.no = sp;
    }
  }

  /** esquece o que foi ouvido (voltou pro começo, pulou de cena) */
  limparMemoria() { this.finais = []; }

  parar() {
    this.parado = true;
    if (this.vigia) clearTimeout(this.vigia);
    if (this.keep) clearInterval(this.keep);
    try { this.o.fonte.disconnect(this.no!); } catch { /* ok */ }
    try { this.no?.disconnect(); } catch { /* ok */ }
    try { this.mudo?.disconnect(); } catch { /* ok */ }
    this.no = null; this.mudo = null;
    const ws = this.ws; this.ws = null;
    if (ws) {
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" })); } catch { /* ok */ }
      setTimeout(() => { try { ws.close(); } catch { /* ok */ } }, 300);
    }
  }

  private falhar(motivo: string) {
    if (this.parado) return;
    this.parar();
    this.o.aoFalhar(motivo);
  }
}
