import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAdmin, type AdminProfile } from "@/hooks/useAdmin";
import { AdminGuard } from "@/components/AdminGuard";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

const PAGE_SIZE = 20;

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground border-border",
  pro: "bg-primary/10 text-primary border-primary/20",
  premium: "bg-amber-50 text-amber-700 border-amber-200",
};

const ROLE_BADGE: Record<string, string> = {
  user: "bg-muted text-muted-foreground border-border",
  admin: "bg-red-50 text-red-700 border-red-200",
  moderator: "bg-blue-50 text-blue-700 border-blue-200",
};

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
];

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
];

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const AdminInner = () => {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [page, setPage] = useState(0);

  const { users, totalCount, stats, isLoading, updateUserRole, updateUserPlan } = useAdmin({
    page,
    pageSize: PAGE_SIZE,
    search,
    planFilter,
    roleFilter,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  if (isLoading) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole.mutateAsync({ userId, role });
      toast.success(`Role atualizado para ${role}`);
    } catch {
      toast.error("Erro ao atualizar role");
    }
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    try {
      await updateUserPlan.mutateAsync({ userId, plan });
      toast.success(`Plano atualizado para ${plan}`);
    } catch {
      toast.error("Erro ao atualizar plano");
    }
  };

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
            <Shield className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
              Painel Admin
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Gerencie usuários e acompanhe o crescimento.
            </p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Total de usuários"
            value={stats.totalUsers}
            gradient="from-blue-500/15 to-sky-500/5"
            iconBg="bg-blue-500"
          />
          <StatCard
            icon={Activity}
            label="Ativos (7 dias)"
            value={stats.activeUsers}
            gradient="from-emerald-500/15 to-teal-500/5"
            iconBg="bg-emerald-500"
          />
          <StatCard
            icon={CheckCircle2}
            label="Onboarding completo"
            value={stats.onboarded}
            gradient="from-violet-500/15 to-purple-500/5"
            iconBg="bg-violet-500"
          />
          <StatCard
            icon={Shield}
            label="Admins"
            value={stats.admins}
            gradient="from-red-500/15 to-orange-500/5"
            iconBg="bg-red-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome..."
              className="rounded-xl pl-9 h-10"
            />
          </div>
          <Select
            value={planFilter}
            onValueChange={(v) => {
              setPlanFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="rounded-xl w-full sm:w-40">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos planos</SelectItem>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="rounded-xl w-full sm:w-40">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos roles</SelectItem>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Usuário
                  </th>
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Nicho
                  </th>
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Plano
                  </th>
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                    Cadastro
                  </th>
                  <th className="px-4 py-3 font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="text-sm text-muted-foreground font-body">
                        Nenhum usuário encontrado com esses filtros.
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => <AdminUserRow
                    key={u.id}
                    user={u}
                    onRoleChange={handleRoleChange}
                    onPlanChange={handlePlanChange}
                  />)
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground font-body">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, totalCount)} de{" "}
                {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                </Button>
                <span className="text-xs font-body text-muted-foreground tabular-nums">
                  {safePage + 1}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Próximo <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

type StatCardProps = {
  icon: typeof Users;
  label: string;
  value: number;
  gradient: string;
  iconBg: string;
};

function StatCard({ icon: Icon, label, value, gradient, iconBg }: StatCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/50 p-4 bg-gradient-to-br", gradient)}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2 shadow-sm", iconBg)}>
        <Icon className="h-4 w-4 text-white" strokeWidth={1.75} />
      </div>
      <p className="text-2xl font-display font-extrabold text-foreground tracking-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground mt-0.5">
        {label}
      </p>
    </div>
  );
}

type AdminUserRowProps = {
  user: AdminProfile;
  onRoleChange: (userId: string, role: string) => void;
  onPlanChange: (userId: string, plan: string) => void;
};

function AdminUserRow({ user, onRoleChange, onPlanChange }: AdminUserRowProps) {
  const planKey = user.plan ?? "free";
  const roleKey = user.role ?? "user";
  const created = user.created_at ? new Date(user.created_at) : null;

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-accent/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center overflow-hidden shrink-0">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-display font-bold text-primary">{initials(user.name)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-body font-semibold text-foreground text-sm truncate">{user.name || "—"}</p>
            <p className="text-xs text-muted-foreground font-body truncate">
              {user.instagram_handle ? `@${user.instagram_handle.replace(/^@/, "")}` : user.id.slice(0, 8)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs font-body text-muted-foreground">{user.niche ?? "—"}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border capitalize",
            PLAN_BADGE[planKey] ?? PLAN_BADGE.free
          )}
        >
          {planKey}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border capitalize",
            ROLE_BADGE[roleKey] ?? ROLE_BADGE.user
          )}
        >
          {roleKey}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs font-body text-muted-foreground">
          {created ? formatDistanceToNow(created, { locale: ptBR, addSuffix: true }) : "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Select value={roleKey} onValueChange={(v) => onRoleChange(user.id, v)}>
            <SelectTrigger className="h-8 rounded-lg w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planKey} onValueChange={(v) => onPlanChange(user.id, v)}>
            <SelectTrigger className="h-8 rounded-lg w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </td>
    </tr>
  );
}

const Admin = () => (
  <AdminGuard>
    <AdminInner />
  </AdminGuard>
);

export default Admin;
