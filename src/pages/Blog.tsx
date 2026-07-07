import { useState, useEffect } from 'react';
import { ArrowRight, Clock, Calendar, Tag, Sparkles, ChevronRight, Search, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  external_url: string | null;
  category: string;
  author_name: string;
  author_avatar_url: string | null;
  reading_time_minutes: number;
  is_featured: boolean;
  published_at: string;
  view_count: number;
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  'product-update': { label: 'Product Update', color: '#1d4ed8', bg: 'rgba(37,99,235,0.08)' },
  'company':        { label: 'Company',         color: '#0f172a', bg: 'rgba(15,23,42,0.06)' },
  'feature':        { label: 'Feature',         color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
  'use-case':       { label: 'Use Case',        color: '#b45309', bg: 'rgba(245,158,11,0.08)' },
  'about':          { label: 'About Us',        color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
};

const ALL_CATS = [
  { id: 'all', label: 'All Posts' },
  { id: 'product-update', label: 'Product Updates' },
  { id: 'feature', label: 'Features' },
  { id: 'use-case', label: 'Use Cases' },
  { id: 'company', label: 'Company' },
  { id: 'about', label: 'About Us' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] || CATEGORY_META['company'];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: meta.bg, color: meta.color }}>
      <Tag className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

function PostCard({ post, onNavigate, featured = false }: { post: BlogPost; onNavigate: (slug: string) => void; featured?: boolean }) {
  const hasImage = !!post.cover_image_url;
  const handleClick = () => {
    if (post.external_url) {
      window.open(post.external_url, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate(post.slug);
    }
  };

  if (featured) {
    return (
      <div
        onClick={handleClick}
        className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
        style={{ background: '#0f172a', minHeight: '440px' }}
      >
        {hasImage && (
          <img src={post.cover_image_url!} alt={post.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500"
            loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/20" />
        <div className="relative p-8 flex flex-col justify-end h-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
              <Sparkles className="w-3 h-3" /> Featured
            </span>
            <CategoryBadge category={post.category} />
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-3 group-hover:text-blue-200 transition-colors">
            {post.title}
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-6 line-clamp-2">{post.excerpt}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {post.author_avatar_url ? (
                <img src={post.author_avatar_url} alt={post.author_name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {post.author_name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{post.author_name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(post.published_at)}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3" />
                  <span>{post.reading_time_minutes} min read</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-blue-300 group-hover:text-blue-200 transition-colors">
              {post.external_url ? (
                <><ExternalLink className="w-4 h-4" /> Visit link</>
              ) : (
                <>Read more <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-slate-200"
    >
      {hasImage ? (
        <div className="h-44 overflow-hidden">
          <img src={post.cover_image_url!} alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy" />
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f8fafc,#e2e8f0)' }}>
          <Sparkles className="w-10 h-10 text-slate-300" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CategoryBadge category={post.category} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div className="flex items-center gap-2">
            {post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt={post.author_name}
                className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                {post.author_name[0]}
              </div>
            )}
            <span className="text-xs font-medium text-slate-600">{post.author_name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{post.reading_time_minutes} min</span>
            <span>·</span>
            <span>{formatDate(post.published_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BlogProps {
  onNavigate: (page: string, slug?: string) => void;
  initialSlug?: string | null;
}

export default function Blog({ onNavigate, initialSlug }: BlogProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialSlug) {
      onNavigate('blog-post', initialSlug);
      return;
    }
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('id,slug,title,excerpt,cover_image_url,external_url,category,author_name,author_avatar_url,reading_time_minutes,is_featured,published_at,view_count')
      .eq('is_published', true)
      .order('published_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  const featured = posts.find(p => p.is_featured);
  const filtered = posts
    .filter(p => !p.is_featured || category !== 'all')
    .filter(p => category === 'all' || p.category === category)
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#0f172a' }}>
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-8">
            <button onClick={() => onNavigate('home')} className="hover:text-white transition-colors">Home</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Blog</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">Poddle Blog</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Insights from the<br />
            <span className="text-blue-400">strategic frontier</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
            Product updates, company news, feature deep-dives, and the thinking behind Poddle.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search posts..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_CATS.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: category === c.id ? '#0f172a' : 'white',
                  color: category === c.id ? 'white' : '#64748b',
                  border: `1px solid ${category === c.id ? '#0f172a' : '#e2e8f0'}`,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-slate-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                  <div className="h-5 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded" />
                  <div className="h-4 bg-slate-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No posts yet</h3>
            <p className="text-slate-400">Check back soon for insights and updates.</p>
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featured && category === 'all' && !search && (
              <div className="mb-10">
                <PostCard post={featured} featured onNavigate={slug => onNavigate('blog-post', slug)} />
              </div>
            )}

            {/* Grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(post => (
                  <PostCard key={post.id} post={post} onNavigate={slug => onNavigate('blog-post', slug)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-slate-400 font-medium">No posts match your filter.</p>
                <button onClick={() => { setCategory('all'); setSearch(''); }}
                  className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700">
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-slate-100 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h3 className="text-xl font-black text-slate-900 mb-2">Ready to think sharper?</h3>
          <p className="text-slate-500 mb-6">Join forward-thinking leaders using Poddle to make better decisions.</p>
          <button
            onClick={() => onNavigate('auth')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
