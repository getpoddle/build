import { Crown } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionBadgeProps {
  onUpgrade?: () => void;
}

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Individual: { bg: 'rgba(37,99,235,0.1)', text: '#60a5fa', border: 'rgba(37,99,235,0.2)' },
  Team:       { bg: 'rgba(184,134,11,0.12)', text: '#d4a535', border: 'rgba(184,134,11,0.25)' },
  Business:   { bg: 'rgba(168,85,247,0.1)', text: '#c084fc', border: 'rgba(168,85,247,0.2)' },
};

export default function SubscriptionBadge({ onUpgrade }: SubscriptionBadgeProps) {
  const { subscription, loading } = useSubscription();

  if (loading) return null;

  if (!subscription.isActive || !subscription.planName) {
    if (!onUpgrade) return null;
    return (
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(184,134,11,0.1)', color: '#b8860b', border: '1px solid rgba(184,134,11,0.2)' }}
      >
        <Crown className="w-3 h-3" />
        Upgrade
      </button>
    );
  }

  const colors = PLAN_COLORS[subscription.planName] ?? PLAN_COLORS.Individual;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      <Crown className="w-3 h-3" />
      {subscription.planName}
    </span>
  );
}