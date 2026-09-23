import { useMemo, useState } from "react";
import { Camera, Check, Clock, Copy, FileText, Loader2, MapPin, Play, Send, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cenasDe, cenasParaTexto, type CaptureScript } from "@/hooks/useCaptureScripts";
import { normalizeShotList, type Capture, type ShotItem } from "@/hooks/useAgenda";

/* ═══════════════════════════════════════════════════════════════════════════
   O DIA DE GRAVAÇÃO

   O Cria Captação era organizado por CLIENTE: pasta do cliente, roteiros do
   cliente, tomadas do cliente. Só que ninguém grava por cliente. Grava por DIA:
   sai de casa às 8h, passa em três clientes, volta com dezoito vídeos. Pra
   montar esse dia, a social mídia tinha que abrir três pastas, copiar três
   roteiros, conferir três listas de tomada e juntar tudo de cabeça.

   Esta tela é o dia inteiro num lugar só, na ordem em que ele acontece:

   1. O PLACAR, porque a primeira pergunta em pé na rua é "quanto falta".
   2. AS TOMADAS, porque é o que não pode esquecer de apontar a câmera pra
      gravar. Fica no topo por isso, não por hierarquia visual.
   3. OS ROTEIROS, por cliente e na ordem de gravação, cada um com o botão de
      teleprompter do lado. É o que ela lê enquanto grava.

   REGRA QUE VALE MAIS QUE O LAYOUT: tudo aqui é de UM TOQUE. Quem está
   segurando uma câmera com uma mão não abre acordeão, não rola até achar, não
   confirma diálogo. Marcar tomada, marcar roteiro gravado e abrir teleprompter
   são um toque cada, com alvo grande.
   ═══════════════════════════════════════════════════════════════════════════ */

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function dataPorExtenso(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, (m ?? 1) - 1, d ?? 1);
  return { dia: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`, semana: WD[dt.getDay()] };
}

export type DiaDeGravacaoProps = {
  data: string;
  caps: Capture[];
  scripts: CaptureScript[];
  /** Nome de exibição do cliente de uma captação (vem da página). */
  nomeDe: (c: Capture) => string;
  cidadeDe: (c: Capture) => string;
  /** WhatsApp do cliente (do CRM), pra avisar "estou chegando" da rota. */
  whatsappDe?: (c: Capture) => string | null;
  aoFechar: () => void;
  aoMarcarTomada: (captureId: string, lista: ShotItem[]) => void;
  aoMarcarGravado: (s: CaptureScript) => void;
  aoConcluirCaptacao: (c: Capture) => void;
  aoTeleprompter: (titulo: string, texto: string) => void;
  /* VIRAR POST OS QUE JÁ GRAVOU (Walter, 21/09/2026: "ter uma opção em virar
     post tudo que eu marcar como check"). Recebe os roteiros marcados como
     gravados e ainda sem post; a página cria um reels por roteiro no kanban do
     cliente, com o roteiro no campo de roteiro. Null quando nenhum cliente do
     dia tem Cria Post ativo. */
  aoVirarPosts?: ((roteiros: CaptureScript[]) => Promise<void>) | null;
  virandoPosts?: boolean;
};

export function DiaDeGravacao({
  data, caps, scripts, nomeDe, cidadeDe, whatsappDe, aoFechar,
  aoMarcarTomada, aoMarcarGravado, aoConcluirCaptacao, aoTeleprompter,
  aoVirarPosts, virandoPosts,
}: DiaDeGravacaoProps) {
  const { dia, semana } = dataPorExtenso(data);
  const [copiado, setCopiado] = useState(false);

  // Os roteiros do dia, agrupados pelo dia de gravação a que pertencem.
  const porCaptura = useMemo(() => {
    const m = new Map<string, CaptureScript[]>();
    for (const s of scripts) {
      if (!s.capture_id) continue;
      m.set(s.capture_id, [...(m.get(s.capture_id) ?? []), s]);
    }
    return m;
  }, [scripts]);

  const todosRoteiros = caps.flatMap((c) => porCaptura.get(c.id) ?? []);
  const gravados = todosRoteiros.filter((s) => s.done).length;
  /* Os que já foram gravados e ainda não viraram post. `source_post_id` é o
     carimbo de "já virou": sem ele o mesmo roteiro viraria dois posts a cada
     clique. */
  const prontosPraPost = todosRoteiros.filter((s) => s.done && !s.source_post_id);
  const locais = [...new Set(caps.map((c) => (c.location ?? "").trim()).filter(Boolean))];
  const clientes = [...new Set(caps.map((c) => nomeDe(c)))];

  const textoDoDia = () => {
    const blocos = caps.map((c) => {
      const lista = porCaptura.get(c.id) ?? [];
      const cabeca = `${nomeDe(c).toUpperCase()}${c.capture_time ? ` (${c.capture_time.slice(0, 5)})` : ""}`;
      const corpo = lista.map((s) => {
        const texto = cenasDe(s).length > 0 ? cenasParaTexto(cenasDe(s)) : (s.content ?? "").trim();
        return `${(s.title ?? "").trim() || "Roteiro"}\n${texto}`;
      }).join("\n\n");
      return `${cabeca}\n${corpo || "(sem roteiro escrito)"}`;
    });
    return `DIA DE GRAVAÇÃO · ${dia} (${semana})${locais.length ? `\nLocal: ${locais.join(", ")}` : ""}\n\n${blocos.join("\n\n-----\n\n")}`;
  };

  const copiarTudo = async () => {
    try {
      await navigator.clipboard.writeText(textoDoDia());
      setCopiado(true);
      toast.success("Dia copiado. Cole onde quiser levar.");
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] p-0 sm:p-0 gap-0 rounded-3xl border-0 overflow-hidden h-[92vh] flex flex-col bg-card [&>button:last-child]:hidden">

        {/* ── 1. O PLACAR ────────────────────────────────────────────────── */}
        <div className="relative shrink-0 px-5 py-4 text-white bg-gradient-to-br from-[#EA4918] to-[#EA4918]/80">
          <button type="button" onClick={aoFechar} aria-label="Fechar"
            className="absolute right-3 top-3 h-9 w-9 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
            <X className="h-4 w-4" />
          </button>
          <DialogTitle className="block font-display font-extrabold text-white text-[20px] leading-tight pr-12">
            Dia de gravação · {dia}
          </DialogTitle>
          <p className="text-[12.5px] font-body text-white/85 mt-0.5 capitalize">{semana}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-[12.5px] font-body">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-bold">
              <Camera className="h-3.5 w-3.5" /> {gravados} de {todosRoteiros.length} gravados
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </span>
            {locais.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{locais.join(", ")}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pb-24 sm:pb-5 space-y-5">

          {/* ── 1b. A ROTA (Captação v4, ciclo 3) ─────────────────────────
              O dia de gravação foi desenhado como se ela estivesse no notebook.
              Ela está no carro. A primeira coisa que precisa é a ORDEM das
              paradas com hora e endereço, e um toque pra abrir o Waze. O
              endereço é texto livre ("Bruder Bistrô"), então a busca vai com
              a cidade junto pra não cair num homônimo em outro estado. O
              WhatsApp vem do CRM: "estou chegando" é a mensagem mais mandada
              do dia, e antes ela saía do app pra procurar o contato. */}
          {caps.length > 0 && (
            <section>
              <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">
                A rota de hoje
              </p>
              <ol className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {caps.map((c, i) => {
                  const local = (c.location ?? "").trim();
                  const cidade = cidadeDe(c);
                  const busca = encodeURIComponent([local, cidade].filter(Boolean).join(", "));
                  const zap = (whatsappDe?.(c) ?? "").replace(/\D/g, "");
                  const concluida = c.status === "concluida";
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-display font-extrabold",
                        concluida ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]" : "bg-primary/10 text-primary")}>
                        {concluida ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[13.5px] font-display font-bold text-foreground truncate", concluida && "line-through text-muted-foreground")}>
                          {c.capture_time && <span className="tabular-nums mr-1.5">{c.capture_time.slice(0, 5)}</span>}{nomeDe(c)}
                        </p>
                        <p className="text-[11.5px] font-body text-muted-foreground truncate">
                          {local || "sem local"}{cidade ? ` · ${cidade}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {local && (
                          <a href={`https://waze.com/ul?q=${busca}&navigate=yes`} target="_blank" rel="noopener noreferrer"
                            className="h-9 px-2.5 grid place-items-center rounded-xl border border-border text-[11px] font-body font-bold text-foreground hover:border-primary/40"
                            aria-label="Abrir no Waze" title="Abrir no Waze">Waze</a>
                        )}
                        {local && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${busca}`} target="_blank" rel="noopener noreferrer"
                            className="h-9 w-9 grid place-items-center rounded-xl border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            aria-label="Abrir no Google Maps" title="Google Maps"><MapPin className="h-4 w-4" /></a>
                        )}
                        {zap && (
                          <a href={`https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent("Oi! Estou a caminho pra nossa gravação de hoje.")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="h-9 w-9 grid place-items-center rounded-xl border border-[hsl(var(--cria-verde)/0.4)] text-[hsl(var(--cria-verde))] hover:bg-[hsl(var(--cria-verde)/0.08)]"
                            aria-label="Avisar no WhatsApp que está chegando" title="Avisar que está chegando"><MessageCircle className="h-4 w-4" /></a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* ── 2. AS TOMADAS, no topo, porque é o que se esquece ────────── */}
          {caps.some((c) => normalizeShotList(c.shot_list).length > 0) && (
            <section>
              <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Não esqueça de gravar
              </p>
              <div className="space-y-2.5">
                {caps.map((c) => {
                  /* normalizeShotList: `shot_list` é jsonb livre, e item sem
                     `id` quebraria a chave do React e o toggle por id. */
                  const lista = normalizeShotList(c.shot_list);
                  if (lista.length === 0) return null;
                  const feitas = lista.filter((s) => s.feito).length;
                  return (
                    <div key={c.id} className="rounded-2xl border border-border bg-card p-3">
                      <p className="flex items-center gap-2 text-[12.5px] font-display font-bold text-foreground mb-2">
                        {nomeDe(c)}
                        <span className="text-[11px] font-body font-normal text-muted-foreground">
                          {feitas}/{lista.length}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lista.map((item) => (
                          /* Alvo grande e um toque: quem está com a câmera na
                             mão não acerta checkbox de 16px. */
                          <button key={item.id} type="button"
                            onClick={() => aoMarcarTomada(c.id, lista.map((x) => x.id === item.id ? { ...x, feito: !x.feito } : x))}
                            className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-body transition-colors min-h-[40px]",
                              item.feito
                                ? "border-[hsl(var(--cria-verde))] bg-[hsl(var(--cria-verde)/0.1)] text-[hsl(var(--cria-verde))] font-semibold"
                                : "border-border bg-background text-foreground hover:border-primary/40")}>
                            {item.feito && <Check className="h-3.5 w-3.5 shrink-0" />}
                            {item.texto}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 3. OS ROTEIROS, cliente por cliente, na ordem do dia ─────── */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                O que gravar, na ordem
              </p>
              <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={copiarTudo}>
                {copiado ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar o dia</>}
              </Button>
            </div>

            {/* GRAVOU, VIRA POST. O caminho antigo era um roteiro por vez,
                dentro da pasta do cliente: quem grava oito num dia abria oito
                vezes. Aqui sai tudo que está com o check, de uma vez, cada um
                como reels no kanban do seu cliente. */}
            {aoVirarPosts && prontosPraPost.length > 0 && (
              <div className="mb-3 rounded-2xl border border-[hsl(var(--cria-verde)/0.35)] bg-[hsl(var(--cria-verde)/0.07)] p-3 flex items-center gap-3 flex-wrap">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--cria-verde)/0.15)] text-[hsl(var(--cria-verde))]">
                  <Send className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-display font-bold text-foreground">
                    {prontosPraPost.length} {prontosPraPost.length === 1 ? "roteiro gravado" : "roteiros gravados"} pra virar post
                  </p>
                  <p className="text-[11.5px] font-body text-muted-foreground leading-snug">
                    Cada um vira um reels em Produção, no kanban do cliente, já com o roteiro dentro.
                  </p>
                </div>
                <Button size="sm" className="rounded-xl shrink-0" disabled={virandoPosts}
                  onClick={() => { void aoVirarPosts(prontosPraPost); }}>
                  {virandoPosts
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Criando...</>
                    : <><Send className="h-3.5 w-3.5 mr-1.5" /> Virar post</>}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {caps.map((c) => {
                const lista = porCaptura.get(c.id) ?? [];
                const concluida = c.status === "concluida";
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border bg-muted/30">
                      <span className="font-display font-bold text-[14px] text-foreground min-w-0 truncate">{nomeDe(c)}</span>
                      {c.capture_time && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" /> {c.capture_time.slice(0, 5)}
                        </span>
                      )}
                      {cidadeDe(c) && (
                        <span className="text-[11px] font-body text-muted-foreground truncate hidden sm:inline">{cidadeDe(c)}</span>
                      )}
                      <button type="button" onClick={() => aoConcluirCaptacao(c)}
                        className={cn("ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-body font-bold transition-colors",
                          concluida
                            ? "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
                            : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                        {concluida ? <><Check className="h-3 w-3" /> Feito</> : "Marcar feito"}
                      </button>
                    </div>

                    {lista.length === 0 ? (
                      <p className="px-3.5 py-3 text-[12.5px] font-body text-muted-foreground">
                        Sem roteiro escrito. Dá pra gravar mesmo assim, mas as tomadas acima são o que te guia.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {lista.map((s, i) => {
                          const texto = cenasDe(s).length > 0 ? cenasParaTexto(cenasDe(s)) : (s.content ?? "").trim();
                          return (
                            <li key={s.id} className="flex items-start gap-2.5 px-3.5 py-3">
                              {/* Um toque marca gravado. É o gesto mais repetido
                                  do dia, então é o alvo maior da linha. */}
                              <button type="button" onClick={() => aoMarcarGravado(s)}
                                aria-label={s.done ? "Desmarcar gravado" : "Marcar como gravado"}
                                className={cn("mt-0.5 h-9 w-9 shrink-0 grid place-items-center rounded-xl border transition-colors",
                                  s.done
                                    ? "border-[hsl(var(--cria-verde))] bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]"
                                    : "border-border text-muted-foreground hover:border-primary/50")}>
                                {s.done ? <Check className="h-4 w-4" /> : <span className="text-[12px] font-display font-bold">{i + 1}</span>}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-[13.5px] font-body font-semibold text-foreground",
                                  s.done && "line-through text-muted-foreground")}>
                                  {(s.title ?? "").trim() || `Roteiro ${i + 1}`}
                                </p>
                                {s.about?.trim() && (
                                  <p className="text-[12px] font-body text-muted-foreground mt-0.5 line-clamp-2">{s.about}</p>
                                )}
                                {s.format?.trim() && (
                                  <span className="inline-block mt-1 text-[10px] font-body font-bold uppercase tracking-wide text-muted-foreground">
                                    {s.format}
                                  </span>
                                )}
                              </div>
                              {texto && (
                                <Button size="sm" variant="outline" className="rounded-xl h-9 shrink-0"
                                  onClick={() => aoTeleprompter((s.title ?? "").trim() || nomeDe(c), texto)}
                                  title="Entregue o celular pro cliente ler enquanto você grava na câmera.">
                                  <Play className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Teleprompter</span>
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {todosRoteiros.length === 0 && caps.length > 0 && (
            <p className="text-[12.5px] font-body text-muted-foreground rounded-2xl border border-dashed border-border p-4 text-center">
              Nenhum roteiro escrito pra este dia ainda. Escreva na agenda do mês ou na pasta do cliente,
              e eles aparecem aqui na ordem.
            </p>
          )}
        </div>

        {/* ── BARRA DO CELULAR (ciclo 3) ──────────────────────────────────
            No celular a rolagem é longa e o placar do topo some no primeiro
            scroll. A barra fixa mantém "quantos faltam" e o próximo roteiro
            não gravado sempre à vista, com o teleprompter a um toque. */}
        {todosRoteiros.length > 0 && (() => {
          const proximo = todosRoteiros.find((s) => !s.done) ?? null;
          const texto = proximo ? (cenasDe(proximo).length > 0 ? cenasParaTexto(cenasDe(proximo)) : (proximo.content ?? "").trim()) : "";
          return (
            <div className="sm:hidden absolute inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
                  {gravados} de {todosRoteiros.length} gravados
                </p>
                <p className="text-[13px] font-body font-semibold text-foreground truncate">
                  {proximo ? `Próximo: ${(proximo.title ?? "").trim() || "Roteiro"}` : "Tudo gravado. Bora virar post."}
                </p>
              </div>
              {proximo && texto && (
                <Button size="sm" className="rounded-xl h-10 shrink-0" onClick={() => aoTeleprompter((proximo.title ?? "").trim() || "Roteiro", texto)}>
                  <Play className="h-4 w-4 mr-1.5" /> Ler
                </Button>
              )}
            </div>
          );
        })()}

        {/* Rodapé fixo: o dia inteiro em texto, pra quem prefere levar no bloco
            de notas ou mandar pro cliente antes de sair. */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-[11.5px] font-body text-muted-foreground min-w-0 flex-1">
            Tudo o que está aqui cabe num texto só, pra levar offline.
          </p>
          <Button size="sm" className="rounded-xl shrink-0" onClick={copiarTudo}>
            {copiado ? "Copiado" : "Copiar o dia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
