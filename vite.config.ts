import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source maps do Sentry: só ligam quando as envs SENTRY_AUTH_TOKEN + SENTRY_ORG
// existem no build (setar no Vercel). Sem elas, o build fica IDÊNTICO ao de hoje
// (sem sourcemap, sem plugin): nada quebra. Com elas, o build gera os maps, sobe
// pro Sentry e APAGA os .map do dist (não ficam públicos). Assim o stack no Sentry
// mostra a linha real do código, não a minificada.
const sentryUpload = !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG;

// Um id por build. Vai pro sw.js (cache de arquivos) e pro app como
// __APP_BUILD__ (cache de dados persistido no IndexedDB, ver lib/queryPersist).
const BUILD_ID = Date.now().toString(36);

// VERSÃO LEGÍVEL NO RODAPÉ (Walter, 06/11/2026: "a versão num formato que eu
// consiga entender qual foi o update"). Data e hora do build no fuso de Brasília
// + os 7 primeiros caracteres do commit (a Vercel passa VERCEL_GIT_COMMIT_SHA),
// que é o mesmo código que aparece no `git log --oneline`.
const agoraBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date()).replace(",", " às");
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
const VERSAO = COMMIT ? `${agoraBR} · ${COMMIT}` : agoraBR;
// NÚMERO CURTO (Walter, 06/11/2026: "mostrar tipo V15.90"). Horas desde 01/07/2026
// (início do Cria em produção) no momento do build: sempre sobe, não depende do
// histórico do git (a Vercel clona raso, então contar commits não é confiável) e
// cabe em 4 dígitos por anos. 3084 horas vira "V30.84". Data, hora e commit
// continuam no title, pra quem precisar rastrear.
const HORAS = Math.max(0, Math.floor((Date.now() - Date.UTC(2026, 6, 1, 3)) / 3_600_000));
const VERSAO_CURTA = `V${Math.floor(HORAS / 100)}.${String(HORAS % 100).padStart(2, "0")}`;

// Carimba o service worker com o id do build (ver public/sw.js). Roda depois
// que o dist está pronto; o sw.js é copiado do public/ como está, então a
// troca é feita no arquivo final.
function swBuildId() {
  return {
    name: "cria-sw-build-id",
    apply: "build" as const,
    closeBundle() {
      const alvo = path.resolve(__dirname, "dist/sw.js");
      if (!fs.existsSync(alvo)) return;
      fs.writeFileSync(alvo, fs.readFileSync(alvo, "utf8").replace(/__BUILD_ID__/g, BUILD_ID));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
    __APP_VERSAO__: JSON.stringify(VERSAO),
    __APP_VERSAO_CURTA__: JSON.stringify(VERSAO_CURTA),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    swBuildId(),
    sentryUpload && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT ?? "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    minify: 'esbuild',
    // Só gera sourcemap quando o upload pro Sentry está ligado (senão os .map
    // ficariam públicos no dist sem serventia). O plugin apaga os .map após subir.
    sourcemap: sentryUpload,
    rollupOptions: {
      output: {
        // Só agrupamos o que é REALMENTE usado no boot (vendor/query/supabase).
        // recharts, jspdf e html2canvas são carregados sob demanda (import()
        // dinâmico / rotas lazy); listá-los aqui forçava-os pro preload inicial
        // e inflava o bundle de entrada. Deixar o Rollup fatiar sozinho mantém
        // esses pacotes fora do primeiro carregamento.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}));
