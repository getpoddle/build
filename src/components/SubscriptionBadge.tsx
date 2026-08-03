import { Sparkles, Crown, Building2 } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionBadgeProps {
  userId: string | undefined;
  className?: string;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  Individual: Sparkles,
  Team: Crown,
  Business: Building2,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Individual: { bg: 'rgba(37,99,235,0.1)', text: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  Team: { bg: 'rgba(184,134,11,0.12)', text: '#b8860b', border: 'rgba(184,134,11,0.22)' },
  Business: { bg: 'rgba(124,58,237,0.1)', text: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
};

export default function SubscriptionBadge({ userId, className = '' }: SubscriptionBadgeProps) {
  const subscription = useSubscription(userId);

  if (subscription.loading || !subscription.planName) return null;
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return null;

  const Icon = PLAN_ICONS[subscription.planName] ?? Sparkles;
  const colors = PLAN_COLORS[subscription.planName] ?? PLAN_COLORS.Individual;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${className}`}
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      <Icon className="w-3 h-3" />
      {subscription.planName}
    </span>
  );
}