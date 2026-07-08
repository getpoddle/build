import { ArrowRight, Bot, Brain, ChevronRight, MessageSquare, Shield, Sparkles, Users, Zap, CheckCircle, BarChart3 } from 'lucide-react';

const SLACK_BUTTON_IMG = 'https://platform.slack-edge.com/img/add_to_slack.png';
const SLACK_BUTTON_IMG_2X = 'https://platform.slack-edge.com/img/add_to_slack@2x.png';

interface SlackLandingProps {
  onNavigate: (page: string) => void;
}

const STEPS = [
  {
    num: '01',
    icon: <Users className="w-6 h-6" />,
    title: 'Sign up & create a workspace',
    body: 'Create a free Poddle account and set up a workspace for your team in under two minutes.',
  },
  {
    num: '02',
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Connect Poddle to Slack',
    body: 'In your workspace settings, click "Connect Slack" and authorise Poddle. No code required.',
  },
  {
    num: '03',
    icon: <Bot className="w-6 h-6" />,
    title: 'Run your first War Room',
    body: 'Type /poddle in any channel to kick off a multi-agent decision sprint and get AI synthesis delivered right in Slack.',
  },
];

const FEATURES = [
  {
    icon: <Brain className="w-5 h-5" />,
    title: 'Multi-agent AI analysis',
    body: 'Our Devil\'s Advocate, Domain Expert, Futurist, and Risk Auditor agents debate your decision from every angle.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Decision Health Score',
    body: 'Every War Room produces a structured score covering alignment, evidence quality, and hidden risks.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Delivered in Slack',
    body: 'Synthesis results are posted directly into your channel the moment they\'re ready — no tab-switching needed.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Enterprise-grade privacy',
    body: 'Your data is never used to train AI models. All analysis runs on isolated, secure infrastructure.',
  },
];

const COMMANDS = [
  { cmd: '/poddle', desc: 'Start a new War Room or show your workspace overview' },
];

export default function SlackLanding({ onNavigate }: SlackLandingProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-slate-900 text-sm tracking-tight">Poddle</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('auth')}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              Get started free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%)' }} className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle,#60a5fa,transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle,#38bdf8,transparent 70%)', transform: 'translate(-30%,30%)' }} />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 relative">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>
              <MessageSquare className="w-3 h-3" /> Available on Slack
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 max-w-3xl">
            Smarter decisions,<br />
            <span style={{ color: '#60a5fa' }}>right inside Slack</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Poddle brings AI-powered decision intelligence to your Slack workspace. Run a War Room with a single slash command and get multi-agent synthesis delivered directly in your channel.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)' }}
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://slack.com/oauth/v2/authorize"
              onClick={e => { e.preventDefault(); onNavigate('auth'); }}
              className="inline-block"
              title="Add Poddle to Slack"
            >
              <img
                alt="Add to Slack"
                height="40"
                width="139"
                src={SLACK_BUTTON_IMG}
                srcSet={`${SLACK_BUTTON_IMG} 1x, ${SLACK_BUTTON_IMG_2X} 2x`}
                className="rounded-lg hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">Free to start · No credit card required</p>
        </div>
      </section>

      {/* Slack preview / demo block */}
      <section className="py-16 md:py-20" style={{ background: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">How it works</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-3">From a slash command to AI synthesis</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Three steps from first login to getting decision intelligence in your Slack channel.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-black text-slate-300 tracking-widest">{step.num}</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    {step.icon}
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-200 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slack UI mock */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">In action</span>
              <h2 className="text-3xl font-black text-slate-900 mt-2 mb-4">
                War Room results delivered<br />in your channel
              </h2>
              <p className="text-slate-500 leading-relaxed mb-6">
                When your team finishes a War Room on Poddle, a structured summary is posted to the Slack channel you configured — including the Decision Health Score, key consensus points, and critical risks flagged by the AI agents.
              </p>
              <ul className="space-y-3">
                {[
                  'Decision Health Score (0–100)',
                  'Consensus points and dissenting views',
                  'Risk signals and blind spots',
                  'Direct link to the full War Room',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Stylised Slack message mock */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#3f0e40' }}>
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs font-bold text-white/60"># strategy-team</span>
              </div>
              <div className="bg-white p-5 space-y-4">
                {/* Bot message */}
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#1e40af,#0ea5e9)' }}>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-sm font-bold text-slate-900">Poddle</span>
                      <span className="text-[10px] text-slate-400">App</span>
                      <span className="text-[10px] text-slate-400">11:42 AM</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">War Room complete</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Score: 84/100</span>
                      </div>
                      <p className="text-xs text-slate-500">Should we expand to the APAC market in Q3?</p>
                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-600">Strong demand signals from Singapore & ANZ</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-600">4 of 5 agents recommend phased entry</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-600">Risk: FX volatility flagged by Risk Auditor</span>
                        </div>
                      </div>
                      <button className="w-full text-center text-xs font-bold text-blue-600 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                        View Full War Room →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Slash commands */}
      <section className="py-16" style={{ background: '#f8fafc' }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Slash commands</span>
          <h2 className="text-3xl font-black text-slate-900 mt-2 mb-4">Everything at your fingertips</h2>
          <p className="text-slate-500 mb-10">Trigger Poddle from anywhere in Slack without leaving your conversation.</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Command</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {COMMANDS.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-4">
                      <code className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{c.cmd}</code>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Capabilities</span>
            <h2 className="text-3xl font-black text-slate-900 mt-2">Built for teams that make hard calls</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0f172a' }} className="py-16 md:py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1e40af,#0ea5e9)' }}>
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to think sharper with your team?</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Create a free Poddle account, connect your Slack workspace, and start making better decisions today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)' }}
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://slack.com/oauth/v2/authorize"
              onClick={e => { e.preventDefault(); onNavigate('auth'); }}
              className="inline-block"
              title="Add Poddle to Slack"
            >
              <img
                alt="Add to Slack"
                height="40"
                width="139"
                src={SLACK_BUTTON_IMG}
                srcSet={`${SLACK_BUTTON_IMG} 1x, ${SLACK_BUTTON_IMG_2X} 2x`}
                className="rounded-lg hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-bold text-slate-600">Poddle</span>
            <span className="text-slate-300">·</span>
            <span>&copy; 2026 Poddle, Inc.</span>
          </div>
          <div className="flex gap-5">
            <button onClick={() => onNavigate('home')} className="hover:text-slate-600 transition-colors">Home</button>
            <button onClick={() => onNavigate('pricing')} className="hover:text-slate-600 transition-colors">Pricing</button>
            <button onClick={() => onNavigate('privacy')} className="hover:text-slate-600 transition-colors">Privacy Policy</button>
            <button onClick={() => onNavigate('terms')} className="hover:text-slate-600 transition-colors">Terms</button>
            <button onClick={() => onNavigate('subprocessors')} className="hover:text-slate-600 transition-colors">Sub-processors</button>
            <button onClick={() => onNavigate('contact-us')} className="hover:text-slate-600 transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
