// CORS centralizado — restringe a origens conhecidas (em vez de "*").
const allowedOrigins = [
  "https://app.criasocialclub.com.br",
  "https://criasocialclub.com.br",
  "https://criador-estudio.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  // Libera previews do Lovable dinamicamente (*.lovable.app).
  const isLovablePreview = /^https:\/\/[a-zA-Z0-9-]+\.lovable\.app$/.test(origin);
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
