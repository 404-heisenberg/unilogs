import React, { Component, type ReactNode, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LocalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in sub-tree:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="m-8 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900 shadow-md">
          <h2 className="text-xl font-bold">Runtime Error Caught</h2>
          <p className="mt-2 text-sm font-semibold">{this.state.error?.message}</p>
          {this.state.error?.stack && (
            <pre className="mt-4 max-h-60 overflow-auto rounded bg-red-100 p-3 text-xs font-mono text-red-800">
              {this.state.error.stack}
            </pre>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-md bg-[#1c0d06] px-4 py-2 text-xs font-semibold text-[#f5ebe0] transition-colors hover:bg-[#1c0d06]/90"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-900 transition-colors hover:bg-red-100"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if ((e.key === 'n' || e.key === 'N') && !isTyping) {
        e.preventDefault();
        navigate('/entries/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#f5ebe0]">
      <LocalErrorBoundary resetKey={location.pathname}>
        <Outlet />
      </LocalErrorBoundary>
    </div>
  );
}
