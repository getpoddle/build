import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Calendar, Tag, Eye, Share2, ChevronRight, Sparkles, ArrowRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';

interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  author_name: string;
  author_avatar_url: string | null;
  reading_time_minutes: number;
  is_featured: boolean;
  published_at: string;
  view_count: number;
}

interface RelatedPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  reading_time_minutes: number;
  published_at: string;
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  'product-update': { label: 'Product Update', color: '#1d4ed8', bg: 'rgba(37,99,235,0.08)' },
  'company':        { label: 'Company',         color: '#0f172a', bg: 'rgba(15,23,42,0.06)' },
  'feature':        { label: 'Feature',         color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
  'use-case':       { label: 'Use Case',        color: '#b45309', bg: 'rgba(245,158,11,0.08)' },
  'about':          { label: 'About Us',        color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

interface BlogPostProps {
  slug: string;
  onNavigate: (page: string, slug?: string) => void;
}

export default function BlogPost({ slug, onNavigate }: BlogPostProps) {
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPost();
  }, [slug]);

  async function loadPost() {
    setLoading(true);
    setNotFound(false);

    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPost(data);

    // Fire-and-forget view count
    supabase.rpc('increment_blog_view_count', { post_slug: slug }).then(() => {});

    // Load related posts
    const { data: relData } = await supabase
      .from('blog_posts')
      .select('slug,title,excerpt,category,reading_time_minutes,published_at')
      .eq('is_published', true)
      .eq('category', data.category)
      .neq('slug', slug)
      .order('published_at', { ascending: false })
      .limit(3);
    setRelated(relData || []);

    // SEO
    document.title = `${data.title} — Poddle Blog`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', data.excerpt);

    setLoading(false);
  }

  function handleShare() {
    const url = `https://blog.poddleme.com/blog/${slug}`;
    if (navigator.share) {
      navigator.share({ title: post?.title, text: post?.excerpt, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#f8fafc' }}>
        <div className="max-w-3xl mx-auto px-4 py-16 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-32 mb-8" />
          <div className="h-8 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-8 bg-slate-200 rounded w-1/2 mb-8" />
          <div className="h-64 bg-slate-200 rounded-2xl mb-8" />
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-slate-200 rounded" style={{ width: `${80 + Math.random() * 20}%` }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Post not found</h2>
          <p className="text-slate-500 mb-6">This article doesn't exist or has been unpublished.</p>
          <button onClick={() => onNavigate('blog')}
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </button>
        </div>
      </div>
    );
  }

  const catMeta = CATEGORY_META[post.category] || CATEGORY_META['company'];

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* Hero */}
      <div style={{ background: '#0f172a' }}>
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-8">
            <button onClick={() => onNavigate('home')} className="hover:text-white transition-colors">Home</button>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => onNavigate('blog')} className="hover:text-white transition-colors">Blog</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white truncate max-w-[160px]">{post.title}</span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: catMeta.bg, color: catMeta.color }}>
              <Tag className="w-2.5 h-2.5" />{catMeta.label}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">{post.excerpt}</p>

          {/* Author + meta */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {post.author_avatar_url ? (
                <img src={post.author_avatar_url} alt={post.author_name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {post.author_name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{post.author_name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.reading_time_minutes} min read</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: copied ? '#86efac' : 'white', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? 'Link copied!' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Cover image */}
      {post.cover_image_url && (
        <div className="max-w-3xl mx-auto px-4 -mt-1">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full rounded-2xl object-cover shadow-2xl"
            style={{ maxHeight: '400px' }}
            loading="lazy"
          />
        </div>
      )}

      {/* Article body */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article
          className="prose-blog"
          style={{
            fontSize: '17px',
            lineHeight: '1.8',
            color: '#1e293b',
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div className="border-t border-slate-100" style={{ background: 'white' }}>
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h3 className="text-lg font-black text-slate-900 mb-6">More from this category</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map(r => {
                const rm = CATEGORY_META[r.category] || CATEGORY_META['company'];
                return (
                  <div
                    key={r.slug}
                    onClick={() => onNavigate('blog-post', r.slug)}
                    className="group bg-white rounded-xl border border-slate-100 p-5 cursor-pointer hover:border-slate-200 hover:shadow-md transition-all"
                  >
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-3"
                      style={{ background: rm.bg, color: rm.color }}>
                      <Tag className="w-2.5 h-2.5" />{rm.label}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">
                      {r.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{r.excerpt}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />{r.reading_time_minutes} min · {formatDate(r.published_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-8 flex items-center justify-between">
          <button
            onClick={() => onNavigate('blog')}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All posts
          </button>
          <button
            onClick={() => onNavigate('auth')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            Try Poddle free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
