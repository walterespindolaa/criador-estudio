import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://localhost:8080",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS_TO_CLEAN = ["avatars", "media", "bio-media", "files"];

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deleteUserStorage(supabase: ReturnType<typeof createClient>, userId: string) {
  for (const bucket of BUCKETS_TO_CLEAN) {
    try {
      const { data: files, error: listErr } = await supabase.storage
        .from(bucket)
        .list(userId, { limit: 1000 });

      if (listErr) {
        console.warn(`[delete-account] list bucket=${bucket} failed:`, listErr.message);
        continue;
      }
      if (!files || files.length === 0) continue;

      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
      if (rmErr) {
        console.warn(`[delete-account] remove bucket=${bucket} failed:`, rmErr.message);
      }
    } catch (e) {
      console.warn(`[delete-account] bucket=${bucket} exception:`, e);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const confirmEmail = (body?.confirm_email ?? "").toString().trim().toLowerCase();
    const userEmail = (user.email ?? "").toLowerCase();

    if (!confirmEmail || confirmEmail !== userEmail) {
      return new Response(JSON.stringify({ error: "email_confirmation_mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await deleteUserStorage(admin, user.id);

    const userIdHash = await hashString(user.id);
    const emailHash = await hashString(userEmail);

    await admin.from("account_deletion_log").insert({
      user_id_hash: userIdHash,
      email_hash: emailHash,
      request_metadata: {
        user_agent: req.headers.get("User-Agent") ?? null,
      },
    });

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("[delete-account] deleteUser failed:", delErr);
      return new Response(JSON.stringify({ error: "deletion_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[delete-account] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
