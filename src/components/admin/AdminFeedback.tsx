import { useFeedbacksAdmin } from "@/hooks/useFeedback";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<string, string> = {
  bug: "bg-red-100 text-red-700",
  ideia: "bg-blue-100 text-blue-700",
  outro: "bg-gray-100 text-gray-700",
};
const TYPE_LABEL: Record<string, string> = { bug: "Problema", ideia: "Ideia", outro: "Outro" };
const STATUS_STYLE: Record<string, string> = {
  novo: "bg-amber-100 text-amber-700",
  visto: "bg-blue-100 text-blue-700",
  resolvido: "bg-green-100 text-green-700",
};
// De onde a pessoa enviou. Feedbacks antigos (sem origem) não mostram nada.
const ORIGIN_LABEL: Record<string, string> = { gestor: "Social mídia", usuario: "Usuário", cliente: "Cliente" };

export function AdminFeedback() {
  const { feedbacks, isLoading, setStatus } = useFeedbacksAdmin();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground font-body">Feedbacks enviados pelos usuários (ideias, problemas e outros).</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">Carregando…</p>
      ) : feedbacks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum feedback ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Quando alguém enviar pelo botão de feedback, aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", TYPE_STYLE[f.type] ?? "bg-muted")}>{TYPE_LABEL[f.type] ?? f.type}</span>
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", STATUS_STYLE[f.status] ?? "bg-muted")}>{f.status}</span>
                {f.origin && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{ORIGIN_LABEL[f.origin] ?? f.origin}</span>}
                <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { locale: ptBR, addSuffix: true })}</span>
              </div>
              <p className="text-sm text-foreground break-words">{f.message}</p>
              {f.url && <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{f.url}</p>}
              {/* Anexo (print/imagem/vídeo). Imagem abre em nova aba; vídeo toca inline. */}
              {f.attachment_url && f.attachment_type === "image" && (
                <a href={f.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                  <img src={f.attachment_url} alt="Anexo do feedback" className="max-h-44 rounded-lg border border-border object-contain" loading="lazy" />
                </a>
              )}
              {f.attachment_url && f.attachment_type === "video" && (
                <video src={f.attachment_url} controls className="mt-2 max-h-52 w-full max-w-xs rounded-lg border border-border" />
              )}
              <div className="flex gap-2 mt-2">
                {f.status !== "visto" && <button onClick={() => setStatus.mutate({ id: f.id, status: "visto" })} className="text-[11px] font-medium rounded-lg border border-border px-2.5 py-1 hover:bg-muted">Marcar como visto</button>}
                {f.status !== "resolvido" && <button onClick={() => setStatus.mutate({ id: f.id, status: "resolvido" })} className="text-[11px] font-medium rounded-lg border border-green-200 text-green-700 px-2.5 py-1 hover:bg-green-50">Resolver</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
