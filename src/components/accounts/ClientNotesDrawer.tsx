import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bold, Italic, List, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string | null;
  clientName?: string | null;
};

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ClientNotesDrawer({ open, onOpenChange, ownerId, clientName }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    if (!open || !ownerId) return;
    setLoading(true);
    (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: string | null; error: unknown }>)(
      "get_manager_notes",
      { _owner_id: ownerId },
    )
      .then(({ data, error }) => {
        if (error) {
          console.error("[notes] load failed:", error);
          toast.error("Não foi possível carregar as notas.");
          return;
        }
        const html = (data as string | null) ?? "";
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          setHasContent(html.length > 0 && (editorRef.current.textContent ?? "").trim().length > 0);
        }
        lastSavedRef.current = html;
      })
      .finally(() => setLoading(false));
  }, [open, ownerId]);

  useEffect(() => {
    if (!open && debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [open]);

  const saveNow = async (html: string) => {
    if (!ownerId || html === lastSavedRef.current) return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ error: unknown }>)(
        "set_manager_notes",
        { _owner_id: ownerId, _html: html },
      );
      if (error) throw error;
      lastSavedRef.current = html;
      toast.success("Notas salvas");
    } catch (e) {
      console.error("[notes] save failed:", e);
      toast.error("Erro ao salvar as notas.");
    } finally {
      setSaving(false);
    }
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? "";
    setHasContent((editorRef.current?.textContent ?? "").trim().length > 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNow(html), 800);
  };

  const cmd = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl min-h-[60vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Notas
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription className="font-body text-sm">
            {clientName ? <>Sobre <b className="text-foreground">{clientName}</b></> : "Sobre o cliente"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card flex flex-col flex-1 min-h-[300px] overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
                <ToolbarButton onClick={() => cmd("bold")} label="Negrito"><Bold className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => cmd("italic")} label="Itálico"><Italic className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton onClick={() => cmd("insertUnorderedList")} label="Lista"><List className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="relative flex-1 overflow-y-auto">
                {!hasContent && (
                  <p className="absolute top-3 left-3 text-sm text-muted-foreground font-body pointer-events-none">
                    Anote infos do cliente, próximos passos, ideias, contatos…
                  </p>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleInput}
                  className="cria-notes-editor outline-none px-3 py-3 text-sm font-body text-foreground leading-relaxed min-h-full"
                  style={{ wordBreak: "break-word" }}
                  suppressContentEditableWarning
                />
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground font-body mt-2 shrink-0">
            As notas são salvas automaticamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
