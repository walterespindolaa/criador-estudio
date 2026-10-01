// ═══════════════════════════════════════════════════════════════════════════
// TUTORIAL-VOZ (Walter, 01/10/2026) · só admin
//
// Gera a narração dos vídeos tutoriais do Cria na ElevenLabs, com a voz que a
// Gabriela gravou. A chave fica no segredo ELEVENLABS_API_KEY e nunca sai do
// servidor. O áudio e o tempo de cada letra (pra legenda e cursor baterem com
// a fala) vão pro bucket privado `tutoriais` e voltam como links assinados.
//
// Ações:
//   { acao: "vozes" }                                   -> lista as vozes da conta
//   { acao: "gerar", id, texto, voz, velocidade?, ajustes? } -> gera e guarda uma cena
//
// ajustes (opcional, pra deixar a voz menos robótica):
//   modelo     eleven_multilingual_v2 (padrão) | eleven_v3 | eleven_turbo_v2_5
//   estabilidade 0..1 (menor = mais expressiva), similaridade 0..1, estilo 0..1
//   anterior / proximo: texto da cena de antes e de depois. A ElevenLabs usa pra
//   manter a entonação contínua entre cenas geradas separadas.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const XI = "https://api.elevenlabs.io/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const chave = Deno.env.get("ELEVENLABS_API_KEY");
    if (!chave) return json({ error: "ELEVENLABS_API_KEY não configurado" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.acao === "vozes") {
      const r = await fetch(`${XI}/voices`, { headers: { "xi-api-key": chave } });
      if (!r.ok) return json({ error: "elevenlabs recusou", status: r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
      const j = await r.json();
      return json({
        vozes: (j.voices ?? []).map((v: Record<string, unknown>) => ({
          id: v.voice_id, nome: v.name, categoria: v.category,
        })),
      });
    }

    if (body.acao === "gerar") {
      const { id, texto, voz } = body as { id?: string; texto?: string; voz?: string };
      if (!id || !texto || !voz || !/^[a-z0-9\-_/]+$/i.test(id)) return json({ error: "id, texto e voz são obrigatórios" }, 400);
      // A ElevenLabs aceita velocidade de 0.7 a 1.2. Walter pediu entre 1.05 e 1.10.
      const velocidade = Math.min(1.2, Math.max(0.7, Number(body.velocidade) || 1.08));
      const aj = (body.ajustes ?? {}) as Record<string, unknown>;
      const MODELOS = ["eleven_multilingual_v2", "eleven_v3", "eleven_turbo_v2_5"];
      const modelo = MODELOS.includes(String(aj.modelo)) ? String(aj.modelo) : "eleven_multilingual_v2";
      const num = (v: unknown, padrao: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : padrao; };
      const pedido: Record<string, unknown> = {
        text: texto,
        model_id: modelo,
        language_code: "pt",
        voice_settings: {
          stability: num(aj.estabilidade, 0.5), similarity_boost: num(aj.similaridade, 0.8),
          style: num(aj.estilo, 0.15), use_speaker_boost: true, speed: velocidade,
        },
      };
      // Continuidade entre cenas (o v3 não aceita, então só manda nos outros modelos).
      if (modelo !== "eleven_v3") {
        if (typeof aj.anterior === "string" && aj.anterior) pedido.previous_text = aj.anterior.slice(0, 1000);
        if (typeof aj.proximo === "string" && aj.proximo) pedido.next_text = aj.proximo.slice(0, 1000);
      }
      const r = await fetch(`${XI}/text-to-speech/${encodeURIComponent(voz)}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": chave, "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      if (!r.ok) return json({ error: "elevenlabs recusou", status: r.status, detalhe: (await r.text()).slice(0, 400) }, 502);
      const j = await r.json();
      const bin = Uint8Array.from(atob(j.audio_base64 as string), (c) => c.charCodeAt(0));
      const alinhamento = JSON.stringify({ texto, velocidade, modelo, ajustes: aj, alignment: j.alignment ?? null, normalized: j.normalized_alignment ?? null });

      const up1 = await svc.storage.from("tutoriais").upload(`${id}.mp3`, bin, { contentType: "audio/mpeg", upsert: true });
      if (up1.error) return json({ error: "upload do áudio falhou", detalhe: up1.error.message }, 500);
      const up2 = await svc.storage.from("tutoriais").upload(`${id}.json`, new TextEncoder().encode(alinhamento), { contentType: "application/json", upsert: true });
      if (up2.error) return json({ error: "upload do alinhamento falhou", detalhe: up2.error.message }, 500);

      const { data: a } = await svc.storage.from("tutoriais").createSignedUrl(`${id}.mp3`, 3600);
      const { data: b } = await svc.storage.from("tutoriais").createSignedUrl(`${id}.json`, 3600);
      return json({ ok: true, audio: a?.signedUrl, alinhamento: b?.signedUrl });
    }

    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("[tutorial-voz]", e);
    return json({ error: String(e) }, 500);
  }
});
