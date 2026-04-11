import { Component, ReactNode, ErrorInfo } from "react";

interface Props { children: ReactNode; }
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
  }
  render() {
    if (this.state.hasError) {
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
