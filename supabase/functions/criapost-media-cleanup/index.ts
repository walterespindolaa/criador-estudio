import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cleanup-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const zone = Deno.env.get("BUNNY_STORAGE_ZONE"), host = Deno.env.get("BUNNY_STORAGE_HOST"), pass = Deno.env.get("BUNNY_STORAGE_PASSWORD")!;
    const apiKey = Deno.env.get("BUNNY_CRIAPOST_API_KEY")!, lib = Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID");

    const { data: refs } = await svc.from("external_media_refs")
      .select("id, provider, external_file_id, bunny_video_id")
      .not("expires_at", "is", null).lt("expires_at", new Date().toISOString()).limit(200);
    let removed = 0;
    for (const r of refs ?? []) {
      try {
        if (r.provider === "bunny_storage" && r.external_file_id)
          await fetch(`https://${host}/${zone}/${r.external_file_id}`, { method: "DELETE", headers: { AccessKey: pass } }).catch(() => {});
        if (r.bunny_video_id)
          await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${r.bunny_video_id}`, { method: "DELETE", headers: { AccessKey: apiKey } }).catch(() => {});
        await svc.from("external_media_refs").delete().eq("id", r.id);
        removed++;
      } catch (_) {}
    }
    return json({ ok: true, removed });
  } catch (e) { return json({ error: String(e) }, 500); }
});
