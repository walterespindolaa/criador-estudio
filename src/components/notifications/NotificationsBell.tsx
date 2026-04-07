import { useEffect, useState } from "react";
import { Bell, Trophy, Lightbulb, CheckCircle2, Flame, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateNotifications } from "@/lib/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  meta_batida: { icon: Trophy, color: "text-yellow-500" },
  ideia_criada: { icon: Lightbulb, color: "text-primary" },
  post_publicado: { icon: CheckCircle2, color: "text-secondary" },
  habito_semana: { icon: Flame, color: "text-orange-500" },
  lembrete_postar: { icon: Bell, color: "text-primary" },
};

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data as any[]) || []);
  };

  useEffect(() => {
    if (!user) return;
    generateNotifications(user.id).then(() => fetchNotifications());
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const renderList = (items: Notification[]) => (
    <div className="space-y-1 max-h-[360px] overflow-y-auto">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground font-body text-center py-8">Nenhuma notificação</p>
      )}
      {items.map(n => {
        const typeInfo = TYPE_ICONS[n.type] || TYPE_ICONS.lembrete_postar;
        const Icon = typeInfo.icon;
        return (
          <button
            key={n.id}
            onClick={() => markAsRead(n.id)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${
              n.read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
            }`}
          >
            <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${typeInfo.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-medium text-foreground">{n.title}</p>
              {n.description && <p className="text-xs text-muted-foreground font-body mt-0.5">{n.description}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">{timeAgo(n.created_at)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-accent/60 rounded-xl transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground text-sm">Notificações</h3>
          <Button variant="ghost" size="sm" className="text-xs text-primary h-auto py-1" onClick={markAllRead}>
            Marcar todas como lidas
          </Button>
        </div>
        <Tabs defaultValue="todas" className="p-3">
          <TabsList className="bg-muted rounded-lg mb-2 w-full">
            <TabsTrigger value="todas" className="flex-1 rounded-md font-body text-xs">Todas</TabsTrigger>
            <TabsTrigger value="nao-lidas" className="flex-1 rounded-md font-body text-xs">Não lidas</TabsTrigger>
          </TabsList>
          <TabsContent value="todas">{renderList(notifications)}</TabsContent>
          <TabsContent value="nao-lidas">{renderList(notifications.filter(n => !n.read))}</TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
