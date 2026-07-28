import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { validateUpload } from "@/lib/upload-validation";
import { sanitizeText } from "@/lib/sanitize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Editor enxuto da "vitrine" do feed: mexe so nos campos que aparecem no
// cabecalho (foto, nome, nicho, bio). Ajustes completos ficam em Configuracoes.
// Salva via useProfile.updateProfile, que compartilha a mesma query key do Feed,
// entao o cabecalho reflete a mudanca na hora.
export function FeedEditProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  // Marca que os campos ja foram semeados nesta abertura do dialog. Sem isso,
  // qualquer mudanca do profile (ex.: trocar a foto atualiza a query) re-semeava
  // name/niche/bio com os valores antigos do banco e apagava o que a pessoa digitou.
  const seededRef = useRef(false);

  // Semeia os campos UMA vez por abertura do dialog, nunca a cada mudanca do
  // profile. Reabrir o dialog reseta a flag e volta a semear com os valores atuais.
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    // Espera o profile carregar antes de semear (evita semear vazio na corrida
    // de abertura) e so semeia uma vez por abertura.
    if (seededRef.current || !profile) return;
    seededRef.current = true;
    setName(profile?.name || "");
    setNiche(profile?.niche || "");
    setBio(profile?.bio || "");
    setAvatarUrl(profile?.avatar_url || null);
  }, [open, profile]);

  const initial = (name || "C").charAt(0).toUpperCase();

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo
    if (!file || !user) return;

    const validation = validateUpload(file, "avatar");
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    try {
      setUploadingAvatar(true);
      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        toast.error("Erro ao enviar imagem.");
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const fresh = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(fresh);
      await updateProfile.mutateAsync({ avatar_url: fresh });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao atualizar foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const cleanName = sanitizeText(name);
      await updateProfile.mutateAsync({
        name: cleanName || "Criador",
        niche: niche.trim() ? sanitizeText(niche) : null,
        bio: bio.trim() ? sanitizeText(bio) : null,
      });
      toast.success("Perfil atualizado!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Editar perfil</DialogTitle>
          <DialogDescription className="font-body">
            Ajuste como sua vitrine aparece no topo do feed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-20 h-20 rounded-full ring-[3px] ring-primary/30 ring-offset-2 ring-offset-background overflow-hidden shrink-0"
              aria-label="Trocar foto"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <span className="text-2xl font-display font-bold text-white">{initial}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </button>
            <div className="min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? "Enviando..." : "Trocar foto"}
              </Button>
              <p className="text-xs text-muted-foreground font-body mt-1.5">JPG, PNG ou WEBP até 5 MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="feed-edit-name" className="font-body text-sm">Nome</Label>
            <Input
              id="feed-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Seu nome"
              className="mt-1"
            />
          </div>

          {/* Nicho */}
          <div>
            <Label htmlFor="feed-edit-niche" className="font-body text-sm">Nicho</Label>
            <Input
              id="feed-edit-niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Lifestyle, Moda, Fitness"
              className="mt-1"
            />
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="feed-edit-bio" className="font-body text-sm">
              Bio <span className="text-muted-foreground">({bio.length}/160)</span>
            </Label>
            <Textarea
              id="feed-edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              maxLength={160}
              rows={3}
              placeholder="Uma linha sobre você"
              className="mt-1 resize-none"
            />
          </div>

          <Link
            to="/app/configuracoes"
            className="inline-flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Ajustes completos em Configurações
          </Link>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || uploadingAvatar}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
