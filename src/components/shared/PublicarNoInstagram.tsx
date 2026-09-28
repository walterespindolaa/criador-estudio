import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Instagram, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAgendarPublicacao, useChecarMidia, useConexaoDoPost, usePublicacaoDoPost, usePublicarAgora,
} from "@/hooks/usePublicarInstagram";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO INSTAGRAM (ciclo 5 do plano de publicar, 28/09/2026)

   Caixa única, usada no editor do criador e no editor do Cria Post:
   "Publicar agora", "Publicar automaticamente na data e hora" e "Checar
   mídia". Só aparece quando a conta do post PODE publicar pelo Cria (hoje:
   testadores; depois da aprovação da Meta, todo mundo que reconectar) ou
   quando o post já tem histórico de publicação. Pra quem não pode, a tela
   fica exatamente como era: sem botão que promete o que não entrega.
   ═══════════════════════════════════════════════════════════════════════════ */

function quandoBr(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function PublicarNoInstagram({ postId }: { postId: string | null | undefined }) {
  const { data: est } = usePublicacaoDoPost(postId);
  const { data: cx } = useConexaoDoPost(postId);
  const publicar = usePublicarAgora(postId);
  const agendar = useAgendarPublicacao(postId);
  const checar = useChecarMidia(postId);
  const [confirmar, setConfirmar] = useState(false);

  if (!postId || !est) return null;
  const temHistorico = !!est.publish_status;
  if (!cx?.pode_publicar && !temHistorico) return null;

  const ehCliente = !!est.external_client_id;
  // Mesma regra do servidor: Cria Post só com "aprovado". "postado" quer dizer
  // que alguém já publicou na mão; publicar de novo duplicaria o post.
  const aprovado = !ehCliente || est.approval_status === "aprovado";
  const status = est.publish_status;
  const ocupado = publicar.isPending || status === "publicando";
  const publicado = status === "publicado";

  return (
    <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50/70 to-violet-50/60 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
          <Instagram className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-display font-bold text-foreground leading-tight">Publicar no Instagram</p>
          <p className="text-[11px] font-body text-muted-foreground truncate">
            {cx?.username ? `Sai em @${cx.username}` : "Conta do Instagram do post"}
          </p>
        </div>
      </div>

      {/* Estado atual */}
      {publicado && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-[12.5px] font-body text-green-900 flex-1">Publicado no Instagram.</p>
          {est.ig_permalink && (
            <a href={est.ig_permalink} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-green-800 inline-flex items-center gap-1">
              Ver <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      {status === "publicando" && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-violet-600 animate-spin shrink-0" />
          <p className="text-[12.5px] font-body text-violet-900">Publicando... vídeo pode levar alguns minutos.</p>
        </div>
      )}
      {status === "na_fila" && est.auto_publish && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-600 shrink-0" />
          <p className="text-[12.5px] font-body text-sky-900">
            Agendado: sai sozinho em {quandoBr(est.publicar_em)}.
            {est.publish_error ? ` Última tentativa: ${est.publish_error}` : ""}
          </p>
        </div>
      )}
      {status === "erro" && est.publish_error && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[12.5px] font-body text-amber-900">{est.publish_error}</p>
        </div>
      )}

      {!publicado && (
        <>
          {!aprovado && (
            <p className="text-[12px] font-body text-muted-foreground">
              {est.approval_status === "postado"
                ? "Este post já foi marcado como postado."
                : "Libera depois que o cliente aprovar o post."}
            </p>
          )}
          {cx && !cx.pode_publicar && cx.motivo && (
            <p className="text-[12px] font-body text-amber-800">{cx.motivo}</p>
          )}

          <label className="flex items-center gap-2.5 rounded-xl bg-card/80 border border-border px-3 py-2">
            <Switch
              checked={!!est.auto_publish && status === "na_fila"}
              disabled={!aprovado || !cx?.pode_publicar || agendar.isPending || ocupado}
              onCheckedChange={(v) => agendar.mutate(v)}
            />
            <span className="text-[12.5px] font-body text-foreground leading-snug">
              Publicar automaticamente na data e hora do post
              {est.scheduled_date ? "" : <span className="block text-[11px] text-muted-foreground">Defina a data e salve o post primeiro.</span>}
            </span>
          </label>

          <div className="flex gap-2 flex-wrap">
            <Button type="button" size="sm" className="rounded-xl flex-1 bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90"
              disabled={!aprovado || !cx?.pode_publicar || ocupado} onClick={() => setConfirmar(true)}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Publicar agora</>}
            </Button>
            <Button type="button" size="sm" variant="outline" className="rounded-xl"
              disabled={checar.isPending} onClick={() => checar.mutate()}>
              {checar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Checar mídia</>}
            </Button>
          </div>

          {/* Resultado da checagem: diz o que falta antes de a hora chegar. */}
          {checar.data && (
            checar.data.ok ? (
              <p className="text-[12px] font-body text-green-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mídia pronta pro Instagram.
              </p>
            ) : (
              <ul className="text-[12px] font-body text-amber-900 space-y-1 list-disc pl-4">
                {checar.data.pendentes > 0 && <li>Vídeo ainda processando. Cheque de novo em alguns minutos.</li>}
                {checar.data.erros.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )
          )}
          {checar.error && <p className="text-[12px] font-body text-destructive">{(checar.error as Error).message}</p>}
        </>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar agora no Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              O post sai na hora em {cx?.username ? `@${cx.username}` : "no Instagram"}, com a mídia e a legenda salvas.
              Salve o post antes se mudou alguma coisa. Depois de publicado, editar só pelo app do Instagram.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => publicar.mutate()}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* Selo pequeno pros cards (quadro, calendário, agenda). */
export function SeloPublicacaoIg({ status, autoPublish }: { status?: string | null; autoPublish?: boolean | null }) {
  if (!status) return null;
  const mapa: Record<string, { txt: string; cls: string }> = {
    na_fila: { txt: autoPublish ? "IG agendado" : "IG na fila", cls: "bg-sky-100 text-sky-800" },
    publicando: { txt: "Publicando", cls: "bg-violet-100 text-violet-800" },
    publicado: { txt: "No Instagram", cls: "bg-green-100 text-green-800" },
    erro: { txt: "Erro no IG", cls: "bg-amber-100 text-amber-900" },
  };
  const m = mapa[status];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-body font-bold ${m.cls}`}>
      <Instagram className="h-2.5 w-2.5" /> {m.txt}
    </span>
  );
}
