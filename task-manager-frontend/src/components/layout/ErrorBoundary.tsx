import { Info } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  message?: string;
  onRetry?: () => void;
  mini?: boolean;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Boundary caught error:", error, errorInfo);
  }

  private handleReset = () => {
    if (this.props.onRetry) this.props.onRetry();
    this.setState({ hasError: false });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.mini) {
        return (
          <div className="flex h-full w-full items-center justify-center p-4 bg-surface-muted rounded-md border border-failure/20">
            <button
              onClick={this.handleReset}
              className="text-xs font-medium text-failure hover:underline"
            >
              {this.props.message || "Component Error. Click to retry."}
            </button>
          </div>
        );
      }

      return (
        <div className="flex min-h-50 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-8 dark:border-slate-800">
          <div className="mb-4 rounded-full bg-failure/10 p-3 text-failure">
            <Info />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-text-main">
            Something went wrong
          </h3>
          <p className="mb-6 text-center text-sm text-text-sub">
            {this.props.message ||
              "An error occurred while rendering this section."}
          </p>
          <button onClick={this.handleReset} className="btn-secondary text-sm">
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
