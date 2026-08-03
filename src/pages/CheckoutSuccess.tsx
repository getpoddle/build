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
      style={{ background: 'linear-gradient(135deg,#000 0%,#0a0a0a 55%,#111 100%)' }}
    >
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <PoddleMark size={32} />
          <span className="text-white font-black text-xl tracking-tight">Poddle AI</span>
        </div>

        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ background: 'rgba(22,163,74,0.15)', border: '2px solid rgba(22,163,74,0.35)' }}
        >
          <CheckCircle className="w-10 h-10" style={{ color: '#34d399' }} />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          You're all set!
        </h1>

        {loading ? (
          <div className="flex items-center justify-center gap-2 mb-8" style={{ color: 'rgba(148,163,184,0.6)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Activating your plan…</span>
          </div>
        ) : (
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'rgba(203,213,225,0.7)' }}>
            {subscription.planName
              ? <>Welcome to <span className="text-white font-bold">{subscription.planName}</span>. Your workspace is ready.</>
              : 'Your subscription is active. Your workspace is ready.'}
          </p>
        )}

        <div className="space-y-3">
          <button
            onClick={() => onNavigate('workspaces')}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#b8860b,#d4a535)', color: '#000', boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }}
          >
            <Sparkles className="w-4 h-4" />
            Open your workspace
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs" style={{ color: 'rgba(100,116,139,0.5)' }}>
            Redirecting automatically in {countdown}s…
          </p>
        </div>
      </div>
    </div>
  );
}