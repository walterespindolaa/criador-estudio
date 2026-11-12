import { useEffect, useRef, useState } from "react";
import { Folder } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";
import { VoiceInput } from "@/components/shared/VoiceInput";
import { toast } from "sonner";
import { sugerirIdeiaFalada, type SugestaoIdeiaFalada } from "@/lib/ai/claude";
import { BlocoDeNotas, BotaoFolha, CampoDaFolha, Etiqueta, LINHA, MAO, ehSalvar } from "@/components/folha/BlocoDeNotas";

/* ═══════════════════════════════════════════════════════════════════════════
   NOVA IDEIA COMO FOLHA DO CADERNO (Walter, 07/11/2026, mockup aprovado)

   Uma janela só pro botão "Nova ideia" (Início e topo do app) e pro
   Nova/Editar ideia da aba Ideias. Título na primeira linha; Enter desce pros
   tópicos; Enter num tópico cria o próximo; Ctrl/Cmd+Enter guarda.
   Pilar e pasta são etiquetas na pauta, nada obrigatório.
   Os tópicos viram a lista da folha (o mesmo HTML que a folha da aba Ideias usa).
   ═══════════════════════════════════════════════════════════════════════════ */

export type ItemCor = { id: string; name: string; color: string };

export type DadosDaFolha = {
  titulo: string;
  /** HTML da lista de tópicos (<ul><li>). null quando não tem tópico ou ao editar. */
  notas: string | null;
  pilarId: string | null;
  pastaId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Editando uma ideia que já existe: as anotações moram na folha, aqui não mexe nelas. */
  editando?: boolean;
  inicial?: { titulo?: string; pilarId?: string | null; pastaId?: string | null };
  pilares: ItemCor[];
  pastas: ItemCor[];
  totalIdeias?: number;
  onVerTodas?: () => void;
  salvando?: boolean;
  /** Devolve true quando deu certo (a janela fecha). `abrir` = abrir a folha completa depois. */
  onGuardar: (dados: DadosDaFolha, opcoes: { abrir: boolean }) => Promise<boolean>;
};

const LIMITE_TITULO = 300;
const LIMITE_NOTAS = 2000;

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function topicosEmHtml(topicos: string[]): string | null {
  const limpos = topicos.map((t) => sanitizeText(t)).filter(Boolean);
  if (!limpos.length) return null;
  let html = "<ul>";
  for (const t of limpos) {
    const li = `<li>${escapar(t)}</li>`;
    if (html.length + li.length + 5 > LIMITE_NOTAS) break;
    html += li;
  }
  return html + "</ul>";
}

export function NovaIdeiaFolha(props: Props) {
  // IDEIA POR VOZ (Walter, 11/11/2026; mockup aprovado). A pessoa toca em
  // "Falar", diz a ideia do jeito que vier e o texto cai no título. O `n` muda
  // a cada fala pra mesma frase dita duas vezes entrar duas vezes.
  const [fala, setFala] = useState<{ texto: string; n: number } | null>(null);
  useEffect(() => { if (!props.open) setFala(null); }, [props.open]);
  return (
    <BlocoDeNotas
      acao={props.editando ? undefined : <VoiceInput comRotulo title="Falar a ideia" onTranscript={(t) => setFala({ texto: t, n: Date.now() })} />}
      open={props.open}
      onOpenChange={props.onOpenChange}
      icone="💡"
      rotulo={props.editando ? "Editar ideia" : "Nova ideia"}
      tituloAcessivel={props.editando ? "Editar ideia" : "Nova ideia"}
    >
      {props.open && <Conteudo {...props} fala={fala} />}
    </BlocoDeNotas>
  );
}

function Conteudo({ editando, inicial, pilares, pastas, totalIdeias, onVerTodas, salvando, onGuardar, fala }: Props & { fala: { texto: string; n: number } | null }) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  // O que foi falado entra no fim do título, respeitando o limite.
  useEffect(() => {
    if (!fala?.texto) return;
    setTitulo((t) => `${t ? `${t.trimEnd()} ` : ""}${fala.texto}`.replace(/\n/g, " ").slice(0, LIMITE_TITULO));
  }, [fala]);
  // SUGESTÃO DA CRIA IA. Só aparece depois que a pessoa falou, e só roda quando
  // ela pede (cada pedido conta na cota de IA do mês). "Usar" aplica o pilar e
  // anota formato e pergunta como tópicos; nada é guardado sem ela mandar.
  const [sugestao, setSugestao] = useState<SugestaoIdeiaFalada | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const pedirSugestao = async () => {
    const texto = sanitizeText(titulo).slice(0, 600);
    if (!texto || pedindo) return;
    setPedindo(true);
    try {
      const r = await sugerirIdeiaFalada(texto, pilares.map((p) => p.name));
      if (r && (r.formato || r.pergunta || r.pilar)) setSugestao(r);
      else toast("A Cria IA não achou o que sugerir pra essa ideia.");
    } catch (e) {
      toast.error(e instanceof Error && e.message && !/non-2xx|AI Operation/i.test(e.message) ? e.message : "Não consegui pedir a sugestão agora. Tenta de novo?");
    } finally { setPedindo(false); }
  };
  const usarSugestao = () => {
    if (!sugestao) return;
    const pilar = pilares.find((p) => p.name.trim().toLowerCase() === sugestao.pilar?.trim().toLowerCase());
    if (pilar) setPilarId(pilar.id);
    const novos = [sugestao.formato ? `Formato: ${sugestao.formato}` : "", sugestao.pergunta ?? ""].filter(Boolean);
    setTopicos((l) => [...l.filter((x) => x.trim()), ...novos, ""]);
    setSugestao(null);
  };
  const [topicos, setTopicos] = useState<string[]>([""]);
  const [pilarId, setPilarId] = useState<string | null>(inicial?.pilarId ?? null);
  const [pastaId, setPastaId] = useState<string | null>(inicial?.pastaId ?? null);
  const [enviando, setEnviando] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const tituloRef = useRef<HTMLTextAreaElement | null>(null);
  const ocupado = salvando || enviando;
  const pronto = !!titulo.trim() && !ocupado;

  const guardar = async (abrir: boolean) => {
    const limpo = sanitizeText(titulo).slice(0, LIMITE_TITULO);
    if (!limpo || ocupado) return;
    setEnviando(true);
    try {
      await onGuardar({ titulo: limpo, notas: editando ? null : topicosEmHtml(topicos), pilarId, pastaId }, { abrir });
    } finally {
      setEnviando(false);
    }
  };

  const focar = (i: number) => requestAnimationFrame(() => refs.current[i]?.focus());

  // O título cresce conforme a frase (ideia colada do ChatGPT é frase inteira).
  const crescer = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(LINHA * 2, Math.ceil(el.scrollHeight / LINHA) * LINHA)}px`;
  };

  return (
    <>
      <textarea
        ref={(el) => { tituloRef.current = el; crescer(el); }}
        value={titulo}
        maxLength={LIMITE_TITULO}
        rows={2}
        placeholder="O que você está pensando?"
        aria-label="Título da ideia"
        onChange={(e) => { setTitulo(e.target.value.replace(/\n/g, " ")); crescer(e.target); }}
        onKeyDown={(e) => {
          if (ehSalvar(e)) { e.preventDefault(); void guardar(false); return; }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (editando) { void guardar(false); return; }
            focar(0);
          }
        }}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-display text-[22px] font-extrabold leading-[32px] text-[#1D1B18] outline-none placeholder:text-[#bcb19c] sm:text-[25px]"
      />

      {editando ? (
        <p className="font-body text-[14px] leading-[32px] text-[#7A7268]">As anotações ficam na folha. Use "Abrir a folha completa" pra escrever.</p>
      ) : (
        topicos.map((t, i) => (
          <div key={i} className="flex items-center" style={{ height: LINHA }}>
            <span className="mr-2 font-extrabold text-primary">•</span>
            <input
              ref={(el) => { refs.current[i] = el; }}
              value={t}
              aria-label={`Tópico ${i + 1}`}
              placeholder={i === 0 ? "anota um tópico, se quiser (Enter pula linha)" : i === topicos.length - 1 ? "mais um tópico" : ""}
              onChange={(e) => setTopicos((l) => l.map((x, k) => (k === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (ehSalvar(e)) { e.preventDefault(); void guardar(false); return; }
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  setTopicos((l) => [...l.slice(0, i + 1), "", ...l.slice(i + 1)]);
                  focar(i + 1);
                } else if (e.key === "Backspace" && !t && topicos.length > 1) {
                  e.preventDefault();
                  setTopicos((l) => l.filter((_, k) => k !== i));
                  if (i > 0) focar(i - 1); else tituloRef.current?.focus();
                } else if (e.key === "ArrowUp" && i === 0) {
                  tituloRef.current?.focus();
                }
              }}
              className="h-full w-full min-w-0 border-0 bg-transparent p-0 font-body text-[15px] text-[#1D1B18] outline-none placeholder:text-[#bcb19c]"
            />
          </div>
        ))
      )}

      {!editando && !!fala && !sugestao && !!titulo.trim() && (
        <div className="flex items-center" style={{ minHeight: LINHA }}>
          <button type="button" onClick={pedirSugestao} disabled={pedindo}
            className="inline-flex h-[26px] items-center rounded-full border-2 border-dashed border-[#0061EE] bg-[#EEF4FF] px-3 font-body text-[12.5px] font-bold text-[#0061EE] disabled:opacity-60">
            {pedindo ? "A Cria IA está pensando..." : "Pedir sugestão da Cria IA"}
          </button>
        </div>
      )}
      {!editando && sugestao && (
        <div className="my-1.5 rounded-[14px] border-2 border-dashed border-[#0061EE] bg-[#EEF4FF] px-3 py-2">
          <p className="text-[21px] leading-none text-[#0061EE]" style={MAO}>Cria IA sugere</p>
          <p className="mt-1.5 font-body text-[13.5px] font-medium leading-snug text-[#1D1B18]">
            {[sugestao.formato, sugestao.pilar ? `pilar ${sugestao.pilar}` : "", sugestao.pergunta].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1.5 flex justify-end gap-2">
            <button type="button" onClick={() => setSugestao(null)} className="h-[26px] rounded-full px-3 font-body text-[12px] font-bold text-[#7A7268]">Dispensar</button>
            <button type="button" onClick={usarSugestao} className="h-[26px] rounded-full border-2 border-[#1D1B18] bg-white px-3 font-body text-[12px] font-bold text-[#1D1B18]">Usar</button>
          </div>
        </div>
      )}

      {pilares.length > 0 && (
        <CampoDaFolha rotulo="pilar">
          {pilares.map((p) => (
            <Etiqueta key={p.id} ativa={pilarId === p.id} cor={`${p.color}55`} onClick={() => setPilarId(pilarId === p.id ? null : p.id)}>
              {p.name}
            </Etiqueta>
          ))}
        </CampoDaFolha>
      )}
      {pastas.length > 0 && (
        <CampoDaFolha rotulo="pasta">
          {pastas.map((f) => (
            <Etiqueta key={f.id} ativa={pastaId === f.id} cor={`${f.color}40`} onClick={() => setPastaId(pastaId === f.id ? null : f.id)}>
              <Folder className="h-3 w-3" style={{ color: f.color }} /> {f.name}
            </Etiqueta>
          ))}
        </CampoDaFolha>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {onVerTodas && (
          <button type="button" onClick={onVerTodas} className="font-body text-[13px] font-bold text-primary underline underline-offset-2">
            {totalIdeias != null ? `Ver minhas ${totalIdeias} ideias` : "Ver minhas ideias"}
          </button>
        )}
        <div className="ml-auto flex flex-1 flex-wrap justify-end gap-2.5 sm:flex-none">
          <BotaoFolha tipo="branco" type="button" disabled={!pronto} onClick={() => void guardar(true)} className="hidden sm:inline-flex">
            Abrir a folha completa
          </BotaoFolha>
          <BotaoFolha type="button" disabled={!pronto} onClick={() => void guardar(false)} className="flex-1 sm:flex-none">
            {ocupado ? "Guardando..." : editando ? "Salvar" : <><span className="sm:hidden">Guardar</span><span className="hidden sm:inline">Guardar no caderno</span></>}
          </BotaoFolha>
        </div>
      </div>
      <p className="mt-1.5 hidden text-[22px] leading-none text-[#7A7268] sm:block" style={MAO}>anota agora, organiza depois ✎</p>
    </>
  );
}
