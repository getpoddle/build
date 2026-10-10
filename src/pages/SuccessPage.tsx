import { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../contexts/AuthContext';

interface SuccessPageProps {
  onNavigate: (page: string) => void;
}

export default function SuccessPage({ onNavigate }: SuccessPageProps) {
  const { user } = useAuth();
  const subscription = useSubscription(user?.id);
  const [dots, setDots] = useState('');

  // Animate dots while waiting for subscription to load
  useEffect(() => {
    if (subscription.loading) {
      const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
      return () => clearInterval(t);
    }
  }, [subscription.loading]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--app-bg)' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
            transform: 'translate(-50%,-50%)',
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
          style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <CheckCircle className="w-10 h-10" style={{ color: '#16a34a' }} />
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--app-text-primary)' }}>
          Payment successful!
        </h1>

        {/* Subscription info */}
        {subscription.loading ? (
          <p className="text-base mb-8" style={{ color: 'var(--app-text-muted)' }}>
            Activating your plan{dots}
          </p>
        ) : subscription.planName ? (
          <div className="mb-8">
            <p className="text-base mb-3" style={{ color: 'var(--app-text-secondary)' }}>
              Your <span className="font-bold" style={{ color: 'var(--app-text-primary)' }}>{subscription.planName}</span> plan is now active.
            </p>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'var(--signal-bg)', color: 'var(--signal)', border: '1px solid var(--signal)' }}
            >
              <Sparkles className="w-4 h-4" />
              {subscription.planName} plan active
            </div>
          </div>
        ) : (
          <p className="text-base mb-8" style={{ color: 'var(--app-text-muted)' }}>
            Your subscription has been activated.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={() => onNavigate('home')}
          className="btn-primary inline-flex items-center gap-2.5 px-8 py-4 transition-all hover:-translate-y-0.5"
        >
          Go to dashboard
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs mt-4" style={{ color: 'var(--app-text-muted)' }}>
          A confirmation email has been sent to your inbox.
        </p>
      </div>
    </div>
  );
}