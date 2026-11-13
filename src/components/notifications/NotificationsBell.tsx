import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Trophy, Lightbulb, CheckCircle2, CheckCheck, ChevronRight, X, Flame, UserPlus, Clock, Package, Clapperboard, Handshake, CalendarDays, FileText, Video, Cake, MessageCircle, Sun, ShieldAlert, Wallet, Target } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { generateNotifications } from "@/lib/notifications";
import { confirmar } from "@/components/shared/Confirm";

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  lead: { icon: UserPlus, color: "text-green-600" },
  cria_post: { icon: CheckCircle2, color: "text-secondary" },
  material: { icon: Package, color: "text-primary" },
  meta_batida: { icon: Trophy, color: "text-yellow-500" },
  ideia_criada: { icon: Lightbulb, color: "text-primary" },
  post_publicado: { icon: CheckCircle2, color: "text-secondary" },
  habito_semana: { icon: Flame, color: "text-orange-500" },
  dica_dia: { icon: Lightbulb, color: "text-primary" },
  posts_pendentes: { icon: Bell, color: "text-primary" },
  lembrete_postar: { icon: Bell, color: "text-primary" },
  meta_semana: { icon: Target, color: "text-orange-500" },
  volte: { icon: Flame, color: "text-orange-500" },
  acesso_vencendo: { icon: Clock, color: "text-destructive" },
  // Tipos que já eram gerados mas caíam no ícone genérico (pente fino 04/09).
  story: { icon: Clapperboard, color: "text-pink-600" },
  collab: { icon: Handshake, color: "text-violet-600" },
  cronograma: { icon: CalendarDays, color: "text-secondary" },
  roteiro: { icon: FileText, color: "text-secondary" },
  captacao_amanha: { icon: Video, color: "text-primary" },
  aniversario_cliente: { icon: Cake, color: "text-pink-600" },
  comentario_cliente: { icon: MessageCircle, color: "text-secondary" },
  resumo_dia: { icon: Sun, color: "text-amber-500" },
  prazo_amanha: { icon: Clock, color: "text-orange-500" },
  resumo_semana_ig: { icon: Trophy, color: "text-pink-600" },
  aprovacao_pendente: { icon: CheckCircle2, color: "text-primary" },
  cliente_atrasado: { icon: Clock, color: "text-destructive" },
  renovacao_cliente: { icon: CalendarDays, color: "text-secondary" },
  parceiro: { icon: Handshake, color: "text-violet-600" },
  sistema: { icon: ShieldAlert, color: "text-destructive" },
  // Cria Parceiros (fase 3)
  demanda_nova: { icon: Clapperboard, color: "text-violet-600" },
  demanda_ajuste: { icon: MessageCircle, color: "text-orange-500" },
  demanda_prazo: { icon: CalendarDays, color: "text-violet-600" },
  demanda_prazo_amanha: { icon: Clock, color: "text-orange-500" },
  demanda_entregue: { icon: CheckCircle2, color: "text-green-600" },
  demanda_comentario: { icon: MessageCircle, color: "text-violet-600" },
  demanda_atrasada: { icon: Clock, color: "text-destructive" },
  cache_aviso: { icon: Wallet, color: "text-amber-600" },
  cache_pago: { icon: Wallet, color: "text-green-600" },
  // Cliente pediu um horário de captação pelo link (19/10/2026).
  captacao_pedido: { icon: CalendarDays, color: "text-blue-600" },
};

// Cada tipo cai numa categoria; a ordem define como aparecem no painel.
const CATEGORY: Record<string, string> = {
  lead: "Leads",
  cria_post: "Cliente / Cria Post",
  material: "Cliente / Cria Post",
  posts_pendentes: "Lembretes",
  lembrete_postar: "Lembretes",
  meta_semana: "Lembretes",
  dica_dia: "Ganchos & dicas",
  meta_batida: "Conquistas",
  habito_semana: "Conquistas",
  post_publicado: "Conquistas",
  ideia_criada: "Ideias",
  volte: "Avisos",
  acesso_vencendo: "Avisos",
  story: "Lembretes",
  captacao_amanha: "Lembretes",
  resumo_dia: "Lembretes",
  prazo_amanha: "Lembretes",
  resumo_semana_ig: "Lembretes",
  aprovacao_pendente: "Cliente / Cria Post",
  cliente_atrasado: "Cliente / Cria Post",
  renovacao_cliente: "Cliente / Cria Post",
  aniversario_cliente: "Lembretes",
  cronograma: "Cliente / Cria Post",
  roteiro: "Cliente / Cria Post",
  comentario_cliente: "Cliente / Cria Post",
  collab: "Avisos",
  parceiro: "Avisos",
  sistema: "Avisos",
  /* PRODUÇÃO É UMA CATEGORIA PRÓPRIA (Walter, 14/09/2026).
     Tudo que envolve parceiro caía em "Cliente / Cria Post", junto com aprovação
     e comentário de cliente. Pro designer, que só recebe demanda, o painel
     inteiro virava uma categoria só, e pra social mídia o recado do freela se
     misturava com o recado do cliente. São duas conversas diferentes. */
  demanda_nova: "Produção",
  demanda_ajuste: "Produção",
  demanda_prazo: "Produção",
  demanda_prazo_amanha: "Produção",
  demanda_atrasada: "Produção",
  demanda_entregue: "Produção",
  demanda_comentario: "Produção",
  cache_aviso: "Produção",
  cache_pago: "Cachês",
  captacao_pedido: "Cliente / Cria Post",
};
const CATEGORY_ORDER = [
  "Leads", "Produção", "Cliente / Cria Post", "Lembretes", "Ganchos & dicas", "Conquistas", "Ideias", "Avisos", "Outras",
];
const categoryOf = (type: string) => CATEGORY[type] ?? "Outras";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/* PAINEL REPAGINADO (Walter, 13/11/2026: "essas notificações tão bem zoadas").
   O que mudou:
   - agrupa por DIA (Hoje, Ontem, Esta semana, Antes), que é como a pessoa lê
     aviso. A categoria virou a cor da bolinha do ícone.
   - lembrete repetido aparece UMA vez: cinco "você tem N posts em andamento"
     de cinco dias viravam cinco linhas iguais. Fica o mais recente.
   - não lida tem ponto e fundo; lida fica limpa (antes ficava apagada a 60%).
   - quem leva a algum lugar mostra a seta; a lixeira não disputa com o texto.
   A parte visual mora aqui, sem dados, pra poder ser conferida sozinha. */
const COR_TIPO: Record<string, string> = {
  "Lembretes": "bg-[#FFF1CC] text-[#8A5A00]",
  "Ganchos & dicas": "bg-[#FFE0D4] text-[#C23A10]",
  "Conquistas": "bg-[#D9F2E2] text-[#0A7A3D]",
  "Cliente / Cria Post": "bg-[#DCE8FF] text-[#0B4FC2]",
  "Produção": "bg-[#E9E2FF] text-[#5B3FD0]",
  "Cachês": "bg-[#D9F2E2] text-[#0A7A3D]",
  "Leads": "bg-[#D9F2E2] text-[#0A7A3D]",
  "Ideias": "bg-[#FFE0D4] text-[#C23A10]",
  "Avisos": "bg-[#FFDCE9] text-[#B0246A]",
  "Outras": "bg-muted text-muted-foreground",
};
// Lembretes que o app refaz todo dia: só o mais recente de cada tipo aparece.
const SO_O_MAIS_RECENTE = new Set(["posts_pendentes", "lembrete_postar", "dica_dia", "meta_semana", "resumo_dia"]);

function grupoDoDia(iso: string | null) {
  if (!iso) return "Antes";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - d.getTime()) / 86400000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias <= 7) return "Esta semana";
  return "Antes";
}
const ORDEM_DIAS = ["Hoje", "Ontem", "Esta semana", "Antes"];

export function PainelNotificacoes({
  notifications, unreadCount, onAbrir, onExcluir, onMarcarLidas, onLimpar,
}: {
  notifications: Notification[];
  unreadCount: number;
  onAbrir: (n: Notification) => void;
  onExcluir: (id: string) => void;
  onMarcarLidas: () => void;
  onLimpar: () => void;
}) {
  const [aba, setAba] = useState<"todas" | "novas">("todas");

  // Uma linha por lembrete diário (a lista já vem da mais nova pra mais antiga).
  const vistos = new Set<string>();
  const enxuta = notifications.filter((n) => {
    if (!SO_O_MAIS_RECENTE.has(n.type)) return true;
    if (vistos.has(n.type)) return false;
    vistos.add(n.type);
    return true;
  });
  const lista = aba === "novas" ? enxuta.filter((n) => !n.read) : enxuta;
  const grupos = new Map<string, Notification[]>();
  for (const n of lista) {
    const g = grupoDoDia(n.created_at);
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(n);
  }

  return (
    <div>
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-display font-extrabold text-foreground text-[17px] leading-none">Notificações</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-body font-bold leading-4 text-primary-foreground whitespace-nowrap">
              {unreadCount > 99 ? "99+" : unreadCount} {unreadCount === 1 ? "nova" : "novas"}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button type="button" onClick={onLimpar} className="shrink-0 text-xs font-body text-muted-foreground hover:text-destructive px-1.5 py-1 rounded-md">
            Limpar tudo
          </button>
        )}
      </div>

      <div className="px-4 pb-2.5 flex items-center justify-between gap-2">
        <div role="tablist" className="flex gap-1.5">
          {([["todas", "Todas"], ["novas", "Não lidas"]] as const).map(([k, rot]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={cn("h-8 px-3.5 rounded-full text-xs font-body font-bold border transition-colors",
                aba === k ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-foreground/15 hover:bg-muted")}>
              {rot}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={onMarcarLidas} className="shrink-0 inline-flex items-center gap-1 text-xs font-body font-bold text-primary px-1.5 py-1 rounded-md hover:bg-primary/10">
            <CheckCheck className="h-3.5 w-3.5" /> Marcar lidas
          </button>
        )}
      </div>

      <div className="max-h-[min(440px,60vh)] overflow-y-auto overscroll-contain px-2 pb-2 border-t border-foreground/10">
        {lista.length === 0 ? (
          <div className="py-10 px-6 text-center">
            <span className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-full bg-[#D9F2E2] text-[#0A7A3D]"><CheckCheck className="h-5 w-5" /></span>
            <p className="text-sm font-display font-bold text-foreground">{aba === "novas" ? "Você leu tudo" : "Tudo em dia por aqui"}</p>
            <p className="mt-0.5 text-xs font-body text-muted-foreground">Quando tiver novidade, ela aparece neste sino.</p>
          </div>
        ) : ORDEM_DIAS.filter((g) => grupos.has(g)).map((g) => (
          <div key={g}>
            <p className="px-2 pt-3 pb-1 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">{g}</p>
            <div className="space-y-0.5">
              {grupos.get(g)!.map((n) => {
                const typeInfo = TYPE_ICONS[n.type] || TYPE_ICONS.lembrete_postar;
                const Icon = typeInfo.icon;
                const cor = COR_TIPO[categoryOf(n.type)] ?? COR_TIPO["Outras"];
                return (
                  <div
                    key={n.id}
                    role={n.link ? "button" : undefined}
                    tabIndex={n.link ? 0 : undefined}
                    onClick={() => onAbrir(n)}
                    onKeyDown={(e) => { if (n.link && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrir(n); } }}
                    className={cn("group/item relative flex items-start gap-3 rounded-2xl p-2.5 pr-2 transition-colors cursor-pointer",
                      n.read ? "hover:bg-muted/60" : "bg-primary/[0.06] hover:bg-primary/10")}
                  >
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", cor)}><Icon className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[14px] leading-snug font-body text-foreground", n.read ? "font-medium" : "font-bold")}>{n.title}</p>
                      {n.description && <p className="mt-0.5 text-[12.5px] leading-snug font-body text-muted-foreground">{n.description}</p>}
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-body text-muted-foreground">
                        {!n.read && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        {n.created_at ? timeAgo(n.created_at) : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1 self-stretch justify-between">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onExcluir(n.id); }}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/45 hover:text-destructive hover:bg-destructive/10 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity"
                        aria-label="Excluir notificação"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {n.link && <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground/50" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteOne, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  // Mesmo padrão do resto do app (ManagerLayout/App): conta gestor/agência.
  const isManager = profile?.account_type === "manager" || (profile?.seat_limit ?? 0) > 0;

  useEffect(() => {
    if (!user) return;
    generateNotifications(user.id, { isManager });
  }, [user, isManager]);

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    markAllAsRead.mutate();
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (await confirmar({ titulo: "Limpar todas as notificações?", descricao: "Isso não dá pra desfazer.", acao: "Limpar" })) {
      clearAll.mutate();
    }
  };

  /* CLICAR NA NOTIFICAÇÃO LEVA AO LUGAR CERTO (Walter, 14/09/2026).
     O campo `link` existe desde o começo e era gravado por todos os gatilhos,
     mas o clique só marcava como lida: o aviso dizia "fulano entregou tal peça"
     e a pessoa tinha que caçar a peça na mão, num quadro de 40 cards. Aviso que
     não leva a lugar nenhum é ruído, não é aviso.
     Fecha o painel antes de navegar, senão o popover fica preso por cima da
     tela nova. */
  const abrir = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (!n.link) return;
    setOpen(false);
    navigate(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"} className="relative p-2 hover:bg-accent/60 rounded-xl transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-1rem))] p-0 rounded-[22px] border border-foreground/15 overflow-hidden" align="end" collisionPadding={8}>
        <PainelNotificacoes
          notifications={notifications}
          unreadCount={unreadCount}
          onAbrir={abrir}
          onExcluir={(id) => deleteOne.mutate(id)}
          onMarcarLidas={handleMarkAllRead}
          onLimpar={handleClearAll}
        />
      </PopoverContent>
    </Popover>
  );
}
