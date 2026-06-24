import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExternalClients } from "@/hooks/useCriaPost";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS } from "@/lib/constants";
import { CLIENT_COLORS } from "@/components/accounts/CriaPostBoard";
import { BestTimesHint } from "@/components/shared/BestTimesHint";
import { toast } from "sonner";

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type CalPost = {
  id: string; title: string; format: string; platform: string;
  external_client_id: string; scheduled_date: string | null; scheduled_time: string | null;
  approval_status: string | null;
};

const dkey = (d: Date) => format(d, "yyyy-MM-dd");

export function ManagerCalendar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { clients } = useExternalClients();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c, i) => { map[c.id] = c.color || CLIENT_COLORS[i % CLIENT_COLORS.length]; });
    return map;
  }, [clients]);
  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [clients]);

  const { data: posts = [] } = useQuery({
    queryKey: ["manager-calendar", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id, title, format, platform, external_client_id, scheduled_date, scheduled_time, approval_status")
        .eq("user_id", user!.id)
        .not("external_client_id", "is", null);
      if (error) throw error;
      return (data as CalPost[]) ?? [];
    },
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string | null; time?: string | null }) => {
      const patch: Record<string, unknown> = { scheduled_date: date };
      if (time !== undefined) patch.scheduled_time = time;
      const { error } = await sbFrom("posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager-calendar", user?.id] }),
    onError: () => toast.error("Erro ao atualizar."),
  });

  const visible = (p: CalPost) => !hidden.has(p.external_client_id);
  const byDay = useMemo(() => {
    const map: Record<string, CalPost[]> = {};
    for (const p of posts) {
      if (!p.scheduled_date || !visible(p)) continue;
      (map[p.scheduled_date] ??= []).push(p);
    }
    return map;
  }, [posts, hidden]);
  const unscheduled = posts.filter((p) => !p.scheduled_date && visible(p));

  // Grid: 6 semanas a partir do domingo da semana do dia 1.
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const onDrop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) reschedule.mutate({ id, date });
  };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const toggleClient = (id: string) =>
    setHidden((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const chip = (p: CalPost) => {
    const color = colorOf[p.external_client_id] ?? "#8B5CF6";
    return (
      <Popover key={p.id}>
        <PopoverTrigger asChild>
          <div
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
            className="cursor-grab active:cursor-grabbing rounded-md px-1.5 py-1 mb-1 text-[10px] leading-tight truncate"
            style={{ backgroundColor: `${color}1a`, borderLeft: `3px solid ${color}` }}
            title={`${nameOf[p.external_client_id] ?? ""} · ${p.title}`}
          >
            {p.scheduled_time && <span className="font-semibold mr-1">{p.scheduled_time.slice(0, 5)}</span>}
            {p.title}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div>
            <p className="text-xs font-display font-bold text-foreground truncate">{p.title}</p>
            <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: color }} />
              {nameOf[p.external_client_id] ?? "Cliente"} · {FORMAT_LABELS[p.format] ?? p.format}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-body text-muted-foreground uppercase tracking-wide">Data</label>
              <input type="date" defaultValue={p.scheduled_date ?? ""}
                onChange={(e) => reschedule.mutate({ id: p.id, date: e.target.value || null })}
                className="w-full mt-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-body text-muted-foreground uppercase tracking-wide">Hora</label>
              <input type="time" defaultValue={p.scheduled_time?.slice(0, 5) ?? ""}
                onChange={(e) => reschedule.mutate({ id: p.id, date: p.scheduled_date, time: e.target.value || null })}
                className="w-full mt-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </div>
          </div>
          <BestTimesHint platform={p.platform} onPick={(t) => reschedule.mutate({ id: p.id, date: p.scheduled_date, time: t })} />
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-destructive"
            onClick={() => reschedule.mutate({ id: p.id, date: null })}>
            Tirar do calendário
          </Button>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Calendário</h1>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-display font-semibold text-foreground min-w-[140px] text-center capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
        </div>
      </div>

      {/* Filtro por cliente (cor) */}
      {clients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {clients.map((c) => {
            const color = colorOf[c.id];
            const off = hidden.has(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleClient(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${off ? "opacity-40 border-border" : "border-border"}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* A agendar */}
      <div
        onDrop={onDrop(null)} onDragOver={allowDrop}
        className="rounded-xl border border-dashed border-border bg-card/50 p-3"
      >
        <p className="text-[11px] uppercase tracking-wider font-display font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> A agendar ({unscheduled.length})
        </p>
        {unscheduled.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body">Tudo agendado. Arraste um post pra cá pra desagendar.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((p) => (
              <div key={p.id} className="min-w-[120px] max-w-[200px]">{chip(p)}</div>
            ))}
          </div>
        )}
      </div>

      {/* Grade do mês */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-[11px] font-body font-semibold text-muted-foreground text-center py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            const list = byDay[dkey(d)] ?? [];
            return (
              <div key={d.toISOString()}
                onDrop={onDrop(dkey(d))} onDragOver={allowDrop}
                className={`min-h-[92px] border-b border-r border-border p-1.5 ${inMonth ? "" : "bg-muted/20"}`}
              >
                <div className={`text-[11px] font-body mb-1 ${today ? "font-bold text-primary" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {format(d, "d")}
                </div>
                {list.map(chip)}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground font-body flex items-center gap-1.5">
        <Clock className="h-3 w-3" /> Arraste os posts entre os dias pra remarcar. Clique num post pra ajustar data e horário.
      </p>
    </div>
  );
}
