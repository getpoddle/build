import { useState } from 'react';
import { Lightbulb, TrendingUp, X, Download, Share2, Bot } from 'lucide-react';
import ShareButton from './ShareButton';

interface ShareableInsightCardProps {
  type: 'post' | 'assumption' | 'decision' | 'agent-discussion' | 'prediction';
  title: string;
  content: string;
  authorName?: string;
  podName?: string;
  stat?: { label: string; value: string | number };
  shareUrl: string;
  agentNames?: string[];
  onClose?: () => void;
}

export default function ShareableInsightCard({
  type,
  title,
  content,
  authorName,
  podName,
  stat,
  shareUrl,
  agentNames,
  onClose,
}: ShareableInsightCardProps) {
  const [shareCount, setShareCount] = useState(0);

  const typeConfig = {
    post: { label: 'Post', color: 'from-blue-600 to-cyan-500', icon: <Lightbulb className="w-5 h-5 text-white" />, bg: 'from-slate-900 via-blue-950 to-slate-900' },
    assumption: { label: 'Insight', color: 'from-emerald-600 to-teal-500', icon: <Lightbulb className="w-5 h-5 text-white" />, bg: 'from-slate-900 via-emerald-950 to-slate-900' },
    decision: { label: 'Decision Thread', color: 'from-blue-600 to-cyan-500', icon: <TrendingUp className="w-5 h-5 text-white" />, bg: 'from-slate-900 via-blue-950 to-slate-900' },
    'agent-discussion': { label: 'AI Discussion', color: 'from-slate-700 to-slate-500', icon: <Bot className="w-5 h-5 text-white" />, bg: 'from-slate-900 via-slate-800 to-slate-900' },
    prediction: { label: 'Prediction', color: 'from-blue-600 to-cyan-500', icon: <TrendingUp className="w-5 h-5 text-white" />, bg: 'from-slate-900 via-blue-950 to-slate-900' },
  };

  const cfg = typeConfig[type];
  const truncatedContent = content.length > 160 ? content.slice(0, 157) + '...' : content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          )}

          <div
            id="shareable-card"
            className={`rounded-3xl overflow-hidden bg-gradient-to-br ${cfg.bg}`}
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
          >
            <div className="relative p-6 pb-4">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                  {cfg.icon}
                </div>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${cfg.color} bg-clip-text text-transparent`}>
                    {cfg.label}
                  </span>
                  {podName && (
                    <p className="text-xs text-slate-400 mt-0.5">{podName}</p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-400 font-medium">Live</span>
                </div>
              </div>

              {title && title !== content && (
                <h2 className="text-lg font-black text-white leading-snug mb-2">{title}</h2>
              )}

              <p className="text-slate-200 text-sm leading-relaxed">{truncatedContent}</p>

              {agentNames && agentNames.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex -space-x-1.5">
                    {agentNames.slice(0, 3).map((name, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-400 border-2 border-slate-800 flex items-center justify-center text-white text-xs font-bold">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    {agentNames.slice(0, 2).join(' & ')}
                    {agentNames.length > 2 ? ` & ${agentNames.length - 2} more` : ''}
                  </span>
                </div>
              )}

              {authorName && !agentNames?.length && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-400">{authorName}</span>
                </div>
              )}
            </div>

            {stat && (
              <div className="mx-6 mb-4 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-slate-400 font-medium">{stat.label}</div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <span className="text-white text-xs font-black">P</span>
                </div>
                <span className="text-sm font-bold text-white">Poddle</span>
                <span className="text-xs text-slate-500">poddleme.com</span>
              </div>
              <span className="text-xs text-slate-500 font-mono truncate max-w-24">{shareUrl.split('/').pop()}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 border border-slate-200" style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}>
          <p className="text-sm font-semibold text-slate-700 mb-3 text-center">Share this insight</p>
          <div className="flex items-center gap-2">
            <ShareButton
              url={shareUrl}
              title={title || content.slice(0, 80)}
              text={`${content.slice(0, 120)}... — via Poddle`}
              variant="full"
              className="flex-1 justify-center"
              onShare={() => setShareCount(c => c + 1)}
            />
            {shareCount > 0 && (
              <div className="flex items-center gap-1 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-600 font-bold text-sm">{shareCount}</span>
                <span className="text-emerald-500 text-xs">shared</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">Screenshot the card above to share on Instagram, TikTok</p>
        </div>
      </div>
    </div>
  );
}
