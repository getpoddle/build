import { ArrowRight, CheckCircle, MessageSquare, Sparkles, Zap, ChevronRight } from 'lucide-react';

interface SlackSuccessProps {
  onNavigate: (page: string, id?: string) => void;
}

const NEXT_STEPS = [
  {
    step: '1',
    title: 'Open a Slack channel',
    body: 'Go to any channel in your workspace where your team discusses strategy or decisions.',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    step: '2',
    title: 'Type /poddle',
    body: 'Use the /poddle slash command to see your workspace overview and available actions.',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    step: '3',
    title: 'Start a War Room',
    body: 'Kick off a multi-agent decision sprint. Your AI agents will debate, challenge, and synthesise in real time.',
    icon: <Sparkles className="w-5 h-5" />,
  },
];

export default function SlackSuccess({ onNavigate }: SlackSuccessProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-slate-900 text-sm tracking-tight">Poddle</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <button onClick={() => onNavigate('slack')} className="hover:text-slate-600 transition-colors">Slack</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium">Installation successful</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Success state */}
        <div className="max-w-lg w-full text-center mb-14">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' }}>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
            <CheckCircle className="w-3 h-3" /> Connected to Slack
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Poddle is now live in your Slack workspace
          </h1>
          <p className="text-slate-500 leading-relaxed">
            Your team can now use Poddle's AI-powered decision intelligence directly from Slack. Here's how to get started.
          </p>
        </div>

        {/* Next steps */}
        <div className="max-w-2xl w-full space-y-4 mb-12">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center mb-6">Next steps</h2>
          {NEXT_STEPS.map((step, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-slate-300">Step {step.step}</span>
                  <span className="text-sm font-bold text-slate-900">{step.title}</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tip box */}
        <div className="max-w-lg w-full rounded-2xl border border-blue-100 bg-blue-50 p-5 mb-10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900 mb-1">Pro tip</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Pin Poddle to a dedicated <span className="font-bold">#decisions</span> or <span className="font-bold">#strategy</span> channel so your team always knows where to find the latest War Room insights.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => onNavigate('workspaces')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            Go to my workspace <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Back to home
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>&copy; 2026 Poddle, Inc.</span>
          <div className="flex gap-5">
            <button onClick={() => onNavigate('privacy')} className="hover:text-slate-600 transition-colors">Privacy Policy</button>
            <button onClick={() => onNavigate('terms')} className="hover:text-slate-600 transition-colors">Terms</button>
            <button onClick={() => onNavigate('contact-us')} className="hover:text-slate-600 transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
