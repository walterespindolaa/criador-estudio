export const UPLOAD_LIMITS = {
  avatar: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
    label: "avatar",
  },
  bioMedia: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "imagem da bio",
  },
  postMedia: {
    maxBytes: 50 * 1024 * 1024, // 50 MB (vídeos curtos)
    allowedMimes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/quicktime", "video/webm",
    ],
    label: "mídia do post",
  },
  file: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    allowedMimes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/quicktime", "video/webm",
      "application/pdf",
    ],
    label: "arquivo",
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateUpload(file: File, kind: UploadKind): ValidationResult {
  const limits = UPLOAD_LIMITS[kind];

  if (file.size === 0) {
    return { ok: false, reason: "O arquivo está vazio." };
  }

  if (file.size > limits.maxBytes) {
    const mb = (limits.maxBytes / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      reason: `Arquivo grande demais. O ${limits.label} pode ter no máximo ${mb} MB.`,
    };
  }

  const mime = (file.type || "").toLowerCase();
  if (!mime) {
    return {
      ok: false,
      reason: "Não conseguimos identificar o tipo do arquivo. Tente outro.",
    };
  }

  if (!(limits.allowedMimes as readonly string[]).includes(mime)) {
    return {
      ok: false,
      reason: `Tipo de arquivo não permitido para ${limits.label}.`,
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const dangerousExts = ["html", "htm", "svg", "js", "exe", "sh", "bat", "php"];
  if (dangerousExts.includes(ext)) {
    return {
      ok: false,
      reason: "Extensão de arquivo não permitida.",
    };
  }

  return { ok: true };
}

export function bytesToMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
