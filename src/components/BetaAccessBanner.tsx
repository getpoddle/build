import { Sparkles, X, ArrowRight } from 'lucide-react';

interface BetaAccessBannerProps {
  daysRemaining: number;
  onUpgrade: () => void;
  onDismiss?: () => void;
}

export default function BetaAccessBanner({ daysRemaining, onUpgrade, onDismiss }: BetaAccessBannerProps) {
  const isUrgent = daysRemaining <= 7;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: isUrgent ? 'rgba(245,158,11,0.08)' : 'rgba(37,99,235,0.06)',
        border: `1px solid ${isUrgent ? 'rgba(245,158,11,0.25)' : 'rgba(37,99,235,0.15)'}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: isUrgent ? 'rgba(245,158,11,0.15)' : 'rgba(37,99,235,0.1)' }}
      >
        <Sparkles className="w-4 h-4" style={{ color: isUrgent ? '#d97706' : '#2563eb' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: isUrgent ? '#92400e' : '#1e3a5f' }}>
          {daysRemaining === 1
            ? 'Beta access expires tomorrow'
            : `${daysRemaining} days left in your beta access`}
        </p>
        <p className="text-xs mt-0.5" style={{ color: isUrgent ? '#b45309' : '#3b82f6' }}>
          Upgrade to keep access to War Room, Pattern Intelligence, and more.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onUpgrade}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:-translate-y-px"
          style={{
            background: isUrgent
              ? 'linear-gradient(135deg,#b45309,#d97706)'
              : 'linear-gradient(135deg,#1e3a5f,#2563eb)',
            boxShadow: isUrgent
              ? '0 3px 10px rgba(180,83,9,0.25)'
              : '0 3px 10px rgba(37,99,235,0.25)',
          }}
        >
          Upgrade
          <ArrowRight className="w-3 h-3" />
        </button>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
