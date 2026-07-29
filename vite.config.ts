import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source maps do Sentry: só ligam quando as envs SENTRY_AUTH_TOKEN + SENTRY_ORG
// existem no build (setar no Vercel). Sem elas, o build fica IDÊNTICO ao de hoje
// (sem sourcemap, sem plugin) — nada quebra. Com elas, o build gera os maps, sobe
// pro Sentry e APAGA os .map do dist (não ficam públicos). Assim o stack no Sentry
// mostra a linha real do código, não a minificada.
const sentryUpload = !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
