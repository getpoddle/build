import { useEffect } from 'react';
import { Search, TrendingUp, Cpu, LineChart, Users, ArrowRight } from 'lucide-react';
import { updatePageSEO } from '../lib/seo';
import PoddleMark from '../components/PoddleMark';

interface AdvisoryProps {
  onNavigate: (page: string) => void;
}

const SERVICES = [
  {
    icon: Search,
    title: 'Strategic Decision Review',
    desc: 'We independently examine critical business decisions, challenge the underlying assumptions, and identify potential blind spots before resources are committed.',
  },
  {
    icon: TrendingUp,
    title: 'Strategy & Growth Advisory',
    desc: 'We help organizations develop, evaluate, and stress-test strategies across growth, market expansion, product, operations, and organizational transformation.',
  },
  {
    icon: Cpu,
    title: 'AI & Digital Transformation',
    desc: 'We advise organizations on how to identify, prioritize, and implement AI and digital opportunities that create measurable business value.',
  },
  {
    icon: LineChart,
    title: 'Market & Competitive Intelligence',
    desc: 'We turn complex market information, competitive signals, and emerging trends into actionable strategic insight.',
  },
  {
    icon: Users,
    title: 'Executive Decision Support',
    desc: 'We provide leadership teams with structured analysis and an independent perspective on high-impact decisions, from investments and partnerships to new products and market entry.',
  },
];

export default function Advisory({ onNavigate }: AdvisoryProps) {
  useEffect(() => {
    updatePageSEO({
      title: 'Poddle Advisory — Decision Intelligence & Strategic Advisory',
      description: 'Poddle Advisory helps leaders, executives, and organizations make better decisions when the stakes are high, the information is incomplete, and the path forward is unclear.',
      path: '/advisory',
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          <PoddleMark size={22} />
          <span className="font-semibold"><span style={{ color: 'var(--signal)', fontWeight: 700 }}>Poddle</span><span style={{ color: 'var(--app-text-muted)', fontWeight: 400, marginLeft: '0.15em' }}>AI</span></span>
        </button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border)' }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.06) 0%,transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6"
            style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--signal)' }}>Poddle Advisory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3" style={{ color: 'var(--app-text-primary)' }}>
            Decision Intelligence &amp; Strategic Advisory
          </h1>
          <p className="text-base sm:text-lg mb-6" style={{ color: 'var(--app-text-secondary)' }}>
            Better decisions. Stronger strategies. Greater confidence.
          </p>
          <p className="text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: 'var(--app-text-muted)' }}>
            Poddle Advisory helps leaders, executives, and organizations make better decisions when the stakes are high, the information is incomplete, and the path forward is unclear. We combine strategic advisory, decision science, and AI-powered decision intelligence to help organizations evaluate opportunities, challenge assumptions, identify risks, and stress-test important decisions before they are made.
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--signal)' }}>What we do</p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10" style={{ color: 'var(--app-text-primary)' }}>Five ways we help you decide with confidence</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {SERVICES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--signal-bg)' }}>
                <Icon className="w-5 h-5" style={{ color: 'var(--signal)' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--app-text-primary)' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our approach */}
      <section style={{ background: 'var(--app-surface-raised)', borderTop: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--signal)' }}>Our approach</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6" style={{ color: 'var(--app-text-primary)' }}>
            Traditional consulting often delivers recommendations.<br />Poddle Advisory goes deeper.
          </h2>
          <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--app-text-secondary)' }}>
            We focus on the quality of the decision itself. Every engagement combines human strategic judgment with the intelligence capabilities of Poddle, enabling us to examine decisions from multiple perspectives, surface conflicting assumptions, model risks, identify patterns, and challenge conventional thinking.
          </p>
          <p className="text-base font-semibold" style={{ color: 'var(--app-text-primary)' }}>
            The result is not simply an answer. It is a better-understood decision, stronger reasoning, and greater confidence in the path forward.
          </p>
        </div>
      </section>

      {/* Built for decisions that matter */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4" style={{ color: 'var(--app-text-primary)' }}>Built for decisions that matter</h2>
        <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--app-text-secondary)' }}>
          Whether you are considering entering a new market, launching a product, investing in an opportunity, restructuring an organization, or navigating a major strategic shift, Poddle Advisory helps you see the decision from every important angle.
        </p>
        <p className="text-lg font-bold mb-8" style={{ color: 'var(--signal)' }}>
          Think deeper. Challenge assumptions. Decide with confidence.
        </p>
        <button
          onClick={() => onNavigate('contact-us')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white text-sm font-bold transition-all hover:-translate-y-px"
          style={{ background: 'var(--signal)' }}
        >
          Talk to Poddle Advisory
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs mt-8" style={{ color: 'var(--app-text-muted)' }}>Poddle Advisory — the strategic advisory arm of Poddle, Inc.</p>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--app-surface-raised)', borderTop: '1px solid var(--app-border)' }} className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PoddleMark size={28} />
              <span className="font-black text-lg tracking-tight">
                <span style={{ color: 'var(--signal)', fontWeight: 700 }}>Poddle</span><span style={{ color: 'var(--app-text-muted)', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: 'var(--app-text-secondary)' }}>
              <button onClick={() => onNavigate('home')} className="hover:opacity-70 transition-opacity">Home</button>
              <button onClick={() => onNavigate('team')} className="hover:opacity-70 transition-opacity">Team</button>
              <button onClick={() => onNavigate('blog')} className="hover:opacity-70 transition-opacity">Blog</button>
              <a href="#privacy" className="hover:opacity-70 transition-opacity">Privacy</a>
              <a href="#terms" className="hover:opacity-70 transition-opacity">Terms</a>
              <a href="#contact-us" className="hover:opacity-70 transition-opacity">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 text-center text-xs" style={{ color: 'var(--app-text-muted)', borderTop: '1px solid var(--app-border)' }}>
            &copy; 2026 Poddle, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
