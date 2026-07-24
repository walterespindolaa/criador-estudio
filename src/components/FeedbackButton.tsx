import { useRef, useState } from "react";
import { MessageSquarePlus, Paperclip, X, Loader2, FileVideo } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendFeedback } from "@/hooks/useFeedback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = [
  { v: "ideia", l: "Ideia / sugestão" },
  { v: "bug", l: "Reportar um problema" },
  { v: "outro", l: "Outro" },
];

// Limite do anexo. O arquivo vai pro bucket SEPARADO 'feedback' (não conta na
// cota de armazenamento do usuário, que só soma linhas da tabela 'files').
const MAX_ATTACHMENT = 25 * 1024 * 1024; // 25 MB

// Diálogo controlado de feedback. Pode ser aberto pelo botão do desktop
// (HeroBand) ou por um item dos menus mobile (dock/rodapé). `origin` marca de
// onde a pessoa enviou (gestor | usuario) pro admin saber quem falou.
export function FeedbackDialog({
  open,
  onOpenChange,
  origin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  origin?: string;
}) {
  const [type, setType] = useState("ideia");
  const [message, setMessage] = useState("");
  const send = useSendFeedback();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Anexo (1 arquivo). O upload é imediato ao escolher; guardamos a URL pública
  // + o caminho (pra poder apagar se a pessoa remover) + o tipo (image | video).
  const [attUrl, setAttUrl] = useState<string | null>(null);
  const [attPath, setAttPath] = useState<string | null>(null);
  const [attType, setAttType] = useState<"image" | "video" | null>(null);
  const [attName, setAttName] = useState("");
  const [attPreview, setAttPreview] = useState<string | null>(null); // objectURL local da imagem
  const [uploading, setUploading] = useState(false);

  // Limpa o estado do anexo (e o objectURL da prévia) sem apagar do Storage.
  const resetAttachment = () => {
    if (attPreview) URL.revokeObjectURL(attPreview);
    setAttUrl(null); setAttPath(null); setAttType(null); setAttName(""); setAttPreview(null);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // permite reescolher o mesmo arquivo
    if (!file) return;
    if (!user) { toast.error("Sua sessão expirou. Entre de novo pra anexar."); return; }

    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { toast.error("Anexe uma imagem ou um vídeo."); return; }
    if (file.size > MAX_ATTACHMENT) {
      toast.error("Arquivo muito grande. O limite é 25 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || (isVid ? "mp4" : "jpg"))
        .toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || (isVid ? "mp4" : "jpg");
      // Caminho por usuário/uuid no bucket SEPARADO 'feedback'.
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("feedback").upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const publicUrl = supabase.storage.from("feedback").getPublicUrl(path).data.publicUrl;
      resetAttachment();
      setAttUrl(publicUrl);
      setAttPath(path);
      setAttType(isImg ? "image" : "video");
      setAttName(file.name);
      setAttPreview(isImg ? URL.createObjectURL(file) : null);
    } catch {
      toast.error("Não consegui anexar o arquivo. Tente de novo.");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async () => {
    const path = attPath;
    resetAttachment();
    if (path) { try { await supabase.storage.from("feedback").remove([path]); } catch { /* ignora */ } }
  };

  const submit = async () => {
    if (!message.trim()) return;
    await send.mutateAsync({
      type, message: message.trim(), origin,
      attachmentUrl: attUrl ?? undefined,
      attachmentType: attType ?? undefined,
    });
    resetAttachment();
    setMessage(""); setType("ideia"); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-lg">
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

          {/* Anexo: print, imagem ou vídeo (opcional). */}
          <div className="space-y-1.5">
            <Label className="text-xs">Anexo (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={onPickFile}
            />
            {!attUrl && !uploading && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                Anexar print ou vídeo
              </button>
            )}
            {uploading && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando anexo…
              </div>
            )}
            {attUrl && !uploading && (
              <div className="flex items-center gap-2 rounded-xl border border-border p-2">
                {attType === "image" && attPreview ? (
                  <img src={attPreview} alt="Prévia do anexo" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileVideo className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs text-foreground truncate flex-1">{attName}</span>
                <button
                  type="button"
                  onClick={removeAttachment}
                  aria-label="Remover anexo"
                  className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/70">Imagem ou vídeo, até 25 MB.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!message.trim() || send.isPending || uploading}>{send.isPending ? "Enviando…" : "Enviar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackButton({ className, origin }: { className?: string; origin?: string }) {
  const [open, setOpen] = useState(false);

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

      <FeedbackDialog open={open} onOpenChange={setOpen} origin={origin} />
    </>
  );
}
