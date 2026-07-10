import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/CopyButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, ShieldOff, ShieldCheck, Trash2, Loader2, Eraser } from "lucide-react";

interface UserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

type UserDetails = {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  role: string | null;
  subscription_status: string | null;
  access_expires_at: string | null;
  trial_ends_at: string | null;
  niche: string | null;
  created_at: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

function formatValidity(accessExpiresAt: string | null | undefined): string {
  if (!accessExpiresAt) return "Vitalício / sem prazo";
  try {
    const date = new Date(accessExpiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const formatted = format(date, "dd/MM/yyyy", { locale: ptBR });
    if (diff <= 0) return `${formatted} (expirado)`;
    return `${formatted} (${days} dia${days === 1 ? "" : "s"})`;
  } catch {
    return "-";
  }
}

function FieldBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</p>
      {children}
    </div>
  );
}

export function UserDetailsDrawer({ open, onOpenChange, userId }: UserDetailsDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [validity, setValidity] = useState<string>("lifetime");
  const [plan, setPlan] = useState<string>("");
  const [seats, setSeats] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  // Reset do estado local ao trocar de usuário (evita vazar seleção de um pro outro).
  useEffect(() => { setPlan(""); setValidity("lifetime"); setSeats(null); }, [userId]);

  const { data, isLoading, error } = useQuery<UserDetails | null>({
    queryKey: ["admin-user-details", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: unknown,
      ) => Promise<{ data: UserDetails | null; error: unknown }>)(
        "get_user_details",
        { _user_id: userId },
      );
      if (error) throw error;
      return data;
    },
  });

  const isSelf = !!data && !!currentUser && data.id === currentUser.id;
  const isSuspended = data?.subscription_status === "suspended";

  const invokeAction = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: payload });
    if (error || (data as { error?: string })?.error) {
      throw new Error((data as { error?: string })?.error ?? "action_failed");
    }
    return data;
  };

  const resendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "resend_access" }),
    onSuccess: () => toast.success("E-mail de redefinição enviado."),
    onError: (e: Error) => toast.error(`Falha ao enviar: ${e.message}`),
  });

  const setValidityMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_validity", validity }),
    onSuccess: () => {
      toast.success("Validade atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const setPlanMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_plan", plan: plan || data?.plan }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  type ModulesInfo = { modules: { code: string; name: string; coming_soon?: boolean }[]; active: string[]; account_type?: string | null; is_manager?: boolean; seat_limit?: number; seats_used?: number; agency_owner_id?: string | null; agency_owner_name?: string | null };
  const { data: modulesData } = useQuery<ModulesInfo>({
    queryKey: ["admin-user-modules", userId],
    enabled: open && !!userId,
    queryFn: () => invokeAction({ user_id: userId, action: "get_modules" }) as Promise<ModulesInfo>,
  });

  const setModuleMutation = useMutation({
    mutationFn: (v: { code: string; enabled: boolean }) => invokeAction({ user_id: userId, action: "set_module", module_code: v.code, enabled: v.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] });
      toast.success("Módulo atualizado.");
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const seatsValue = seats ?? modulesData?.seat_limit ?? 0;
  const setSeatsMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_seats", seats: seatsValue }),
    onSuccess: () => {
      toast.success("Assentos atualizados.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: isSuspended ? "reactivate" : "suspend" }),
    onSuccess: () => {
      toast.success(isSuspended ? "Acesso reativado." : "Acesso suspenso.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const wipeMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "wipe_data" }),
    onSuccess: () => {
      toast.success("Conta limpa. Conteúdo apagado, acesso mantido.");
      setConfirmWipe(false);
      queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(`Falha ao limpar: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "delete" }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setConfirmDelete(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(`Falha ao excluir: ${e.message}`),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do usuário</DialogTitle>
            <DialogDescription className="font-body text-sm truncate">
              {data?.name || (isLoading ? "Carregando…" : userId?.slice(0, 8) || "")}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-2 mt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive font-body mt-4">Não foi possível carregar os detalhes.</p>
          ) : data ? (
            <div className="space-y-6 mt-4 min-w-0">
              <section className="space-y-2 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Conta</h3>
                <div className="space-y-2 min-w-0">
                  <FieldBox label="Nome">
                    <p className="text-sm font-body text-foreground break-words">{data.name || "-"}</p>
                  </FieldBox>
                  <FieldBox label="E-mail">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 min-w-0 truncate text-sm font-body text-foreground">{data.email || "-"}</span>
                      {data.email && <CopyButton text={data.email} />}
                    </div>
                  </FieldBox>
                  <FieldBox label="Tipo de conta">
                    <p className="text-sm font-body text-foreground truncate">
                      {modulesData ? (modulesData.is_manager ? "🧑‍💼 Social mídia (gestor)" : "👤 Pessoa física (criador)") : "…"}
                    </p>
                  </FieldBox>
                  {modulesData?.agency_owner_name && (
                    <FieldBox label="Coberta pela agência">
                      <p className="text-sm font-body text-foreground truncate">🏢 {modulesData.agency_owner_name}</p>
                    </FieldBox>
                  )}
                  <FieldBox label="Plano">
                    <p className="text-sm font-body text-foreground truncate">{data.plan ?? "-"}</p>
                  </FieldBox>
                  <FieldBox label="Role">
                    <p className="text-sm font-body text-foreground truncate">{data.role ?? "-"}</p>
                  </FieldBox>
                  <FieldBox label="Status de acesso">
                    <p className="text-sm font-body text-foreground truncate">{data.subscription_status ?? "-"}</p>
                  </FieldBox>
                  <FieldBox label="Validade do acesso">
                    <p className="text-sm font-body text-foreground break-words">{formatValidity(data.access_expires_at)}</p>
                  </FieldBox>
                </div>
              </section>

              <section className="space-y-2 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Perfil</h3>
                <div className="space-y-2 min-w-0">
                  <FieldBox label="Nicho">
                    <p className="text-sm font-body text-foreground break-words">{data.niche || "-"}</p>
                  </FieldBox>
                  <FieldBox label="Cadastro">
                    <p className="text-sm font-body text-foreground truncate">{formatDate(data.created_at)}</p>
                  </FieldBox>
                </div>
              </section>

              <section className="space-y-3 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Ações</h3>

                <FieldBox label="Mudar validade">
                  <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                    <Select value={validity} onValueChange={setValidity}>
                      <SelectTrigger className="rounded-lg h-9 flex-1 min-w-[120px] text-sm">
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
                    <Button
                      size="sm"
                      onClick={() => setValidityMutation.mutate()}
                      disabled={setValidityMutation.isPending}
                    >
                      {setValidityMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </FieldBox>

                <FieldBox label="Plano">
                  <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                    <Select value={plan || data.plan || "free"} onValueChange={setPlan}>
                      <SelectTrigger className="rounded-lg h-9 flex-1 min-w-[120px] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="agency">Agência</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => setPlanMutation.mutate()} disabled={setPlanMutation.isPending}>
                      {setPlanMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </FieldBox>

                {(data.plan === "agency" || modulesData?.is_manager) && (
                  <FieldBox label="Assentos de agência (clientes)">
                    <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                      <Input
                        type="number" min={0} max={200}
                        value={seatsValue}
                        onChange={(e) => setSeats(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                        className="h-9 w-24"
                      />
                      <Button size="sm" onClick={() => setSeatsMutation.mutate()} disabled={setSeatsMutation.isPending}>
                        {setSeatsMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Salvar
                      </Button>
                      {modulesData && (
                        <span className="text-[11px] font-body text-muted-foreground">{modulesData.seats_used ?? 0} usados de {modulesData.seat_limit ?? 0}</span>
                      )}
                    </div>
                    <p className="text-[10px] font-body text-muted-foreground mt-1.5">Nº de clientes que a agência pode cobrir. Precisa ser &gt; 0 pra ela sair do banner e adicionar clientes em "Suas contas".</p>
                  </FieldBox>
                )}

                {modulesData && (
                  <FieldBox label="Módulos (add-ons de social mídia)">
                    {modulesData.is_manager ? (
                      <>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {modulesData.modules.map((m) => {
                            const on = modulesData.active.includes(m.code);
                            return (
                              <button
                                key={m.code}
                                onClick={() => setModuleMutation.mutate({ code: m.code, enabled: !on })}
                                disabled={setModuleMutation.isPending}
                                className={`px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${on ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                              >
                                {on ? "✓ " : "+ "}{m.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] font-body text-muted-foreground mt-1.5">Clique pra ligar/desligar cada módulo pra esta conta de gestor.</p>
                      </>
                    ) : (
                      <p className="text-[11px] font-body text-muted-foreground mt-1">Esta é uma conta <strong>pessoa física</strong> (criador). Os add-ons são só pra contas de social mídia, aqui, pra liberar recursos, use o <strong>Plano</strong> (ex.: Studio) acima.</p>
                    )}
                  </FieldBox>
                )}

                <div className="flex flex-wrap gap-2 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending || !data.email}
                  >
                    {resendMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                    Reenviar acesso
                  </Button>

                  {!isSelf && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSuspendMutation.mutate()}
                      disabled={toggleSuspendMutation.isPending}
                    >
                      {toggleSuspendMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : isSuspended ? (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <ShieldOff className="h-3 w-3 mr-1" />
                      )}
                      {isSuspended ? "Reativar" : "Suspender"}
                    </Button>
                  )}

                  {!isSelf && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      onClick={() => setConfirmWipe(true)}
                      disabled={wipeMutation.isPending}
                    >
                      {wipeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eraser className="h-3 w-3 mr-1" />}
                      Limpar dados
                    </Button>
                  )}

                  {!isSelf && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Limpar dados da conta?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Apaga <strong>todo o conteúdo</strong> deste usuário, posts, ideias, CRM, clientes,
              cronograma, media kit, bio, hábitos, metas, personas, pilares e arquivos.
              <br /><br />
              <strong>Mantém:</strong> login, plano, assinatura, cobrança, conexões (Instagram/Drive),
              push e vínculos de agência. A conta fica zerada, pronta pra recomeçar. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wipeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => { e.preventDefault(); wipeMutation.mutate(); }}
              disabled={wipeMutation.isPending}
            >
              {wipeMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Isso apaga o usuário e todos os dados dele (perfil, posts, mídia, parcerias).
              Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
