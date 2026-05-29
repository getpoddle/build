import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface PostAIInsightData {
  id: string;
  post_id: string;
  insight_type: 'assumption' | 'contradiction';
  insight_text: string;
  confidence_score: number;
  generated_at: string;
}

interface PostAIInsightProps {
  postId: string;
  postContent: string;
  podNames?: string[];
}

export default function PostAIInsight({ postId, postContent, podNames }: PostAIInsightProps) {
  const [insight, setInsight] = useState<PostAIInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const loadInsight = useCallback(async () => {
    const { data } = await supabase
      .from('post_ai_insights')
      .select('*')
      .eq('post_id', postId)
      .maybeSingle();
    if (data) {
      setInsight(data as PostAIInsightData);
      setTriggered(true);
    }
  }, [postId]);

  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  const generateInsight = async () => {
    if (loading) return;
    setLoading(true);
    setTriggered(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let token = session.access_token;
      const expiresAt = session.expires_at ?? 0;
      if (Math.floor(Date.now() / 1000) >= expiresAt - 60) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? token;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'analyze-post',
          postId,
          postContent,
          podNames: podNames || [],
        }),
      });

      if (!response.ok) throw new Error('Failed to generate insight');
      const result = await response.json();
      if (result.insight) {
        setInsight(result.insight as PostAIInsightData);
        setExpanded(true);
      }
    } catch (err) {
      console.error('Error generating post insight:', err);
      setTriggered(false);
    } finally {
      setLoading(false);
    }
  };

  if (postContent.trim().length < 30) return null;

  if (!triggered && !insight) {
    return (
      <button
        onClick={generateInsight}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors mt-1 group"
      >
        <Sparkles className="w-3.5 h-3.5 group-hover:text-blue-500" />
        <span>AI insight</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Analysing post...</span>
      </div>
    );
  }

  if (!insight) return null;

  const isAssumption = insight.insight_type === 'assumption';
  const confidenceLabel = insight.confidence_score >= 80 ? 'High' : insight.confidence_score >= 65 ? 'Moderate' : 'Low';

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isAssumption
            ? 'bg-blue-50 hover:bg-blue-100 border border-blue-100'
            : 'bg-amber-50 hover:bg-amber-100 border border-amber-100'
        }`}
      >
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          isAssumption ? 'bg-blue-100' : 'bg-amber-100'
        }`}>
          {isAssumption ? (
            <Sparkles className="w-3 h-3 text-blue-600" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-semibold ${isAssumption ? 'text-blue-700' : 'text-amber-700'}`}>
            {isAssumption ? 'Hidden assumption' : 'Contradiction spotted'}
          </span>
          <span className={`ml-2 text-xs ${isAssumption ? 'text-blue-500' : 'text-amber-500'}`}>
            {confidenceLabel} confidence
          </span>
        </div>
        <div className={`flex-shrink-0 ${isAssumption ? 'text-blue-400' : 'text-amber-400'}`}>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className={`px-3 py-2.5 rounded-b-lg text-xs leading-relaxed border-x border-b ${
          isAssumption
            ? 'bg-blue-50 text-blue-900 border-blue-100'
            : 'bg-amber-50 text-amber-900 border-amber-100'
        }`}>
          {insight.insight_text}
        </div>
      )}
    </div>
  );
}
