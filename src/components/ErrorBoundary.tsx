import { Component, ReactNode, ErrorInfo } from "react";
import * as Sentry from "@sentry/react";
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

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
    // Como o boundary "engole" o erro de renderização, o Sentry não o captura
    // sozinho mandamos manualmente (o app_logs continua recebendo via logError).
    Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } });
    logError(error?.message || "Erro de renderização", {
      stack: error?.stack?.slice(0, 1200),
      componentStack: info?.componentStack?.slice(0, 1200),
      boundary: true,
    });
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-lg font-medium">Algo deu errado nesta página.</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center">
            {this.state.error?.message || "Erro inesperado."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
