import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Aceita chamada manual (POST) ou de cron (GET)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  // Falha FECHADO: sem segredo configurado, ninguém chama esta função destrutiva.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Busca arquivos expirados (source = 'upload' e expires_at no passado)
    const { data: expiredFiles, error } = await supabase
      .from("files")
      .select("id, user_id, storage_path")
      .eq("source", "upload")
      .lt("expires_at", new Date().toISOString())
      .limit(100); // processa em lotes de 100

    if (error) throw error;
    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let deleted = 0;
    for (const file of expiredFiles) {
      // Deleta do Supabase Storage
      if (file.storage_path) {
        await supabase.storage.from("files").remove([file.storage_path]);
      }
      // Deleta o registro (trigger atualiza storage_used_bytes automaticamente)
      const { error: delErr } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);
      if (!delErr) deleted++;
    }

    // Envia notificação para usuários que estão acima de 80% do limite
    await notifyHighUsageUsers();

    return new Response(JSON.stringify({ deleted, processed: expiredFiles.length }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[storage-cleanup] unhandled error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

async function notifyHighUsageUsers() {
  const { data: users } = await supabase
    .from("profiles")
    .select("id, storage_used_bytes, storage_quota_bytes")
    .gt("storage_used_bytes", 0);

  if (!users) return;

  for (const user of users) {
    const pct = user.storage_used_bytes / user.storage_quota_bytes;
    if (pct >= 0.8) {
      // Verifica se já enviou notificação hoje
      const today = new Date().toDateString();
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "storage_warning")
        .gte("created_at", new Date(today).toISOString())
        .maybeSingle();

      if (!existing) {
        const pctLabel = Math.round(pct * 100);
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "storage_warning",
          title: `Armazenamento ${pctLabel}% usado`,
          description: pctLabel >= 100
            ? "Seu armazenamento está cheio. Novos uploads estão bloqueados. Exclua arquivos ou aguarde a limpeza automática."
            : `Você usou ${pctLabel}% do seu armazenamento. Arquivos mais antigos serão removidos automaticamente.`,
          read: false,
        });
      }
    }
  }
}
