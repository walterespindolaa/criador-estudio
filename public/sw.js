/* ═══════════════════════════════════════════════════════════════════════════
   Service Worker do CRIA

   ANTES: este arquivo só tratava PUSH. Não tinha handler de `fetch`.
   Consequência: ZERO cache. Toda abertura do app ia à rede buscar HTML, JS,
   CSS e fontes. No 4G ruim, 3 a 6 segundos de tela branca. O Trello abre em
   ~300ms porque o app-shell mora no cache do SW e a tela pinta ANTES da rede.

   AGORA ele faz três coisas:
   1. CACHE (app-shell + assets + fontes + imagens) → abre instantâneo e offline
   2. SHARE TARGET com arquivo → compartilhar um print/Reels pro CRIA
   3. PUSH (o que já existia)

   Estratégias, por tipo:
   - /assets/*  (JS/CSS com hash no nome, imutáveis) → cache-first
   - navegação   (o HTML)                            → network-first c/ timeout,
                                                        cai no index.html do cache
   - fontes                                          → stale-while-revalidate
   - imagens (Supabase Storage, CDN do Instagram)    → stale-while-revalidate
   - Supabase REST/Realtime                          → SEMPRE rede (quem cuida
                                                        do offline dos DADOS é a
                                                        persistência do react-query)
   ═══════════════════════════════════════════════════════════════════════════ */

const VERSION = "v4"; // v4: push com tag/renotify + badge (04/09)
const SHELL = `cria-shell-${VERSION}`;
const ASSETS = `cria-assets-${VERSION}`;
const FONTS = `cria-fonts-${VERSION}`;
const IMGS = `cria-img-${VERSION}`;

const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/app-icon-192.png"];

// Cache de imagem cresce sem limite se ninguém podar. 120 dá conta de uma
// sessão pesada (feed + referências) sem estourar a cota do navegador.
const MAX_IMGS = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("cria-") && !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── helpers ────────────────────────────────────────────────────────────────

async function podar(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // FIFO: as mais antigas saem primeiro.
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const rede = fetch(req)
    .then((res) => {
      // opaque (no-cors) também vale guardar: é assim que a imagem de CDN chega.
      if (res.ok || res.type === "opaque") {
        cache.put(req, res.clone());
        if (max) podar(cacheName, max);
      }
      return res;
    })
    .catch(() => null);
  return hit || (await rede) || Response.error();
}

// Navegação: tenta a rede (pra pegar deploy novo), mas não deixa a pessoa
// esperando pra sempre. 3,5s e serve o shell do cache.
async function networkFirstNav(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500)),
    ]);
    if (res && res.ok) cache.put("/index.html", res.clone());
    return res;
  } catch {
    return (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
  }
}

// ── SHARE TARGET ───────────────────────────────────────────────────────────
// A pessoa vê um Reels que quer usar de referência, aperta Compartilhar → CRIA,
// e o print/vídeo cai no banco de ideias. Como o CRIA é um SPA estático, o POST
// do sistema operacional não tem servidor pra receber: quem intercepta é o SW.
// Guardamos o arquivo aqui e redirecionamos pra tela de Ideias, que lê de volta.
const SHARE_CACHE = "cria-share";

// SEGURANÇA: o share target guarda bytes que vêm de FORA (qualquer app que
// compartilhe pro CRIA) e os serve de volta pela nossa origem. Se a gente ecoar
// o Content-Type escolhido por quem compartilhou, um "text/html" viraria página
// same-origin executável (XSS). Então: só aceitamos MIME de imagem/vídeo de uma
// lista fixa, servimos com o tipo seguro FORÇADO + nosniff + attachment, e a
// leitura de /__share/* nunca responde a uma navegação (só a fetch do app).
const SHARE_MIME_OK = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
]);

// Devolve o MIME seguro (da allow-list) ou null quando o tipo não é permitido.
function tipoSeguroCompartilhado(mime) {
  const m = (mime || "").split(";")[0].trim().toLowerCase();
  return SHARE_MIME_OK.has(m) ? m : null;
}

async function receberCompartilhamento(event) {
  const form = await event.request.formData();
  const arquivos = form.getAll("files").filter((f) => f && f.size > 0);
  const texto = [form.get("title"), form.get("text"), form.get("url")]
    .filter(Boolean)
    .join(" ")
    .trim();

  const cache = await caches.open(SHARE_CACHE);
  // Limpa o compartilhamento anterior: só o último interessa.
  await Promise.all((await cache.keys()).map((k) => cache.delete(k)));

  const nomes = [];
  for (let i = 0; i < arquivos.length && i < 4; i++) {
    const f = arquivos[i];
    // Só guarda imagem/vídeo de MIME conhecido; qualquer outro tipo é ignorado
    // (não gravamos bytes arbitrários de fora com Content-Type controlado por eles).
    const tipo = tipoSeguroCompartilhado(f.type);
    if (!tipo) continue;
    // Chave ALEATÓRIA (não Date.now(), que é previsível): dificulta um terceiro
    // adivinhar a URL do que foi compartilhado.
    const url = `/__share/${crypto.randomUUID()}`;
    await cache.put(
      url,
      new Response(f, {
        headers: {
          "content-type": tipo,                 // tipo seguro forçado, não o enviado
          "x-content-type-options": "nosniff",  // o navegador não re-adivinha o tipo
          "content-disposition": "attachment",  // se abrir direto, baixa (não renderiza)
        },
      }),
    );
    nomes.push(url);
  }
  await cache.put(
    "/__share/meta",
    new Response(JSON.stringify({ texto, arquivos: nomes, em: Date.now() }), {
      headers: { "content-type": "application/json" },
    }),
  );

  return Response.redirect("/app/ideias?compartilhado=1", 303);
}

// ── FETCH ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Share target (POST): precisa vir antes do filtro de GET.
  if (req.method === "POST" && url.pathname === "/compartilhar") {
    event.respondWith(receberCompartilhamento(event));
    return;
  }

  if (req.method !== "GET") return;

  // Supabase (REST, auth, realtime, functions) e analytics: nunca do cache.
  // Dado velho de API é pior do que dado nenhum. O offline dos DADOS é
  // resolvido pela persistência do react-query, não aqui.
  if (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.includes("google-analytics") ||
    url.hostname.includes("googletagmanager") ||
    url.hostname.includes("facebook")
  ) {
    return;
  }

  // Ler de volta o arquivo compartilhado (só via fetch do app, nunca navegação).
  if (url.pathname.startsWith("/__share/")) {
    // Navegar direto pra /__share/* (abrir a URL no browser) faria o conteúdo de
    // fora virar documento same-origin. Recusamos: só o fetch da tela de Ideias lê.
    if (req.mode === "navigate") {
      event.respondWith(new Response("", { status: 404 }));
      return;
    }
    event.respondWith(
      caches.open(SHARE_CACHE).then((c) => c.match(req).then((r) => r || new Response("{}", { headers: { "content-type": "application/json" } }))),
    );
    return;
  }

  // O HTML (qualquer rota do SPA).
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNav(req));
    return;
  }

  // Build do Vite: /assets/index-a1b2c3.js: o hash muda a cada deploy, então o
  // conteúdo de um arquivo nunca muda. Cache-first sem medo.
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, ASSETS));
    return;
  }

  // Ícones, logos e o resto do /public.
  if (url.origin === self.location.origin && /\.(png|svg|ico|webp|jpg|jpeg)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, IMGS, MAX_IMGS));
    return;
  }

  // Fontes do Google.
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }

  // Imagem remota (Storage, CDN do Instagram, avatares).
  if (req.destination === "image") {
    event.respondWith(staleWhileRevalidate(req, IMGS, MAX_IMGS));
    return;
  }
});

// ── PUSH (o que já existia) ────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Cria";
  const url = data.url || "/app";
  const options = {
    body: data.body || data.message || "",
    icon: "/app-icon-192.png",
    badge: "/favicon-32.png",
    // tag por destino: 10 avisos do mesmo lugar viram 1 banner atualizado, não 10.
    tag: "cria-" + url,
    renotify: true,
    data: { url },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Bolinha no ícone do app instalado (quando a plataforma suporta).
      "setAppBadge" in self.navigator ? self.navigator.setAppBadge().catch(function () {}) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
