import { useEffect } from 'react';
import { ShieldCheck, Users, Swords, Building2, ArrowRight } from 'lucide-react';
import { updatePageSEO } from '../lib/seo';
import PoddleMark from '../components/PoddleMark';

interface AboutProps {
  onNavigate: (page: string) => void;
}

const SERVICES = [
  {
    title: 'AI War Room',
    desc: 'Seven specialized AI agents (Risk Analyst, Devil\'s Advocate, Financial Strategist, Market Analyst, Execution Lead, Innovation Lead, People Advisor) debate a decision from opposing angles before it commits. The outcome is a synthesized recommendation, a Decision Health Score, and a list of the risks nobody in the room raised.',
  },
  {
    title: 'Organization Decision Control',
    desc: 'Link every team\'s workspace under one organization, require sign-off before a decision locks in, and route approval to the specific person accountable for that category — not a generic admin list. Built for companies where more than one person needs to be on record before a call is made.',
  },
  {
    title: 'Decision Trail & Evidence IDs',
    desc: 'Every decision keeps a permanent, chronological record — what was asked, what AI recommended, what a human overrode, and what happened after. Every claim gets a citable Evidence ID with a freshness status, so a decision built on a 6-month-old assumption gets flagged before it quietly goes wrong.',
  },
  {
    title: 'Poddle Advisory',
    desc: 'For teams that want the same adversarial rigor delivered as a service rather than software, Poddle Advisory maps a client\'s real decision workflows and pressure-tests them directly, delivering a redesign artifact rather than a subscription.',
  },
];

const DIFFERENTIATORS = [
  {
    title: 'Adversarial by design, not agreeable by default',
    desc: 'Most AI tools are built to be helpful and agreeable. Poddle\'s agents are built to argue — Devil\'s Advocate exists specifically to find the flaw in the room\'s thinking, not to validate it.',
  },
  {
    title: 'Governance with real teeth',
    desc: 'A "Decision Owner" isn\'t just a label. When it\'s turned on, a decision literally cannot move to Committed without that specific person\'s sign-off, enforced at the database level, not just hidden behind a UI button.',
  },
  {
    title: 'An audit trail built for someone who wasn\'t in the room',
    desc: 'The Decision Trail is designed so a person with zero context can open the export and answer what was decided, why, on what evidence, and what happened after — without ever messaging the original decision-maker.',
  },
  {
    title: 'Evidence has an expiration date',
    desc: 'Every AI-extracted claim carries a freshness status. A forecast that was true in January and never re-verified gets flagged as stale before it silently keeps steering new decisions.',
  },
  {
    title: 'Month-to-month for teams, annual for scale',
    desc: 'Team plans are flexible month-to-month. Business and Enterprise move to annual terms once governance and multi-department rollout are the point — you\'re not locked into a long contract just to try it.',
  },
];

const ICP = [
  'B2B SaaS founders and Chiefs of Staff making high-stakes, hard-to-reverse calls',
  'Multi-department companies (11–100+ seats) that need a documented sign-off process, not just a chat log',
  'Teams that have been burned by a decision that later turned out to rest on outdated data',
  'Organizations that need to show, not just claim, that a decision was properly reviewed',
];

const FAQS = [
  {
    q: 'Is Poddle a replacement for human judgment?',
    a: 'No. Poddle is built to pressure-test human judgment, not replace it. Every AI recommendation is designed to be challenged, overridden, and ultimately decided on by a person — the platform just makes sure that override is deliberate and recorded, not accidental.',
  },
  {
    q: 'Do I need to be a large company to use Poddle?',
    a: 'No. Anyone can start on the Free plan with a single private workspace. Organization Decision Control and multi-department governance become relevant once you have more than one team making decisions that affect each other.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your workspace data is retained for 30 days after cancellation, and you can export your Decision Trail and evidence before downgrading. Nothing is deleted without notice.',
  },
  {
    q: 'How is this different from just asking ChatGPT?',
    a: 'A general chat assistant tells you what you want to hear unless you specifically prompt it not to. Poddle\'s agents are built with permanent, adversarial mandates — one agent\'s entire job is to find out why the room might be wrong — and every exchange is kept as a structured, citable record instead of a disappearing chat.',
  },
];

export default function About({ onNavigate }: AboutProps) {
  useEffect(() => {
    updatePageSEO({
      title: 'About Poddle AI — The Governance Layer for Company Decisions',
      description: 'Poddle AI is a decision governance platform that helps teams pressure-test, approve, and permanently record high-stakes business decisions.',
      path: '/about',
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          <PoddleMark size={22} />
          <span className="font-semibold"><span style={{ color: '#0B4AA2', fontWeight: 700 }}>Poddle</span><span style={{ color: '#C7A95F', fontWeight: 400, marginLeft: '0.15em' }}>AI</span></span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

        {/* Value prop */}
        <section className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#b8860b' }}>About Poddle AI</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            Poddle AI is a decision governance platform that pressure-tests, approves, and permanently records high-stakes business decisions for growing companies.
          </h1>
        </section>

        {/* What Poddle does */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-6">What Poddle AI does</h2>
          <div className="space-y-6">
            {SERVICES.map(s => (
              <div key={s.title}>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Differentiators */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-6">What makes Poddle AI different</h2>
          <div className="space-y-6">
            {DIFFERENTIATORS.map(d => (
              <div key={d.title}>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{d.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who uses Poddle */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Who uses Poddle AI</h2>
          <ul className="space-y-2.5">
            {ICP.map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 mt-1" style={{ color: '#b8860b' }} />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Team */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-4">The team behind Poddle AI</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Poddle AI is founder-led by <strong className="text-slate-900">Oludotun Akinbobola</strong>, a digital transformation professional with prior experience across aviation software, insurance, and automotive-adjacent agency work. He previously co-founded Teamplana, a SaaS project management platform.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Poddle AI grew out of a simple observation: most tools help you communicate a decision after it's made, but almost none help pressure-test it before it becomes expensive to reverse.
          </p>
        </section>

        {/* How Poddle works */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-4">How Poddle AI works</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Support is currently direct and founder-led — questions raised through the app or by email are handled personally, not routed through a support queue. Most new workspaces are usable within minutes: create a workspace, bring your team and evidence into the War Room, and let the agent panel debate before you commit.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            For Business and Enterprise customers using Organization Decision Control, onboarding includes setting up your organization, linking existing workspaces, and configuring who has approval authority per decision category.
          </p>
        </section>

        {/* Key facts */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Key facts</h2>
          <dl className="border-t border-slate-200">
            {[
              ['Company Name', 'Poddle, Inc.'],
              ['Type', 'Delaware C-Corporation, pre-seed'],
              ['Founder', 'Oludotun Akinbobola'],
              ['Headquarters', 'Delaware, USA (remote-first team)'],
              ['Website', 'poddleme.com'],
              ['Core Offering', 'AI-powered decision review, governance, and audit-trail platform'],
              ['Pricing', 'Free · Team $249/mo · Business $999/mo · Enterprise from $2,500/mo'],
              ['Contract Terms', 'Month-to-month (Team) · Annual (Business & Enterprise)'],
              ['Services', 'Poddle software platform, and Poddle Advisory (consulting)'],
              ['Communication', 'Direct, founder-led support'],
              ['Customers Served', 'Early access — onboarding founding customers now'],
              ['Social', '@poddleai on LinkedIn, X (Twitter), and Instagram'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-3 gap-4 py-3 border-b border-slate-200">
                <dt className="text-sm font-semibold text-slate-900 col-span-1">{label}</dt>
                <dd className="text-sm text-slate-600 col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Frequently asked questions</h2>
          <div className="space-y-6">
            {FAQS.map(f => (
              <div key={f.q}>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{f.q}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer style={{ background: '#000000' }} className="py-12">
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
              <button onClick={() => onNavigate('advisory')} className="hover:text-white transition-colors">Advisory</button>
              <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms</a>
              <a href="#contact-us" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
