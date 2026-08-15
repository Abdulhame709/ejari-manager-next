import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Application-level error boundary. Catches render-time errors so a failure
 * in one page never white-screens the whole app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log for observability; replace with a crash-reporting call when wired.
    console.error("[EJARI ErrorBoundary]", error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const showTechnicalDetails = import.meta.env.DEV;
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-background px-4"
          dir="rtl"
          role="alert"
        >
          <div className="max-w-md text-center">
            <div className="text-6xl" aria-hidden="true">
              !
            </div>
            <h1 className="mt-4 text-xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              نعتذر عن هذا الخلل. حاول تحديث الصفحة، وإذا استمرت المشكلة تواصل مع الدعم.
            </p>
            {showTechnicalDetails && this.state.error?.message && (
              <pre
                className="mt-3 overflow-auto rounded-md bg-muted p-3 text-right text-xs text-muted-foreground"
                dir="ltr"
              >
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={() => window.location.assign("/")}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
