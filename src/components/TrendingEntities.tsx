import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, AlertTriangle, Lightbulb, MessageSquare, ChevronRight, Flame } from 'lucide-react';

interface TrendingItem {
  id: string;
  type: 'problem' | 'idea' | 'prediction';
  content: string;
  challengeCount: number;
}

interface TrendingEntitiesProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
}

const TYPE_CONFIG = {
  problem: {
    icon: AlertTriangle,
    label: 'Problem',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
  idea: {
    icon: Lightbulb,
    label: 'Idea',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  prediction: {
    icon: TrendingUp,
    label: 'Prediction',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
};

export default function TrendingEntities({ onNavigate }: TrendingEntitiesProps) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: challenges } = await supabase
        .from('entity_challenges')
        .select('entity_id, entity_type')
        .gte('created_at', sevenDaysAgo);

      if (!challenges || challenges.length === 0) {
        await loadFallback();
        return;
      }

      const counts = new Map<string, { entity_type: string; count: number }>();
      challenges.forEach(c => {
        const existing = counts.get(c.entity_id);
        if (existing) existing.count++;
        else counts.set(c.entity_id, { entity_type: c.entity_type, count: 1 });
      });

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      const byType: Record<string, string[]> = {};
      sorted.forEach(([id, { entity_type }]) => {
        if (!byType[entity_type]) byType[entity_type] = [];
        byType[entity_type].push(id);
      });

      const fetched: TrendingItem[] = [];

      for (const [type, ids] of Object.entries(byType)) {
        const table = type === 'problem' ? 'problems' : type === 'idea' ? 'ideas' : 'predictions';
        const { data: entities } = await supabase
          .from(table)
          .select('id, content')
          .in('id', ids);

        (entities || []).forEach(entity => {
          const entry = counts.get(entity.id);
          if (entry) {
            fetched.push({ id: entity.id, type: type as TrendingItem['type'], content: entity.content, challengeCount: entry.count });
          }
        });
      }

      fetched.sort((a, b) => b.challengeCount - a.challengeCount);
      setItems(fetched.slice(0, 5));

      if (fetched.length === 0) await loadFallback();
    } catch {
      await loadFallback();
    } finally {
      setLoading(false);
    }
  }

  async function loadFallback() {
    try {
      const [{ data: problems }, { data: ideas }, { data: predictions }] = await Promise.all([
        supabase.from('problems').select('id, content').order('created_at', { ascending: false }).limit(2),
        supabase.from('ideas').select('id, content').order('created_at', { ascending: false }).limit(2),
        supabase.from('predictions').select('id, content').order('created_at', { ascending: false }).limit(1),
      ]);

      const fallback: TrendingItem[] = [
        ...(problems || []).map(p => ({ id: p.id, type: 'problem' as const, content: p.content, challengeCount: 0 })),
        ...(ideas || []).map(i => ({ id: i.id, type: 'idea' as const, content: i.content, challengeCount: 0 })),
        ...(predictions || []).map(p => ({ id: p.id, type: 'prediction' as const, content: p.content, challengeCount: 0 })),
      ];

      setItems(fallback.slice(0, 5));
    } catch {
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100">
          <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-slate-800">Trending this week</span>
      </div>

      <div className="divide-y divide-slate-50">
        {items.map((item, idx) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          const title = item.content.split('\n\n')[0]?.trim() || item.content.slice(0, 100);

          return (
            <button
              key={item.id}
              onClick={() => { window.location.hash = `entity/${item.type}/${item.id}`; }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xs font-bold text-slate-400 mt-0.5 w-4 flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {config.label}
                    </div>
                    {item.challengeCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {item.challengeCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-snug line-clamp-2 group-hover:text-slate-900 transition-colors">
                    {title}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onNavigate('reasoning')}
        className="w-full px-4 py-3 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 border-t border-slate-100"
      >
        Explore Reasoning Hub
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
