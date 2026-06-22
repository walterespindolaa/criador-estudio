import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Camera, ExternalLink, FileText, HardDrive, Image as ImageIcon, Loader2, Lock, Palette, Plug, Unplug, User, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { sanitizeText } from "@/lib/sanitize";
import { ManagerCompanyDialog } from "@/components/accounts/ManagerCompanyDialog";
import { SettingsVisual } from "@/components/settings/SettingsVisual";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsManagerDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { managedAccounts } = useActiveAccount();
  const { connection: drive, connect: driveConnect, disconnect: driveDisconnect } = useGoogleDriveConnection();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [name, setName] = useState(profile?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // ── Avatar ───────────────────────────────────────────────
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = async (croppedBlob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, croppedBlob, {
        upsert: true, contentType: "image/jpeg",
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const fresh = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ avatar_url: fresh });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setCropOpen(false);
      setRawImageSrc(null);
    }
  };

  // ── Logo da marca ────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/brand-logo.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ brand_logo_url: `${data.publicUrl}?t=${Date.now()}` });
      toast.success("Logo atualizada!");
    } catch {
      toast.error("Erro ao enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    try { await updateProfile.mutateAsync({ brand_logo_url: null }); toast.success("Logo removida."); }
    catch { toast.error("Erro ao remover a logo."); }
  };

  // ── Nome ─────────────────────────────────────────────────
  const handleSaveName = async () => {
    const clean = sanitizeText(name).trim();
    if (!clean) { toast.error("Informe um nome"); return; }
    if (clean === profile?.name) return;
    setSavingName(true);
    try {
      await updateProfile.mutateAsync({ name: clean });
      toast.success("Nome atualizado!");
    } catch {
      toast.error("Erro ao atualizar o nome.");
    } finally {
      setSavingName(false);
    }
  };

  // ── Google Drive ─────────────────────────────────────────
  const handleDriveConnect = async () => {
    setConnecting(true);
    try {
      // Carrega Google Identity Services se ainda não estiver
      await new Promise<void>((resolve) => {
        if ((window as { google?: unknown }).google) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });
      const { data: config } = await supabase.functions.invoke("get-google-config");
      if (!config?.client_id) { toast.error("GOOGLE_CLIENT_ID não configurado."); return; }

      const token: string = await new Promise((resolve, reject) => {
        const g = (window as { google?: { accounts: { oauth2: { initTokenClient: (opts: unknown) => { requestAccessToken: (o: unknown) => void } } } } }).google!;
        const client = g.accounts.oauth2.initTokenClient({
          client_id: config.client_id,
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          callback: (resp: { error?: unknown; access_token?: string }) => {
            if (resp.error || !resp.access_token) reject(resp.error ?? "no_token");
            else resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: "consent" });
      });

      await driveConnect(token);
      toast.success("Google Drive conectado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao conectar Google Drive.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDriveDisconnect = async () => {
    try {
      await driveDisconnect();
      toast.success("Google Drive desconectado.");
    } catch {
      toast.error("Erro ao desconectar.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Configurações da conta</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Suas preferências pessoais como social media.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="conta" className="mt-5">
            <TabsList className="grid w-full grid-cols-4 rounded-xl">
              <TabsTrigger value="conta" className="gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> Conta</TabsTrigger>
              <TabsTrigger value="tema" className="gap-1.5 text-xs"><Palette className="h-3.5 w-3.5" /> Tema</TabsTrigger>
              <TabsTrigger value="integracoes" className="gap-1.5 text-xs"><Plug className="h-3.5 w-3.5" /> Integrações</TabsTrigger>
              <TabsTrigger value="clientes" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
            </TabsList>

            <TabsContent value="conta" className="space-y-6 mt-5">
            {/* Foto + Nome */}
            <section className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 hover:scale-[1.02] transition-transform"
                  aria-label="Trocar foto"
                >
                  <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl font-display font-extrabold text-primary">
                        {(profile?.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                    <Camera className="h-3 w-3 text-primary-foreground" />
                  </div>
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-foreground truncate">{profile?.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground font-body truncate">{user?.email}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs">Nome</Label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" placeholder="Seu nome" />
                  <Button
                    onClick={handleSaveName}
                    disabled={savingName || !name.trim() || name.trim() === profile?.name}
                    size="sm"
                    className="shrink-0"
                  >
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Senha */}
            <section className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" /> Senha
              </h3>
              <p className="text-xs text-muted-foreground font-body">Atualize sua senha para manter a conta segura.</p>
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); navigate("/app/trocar-senha"); }}
                className="w-full justify-start"
              >
                Trocar senha
              </Button>
            </section>

            {/* Dados da empresa (contratos) */}
            <section className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Dados da minha empresa
              </h3>
              <p className="text-xs text-muted-foreground font-body">Usados como CONTRATADA nos contratos. Configure CPF ou CNPJ e seus dados uma vez.</p>
              <Button variant="outline" onClick={() => setCompanyOpen(true)} className="w-full justify-start">
                Editar dados da empresa
              </Button>
            </section>
            </TabsContent>

            <TabsContent value="tema" className="mt-5 space-y-6">
              <section className="space-y-2">
                <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Logo da marca
                </h3>
                <p className="text-xs text-muted-foreground font-body">Aparece no cabeçalho do cronograma que o cliente recebe. Opcional — sem logo, mostramos só o nome e a cor.</p>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0">
                    {profile?.brand_logo_url
                      ? <img src={profile.brand_logo_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                      : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar logo"}
                    </Button>
                    {profile?.brand_logo_url && (
                      <Button variant="ghost" size="sm" onClick={removeLogo} className="text-destructive h-7">Remover</Button>
                    )}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                </div>
              </section>
              <SettingsVisual />
            </TabsContent>

            <TabsContent value="integracoes" className="space-y-6 mt-5">
            {/* Google Drive */}
            <section className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Google Drive
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                Conecte seu Drive pra usar o picker de mídia nos posts dos clientes.
              </p>
              {drive ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-body">Conectado como</p>
                    <p className="text-sm font-body text-foreground truncate">{drive.google_email}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDriveDisconnect} className="shrink-0">
                    <Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar
                  </Button>
                </div>
              ) : (
                <Button onClick={handleDriveConnect} disabled={connecting} className="w-full">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Conectar Google Drive
                </Button>
              )}
            </section>

            </TabsContent>

            <TabsContent value="clientes" className="mt-5">
            {/* Total de clientes */}
            <section className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Clientes
              </h3>
              <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
                <p className="text-sm font-body text-muted-foreground">Total que você gerencia</p>
                <p className="text-2xl font-display font-extrabold text-primary">{managedAccounts.length}</p>
              </div>
            </section>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ManagerCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />

      {rawImageSrc && (
        <ImageCropModal
          open={cropOpen}
          onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc}
          onCropComplete={handleAvatarCropped}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </>
  );
}
