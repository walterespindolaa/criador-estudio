import { supabase } from "@/integrations/supabase/client";

export async function generateNotifications(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  // Get current week range
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = sunday.toISOString().split("T")[0];

  const [postsRes, profileRes, existingRes] = await Promise.all([
    supabase.from("posts").select("id, status, scheduled_date, published_at").eq("user_id", userId),
    supabase.from("profiles").select("weekly_goal").eq("id", userId).single(),
    supabase.from("notifications").select("type, created_at").eq("user_id", userId).gte("created_at", weekStart),
  ]);

  const posts = postsRes.data || [];
  const weeklyGoal = profileRes.data?.weekly_goal || 3;
  const existingNotifs = (existingRes.data as any[]) || [];

  // Weekly published count
  const weekPublished = posts.filter(p =>
    p.status === "publicado" && p.published_at &&
    p.published_at.split("T")[0] >= weekStart && p.published_at.split("T")[0] <= weekEnd
  ).length;

  // 1. Weekly goal met
  if (weekPublished >= weeklyGoal && !existingNotifs.find(n => n.type === "meta_batida")) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "meta_batida",
      title: "Meta semanal batida!",
      description: `Você publicou ${weekPublished} posts esta semana. Parabéns!`,
      link: "/app/plano",
    } as any);
  }

  // 2. No posts in 3+ days
  const publishedDates = posts
    .filter(p => p.published_at)
    .map(p => p.published_at!)
    .sort()
    .reverse();
  const lastPublished = publishedDates[0];
  const daysSinceLast = lastPublished
    ? Math.floor((now.getTime() - new Date(lastPublished).getTime()) / 86400000)
    : 999;

  const todayReminder = existingNotifs.find(n => n.type === "lembrete_postar" && n.created_at?.startsWith(today));
  if (daysSinceLast >= 3 && !todayReminder) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "lembrete_postar",
      title: "Que tal publicar hoje?",
      description: `Faz ${daysSinceLast} dias desde seu último post.`,
      link: "/app/criando",
    } as any);
  }

  // 3. Scheduled posts for today
  const todayScheduled = posts.filter(p => p.scheduled_date === today && p.status !== "publicado");
  const todayScheduledNotif = existingNotifs.find(n => n.type === "lembrete_postar" && n.created_at?.startsWith(today));
  if (todayScheduled.length > 0 && !todayScheduledNotif) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "lembrete_postar",
      title: `Você tem ${todayScheduled.length} post(s) pra hoje`,
      description: "Confira seu plano de conteúdo.",
      link: "/app/plano",
    } as any);
  }
}
