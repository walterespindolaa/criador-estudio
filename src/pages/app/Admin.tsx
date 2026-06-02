import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Plus,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAdmin, type AdminProfile } from "@/hooks/useAdmin";
import { AdminGuard } from "@/components/AdminGuard";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { CopyButton } from "@/components/shared/CopyButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPartners } from "@/components/admin/AdminPartners";
import { UserDetailsDrawer } from "@/components/admin/UserDetailsDrawer";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground border-border",
  pro: "bg-primary/10 text-primary border-primary/20",
  studio: "bg-amber-50 text-amber-700 border-amber-200",
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
  { value: "studio", label: "Studio" },
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
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", plan: "trial" });
  const [validity, setValidity] = useState("lifetime");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<null | { email: string; inviteLink: string }>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: { ...form, validity } });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error ?? "create_failed");
      }
      setResult({ email: data.email, inviteLink: data.inviteLink });
      setOpenCreate(false);
      setForm({ name: "", email: "", phone: "", plan: "trial" });
      setValidity("lifetime");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Usuário criado e e-mail enviado!");
    } catch {
      toast.error("Erro ao criar usuário.");
    } finally {
      setCreating(false);
    }
  };

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
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
              Painel Admin
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Gerencie usuários e acompanhe o crescimento.
            </p>
          </div>
          <Button onClick={() => setOpenCreate(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Adicionar usuário
          </Button>
        </div>

        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="inline-flex h-auto bg-card border border-border rounded-2xl p-1.5 gap-1 mb-6">
            <TabsTrigger value="usuarios" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5 shrink-0" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="parceiros" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Handshake className="h-3.5 w-3.5 shrink-0" /> Parceiros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="space-y-0">
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
                    onSelect={setSelectedUserId}
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
          </TabsContent>

          <TabsContent value="parceiros">
            <AdminPartners />
          </TabsContent>
        </Tabs>

        <Dialog open={openCreate} onOpenChange={(o) => !creating && setOpenCreate(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Adicionar usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                  className="rounded-xl"
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="rounded-xl"
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Telefone (opcional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+55 47 99999-9999"
                  className="rounded-xl"
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Plano</Label>
                <Select
                  value={form.plan}
                  onValueChange={(v) => setForm({ ...form, plan: v })}
                  disabled={creating}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.plan === "pro" || form.plan === "studio") && (
                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Validade do acesso</Label>
                  <Select value={validity} onValueChange={setValidity} disabled={creating}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15d">15 dias</SelectItem>
                      <SelectItem value="1m">1 mês</SelectItem>
                      <SelectItem value="3m">3 meses</SelectItem>
                      <SelectItem value="6m">6 meses</SelectItem>
                      <SelectItem value="1y">1 ano</SelectItem>
                      <SelectItem value="lifetime">Vitalício</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground font-body">
                    Vitalício não expira. Ao vencer, o usuário vai pro paywall.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">Usuário criado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground font-body">
              Convite enviado por e-mail. O link abaixo já autentica o usuário e leva pra definição de senha.
            </p>
            {result && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">E-mail</p>
                    <p className="text-sm font-body text-foreground truncate">{result.email}</p>
                  </div>
                  <CopyButton text={result.email} />
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Link de acesso</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="flex-1 min-w-0 truncate text-xs font-mono bg-muted rounded-lg px-2 py-1.5">{result.inviteLink}</code>
                    <CopyButton text={result.inviteLink} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setResult(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UserDetailsDrawer
          open={!!selectedUserId}
          onOpenChange={(o) => !o && setSelectedUserId(null)}
          userId={selectedUserId}
        />
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
  onSelect: (userId: string) => void;
};

function AdminUserRow({ user, onRoleChange, onPlanChange, onSelect }: AdminUserRowProps) {
  const planKey = user.plan ?? "free";
  const roleKey = user.role ?? "user";
  const created = user.created_at ? new Date(user.created_at) : null;

  return (
    <tr
      onClick={() => onSelect(user.id)}
      className="border-b border-border/40 last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
    >
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
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
