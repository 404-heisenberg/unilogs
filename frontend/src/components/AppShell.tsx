import React, { Component, ReactNode, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
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

  public render() {
    if (this.state.hasError) {
      return (
        <div className="m-8 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900 shadow-md">
          <h2 className="text-xl font-bold">Runtime Error Caught</h2>
          <p className="mt-2 text-sm font-semibold">{this.state.error?.message}</p>
          <pre className="mt-4 max-h-60 overflow-auto rounded bg-red-100 p-3 text-xs font-mono text-red-800">
            {this.state.error?.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-[#1c0d06] px-4 py-2 text-xs font-semibold text-[#f5ebe0]"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppShell() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'n' && !isTyping) {
        e.preventDefault();
        navigate('/entries/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#f5ebe0]">
      <LocalErrorBoundary>
        <Outlet />
      </LocalErrorBoundary>
    </div>
  );
}
