import { useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Instagram, Loader2, RefreshCw, RotateCcw, Send, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useChecarMidia, useConexaoDoPost, useDesfazerConferencia, usePublicacaoDoPost, useRepublicar,
  type ConexaoDoPost, type EstadoPublicacao, type ResultadoChecagem,
} from "@/hooks/usePublicarInstagram";
import { ConferenciaPublicacao } from "@/components/shared/ConferenciaPublicacao";
import { OpcoesInstagram } from "@/components/shared/OpcoesInstagram";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO INSTAGRAM (ciclo 5 do plano de publicar, 28/09/2026)

   Caixa única, usada no editor do criador e no editor do Cria Post. Só
   aparece quando a conta do post PODE publicar pelo Cria (hoje: testadores;
   depois da aprovação da Meta, quem reconectar) ou quando o post já tem
   histórico de publicação. Pra quem não pode, a tela fica igual.

   Lapidação mobile (28/09): um selo de estado no topo (a pessoa bate o olho
   e sabe onde está), um painel por estado com a informação que importa
   (quando sai, link, motivo do erro), toque de 44px no celular e textos de
   no mínimo 12px. A parte visual mora em PublicarNoInstagramView, sem
   dados, pra poder ser conferida em todos os estados.
   ═══════════════════════════════════════════════════════════════════════════ */

const FUSO = "America/Sao_Paulo";

function dataHoraBr(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

// Data/hora do post como está no editor (sem fuso: é o que a pessoa digitou).
function dataHoraDoPost(data: string | null, hora: string | null) {
  if (!data) return null;
  const [, m, d] = data.split("-");
  const h = /^\d{1,2}:\d{2}/.test(hora ?? "") ? (hora as string).slice(0, 5) : "09:00";
  return `${d}/${m} às ${h}`;
}

type Estado = "publicado" | "publicando" | "agendado" | "erro" | "pronto" | "aguardando" | "postado";

const SELO: Record<Estado, { txt: string; cls: string }> = {
  publicado: { txt: "Publicado", cls: "bg-green-100 text-green-800" },
  publicando: { txt: "Publicando", cls: "bg-violet-100 text-violet-800" },
  agendado: { txt: "Agendado", cls: "bg-sky-100 text-sky-800" },
  erro: { txt: "Não saiu", cls: "bg-amber-100 text-amber-900" },
  pronto: { txt: "Pronto pra sair", cls: "bg-muted text-muted-foreground" },
  aguardando: { txt: "Aguardando aprovação", cls: "bg-muted text-muted-foreground" },
  postado: { txt: "Já postado", cls: "bg-muted text-muted-foreground" },
};

export type PublicarNoInstagramViewProps = {
  est: EstadoPublicacao;
  cx: ConexaoDoPost | null;
  publicando?: boolean;
  alternando?: boolean;
  checando?: boolean;
  checagem?: ResultadoChecagem | null;
  erroChecagem?: string | null;
  /** Abre a conferência pra publicar já. */
  onPublicar: () => void;
  /** Ligar abre a conferência (sai no horário); desligar desfaz a conferência. */
  onAuto: (ligar: boolean) => void;
  onChecar: () => void;
  /** Cliente não aprovou: abre a conferência com motivo. */
  onSemAprovacao?: () => void;
  /** Abre as opções do Instagram (collab, marcação, alt, teste, música). */
  onOpcoes?: () => void;
  /** Post publicado e apagado no Instagram: volta pra "Pronto pra sair". */
  onRepublicar?: () => void;
  /* Compacto (editor no computador, Walter 19/10/2026): uma linha só com selo,
     automático, checar e publicar. O cartão cheio comia 1/3 do painel e
     empurrava a prévia pra fora da tela. Avisos de estado continuam aparecendo. */
  compacto?: boolean;
  /** Formato que está na tela agora (o editor pode ter trocado sem salvar). */
  formato?: string | null;
};

export function PublicarNoInstagramView({
  est, cx, publicando, alternando, checando, checagem, erroChecagem, onPublicar, onAuto, onChecar, onSemAprovacao, onOpcoes, onRepublicar, compacto, formato,
}: PublicarNoInstagramViewProps) {

  const status = est.publish_status;
  const estadoBase: Estado =
    status === "publicado" ? "publicado"
    : status === "publicando" || publicando ? "publicando"
    : status === "na_fila" && est.auto_publish ? "agendado"
    : status === "erro" ? "erro"
    : "pronto";

  // Cria Post: aprovado pelo cliente, ou liberado sem aprovação na conferência
  // (Walter, 28/10/2026). "postado" = já publicaram na mão; de novo duplicaria.
  const ehCliente = !!est.external_client_id;
  const aprovado = !ehCliente || est.approval_status === "aprovado" || !!est.publish_sem_aprovacao_motivo;
  const musicaCelular = !!est.ig_opcoes?.musica_celular || !!est.ig_opcoes?.pelo_celular;
  const ehStoryFmt = /^stor(y|ies)$/i.test(String(formato ?? est.format ?? ""));
  // Selo honesto: "Pronto pra sair" só quando dá pra sair mesmo.
  const estado: Estado = estadoBase !== "pronto" ? estadoBase
    : est.approval_status === "postado" ? "postado"
    : !aprovado ? "aguardando"
    : "pronto";
  /* STORIES LIBERADO (28/10/2026): o motor publica story (1 mídia, vídeo até
     60 s). Música do Instagram não sai pela API: esse post é pelo celular. */
  const podeAgir = aprovado && !musicaCelular && !!cx?.pode_publicar && estado !== "publicando";
  // Cliente ainda não aprovou: dá pra liberar com motivo, na conferência.
  const podeSemAprovacao = ehCliente && !aprovado && est.approval_status !== "postado" && !musicaCelular && !!cx?.pode_publicar && !!onSemAprovacao;
  // Desligar o automático sempre pode (ex.: card virou stories depois de agendado).
  const podeDesligar = estado === "agendado" && !alternando;
  const quandoPost = dataHoraDoPost(est.scheduled_date, est.scheduled_time);

  // O que impede, em uma frase (mostra só o primeiro motivo).
  const bloqueio =
    est.approval_status === "postado" ? "Este post já foi marcado como postado."
    : musicaCelular ? (est.ig_opcoes?.pelo_celular ? "Marcado pra postar pelo celular (story com figurinha)." : "Marcado pra postar pelo celular (música do Instagram).")
    : cx && !cx.pode_publicar ? (cx.motivo ?? "Esta conta não pode publicar pelo Cria.")
    : !aprovado ? "O cliente ainda não aprovou. Dá pra publicar mesmo assim, com motivo."
    : null;
  const qtdOpcoes = (est.ig_opcoes?.collaborators?.length ?? 0) + (est.ig_opcoes?.user_tags?.length ?? 0)
    + (est.ig_opcoes?.alt_text ? 1 : 0) + (est.ig_opcoes?.trial ? 1 : 0) + (musicaCelular ? 1 : 0);

  const selo = SELO[estado];

  /* AGENDAR É O PRINCIPAL, PUBLICAR AGORA É O SECUNDÁRIO (Walter, 29/10/2026).
     Antes o botão grande "Publicar" publicava NA HORA e o agendamento era um
     interruptor "Auto" do lado: um post marcado pra 03/11 saiu no dia 29.
     Agora a ação principal diz a data em que sai, e "Publicar agora" é um
     botão de contorno que ainda passa pela conferência com aviso vermelho. */
  const podeAgendar = podeAgir && !alternando && !!est.scheduled_date;
  const acoes = (
    <div className="flex flex-wrap gap-2">
      {estado === "agendado" ? (
        <Button type="button" variant="outline" onClick={() => onAuto(false)} disabled={!podeDesligar}
          className={cn("flex-1 min-w-[140px] rounded-xl text-xs font-bold", compacto ? "h-8" : "h-11 sm:h-9")}>
          {alternando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelar agendamento"}
        </Button>
      ) : (
        <Button type="button" onClick={() => onAuto(true)} disabled={!podeAgendar}
          title={quandoPost ? `Sai sozinho ${quandoPost}` : "Defina a data do post e salve pra agendar."}
          className={cn("flex-1 min-w-[160px] rounded-xl text-xs font-bold bg-sky-700 text-white hover:bg-sky-800", compacto ? "h-8" : "h-11 sm:h-9")}>
          <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
          {quandoPost ? `Agendar pra ${quandoPost.replace(" às ", " ")}` : "Agendar (defina a data)"}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onPublicar} disabled={!podeAgir}
        className={cn("rounded-xl text-xs font-bold", compacto ? "h-8 px-3" : "h-11 sm:h-9 px-4")}>
        {estado === "erro" ? <><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Tentar agora</> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Publicar agora</>}
      </Button>
    </div>
  );
  const tocar = "h-11 sm:h-9"; // 44px no celular, compacto no computador

  return (
    <section aria-label="Publicar no Instagram" data-tour="editor-instagram" className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Faixa de identidade: fina, pra não brigar com a data logo acima. */}
      <div className="h-1 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]" />

      <div className={cn(compacto ? "px-3 py-2 space-y-2" : "p-3 space-y-3")}>
        {compacto ? (
          /* DUAS LINHAS (Walter, 20/10/2026: "ali na parte do instagram ta
             bugado"). Numa linha só, com a janela do editor mais estreita, o
             cartão ficava com ~300px: o selo encavalava no "Auto" e o @ virava
             "em ...". Em cima: quem é, o estado e o botão principal. Embaixo:
             a conta, o automático e o checar. */
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
                <Instagram className="h-3.5 w-3.5 text-white" />
              </span>
              <p className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="text-xs font-display font-bold text-foreground shrink-0">Instagram</span>
                <span className={cn("min-w-0 truncate rounded-full px-1.5 py-px text-[10px] font-body font-bold leading-4", selo.cls)}>{selo.txt}</span>
              </p>
              {estado !== "publicado" && (
                <Button type="button" variant="outline" onClick={onChecar} disabled={checando}
                  title="Checar mídia" aria-label="Checar mídia" className="h-7 w-7 p-0 rounded-lg shrink-0">
                  {checando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
            <p className="text-[11px] font-body text-muted-foreground truncate" title={bloqueio ?? (cx?.username ? `@${cx.username}` : undefined)}>
              {estado !== "publicado" && bloqueio ? bloqueio
                : estado === "agendado" && est.publicar_em ? `Sai sozinho ${dataHoraBr(est.publicar_em)}${cx?.username ? ` · @${cx.username}` : ""}`
                : cx?.username ? `${estado === "publicado" ? "saiu em" : "em"} @${cx.username}` : ""}
            </p>
            {estado !== "publicado" && estado !== "publicando" && acoes}
          </div>
        ) : (<>
        {/* Cabeçalho: o que é, em que pé está e por onde sai. O selo fica
            na segunda linha (não ao lado do título): em tela de 320px o
            título quebrava em três linhas brigando com o selo. */}
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
            <Instagram className="h-[18px] w-[18px] text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-display font-bold text-foreground leading-tight">Publicar no Instagram</p>
            <div className="mt-1 flex items-center gap-1.5 min-w-0">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-body font-bold leading-4", selo.cls)}>{selo.txt}</span>
              <span className="text-xs font-body text-muted-foreground truncate">
                {cx?.username ? `${estado === "publicado" ? "saiu em" : "em"} @${cx.username}` : ""}
              </span>
            </div>
          </div>
        </div>
        </>)}

        {/* Painel do estado */}
        {estado === "publicado" && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2.5">
            <p className="text-[13px] font-body text-green-900 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <span>Saiu no Instagram{est.published_at ? ` ${dataHoraBr(est.published_at)}` : ""}.</span>
            </p>
            {est.publish_aviso && (
              <p className="text-xs font-body text-amber-900 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 flex gap-1.5" role="alert">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" /> {est.publish_aviso}
              </p>
            )}
            {est.ig_permalink && (
              <Button asChild variant="outline" className={cn("w-full rounded-xl border-green-300 bg-white text-green-800 hover:bg-green-50", tocar)}>
                <a href={est.ig_permalink} target="_blank" rel="noreferrer">
                  Ver no Instagram <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
            )}
            {onRepublicar && (
              <button type="button" onClick={onRepublicar}
                className="block text-xs font-body font-bold text-sky-800 underline underline-offset-2 hover:text-sky-950">
                Apagou no Instagram? Publicar ou agendar de novo
              </button>
            )}
          </div>
        )}

        {estado === "publicando" && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 flex items-start gap-2" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 text-violet-600 animate-spin shrink-0 mt-0.5" />
            <p className="text-[13px] font-body text-violet-900">
              Publicando. Foto sai em segundos; vídeo pode levar alguns minutos. Pode fechar o post, o Cria avisa no sino.
            </p>
          </div>
        )}

        {/* No compacto o "sai sozinho" já está na linha da conta; a caixa só
            aparece se a tentativa automática falhou. */}
        {estado === "agendado" && (!compacto || !!est.publish_error) && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-1">
            <p className="text-[13px] font-body text-sky-900 flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Conferido. Sai sozinho <b>{dataHoraBr(est.publicar_em)}</b> (horário de Brasília).</span>
            </p>
            {est.publish_sem_aprovacao_motivo && (
              <p className="text-xs font-body text-sky-800 pl-6">Liberado sem aprovação do cliente: {est.publish_sem_aprovacao_motivo}.</p>
            )}
            {est.publish_error && (
              <p className="text-xs font-body text-sky-800 pl-6">Tentando de novo. Última falha: {est.publish_error}</p>
            )}
          </div>
        )}

        {estado === "erro" && est.publish_error && (
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[13px] font-body text-amber-900">{est.publish_error}</p>
          </div>
        )}

        {estado !== "publicado" && (
          <>
            {bloqueio && !compacto && (
              <p className="text-xs font-body text-muted-foreground rounded-xl bg-muted/60 px-3 py-2">{bloqueio}</p>
            )}

            {!compacto && estado !== "publicando" && (<>
              {acoes}
              <Button type="button" variant="ghost" onClick={onChecar} disabled={checando} className="h-9 px-2.5 rounded-xl text-xs font-body text-muted-foreground hover:text-foreground">
                {checando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />} Checar mídia
              </Button>
                        </>)}

            {/* O que não sai pela API no story (Walter, 28/10/2026). */}
            {ehStoryFmt && !compacto && (
              <p className="text-[11.5px] font-body text-muted-foreground rounded-xl bg-muted/50 px-3 py-2 leading-relaxed">
                Pelo Cria o story sai só com a foto ou o vídeo. Figurinha (enquete, caixinha, quiz, link), música, filtro e efeito não passam pela API do Instagram:
                pra usar, baixe a mídia aqui no post e publique pelo app.
              </p>
            )}

            {/* Collab, marcação, texto alternativo, Reels de teste e música. */}
            <div className="flex flex-wrap gap-2">
              {onOpcoes && estado !== "publicando" && (
                <Button type="button" variant="ghost" onClick={onOpcoes} className="h-9 px-2.5 rounded-xl text-xs font-body text-muted-foreground hover:text-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Opções do Instagram{qtdOpcoes ? ` (${qtdOpcoes})` : ""}
                </Button>
              )}
              {podeSemAprovacao && estado !== "agendado" && (
                <Button type="button" variant="outline" onClick={onSemAprovacao} className="h-9 px-3 rounded-xl text-xs font-body border-amber-300 text-amber-900 hover:bg-amber-50">
                  Publicar sem aprovação
                </Button>
              )}
            </div>

            {/* Resultado da checagem: diz o que falta antes da hora chegar. */}
            {checagem && (
              checagem.ok ? (
                <p className="text-xs font-body text-green-800 flex items-center gap-1.5" role="status">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mídia pronta pro Instagram.
                </p>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2" role="status">
                  <p className="text-xs font-body font-bold text-amber-900 mb-1">Antes de publicar:</p>
                  <ul className="text-xs font-body text-amber-900 space-y-1 list-disc pl-4">
                    {checagem.pendentes > 0 && <li>Vídeo ainda processando. Cheque de novo em alguns minutos.</li>}
                    {checagem.erros.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )
            )}
            {erroChecagem && <p className="text-xs font-body text-destructive">{erroChecagem}</p>}
          </>
        )}
      </div>

    </section>
  );
}

/* onAgendou: o editor do criador guarda o status em estado local; sem avisar,
   o próximo salvar devolvia o card pra coluna antiga depois de agendar. */
export function PublicarNoInstagram({ postId, onAgendou, compacto, formato }: { postId: string | null | undefined; onAgendou?: (ligado: boolean) => void; compacto?: boolean; formato?: string | null }) {
  const { data: est } = usePublicacaoDoPost(postId);
  const { data: cx } = useConexaoDoPost(postId);
  const desfazer = useDesfazerConferencia(postId);
  const checar = useChecarMidia(postId);
  // Conferência final (Walter, 28/10/2026): agendar e publicar agora passam por ela.
  const [conf, setConf] = useState<{ agora: boolean; semAprovacao: boolean } | null>(null);
  const [opcoes, setOpcoes] = useState(false);
  const republicar = useRepublicar(postId);
  const [rep, setRep] = useState<null | "perguntar" | "no_ar" | "sem_conferir">(null);

  if (!postId || !est) return null;
  if (!cx?.pode_publicar && !est.publish_status) return null;

  const naoAprovado = !!est.external_client_id && est.approval_status !== "aprovado" && !est.publish_sem_aprovacao_motivo;

  return (
    <>
      <PublicarNoInstagramView
        est={est}
        cx={cx ?? null}
        publicando={false}
        alternando={desfazer.isPending}
        checando={checar.isPending}
        checagem={checar.data ?? null}
        erroChecagem={checar.error ? (checar.error as Error).message : null}
        onPublicar={() => setConf({ agora: true, semAprovacao: naoAprovado })}
        onAuto={(v) => {
          if (v) setConf({ agora: false, semAprovacao: naoAprovado });
          else desfazer.mutate(undefined, { onSuccess: () => onAgendou?.(false) });
        }}
        onSemAprovacao={() => setConf({ agora: false, semAprovacao: true })}
        onOpcoes={() => setOpcoes(true)}
        onRepublicar={() => setRep("perguntar")}
        onChecar={() => checar.mutate()}
        compacto={compacto}
        formato={formato}
      />
      <ConferenciaPublicacao
        postId={postId}
        open={!!conf}
        onOpenChange={(v) => { if (!v) setConf(null); }}
        agora={conf?.agora}
        semAprovacao={conf?.semAprovacao}
        onConcluido={() => { if (conf && !conf.agora) onAgendou?.(true); }}
      />
      <Dialog open={!!rep} onOpenChange={(v) => { if (!v) setRep(null); }}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] rounded-3xl">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Publicar de novo?</DialogTitle>
            <DialogDescription className="text-[13px]">
              O Cria confere no Instagram se o post ainda está lá. Se já foi apagado, ele volta pra "Pronto pra sair", com a mesma mídia e legenda, e você escolhe agendar ou publicar agora.
            </DialogDescription>
          </DialogHeader>
          {rep === "no_ar" && (
            <p className="text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 flex gap-2" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> Ele ainda está no ar no Instagram. Publicar de novo deixaria duplicado: apague lá primeiro e volte aqui.
            </p>
          )}
          {rep === "sem_conferir" && (
            <p className="text-[13px] rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 flex gap-2" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> Não consegui conferir no Instagram agora. Só continue se você tem certeza de que o post foi apagado.
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setRep(null)}>Cancelar</Button>
            {rep !== "no_ar" && (
              <Button type="button" className="rounded-xl bg-sky-700 text-white hover:bg-sky-800" disabled={republicar.isPending}
                onClick={() => republicar.mutate(rep === "sem_conferir", {
                  onSuccess: (r) => { if (r.ok) setRep(null); else if (r.motivo === "no_ar" || r.motivo === "sem_conferir") setRep(r.motivo); else setRep(null); },
                })}>
                {republicar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : rep === "sem_conferir" ? "Tenho certeza, liberar" : "Conferir e liberar"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <OpcoesInstagram postId={postId} formato={formato ?? est.format} inicial={est.ig_opcoes} open={opcoes} onOpenChange={setOpcoes} />
    </>
  );
}

/* Selo pequeno pros cards (quadro, calendário, agenda). */
export function SeloPublicacaoIg({ status, autoPublish, className }: { status?: string | null; autoPublish?: boolean | null; className?: string }) {
  if (!status) return null;
  const mapa: Record<string, { txt: string; cls: string }> = {
    na_fila: { txt: autoPublish ? "IG agendado" : "IG na fila", cls: "bg-sky-100 text-sky-800" },
    publicando: { txt: "Publicando", cls: "bg-violet-100 text-violet-800" },
    publicado: { txt: "No Instagram", cls: "bg-green-100 text-green-800" },
    erro: { txt: "Não saiu", cls: "bg-amber-100 text-amber-900" },
  };
  const m = mapa[status];
  if (!m) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body font-bold align-middle whitespace-nowrap", m.cls, className)}>
      <Instagram className="h-2.5 w-2.5" /> {m.txt}
    </span>
  );
}
