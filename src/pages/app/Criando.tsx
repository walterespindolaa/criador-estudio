import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  pillar_id: string | null;
  status: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  scheduled_date: string | null;
  notes: string | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

const COLUMNS = [
  { key: "ideia", label: "💡 Tenho a Ideia", bg: "bg-muted" },
  { key: "roteiro", label: "✍️ Fazendo o Roteiro", bg: "bg-primary/5" },
  { key: "gravando", label: "🎬 Pronto pra Gravar", bg: "bg-secondary/10" },
  { key: "editando", label: "✂️ Editando", bg: "bg-accent" },
  { key: "agendado", label: "📅 Agendado", bg: "bg-primary/10" },
  { key: "publicado", label: "✅ Publicado", bg: "bg-secondary/20" },
];

const FORMATS = ["reels", "carrossel", "story", "video", "shorts", "live"];
const PLATFORMS = ["instagram", "tiktok", "youtube"];
const PLATFORM_ICONS: Record<string, string> = { instagram: "📸", tiktok: "🎵", youtube: "🎬" };
const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

const Criando = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram");
  const [formFormat, setFormFormat] = useState("reels");
  const [formPillar, setFormPillar] = useState("");
  const [formHook, setFormHook] = useState("");
  const [formScript, setFormScript] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formCta, setFormCta] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const [postsRes, pillarsRes] = await Promise.all([
      supabase.from("posts").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
    ]);
    setPosts(postsRes.data || []);
    setPillars(pillarsRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const openNew = (status = "ideia") => {
    setEditingPost(null);
    setFormTitle("");
    setFormPlatform("instagram");
    setFormFormat("reels");
    setFormPillar("");
    setFormHook("");
    setFormScript("");
    setFormCaption("");
    setFormCta("");
    setFormDate("");
    setFormNotes("");
    setSheetOpen(true);
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormPlatform(post.platform);
    setFormFormat(post.format);
    setFormPillar(post.pillar_id || "");
    setFormHook(post.hook || "");
    setFormScript(post.script || "");
    setFormCaption(post.caption || "");
    setFormCta(post.cta || "");
    setFormDate(post.scheduled_date || "");
    setFormNotes(post.notes || "");
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !user) return;
    const data = {
      title: formTitle.trim(),
      platform: formPlatform,
      format: formFormat,
      pillar_id: formPillar || null,
      hook: formHook || null,
      script: formScript || null,
      caption: formCaption || null,
      cta: formCta || null,
      scheduled_date: formDate || null,
      notes: formNotes || null,
      user_id: user.id,
    };

    if (editingPost) {
      const { error } = await supabase.from("posts").update(data).eq("id", editingPost.id);
      if (error) { toast.error("Erro ao atualizar."); return; }
      toast.success("Post atualizado!");
    } else {
      const { error } = await supabase.from("posts").insert({ ...data, status: "ideia" });
      if (error) { toast.error("Erro ao criar post."); return; }
      toast.success("Post criado! 🎉");
    }
    setSheetOpen(false);
    fetchData();
  };

  const handleDragStart = (postId: string) => setDraggedPost(postId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (newStatus: string) => {
    if (!draggedPost) return;
    const updates: any = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
    }
    await supabase.from("posts").update(updates).eq("id", draggedPost);
    if (newStatus === "publicado") {
      toast.success("Conteúdo publicado! 🎉🎊");
    }
    setDraggedPost(null);
    fetchData();
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Estou Criando</h1>
            <p className="text-muted-foreground font-body mt-1">Seu pipeline de criação. Arraste entre colunas.</p>
          </div>
          <Button variant="hero" onClick={() => openNew()}>
            <Plus className="h-4 w-4 mr-1" /> Novo Post
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colPosts = posts.filter(p => p.status === col.key);
            return (
              <div
                key={col.key}
                className="min-w-[220px] flex-1"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(col.key)}
              >
                <div className={`${col.bg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                  <h3 className="font-body font-semibold text-sm text-foreground">{col.label}</h3>
                  <span className="text-xs text-muted-foreground font-body">{colPosts.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {colPosts.map(post => {
                    const pillar = getPillar(post.pillar_id);
                    return (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={() => handleDragStart(post.id)}
                        onClick={() => openEdit(post)}
                        className="bg-card rounded-xl p-4 shadow-warm border border-border cursor-grab active:cursor-grabbing hover:shadow-warm-lg transition-shadow"
                      >
                        <p className="font-body font-medium text-sm text-foreground mb-2 leading-snug">{post.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs">{PLATFORM_ICONS[post.platform]}</span>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format]}</span>
                          {pillar && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground"
                              style={{ backgroundColor: pillar.color }}
                            >
                              {pillar.name}
                            </span>
                          )}
                        </div>
                        {post.scheduled_date && (
                          <p className="text-xs text-muted-foreground font-body mt-2">📅 {post.scheduled_date}</p>
                        )}
                      </div>
                    );
                  })}
                  {colPosts.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                      <p className="text-xs text-muted-foreground font-body">Arraste pra cá</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Post drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-background overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingPost ? "Editar Post" : "Novo Post"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6 pb-8">
            <div className="space-y-2">
              <Label className="font-body">Título</Label>
              <Input placeholder="Sobre o que é esse post?" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">Plataforma</Label>
                <Select value={formPlatform} onValueChange={setFormPlatform}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p}>{PLATFORM_ICONS[p]} {p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Formato</Label>
                <Select value={formFormat} onValueChange={setFormFormat}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f} value={f}>{FORMAT_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Pilar</Label>
              <div className="flex flex-wrap gap-2">
                {pillars.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFormPillar(formPillar === p.id ? "" : p.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                      formPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
                    }`}
                    style={formPillar === p.id ? { backgroundColor: p.color } : {}}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Hook (gancho)</Label>
              <Input placeholder="A primeira frase que prende..." value={formHook} onChange={(e) => setFormHook(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Roteiro</Label>
              <Textarea placeholder="Escreva seu roteiro aqui..." value={formScript} onChange={(e) => setFormScript(e.target.value)} className="rounded-xl min-h-[120px]" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Legenda</Label>
              <Textarea placeholder="Legenda do post..." value={formCaption} onChange={(e) => setFormCaption(e.target.value)} className="rounded-xl min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">CTA (chamada pra ação)</Label>
              <Input placeholder="Ex: Salva esse post!" value={formCta} onChange={(e) => setFormCta(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Data agendada</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Notas</Label>
              <Textarea placeholder="Anotações extras..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="rounded-xl" />
            </div>
            <Button variant="hero" className="w-full" onClick={handleSave} disabled={!formTitle.trim()}>
              {editingPost ? "Salvar alterações" : "Criar post 🎬"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Criando;
