import { useEffect, useRef, useState } from 'react';
import { Swords, ArrowRight, Shield, Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface WarRoomCTAProps {
  onNavigate: (page: string) => void;
  topic?: string;
}

export default function WarRoomCTA({ onNavigate, topic }: WarRoomCTAProps) {
  const { user } = useAuth();

  const handleLaunch = () => {
    if (user) {
      onNavigate('workspaces');
    } else {
      sessionStorage.setItem('postLoginRedirect', window.location.href);
      onNavigate('auth');
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{ background: 'linear-gradient(135deg, #0f1e36 0%, #1e3a5f 50%, #1d4ed8 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 60%), radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 50%)' }}
      />
      <div className="absolute top-0 right-0 w-64 h-64 opacity-5" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Swords className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Private War Room</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3">
            How would this impact{' '}
            <span className="text-blue-300">your business?</span>
          </h2>

          <p className="text-base text-blue-100/80 leading-relaxed mb-8 max-w-xl">
            Launch a private War Room to pressure-test your team's alignment on{' '}
            {topic ? (
              <span className="font-semibold text-white">
                {topic.length > 60 ? topic.slice(0, 60) + '…' : topic}
              </span>
            ) : (
              'this exact topic'
            )}
            . AI agents brief your team, surface blind spots, and drive decisions fast.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            {([
              { icon: Shield, label: 'End-to-end encrypted' },
              { icon: Users, label: 'Invite your whole team' },
              { icon: Zap, label: 'AI agents on tap' },
            ] as const).map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5"
              >
                <Icon className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-xs font-medium text-blue-100">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={handleLaunch}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-sm text-slate-900 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #f0f9ff, #bfdbfe)' }}
            >
              <Swords className="w-4 h-4" />
              Launch Your War Room
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <span className="text-xs text-blue-300/70 font-medium">Free 7-day trial — no credit card needed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StickyWarRoomCTA({ onNavigate, topic }: WarRoomCTAProps) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (dismissed) return;
    const handleScroll = () => {
      if (shownRef.current) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && window.scrollY / total >= 0.6) {
        shownRef.current = true;
        setVisible(true);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [dismissed]);

  const handleLaunch = () => {
    if (user) {
      onNavigate('workspaces');
    } else {
      sessionStorage.setItem('postLoginRedirect', window.location.href);
      onNavigate('auth');
    }
  };

  if (!visible || dismissed) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
      style={{ animation: 'ctaSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <style>{`@keyframes ctaSlideUp{from{opacity:0;transform:translate(-50%,2rem)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div
        className="relative rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1e36, #1d4ed8)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors z-10 text-sm font-bold"
        >
          ×
        </button>
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-400/20 flex items-center justify-center flex-shrink-0">
            <Swords className="w-5 h-5 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-snug">
              {topic ? 'How does this affect your business?' : "Test your team's alignment on this."}
            </p>
            <p className="text-xs text-blue-200/70 mt-0.5">Launch a private War Room — free for 7 days</p>
          </div>
          <button
            onClick={handleLaunch}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #e0f2fe, #bfdbfe)' }}
          >
            Launch
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
