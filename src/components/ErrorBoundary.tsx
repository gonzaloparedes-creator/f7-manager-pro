import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Antes de esto, cualquier error acá dejaba la pantalla en blanco sin
    // ningún rastro — ni para el usuario ni para nosotros. Al menos que
    // quede en la consola con el stack completo.
    console.error("F7 Manager Pro — error no capturado:", error, errorInfo);
    this.setState({ errorInfo });
  }

  copyDetails = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `F7 Manager Pro — error`,
      `URL: ${window.location.href}`,
      `Fecha: ${new Date().toISOString()}`,
      `Mensaje: ${error?.message ?? "(sin mensaje)"}`,
      error?.stack ? `\nStack:\n${error.stack}` : "",
      errorInfo?.componentStack ? `\nComponentes:\n${errorInfo.componentStack}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Encontramos un error inesperado. Recargá la página — si el problema sigue,
                copiá el detalle de abajo y enviánoslo.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => window.location.reload()} className="flex-1 gap-2">
                <RefreshCw className="h-4 w-4" /> Recargar página
              </Button>
              <Button onClick={this.copyDetails} variant="outline" className="flex-1 gap-2">
                <Copy className="h-4 w-4" /> {this.state.copied ? "¡Copiado!" : "Copiar detalles"}
              </Button>
            </div>
            <details className="rounded-md bg-muted/30 p-3 text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Detalle técnico</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
                {this.state.errorInfo?.componentStack ?? ""}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
