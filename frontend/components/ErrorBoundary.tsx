import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    trackEvent(ANALYTICS_EVENTS.COMPONENT_ERROR, {
      message: error.message,
      component: errorInfo.componentStack?.split("\n")[1]?.trim()
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px] border border-error/20 rounded-2xl bg-error/5 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 bg-error/10 rounded-2xl mb-6">
            <AlertCircle className="h-10 w-10 text-error" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-text-muted mb-4 max-w-md text-sm">
            This component encountered an error and couldn't render. You can try again or refresh the page.
          </p>

          {this.state.error && (
            <div className="mb-6 w-full max-w-md">
              <button
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                className="flex items-center gap-1.5 text-xs text-error/60 hover:text-error transition-colors mx-auto mb-2"
              >
                {this.state.showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {this.state.showDetails ? "Hide" : "Show"} details
              </button>
              {this.state.showDetails && (
                <div className="p-3 bg-black/40 border border-error/10 rounded-lg text-left overflow-x-auto">
                  <code className="text-[11px] text-error/80 font-mono">
                    {this.state.error.name}: {this.state.error.message}
                  </code>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 bg-error hover:bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-[0.98]"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}