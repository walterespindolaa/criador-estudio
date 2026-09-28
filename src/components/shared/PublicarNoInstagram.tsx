import { useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Instagram, Loader2, RefreshCw, RotateCcw, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAgendarPublicacao, useChecarMidia, useConexaoDoPost, usePublicacaoDoPost, usePublicarAgora,
  type ConexaoDoPost, type EstadoPublicacao, type ResultadoChecagem,
} from "@/hooks/usePublicarInstagram";

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
  onPublicar: () => void;
  onAuto: (ligar: boolean) => void;
  onChecar: () => void;
};

export function PublicarNoInstagramView({
  est, cx, publicando, alternando, checando, checagem, erroChecagem, onPublicar, onAuto, onChecar,
}: PublicarNoInstagramViewProps) {
  const [confirmar, setConfirmar] = useState(false);

  const status = est.publish_status;
  const estadoBase: Estado =
    status === "publicado" ? "publicado"
    : status === "publicando" || publicando ? "publicando"
    : status === "na_fila" && est.auto_publish ? "agendado"
    : status === "erro" ? "erro"
    : "pronto";

  // Cria Post só com "aprovado" (mesma regra do servidor). "postado" = já
  // publicaram na mão; publicar de novo duplicaria.
  const ehCliente = !!est.external_client_id;
  const aprovado = !ehCliente || est.approval_status === "aprovado";
  // Selo honesto: "Pronto pra sair" só quando dá pra sair mesmo.
  const estado: Estado = estadoBase !== "pronto" ? estadoBase
    : est.approval_status === "postado" ? "postado"
    : !aprovado ? "aguardando"
    : "pronto";
  const podeAgir = aprovado && !!cx?.pode_publicar && estado !== "publicando";
  const quandoPost = dataHoraDoPost(est.scheduled_date, est.scheduled_time);

  // O que impede, em uma frase (mostra só o primeiro motivo).
  const bloqueio =
    est.approval_status === "postado" ? "Este post já foi marcado como postado."
    : !aprovado ? "Libera depois que o cliente aprovar o post."
    : cx && !cx.pode_publicar ? (cx.motivo ?? "Esta conta não pode publicar pelo Cria.")
    : null;

  const selo = SELO[estado];
  const tocar = "h-11 sm:h-9"; // 44px no celular, compacto no computador

  return (
    <section aria-label="Publicar no Instagram" className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Faixa de identidade: fina, pra não brigar com a data logo acima. */}
      <div className="h-1 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]" />

      <div className="p-3 space-y-3">
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

        {/* Painel do estado */}
        {estado === "publicado" && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2.5">
            <p className="text-[13px] font-body text-green-900 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <span>Saiu no Instagram{est.published_at ? ` ${dataHoraBr(est.published_at)}` : ""}.</span>
            </p>
            {est.ig_permalink && (
              <Button asChild variant="outline" className={cn("w-full rounded-xl border-green-300 bg-white text-green-800 hover:bg-green-50", tocar)}>
                <a href={est.ig_permalink} target="_blank" rel="noreferrer">
                  Ver no Instagram <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
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

        {estado === "agendado" && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-1">
            <p className="text-[13px] font-body text-sky-900 flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Sai sozinho <b>{dataHoraBr(est.publicar_em)}</b> (horário de Brasília).</span>
            </p>
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
            {bloqueio && (
              <p className="text-xs font-body text-muted-foreground rounded-xl bg-muted/60 px-3 py-2">{bloqueio}</p>
            )}

            {/* Automático: a linha inteira é tocável (não só o botãozinho). */}
            <label className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 min-h-[52px]",
              podeAgir ? "cursor-pointer border-border hover:bg-muted/40" : "border-border/60 opacity-70",
            )}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-body font-bold text-foreground">Publicar automaticamente</span>
                <span className="block text-xs font-body text-muted-foreground">
                  {quandoPost ? `Na data e hora do post: ${quandoPost}` : "Defina a data do post e salve pra ligar."}
                </span>
              </span>
              <Switch
                checked={estado === "agendado"}
                disabled={!podeAgir || alternando || !est.scheduled_date}
                onCheckedChange={(v) => onAuto(v)}
                aria-label="Publicar automaticamente na data e hora do post"
              />
            </label>

            {/* Lado a lado quando cabe; em tela estreita um embaixo do outro
                (min-w evita o texto do botão cortado). */}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setConfirmar(true)} disabled={!podeAgir}
                className={cn("flex-1 min-w-[150px] rounded-xl bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90", tocar)}>
                {estado === "publicando" ? <Loader2 className="h-4 w-4 animate-spin" />
                  : estado === "erro" ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Tentar de novo</>
                  : <><Send className="h-4 w-4 mr-1.5" /> Publicar agora</>}
              </Button>
              <Button type="button" variant="outline" onClick={onChecar} disabled={checando} className={cn("flex-1 min-w-[150px] rounded-xl", tocar)}>
                {checando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1.5" /> Checar mídia</>}
              </Button>
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

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="rounded-2xl w-[calc(100vw-2rem)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar agora no Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              O post sai na hora em {cx?.username ? `@${cx.username}` : "no Instagram"}, com a mídia e a legenda salvas.
              Mudou algo? Salve o post antes. Depois de publicado, editar só pelo app do Instagram.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-11 sm:h-10 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11 sm:h-10 rounded-xl" onClick={onPublicar}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function PublicarNoInstagram({ postId }: { postId: string | null | undefined }) {
  const { data: est } = usePublicacaoDoPost(postId);
  const { data: cx } = useConexaoDoPost(postId);
  const publicar = usePublicarAgora(postId);
  const agendar = useAgendarPublicacao(postId);
  const checar = useChecarMidia(postId);

  if (!postId || !est) return null;
  if (!cx?.pode_publicar && !est.publish_status) return null;

  return (
    <PublicarNoInstagramView
      est={est}
      cx={cx ?? null}
      publicando={publicar.isPending}
      alternando={agendar.isPending}
      checando={checar.isPending}
      checagem={checar.data ?? null}
      erroChecagem={checar.error ? (checar.error as Error).message : null}
      onPublicar={() => publicar.mutate()}
      onAuto={(v) => agendar.mutate(v)}
      onChecar={() => checar.mutate()}
    />
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
