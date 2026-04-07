import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Archive, ExternalLink, Eye, Bookmark, MessageSquare } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  published_at: string | null;
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  archive_summary: string | null;
}



const Historico = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "publicado")
      .order("published_at", { ascending: false })
      .then(({ data }) => setPosts(data || []));
  }, [user]);

  return (
    <div className="max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Histórico</h1>
        <p className="text-muted-foreground font-body mb-8">Tudo que você já publicou. Seu portfólio de consistência.</p>

        {posts.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Archive className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-display font-semibold text-foreground mb-2">
              Seu histórico vai crescer com você 📚
            </p>
            <p className="text-muted-foreground font-body max-w-sm mx-auto">
              Quando você publicar seus primeiros conteúdos, eles vão aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl p-5 shadow-warm border border-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-body font-semibold text-foreground">{post.title}</h3>
                    {post.archive_summary && (
                      <p className="text-xs text-primary font-body mt-0.5 italic">"{post.archive_summary}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <PlatformIcon platform={post.platform as any} size="sm" />
                      <p className="text-sm text-muted-foreground font-body">
                        {post.format} •{" "}
                        {post.published_at ? new Date(post.published_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>
                </div>
                {(post.result_views || post.result_saves || post.result_comments) && (
                  <div className="flex gap-4 mt-3 text-sm text-muted-foreground font-body">
                    {post.result_views && <span>👁 {post.result_views}</span>}
                    {post.result_saves && <span>🔖 {post.result_saves}</span>}
                    {post.result_comments && <span>💬 {post.result_comments}</span>}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Historico;
