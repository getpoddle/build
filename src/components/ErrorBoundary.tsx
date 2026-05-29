import { Component, ReactNode, ErrorInfo } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCount: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, errorCount: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error caught by boundary:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorCount: 0 });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--app-bg)' }}>
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
