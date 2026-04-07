import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, LogOut, Camera, Lock, AlertTriangle, GripVertical, Sparkles, Bell, Shield, CreditCard, Paintbrush, Languages, MessageSquareText, MessageSquare, Ban, Moon, Sun, Monitor, Users, HardDrive, ExternalLink, Unplug, Palette } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { PlatformIcon as PlatformIconComp } from "@/components/shared/PlatformIcon";
import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { SettingsVisual } from "@/components/settings/SettingsVisual";
import { useGoogleDriveConnection } from "@/hooks/useGoogleDriveConnection";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface Pillar { id: string; name: string; color: string; }
interface Habit { id: string; name: string; position: number; }
interface BrandItem { id: string; type: string; name: string; value: string | null; }

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];
const NICHE_OPTIONS = ["Lifestyle", "Moda", "Beleza", "Fitness", "Culinária", "Educação", "Negócios", "Entretenimento", "Saúde", "Tecnologia"];
const HABIT_SUGGESTIONS = ["Filmei hoje?", "Postei?", "Respondi comentários?", "Estudei algo?", "Planejei amanhã?"];

const BRAND_SECTIONS = [
  { type: "cor", label: "Cores da marca", icon: Paintbrush, placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "Fontes", icon: Languages, placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "Tom de voz", icon: MessageSquareText, placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "Expressões que uso", icon: MessageSquare, placeholder: "Ex: Bora!" },
  { type: "evitar", label: "Palavras que evito", icon: Ban, placeholder: "Ex: Não use gírias" },
];

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [brandItems, setBrandItems] = useState<BrandItem[]>([]);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [niche, setNiche] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [igHandle, setIgHandle] = useState("");
  const [ttHandle, setTtHandle] = useState("");
  const [ytHandle, setYtHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPillarName, setNewPillarName] = useState("");
  const [newPillarColor, setNewPillarColor] = useState(PILLAR_COLORS[0]);
  const [newHabitName, setNewHabitName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [activeSection, setActiveSection] = useState("");

  // Dialogs
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Notification prefs
  const [notifApp, setNotifApp] = useState(true);
  const [notifDailyReminder, setNotifDailyReminder] = useState(false);
  const [notifWeeklyGoal, setNotifWeeklyGoal] = useState(true);
  const [notifWeeklyTip, setNotifWeeklyTip] = useState(true);

  // Persona state
  const [personaName, setPersonaName] = useState("Meu público principal");
  const [personaAge, setPersonaAge] = useState("");
  const [personaGender, setPersonaGender] = useState("");
  const [personaLocation, setPersonaLocation] = useState("");
  const [personaInterests, setPersonaInterests] = useState<string[]>([]);
  const [personaPains, setPersonaPains] = useState<string[]>([]);
  const [personaDesires, setPersonaDesires] = useState<string[]>([]);
  const [personaPlatforms, setPersonaPlatforms] = useState<string[]>([]);
  const [personaNotes, setPersonaNotes] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  // Google Drive
  const { connection: driveConnection, loading: driveLoading, connect: driveConnect, disconnect: driveDisconnect } = useGoogleDriveConnection();
  const { pickAndSave } = useGoogleDrive();
  const [connectingDrive, setConnectingDrive] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBio(profile.bio || "");
      setNiche(profile.niche || "");
      setWeeklyGoal(profile.weekly_goal || 3);
      setPlatforms(profile.platforms || []);
      setIgHandle(profile.instagram_handle || "");
      setTtHandle(profile.tiktok_handle || "");
      setYtHandle(profile.youtube_handle || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("habits").select("*").eq("user_id", user.id).order("position"),
      supabase.from("brand_items").select("*").eq("user_id", user.id).order("position"),
      supabase.from("personas").select("*").eq("user_id", user.id).limit(1),
    ]).then(([pillarsRes, habitsRes, brandRes, personaRes]) => {
      setPillars(pillarsRes.data || []);
      setHabits(habitsRes.data || []);
      setBrandItems(brandRes.data || []);
      const p = (personaRes.data as any[])?.[0];
      if (p) {
        setPersonaId(p.id);
        setPersonaName(p.name || "");
        setPersonaAge(p.age_range || "");
        setPersonaGender(p.gender || "");
        setPersonaLocation(p.location || "");
        setPersonaInterests(p.interests || []);
        setPersonaPains(p.pain_points || []);
        setPersonaDesires(p.desires || []);
        setPersonaPlatforms(p.platforms || []);
        setPersonaNotes(p.notes || "");
      }
    });
  }, [user]);

  const saveProfile = async () => {
    await updateProfile({ name, niche, weekly_goal: weeklyGoal, platforms, bio, instagram_handle: igHandle, tiktok_handle: ttHandle, youtube_handle: ytHandle, avatar_url: avatarUrl } as any);
    toast.success("Perfil atualizado!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem."); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    toast.success("Avatar atualizado!");
  };

  const togglePlatform = (p: string) => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const addPillar = async () => {
    if (!newPillarName.trim() || !user || pillars.length >= 5) return;
    await supabase.from("pillars").insert({ user_id: user.id, name: newPillarName.trim(), color: newPillarColor, position: pillars.length });
    setNewPillarName("");
    const { data } = await supabase.from("pillars").select("*").eq("user_id", user.id).order("position");
    setPillars(data || []);
    toast.success("Pilar adicionado!");
  };

  const deletePillar = async (id: string) => { await supabase.from("pillars").delete().eq("id", id); setPillars(prev => prev.filter(p => p.id !== id)); };

  const addHabit = async (habitName?: string) => {
    const n = habitName || newHabitName.trim();
    if (!n || !user) return;
    await supabase.from("habits").insert({ user_id: user.id, name: n, position: habits.length });
    setNewHabitName("");
    const { data } = await supabase.from("habits").select("*").eq("user_id", user.id).order("position");
    setHabits(data || []);
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (id: string) => { await supabase.from("habits").delete().eq("id", id); setHabits(prev => prev.filter(h => h.id !== id)); };

  const addBrandItem = async (type: string) => {
    if (!newItemName.trim() || !user) return;
    await supabase.from("brand_items").insert({ user_id: user.id, type, name: newItemName.trim(), value: newItemValue || null, position: brandItems.filter(i => i.type === type).length });
    setNewItemName(""); setNewItemValue("");
    const { data } = await supabase.from("brand_items").select("*").eq("user_id", user.id).order("position");
    setBrandItems(data || []);
    toast.success("Item adicionado!");
  };

  const deleteBrandItem = async (id: string) => {
    await supabase.from("brand_items").delete().eq("id", id);
    setBrandItems(prev => prev.filter(i => i.id !== id));
  };

  const savePersona = async () => {
    if (!user) return;
    const data: any = {
      user_id: user.id, name: personaName, age_range: personaAge || null,
      gender: personaGender || null, location: personaLocation || null,
      interests: personaInterests.length > 0 ? personaInterests : null,
      pain_points: personaPains.length > 0 ? personaPains : null,
      desires: personaDesires.length > 0 ? personaDesires : null,
      platforms: personaPlatforms.length > 0 ? personaPlatforms : null,
      notes: personaNotes || null,
    };
    if (personaId) {
      await supabase.from("personas").update(data).eq("id", personaId);
    } else {
      const { data: newP } = await supabase.from("personas").insert(data).select().single();
      if (newP) setPersonaId((newP as any).id);
    }
    toast.success("Persona salva!");
  };

  const addTagTo = (arr: string[], setArr: (v: string[]) => void) => {
    if (!newTag.trim() || arr.includes(newTag.trim())) return;
    setArr([...arr, newTag.trim()]);
    setNewTag("");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    if (!/[A-Z]/.test(newPassword)) { toast.error("Inclua pelo menos uma maiúscula."); return; }
    if (!/[0-9]/.test(newPassword)) { toast.error("Inclua pelo menos um número."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Erro ao alterar senha."); return; }
    toast.success("Senha alterada!");
    setPasswordOpen(false); setNewPassword("");
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "EXCLUIR") { toast.error("Digite EXCLUIR para confirmar."); return; }
    await signOut(); navigate("/");
    toast.success("Conta desconectada. Entre em contato para exclusão completa.");
  };

  const handleDriveConnect = async () => {
    setConnectingDrive(true);
    try {
      // Load Google scripts and get token
      const loadScripts = (): Promise<void> => {
        return new Promise((resolve) => {
          if (window.google?.accounts) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://accounts.google.com/gsi/client";
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
      };
      await loadScripts();
      const { data: config } = await supabase.functions.invoke("get-google-config");
      if (!config?.client_id) { toast.error("GOOGLE_CLIENT_ID não configurado."); return; }

      const token: string = await new Promise((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: config.client_id,
          scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          callback: (resp: any) => { if (resp.error) reject(resp.error); else resolve(resp.access_token); },
        });
        client.requestAccessToken({ prompt: "consent" });
      });

      await driveConnect(token);
      toast.success("Google Drive conectado!");
    } catch (err) {
      toast.error("Erro ao conectar Google Drive.");
      console.error(err);
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDriveDisconnect = async () => {
    await driveDisconnect();
    toast.success("Google Drive desconectado.");
  };

  return (
    <div className="max-w-2xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground font-body mb-6">Gerencie sua conta e preferências.</p>

        <Tabs defaultValue="perfil">
          <TabsList className="bg-card border border-border rounded-xl mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="perfil" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Perfil</TabsTrigger>
            <TabsTrigger value="marca" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Minha Marca</TabsTrigger>
            <TabsTrigger value="pilares" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Pilares & Hábitos</TabsTrigger>
            <TabsTrigger value="notificacoes" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Notificações</TabsTrigger>
            <TabsTrigger value="seguranca" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Segurança</TabsTrigger>
            <TabsTrigger value="integracoes" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Integrações</TabsTrigger>
            <TabsTrigger value="assinatura" className="rounded-lg font-body text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Assinatura</TabsTrigger>
          </TabsList>

          {/* PERFIL — only profile info, no pillars/habits */}
          <TabsContent value="perfil">
            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-5">
                <h3 className="font-display font-semibold text-foreground">Meu Perfil</h3>
                <div className="flex items-center gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors group">
                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary" />}
                    <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="h-5 w-5 text-primary-foreground" /></div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <div><p className="font-body text-sm font-medium text-foreground">Foto de perfil</p><p className="font-body text-xs text-muted-foreground">Clique para alterar</p></div>
                </div>
                <div className="space-y-2"><Label className="font-body text-sm">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" /></div>
                <div className="space-y-2"><Label className="font-body text-sm">Bio <span className="text-muted-foreground">({bio.length}/160)</span></Label><Textarea value={bio} onChange={(e) => e.target.value.length <= 160 && setBio(e.target.value)} placeholder="Conte um pouco sobre você..." className="rounded-xl min-h-[60px]" /></div>
                <div className="space-y-2"><Label className="font-body text-sm">Nicho</Label><div className="flex flex-wrap gap-2">{NICHE_OPTIONS.map(n => (<button key={n} onClick={() => setNiche(n)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${niche === n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{n}</button>))}</div></div>
                <div className="space-y-2"><Label className="font-body text-sm">Plataformas</Label><div className="flex gap-3">{(["instagram", "tiktok", "youtube"] as const).map(p => (<button key={p} onClick={() => togglePlatform(p)} className={`px-4 py-2 rounded-xl border text-sm font-body transition-colors flex items-center gap-2 ${platforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"}`}><PlatformIcon platform={p} size="sm" />{p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "YouTube"}</button>))}</div></div>
                <div className="space-y-2"><Label className="font-body text-sm">Meta semanal: {weeklyGoal} posts</Label><input type="range" min={1} max={7} value={weeklyGoal} onChange={(e) => setWeeklyGoal(parseInt(e.target.value))} className="w-full accent-[hsl(var(--primary))]" /></div>
                <div className="space-y-3"><Label className="font-body text-sm">Handles</Label>
                  <div className="flex items-center gap-2"><PlatformIcon platform="instagram" size="sm" /><Input placeholder="@seuinstagram" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} className="rounded-xl" /></div>
                  <div className="flex items-center gap-2"><PlatformIcon platform="tiktok" size="sm" /><Input placeholder="@seutiktok" value={ttHandle} onChange={(e) => setTtHandle(e.target.value)} className="rounded-xl" /></div>
                  <div className="flex items-center gap-2"><PlatformIcon platform="youtube" size="sm" /><Input placeholder="@seuyoutube" value={ytHandle} onChange={(e) => setYtHandle(e.target.value)} className="rounded-xl" /></div>
                </div>
                <Button onClick={saveProfile} variant="hero">Salvar perfil</Button>
              </div>
            </div>
          </TabsContent>

          {/* PILARES & HÁBITOS — separate tab */}
          <TabsContent value="pilares">
            <div className="space-y-6">
              {/* Pillars */}
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                <h3 className="font-display font-semibold text-foreground">Pilares de Conteúdo</h3>
                <p className="text-xs text-muted-foreground font-body">Máximo 5 pilares</p>
                {pillars.map(p => (<div key={p.id} className="flex items-center gap-3"><div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} /><span className="font-body text-sm text-foreground flex-1">{p.name}</span><button onClick={() => deletePillar(p.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div>))}
                {pillars.length < 5 && (<div className="space-y-2"><div className="flex gap-2"><Input placeholder="Novo pilar..." value={newPillarName} onChange={(e) => setNewPillarName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPillar()} className="rounded-xl text-sm" /><Button variant="outline" size="sm" onClick={addPillar}><Plus className="h-4 w-4" /></Button></div><div className="flex gap-2">{PILLAR_COLORS.map(c => (<button key={c} onClick={() => setNewPillarColor(c)} className={`w-6 h-6 rounded-full transition-all ${newPillarColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ backgroundColor: c }} />))}</div></div>)}
              </div>

              {/* Habits */}
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                <h3 className="font-display font-semibold text-foreground">Meus Hábitos</h3>
                {habits.map(h => (<div key={h.id} className="flex items-center gap-3"><GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" /><span className="font-body text-sm text-foreground flex-1">{h.name}</span><button onClick={() => deleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div>))}
                <div className="flex gap-2"><Input placeholder="Novo hábito..." value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} className="rounded-xl text-sm" /><Button variant="outline" size="sm" onClick={() => addHabit()}><Plus className="h-4 w-4" /></Button></div>
                <div className="flex flex-wrap gap-2">{HABIT_SUGGESTIONS.filter(s => !habits.find(h => h.name === s)).map(s => (<button key={s} onClick={() => addHabit(s)} className="px-3 py-1 rounded-xl text-xs font-body bg-muted border border-border hover:bg-accent transition-colors">+ {s}</button>))}</div>
              </div>
            </div>
          </TabsContent>

          {/* MINHA MARCA */}
          <TabsContent value="marca">
            <div className="space-y-6">
              {BRAND_SECTIONS.map(section => {
                const items = brandItems.filter(i => i.type === section.type);
                return (
                  <div key={section.type} className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
                    <h3 className="font-body font-semibold text-foreground mb-3 flex items-center gap-2">
                      <section.icon className="h-4 w-4 text-primary/70" />
                      {section.label}
                    </h3>
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {items.map(item => (
                          <div key={item.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl border border-border">
                            {section.type === "cor" && item.value && <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.value }} />}
                            <span className="text-sm font-body text-foreground">{item.name}</span>
                            {item.value && section.type !== "cor" && <span className="text-xs text-muted-foreground font-body">({item.value})</span>}
                            <button onClick={() => deleteBrandItem(item.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeSection === section.type ? (
                      <div className="flex gap-2">
                        <Input placeholder="Nome" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="rounded-xl text-sm" />
                        <Input placeholder={section.placeholder} value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} className="rounded-xl text-sm" />
                        <Button size="sm" onClick={() => addBrandItem(section.type)} disabled={!newItemName.trim()}><Plus className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <button onClick={() => { setActiveSection(section.type); setNewItemName(""); setNewItemValue(""); }} className="text-sm text-primary font-body font-medium hover:underline">+ Adicionar</button>
                    )}
                  </div>
                );
              })}

              {/* Persona section */}
              <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border space-y-4">
                <h3 className="font-body font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary/70" /> Meu Público (Persona)
                </h3>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Nome da persona</Label>
                  <Input placeholder="Ex: Maria, 28 anos" value={personaName} onChange={e => setPersonaName(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Faixa etária</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["18-24", "25-34", "35-44", "45+"].map(a => (
                      <button key={a} onClick={() => setPersonaAge(personaAge === a ? "" : a)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${personaAge === a ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{a}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Gênero</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["Mulheres", "Homens", "Todos"].map(g => (
                      <button key={g} onClick={() => setPersonaGender(personaGender === g ? "" : g)} className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${personaGender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{g}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Localização</Label>
                  <Input placeholder="Ex: Brasil, São Paulo" value={personaLocation} onChange={e => setPersonaLocation(e.target.value)} className="rounded-xl" />
                </div>
                {([
                  { label: "Interesses", arr: personaInterests, setArr: setPersonaInterests },
                  { label: "Dores principais", arr: personaPains, setArr: setPersonaPains },
                  { label: "Desejos", arr: personaDesires, setArr: setPersonaDesires },
                ] as const).map(section => (
                  <div key={section.label} className="space-y-2">
                    <Label className="font-body text-sm">{section.label}</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {section.arr.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-lg text-xs font-body">
                          {tag}
                          <button onClick={() => section.setArr(section.arr.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder={`Adicionar ${section.label.toLowerCase()}...`} value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addTagTo(section.arr, section.setArr); } }} className="rounded-xl text-sm" />
                      <Button variant="outline" size="sm" onClick={() => addTagTo(section.arr, section.setArr)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label className="font-body text-sm">Plataformas que usa</Label>
                  <div className="flex gap-2">
                    {(["instagram", "tiktok", "youtube"] as const).map(p => (
                      <button key={p} onClick={() => setPersonaPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={`px-3 py-2 rounded-xl border transition-colors ${personaPlatforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
                        <PlatformIconComp platform={p} size="sm" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Notas</Label>
                  <Textarea placeholder="Observações sobre seu público..." value={personaNotes} onChange={e => setPersonaNotes(e.target.value)} className="rounded-xl min-h-[60px]" />
                </div>
                <Button variant="hero" onClick={savePersona}>Salvar persona</Button>
              </div>
            </div>
          </TabsContent>

          {/* NOTIFICAÇÕES */}
          <TabsContent value="notificacoes">
            <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-5">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div><p className="font-body text-sm text-foreground">Notificações no app</p><p className="text-xs text-muted-foreground font-body">Receba alertas dentro do app</p></div><Switch checked={notifApp} onCheckedChange={setNotifApp} /></div>
                <div className="flex items-center justify-between"><div><p className="font-body text-sm text-foreground">Lembrete diário de postagem</p><p className="text-xs text-muted-foreground font-body">Aviso para não esquecer de postar</p></div><Switch checked={notifDailyReminder} onCheckedChange={setNotifDailyReminder} /></div>
                <div className="flex items-center justify-between"><div><p className="font-body text-sm text-foreground">Alerta de meta semanal</p><p className="text-xs text-muted-foreground font-body">Aviso quando bater a meta</p></div><Switch checked={notifWeeklyGoal} onCheckedChange={setNotifWeeklyGoal} /></div>
                <div className="flex items-center justify-between"><div><p className="font-body text-sm text-foreground">Dica semanal de conteúdo</p><p className="text-xs text-muted-foreground font-body">Receba inspiração toda semana</p></div><Switch checked={notifWeeklyTip} onCheckedChange={setNotifWeeklyTip} /></div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground font-body flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> Notificações push (PWA) disponíveis ao instalar o app no celular.</p>
              </div>
            </div>

            {/* Theme */}
            <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4 mt-6">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Aparência
              </h3>
              <div className="flex gap-3">
                {([
                  { key: "light" as const, label: "Claro", icon: Sun },
                  { key: "dark" as const, label: "Escuro", icon: Moon },
                  { key: "system" as const, label: "Automático", icon: Monitor },
                ]).map(opt => (
                  <button key={opt.key} onClick={() => setTheme(opt.key)}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${theme === opt.key ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
                    <opt.icon className={`h-5 w-5 ${theme === opt.key ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-body font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SEGURANÇA */}
          <TabsContent value="seguranca">
            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><Shield className="h-4 w-4" /> Segurança</h3>
                <div className="space-y-2"><Label className="font-body text-sm">E-mail</Label><Input value={user?.email || ""} readOnly className="rounded-xl bg-muted" /></div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Sessão atual</Label>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <p className="text-sm font-body text-foreground">Logado desde {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "hoje"}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setPasswordOpen(true)}><Lock className="h-4 w-4 mr-2" /> Alterar senha</Button>
              </div>
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-destructive/20 space-y-4">
                <h3 className="font-display font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Zona de perigo</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setLogoutOpen(true)}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}><AlertTriangle className="h-4 w-4 mr-2" /> Excluir conta</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* INTEGRAÇÕES */}
          <TabsContent value="integracoes">
            <div className="space-y-6">
              {/* Google Drive */}
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-foreground">Google Drive</h3>
                    <p className="text-xs text-muted-foreground font-body">Vincule arquivos do Drive aos seus posts</p>
                  </div>
                  {driveConnection && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-body font-semibold bg-secondary/20 text-secondary">Conectado</span>
                  )}
                </div>

                {driveLoading ? (
                  <p className="text-sm text-muted-foreground font-body">Carregando...</p>
                ) : driveConnection ? (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-xl p-3 border border-border">
                      <p className="text-sm font-body text-foreground">{driveConnection.google_name || driveConnection.google_email}</p>
                      <p className="text-xs text-muted-foreground font-body">{driveConnection.google_email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDriveConnect}>Trocar conta</Button>
                      <Button variant="ghost" size="sm" onClick={handleDriveDisconnect} className="text-destructive hover:text-destructive">
                        <Unplug className="h-4 w-4 mr-1" /> Desconectar
                      </Button>
                      <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-body border border-border hover:bg-accent transition-colors ml-auto">
                        Abrir Drive <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <Button variant="hero" onClick={handleDriveConnect} disabled={connectingDrive}>
                    <HardDrive className="h-4 w-4 mr-1" /> {connectingDrive ? "Conectando..." : "Conectar Google Drive"}
                  </Button>
                )}
              </div>

              {/* Coming soon */}
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border">
                <h3 className="font-display font-semibold text-foreground mb-3">Mais integrações em breve</h3>
                <div className="space-y-3">
                  {[
                    { name: "Instagram API", desc: "Publique direto pelo Criadores" },
                    { name: "TikTok", desc: "Agendamento nativo" },
                    { name: "YouTube", desc: "Upload de thumbnails" },
                  ].map(i => (
                    <div key={i.name} className="flex items-center gap-3 opacity-50">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-body font-medium text-foreground">{i.name}</p>
                        <p className="text-xs text-muted-foreground font-body">{i.desc}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-body bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Em breve</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ASSINATURA */}
          <TabsContent value="assinatura">
            <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2"><CreditCard className="h-4 w-4" /> Assinatura</h3>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${profile?.plan === "pro" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {profile?.plan === "pro" ? "Pro" : "Free"}
                </span>
              </div>
              {profile?.plan !== "pro" ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                  <p className="font-body text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Benefícios do Pro</p>
                  <ul className="text-sm font-body text-muted-foreground space-y-1.5">
                    <li>• Posts e ideias ilimitados</li>
                    <li>• Histórico completo com insights</li>
                    <li>• Biblioteca de mídia (2GB)</li>
                    <li>• Arquivos ilimitados</li>
                    <li>• Acesso a todos os cursos</li>
                    <li>• Insights de IA avançados</li>
                  </ul>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-display font-bold text-foreground">R$47</span>
                    <span className="text-sm text-muted-foreground font-body">/mês</span>
                    <span className="text-xs text-muted-foreground font-body ml-2">ou R$397/ano</span>
                  </div>
                  <Button variant="hero" className="w-full">Assinar o Pro</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-body text-muted-foreground">Próxima renovação: —</p>
                  <Button variant="outline">Gerenciar assinatura</Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display">Alterar senha</DialogTitle><DialogDescription className="font-body">Mínimo 8 caracteres, 1 maiúscula, 1 número.</DialogDescription></DialogHeader>
          <div className="space-y-4"><Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" /><Button variant="hero" className="w-full" onClick={handleChangePassword}>Salvar nova senha</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display">Sair da conta</DialogTitle><DialogDescription className="font-body">Tem certeza que deseja sair?</DialogDescription></DialogHeader>
          <div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancelar</Button><Button variant="hero" onClick={handleSignOut}>Sair</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="font-display text-destructive">Excluir conta</DialogTitle><DialogDescription className="font-body">Esta ação é irreversível. Digite <span className="font-semibold">EXCLUIR</span> para confirmar.</DialogDescription></DialogHeader>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="rounded-xl" />
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount} disabled={deleteConfirm !== "EXCLUIR"}>Excluir minha conta permanentemente</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
