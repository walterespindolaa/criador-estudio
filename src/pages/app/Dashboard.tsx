import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, FileText, CheckCircle2, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [ideaCount, setIdeaCount] = useState(0);
  const [postCounts, setPostCounts] = useState({ creating: 0, published: 0, thisWeek: 0 });
  const [quickIdea, setQuickIdea] = useState("");

  useEffect(() => {
    if (!user) return;
    // Fetch counts
    const fetchCounts = async () => {
      const { count: ideas } = await supabase.from("ideas").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setIdeaCount(ideas || 0);

      const { data: posts } = await supabase.from("posts").select("status, published_at").eq("user_id", user.id);
      if (posts) {
        const creating = posts.filter(p => !["publicado"].includes(p.status || "")).length;
        const published = posts.filter(p => p.status === "publicado").length;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeek = posts.filter(p => p.published_at && new Date(p.published_at) >= weekAgo).length;
        setPostCounts({ creating, published, thisWeek });
      }
    };
    fetchCounts();
  }, [user]);

  const handleQuickCapture = async () => {
    if (!quickIdea.trim() || !user) return;
    const { error } = await supabase.from("ideas").insert({
      user_id: user.id,
      title: quickIdea.trim(),
    });
    if (error) {
      toast.error("Erro ao salvar ideia.");
    } else {
      toast.success("Ideia capturada! 💡");
      setQuickIdea("");
      setIdeaCount(prev => prev + 1);
    }
  };

  const stats = [
    { label: "Ideias guardadas", value: ideaCount, icon: Lightbulb, color: "text-primary" },
    { label: "Em criação", value: postCounts.creating, icon: FileText, color: "text-secondary" },
    { label: "Publicados", value: postCounts.published, icon: CheckCircle2, color: "text-secondary" },
    { label: "Esta semana", value: postCounts.thisWeek, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Oi, {profile?.name || "criador"}! 👋
        </h1>
        <p className="text-muted-foreground font-body mb-4">
          Sua meta: {postCounts.thisWeek}/{profile?.weekly_goal || 3} posts esta semana
        </p>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mb-8">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (postCounts.thisWeek / (profile?.weekly_goal || 3)) * 100)}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-card rounded-2xl p-5 shadow-warm border border-border"
            >
              <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-body mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick capture */}
        <div className="bg-card rounded-2xl p-6 shadow-warm border border-border mb-8">
          <p className="text-sm font-body font-medium text-foreground mb-3">Captura rápida de ideia</p>
          <div className="flex gap-2">
            <Input
              placeholder="Capturar ideia rápida..."
              value={quickIdea}
              onChange={(e) => setQuickIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()}
              className="rounded-xl"
            />
            <Button variant="default" onClick={handleQuickCapture} disabled={!quickIdea.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {ideaCount === 0 && postCounts.published === 0 && (
          <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
            <p className="text-lg font-display font-semibold text-foreground mb-2">Seu estúdio está pronto! 🎨</p>
            <p className="text-muted-foreground font-body max-w-md mx-auto">
              Comece capturando sua primeira ideia acima. Pode ser uma frase, um tema, um insight — tudo vale.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
