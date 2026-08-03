import { Lock, Sparkles, ArrowRight, X, Shield, Users, Brain } from 'lucide-react';

interface UpgradePromptProps {
  onClose?: () => void;
  onUpgrade: () => void;
  context?: 'workspace' | 'seats' | 'generic' | 'trial_exhausted';
  workspaceName?: string;
}

export default function UpgradePrompt({ onClose, onUpgrade, context = 'generic', workspaceName }: UpgradePromptProps) {
  const copy = {
    workspace: {
      headline: 'Private Workspaces are a Pro feature',
      sub: 'Create encrypted spaces where your team debates proprietary ideas with AI agents — completely private and invite-only.',
    },
    seats: {
      headline: `You've reached your seat limit`,
      sub: workspaceName
        ? `Upgrade ${workspaceName} to add more team members.`
        : 'Upgrade your plan to add more team members to this workspace.',
    },
    generic: {
      headline: 'Upgrade to Pro',
      sub: 'Unlock unlimited War Room sessions, private workspaces, and AI agent intelligence — starting at $39/mo.',
    },
    trial_exhausted: {
      headline: "You've used your free trial workspace",
      sub: 'Upgrade to Pro to create unlimited workspaces and keep all your data — your trial content is safe and will carry over.',
    },
  };

  const { headline, sub } = copy[context];
  const perks = [
    { icon: Lock, label: 'Encrypted private workspace' },
    { icon: Users, label: 'Invite-only team access' },
    { icon: Brain, label: 'AI agents debate your ideas' },
    { icon: Shield, label: 'Your IP stays private' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-md w-full overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 32px 80px rgba(15,23,42,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(160deg,#1e3a5f 0%,#0f2040 100%)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">{headline}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{sub}</p>
        </div>

        <div className="px-8 py-6">
          <div className="space-y-3 mb-6">
            {perks.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.08)' }}>
                  <Icon className="w-4 h-4" style={{ color: '#2563eb' }} />
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onUpgrade}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
            <ArrowRight className="w-4 h-4" />
          </button>

          {onClose && (
            <button onClick={onClose} className="w-full mt-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
