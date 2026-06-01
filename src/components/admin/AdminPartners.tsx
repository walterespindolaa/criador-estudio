import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Handshake, Check, Clock, X, Search, PauseCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Partner, PartnerStatus } from "@/hooks/usePartner";
import { PainelAfiliadoDrawer } from "./PainelAfiliadoDrawer";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

type Filter = "todas" | "pendente" | "aprovada" | "recusada" | "suspensa";

const FILTERS: { key: Filter; label: string; status: PartnerStatus | null }[] = [
  { key: "todas", label: "Todas", status: null },
  { key: "pendente", label: "Pendentes", status: "pending" },
  { key: "aprovada", label: "Aprovadas", status: "approved" },
  { key: "suspensa", label: "Suspensas", status: "suspended" },
  { key: "recusada", label: "Recusadas", status: "rejected" },
];

const STATUS_BADGE: Record<PartnerStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
  suspended: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
};

const STATUS_LABEL: Record<PartnerStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  suspended: "Suspensa",
  rejected: "Recusada",
};

const StatusIcon = ({ status }: { status: PartnerStatus }) => {
  if (status === "approved") return <Check className="h-3 w-3" />;
  if (status === "rejected") return <X className="h-3 w-3" />;
  if (status === "suspended") return <PauseCircle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
};

export function AdminPartners() {
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Partner | null>(null);

  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data, error } = await sbFrom("partners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });

  const pendingCount = useMemo(
    () => partners.filter((p) => p.status === "pending").length,
    [partners],
  );

  const filtered = useMemo(() => {
    let list = partners;
    const statusFilter = FILTERS.find((f) => f.key === filter)?.status;
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.cpf.includes(q) ||
          p.phone.includes(q),
      );
    }
    return list;
  }, [partners, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            const showBadge = f.key === "pendente" && pendingCount > 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-semibold border transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                )}
              >
                {f.label}
                {showBadge && (
                  <span className={cn(
                    "min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                    isActive ? "bg-white/20" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  )}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou telefone"
            className="pl-9 rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Handshake className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-body text-foreground font-medium">
            {search ? "Nenhuma parceira encontrada" : "Nenhuma parceira nesta categoria"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 font-semibold">Parceira</th>
                  <th className="p-3 font-semibold hidden sm:table-cell">Solicitado</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="border-t border-border hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3">
                      <p className="font-body font-semibold text-foreground truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground font-body truncate">{p.pix_key}</p>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground font-body">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold border",
                        STATUS_BADGE[p.status],
                      )}>
                        <StatusIcon status={p.status} />
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PainelAfiliadoDrawer
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        partner={selected}
      />
    </div>
  );
}
