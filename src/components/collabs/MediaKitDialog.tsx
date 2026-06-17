import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Check, Loader2, ExternalLink, Trash2 } from "lucide-react";

const CANVA_URL = "https://canva.link/4107g68sk2cn10g";

export function MediaKitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const currentUrl = (profile as { media_kit_url?: string | null } | null)?.media_kit_url ?? null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.type !== "application/pdf") { toast.error("Envie um arquivo PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("O PDF deve ter no máximo 10 MB."); return; }
    setUploading(true);
    try {
      const path = `${user.id}/media-kit.pdf`;
      const up = await supabase.storage.from("bio-media").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("bio-media").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      await updateProfile.mutateAsync({ media_kit_url: url } as never);
      toast.success("Mídia kit salvo!");
    } catch {
      toast.error("Erro ao subir o PDF.");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!user) return;
    try {
      await supabase.storage.from("bio-media").remove([`${user.id}/media-kit.pdf`]);
      await updateProfile.mutateAsync({ media_kit_url: null } as never);
      toast.success("Mídia kit removido.");
    } catch {
      toast.error("Erro ao remover.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Seu Mídia Kit</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">Uma apresentação dos seus trabalhos que vai junto em cada proposta.</p>

        <div className="space-y-3 mt-1">
          {/* passo 1 */}
          <div className="flex gap-3 p-3.5 rounded-2xl border border-border">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Edite no Canva</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">Abra o modelo, duplique e personalize. Depois baixe em PDF (Compartilhar → Baixar → PDF).</p>
              <a href={CANVA_URL} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" className="rounded-xl h-9 gap-2 text-xs"><ExternalLink className="h-3.5 w-3.5" /> Abrir modelo no Canva</Button>
              </a>
            </div>
          </div>
          {/* passo 2 */}
          <div className="flex gap-3 p-3.5 rounded-2xl border border-border">
            <div className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold flex-shrink-0 ${currentUrl ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>{currentUrl ? <Check className="h-3.5 w-3.5" /> : "2"}</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Suba o PDF</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">Envie o PDF que você baixou. Ele aparece em toda proposta.</p>
              {currentUrl ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                  <FileText className="h-4 w-4 text-green-700 flex-shrink-0" />
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-green-700 truncate flex-1">Mídia kit atual (ver)</a>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-muted-foreground hover:text-primary">Trocar</button>
                  <button type="button" onClick={remove} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-xl h-9 gap-2 text-xs">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Subir PDF
                </Button>
              )}
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFile} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
