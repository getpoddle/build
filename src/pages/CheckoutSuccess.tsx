import { useEffect, useState } from 'react';
import { CheckCircle, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import PoddleMark from '../components/PoddleMark';

interface CheckoutSuccessProps {
  onNavigate: (page: string) => void;
}

export default function CheckoutSuccess({ onNavigate }: CheckoutSuccessProps) {
  const { subscription, loading } = useSubscription();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onNavigate('workspaces');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onNavigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--app-bg)' }}
    >
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <PoddleMark size={32} />
          <span className="font-black text-xl tracking-tight">
            <span style={{ color: 'var(--signal)', fontWeight: 700 }}>Poddle</span><span style={{ color: 'var(--app-text-muted)', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
          </span>
        </div>

        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ background: 'rgba(22,163,74,0.12)', border: '2px solid rgba(22,163,74,0.35)' }}
        >
          <CheckCircle className="w-10 h-10" style={{ color: '#16a34a' }} />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--app-text-primary)' }}>
          You're all set!
        </h1>

        {loading ? (
          <div className="flex items-center justify-center gap-2 mb-8" style={{ color: 'var(--app-text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Activating your plan…</span>
          </div>
        ) : (
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
            {subscription.planName
              ? <>Welcome to <span className="font-bold" style={{ color: 'var(--app-text-primary)' }}>{subscription.planName}</span>. Your workspace is ready.</>
              : 'Your subscription is active. Your workspace is ready.'}
          </p>
        )}

        <div className="space-y-3">
          <button
            onClick={() => onNavigate('workspaces')}
            className="btn-primary w-full flex items-center justify-center gap-2.5 px-6 py-4 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            Open your workspace
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Redirecting automatically in {countdown}s…
          </p>
        </div>
      </div>
    </div>
  );
}