import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   VÍDEO DO DRIVE -> BUNNY, PELO SERVIDOR (Walter, 01/10/2026)

   Só AVISA a edge bunny-ingerir-drive: quem baixa o arquivo é o próprio Bunny,
   direto do Drive. Nada passa pelo computador nem pela internet de quem anexou,
   e fechar a aba não interrompe nada. A promoção pro Bunny acontece quando o
   encoding termina (a edge confere, e um robô confere de 5 em 5 minutos).

   Uma chamada por mídia por sessão: abrir o mesmo post várias vezes não
   dispara busca repetida (e a edge também se protege sozinha).
   ═══════════════════════════════════════════════════════════════════════════ */
const jaPedido = new Set<string>();

export async function levarVideoDoDriveProBunny(mediaId: string, driveToken?: string | null): Promise<void> {
  // Com token novo vale pedir de novo (ex.: retentativa depois de um erro).
  const chave = `${mediaId}:${driveToken ? "t" : "-"}`;
  if (jaPedido.has(chave)) return;
  jaPedido.add(chave);
  try {
    const { error } = await supabase.functions.invoke("bunny-ingerir-drive", {
      body: { mediaId, driveToken: driveToken || null },
    });
    if (error) throw error;
  } catch (e) {
    // Falhar aqui não tira o vídeo de ninguém: a peça segue tocando pelo Drive.
    console.warn("[bunny-ingestao] não consegui pedir a passagem pro Bunny:", e);
    jaPedido.delete(chave);
  }
}
