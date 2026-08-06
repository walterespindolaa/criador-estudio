import { useState } from "react";
import { Hash, Copy, Check, ChevronLeft, ChevronRight, ArrowLeftRight, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import {
  useClientHashtags, useSetClientHashtags,
  parseHashtags, mesclarHashtags, blocoParaColar,
  LIMITE_HASHTAGS_POST, LIMITE_HASHTAGS_BANCO,
} from "@/hooks/useClientHashtags";

// ============================================================
// BANCO DE HASHTAGS DO CLIENTE
//
// O que a social mídia faz aqui, na ordem real de uso:
//   1) cola o bloco inteiro de uma vez ("#hof #balneariocamboriu #skincare")
//   2) vai somando e tirando ao longo dos meses
//   3) CLICA EM "COPIAR TODAS" e cola na legenda do Instagram  ← é o pedido
//
// Por isso "Copiar todas" fica no cabeçalho, sempre visível, e é o único botão
// com peso visual. Todo o resto (adicionar, remover, reordenar) é secundário.
//
// A ordem importa: a pessoa monta o bloco na ordem em que quer colar. Reordenar
// entra como MODO (setinhas ‹ ›), não como arrastar: arrastar chip em layout que
// quebra linha é ruim de mirar no celular, exigiria montar contexto de
// drag-and-drop e daria trabalho pra ganhar pouco. Setinha resolve, funciona no
// dedo e no teclado, e custa duas linhas.
//
// Mobile-first: chip com 36px de altura e "x" com 28px de área própria, que é
// o mínimo pra não errar o alvo no celular.
// ============================================================

// Copia com fallback: no PWA em iOS o navigator.clipboard nem sempre está lá.
// Mesmo caminho que a "Copiar legenda" do Cria Post já usa.
async function copiarTexto(texto: string): Promise<boolean> {
  const valor = texto ?? "";
  if (!valor.trim()) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // cai no fallback abaixo
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = valor;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, valor.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ClientHashtags({ clientId, className }: { clientId: string; className?: string }) {
  const { data: tags = [], isLoading } = useClientHashtags(clientId);
  const salvar = useSetClientHashtags(clientId);

  const [entrada, setEntrada] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ordenando, setOrdenando] = useState(false);

  const total = tags.length;
  const passouDoPost = total > LIMITE_HASHTAGS_POST;

  const adicionar = () => {
    const novas = parseHashtags(entrada);
    if (novas.length === 0) {
      if (entrada.trim()) toast.error("Não consegui ler nenhuma hashtag válida nesse texto.");
      return;
    }
    const { lista, repetidas } = mesclarHashtags(tags, novas);
    const entraram = lista.length - tags.length;
    if (entraram === 0) {
      toast.info(repetidas === 1 ? "Essa hashtag já está na lista." : "Todas essas já estavam na lista.");
      setEntrada("");
      return;
    }
    if (lista.length > LIMITE_HASHTAGS_BANCO) {
      toast.error(`O banco de hashtags deste cliente vai até ${LIMITE_HASHTAGS_BANCO}. Remova algumas antes de adicionar mais.`);
      return;
    }
    salvar.mutate(lista);
    setEntrada("");
    // Só avisa de repetida quando teve mistura: colou 10, entraram 7.
    if (repetidas > 0) toast.success(`${entraram} adicionada(s). ${repetidas} já estava(m) na lista.`);
  };

  const remover = (tag: string) => salvar.mutate(tags.filter((t) => t !== tag));

  const mover = (i: number, direcao: -1 | 1) => {
    const j = i + direcao;
    if (j < 0 || j >= tags.length) return;
    const lista = [...tags];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    salvar.mutate(lista);
  };

  const copiarTodas = async () => {
    const ok = await copiarTexto(blocoParaColar(tags));
    if (!ok) { toast.error("Não consegui copiar. Selecione o bloco e copie na mão."); return; }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
    toast.success(`${total} hashtag(s) copiada(s). É só colar na legenda.`);
  };

  const limpar = async () => {
    if (await confirmar({ titulo: "Apagar todas as hashtags deste cliente?", descricao: "Some a lista inteira. Não dá pra desfazer." })) {
      salvar.mutate([]);
    }
  };

  return (
    // data-tour="cli-hashtags": alvo do passo "O banco de hashtags dele" no tour do cockpit.
    <div data-tour="cli-hashtags" className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      {/* CABEÇALHO: título + o botão que é o motivo desta tela existir */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-display font-bold text-foreground">Hashtags</p>
          {total > 0 && (
            <span className="text-[10px] font-body font-bold rounded-full bg-primary/10 text-primary px-1.5 py-0.5 leading-none">{total}</span>
          )}
        </div>
        <Button
          size="sm"
          onClick={copiarTodas}
          disabled={total === 0}
          className="h-9 gap-1.5"
        >
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado!" : "Copiar todas"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground font-body mt-1.5">
        O bloco de hashtags deste cliente. Copia tudo de uma vez e cola na legenda.
      </p>

      {/* CHIPS */}
      {isLoading ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-9 w-28 rounded-full bg-muted animate-pulse" />)}
        </div>
      ) : total === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4">
          <p className="text-xs font-body text-muted-foreground">
            Nenhuma ainda. Cole o bloco inteiro no campo abaixo, do jeito que você já usa:
          </p>
          <p className="text-[11.5px] font-body text-foreground/70 mt-1 break-words">
            #hof #balneariocamboriu #harmonizacaofacial #esteticaregenerativa #skincare
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t, i) => (
            <span
              key={t}
              className="h-9 pl-3 pr-1 rounded-full border border-border bg-muted/40 text-foreground inline-flex items-center gap-0.5 text-[13px] font-body font-medium max-w-full"
            >
              <span className="truncate">{t}</span>
              {ordenando ? (
                <>
                  {/* Setinhas: mover uma casa pra esquerda / direita. Área de
                      toque de 28px, igual ao "x". */}
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                    className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-25 shrink-0"
                    aria-label={`Mover ${t} pra esquerda`}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === tags.length - 1}
                    className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-25 shrink-0"
                    aria-label={`Mover ${t} pra direita`}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => remover(t)}
                  className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  aria-label={`Remover ${t}`}>
                  <span className="text-base leading-none">×</span>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* AVISO DAS 30: avisa e NÃO bloqueia. O banco do cliente pode ser maior
          do que cabe numa legenda: a pessoa escolhe quais vão em cada post. */}
      {passouDoPost && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11.5px] font-body text-amber-700 dark:text-amber-400 leading-snug">
            São {total} hashtags e o Instagram só considera {LIMITE_HASHTAGS_POST} por post.
            Pode manter o banco maior, mas escolha até {LIMITE_HASHTAGS_POST} pra cada legenda.
          </p>
        </div>
      )}

      {/* ADICIONAR: aceita uma ou o bloco inteiro colado de uma vez */}
      <div className="flex items-center gap-2 mt-3">
        <Input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          placeholder="Cole ou digite as hashtags…"
          enterKeyHint="done"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-10 rounded-xl text-sm"
        />
        <Button variant="outline" onClick={adicionar} disabled={!entrada.trim()} className="h-10 px-3 shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground font-body mt-1.5 leading-snug">
        Pode colar várias de uma vez, separadas por espaço, vírgula ou linha. Entram sem acento, sem espaço e em minúsculas, do jeito que o Instagram aceita, e repetida não entra duas vezes.
      </p>

      {/* AÇÕES SECUNDÁRIAS */}
      {total > 1 && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <button type="button" onClick={() => setOrdenando((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11.5px] font-body font-medium transition-colors",
              ordenando ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {ordenando ? "Concluir ordenação" : "Reordenar"}
          </button>
          <button type="button" onClick={limpar}
            className="inline-flex items-center h-8 px-2.5 rounded-lg text-[11.5px] font-body font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

export default ClientHashtags;
