import { Component, ReactNode, ErrorInfo } from "react";
import { logError } from "@/lib/logError";

interface Props {
  children: ReactNode;
  /** Tela alternativa. A padrão mostra a mensagem técnica do erro, o que serve
   *  pra quem está usando o app e pode nos contar o que apareceu. Numa página
   *  pública, aberta por um seguidor, essa mensagem não significa nada e ainda
   *  vaza detalhe interno: ali passa-se um fallback próprio. */
  fallback?: ReactNode;
}
interface State { hasError: boolean; error?: Error; }

/* ERRO DE PEDAÇO DO APP (Walter, 23/09/2026)
   O Vite quebra o app em vários arquivos .js com hash no nome e o React carrega
   cada tela sob demanda. Quando um desses arquivos não vem, o React estoura
   "Failed to fetch dynamically imported module" e cai aqui. Acontece em duas
   situações, e nas duas a tela antiga ficava presa:

   1. O host devolve 503 por alguns segundos (foi o caso do print de hoje).
   2. Saiu um deploy novo. Os arquivos antigos deixam de existir, mas a aba que
      já estava aberta (ou o index.html guardado pelo nosso service worker, que
      é servido quando a rede falha) continua pedindo os hashes velhos.

   O "Tentar novamente" antigo só limpava o estado do React e re-renderizava.
   Isso NUNCA resolvia: o navegador guarda a promessa do import que falhou, e a
   re-renderização recebe o mesmo erro na hora. O que resolve é recarregar a
   página buscando um index.html fresco.

   Então: uma recarga automática, UMA só por aba (a trava vive no
   sessionStorage), limpando antes o shell do service worker pra não receber de
   volta o mesmo index.html velho. Se depois disso ainda falhar, aí é problema
   de verdade e a pessoa vê a mensagem em vez de entrar em laço de recarga. */
const CHAVE_RECARGA = "cria.recarregou-por-chunk";
function ehErroDeChunk(e?: Error): boolean {
  const m = `${e?.message ?? ""} ${e?.name ?? ""}`.toLowerCase();
  return (
    m.includes("dynamically imported module") ||
    m.includes("failed to fetch dynamically") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module") ||
    (m.includes("chunkloaderror") || m.includes("chunk load"))
  );
}

async function recarregarLimpo() {
  try {
    // Só o shell (index.html) e os assets com hash. O cache de imagens e o
    // registro de push ficam de pé: não têm nada a ver com o problema.
    if (typeof caches !== "undefined") {
      const chaves = await caches.keys();
      await Promise.all(
        chaves.filter((k) => k.startsWith("cria-shell") || k.startsWith("cria-assets")).map((k) => caches.delete(k)),
      );
    }
  } catch { /* se não der pra limpar, recarrega assim mesmo */ }
  window.location.reload();
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  private limpeza?: ReturnType<typeof setTimeout>;
  componentDidMount() {
    /* Solta a trava da recarga automática depois que o app ficou de pé por um
       tempo. Sem isso a trava valeria pra aba inteira e o PRÓXIMO deploy do dia
       não ganharia a recarga automática: a pessoa veria a tela de erro à toa. */
    this.limpeza = setTimeout(() => {
      if (!this.state.hasError) {
        try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* aba anônima */ }
      }
    }, 10000);
  }
  componentWillUnmount() {
    if (this.limpeza) clearTimeout(this.limpeza);
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
    // Recarga automática pra erro de pedaço do app, no máximo uma por aba.
    if (ehErroDeChunk(error)) {
      let jaTentou = false;
      try { jaTentou = sessionStorage.getItem(CHAVE_RECARGA) === "1"; } catch { jaTentou = false; }
      if (!jaTentou) {
        try { sessionStorage.setItem(CHAVE_RECARGA, "1"); } catch { /* aba anônima */ }
        void recarregarLimpo();
        return; // não reporta: é atualização de versão, não defeito
      }
    }
    // Como o boundary "engole" o erro de renderização, o Sentry não o captura
    // sozinho mandamos manualmente (o app_logs continua recebendo via logError).
    // Import dinâmico: o ErrorBoundary é o primeiro componente da árvore e não
    // pode carregar o SDK do Sentry no boot (ver main.tsx).
    void import("@/lib/sentry").then((m) => m.capturar(error, info?.componentStack)).catch(() => { /* ok */ });
    logError(error?.message || "Erro de renderização", {
      stack: error?.stack?.slice(0, 1200),
      componentStack: info?.componentStack?.slice(0, 1200),
      boundary: true,
    });
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      /* Erro de pedaço do app tem tela própria: a mensagem técnica ("Failed to
         fetch dynamically imported module...") não diz nada pra quem está
         usando, e o botão precisa RECARREGAR, não re-renderizar. */
      const deChunk = ehErroDeChunk(this.state.error);
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-lg font-medium">
            {deChunk ? "Não consegui carregar esta parte do Cria." : "Algo deu errado nesta página."}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm text-center">
            {deChunk
              ? "Costuma ser uma versão nova que acabou de subir, ou a conexão oscilando. Recarregar resolve."
              : this.state.error?.message || "Erro inesperado."}
          </p>
          <button
            onClick={() => (deChunk ? void recarregarLimpo() : this.setState({ hasError: false }))}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            {deChunk ? "Recarregar o Cria" : "Tentar novamente"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
