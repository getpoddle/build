import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, MessageSquare, AlertTriangle, Layers, ArrowLeft, LogIn, ThumbsUp, Link as LinkIcon, Eye, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ShareButton from '../components/ShareButton';
import ShareableInsightCard from '../components/ShareableInsightCard';
import { setShareablePageMeta } from '../lib/seo';

interface PublicAssumptionProps {
  assumptionId: string;
  onNavigate: (page: string) => void;
}

interface Assumption {
  id: string;
  content: string;
  description: string;
  category: string;
  challenge_count: number;
  created_at: string;
  created_by: string;
  pod_id: string;
  view_count: number;
  share_count: number;
  profiles: { full_name: string; avatar_url: string | null } | null;
  pods: { name: string; description: string } | null;
}

interface AssumptionForecast {
  id: string;
  probability: number;
  justification: string;
  user_id: string;
  reference_url?: string | null;
}

interface AssumptionChallenge {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface AssumptionRisk {
  id: string;
  description: string;
  severity: number;
  created_by: string;
  created_at: string;
  profiles: { full_name: string } | null;
  reference_url?: string | null;
}

interface AssumptionScenario {
  id: string;
  description: string;
  created_by: string;
  created_at: string;
  profiles: { full_name: string } | null;
  reference_url?: string | null;
}

export default function PublicAssumption({ assumptionId, onNavigate }: PublicAssumptionProps) {
  const { user } = useAuth();
  const [assumption, setAssumption] = useState<Assumption | null>(null);
  const [forecasts, setForecasts] = useState<AssumptionForecast[]>([]);
  const [challenges, setChallenges] = useState<AssumptionChallenge[]>([]);
  const [risks, setRisks] = useState<AssumptionRisk[]>([]);
  const [scenarios, setScenarios] = useState<AssumptionScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [newForecast, setNewForecast] = useState({ probability: 50, justification: '', reference_url: '' });
  const [newChallenge, setNewChallenge] = useState('');
  const [newRisk, setNewRisk] = useState({ description: '', severity: 3, reference_url: '' });
  const [newScenario, setNewScenario] = useState({ description: '', reference_url: '' });
  const [showShareCard, setShowShareCard] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}#assumption/${assumptionId}`;

  useEffect(() => {
    loadAssumption();
  }, [assumptionId, user]);

  useEffect(() => {
    if (!assumptionId) return;
    let sessionId = sessionStorage.getItem('poddle_session');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('poddle_session', sessionId);
    }
    supabase.rpc('increment_assumption_view', { p_assumption_id: assumptionId, p_session_id: sessionId });
  }, [assumptionId]);

  const loadAssumption = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: assumptionData, error: assumptionError } = await supabase
        .from('pod_assumptions')
        .select('*, profiles(full_name, avatar_url), pods(name, description)')
        .eq('id', assumptionId)
        .maybeSingle();

      if (assumptionError) throw assumptionError;
      if (!assumptionData) {
        setError('Assumption not found');
        return;
      }

      setAssumption(assumptionData);

      setShareablePageMeta({
        title: assumptionData.content,
        description: assumptionData.description
          ? `${assumptionData.description} — ${assumptionData.challenge_count} people are debating this on Poddle.`
          : `${assumptionData.challenge_count} people are debating this insight on Poddle. Join the conversation.`,
        url: `${window.location.origin}${window.location.pathname}#assumption/${assumptionData.id}`,
        type: 'article',
      });

      if (user) {
        const { data: memberData } = await supabase
          .from('pod_members')
          .select('id')
          .eq('pod_id', assumptionData.pod_id)
          .eq('user_id', user.id)
          .maybeSingle();

        setIsMember(!!memberData);
      }

      const [forecastsRes, challengesRes, risksRes, scenariosRes] = await Promise.all([
        supabase.from('assumption_forecasts').select('*').eq('assumption_id', assumptionId),
        supabase.from('assumption_challenges').select('*, profiles(full_name)').eq('assumption_id', assumptionId).order('created_at', { ascending: false }),
        supabase.from('assumption_risks').select('*, profiles(full_name)').eq('assumption_id', assumptionId).order('created_at', { ascending: false }),
        supabase.from('assumption_scenarios').select('*, profiles(full_name)').eq('assumption_id', assumptionId).order('created_at', { ascending: false }),
      ]);

      setForecasts(forecastsRes.data || []);
      setChallenges(challengesRes.data || []);
      setRisks(risksRes.data || []);
      setScenarios(scenariosRes.data || []);
    } catch (err) {
      console.error('Error loading assumption:', err);
      setError('Failed to load assumption');
    } finally {
      setLoading(false);
    }
  };

  const addForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assumptionId) return;
    try {
      const { error } = await supabase.from('assumption_forecasts').insert({
        assumption_id: assumptionId,
        user_id: user.id,
        probability: newForecast.probability,
        justification: newForecast.justification,
        reference_url: newForecast.reference_url || null,
      });
      if (error) throw error;
      setNewForecast({ probability: 50, justification: '', reference_url: '' });
      loadAssumption();
    } catch (error) {
      console.error('Error adding forecast:', error);
    }
  };

  const addChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assumptionId || !newChallenge.trim()) return;
    try {
      const { error } = await supabase.from('assumption_challenges').insert({
        assumption_id: assumptionId,
        user_id: user.id,
        content: newChallenge,
      });
      if (error) throw error;
      setNewChallenge('');
      loadAssumption();
    } catch (error) {
      console.error('Error adding challenge:', error);
    }
  };

  const addRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assumptionId || !newRisk.description.trim()) return;
    try {
      const { error } = await supabase.from('assumption_risks').insert({
        assumption_id: assumptionId,
        created_by: user.id,
        description: newRisk.description,
        severity: newRisk.severity,
        reference_url: newRisk.reference_url || null,
      });
      if (error) throw error;
      setNewRisk({ description: '', severity: 3, reference_url: '' });
      loadAssumption();
    } catch (error) {
      console.error('Error adding risk:', error);
    }
  };

  const addScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assumptionId || !newScenario.description.trim()) return;
    try {
      const { error } = await supabase.from('assumption_scenarios').insert({
        assumption_id: assumptionId,
        created_by: user.id,
        description: newScenario.description,
        reference_url: newScenario.reference_url || null,
      });
      if (error) throw error;
      setNewScenario({ description: '', reference_url: '' });
      loadAssumption();
    } catch (error) {
      console.error('Error adding scenario:', error);
    }
  };

  const avgProbability = forecasts.length > 0
    ? Math.round(forecasts.reduce((sum, f) => sum + f.probability, 0) / forecasts.length)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
          >
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-slate-500 font-semibold">Loading insight...</p>
        </div>
      </div>
    );
  }

  if (error || !assumption) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <div className="text-center max-w-md">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239,68,68,0.1)' }}
          >
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Insight Not Found</h1>
          <p className="text-slate-600 mb-6">{error || 'The insight you are looking for does not exist or has been removed.'}</p>
          {user ? (
            <button
              onClick={() => onNavigate('home')}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
            >
              Go to Home
            </button>
          ) : (
            <button
              onClick={() => onNavigate('auth')}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
            >
              Sign In to Poddle
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 12px 40px rgba(15,23,42,0.1)' }}
          >
            <div
              className="px-6 py-8"
              style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)', boxShadow: '0 4px 20px rgba(15,23,42,0.3)' }}
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 70%)' }}
              />
              <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span
                      className="inline-block px-3 py-1 rounded-lg text-xs font-semibold mb-2"
                      style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      {assumption.category}
                    </span>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">{assumption.content}</h1>
                  </div>
                </div>
                <ShareButton
                  url={shareUrl}
                  title={assumption.content}
                  text={`${assumption.content} — ${assumption.challenge_count} people are debating this on Poddle`}
                  variant="icon"
                  size="sm"
                  className="flex-shrink-0 mt-1"
                  onShare={() => supabase.rpc('increment_assumption_share', { p_assumption_id: assumptionId })}
                />
              </div>
              {assumption.description && (
                <p className="text-blue-200 text-base relative z-10">{assumption.description}</p>
              )}
              {assumption.pods && (
                <div className="mt-4 pt-4 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                  <p className="text-sm text-blue-200">
                    From room: <span className="font-semibold text-white">{assumption.pods.name}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="p-6" style={{ background: 'rgba(239,246,255,0.6)', borderTop: '1px solid rgba(147,197,253,0.3)' }}>
              <div className="flex items-center gap-3 mb-4">
                <LogIn className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Sign in to view details and participate</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Join Poddle to see forecasts, challenges, risks, and scenarios for this insight. You'll also be able to add your own contributions.
              </p>
              <button
                onClick={() => onNavigate('auth')}
                className="w-full px-6 py-3 rounded-xl font-semibold text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
              >
                Sign In or Create Account
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: <TrendingUp className="w-5 h-5 text-blue-600" />, title: 'Forecasts', desc: 'View probability forecasts from members', accent: 'rgba(37,99,235,0.08)' },
              { icon: <MessageSquare className="w-5 h-5 text-orange-500" />, title: 'Challenges', desc: 'See how members challenge this insight', accent: 'rgba(249,115,22,0.08)' },
              { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, title: 'Risks', desc: 'Explore potential risks and concerns', accent: 'rgba(239,68,68,0.08)' },
              { icon: <Layers className="w-5 h-5 text-emerald-600" />, title: 'Scenarios', desc: 'Discover future scenarios if this holds true', accent: 'rgba(16,185,129,0.08)' },
            ].map(({ icon, title, desc, accent }) => (
              <div
                key={title}
                className="rounded-xl p-6"
                style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent }}>
                    {icon}
                  </div>
                  <h3 className="font-bold text-slate-900">{title}</h3>
                </div>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all";
  const inputStyle = { border: '1px solid rgba(15,23,42,0.12)', background: 'rgba(255,255,255,0.8)' };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ color: '#475569', background: 'rgba(255,255,255,0.7)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1e293b'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.7)'; }}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {showShareCard && (
          <ShareableInsightCard
            type="assumption"
            title={assumption.content}
            content={assumption.description || assumption.content}
            authorName={assumption.profiles?.full_name || undefined}
            podName={assumption.pods?.name}
            stat={avgProbability !== null ? { label: `avg. confidence · ${forecasts.length} forecasts`, value: `${avgProbability}%` } : undefined}
            shareUrl={shareUrl}
            onClose={() => setShowShareCard(false)}
          />
        )}

        {/* Main insight card */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 8px 24px rgba(16,185,129,0.08)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <span
              className="inline-block px-3 py-1 rounded-lg text-xs font-semibold border"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              {assumption.category}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {assumption.view_count > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                  <Eye className="w-3.5 h-3.5" />
                  {assumption.view_count} views
                </div>
              )}
              <button
                onClick={() => setShowShareCard(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.15)' }}
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{assumption.content}</h1>
          {assumption.description && (
            <p className="text-slate-600 mb-4">{assumption.description}</p>
          )}
          {(challenges.length > 0 || forecasts.length > 0) && (
            <div className="flex items-center gap-4 py-3 mb-2" style={{ borderTop: '1px solid rgba(226,232,240,0.7)' }}>
              {forecasts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">{forecasts.length} forecast{forecasts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {challenges.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-slate-700">{challenges.length} challenge{challenges.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {assumption.share_count > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">shared {assumption.share_count}×</span>
                </div>
              )}
            </div>
          )}
          {assumption.pods && (
            <div className="flex items-center gap-2 text-sm text-slate-500 pt-3" style={{ borderTop: '1px solid rgba(226,232,240,0.7)' }}>
              <span>From room:</span>
              <span className="font-semibold text-slate-700">{assumption.pods.name}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Forecasts */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
          >
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              Forecasts
            </h3>
            {avgProbability !== null && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(219,234,254,0.7),rgba(191,219,254,0.4))', border: '1px solid rgba(147,197,253,0.4)' }}>
                <div className="text-3xl font-bold text-blue-700 mb-1">{avgProbability}%</div>
                <div className="text-sm text-blue-600">Average confidence from {forecasts.length} forecast{forecasts.length !== 1 ? 's' : ''}</div>
              </div>
            )}
            {isMember && (
              <form onSubmit={addForecast} className="space-y-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Probability: {newForecast.probability}%
                  </label>
                  <input type="range" min="0" max="100" value={newForecast.probability} onChange={(e) => setNewForecast({ ...newForecast, probability: parseInt(e.target.value) })} className="w-full accent-blue-500" />
                </div>
                <textarea value={newForecast.justification} onChange={(e) => setNewForecast({ ...newForecast, justification: e.target.value })} className={`${inputClass} focus:ring-blue-400`} style={inputStyle} placeholder="What's your reasoning for this probability?" rows={2} required />
                <input type="url" value={newForecast.reference_url} onChange={(e) => setNewForecast({ ...newForecast, reference_url: e.target.value })} className={`${inputClass} focus:ring-blue-400`} style={inputStyle} placeholder="Reference URL (optional)" />
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 3px 10px rgba(37,99,235,0.3)' }}>
                  <ThumbsUp className="w-3.5 h-3.5 inline mr-1.5" />
                  Add Forecast
                </button>
              </form>
            )}
            {forecasts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No forecasts yet</p>
            ) : (
              <div className="space-y-2">
                {forecasts.map((forecast) => (
                  <div key={forecast.id} className="p-3 rounded-lg" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}>
                    <div className="font-bold text-blue-700 mb-1">{forecast.probability}%</div>
                    <p className="text-xs text-slate-600">{forecast.justification}</p>
                    {forecast.reference_url && (
                      <a href={forecast.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 underline flex items-center gap-1 mt-1">
                        <LinkIcon className="w-3 h-3" />Reference
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Challenges */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
          >
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <MessageSquare className="w-4 h-4 text-orange-500" />
              </div>
              Challenges
            </h3>
            {isMember && (
              <form onSubmit={addChallenge} className="space-y-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
                <textarea value={newChallenge} onChange={(e) => setNewChallenge(e.target.value)} className={`${inputClass} focus:ring-orange-400`} style={inputStyle} placeholder="What could go wrong? Challenge this insight..." rows={2} required />
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 3px 10px rgba(249,115,22,0.3)' }}>
                  Add Challenge
                </button>
              </form>
            )}
            {challenges.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No challenges yet</p>
            ) : (
              <div className="space-y-2">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className="p-3 rounded-lg" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{challenge.profiles?.full_name || 'Anonymous'}</div>
                    <p className="text-sm text-slate-700">{challenge.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risks */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
          >
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              Risks
            </h3>
            {isMember && (
              <form onSubmit={addRisk} className="space-y-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
                <textarea value={newRisk.description} onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })} className={`${inputClass} focus:ring-red-400`} style={inputStyle} placeholder="Describe the risk..." rows={3} required />
                <input type="url" value={newRisk.reference_url} onChange={(e) => setNewRisk({ ...newRisk, reference_url: e.target.value })} className={`${inputClass} focus:ring-red-400`} style={inputStyle} placeholder="Reference URL (optional)" />
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Severity: {newRisk.severity}/5</label>
                  <input type="range" min="1" max="5" value={newRisk.severity} onChange={(e) => setNewRisk({ ...newRisk, severity: parseInt(e.target.value) })} className="w-full accent-red-500" />
                </div>
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 3px 10px rgba(239,68,68,0.3)' }}>
                  Add Risk
                </button>
              </form>
            )}
            {risks.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No risks identified yet</p>
            ) : (
              <div className="space-y-2">
                {risks.map((risk) => (
                  <div key={risk.id} className="p-3 rounded-lg" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-xs font-semibold text-slate-500">{risk.profiles?.full_name || 'Anonymous'}</div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div key={level} className={`w-2 h-2 rounded-full ${level <= risk.severity ? 'bg-red-500' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-900">{risk.description}</p>
                    {risk.reference_url && (
                      <a href={risk.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 underline flex items-center gap-1 mt-1">
                        <LinkIcon className="w-3 h-3" />Reference
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scenarios */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
          >
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              Scenarios
            </h3>
            {isMember && (
              <form onSubmit={addScenario} className="space-y-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
                <textarea value={newScenario.description} onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })} className={`${inputClass} focus:ring-emerald-400`} style={inputStyle} placeholder="Describe what would happen if this insight holds true..." rows={3} required />
                <input type="url" value={newScenario.reference_url} onChange={(e) => setNewScenario({ ...newScenario, reference_url: e.target.value })} className={`${inputClass} focus:ring-emerald-400`} style={inputStyle} placeholder="Reference URL (optional)" />
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}>
                  Add Scenario
                </button>
              </form>
            )}
            {scenarios.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No scenarios yet</p>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div key={scenario.id} className="p-3 rounded-lg" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{scenario.profiles?.full_name || 'Anonymous'}</div>
                    <p className="text-sm text-slate-900">{scenario.description}</p>
                    {scenario.reference_url && (
                      <a href={scenario.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 underline flex items-center gap-1 mt-1">
                        <LinkIcon className="w-3 h-3" />Reference
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
