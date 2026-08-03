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
      style={{ background: 'linear-gradient(135deg,#000 0%,#0a0a0a 60%,#111 100%)' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(184,134,11,0.15) 0%, transparent 70%)',
            transform: 'translate(-50%,-50%)',
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
          style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <CheckCircle className="w-10 h-10" style={{ color: '#16a34a' }} />
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
          Payment successful!
        </h1>

        {/* Subscription info */}
        {subscription.loading ? (
          <p className="text-base mb-8" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Activating your plan{dots}
          </p>
        ) : subscription.planName ? (
          <div className="mb-8">
            <p className="text-base mb-3" style={{ color: 'rgba(203,213,225,0.8)' }}>
              Your <span className="font-bold text-white">{subscription.planName}</span> plan is now active.
            </p>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(184,134,11,0.15)', color: '#d4a535', border: '1px solid rgba(184,134,11,0.25)' }}
            >
              <Sparkles className="w-4 h-4" />
              {subscription.planName} plan active
            </div>
          </div>
        ) : (
          <p className="text-base mb-8" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Your subscription has been activated.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-sm transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,#b8860b,#d4a535)', color: '#000', boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }}
        >
          Go to dashboard
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs mt-4" style={{ color: 'rgba(100,116,139,0.6)' }}>
          A confirmation email has been sent to your inbox.
        </p>
      </div>
    </div>
  );
}