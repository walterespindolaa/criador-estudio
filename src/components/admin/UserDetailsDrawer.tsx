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
import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import { cn } from "@/lib/utils";
import {
  Mail, ShieldOff, ShieldCheck, Trash2, Loader2, Eraser, MessageCircle, Instagram, X,
  Check, Plus, Users, UserRound,
} from "lucide-react";

/* DETALHES DO USUÁRIO v2 (Walter, 20/10/2026, mockup aprovado). Janela larga
   em duas colunas: à esquerda quem é a pessoa (contato e acesso), à direita
   duas abas: "Plano e uso" (prazo do plano, estender teste, upgrade, o que ela
   cria e as telas que mais abre) e "Módulos e limites" (tipo de conta,
   módulos de social mídia, carteira e assentos). A "validade" deixou de ser um
   campo solto: virou o prazo do plano. */

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
  trial_started_at: string | null;
  trial_ends_at: string | null;
  niche: string | null;
  created_at: string | null;
  phone: string | null;
  cidade: string | null;
  instagram_handle: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  last_sign_in_at: string | null;
  onboarding_completed: boolean | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  stripe_subscription_id: string | null;
  storage_used_bytes: number | null;
  storage_quota_bytes: number | null;
  ai_ideas_used_month: number | null;
  uso?: { posts: number; clientes: number; captacoes: number; roteiros: number };
  dias_ativos_14?: number;
  telas_30?: { modulo: string; n: number }[];
};

const NOME_PLANO: Record<string, string> = {
  free: "Free", trial: "Teste", essencial: "Essencial", pro: "Pro", studio: "Studio", agency: "Agência",
};

// Segmento da rota (/app/<x> ou /socialmidia/<x>) -> nome que a gente fala.
const NOME_TELA: Record<string, string> = {
  dashboard: "Início", criando: "Criando (posts)", criapost: "Cria Post", captacao: "Captação",
  criacrm: "CRM", clientes: "Clientes", agenda: "Agenda", "minha-agenda": "Minha agenda",
  aprovacoes: "Aprovações", aprovacao: "Aprovação", hubcria: "Radar", ideias: "Ideias",
  tendencias: "Tendências", stories: "Stories", prompter: "Prompter", criacaixa: "Caixa",
  equipe: "Equipe", configuracoes: "Configurações", insights: "Insights", relatorio: "Relatório",
  relatorios: "Relatórios", linkinbio: "Link na bio", brandbook: "Brandbook", biblioteca: "Biblioteca",
  demandas: "Demandas", entregues: "Entregues", marcas: "Marcas", tarefas: "Tarefas", metas: "Metas",
  "media-kit": "Media kit", aprender: "Aprender", tutoriais: "Tutoriais", plano: "Plano", assinar: "Assinar",
  "cf-admin-panel": "Admin", criakut: "Criakut", historico: "Histórico", contas: "Contas",
};
const nomeTela = (m: string) => NOME_TELA[m] ?? m;

function dataCurta(v: string | null | undefined): string {
  if (!v) return "-";
  try { return format(new Date(v), "dd/MM/yyyy", { locale: ptBR }); } catch { return "-"; }
}
function haQuanto(v: string | null | undefined): string {
  if (!v) return "nunca";
  try { return formatDistanceToNow(new Date(v), { locale: ptBR, addSuffix: true }); } catch { return "-"; }
}
function quandoComHora(v: string | null | undefined): string {
  if (!v) return "-";
  try {
    const d = new Date(v);
    const dias = differenceInCalendarDays(new Date(), d);
    const hora = format(d, "HH:mm");
    if (dias === 0) return `hoje, ${hora}`;
    if (dias === 1) return `ontem, ${hora}`;
    return `${format(d, "dd/MM")}, ${hora}`;
  } catch { return "-"; }
}
function mb(bytes: number | null | undefined): string {
  if (!bytes) return "0 MB";
  const v = bytes / (1024 * 1024);
  return v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`;
}
function soDigitos(t: string | null | undefined) { return (t ?? "").replace(/\D/g, ""); }

function Linha({ k, children, acao }: { k: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-dashed border-border/70 last:border-b-0 min-w-0">
      <span className="w-24 shrink-0 text-[12px] font-body text-muted-foreground">{k}</span>
      <span className="flex-1 min-w-0 truncate text-[13.5px] font-body text-foreground">{children}</span>
      {acao}
    </div>
  );
}
const Vazio = ({ t = "não informou" }: { t?: string }) => <span className="italic text-muted-foreground/70">{t}</span>;

function Chip({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "verde" | "ambar" | "vermelho" | "roxo" }) {
  const cls = {
    neutro: "bg-muted text-muted-foreground",
    verde: "bg-emerald-100 text-emerald-800",
    ambar: "bg-amber-100 text-amber-800",
    vermelho: "bg-red-100 text-red-700",
    roxo: "bg-violet-100 text-violet-800",
  }[tom];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-body font-semibold whitespace-nowrap", cls)}>{children}</span>;
}

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">{children}</h3>
);
const Cartao = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border border-border bg-card px-4 py-3.5", className)}>{children}</div>
);

export function UserDetailsDrawer({ open, onOpenChange, userId }: UserDetailsDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<"plano" | "modulos">("plano");
  const [plan, setPlan] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("manter");
  const [seats, setSeats] = useState<number | null>(null);
  const [packs, setPacks] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  // Reset ao trocar de usuário (evita vazar seleção de um pro outro).
  useEffect(() => { setPlan(""); setPrazo("manter"); setSeats(null); setPacks(null); setAba("plano"); }, [userId]);

  const rpc = supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown; error: { message?: string } | null }>;

  const { data, isLoading, error } = useQuery<UserDetails | null>({
    queryKey: ["admin-user-details", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await rpc("get_user_details", { _user_id: userId });
      if (error) throw error;
      return data as UserDetails | null;
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
  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  // Reenvio de acesso: além do e-mail, guarda o link novo pra mostrar na tela
  // com a mensagem pronta pro WhatsApp (o link vence em ~1h e funciona uma vez).
  const [resent, setResent] = useState<{ email: string; link: string } | null>(null);
  const resendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "resend_access" }),
    onSuccess: (d) => {
      const r = d as { email?: string; actionLink?: string };
      if (r?.actionLink && r?.email) {
        setResent({ email: r.email, link: r.actionLink });
        toast.success("Link novo gerado. A mensagem pronta está logo abaixo.");
      } else {
        toast.success("E-mail de redefinição enviado.");
      }
    },
    onError: (e: Error) => toast.error(`Falha ao enviar: ${e.message}`),
  });

  // Plano + prazo num botão só: troca o plano e, se escolheu prazo, grava a validade.
  const salvarPlano = useMutation({
    mutationFn: async () => {
      const novo = plan || data?.plan || "free";
      if (novo !== data?.plan) await invokeAction({ user_id: userId, action: "set_plan", plan: novo });
      if (prazo !== "manter") await invokeAction({ user_id: userId, action: "set_validity", validity: prazo });
    },
    onSuccess: () => { toast.success("Plano atualizado."); setPrazo("manter"); setPlan(""); recarregar(); },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const estenderTeste = useMutation({
    mutationFn: async (dias: number) => {
      const { data: fim, error } = await rpc("admin_estender_teste", { _user_id: userId, _dias: dias });
      if (error) throw new Error(error.message ?? "falhou");
      return fim as string;
    },
    onSuccess: (fim) => { toast.success(`Teste vai até ${dataCurta(fim)}.`); recarregar(); },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const trocarTipo = useMutation({
    mutationFn: async (tipo: "manager" | "creator") => {
      const { error } = await rpc("admin_definir_tipo_conta", { _user_id: userId, _tipo: tipo });
      if (error) throw new Error(error.message ?? "falhou");
      return tipo;
    },
    onSuccess: (tipo) => {
      toast.success(tipo === "manager" ? "Agora é conta de social mídia." : "Agora é conta de criador.");
      recarregar();
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  type ModulesInfo = { modules: { code: string; name: string; coming_soon?: boolean }[]; active: string[]; account_type?: string | null; is_manager?: boolean; seat_limit?: number; seats_used?: number; agency_owner_id?: string | null; agency_owner_name?: string | null; client_packs?: number; paid_client_packs?: number; crm_limit?: number; crm_used?: number };
  const { data: modulesData } = useQuery<ModulesInfo>({
    queryKey: ["admin-user-modules", userId],
    enabled: open && !!userId,
    queryFn: () => invokeAction({ user_id: userId, action: "get_modules" }) as Promise<ModulesInfo>,
  });

  const setModuleMutation = useMutation({
    mutationFn: (v: { code: string; enabled: boolean }) => invokeAction({ user_id: userId, action: "set_module", module_code: v.code, enabled: v.enabled }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] }); toast.success("Módulo atualizado."); },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const seatsValue = seats ?? modulesData?.seat_limit ?? 0;
  const setSeatsMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_seats", seats: seatsValue }),
    onSuccess: () => { toast.success("Assentos atualizados."); queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] }); },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  /* Pacotes de cortesia da carteira do CRM. Cada pacote vale 10 clientes; o
     teto final é 3 + (cortesia + pago) x 10. */
  const packsValue = packs ?? modulesData?.client_packs ?? 0;
  const setPacksMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "set_client_packs", packs: packsValue }),
    onSuccess: (r) => {
      const teto = (r as { crm_limit?: number })?.crm_limit;
      toast.success(teto ? `Carteira atualizada: até ${teto} clientes.` : "Carteira atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-modules", userId] });
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: isSuspended ? "reactivate" : "suspend" }),
    onSuccess: () => { toast.success(isSuspended ? "Acesso reativado." : "Acesso suspenso."); recarregar(); },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const wipeMutation = useMutation({
    mutationFn: () => invokeAction({ user_id: userId, action: "wipe_data" }),
    onSuccess: () => {
      toast.success("Conta limpa. Conteúdo apagado, acesso mantido.");
      setConfirmWipe(false);
      recarregar();
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

  // ── Leitura do plano: em teste, cortesia com prazo, assinatura ou sem prazo ──
  const agora = Date.now();
  const fimTeste = data?.trial_ends_at ? new Date(data.trial_ends_at).getTime() : null;
  const inicioTeste = data?.trial_started_at ? new Date(data.trial_started_at).getTime() : null;
  const temStripe = !!data?.stripe_subscription_id;
  const emTeste = !temStripe && !!fimTeste && fimTeste > agora && (data?.plan === "trial" || !data?.access_expires_at);
  const diasRestantes = fimTeste ? Math.max(0, Math.ceil((fimTeste - agora) / 86400000)) : 0;
  const diasTotais = fimTeste && inicioTeste ? Math.max(1, Math.round((fimTeste - inicioTeste) / 86400000)) : 7;
  const pctTeste = fimTeste && inicioTeste ? Math.min(100, Math.max(0, ((agora - inicioTeste) / (fimTeste - inicioTeste)) * 100)) : 0;
  const expira = data?.access_expires_at ? new Date(data.access_expires_at).getTime() : null;
  const isManager = !!modulesData?.is_manager;

  const chipPlano = !data ? null
    : isSuspended ? <Chip tom="vermelho">Suspensa</Chip>
    : temStripe ? <Chip tom="verde">Assinante {NOME_PLANO[data.plan ?? ""] ?? data.plan}</Chip>
    : emTeste ? <Chip tom="ambar">Em teste · {diasRestantes === 0 ? "acaba hoje" : `faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`}</Chip>
    : expira && expira < agora ? <Chip tom="vermelho">Acesso vencido</Chip>
    : <Chip>{NOME_PLANO[data.plan ?? ""] ?? data.plan ?? "sem plano"}{expira ? ` até ${dataCurta(data.access_expires_at)}` : ""}</Chip>;

  const telas = data?.telas_30 ?? [];
  const maxTela = Math.max(1, ...telas.map((t) => t.n));
  const zap = soDigitos(data?.phone);
  const zapLink = zap ? `https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}` : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-[1040px] w-[calc(100vw-1rem)] max-h-[92vh] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-3xl p-0 sm:p-0 gap-0 [&>button:last-child]:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do usuário</DialogTitle>
            <DialogDescription>{data?.name ?? ""}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive font-body p-6">Não foi possível carregar os detalhes.</p>
          ) : data ? (
            <>
              {/* Cabeçalho */}
              <div className="flex items-center gap-4 px-5 sm:px-6 py-5 border-b border-border bg-gradient-to-r from-muted/50 to-card">
                {data.avatar_url
                  ? <img src={data.avatar_url} alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover shrink-0" />
                  : <span className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/80 text-primary-foreground grid place-items-center font-display font-extrabold text-2xl shrink-0">
                      {(data.name ?? "?").trim().charAt(0).toUpperCase()}
                    </span>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-extrabold text-xl sm:text-2xl leading-tight truncate">{data.name || "-"}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Chip tom={isManager ? "roxo" : "neutro"}>{modulesData ? (isManager ? "Social mídia (gestora)" : "Criador (PF)") : "…"}</Chip>
                    {chipPlano}
                    <Chip tom="verde">Visto {haQuanto(data.last_seen_at)}</Chip>
                    <Chip>Cadastro {dataCurta(data.created_at)}</Chip>
                  </div>
                </div>
                <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar"
                  className="self-start rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              <div className="grid md:grid-cols-[330px_minmax(0,1fr)]">
                {/* ESQUERDA: quem é */}
                <div className="px-5 sm:px-6 py-5 space-y-5 min-w-0">
                  <section>
                    <Titulo>Contato</Titulo>
                    <Linha k="E-mail" acao={data.email ? <CopyButton text={data.email} /> : undefined}>{data.email || <Vazio />}</Linha>
                    <Linha k="WhatsApp" acao={zapLink ? (
                      <a href={zapLink} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#25D366] text-white px-2.5 py-1 text-[11px] font-body font-bold">
                        <MessageCircle className="h-3 w-3" /> Chamar
                      </a>) : undefined}>
                      {data.phone || <Vazio />}
                    </Linha>
                    <Linha k="Instagram" acao={data.instagram_handle ? (
                      <a href={`https://instagram.com/${data.instagram_handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-body font-semibold">
                        <Instagram className="h-3 w-3" /> Abrir
                      </a>) : undefined}>
                      {data.instagram_handle ? `@${data.instagram_handle.replace(/^@/, "")}` : <Vazio />}
                    </Linha>
                    <Linha k="Nicho">{data.niche || <Vazio />}</Linha>
                    <Linha k="Cidade">{data.cidade || <Vazio />}</Linha>
                  </section>

                  <section>
                    <Titulo>Acesso</Titulo>
                    <Linha k="Último acesso">{quandoComHora(data.last_seen_at)}</Linha>
                    <Linha k="Último login">{quandoComHora(data.last_sign_in_at)}</Linha>
                    <Linha k="Dias ativos">{(data.dias_ativos_14 ?? 0) > 0 ? `${data.dias_ativos_14} dos últimos 14` : <Vazio t="contando desde 20/10" />}</Linha>
                    <Linha k="Onboarding">{data.onboarding_completed ? "completo" : "não terminou"}</Linha>
                    <Linha k="Termos">{data.terms_accepted_at ? `aceitou ${data.terms_version ?? ""} em ${dataCurta(data.terms_accepted_at)}` : <Vazio t="não aceitou" />}</Linha>
                  </section>

                  {/* Link novo em mãos, com a mensagem pronta pro WhatsApp. */}
                  {resent && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold flex-1">Link novo (vale 1 hora, uso único)</p>
                        <CopyButton text={resent.link} />
                      </div>
                      <code className="block truncate text-xs font-mono bg-white/70 rounded-lg px-2 py-1.5">{resent.link}</code>
                      {(() => {
                        const msg = `Oi! Gerei um link novo de acesso ao CRIA pra você.\n\nE-mail: ${resent.email}\nAcesso: ${resent.link}\n\nImportante: o link vale por 1 hora e funciona uma vez só. Se abrir pelo WhatsApp, toque nos 3 pontinhos e escolha "Abrir no navegador". Qualquer dúvida, me chama!`;
                        return (
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mensagem pronta pro WhatsApp</p>
                              <CopyButton text={msg} />
                            </div>
                            <pre className="text-xs font-body text-foreground whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere] max-h-40 overflow-y-auto">{msg}</pre>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <section>
                    <Titulo>Ações da conta</Titulo>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending || !data.email}>
                        {resendMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                        Reenviar acesso
                      </Button>
                      {!isSelf && (
                        <Button variant="outline" size="sm" disabled={toggleSuspendMutation.isPending}
                          onClick={async () => {
                            const ok = await confirmar({
                              titulo: isSuspended ? "Reativar esta conta?" : "Suspender esta conta?",
                              descricao: isSuspended ? "A pessoa volta a entrar normalmente." : "A pessoa é barrada na entrada do app até você reativar. Os dados ficam guardados.",
                              acao: isSuspended ? "Reativar" : "Suspender",
                              destrutivo: !isSuspended,
                            });
                            if (ok) toggleSuspendMutation.mutate();
                          }}>
                          {toggleSuspendMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            : isSuspended ? <ShieldCheck className="h-3 w-3 mr-1" /> : <ShieldOff className="h-3 w-3 mr-1" />}
                          {isSuspended ? "Reativar" : "Suspender"}
                        </Button>
                      )}
                      {!isSelf && (
                        <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => setConfirmWipe(true)} disabled={wipeMutation.isPending}>
                          {wipeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eraser className="h-3 w-3 mr-1" />}
                          Limpar dados
                        </Button>
                      )}
                      {!isSelf && (
                        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>
                      )}
                    </div>
                  </section>
                </div>

                {/* DIREITA: abas */}
                <div className="border-t md:border-t-0 md:border-l border-border bg-muted/20 px-5 sm:px-6 py-5 min-w-0">
                  <div className="flex gap-1 rounded-full bg-muted p-1 mb-4 w-full sm:w-max">
                    {([["plano", "Plano e uso"], ["modulos", "Módulos e limites"]] as const).map(([k, t]) => (
                      <button key={k} type="button" onClick={() => setAba(k)}
                        className={cn("flex-1 sm:flex-none rounded-full px-4 py-1.5 text-xs font-body font-semibold transition-colors",
                          aba === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {t}
                      </button>
                    ))}
                  </div>

                  {aba === "plano" ? (
                    <div className="space-y-4">
                      <Cartao>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="min-w-0">
                            <p className="font-display font-extrabold text-2xl leading-none">
                              {emTeste ? "Teste grátis" : (NOME_PLANO[data.plan ?? ""] ?? data.plan ?? "Sem plano")}
                            </p>
                            {emTeste ? (
                              <>
                                <p className="text-xs font-body text-muted-foreground mt-1.5">
                                  começou {dataCurta(data.trial_started_at)} · termina <b className="text-foreground">{dataCurta(data.trial_ends_at)}</b>
                                </p>
                                <div className="h-2 rounded-full bg-muted overflow-hidden mt-2"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctTeste}%` }} /></div>
                                <p className="text-[11px] font-body text-muted-foreground mt-1">
                                  {Math.max(0, diasTotais - diasRestantes)} de {diasTotais} dias usados
                                </p>
                              </>
                            ) : (
                              <p className="text-xs font-body text-muted-foreground mt-1.5">
                                {temStripe ? "Cobrança pelo Stripe"
                                  : expira ? (expira < agora ? `Venceu em ${dataCurta(data.access_expires_at)}` : `Liberado até ${dataCurta(data.access_expires_at)}`)
                                  : fimTeste && fimTeste < agora && data.plan === "trial" ? `Teste acabou em ${dataCurta(data.trial_ends_at)}`
                                  : "Sem prazo (cortesia)"}
                              </p>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-body text-muted-foreground">Pagamento</p>
                            <p className="text-[13.5px] font-body mt-0.5">{temStripe ? "Assinatura ativa no Stripe" : "Sem cartão"}</p>
                            <p className="text-[11px] font-body text-muted-foreground">Status: {data.subscription_status ?? "-"}</p>
                          </div>
                        </div>

                        {!temStripe && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {[7, 30].map((d) => (
                              <Button key={d} type="button" variant="outline" size="sm" className="rounded-full h-8"
                                disabled={estenderTeste.isPending}
                                onClick={async () => {
                                  const ok = await confirmar({ titulo: `Dar mais ${d} dias de teste?`, descricao: "Conta a partir do fim atual do teste (ou de hoje, se já acabou).", acao: `+${d} dias` });
                                  if (ok) estenderTeste.mutate(d);
                                }}>
                                {estenderTeste.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                {d} dias de teste
                              </Button>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-[11px] font-body font-semibold text-muted-foreground mb-1.5">Mudar plano ou dar cortesia</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select value={plan || data.plan || "free"} onValueChange={setPlan}>
                              <SelectTrigger className="rounded-xl h-9 flex-1 min-w-[140px] text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="trial">Teste</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="studio">Studio</SelectItem>
                                <SelectItem value="agency">Agência</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={prazo} onValueChange={setPrazo}>
                              <SelectTrigger className="rounded-xl h-9 flex-1 min-w-[140px] text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manter">Prazo: manter</SelectItem>
                                <SelectItem value="15d">Até daqui 15 dias</SelectItem>
                                <SelectItem value="1m">Até daqui 1 mês</SelectItem>
                                <SelectItem value="3m">Até daqui 3 meses</SelectItem>
                                <SelectItem value="6m">Até daqui 6 meses</SelectItem>
                                <SelectItem value="1y">Até daqui 1 ano</SelectItem>
                                <SelectItem value="lifetime">Sem prazo</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="rounded-xl h-9"
                              disabled={salvarPlano.isPending || ((plan || data.plan) === data.plan && prazo === "manter")}
                              onClick={async () => {
                                const ok = await confirmar({ titulo: "Salvar plano desta conta?", descricao: "Muda o que a pessoa acessa na hora e fica registrado na trilha do admin.", acao: "Salvar" });
                                if (ok) salvarPlano.mutate();
                              }}>
                              {salvarPlano.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Salvar
                            </Button>
                          </div>
                          {temStripe && <p className="text-[11px] font-body text-amber-700 mt-1.5">Ela paga pelo Stripe: mudar aqui não muda a cobrança.</p>}
                        </div>
                      </Cartao>

                      <section>
                        <Titulo>O que {isManager ? "ela" : "a pessoa"} usa</Titulo>
                        <Cartao>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { n: data.uso?.posts ?? 0, t: "posts criados" },
                              { n: data.uso?.clientes ?? 0, t: "clientes no CRM" },
                              { n: data.uso?.captacoes ?? 0, t: "captações" },
                              { n: data.ai_ideas_used_month ?? 0, t: "usos de IA no mês" },
                            ].map((x) => (
                              <div key={x.t} className="rounded-xl border border-border bg-background px-3 py-2.5">
                                <p className="font-display font-extrabold text-xl leading-none">{x.n}</p>
                                <p className="text-[11px] font-body text-muted-foreground mt-1">{x.t}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs font-body text-muted-foreground mt-3 mb-1.5">Telas mais abertas (últimos 30 dias)</p>
                          {telas.length === 0 ? (
                            <p className="text-[12px] font-body italic text-muted-foreground/80">Nada ainda: começou a contar em 20/10/2026.</p>
                          ) : telas.map((t) => (
                            <div key={t.modulo} className="grid grid-cols-[110px_1fr_40px] gap-2 items-center py-1">
                              <span className="text-[12.5px] font-body truncate">{nomeTela(t.modulo)}</span>
                              <span className="h-2.5 rounded-full bg-muted overflow-hidden"><span className="block h-full rounded-full bg-primary" style={{ width: `${(t.n / maxTela) * 100}%` }} /></span>
                              <span className="text-[11.5px] font-body text-muted-foreground text-right">{t.n}x</span>
                            </div>
                          ))}
                          <p className="text-[11px] font-body text-muted-foreground mt-3">
                            Armazenamento: {mb(data.storage_used_bytes)} de {mb(data.storage_quota_bytes)}
                          </p>
                        </Cartao>
                      </section>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Cartao>
                        <div className="flex items-center gap-3">
                          <span className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", isManager ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground")}>
                            {isManager ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-body font-bold">{modulesData ? (isManager ? "Conta de social mídia (gestora)" : "Conta de criador (pessoa física)") : "…"}</p>
                            <p className="text-[11.5px] font-body text-muted-foreground">
                              {isManager ? "Abre no painel de social mídia, com clientes, captação e equipe." : "Abre no painel de criador, com o próprio conteúdo."}
                            </p>
                          </div>
                          {modulesData && !isSelf && (
                            <Button size="sm" variant="outline" className="rounded-xl shrink-0" disabled={trocarTipo.isPending}
                              onClick={async () => {
                                const pra = isManager ? "creator" : "manager";
                                const ok = await confirmar({
                                  titulo: pra === "manager" ? "Transformar em social mídia?" : "Voltar pra conta de criador?",
                                  descricao: pra === "manager"
                                    ? "No próximo acesso ela cai no painel de social mídia. O que já criou continua na conta; plano e teste não mudam."
                                    : "No próximo acesso ela cai no painel de criador. Clientes e equipe continuam guardados.",
                                  acao: pra === "manager" ? "Transformar" : "Voltar pra criador",
                                });
                                if (ok) trocarTipo.mutate(pra);
                              }}>
                              {trocarTipo.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {isManager ? "Voltar pra criador" : "Transformar em social mídia"}
                            </Button>
                          )}
                        </div>
                        {modulesData?.agency_owner_name && (
                          <p className="text-[11.5px] font-body text-muted-foreground mt-2">Coberta pela agência <b className="text-foreground">{modulesData.agency_owner_name}</b>.</p>
                        )}
                      </Cartao>

                      <section>
                        <Titulo>Módulos</Titulo>
                        <Cartao>
                          {!modulesData ? <Skeleton className="h-8 w-full rounded-lg" />
                            : isManager ? (
                              <>
                                <div className="flex flex-wrap gap-1.5">
                                  {modulesData.modules.map((m) => {
                                    const on = modulesData.active.includes(m.code);
                                    return (
                                      <button key={m.code} type="button"
                                        onClick={() => setModuleMutation.mutate({ code: m.code, enabled: !on })}
                                        disabled={setModuleMutation.isPending}
                                        className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body font-semibold border transition-colors",
                                          on ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                                        {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{m.name}
                                        {m.coming_soon && <span className="text-[9px] font-normal opacity-70">(em breve)</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] font-body text-muted-foreground mt-2">Toque pra ligar ou desligar cada módulo nesta conta. Vale na hora.</p>
                              </>
                            ) : (
                              <p className="text-[12.5px] font-body text-muted-foreground">
                                Módulos são da conta de social mídia. Pra criador, o que libera recurso é o <b className="text-foreground">plano</b> (aba Plano e uso).
                                Se ela é social mídia, use "Transformar em social mídia" acima.
                              </p>
                            )}
                        </Cartao>
                      </section>

                      {(data.plan === "agency" || isManager) && (
                        <section>
                          <Titulo>Limites</Titulo>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <Cartao className="min-w-0">
                              <p className="text-[13px] font-body font-bold">Carteira do CRM</p>
                              <p className="text-[11.5px] font-body text-muted-foreground">
                                {modulesData ? `${modulesData.crm_used ?? 0} de ${modulesData.crm_limit ?? 3} clientes em uso` : "…"}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Input type="number" inputMode="numeric" min={0} max={100} value={packsValue}
                                  onChange={(e) => setPacks(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                                  className="h-9 w-20" />
                                <span className="text-[11px] font-body text-muted-foreground flex-1 min-w-0">pacotes de cortesia (10 cada)</span>
                                <Button size="sm" onClick={() => setPacksMutation.mutate()} disabled={setPacksMutation.isPending}>
                                  {setPacksMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Salvar
                                </Button>
                              </div>
                              {(modulesData?.paid_client_packs ?? 0) > 0 && (
                                <p className="text-[10.5px] font-body text-muted-foreground mt-1.5">+ {modulesData?.paid_client_packs} pacote(s) pago(s) no Stripe, que entram sozinhos.</p>
                              )}
                            </Cartao>
                            <Cartao className="min-w-0">
                              <p className="text-[13px] font-body font-bold">Contas Cria pra clientes</p>
                              <p className="text-[11.5px] font-body text-muted-foreground">
                                {modulesData ? `${modulesData.seats_used ?? 0} de ${modulesData.seat_limit ?? 0} em uso` : "…"}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Input type="number" inputMode="numeric" min={0} max={200} value={seatsValue}
                                  onChange={(e) => setSeats(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                                  className="h-9 w-20" />
                                <span className="text-[11px] font-body text-muted-foreground flex-1 min-w-0">assentos</span>
                                <Button size="sm" onClick={() => setSeatsMutation.mutate()} disabled={setSeatsMutation.isPending}>
                                  {setSeatsMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Salvar
                                </Button>
                              </div>
                              <p className="text-[10.5px] font-body text-muted-foreground mt-1.5">Login próprio pro cliente dela, em "Suas contas". Não é a carteira do CRM.</p>
                            </Cartao>
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 sm:px-6 py-3 border-t border-border bg-muted/30 text-[11px] font-body text-muted-foreground">
                <span>Técnico: role <b className="text-foreground">{data.role ?? "-"}</b></span>
                <span>status <b className="text-foreground">{data.subscription_status ?? "-"}</b></span>
                <span>id {data.id.slice(0, 8)}…</span>
                <span className="ml-auto"><Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button></span>
              </div>
            </>
          ) : null}
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
            <AlertDialogAction className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => { e.preventDefault(); wipeMutation.mutate(); }} disabled={wipeMutation.isPending}>
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
