import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ArrowRight, Ticket, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePartner } from "@/hooks/usePartner";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload-validation";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { CopyButton } from "@/components/shared/CopyButton";
import { ClientsGrid } from "@/components/accounts/ClientsGrid";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";

function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }
function greeting(name?: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "social media";
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${first}!`;
}

export default function ManagerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { partner, isPartner } = usePartner();
  const { modules } = useModules();
  const { openModule, openSettings } = useManagerOutlet();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "managerAvatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
  };
  const handleAvatarCropped = async (blob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success("Foto atualizada!");
    } catch { toast.error("Erro ao enviar a foto."); }
    finally { setCropOpen(false); setRawImageSrc(null); }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="relative w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[3px] shrink-0 hover:scale-[1.02] transition-transform" aria-label="Trocar foto">
          <div className="w-full h-full rounded-3xl bg-card overflow-hidden flex items-center justify-center">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <span className="text-3xl font-display font-extrabold text-primary">{initial(profile?.name)}</span>}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm"><Camera className="h-3.5 w-3.5 text-primary-foreground" /></div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">{greeting(profile?.name)}</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Aqui está o resumo do seu dia.</p>
        </div>
        <button type="button" onClick={openSettings} aria-label="Configurações" className="md:hidden p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors shrink-0">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seus módulos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {modules.map((m) => {
          const active = m.status === "active" || m.status === "past_due";
          return (
            <button key={m.code} type="button" onClick={() => openModule(m)}
              className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-display font-bold text-foreground text-sm">{m.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700" : m.coming_soon ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {active ? "Ativo" : m.coming_soon ? "Em breve" : "Adquirir"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-body">{active ? "Toque para abrir" : m.coming_soon ? "Em desenvolvimento" : "Toque para conhecer"}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Aprovações recentes</h2>
        <button onClick={() => navigate("/socialmidia/aprovacoes")} className="text-primary font-body font-bold text-xs flex items-center gap-1 hover:underline">Ver todas <ArrowRight className="h-3 w-3" /></button>
      </div>
      <div className="mb-8"><ApprovalTracker hideHeader limit={5} /></div>

      {isPartner && partner?.coupon_code && (
        <>
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seu cupom de parceira</h2>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-4 py-3 flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Ticket className="h-5 w-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seu cupom</p>
              <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">{partner.coupon_code}</p>
            </div>
            <CopyButton text={partner.coupon_code} />
          </div>
        </>
      )}

      <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seus clientes</h2>
      <ClientsGrid defaultLimit={5} />

      {rawImageSrc && (
        <ImageCropModal open={cropOpen} onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc} onCropComplete={handleAvatarCropped} aspectRatio={1} cropShape="round" />
      )}
    </div>
  );
}
