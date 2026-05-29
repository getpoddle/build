import { X, Sparkles, Brain, TrendingUp, Users, Zap } from 'lucide-react';

interface JoinPromptModalProps {
  onClose: () => void;
  onNavigate: (page: string) => void;
  trigger?: 'comment' | 'react' | 'thread' | 'save' | 'pod' | 'ai' | 'default';
}

const TRIGGER_COPY: Record<string, { headline: string; sub: string }> = {
  comment: {
    headline: 'Join the conversation',
    sub: 'Share your perspective and get AI-powered analysis of your thinking.',
  },
  react: {
    headline: 'React to this insight',
    sub: 'Like, challenge, and engage with the brightest minds on the platform.',
  },
  thread: {
    headline: 'Read the full debate',
    sub: 'See every angle — AI agents and human experts dissecting this topic.',
  },
  save: {
    headline: 'Save this insight',
    sub: 'Build your personal library of the ideas that matter most to you.',
  },
  pod: {
    headline: 'Join this Decision Room',
    sub: 'Collaborate, challenge assumptions, and track outcomes with your team.',
  },
  ai: {
    headline: 'Unlock full AI intelligence',
    sub: 'Get the complete multi-agent debate, forecasts, risks, and action steps.',
  },
  default: {
    headline: 'Join the conversation',
    sub: 'Access full discussions, AI debates, and collective intelligence.',
  },
};

const FEATURES = [
  { icon: Brain, label: 'AI agent debates', desc: 'AI agents challenge every assumption' },
  { icon: TrendingUp, label: 'Calibrated forecasts', desc: 'See probability scores on every claim' },
  { icon: Users, label: 'Decision Rooms', desc: 'Collaborate on high-stakes choices' },
  { icon: Zap, label: 'Action intelligence', desc: 'Concrete next steps for every breakthrough idea' },
];

export default function JoinPromptModal({ onClose, onNavigate, trigger = 'default' }: JoinPromptModalProps) {
  const copy = TRIGGER_COPY[trigger] ?? TRIGGER_COPY.default;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 32px 80px rgba(15,23,42,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="px-6 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(160deg, #f0f7ff 0%, #e8f4ff 50%, #f0fdfa 100%)' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-2">{copy.headline}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{copy.sub}</p>
        </div>

        <div className="px-6 py-5 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-50">
                <Icon className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-bold text-slate-800 leading-tight">{label}</p>
                <p className="text-xs text-slate-500 leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { onClose(); onNavigate('auth'); }}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-200 hover:-translate-y-px active:translate-y-0"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 6px 20px rgba(37,99,235,0.35)' }}
          >
            Create free account
          </button>
          <button
            onClick={() => { onClose(); onNavigate('auth'); }}
            className="w-full mt-2.5 py-3 rounded-2xl text-slate-600 font-semibold text-sm bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Sign in
          </button>

          <p className="text-center text-xs text-slate-400 mt-4">
            Free. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
