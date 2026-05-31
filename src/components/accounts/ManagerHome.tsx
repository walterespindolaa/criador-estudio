import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Camera, LogOut, Settings as SettingsIcon, Sparkles, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount, type ManagedAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { validateUpload } from "@/lib/upload-validation";
import { SettingsManagerDrawer } from "@/components/accounts/SettingsManagerDrawer";
import { ClientNotesDrawer } from "@/components/accounts/ClientNotesDrawer";

function initial(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function greeting(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "social media";
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${first}!`;
}

export function ManagerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { managedAccounts, accountsLoading, setActiveAccount } = useActiveAccount();
  const { signOut } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesAccount, setNotesAccount] = useState<ManagedAccount | null>(null);

  // Upload de avatar inline (sem abrir o drawer)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "avatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = async (blob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, {
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-border">
        <Logo className="h-8 w-auto" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-xl hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Configurações"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Hero: avatar grande + saudação */}
          <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[3px] shrink-0 hover:scale-[1.02] transition-transform"
              aria-label="Trocar foto"
            >
              <div className="w-full h-full rounded-3xl bg-card overflow-hidden flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-3xl font-display font-extrabold text-primary">
                    {initial(profile?.name)}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm">
                <Camera className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
                {greeting(profile?.name)}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-body mt-1">
                Selecione qual cliente você quer gerenciar.
              </p>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">
                  {managedAccounts.length}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {managedAccounts.length === 1 ? "cliente" : "clientes"}
                </p>
              </div>
            </div>
            {/* TODO Parceiros: card "clientes no cupom" + card "receita do mês" */}
          </section>

          {/* Cards de cliente */}
          <section className="mb-12">
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Suas contas
            </h2>

            {accountsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : managedAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-body text-foreground font-medium">
                  Você ainda não gerencia nenhuma conta
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
                  Quando uma criadora te convidar pra gerenciar a conta dela, ela aparece aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {managedAccounts.map((account) => (
                  <div
                    key={account.owner_id}
                    className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                        <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
                          {account.avatar_url ? (
                            <img src={account.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-lg font-display font-extrabold text-primary">
                              {initial(account.name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-display font-bold text-foreground truncate">
                          {account.name || "Sem nome"}
                        </p>
                        {account.instagram_handle && (
                          <p className="text-xs text-muted-foreground font-body truncate">
                            @{account.instagram_handle.replace(/^@/, "")}
                          </p>
                        )}
                        {account.niche && (
                          <p className="text-[11px] text-muted-foreground font-body truncate mt-0.5">
                            {account.niche}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setActiveAccount(account.owner_id)}
                        className="flex-1"
                      >
                        Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNotesAccount(account)}
                        aria-label="Notas do cliente"
                        className="shrink-0"
                      >
                        <StickyNote className="h-4 w-4 mr-1.5" /> Notas
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* TODO Parceiros: card "Minha conta" (depende do fluxo de assinatura) */}

          {/* Upsell */}
          <section className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground">
                Quer usar o cria pro seu conteúdo também?
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                Crie sua conta de criadora e ganhe ideias, calendário e IA pra você.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app/assinar")}
              className="shrink-0"
            >
              Ver planos
            </Button>
          </section>
        </div>
      </main>

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

      <SettingsManagerDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <ClientNotesDrawer
        open={!!notesAccount}
        onOpenChange={(o) => { if (!o) setNotesAccount(null); }}
        ownerId={notesAccount?.owner_id ?? null}
        clientName={notesAccount?.name ?? null}
      />
    </div>
  );
}
