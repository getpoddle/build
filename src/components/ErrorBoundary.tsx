import { Component, ReactNode, ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Sentry } from '../lib/sentry';
import { logBoundaryCatch } from '../lib/tabDiagnostics';

// ─── Top-level boundary — wraps the entire app ────────────────────────────────

interface AppBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, AppBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): AppBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled exception:', error.message, info.componentStack);
    logBoundaryCatch('App', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f8fafc' }}>
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 text-sm mb-6">
              The page encountered an unexpected error. Refreshing usually fixes this.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #06b6d4 100%)' }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Page-level boundary — wraps individual route content ─────────────────────
// A crash in one page shows an inline error; navigation and other UI stay intact.

interface PageBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class PageErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, PageBoundaryState> {
  constructor(props: { children: ReactNode; resetKey?: string }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  componentDidUpdate(prevProps: { children: ReactNode; resetKey?: string }) {
    if (this.props.resetKey && prevProps.resetKey && this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  static getDerivedStateFromError(error: Error): PageBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary] Component crash:', error.message, info.componentStack);
    logBoundaryCatch('Page', error, info.componentStack);
  }

  handleDismiss = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8" style={{ minHeight: '40vh' }}>
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(220,38,38,0.08)' }}>
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">This section crashed</h3>
            <p className="text-slate-500 text-sm mb-5">
              An unexpected error occurred. The rest of the app is still working.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleDismiss}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
