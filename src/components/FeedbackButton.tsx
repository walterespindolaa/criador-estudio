import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendFeedback } from "@/hooks/useFeedback";
import { cn } from "@/lib/utils";

const TYPES = [
  { v: "ideia", l: "Ideia / sugestão" },
  { v: "bug", l: "Reportar um problema" },
  { v: "outro", l: "Outro" },
];

export function FeedbackButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("ideia");
  const [message, setMessage] = useState("");
  const send = useSendFeedback();

  const submit = async () => {
    if (!message.trim()) return;
    await send.mutateAsync({ type, message: message.trim() });
    setMessage(""); setType("ideia"); setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Enviar feedback"
        aria-label="Enviar feedback"
        className={cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
          className,
        )}
      >
        <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">Enviar feedback</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sua mensagem</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Conte o que achou, uma ideia ou um problema que encontrou…" className="rounded-xl" maxLength={1000} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!message.trim() || send.isPending}>{send.isPending ? "Enviando…" : "Enviar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
