import { useEffect } from 'react';
import { Search, TrendingUp, Sparkles, LineChart, Users, ArrowRight } from 'lucide-react';
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
    icon: Sparkles,
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
          <span className="font-semibold"><span style={{ color: '#0B4AA2', fontWeight: 700 }}>Poddle</span><span style={{ color: '#C7A95F', fontWeight: 400, marginLeft: '0.15em' }}>AI</span></span>
        </button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: '#0e1117' }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(184,134,11,0.1) 0%,transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6"
            style={{ background: 'rgba(184,134,11,0.1)', border: '1px solid rgba(184,134,11,0.35)' }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#d4a535' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#d4a535' }}>Poddle Advisory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3" style={{ color: '#f4f4f5' }}>
            Decision Intelligence &amp; Strategic Advisory
          </h1>
          <p className="text-base sm:text-lg mb-6" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Better decisions. Stronger strategies. Greater confidence.
          </p>
          <p className="text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Poddle Advisory helps leaders, executives, and organizations make better decisions when the stakes are high, the information is incomplete, and the path forward is unclear. We combine strategic advisory, decision science, and AI-powered decision intelligence to help organizations evaluate opportunities, challenge assumptions, identify risks, and stress-test important decisions before they are made.
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8860b' }}>What we do</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10">Five ways we help you decide with confidence</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {SERVICES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl" style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(184,134,11,0.1)' }}>
                <Icon className="w-5 h-5" style={{ color: '#b8860b' }} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our approach */}
      <section style={{ background: '#fafafa', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8860b' }}>Our approach</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Traditional consulting often delivers recommendations.<br />Poddle Advisory goes deeper.
          </h2>
          <p className="text-base text-slate-600 leading-relaxed mb-4">
            We focus on the quality of the decision itself. Every engagement combines human strategic judgment with the intelligence capabilities of Poddle, enabling us to examine decisions from multiple perspectives, surface conflicting assumptions, model risks, identify patterns, and challenge conventional thinking.
          </p>
          <p className="text-base font-semibold text-slate-900">
            The result is not simply an answer. It is a better-understood decision, stronger reasoning, and greater confidence in the path forward.
          </p>
        </div>
      </section>

      {/* Built for decisions that matter */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Built for decisions that matter</h2>
        <p className="text-base text-slate-600 leading-relaxed mb-8">
          Whether you are considering entering a new market, launching a product, investing in an opportunity, restructuring an organization, or navigating a major strategic shift, Poddle Advisory helps you see the decision from every important angle.
        </p>
        <p className="text-lg font-bold mb-8" style={{ color: '#b8860b' }}>
          Think deeper. Challenge assumptions. Decide with confidence.
        </p>
        <button
          onClick={() => onNavigate('contact-us')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-none text-white text-sm font-bold transition-all hover:-translate-y-px"
          style={{ background: '#0f172a' }}
        >
          Talk to Poddle Advisory
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-slate-400 mt-8">Poddle Advisory — the strategic advisory arm of Poddle, Inc.</p>
      </section>

      {/* Footer */}
      <footer style={{ background: '#000000', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PoddleMark size={28} />
              <span className="font-black text-lg tracking-tight">
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>Poddle</span><span style={{ color: '#d4a535', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <button onClick={() => onNavigate('home')} className="hover:text-white transition-colors">Home</button>
              <button onClick={() => onNavigate('team')} className="hover:text-white transition-colors">Team</button>
              <button onClick={() => onNavigate('blog')} className="hover:text-white transition-colors">Blog</button>
              <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms</a>
              <a href="#contact-us" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 text-center text-xs" style={{ color: 'rgba(100,116,139,0.7)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            &copy; 2026 Poddle, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
