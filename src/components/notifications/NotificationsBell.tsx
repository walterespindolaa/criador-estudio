import { useEffect, useState } from "react";
import { Bell, Trophy, Lightbulb, CheckCircle2, Flame, UserPlus, Clock, Trash2, Package, Clapperboard, Handshake, CalendarDays, FileText, Video, Cake, MessageCircle, Sun, ShieldAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
};

// Cada tipo cai numa categoria; a ordem define como aparecem no painel.
const CATEGORY: Record<string, string> = {
  lead: "Leads",
  cria_post: "Cliente / Cria Post",
  material: "Cliente / Cria Post",
  posts_pendentes: "Lembretes",
  lembrete_postar: "Lembretes",
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
};
const CATEGORY_ORDER = [
  "Leads", "Cliente / Cria Post", "Lembretes", "Ganchos & dicas", "Conquistas", "Ideias", "Avisos", "Outras",
];
const categoryOf = (type: string) => CATEGORY[type] ?? "Outras";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function NotificationsBell() {
  const { user } = useAuth();
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

  const renderItem = (n: Notification) => {
    const typeInfo = TYPE_ICONS[n.type] || TYPE_ICONS.lembrete_postar;
    const Icon = typeInfo.icon;
    return (
      <div
        key={n.id}
        onClick={() => markAsRead.mutate(n.id)}
        className={`group/item w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
          n.read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
        }`}
      >
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${typeInfo.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body font-medium text-foreground">{n.title}</p>
          {n.description && <p className="text-xs text-muted-foreground font-body mt-0.5">{n.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">
            {n.created_at ? timeAgo(n.created_at) : ""}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteOne.mutate(n.id);
            }}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderList = (items: Notification[]) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground font-body text-center py-8">Nenhuma notificação</p>;
    }
    const groups = new Map<string, Notification[]>();
    for (const n of items) {
      const cat = categoryOf(n.type);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(n);
    }
    const ordered = CATEGORY_ORDER.filter((c) => groups.has(c));
    return (
      <div className="space-y-3 max-h-[360px] overflow-y-auto">
        {ordered.map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-body font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">
              {cat}
            </p>
            <div className="space-y-1">{groups.get(cat)!.map(renderItem)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"} className="relative p-2 hover:bg-accent/60 rounded-xl transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-1rem))] p-0" align="end" collisionPadding={8}>
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-foreground text-sm">Notificações</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-xs text-primary h-auto py-1 px-2" onClick={handleMarkAllRead}>
              Marcar lidas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive h-auto py-1 px-2"
              onClick={handleClearAll}
            >
              Limpar
            </Button>
          </div>
        </div>
        <Tabs defaultValue="todas" className="p-3">
          <TabsList className="bg-muted rounded-lg mb-2 w-full">
            <TabsTrigger value="todas" className="flex-1 rounded-md font-body text-xs">Todas</TabsTrigger>
            <TabsTrigger value="nao-lidas" className="flex-1 rounded-md font-body text-xs">Não lidas</TabsTrigger>
          </TabsList>
          <TabsContent value="todas">{renderList(notifications)}</TabsContent>
          <TabsContent value="nao-lidas">{renderList(notifications.filter((n) => !n.read))}</TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
