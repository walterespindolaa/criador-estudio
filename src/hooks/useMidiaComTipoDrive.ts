import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDriveFileId, isUnknownDriveMedia, type MediaLike } from "@/lib/driveMedia";

/* MÍDIA DO DRIVE SEM TIPO SE CORRIGE SOZINHA (Walter, 29/10/2026).
   Quando o link é colado com o arquivo ainda "Restrito", o Drive não diz se é
   imagem ou vídeo e a mídia fica sem tipo (miniatura + "Abrir no Drive", sem
   play). Antes, liberar o compartilhamento depois não resolvia no link do
   cliente. Aqui, toda tela que mostra a mídia pergunta de novo ao Drive (pela
   edge drive-file-meta, que também grava o tipo no banco) e já troca a mídia
   na tela, com play, sem ninguém recarregar nada.
   Uma pergunta por arquivo por carregamento de página: se o arquivo continua
   privado, não insiste. */

const descoberto = new Map<string, string>();
const tentado = new Map<string, Promise<string | null>>();
const respondido = new Set<string>();

/** O Drive já respondeu sobre este arquivo nesta página (público ou não)? */
export function driveJaRespondeu(fileId: string | null | undefined): boolean {
  return !!fileId && respondido.has(fileId);
}

function perguntar(fileId: string): Promise<string | null> {
  const ja = tentado.get(fileId);
  if (ja) return ja;
  const p = supabase.functions
    .invoke("drive-file-meta", { body: { corrigir_tipo: true, file_id: fileId } })
    .then(({ data }) => {
      const d = data as { ok?: boolean; mime_type?: string | null } | null;
      const mime = d?.ok ? d.mime_type ?? null : null;
      if (mime) descoberto.set(fileId, mime);
      respondido.add(fileId);
      return mime;
    })
    .catch(() => { respondido.add(fileId); return null; });
  tentado.set(fileId, p);
  return p;
}

function comTipo<T extends MediaLike>(m: T): T {
  if (!isUnknownDriveMedia(m)) return m;
  const id = getDriveFileId(m);
  const mime = id ? descoberto.get(id) : undefined;
  return mime ? { ...m, file_type: mime } : m;
}

export function useMidiaComTipoDrive<T extends MediaLike>(media: T[]): T[] {
  const [, setVersao] = useState(0);
  const chave = media.map((m) => (isUnknownDriveMedia(m) ? getDriveFileId(m) ?? "" : "")).join("|");

  useEffect(() => {
    let vivo = true;
    const ids = media
      .filter((m) => isUnknownDriveMedia(m))
      .map((m) => getDriveFileId(m))
      .filter((id): id is string => !!id && !descoberto.has(id));
    if (!ids.length) return;
    // Atualiza a tela também quando continua privado: é o que acende o selo.
    Promise.all(ids.map(perguntar)).then(() => { if (vivo) setVersao((v) => v + 1); });
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  return media.map(comTipo);
}
