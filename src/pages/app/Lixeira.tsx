import { useMemo } from "react";
import { motion } from "framer-motion";
import { Trash2, RotateCcw, X, FileText, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrashedPosts, useTrashedClients, useRestoreTrash, usePurgeTrash, type TrashRow } from "@/hooks/useTrash";
import { confirmar } from "@/components/shared/Confirm";
import { Sticker } from "@/components/shared/Sticker";

function daysLeft(deletedAt: string): number {
  const gone = new Date(deletedAt).getTime() + 30 * 86400000;
  return Math.max(0, Math.ceil((gone - Date.now()) / 86400000));
}

export default function Lixeira() {
  const { data: posts = [], isLoading: lp } = useTrashedPosts();
  const { data: clients = [], isLoading: lc } = useTrashedClients();
  const restore = useRestoreTrash();
  const purge = usePurgeTrash();

  const all = useMemo(() => [...clients, ...posts].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)), [clients, posts]);
  const loading = lp || lc;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div data-tour="lixeira-header" className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center shrink-0"><Trash2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Lixeira</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Itens excluídos ficam aqui por 30 dias, dá pra restaurar ou apagar de vez.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>
      ) : all.length === 0 ? (
        <div className="relative overflow-hidden border border-dashed border-border rounded-2xl py-16 text-center mt-4">
          <Sticker name="selo-social-club-verde" className="absolute -bottom-5 -right-4 w-32 opacity-[0.08]" />
          <Sticker name="selo-social-club-verde" className="mx-auto mb-3 w-[72px]" />
          <p className="text-sm font-body text-foreground font-medium">Lixeira vazia</p>
          <p className="text-xs font-body text-muted-foreground mt-1">O que você excluir aparece aqui por 30 dias.</p>
        </div>
      ) : (
        <div data-tour="lixeira-itens" className="space-y-2 mt-4">
          {all.map((row) => (
            <TrashItem key={`${row.kind}:${row.id}`} row={row}
              onRestore={() => restore.mutate({ id: row.id, kind: row.kind })}
              onPurge={async () => { if (await confirmar({ titulo: `Excluir "${row.label}" de vez?`, descricao: "Isso não dá pra desfazer nem pela lixeira." })) purge.mutate({ id: row.id, kind: row.kind }); }} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function TrashItem({ row, onRestore, onPurge }: { row: TrashRow; onRestore: () => void; onPurge: () => void }) {
  const left = daysLeft(row.deleted_at);
  const Icon = row.kind === "client" ? Users : FileText;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 flex-wrap">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground shrink-0"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-foreground truncate">{row.label}</p>
        <p className="text-[11px] font-body text-muted-foreground">{row.kind === "client" ? "Cliente" : "Post"} · some em {left} {left === 1 ? "dia" : "dias"}</p>
      </div>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRestore}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar</Button>
      <button onClick={onPurge} className="text-muted-foreground/60 hover:text-destructive shrink-0" title="Excluir de vez"><X className="h-4 w-4" /></button>
    </div>
  );
}
