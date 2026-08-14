import { useEffect } from 'react';
import { updatePageSEO } from '../lib/seo';
import { TeamSection } from './GuestHome';
import PoddleMark from '../components/PoddleMark';

interface TeamPageProps {
  onNavigate: (page: string) => void;
}

export default function Team({ onNavigate }: TeamPageProps) {
  useEffect(() => {
    updatePageSEO({
      title: 'Team — Poddle AI',
      description: 'The minds behind Poddle AI, shaping decision intelligence for teams.',
      path: '/team',
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
      <TeamSection />
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
              <button onClick={() => onNavigate('blog')} className="hover:text-white transition-colors">Blog</button>
              <button onClick={() => onNavigate('slack')} className="hover:text-white transition-colors">Slack</button>
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
