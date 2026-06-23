import { useState } from "react";
import { useBroadcastsAdmin } from "@/hooks/useBroadcasts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = [
  { value: "info", label: "Informação" },
  { value: "aviso", label: "Aviso" },
  { value: "novidade", label: "Novidade" },
];

export function AdminRecados() {
  const { broadcasts, isLoading, create, setActive, remove } = useBroadcastsAdmin();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [audience, setAudience] = useState("todos");

  const send = async () => {
    if (!message.trim()) return;
    await create.mutateAsync({ title: title.trim() || null, message: message.trim(), level, audience });
    setTitle(""); setMessage(""); setLevel("info"); setAudience("todos");
  };

  const AUD_LABEL: Record<string, string> = { todos: "Todos", criadora: "Criadoras", social: "Social mídia" };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display font-bold text-foreground flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Novo recado</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Nova função no ar!" className="rounded-xl" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Enviar para</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="rounded-xl sm:w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos (criadoras + social mídia)</SelectItem>
              <SelectItem value="criadora">Só criadoras</SelectItem>
              <SelectItem value="social">Só social mídia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mensagem</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="O que você quer avisar pros usuários?" className="rounded-xl" maxLength={500} />
        </div>
        <div className="flex justify-end">
          <Button onClick={send} disabled={!message.trim() || create.isPending} className="gap-1.5">
            <Send className="h-4 w-4" /> {create.isPending ? "Enviando…" : "Enviar pra todos"}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-display font-semibold text-foreground mb-2">Recados enviados</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground font-body py-4">Carregando…</p>
        ) : broadcasts.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body py-4">Nenhum recado ainda.</p>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div key={b.id} className={cn("rounded-xl border p-3 flex items-start gap-3", b.active ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card opacity-70")}>
                <div className="min-w-0 flex-1">
                  {b.title && <p className="text-sm font-semibold text-foreground">{b.title}</p>}
                  <p className="text-sm text-muted-foreground break-words">{b.message}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{new Date(b.created_at).toLocaleString("pt-BR")} · {AUD_LABEL[b.audience] ?? "Todos"} · {b.active ? "ativo" : "inativo"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={b.active} onCheckedChange={(v) => setActive.mutate({ id: b.id, active: v })} />
                  <button onClick={() => { if (confirm("Excluir este recado?")) remove.mutate(b.id); }} className="text-destructive p-1 rounded-lg hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
